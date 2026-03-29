"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type { SemanticSearchResponse } from "@/types";
import { AiStatusToast } from "./ai-status-toast";

type SemanticSearchPanelProps = {
  enabled: boolean;
};

export function SemanticSearchPanel({ enabled }: SemanticSearchPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResponse["results"]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    tone: "loading" | "success" | "error";
    message: string | null;
  }>({ tone: "loading", message: null });

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

  function showToast(
    tone: "loading" | "success" | "error",
    message: string | null,
    dismissAfterMs?: number
  ) {
    setToast({ tone, message });
    if (dismissAfterMs) {
      window.setTimeout(() => {
        setToast((current) => (current.message === message ? { ...current, message: null } : current));
      }, dismissAfterMs);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    showToast("loading", "Searching case notes with AI...");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoading(false);
        setToast({ tone: "loading", message: null });
        return;
      }

      const response = await apiFetch<SemanticSearchResponse>(
        "/ai/search",
        {
          method: "POST",
          body: JSON.stringify({
            query: trimmed,
          }),
        },
        accessToken
      );

      setResults(response.results);
      setSearched(true);
      showToast(
        "success",
        response.results.length
          ? `Found ${response.results.length} matching case notes.`
          : "Search completed. No matches found.",
        2500
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to search case notes.";
      setError(message);
      showToast("error", message, 3500);
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return null;
  }

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Semantic Search</h2>
        <p className="text-sm text-muted-foreground">
          Search across case notes using natural language, not exact keywords.
        </p>
      </div>

      <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Example: clients struggling with rent or eviction risk"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 transition"
        >
          {loading ? "Searching..." : "Search Notes"}
        </button>
      </form>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {searched && results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No similar service entries were found for that query.
          </p>
        ) : null}

        {results.map((result) => (
          <div key={result.service_entry_id} className="rounded-md border p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/clients/${result.client_id}`}
                className="font-medium hover:underline"
              >
                {result.client_name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {result.service_type} · {formatDate(result.service_date)} ·{" "}
                {(result.similarity * 100).toFixed(0)}% match
              </p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {result.content_snippet}
            </p>
          </div>
        ))}
      </div>

      <AiStatusToast message={toast.message} tone={toast.tone} />
    </section>
  );
}
