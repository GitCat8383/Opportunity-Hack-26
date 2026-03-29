"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  ClipboardList,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  signInWithEmailPassword,
  type LoginFormState,
} from "@/app/(auth)/login/actions";

const initialLoginFormState: LoginFormState = {
  error: null,
};

export default function LoginPage() {
  const [formState, formAction] = useFormState(
    signInWithEmailPassword,
    initialLoginFormState
  );
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleGoogleLogin() {
    setOauthLoading(true);
    setOauthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setOauthError(error.message);
      setOauthLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="absolute left-1/2 top-0 h-[420px] w-full max-w-2xl -translate-x-1/2 rounded-full bg-purple-100/60 blur-3xl" />
          <div className="relative flex min-h-full flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-600 p-2 text-white shadow-sm">
                  <HeartHandshake size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-800">
                  CareFlow
                </span>
              </Link>

              <Link
                href="/"
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Back Home
              </Link>
            </div>

            <div className="flex flex-1 items-center py-12">
              <div className="max-w-xl space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 shadow-sm">
                  <ShieldCheck size={16} className="text-purple-600" />
                  <span>Secure nonprofit operations</span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                    Welcome back to your case management workspace.
                  </h1>
                  <p className="max-w-lg text-lg leading-relaxed text-slate-600">
                    Track clients, log services, and surface follow-ups from one
                    place designed for small nonprofit teams.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <InfoCard
                    icon={<Users size={20} />}
                    title="Client History"
                    description="Fast access to demographics, appointments, and records."
                  />
                  <InfoCard
                    icon={<ClipboardList size={20} />}
                    title="Service Logs"
                    description="Structured entries with notes, outcomes, and follow-ups."
                  />
                  <InfoCard
                    icon={<Sparkles size={20} />}
                    title="AI Assist"
                    description="Summaries, translation, and reporting built in."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 sm:p-10">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Sign In
              </h2>
              <p className="text-sm text-slate-600">
                Access your case management dashboard
              </p>
            </div>

            {(formState.error || oauthError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formState.error ?? oauthError}
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                  placeholder="you@nonprofit.org"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <SubmitButton />
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">or</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={oauthLoading}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {oauthLoading ? "Redirecting..." : "Sign In with Google"}
            </button>

            <p className="text-center text-xs text-slate-500">
              Protected workspace for nonprofit staff, volunteers, and admins.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
    >
      {pending ? "Signing in..." : "Sign In with Email"}
    </button>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-purple-600 shadow-sm">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </div>
  );
}
