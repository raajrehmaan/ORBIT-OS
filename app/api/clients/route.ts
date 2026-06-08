import { NextResponse } from "next/server";
import { z } from "zod";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const quickClientSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional()
});

export async function POST(request: Request) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "clients")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const values = quickClientSchema.parse(await request.json());
  const supabase = await createSupabaseServerClient();

  if (values.email) {
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("organisation_id", profile.organisation_id)
      .eq("email", values.email)
      .maybeSingle();

    if (existingClient) {
      return NextResponse.json({ client: { id: existingClient.id, name: existingClient.full_name } });
    }
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organisation_id: profile.organisation_id,
      full_name: values.full_name,
      email: values.email || null,
      phone: values.phone || null
    })
    .select("id, full_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ client: { id: data.id, name: data.full_name } });
}
