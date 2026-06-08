import type { Role, StaffRole } from "@/types/database";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  organisation_owner: "Organisation Owner",
  admin: "Admin",
  staff: "Staff",
  client: "Client"
};

export const staffRoleLabels: Record<StaffRole, string> = {
  organisation_owner: "Organisation Owner",
  admin: "Admin",
  staff: "Staff",
  therapist: "Therapist",
  receptionist: "Receptionist"
};

const roleRank: Record<Role, number> = {
  client: 10,
  staff: 20,
  admin: 30,
  organisation_owner: 40,
  super_admin: 50
};

export function canManage(role: Role, resource: "clients" | "services" | "appointments" | "staff" | "settings") {
  if (role === "super_admin") return true;
  if (resource === "staff" || resource === "settings") return roleRank[role] >= roleRank.admin;
  if (resource === "services") return roleRank[role] >= roleRank.admin;
  if (resource === "clients" || resource === "appointments") return roleRank[role] >= roleRank.staff;
  return false;
}
