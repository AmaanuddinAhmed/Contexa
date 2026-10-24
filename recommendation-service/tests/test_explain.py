import json
from pathlib import Path

import pytest

from explain import MAX_ITEMS_IN_TEXT, explain_match
from matching import calculate_context_compatibility, calculate_profile_similarity

FIXTURE_FILE = (
    Path(__file__).resolve().parents[2] / "data" / "parity" / "matching_parity.json"
)
PAIR_CASES = json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))["pairCases"]

PYTHON_DEV = {"skills": ["Python"], "interests": [], "experienceLevel": "Intermediate",
              "collaborationPreferences": ["Project-based"]}
REACT_DEV = {"skills": ["React"], "interests": [], "experienceLevel": "Intermediate",
             "collaborationPreferences": ["Project-based"]}
NEEDS_REACT = {"need": ["React"], "activity": "Building a software project",
               "availability": "Weekends", "interactionPreference": "Online"}
NEEDS_PYTHON = {"need": ["Python"], "activity": "Building a software project",
                "availability": "Weekends", "interactionPreference": "Online"}


def codes(reasons):
    return [reason["code"] for reason in reasons]


def by_code(reasons):
    return {reason["code"]: reason for reason in reasons}


def test_complementary_pair_explains_both_directions_first():
    reasons = explain_match("CONTEXT_AWARE", PYTHON_DEV, REACT_DEV, NEEDS_REACT, NEEDS_PYTHON)

    assert codes(reasons)[:2] == ["THEY_MEET_YOUR_NEEDS", "YOU_MEET_THEIR_NEEDS"]
    assert by_code(reasons)["THEY_MEET_YOUR_NEEDS"]["items"] == ["React"]
    assert by_code(reasons)["YOU_MEET_THEIR_NEEDS"]["items"] == ["Python"]
    assert by_code(reasons)["THEY_MEET_YOUR_NEEDS"]["text"] == (
        "They can help with what you need: React"
    )


def test_context_factors_are_explained():
    reasons = by_code(
        explain_match("CONTEXT_AWARE", PYTHON_DEV, REACT_DEV, NEEDS_REACT, NEEDS_PYTHON)
    )

    assert "SAME_ACTIVITY" in reasons
    assert reasons["SAME_AVAILABILITY"]["text"] == "You're both available: Weekends"
    assert reasons["COMPATIBLE_INTERACTION"]["text"] == "You both prefer to meet: Online"
    assert "SAME_EXPERIENCE" in reasons
    assert "SHARED_COLLABORATION" in reasons


def test_profile_only_gives_profile_reasons_only():
    reasons = explain_match("PROFILE_ONLY", PYTHON_DEV, REACT_DEV, None, NEEDS_PYTHON)

    assert codes(reasons) == ["SAME_EXPERIENCE", "SHARED_COLLABORATION"]


def test_matching_ignores_case_and_spaces_but_keeps_spelling():
    profile = {**REACT_DEV, "skills": [" REACT "]}
    context = {**NEEDS_REACT, "need": ["react", "React"]}
    reasons = by_code(
        explain_match("CONTEXT_AWARE", PYTHON_DEV, profile, context, NEEDS_PYTHON)
    )

    assert reasons["THEY_MEET_YOUR_NEEDS"]["items"] == ["react"]


def test_partial_overlaps_are_described_as_partial():
    context_b = {**NEEDS_PYTHON, "availability": "Weekends and evenings",
                 "interactionPreference": "Either"}
    reasons = by_code(
        explain_match("CONTEXT_AWARE", PYTHON_DEV, REACT_DEV, NEEDS_REACT, context_b)
    )

    assert "OVERLAPPING_AVAILABILITY" in reasons
    assert reasons["COMPATIBLE_INTERACTION"]["text"] == (
        "Compatible meeting preference (one of you is flexible)"
    )


def test_long_lists_are_shortened_in_text_but_complete_in_items():
    skills = ["A", "B", "C", "D", "E", "F"]
    first = {**PYTHON_DEV, "skills": skills}
    second = {**PYTHON_DEV, "skills": skills}
    reason = by_code(explain_match("PROFILE_ONLY", first, second, None, NEEDS_REACT))[
        "SHARED_SKILLS"
    ]

    assert reason["items"] == skills
    assert reason["text"].endswith(f"+{len(skills) - MAX_ITEMS_IN_TEXT} more")


def test_no_overlap_gives_no_reasons():
    first = {"skills": ["Python"], "interests": [], "experienceLevel": "Beginner"}
    second = {"skills": ["Figma"], "interests": [], "experienceLevel": "Advanced"}
    context_a = {"need": ["Docker"], "activity": "Studying", "availability": "Mornings",
                 "interactionPreference": "Online"}
    context_b = {"need": ["SQL"], "activity": "Hiring", "availability": "Nights",
                 "interactionPreference": "Offline"}

    assert explain_match("CONTEXT_AWARE", first, second, context_a, context_b) == []


def test_experience_two_levels_apart_is_not_a_reason():
    first = {**PYTHON_DEV, "experienceLevel": "Beginner"}
    second = {**PYTHON_DEV, "experienceLevel": "Advanced"}
    reasons = codes(explain_match("PROFILE_ONLY", first, second, None, NEEDS_REACT))

    assert "SAME_EXPERIENCE" not in reasons
    assert "CLOSE_EXPERIENCE" not in reasons


def test_unknown_experience_level_is_not_a_reason():
    first = {**PYTHON_DEV, "experienceLevel": "Expert"}
    reasons = codes(explain_match("PROFILE_ONLY", first, PYTHON_DEV, None, NEEDS_REACT))

    assert not {"SAME_EXPERIENCE", "CLOSE_EXPERIENCE"} & set(reasons)


def test_context_aware_without_requester_context_is_rejected():
    with pytest.raises(ValueError, match="ACTIVE_CONTEXT_NOT_FOUND"):
        explain_match("CONTEXT_AWARE", PYTHON_DEV, REACT_DEV, None, NEEDS_PYTHON)


PROFILE_FACTOR_CODES = {
    "skills": {"SHARED_SKILLS"},
    "interests": {"SHARED_INTERESTS"},
    "experience": {"SAME_EXPERIENCE", "CLOSE_EXPERIENCE"},
    "collaborationPreferences": {"SHARED_COLLABORATION"},
}
CONTEXT_FACTOR_CODES = {
    "needFulfillmentA": {"THEY_MEET_YOUR_NEEDS"},
    "needFulfillmentB": {"YOU_MEET_THEIR_NEEDS"},
    "need": {"SHARED_NEEDS"},
    "activity": {"SAME_ACTIVITY", "SIMILAR_ACTIVITY"},
    "availability": {"SAME_AVAILABILITY", "OVERLAPPING_AVAILABILITY"},
    "interactionPreference": {"COMPATIBLE_INTERACTION"},
}


@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_profile_reasons_match_profile_breakdown(case):
    breakdown = calculate_profile_similarity(case["profileA"], case["profileB"])["breakdown"]
    reasons = set(codes(explain_match(
        "PROFILE_ONLY", case["profileA"], case["profileB"], None, case["contextB"]
    )))

    for factor, factor_codes in PROFILE_FACTOR_CODES.items():
        assert bool(reasons & factor_codes) == (breakdown[factor] > 0), factor


@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_context_reasons_match_context_breakdown(case):
    breakdown = calculate_context_compatibility(
        case["profileA"], case["profileB"], case["contextA"], case["contextB"]
    )["breakdown"]
    reasons = set(codes(explain_match(
        "CONTEXT_AWARE", case["profileA"], case["profileB"],
        case["contextA"], case["contextB"]
    )))

    for factor, factor_codes in CONTEXT_FACTOR_CODES.items():
        assert bool(reasons & factor_codes) == (breakdown[factor] > 0), factor