"use server";

import { revalidatePath } from "next/cache";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAdminPin } from "@/lib/security/admin-pin";
import { fail, ok } from "@/lib/action-result";

const logoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function updateOrganisationSettings(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "organisation")) return fail("Not authorised.");

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  if (!name) return fail("Organisation name is required.");
  if (!slug) return fail("Organisation slug is required.");

  const supabase = await createSupabaseServerClient();
  const payload = {
    name,
    slug,
    business_info: {
      clinic_email: String(formData.get("clinic_email") ?? "").trim(),
      clinic_phone: String(formData.get("clinic_phone") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim()
    },
    brand_primary_color: String(formData.get("brand_primary_color") ?? "#0f766e"),
    brand_secondary_color: String(formData.get("brand_secondary_color") ?? "#334155")
  };

  const { error } = await supabase.from("organisations").update(payload).eq("id", profile.organisation_id);
  if (error) return fail(`Organisation settings could not be saved: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "organisation",
    entity_id: profile.organisation_id,
    action: "updated",
    metadata: { fields: Object.keys(payload) }
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return ok("Organisation settings saved.");
}

export async function uploadOrganisationLogo(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "organisation")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "settings_update");
  if (!pinCheck.valid) return fail(pinCheck.message);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a logo file.");
  if (!logoTypes.has(file.type)) return fail("Logo must be PNG, JPG, or WebP.");

  const supabase = await createSupabaseServerClient();
  const extension = extensionFor(file.type);
  const path = `${profile.organisation_id}/branding/logo/logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("organisation-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return fail(`Logo could not be uploaded: ${uploadError.message}`);

  const { error } = await supabase.from("organisations").update({ logo_path: path }).eq("id", profile.organisation_id);
  if (error) return fail(`Logo path could not be saved: ${error.message}`);
  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "organisation",
    entity_id: profile.organisation_id,
    action: "logo_uploaded",
    metadata: { path }
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return ok("Organisation logo uploaded.");
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extensionFor(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}
