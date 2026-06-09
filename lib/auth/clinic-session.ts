import { cookies } from "next/headers";
import { clinicSessionCookieName, clinicSessionMaxAgeSeconds, signClinicSession, verifyClinicSessionValue, type ClinicSession } from "@/lib/auth/session-token";

export { clinicSessionCookieName, verifyClinicSessionValue };
export type { ClinicSession };

export async function createClinicSessionCookie(session: Omit<ClinicSession, "expiresAt">) {
  const expiresAt = Math.floor(Date.now() / 1000) + clinicSessionMaxAgeSeconds;
  const value = await signClinicSession({ ...session, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(clinicSessionCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: clinicSessionMaxAgeSeconds
  });
}

export async function clearClinicSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(clinicSessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getClinicSessionFromCookies() {
  const cookieStore = await cookies();
  return verifyClinicSessionValue(cookieStore.get(clinicSessionCookieName)?.value ?? "");
}
