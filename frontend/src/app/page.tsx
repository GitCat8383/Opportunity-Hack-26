import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  HeartHandshake,
  ShieldCheck,
  Users,
} from "lucide-react";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-purple-200">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-600 p-2 text-white shadow-sm">
              <HeartHandshake size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              CareFlow
            </span>
          </div>

          <div className="flex gap-4">
            <Link
              href="/login"
              className="hidden px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden pb-32 pt-20">
          <div className="absolute left-1/2 top-0 -z-10 h-[500px] w-full max-w-3xl -translate-x-1/2 rounded-full bg-purple-100/50 blur-3xl opacity-60" />
          <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-purple-50 via-slate-50 to-slate-50" />

          <div className="relative z-10 mx-auto mt-12 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl space-y-8">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 shadow-sm">
                <ShieldCheck size={16} className="text-purple-600" />
                <span>Built for small nonprofits</span>
              </div>

              <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
                Empower your mission with{" "}
                <span className="bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent">
                  intelligent
                </span>{" "}
                case management.
              </h1>

              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
                Lightweight, AI-powered client tracking and service logging.
                Spend less time on paperwork and more time making an impact.
              </p>

              <div className="flex flex-col justify-center gap-4 pt-6 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-purple-700 hover:shadow-purple-600/20"
                >
                  Open Dashboard
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-4 text-base font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Everything you need, all in one place
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Streamline your workflow from intake to outcome reporting.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <FeatureCard
                icon={<Users size={28} />}
                title="Track Clients"
                description="Maintain comprehensive client profiles, history, and notes securely. Access the information you need instantly."
              />
              <FeatureCard
                icon={<ClipboardList size={28} />}
                title="Log Services"
                description="Easily record services provided, track attendance, and manage case notes with AI-assisted data entry."
              />
              <FeatureCard
                icon={<BarChart3 size={28} />}
                title="Report Outcomes"
                description="Generate accurate, presentation-ready reports for grantmakers and stakeholders with just a few clicks."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 py-12 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2 text-slate-200">
            <HeartHandshake size={24} className="text-purple-500" />
            <span className="text-xl font-semibold tracking-tight">CareFlow</span>
          </div>
          <p className="text-sm">
            &copy; {new Date().getFullYear()} CareFlow Nonprofit Solutions. All
            rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-slate-50 p-8 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-100 bg-white text-purple-600 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
