from google import genai
from google.genai import types

from app.core.config import get_settings
from app.schemas.ai import (
    PhotoIntakeResponse,
    StructureNoteResponse,
    TranscriptionResponse,
)
from app.schemas.org_config import CustomFieldDefinition

settings = get_settings()

PHOTO_INTAKE_MODEL = "gemini-2.5-pro"
VOICE_MODEL = "gemini-2.5-flash"

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
        return response.parsed
    if response.parsed is not None:
        return PhotoIntakeResponse.model_validate(response.parsed)
    return PhotoIntakeResponse.model_validate_json(response.text)


async def transcribe_audio_bytes(
    *,
    audio_bytes: bytes,
    mime_type: str,
) -> TranscriptionResponse:
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
        return response.parsed
    if response.parsed is not None:
        return TranscriptionResponse.model_validate(response.parsed)
    return TranscriptionResponse.model_validate_json(response.text)


async def structure_transcript_note(
    *,
    transcript: str,
    service_types: list[str],
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
    return parsed
