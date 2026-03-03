from __future__ import annotations

import os
import json
import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Set

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
    NOTE: TimeRange.merge() requires true overlap, so for "gap merge" we build
    the union range manually.
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


def analyze_subtitles(
    subtitle_blocks: Iterable[SubtitleBlock],
    enabled_categories: Optional[Set[FilterCategory]] = None,
    merge_gap_ms: int = DEFAULT_MERGE_GAP_MS,
    multi_label: bool = False,
) -> list[SkipRange]:
    """
    Gemini-powered analyzer:
    - Uses Gemini to analyze subtitle text for content safety
    - Returns SkipRanges (merged) for flagged content
    - If multi_label=False: each block maps to the first matched category.
      If multi_label=True: a block can produce multiple SkipRanges (one per matched category).
    """
    enabled = enabled_categories or set(DEFAULT_KEYWORDS.keys())
    hits: list[SkipRange] = []

    # Check if API key is configured
    if not GEMINI_API_KEY:
        # Fall back to keyword matching if API key not available
        patterns_by_cat = {
            cat: _compile_patterns(DEFAULT_KEYWORDS.get(cat, []))
            for cat in enabled
        }
        
        for b in subtitle_blocks:
            text = (b.text or "").strip()
            if not text:
                continue
            if b.end_ms <= b.start_ms:
                continue

            matched_any = False
            for cat, patterns in patterns_by_cat.items():
                if not patterns:
                    continue
                if any(p.search(text) for p in patterns):
                    hits.append(SkipRange.from_ms(b.start_ms, b.end_ms, cat.value))
                    matched_any = True
                    if not multi_label:
                        break
        
        return _merge_skip_ranges(hits, gap_ms=merge_gap_ms)

    # Use Gemini for analysis
    model = genai.GenerativeModel("gemini-2.5-flash")
    enabled_cat_names = [cat.value for cat in enabled]
    
    for b in subtitle_blocks:
        text = (b.text or "").strip()
        if not text:
            continue
        if b.end_ms <= b.start_ms:
            continue

        try:
            prompt = get_content_analysis_prompt(text, enabled_cat_names)
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Extract JSON from response
            try:
                # Try to find JSON in the response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                    categories = result.get("categories", [])
                else:
                    categories = []
            except (json.JSONDecodeError, AttributeError):
                categories = []

            # Create skip ranges for matched categories
            matched_any = False
            for cat_name in categories:
                try:
                    cat = FilterCategory(cat_name)
                    if cat in enabled:
                        hits.append(SkipRange.from_ms(b.start_ms, b.end_ms, cat.value))
                        matched_any = True
                        if not multi_label:
                            break
                except ValueError:
                    # Category name not recognized
                    continue

        except Exception as e:
            # If Gemini API fails, log and skip this block
            print(f"Gemini API error analyzing subtitle: {e}")
            continue

    return _merge_skip_ranges(hits, gap_ms=merge_gap_ms)
