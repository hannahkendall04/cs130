from app.filters.detector import SubtitleBlock, analyze_subtitles
from app.filters.categories import FilterCategory


subs = [
    SubtitleBlock(0, 2000, "Let's go."),
    SubtitleBlock(2000, 4000, "He pulled a gun!"),
    SubtitleBlock(4200, 6000, "I'll kill you!"),
    SubtitleBlock(9000, 11000, "This is bullshit."),
]

ranges = analyze_subtitles(
    subs,
    enabled_categories={FilterCategory.WEAPONS, FilterCategory.VIOLENCE, FilterCategory.PROFANITY},
)

for r in ranges:
    print(r.to_dict())
