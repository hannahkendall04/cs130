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
    BULLYING = "BULLYING"
    HATE_SPEECH = "HATE_SPEECH"
    CRIMINAL_ACTIVITY = "CRIMINAL_ACTIVITY"
    WEAPONS = "WEAPONS"
    TERROR_THREATS = "TERROR_THREATS"


DEFAULT_MERGE_GAP_MS = 500

DEFAULT_KEYWORDS: dict[FilterCategory, list[str]] = {

    FilterCategory.PROFANITY: [
        "fuck", "fucking", "fucked", "shit", "shitty", "bullshit",
        "bitch", "bastard", "asshole", "dumbass", "jackass",
        "goddamn", "damn", "motherfucker", "prick", "dick",
        "piss off", "son of a bitch", "crap", "hell no",
        "what the hell", "what the fuck", "holy shit",
        "bloody hell", "screw you", "screw this",
        "jerk", "buttface", "arse"
    ],

    FilterCategory.SEXUAL_CONTENT: [
        "sex", "sexual", "have sex", "having sex",
        "hook up", "hooked up", "make out", "making out",
        "sleep with", "slept with", "oral",
        "foreplay", "orgasm", "porn", "pornography",
        "intimate", "affair", "cheating on",
        "turned on", "one night stand",
        "kiss passionately", "in bed together",
        "seduce", "seduced", "seducing",
        "flirting heavily"
    ],

    FilterCategory.NUDITY: [
        "naked", "nude", "nudity", "topless",
        "bare", "no clothes", "without clothes",
        "strip", "stripping", "undressed",
        "take off your clothes",
        "in his underwear", "in her underwear",
        "half naked"
    ],

    FilterCategory.VIOLENCE: [
        "kill", "killed", "killing", "murder",
        "murdered", "murdering",
        "shoot", "shot", "shooting",
        "stab", "stabbed", "stabbing",
        "attack", "attacked", "attacking",
        "beat", "beaten", "beating",
        "choke", "choked", "strangle",
        "fight", "fighting", "brawl",
        "assault", "threaten", "threatened",
        "slap", "punch", "knock him out",
        "hit him", "hit her", "violence",
        "execute", "execution"
    ],

    FilterCategory.GORE: [
        "blood", "bloody", "bleeding",
        "guts", "gory", "decapitate",
        "decapitated", "dismember",
        "dismembered", "severed",
        "corpse", "dead body",
        "body parts", "brain matter",
        "intestines", "skull crushed"
    ],

    FilterCategory.SUBSTANCE_USE: [
        "drugs", "drug", "cocaine",
        "heroin", "meth", "weed",
        "marijuana", "joint", "rolling a joint",
        "overdose", "high on", "stoned",
        "drunk", "drinking", "drank",
        "alcohol", "vodka", "whiskey",
        "beer", "wine", "liquor",
        "get wasted", "hungover",
        "take a hit", "smoke this",
        "inject", "snort"
    ],

    FilterCategory.SELF_HARM: [
        "suicide", "kill myself",
        "kill yourself", "cut myself",
        "self harm", "hang myself",
        "overdose on", "i want to die",
        "end it all", "no reason to live",
        "better off dead",
        "i can't go on",
        "i don't want to live",
        "i deserve to die"
    ],

    FilterCategory.BULLYING: [
        "loser", "idiot", "stupid",
        "moron", "shut up",
        "worthless", "pathetic",
        "fat", "ugly", "trash",
        "freak", "nerd",
        "bully", "harass",
        "make fun of",
        "you're nothing",
        "nobody likes you",
        "you're a joke"
    ],

    FilterCategory.HATE_SPEECH: [
        "go back to your country",
        "your kind", "you people",
        "race traitor",
        "illegal immigrant",
        "you're not one of us",
        "inferior race"
    ],

    FilterCategory.CRIMINAL_ACTIVITY: [
        "rob", "robbed", "robbery",
        "steal", "stole",
        "kidnap", "kidnapped",
        "hostage", "blackmail",
        "extortion", "smuggle",
        "smuggling", "deal drugs",
        "crime boss", "break in",
        "fraud", "money laundering",
        "counterfeit", "hijack"
    ],

    FilterCategory.WEAPONS: [
        "gun", "guns", "pistol",
        "rifle", "shotgun",
        "knife", "blade",
        "bomb", "explosive",
        "grenade", "sniper",
        "machine gun", "firearm",
        "pull the trigger",
        "loaded weapon",
        "armed", "weapon"
    ],

    FilterCategory.TERROR_THREATS: [
        "bomb threat",
        "i will kill you",
        "i'm going to kill you",
        "blow you up",
        "terrorist",
        "massacre",
        "execute you",
        "destroy the city",
        "threat to humanity",
        "take down the government"
    ],
}
