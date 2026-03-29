# Demo Test Plan

Requirements-based demo and acceptance checklist for the Nonprofit Client & Case Management Platform.

Use this file to verify the app against the core Client Case Management requirements before presenting or claiming final completion.

## Purpose

This plan is organized around the main product requirements:

- P0: must-have core workflow requirements
- P1: implemented admin/reporting workflow requirements
- Production verification: deployed frontend/backend behavior

## Test Environment

Test these environments if available:

- Local frontend: `http://localhost:3000`
- Local backend docs: `http://localhost:8000/api/v1/docs`
- Deployed frontend: `https://opportunity-hack-26.vercel.app`
- Deployed backend: `https://opportunity-hack-26.onrender.com`

## Test Accounts

- Admin: `maria@sunrise-demo.org` / `SeedPass123!`
- Staff: `james@sunrise-demo.org` / `SeedPass123!`
- Volunteer: `aisha@sunrise-demo.org` / `SeedPass123!`

## Preconditions

Before running this plan:

- [ ] Supabase schema is applied
- [ ] Seed data exists
- [ ] `client-documents` bucket exists in Supabase Storage
- [ ] Backend env vars are valid
- [ ] Frontend env vars are valid
- [ ] Google SSO is configured in Supabase if you want to test Google login
- [ ] Render backend is live
- [ ] Vercel frontend is live

## P0 Acceptance Tests

These are the minimum requirements to demonstrate the product works.

### P0-1 Auth + Role-Based Access

- [ ] Open the frontend homepage
- [ ] Confirm homepage loads without error
- [ ] Open `/login`
- [ ] Log in with email/password as `staff`
- [ ] Confirm redirect to `/dashboard`
- [ ] Open a protected route while logged out
- [ ] Confirm redirect to `/login`
- [ ] If Google SSO is configured, log in with Google
- [ ] Confirm Google login succeeds in the deployed environment
- [ ] Confirm `staff` can access normal workflow pages
- [ ] Confirm `admin` can access admin-only pages
- [ ] Confirm restricted pages redirect with an access-denied warning

Pass criteria:

- Auth works
- Unauthorized users cannot access protected pages
- Role restrictions behave correctly

### P0-2 Client Registration

- [ ] Log in as `staff`
- [ ] Open `/clients/new`
- [ ] Create a client with:
  - first name
  - last name
  - date of birth
  - phone
  - email
  - gender
  - language
  - household size
- [ ] Submit the form
- [ ] Confirm client record is created
- [ ] Confirm client has a unique ID
- [ ] Open `/clients`
- [ ] Search by the client’s first name
- [ ] Confirm the client appears in search results

Pass criteria:

- Staff can create a client
- Search by name works
- The list view shows the client

### P0-3 Service / Visit Logging

- [ ] Open the created client profile
- [ ] Click `+ Log Service`
- [ ] Create a service entry with:
  - date
  - service type
  - notes
- [ ] Save the service entry
- [ ] Confirm the service entry appears on the client profile
- [ ] Confirm the staff member is attached to the entry

Pass criteria:

- Staff can create service entries
- Entry includes date, type, staff, and notes

### P0-4 Client Profile View

- [ ] Open a client profile
- [ ] Confirm demographics appear at the top/left
- [ ] Confirm service history appears below/right
- [ ] Confirm newest service entries appear first
- [ ] Confirm the page behaves like a single client chart/profile view

Pass criteria:

- Client profile shows demographics and reverse-chronological service history

### P0-5 Deploy + Seed Data

- [ ] Open the public frontend URL
- [ ] Open the public backend `/health` endpoint
- [ ] Confirm the app is publicly reachable
- [ ] Confirm at least 10 seeded clients exist
- [ ] Confirm at least 30 seeded service entries exist
- [ ] Confirm README deployment/setup instructions are usable by another person

Pass criteria:

- App is deployed publicly
- Demo data exists
- README is sufficient for setup/deploy

## P1 Acceptance Tests

Run these if you want to confirm the implemented admin/reporting features.

### P1-1 CSV Import / Export

- [ ] Log in as `admin`
- [ ] Open `/clients`
- [ ] Confirm `Import CSV` button is visible
- [ ] Confirm `Export CSV` button is visible
- [ ] Export clients CSV
- [ ] Confirm the file downloads
- [ ] Import a small valid CSV file
- [ ] Confirm records are imported
- [ ] Import an invalid CSV file
- [ ] Confirm validation errors are shown

### P1-2 Basic Reporting Dashboard

- [ ] Log in as `staff` or `admin`
- [ ] Open `/reports`
- [ ] Confirm active clients stat is shown
- [ ] Confirm services this week/month/quarter chart is shown
- [ ] Confirm service type breakdown chart is shown
- [ ] Confirm visit trend chart is shown
- [ ] Click `Print Report`
- [ ] Confirm print layout is usable for PDF export

### P1-3 Scheduling / Calendar

- [ ] Open `/calendar`
- [ ] Create an appointment
- [ ] Confirm it appears in the calendar/upcoming view
- [ ] Refresh the page
- [ ] Confirm it remains visible

### P1-4 Configurable Fields

- [ ] Log in as `admin`
- [ ] Open `/clients/config`
- [ ] Add a custom field
- [ ] Confirm “field added” feedback appears
- [ ] Save changes
- [ ] Confirm save success message appears
- [ ] Open `/clients/new`
- [ ] Confirm the new custom field appears on the intake form
- [ ] Create a client using the custom field
- [ ] Open the client profile
- [ ] Confirm the custom field value appears correctly

### P1-5 Audit Log

- [ ] Log in as `admin`
- [ ] Open `/audit-log`
- [ ] Confirm audit rows are visible
- [ ] Create or update a client
- [ ] Return to `/audit-log`
- [ ] Confirm a new audit entry appears
- [ ] Confirm no raw sensitive case-note values are exposed if policy is to avoid PII contents

## Implemented AI / Advanced Workflow Tests

These are beyond the original P0/P1 minimums, but should be tested because they are core to the delivered product.

### AI-1 Photo Intake

- [ ] Log in as `staff`
- [ ] Open `/clients/new`
- [ ] Confirm the AI intake controls are visible for `staff`
- [ ] Click `Scan Intake Form`
- [ ] Upload a real intake-form photo or use one of the demo intake images
- [ ] Wait for the AI extraction to finish
- [ ] Confirm fields are prefilled
- [ ] Confirm at minimum these fields are extracted when present in the image:
  - first name
  - last name
  - date of birth
  - phone
  - email
  - address
- [ ] Confirm no page crash occurs if some fields are unreadable
- [ ] Confirm you can still edit the fields before saving
- [ ] Save the client
- [ ] Open the created client profile
- [ ] Confirm the saved demographics match the reviewed intake data

### AI-2 Voice Note Workflow

- [ ] Log in as `staff`
- [ ] Open an existing client profile
- [ ] Open a service entry form
- [ ] Confirm the voice-note / AI note tools are visible for `staff`
- [ ] Record a voice note
- [ ] Speak a short realistic note such as:
  - service provided
  - client concern
  - next step or follow-up
- [ ] Confirm transcription succeeds
- [ ] Confirm structured draft fields are generated
- [ ] Confirm the note content is mapped into the form rather than requiring manual re-entry
- [ ] Confirm staff can edit before saving
- [ ] Save the service entry
- [ ] Return to the client profile
- [ ] Confirm the saved service entry appears in history
- [ ] If the note implied a next step, confirm a follow-up is created when applicable

### AI-3 Semantic Search

- [ ] Log in as `staff` or `admin`
- [ ] Open `/clients`
- [ ] Confirm the semantic search panel is visible
- [ ] Search a natural-language query, not just an exact keyword
- [ ] Use a query such as:
  - `clients struggling with rent`
  - `people needing housing follow-up`
  - `clients reporting trouble sleeping`
- [ ] Confirm the search completes without error
- [ ] Confirm similar case notes are returned when matching data exists
- [ ] Confirm each result shows:
  - client name
  - service type
  - service date
  - similarity score
  - note snippet
- [ ] Confirm results link back to the correct client
- [ ] Confirm a no-match search returns a clean empty-state message, not a crash

### AI-4 Client Summary

- [ ] Log in as `staff` or `admin`
- [ ] Open a client profile with multiple service entries
- [ ] Click `Generate Summary`
- [ ] Confirm the request starts without page failure
- [ ] Confirm the summary is created as a draft
- [ ] Confirm the draft includes a useful handoff-style overview, not raw copied notes
- [ ] Confirm it is editable before saving
- [ ] Save the summary
- [ ] Refresh the page
- [ ] Confirm the saved summary remains visible on the client profile

### AI-5 Funder Report

- [ ] Log in as `admin`
- [ ] Open `/dashboard`
- [ ] Confirm the funder report panel is visible
- [ ] Select a reporting window
- [ ] Generate a funder report
- [ ] Confirm the request begins without error
- [ ] Confirm report text streams into the UI
- [ ] Confirm the metadata block shows the reporting period
- [ ] Confirm the raw CSV section is populated
- [ ] Confirm the narrative report is polished and readable
- [ ] Export the report to DOCX
- [ ] Confirm the document downloads successfully

### AI-6 Translation

- [ ] Log in as `staff` or `admin`
- [ ] Open client intake form
- [ ] Switch form language from English to Spanish
- [ ] Confirm visible labels and helper text translate
- [ ] Switch back to English
- [ ] Confirm labels return correctly
- [ ] Open service entry form
- [ ] Switch form language
- [ ] Confirm labels translate there as well
- [ ] Open a client profile with note content in history
- [ ] Click `Translate Note`
- [ ] Confirm inline translation appears
- [ ] Confirm the original note is not lost or overwritten
- [ ] If budget controls are active, confirm cached translations still load normally

## Role Permission Demo Checks

These are useful for showing that the system enforces access correctly.

### Volunteer

- [ ] Can log in
- [ ] Can create client
- [ ] Can log service
- [ ] Cannot access admin config
- [ ] Cannot access audit log

### Staff

- [ ] Can log in
- [ ] Can create and update client-facing work
- [ ] Can use AI workflows
- [ ] Can access reports
- [ ] Cannot access admin-only configuration pages

### Admin

- [ ] Can access all standard pages
- [ ] Can access config
- [ ] Can access audit log
- [ ] Can import/export client CSV
- [ ] Can generate funder report
- [ ] Can update AI budget

## Production Smoke Test

Run this after both frontend and backend are deployed.

- [ ] Open deployed frontend homepage
- [ ] Confirm no `500` error
- [ ] Open deployed login page
- [ ] Log in successfully
- [ ] Create a client from the deployed frontend
- [ ] Log a service from the deployed frontend
- [ ] Open the deployed backend docs page
- [ ] Confirm `/api/v1/docs` loads
- [ ] Confirm CORS allows frontend-to-backend requests successfully

## Final Requirements Sign-Off

Mark this only after the relevant sections above are complete.

- [ ] P0 requirements passed
- [ ] Chosen P1 features passed
- [ ] Deployed frontend passed smoke test
- [ ] Deployed backend passed smoke test
- [ ] Role restrictions verified
- [ ] Seed/demo data verified
- [ ] README deployment instructions verified by following them

## Test Notes

- Date:
- Tester:
- Environment:
- Issues found:
- Blocking issues:
- Retest needed:
