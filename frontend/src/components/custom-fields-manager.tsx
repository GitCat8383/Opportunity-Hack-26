"use client";

import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { CustomFieldDefinition, OrgConfig } from "@/types";

type CustomFieldsManagerProps = {
  initialSchema: CustomFieldDefinition[];
};

type FieldType = CustomFieldDefinition["field_type"];

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
];

function createEmptyField(): CustomFieldDefinition {
  return {
    key: "",
    label: "",
    field_type: "text",
    required: false,
    options: [],
  };
}

function validateSchema(schema: CustomFieldDefinition[]) {
  const seenKeys = new Set<string>();

  for (const field of schema) {
    const key = field.key.trim();
    const label = field.label.trim();

    if (!key) {
      return "Every custom field needs a key.";
    }

    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      return "Field keys must start with a letter and use only letters, numbers, or underscores.";
    }

    if (seenKeys.has(key)) {
      return `Duplicate field key: ${key}`;
    }

    if (!label) {
      return "Every custom field needs a label.";
    }

    if (field.field_type === "select" && field.options.length === 0) {
      return `Select field "${label}" needs at least one option.`;
    }

    seenKeys.add(key);
  }

  return null;
}

export function CustomFieldsManager({
  initialSchema,
}: CustomFieldsManagerProps) {
  const supabase = createClient();
  const [schema, setSchema] = useState<CustomFieldDefinition[]>(initialSchema);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function updateField(
    index: number,
    updates: Partial<CustomFieldDefinition>
  ) {
    setSchema((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...updates } : field
      )
    );
  }

  function addField() {
    setSuccessMessage(null);
    setSchema((current) => [...current, createEmptyField()]);
  }

  function removeField(index: number) {
    setSuccessMessage(null);
    setSchema((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const normalizedSchema = schema.map((field) => ({
      ...field,
      key: field.key.trim(),
      label: field.label.trim(),
      options:
        field.field_type === "select"
          ? field.options.map((option) => option.trim()).filter(Boolean)
          : [],
    }));

    const validationError = validateSchema(normalizedSchema);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Your session has expired. Please sign in again.");
        setLoading(false);
        return;
      }

      const updatedConfig = await apiFetch<OrgConfig>(
        "/org-config",
        {
          method: "PATCH",
          body: JSON.stringify({ extra_fields_schema: normalizedSchema }),
        },
        session.access_token
      );

      setSchema(updatedConfig.extra_fields_schema);
      setSuccessMessage("Custom fields saved.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to save custom fields."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Client Custom Fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These fields render automatically on the client registration form and
          appear on the client profile after save.
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="space-y-4">
        {schema.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No custom fields configured yet.
          </div>
        ) : (
          schema.map((field, index) => (
            <div key={`${field.key || "new"}-${index}`} className="rounded-lg border bg-card p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Label</span>
                  <input
                    value={field.label}
                    onChange={(event) =>
                      updateField(index, { label: event.target.value })
                    }
                    placeholder="Veteran Status"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Key</span>
                  <input
                    value={field.key}
                    onChange={(event) =>
                      updateField(index, { key: event.target.value })
                    }
                    placeholder="veteran_status"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Field Type</span>
                  <select
                    value={field.field_type}
                    onChange={(event) =>
                      updateField(index, {
                        field_type: event.target.value as FieldType,
                        options:
                          event.target.value === "select" ? field.options : [],
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {FIELD_TYPES.map((fieldType) => (
                      <option key={fieldType} value={fieldType}>
                        {fieldType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateField(index, { required: event.target.checked })
                    }
                  />
                  Required field
                </label>
              </div>

              {field.field_type === "select" ? (
                <label className="mt-4 block space-y-1">
                  <span className="text-sm font-medium">
                    Options (comma-separated)
                  </span>
                  <input
                    value={field.options.join(", ")}
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value
                          .split(",")
                          .map((option) => option.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Yes, No, Prefer not to say"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={addField}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent transition"
        >
          Add Custom Field
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
