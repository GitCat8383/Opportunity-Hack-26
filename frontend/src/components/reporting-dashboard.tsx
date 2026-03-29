"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportingDashboardProps = {
  activeClients: number;
  servicesByPeriod: Array<{ period: string; count: number }>;
  serviceTypeBreakdown: Array<{ service_type: string; count: number }>;
  visitTrend: Array<{ label: string; count: number }>;
};

const PIE_COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

export function ReportingDashboard({
  activeClients,
  servicesByPeriod,
  serviceTypeBreakdown,
  visitTrend,
}: ReportingDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 print-hidden">
        <div>
          <h1 className="text-2xl font-bold">Reporting Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review service delivery patterns and print a PDF-friendly summary.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition"
        >
          Print Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Active Clients</p>
          <p className="mt-2 text-3xl font-bold">{activeClients}</p>
        </div>
        {servicesByPeriod.map((item) => (
          <div key={item.period} className="rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">Services {item.period}</p>
            <p className="mt-2 text-3xl font-bold">{item.count}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Services This Week / Month / Quarter</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={servicesByPeriod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Service Type Breakdown</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceTypeBreakdown}
                  dataKey="count"
                  nameKey="service_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label
                >
                  {serviceTypeBreakdown.map((entry, index) => (
                    <Cell
                      key={entry.service_type}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Visit Trend</h2>
        <p className="text-sm text-muted-foreground">
          Weekly service-entry trend over the last twelve weeks.
        </p>
        <div className="mt-4 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visitTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0f766e"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
