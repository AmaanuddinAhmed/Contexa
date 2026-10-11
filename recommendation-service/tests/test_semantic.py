"""
SEMANTIC matcher: positive and negative cases, and its relationship to EXACT.

Uses the deterministic FakeEmbedder (tests/conftest.py), so no model is needed.
tests/test_semantic_model.py checks the real model when it is installed.
"""

import json
from pathlib import Path

import pytest

from conftest import FakeEmbedder
from explain import explain_match
from matching import (
    EXACT,
    calculate_context_compatibility,
    calculate_profile_similarity,
    rank_candidates,
)
from semantic import SIMILARITY_THRESHOLD, SemanticTerms, request_vocabulary

FIXTURE_FILE = (
    Path(__file__).resolve().parents[2] / "data" / "parity" / "matching_parity.json"
)
FIXTURES = json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))
PAIR_CASES = FIXTURES["pairCases"]
RANKING_CASES = FIXTURES["rankingCases"]


def terms_for(*sides, embedder=None):
    """A SemanticTerms over everything in the given profiles and contexts."""
    vocabulary = []

    for side in sides:
        vocabulary += request_vocabulary(side, [])

    return SemanticTerms(embedder or FakeEmbedder(), vocabulary)


def case_terms(case, embedder=None):
    return terms_for(
        {"profile": case["profileA"], "context": case["contextA"]},
        {"profile": case["profileB"], "context": case["contextB"]},
        embedder=embedder,
    )


def profile(skills=(), interests=(), level="Intermediate", collaboration=("Project-based",)):
    return {"skills": list(skills), "interests": list(interests),
            "experienceLevel": level, "collaborationPreferences": list(collaboration)}


def context(need=(), activity="Building a software project", availability="Weekends",
            preference="Online"):
    return {"need": list(need), "activity": activity, "availability": availability,
            "interactionPreference": preference}


# ---------- term similarity ----------

def test_identical_terms_match_fully_ignoring_case_and_spaces():
    terms = terms_for({"profile": profile(["React"])})
    assert terms.similarity(" react ", "React") == 1.0


def test_synonyms_match_with_their_similarity():
    terms = terms_for({"profile": profile(["React", "React.js"])})
    assert terms.similarity("React", "React.js") == pytest.approx(0.9)


def test_related_terms_below_the_threshold_do_not_match():
    terms = terms_for({"profile": profile(["Python", "Java"])})
    assert SIMILARITY_THRESHOLD > 0.5
    assert terms.similarity("Python", "Java") == 0.0


def test_unrelated_and_unknown_terms_do_not_match():
    terms = terms_for({"profile": profile(["React", "Docker"])})
    assert terms.similarity("React", "Docker") == 0.0
    assert terms.similarity("React", "never embedded") == 0.0


def test_vocabulary_is_embedded_once_per_request():
    embedder = FakeEmbedder()
    terms_for({"profile": profile(["React", "AI"]), "context": context(["UI"])},
              embedder=embedder)
    assert embedder.calls == 1


# ---------- factors ----------

def test_need_is_fulfilled_by_a_synonym():
    terms = terms_for({"context": context(["React"])}, {"profile": profile(["React.js"])})
    assert EXACT.need_fulfillment(["React"], profile(["React.js"])) == 0
    assert terms.need_fulfillment(["React"], profile(["React.js"])) == pytest.approx(0.9)


def test_soft_jaccard_counts_synonyms_as_partial_overlap():
    terms = terms_for({"profile": profile(["React", "Docker"])},
                      {"profile": profile(["React.js", "Docker"])})
    # Exact: {docker} / {react, docker, react.js} = 1/3.
    assert EXACT.array_similarity(["React", "Docker"], ["React.js", "Docker"]) == pytest.approx(1 / 3)
    # Semantic: overlap 1.9 (Docker 1 + React~React.js 0.9) out of 4 - 1.9.
    assert terms.array_similarity(["React", "Docker"], ["React.js", "Docker"]) == pytest.approx(1.9 / 2.1)


def test_empty_lists_score_zero():
    terms = terms_for({"profile": profile(["React"])})
    assert terms.array_similarity([], ["React"]) == 0.0
    assert terms.need_fulfillment([], profile(["React"])) == 0.0


def test_phrase_similarity_helps_free_text():
    terms = terms_for({"context": context(availability="Evenings")},
                      {"context": context(availability="After 6pm")})
    assert EXACT.text_similarity("Evenings", "After 6pm") == 0
    assert terms.text_similarity("Evenings", "After 6pm") == pytest.approx(0.9)


# ---------- relationship to EXACT ----------

@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_semantic_equals_exact_when_no_terms_are_similar(case):
    """With a model that sees no synonyms, SEMANTIC reproduces EXACT exactly."""
    terms = case_terms(case, FakeEmbedder(synonyms=[], weakly_related=[]))

    assert calculate_profile_similarity(case["profileA"], case["profileB"], terms) == \
        calculate_profile_similarity(case["profileA"], case["profileB"])
    assert calculate_context_compatibility(
        case["profileA"], case["profileB"], case["contextA"], case["contextB"], terms
    ) == calculate_context_compatibility(
        case["profileA"], case["profileB"], case["contextA"], case["contextB"]
    )


@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_semantic_never_scores_below_exact(case):
    """Every factor, and the total, is at least its EXACT value."""
    terms = case_terms(case)
    args = (case["profileA"], case["profileB"], case["contextA"], case["contextB"])

    for exact, semantic in [
        (calculate_profile_similarity(*args[:2]), calculate_profile_similarity(*args[:2], terms)),
        (calculate_context_compatibility(*args), calculate_context_compatibility(*args, terms)),
    ]:
        assert semantic["score"] >= exact["score"]
        for factor, value in exact["breakdown"].items():
            assert semantic["breakdown"][factor] >= value, factor
        assert 0 <= semantic["score"] <= 1


@pytest.mark.parametrize("mode", ["PROFILE_ONLY", "CONTEXT_AWARE"])
@pytest.mark.parametrize("case", RANKING_CASES, ids=[c["name"] for c in RANKING_CASES])
def test_semantic_ranking_is_well_formed(case, mode):
    requester = case["requester"]
    terms = SemanticTerms(FakeEmbedder(), request_vocabulary(requester, case["candidates"]))
    ranked = rank_candidates(mode, requester["profile"], requester["context"],
                             case["candidates"], case["limit"], terms)

    assert len(ranked) == min(case["limit"], len(case["candidates"]))
    assert [r["score"] for r in ranked] == sorted((r["score"] for r in ranked), reverse=True)


def test_a_synonym_match_can_change_the_ranking():
    requester = {"profile": profile(["Python"]), "context": context(["React"])}
    uses_synonym = {"userId": "synonym", "profile": profile(["React.js"]),
                    "context": context(["Docker"])}
    unrelated = {"userId": "unrelated", "profile": profile(["Python"]),
                 "context": context(["Docker"])}
    candidates = [unrelated, uses_synonym]

    exact = rank_candidates("CONTEXT_AWARE", requester["profile"], requester["context"],
                            candidates, 2)
    terms = SemanticTerms(FakeEmbedder(), request_vocabulary(requester, candidates))
    semantic = rank_candidates("CONTEXT_AWARE", requester["profile"], requester["context"],
                               candidates, 2, terms)

    assert exact[0]["userId"] == "unrelated"
    assert semantic[0]["userId"] == "synonym"


# ---------- explanations ----------

def reasons_by_code(reasons):
    return {reason["code"]: reason for reason in reasons}


def test_explanation_names_the_semantic_match():
    requester_profile, requester_context = profile(["Python"]), context(["React"])
    candidate_profile, candidate_context = profile(["React.js"]), context(["Docker"])
    terms = terms_for({"profile": requester_profile, "context": requester_context},
                      {"profile": candidate_profile, "context": candidate_context})

    reasons = reasons_by_code(explain_match("CONTEXT_AWARE", requester_profile,
                                            candidate_profile, requester_context,
                                            candidate_context, terms))

    assert reasons["THEY_MEET_YOUR_NEEDS"]["items"] == ["React ≈ React.js"]
    assert reasons["THEY_MEET_YOUR_NEEDS"]["text"] == (
        "They can help with what you need: React ≈ React.js"
    )


def test_exact_matches_are_shown_without_the_symbol():
    terms = terms_for({"profile": profile(["React"])}, {"profile": profile(["React"])})
    reasons = reasons_by_code(explain_match("PROFILE_ONLY", profile(["React"]),
                                            profile(["React"]), None, context(), terms))
    assert reasons["SHARED_SKILLS"]["items"] == ["React"]


def test_no_reason_for_terms_below_the_threshold():
    terms = terms_for({"context": context(["Python"])}, {"profile": profile(["Java"])})
    reasons = reasons_by_code(explain_match("CONTEXT_AWARE", profile(["Go"]),
                                            profile(["Java"]), context(["Python"]),
                                            context(["Rust"]), terms))
    assert "THEY_MEET_YOUR_NEEDS" not in reasons


FACTOR_REASONS = {
    "needFulfillmentA": "THEY_MEET_YOUR_NEEDS",
    "needFulfillmentB": "YOU_MEET_THEIR_NEEDS",
    "need": "SHARED_NEEDS",
}


@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_semantic_reason_appears_exactly_when_its_factor_contributes(case):
    terms = case_terms(case)
    args = (case["profileA"], case["profileB"], case["contextA"], case["contextB"])
    breakdown = calculate_context_compatibility(*args, terms)["breakdown"]
    codes = {r["code"] for r in explain_match("CONTEXT_AWARE", *args, terms)}

    for factor, code in FACTOR_REASONS.items():
        assert (breakdown[factor] > 0) == (code in codes), factor

    profile_breakdown = calculate_profile_similarity(*args[:2], terms)["breakdown"]
    for factor, code in [("skills", "SHARED_SKILLS"), ("interests", "SHARED_INTERESTS"),
                         ("collaborationPreferences", "SHARED_COLLABORATION")]:
        assert (profile_breakdown[factor] > 0) == (code in codes), factor


# ---------- model loading ----------

def test_missing_model_fails_fast_without_downloading(tmp_path, monkeypatch):
    import time

    import semantic

    monkeypatch.delenv("SEMANTIC_MODEL_PATH", raising=False)
    monkeypatch.setattr(semantic, "DEFAULT_MODEL_DIR", tmp_path / "no-model-here")

    started = time.monotonic()
    with pytest.raises(semantic.SemanticMatcherUnavailable):
        semantic.FastEmbedEmbedder().load()

    assert time.monotonic() - started < 5