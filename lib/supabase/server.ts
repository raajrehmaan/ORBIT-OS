import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function createSupabaseServerClient() {
  return createSupabaseAdminClient();
}
