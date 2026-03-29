from time import perf_counter

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.translation import Translation
from app.schemas.ai import TranslationItemResponse
from app.services.ai_usage import (
    AIUsageContext,
    enforce_ai_budget,
    elapsed_ms,
    record_generative_ai_usage,
)

settings = get_settings()
_client = genai.Client(api_key=settings.gemini_api_key)
TRANSLATE_MODEL = "gemini-3.1-flash-lite-preview"


async def translate_texts_with_cache(
    db: AsyncSession,
    *,
    texts: list[str],
    source_lang: str,
    target_lang: str,
    usage_context: AIUsageContext | None = None,
) -> list[TranslationItemResponse]:
    cleaned_texts = list(dict.fromkeys(text.strip() for text in texts if text.strip()))
    if not cleaned_texts:
        return []

    if source_lang == target_lang:
        return [
            TranslationItemResponse(
                source_text=text,
                translated_text=text,
                from_cache=True,
            )
            for text in cleaned_texts
        ]

    cached_result = await db.execute(
        select(Translation).where(
            Translation.source_lang == source_lang,
            Translation.target_lang == target_lang,
            Translation.source_text.in_(cleaned_texts),
        )
    )
    cached_rows = cached_result.scalars().all()
    cached_map = {row.source_text: row.translated_text for row in cached_rows}

    missing_texts = [text for text in cleaned_texts if text not in cached_map]

    if missing_texts:
        if usage_context is not None:
            await enforce_ai_budget(db, usage_context.org_id)

        start_time = perf_counter()
        prompt = f"""
You translate nonprofit case-management UI and notes.
Return JSON only as a list of objects with `source_text` and `translated_text`.

Rules:
- Translate from {source_lang} to {target_lang}.
- Preserve meaning and keep the translation concise.
- If text is already in the target language, return it unchanged.
- Do not add explanations.
""".strip()

        response = await _client.aio.models.generate_content(
            model=TRANSLATE_MODEL,
            contents=[
                prompt,
                "\n".join(f"- {text}" for text in missing_texts),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[TranslationItemResponse],
            ),
        )

        if isinstance(response.parsed, list):
            parsed_items = [
                TranslationItemResponse.model_validate(item) for item in response.parsed
            ]
        elif response.parsed is not None:
            parsed_items = [
                TranslationItemResponse.model_validate(item) for item in response.parsed
            ]
        else:
            import json

            parsed_items = [
                TranslationItemResponse.model_validate(item)
                for item in json.loads(response.text or "[]")
            ]

        generated_map = {
            item.source_text: item.translated_text for item in parsed_items if item.source_text
        }

        for source_text in missing_texts:
            translated_text = generated_map.get(source_text, source_text)
            db.add(
                Translation(
                    source_text=source_text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    translated_text=translated_text,
                )
            )
            cached_map[source_text] = translated_text

        await record_generative_ai_usage(
            context=usage_context,
            model=TRANSLATE_MODEL,
            response=response,
            input_payload={
                "source_lang": source_lang,
                "target_lang": target_lang,
                "texts": missing_texts,
            },
            output_payload=generated_map,
            duration_ms=elapsed_ms(start_time),
            session=db,
        )

    return [
        TranslationItemResponse(
            source_text=text,
            translated_text=cached_map.get(text, text),
            from_cache=text in {row.source_text for row in cached_rows},
        )
        for text in cleaned_texts
    ]
