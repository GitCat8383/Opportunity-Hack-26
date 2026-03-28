import Link from "next/link";

export default function ClientsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex gap-2">
          <button className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition">
            Import CSV
          </button>
          <button className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition">
            Export CSV
          </button>
          <Link
            href="/clients/new"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            + New Client
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search clients by name..."
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {/* Client table — will be wired in Step 3 */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Language</th>
              <th className="text-left p-3 font-medium">Last Service</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="p-6 text-center text-muted-foreground">
                No clients yet. Click &quot;+ New Client&quot; to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
