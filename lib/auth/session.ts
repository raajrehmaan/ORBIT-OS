import { redirect } from "next/navigation";
import { getClinicSessionFromCookies } from "@/lib/auth/clinic-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

export async function getCurrentUserProfile() {
  const session = await getClinicSessionFromCookies();
  if (!session) return null;

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.userId)
    .eq("organisation_id", session.organisationId)
    .maybeSingle();

  if (profile?.organisation_id) return profile;

  const fallbackProfile: UserProfile = {
    id: session.userId,
    organisation_id: session.organisationId,
    email: `${session.username}@clinic.local`,
    full_name: session.fullName,
    role: session.role,
    created_at: new Date(session.expiresAt * 1000).toISOString(),
    updated_at: new Date(session.expiresAt * 1000).toISOString()
  };

  return fallbackProfile;
}

export async function requireUserProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
