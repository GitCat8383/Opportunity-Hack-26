import Link from "next/link";
import { ArrowRight, Search, Sparkles, Users } from "lucide-react";

import { ClientsAdminActions } from "@/components/clients-admin-actions";
import { SemanticSearchPanel } from "@/components/semantic-search-panel";
import { ApiError, apiFetch } from "@/lib/api";
import { handleProtectedApiError, requireAuthenticatedProfile } from "@/lib/auth";
import type { ClientListResponse } from "@/types";

type ClientsPageProps = {
  searchParams: Promise<{
    search?: string;
  }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { profile, session } = await requireAuthenticatedProfile();
  const resolvedParams = await searchParams;
  const search = resolvedParams?.search?.trim() ?? "";
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  let data: ClientListResponse;

  try {
    data = await apiFetch<ClientListResponse>(
      `/clients${query}`,
      { cache: "no-store" },
      session.access_token
    );
  } catch (error) {
    if (error instanceof ApiError) {
      handleProtectedApiError(error);
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <Users size={14} />
              Client Relationship Workspace
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Client Directory
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                Search active records, open profiles fast, and move from intake
                to service history without leaving the workspace.
              </p>
            </div>
            <form className="max-w-xl">
              <label className="relative block">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search clients by name..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </form>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Directory Snapshot
                </p>
                <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                  {data.total}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  total client records in this workspace
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 text-cyan-200">
                <Sparkles size={24} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Link
                href="/clients/new"
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Register Client</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Start a new intake profile.
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-200"
                />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {profile.role === "admin" ? <ClientsAdminActions /> : null}

      <SemanticSearchPanel
        enabled={profile.role === "staff" || profile.role === "admin"}
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/80 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Client Records
            </h2>
            <p className="text-sm text-slate-600">
              Showing {data.clients.length} of {data.total} clients
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Client
                </th>
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Language
                </th>
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Last Service
                </th>
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-10 text-center text-sm text-slate-500"
                  >
                    No clients found. Use{" "}
                    <span className="font-semibold text-slate-700">
                      Register Client
                    </span>{" "}
                    to create the first record.
                  </td>
                </tr>
              ) : (
                data.clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50/80"
                  >
                    <td className="p-4">
                      <Link
                        href={`/clients/${client.id}`}
                        className="group inline-flex items-center gap-3"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-sm font-semibold text-cyan-700">
                          {client.first_name.charAt(0)}
                          {client.last_name.charAt(0)}
                        </span>
                        <span>
                          <span className="block font-semibold text-slate-900 group-hover:underline">
                            {client.first_name} {client.last_name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            Open profile
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="p-4">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {client.language}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {client.last_service_date ?? "No services yet"}
                    </td>
                    <td className="p-4">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize tracking-[0.08em] text-emerald-700">
                        {client.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
