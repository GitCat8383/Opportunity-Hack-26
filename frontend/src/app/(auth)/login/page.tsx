"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

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
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access your case management dashboard
          </p>
        </div>

        {(formState.error || oauthError) && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {formState.error ?? oauthError}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@nonprofit.org"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton />
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={oauthLoading}
          className="w-full rounded-md border border-input bg-background py-2 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
        >
          Sign In with Google
        </button>
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
      className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
    >
      {pending ? "Signing in..." : "Sign In with Email"}
    </button>
  );
}
