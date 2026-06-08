import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardSchedule } from "@/components/dashboard/dashboard-schedule";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUserProfile } from "@/lib/auth/session";
import { getTenantData } from "@/lib/db/queries";
import { safeArray, safeDate } from "@/lib/utils";

export default async function DashboardPage() {
  const profile = await requireUserProfile();
  let data: Awaited<ReturnType<typeof getTenantData>>;
  if (profile.organisation_id) {
    data = await getTenantData(profile.organisation_id);
  } else {
    data = { clients: [], staff: [], services: [], serviceCategories: [], appointments: [], colours: [] };
  }
  const clients = safeArray(data.clients);
  const services = safeArray(data.services);
  const appointments = safeArray(data.appointments);
  const todaysAppointments = appointments.filter((appointment) => isToday(appointment.starts_at));
  const todayAppointmentCount = todaysAppointments.length;
  const todayClientCount = new Set(todaysAppointments.map((appointment) => appointment.client_id).filter(Boolean)).size;
  const staffWorkingToday = new Set(todaysAppointments.flatMap((appointment) => [
    appointment.staff_id,
    appointment.secondary_staff_id,
    ...safeArray(appointment.appointment_staff).map((link) => link.staff_id)
  ]).filter(Boolean)).size;
  const revenueToday = todaysAppointments.reduce((sum, appointment) => sum + Number(appointment.amount_paid ?? 0), 0);
  const isEmptyOrganisation = clients.length === 0 && services.length === 0 && appointments.length === 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your organisation activity at a glance.</p>
        </div>
        <Link href="/calendar" className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 sm:w-auto">
          <Plus className="h-4 w-4" /> New Appointment
        </Link>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Today's appointments" value={todayAppointmentCount} />
        <Metric title="Today's clients" value={todayClientCount} />
        <Metric title="Total clients" value={clients.length} />
        <Metric title="Staff working today" value={staffWorkingToday} />
        <Metric title="Revenue today" value={revenueToday} prefix="£" />
      </section>
      {isEmptyOrganisation ? (
        <EmptyState
          title="Your organisation is ready"
          description="Start by adding clients and services. Appointments will appear here as soon as they are scheduled."
        />
      ) : null}
      <DashboardSchedule initialAppointments={appointments} organisationId={profile.organisation_id} colours={safeArray(data.colours)} />
    </div>
  );
}

function isToday(value: string) {
  const date = safeDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function Metric({ title, value, prefix = "" }: { title: string; value: number; prefix?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-semibold">{prefix}{prefix ? value.toFixed(2) : value}</p>
      </CardContent>
    </Card>
  );
}
