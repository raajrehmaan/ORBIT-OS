import type { Role, StaffRole } from "@/types/database";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  organisation_owner: "Organisation Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  client: "Client"
};

export const staffRoleLabels: Record<StaffRole, string> = {
  organisation_owner: "Organisation Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  therapist: "Therapist",
  receptionist: "Receptionist"
};

const roleRank: Record<Role, number> = {
  client: 10,
  staff: 20,
  manager: 25,
  admin: 30,
  organisation_owner: 40,
  super_admin: 50
};

export function canManage(role: Role, resource: "clients" | "services" | "appointments" | "staff" | "settings" | "security" | "organisation" | "audit_logs" | "photos") {
  if (role === "super_admin" || role === "organisation_owner") return true;
  if (resource === "staff" || resource === "settings") return roleRank[role] >= roleRank.admin;
  if (resource === "security" || resource === "organisation" || resource === "audit_logs") return roleRank[role] >= roleRank.admin;
  if (resource === "services") return roleRank[role] >= roleRank.admin;
  if (resource === "photos") return roleRank[role] >= roleRank.staff;
  if (resource === "clients" || resource === "appointments") return roleRank[role] >= roleRank.staff;
  return false;
}
