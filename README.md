# CONTEXA

**Context-Aware Human Matching and Recommendation System.** MCA Capstone Project, PES University.

CONTEXA recommends people to collaborate with based on who they are (their profile) and what they need right now (their context). It is built to test one research question:

> Does adding dynamic context to profile information improve how relevant people recommendations are?

The system has two recommendation modes:

| Mode                       | What it uses                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROFILE_ONLY` (baseline)  | Profile similarity only: skills, interests, experience level, collaboration preferences                                                                                                                          |
| `CONTEXT_AWARE` (proposed) | Profile similarity, current context (needs, activity, availability, interaction preference) and **directional complementarity**: how well each person covers the other's needs, where M(A→B) ≠ M(B→A) in general |

Each mode can compare terms (skills, interests, needs) in two ways:

| Matcher    | When two terms match                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `EXACT`    | Identical after trimming and lowercasing ("React" = " react ")                                                                             |
| `SEMANTIC` | Also near-synonyms, by sentence-embedding similarity ≥ 0.65 with all-MiniLM-L6-v2 ("React" ≈ "React.js", "AI" ≈ "Artificial Intelligence") |

That gives four variants to compare: `PROFILE_ONLY`, `CONTEXT_AWARE`, `PROFILE_ONLY:SEMANTIC` and `CONTEXT_AWARE:SEMANTIC`. Only term comparison differs between matchers; weights and every other factor are shared, so `SEMANTIC` never scores a pair lower than `EXACT` and only adds credit for near-synonyms.

Every recommendation comes with plain-language reasons ("They can help with what you need: React", or "React ≈ React.js" for a semantic match) that correspond exactly to the factors that produced its score.

## Architecture

```
Browser
   │  same origin, no CORS
   ▼
web/  (Next.js: UI + API routes under /api/v1)
   │  auth (JWT), profiles, contexts, candidate generation (stage 1)
   │
   ├──► MongoDB  (users, profiles, contexts, connections, feedback rounds, messages, experiments)
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
python download_model.py      # once: the ~90 MB embedding model for SEMANTIC matching
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

## Messaging

Two people can message each other once a connection request is accepted (`/messages`). Messages are fetched by polling: an open conversation checks for anything newer every second while people are chatting, slowing to every 2, 5 and finally 10 seconds as it goes quiet, and unread counts refresh every 30 seconds, all only while the tab is visible. Push over WebSockets would remove the delay entirely, but it needs a server that keeps connections open, which Vercel's serverless functions do not. Removing a connection deletes its messages. Each sender is limited to 20 messages a minute.

## Evaluation

Two kinds of evidence, both shown on the admin dashboard (`/admin`, linked as **Evaluation** in the header for admins):

**Real evidence: blind ratings.** On **Rate matches**, a user rates a shuffled pool built from the top 5 of every variant, without seeing scores, reasons or which variant chose whom. For each variant the dashboard reports the mean rating, precision (share rated 4 or 5) and NDCG (the variant's order against the best possible order from the same pool), with 95% bootstrap intervals. Variants are compared in pairs on the rounds that contain both. A difference is called only with at least 10 paired rounds and an interval that excludes zero. Connection requests are also counted by the variant that showed the person. **Export ratings (CSV)** downloads every rating, pseudonymised (ids only).

**System behaviour: synthetic experiment.** `npm run experiment` ranks every synthetic user under all four variants, once with their own context and once with another user's (same profile). It stores the lists and a summary in the `experiments` collection:

- how much the variants agree (overlap@K and rank-biased overlap)
- whether each variant responds to context (`PROFILE_ONLY` should not change after a context swap; `CONTEXT_AWARE` should)
- how many of the user's needs the top K cover (circular for `CONTEXT_AWARE`, so descriptive only)

```bash
cd web
npm run admin:grant -- you@example.com     # once: give your account the dashboard
npm run experiment                          # options: --k=10 --population=synthetic|all --seed=N --name="..." --matchers=EXACT
```

The experiment uses the same candidate generation and scoring service as the app, so `RECOMMENDATION_SERVICE_URL` must point at a running service. Against Render, run it once beforehand to wake the service.

## Tests

```bash
cd recommendation-service
python -m pytest -q

cd web
npm test
```

The recommendation service tests cover:

- **Parity:** Python scores and rankings exactly equal the TypeScript golden fixtures.
- **API contract:** positive and negative cases for `/internal/recommend`.
- **Explanations:** a reason appears exactly when its factor contributes to the score.
  The web tests cover the connection and messaging rules (who may send, accept, read and message, with positive and negative cases), the feedback pool, how polled messages are merged, the evaluation metrics (NDCG, precision, bootstrap intervals, verdicts, overlap, rank-biased overlap) and the experiment summary.
- **Semantic matching:** with no synonyms it reproduces `EXACT` exactly, it never scores below `EXACT`, synonyms change rankings, reasons name the matched pair, and a missing model fails fast with a 503 while `EXACT` keeps working. These use a small deterministic stand-in for the model; `tests/test_semantic_model.py` checks the real model and runs only once it is downloaded.

## Deployment

| Part                   | Host                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| Web app                | Vercel (Root Directory: `web`)                                     |
| Recommendation service | Render free web service (Root Directory: `recommendation-service`) |
| Database               | MongoDB Atlas (M0 free cluster)                                    |

On Render, the build command is `pip install -r requirements.txt && python download_model.py` and the start command is `uvicorn main:app --host 0.0.0.0 --port $PORT`. The model is downloaded at build time, so the running service never downloads it; if it is missing, `SEMANTIC` requests return 503 and `EXACT` is unaffected. With the model loaded the service uses about 270 MB of memory (free tier: 512 MB).

Render's free tier stops an idle service after 15 minutes and takes about a minute to wake it, which is why the production timeout is 60 seconds.

## Research integrity

- The weights in `matching.py` are a starting point, not a validated optimum.
- Results from synthetic data describe system behaviour, not real-world relevance.
- No claim is made that `CONTEXT_AWARE` is better until the evaluation shows it.
- The 0.65 similarity threshold was chosen by inspecting term pairs, not tuned on evaluation results. The same holds for `SEMANTIC`: no claim that it is better until the evaluation shows it.
- The synthetic users draw from a fixed list of distinct terms, so they understate what `SEMANTIC` changes; real users typing freely are the meaningful test.
