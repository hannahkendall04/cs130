from __future__ import annotations
import re
from typing import List, Tuple

TIME_RE = re.compile(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})")
TIME_LINE_RE = re.compile(
    r"^\s*(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})"
)

def _to_ms(ts: str) -> int:
    m = TIME_RE.search(ts)
    if not m:
        raise ValueError(f"Bad timestamp: {ts}")
    hh, mm, ss, ms = map(int, m.groups())
    return ((hh * 60 + mm) * 60 + ss) * 1000 + ms

def parse_srt(srt_text: str) -> List[Tuple[int, int, str]]:
    """
    Returns [(start_ms, end_ms, text), ...]
    Works even if blocks are missing blank lines.
    """
    lines = srt_text.splitlines()
    out: List[Tuple[int, int, str]] = []

    i = 0
    n = len(lines)

    while i < n:
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Optional numeric index line
        if line.isdigit():
            i += 1
            if i >= n:
                break
            line = lines[i].strip()

        # Expect a time line
        m = TIME_LINE_RE.match(line)
        if not m:
            # Not a valid block start; skip
            i += 1
            continue

        start_ms = _to_ms(m.group(1))
        end_ms = _to_ms(m.group(2))
        i += 1

        # Collect text lines until next index or next time line or EOF
        text_lines = []
        while i < n:
            nxt = lines[i].strip()
            if not nxt:
                i += 1
                break  # blank line ends block (if present)

            if nxt.isdigit():
                break  # likely next block index

            if TIME_LINE_RE.match(nxt):
                break  # next block time line (no blank line case)

            text_lines.append(nxt)
            i += 1

        text = " ".join(text_lines).strip()
        if text:
            out.append((start_ms, end_ms, text))

        # Do NOT increment i here; loop continues and will handle index/time line

    return out
