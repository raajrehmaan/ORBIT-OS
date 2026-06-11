import type { Database } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

const demoProfile = {
  id: "93869fec-3ee7-415b-8ffe-a145037c9e7f",
  organisation_id: "f28afbdd-c93b-4f3b-839a-17af2e00261b",
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
