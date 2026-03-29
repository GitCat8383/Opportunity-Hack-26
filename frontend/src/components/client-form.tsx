"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type ExtraField = {
  id: string;
  key: string;
  value: string;
};

const EMPTY_EXTRA_FIELD = () => ({
  id: crypto.randomUUID(),
  key: "",
  value: "",
});

export function ClientForm() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraFields, setExtraFields] = useState<ExtraField[]>([
    EMPTY_EXTRA_FIELD(),
  ]);

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

    const extraFieldsPayload = extraFields.reduce<Record<string, string>>(
      (acc, field) => {
        const key = field.key.trim();
        const value = field.value.trim();
        if (key) {
          acc[key] = value;
        }
        return acc;
      },
      {}
    );

    try {
      const client = await apiFetch<{ id: string }>(
        "/clients",
        {
          method: "POST",
          body: JSON.stringify({
            first_name: formData.get("first_name"),
            last_name: formData.get("last_name"),
            date_of_birth: formData.get("date_of_birth") || null,
            phone: formData.get("phone") || null,
            email: formData.get("email") || null,
            address: formData.get("address") || null,
            language: formData.get("language") || "en",
            gender: formData.get("gender") || null,
            household_size: formData.get("household_size")
              ? Number(formData.get("household_size"))
              : null,
            status: formData.get("status") || "active",
            extra_fields: extraFieldsPayload,
          }),
        },
        session.access_token
      );

      router.push(`/clients/${client.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to create client."
      );
      setLoading(false);
    }
  }

  function updateExtraField(id: string, field: "key" | "value", value: string) {
    setExtraFields((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function addExtraField() {
    setExtraFields((current) => [...current, EMPTY_EXTRA_FIELD()]);
  }

  function removeExtraField(id: string) {
    setExtraFields((current) =>
      current.length === 1 ? [EMPTY_EXTRA_FIELD()] : current.filter((item) => item.id !== id)
    );
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
          <span className="text-sm font-medium">First Name</span>
          <input
            name="first_name"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Last Name</span>
          <input
            name="last_name"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Date of Birth</span>
          <input
            name="date_of_birth"
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        <label className="space-y-1">
          <span className="text-sm font-medium">Phone</span>
          <input
            name="phone"
            type="tel"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Gender</span>
          <input
            name="gender"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Household Size</span>
          <input
            name="household_size"
            type="number"
            min="1"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Address</span>
        <textarea
          name="address"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Additional Fields</h2>
            <p className="text-sm text-muted-foreground">
              Optional key-value data saved to `extra_fields`.
            </p>
          </div>
          <button
            type="button"
            onClick={addExtraField}
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition"
          >
            Add Field
          </button>
        </div>

        <div className="space-y-3">
          {extraFields.map((field) => (
            <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={field.key}
                onChange={(event) =>
                  updateExtraField(field.id, "key", event.target.value)
                }
                placeholder="Field name"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={field.value}
                onChange={(event) =>
                  updateExtraField(field.id, "value", event.target.value)
                }
                placeholder="Field value"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeExtraField(field.id)}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {loading ? "Saving..." : "Create Client"}
        </button>
      </div>
    </form>
  );
}
