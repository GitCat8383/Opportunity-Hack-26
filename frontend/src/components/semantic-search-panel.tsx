"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

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
    <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
          <Sparkles size={14} />
          AI Search
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Semantic Search
        </h2>
        <p className="text-sm text-slate-600">
          Search across case notes using natural language, not exact keywords.
        </p>
      </div>

      <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSubmit}>
        <label className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: clients struggling with rent or eviction risk"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search Notes"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {searched && results.length === 0 ? (
          <p className="text-sm text-slate-600">
            No similar service entries were found for that query.
          </p>
        ) : null}

        {results.map((result) => (
          <div
            key={result.service_entry_id}
            className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/clients/${result.client_id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {result.client_name}
              </Link>
              <p className="text-xs text-slate-500">
                {result.service_type} · {formatDate(result.service_date)} ·{" "}
                {(result.similarity * 100).toFixed(0)}% match
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {result.content_snippet}
            </p>
          </div>
        ))}
      </div>

      <AiStatusToast message={toast.message} tone={toast.tone} />
    </section>
  );
}
