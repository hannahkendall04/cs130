import unittest
from unittest.mock import MagicMock, patch

from app.filters.categories import FilterCategory
from app.filters.detector import (
    SubtitleBlock,
    _analyze_chunk,
    analyze_subtitles,
    analyze_subtitles_stream,
    CHUNK_SIZE,
)
from app.filters.skip_range import SkipRange


def _make_mock_model(response_text: str) -> MagicMock:
    """Create a mock Gemini model that returns the given text."""
    model = MagicMock()
    response = MagicMock()
    response.text = response_text
    model.generate_content.return_value = response
    return model


@patch("builtins.print")
class TestGeminiConnection(unittest.IsolatedAsyncioTestCase):

    # ── 1. _analyze_chunk calls Gemini and parses response ────────────────
    def test_analyze_chunk_calls_gemini_and_parses_response(self, _print):
        blocks = [
            SubtitleBlock(0, 1000, "What the fuck"),
            SubtitleBlock(1000, 2000, "Nice weather today"),
        ]
        response_json = '{"flagged": [{"index": 0, "categories": ["PROFANITY"]}]}'
        model = _make_mock_model(response_json)

        hits = _analyze_chunk(
            model, blocks, ["PROFANITY"], {FilterCategory.PROFANITY}, False
        )

        model.generate_content.assert_called_once()
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].category, FilterCategory.PROFANITY.value)
        self.assertEqual(hits[0].time_range.start.ms, 0)
        self.assertEqual(hits[0].time_range.end.ms, 1000)

    # ── 2. _analyze_chunk raises on API error ─────────────────────────────
    def test_analyze_chunk_handles_api_error(self, _print):
        model = MagicMock()
        model.generate_content.side_effect = Exception("API unavailable")
        blocks = [SubtitleBlock(0, 1000, "Hello")]

        with self.assertRaises(Exception, msg="API unavailable"):
            _analyze_chunk(
                model, blocks, ["PROFANITY"], {FilterCategory.PROFANITY}, False
            )

    # ── 3. analyze_subtitles uses Gemini when key is set ──────────────────
    async def test_analyze_subtitles_uses_gemini_when_key_set(self, _print):
        blocks = [SubtitleBlock(0, 1000, "Some dialogue")]
        response_json = '{"flagged": []}'

        mock_model_instance = _make_mock_model(response_json)

        with patch("app.filters.detector.GEMINI_API_KEY", "fake-key"), \
             patch("app.filters.detector.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model_instance

            result = await analyze_subtitles(
                blocks, enabled_categories={FilterCategory.PROFANITY}
            )

        mock_genai.GenerativeModel.assert_called_once_with("gemini-2.5-flash")
        mock_model_instance.generate_content.assert_called_once()
        self.assertEqual(result, [])

    # ── 4. analyze_subtitles chunks large input ───────────────────────────
    async def test_analyze_subtitles_chunks_large_input(self, _print):
        num_blocks = CHUNK_SIZE + 50  # forces 2 chunks
        blocks = [
            SubtitleBlock(i * 1000, (i + 1) * 1000, f"Line {i}")
            for i in range(num_blocks)
        ]
        response_json = '{"flagged": []}'
        mock_model_instance = _make_mock_model(response_json)

        with patch("app.filters.detector.GEMINI_API_KEY", "fake-key"), \
             patch("app.filters.detector.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model_instance

            await analyze_subtitles(
                blocks, enabled_categories={FilterCategory.PROFANITY}
            )

        self.assertEqual(mock_model_instance.generate_content.call_count, 2)

    # ── 5. analyze_subtitles_stream yields results ────────────────────────
    async def test_analyze_subtitles_stream_yields_results(self, _print):
        blocks = [SubtitleBlock(0, 1000, "Hello there")]
        response_json = '{"flagged": []}'
        mock_model_instance = _make_mock_model(response_json)

        with patch("app.filters.detector.GEMINI_API_KEY", "fake-key"), \
             patch("app.filters.detector.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model_instance

            results = []
            async for item in analyze_subtitles_stream(
                blocks, enabled_categories={FilterCategory.PROFANITY}
            ):
                results.append(item)

        self.assertEqual(len(results), 1)
        hits, chunk_idx, total, is_final = results[0]
        self.assertEqual(chunk_idx, 1)
        self.assertEqual(total, 1)
        self.assertTrue(is_final)

    # ── 6. _analyze_chunk ignores invalid categories ──────────────────────
    def test_analyze_chunk_ignores_invalid_categories(self, _print):
        blocks = [SubtitleBlock(0, 1000, "Some text")]
        response_json = '{"flagged": [{"index": 0, "categories": ["FAKE_CATEGORY"]}]}'
        model = _make_mock_model(response_json)

        hits = _analyze_chunk(
            model, blocks, ["PROFANITY"], {FilterCategory.PROFANITY}, False
        )

        self.assertEqual(len(hits), 0)

    # ── 7. analyze_subtitles falls back to keywords on Gemini error ───────
    async def test_analyze_subtitles_falls_back_to_keywords_on_gemini_error(self, _print):
        blocks = [
            SubtitleBlock(0, 1000, "He has a gun"),
            SubtitleBlock(1000, 2000, "Nice weather today"),
        ]

        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.side_effect = Exception("API down")

        with patch("app.filters.detector.GEMINI_API_KEY", "fake-key"), \
             patch("app.filters.detector.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model_instance

            result = await analyze_subtitles(
                blocks, enabled_categories={FilterCategory.WEAPONS}
            )

        # Should have fallen back to keyword matching, finding "gun"
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].category, FilterCategory.WEAPONS.value)
        self.assertEqual(result[0].time_range.start.ms, 0)
        self.assertEqual(result[0].time_range.end.ms, 1000)


if __name__ == "__main__":
    unittest.main()
