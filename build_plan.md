What we are going to build: 
A nonprofit client & case management web platform — think a lightweight, AI-supercharged alternative to expensive tools like Salesforce or Bonterra, built specifically for small nonprofits (food banks, therapy centers, animal rescues, etc.) that can't afford $50–150/user/month.
The core idea is simple: nonprofits need to register clients, log services, and report outcomes. Every nonprofit asks for the same thing, just with different vocabulary. Your app solves all of them with one configurable system and wraps it in AI features.

Techstack:
Frontend: Next.js 14+ (React 18, TypeScript), shadcn/ui + Tailwind CSS
Backend: Python 3.11, FastAPI + SQLAlchemy + Alembic
Database: Supabase (PostgreSQL 15 + pgvector)
AI: Google Gemini 2.5 Pro (vision, summaries, reports), Gemini 2.5 Flash (transcription, structuring, follow-ups, translation), Gemini gemini-embedding-001 (semantic search)
Auth & Security: Supabase Auth (Google SSO + email, JWT)
Hosting: Vercel (frontend), Railway/Render (backend)

Dashboard — the first thing staff sees when they log in. Stat cards at the top (active clients, services this week, open follow-ups, AI spend). Below that: a live "Pending Follow-Ups" list sorted by urgency (AI-detected from case notes), and a bar chart of services by type for the month.
Clients — a searchable, sortable table of all clients with their ID, language, last service date, and status. Buttons for CSV import/export and adding new clients. Clicking any row opens their profile.
Profile — the core screen of the app. Left side has the client's demographics and custom fields. Right side has the AI-generated handoff summary with a Regenerate button. Below is the full chronological service history. A "+ Log service" button is always visible here.
Log service — the service entry form. Has a "Scan intake form" button (photo-to-intake AI) at the top right, a voice record button that triggers Gemini audio transcription + structuring, and after saving — the green AI nudge box showing any follow-ups the AI detected in the note.
The whole app is intentionally simple — it needs to be usable by a food bank volunteer with no tech background. Every AI feature is invisible until you need it, never in the way.

Auth + Role-Based Access:
When a user logs in via Google SSO or email, Supabase issues a JWT that FastAPI validates on every request. From there, access splits by role: volunteers can register new clients and log service entries — the basics needed for field work like food bank intake. Staff get everything volunteers have plus the ability to edit client records, use all AI features (voice notes, semantic search, photo intake, handoff summaries), and manage their own follow-ups. Admins get the full picture — deleting and archiving clients, managing staff accounts, configuring custom fields, enabling or disabling AI features per the org's data policy, viewing the audit log, generating funder reports, and exporting all org data. Crucially, every user regardless of role can only ever see their own organization's data — a staff member at one nonprofit cannot accidentally (or intentionally) access another org's clients, even if they share the same database, because Supabase RLS enforces org-level isolation at the database layer independently of the application code.

To do step:
Step 1: ✅ COMPLETED
[x] Create Supabase project, save URL + anon key — MANUAL (user)
[x] Create Vercel account, link GitHub — MANUAL (user)
[x] Fund Google Gemini API key (Google AI Studio) — MANUAL (user)
[x] Pre-write DB schema SQL → database/schema.sql
[x] Pre-write seed script (15 clients, 50 service entries) → database/seed.py
[x] Scaffold FastAPI project locally → backend/
[x] Scaffold Next.js 14+ frontend locally, install shadcn/ui + Tailwind → frontend/
[x] Write README with one-click deploy instructions and project overview → README.md
Step 2: 🔄 IN PROGRESS
[x] Paste DB schema into Supabase SQL editor, run it (14 tables, 22 indexes, pgvector 0.8.0)
[x] Enable pgvector extension (CREATE EXTENSION IF NOT EXISTS vector)
[ ] Set up Supabase Google SSO, create Admin + Staff test accounts — MANUAL (user)
[x] Configure RLS policies on clients, service_entries, follow_ups, audit_log (34 policies on 13 tables)
[ ] Deploy FastAPI skeleton to Railway/Render, confirm it's live — MANUAL (user)
[ ] Deploy Next.js frontend to Vercel, confirm it's live — MANUAL (user)
[ ] Set all env vars on both deployments (SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY) — MANUAL (user)
[x] Run seed script, confirm data appears in Supabase dashboard (1 org, 3 staff, 15 clients, 50 entries)
[x] Create POST /ai/{action} skeleton route with auth check (9 endpoints in ai.py)
[x] Create prompts table with version history (prompt registry for AI system prompts)
[x] Create organizations table and ensure all data tables include org_id for multi-tenant isolation
[x] Verify RLS policies enforce org-level data isolation across all tables
Step 3:
[x] Client list page with search by name
[x] Client registration form (name, DOB, phone, email + extra_fields JSONB)
[x] Client profile page (demographics + service history, reverse chron)
[x] Service entry form (date, service type dropdown, staff, notes)
[x] Role-based route guards (middleware checking Supabase session + role)
Step 4:
[x] POST /ai/embed — takes service_entry_id, calls Gemini gemini-embedding-001, stores in embeddings table
[x] Backfill script — embed all 50 seed service entries now (so pgvector index is warm)
[x] match_documents Supabase RPC function (cosine similarity, threshold 0.75, limit 10)
[x] POST /ai/search — embed query, run RPC, return matched entries with client + snippet
[x] Add embed-on-save hook to service entry creation endpoint (async, non-blocking)
[x] Test semantic search with 5 natural language queries
Step 5:
[x] org_config table — store extra_fields JSON schema per org
[x] Admin panel to add/remove custom fields (renders dynamically on client form)
[x] CSV export — clients table → download via pandas or manual CSV build
[x] CSV import — upload CSV, parse, bulk insert with validation errors shown inline
Step 6: Scheduling, Calendar & Document Uploads
[x] Create appointments table (client_id, staff_id, scheduled_date, type, status, notes)
[x] Appointment creation form (date/time picker, client selector, service type)
[x] Calendar view page showing upcoming appointments for today/this week (use a lightweight calendar component)
[x] In-app reminder system for upcoming appointments (Supabase Realtime or polling)
[x] Document upload button on client profile (intake forms, signed waivers, photos)
[x] POST /clients/{id}/documents — upload to Supabase Storage with org-level access controls
[x] Display attached documents on client profile page
Step 7: AI — Photo Intake & Voice Notes
[x] Camera/upload button on client registration form
[x] POST /ai/photo-intake — base64 image → Gemini 2.5 Pro → JSON → pre-fill form fields
[x] Prepare 3 demo images (handwritten form, printed form, napkin)
[x] Record button on service entry form (browser MediaRecorder API → .webm blob)
[x] POST /ai/transcribe — audio blob → Gemini 2.5 Flash (native audio) → transcript
[x] POST /ai/structure-note — transcript + service types → Gemini 2.5 Flash → structured JSON (summary, service type, action items, follow-up date, risk flag)
[x] Pre-fill service entry form fields from structured JSON response
[x] Add loading toast: "Recording → Transcribing → Structuring"
Step 8: Audit Log, Summaries & Follow-Ups
[x] Supabase trigger on INSERT/UPDATE/DELETE for clients and service_entries → writes to audit_log (no PII values, just metadata)
[x] Admin audit log view page
[x] POST /ai/summarize-client — fetch all service entries for client, send to Gemini 2.5 Pro, return structured handoff summary
[x] "Generate Summary" button on client profile with "Regenerate" + copy-to-clipboard
[x] Ensure all AI outputs are shown as editable drafts — never auto-saved without human confirmation (human-in-the-loop)
[x] POST /ai/extract-followups — async call on every service entry save → Gemini 2.5 Flash → writes to follow_ups table
[x] Dashboard "Pending Follow-Ups" widget sorted by urgency (Supabase Realtime subscription)
Step 9: Full Integration & Funder Reports
[x] Wire all AI features into actual UI (semantic search bar, voice button, photo button, summary button, follow-ups widget)
[x] Add loading spinners/toasts to all AI calls
[x] End-to-end test of full user journey
[x] Admin dashboard "Generate Report" button with quarter date range picker
[x] POST /ai/funder-report — SQL aggregation → Gemini 2.5 Pro (long context, streaming) → narrative report
[x] Stream response to frontend via SSE (report appears word by word)
[x] Export report to .docx using python-docx
[x] Prepare "before vs after" demo: raw CSV dump vs polished report side by side
Step 10:
[x] Language toggle (EN/ES) on registration and service entry forms
[x] POST /ai/translate — check translations cache table first, call Gemini 2.5 Flash on miss, store result
[x] Batch-translate all form labels + placeholder text on language switch
[x] "Translate Note" toggle on case notes (inline translation, lighter font color)
[x] Reporting dashboard page — 4 charts using Recharts: active clients (stat), services this week/month/quarter (bar), service type breakdown (pie), visit trend (line)
[x] Print button (window.print() + print-only CSS) for PDF export
Step 11: AI Cost Tracking & Demo Prep
[x] ai_usage_log table — log feature, model, tokens, cost, input/output hashes after every AI call (privacy audit trail)
[x] Per-org monthly AI budget cap in org_config — enforce at the API gateway, return 429 when exceeded
[x] Admin widget showing total AI spend (live dashboard)
[ ] Seed compelling demo narrative: fictional nonprofit "Sunrise Services", 3 realistic clients, one with 20+ case notes, one Spanish-speaking
[ ] Script the 5-minute demo (spreadsheet chaos → photo intake → voice note → semantic search → handoff summary → funder report → AI spend = $0.14)
[ ] Record demo video and prepare DevPost submission
Step 12: Polish & Launch
[ ] Mobile responsiveness pass (client list + service entry form at minimum)
[ ] PWA manifest for mobile installability (optional stretch)
[ ] Fix bugs found during integration
[ ] Double-check all env vars set in production deployments
[ ] Update README with final setup instructions, architecture diagram, and screenshots
