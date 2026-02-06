from __future__ import annotations
from enum import Enum


class FilterCategory(str, Enum):
    PROFANITY = "PROFANITY"
    SEXUAL_CONTENT = "SEXUAL_CONTENT"
    NUDITY = "NUDITY"
    VIOLENCE = "VIOLENCE"
    GORE = "GORE"
    SUBSTANCE_USE = "SUBSTANCE_USE"
    SELF_HARM = "SELF_HARM"
    HARASSMENT_BULLYING = "HARASSMENT_BULLYING"
    HATE_SPEECH = "HATE_SPEECH"
    CRIMINAL_ACTIVITY = "CRIMINAL_ACTIVITY"
    WEAPONS = "WEAPONS"
    TERROR_THREATS = "TERROR_THREATS"


DEFAULT_MERGE_GAP_MS = 500

DEFAULT_KEYWORDS: dict[FilterCategory, list[str]] = {
    FilterCategory.PROFANITY: [
        "fuck", "shit", "bitch", "asshole", "bastard", "damn", "goddamn",
        "motherfucker", "bullshit", "prick", "dick"
    ],
    FilterCategory.SEXUAL_CONTENT: [
        "sex", "hook up", "make out", "sleep with", "oral", "blowjob",
        "handjob", "orgasm", "porn", "foreplay"
    ],
    FilterCategory.NUDITY: [
        "naked", "nudity", "topless", "bare", "no clothes", "strip"
    ],
    FilterCategory.VIOLENCE: [
        "kill", "murder", "shoot", "stab", "attack", "beat", "choke",
        "strangle", "fight", "assault"
    ],
    FilterCategory.GORE: [
        "blood", "bleeding", "guts", "decapitate", "dismember", "severed",
        "corpse"
    ],
    FilterCategory.SUBSTANCE_USE: [
        "drugs", "cocaine", "heroin", "meth", "weed", "marijuana",
        "overdose", "high", "drunk", "alcohol", "vodka", "whiskey"
    ],
    FilterCategory.SELF_HARM: [
        "suicide", "kill myself", "cut myself", "self harm", "hang myself",
        "overdose"
    ],
    FilterCategory.HARASSMENT_BULLYING: [
        "loser", "idiot", "stupid", "shut up", "fat", "ugly", "trash",
        "bully", "harass"
    ],
    FilterCategory.HATE_SPEECH: [
        "go back to your country", "race traitor"
    ],
    FilterCategory.CRIMINAL_ACTIVITY: [
        "rob", "steal", "kidnap", "hostage", "blackmail", "extortion",
        "deal drugs", "smuggle"
    ],
    FilterCategory.WEAPONS: [
        "gun", "pistol", "rifle", "shotgun", "knife", "blade",
        "bomb", "explosive", "grenade"
    ],
    FilterCategory.TERROR_THREATS: [
        "bomb threat", "i will kill you", "i'm going to kill you",
        "blow you up", "terrorist"
    ],
}
