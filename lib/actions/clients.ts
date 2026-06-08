"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManage } from "@/lib/auth/permissions";
import { fail, ok } from "@/lib/action-result";
import { validateAdminPin } from "@/lib/security/admin-pin";

const clientSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional()
});

export async function createClient(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "clients")) throw new Error("Not authorised");
  const values = clientSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();

  await supabase.from("clients").insert({
    organisation_id: profile.organisation_id,
    full_name: values.full_name,
    email: values.email || null,
    phone: values.phone || null,
    notes: values.notes || null
  });

  revalidatePath("/clients");
}

export async function updateClient(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "clients")) throw new Error("Not authorised");
  const id = String(formData.get("id"));
  const values = clientSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();

  await supabase.from("clients").update({
    full_name: values.full_name,
    email: values.email || null,
    phone: values.phone || null,
    notes: values.notes || null
  }).eq("id", id).eq("organisation_id", profile.organisation_id);

  revalidatePath("/clients");
}

export async function deleteClient(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "clients")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "client_archive");
  if (!pinCheck.valid) return fail(pinCheck.message);
  const id = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clients").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("organisation_id", profile.organisation_id);
  if (error) return fail(`Client could not be archived: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "client",
    entity_id: id,
    action: "archived",
    metadata: { soft_delete: true }
  });
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return ok("Client archived.");
}
