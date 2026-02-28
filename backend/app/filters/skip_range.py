from pydantic import BaseModel
from app.filters.timestamp import Timestamp, TimeRange

class SkipRange(BaseModel):
    time_range: TimeRange
    category: str

    @classmethod
    def from_ms(cls, start_ms: int, end_ms: int, category: str) -> "SkipRange":
        return cls(
            time_range=TimeRange(Timestamp(start_ms), Timestamp(end_ms)),
            category=category,
        )

    def duration(self) -> int:
        return self.time_range.duration_ms()

    def overlaps(self, other: "SkipRange") -> bool:
        return self.time_range.overlaps(other.time_range)

    def merge(self, other: "SkipRange") -> "SkipRange":
        if self.category != other.category:
            raise ValueError("Cannot merge SkipRanges of different categories")

        return SkipRange(
            time_range=self.time_range.merge(other.time_range),
            category=self.category,
        )

    def to_dict(self):
        return {**self.time_range.to_dict(), "category": self.category}