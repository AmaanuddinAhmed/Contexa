"""API contract tests for POST /internal/recommend (positive and negative)."""

import importlib

import pytest
from fastapi.testclient import TestClient

import main

REACT_DEV = {
    "userId": "b",
    "profile": {"skills": ["React"], "interests": [], "experienceLevel": "Intermediate",
                "collaborationPreferences": ["Project-based"]},
    "context": {"need": ["Python"], "activity": "Building a software project",
                "availability": "Weekends", "interactionPreference": "Online"},
}
PYTHON_CLONE = {
    "userId": "c",
    "profile": {"skills": ["Python"], "interests": [], "experienceLevel": "Intermediate",
                "collaborationPreferences": ["Project-based"]},
    "context": {"need": ["Docker"], "activity": "Building a software project",
                "availability": "Weekends", "interactionPreference": "Online"},
}
REQUESTER = {
    "profile": {"skills": ["Python"], "interests": [], "experienceLevel": "Intermediate",
                "collaborationPreferences": ["Project-based"]},
    "context": {"need": ["React"], "activity": "Building a software project",
                "availability": "Weekends", "interactionPreference": "Online"},
}


def body(**overrides):
    request = {"mode": "CONTEXT_AWARE", "limit": 10, "requester": REQUESTER,
               "candidates": [PYTHON_CLONE, REACT_DEV]}
    request.update(overrides)
    return request


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    importlib.reload(main)
    return TestClient(main.app)


def test_health(client):
    assert client.get("/health").json()["success"] is True


def test_context_aware_ranks_complementary_candidate_first(client):
    response = client.post("/internal/recommend", json=body())
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "CONTEXT_AWARE"
    assert [r["userId"] for r in data["recommendations"]] == ["b", "c"]
    assert data["recommendations"][0]["score"] == 0.69

def test_recommendations_include_reasons(client):
    response = client.post("/internal/recommend", json=body())
    top = response.json()["recommendations"][0]
    assert top["reasons"][0]["code"] == "THEY_MEET_YOUR_NEEDS"
    assert top["reasons"][0]["items"] == ["React"]
    assert all({"code", "text", "items"} <= set(r) for r in top["reasons"])


def test_profile_only_reasons_have_no_context_codes(client):
    response = client.post("/internal/recommend", json=body(mode="PROFILE_ONLY"))
    for recommendation in response.json()["recommendations"]:
        assert not {r["code"] for r in recommendation["reasons"]} & {
            "THEY_MEET_YOUR_NEEDS", "YOU_MEET_THEIR_NEEDS", "SHARED_NEEDS"}

def test_profile_only_ranks_similar_candidate_first(client):
    response = client.post("/internal/recommend", json=body(mode="PROFILE_ONLY"))
    assert response.status_code == 200
    assert [r["userId"] for r in response.json()["recommendations"]] == ["c", "b"]


def test_profile_only_works_without_requester_context(client):
    requester = {"profile": REQUESTER["profile"]}
    response = client.post("/internal/recommend",
                           json=body(mode="PROFILE_ONLY", requester=requester))
    assert response.status_code == 200


def test_context_aware_without_requester_context_is_rejected(client):
    requester = {"profile": REQUESTER["profile"]}
    response = client.post("/internal/recommend", json=body(requester=requester))
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "ACTIVE_CONTEXT_NOT_FOUND"


def test_limit_is_applied(client):
    response = client.post("/internal/recommend", json=body(limit=1))
    assert response.json()["count"] == 1


@pytest.mark.parametrize("bad", [
    {"mode": "BANANA"},
    {"limit": 0},
    {"limit": 51},
    {"candidates": [PYTHON_CLONE] * (main.MAX_CANDIDATES + 1)},
])
def test_invalid_requests_are_rejected(client, bad):
    assert client.post("/internal/recommend", json=body(**bad)).status_code == 422


def test_empty_candidate_pool_returns_empty_list(client):
    response = client.post("/internal/recommend", json=body(candidates=[]))
    assert response.status_code == 200
    assert response.json()["count"] == 0


def test_internal_key_enforced_when_configured(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", "secret-123")
    importlib.reload(main)
    client = TestClient(main.app)

    assert client.post("/internal/recommend", json=body()).status_code == 401
    assert client.post("/internal/recommend", json=body(),
                       headers={"X-Internal-Key": "wrong"}).status_code == 401
    assert client.post("/internal/recommend", json=body(),
                       headers={"X-Internal-Key": "secret-123"}).status_code == 200

    monkeypatch.delenv("INTERNAL_API_KEY")
    importlib.reload(main) 

# ---------- matcher (EXACT / SEMANTIC) ----------

from conftest import BrokenEmbedder, FakeEmbedder  # noqa: E402

REACT_JS_DEV = {
    "userId": "d",
    "profile": {"skills": ["React.js"], "interests": [], "experienceLevel": "Intermediate",
                "collaborationPreferences": ["Project-based"]},
    "context": {"need": ["Docker"], "activity": "Building a software project",
                "availability": "Weekends", "interactionPreference": "Online"},
}


def test_matcher_defaults_to_exact(client):
    response = client.post("/internal/recommend", json=body())
    assert response.json()["matcher"] == "EXACT"


def test_exact_matcher_ignores_synonyms(client):
    response = client.post("/internal/recommend",
                           json=body(matcher="EXACT", candidates=[PYTHON_CLONE, REACT_JS_DEV]))
    assert [r["userId"] for r in response.json()["recommendations"]] == ["c", "d"]


def test_semantic_matcher_credits_synonyms(client, monkeypatch):
    monkeypatch.setattr(main, "EMBEDDER", FakeEmbedder())
    response = client.post("/internal/recommend",
                           json=body(matcher="SEMANTIC", candidates=[PYTHON_CLONE, REACT_JS_DEV]))

    assert response.status_code == 200
    data = response.json()
    assert data["matcher"] == "SEMANTIC"
    assert [r["userId"] for r in data["recommendations"]] == ["d", "c"]
    assert data["recommendations"][0]["reasons"][0]["items"] == ["React ≈ React.js"]


def test_semantic_matcher_unavailable_returns_503(client, monkeypatch):
    monkeypatch.setattr(main, "EMBEDDER", BrokenEmbedder())
    response = client.post("/internal/recommend", json=body(matcher="SEMANTIC"))

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SEMANTIC_MATCHER_UNAVAILABLE"


def test_exact_matcher_works_when_semantic_is_unavailable(client, monkeypatch):
    monkeypatch.setattr(main, "EMBEDDER", BrokenEmbedder())
    assert client.post("/internal/recommend", json=body(matcher="EXACT")).status_code == 200


def test_unknown_matcher_is_rejected(client):
    assert client.post("/internal/recommend", json=body(matcher="FUZZY")).status_code == 422