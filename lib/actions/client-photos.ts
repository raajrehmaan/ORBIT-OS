"use server";

import { revalidatePath } from "next/cache";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAdminPin } from "@/lib/security/admin-pin";
import { fail, ok } from "@/lib/action-result";
import type { Database } from "@/types/database";

type PhotoCategory = Database["public"]["Tables"]["client_photos"]["Row"]["category"];

const photoTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const photoCategories = new Set(["consultation", "before", "after", "progress", "consent", "treatment-area", "followup"]);

export async function uploadClientPhoto(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "photos")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "client_archive");
  if (!pinCheck.valid) return fail(pinCheck.message);

  const clientId = String(formData.get("client_id") ?? "");
  const category = String(formData.get("category") ?? "progress");
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("photo");
  if (!clientId) return fail("Client is required.");
  if (!photoCategories.has(category)) return fail("Choose a valid photo category.");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo.");
  if (!photoTypes.has(file.type)) return fail("Photo must be PNG, JPG, WebP, HEIC, or HEIF.");

  const supabase = await createSupabaseServerClient();
  const clientCheck = await supabase.from("clients").select("id").eq("id", clientId).eq("organisation_id", profile.organisation_id).maybeSingle();
  if (clientCheck.error || !clientCheck.data) return fail("Client could not be found.");

  const path = `${profile.organisation_id}/clients/${clientId}/${folderForCategory(category)}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("organisation-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail(`Photo could not be uploaded: ${uploadError.message}`);

  const { error } = await supabase.from("client_photos").insert({
    organisation_id: profile.organisation_id,
    client_id: clientId,
    category: category as PhotoCategory,
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type,
    file_size: file.size,
    notes: notes || null,
    created_by: profile.id
  });
  if (error) return fail(`Photo record could not be saved: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "client_photo",
    entity_id: clientId,
    action: "uploaded",
    metadata: { category, path }
  });
  revalidatePath(`/clients/${clientId}`);
  return ok("Photo uploaded.");
}

export async function archiveClientPhoto(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "photos")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "client_archive");
  if (!pinCheck.valid) return fail(pinCheck.message);

  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("client_photos").update({
    archived_at: new Date().toISOString(),
    archived_by: profile.id
  }).eq("id", id).eq("organisation_id", profile.organisation_id);
  if (error) return fail(`Photo could not be archived: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "client_photo",
    entity_id: id,
    action: "archived"
  });
  if (clientId) revalidatePath(`/clients/${clientId}`);
  return ok("Photo archived.");
}

function folderForCategory(category: string) {
  if (category === "before" || category === "after") return "before-after";
  if (category === "consultation" || category === "consent") return "consultations";
  return "timeline";
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "photo";
}
