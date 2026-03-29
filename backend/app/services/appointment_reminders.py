from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import smtplib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.appointment import Appointment
from app.models.client import Client

settings = get_settings()


@dataclass
class ReminderRunResult:
    sent_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0


def _is_email_configured() -> bool:
    return bool(
        settings.smtp_username
        and settings.smtp_password
        and (settings.smtp_from_email or settings.smtp_username)
    )


def _build_email_message(
    *,
    recipient_email: str,
    recipient_name: str,
    scheduled_at: datetime,
    service_type: str | None,
    notes: str | None,
) -> EmailMessage:
    local_time = scheduled_at.astimezone()
    formatted_date = local_time.strftime("%A, %B %d, %Y")
    formatted_time = local_time.strftime("%I:%M %p").lstrip("0")

    message = EmailMessage()
    message["Subject"] = "Appointment Reminder"
    message["From"] = (
        f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_username}>"
    )
    message["To"] = recipient_email

    service_line = service_type or "Scheduled appointment"
    note_line = notes.strip() if notes else "No additional appointment notes were provided."

    message.set_content(
        "\n".join(
            [
                f"Hello {recipient_name},",
                "",
                "This is a reminder that you have an upcoming appointment.",
                "",
                f"Date: {formatted_date}",
                f"Time: {formatted_time}",
                f"Service: {service_line}",
                f"Notes: {note_line}",
                "",
                "If you need to reschedule or have questions, please contact your provider.",
                "",
                f"- {settings.smtp_from_name}",
            ]
        )
    )
    return message


def _send_email(message: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


async def send_appointment_reminders(
    db: AsyncSession,
    *,
    dry_run: bool = False,
) -> ReminderRunResult:
    if not _is_email_configured():
        raise RuntimeError(
            "SMTP is not configured. Set SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL."
        )

    now = datetime.now(timezone.utc)
    reminder_cutoff = now + timedelta(days=settings.appointment_reminder_window_days)

    result = await db.execute(
        select(Appointment, Client)
        .join(Client, Client.id == Appointment.client_id)
        .where(
            Appointment.status == "scheduled",
            Appointment.scheduled_at >= now,
            Appointment.scheduled_at <= reminder_cutoff,
            Client.email.is_not(None),
        )
        .order_by(Appointment.scheduled_at.asc())
    )

    run_result = ReminderRunResult()

    for appointment, client in result.all():
        if (
            appointment.reminder_sent_for_scheduled_at is not None
            and appointment.reminder_sent_for_scheduled_at == appointment.scheduled_at
        ):
            run_result.skipped_count += 1
            continue

        if not client.email:
            run_result.skipped_count += 1
            continue

        if dry_run:
            run_result.sent_count += 1
            continue

        try:
            message = _build_email_message(
                recipient_email=client.email,
                recipient_name=f"{client.first_name} {client.last_name}".strip(),
                scheduled_at=appointment.scheduled_at,
                service_type=appointment.service_type,
                notes=appointment.notes,
            )
            _send_email(message)
            appointment.reminder_sent_at = now
            appointment.reminder_sent_for_scheduled_at = appointment.scheduled_at
            appointment.reminder_error = None
            run_result.sent_count += 1
        except Exception as exc:
            appointment.reminder_error = str(exc)
            run_result.failed_count += 1

    return run_result
