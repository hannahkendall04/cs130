import unittest
from unittest.mock import patch

from app.filters.categories import FilterCategory
from app.filters.detector import (
    SubtitleBlock,
    _compile_patterns,
    _merge_skip_ranges,
    _parse_gemini_json,
    analyze_subtitles,
)
from app.filters.skip_range import SkipRange


class TestDetectorHelpers(unittest.TestCase):
    def test_compile_patterns_word_boundaries(self):
        patterns = _compile_patterns(["gun", "pull the trigger"])
        self.assertEqual(len(patterns), 2)

        self.assertIsNotNone(patterns[0].search("He has a gun"))
        self.assertIsNone(patterns[0].search("shotgun"))
        self.assertIsNotNone(patterns[1].search("Please pull the trigger now"))

    def test_parse_gemini_json_handles_fences_and_prose(self):
        text = "Result:\n```json\n{\"flagged\": [{\"index\": 0, \"categories\": [\"PROFANITY\"]}]}\n```"
        parsed = _parse_gemini_json(text)
        self.assertEqual(parsed["flagged"][0]["index"], 0)

    def test_parse_gemini_json_returns_empty_dict_when_unparseable(self):
        self.assertEqual(_parse_gemini_json("not json"), {})

    def test_merge_skip_ranges_merges_when_within_gap(self):
        ranges = [
            SkipRange.from_ms(1000, 2000, FilterCategory.VIOLENCE.value),
            SkipRange.from_ms(2200, 3000, FilterCategory.VIOLENCE.value),
            SkipRange.from_ms(1000, 1500, FilterCategory.WEAPONS.value),
        ]

        merged = _merge_skip_ranges(ranges, gap_ms=300)

        self.assertEqual(len(merged), 2)
        violence = [r for r in merged if r.category == FilterCategory.VIOLENCE.value][0]
        self.assertEqual((violence.time_range.start.ms, violence.time_range.end.ms), (1000, 3000))


class TestAnalyzeSubtitlesFallback(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_subtitles_uses_keyword_fallback_and_merges(self):
        blocks = [
            SubtitleBlock(0, 1000, "I have a gun"),
            SubtitleBlock(1200, 1800, "Drop the weapon now"),
            SubtitleBlock(5000, 6000, "This is clean dialogue"),
            SubtitleBlock(7000, 7500, ""),  # ignored empty
            SubtitleBlock(8000, 7900, "bad range"),  # ignored invalid range
        ]

        with patch("app.filters.detector.GEMINI_API_KEY", None):
            result = await analyze_subtitles(
                blocks,
                enabled_categories={FilterCategory.WEAPONS},
                merge_gap_ms=300,
            )

        self.assertEqual(len(result), 1)
        only = result[0]
        self.assertEqual(only.category, FilterCategory.WEAPONS.value)
        self.assertEqual((only.time_range.start.ms, only.time_range.end.ms), (0, 1800))

    async def test_analyze_subtitles_multi_label_controls_single_vs_multi(self):
        blocks = [SubtitleBlock(0, 1000, "I will kill you with this gun")]

        with patch("app.filters.detector.GEMINI_API_KEY", None):
            single = await analyze_subtitles(
                blocks,
                enabled_categories={FilterCategory.WEAPONS, FilterCategory.VIOLENCE},
                multi_label=False,
            )
            multi = await analyze_subtitles(
                blocks,
                enabled_categories={FilterCategory.WEAPONS, FilterCategory.VIOLENCE},
                multi_label=True,
            )

        self.assertEqual(len(single), 1)
        self.assertEqual(len(multi), 2)


if __name__ == "__main__":
    unittest.main()
