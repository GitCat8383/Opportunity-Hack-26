import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  Shield,
  Users,
} from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { requireAuthenticatedProfile } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuthenticatedProfile();

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      description: "Overview and team pulse",
    },
    {
      href: "/clients",
      label: "Clients",
      icon: Users,
      description: "Profiles, notes, and history",
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: CalendarDays,
      description: "Appointments and scheduling",
    },
    ...(profile.role === "staff" || profile.role === "admin"
      ? [
          {
            href: "/reports",
            label: "Reports",
            icon: BarChart3,
            description: "Trends and output summaries",
          },
        ]
      : []),
    ...(profile.role === "admin"
      ? [
          {
            href: "/audit-log",
            label: "Audit Log",
            icon: Shield,
            description: "Governance and traceability",
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.16),_transparent_36%),linear-gradient(180deg,_#f8fafc,_#f1f5f9_40%,_#eef2ff)] text-slate-900 lg:grid lg:grid-cols-[320px_1fr]">
      <aside className="app-sidebar border-b border-slate-200/70 bg-slate-950 px-5 py-6 text-slate-100 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex h-full flex-col gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-purple-600 p-3 text-white shadow-lg shadow-purple-600/30">
                <HeartHandshake size={24} />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-white">
                  CareFlow
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Case Management
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-sm font-semibold text-white">{profile.full_name}</p>
              <div className="mt-2 inline-flex rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-purple-200">
                {profile.role}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Central workspace for client services, outcomes, and follow-up
                coordination.
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-2xl border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/5"
                >
                  <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition group-hover:border-purple-400/30 group-hover:bg-purple-500/10 group-hover:text-purple-200">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">
                      {item.label}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/15 via-transparent to-cyan-400/10 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-2 text-purple-200">
                <ClipboardList size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Mission Board</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Keep records current, close follow-ups early, and make
                  reporting easier at the end of each quarter.
                </p>
              </div>
            </div>
            <LogoutButton className="mt-5 w-full justify-center border-white/10 bg-white/5 hover:bg-white/10" />
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
