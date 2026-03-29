import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

type AllowedRole = UserProfile["role"];

/**
 * Profile must come from the profiles table — never fall back to
 * user_metadata (which is user-editable and could be spoofed).
 */

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

  if (!profileData || !profileData.org_id) {
    redirect("/login");
  }

  const profile: UserProfile = profileData;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    redirect("/dashboard?access_denied=1");
  }

  return {
    supabase,
    session: sessionData.session,
    user: userData.user,
    profile,
  };
}
