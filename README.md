# Penny Money 

A private personal spending tracker that teaches the user while it tracks. Record transactions, set a monthly budget, and let Google Gemini turn your spending into insights and education: an overview of your financial lifestyle that describes how you spend, projected habits, trade-offs, and curated next steps.
## Features

- **Ledger** — record inflows and outflows against vendors, accounts, and categories; move money between accounts with transfers (never counted as spending); reconcile accounts with adjustments.
- **Budgeting** — set a monthly budget, watch spent this month and left to spend, and log subscriptions that count toward each month.
- **AI insights** — Google Gemini reads your transactions (with your choice of raw or sanitised sharing mode) and produces a personalised overview with habits, projected habits, trade-offs, suggestions, and recommendations to guides and resources.
- **Education** — short guides and external resources, plus personalised explanations written in your own categories, vendors, and amounts.
## Stack

| Layer    | Tech                                          |
| -------- | --------------------------------------------- |
| Frontend | React 19, Vite, React Router (`frontend/`)    |
| Backend  | FastAPI, SQLAlchemy,(`backend/`)              |
| Database | PostgreSQL, SQL migrations (`db/migrations/`) |
| AI       | Google Gemini                                 |
| Auth     | Auth0 (JWT)                                   |
| Deploy   | Docker Compose: nginx + API (`compose.yaml`)  |

## Quick start

```sh
# backend environment (used by both local dev and the Docker API container)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

cp .env.example .env            # fill in the VITE_AUTH0_* values

cat > backend/.env <<EOF
DATABASE_URL=postgresql://...
AUTH0_DOMAIN=...
AUTH0_AUDIENCE=...
CORS_ORIGINS=...
GEMINI_API_KEY=...
EOF

docker compose up --build       # web on :80/:443, API proxied by nginx
```

Local development without Docker:

```sh
# backend (needs DATABASE_URL etc. in backend/.env)
cd backend && uvicorn main:app --reload

# frontend (proxies API via vite config)
cd frontend && npm install && npm run dev
```

## Layout

```
backend/pennies/    FastAPI modules: ledger, budgets, categories, dashboard,
                    guides, resources, gemini, auth, db, models, schemas
frontend/src/       React pages: Dashboard, Transactions, Accounts, Spending
                    Habits, Recommendations, Guides
db/migrations/      numbered SQL migrations (run via db/migrate.sh)
docs/               ADRs, specs, agent docs
GLOSSARY.md         domain language (financial portrait, transfer, ...)
```

## Tests

```sh
cd backend  && pytest
cd frontend && npm test
```

## Privacy

The AI sharing mode is per-user. It defaults to raw (full transaction detail: vendor, amount, category, date, note) until you switch to sanitised (amounts, categories, calendar months, and balances only — no vendor names or notes).
