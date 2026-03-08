from __future__ import annotations

import asyncio
import os
import json
import re
from dataclasses import dataclass
from typing import AsyncGenerator, Iterable, List, Optional, Set, Tuple

from dotenv import load_dotenv
import google.generativeai as genai

from app.filters.timestamp import Timestamp, TimeRange
from app.filters.skip_range import SkipRange
from app.filters.categories import (
    FilterCategory,
    DEFAULT_KEYWORDS,
    DEFAULT_MERGE_GAP_MS,
)
from app.filters.prompts import get_content_analysis_prompt

# Load environment variables from .env file
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Number of subtitle blocks to send per Gemini API call.
# Gemini 2.5 Flash supports 1M token context — 500 blocks fits comfortably.
CHUNK_SIZE = 200

# Max concurrent Gemini API requests to avoid rate limits
MAX_CONCURRENT = 5


@dataclass(frozen=True)
class SubtitleBlock:
    """
    Minimal subtitle block with timestamps in ms.
    """
    start_ms: int
    end_ms: int
    text: str

    def clean_text(self) -> str:
        return (self.text or "").strip()


def _compile_patterns(keywords: list[str]) -> list[re.Pattern]:
    """
    - Whole-word match for single words to reduce false positives
    - Phrase match for multi-word phrases
    """
    patterns: list[re.Pattern] = []
    for kw in keywords:
        kw = kw.strip()
        if not kw:
            continue
        if " " in kw:
            patterns.append(re.compile(re.escape(kw), re.IGNORECASE))
        else:
            patterns.append(re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE))
    return patterns


def _merge_skip_ranges(
    ranges: list[SkipRange],
    gap_ms: int = DEFAULT_MERGE_GAP_MS
) -> list[SkipRange]:
    """
    Merge SkipRanges of the same category if they overlap OR are within gap_ms.
    """
    if not ranges:
        return []

    ranges_sorted = sorted(
        ranges,
        key=lambda r: (r.category, r.time_range.start.ms, r.time_range.end.ms),
    )

    merged: list[SkipRange] = []

    for r in ranges_sorted:
        if not merged:
            merged.append(r)
            continue

        last = merged[-1]

        if last.category != r.category:
            merged.append(r)
            continue

        last_start = last.time_range.start.ms
        last_end = last.time_range.end.ms
        curr_start = r.time_range.start.ms
        curr_end = r.time_range.end.ms

        # Overlap OR close enough (including touching)
        if curr_start <= last_end + gap_ms:
            new_start = min(last_start, curr_start)
            new_end = max(last_end, curr_end)
            merged[-1] = SkipRange.from_ms(new_start, new_end, last.category)
        else:
            merged.append(r)

    return merged


def _parse_gemini_json(text: str) -> dict:
    """
    Extract and parse JSON from a Gemini response, handling:
    - Markdown code fences (```json ... ```)
    - Leading/trailing whitespace or prose
    """
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```", "", cleaned).strip()

    # Try direct parse first (clean responses)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Fall back: find the first complete {...} object in the text
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    return {}


def _analyze_chunk(
    model,
    chunk: list[SubtitleBlock],
    enabled_cat_names: list[str],
    enabled: Set[FilterCategory],
    multi_label: bool,
) -> list[SkipRange]:
    """
    Send one batch of subtitle blocks to Gemini and return SkipRanges for flagged entries.
    """
    subtitle_lines = [f"[{i}] {b.text}" for i, b in enumerate(chunk)]
    prompt = get_content_analysis_prompt(subtitle_lines, enabled_cat_names)

    try:
        response = model.generate_content(prompt)
        result = _parse_gemini_json(response.text.strip())
    except Exception as e:
        print(f"Gemini API error for chunk of {len(chunk)} subtitles: {e}")
        raise  # re-raise so the caller knows something went wrong

    flagged = result.get("flagged", [])
    if not isinstance(flagged, list):
        print(f"Unexpected 'flagged' format from Gemini: {flagged!r}")
        return []

    hits: list[SkipRange] = []
    for item in flagged:
        idx = item.get("index")
        categories = item.get("categories", [])

        if not isinstance(idx, int) or idx < 0 or idx >= len(chunk):
            print(f"Invalid index in Gemini response: {idx!r}")
            continue

        block = chunk[idx]
        for cat_name in categories:
            try:
                cat = FilterCategory(cat_name)
                if cat in enabled:
                    hits.append(SkipRange.from_ms(block.start_ms, block.end_ms, cat.value))
                    if not multi_label:
                        break
            except ValueError:
                print(f"Unrecognized category from Gemini: {cat_name!r}")
                continue

    return hits


async def analyze_subtitles(
    subtitle_blocks: Iterable[SubtitleBlock],
    enabled_categories: Optional[Set[FilterCategory]] = None,
    merge_gap_ms: int = DEFAULT_MERGE_GAP_MS,
    multi_label: bool = False,
) -> list[SkipRange]:
    """
    Gemini-powered analyzer:
    - Batches subtitle blocks into chunks (CHUNK_SIZE per Gemini call)
    - Runs chunks in parallel (up to MAX_CONCURRENT) for speed
    - Falls back to keyword matching if GEMINI_API_KEY is not set.
    - Returns merged SkipRanges for flagged content.
    """
    enabled = enabled_categories or set(DEFAULT_KEYWORDS.keys())

    # Pre-filter: drop empty blocks and invalid time ranges
    blocks = [
        b for b in subtitle_blocks
        if (b.text or "").strip() and b.end_ms > b.start_ms
    ]

    hits: list[SkipRange] = []

    # ── Keyword fallback (no API key) ────────────────────────────────────────
    if not GEMINI_API_KEY:
        print("No GEMINI_API_KEY set — using keyword matching fallback")
        patterns_by_cat = {
            cat: _compile_patterns(DEFAULT_KEYWORDS.get(cat, []))
            for cat in enabled
        }
        for b in blocks:
            text = b.text.strip()
            for cat, patterns in patterns_by_cat.items():
                if not patterns:
                    continue
                if any(p.search(text) for p in patterns):
                    hits.append(SkipRange.from_ms(b.start_ms, b.end_ms, cat.value))
                    if not multi_label:
                        break
        return _merge_skip_ranges(hits, gap_ms=merge_gap_ms)

    # ── Gemini parallel batched analysis ─────────────────────────────────────
    model = genai.GenerativeModel("gemini-2.5-flash")
    enabled_cat_names = [cat.value for cat in enabled]

    total_chunks = (len(blocks) + CHUNK_SIZE - 1) // CHUNK_SIZE
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def process_chunk(chunk_idx: int) -> list[SkipRange]:
        start = chunk_idx * CHUNK_SIZE
        chunk = blocks[start: start + CHUNK_SIZE]
        print(f"Analyzing chunk {chunk_idx + 1}/{total_chunks} ({len(chunk)} blocks)...")

        async with semaphore:
            try:
                # Run blocking Gemini call in a thread to not block the event loop
                chunk_hits = await asyncio.to_thread(
                    _analyze_chunk, model, chunk, enabled_cat_names, enabled, multi_label
                )
                return chunk_hits
            except Exception:
                return []

    # Launch all chunks in parallel (bounded by semaphore)
    results = await asyncio.gather(*[process_chunk(i) for i in range(total_chunks)])

    errors = sum(1 for r in results if not r)
    for chunk_hits in results:
        hits.extend(chunk_hits)

    if errors:
        print(f"Warning: {errors}/{total_chunks} chunks returned no results")

    result = _merge_skip_ranges(hits, gap_ms=merge_gap_ms)
    print(f"analyze_subtitles complete: {len(result)} skip ranges found from {len(blocks)} blocks")
    return result


async def analyze_subtitles_stream(
    subtitle_blocks: Iterable[SubtitleBlock],
    enabled_categories: Optional[Set[FilterCategory]] = None,
    merge_gap_ms: int = DEFAULT_MERGE_GAP_MS,
    multi_label: bool = False,
) -> AsyncGenerator[Tuple[list[SkipRange], int, int, bool], None]:
    """
    Streaming version of analyze_subtitles.
    Yields (chunk_hits, chunk_index, total_chunks, is_final) tuples as each chunk completes.
    The final yield contains the merged result across all chunks.
    Falls back to keyword matching (single yield) if no API key.
    """
    enabled = enabled_categories or set(DEFAULT_KEYWORDS.keys())

    blocks = [
        b for b in subtitle_blocks
        if (b.text or "").strip() and b.end_ms > b.start_ms
    ]

    # ── Keyword fallback ──────────────────────────────────────────────────────
    if not GEMINI_API_KEY:
        print("No GEMINI_API_KEY set — using keyword matching fallback")
        patterns_by_cat = {
            cat: _compile_patterns(DEFAULT_KEYWORDS.get(cat, []))
            for cat in enabled
        }
        hits: list[SkipRange] = []
        for b in blocks:
            text = b.text.strip()
            for cat, patterns in patterns_by_cat.items():
                if not patterns:
                    continue
                if any(p.search(text) for p in patterns):
                    hits.append(SkipRange.from_ms(b.start_ms, b.end_ms, cat.value))
                    if not multi_label:
                        break
        merged = _merge_skip_ranges(hits, gap_ms=merge_gap_ms)
        yield (merged, 1, 1, True)
        return

    # ── Gemini streaming analysis ─────────────────────────────────────────────
    model = genai.GenerativeModel("gemini-2.5-flash")
    enabled_cat_names = [cat.value for cat in enabled]

    total_chunks = (len(blocks) + CHUNK_SIZE - 1) // CHUNK_SIZE
    all_hits: list[SkipRange] = []

    # Process chunk 0 FIRST and yield immediately so the frontend gets results ASAP
    first_chunk = blocks[:CHUNK_SIZE]
    print(f"Analyzing chunk 1/{total_chunks} ({len(first_chunk)} blocks) [eager]...")
    try:
        first_hits = await asyncio.to_thread(
            _analyze_chunk, model, first_chunk, enabled_cat_names, enabled, multi_label
        )
    except Exception:
        first_hits = []

    all_hits.extend(first_hits)

    if total_chunks == 1:
        merged = _merge_skip_ranges(all_hits, gap_ms=merge_gap_ms)
        print(f"analyze_subtitles_stream complete: {len(merged)} skip ranges from {len(blocks)} blocks")
        yield (merged, 1, 1, True)
        return

    # Yield first chunk results immediately (unmerged — frontend uses them right away)
    yield (first_hits, 1, total_chunks, False)

    # Now launch remaining chunks in parallel
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    queue: asyncio.Queue[Tuple[int, list[SkipRange]]] = asyncio.Queue()

    async def process_chunk(chunk_idx: int) -> None:
        start = chunk_idx * CHUNK_SIZE
        chunk = blocks[start: start + CHUNK_SIZE]
        print(f"Analyzing chunk {chunk_idx + 1}/{total_chunks} ({len(chunk)} blocks)...")

        async with semaphore:
            try:
                chunk_hits = await asyncio.to_thread(
                    _analyze_chunk, model, chunk, enabled_cat_names, enabled, multi_label
                )
                await queue.put((chunk_idx, chunk_hits))
            except Exception:
                await queue.put((chunk_idx, []))

    remaining = total_chunks - 1
    tasks = [asyncio.create_task(process_chunk(i)) for i in range(1, total_chunks)]

    completed = 0
    while completed < remaining:
        _idx, chunk_hits = await queue.get()
        completed += 1
        all_hits.extend(chunk_hits)
        is_final = completed == remaining

        if is_final:
            merged = _merge_skip_ranges(all_hits, gap_ms=merge_gap_ms)
            print(f"analyze_subtitles_stream complete: {len(merged)} skip ranges from {len(blocks)} blocks")
            yield (merged, completed + 1, total_chunks, True)
        else:
            yield (chunk_hits, completed + 1, total_chunks, False)

    await asyncio.gather(*tasks)
