"use client";

import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Settings2, Upload } from "lucide-react";

import { API_BASE, ApiError, apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { ClientImportResponse } from "@/types";

function parseFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return "clients-export.csv";
  }

  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "clients-export.csv";
}

export function ClientsAdminActions() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ClientImportResponse | null>(
    null
  );

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

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return;
      }

      const response = await fetch(`${API_BASE}/clients/export`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: response.statusText }));
        throw new ApiError(
          payload.detail || "Unable to export clients.",
          response.status
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = parseFilename(
        response.headers.get("content-disposition")
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to export clients."
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const result = await apiFetch<ClientImportResponse>(
        "/clients/import",
        {
          method: "POST",
          body: formData,
        },
        accessToken
      );

      setImportResult(result);
      router.refresh();
    } catch (err) {
      setImportResult(null);
      setError(
        err instanceof ApiError ? err.message : "Unable to import clients."
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Admin Data Controls
          </h2>
          <p className="text-sm text-slate-600">
            Import, export, and tune the client schema for your organization.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImport}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Upload size={16} />
          {isImporting ? "Importing..." : "Import CSV"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={16} />
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
        <Link
          href="/clients/config"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Settings2 size={16} />
          Manage Custom Fields
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        CSV import accepts core client columns plus any configured custom-field
        keys or labels.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {importResult ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
          <p className="text-sm font-medium text-slate-900">
            Imported {importResult.inserted_count} client
            {importResult.inserted_count === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {importResult.failed_count} row
            {importResult.failed_count === 1 ? "" : "s"} failed validation.
          </p>

          {importResult.errors.length > 0 ? (
            <div className="mt-4 space-y-3">
              {importResult.errors.map((rowError) => (
                <div
                  key={rowError.row_number}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-sm font-medium text-slate-900">
                    Row {rowError.row_number}
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    {rowError.errors.join(" ")}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
