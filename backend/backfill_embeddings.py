import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

from app.services.semantic_search import backfill_missing_embeddings  # noqa: E402


async def main() -> None:
    limit_value = os.getenv("EMBED_BACKFILL_LIMIT")
    limit = int(limit_value) if limit_value else None
    embedded_count = await backfill_missing_embeddings(limit=limit)
    print(f"Embedded {embedded_count} service entries.")


if __name__ == "__main__":
    asyncio.run(main())
