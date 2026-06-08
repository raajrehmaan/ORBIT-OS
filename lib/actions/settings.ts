"use server";

import { revalidatePath } from "next/cache";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/action-result";
import { generateRecoveryCodes, hashAdminPin, hashRecoveryCodes, validateAdminPin } from "@/lib/security/admin-pin";

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
    .single();

  if (newPin || confirmPin) {
    if (existing?.admin_pin_hash) {
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
    ...(newPin ? { admin_pin_hash: hashAdminPin(newPin), pin_updated_at: new Date().toISOString() } : {}),
    ...(shouldGenerateRecoveryCodes ? { recovery_code_hashes: hashRecoveryCodes(recoveryCodes) } : {})
  };

  const { error } = await supabase
    .from("organisation_security_settings")
    .upsert(payload, { onConflict: "organisation_id" });

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

  await supabase.from("appointment_staff").delete().eq("organisation_id", orgId);
  await supabase.from("treatment_sessions").delete().eq("organisation_id", orgId);
  await supabase.from("treatment_plans").delete().eq("organisation_id", orgId);
  await supabase.from("payment_logs").delete().eq("organisation_id", orgId);
  await supabase.from("payments").delete().eq("organisation_id", orgId);
  await supabase.from("treatment_records").delete().eq("organisation_id", orgId);
  await supabase.from("appointment_history").delete().eq("organisation_id", orgId);
  await supabase.from("appointments").delete().eq("organisation_id", orgId);

  if (testClientIds.length) {
    await supabase.from("clients").update({ archived_at: new Date().toISOString(), archived_by: profile.id }).in("id", testClientIds).eq("organisation_id", orgId);
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
