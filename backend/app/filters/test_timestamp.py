import unittest

from app.filters.timestamp import TimeRange, Timestamp


class TestTimestamp(unittest.TestCase):
    def test_from_and_to_seconds_round_trip(self):
        ts = Timestamp.from_seconds(1.234)
        self.assertEqual(ts.ms, 1234)
        self.assertEqual(ts.to_seconds(), 1.234)

    def test_rejects_negative_timestamp(self):
        with self.assertRaises(ValueError):
            Timestamp(-1)


class TestTimeRange(unittest.TestCase):
    def test_duration_and_to_dict(self):
        rng = TimeRange(Timestamp(1000), Timestamp(2500))
        self.assertEqual(rng.duration_ms(), 1500)
        self.assertEqual(rng.to_dict(), {"start_ms": 1000, "end_ms": 2500})

    def test_overlap_and_merge(self):
        a = TimeRange(Timestamp(1000), Timestamp(3000))
        b = TimeRange(Timestamp(2500), Timestamp(5000))

        self.assertTrue(a.overlaps(b))
        merged = a.merge(b)
        self.assertEqual(merged.start.ms, 1000)
        self.assertEqual(merged.end.ms, 5000)

    def test_merge_rejects_non_overlapping_ranges(self):
        a = TimeRange(Timestamp(1000), Timestamp(2000))
        b = TimeRange(Timestamp(2000), Timestamp(3000))

        self.assertFalse(a.overlaps(b))
        with self.assertRaises(ValueError):
            a.merge(b)

    def test_rejects_invalid_range(self):
        with self.assertRaises(ValueError):
            TimeRange(Timestamp(1000), Timestamp(1000))


if __name__ == "__main__":
    unittest.main()
