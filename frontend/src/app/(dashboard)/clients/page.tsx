import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type { ClientListResponse } from "@/types";

type ClientsPageProps = {
  searchParams?: {
    search?: string;
  };
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { session } = await requireAuthenticatedProfile();
  const search = searchParams?.search?.trim() ?? "";
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const data = await apiFetch<ClientListResponse>(
    `/clients${query}`,
    { cache: "no-store" },
    session.access_token
  );

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

      <form className="w-full max-w-sm">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search clients by name..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </form>

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
            {data.clients.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="p-6 text-center text-muted-foreground"
                >
                  No clients found. Click &quot;+ New Client&quot; to get started.
                </td>
              </tr>
            ) : (
              data.clients.map((client) => (
                <tr key={client.id} className="border-t">
                  <td className="p-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {client.first_name} {client.last_name}
                    </Link>
                  </td>
                  <td className="p-3 uppercase">{client.language}</td>
                  <td className="p-3">
                    {client.last_service_date ?? "No services yet"}
                  </td>
                  <td className="p-3 capitalize">{client.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {data.clients.length} of {data.total} clients
      </p>
    </div>
  );
}
