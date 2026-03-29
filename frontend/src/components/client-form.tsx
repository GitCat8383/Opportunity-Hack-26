"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { useAiTranslations } from "@/hooks/use-ai-translations";
import { createClient } from "@/lib/supabase/client";
import type { CustomFieldDefinition, PhotoIntakeResult } from "@/types";
import { AiStatusToast } from "./ai-status-toast";

type ClientFormProps = {
  extraFieldsSchema: CustomFieldDefinition[];
  canUseAi: boolean;
};

type ClientFormValues = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  email: string;
  address: string;
  language: string;
  gender: string;
  household_size: string;
  status: string;
};

const DEMO_INTAKE_IMAGES = [
  {
    label: "Handwritten Demo",
    path: "/demo-intake/handwritten-intake.svg",
  },
  {
    label: "Printed Demo",
    path: "/demo-intake/printed-intake.svg",
  },
  {
    label: "Napkin Demo",
    path: "/demo-intake/napkin-intake.svg",
  },
];

const DEFAULT_VALUES: ClientFormValues = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  phone: "",
  email: "",
  address: "",
  language: "en",
  gender: "",
  household_size: "",
  status: "active",
};

function extractBase64Payload(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Unsupported image format.");
  }

  return {
    mimeType: match[1],
    imageBase64: match[2],
  };
}

async function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read file."));
    };
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

async function svgPathToPngDataUrl(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Unable to load demo image.");
  }

  const svgText = await response.text();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    return await new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width || 1200;
        canvas.height = image.height || 900;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas is not available."));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("Unable to render demo image."));
      image.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function ClientForm({ extraFieldsSchema, canUseAi }: ClientFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayLanguage, setDisplayLanguage] = useState<"en" | "es">("en");
  const [formValues, setFormValues] = useState<ClientFormValues>(DEFAULT_VALUES);
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    tone: "loading" | "success" | "error";
    message: string | null;
  }>({ tone: "loading", message: null });
  const translationTexts = useMemo(
    () => [
      "Register Client",
      "Switch the form language without changing the client's saved preferred language.",
      "Form Language",
      "English",
      "Spanish",
      "AI Photo Intake",
      "Scan an intake image to prefill the registration form.",
      "Scan Intake Form",
      "Scanning...",
      "First Name",
      "Last Name",
      "Date of Birth",
      "Language",
      "Phone",
      "Email",
      "Gender",
      "Household Size",
      "Address",
      "Custom Fields",
      "These fields are configured per organization.",
      "Select an option",
      "Create Client",
      "Saving...",
      "you@nonprofit.org",
      "Client phone number",
      "Street address",
      "Scan intake form with AI...",
      "Photo intake fields were added to the form.",
      "Unable to scan intake form.",
      ...extraFieldsSchema.flatMap((field) => [field.label, ...field.options]),
    ],
    [extraFieldsSchema]
  );
  const {
    t,
    loading: translatingUi,
  } = useAiTranslations({
    texts: translationTexts,
    targetLanguage: displayLanguage,
    enabled: displayLanguage === "es",
  });

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

  function applyPhotoIntake(result: PhotoIntakeResult) {
    setFormValues((current) => ({
      ...current,
      first_name: result.first_name ?? current.first_name,
      last_name: result.last_name ?? current.last_name,
      date_of_birth: result.date_of_birth ?? current.date_of_birth,
      phone: result.phone ?? current.phone,
      email: result.email ?? current.email,
      address: result.address ?? current.address,
      language: result.language ?? current.language,
      gender: result.gender ?? current.gender,
      household_size:
        result.household_size == null
          ? current.household_size
          : String(result.household_size),
      status: result.status ?? current.status,
    }));

    if (result.extra_fields) {
      setExtraFieldValues((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(result.extra_fields)) {
          if (value != null) {
            next[key] = String(value);
          }
        }
        return next;
      });
    }
  }

  async function submitPhotoIntake(dataUrl: string) {
    setAiLoading(true);
    setAiError(null);
    showToast("loading", "Scanning intake form with AI...");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setToast({ tone: "loading", message: null });
        return;
      }

      const { mimeType, imageBase64 } = extractBase64Payload(dataUrl);
      const result = await apiFetch<PhotoIntakeResult>(
        "/ai/photo-intake",
        {
          method: "POST",
          body: JSON.stringify({
            mime_type: mimeType,
            image_base64: imageBase64,
          }),
        },
        accessToken
      );

      applyPhotoIntake(result);
      showToast("success", "Photo intake fields were added to the form.", 2500);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to scan intake form.";
      setAiError(message);
      showToast("error", message, 3500);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDemoImage(path: string) {
    try {
      const dataUrl = await svgPathToPngDataUrl(path);
      await submitPhotoIntake(dataUrl);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unable to load demo image.");
      setAiLoading(false);
    }
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      await submitPhotoIntake(dataUrl);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Unable to read selected image."
      );
      setAiLoading(false);
    }
  }

  function updateFormValue<K extends keyof ClientFormValues>(
    key: K,
    value: ClientFormValues[K]
  ) {
    setFormValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const extraFieldsPayload = extraFieldsSchema.reduce<Record<string, string | number>>(
      (acc, field) => {
        const value = (extraFieldValues[field.key] ?? "").trim();
        if (!value) {
          return acc;
        }
        acc[field.key] = field.field_type === "number" ? Number(value) : value;
        return acc;
      },
      {}
    );

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const client = await apiFetch<{ id: string }>(
        "/clients",
        {
          method: "POST",
          body: JSON.stringify({
            first_name: formValues.first_name,
            last_name: formValues.last_name,
            date_of_birth: formValues.date_of_birth || null,
            phone: formValues.phone || null,
            email: formValues.email || null,
            address: formValues.address || null,
            language: formValues.language || "en",
            gender: formValues.gender || null,
            household_size: formValues.household_size
              ? Number(formValues.household_size)
              : null,
            status: formValues.status || "active",
            extra_fields: extraFieldsPayload,
          }),
        },
        accessToken
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
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("Register Client")}</h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "Switch the form language without changing the client's saved preferred language."
              )}
            </p>
          </div>
          <div className="inline-flex rounded-md border bg-background p-1">
            {(["en", "es"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setDisplayLanguage(lang)}
                className={`rounded px-3 py-1.5 text-sm transition ${
                  displayLanguage === lang ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {lang === "en" ? t("English") : t("Spanish")}
              </button>
            ))}
          </div>
        </div>
        {translatingUi ? (
          <p className="text-xs text-muted-foreground">
            {t("Translating form...")}
          </p>
        ) : null}
      </div>

      {canUseAi ? (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("AI Photo Intake")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("Scan an intake image to prefill the registration form.")}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelection}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={aiLoading}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition"
            >
              {aiLoading ? t("Scanning...") : t("Scan Intake Form")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {DEMO_INTAKE_IMAGES.map((image) => (
              <button
                key={image.path}
                type="button"
                onClick={() => handleDemoImage(image.path)}
                disabled={aiLoading}
                className="rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition"
              >
                {image.label}
              </button>
            ))}
          </div>

          {aiError ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {aiError}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("First Name")}</span>
          <input
            name="first_name"
            required
            value={formValues.first_name}
            onChange={(event) => updateFormValue("first_name", event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Last Name")}</span>
          <input
            name="last_name"
            required
            value={formValues.last_name}
            onChange={(event) => updateFormValue("last_name", event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Date of Birth")}</span>
          <input
            name="date_of_birth"
            type="date"
            value={formValues.date_of_birth}
            onChange={(event) =>
              updateFormValue("date_of_birth", event.target.value)
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Language")}</span>
          <select
            name="language"
            value={formValues.language}
            onChange={(event) => updateFormValue("language", event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="en">{t("English")}</option>
            <option value="es">{t("Spanish")}</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Phone")}</span>
          <input
            name="phone"
            type="tel"
            value={formValues.phone}
            onChange={(event) => updateFormValue("phone", event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("Client phone number")}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Email")}</span>
          <input
            name="email"
            type="email"
            value={formValues.email}
            onChange={(event) => updateFormValue("email", event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("you@nonprofit.org")}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Gender")}</span>
          <input
            name="gender"
            value={formValues.gender}
            onChange={(event) => updateFormValue("gender", event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t("Household Size")}</span>
          <input
            name="household_size"
            type="number"
            min="1"
            value={formValues.household_size}
            onChange={(event) =>
              updateFormValue("household_size", event.target.value)
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("Address")}</span>
        <textarea
          name="address"
          rows={3}
          value={formValues.address}
          onChange={(event) => updateFormValue("address", event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t("Street address")}
        />
      </label>

      {extraFieldsSchema.length > 0 ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h2 className="font-semibold">{t("Custom Fields")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("These fields are configured per organization.")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {extraFieldsSchema.map((field) => {
              const value = extraFieldValues[field.key] ?? "";

              if (field.field_type === "textarea") {
                return (
                  <label key={field.key} className="space-y-1 md:col-span-2">
                    <span className="text-sm font-medium">{t(field.label)}</span>
                    <textarea
                      name={`extra_${field.key}`}
                      required={field.required}
                      rows={3}
                      value={value}
                      onChange={(event) =>
                        setExtraFieldValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                );
              }

              if (field.field_type === "select") {
                return (
                  <label key={field.key} className="space-y-1">
                    <span className="text-sm font-medium">{t(field.label)}</span>
                    <select
                      name={`extra_${field.key}`}
                      required={field.required}
                      value={value}
                      onChange={(event) =>
                        setExtraFieldValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{t("Select an option")}</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {t(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field.key} className="space-y-1">
                  <span className="text-sm font-medium">{t(field.label)}</span>
                  <input
                    name={`extra_${field.key}`}
                    required={field.required}
                    value={value}
                    onChange={(event) =>
                      setExtraFieldValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
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
          {loading ? t("Saving...") : t("Create Client")}
        </button>
      </div>

      <AiStatusToast message={toast.message} tone={toast.tone} />
    </form>
  );
}
