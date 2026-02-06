from app.filters.timestamp import Timestamp, TimeRange


class SkipRange:
    def __init__(self, time_range: TimeRange, category: str):
        self.time_range = time_range
        self.category = category

    @classmethod
    def from_ms(cls, start_ms: int, end_ms: int, category: str) -> "SkipRange":
        return cls(
            TimeRange(Timestamp(start_ms), Timestamp(end_ms)),
            category
        )

    def duration(self) -> int:
        return self.time_range.duration_ms()

    def overlaps(self, other: "SkipRange") -> bool:
        return self.time_range.overlaps(other.time_range)

    def merge(self, other: "SkipRange") -> "SkipRange":
        
        if self.category != other.category:
            raise ValueError("Cannot merge SkipRanges of different categories")

        return SkipRange(
            self.time_range.merge(other.time_range),
            self.category
        )

    def to_dict(self):
        return {
            **self.time_range.to_dict(),
            "category": self.category
        }