"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE, ApiError, apiFetch } from "@/lib/api";
import { formatDateTime, formatFileSize } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type { ClientDocument, UserProfile } from "@/types";

type ClientDocumentsPanelProps = {
  clientId: string;
  initialDocuments: ClientDocument[];
  role: UserProfile["role"];
};

export function ClientDocumentsPanel({
  clientId,
  initialDocuments,
  role,
}: ClientDocumentsPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Please choose a file to upload.");
      setUploading(false);
      return;
    }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return;
      }

      const uploadPayload = new FormData();
      uploadPayload.append("file", file);
      uploadPayload.append(
        "description",
        String(formData.get("description") || "").trim()
      );

      const document = await apiFetch<ClientDocument>(
        `/clients/${clientId}/documents`,
        {
          method: "POST",
          body: uploadPayload,
        },
        accessToken
      );

      setDocuments((current) => [document, ...current]);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to upload document."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(documentItem: ClientDocument) {
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/clients/${clientId}/documents/${documentItem.id}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: response.statusText }));
        throw new ApiError(
          payload.detail || "Unable to download document.",
          response.status
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = documentItem.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to download document."
      );
    }
  }

  async function handleDelete(documentId: string) {
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return;
      }

      await apiFetch(
        `/clients/${clientId}/documents/${documentId}`,
        {
          method: "DELETE",
        },
        accessToken
      );

      setDocuments((current) => current.filter((item) => item.id !== documentId));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to delete document."
      );
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5 space-y-5">
      <div>
        <h2 className="font-semibold">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Upload intake forms, waivers, or supporting files to this client record.
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleUpload} className="space-y-3 rounded-md border p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">File</span>
          <input
            name="file"
            type="file"
            required
            className="block w-full text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <input
            name="description"
            placeholder="Signed waiver, intake form, insurance card..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>
        </div>
      </form>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents attached yet.
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((documentItem) => (
            <article key={documentItem.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{documentItem.file_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(documentItem.created_at)} ·{" "}
                    {formatFileSize(documentItem.file_size)}
                  </p>
                  {documentItem.description ? (
                    <p className="mt-2 text-sm">{documentItem.description}</p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(documentItem)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition"
                  >
                    Download
                  </button>
                  {role === "staff" || role === "admin" ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(documentItem.id)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
