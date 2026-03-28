export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat cards — will be wired in Step 9/10 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["Active Clients", "Services This Week", "Open Follow-Ups", "AI Spend"].map(
          (label) => (
            <div
              key={label}
              className="rounded-lg border bg-card p-4 space-y-1"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">--</p>
            </div>
          )
        )}
      </div>

      {/* Pending follow-ups placeholder */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Pending Follow-Ups</h2>
        <p className="text-sm text-muted-foreground">
          No follow-ups yet. They will appear here once AI detection is enabled.
        </p>
      </div>
    </div>
  );
}
