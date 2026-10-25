# Accidental Zone Reminder System — Deployment Guide

Complete deployment guide for making the application publicly accessible.

---

## Architecture

```
User Browser
    │
    ▼
Vercel (Frontend — React/Vite SPA)
    │  VITE_API_URL baked in at build time
    │
    ▼
Render.com (Backend — FastAPI/Python)
    │  /api/zones  /api/demo-zones  /health
    │
    ├── In-memory CSV store (always available)
    └── Supabase PostgreSQL (optional — activates when env vars are set)
```

---

## Step 1 — Push to GitHub

Run these commands from the project root **the first time**:

```bash
git init
git add .
git commit -m "feat: initial deployment-ready configuration"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

> **Important:** Never run `git add .env` — .gitignore blocks it, but verify
> with `git status` before every commit.

---

## Step 2 — Deploy Backend on Render.com

1. Go to https://render.com and sign in with GitHub.
2. Click **New → Web Service**.
3. Select your repository.
4. Render auto-detects `render.yaml`. Verify these settings:
   - **Name:** `accidental-zone-reminder-api`
   - **Region:** Singapore (closest free-tier for India)
   - **Branch:** `main`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn api.index:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
5. Add **Environment Variables**:

| Key | Value |
|-----|-------|
| `ALLOWED_ORIGINS` | *(leave blank — fill after Vercel step)* |
| `SUPABASE_URL` | *(optional)* your Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | *(optional)* your Supabase service role key |

6. Click **Create Web Service** and wait ~3–5 minutes.
7. Test: visit `https://YOUR-SERVICE.onrender.com/health`
   → Expected: `{"status":"healthy","service":"accidental-zone-reminder-api"}`

---

## Step 3 — Deploy Frontend on Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New → Project** → Import your repository.
3. `vercel.json` is detected. Confirm:
   - **Framework Preset:** Other
   - **Root Directory:** `.` (project root, not `frontend/`)
   - **Build Command:** `cd frontend && npm ci && npm run build`
   - **Output Directory:** `frontend/dist`
4. Add **Environment Variable**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://YOUR-SERVICE.onrender.com` |

5. Click **Deploy** and wait ~2 minutes.
6. Copy your public URL: `https://YOUR-APP.vercel.app`

---

## Step 4 — Wire CORS (Backend → Frontend)

Go back to Render dashboard → your web service → **Environment** tab:

- Set `ALLOWED_ORIGINS` = `https://YOUR-APP.vercel.app`
  *(no trailing slash; exact URL as given by Vercel)*
- Click **Save Changes** — Render redeploys automatically.

---

## Step 5 — Verify End-to-End

Visit your Vercel URL and confirm:

- [ ] Dashboard loads with zone statistics
- [ ] Map shows accident zone pins (red) and demo GPS zones (purple)
- [ ] Monitor / Alert functionality works
- [ ] Analysis tab loads data table

In DevTools → Network, verify `/api/zones` returns 200 from Render (not localhost).

---

## Local Development (unchanged)

```bash
# Terminal 1 — Backend
cd "DAE PROJECT"
pip install -r requirements-dev.txt
uvicorn api.index:app --reload --port 8000

# Terminal 2 — Frontend
cd "DAE PROJECT/frontend"
npm install
npm run dev
# Opens http://localhost:5173 — Vite proxies /api/* to localhost:8000
```

No `.env` changes needed for local development.

---

## Environment Variables Reference

### Backend — set in Render dashboard

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_ORIGINS` | Production | Comma-separated Vercel frontend URLs for CORS |
| `SUPABASE_URL` | Optional | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service-role key (server-side only) |

### Frontend — set in Vercel dashboard

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production | Full URL of Render backend |

---

## Data Files

Files in `data/raw/` are committed to Git and served by the backend:

| File | Description |
|------|-------------|
| `accident_zones_2024_normalized.csv` | Real 2024 accident zone records |
| `accident_zones_demo.csv` | Demo dataset |
| `accident_zones_gps_demo.csv` | Demo GPS zones for the map |

These are public non-sensitive datasets. They are loaded into memory at startup.

---

## Security Checklist

- [x] `.env` is in `.gitignore` — never committed
- [x] `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never in frontend
- [x] CORS restricted to Vercel domain in production
- [x] Frontend uses relative `/api/*` paths (no hardcoded localhost)
- [x] `.env.example` has only placeholder values — safe to commit
