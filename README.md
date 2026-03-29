# Nonprofit Client & Case Management Platform

A lightweight, AI-powered client and case management web application built for small nonprofits. Track clients, log services, and report outcomes — all in one place, for under $30/month.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (React 18, TypeScript), shadcn/ui, Tailwind CSS |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Database | Supabase (PostgreSQL 15 + pgvector) |
| Auth | Supabase Auth (Google SSO + email/password) |
| AI | Google Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini gemini-embedding-001 |
| Hosting | Vercel (frontend), Railway/Render (backend) |

## Features

**Core (P0)**
- Client registration with configurable demographic fields
- Service/visit logging with chronological history
- Client profile view (demographics + service timeline)
- Role-based access: Volunteer, Staff, Admin
- Multi-tenant data isolation via Supabase RLS

**AI-Powered (P2)**
- Voice-to-structured case notes (Gemini 2.5 Flash native audio)
- Photo-to-intake form digitization (Gemini 2.5 Pro vision)
- Semantic search across all case notes (pgvector)
- AI-generated client handoff summaries
- Smart follow-up detection from case notes
- Auto-generated funder reports
- Multilingual support (EN/ES)

## Project Structure

```
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── core/           # Config, database, Supabase client
│   │   ├── middleware/     # Auth (JWT validation, role checks)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routers/        # API endpoints (clients, service entries, AI)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic
│   │   └── main.py         # FastAPI app entrypoint
│   └── requirements.txt
├── frontend/                # Next.js application
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   ├── lib/            # Supabase client, API helpers, utilities
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript interfaces
│   └── package.json
├── database/
│   ├── schema.sql          # Full PostgreSQL schema (paste into Supabase SQL editor)
│   └── seed.py             # Seed script (15 clients, 50 service entries)
└── build_plan.md           # Step-by-step build plan
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Supabase project ([supabase.com](https://supabase.com))
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))

### 1. Database Setup

1. Create a new Supabase project
2. Open the SQL Editor in your Supabase dashboard
3. Paste the contents of `database/schema.sql` and run it
4. This creates all tables, RLS policies, indexes, and triggers
5. Create a private Supabase Storage bucket named `client-documents`
6. In Supabase Auth, enable:
   - Email/password
   - Google OAuth if you want Google SSO in local or production

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Fill in your keys
uvicorn app.main:app --reload
```

The API will be running at `http://localhost:8000`. Docs at `http://localhost:8000/api/v1/docs`.

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local  # Fill in your Supabase public keys
npm run dev
```

The app will be running at `http://localhost:3000`.

### 4. Seed Demo Data

```bash
cd database
pip install supabase python-dotenv
python seed.py
```

This inserts a fictional nonprofit "Sunrise Services" with 15 clients and 50 service entries.

## Deployment

Recommended production hosting:

- Frontend: [Vercel](https://vercel.com)
- Backend: [Render](https://render.com)

Railway also works for the backend, but the instructions below use Render because it is straightforward for a FastAPI service.

### Deploy Backend to Render

1. Push this repository to GitHub.
2. Open [Render](https://render.com) and create a new `Web Service`.
3. Connect the GitHub repository.
4. Configure the service:
   - Root Directory: `backend`
   - Runtime: `Python`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql+asyncpg://postgres:your-password@db.your-project.supabase.co:5432/postgres
GEMINI_API_KEY=your-gemini-api-key
DEBUG=false
CORS_ORIGINS=https://your-frontend.vercel.app
```

6. Deploy the service.
7. After deploy, verify:
   - `https://your-backend-url/health`
   - `https://your-backend-url/api/v1/docs`

### Deploy Frontend to Vercel

1. Open [Vercel](https://vercel.com) and create a new project from the same GitHub repository.
2. Set the project root directory to `frontend`.
3. Add environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://your-backend-url/api/v1
```

4. Deploy the project.
5. After deploy, open the public Vercel URL and verify:
   - `/`
   - `/login`
   - `/dashboard` after sign-in

### Google SSO Setup

If you want Google SSO to work in production:

1. In Supabase Auth, enable Google as a provider.
2. Add your Vercel production URL to the allowed redirect URLs in Supabase.
3. Add your local URL too if you want local Google login:
   - `http://localhost:3000/dashboard`
4. Test Google sign-in from the deployed frontend, not just localhost.

### Production Verification Checklist

After both apps are deployed:

1. Confirm email/password login works from the public frontend.
2. Confirm Google SSO works from the public frontend if enabled.
3. Confirm client create/list/profile/service-entry flows work.
4. Confirm protected pages redirect correctly when not authenticated.
5. Confirm admin pages such as `/clients/config` and `/audit-log` work for admin only.
6. Confirm AI routes work:
   - photo intake
   - voice note transcription
   - semantic search
   - summaries
   - funder reports
7. Confirm document upload works using the `client-documents` bucket.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `DATABASE_URL` | Direct PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `CORS_ORIGINS` | Allowed frontend origins. Use a comma-separated list or JSON array. Example: `http://localhost:3000,https://your-frontend.vercel.app` |
| `DEBUG` | FastAPI debug flag (`true` locally, `false` in production) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000/api/v1`) |

## Roles & Permissions

| Action | Volunteer | Staff | Admin |
|--------|-----------|-------|-------|
| Register clients | Yes | Yes | Yes |
| Log services | Yes | Yes | Yes |
| Edit clients | | Yes | Yes |
| AI features | | Yes | Yes |
| Delete/archive clients | | | Yes |
| Manage staff accounts | | | Yes |
| Configure custom fields | | | Yes |
| View audit log | | | Yes |
| Generate funder reports | | | Yes |
| Export all org data | | | Yes |

## License

Open source — built by Opportunity Hack for the nonprofit community.
