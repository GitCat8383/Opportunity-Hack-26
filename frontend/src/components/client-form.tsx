"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { CustomFieldDefinition } from "@/types";

type ClientFormProps = {
  extraFieldsSchema: CustomFieldDefinition[];
};

export function ClientForm({ extraFieldsSchema }: ClientFormProps) {
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

    const extraFieldsPayload = extraFieldsSchema.reduce<Record<string, string | number>>(
      (acc, field) => {
        const rawValue = formData.get(`extra_${field.key}`);
        const value = rawValue == null ? "" : String(rawValue).trim();
        if (!value) {
          return acc;
        }
        acc[field.key] = field.field_type === "number" ? Number(value) : value;
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

      {extraFieldsSchema.length > 0 ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h2 className="font-semibold">Custom Fields</h2>
            <p className="text-sm text-muted-foreground">
              These fields are configured per organization.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {extraFieldsSchema.map((field) => {
              const inputName = `extra_${field.key}`;

              if (field.field_type === "textarea") {
                return (
                  <label key={field.key} className="space-y-1 md:col-span-2">
                    <span className="text-sm font-medium">{field.label}</span>
                    <textarea
                      name={inputName}
                      required={field.required}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                );
              }

              if (field.field_type === "select") {
                return (
                  <label key={field.key} className="space-y-1">
                    <span className="text-sm font-medium">{field.label}</span>
                    <select
                      name={inputName}
                      required={field.required}
                      defaultValue=""
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select an option</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field.key} className="space-y-1">
                  <span className="text-sm font-medium">{field.label}</span>
                  <input
                    name={inputName}
                    required={field.required}
                    type={
                      field.field_type === "number"
                        ? "number"
                        : field.field_type === "date"
                          ? "date"
                          : "text"
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

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
