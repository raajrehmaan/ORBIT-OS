"use server";

import { revalidatePath } from "next/cache";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/action-result";
import { generateRecoveryCodes, hashAdminPin, hashRecoveryCodes, isSupportedAdminPinHash, validateAdminPin } from "@/lib/security/admin-pin";

export async function updateStatusColours(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "settings")) throw new Error("Not authorised");
  const supabase = await createSupabaseServerClient();
  const rows = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("appointment_colour:"))
    .map(([key, value]) => {
      const [, status] = key.split(":");
      const backgroundColor = String(value);
      return {
        organisation_id: profile.organisation_id!,
        status,
        background_color: backgroundColor,
        text_color: backgroundColor
      };
    });

  if (rows.length) {
    const { error } = await supabase
      .from("appointment_status_colours")
      .upsert(rows, { onConflict: "organisation_id,status" });
    if (error) throw new Error(`Status colours could not be saved: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updateSecuritySettings(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "settings")) return fail("Not authorised.");

  const newPin = String(formData.get("new_pin") ?? "").trim();
  const confirmPin = String(formData.get("confirm_pin") ?? "").trim();
  const recoveryEmail = String(formData.get("recovery_email") ?? "").trim();
  const shouldGenerateRecoveryCodes = formData.get("generate_recovery_codes") === "on";
  const recoveryCodes = shouldGenerateRecoveryCodes ? generateRecoveryCodes() : [];
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("organisation_security_settings")
    .select("admin_pin_hash")
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  if (newPin || confirmPin) {
    if (isSupportedAdminPinHash(existing?.admin_pin_hash)) {
      const pinCheck = await validateAdminPin(profile, formData.get("current_pin"), "settings_update");
      if (!pinCheck.valid) return fail(pinCheck.message);
    }
    if (!/^\d{4,12}$/.test(newPin)) return fail("New admin PIN must be 4 to 12 digits.");
    if (newPin !== confirmPin) return fail("New PIN and confirmation do not match.");
  }

  const payload = {
    organisation_id: profile.organisation_id,
    recovery_email: recoveryEmail || null,
    two_step_enabled: formData.get("two_step_enabled") === "on",
    owner_password_verification_enabled: formData.get("owner_password_verification_enabled") === "on",
    protect_client_archive: formData.get("protect_client_archive") === "on",
    protect_staff_changes: formData.get("protect_staff_changes") === "on",
    protect_appointments: formData.get("protect_appointments") === "on",
    protect_services: formData.get("protect_services") === "on",
    protect_financials: formData.get("protect_financials") === "on",
    protect_settings: formData.get("protect_settings") === "on",
    ...(newPin ? { admin_pin_hash: await hashAdminPin(newPin), pin_updated_at: new Date().toISOString() } : {}),
    ...(shouldGenerateRecoveryCodes ? { recovery_code_hashes: await hashRecoveryCodes(recoveryCodes) } : {})
  };

  let { error } = await supabase
    .from("organisation_security_settings")
    .upsert(payload, { onConflict: "organisation_id" });
  if (isMissingColumnError(error, "owner_password_verification_enabled")) {
    const fallbackPayload = omitKeys(payload, ["owner_password_verification_enabled"]);
    const retry = await supabase.from("organisation_security_settings").upsert(fallbackPayload, { onConflict: "organisation_id" });
    error = retry.error;
  }
  if (isMissingColumnError(error, "recovery_code_hashes")) {
    const fallbackPayload = omitKeys(payload, ["recovery_code_hashes", "owner_password_verification_enabled"]);
    const retry = await supabase.from("organisation_security_settings").upsert(fallbackPayload, { onConflict: "organisation_id" });
    error = retry.error;
  }

  if (error) return fail(`Security settings could not be saved: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "security_settings",
    entity_id: profile.organisation_id,
    action: newPin ? "admin_pin_changed" : "security_settings_updated",
    metadata: { two_step_enabled: payload.two_step_enabled, generated_recovery_codes: shouldGenerateRecoveryCodes }
  });

  revalidatePath("/settings");
  return ok(
    shouldGenerateRecoveryCodes
      ? "Security settings saved. Store the new recovery codes now; they will not be shown again."
      : newPin
        ? "Admin PIN changed."
        : "Security settings saved.",
    recoveryCodes.length ? { recoveryCodes } : undefined
  );
}

export async function resetDemoTestData(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "settings")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "reset_demo_data");
  if (!pinCheck.valid) return fail(pinCheck.message);

  const supabase = await createSupabaseServerClient();
  const orgId = profile.organisation_id;
  const { data: testClients } = await supabase
    .from("clients")
    .select("id")
    .eq("organisation_id", orgId)
    .or("full_name.ilike.%test%,full_name.ilike.%demo%,full_name.ilike.%e2e%,email.ilike.%example.com%");
  const testClientIds = (testClients ?? []).map((client) => client.id);

  for (const table of ["appointment_staff", "treatment_sessions", "treatment_plans", "payment_logs", "payments", "treatment_records", "appointment_history", "appointments"]) {
    const error = await deleteOrganisationRows(supabase, table, orgId);
    if (error) return fail(`Demo/test data could not be reset: ${error.message}`);
  }

  if (testClientIds.length) {
    const archivedAt = new Date().toISOString();
    let { error } = await supabase.from("clients").update({ archived_at: archivedAt, archived_by: profile.id }).in("id", testClientIds).eq("organisation_id", orgId);
    if (isMissingColumnError(error, "archived_by")) {
      const retry = await supabase.from("clients").update({ archived_at: archivedAt }).in("id", testClientIds).eq("organisation_id", orgId);
      error = retry.error;
    }
    if (error) return fail(`Test clients could not be archived: ${error.message}`);
  }

  await supabase.from("audit_logs").insert({
    organisation_id: orgId,
    user_id: profile.id,
    entity_type: "organisation",
    entity_id: orgId,
    action: "reset_demo_test_data",
    metadata: { archived_test_clients: testClientIds.length }
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/clients");
  return ok(`Demo/test data reset. Archived ${testClientIds.length} test client${testClientIds.length === 1 ? "" : "s"}.`);
}

function isMissingColumnError(error: { code?: string; message?: string } | null, column: string) {
  return error?.code === "PGRST204" || error?.message?.includes(`'${column}' column`) || error?.message?.includes(column);
}

function omitKeys<T extends Record<string, unknown>, K extends keyof T>(value: T, keys: K[]) {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

async function deleteOrganisationRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  organisationId: string
) {
  const { error } = await supabase.from(table).delete().eq("organisation_id", organisationId);
  if (!error || isMissingTableError(error)) return null;
  return error;
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || error?.message?.includes("Could not find the table")
    || error?.message?.includes("does not exist");
}
