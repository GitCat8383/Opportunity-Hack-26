"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type { FollowUp } from "@/types";

type PendingFollowupsWidgetProps = {
  initialFollowUps: FollowUp[];
  orgId: string;
};

const urgencyRank: Record<FollowUp["urgency"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function urgencyClasses(urgency: FollowUp["urgency"]) {
  if (urgency === "critical") {
    return "bg-rose-100 text-rose-700";
  }
  if (urgency === "high") {
    return "bg-amber-100 text-amber-800";
  }
  if (urgency === "medium") {
    return "bg-sky-100 text-sky-700";
  }
  return "bg-zinc-100 text-zinc-700";
}

export function PendingFollowupsWidget({
  initialFollowUps,
  orgId,
}: PendingFollowupsWidgetProps) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`follow-ups-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follow_ups",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, router, supabase]);

  const followUps = useMemo(
    () =>
      [...initialFollowUps].sort((left, right) => {
        const urgencyDelta = urgencyRank[right.urgency] - urgencyRank[left.urgency];
        if (urgencyDelta !== 0) {
          return urgencyDelta;
        }

        if (left.due_date && right.due_date) {
          return left.due_date.localeCompare(right.due_date);
        }

        if (left.due_date) {
          return -1;
        }

        if (right.due_date) {
          return 1;
        }

        return right.created_at.localeCompare(left.created_at);
      }),
    [initialFollowUps]
  );

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pending Follow-Ups
          </h2>
          <p className="text-sm text-slate-600">
            Prioritized live queue for unresolved client actions.
          </p>
        </div>
        <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Live updates enabled
        </p>
      </div>

      {followUps.length === 0 ? (
        <p className="text-sm text-slate-600">
          No pending follow-ups right now.
        </p>
      ) : (
        <div className="space-y-3">
          {followUps.map((followUp) => (
            <article
              key={followUp.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {followUp.description}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Due:{" "}
                    {followUp.due_date
                      ? formatDate(followUp.due_date)
                      : "Unscheduled"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${urgencyClasses(followUp.urgency)}`}
                >
                  {followUp.urgency}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {followUp.category ?? "general"}
                </span>
                <Link
                  href={`/clients/${followUp.client_id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  Open client
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
