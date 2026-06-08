"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";

export function ConfirmDeleteForm({
  action,
  id,
  label = "Remove",
  message = "Are you sure you want to remove this record?",
  requirePin = false
}: {
  action: (formData: FormData) => void | Promise<void | ActionResult>;
  id: string;
  label?: string;
  message?: string;
  requirePin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  if (requirePin) {
    return (
      <>
        <Button type="button" variant="ghost" size="sm" className="px-0 text-error hover:bg-transparent hover:text-error/80" onClick={() => setOpen(true)}>
          {label}
        </Button>
        {open ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 backdrop-blur-sm">
            <form
              className="grid w-full max-w-sm gap-4 rounded-lg border bg-surface p-5 shadow-elevated"
              onSubmit={(event) => {
                event.preventDefault();
                setFeedback(null);
                if (!pin.trim()) {
                  setFeedback({ success: false, message: "Admin PIN is required." });
                  return;
                }
                const formData = new FormData(event.currentTarget);
                startTransition(async () => {
                  try {
                    const result = await action(formData);
                    if (result && !result.success) {
                      setFeedback(result);
                      return;
                    }
                    setFeedback({ success: true, message: result?.message ?? "Action completed." });
                    setPin("");
                    window.setTimeout(() => setOpen(false), 450);
                  } catch (error) {
                    setFeedback({ success: false, message: error instanceof Error ? error.message : "Action could not be completed." });
                  }
                });
              }}
            >
              <input type="hidden" name="id" value={id} />
              <div>
                <h2 className="font-semibold">Confirm deletion</h2>
                <p className="mt-1 text-sm text-muted-foreground">{message}</p>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Admin PIN</span>
                <Input name="admin_pin" value={pin} onChange={(event) => setPin(event.target.value)} type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" />
              </label>
              {feedback ? <p className={feedback.success ? "text-sm font-medium text-success" : "text-sm font-medium text-error"}>{feedback.message}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={isPending} onClick={() => { setOpen(false); setFeedback(null); setPin(""); }}>Cancel</Button>
                <Button type="submit" variant="danger" disabled={isPending}>
                  {isPending ? "Checking..." : "Delete"}
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
      }}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" className="px-0 text-error hover:bg-transparent hover:text-error/80">
        {label}
      </Button>
    </form>
  );
}
