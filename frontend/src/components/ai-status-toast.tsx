"use client";

type AiStatusToastProps = {
  message: string | null;
  tone: "loading" | "success" | "error";
};

function toneClasses(tone: AiStatusToastProps["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "error":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-sky-200 bg-sky-50 text-sky-900";
  }
}

export function AiStatusToast({ message, tone }: AiStatusToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${toneClasses(tone)}`}
      >
        {tone === "loading" ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
