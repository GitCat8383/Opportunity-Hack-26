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

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `DATABASE_URL` | Direct PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API key |

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
