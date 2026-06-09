import type { Role } from "@/types/database";

export const clinicSessionCookieName = "orbitos_clinic_session";
export const clinicSessionMaxAgeSeconds = 60 * 60 * 12;

export type ClinicSession = {
  userId: string;
  organisationId: string;
  username: string;
  fullName: string;
  role: Role;
  expiresAt: number;
};

export async function signClinicSession(session: ClinicSession) {
  const payload = base64UrlEncode(JSON.stringify(session));
  return `${payload}.${await signValue(payload)}`;
}

export async function verifyClinicSessionValue(value: string) {
  const [payloadPart, signaturePart] = value.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = await signValue(payloadPart);
  if (!constantTimeEqual(signaturePart, expectedSignature)) return null;

  const session = parsePayload(payloadPart);
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return session;
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function parsePayload(payloadPart: string): ClinicSession | null {
  try {
    const value = JSON.parse(base64UrlDecode(payloadPart));
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<ClinicSession>;
    if (!session.userId || !session.organisationId || !session.username || !session.fullName || !session.role || !session.expiresAt) return null;
    if (!["super_admin", "organisation_owner", "admin", "staff", "client"].includes(session.role)) return null;
    return session as ClinicSession;
  } catch {
    return null;
  }
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be at least 32 characters.");
  return secret;
}

function base64UrlEncode(value: string | Uint8Array) {
  const binary = typeof value === "string"
    ? String.fromCharCode(...new TextEncoder().encode(value))
    : String.fromCharCode(...value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}
