import unittest
from unittest.mock import patch

from app.filters.categories import FilterCategory
from app.filters.detector import SubtitleBlock, analyze_subtitles


class TestDetectorIntegrationFallback(unittest.IsolatedAsyncioTestCase):
    async def test_detects_multiple_categories_in_fallback_mode(self):
        subs = [
            SubtitleBlock(0, 2000, "Let's go."),
            SubtitleBlock(2000, 4000, "He pulled a gun!"),
            SubtitleBlock(4200, 6000, "I'll kill you!"),
            SubtitleBlock(9000, 11000, "This is bullshit."),
        ]

        with patch("app.filters.detector.GEMINI_API_KEY", None):
            ranges = await analyze_subtitles(
                subs,
                enabled_categories={
                    FilterCategory.WEAPONS,
                    FilterCategory.VIOLENCE,
                    FilterCategory.PROFANITY,
                },
                multi_label=True,
            )

        categories = {r.category for r in ranges}
        self.assertIn(FilterCategory.WEAPONS.value, categories)
        self.assertIn(FilterCategory.VIOLENCE.value, categories)
        self.assertIn(FilterCategory.PROFANITY.value, categories)


if __name__ == "__main__":
    unittest.main()
