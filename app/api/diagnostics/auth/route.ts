import { NextResponse } from "next/server";
import { getSupabaseEnvDiagnostics } from "@/lib/env";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.AUTH_DIAGNOSTICS_ENABLED !== "true") {
    return NextResponse.json({ error: "Auth diagnostics disabled." }, { status: 404 });
  }

  return NextResponse.json({
    supabase: getSupabaseEnvDiagnostics(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercel: Boolean(process.env.VERCEL),
      vercelEnv: process.env.VERCEL_ENV ?? null
    }
  });
}
