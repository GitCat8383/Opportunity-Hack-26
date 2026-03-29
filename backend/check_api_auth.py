import asyncio
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).with_name(".env"))

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402

settings = get_settings()

TEST_EMAIL = "maria@sunrise-demo.org"
TEST_PASSWORD = "SeedPass123!"


async def main() -> None:
    supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
    auth_response = supabase.auth.sign_in_with_password(
        {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    access_token = auth_response.session.access_token

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        headers = {"Authorization": f"Bearer {access_token}"}

        clients_response = await client.get(
            "/api/v1/clients?per_page=1",
            headers=headers,
        )
        print("GET /clients", clients_response.status_code)
        print(clients_response.json())

        service_entries_response = await client.get(
            "/api/v1/service-entries?per_page=1",
            headers=headers,
        )
        print("GET /service-entries", service_entries_response.status_code)
        service_entries_payload = service_entries_response.json()
        print(service_entries_payload)

        search_response = await client.post(
            "/api/v1/ai/search",
            headers=headers,
            json={"query": "housing assistance", "threshold": 0.7, "limit": 3},
        )
        print("POST /ai/search", search_response.status_code)
        print(search_response.json())


if __name__ == "__main__":
    asyncio.run(main())
