"""
CONTEXA matching engine.

Exact port of the original TypeScript services
(profileMatchingService.ts and contextMatchingService.ts). Scores must stay
identical to the TypeScript version; tests/test_parity.py checks this against
golden fixtures in data/parity/.

Pure functions only: no database, no I/O.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Literal, Optional, Protocol, TypedDict

Mode = Literal["PROFILE_ONLY", "CONTEXT_AWARE"]

# How two terms (skills, interests, needs, ...) are judged to match.
# EXACT: identical after trim + lowercase (this module).
# SEMANTIC: also similar in meaning, via embeddings (semantic.py).
Matcher = Literal["EXACT", "SEMANTIC"]

EXPERIENCE_LEVELS = {"Beginner": 1, "Intermediate": 2, "Advanced": 3}

# Weights (unchanged from the TypeScript implementation).
PROFILE_WEIGHTS = {
    "skills": 0.4,
    "interests": 0.3,
    "experience": 0.15,
    "collaborationPreferences": 0.15,
}
CONTEXT_WEIGHTS = {
    "profile": 0.30,
    "need": 0.10,
    "activity": 0.05,
    "availability": 0.05,
    "interactionPreference": 0.05,
    "complementarity": 0.45,
}


class ProfileData(TypedDict, total=False):
    skills: list[str]
    interests: list[str]
    experienceLevel: Optional[str]
    collaborationPreferences: list[str]


class ContextData(TypedDict):
    need: list[str]
    activity: str
    availability: str
    interactionPreference: str


def round4(value: float) -> float:
    """
    Matches JavaScript's Number(value.toFixed(4)).

    Python's round() rounds exact ties to even (0.03125 -> 0.0312), while
    toFixed rounds them up (0.03125 -> 0.0313). Decimal(value) uses the
    exact binary value, as toFixed does.
    """
    return float(
        Decimal(value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    )


def _normalize(value: str) -> str:
    return value.strip().lower()


def array_similarity(first: list[str], second: list[str]) -> float:
    """Jaccard similarity of two lists after normalisation."""
    # Emptiness is checked on the raw lists, as in the TypeScript version.
    if not first or not second:
        return 0.0

    first_set = {_normalize(item) for item in first}
    second_set = {_normalize(item) for item in second}

    intersection = len(first_set & second_set)
    union = len(first_set | second_set)

    return 0.0 if union == 0 else intersection / union


def text_similarity(first: str, second: str) -> float:
    """Word-overlap (Jaccard) similarity of two free-text values."""
    return array_similarity(_normalize(first).split(), _normalize(second).split())


def experience_similarity(first: Optional[str], second: Optional[str]) -> float:
    if not first or not second:
        return 0.0

    first_level = EXPERIENCE_LEVELS.get(first)
    second_level = EXPERIENCE_LEVELS.get(second)

    if not first_level or not second_level:
        return 0.0

    return 1 - abs(first_level - second_level) / 2


def interaction_similarity(first: str, second: str) -> float:
    a = _normalize(first)
    b = _normalize(second)

    if a == b or a == "either" or b == "either":
        return 1

    return 0


def need_fulfillment(needs: list[str], profile: ProfileData) -> float:
    """
    Directional: the fraction of `needs` covered by the other person's
    skills or interests.
    """
    if not needs:
        return 0.0

    capabilities = {
        _normalize(item)
        for item in [*profile.get("skills", []), *profile.get("interests", [])]
    }

    # Duplicate needs count individually, as in the TypeScript version.
    fulfilled = sum(1 for need in needs if _normalize(need) in capabilities)

    return fulfilled / len(needs)


class TermMatcher(Protocol):
    """
    The three term-level comparisons the scores use. Everything else (weights,
    experience, interaction preference) is shared, so EXACT and SEMANTIC
    differ only in how terms are compared.
    """

    def array_similarity(self, first: list[str], second: list[str]) -> float: ...

    def text_similarity(self, first: str, second: str) -> float: ...

    def need_fulfillment(self, needs: list[str], profile: ProfileData) -> float: ...


class ExactTerms:
    """The original exact-match comparisons, unchanged (parity-tested)."""

    array_similarity = staticmethod(array_similarity)
    text_similarity = staticmethod(text_similarity)
    need_fulfillment = staticmethod(need_fulfillment)


EXACT = ExactTerms()


def calculate_profile_similarity(
    first: ProfileData, second: ProfileData, terms: TermMatcher = EXACT
) -> dict:
    """PROFILE_ONLY baseline score."""
    skills = terms.array_similarity(first.get("skills", []), second.get("skills", []))
    interests = terms.array_similarity(
        first.get("interests", []), second.get("interests", [])
    )
    experience = experience_similarity(
        first.get("experienceLevel"), second.get("experienceLevel")
    )
    collaboration = terms.array_similarity(
        first.get("collaborationPreferences") or [],
        second.get("collaborationPreferences") or [],
    )

    # Same operation order as the TypeScript version, so floats match exactly.
    score = (
        skills * PROFILE_WEIGHTS["skills"]
        + interests * PROFILE_WEIGHTS["interests"]
        + experience * PROFILE_WEIGHTS["experience"]
        + collaboration * PROFILE_WEIGHTS["collaborationPreferences"]
    )

    return {
        "score": round4(score),
        "breakdown": {
            "skills": round4(skills),
            "interests": round4(interests),
            "experience": round4(experience),
            "collaborationPreferences": round4(collaboration),
        },
    }


def calculate_context_compatibility(
    profile_a: ProfileData,
    profile_b: ProfileData,
    context_a: ContextData,
    context_b: ContextData,
    terms: TermMatcher = EXACT,
) -> dict:
    """CONTEXT_AWARE score: profile + context + directional complementarity."""
    # Uses the already-rounded profile score, as the TypeScript version does.
    profile = calculate_profile_similarity(profile_a, profile_b, terms)["score"]

    need = terms.array_similarity(context_a["need"], context_b["need"])
    activity = terms.text_similarity(context_a["activity"], context_b["activity"])
    availability = terms.text_similarity(
        context_a["availability"], context_b["availability"]
    )
    interaction = interaction_similarity(
        context_a["interactionPreference"], context_b["interactionPreference"]
    )

    # A -> B: how well B covers A's needs. B -> A: how well A covers B's needs.
    need_fulfillment_a = terms.need_fulfillment(context_a["need"], profile_b)
    need_fulfillment_b = terms.need_fulfillment(context_b["need"], profile_a)
    complementarity = (need_fulfillment_a + need_fulfillment_b) / 2

    score = (
        profile * CONTEXT_WEIGHTS["profile"]
        + need * CONTEXT_WEIGHTS["need"]
        + activity * CONTEXT_WEIGHTS["activity"]
        + availability * CONTEXT_WEIGHTS["availability"]
        + interaction * CONTEXT_WEIGHTS["interactionPreference"]
        + complementarity * CONTEXT_WEIGHTS["complementarity"]
    )

    return {
        "score": round4(score),
        "breakdown": {
            "profile": profile,
            "need": round4(need),
            "activity": round4(activity),
            "availability": round4(availability),
            "interactionPreference": interaction,
            "needFulfillmentA": round4(need_fulfillment_a),
            "needFulfillmentB": round4(need_fulfillment_b),
        },
    }


def score_candidate(
    mode: Mode,
    requester_profile: ProfileData,
    candidate_profile: ProfileData,
    requester_context: Optional[ContextData],
    candidate_context: ContextData,
    terms: TermMatcher = EXACT,
) -> dict:
    """Only this step differs between modes."""
    if mode == "PROFILE_ONLY":
        return calculate_profile_similarity(requester_profile, candidate_profile, terms)

    if requester_context is None:
        raise ValueError("ACTIVE_CONTEXT_NOT_FOUND")

    return calculate_context_compatibility(
        requester_profile, candidate_profile, requester_context, candidate_context, terms
    )


def rank_candidates(
    mode: Mode,
    requester_profile: ProfileData,
    requester_context: Optional[ContextData],
    candidates: list[dict],
    limit: int,
    terms: TermMatcher = EXACT,
) -> list[dict]:
    """
    Scores every candidate and returns the top `limit`, highest first.
    Ties keep input order (stable sort), matching the TypeScript version.
    """
    results = []

    for candidate in candidates:
        scored = score_candidate(
            mode,
            requester_profile,
            candidate["profile"],
            requester_context,
            candidate["context"],
            terms,
        )
        results.append({"userId": candidate["userId"], **scored})

    results.sort(key=lambda result: result["score"], reverse=True)

    return results[:limit]