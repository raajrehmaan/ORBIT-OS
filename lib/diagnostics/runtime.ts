const enabled = process.env.ORBIT_RUNTIME_DIAGNOSTICS === "true" || process.env.NODE_ENV === "production";

export function logRuntimeDiagnostic(event: string, details: Record<string, unknown> = {}) {
  if (!enabled) return;
  console.error(`[OrbitOS runtime] ${event}`, safeDetails(details));
}

export function envSnapshot() {
  return {
    vercel: Boolean(process.env.VERCEL),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    NEXT_PUBLIC_SUPABASE_URL: describeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_URL: describeUrl(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: describePublicSecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: describeServiceRoleSecret(process.env.SUPABASE_SERVICE_ROLE_KEY),
    AUTH_SESSION_SECRET: describeSecret(process.env.AUTH_SESSION_SECRET, false)
  };
}

export function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 3).join("\n") };
  }
  return { message: String(error) };
}

function safeDetails(details: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(details, (_key, value) => {
    if (typeof value === "string" && value.length > 80) return `${value.slice(0, 80)}...`;
    return value;
  }));
}

function describeUrl(value: string | undefined) {
  try {
    const url = value ? new URL(value.trim()) : null;
    return {
      exists: Boolean(value),
      length: value?.length ?? 0,
      hostname: url?.hostname ?? null,
      valid: Boolean(url?.protocol === "https:" && url.hostname.endsWith(".supabase.co"))
    };
  } catch {
    return { exists: Boolean(value), length: value?.length ?? 0, hostname: null, valid: false };
  }
}

function describeSecret(value: string | undefined, jwtLike = true) {
  const token = value?.trim() ?? "";
  return {
    exists: Boolean(token),
    length: token.length,
    validShape: jwtLike ? token.split(".").length === 3 : token.length >= 32
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
    validShape: token.length >= 32 && (token.startsWith("sb_secret_") || token.split(".").length === 3),
    keyType: token.startsWith("sb_secret_") ? "sb_secret" : token.split(".").length === 3 ? "jwt" : "unknown"
  };
}
