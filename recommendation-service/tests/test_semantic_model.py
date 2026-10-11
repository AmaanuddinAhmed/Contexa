"""
The real embedding model (all-MiniLM-L6-v2). Skipped unless it is available:
run `python download_model.py` first, or set SEMANTIC_MODEL_PATH.
"""

import pytest

from semantic import FastEmbedEmbedder, SemanticTerms

pytestmark = pytest.mark.skipif(
    not FastEmbedEmbedder.is_installed(), reason="embedding model not downloaded"
)

MATCH = [
    ("React", "React.js"),
    ("Node.js", "NodeJS"),
    ("AI", "Artificial Intelligence"),
    ("UI/UX", "UI/UX Design"),
    ("Data Analysis", "Data Science"),
    ("Weekday evenings", "Evenings"),
]
NO_MATCH = [
    ("Java", "JavaScript"),
    ("Python", "Java"),
    ("React", "Docker"),
    ("Machine Learning", "Cooking"),
]


@pytest.fixture(scope="module")
def terms():
    vocabulary = [term for pair in MATCH + NO_MATCH for term in pair]
    return SemanticTerms(FastEmbedEmbedder(), vocabulary)


@pytest.mark.parametrize("first,second", MATCH)
def test_near_synonyms_match(terms, first, second):
    assert terms.similarity(first, second) > 0


@pytest.mark.parametrize("first,second", NO_MATCH)
def test_different_things_do_not_match(terms, first, second):
    assert terms.similarity(first, second) == 0


def test_vectors_are_normalised():
    vectors = FastEmbedEmbedder().embed(["react", "python"])
    assert vectors.shape == (2, 384)
    assert abs(float((vectors[0] ** 2).sum()) - 1) < 1e-5