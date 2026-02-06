class SkipRange:
    def __init__(self, start_ms: int, end_ms: int, category: str):
        if start_ms < 0 or end_ms < 0:
            raise ValueError("Timestamps must be non-negative")
        if end_ms <= start_ms:
            raise ValueError("end_ms must be greater than start_ms")

        self.start_ms = start_ms
        self.end_ms = end_ms
        self.category = category

    def duration(self) -> int:
        """Return how long this range lasts (ms)."""
        return self.end_ms - self.start_ms

    def overlaps(self, other: "SkipRange") -> bool:
        return not (self.end_ms < other.start_ms or other.end_ms < self.start_ms)

    def merge(self, other: "SkipRange") -> "SkipRange":
        if self.category != other.category:
            raise ValueError("Cannot merge SkipRanges of different categories")

        return SkipRange(
            start_ms=min(self.start_ms, other.start_ms),
            end_ms=max(self.end_ms, other.end_ms),
            category=self.category
        )

    def to_dict(self):
        return {
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "category": self.category
        }
