"""
Prompts for content analysis using Gemini API.
"""


def get_content_analysis_prompt(subtitle_lines: list[str], enabled_categories: list[str]) -> str:
    """
    Generate a prompt for Gemini to analyze a batch of subtitle entries.

    Args:
        subtitle_lines: List of strings in the format "[index] text"
        enabled_categories: List of content category names to check for

    Returns:
        A formatted prompt string for Gemini
    """
    subtitles_text = "\n".join(subtitle_lines)
    return f"""Analyze these subtitle entries and identify which ones contain any of the specified content categories.

Categories to detect: {', '.join(enabled_categories)}

Subtitle entries (format: [index] text):
{subtitles_text}

Respond with ONLY a JSON object in this exact format:
{{"flagged": [{{"index": 0, "categories": ["CATEGORY1"]}}, {{"index": 3, "categories": ["CATEGORY2"]}}]}}

Rules:
- Only include entries that clearly match at least one category
- "flagged" must be an empty list [] if nothing matches
- Only use category names from the provided list above
- Do not include any text, explanation, or markdown outside the JSON object"""
