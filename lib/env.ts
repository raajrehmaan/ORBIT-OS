const requiredEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serverSupabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

export function getPublicEnv() {
  const supabaseUrl = normalizeSupabaseUrl(requiredEnv.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = normalizePublicSupabaseKey(requiredEnv.supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { supabaseUrl, supabaseAnonKey };
}

export function getAdminEnv() {
  const supabaseUrl = normalizeSupabaseUrl(requiredEnv.serverSupabaseUrl || requiredEnv.supabaseUrl, "SUPABASE_URL");
  const supabaseServiceRoleKey = normalizeServiceRoleKey(requiredEnv.supabaseServiceRoleKey, "SUPABASE_SERVICE_ROLE_KEY");

  return { supabaseUrl, supabaseServiceRoleKey };
}

export function getSupabaseEnvDiagnostics() {
  const publicUrl = safeUrl(requiredEnv.supabaseUrl);
  const serverUrl = safeUrl(requiredEnv.serverSupabaseUrl);

  return {
    NEXT_PUBLIC_SUPABASE_URL: describeUrl(requiredEnv.supabaseUrl),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: describePublicSecret(requiredEnv.supabaseAnonKey),
    SUPABASE_URL: describeUrl(requiredEnv.serverSupabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: describeServiceRoleSecret(requiredEnv.supabaseServiceRoleKey),
    urlHostsMatch: Boolean(publicUrl?.hostname && (!serverUrl?.hostname || publicUrl.hostname === serverUrl.hostname))
  };
}

function normalizeSupabaseUrl(value: string | undefined, name: string) {
  const url = safeUrl(value);
  if (!url) throw new Error(`Missing or invalid ${name}. Expected a Supabase project URL.`);
  if (url.protocol !== "https:") throw new Error(`Invalid ${name}. Supabase URL must use https.`);
  if (!url.hostname.endsWith(".supabase.co")) throw new Error(`Invalid ${name}. Host must end with .supabase.co.`);
  return url.toString().replace(/\/$/, "");
}

function normalizePublicSupabaseKey(value: string | undefined, name: string) {
  const token = value?.trim();
  if (!token) throw new Error(`Missing ${name}.`);
  if (token.length < 32) throw new Error(`Invalid ${name}. Key is too short.`);
  return token;
}

function normalizeServiceRoleKey(value: string | undefined, name: string) {
  const token = value?.trim();
  if (!token) throw new Error(`Missing ${name}.`);
  if (token.length < 32) throw new Error(`Invalid ${name}. Key is too short.`);
  if (!isServiceRoleKeyShape(token)) {
    throw new Error(`Invalid ${name}. Expected a Supabase sb_secret key or legacy JWT service role key.`);
  }
  return token;
}

function safeUrl(value: string | undefined) {
  try {
    return value ? new URL(value.trim()) : null;
  } catch {
    return null;
  }
}

function describeUrl(value: string | undefined) {
  const url = safeUrl(value);
  return {
    exists: Boolean(value),
    length: value?.length ?? 0,
    hostname: url?.hostname ?? null,
    valid: Boolean(url?.hostname && url.protocol === "https:" && url.hostname.endsWith(".supabase.co"))
  };
}

function describePublicSecret(value: string | undefined) {
  const token = value?.trim() ?? "";
  return {
    exists: Boolean(token),
    length: token.length,
    validShape: token.length >= 32,
    keyType: token.startsWith("sb_publishable_") ? "sb_publishable" : token.split(".").length === 3 ? "jwt" : token.length >= 32 ? "opaque" : "unknown"
  };
}

function describeServiceRoleSecret(value: string | undefined) {
  const token = value?.trim() ?? "";
  return {
    exists: Boolean(token),
    length: token.length,
    validShape: token.length >= 32 && isServiceRoleKeyShape(token),
    keyType: token.startsWith("sb_secret_") ? "sb_secret" : token.split(".").length === 3 ? "jwt" : "unknown"
  };
}

function isServiceRoleKeyShape(token: string) {
  return token.startsWith("sb_secret_") || token.split(".").length === 3;
}
