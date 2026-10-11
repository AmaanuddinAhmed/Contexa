"""
CONTEXA semantic term matching: the SEMANTIC matcher.

EXACT (matching.py) treats two terms as the same only when they are identical
after trim + lowercase, so "React" and "React.js" never match. SEMANTIC also
gives credit when two terms mean nearly the same thing, using sentence
embeddings from all-MiniLM-L6-v2.

Design rules:
- Only term comparison changes. Weights, experience levels and interaction
  preference are shared with matching.py, so EXACT vs SEMANTIC differ in one
  thing only, and any change in ranking is caused by term matching.
- Two terms match if their cosine similarity is at least SIMILARITY_THRESHOLD.
  The credit is the similarity itself, and identical terms always get 1.
- SEMANTIC never gives less than EXACT: every factor is at least its EXACT
  value (tests/test_semantic.py checks this). It only adds credit for
  near-synonyms.
- The model sits behind the `Embedder` protocol, so tests use a small
  deterministic fake and need no model download.
"""

from __future__ import annotations

import os
from collections import OrderedDict
from pathlib import Path
from typing import Iterable, Optional, Protocol

import numpy as np

from matching import ProfileData, _normalize, text_similarity as exact_text_similarity

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# Chosen by inspecting pairs, not tuned on evaluation results:
#   above it: React ~ React.js 0.88, AI ~ Artificial Intelligence 0.79,
#             UI/UX ~ UI/UX Design 0.84, Data Analysis ~ Data Science 0.67
#   below it: AWS ~ Cloud Computing 0.52, Python ~ Java 0.45, Java ~ JavaScript 0.40
SIMILARITY_THRESHOLD = 0.65

# Where download_model.py stores the model at build time.
DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models"

# Term vectors kept in memory between requests (384 floats each, about 1.5 KB).
CACHE_SIZE = 20_000


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> np.ndarray:
        """One L2-normalised row per text, in the same order."""
        ...


class SemanticMatcherUnavailable(RuntimeError):
    """The embedding model could not be loaded."""


class FastEmbedEmbedder:
    """
    all-MiniLM-L6-v2 through fastembed (ONNX Runtime, no PyTorch).

    Loaded on first use (or at startup, see main.py). Looks in
    SEMANTIC_MODEL_PATH if set (a folder with model.onnx and tokenizer files),
    otherwise in the models/ folder filled by download_model.py.

    Only download_model.py downloads (allow_download=True). The running
    service never does: a missing model fails in under a second instead of
    stalling requests on a 90 MB download with retries.
    """

    def __init__(self, allow_download: bool = False) -> None:
        self._model = None
        self._allow_download = allow_download
        self._cache: OrderedDict[str, np.ndarray] = OrderedDict()

    @staticmethod
    def is_installed() -> bool:
        """True when a model is available locally (no download needed)."""
        if os.getenv("SEMANTIC_MODEL_PATH"):
            return True

        # A failed download can leave an empty folder, so look for the model file.
        return DEFAULT_MODEL_DIR.exists() and any(DEFAULT_MODEL_DIR.rglob("*.onnx"))

    def load(self) -> None:
        if self._model is not None:
            return

        try:
            from fastembed import TextEmbedding

            model_path = os.getenv("SEMANTIC_MODEL_PATH")
            options = (
                {"specific_model_path": model_path}
                if model_path
                else {
                    "cache_dir": str(DEFAULT_MODEL_DIR),
                    "local_files_only": not self._allow_download,
                }
            )
            # One thread: free-tier hosts have a fraction of one CPU.
            self._model = TextEmbedding(MODEL_NAME, threads=1, **options)
        except Exception as error:  # noqa: BLE001 - any failure means "unavailable"
            raise SemanticMatcherUnavailable(str(error)) from error

    def embed(self, texts: list[str]) -> np.ndarray:
        self.load()

        missing = [text for text in dict.fromkeys(texts) if text not in self._cache]

        if missing:
            vectors = np.array(list(self._model.embed(missing)), dtype=np.float32)
            vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)

            for text, vector in zip(missing, vectors):
                self._cache[text] = vector

        for text in texts:
            self._cache.move_to_end(text)

        while len(self._cache) > CACHE_SIZE:
            self._cache.popitem(last=False)

        return np.stack([self._cache[text] for text in texts])


class SemanticTerms:
    """
    Term matcher for one request. Embeds the request's whole vocabulary once
    and precomputes every pairwise similarity, so scoring hundreds of
    candidates is table lookups rather than model calls.
    """

    def __init__(
        self,
        embedder: Embedder,
        vocabulary: Iterable[str],
        threshold: float = SIMILARITY_THRESHOLD,
    ) -> None:
        keys = sorted({_normalize(term) for term in vocabulary} - {""})
        self._index = {key: position for position, key in enumerate(keys)}
        self.threshold = threshold

        if keys:
            vectors = embedder.embed(keys)
            similarities = np.clip(vectors @ vectors.T, 0.0, 1.0)
            similarities[similarities < threshold] = 0.0
            np.fill_diagonal(similarities, 1.0)
            self._similarities = similarities
        else:
            self._similarities = np.zeros((0, 0))

    def similarity(self, first: str, second: str) -> float:
        """1 for identical terms, cosine similarity above the threshold, else 0."""
        first_key, second_key = _normalize(first), _normalize(second)

        if first_key == second_key:
            return 1.0

        first_index = self._index.get(first_key)
        second_index = self._index.get(second_key)

        if first_index is None or second_index is None:
            return 0.0

        return float(self._similarities[first_index, second_index])

    def best_match(self, term: str, reference: list[str]) -> tuple[float, Optional[str]]:
        """The closest term in `reference` and its similarity (0, None if none)."""
        best_score, best_term = 0.0, None

        for candidate in reference:
            score = self.similarity(term, candidate)

            if score > best_score:
                best_score, best_term = score, candidate

        return best_score, best_term

    # ----- the TermMatcher interface (see matching.py) -----

    def array_similarity(self, first: list[str], second: list[str]) -> float:
        """
        Soft Jaccard. Each term's credit is its best match on the other side.
        The overlap is the average of both directions:

            overlap = (sum over A of best match in B + sum over B of best match in A) / 2
            score   = overlap / (|A| + |B| - overlap)

        With only exact matches this is exactly the Jaccard index EXACT uses.
        """
        if not first or not second:
            return 0.0

        # Unique terms, as EXACT compares sets.
        first_terms = list({_normalize(term): term for term in first}.values())
        second_terms = list({_normalize(term): term for term in second}.values())

        forward = sum(self.best_match(term, second_terms)[0] for term in first_terms)
        backward = sum(self.best_match(term, first_terms)[0] for term in second_terms)
        overlap = (forward + backward) / 2
        union = len(first_terms) + len(second_terms) - overlap

        return 0.0 if union <= 0 else overlap / union

    def text_similarity(self, first: str, second: str) -> float:
        """
        Free text (activity, availability): the better of EXACT's word overlap
        and the whole-phrase similarity, e.g. "Weekday evenings" ~ "Evenings".
        """
        exact = exact_text_similarity(first, second)

        # Blank text has no words, so EXACT scores it 0; keep that.
        if not _normalize(first) or not _normalize(second):
            return exact

        return max(exact, self.similarity(first, second))

    def need_fulfillment(self, needs: list[str], profile: ProfileData) -> float:
        """Average over needs of the best match among the other's skills and interests."""
        if not needs:
            return 0.0

        capabilities = [*profile.get("skills", []), *profile.get("interests", [])]

        # Duplicate needs count individually, as in EXACT.
        return sum(self.best_match(need, capabilities)[0] for need in needs) / len(needs)

    # ----- explanations -----

    def matched(self, values: list[str], reference: list[str]) -> list[str]:
        """
        Items of `values` with a match in `reference`, for explanations.
        Exact matches are shown as-is; semantic ones as "React ≈ React.js".
        """
        seen: set[str] = set()
        matched: list[str] = []

        for value in values:
            key = _normalize(value)

            if key in seen:
                continue

            score, partner = self.best_match(value, reference)

            if score > 0 and partner is not None:
                seen.add(key)
                label = value.strip()

                if _normalize(partner) != key:
                    label = f"{label} ≈ {partner.strip()}"

                matched.append(label)

        return matched


def request_vocabulary(requester: dict, candidates: list[dict]) -> list[str]:
    """Every term and phrase the scorer may compare in one request."""
    terms: list[str] = []

    def add(profile: Optional[dict], context: Optional[dict]) -> None:
        if profile:
            terms.extend(profile.get("skills") or [])
            terms.extend(profile.get("interests") or [])
            terms.extend(profile.get("collaborationPreferences") or [])

        if context:
            terms.extend(context.get("need") or [])
            terms.append(context.get("activity") or "")
            terms.append(context.get("availability") or "")

    add(requester.get("profile"), requester.get("context"))

    for candidate in candidates:
        add(candidate.get("profile"), candidate.get("context"))

    return terms