import os
import secrets
from typing import Annotated, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from matching import Mode, rank_candidates

# Upper bound on candidates per request. Candidate generation (retrieval)
# narrows the pool to at most this many before scoring, so request size and
# scoring cost stay bounded regardless of the total number of users.
MAX_CANDIDATES = 500
DEFAULT_LIMIT = 10
MAX_LIMIT = 50

# Optional shared secret. When set, callers must send it as X-Internal-Key.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

app = FastAPI(title="CONTEXA Recommendation Service")


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
    # Optional: the PROFILE_ONLY baseline does not use it.
    context: Optional[ContextIn] = None


class CandidateIn(BaseModel):
    userId: str
    profile: ProfileIn
    context: ContextIn


class RecommendRequest(BaseModel):
    mode: Mode
    limit: int = Field(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    requester: RequesterIn
    candidates: list[CandidateIn] = Field(max_length=MAX_CANDIDATES)


class RecommendationOut(BaseModel):
    userId: str
    score: float
    breakdown: dict[str, float]


class RecommendResponse(BaseModel):
    mode: Mode
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


@app.get("/health")
def health_check():
    return {
        "success": True,
        "message": "CONTEXA recommendation service is running.",
    }


@app.post("/internal/recommend", response_model=RecommendResponse)
def recommend(
    request: RecommendRequest,
    x_internal_key: Annotated[Optional[str], Header()] = None,
) -> RecommendResponse:
    _check_internal_key(x_internal_key)

    if request.mode == "CONTEXT_AWARE" and request.requester.context is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "ACTIVE_CONTEXT_NOT_FOUND",
                "message": "CONTEXT_AWARE mode requires the requester's context.",
            },
        )

    requester_context = (
        request.requester.context.model_dump()
        if request.requester.context is not None
        else None
    )

    ranked = rank_candidates(
        mode=request.mode,
        requester_profile=request.requester.profile.model_dump(),
        requester_context=requester_context,
        candidates=[candidate.model_dump() for candidate in request.candidates],
        limit=request.limit,
    )

    return RecommendResponse(
        mode=request.mode,
        recommendations=ranked,
        count=len(ranked),
        limit=request.limit,
    )