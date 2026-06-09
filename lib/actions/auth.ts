"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { envSnapshot, errorDetails, logRuntimeDiagnostic } from "@/lib/diagnostics/runtime";
import { clearClinicSessionCookie, createClinicSessionCookie } from "@/lib/auth/clinic-session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import type { Role } from "@/types/database";

export async function signInWithClinicPassword(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  logRuntimeDiagnostic("login_action_started", { usernamePresent: Boolean(username), ...envSnapshot() });
  const supabase = await createSupabaseServerClient();

  const { data: authUser, error } = await supabase
    .from("auth_users")
    .select("id, username, password_hash, role, organisation_id, active, users(full_name)")
    .eq("username", username)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    logRuntimeDiagnostic("login_auth_users_query_failed", { usernamePresent: Boolean(username), error: errorDetails(error) });
  } else {
    logRuntimeDiagnostic("login_auth_users_query_ok", {
      usernamePresent: Boolean(username),
      found: Boolean(authUser),
      hasOrganisationId: Boolean(authUser?.organisation_id),
      role: authUser?.role ?? null
    });
  }

  if (error || !authUser || !await verifyPassword(password, authUser.password_hash)) {
    redirect(`/login?error=${encodeURIComponent("Invalid username or password.")}`);
  }

  const role = toAppRole(authUser.role);
  logRuntimeDiagnostic("login_create_session_cookie_started", { userId: authUser.id, organisationId: authUser.organisation_id, role });
  await createClinicSessionCookie({
    userId: authUser.id,
    organisationId: authUser.organisation_id,
    username: authUser.username,
    fullName: extractFullName(authUser.users) || authUser.username,
    role
  });
  logRuntimeDiagnostic("login_create_session_cookie_ok", { userId: authUser.id, organisationId: authUser.organisation_id, role });

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signOut() {
  await clearClinicSessionCookie();
  redirect("/login");
}

export async function createClinicUser(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "staff")) throw new Error("Not authorised");

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = normalizeClinicRole(String(formData.get("role") ?? "staff"));

  if (!username) throw new Error("Username is required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (!fullName) throw new Error("Full name is required");

  const supabase = await createSupabaseServerClient();
  const userId = randomUUID();
  const appRole = toAppRole(role);
  const usernameEmail = `${username}@clinic.local`;
  const passwordHash = await hashPassword(password);

  const { error: profileError } = await supabase.from("users").insert({
    id: userId,
    organisation_id: profile.organisation_id,
    email: usernameEmail,
    full_name: fullName,
    role: appRole
  });
  if (profileError) throw new Error(`User profile could not be created: ${profileError.message}`);

  const { error: authError } = await supabase.from("auth_users").insert({
    id: userId,
    organisation_id: profile.organisation_id,
    username,
    password_hash: passwordHash,
    role,
    active: true
  });
  if (authError) throw new Error(`Login user could not be created: ${authError.message}`);

  redirect("/staff");
}

export async function changeOwnPassword(formData: FormData) {
  const profile = await requireUserProfile();
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");

  const supabase = await createSupabaseServerClient();
  const { data: currentAuthUser, error: usernameError } = await supabase.from("auth_users").select("username, password_hash").eq("id", profile.id).maybeSingle();
  if (usernameError || !currentAuthUser?.username) throw new Error("Current login user could not be found");
  if (!await verifyPassword(currentPassword, currentAuthUser.password_hash)) throw new Error("Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase.from("auth_users").update({ password_hash: passwordHash }).eq("id", profile.id);
  if (updateError) throw new Error(`Password could not be changed: ${updateError.message}`);

  redirect("/settings");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeClinicRole(value: string) {
  if (value === "admin" || value === "receptionist" || value === "staff") return value;
  return "staff";
}

function toAppRole(value: string): Role {
  if (value === "admin") return "admin";
  return "staff";
}

function extractFullName(value: unknown) {
  if (Array.isArray(value)) return typeof value[0]?.full_name === "string" ? value[0].full_name : "";
  if (value && typeof value === "object" && "full_name" in value) {
    const fullName = (value as { full_name?: unknown }).full_name;
    return typeof fullName === "string" ? fullName : "";
  }
  return "";
}
