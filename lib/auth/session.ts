import { redirect } from "next/navigation";
import { getClinicSessionFromCookies } from "@/lib/auth/clinic-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorDetails, logRuntimeDiagnostic } from "@/lib/diagnostics/runtime";
import type { Database } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

export async function getCurrentUserProfile() {
  const session = await getClinicSessionFromCookies();
  if (!session) return null;

  const supabase = await createSupabaseServerClient();
  try {
    const { data: authUser, error: authError } = await supabase
      .from("auth_users")
      .select("id, username, organisation_id, role, active")
      .eq("id", session.userId)
      .eq("active", true)
      .maybeSingle();
    if (authError || !authUser?.organisation_id) {
      logRuntimeDiagnostic("session_auth_user_missing", { userId: session.userId, error: authError ? errorDetails(authError) : null });
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .eq("organisation_id", authUser.organisation_id)
      .maybeSingle();
    if (profile?.organisation_id) return profile;

    logRuntimeDiagnostic("session_profile_missing", { userId: authUser.id, organisationId: authUser.organisation_id, error: profileError ? errorDetails(profileError) : null });
    return {
      id: authUser.id,
      organisation_id: authUser.organisation_id,
      email: `${authUser.username}@clinic.local`,
      full_name: session.fullName || authUser.username,
      role: session.role,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString()
    } satisfies UserProfile;
  } catch (error) {
    logRuntimeDiagnostic("session_profile_load_failed", { userId: session.userId, error: errorDetails(error) });
    return null;
  }
}

export async function requireUserProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
