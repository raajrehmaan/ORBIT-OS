import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

const roles: Role[] = ["super_admin", "organisation_owner", "admin", "staff", "client"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export async function getCurrentUserProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (!error && profile?.organisation_id) return profile;

  const { data: onboardedProfile, error: onboardingError } = await supabase.rpc("ensure_user_organisation");
  if (onboardingError) {
    throw new Error(`Unable to complete organisation onboarding: ${onboardingError.message}`);
  }
  if (onboardedProfile?.organisation_id) return onboardedProfile;

  const metadataRole = user.app_metadata?.role;
  const metadataOrganisationId = user.app_metadata?.organisation_id;
  const fallbackProfile: UserProfile = {
    id: user.id,
    organisation_id: typeof metadataOrganisationId === "string" ? metadataOrganisationId : null,
    email: user.email ?? "",
    full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : user.email ?? "Authenticated user",
    role: isRole(metadataRole) ? metadataRole : "client",
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at
  };

  return fallbackProfile;
}

export async function requireUserProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
