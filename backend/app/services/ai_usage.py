import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from time import perf_counter
from typing import Any
from uuid import UUID

from google import genai
from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import async_session
from app.models.ai_usage_log import AIUsageLog
from app.models.org_config import OrgConfig

settings = get_settings()
logger = logging.getLogger(__name__)
_client = genai.Client(api_key=settings.gemini_api_key)


class AIBudgetExceededError(Exception):
    pass


@dataclass
class AIUsageContext:
    org_id: str
    user_id: str
    feature: str


MODEL_PRICING_USD_PER_MILLION: dict[str, dict[str, Decimal]] = {
    "gemini-3.1-flash-lite-preview": {
        "TEXT": Decimal("0.25"),
        "IMAGE": Decimal("0.25"),
        "VIDEO": Decimal("0.25"),
        "OUTPUT_TEXT": Decimal("1.50"),
        "AUDIO": Decimal("0.50"),
    },
    "gemini-2.5-pro": {
        "TEXT": Decimal("1.25"),
        "IMAGE": Decimal("1.25"),
        "VIDEO": Decimal("1.25"),
        "DOCUMENT": Decimal("1.25"),
        "OUTPUT_TEXT": Decimal("10.00"),
    },
    "gemini-2.5-flash": {
        "TEXT": Decimal("0.30"),
        "IMAGE": Decimal("0.30"),
        "VIDEO": Decimal("0.30"),
        "DOCUMENT": Decimal("0.30"),
        "AUDIO": Decimal("1.00"),
        "OUTPUT_TEXT": Decimal("2.50"),
    },
    "gemini-embedding-001": {
        "TEXT": Decimal("0.15"),
        "OUTPUT_TEXT": Decimal("0.00"),
    },
}


DEFAULT_INPUT_MODALITY_BY_FEATURE = {
    "photo_intake": "IMAGE",
    "transcribe": "AUDIO",
    "embed": "TEXT",
    "search": "TEXT",
    "structure_note": "TEXT",
    "summarize_client": "TEXT",
    "extract_followups": "TEXT",
    "funder_report": "TEXT",
    "translate": "TEXT",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def elapsed_ms(start_time: float) -> int:
    return int((perf_counter() - start_time) * 1000)


def _hash_payload(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        payload = value
    elif isinstance(value, str):
        payload = value.encode("utf-8")
    else:
        payload = json.dumps(value, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _normalize_modality(value: Any) -> str:
    if value is None:
        return "TEXT"
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _calculate_input_cost_cents(
    *,
    model: str,
    feature: str,
    prompt_token_count: int,
    prompt_tokens_details: list[Any] | None,
) -> Decimal:
    pricing = MODEL_PRICING_USD_PER_MILLION.get(model)
    if not pricing or prompt_token_count <= 0:
        return Decimal("0")

    if prompt_tokens_details:
        total = Decimal("0")
        covered_tokens = 0
        for detail in prompt_tokens_details:
            token_count = int(getattr(detail, "token_count", 0) or 0)
            if token_count <= 0:
                continue
            modality = _normalize_modality(getattr(detail, "modality", None))
            per_million = pricing.get(modality, pricing.get("TEXT", Decimal("0")))
            total += (Decimal(token_count) / Decimal(1_000_000)) * per_million
            covered_tokens += token_count

        if covered_tokens < prompt_token_count:
            fallback_rate = pricing.get(
                DEFAULT_INPUT_MODALITY_BY_FEATURE.get(feature, "TEXT"),
                pricing.get("TEXT", Decimal("0")),
            )
            uncovered_tokens = prompt_token_count - covered_tokens
            total += (Decimal(uncovered_tokens) / Decimal(1_000_000)) * fallback_rate
        return total * Decimal("100")

    fallback_rate = pricing.get(
        DEFAULT_INPUT_MODALITY_BY_FEATURE.get(feature, "TEXT"),
        pricing.get("TEXT", Decimal("0")),
    )
    return (Decimal(prompt_token_count) / Decimal(1_000_000)) * fallback_rate * Decimal(
        "100"
    )


def _calculate_output_cost_cents(
    *,
    model: str,
    response_token_count: int,
) -> Decimal:
    pricing = MODEL_PRICING_USD_PER_MILLION.get(model)
    if not pricing or response_token_count <= 0:
        return Decimal("0")
    rate = pricing.get("OUTPUT_TEXT", Decimal("0"))
    return (Decimal(response_token_count) / Decimal(1_000_000)) * rate * Decimal("100")


async def get_or_create_org_budget_cents(db: AsyncSession, org_id: str) -> int:
    result = await db.execute(select(OrgConfig).where(OrgConfig.org_id == org_id))
    org_config = result.scalar_one_or_none()
    if org_config is None:
        return 5000
    return int(org_config.ai_monthly_budget_cents)


def _month_start() -> datetime:
    now = utc_now()
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


async def get_monthly_ai_spend_cents(db: AsyncSession, org_id: str) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(AIUsageLog.cost_cents), 0)).where(
            AIUsageLog.org_id == org_id,
            AIUsageLog.created_at >= _month_start(),
        )
    )
    return Decimal(result.scalar() or 0)


async def enforce_ai_budget(db: AsyncSession, org_id: str) -> None:
    budget_cents = await get_or_create_org_budget_cents(db, org_id)
    spent_cents = await get_monthly_ai_spend_cents(db, org_id)

    if budget_cents <= 0:
        raise AIBudgetExceededError("AI features are disabled for this organization.")
    if spent_cents >= Decimal(budget_cents):
        raise AIBudgetExceededError(
            "This organization has reached its monthly AI budget. Contact an admin."
        )


async def _insert_usage_log(
    *,
    session: AsyncSession,
    context: AIUsageContext,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_cents: Decimal,
    input_hash: str | None,
    output_hash: str | None,
    duration_ms: int | None,
) -> None:
    session.add(
        AIUsageLog(
            org_id=UUID(context.org_id),
            user_id=UUID(context.user_id),
            feature=context.feature,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_cents=cost_cents,
            input_hash=input_hash,
            output_hash=output_hash,
            duration_ms=duration_ms,
        )
    )


async def record_generative_ai_usage(
    *,
    context: AIUsageContext | None,
    model: str,
    response: types.GenerateContentResponse,
    input_payload: Any,
    output_payload: Any,
    duration_ms: int | None,
    session: AsyncSession | None = None,
) -> None:
    if context is None:
        return

    usage = getattr(response, "usage_metadata", None)
    prompt_token_count = int(getattr(usage, "prompt_token_count", 0) or 0)
    response_token_count = int(getattr(usage, "response_token_count", 0) or 0)
    prompt_tokens_details = list(getattr(usage, "prompt_tokens_details", None) or [])

    cost_cents = _calculate_input_cost_cents(
        model=model,
        feature=context.feature,
        prompt_token_count=prompt_token_count,
        prompt_tokens_details=prompt_tokens_details,
    ) + _calculate_output_cost_cents(
        model=model,
        response_token_count=response_token_count,
    )

    try:
        if session is not None:
            await _insert_usage_log(
                session=session,
                context=context,
                model=model,
                input_tokens=prompt_token_count,
                output_tokens=response_token_count,
                cost_cents=cost_cents,
                input_hash=_hash_payload(input_payload),
                output_hash=_hash_payload(output_payload),
                duration_ms=duration_ms,
            )
            return

        async with async_session() as temp_session:
            await _insert_usage_log(
                session=temp_session,
                context=context,
                model=model,
                input_tokens=prompt_token_count,
                output_tokens=response_token_count,
                cost_cents=cost_cents,
                input_hash=_hash_payload(input_payload),
                output_hash=_hash_payload(output_payload),
                duration_ms=duration_ms,
            )
            await temp_session.commit()
    except Exception:
        logger.exception("Failed to log AI usage for feature %s", context.feature)


async def record_embedding_usage(
    *,
    context: AIUsageContext | None,
    model: str,
    text_input: str,
    output_payload: Any,
    duration_ms: int | None,
    session: AsyncSession | None = None,
) -> None:
    if context is None:
        return

    try:
        token_response = await _client.aio.models.count_tokens(
            model=model,
            contents=text_input,
        )
        prompt_token_count = int(token_response.total_tokens or 0)
    except Exception:
        logger.exception("Failed to count embedding tokens for feature %s", context.feature)
        prompt_token_count = max(1, len(text_input) // 4)

    cost_cents = _calculate_input_cost_cents(
        model=model,
        feature=context.feature,
        prompt_token_count=prompt_token_count,
        prompt_tokens_details=None,
    )

    try:
        if session is not None:
            await _insert_usage_log(
                session=session,
                context=context,
                model=model,
                input_tokens=prompt_token_count,
                output_tokens=0,
                cost_cents=cost_cents,
                input_hash=_hash_payload(text_input),
                output_hash=_hash_payload(output_payload),
                duration_ms=duration_ms,
            )
            return

        async with async_session() as temp_session:
            await _insert_usage_log(
                session=temp_session,
                context=context,
                model=model,
                input_tokens=prompt_token_count,
                output_tokens=0,
                cost_cents=cost_cents,
                input_hash=_hash_payload(text_input),
                output_hash=_hash_payload(output_payload),
                duration_ms=duration_ms,
            )
            await temp_session.commit()
    except Exception:
        logger.exception("Failed to log embedding usage for feature %s", context.feature)
