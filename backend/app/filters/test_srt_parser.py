import unittest

from app.filters.srt_parser import _to_ms, parse_srt


class TestSrtParser(unittest.TestCase):
    def test_to_ms_parses_timestamp(self):
        self.assertEqual(_to_ms("01:02:03,004"), 3723004)

    def test_to_ms_rejects_bad_timestamp(self):
        with self.assertRaises(ValueError):
            _to_ms("bad")

    def test_parse_srt_standard_blocks(self):
        srt = """1
00:00:01,000 --> 00:00:02,500
Hello there

2
00:00:03,000 --> 00:00:04,000
General Kenobi
"""
        parsed = parse_srt(srt)
        self.assertEqual(
            parsed,
            [
                (1000, 2500, "Hello there"),
                (3000, 4000, "General Kenobi"),
            ],
        )

    def test_parse_srt_without_blank_lines(self):
        srt = """1
00:00:00,000 --> 00:00:01,000
First line
2
00:00:01,100 --> 00:00:02,000
Second line
"""
        parsed = parse_srt(srt)
        self.assertEqual(
            parsed,
            [
                (0, 1000, "First line"),
                (1100, 2000, "Second line"),
            ],
        )

    def test_parse_srt_skips_invalid_block_prefix(self):
        srt = """This is noise
00:00:01,000 --> 00:00:02,000
Valid subtitle
"""
        parsed = parse_srt(srt)
        self.assertEqual(parsed, [(1000, 2000, "Valid subtitle")])


if __name__ == "__main__":
    unittest.main()
