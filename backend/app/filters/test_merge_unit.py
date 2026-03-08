import unittest

from app.filters.detector import _merge_skip_ranges
from app.filters.skip_range import SkipRange


class TestMergeSkipRanges(unittest.TestCase):
    def test_merge_skip_ranges_empty_input(self):
        self.assertEqual(_merge_skip_ranges([]), [])

    def test_merge_skip_ranges_merges_overlapping_same_category(self):
        ranges = [
            SkipRange.from_ms(1000, 3000, "PROFANITY"),
            SkipRange.from_ms(2500, 5000, "PROFANITY"),
        ]

        merged = _merge_skip_ranges(ranges)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].time_range.start.ms, 1000)
        self.assertEqual(merged[0].time_range.end.ms, 5000)
        self.assertEqual(merged[0].category, "PROFANITY")

    def test_merge_skip_ranges_merges_within_gap_threshold(self):
        ranges = [
            SkipRange.from_ms(1000, 2000, "VIOLENCE"),
            SkipRange.from_ms(2300, 4000, "VIOLENCE"),
        ]

        merged = _merge_skip_ranges(ranges, gap_ms=500)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].time_range.start.ms, 1000)
        self.assertEqual(merged[0].time_range.end.ms, 4000)

    def test_merge_skip_ranges_does_not_merge_beyond_gap_threshold(self):
        ranges = [
            SkipRange.from_ms(1000, 2000, "VIOLENCE"),
            SkipRange.from_ms(2601, 4000, "VIOLENCE"),
        ]

        merged = _merge_skip_ranges(ranges, gap_ms=600)

        self.assertEqual(len(merged), 2)

    def test_merge_skip_ranges_merges_touching_ranges(self):
        ranges = [
            SkipRange.from_ms(1000, 2000, "PROFANITY"),
            SkipRange.from_ms(2000, 3000, "PROFANITY"),
        ]

        merged = _merge_skip_ranges(ranges, gap_ms=0)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].time_range.start.ms, 1000)
        self.assertEqual(merged[0].time_range.end.ms, 3000)

    def test_merge_skip_ranges_does_not_merge_different_categories(self):
        ranges = [
            SkipRange.from_ms(1000, 3000, "PROFANITY"),
            SkipRange.from_ms(2000, 4000, "VIOLENCE"),
        ]

        merged = _merge_skip_ranges(ranges)

        self.assertEqual(len(merged), 2)
        categories = {r.category for r in merged}
        self.assertEqual(categories, {"PROFANITY", "VIOLENCE"})

    def test_merge_skip_ranges_sorts_before_merging(self):
        ranges = [
            SkipRange.from_ms(3000, 5000, "PROFANITY"),
            SkipRange.from_ms(1000, 2500, "PROFANITY"),
            SkipRange.from_ms(2600, 2900, "PROFANITY"),
        ]

        merged = _merge_skip_ranges(ranges, gap_ms=200)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].time_range.start.ms, 1000)
        self.assertEqual(merged[0].time_range.end.ms, 5000)

    def test_merge_skip_ranges_chain_merging(self):
        ranges = [
            SkipRange.from_ms(1000, 2000, "WEAPONS"),
            SkipRange.from_ms(2200, 3000, "WEAPONS"),
            SkipRange.from_ms(3200, 4000, "WEAPONS"),
        ]

        merged = _merge_skip_ranges(ranges, gap_ms=250)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].time_range.start.ms, 1000)
        self.assertEqual(merged[0].time_range.end.ms, 4000)


if __name__ == "__main__":
    unittest.main()