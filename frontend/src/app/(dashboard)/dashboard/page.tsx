import { startOfMonth, startOfWeek } from "date-fns";

import { AdminReportPanel } from "@/components/admin-report-panel";
import { AccessDeniedToast } from "@/components/access-denied-toast";
import { PendingFollowupsWidget } from "@/components/pending-followups-widget";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type { FollowUp } from "@/types";

type DashboardPageProps = {
  searchParams?: Promise<{
    access_denied?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
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
  ] =
    await Promise.all([
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
        : Promise.resolve({ data: null as { ai_monthly_budget_cents: number } | null }),
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
    { label: "Active Clients", value: activeClientsResult.count ?? 0 },
    { label: "Services This Week", value: servicesThisWeekResult.count ?? 0 },
    { label: "Open Follow-Ups", value: openFollowUpsResult.count ?? 0 },
    {
      label: "AI Spend",
      value: `$${(aiSpendCents / 100).toFixed(2)}`,
      hint:
        isAdmin && orgConfigResult.data
          ? `of $${(orgConfigResult.data.ai_monthly_budget_cents / 100).toFixed(2)} monthly cap`
          : "month to date",
    },
  ];

  return (
    <div className="space-y-6">
      {showAccessDenied ? <AccessDeniedToast /> : null}
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
            {"hint" in card && card.hint ? (
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      {canUseAi ? (
        <PendingFollowupsWidget
          initialFollowUps={followUps ?? []}
          orgId={profile.org_id}
        />
      ) : (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-semibold">Pending Follow-Ups</h2>
          <p className="text-sm text-muted-foreground">
            AI follow-up detection is available to staff and admins.
          </p>
        </div>
      )}

      {isAdmin ? <AdminReportPanel /> : null}
    </div>
  );
}
