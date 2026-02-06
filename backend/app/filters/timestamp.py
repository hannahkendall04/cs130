from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class Timestamp:
    """
    Represents a point in time in milliseconds.
    """
    ms: int

    def __post_init__(self):
        if self.ms < 0:
            raise ValueError("Timestamp must be non-negative")

    @classmethod
    def from_seconds(cls, seconds: float) -> "Timestamp":
        return cls(int(seconds * 1000))

    def to_seconds(self) -> float:
        return self.ms / 1000.0


@dataclass(frozen=True)
class TimeRange:
    """
    Represents a half-open time range [start, end) in milliseconds.
    """
    start: Timestamp
    end: Timestamp

    def __post_init__(self):
        if self.end.ms <= self.start.ms:
            raise ValueError("end must be greater than start")

    def duration_ms(self) -> int:
        return self.end.ms - self.start.ms

    def overlaps(self, other: "TimeRange") -> bool:
        return not (self.end.ms <= other.start.ms or other.end.ms <= self.start.ms)

    def merge(self, other: "TimeRange") -> "TimeRange":
        if not self.overlaps(other):
            raise ValueError("Cannot merge non-overlapping TimeRanges")

        return TimeRange(
            start=min(self.start, other.start),
            end=max(self.end, other.end)
        )

    def to_dict(self) -> dict:
        return {
            "start_ms": self.start.ms,
            "end_ms": self.end.ms
        }
