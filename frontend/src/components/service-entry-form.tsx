"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type ServiceEntryFormProps = {
  clientId: string;
  serviceTypes: string[];
  staffName: string;
};

export function ServiceEntryForm({
  clientId,
  serviceTypes,
  staffName,
}: ServiceEntryFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    try {
      await apiFetch(
        "/service-entries",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: clientId,
            service_date: formData.get("service_date"),
            service_type: formData.get("service_type"),
            notes: formData.get("notes") || null,
            summary: null,
            action_items: [],
            risk_flags: [],
            language: formData.get("language") || "en",
          }),
        },
        session.access_token
      );

      router.push(`/clients/${clientId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to save the service entry."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Service Date</span>
          <input
            name="service_date"
            type="date"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Service Type</span>
          <select
            name="service_type"
            required
            defaultValue={serviceTypes[0] ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {serviceTypes.map((serviceType) => (
              <option key={serviceType} value={serviceType}>
                {serviceType}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Staff</span>
          <input
            value={staffName}
            disabled
            className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Language</span>
          <select
            name="language"
            defaultValue="en"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Notes</span>
        <textarea
          name="notes"
          rows={8}
          placeholder="Enter the service details and case notes."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {loading ? "Saving..." : "Save Service Entry"}
        </button>
      </div>
    </form>
  );
}
