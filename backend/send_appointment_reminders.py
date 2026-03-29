import asyncio

from app.core.database import async_session
from app.services.appointment_reminders import send_appointment_reminders


async def main() -> None:
    async with async_session() as db:
        try:
            result = await send_appointment_reminders(db)
            await db.commit()
            print(
                f"Appointment reminders complete: sent={result.sent_count}, "
                f"skipped={result.skipped_count}, failed={result.failed_count}"
            )
        except Exception:
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
