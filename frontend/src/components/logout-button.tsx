"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="mt-6 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
    >
      {loading ? "Signing Out..." : "Sign Out"}
    </button>
  );
}
