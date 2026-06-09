import { createClient } from "@supabase/supabase-js";
import { envSnapshot, errorDetails, logRuntimeDiagnostic } from "@/lib/diagnostics/runtime";
import { getAdminEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  let env: ReturnType<typeof getAdminEnv>;
  try {
    env = getAdminEnv();
    logRuntimeDiagnostic("supabase_admin_env_ok", envSnapshot());
  } catch (error) {
    logRuntimeDiagnostic("supabase_admin_env_failed", { ...envSnapshot(), error: errorDetails(error) });
    throw error;
  }

  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
