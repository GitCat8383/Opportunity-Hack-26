from uuid import UUID

from sqlalchemy import delete, select

from app.core.database import async_session
from app.models.follow_up import FollowUp
from app.models.service_entry import ServiceEntry
from app.schemas.ai import ExtractedFollowUpItem
from app.services.ai_usage import (
    AIBudgetExceededError,
    AIUsageContext,
    enforce_ai_budget,
)
from app.services.gemini_ai import extract_follow_ups_from_entry


async def extract_followups_for_entry(
    service_entry_id: UUID,
    *,
    expected_org_id: UUID | str | None = None,
    usage_context: AIUsageContext | None = None,
) -> list[ExtractedFollowUpItem]:
    async with async_session() as session:
        result = await session.execute(
            select(ServiceEntry).where(ServiceEntry.id == service_entry_id)
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            raise ValueError("Service entry not found")
        if expected_org_id is not None and str(entry.org_id) != str(expected_org_id):
            raise ValueError("Service entry not found")

        follow_ups = await extract_follow_ups_from_entry(
            service_date=entry.service_date.isoformat(),
            service_type=entry.service_type,
            notes=entry.notes,
            summary=entry.summary,
            action_items=list(entry.action_items or []),
            usage_context=usage_context,
        )

        # Only delete pending follow-ups — preserve completed/dismissed ones
        await session.execute(
            delete(FollowUp).where(
                FollowUp.service_entry_id == service_entry_id,
                FollowUp.status == "pending",
            )
        )

        for item in follow_ups:
            session.add(
                FollowUp(
                    org_id=entry.org_id,
                    client_id=entry.client_id,
                    service_entry_id=entry.id,
                    assigned_to=entry.staff_id,
                    description=item.description,
                    category=item.category,
                    urgency=item.urgency,
                    due_date=item.due_date,
                    status="pending",
                )
            )

        await session.commit()
        return follow_ups


async def extract_followups_background(
    service_entry_id: UUID,
    usage_context: AIUsageContext | None = None,
) -> None:
    try:
        if usage_context is not None:
            async with async_session() as session:
                await enforce_ai_budget(session, usage_context.org_id)
        await extract_followups_for_entry(service_entry_id, usage_context=usage_context)
    except AIBudgetExceededError:
        import logging

        logging.getLogger(__name__).info(
            "Skipping follow-up extraction for %s due to AI budget cap",
            service_entry_id,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception(
            "Failed to extract follow-ups for service entry %s",
            service_entry_id,
        )
