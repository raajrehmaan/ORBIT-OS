"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { staffRoleLabels } from "@/lib/auth/permissions";
import type { StaffRole } from "@/types/database";

const editableStaffRoles: StaffRole[] = ["staff", "manager", "therapist", "receptionist", "admin"];

type StaffEditAction = (formData: FormData) => void | Promise<void | ActionResult>;

export function StaffEditForm({
  action,
  id,
  fullName,
  email,
  phone,
  notes,
  role,
  active
}: {
  action: StaffEditAction;
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  role: StaffRole;
  active: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>(role);
  const [pin, setPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const roleChanged = selectedRole !== role;
  const immutableOwner = role === "organisation_owner";

  function submitWithPin(adminPin?: string) {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    if (adminPin !== undefined) formData.set("admin_pin", adminPin);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result && !result.success) {
          setFeedback(result);
          return;
        }
        setFeedback({ success: true, message: result?.message ?? "Staff member saved." });
        setShowPinModal(false);
        setPin("");
      } catch (error) {
        setFeedback({ success: false, message: error instanceof Error ? error.message : "Staff member could not be saved." });
      }
    });
  }

  return (
    <>
      <form
        ref={formRef}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] xl:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (roleChanged && !immutableOwner) {
            setFeedback(null);
            setShowPinModal(true);
            return;
          }
          submitWithPin();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Field label="Full name"><Input name="full_name" defaultValue={fullName} required /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={email ?? ""} placeholder="Optional" /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={phone ?? ""} /></Field>
        <Field label="Role">
          <Select name="role" value={selectedRole} disabled={immutableOwner} onChange={(event) => setSelectedRole(event.target.value as StaffRole)}>
            {(immutableOwner ? ["organisation_owner" as const] : editableStaffRoles).map((item) => (
              <option key={item} value={item}>{staffRoleLabels[item]}</option>
            ))}
          </Select>
          {immutableOwner ? <input type="hidden" name="role" value={role} /> : null}
        </Field>
        <Field label="Notes"><Input name="notes" defaultValue={notes ?? ""} placeholder="Optional" /></Field>
        <label className="flex h-10 items-center gap-2 text-sm font-medium"><input name="active" type="checkbox" defaultChecked={active} /> Active</label>
        <Button disabled={isPending} type="submit">{isPending ? "Saving..." : "Save"}</Button>
        {feedback ? <p className={feedback.success ? "text-sm font-medium text-success md:col-span-2" : "text-sm font-medium text-error md:col-span-2"}>{feedback.message}</p> : null}
      </form>
      {showPinModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 backdrop-blur-sm">
          <div className="grid w-full max-w-sm gap-4 rounded-lg border bg-surface p-5 shadow-elevated">
            <div>
              <h2 className="font-semibold">Confirm role change</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter admin PIN before changing this staff role.</p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Admin PIN</span>
              <Input value={pin} onChange={(event) => setPin(event.target.value)} type="password" inputMode="numeric" autoComplete="off" />
            </label>
            {feedback && !feedback.success ? <p className="text-sm font-medium text-error">{feedback.message}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => { setShowPinModal(false); setPin(""); setFeedback(null); }}>Cancel</Button>
              <Button type="button" disabled={isPending} onClick={() => {
                if (!pin.trim()) {
                  setFeedback({ success: false, message: "Admin PIN is required." });
                  return;
                }
                submitWithPin(pin);
              }}>
                {isPending ? "Checking..." : "Save role"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
