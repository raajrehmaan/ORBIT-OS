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
  void action;
  const pin = String(pinValue ?? "").trim();
  if (!profile.organisation_id) return { valid: false, message: "Organisation is not available." };
  if (!pin) return { valid: false, message: "Admin PIN is required." };

  const supabase = await createSupabaseServerClient();
  const { settings, error } = await loadSecuritySettings(supabase, profile.organisation_id);

  if (error) {
    return { valid: false, message: `Security settings could not be loaded: ${error.message ?? "unknown error"}` };
  }

  if (!settings?.admin_pin_hash) {
    return { valid: false, message: "Admin PIN is not configured. Set it in Settings > Security Settings." };
  }

  const pinValid = verifyAdminPin(pin, settings.admin_pin_hash);
  if (pinValid) {
    return { valid: true, message: "PIN verified." };
  }

  const recoveryResult = verifyRecoveryCode(pin, settings.recovery_code_hashes);
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
  const [algorithm, iterationText, salt, expectedHash] = storedHash.split("$");
  if (algorithm !== `pbkdf2_${DIGEST}` || !iterationText || !salt || !expectedHash) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 10000) return false;
  const actual = pbkdf2Sync(normalizeSecret(pin), salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isSupportedAdminPinHash(storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, iterationText, salt, expectedHash] = storedHash.split("$");
  const iterations = Number(iterationText);
  return algorithm === `pbkdf2_${DIGEST}`
    && Number.isInteger(iterations)
    && iterations >= 10000
    && Boolean(salt)
    && /^[a-f0-9]+$/i.test(expectedHash ?? "");
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

async function loadSecuritySettings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organisationId: string
) {
  const fullResult = await supabase
    .from("organisation_security_settings")
    .select("admin_pin_hash, recovery_code_hashes")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (!isMissingColumnError(fullResult.error)) {
    return { settings: fullResult.data, error: fullResult.error };
  }

  const fallbackResult = await supabase
    .from("organisation_security_settings")
    .select("admin_pin_hash")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  return {
    settings: fallbackResult.data ? { ...fallbackResult.data, recovery_code_hashes: [] } : null,
    error: fallbackResult.error
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST204" || error?.message?.includes("recovery_code_hashes");
}
