"""
CONTEXA match explanations: "why was this person recommended?"

Pure functions only: no database, no I/O, and no effect on scores.

Every reason is derived from the same inputs and the same normalisation as
matching.py, and a reason appears exactly when its factor contributed to the
score (factor > 0). tests/test_explain.py checks this against the parity
fixtures.

Reasons are written from the requester's point of view ("you" = the person
asking for recommendations, "they" = the candidate).
"""

from __future__ import annotations

from typing import Optional, TypedDict

from matching import (
    EXPERIENCE_LEVELS,
    ContextData,
    Mode,
    ProfileData,
    _normalize,
    interaction_similarity,
    text_similarity,
)

# How many items to name in a reason's text before "+N more".
MAX_ITEMS_IN_TEXT = 4


class Reason(TypedDict):
    code: str
    text: str
    items: list[str]


def _matched(values: list[str], reference: list[str]) -> list[str]:
    """
    Items of `values` whose normalised form appears in `reference`.
    Keeps the original spelling and order; duplicates are listed once.
    """
    reference_set = {_normalize(item) for item in reference}
    seen: set[str] = set()
    matched: list[str] = []

    for value in values:
        key = _normalize(value)

        if key in reference_set and key not in seen:
            seen.add(key)
            matched.append(value.strip())

    return matched


def _join(items: list[str]) -> str:
    shown = items[:MAX_ITEMS_IN_TEXT]
    hidden = len(items) - len(shown)
    text = ", ".join(shown)

    return f"{text} +{hidden} more" if hidden else text


def _reason(code: str, text: str, items: Optional[list[str]] = None) -> Reason:
    return {"code": code, "text": text, "items": items or []}


def _capabilities(profile: ProfileData) -> list[str]:
    return [*profile.get("skills", []), *profile.get("interests", [])]


def profile_reasons(first: ProfileData, second: ProfileData) -> list[Reason]:
    """Reasons behind the profile-similarity score, in weight order."""
    reasons: list[Reason] = []

    shared_skills = _matched(first.get("skills", []), second.get("skills", []))
    if shared_skills:
        reasons.append(_reason(
            "SHARED_SKILLS", f"You share skills: {_join(shared_skills)}", shared_skills
        ))

    shared_interests = _matched(
        first.get("interests", []), second.get("interests", [])
    )
    if shared_interests:
        reasons.append(_reason(
            "SHARED_INTERESTS",
            f"You share interests: {_join(shared_interests)}",
            shared_interests,
        ))

    first_level = EXPERIENCE_LEVELS.get(first.get("experienceLevel") or "")
    second_level = EXPERIENCE_LEVELS.get(second.get("experienceLevel") or "")
    if first_level and second_level:
        if first_level == second_level:
            level = first["experienceLevel"]
            reasons.append(_reason(
                "SAME_EXPERIENCE", f"Same experience level: {level}", [level]
            ))
        elif abs(first_level - second_level) == 1:
            levels = [first["experienceLevel"], second["experienceLevel"]]
            reasons.append(_reason(
                "CLOSE_EXPERIENCE",
                f"Close experience levels (you: {levels[0]}, them: {levels[1]})",
                levels,
            ))

    shared_collaboration = _matched(
        first.get("collaborationPreferences") or [],
        second.get("collaborationPreferences") or [],
    )
    if shared_collaboration:
        reasons.append(_reason(
            "SHARED_COLLABORATION",
            f"You both like to work: {_join(shared_collaboration)}",
            shared_collaboration,
        ))

    return reasons


def context_reasons(
    profile_a: ProfileData,
    profile_b: ProfileData,
    context_a: ContextData,
    context_b: ContextData,
) -> list[Reason]:
    """Reasons behind the CONTEXT_AWARE score, in weight order."""
    reasons: list[Reason] = []

    # Complementarity (weight 0.45), both directions.
    they_cover = _matched(context_a["need"], _capabilities(profile_b))
    if they_cover:
        reasons.append(_reason(
            "THEY_MEET_YOUR_NEEDS",
            f"They can help with what you need: {_join(they_cover)}",
            they_cover,
        ))

    you_cover = _matched(context_b["need"], _capabilities(profile_a))
    if you_cover:
        reasons.append(_reason(
            "YOU_MEET_THEIR_NEEDS",
            f"You can help with what they need: {_join(you_cover)}",
            you_cover,
        ))

    # Profile similarity (weight 0.30).
    reasons.extend(profile_reasons(profile_a, profile_b))

    # Shared needs (weight 0.10).
    shared_needs = _matched(context_a["need"], context_b["need"])
    if shared_needs:
        reasons.append(_reason(
            "SHARED_NEEDS", f"You're both looking for: {_join(shared_needs)}", shared_needs
        ))

    # Activity, availability, interaction preference (weight 0.05 each).
    activity_a, activity_b = context_a["activity"], context_b["activity"]
    if text_similarity(activity_a, activity_b) > 0:
        if _normalize(activity_a) == _normalize(activity_b):
            reasons.append(_reason(
                "SAME_ACTIVITY", f"You're both: {activity_a.strip()}", [activity_a.strip()]
            ))
        else:
            reasons.append(_reason(
                "SIMILAR_ACTIVITY",
                f"Similar current activity (you: {activity_a.strip()}, "
                f"them: {activity_b.strip()})",
                [activity_a.strip(), activity_b.strip()],
            ))

    availability_a, availability_b = context_a["availability"], context_b["availability"]
    if text_similarity(availability_a, availability_b) > 0:
        if _normalize(availability_a) == _normalize(availability_b):
            reasons.append(_reason(
                "SAME_AVAILABILITY",
                f"You're both available: {availability_a.strip()}",
                [availability_a.strip()],
            ))
        else:
            reasons.append(_reason(
                "OVERLAPPING_AVAILABILITY",
                f"Overlapping availability (you: {availability_a.strip()}, "
                f"them: {availability_b.strip()})",
                [availability_a.strip(), availability_b.strip()],
            ))

    preference_a = context_a["interactionPreference"]
    preference_b = context_b["interactionPreference"]
    if interaction_similarity(preference_a, preference_b) == 1:
        a, b = _normalize(preference_a), _normalize(preference_b)

        if a == b == "either":
            text = "You're both flexible about how to meet"
        elif a == b:
            text = f"You both prefer to meet: {preference_a.strip()}"
        else:
            text = "Compatible meeting preference (one of you is flexible)"

        reasons.append(_reason(
            "COMPATIBLE_INTERACTION", text, [preference_a.strip(), preference_b.strip()]
        ))

    return reasons


def explain_match(
    mode: Mode,
    requester_profile: ProfileData,
    candidate_profile: ProfileData,
    requester_context: Optional[ContextData],
    candidate_context: ContextData,
) -> list[Reason]:
    """Same inputs as matching.score_candidate; returns the reasons only."""
    if mode == "PROFILE_ONLY":
        return profile_reasons(requester_profile, candidate_profile)

    if requester_context is None:
        raise ValueError("ACTIVE_CONTEXT_NOT_FOUND")

    return context_reasons(
        requester_profile, candidate_profile, requester_context, candidate_context
    )