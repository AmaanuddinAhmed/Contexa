"""Shared test helpers."""

import numpy as np
import pytest

# Terms that the fake model treats as near-synonyms (cosine 0.9 within a group).
SYNONYMS = [
    {"ai", "machine learning", "artificial intelligence"},
    {"ui", "ui design", "design", "figma", "ui/ux"},
    {"cloud", "aws"},
    {"react", "react.js", "frontend"},
    {"node.js", "backend"},
    {"evenings", "weekday evenings", "after 6pm"},
]
# Related but below the 0.65 threshold (cosine 0.5): must NOT match.
WEAKLY_RELATED = [{"python", "java"}]


class FakeEmbedder:
    """
    Deterministic stand-in for the real model. Every text gets its own
    direction; texts in the same group also share a group direction, which
    sets their cosine similarity (0.9 for SYNONYMS, 0.5 for WEAKLY_RELATED).
    Everything else is orthogonal (similarity 0).
    """

    DIMENSIONS = 8192

    def __init__(self, synonyms=SYNONYMS, weakly_related=WEAKLY_RELATED):
        self.groups = [(group, 3.0) for group in synonyms] + [
            (group, 1.0) for group in weakly_related
        ]
        self.own_axis: dict[str, int] = {}
        self.calls = 0

    def _vector(self, text: str) -> np.ndarray:
        vector = np.zeros(self.DIMENSIONS, dtype=np.float32)
        axis = self.own_axis.setdefault(text, len(self.groups) + len(self.own_axis))
        vector[axis] = 1.0

        for index, (group, weight) in enumerate(self.groups):
            if text in group:
                vector[index] = weight

        return vector / np.linalg.norm(vector)

    def embed(self, texts: list[str]) -> np.ndarray:
        self.calls += 1
        return np.stack([self._vector(text) for text in texts])


class BrokenEmbedder:
    def embed(self, texts):
        from semantic import SemanticMatcherUnavailable

        raise SemanticMatcherUnavailable("model not available")


@pytest.fixture
def fake_embedder():
    return FakeEmbedder()