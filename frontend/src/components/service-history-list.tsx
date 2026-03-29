"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { ServiceEntry, TranslateResponse } from "@/types";

type ServiceHistoryListProps = {
  entries: ServiceEntry[];
  clientPreferredLanguage: string;
};

type TranslationState = {
  text: string;
  loading: boolean;
  visible: boolean;
  error: string | null;
  targetLanguage: "en" | "es";
};

function resolveTargetLanguage(
  entryLanguage: string,
  clientPreferredLanguage: string
): "en" | "es" {
  const normalizedEntry = entryLanguage.toLowerCase();
  const normalizedClient = clientPreferredLanguage.toLowerCase();

  if ((normalizedClient === "en" || normalizedClient === "es") && normalizedClient !== normalizedEntry) {
    return normalizedClient;
  }

  return normalizedEntry === "es" ? "en" : "es";
}

export function ServiceHistoryList({
  entries,
  clientPreferredLanguage,
}: ServiceHistoryListProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return null;
    }

    return session.access_token;
  }

  async function toggleTranslation(entry: ServiceEntry) {
    const current = translations[entry.id];
    if (current?.text) {
      setTranslations((state) => ({
        ...state,
        [entry.id]: {
          ...current,
          visible: !current.visible,
          error: null,
        },
      }));
      return;
    }

    if (!entry.notes) {
      return;
    }

    const targetLanguage = resolveTargetLanguage(
      entry.language || "en",
      clientPreferredLanguage
    );

    setTranslations((state) => ({
      ...state,
      [entry.id]: {
        text: "",
        loading: true,
        visible: false,
        error: null,
        targetLanguage,
      },
    }));

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return;
      }

      const response = await apiFetch<TranslateResponse>(
        "/ai/translate",
        {
          method: "POST",
          body: JSON.stringify({
            texts: [entry.notes],
            source_lang: entry.language || "en",
            target_lang: targetLanguage,
          }),
        },
        accessToken
      );

      const translatedText =
        response.translations[0]?.translated_text ?? entry.notes;

      setTranslations((state) => ({
        ...state,
        [entry.id]: {
          text: translatedText,
          loading: false,
          visible: true,
          error: null,
          targetLanguage,
        },
      }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to translate note.";
      setTranslations((state) => ({
        ...state,
        [entry.id]: {
          text: "",
          loading: false,
          visible: false,
          error: message,
          targetLanguage,
        },
      }));
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No services logged yet for this client.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const translation = translations[entry.id];
        const canTranslate =
          Boolean(entry.notes) &&
          (entry.language === "en" || entry.language === "es");

        return (
          <article key={entry.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{entry.service_type}</p>
                <p className="text-sm text-muted-foreground">{entry.service_date}</p>
              </div>
              <p className="text-sm text-muted-foreground">Staff ID: {entry.staff_id}</p>
            </div>

            {entry.summary ? (
              <p className="mt-3 text-sm">
                <span className="font-medium">Summary:</span> {entry.summary}
              </p>
            ) : null}

            <p className="mt-3 whitespace-pre-wrap text-sm">
              {entry.notes || "No notes recorded."}
            </p>

            {canTranslate ? (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleTranslation(entry)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent transition"
                >
                  {translation?.loading
                    ? "Translating..."
                    : translation?.visible
                      ? "Show Original"
                      : `Translate Note (${resolveTargetLanguage(
                          entry.language,
                          clientPreferredLanguage
                        ).toUpperCase()})`}
                </button>

                {translation?.error ? (
                  <p className="text-sm text-destructive">{translation.error}</p>
                ) : null}

                {translation?.visible && translation.text ? (
                  <p className="whitespace-pre-wrap text-sm italic text-muted-foreground">
                    {translation.text}
                  </p>
                ) : null}
              </div>
            ) : null}

            {entry.action_items.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Action items: {entry.action_items.join(", ")}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
