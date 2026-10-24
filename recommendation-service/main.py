import os
import secrets
from contextlib import asynccontextmanager
from typing import Annotated, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from explain import explain_match
from matching import EXACT, Matcher, Mode, TermMatcher, rank_candidates
from semantic import (
    FastEmbedEmbedder,
    SemanticMatcherUnavailable,
    SemanticTerms,
    request_vocabulary,
)

MAX_CANDIDATES = 500
DEFAULT_LIMIT = 10
MAX_LIMIT = 50

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY") or None

MIN_INTERNAL_KEY_LENGTH = 32


def is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("RENDER", "").lower() == "true"
    )


IS_PRODUCTION = is_production()


def check_security_config(internal_key: Optional[str], production: bool) -> None:
    if not production:
        return

    if internal_key is None:
        raise RuntimeError("INTERNAL_API_KEY must be set in production.")

    if len(internal_key) < MIN_INTERNAL_KEY_LENGTH:
        raise RuntimeError(
            f"INTERNAL_API_KEY must be at least {MIN_INTERNAL_KEY_LENGTH} characters "
            "in production."
        )

EMBEDDER = FastEmbedEmbedder()

@asynccontextmanager
async def lifespan(_app: FastAPI): 
    check_security_config(INTERNAL_API_KEY, IS_PRODUCTION) 

    if FastEmbedEmbedder.is_installed():
        try:
            EMBEDDER.load()
            print("Semantic matcher ready.")
        except SemanticMatcherUnavailable as error:
            print(f"Semantic matcher unavailable: {error}")
    else:
        print("Semantic matcher not installed: run `python download_model.py`.")

    yield


app = FastAPI(
    title="CONTEXA Recommendation Service",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skills: list[str] = []
    interests: list[str] = []
    experienceLevel: Optional[str] = None
    collaborationPreferences: list[str] = []


class ContextIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    need: list[str] = []
    activity: str
    availability: str
    interactionPreference: str


class RequesterIn(BaseModel):
    profile: ProfileIn
    context: Optional[ContextIn] = None


class CandidateIn(BaseModel):
    userId: str
    profile: ProfileIn
    context: ContextIn


class RecommendRequest(BaseModel):
    mode: Mode
    matcher: Matcher = "EXACT"
    limit: int = Field(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    requester: RequesterIn
    candidates: list[CandidateIn] = Field(max_length=MAX_CANDIDATES)


class ReasonOut(BaseModel):
    code: str
    text: str
    items: list[str]


class RecommendationOut(BaseModel):
    userId: str
    score: float
    breakdown: dict[str, float]
    reasons: list[ReasonOut]


class RecommendResponse(BaseModel):
    mode: Mode
    matcher: Matcher
    recommendations: list[RecommendationOut]
    count: int
    limit: int


def _check_internal_key(provided: Optional[str]) -> None:
    if INTERNAL_API_KEY is None:
        return

    if provided is None or not secrets.compare_digest(provided, INTERNAL_API_KEY):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid internal key."},
        ) 

def require_internal_key(
    x_internal_key: Annotated[Optional[str], Header()] = None,
) -> None:
    _check_internal_key(x_internal_key)


@app.get("/health")
def health_check():
    return {
        "success": True,
        "message": "CONTEXA recommendation service is running.",
    }


@app.post(
    "/internal/recommend",
    response_model=RecommendResponse,
    dependencies=[Depends(require_internal_key)],
)
def recommend(request: RecommendRequest) -> RecommendResponse:

    if request.mode == "CONTEXT_AWARE" and request.requester.context is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "ACTIVE_CONTEXT_NOT_FOUND",
                "message": "CONTEXT_AWARE mode requires the requester's context.",
            },
        )

    requester_profile = request.requester.profile.model_dump()
    requester_context = (
        request.requester.context.model_dump()
        if request.requester.context is not None
        else None
    )

    candidates = [candidate.model_dump() for candidate in request.candidates]
    terms: TermMatcher = EXACT

    if request.matcher == "SEMANTIC":
        try:
            terms = SemanticTerms(
                EMBEDDER,
                request_vocabulary(
                    {"profile": requester_profile, "context": requester_context},
                    candidates,
                ),
            )
        except SemanticMatcherUnavailable as error:
            print(f"Semantic matcher unavailable: {error}")
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "SEMANTIC_MATCHER_UNAVAILABLE",
                    "message": "The semantic matcher is not available.",
                },
            ) from error

    ranked = rank_candidates(
        mode=request.mode,
        requester_profile=requester_profile,
        requester_context=requester_context,
        candidates=candidates,
        limit=request.limit,
        terms=terms,
    )

    candidates_by_id = {candidate.userId: candidate for candidate in request.candidates}
    recommendations = []

    for result in ranked:
        candidate = candidates_by_id[result["userId"]]
        reasons = explain_match(
            request.mode,
            requester_profile,
            candidate.profile.model_dump(),
            requester_context,
            candidate.context.model_dump(),
            terms,
        )
        recommendations.append({**result, "reasons": reasons})

    return RecommendResponse(
        mode=request.mode,
        matcher=request.matcher,
        recommendations=recommendations,
        count=len(recommendations),
        limit=request.limit,
    )