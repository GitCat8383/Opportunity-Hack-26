"use client";

import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { CustomFieldDefinition, OrgConfig } from "@/types";

type CustomFieldsManagerProps = {
  initialConfig: OrgConfig;
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
  initialConfig,
}: CustomFieldsManagerProps) {
  const supabase = createClient();
  const [schema, setSchema] = useState<CustomFieldDefinition[]>(
    initialConfig.extra_fields_schema
  );
  const [draftField, setDraftField] = useState<CustomFieldDefinition>(
    createEmptyField()
  );
  const [savedBudgetCents, setSavedBudgetCents] = useState<number>(
    initialConfig.ai_monthly_budget_cents
  );
  const [aiBudgetDollars, setAiBudgetDollars] = useState<string>(
    (initialConfig.ai_monthly_budget_cents / 100).toFixed(2)
  );
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

  function updateDraftField(updates: Partial<CustomFieldDefinition>) {
    setDraftField((current) => ({ ...current, ...updates }));
  }

  function addField() {
    setSuccessMessage(null);
    setError(null);

    const normalizedDraft: CustomFieldDefinition = {
      ...draftField,
      key: draftField.key.trim(),
      label: draftField.label.trim(),
      options:
        draftField.field_type === "select"
          ? draftField.options.map((option) => option.trim()).filter(Boolean)
          : [],
    };

    const validationError = validateSchema([...schema, normalizedDraft]);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSchema((current) => [...current, normalizedDraft]);
    setDraftField(createEmptyField());
    setSuccessMessage('Field added. Click "Save Changes" to persist it.');
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

    const parsedBudgetDollars = Number(aiBudgetDollars);
    if (!Number.isFinite(parsedBudgetDollars) || parsedBudgetDollars < 0) {
      setError("AI monthly budget must be zero dollars or greater.");
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
          body: JSON.stringify({
            extra_fields_schema: normalizedSchema,
            ai_monthly_budget_cents: Math.round(parsedBudgetDollars * 100),
          }),
        },
        session.access_token
      );

      setSchema(updatedConfig.extra_fields_schema);
      setSavedBudgetCents(updatedConfig.ai_monthly_budget_cents);
      setAiBudgetDollars(
        (updatedConfig.ai_monthly_budget_cents / 100).toFixed(2)
      );
      setSuccessMessage(
        `Configuration saved. AI monthly budget is now $${(
          updatedConfig.ai_monthly_budget_cents / 100
        ).toFixed(2)}.`
      );
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

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Add New Field</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a custom field here, then save your changes to make it live
            for this organization.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Label</span>
            <input
              value={draftField.label}
              onChange={(event) =>
                updateDraftField({ label: event.target.value })
              }
              placeholder="Veteran Status"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Key</span>
            <input
              value={draftField.key}
              onChange={(event) =>
                updateDraftField({ key: event.target.value })
              }
              placeholder="veteran_status"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Field Type</span>
            <select
              value={draftField.field_type}
              onChange={(event) =>
                updateDraftField({
                  field_type: event.target.value as FieldType,
                  options:
                    event.target.value === "select" ? draftField.options : [],
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
              checked={draftField.required}
              onChange={(event) =>
                updateDraftField({ required: event.target.checked })
              }
            />
            Required field
          </label>
        </div>

        {draftField.field_type === "select" ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Options (comma-separated)
            </span>
            <input
              value={draftField.options.join(", ")}
              onChange={(event) =>
                updateDraftField({
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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={addField}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent transition"
          >
            Add Field
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">AI Monthly Budget</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set the monthly AI cap for this organization in dollars. Enter `0`
            to disable AI features entirely.
          </p>
        </div>
        <label className="block max-w-xs space-y-1">
          <span className="text-sm font-medium">Budget (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={aiBudgetDollars}
            onChange={(event) => setAiBudgetDollars(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Current stored value: {savedBudgetCents} cents (${(
            savedBudgetCents / 100
          ).toFixed(2)})
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

      <div className="flex flex-wrap justify-end gap-3">
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
