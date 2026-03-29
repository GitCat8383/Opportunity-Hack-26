"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type AppointmentFormProps = {
  clients: Array<{
    id: string;
    first_name: string;
    last_name: string;
  }>;
  serviceTypes: string[];
  defaultClientId?: string;
};

export function AppointmentForm({
  clients,
  serviceTypes,
  defaultClientId,
}: AppointmentFormProps) {
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
        "/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: formData.get("client_id"),
            scheduled_at: new Date(String(formData.get("scheduled_at"))).toISOString(),
            duration_minutes: Number(formData.get("duration_minutes") || 60),
            service_type: formData.get("service_type") || null,
            status: "scheduled",
            notes: formData.get("notes") || null,
          }),
        },
        session.access_token
      );

      event.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to schedule appointment."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Client</span>
          <select
            name="client_id"
            required
            defaultValue={defaultClientId ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Date & Time</span>
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Duration</span>
          <select
            name="duration_minutes"
            defaultValue="60"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {[30, 45, 60, 90, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Service Type</span>
          <select
            name="service_type"
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
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Notes</span>
        <textarea
          name="notes"
          rows={4}
          placeholder="Optional scheduling notes, preparation reminders, or context."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {loading ? "Scheduling..." : "Schedule Appointment"}
        </button>
      </div>
    </form>
  );
}
