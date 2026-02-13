from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Set

from app.filters.timestamp import Timestamp, TimeRange
from app.filters.skip_range import SkipRange
from app.filters.categories import (
    FilterCategory,
    DEFAULT_KEYWORDS,
    DEFAULT_MERGE_GAP_MS,
)



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
    Uses your TimeRange.merge(), which requires overlap, so we "bridge" tiny gaps.
    """
    if not ranges:
        return []

    # Sort by category then time
    ranges_sorted = sorted(ranges, key=lambda r: (r.category, r.time_range.start.ms, r.time_range.end.ms))
    merged: list[SkipRange] = []

    for r in ranges_sorted:
        if not merged:
            merged.append(r)
            continue

        last = merged[-1]

        # Only merge within same category
        if last.category != r.category:
            merged.append(r)
            continue

        last_end = last.time_range.end.ms
        curr_start = r.time_range.start.ms

        # If overlapping, easy
        if last.time_range.overlaps(r.time_range):
            merged[-1] = SkipRange(last.time_range.merge(r.time_range), last.category)
            continue

        # If close enough, bridge gap so TimeRange.merge() is allowed
        if curr_start - last_end <= gap_ms:
            bridge = TimeRange(Timestamp(last_end), Timestamp(curr_start))
            merged_tr = last.time_range.merge(bridge).merge(r.time_range)
            merged[-1] = SkipRange(merged_tr, last.category)
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
    Basic analyzer:
    - scans each subtitle block text against DEFAULT_KEYWORDS
    - returns SkipRanges (merged)
    - If multi_label=False: each block maps to the first matched category.
      If multi_label=True: a block can produce multiple SkipRanges (one per matched category).
    """
    enabled = enabled_categories or set(DEFAULT_KEYWORDS.keys())

    patterns_by_cat = {
        cat: _compile_patterns(DEFAULT_KEYWORDS.get(cat, []))
        for cat in enabled
    }

    hits: list[SkipRange] = []

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

        # (Optional) could track unmatched blocks here if you want debug stats

    return _merge_skip_ranges(hits, gap_ms=merge_gap_ms)
