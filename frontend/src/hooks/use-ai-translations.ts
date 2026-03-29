"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { TranslateResponse } from "@/types";

type SupportedLanguage = "en" | "es";

type UseAiTranslationsOptions = {
  texts: string[];
  targetLanguage: SupportedLanguage;
  sourceLanguage?: SupportedLanguage;
  enabled?: boolean;
};

export function useAiTranslations({
  texts,
  targetLanguage,
  sourceLanguage = "en",
  enabled = true,
}: UseAiTranslationsOptions) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const normalizedTexts = useMemo(
    () => Array.from(new Set(texts.map((text) => text.trim()).filter(Boolean))),
    [texts]
  );
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!enabled || targetLanguage === sourceLanguage || normalizedTexts.length === 0) {
        setTranslations({});
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const response = await apiFetch<TranslateResponse>(
          "/ai/translate",
          {
            method: "POST",
            body: JSON.stringify({
              texts: normalizedTexts,
              source_lang: sourceLanguage,
              target_lang: targetLanguage,
            }),
          },
          session.access_token
        );

        if (cancelled) {
          return;
        }

        setTranslations(
          Object.fromEntries(
            response.translations.map((item) => [item.source_text, item.translated_text])
          )
        );
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Unable to load translations.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, normalizedTexts, router, sourceLanguage, supabase, targetLanguage]);

  function t(sourceText: string) {
    if (!enabled || targetLanguage === sourceLanguage) {
      return sourceText;
    }
    return translations[sourceText] ?? sourceText;
  }

  return {
    t,
    loading,
    error,
  };
}
