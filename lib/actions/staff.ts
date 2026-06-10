"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/action-result";
import { validateAdminPin } from "@/lib/security/admin-pin";
import type { StaffRole } from "@/types/database";

const staffSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
  role: z.enum(["organisation_owner", "admin", "manager", "therapist", "receptionist", "staff"]),
  active: z.string().optional()
});

export async function createStaff(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "staff")) throw new Error("Not authorised");
  const values = staffSchema.parse(Object.fromEntries(formData));
  if (values.role === "organisation_owner") throw new Error("Organisation owner role cannot be created from staff management");
  const supabase = await createSupabaseServerClient();

  const staffPayload = {
    organisation_id: profile.organisation_id,
    full_name: values.full_name,
    email: values.email || null,
    phone: values.phone || null,
    notes: values.notes || null,
    role: values.role,
    active: values.active === "on"
  };

  let payload = staffPayload;
  let { error } = await supabase.from("staff").insert(payload);

  for (const column of ["notes", "role", "active"] as const) {
    if (!isMissingColumnError(error, column)) continue;
    payload = withoutColumn(payload, column);
    const retry = await supabase.from("staff").insert(payload);
    error = retry.error;
  }

  if (error) throw new Error(`Staff member could not be created: ${error.message}`);

  revalidatePath("/staff");
  revalidatePath("/calendar");
}

export async function updateStaff(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "staff")) return fail("Not authorised.");
  const values = staffSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id"));

  const { data: staffMember, error: lookupError } = await supabase
    .from("staff")
    .select("user_id, role")
    .eq("id", id)
    .eq("organisation_id", profile.organisation_id)
    .single();

  if (lookupError) return fail(`Staff member could not be found: ${lookupError.message}`);
  const currentRole = normalizeStaffRole(staffMember?.role);
  const nextRole = normalizeStaffRole(values.role);
  if (currentRole === "organisation_owner" || nextRole === "organisation_owner") {
    return fail("Organisation owner role is immutable.");
  }
  if (currentRole !== nextRole) {
    const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "staff_role_change");
    if (!pinCheck.valid) return fail(pinCheck.message);
  }

  const staffPayload = {
    full_name: values.full_name,
    email: values.email || null,
    phone: values.phone || null,
    notes: values.notes || null,
    role: nextRole,
    active: values.active === "on"
  };

  let payload = staffPayload;
  let { error } = await supabase.from("staff").update(payload).eq("id", id).eq("organisation_id", profile.organisation_id);

  for (const column of ["notes", "role", "active"] as const) {
    if (!isMissingColumnError(error, column)) continue;
    payload = withoutColumn(payload, column);
    const retry = await supabase.from("staff").update(payload).eq("id", id).eq("organisation_id", profile.organisation_id);
    error = retry.error;
  }

  if (error) return fail(`Staff member could not be updated: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "staff",
    entity_id: id,
    action: currentRole !== nextRole ? "role_changed" : "edited",
    metadata: { previous_role: currentRole, next_role: nextRole }
  });

  if (staffMember?.user_id) {
    const userUpdate = values.email
      ? { full_name: values.full_name, email: values.email }
      : { full_name: values.full_name };
    const { error: userError } = await supabase.from("users").update(userUpdate).eq("id", staffMember.user_id).eq("organisation_id", profile.organisation_id);
    if (userError) return fail(`Linked user could not be updated: ${userError.message}`);
  }

  revalidatePath("/staff");
  revalidatePath("/calendar");
  return ok("Staff member saved.");
}

function isMissingColumnError(error: { message?: string; code?: string } | null, column: string) {
  if (!error) return false;
  return error.code === "PGRST204" || error.message?.includes(`'${column}' column`);
}

function withoutColumn<T extends Record<string, unknown>, K extends keyof T>(payload: T, column: K) {
  const payloadWithoutColumn = { ...payload };
  delete payloadWithoutColumn[column];
  return payloadWithoutColumn;
}

function normalizeStaffRole(value: unknown): StaffRole {
  if (value === "reception") return "receptionist";
  if (value === "organisation_owner" || value === "admin" || value === "manager" || value === "therapist" || value === "receptionist" || value === "staff") return value;
  return "staff";
}

export async function deleteStaff(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "staff")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "staff_delete");
  if (!pinCheck.valid) return fail(pinCheck.message);
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id"));
  const payload = {
    active: false,
    deleted_at: new Date().toISOString(),
    deleted_by: profile.id
  };
  let softDeletePayload = payload;
  let { error } = await supabase.from("staff").update(softDeletePayload).eq("id", id).eq("organisation_id", profile.organisation_id);

  for (const column of ["deleted_at", "deleted_by", "active"] as const) {
    if (!isMissingColumnError(error, column)) continue;
    softDeletePayload = withoutColumn(softDeletePayload, column);
    const retry = await supabase.from("staff").update(softDeletePayload).eq("id", id).eq("organisation_id", profile.organisation_id);
    error = retry.error;
  }

  if (error) return fail(`Staff member could not be removed: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "staff",
    entity_id: id,
    action: "deleted",
    metadata: { soft_delete: true }
  });
  revalidatePath("/staff");
  revalidatePath("/calendar");
  return ok("Staff member removed.");
}
