import { requireAuthenticatedProfile } from "@/lib/auth";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuthenticatedProfile();
  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/calendar", label: "Calendar" },
    ...(profile.role === "staff" || profile.role === "admin"
      ? [{ href: "/reports", label: "Reports" }]
      : []),
    ...(profile.role === "admin"
      ? [{ href: "/audit-log", label: "Audit Log" }]
      : []),
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="app-sidebar w-64 border-r bg-card p-4 flex flex-col gap-1">
        <div className="mb-6 px-2">
          <h2 className="font-bold text-lg">Case Manager</h2>
          <p className="text-xs text-muted-foreground">Nonprofit Platform</p>
          <div className="mt-4 rounded-md border bg-background px-3 py-2">
            <p className="text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {profile.role}
            </p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
