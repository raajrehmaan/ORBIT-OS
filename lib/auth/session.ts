import type { Database } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

const demoProfile = {
  id: "demo-user",
  organisation_id: null,
  email: "demo@orbit.local",
  full_name: "Raaj",
  role: "super_admin",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
} as UserProfile;

export async function getCurrentUserProfile() {
  return demoProfile;
}

export async function requireUserProfile() {
  return demoProfile;
}
