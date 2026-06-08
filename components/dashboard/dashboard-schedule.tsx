"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, humanize, safeArray, safeDate, safeText } from "@/lib/utils";
import type { AppointmentStatus, Database, PaymentStatus } from "@/types/database";

type Tables = Database["public"]["Tables"];
type Appointment = Tables["appointments"]["Row"] & {
  clients: Pick<Tables["clients"]["Row"], "full_name"> | null;
  staff: Pick<Tables["staff"]["Row"], "full_name"> | null;
  services: Pick<Tables["services"]["Row"], "name" | "color"> | null;
  appointment_staff: (Tables["appointment_staff"]["Row"] & { staff: Pick<Tables["staff"]["Row"], "full_name"> | null })[];
  history_staff_summary?: string | null;
};
type StatusColour = Tables["status_colours"]["Row"];

const serviceColorClasses: Record<string, string> = {
  teal: "bg-primary/10 text-primary border-primary/25",
  blue: "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-300",
  violet: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  amber: "bg-warning/15 text-warning-foreground border-warning/35",
  rose: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  slate: "bg-muted text-muted-foreground border-border"
};

const sectionLabels = ["Today", "Tomorrow", "Day after tomorrow"] as const;
const defaultStatusColours: Record<string, string> = {
  completed: "#16a34a",
  scheduled: "#eab308",
  cancelled: "#dc2626",
  rescheduled: "#f97316",
  confirmed: "#2563eb",
  no_show: "#6b7280",
  due: "#e11d48",
  paid: "#22c55e",
  partial: "#f59e0b",
  deposit: "#7c3aed",
  refunded: "#64748b"
};

export function DashboardSchedule({ initialAppointments, organisationId, colours }: { initialAppointments: Appointment[]; organisationId: string | null; colours: StatusColour[] }) {
  const [appointments, setAppointments] = useState(safeArray(initialAppointments));
  const [loading, setLoading] = useState(false);

  async function refreshAppointments() {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/appointments", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      setAppointments(safeArray(payload.appointments));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!organisationId) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`dashboard-appointments-${organisationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `organisation_id=eq.${organisationId}` },
        () => {
          void refreshAppointments();
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void refreshAppointments();
    }, 15000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [organisationId]);

  const grouped = useMemo(() => groupAppointments(appointments), [appointments]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Schedule</h2>
          <p className="text-sm text-muted-foreground">Today and the next two days.</p>
        </div>
        {loading ? <span className="text-xs font-medium text-muted-foreground">Updating...</span> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {sectionLabels.map((label) => (
          <Card key={label}>
            <CardHeader>
              <h3 className="font-semibold">{label}</h3>
            </CardHeader>
            <CardContent className="grid gap-3">
              {grouped[label].length ? grouped[label].map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} colours={colours} onDeleted={refreshAppointments} />
              )) : (
                <p className="text-sm text-muted-foreground">No appointments.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {!appointments.length ? (
        <EmptyState title="No appointments scheduled" description="Newly created appointments will appear here automatically." />
      ) : null}
    </div>
  );
}

function AppointmentCard({ appointment, colours, onDeleted }: { appointment: Appointment; colours: StatusColour[]; onDeleted: () => Promise<void> }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const appointmentStatus = safeText(appointment.appointment_status ?? appointment.status, "scheduled");
  const isCancelled = appointmentStatus === "cancelled";
  const serviceName = appointment.service_snapshot_name ?? appointment.services?.name ?? "No service";

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/appointments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, admin_pin: pin, cancellation_reason: reason })
      });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteError(payload.error ?? "Appointment could not be deleted.");
        return;
      }
      setConfirmingDelete(false);
      setPin("");
      setReason("");
      await onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={cn("grid gap-3 rounded-lg border bg-background/50 p-3", isCancelled && "border-error/50 bg-error/5")}>
      <time className="flex items-center justify-between rounded-md border bg-surface px-3 py-2">
        <span className="text-sm font-semibold text-primary">{formatAppointmentDate(appointment.starts_at)}</span>
        <span className="text-xl font-semibold leading-none">{formatAppointmentTime(appointment.starts_at)}</span>
      </time>
      <div className="grid gap-2">
        <Link href={`/clients/${appointment.client_id}`} className="font-medium text-primary hover:underline">
          {appointment.clients?.full_name ?? "Client"}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", serviceColorClasses[safeText(appointment.services?.color, "teal")] ?? serviceColorClasses.teal)}>
            {serviceName}
          </span>
          <StatusBadge label={humanize(appointmentStatus, "scheduled")} colour={findColour(colours, "appointment", appointmentStatus)} />
          <StatusBadge label={humanize(appointment.payment_status, "due")} colour={findColour(colours, "payment", safeText(appointment.payment_status, "due"))} />
          <span>{staffLabel(appointment)}</span>
          {appointment.session_number && appointment.total_sessions ? <span>Session {appointment.session_number} / {appointment.total_sessions}</span> : null}
        </div>
      </div>
      <Button variant="ghost" size="sm" className="w-fit px-0 text-error hover:bg-transparent hover:text-error/80" disabled={isCancelled} onClick={() => setConfirmingDelete(true)}>
        Cancel appointment
      </Button>
      {confirmingDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 px-4 backdrop-blur-sm">
          <div className="grid w-full max-w-sm gap-4 rounded-lg border bg-surface p-5 shadow-elevated">
            <div>
              <h2 className="font-semibold">Cancel appointment</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter admin password. The appointment history will be kept.</p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Admin password</span>
              <Input value={pin} onChange={(event) => setPin(event.target.value)} type="password" inputMode="numeric" autoComplete="off" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Reason</span>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional" autoComplete="off" />
            </label>
            {deleteError ? <p className="text-sm font-medium text-error">{deleteError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
              <Button type="button" variant="danger" disabled={deleting || !pin} onClick={handleDelete}>
                {deleting ? "Cancelling..." : "Cancel appointment"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ label, colour }: { label: string; colour: string }) {
  return (
    <span className="rounded-md border px-2 py-1 text-xs font-semibold" style={{ borderColor: colour, color: colour, backgroundColor: `${colour}18` }}>
      {label}
    </span>
  );
}

function findColour(colours: StatusColour[], colourType: "appointment" | "payment", statusKey: AppointmentStatus | PaymentStatus | string) {
  return safeArray(colours).find((colour) => colour.colour_type === colourType && colour.status_key === statusKey)?.colour ?? defaultStatusColours[statusKey] ?? "#64748b";
}

function staffLabel(appointment: Appointment) {
  const staff = safeArray(appointment.appointment_staff).map((link) => link.staff?.full_name).filter(Boolean);
  if (staff.length) return staff.join(" + ");
  return appointment.staff?.full_name ?? appointment.history_staff_summary ?? "Unassigned";
}

function groupAppointments(appointments: Appointment[]) {
  const now = new Date();
  const keys = {
    Today: dateKey(addDays(now, 0)),
    Tomorrow: dateKey(addDays(now, 1)),
    "Day after tomorrow": dateKey(addDays(now, 2))
  };

  const grouped: Record<(typeof sectionLabels)[number], Appointment[]> = {
    Today: [],
    Tomorrow: [],
    "Day after tomorrow": []
  };

  safeArray(appointments)
    .filter((appointment) => {
      const startsAt = safeDate(appointment.starts_at);
      if (!startsAt) return false;
      const key = dateKey(startsAt);
      return Object.values(keys).includes(key);
    })
    .sort((a, b) => (safeDate(a.starts_at)?.getTime() ?? 0) - (safeDate(b.starts_at)?.getTime() ?? 0))
    .forEach((appointment) => {
      const startsAt = safeDate(appointment.starts_at);
      if (!startsAt) return;
      const key = dateKey(startsAt);
      const label = sectionLabels.find((section) => keys[section] === key);
      if (label) grouped[label].push(appointment);
    });

  return grouped;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatAppointmentDate(value: string) {
  const date = safeDate(value);
  if (!date) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatAppointmentTime(value: string) {
  const date = safeDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
