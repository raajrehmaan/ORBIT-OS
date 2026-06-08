const requiredEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

export function getPublicEnv() {
  if (!requiredEnv.supabaseUrl || !requiredEnv.supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables. Copy .env.example to .env.local.");
  }

  return requiredEnv as { supabaseUrl: string; supabaseAnonKey: string };
}
