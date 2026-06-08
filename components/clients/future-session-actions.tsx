"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteAppointment, markAppointmentNoShow, rescheduleAppointment } from "@/lib/actions/appointments";
import type { ActionResult } from "@/lib/action-result";

type FutureSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
};

export function FutureSessionActions({ session }: { session: FutureSession }) {
  const [mode, setMode] = useState<"cancel" | "reschedule" | "no_show" | null>(null);
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultStart = useMemo(() => toLocalInput(session.starts_at), [session.starts_at]);
  const defaultEnd = useMemo(() => toLocalInput(session.ends_at), [session.ends_at]);

  function submit(formData: FormData) {
    formData.set("id", session.id);
    formData.set("admin_pin", pin);
    setFeedback(null);
    startTransition(async () => {
      const result = mode === "reschedule"
        ? await rescheduleAppointment(formData)
        : mode === "no_show"
          ? await markAppointmentNoShow(formData)
          : await deleteAppointment(formData);
      setFeedback(result);
      if (result.success) {
        setPin("");
        window.setTimeout(() => setMode(null), 600);
      }
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setMode("reschedule")}>Reschedule</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setMode("no_show")}>No-show</Button>
        <Button type="button" size="sm" variant="danger" onClick={() => setMode("cancel")}>Cancel future session</Button>
      </div>
      {mode ? (
        <form
          className="grid gap-3 rounded-lg border bg-background/70 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pin.trim()) {
              setFeedback({ success: false, message: "Admin PIN is required." });
              return;
            }
            submit(new FormData(event.currentTarget));
          }}
        >
          <p className="text-sm font-semibold capitalize">{mode.replace("_", " ")} · {session.label}</p>
          {mode === "reschedule" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New start">
                <Input name="starts_at" type="datetime-local" defaultValue={defaultStart} required />
              </Field>
              <Field label="New end">
                <Input name="ends_at" type="datetime-local" defaultValue={defaultEnd} required />
              </Field>
            </div>
          ) : null}
          {mode === "cancel" ? (
            <Field label="Cancellation reason">
              <Input name="cancellation_reason" placeholder="Optional" />
            </Field>
          ) : null}
          <Field label="Admin PIN">
            <Input value={pin} onChange={(event) => setPin(event.target.value)} type="password" inputMode="numeric" autoComplete="off" />
          </Field>
          {feedback ? <p className={feedback.success ? "text-sm font-medium text-success" : "text-sm font-medium text-error"}>{feedback.message}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => { setMode(null); setFeedback(null); setPin(""); }}>Close</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save lifecycle change"}</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}
