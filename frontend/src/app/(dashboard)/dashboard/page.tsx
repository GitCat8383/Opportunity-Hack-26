import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  FileSpreadsheet,
  Sparkles,
  Users,
} from "lucide-react";
import { format, startOfMonth, startOfWeek } from "date-fns";

import { AccessDeniedToast } from "@/components/access-denied-toast";
import { AdminReportPanel } from "@/components/admin-report-panel";
import { PendingFollowupsWidget } from "@/components/pending-followups-widget";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type { FollowUp } from "@/types";

type DashboardPageProps = {
  searchParams?: Promise<{
    access_denied?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { profile, supabase } = await requireAuthenticatedProfile();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showAccessDenied = resolvedSearchParams?.access_denied === "1";

  const canUseAi = profile.role === "staff" || profile.role === "admin";
  const isAdmin = profile.role === "admin";
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    .toISOString()
    .slice(0, 10);
  const monthStart = startOfMonth(new Date()).toISOString();

  const [
    activeClientsResult,
    servicesThisWeekResult,
    openFollowUpsResult,
    aiSpendResult,
    orgConfigResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("service_entries")
      .select("id", { count: "exact", head: true })
      .gte("service_date", weekStart),
    canUseAi
      ? supabase
          .from("follow_ups")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase
          .from("ai_usage_log")
          .select("cost_cents")
          .gte("created_at", monthStart)
      : Promise.resolve({
          data: [] as Array<{ cost_cents: number | string | null }>,
        }),
    isAdmin
      ? supabase
          .from("org_config")
          .select("ai_monthly_budget_cents")
          .maybeSingle()
      : Promise.resolve({
          data: null as { ai_monthly_budget_cents: number } | null,
        }),
  ]);

  const { data: followUps } = canUseAi
    ? await supabase
        .from("follow_ups")
        .select(
          "id, org_id, client_id, service_entry_id, assigned_to, description, category, urgency, due_date, status, completed_at, created_at, updated_at"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as FollowUp[] };

  const aiSpendCents = Array.isArray(aiSpendResult.data)
    ? aiSpendResult.data.reduce(
        (total, item) => total + Number(item.cost_cents ?? 0),
        0
      )
    : 0;

  const statCards = [
    {
      label: "Active Clients",
      value: activeClientsResult.count ?? 0,
      hint: "current open records",
      icon: Users,
      accent:
        "from-indigo-500/15 via-white to-white text-indigo-600 ring-indigo-100",
    },
    {
      label: "Services This Week",
      value: servicesThisWeekResult.count ?? 0,
      hint: "logged since Monday",
      icon: CalendarClock,
      accent:
        "from-emerald-500/15 via-white to-white text-emerald-600 ring-emerald-100",
    },
    {
      label: "Open Follow-Ups",
      value: openFollowUpsResult.count ?? 0,
      hint: canUseAi ? "needs review or action" : "AI tracking unavailable",
      icon: Sparkles,
      accent:
        "from-amber-500/15 via-white to-white text-amber-600 ring-amber-100",
    },
    {
      label: "AI Spend",
      value: `$${(aiSpendCents / 100).toFixed(2)}`,
      hint:
        isAdmin && orgConfigResult.data
          ? `of $${(orgConfigResult.data.ai_monthly_budget_cents / 100).toFixed(2)} monthly cap`
          : "month to date",
      icon: Bot,
      accent:
        "from-purple-500/15 via-white to-white text-purple-600 ring-purple-100",
    },
  ];

  const quickLinks = [
    {
      href: "/clients/new",
      label: "Register Client",
      description: "Capture a new intake profile.",
    },
    {
      href: "/clients",
      label: "Open Client Directory",
      description: "Search records and recent services.",
    },
    {
      href: "/calendar",
      label: "Schedule Appointment",
      description: "Plan the next client touchpoint.",
    },
    ...(isAdmin
      ? [
          {
            href: "/clients/config",
            label: "Update Intake Fields",
            description: "Adjust org-specific client schema.",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      {showAccessDenied ? <AccessDeniedToast /> : null}

      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">
              <Sparkles size={14} />
              Daily Operations Snapshot
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Welcome back, {profile.full_name.split(" ")[0]}.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                Today is {format(new Date(), "EEEE, MMMM d")}. Review live case
                activity, clear pending follow-ups, and keep your reporting
                pipeline current.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article
                    key={card.label}
                    className={`rounded-3xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm ring-1 ${card.accent}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {card.label}
                        </p>
                        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                          {card.value}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                        <Icon size={18} />
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">{card.hint}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-slate-900/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Team Focus
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Keep the week moving.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Focus on timely documentation, visible next steps, and a clean
              handoff into reporting. The dashboard is optimized for quick daily
              decisions, not just data storage.
            </p>

            <div className="mt-6 space-y-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-purple-400/30 hover:bg-white/10"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-purple-200"
                  />
                </Link>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Access Level
              </p>
              <p className="mt-2 text-lg font-semibold capitalize text-white">
                {profile.role}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {canUseAi
                  ? "AI-assisted casework and follow-up features are enabled."
                  : "Core intake and service logging tools are available."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div className={`grid gap-6 ${isAdmin ? "xl:grid-cols-[0.95fr_1.05fr]" : ""}`}>
        {canUseAi ? (
          <PendingFollowupsWidget
            initialFollowUps={followUps ?? []}
            orgId={profile.org_id}
          />
        ) : (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  Pending Follow-Ups
                </h2>
                <p className="text-sm text-slate-600">
                  AI follow-up detection is available to staff and admins.
                </p>
              </div>
            </div>
          </section>
        )}

        {isAdmin ? (
          <AdminReportPanel />
        ) : (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  Reporting Workspace
                </h2>
                <p className="text-sm text-slate-600">
                  Detailed reporting and funder narrative generation are
                  available to admins.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
