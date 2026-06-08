"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetDemoTestData, updateSecuritySettings } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/action-result";
import type { Database } from "@/types/database";

type SecuritySettings = Database["public"]["Tables"]["organisation_security_settings"]["Row"];

export function SecuritySettingsForm({ settings }: { settings: SecuritySettings | null }) {
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [resetFeedback, setResetFeedback] = useState<ActionResult | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isResetting, startReset] = useTransition();

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Security Settings</h2>
        <p className="text-sm text-muted-foreground">Fast local PIN protection for clinic operations. Email is optional and never required for daily workflow.</p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await updateSecuritySettings(formData);
              setFeedback(result);
              setRecoveryCodes(result.recoveryCodes ?? []);
              if (result.success && event.currentTarget) event.currentTarget.reset();
            });
          }}
        >
          <Field label="Current admin PIN">
            <Input name="current_pin" type="password" inputMode="numeric" autoComplete="off" placeholder={settings?.admin_pin_hash ? "Required to change PIN" : "Not required for first setup"} />
          </Field>
          <Field label="Recovery email">
            <Input name="recovery_email" type="email" defaultValue={settings?.recovery_email ?? ""} placeholder="Optional owner contact" />
          </Field>
          <Field label="New admin PIN">
            <Input name="new_pin" type="password" inputMode="numeric" autoComplete="off" placeholder="4-12 digits" />
          </Field>
          <Field label="Confirm new PIN">
            <Input name="confirm_pin" type="password" inputMode="numeric" autoComplete="off" />
          </Field>
          <div className="grid gap-3 md:col-span-2">
            <Toggle name="two_step_enabled" label="Two-step verification" defaultChecked={settings?.two_step_enabled ?? false} />
            <Toggle name="owner_password_verification_enabled" label="Allow owner-password verification support" defaultChecked={settings?.owner_password_verification_enabled ?? false} />
            <Toggle name="generate_recovery_codes" label="Generate 5 new one-time recovery codes" defaultChecked={false} />
            <div className="grid gap-2 rounded-lg border bg-background/50 p-3 sm:grid-cols-2">
              <Toggle name="protect_client_archive" label="Protect client archive/delete" defaultChecked={settings?.protect_client_archive ?? true} />
              <Toggle name="protect_staff_changes" label="Protect staff changes" defaultChecked={settings?.protect_staff_changes ?? true} />
              <Toggle name="protect_appointments" label="Protect appointment lifecycle" defaultChecked={settings?.protect_appointments ?? true} />
              <Toggle name="protect_services" label="Protect services/categories" defaultChecked={settings?.protect_services ?? true} />
              <Toggle name="protect_financials" label="Protect financial adjustments" defaultChecked={settings?.protect_financials ?? true} />
              <Toggle name="protect_settings" label="Protect settings modifications" defaultChecked={settings?.protect_settings ?? true} />
            </div>
          </div>
          {feedback ? <p className={feedback.success ? "text-sm font-medium text-success md:col-span-2" : "text-sm font-medium text-error md:col-span-2"}>{feedback.message}</p> : null}
          {recoveryCodes.length ? (
            <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 md:col-span-2">
              <div>
                <h3 className="font-semibold">Recovery codes</h3>
                <p className="text-sm text-muted-foreground">Print or download these now. They are stored hashed and will not be shown again.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {recoveryCodes.map((code) => (
                  <code key={code} className="rounded-md border bg-surface px-3 py-2 text-sm font-semibold tracking-wide">{code}</code>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => window.print()}>Print codes</Button>
                <Button type="button" variant="outline" onClick={() => downloadCodes(recoveryCodes)}>Download codes</Button>
              </div>
            </div>
          ) : null}
          <Button className="w-fit md:col-span-2" disabled={isPending}>{isPending ? "Saving security..." : "Save security settings"}</Button>
        </form>

        <form
          className="grid gap-3 rounded-lg border border-error/30 bg-error/5 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setResetFeedback(null);
            const formData = new FormData(event.currentTarget);
            startReset(async () => {
              const result = await resetDemoTestData(formData);
              setResetFeedback(result);
              if (result.success && event.currentTarget) event.currentTarget.reset();
            });
          }}
        >
          <div>
            <h3 className="font-semibold text-error">Reset Demo/Test Data</h3>
            <p className="mt-1 text-sm text-muted-foreground">Removes operational test data while preserving schema, settings, services, categories, and staff accounts.</p>
          </div>
          <Field label="Admin PIN">
            <Input name="admin_pin" type="password" inputMode="numeric" autoComplete="off" required />
          </Field>
          {resetFeedback ? <p className={resetFeedback.success ? "text-sm font-medium text-success" : "text-sm font-medium text-error"}>{resetFeedback.message}</p> : null}
          <Button variant="danger" className="w-fit" disabled={isResetting}>{isResetting ? "Resetting..." : "Reset demo/test data"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function downloadCodes(codes: string[]) {
  const blob = new Blob([codes.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "orbitos-recovery-codes.txt";
  link.click();
  URL.revokeObjectURL(url);
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border bg-surface px-3 py-2 text-sm font-medium">
      <span>{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-primary" />
    </label>
  );
}
