import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/session";
import { getTenantData } from "@/lib/db/queries";

export async function GET() {
  const profile = await requireUserProfile();
  if (!profile.organisation_id) return NextResponse.json({ appointments: [] });

  const data = await getTenantData(profile.organisation_id);
  return NextResponse.json({ appointments: data.appointments });
}
