"""
Prompts for content analysis using Gemini API.
"""


def get_content_analysis_prompt(subtitle_text: str, enabled_categories: list[str]) -> str:
    """
    Generate a prompt for Gemini to analyze subtitle text for content safety.
    
    Args:
        subtitle_text: The subtitle text to analyze
        enabled_categories: List of content categories to check for
        
    Returns:
        A formatted prompt string for Gemini
    """
    return f"""Analyze the following subtitle text and identify any of these content categories present:

Categories: {', '.join(enabled_categories)}

Subtitle text: "{subtitle_text}"

Respond with ONLY a JSON object with this format:
{{"categories": ["CATEGORY1", "CATEGORY2"] or []}}

If no categories match, return {{"categories": []}}.
Only include categories that are actually present in the text."""
