# Test Plan

Manual test plan for the Nonprofit Client & Case Management Platform.

This file is meant to help verify the app role by role before claiming P0 or broader milestone completion.

## Environment Setup

Before testing:

- Ensure `backend/.env` is filled with valid Supabase and Gemini keys.
- Ensure `frontend/.env.local` is filled with valid Supabase public keys and API URL.
- Ensure the Supabase Storage bucket `client-documents` exists if you want to test document uploads.
- Ensure seed data exists in Supabase.

Start the backend:

```bash
cd backend
uvicorn app.main:app --reload
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open the app:

- `http://localhost:3000/login`

## Test Accounts

- Admin: `maria@sunrise-demo.org` / `SeedPass123!`
- Staff: `james@sunrise-demo.org` / `SeedPass123!`
- Volunteer: `aisha@sunrise-demo.org` / `SeedPass123!`

## Volunteer Test

Expected scope:

- Can log in
- Can create clients
- Can log service entries
- Cannot access admin-only features
- Should not have staff/admin AI tools exposed for restricted workflows

Checklist:

- [ ] Log in as `aisha@sunrise-demo.org`
- [ ] Confirm redirect to `/dashboard`
- [ ] Open `/clients`
- [ ] Open `/clients/new`
- [ ] Create a client with:
  - First name: `Test`
  - Last name: `Volunteer`
  - DOB: `1995-05-10`
  - Phone: `555-111-2222`
  - Email: `volunteer-test@example.com`
- [ ] Confirm save succeeds
- [ ] Confirm the new client appears in `/clients`
- [ ] Open the new client profile
- [ ] Confirm demographics render correctly
- [ ] Click `+ Log Service`
- [ ] Create a service entry with:
  - Date: today
  - Service type: `Food Assistance`
  - Notes: `Client received pantry support and requested next-week follow-up.`
- [ ] Confirm the service entry saves
- [ ] Confirm the new entry appears on the client profile in reverse chronological order
- [ ] Try opening `/audit-log`
- [ ] Confirm access is denied or redirected
- [ ] Try opening admin config pages such as `/clients/config`
- [ ] Confirm access is denied or redirected
- [ ] Confirm admin-only actions like CSV import/export are not exposed

## Staff Test

Expected scope:

- Can do all core casework flows
- Can use AI features
- Cannot access admin-only controls

Checklist:

- [ ] Log in as `james@sunrise-demo.org`
- [ ] Confirm redirect to `/dashboard`
- [ ] Open `/clients`
- [ ] Search by an existing seeded client name
- [ ] Confirm matching client results appear
- [ ] Create a new client
- [ ] Confirm the client profile loads after save
- [ ] Log a manual service entry
- [ ] Confirm it appears in the client profile history
- [ ] Test voice-note flow on the service entry page
- [ ] Confirm recording starts
- [ ] Confirm transcription returns text
- [ ] Confirm structured note fields are prefilled
- [ ] Test photo intake on the client registration form
- [ ] Confirm uploaded image pre-fills client fields
- [ ] Test semantic search from `/clients`
- [ ] Confirm relevant results are returned for a natural-language query
- [ ] Test `Generate Summary` on a client profile
- [ ] Confirm summary appears as an editable draft
- [ ] Open `/reports`
- [ ] Confirm charts render
- [ ] Confirm `Print Report` opens a printable layout
- [ ] Try opening `/audit-log`
- [ ] Confirm access is denied or redirected
- [ ] Try opening `/clients/config`
- [ ] Confirm access is denied or redirected

## Admin Test

Expected scope:

- Can access all staff features
- Can access admin configuration, audit, reporting, and export/import flows

Checklist:

- [ ] Log in as `maria@sunrise-demo.org`
- [ ] Confirm redirect to `/dashboard`
- [ ] Confirm admin navigation items are visible
- [ ] Open `/clients/config`
- [ ] Add a custom field
- [ ] Confirm the new field appears on the client registration form
- [ ] Open `/clients`
- [ ] Test CSV export
- [ ] Confirm CSV downloads successfully
- [ ] Test CSV import with a small sample file
- [ ] Confirm valid rows import successfully
- [ ] Confirm invalid rows show validation errors inline
- [ ] Open `/audit-log`
- [ ] Confirm create/update/delete events appear
- [ ] Open `/dashboard`
- [ ] Generate a funder report
- [ ] Confirm the report streams into the UI
- [ ] Export the generated report to DOCX
- [ ] Confirm the DOCX downloads and opens
- [ ] Open `/reports`
- [ ] Confirm charts render correctly
- [ ] Click `Print Report`
- [ ] Confirm print layout hides app navigation and looks PDF-ready
- [ ] Check AI budget settings in org config
- [ ] Confirm admin can view and update the monthly AI budget

## Document Upload Test

Precondition:

- Supabase bucket `client-documents` exists

Checklist:

- [ ] Log in as staff or admin
- [ ] Open a client profile
- [ ] Upload a document
- [ ] Confirm upload succeeds
- [ ] Confirm document appears in the profile documents panel
- [ ] Download the uploaded document
- [ ] Confirm the downloaded file is correct

## Translation Test

Checklist:

- [ ] Open the client registration form
- [ ] Switch language toggle from English to Spanish
- [ ] Confirm labels and placeholders translate
- [ ] Open the service entry form
- [ ] Switch language toggle from English to Spanish
- [ ] Confirm labels and placeholders translate
- [ ] Open a client profile with an English or Spanish case note
- [ ] Click `Translate Note`
- [ ] Confirm inline translated text appears in lighter styling
- [ ] Click `Show Original`
- [ ] Confirm original note text is shown again

## Scheduling Test

Checklist:

- [ ] Log in as staff or admin
- [ ] Open `/calendar`
- [ ] Create a new appointment
- [ ] Confirm the appointment appears in the weekly view
- [ ] Refresh the page
- [ ] Confirm the appointment still appears

## Security and Access Checks

Checklist:

- [ ] As a logged-out user, open `/clients`
- [ ] Confirm redirect to `/login`
- [ ] As volunteer, try `/audit-log`
- [ ] Confirm redirect or denial
- [ ] As volunteer, try `/clients/config`
- [ ] Confirm redirect or denial
- [ ] As staff, try admin-only config pages
- [ ] Confirm redirect or denial
- [ ] Confirm users only see their own org's records

## Seed Data Verification

Checklist:

- [ ] Confirm seeded org exists: `Sunrise Services`
- [ ] Confirm at least 10 clients exist
- [ ] Confirm at least 30 service entries exist
- [ ] Confirm seeded users can log in

## P0 Sign-Off

P0 from the SRD is functionally complete if all of these pass:

- [ ] Login works via email
- [ ] Login works via Google SSO
- [ ] Unauthorized users are blocked
- [ ] Client registration works
- [ ] Client list works
- [ ] Search by client name works
- [ ] Client profile shows demographics and reverse-chronological service history
- [ ] Service entry creation works
- [ ] Seed data is present and usable

P0 is fully complete only after both of these are also true:

- [ ] Frontend is deployed to a public URL
- [ ] Backend is deployed to a public URL
- [ ] README deployment instructions are accurate and sufficient for another person to set up the project

## Notes

Use this section while testing:

- Date tested:
- Tester:
- Environment:
- Known issues:
- Retest needed:
