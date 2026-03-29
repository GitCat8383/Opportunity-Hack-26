from google import genai
from google.genai import types
import hashlib
import json
from time import perf_counter

from app.core.config import get_settings
from app.schemas.ai import (
    ExtractedFollowUpItem,
    FunderReportResponse,
    PhotoIntakeResponse,
    SummarizeClientResponse,
    StructureNoteResponse,
    TranscriptionResponse,
)
from app.schemas.client_summary import ClientSummaryStructured
from app.schemas.org_config import CustomFieldDefinition
from app.services.ai_usage import (
    AIUsageContext,
    elapsed_ms,
    record_generative_ai_usage,
)

settings = get_settings()

PHOTO_INTAKE_MODEL = "gemini-2.5-pro"
VOICE_MODEL = "gemini-2.5-flash"
SUMMARY_MODEL = "gemini-2.5-pro"
REPORT_MODEL = "gemini-2.5-pro"

_client = genai.Client(api_key=settings.gemini_api_key)


def _build_custom_fields_prompt(
    extra_fields_schema: list[CustomFieldDefinition],
) -> str:
    if not extra_fields_schema:
        return "No custom fields are configured for this organization."

    lines = []
    for field in extra_fields_schema:
        descriptor = f"- key={field.key}; label={field.label}; type={field.field_type}"
        if field.options:
            descriptor += f"; allowed_options={', '.join(field.options)}"
        lines.append(descriptor)
    return "\n".join(lines)


async def extract_photo_intake(
    *,
    image_bytes: bytes,
    mime_type: str,
    extra_fields_schema: list[CustomFieldDefinition],
    usage_context: AIUsageContext | None = None,
) -> PhotoIntakeResponse:
    prompt = f"""
You extract client intake data from nonprofit intake forms.
Return JSON only. If a field is not visible or not legible, return null.
Do not guess. Normalize dates to YYYY-MM-DD when possible.

Extract these standard fields:
- first_name
- last_name
- date_of_birth
- phone
- email
- address
- language
- gender
- household_size
- status

Also extract organization-specific custom fields into the `extra_fields` object.
Only include keys that are explicitly configured below.
Configured custom fields:
{_build_custom_fields_prompt(extra_fields_schema)}
""".strip()

    start_time = perf_counter()
    response = await _client.aio.models.generate_content(
        model=PHOTO_INTAKE_MODEL,
        contents=[
            prompt,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PhotoIntakeResponse,
        ),
    )

    if isinstance(response.parsed, PhotoIntakeResponse):
        parsed = response.parsed
    elif response.parsed is not None:
        parsed = PhotoIntakeResponse.model_validate(response.parsed)
    else:
        parsed = PhotoIntakeResponse.model_validate_json(response.text)

    await record_generative_ai_usage(
        context=usage_context,
        model=PHOTO_INTAKE_MODEL,
        response=response,
        input_payload={
            "mime_type": mime_type,
            "image_digest": hashlib.sha256(image_bytes).hexdigest(),
            "extra_fields_schema": _build_custom_fields_prompt(extra_fields_schema),
        },
        output_payload=parsed.model_dump(mode="json"),
        duration_ms=elapsed_ms(start_time),
    )
    return parsed


async def transcribe_audio_bytes(
    *,
    audio_bytes: bytes,
    mime_type: str,
    usage_context: AIUsageContext | None = None,
) -> TranscriptionResponse:
    start_time = perf_counter()
    response = await _client.aio.models.generate_content(
        model=VOICE_MODEL,
        contents=[
            (
                "Transcribe this nonprofit case-management voice note as accurately "
                "as possible. Return JSON with a single `transcript` field."
            ),
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TranscriptionResponse,
        ),
    )

    if isinstance(response.parsed, TranscriptionResponse):
        parsed = response.parsed
    elif response.parsed is not None:
        parsed = TranscriptionResponse.model_validate(response.parsed)
    else:
        parsed = TranscriptionResponse.model_validate_json(response.text)

    await record_generative_ai_usage(
        context=usage_context,
        model=VOICE_MODEL,
        response=response,
        input_payload={
            "mime_type": mime_type,
            "audio_digest": hashlib.sha256(audio_bytes).hexdigest(),
        },
        output_payload=parsed.model_dump(mode="json"),
        duration_ms=elapsed_ms(start_time),
    )
    return parsed


async def structure_transcript_note(
    *,
    transcript: str,
    service_types: list[str],
    usage_context: AIUsageContext | None = None,
) -> StructureNoteResponse:
    service_type_list = ", ".join(service_types) if service_types else "General"
    prompt = f"""
You convert nonprofit service transcripts into a structured case-note summary.
Return JSON only.

Rules:
- service_type must be one of: {service_type_list}
- summary should be concise and useful for handoff
- action_items should be a short list of concrete follow-up tasks
- follow_up_date should only be set if the transcript clearly implies one
- risk_flag should be true only when the transcript indicates elevated client risk, urgency, or safety concerns

Transcript:
{transcript}
""".strip()

    start_time = perf_counter()
    response = await _client.aio.models.generate_content(
        model=VOICE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=StructureNoteResponse,
        ),
    )

    if isinstance(response.parsed, StructureNoteResponse):
        parsed = response.parsed
    elif response.parsed is not None:
        parsed = StructureNoteResponse.model_validate(response.parsed)
    else:
        parsed = StructureNoteResponse.model_validate_json(response.text)

    if parsed.service_type and service_types and parsed.service_type not in service_types:
        parsed.service_type = None

    await record_generative_ai_usage(
        context=usage_context,
        model=VOICE_MODEL,
        response=response,
        input_payload={"transcript": transcript, "service_types": service_types},
        output_payload=parsed.model_dump(mode="json"),
        duration_ms=elapsed_ms(start_time),
    )
    return parsed


async def summarize_client_history(
    *,
    client_name: str,
    demographics: dict[str, str | int | None],
    service_history: list[dict[str, str | list[str] | None]],
    usage_context: AIUsageContext | None = None,
) -> SummarizeClientResponse:
    history_lines: list[str] = []
    for entry in service_history:
        history_lines.append(
            "\n".join(
                [
                    f"Service date: {entry['service_date']}",
                    f"Service type: {entry['service_type']}",
                    f"Summary: {entry['summary'] or 'None'}",
                    f"Notes: {entry['notes'] or 'None'}",
                    f"Action items: {', '.join(entry['action_items']) if entry['action_items'] else 'None'}",
                    f"Risk flags: {', '.join(entry['risk_flags']) if entry['risk_flags'] else 'None'}",
                ]
            )
        )

    prompt = f"""
You are generating a nonprofit case handoff summary for internal staff use.
Return JSON only.

Client name: {client_name}
Demographics: {demographics}

Service history:
{chr(10).join(history_lines) if history_lines else 'No service history available.'}

Requirements:
- summary_text should be a concise but useful handoff narrative
- summary_structured.background should cover stable context
- summary_structured.services_history should mention key service history bullets
- summary_structured.current_status should summarize where the case stands now
- summary_structured.active_needs should list active unmet needs
- summary_structured.risk_factors should list notable risks or concerns
- summary_structured.next_steps should list concrete next actions
""".strip()

    start_time = perf_counter()
    response = await _client.aio.models.generate_content(
        model=SUMMARY_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SummarizeClientResponse,
        ),
    )

    if isinstance(response.parsed, SummarizeClientResponse):
        parsed = response.parsed
    elif response.parsed is not None:
        parsed = SummarizeClientResponse.model_validate(response.parsed)
    else:
        parsed = SummarizeClientResponse.model_validate_json(response.text)

    await record_generative_ai_usage(
        context=usage_context,
        model=SUMMARY_MODEL,
        response=response,
        input_payload={
            "client_name": client_name,
            "demographics": demographics,
            "service_history": service_history,
        },
        output_payload=parsed.model_dump(mode="json"),
        duration_ms=elapsed_ms(start_time),
    )
    return parsed


async def extract_follow_ups_from_entry(
    *,
    service_date: str,
    service_type: str,
    notes: str | None,
    summary: str | None,
    action_items: list[str],
    usage_context: AIUsageContext | None = None,
) -> list[ExtractedFollowUpItem]:
    prompt = f"""
You extract actionable follow-ups from nonprofit case notes.
Return JSON only as a list.

Service date: {service_date}
Service type: {service_type}
Summary: {summary or 'None'}
Notes: {notes or 'None'}
Action items: {', '.join(action_items) if action_items else 'None'}

Rules:
- Only return follow-ups that require future action.
- description must be concrete and concise.
- category should be a short kebab-case label when clear.
- urgency must be one of: low, medium, high, critical.
- due_date should be YYYY-MM-DD only when clearly implied.
- Return an empty list if there are no follow-ups.
""".strip()

    start_time = perf_counter()
    response = await _client.aio.models.generate_content(
        model=VOICE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=list[ExtractedFollowUpItem],
        ),
    )

    if isinstance(response.parsed, list):
        parsed = [ExtractedFollowUpItem.model_validate(item) for item in response.parsed]
    elif response.parsed is not None:
        parsed = [ExtractedFollowUpItem.model_validate(item) for item in response.parsed]
    else:
        parsed_text = json.loads(response.text or "[]")
        parsed = [ExtractedFollowUpItem.model_validate(item) for item in parsed_text]

    await record_generative_ai_usage(
        context=usage_context,
        model=VOICE_MODEL,
        response=response,
        input_payload={
            "service_date": service_date,
            "service_type": service_type,
            "notes": notes,
            "summary": summary,
            "action_items": action_items,
        },
        output_payload=[item.model_dump(mode="json") for item in parsed],
        duration_ms=elapsed_ms(start_time),
    )
    return parsed


async def generate_funder_report_narrative(
    *,
    org_name: str,
    period_label: str,
    metrics: dict,
    raw_csv: str,
    usage_context: AIUsageContext | None = None,
) -> FunderReportResponse:
    prompt = f"""
You are writing a nonprofit funder report for external stakeholders.
Return JSON only.

Organization: {org_name}
Reporting period: {period_label}

Structured metrics:
{json.dumps(metrics, indent=2)}

Raw CSV export:
{raw_csv}

Requirements:
- title should be polished and board-ready.
- executive_summary should be 1 concise paragraph.
- narrative should read like a polished funder update with short sections and clear outcomes.
- key_outcomes should be 3 to 6 concrete bullet points grounded in the metrics.
- data_quality_notes should mention any obvious limitations without sounding alarmist.
- Do not invent beneficiaries, percentages, or outcomes that are not supported by the provided data.
""".strip()

    start_time = perf_counter()
    response = await _client.aio.models.generate_content(
        model=REPORT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=FunderReportResponse,
        ),
    )

    if isinstance(response.parsed, FunderReportResponse):
        parsed = response.parsed
    elif response.parsed is not None:
        parsed = FunderReportResponse.model_validate(response.parsed)
    else:
        parsed = FunderReportResponse.model_validate_json(response.text)

    await record_generative_ai_usage(
        context=usage_context,
        model=REPORT_MODEL,
        response=response,
        input_payload={
            "org_name": org_name,
            "period_label": period_label,
            "metrics": metrics,
            "raw_csv": raw_csv,
        },
        output_payload=parsed.model_dump(mode="json"),
        duration_ms=elapsed_ms(start_time),
    )
    return parsed
