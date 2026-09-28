"""
Parity: the Python matching engine must reproduce the original TypeScript
scores exactly (no tolerance). Golden fixtures: data/parity/matching_parity.json
"""

import json
from pathlib import Path

import pytest

from matching import (
    calculate_context_compatibility,
    calculate_profile_similarity,
    rank_candidates,
    round4,
)

FIXTURE_FILE = (
    Path(__file__).resolve().parents[2] / "data" / "parity" / "matching_parity.json"
)
FIXTURES = json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))

PAIR_CASES = FIXTURES["pairCases"]
RANKING_CASES = FIXTURES["rankingCases"]


@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_profile_only_matches_typescript(case):
    result = calculate_profile_similarity(case["profileA"], case["profileB"])
    assert result == case["expected"]["PROFILE_ONLY"]


@pytest.mark.parametrize("case", PAIR_CASES, ids=[c["name"] for c in PAIR_CASES])
def test_context_aware_matches_typescript(case):
    result = calculate_context_compatibility(
        case["profileA"], case["profileB"], case["contextA"], case["contextB"]
    )
    assert result == case["expected"]["CONTEXT_AWARE"]


@pytest.mark.parametrize("mode", ["PROFILE_ONLY", "CONTEXT_AWARE"])
@pytest.mark.parametrize("case", RANKING_CASES, ids=[c["name"] for c in RANKING_CASES])
def test_ranking_matches_typescript(case, mode):
    ranked = rank_candidates(
        mode=mode,
        requester_profile=case["requester"]["profile"],
        requester_context=case["requester"]["context"],
        candidates=case["candidates"],
        limit=case["limit"],
    )
    # Same people, same order (including ties), same scores.
    assert ranked == case["expected"][mode]


def test_round4_matches_javascript_tofixed_on_ties():
    # Python's round(0.03125, 4) gives 0.0312; JavaScript's toFixed gives 0.0313.
    assert round4(0.03125) == 0.0313
    assert round4(1 / 3) == 0.3333