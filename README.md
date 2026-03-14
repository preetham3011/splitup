SplitUP — Expense Splitting Application
======================================

Overview
--------

SplitUP is a full‑stack Splitwise‑style web application for managing shared expenses with friends, family, and roommates. It lets you create groups, add expenses with multiple split types, track per‑member balances, record settlements, and monitor budgets, all backed by a FastAPI + MongoDB backend and a modern React UI.

Key Features
-----------

- **Authentication**
  - Google OAuth login
  - JWT‑based session handling on the backend
- **Groups & Members**
  - Create/join groups with invite codes
  - View group members and basic stats
- **Expenses**
  - Equal, exact, and percentage splits
  - Support for subset splits and payer not in split
  - Automatic balance recomputation on add/delete
- **Settlements**
  - Record partial and full settlements between members
  - Settlement suggestions based on current balances
  - Settlements do **not** count as expenses or affect budgets
- **Budgets**
  - Per‑group category budgets (MongoDB‑backed)
  - Spent/remaining/percent‑used per category
- **Dashboard & Activity**
  - Global dashboard stats for the current user
  - Per‑group cards with your net balance and budget usage
  - Activity feed for recent actions

Tech Stack
----------

- **Frontend**
  - React (Create React App + CRACO)
  - React Router
  - Tailwind CSS
  - shadcn/ui (Radix UI primitives)
  - Axios for API calls
  - Lucide React, Sonner, Recharts, date‑fns

- **Backend**
  - Python 3.11+
  - FastAPI
  - Uvicorn (ASGI server)
  - Motor (async MongoDB driver) + PyMongo
  - Pydantic v2
  - python‑jose, passlib[bcrypt] for auth
  - python‑dotenv for configuration

- **Database**
  - MongoDB (Atlas recommended)

Repository Structure
--------------------

At the repository root:

- `backend/` — FastAPI application
- `frontend/` — React application
- `docs/` *(optional)* — additional documentation (if you add any)
- `README.md` — this file
- `.gitignore` — ignores Python/Node/IDE artifacts

Backend layout:

- `backend/main.py` — FastAPI entrypoint (`app`)
- `backend/server.py` — alternative server module (status test/demo)
- `backend/routes/` — API route modules (auth, groups, expenses, balances, budgets, dashboard, activity, etc.)
- `backend/models/` — Pydantic request/response models
- `backend/data/` — storage and business logic (Mongo + in‑memory helpers)
- `backend/requirements.txt` — consolidated backend dependencies

Frontend layout:

- `frontend/src/`
  - `pages/` — top‑level route components (dashboard, groups, group detail, login, settings, etc.)
  - `components/` — feature and UI components (tabs, modals, dashboard cards, shadcn/ui primitives)
  - `services/api.js` — centralized API client for the backend
  - `contexts/` — auth and other React context providers
  - `lib/` and `hooks/` — utilities and shared hooks
- `frontend/public/` — static assets
- `frontend/package.json` — frontend dependencies and scripts

Setup Instructions
------------------

### 1. Backend Setup

From the repository root:

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # macOS / Linux

pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` file in `backend/` with at least:

```env
MONGO_URL=<your MongoDB connection string>
DB_NAME=splitup
GOOGLE_CLIENT_ID=<your Google OAuth client ID>
JWT_SECRET=<your JWT secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Run the backend:

```bash
cd backend
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000` (FastAPI docs at `/docs`).

### 2. Frontend Setup

From the repository root:

```bash
cd frontend
npm install
npm start
```

The React app will run on `http://localhost:3000` by default.

Configuration for the frontend (e.g. API base URL, Google client ID) is handled via the usual CRA/Tailwind config and `.env` files in `frontend/` (for example, `REACT_APP_API_BASE_URL` if you add one). Ensure that the frontend points to the backend base URL `http://localhost:8000/api`.

Environment Variables Summary
-----------------------------

Minimum backend variables:

- **`MONGO_URL`** — MongoDB Atlas or local URI  
- **`DB_NAME`** — database name (e.g. `splitup`)  
- **`GOOGLE_CLIENT_ID`** — Google OAuth client ID  
- **`JWT_SECRET`** — secret used to sign JWTs  
- **`JWT_ALGORITHM`** — typically `HS256`  
- **`ACCESS_TOKEN_EXPIRE_MINUTES`** — token lifetime  
- **`CORS_ORIGINS`** — comma‑separated list of allowed origins

For the frontend, typical `.env` entries might include:

- `REACT_APP_API_BASE_URL=http://localhost:8000/api`
- `REACT_APP_GOOGLE_CLIENT_ID=<same client ID>`

Architecture Overview
---------------------

- **Frontend** communicates only with the backend via a JSON REST API (`/api/...`).
- **Backend** is the single source of truth for:
  - Expense split normalization (equal/exact/percentage, subset splits, payer not in split).
  - Balance computation including expenses **and** settlements.
  - Budget aggregation (spent/remaining/percent used).
- **MongoDB** stores users, groups, group members, expenses, settlements, and budgets.

All critical business logic (splits, balances, settlements, budgets) lives in `backend/data/storage.py` and is consumed by route modules; the React app never recomputes balances on its own, it only displays what the API returns.

Deployment Overview
-------------------

One possible production deployment setup:

- **Frontend**: Vercel (build the React app with `npm run build` and deploy the static bundle).
- **Backend**: Railway / Render / other ASGI‑compatible host
  - Run `uvicorn main:app` with an appropriate process manager.
  - Set environment variables for Mongo, JWT, and Google OAuth.
- **Database**: MongoDB Atlas
  - Create a cluster and database.
  - Whitelist your backend host and set `MONGO_URL` accordingly.

GitHub Readiness Notes
----------------------

- `node_modules/`, `venv/`, `__pycache__/`, build outputs, and environment files are ignored via `.gitignore`.
- All core application code lives under `backend/` and `frontend/`; debug/test artifacts and AI analysis markdown files have been removed to keep the repository clean.
- To validate after cloning:
  1. Configure backend `.env` and run `uvicorn main:app --reload` from `backend/`.
  2. Run `npm install && npm start` from `frontend/`.

License / Usage
---------------

This project is intended for educational and portfolio use. Adjust the license and contribution guidelines as needed for your own deployment or coursework.

