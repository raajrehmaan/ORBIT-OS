import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"] & { role: Role };
type PinAction =
  | "client_archive"
  | "staff_delete"
  | "staff_role_change"
  | "appointment_cancel"
  | "appointment_reschedule"
  | "appointment_no_show"
  | "service_archive"
  | "category_archive"
  | "reset_demo_data"
  | "settings_update"
  | "financial_adjustment";

const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashAdminPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(normalizeSecret(pin), salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2_${DIGEST}$${ITERATIONS}$${salt}$${hash}`;
}

export function generateRecoveryCodes() {
  return Array.from({ length: 5 }, () => `${randomChunk()}-${randomChunk()}`.toUpperCase());
}

export function hashRecoveryCodes(codes: string[]) {
  return codes.map((code) => hashAdminPin(code));
}

export async function validateAdminPin(profile: UserProfile, pinValue: FormDataEntryValue | null, action: PinAction) {
  const pin = String(pinValue ?? "").trim();
  if (!profile.organisation_id) return { valid: false, message: "Organisation is not available." };
  if (!pin) return { valid: false, message: "Admin PIN is required." };

  const supabase = await createSupabaseServerClient();
  const rateLimited = await isRateLimited(supabase, profile.organisation_id, profile.id);
  if (rateLimited) return { valid: false, message: "Too many invalid PIN attempts. Try again in 10 minutes." };

  const { data: settings, error } = await supabase
    .from("organisation_security_settings")
    .select("admin_pin_hash, recovery_code_hashes")
    .eq("organisation_id", profile.organisation_id)
    .single();

  if (error || !settings?.admin_pin_hash) {
    await logPinAttempt(supabase, profile, action, false);
    return { valid: false, message: "Admin PIN is not configured. Set it in Settings > Security Settings." };
  }

  const pinValid = verifyAdminPin(pin, settings.admin_pin_hash);
  if (pinValid) {
    await logPinAttempt(supabase, profile, action, true);
    return { valid: true, message: "PIN verified." };
  }

  const recoveryResult = verifyRecoveryCode(pin, settings.recovery_code_hashes);
  if (recoveryResult.valid) {
    await supabase
      .from("organisation_security_settings")
      .update({ recovery_code_hashes: recoveryResult.remainingHashes })
      .eq("organisation_id", profile.organisation_id);
    await logPinAttempt(supabase, profile, action, true);
    return { valid: true, message: "Recovery code verified." };
  }

  await logPinAttempt(supabase, profile, action, false);
  return { valid: false, message: "Enter a valid admin PIN or recovery code." };
}

export function verifyAdminPin(pin: string, storedHash: string) {
  const [algorithm, iterationText, salt, expectedHash] = storedHash.split("$");
  if (algorithm !== `pbkdf2_${DIGEST}` || !iterationText || !salt || !expectedHash) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 10000) return false;
  const actual = pbkdf2Sync(normalizeSecret(pin), salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function verifyRecoveryCode(value: string, storedHashes: unknown) {
  const hashes = Array.isArray(storedHashes) ? storedHashes.filter((item): item is string => typeof item === "string") : [];
  const matchIndex = hashes.findIndex((hash) => verifyAdminPin(value, hash));
  if (matchIndex < 0) return { valid: false, remainingHashes: hashes };
  return { valid: true, remainingHashes: hashes.filter((_, index) => index !== matchIndex) };
}

function normalizeSecret(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function randomChunk() {
  return randomBytes(3).toString("hex");
}

async function isRateLimited(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organisationId: string,
  userId: string
) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("admin_pin_attempts")
    .select("success")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) return false;
  const recentFailures = (data ?? []).filter((attempt) => !attempt.success).length;
  return recentFailures >= 5;
}

async function logPinAttempt(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profile: UserProfile,
  action: PinAction,
  success: boolean
) {
  if (!profile.organisation_id) return;
  await supabase.from("admin_pin_attempts").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    action,
    success
  });
}
