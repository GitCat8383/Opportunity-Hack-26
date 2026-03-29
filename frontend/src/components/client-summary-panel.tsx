"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientSummary,
  ClientSummaryDraft,
  ClientSummaryStructured,
  UserProfile,
} from "@/types";
import { AiStatusToast } from "./ai-status-toast";

type ClientSummaryPanelProps = {
  clientId: string;
  latestSummary: ClientSummary | null;
  role: UserProfile["role"];
};

function createEmptyStructured(): ClientSummaryStructured {
  return {
    background: null,
    services_history: [],
    current_status: null,
    active_needs: [],
    risk_factors: [],
    next_steps: [],
  };
}

function createDraftFromSummary(summary: ClientSummary | null): ClientSummaryDraft {
  return {
    summary_text: summary?.summary_text ?? "",
    summary_structured: summary?.summary_structured ?? createEmptyStructured(),
  };
}

function structuredFieldLabel(key: keyof ClientSummaryStructured) {
  switch (key) {
    case "services_history":
      return "Service History";
    case "current_status":
      return "Current Status";
    case "active_needs":
      return "Active Needs";
    case "risk_factors":
      return "Risk Factors";
    case "next_steps":
      return "Next Steps";
    default:
      return "Background";
  }
}

export function ClientSummaryPanel({
  clientId,
  latestSummary,
  role,
}: ClientSummaryPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState<ClientSummaryDraft>(
    createDraftFromSummary(latestSummary)
  );
  const [currentSavedSummary, setCurrentSavedSummary] = useState(latestSummary);
  const [loadingState, setLoadingState] = useState<"idle" | "generating" | "saving">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    tone: "loading" | "success" | "error";
    message: string | null;
  }>({ tone: "loading", message: null });

  const canUseAi = role === "staff" || role === "admin";

  const hasDraftContent = useMemo(() => {
    if (draft.summary_text.trim()) {
      return true;
    }

    return Object.values(draft.summary_structured).some((value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value)
    );
  }, [draft]);

  function showToast(
    tone: "loading" | "success" | "error",
    message: string | null,
    dismissAfterMs?: number
  ) {
    setToast({ tone, message });
    if (dismissAfterMs) {
      window.setTimeout(() => {
        setToast((current) =>
          current.message === message ? { ...current, message: null } : current
        );
      }, dismissAfterMs);
    }
  }

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

  async function generateSummary() {
    setLoadingState("generating");
    setError(null);
    setCopyMessage(null);
    showToast("loading", "Generating handoff summary...");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoadingState("idle");
        return;
      }

      const generated = await apiFetch<ClientSummaryDraft>(
        "/ai/summarize-client",
        {
          method: "POST",
          body: JSON.stringify({ client_id: clientId }),
        },
        accessToken
      );

      setDraft(generated);
      showToast("success", "Summary draft generated.", 2500);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to generate summary.";
      setError(message);
      showToast("error", message, 3500);
    } finally {
      setLoadingState("idle");
    }
  }

  async function saveDraft() {
    setLoadingState("saving");
    setError(null);
    showToast("loading", "Saving summary draft...");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoadingState("idle");
        return;
      }

      const saved = await apiFetch<ClientSummary>(
        `/clients/${clientId}/summary`,
        {
          method: "POST",
          body: JSON.stringify(draft),
        },
        accessToken
      );

      setCurrentSavedSummary(saved);
      setDraft(createDraftFromSummary(saved));
      router.refresh();
      showToast("success", "Summary draft saved.", 2500);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to save summary.";
      setError(message);
      showToast("error", message, 3500);
    } finally {
      setLoadingState("idle");
    }
  }

  async function copySummary() {
    if (!draft.summary_text.trim()) {
      return;
    }

    await navigator.clipboard.writeText(draft.summary_text);
    setCopyMessage("Copied");
    window.setTimeout(() => setCopyMessage(null), 1500);
  }

  function updateStructuredList(
    key: "services_history" | "active_needs" | "risk_factors" | "next_steps",
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      summary_structured: {
        ...current.summary_structured,
        [key]: value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    }));
  }

  function updateStructuredValue(
    key: "background" | "current_status",
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      summary_structured: {
        ...current.summary_structured,
        [key]: value || null,
      },
    }));
  }

  if (!canUseAi) {
    return null;
  }

  return (
    <section className="rounded-lg border bg-card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Handoff Summary</h2>
          <p className="text-sm text-muted-foreground">
            Generate a draft, edit it, then save only when it looks right.
          </p>
          {currentSavedSummary ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Last saved {formatDateTime(currentSavedSummary.created_at)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateSummary}
            disabled={loadingState !== "idle"}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition"
          >
            {loadingState === "generating"
              ? "Generating..."
              : currentSavedSummary
                ? "Regenerate"
                : "Generate Summary"}
          </button>
          <button
            type="button"
            onClick={copySummary}
            disabled={!draft.summary_text.trim()}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition"
          >
            {copyMessage ?? "Copy"}
          </button>
          <button
            type="button"
            onClick={saveDraft}
            disabled={loadingState !== "idle" || !hasDraftContent}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {loadingState === "saving" ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!hasDraftContent ? (
        <p className="text-sm text-muted-foreground">
          No saved summary yet. Generate one to create an editable draft.
        </p>
      ) : (
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Narrative Summary</span>
            <textarea
              rows={6}
              value={draft.summary_text}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  summary_text: event.target.value,
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Background</span>
              <textarea
                rows={4}
                value={draft.summary_structured.background ?? ""}
                onChange={(event) =>
                  updateStructuredValue("background", event.target.value)
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Current Status</span>
              <textarea
                rows={4}
                value={draft.summary_structured.current_status ?? ""}
                onChange={(event) =>
                  updateStructuredValue("current_status", event.target.value)
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>

            {(
              [
                "services_history",
                "active_needs",
                "risk_factors",
                "next_steps",
              ] as const
            ).map((key) => (
              <label key={key} className="space-y-1">
                <span className="text-sm font-medium">
                  {structuredFieldLabel(key)}
                </span>
                <textarea
                  rows={4}
                  value={draft.summary_structured[key].join("\n")}
                  onChange={(event) => updateStructuredList(key, event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <AiStatusToast message={toast.message} tone={toast.tone} />
    </section>
  );
}
