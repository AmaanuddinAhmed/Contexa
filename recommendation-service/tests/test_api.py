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