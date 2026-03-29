import {
  endOfQuarter,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subWeeks,
} from "date-fns";

import { ReportingDashboard } from "@/components/reporting-dashboard";
import { requireAuthenticatedProfile } from "@/lib/auth";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function ReportsPage() {
  const { supabase } = await requireAuthenticatedProfile(["staff", "admin"]);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);
  const trendStart = subWeeks(weekStart, 11);

  const [
    activeClientsResult,
    servicesThisWeekResult,
    servicesThisMonthResult,
    servicesThisQuarterResult,
    quarterEntriesResult,
    trendEntriesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("service_entries")
      .select("id", { count: "exact", head: true })
      .gte("service_date", isoDate(weekStart)),
    supabase
      .from("service_entries")
      .select("id", { count: "exact", head: true })
      .gte("service_date", isoDate(monthStart)),
    supabase
      .from("service_entries")
      .select("id", { count: "exact", head: true })
      .gte("service_date", isoDate(quarterStart)),
    supabase
      .from("service_entries")
      .select("service_type, service_date")
      .gte("service_date", isoDate(quarterStart))
      .lte("service_date", isoDate(quarterEnd))
      .order("service_date", { ascending: true }),
    supabase
      .from("service_entries")
      .select("service_date")
      .gte("service_date", isoDate(trendStart))
      .order("service_date", { ascending: true }),
  ]);

  const serviceTypeBreakdownMap = new Map<string, number>();
  for (const entry of quarterEntriesResult.data ?? []) {
    const key = entry.service_type || "General";
    serviceTypeBreakdownMap.set(key, (serviceTypeBreakdownMap.get(key) ?? 0) + 1);
  }

  const visitTrendMap = new Map<string, number>();
  for (let i = 0; i < 12; i += 1) {
    const week = subWeeks(weekStart, 11 - i);
    visitTrendMap.set(format(week, "MMM d"), 0);
  }

  for (const entry of trendEntriesResult.data ?? []) {
    const weekKey = format(
      startOfWeek(new Date(entry.service_date), { weekStartsOn: 1 }),
      "MMM d"
    );
    if (visitTrendMap.has(weekKey)) {
      visitTrendMap.set(weekKey, (visitTrendMap.get(weekKey) ?? 0) + 1);
    }
  }

  return (
    <ReportingDashboard
      activeClients={activeClientsResult.count ?? 0}
      servicesByPeriod={[
        { period: "This Week", count: servicesThisWeekResult.count ?? 0 },
        { period: "This Month", count: servicesThisMonthResult.count ?? 0 },
        { period: "This Quarter", count: servicesThisQuarterResult.count ?? 0 },
      ]}
      serviceTypeBreakdown={Array.from(serviceTypeBreakdownMap.entries()).map(
        ([service_type, count]) => ({
          service_type,
          count,
        })
      )}
      visitTrend={Array.from(visitTrendMap.entries()).map(([label, count]) => ({
        label,
        count,
      }))}
    />
  );
}
