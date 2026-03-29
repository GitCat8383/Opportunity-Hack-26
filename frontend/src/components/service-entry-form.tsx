"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { StructuredNoteResult, TranscriptionResult } from "@/types";

type ServiceEntryFormProps = {
  clientId: string;
  serviceTypes: string[];
  staffName: string;
  canUseAi: boolean;
};

type AiProgressState = "idle" | "recording" | "transcribing" | "structuring";

type StructuredFieldsState = {
  summary: string;
  actionItems: string[];
  followUpDate: string;
  riskFlag: boolean;
};

function buildTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function progressClasses(state: AiProgressState, step: Exclude<AiProgressState, "idle">) {
  const order: Record<Exclude<AiProgressState, "idle">, number> = {
    recording: 1,
    transcribing: 2,
    structuring: 3,
  };

  if (state === step) {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (state !== "idle" && order[state] > order[step]) {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  return "border-input bg-background text-muted-foreground";
}

export function ServiceEntryForm({
  clientId,
  serviceTypes,
  staffName,
  canUseAi,
}: ServiceEntryFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [serviceDate, setServiceDate] = useState(buildTodayValue);
  const [serviceType, setServiceType] = useState(serviceTypes[0] ?? "");
  const [language, setLanguage] = useState("en");
  const [notes, setNotes] = useState("");
  const [structuredFields, setStructuredFields] = useState<StructuredFieldsState>({
    summary: "",
    actionItems: [],
    followUpDate: "",
    riskFlag: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<AiProgressState>("idle");

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

  async function handleStructuredTranscript(transcript: string, accessToken: string) {
    setAiProgress("structuring");

    const structured = await apiFetch<StructuredNoteResult>(
      "/ai/structure-note",
      {
        method: "POST",
        body: JSON.stringify({
          transcript,
          service_types: serviceTypes,
        }),
      },
      accessToken
    );

    if (structured.service_type) {
      setServiceType(structured.service_type);
    }

    setStructuredFields({
      summary: structured.summary ?? "",
      actionItems: structured.action_items,
      followUpDate: structured.follow_up_date ?? "",
      riskFlag: structured.risk_flag,
    });
  }

  async function transcribeBlob(audioBlob: Blob) {
    setAiError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setAiProgress("idle");
        return;
      }

      setAiProgress("transcribing");

      const formData = new FormData();
      formData.append(
        "file",
        new File([audioBlob], "voice-note.webm", {
          type: audioBlob.type || "audio/webm",
        })
      );

      const transcription = await apiFetch<TranscriptionResult>(
        "/ai/transcribe",
        {
          method: "POST",
          body: formData,
        },
        accessToken
      );

      setNotes((current) =>
        current.trim()
          ? `${current.trim()}\n\n${transcription.transcript}`
          : transcription.transcript
      );

      await handleStructuredTranscript(transcription.transcript, accessToken);
      setAiProgress("idle");
    } catch (err) {
      setAiProgress("idle");
      setAiError(
        err instanceof ApiError
          ? err.message
          : "Unable to process the voice note."
      );
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    recorder.stop();
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAiError("This browser does not support audio recording.");
      return;
    }

    setAiError(null);
    setAiProgress("recording");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType: preferredMimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        await transcribeBlob(audioBlob);
      };

      recorder.start();
    } catch (err) {
      setAiProgress("idle");
      setAiError(
        err instanceof Error ? err.message : "Unable to start recording."
      );
    }
  }

  async function toggleRecording() {
    if (aiProgress === "recording") {
      await stopRecording();
      return;
    }

    await startRecording();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      await apiFetch(
        "/service-entries",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: clientId,
            service_date: serviceDate,
            service_type: serviceType,
            notes: notes || null,
            summary: structuredFields.summary || null,
            action_items: structuredFields.actionItems,
            risk_flags: structuredFields.riskFlag ? ["ai_risk_flag"] : [],
            language,
          }),
        },
        accessToken
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
      {canUseAi ? (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Voice Note Assistant</h2>
              <p className="text-sm text-muted-foreground">
                Record, transcribe, and structure a service note with Gemini.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleRecording}
              disabled={aiProgress === "transcribing" || aiProgress === "structuring"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 transition"
            >
              {aiProgress === "recording" ? "Stop Recording" : "Record Voice Note"}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className={`rounded-md border px-3 py-2 text-sm ${progressClasses(aiProgress, "recording")}`}>
              Recording
            </div>
            <div className={`rounded-md border px-3 py-2 text-sm ${progressClasses(aiProgress, "transcribing")}`}>
              Transcribing
            </div>
            <div className={`rounded-md border px-3 py-2 text-sm ${progressClasses(aiProgress, "structuring")}`}>
              Structuring
            </div>
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
          <span className="text-sm font-medium">Service Date</span>
          <input
            name="service_date"
            type="date"
            required
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Service Type</span>
          <select
            name="service_type"
            required
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {serviceTypes.map((item) => (
              <option key={item} value={item}>
                {item}
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
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
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
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Enter the service details and case notes."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      {canUseAi && (structuredFields.summary || structuredFields.actionItems.length > 0 || structuredFields.followUpDate || structuredFields.riskFlag) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-emerald-900">AI Structured Draft</h2>
            <p className="text-sm text-emerald-800">
              Review the structured note fields before saving.
            </p>
          </div>

          {structuredFields.summary ? (
            <div>
              <p className="text-sm font-medium text-emerald-900">Summary</p>
              <p className="mt-1 text-sm text-emerald-900">
                {structuredFields.summary}
              </p>
            </div>
          ) : null}

          {structuredFields.actionItems.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-emerald-900">Action Items</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-emerald-900">
                {structuredFields.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
              Follow-up date: {structuredFields.followUpDate || "None detected"}
            </div>
            <div className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
              Risk flag: {structuredFields.riskFlag ? "Yes" : "No"}
            </div>
          </div>
        </div>
      ) : null}

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
