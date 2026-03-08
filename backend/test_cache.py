import json
import pytest
from app.filters.skip_range import SkipRange
from app.cache import serialize_skip_ranges


# ---------------------------------------------------------------------------
# Helpers / Fixtures
# ---------------------------------------------------------------------------

def load_skip_ranges(group: str) -> list[SkipRange]:
    with open("testing/test_skip_ranges.json") as f:
        data = json.load(f)
    return [SkipRange.from_ms(**r) for r in data["test_skip_ranges"][group]]


@pytest.fixture
def standard_ranges():
    return load_skip_ranges("standard")


@pytest.fixture
def all_category_ranges():
    return load_skip_ranges("all_categories")


@pytest.fixture
def overlapping_ranges():
    return load_skip_ranges("overlapping_same_category")



# ---------------------------------------------------------------------------
# serialize_skip_ranges
# ---------------------------------------------------------------------------

class TestSerializeSkipRanges:

    def test_returns_list_of_dicts(self, standard_ranges):
        result = serialize_skip_ranges(standard_ranges)
        assert isinstance(result, list)
        assert all(isinstance(r, dict) for r in result)

    def test_dict_has_required_keys(self, standard_ranges):
        result = serialize_skip_ranges(standard_ranges)
        for item in result:
            assert "start_ms" in item
            assert "end_ms" in item
            assert "category" in item

    def test_values_match_input(self, standard_ranges):
        result = serialize_skip_ranges(standard_ranges)
        for original, serialized in zip(standard_ranges, result):
            assert serialized["start_ms"] == original.time_range.start.ms
            assert serialized["end_ms"] == original.time_range.end.ms
            assert serialized["category"] == original.category

    def test_empty_input_returns_empty_list(self):
        result = serialize_skip_ranges([])
        assert result == []

    def test_preserves_order(self, standard_ranges):
        result = serialize_skip_ranges(standard_ranges)
        assert len(result) == len(standard_ranges)

    def test_all_categories_serialized(self, all_category_ranges):
        result = serialize_skip_ranges(all_category_ranges)
        categories = {r["category"] for r in result}
        expected = {
            "PROFANITY", "SEXUAL_CONTENT", "NUDITY", "VIOLENCE", "GORE",
            "SUBSTANCE_USE", "SELF_HARM", "BULLYING", "HATE_SPEECH",
            "CRIMINAL_ACTIVITY", "WEAPONS", "TERROR_THREATS"
        }
        assert categories == expected


    def test_overlapping_ranges_all_included(self, overlapping_ranges):
        result = serialize_skip_ranges(overlapping_ranges)
        assert len(result) == len(overlapping_ranges)

    def test_single_range(self):
        r = SkipRange.from_ms(1000, 5000, "VIOLENCE")
        result = serialize_skip_ranges([r])
        assert result == [{"start_ms": 1000, "end_ms": 5000, "category": "VIOLENCE"}]