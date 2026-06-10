import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StaffEditForm } from "@/components/staff/staff-edit-form";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClinicUser } from "@/lib/actions/auth";
import { createStaff, deleteStaff, updateStaff } from "@/lib/actions/staff";
import { staffRoleLabels } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { getTenantData } from "@/lib/db/queries";
import { safeArray } from "@/lib/utils";
import type { StaffRole } from "@/types/database";

const editableStaffRoles: StaffRole[] = ["staff", "manager", "therapist", "receptionist", "admin"];

export default async function StaffPage() {
  const profile = await requireUserProfile();
  let data: Awaited<ReturnType<typeof getTenantData>>;
  if (profile.organisation_id) {
    data = await getTenantData(profile.organisation_id);
  } else {
    data = { clients: [], staff: [], services: [], serviceCategories: [], appointments: [], colours: [] };
  }
  const { staff } = data;
  const staffMembers = safeArray(staff);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="text-sm text-muted-foreground">Staff records are tenant-scoped and managed by admins.</p>
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Create login user</h2></CardHeader>
        <CardContent>
          <form action={createClinicUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_auto] xl:items-end">
            <Field label="Full name"><Input name="full_name" required /></Field>
            <Field label="Username"><Input name="username" autoComplete="off" required /></Field>
            <Field label="Password"><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
            <Field label="Role">
              <Select name="role" defaultValue="staff">
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="receptionist">Receptionist</option>
              </Select>
            </Field>
            <SubmitButton className="md:w-fit" pendingLabel="Creating...">Create login</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Add staff</h2></CardHeader>
        <CardContent>
          <form action={createStaff} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] xl:items-end">
            <Field label="Full name"><Input name="full_name" required /></Field>
            <Field label="Email"><Input name="email" type="email" placeholder="Optional" /></Field>
            <Field label="Phone"><Input name="phone" /></Field>
            <RoleSelect defaultValue="staff" />
            <Field label="Notes"><Textarea name="notes" placeholder="Optional" /></Field>
            <label className="flex h-10 items-center gap-2 text-sm font-medium"><input name="active" type="checkbox" defaultChecked /> Active</label>
            <SubmitButton className="md:w-fit" pendingLabel="Adding...">Add staff</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <section className="grid gap-4">
        {staffMembers.map((member) => (
          <Card key={member.id}>
            <CardContent className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{member.full_name}</p>
                  <p className="text-sm text-muted-foreground">{member.email ?? "No email"}</p>
                  {member.phone ? <p className="text-sm text-muted-foreground">{member.phone}</p> : null}
                  {member.notes ? <p className="mt-2 text-sm text-muted-foreground">{member.notes}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border px-2 py-1 text-xs font-medium">{staffRoleLabels[member.role] ?? "Staff"}</span>
                  <span className="rounded-md border px-2 py-1 text-xs">{member.active ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <details className="group rounded-md border bg-background/50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground transition group-open:border-b hover:text-foreground">
                  Manage staff member
                </summary>
                <div className="grid gap-4 p-3">
                  <StaffEditForm
                    action={updateStaff}
                    id={member.id}
                    fullName={member.full_name}
                    email={member.email}
                    phone={member.phone}
                    notes={member.notes}
                    role={member.role}
                    active={member.active}
                  />
                  <ConfirmDeleteForm
                    action={deleteStaff}
                    id={member.id}
                    label="Remove staff"
                    message={`Remove ${member.full_name} from staff?`}
                    requirePin
                  />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
        {!staffMembers.length ? <EmptyState title="No staff records yet" description="Add clinic staff such as therapists, reception, managers, or admins." /> : null}
      </section>
    </div>
  );
}

function RoleSelect({ defaultValue, disabled = false }: { defaultValue: StaffRole; disabled?: boolean }) {
  const roles = defaultValue === "organisation_owner" ? ["organisation_owner" as const] : editableStaffRoles;
  return (
    <Field label="Role">
      <Select name="role" defaultValue={defaultValue} disabled={disabled}>
        {roles.map((role) => (
          <option key={role} value={role}>{staffRoleLabels[role]}</option>
        ))}
      </Select>
      {disabled ? <input type="hidden" name="role" value={defaultValue} /> : null}
    </Field>
  );
}
