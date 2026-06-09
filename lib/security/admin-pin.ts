import bcrypt from "bcryptjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/types/database";

type UserProfile = Database["public"]["Tables"]["users"]["Row"] & { role: Role };
type SecuritySettings = {
  admin_pin_hash?: string | null;
  pin_hash?: string | null;
  development_pin?: string | null;
  recovery_code_hashes?: unknown;
};
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

const BCRYPT_ROUNDS = 10;

export async function hashAdminPin(pin: string) {
  return bcrypt.hash(normalizeSecret(pin), BCRYPT_ROUNDS);
}

export function generateRecoveryCodes() {
  return Array.from({ length: 5 }, () => `${randomChunk()}-${randomChunk()}`.toUpperCase());
}

export async function hashRecoveryCodes(codes: string[]) {
  return Promise.all(codes.map((code) => hashAdminPin(code)));
}

export async function validateAdminPin(profile: UserProfile, pinValue: FormDataEntryValue | null, action: PinAction) {
  void action;
  const pin = String(pinValue ?? "").trim();
  if (!profile.organisation_id) return { valid: false, message: "Organisation is not available." };
  if (!pin) return { valid: false, message: "Admin PIN is required." };

  const supabase = await createSupabaseServerClient();
  const { settings, error } = await loadSecuritySettings(supabase, profile.organisation_id);

  if (error) {
    return { valid: false, message: `Security settings could not be loaded: ${error.message ?? "unknown error"}` };
  }

  const adminPinHash = firstPinHash(settings);
  if (!adminPinHash) {
    return { valid: false, message: "Admin PIN is not configured. Set it in Settings > Security Settings." };
  }

  const pinValid = await verifyAdminPin(pin, adminPinHash);
  if (pinValid) {
    return { valid: true, message: "PIN verified." };
  }

  const recoveryResult = await verifyRecoveryCode(pin, settings?.recovery_code_hashes);
  if (recoveryResult.valid) {
    await supabase
        .from("organisation_security_settings")
        .update({ recovery_code_hashes: recoveryResult.remainingHashes })
        .eq("organisation_id", profile.organisation_id);
    return { valid: true, message: "Recovery code verified." };
  }

  return { valid: false, message: "Enter a valid admin PIN or recovery code." };
}

export function verifyAdminPin(pin: string, storedHash: string) {
  if (!storedHash.startsWith("$2")) return false;
  return bcrypt.compare(normalizeSecret(pin), storedHash);
}

export function isSupportedAdminPinHash(storedHash: string | null | undefined) {
  if (!storedHash) return false;
  return storedHash.startsWith("$2");
}

async function verifyRecoveryCode(value: string, storedHashes: unknown) {
  const hashes = Array.isArray(storedHashes) ? storedHashes.filter((item): item is string => typeof item === "string") : [];
  const results = await Promise.all(hashes.map((hash) => verifyAdminPin(value, hash)));
  const matchIndex = results.findIndex(Boolean);
  if (matchIndex < 0) return { valid: false, remainingHashes: hashes };
  return { valid: true, remainingHashes: hashes.filter((_, index) => index !== matchIndex) };
}

function normalizeSecret(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function randomChunk() {
  return Math.random().toString(16).slice(2, 8);
}

async function loadSecuritySettings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organisationId: string
) {
  const fullResult = await supabase
    .from("organisation_security_settings")
    .select("admin_pin_hash, pin_hash, development_pin, recovery_code_hashes")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (!isMissingColumnError(fullResult.error)) {
    return { settings: fullResult.data as SecuritySettings | null, error: fullResult.error };
  }

  const fallbackResult = await supabase
    .from("organisation_security_settings")
    .select("admin_pin_hash")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  return {
    settings: fallbackResult.data ? { ...fallbackResult.data, recovery_code_hashes: [] } as SecuritySettings : null,
    error: fallbackResult.error
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST204"
    || error?.message?.includes("recovery_code_hashes")
    || error?.message?.includes("pin_hash")
    || error?.message?.includes("development_pin");
}

function firstPinHash(settings: unknown) {
  if (!settings || typeof settings !== "object") return "";
  const values = settings as { admin_pin_hash?: unknown; pin_hash?: unknown; development_pin?: unknown };
  for (const value of [values.admin_pin_hash, values.pin_hash, values.development_pin]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}
