import unittest

from app.cache import SkipRange


class TestSkipRange(unittest.TestCase):
    def test_from_ms_builds_skip_range(self):
        rng = SkipRange.from_ms(1000, 2500, "PROFANITY")

        self.assertEqual(rng.time_range.start.ms, 1000)
        self.assertEqual(rng.time_range.end.ms, 2500)
        self.assertEqual(rng.category, "PROFANITY")

    def test_duration_returns_range_length(self):
        rng = SkipRange.from_ms(1000, 2500, "PROFANITY")
        self.assertEqual(rng.duration(), 1500)

    def test_overlaps_true_for_overlapping_ranges(self):
        a = SkipRange.from_ms(1000, 3000, "PROFANITY")
        b = SkipRange.from_ms(2500, 5000, "PROFANITY")

        self.assertTrue(a.overlaps(b))

    def test_overlaps_false_for_touching_ranges(self):
        a = SkipRange.from_ms(1000, 2000, "PROFANITY")
        b = SkipRange.from_ms(2000, 3000, "PROFANITY")

        self.assertFalse(a.overlaps(b))

    def test_merge_same_category_overlapping_ranges(self):
        a = SkipRange.from_ms(1000, 3000, "PROFANITY")
        b = SkipRange.from_ms(2500, 5000, "PROFANITY")

        merged = a.merge(b)

        self.assertEqual(merged.time_range.start.ms, 1000)
        self.assertEqual(merged.time_range.end.ms, 5000)
        self.assertEqual(merged.category, "PROFANITY")

    def test_merge_rejects_different_categories(self):
        a = SkipRange.from_ms(1000, 3000, "PROFANITY")
        b = SkipRange.from_ms(2500, 5000, "VIOLENCE")

        with self.assertRaises(ValueError):
            a.merge(b)

    def test_to_dict_includes_category_and_range(self):
        rng = SkipRange.from_ms(1000, 2500, "PROFANITY")

        self.assertEqual(
            rng.to_dict(),
            {
                "start_ms": 1000,
                "end_ms": 2500,
                "category": "PROFANITY",
            },
        )


if __name__ == "__main__":
    unittest.main()