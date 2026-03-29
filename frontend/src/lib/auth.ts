import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

type AllowedRole = UserProfile["role"];

function buildProfileFallback(
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  },
  existingProfile: UserProfile | null
): UserProfile {
  if (existingProfile) {
    return existingProfile;
  }

  const metadata = user.user_metadata ?? {};
  return {
    id: user.id,
    org_id: String(metadata.org_id ?? ""),
    full_name:
      String(metadata.full_name ?? user.email?.split("@")[0] ?? "Case Manager"),
    email: user.email ?? "",
    role: (metadata.role as AllowedRole | undefined) ?? "volunteer",
    avatar_url: (metadata.avatar_url as string | null | undefined) ?? null,
  };
}

export async function requireAuthenticatedProfile(allowedRoles?: AllowedRole[]) {
  const supabase = await createServerSupabaseClient();
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  if (!sessionData.session || !userData.user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, email, role, avatar_url")
    .eq("id", userData.user.id)
    .maybeSingle();

  const profile = buildProfileFallback(userData.user, profileData);

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    session: sessionData.session,
    user: userData.user,
    profile,
  };
}
