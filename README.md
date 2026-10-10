# CONTEXA

**Context-Aware Human Matching and Recommendation System.** MCA Capstone Project, PES University.

CONTEXA recommends people to collaborate with based on who they are (their profile) and what they need right now (their context). It is built to test one research question:

> Does adding dynamic context to profile information improve how relevant people recommendations are?

The system has two recommendation modes:

| Mode                       | What it uses                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROFILE_ONLY` (baseline)  | Profile similarity only: skills, interests, experience level, collaboration preferences                                                                                                                          |
| `CONTEXT_AWARE` (proposed) | Profile similarity, current context (needs, activity, availability, interaction preference) and **directional complementarity**: how well each person covers the other's needs, where M(A→B) ≠ M(B→A) in general |

Every recommendation comes with plain-language reasons ("They can help with what you need: React") that correspond exactly to the factors that produced its score.

## Architecture

```
Browser
   │  same origin, no CORS
   ▼
web/  (Next.js: UI + API routes under /api/v1)
   │  auth (JWT), profiles, contexts, candidate generation (stage 1)
   │
   ├──► MongoDB  (users, profiles, contexts)
   │
   └──► recommendation-service/  (Python FastAPI, stateless)
          POST /internal/recommend: scoring, ranking, explanations (stage 2)
          protected by the X-Internal-Key shared secret
```

Recommendation is two-stage:

1. **Candidate generation** (`web/src/server/recommendations/candidateGeneration.ts`). It is mode-neutral, so both modes rank the same pool, and bounded to at most 500 candidates however many users exist.
2. **Scoring** (`recommendation-service/matching.py`). Pure functions with no database access, so the matching logic can be tested on its own.

## Repository layout

| Path                      | Contents                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `web/`                    | Next.js app: pages, API routes, Mongoose models, seed scripts                               |
| `recommendation-service/` | FastAPI scoring service, matching engine, explanations, tests                               |
| `data/parity/`            | Golden fixtures proving the Python engine reproduces the original TypeScript scores exactly |

## Running locally

**Prerequisites:** Node.js 24, Python 3.14, and MongoDB 8 (or an Atlas connection string).

**1. Recommendation service**

```bash
cd recommendation-service
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**2. Web app** (in a second terminal)

```bash
cd web
cp .env.example .env.local    # then fill in the values
npm install
npm run db:seed               # optional: 100 reproducible synthetic users
npm run dev
```

Open http://localhost:3000.

## Environment variables

**Web app (`web/.env.local`, or Vercel project settings):**

| Variable                            | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `MONGODB_URI`                       | MongoDB connection string                                  |
| `JWT_SECRET`                        | Secret for signing login tokens                            |
| `RECOMMENDATION_SERVICE_URL`        | Base URL of the recommendation service                     |
| `INTERNAL_API_KEY`                  | Shared secret sent to the recommendation service           |
| `RECOMMENDATION_SERVICE_TIMEOUT_MS` | Scoring timeout; 10000 by default, use 60000 in production |

**Recommendation service:** `INTERNAL_API_KEY`, which must match the web app's value. Leave it unset locally to disable the check.

See `web/.env.example` and `recommendation-service/.env.example`.

## Tests

```bash
cd recommendation-service
python -m pytest -q
```

They cover:

- **Parity:** Python scores and rankings exactly equal the TypeScript golden fixtures.
- **API contract:** positive and negative cases for `/internal/recommend`.
- **Explanations:** a reason appears exactly when its factor contributes to the score.

## Deployment

| Part                   | Host                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| Web app                | Vercel (Root Directory: `web`)                                     |
| Recommendation service | Render free web service (Root Directory: `recommendation-service`) |
| Database               | MongoDB Atlas (M0 free cluster)                                    |

On Render, the build command is `pip install -r requirements.txt` and the start command is `uvicorn main:app --host 0.0.0.0 --port $PORT`.

Render's free tier stops an idle service after 15 minutes and takes about a minute to wake it, which is why the production timeout is 60 seconds.

## Research integrity

- The weights in `matching.py` are a starting point, not a validated optimum.
- Results from synthetic data describe system behaviour, not real-world relevance.
- No claim is made that `CONTEXT_AWARE` is better until the evaluation shows it.
