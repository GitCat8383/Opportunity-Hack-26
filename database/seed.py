"""
Seed script for Nonprofit Client & Case Management Platform.
Inserts: 1 org, 3 staff profiles (with auth users), 15 clients, 50 service entries.
Fictional nonprofit: "Sunrise Services" — a food bank + social services org.

Usage:
    pip install supabase python-dotenv
    python seed.py
"""

import os
import uuid
import random
from datetime import date, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Organization ──────────────────────────────────────────────
ORG_ID = str(uuid.uuid4())
org = {
    "id": ORG_ID,
    "name": "Sunrise Services",
    "slug": "sunrise-services",
    "settings": {},
}

# ── Staff definitions ────────────────────────────────────────
STAFF_DEFS = [
    {"full_name": "Maria Lopez", "email": "maria@sunrise-demo.org", "role": "admin", "password": "SeedPass123!"},
    {"full_name": "James Carter", "email": "james@sunrise-demo.org", "role": "staff", "password": "SeedPass123!"},
    {"full_name": "Aisha Patel", "email": "aisha@sunrise-demo.org", "role": "volunteer", "password": "SeedPass123!"},
]

# ── Clients ───────────────────────────────────────────────────
CLIENT_DATA = [
    {"first_name": "Rosa", "last_name": "Martinez", "language": "es", "gender": "Female", "household_size": 5,
     "phone": "602-555-0101", "date_of_birth": "1985-03-12"},
    {"first_name": "David", "last_name": "Nguyen", "language": "en", "gender": "Male", "household_size": 2,
     "phone": "602-555-0102", "date_of_birth": "1978-07-22"},
    {"first_name": "Fatima", "last_name": "Al-Rashid", "language": "en", "gender": "Female", "household_size": 4,
     "phone": "602-555-0103", "date_of_birth": "1990-01-15"},
    {"first_name": "Marcus", "last_name": "Johnson", "language": "en", "gender": "Male", "household_size": 1,
     "phone": "602-555-0104", "date_of_birth": "1965-11-30"},
    {"first_name": "Elena", "last_name": "Petrova", "language": "en", "gender": "Female", "household_size": 3,
     "phone": "602-555-0105", "date_of_birth": "1992-06-08"},
    {"first_name": "Carlos", "last_name": "Rivera", "language": "es", "gender": "Male", "household_size": 6,
     "phone": "602-555-0106", "date_of_birth": "1980-09-25"},
    {"first_name": "Sarah", "last_name": "Thompson", "language": "en", "gender": "Female", "household_size": 2,
     "phone": "602-555-0107", "date_of_birth": "1988-04-17"},
    {"first_name": "Ahmed", "last_name": "Hassan", "language": "en", "gender": "Male", "household_size": 5,
     "phone": "602-555-0108", "date_of_birth": "1975-12-03"},
    {"first_name": "Lisa", "last_name": "Chen", "language": "en", "gender": "Female", "household_size": 3,
     "phone": "602-555-0109", "date_of_birth": "1995-08-20"},
    {"first_name": "Robert", "last_name": "Williams", "language": "en", "gender": "Male", "household_size": 1,
     "phone": "602-555-0110", "date_of_birth": "1960-02-14"},
    {"first_name": "Maria", "last_name": "Gonzalez", "language": "es", "gender": "Female", "household_size": 4,
     "phone": "602-555-0111", "date_of_birth": "1987-10-05"},
    {"first_name": "Kevin", "last_name": "Brown", "language": "en", "gender": "Male", "household_size": 2,
     "phone": "602-555-0112", "date_of_birth": "1993-01-28"},
    {"first_name": "Priya", "last_name": "Sharma", "language": "en", "gender": "Female", "household_size": 3,
     "phone": "602-555-0113", "date_of_birth": "1982-05-19"},
    {"first_name": "Thomas", "last_name": "Anderson", "language": "en", "gender": "Male", "household_size": 4,
     "phone": "602-555-0114", "date_of_birth": "1970-07-11"},
    {"first_name": "Ana", "last_name": "Morales", "language": "es", "gender": "Female", "household_size": 7,
     "phone": "602-555-0115", "date_of_birth": "1983-12-22"},
]

SERVICE_TYPES = [
    "Food Assistance",
    "Housing",
    "Mental Health",
    "Legal",
    "Medical",
    "Education",
    "General",
    "Other",
]

# Realistic case note templates
CASE_NOTES = [
    "Client came in for weekly food box pickup. Mentioned difficulty paying rent this month. Referred to housing assistance program.",
    "Initial intake completed. Client is a single mother of three. Needs help with SNAP application and school supplies for children.",
    "Follow-up visit. Client reports that the food assistance has been very helpful. Still looking for stable employment. Provided job board resources.",
    "Client requested help with utility bills. Connected with LIHEAP program. Also discussed budgeting strategies.",
    "Mental health check-in. Client expressed feelings of anxiety related to housing instability. Scheduled follow-up with counselor next week.",
    "Client attended financial literacy workshop. Showed strong engagement. Will follow up on action items from the session.",
    "Emergency food assistance provided. Client lost job last week. Discussed unemployment benefits and emergency assistance options.",
    "Client brought children for after-school program enrollment. Completed paperwork. Kids start Monday.",
    "Helped client fill out Section 8 housing application. Waitlist is approximately 6 months. Discussed interim options.",
    "Client mentioned she has been skipping meals to feed her children. Will check in next week about food assistance options and WIC enrollment.",
    "Quarterly review. Client has made significant progress. Secured part-time employment at local grocery store. Continuing food assistance.",
    "Client needs help with medical bills from ER visit. No insurance. Referred to hospital financial assistance program and Medicaid application.",
    "Home visit completed. Living conditions are adequate but cramped. Family of 6 in a 2-bedroom apartment. Added to housing waitlist.",
    "Client is a recent immigrant. Needs ESL classes and help understanding school enrollment for children. Connected with local community college.",
    "Legal consultation arranged for client regarding custody issues. Pro bono attorney from partner org will follow up within 5 business days.",
    "Client expressed interest in GED program. Enrolled in next cohort starting in January. Transportation may be an issue — exploring bus pass options.",
    "Food bank visit. Client specifically requested culturally appropriate food items. Updated our inventory to include more diverse options.",
    "Client reports landlord has not fixed heating. Documented issue. Connected with tenant rights organization for assistance.",
    "Client completed parenting classes. Certificate issued. Positive feedback about the program. Will continue attending support group.",
    "Wellness check. Client managing diabetes. Discussed nutrition options available through our food pantry. Provided diabetic-friendly food box.",
    "Client applied for three jobs this week. Helped review resume and practice interview skills. Scheduled mock interview for Thursday.",
    "Family counseling session completed. Family dynamics improving. Father engaged for the first time. Next session in two weeks.",
    "Client needs winter clothing for family of 5. Provided coats, boots, and thermal wear from donation inventory.",
    "Elderly client lives alone. Concerns about isolation and fall risk. Connected with Meals on Wheels and senior companion program.",
    "Client successfully transitioned off emergency food assistance to SNAP benefits. Closing food assistance case. Will keep housing case open.",
    "Youth program: Client's teenager participating in mentorship program. Mentor reports good rapport. Grades improving this semester.",
    "Substance abuse screening completed per client request. Referred to outpatient treatment program. Client is motivated for recovery.",
    "Client asked about citizenship process. Referred to immigration legal services partner. Also connected with civics class.",
    "Post-hospitalization follow-up. Client recovering from surgery. Needs temporary meal delivery. Set up 4-week Meals on Wheels.",
    "Client called in crisis — facing eviction notice. Emergency meeting scheduled for tomorrow. Contacting legal aid tonight.",
]


def create_auth_users():
    """Create real Supabase auth users so profile FK constraints are satisfied."""
    staff_with_ids = []
    for s in STAFF_DEFS:
        print(f"  Creating auth user: {s['email']}")
        result = supabase.auth.admin.create_user({
            "email": s["email"],
            "password": s["password"],
            "email_confirm": True,
            "user_metadata": {
                "org_id": ORG_ID,
                "full_name": s["full_name"],
                "role": s["role"],
            },
        })
        staff_with_ids.append({
            "id": result.user.id,
            "full_name": s["full_name"],
            "email": s["email"],
            "role": s["role"],
        })
    return staff_with_ids


def build_clients(staff_ids):
    clients = []
    client_ids = []
    for c in CLIENT_DATA:
        cid = str(uuid.uuid4())
        client_ids.append(cid)
        clients.append({
            "id": cid,
            "org_id": ORG_ID,
            "first_name": c["first_name"],
            "last_name": c["last_name"],
            "date_of_birth": c["date_of_birth"],
            "phone": c["phone"],
            "language": c["language"],
            "gender": c["gender"],
            "household_size": c["household_size"],
            "status": "active",
            "extra_fields": {},
            "created_by": staff_ids[0],
        })
    return clients, client_ids


def build_service_entries(client_ids, staff_ids):
    entries = []
    today = date.today()
    for i in range(50):
        client_id = random.choice(client_ids)
        staff_id = random.choice(staff_ids)
        days_ago = random.randint(1, 180)
        service_date = today - timedelta(days=days_ago)
        note = random.choice(CASE_NOTES)
        entries.append({
            "id": str(uuid.uuid4()),
            "org_id": ORG_ID,
            "client_id": client_id,
            "staff_id": staff_id,
            "service_date": service_date.isoformat(),
            "service_type": random.choice(SERVICE_TYPES),
            "notes": note,
            "action_items": [],
            "risk_flags": [],
            "language": "en",
        })
    return entries


def build_org_config():
    return {
        "org_id": ORG_ID,
        "extra_fields_schema": [],
        "service_types": SERVICE_TYPES,
        "ai_features_enabled": {
            "voice_notes": True,
            "photo_intake": True,
            "semantic_search": True,
            "handoff_summary": True,
            "follow_up_detection": True,
            "funder_reports": True,
            "translation": True,
        },
        "ai_monthly_budget_cents": 5000,
    }


def seed():
    print("Seeding database...")

    # 1. Organization
    print(f"  Creating org: {org['name']}")
    supabase.table("organizations").insert(org).execute()

    # 2. Org config
    print("  Creating org config...")
    supabase.table("org_config").insert(build_org_config()).execute()

    # 3. Auth users + Profiles
    # The handle_new_user trigger auto-creates profiles when auth users are created.
    # But we insert profiles manually to ensure correct data, so we check if the
    # trigger already created them and skip if so.
    print(f"  Creating {len(STAFF_DEFS)} auth users (profiles auto-created by trigger)...")
    staff = create_auth_users()
    staff_ids = [s["id"] for s in staff]

    # Verify profiles were created by the trigger
    profiles = supabase.table("profiles").select("id, full_name, role").execute()
    print(f"  Profiles in DB: {len(profiles.data)}")
    for p in profiles.data:
        print(f"    - {p['full_name']} ({p['role']})")

    # 4. Clients
    clients, client_ids = build_clients(staff_ids)
    print(f"  Creating {len(clients)} clients...")
    supabase.table("clients").insert(clients).execute()

    # 5. Service entries
    entries = build_service_entries(client_ids, staff_ids)
    print(f"  Creating {len(entries)} service entries...")
    # Insert in batches of 25
    for i in range(0, len(entries), 25):
        batch = entries[i:i + 25]
        supabase.table("service_entries").insert(batch).execute()

    print("\nDone! Seeded Sunrise Services with:")
    print(f"  - 1 organization (ID: {ORG_ID})")
    print(f"  - {len(staff)} staff (auth users with profiles)")
    print(f"  - {len(clients)} clients")
    print(f"  - {len(entries)} service entries")
    print(f"\nDemo login credentials (all passwords: SeedPass123!):")
    for s in staff:
        print(f"  - {s['email']} ({s['role']})")


if __name__ == "__main__":
    seed()
