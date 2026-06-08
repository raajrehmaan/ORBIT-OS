"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn, humanize, safeArray, safeDate, safeText } from "@/lib/utils";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];
type Appointment = Tables["appointments"]["Row"] & {
  clients?: Pick<Tables["clients"]["Row"], "full_name"> | null;
  staff?: Pick<Tables["staff"]["Row"], "full_name"> | null;
  services?: Pick<Tables["services"]["Row"], "name" | "color" | "category"> | null;
  appointment_staff?: (Tables["appointment_staff"]["Row"] & { staff: Pick<Tables["staff"]["Row"], "full_name"> | null })[];
  history_staff_summary?: string | null;
};
type StatusColour = { colour_type: string; status_key: string; colour: string };

const statusStyles: Record<string, string> = {
  scheduled: "border-yellow-400 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200",
  completed: "border-green-500 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200",
  cancelled: "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200",
  rescheduled: "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  no_show: "border-slate-500 bg-slate-100 text-slate-900 dark:bg-slate-900/30 dark:text-slate-200",
  confirmed: "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
};

export function MonthlyCalendarWidget({ appointments, colours }: { appointments: Appointment[]; colours: StatusColour[] }) {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of safeArray(appointments)) {
      const date = safeDate(appointment.starts_at);
      if (!date) continue;
      const key = toDateKey(date);
      map.set(key, [...(map.get(key) ?? []), appointment]);
    }
    for (const [key, value] of map.entries()) {
      map.set(key, value.sort((a, b) => (safeDate(a.starts_at)?.getTime() ?? 0) - (safeDate(b.starts_at)?.getTime() ?? 0)));
    }
    return map;
  }, [appointments]);
  const selectedAppointments = appointmentsByDate.get(selectedDate) ?? [];
  const years = useMemo(() => {
    const currentYear = today.getFullYear();
    return Array.from({ length: 111 }, (_, index) => currentYear - 10 + index);
  }, [today]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(visibleMonth)}</h2>
            <p className="text-sm text-muted-foreground">Clinic calendar</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button type="button" className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-muted" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}>Previous</button>
            <button type="button" className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-muted" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>Next</button>
            <select
              aria-label="Month"
              className="h-9 rounded-md border bg-surface px-2 text-sm"
              value={visibleMonth.getMonth()}
              onChange={(event) => setVisibleMonth(new Date(visibleMonth.getFullYear(), Number(event.target.value), 1))}
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>{new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(2026, index, 1))}</option>
              ))}
            </select>
            <select
              aria-label="Year"
              className="h-9 rounded-md border bg-surface px-2 text-sm"
              value={visibleMonth.getFullYear()}
              onChange={(event) => setVisibleMonth(new Date(Number(event.target.value), visibleMonth.getMonth(), 1))}
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button
              type="button"
              className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-muted sm:col-auto"
              onClick={() => {
                const nextToday = new Date();
                setVisibleMonth(new Date(nextToday.getFullYear(), nextToday.getMonth(), 1));
                setSelectedDate(toDateKey(nextToday));
              }}
            >
              Today
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid grid-cols-7 gap-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="py-1 text-center text-xs font-semibold text-muted-foreground">{day}</div>
          ))}
          {monthDays.map((day, index) => {
            const key = day ? toDateKey(day) : "";
            const dayAppointments = key ? appointmentsByDate.get(key) ?? [] : [];
            const dominantStatus = dominantDayStatus(dayAppointments);
            const active = key === selectedDate;
            return (
              <button
                key={key || `empty-${index}`}
                type="button"
                disabled={!day}
                onClick={() => day && setSelectedDate(key)}
                className={cn(
                  "min-h-20 rounded-md border p-1.5 text-left transition disabled:opacity-0",
                  active ? "border-primary bg-primary/10" : "bg-background/50 hover:bg-muted",
                  dominantStatus ? dayStatusStyles[dominantStatus] : ""
                )}
              >
                {day ? (
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-semibold">{day.getDate()}</span>
                    {dayAppointments.length ? <span className="rounded-full bg-background/80 px-1.5 text-[11px] font-semibold">{dayAppointments.length}</span> : null}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {dayAppointments.slice(0, 5).map((appointment) => {
                    const status = safeText(appointment.appointment_status ?? appointment.status, "scheduled");
                    return <span key={appointment.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: findColour(colours, status) }} />;
                  })}
                </div>
              </button>
            );
          })}
        </div>
        <div className="grid content-start gap-3">
          <div>
            <h3 className="font-semibold">{formatLongDate(selectedDate)}</h3>
            <p className="text-sm text-muted-foreground">{selectedAppointments.length} appointment{selectedAppointments.length === 1 ? "" : "s"}</p>
          </div>
          {selectedAppointments.map((appointment) => {
            const status = safeText(appointment.appointment_status ?? appointment.status, "scheduled");
            const staff = safeArray(appointment.appointment_staff).map((link) => link.staff?.full_name).filter(Boolean).join(" + ") || appointment.staff?.full_name || appointment.history_staff_summary || "Unassigned";
            return (
              <details key={appointment.id} className={cn("rounded-md border p-3", statusStyles[status] ?? statusStyles.scheduled)}>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{formatTime(appointment.starts_at)} · {appointment.clients?.full_name ?? "Client"}</p>
                      <p className="text-sm">{appointment.service_snapshot_name ?? appointment.services?.name ?? "Treatment"}</p>
                    </div>
                    <span className="rounded-md bg-background/70 px-2 py-1 text-xs font-semibold capitalize">{humanize(status)}</span>
                  </div>
                </summary>
                <div className="mt-3 grid gap-1 text-sm">
                  <p>Staff: {staff}</p>
                  <p>Payment: {humanize(appointment.payment_status, "due")}</p>
                  {appointment.notes ? <p>Notes: {appointment.notes}</p> : null}
                  {appointment.cancellation_reason ? <p>Cancellation: {appointment.cancellation_reason}</p> : null}
                </div>
              </details>
            );
          })}
          {!selectedAppointments.length ? <p className="rounded-md border bg-background/50 p-4 text-sm text-muted-foreground">No appointments for this date.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

const dayStatusStyles: Record<string, string> = {
  completed: "border-green-500/70 bg-green-50 dark:bg-green-950/20",
  scheduled: "border-yellow-400/70 bg-yellow-50 dark:bg-yellow-950/20",
  confirmed: "border-yellow-400/70 bg-yellow-50 dark:bg-yellow-950/20",
  arrived: "border-yellow-400/70 bg-yellow-50 dark:bg-yellow-950/20",
  in_progress: "border-yellow-400/70 bg-yellow-50 dark:bg-yellow-950/20",
  cancelled: "border-red-500/70 bg-red-50 dark:bg-red-950/20",
  no_show: "border-slate-500/70 bg-slate-100 dark:bg-slate-900/30"
};

function buildMonthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const leading = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= last.getDate(); day++) days.push(new Date(date.getFullYear(), date.getMonth(), day));
  return days;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dominantDayStatus(appointments: Appointment[]) {
  if (!appointments.length) return null;
  const statuses = appointments.map((appointment) => safeText(appointment.appointment_status ?? appointment.status, "scheduled"));
  if (statuses.includes("cancelled")) return "cancelled";
  if (statuses.includes("no_show")) return "no_show";
  if (statuses.some((status) => ["scheduled", "confirmed", "arrived", "in_progress"].includes(status))) return "scheduled";
  if (statuses.every((status) => status === "completed")) return "completed";
  return statuses[0] ?? null;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLongDate(value: string) {
  const date = safeDate(`${value}T12:00`);
  return date ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date) : "Selected date";
}

function formatTime(value: unknown) {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date) : "--:--";
}

function findColour(colours: StatusColour[], status: string) {
  return safeArray(colours).find((colour) => colour.colour_type === "appointment" && colour.status_key === status)?.colour ?? {
    scheduled: "#eab308",
    completed: "#16a34a",
    cancelled: "#dc2626",
    rescheduled: "#2563eb",
    no_show: "#64748b"
  }[status] ?? "#64748b";
}
