"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCurrencyNumber } from "@/lib/utils";
import { fail, ok } from "@/lib/action-result";
import { validateAdminPin } from "@/lib/security/admin-pin";

const serviceSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  new_category: z.string().optional(),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().int().positive(),
  price: z.preprocess(normalizeCurrencyNumber, z.number().min(0)),
  color: z.enum(["teal", "blue", "violet", "amber", "rose", "slate"])
});

export async function createService(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) throw new Error("Not authorised");
  const values = serviceSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  const category = await resolveCategory(supabase, profile.organisation_id, values.category, values.new_category);

  const { error } = await supabase.from("services").insert({
    organisation_id: profile.organisation_id,
    name: values.name,
    category: category.name,
    category_id: category.id,
    description: values.description || null,
    duration_minutes: values.duration_minutes,
    price: values.price,
    color: values.color
  });

  if (error) throw new Error(`Service could not be created: ${error.message}`);

  revalidatePath("/services");
  revalidatePath("/calendar");
}

export async function updateService(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) throw new Error("Not authorised");
  const values = serviceSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  const category = await resolveCategory(supabase, profile.organisation_id, values.category, values.new_category);

  const { error } = await supabase.from("services").update({
    name: values.name,
    category: category.name,
    category_id: category.id,
    description: values.description || null,
    duration_minutes: values.duration_minutes,
    price: values.price,
    color: values.color
  }).eq("id", String(formData.get("id"))).eq("organisation_id", profile.organisation_id);

  if (error) throw new Error(`Service could not be updated: ${error.message}`);

  revalidatePath("/services");
  revalidatePath("/calendar");
}

export async function deleteService(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "service_archive");
  if (!pinCheck.valid) return fail(pinCheck.message);
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("services").update({
    archived_at: new Date().toISOString(),
    archived_by: profile.id
  }).eq("id", id).eq("organisation_id", profile.organisation_id);
  if (error) return fail(`Service could not be archived: ${error.message}`);
  await supabase.from("audit_logs").insert({ organisation_id: profile.organisation_id, user_id: profile.id, entity_type: "service", entity_id: id, action: "archived" });
  revalidatePath("/services");
  revalidatePath("/calendar");
  return ok("Service archived.");
}

export async function createServiceCategory(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) throw new Error("Not authorised");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) throw new Error("Category name is required");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("service_categories").insert({
    organisation_id: profile.organisation_id,
    name,
    description: description || null
  });
  if (error) throw new Error(`Category could not be created: ${error.message}`);
  revalidatePath("/services");
  revalidatePath("/calendar");
}

export async function updateServiceCategory(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) throw new Error("Not authorised");
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) throw new Error("Category name is required");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("service_categories").update({ name, description: description || null }).eq("id", id).eq("organisation_id", profile.organisation_id);
  if (error) throw new Error(`Category could not be updated: ${error.message}`);
  await supabase.from("services").update({ category: name }).eq("category_id", id).eq("organisation_id", profile.organisation_id);
  revalidatePath("/services");
  revalidatePath("/calendar");
}

export async function deleteServiceCategory(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "category_archive");
  if (!pinCheck.valid) return fail(pinCheck.message);
  const id = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("service_categories").update({
    archived_at: new Date().toISOString(),
    archived_by: profile.id
  }).eq("id", id).eq("organisation_id", profile.organisation_id);
  if (error) return fail(`Category could not be archived: ${error.message}`);
  await supabase.from("audit_logs").insert({ organisation_id: profile.organisation_id, user_id: profile.id, entity_type: "service_category", entity_id: id, action: "archived" });
  revalidatePath("/services");
  revalidatePath("/calendar");
  return ok("Category archived.");
}

export async function seedDefaultServices() {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "services")) throw new Error("Not authorised");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("seed_default_services", { target_organisation_id: profile.organisation_id });
  if (error) throw new Error(`Example services could not be loaded: ${error.message}`);
  revalidatePath("/services");
  revalidatePath("/calendar");
}

async function resolveCategory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organisationId: string,
  categoryValue: string,
  newCategoryValue?: string
) {
  const newCategory = newCategoryValue?.trim();
  const categoryId = categoryValue === "__new__" || categoryValue === "__uncategorised__" ? "" : categoryValue;
  if (newCategory) {
    const { data, error } = await supabase.from("service_categories").upsert({
      organisation_id: organisationId,
      name: newCategory
    }, { onConflict: "organisation_id,name" }).select("id, name").single();
    if (error) throw new Error(`Category could not be saved: ${error.message}`);
    return data;
  }

  if (categoryValue === "__uncategorised__" || !categoryId) {
    const { data, error } = await supabase.from("service_categories").upsert({
      organisation_id: organisationId,
      name: "Uncategorised",
      color: "slate"
    }, { onConflict: "organisation_id,name" }).select("id, name").single();
    if (error) throw new Error(`Category could not be saved: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase.from("service_categories").select("id, name").eq("id", categoryId).eq("organisation_id", organisationId).single();
  if (error || !data) throw new Error("Choose a valid service category");
  return data;
}
