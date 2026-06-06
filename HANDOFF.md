# Well Circle — Hackathon Handoff Document

This document summarizes all the work completed during this session and provides explicit instructions for the frontend and deployment teams to pick up the project seamlessly.

---

## 1. Project Architecture
The project utilizes a modern tripartite architecture:
- **Backend (`/backend`)**: Built with FastAPI and SQLAlchemy. Connects to PostgreSQL (Supabase). Ready for deployment on **Render**.
- **Frontend (`/frontend`)**: Built with React + Vite. Designed to be a Telegram Mini App. Ready for deployment on **Vercel**.
- **Telegram Bot (`/telegram-bot`)**: Built with `python-telegram-bot`. Handles the `/start` command and re-engagement messaging. Ready for deployment on **Railway**.

---

## 2. Backend Implementation (Completed ✅)
The backend is fully complete and tested. 

**Key Features Implemented:**
- **29 RESTful API Endpoints**: Covers Users, Communities, Providers, Bookings, Payments, and Admin functions.
- **Authentication**: Validates Telegram Mini App `initData` payloads using HMAC with the bot token, issuing secure JWTs for subsequent requests.
- **Points Engine & Gamification**: Users earn points for daily community check-ins. A background scheduler (`APScheduler`) automatically decays points for users inactive for over 3 days.
- **Role-Based Access**: Support for regular users, providers, and super admins.
- **Integration Tests**: 25 comprehensive integration tests covering all CRUD operations and business logic are passing via an in-memory SQLite database.
- **Seed Data**: A seed script (`backend/app/db/seed.py`) is provided to populate test users/providers once connected to Supabase.

---

## 3. Frontend Implementation Status
The frontend has been scaffolded using Vite and React, but the UI/UX implementation has been purposefully left to the frontend team.

**What the Frontend Team Needs to Do:**
1. **Review References:** Read `BACKEND_REFERENCE.md` and `API_CONTRACT.md` (located in the project root) to understand all available endpoints, schemas, and enums.
2. **Implement Telegram Auth:** Extract `Telegram.WebApp.initData` and send it to `POST /api/auth/telegram` to receive the user object and session JWT.
3. **Build the Onboarding Flow:** Create the 5-step UI to collect user Name, Goal, Interest Category, Exercise Frequency, and optional circle suggestions (`POST /api/users/me/onboard`).
4. **Environment Variables:** Set `VITE_API_BASE_URL` to point to the deployed Render backend URL.

---

## 4. Deployment Guide

Since the local network IPv6 issue prevented local database connections, deploying to cloud providers will resolve this by enabling cloud-to-cloud connections over standard networks.

### A. Backend Deployment (Render)
1. Log into the [Render Dashboard](https://dashboard.render.com).
2. Click **New** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure the settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add the necessary Environment Variables (from your local `.env`):
   - `DATABASE_URL` (Use your Supabase Transaction/Session pooler URL)
   - `JWT_SECRET` (A strong random string)
   - `TELEGRAM_BOT_TOKEN`
   - `BOT_API_KEY` (The shared secret, e.g., `wc_bot_secret_2026_hackathon`)
   - `FRONTEND_URL`
   - `ENVIRONMENT=production`
6. Deploy!

### B. Telegram Bot Deployment (Railway)
1. Log into the [Railway Dashboard](https://railway.app).
2. Create a new project -> **Deploy from GitHub repo**.
3. Set the **Root Directory** to `telegram-bot` in the project settings.
4. The system will detect the `Procfile` (`worker: python -m bot.main`) and `requirements.txt`.
5. Add Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `BACKEND_URL` (Your newly deployed Render backend URL)
   - `BOT_API_KEY` (Same shared secret as above)
   - `MINI_APP_URL` (Your Vercel URL, once deployed)
6. Deploy!

### C. Frontend Deployment (Vercel)
1. Log into the [Vercel Dashboard](https://vercel.com).
2. Add a **New Project** and import the GitHub repository.
3. Configure the settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. Add Environment Variable:
   - `VITE_API_BASE_URL` (Your Render backend URL)
5. Deploy!

---

## 5. Final Checklist
- [x] Push all code to the `main` branch.
- [x] Connect and deploy the Backend on Render (added `render.yaml`).
- [x] Connect and deploy the Frontend on Vercel (added `vercel.json`).
- [x] Connect and deploy the Bot on Railway (added `railway.json`).
- [ ] Run `python -m app.db.seed` in the backend (using a shell in Render or locally after fixing the IPv6 connection) to populate test data.
- [ ] Register the deployed Vercel URL with BotFather as the Mini App URL.
