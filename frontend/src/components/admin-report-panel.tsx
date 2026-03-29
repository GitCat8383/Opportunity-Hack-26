"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { FunderReportStreamMeta } from "@/types";
import { AiStatusToast } from "./ai-status-toast";

function getQuarterRange(reference = new Date()) {
  const year = reference.getFullYear();
  const quarterStartMonth = Math.floor(reference.getMonth() / 3) * 3;
  const start = new Date(Date.UTC(year, quarterStartMonth, 1));
  const end = new Date(Date.UTC(year, quarterStartMonth + 3, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function getPreviousQuarterRange(reference = new Date()) {
  const currentQuarter = getQuarterRange(reference);
  const previousQuarterEnd = new Date(`${currentQuarter.start}T00:00:00Z`);
  previousQuarterEnd.setUTCDate(0);
  return getQuarterRange(previousQuarterEnd);
}

type ToastState = {
  tone: "loading" | "success" | "error";
  message: string | null;
};

export function AdminReportPanel() {
  const router = useRouter();
  const supabase = createClient();
  const [dateRange, setDateRange] = useState(getQuarterRange);
  const [meta, setMeta] = useState<FunderReportStreamMeta | null>(null);
  const [reportText, setReportText] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    tone: "loading",
    message: null,
  });

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
    tone: ToastState["tone"],
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

  async function handleGenerateReport() {
    setLoading(true);
    setError(null);
    setMeta(null);
    setReportText("");
    showToast("loading", "Generating polished funder report...");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoading(false);
        setToast({ tone: "loading", message: null });
        return;
      }

      const response = await fetch(`${API_BASE}/ai/funder-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          start_date: dateRange.start,
          end_date: dateRange.end,
        }),
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: response.statusText }));
        throw new ApiError(
          payload.detail || "Unable to generate funder report.",
          response.status
        );
      }

      if (!response.body) {
        throw new Error("Streaming response body is missing.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          const lines = eventBlock.split("\n");
          let eventName = "message";
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (!dataLines.length) {
            continue;
          }

          const payload = JSON.parse(dataLines.join("\n"));

          if (eventName === "meta") {
            setMeta(payload as FunderReportStreamMeta);
          } else if (eventName === "chunk") {
            setReportText((current) => current + (payload.text as string));
          } else if (eventName === "done") {
            setReportText(payload.report_text as string);
            showToast("success", "Funder report is ready.", 2500);
          } else if (eventName === "error") {
            throw new Error(payload.detail as string);
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to generate funder report.";
      setError(message);
      showToast("error", message, 3500);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportDocx() {
    if (!meta || !reportText.trim()) {
      return;
    }

    setExporting(true);
    setError(null);
    showToast("loading", "Exporting DOCX report...");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setExporting(false);
        setToast({ tone: "loading", message: null });
        return;
      }

      const response = await fetch(`${API_BASE}/ai/funder-report/docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: meta.title,
          org_name: meta.org_name,
          start_date: meta.start_date,
          end_date: meta.end_date,
          report_text: reportText,
          raw_csv: meta.raw_csv,
        }),
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: response.statusText }));
        throw new ApiError(payload.detail || "Unable to export DOCX.", response.status);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${meta.title.replace(/[^A-Za-z0-9._-]+/g, "-")}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast("success", "DOCX export downloaded.", 2500);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to export DOCX.";
      setError(message);
      showToast("error", message, 3500);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Funder Reports
          </h2>
          <p className="text-sm text-slate-600">
            Generate a quarter-based report from live case data, stream the narrative,
            and export it to DOCX.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDateRange(getQuarterRange())}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Current Quarter
          </button>
          <button
            type="button"
            onClick={() => setDateRange(getPreviousQuarterRange())}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Previous Quarter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Start date</span>
          <input
            type="date"
            value={dateRange.start}
            onChange={(event) =>
              setDateRange((current) => ({ ...current, start: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">End date</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(event) =>
              setDateRange((current) => ({ ...current, end: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          onClick={handleGenerateReport}
          disabled={loading || exporting}
          className="self-end rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Report"}
        </button>
        <button
          type="button"
          onClick={handleExportDocx}
          disabled={loading || exporting || !reportText.trim() || !meta}
          className="self-end rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export DOCX"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {meta ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{meta.title}</p>
          <p>
            Reporting period: {meta.start_date} to {meta.end_date}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <h3 className="font-medium text-slate-900">Before: Raw CSV Dump</h3>
            <p className="text-sm text-slate-600">
              This is the raw structured export used as the report input.
            </p>
          </div>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs text-slate-700">
            {meta?.raw_csv ?? "Generate a report to inspect the raw data export."}
          </pre>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <h3 className="font-medium text-slate-900">
              After: Polished Narrative Report
            </h3>
            <p className="text-sm text-slate-600">
              The report streams in as Gemini turns the aggregated data into a funder-ready narrative.
            </p>
          </div>
          <div className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm leading-6 text-slate-700">
            {reportText || "Generate a report to stream the narrative here."}
          </div>
        </div>
      </div>

      <AiStatusToast message={toast.message} tone={toast.tone} />
    </section>
  );
}
