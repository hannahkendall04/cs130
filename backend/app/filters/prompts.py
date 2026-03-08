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
    categories_list = ", ".join(f'"{c}"' for c in enabled_categories)

    # Build category definitions only for enabled categories
    category_defs = []
    for cat in enabled_categories:
        if cat in CATEGORY_DESCRIPTIONS:
            category_defs.append(f'- "{cat}": {CATEGORY_DESCRIPTIONS[cat]}')
    category_defs_text = "\n".join(category_defs)

    return f"""You are a content moderation assistant. Analyze each subtitle entry below and flag any that contain the specified content categories.

BE OVERLY CAUTIOUS — it is far better to flag something that is borderline than to miss actual objectionable content. When in doubt, flag it.

IMPORTANT: Flag the subtitle entry that CONTAINS the objectionable word or phrase itself, not the line before or after it. Look at the actual text in each entry and only flag entries where the offending content appears in THAT entry's text.

ALLOWED CATEGORY NAMES (use these EXACT strings only): [{categories_list}]

CATEGORY DEFINITIONS:
{category_defs_text}

Subtitle entries (format: [index] text):
{subtitles_text}

Respond with ONLY a JSON object in this exact format:
{{"flagged": [{{"index": 0, "categories": ["PROFANITY"]}}, {{"index": 3, "categories": ["VIOLENCE"]}}]}}

Rules:
- Flag the entry where the objectionable content ACTUALLY APPEARS in the text, not surrounding entries
- Be aggressive about flagging — include anything that is even mildly suggestive of the category
- For PROFANITY: flag any swear word, curse word, slur, or crude language, even mild ones (e.g. "damn", "hell", "crap", "ass")
- "flagged" must be an empty list [] if nothing matches
- Each category value MUST be one of: [{categories_list}]. Do NOT abbreviate or rephrase them (e.g. use "PROFANITY" not "PROFANE")
- Do not include any text, explanation, or markdown outside the JSON object"""


CATEGORY_DESCRIPTIONS = {
    "PROFANITY": "Any swear words, curse words, slurs, vulgar language, or crude expressions. Includes mild profanity (damn, hell, crap, ass) and strong profanity (f-word, s-word, etc). Also includes insults using profane words (e.g. 'son of a bitch', 'bastard').",
    "SEXUAL_CONTENT": "Any references to sexual acts, sexual behavior, sexual innuendo, seduction, affairs, hooking up, making out, or sexually suggestive dialogue. Includes both explicit and implied sexual content. Also covers nudity, nakedness, undressing, being topless, removing clothes, or states of undress.",
    "SUBSTANCE_USE": "Any references to drug use, drinking alcohol, being drunk or high, smoking, drug dealing, overdose, or specific drug/alcohol names (cocaine, heroin, weed, vodka, beer, etc).",
    "VIOLENCE": "Any references to physical violence, fighting, hitting, punching, kicking, shooting, stabbing, killing, murder, assault, threats of physical harm, or violent confrontations. Includes both direct violence and threats. Also covers blood, gore, graphic injuries, dismemberment, decapitation, mutilation, corpses, or graphic descriptions of wounds and bodily harm. Also covers weapons such as guns, knives, bombs, explosives, firearms, or other weapons, including mentions of using, carrying, or threatening with weapons. Also covers criminal activity such as robbery, theft, kidnapping, blackmail, fraud, smuggling, drug dealing, money laundering, or breaking and entering. Also covers threats of mass violence, terrorism, bomb threats, massacre, threats to kill, or threats to cause widespread destruction.",
    "BULLYING": "Any verbal bullying, name-calling, mocking, belittling, body-shaming, social exclusion, intimidation, or degrading someone's worth (e.g. 'you're worthless', 'nobody likes you', 'loser'). Also covers discriminatory language targeting race, ethnicity, religion, gender, sexual orientation, or nationality, including slurs, stereotyping, and dehumanizing language. Also covers references to suicide, self-harm, wanting to die, cutting oneself, overdosing intentionally, or expressions of hopelessness about living.",
}
