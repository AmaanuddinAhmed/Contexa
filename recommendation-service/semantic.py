from __future__ import annotations

import os
from collections import OrderedDict
from pathlib import Path
from typing import Iterable, Optional, Protocol

import numpy as np

from matching import ProfileData, _normalize, text_similarity as exact_text_similarity

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

SIMILARITY_THRESHOLD = 0.65

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models"

CACHE_SIZE = 20_000


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> np.ndarray:
        ...


class SemanticMatcherUnavailable(RuntimeError):
    pass


class FastEmbedEmbedder:

    def __init__(self, allow_download: bool = False) -> None:
        self._model = None
        self._allow_download = allow_download
        self._cache: OrderedDict[str, np.ndarray] = OrderedDict()

    @staticmethod
    def is_installed() -> bool:
        if os.getenv("SEMANTIC_MODEL_PATH"):
            return True

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
        first_key, second_key = _normalize(first), _normalize(second)

        if first_key == second_key:
            return 1.0

        first_index = self._index.get(first_key)
        second_index = self._index.get(second_key)

        if first_index is None or second_index is None:
            return 0.0

        return float(self._similarities[first_index, second_index])

    def best_match(self, term: str, reference: list[str]) -> tuple[float, Optional[str]]:
        best_score, best_term = 0.0, None

        for candidate in reference:
            score = self.similarity(term, candidate)

            if score > best_score:
                best_score, best_term = score, candidate

        return best_score, best_term


    def array_similarity(self, first: list[str], second: list[str]) -> float:
        if not first or not second:
            return 0.0

        first_terms = list({_normalize(term): term for term in first}.values())
        second_terms = list({_normalize(term): term for term in second}.values())

        forward = sum(self.best_match(term, second_terms)[0] for term in first_terms)
        backward = sum(self.best_match(term, first_terms)[0] for term in second_terms)
        overlap = (forward + backward) / 2
        union = len(first_terms) + len(second_terms) - overlap

        return 0.0 if union <= 0 else overlap / union

    def text_similarity(self, first: str, second: str) -> float:
        exact = exact_text_similarity(first, second)

        if not _normalize(first) or not _normalize(second):
            return exact

        return max(exact, self.similarity(first, second))

    def need_fulfillment(self, needs: list[str], profile: ProfileData) -> float:
        if not needs:
            return 0.0

        capabilities = [*profile.get("skills", []), *profile.get("interests", [])]

        return sum(self.best_match(need, capabilities)[0] for need in needs) / len(needs)


    def matched(self, values: list[str], reference: list[str]) -> list[str]:
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