import { AppointmentScheduler } from "@/components/calendar/appointment-scheduler";
import { MonthlyCalendarWidget } from "@/components/calendar/monthly-calendar-widget";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createAppointment } from "@/lib/actions/appointments";
import { requireUserProfile } from "@/lib/auth/session";
import { getTenantData } from "@/lib/db/queries";
import { safeArray } from "@/lib/utils";

export default async function CalendarPage() {
  const profile = await requireUserProfile();
  let data: Awaited<ReturnType<typeof getTenantData>>;
  if (profile.organisation_id) {
    data = await getTenantData(profile.organisation_id);
  } else {
    data = { clients: [], staff: [], services: [], serviceCategories: [], appointments: [], colours: [] };
  }
  const clients = safeArray(data.clients);
  const staff = safeArray(data.staff);
  const services = safeArray(data.services);
  const canCreateAppointment = clients.length > 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Appointment</h1>
        <p className="text-sm text-muted-foreground">Scheduling workspace for booking and editing appointments.</p>
      </div>
      <MonthlyCalendarWidget appointments={safeArray(data.appointments)} colours={safeArray(data.colours)} />
      <Card>
        <CardHeader><h2 className="font-semibold">New appointment</h2></CardHeader>
        <CardContent>
          <AppointmentScheduler
            action={createAppointment}
            clients={clients.map((client) => ({ id: client.id, name: client.full_name }))}
            staff={staff.map((member) => ({ id: member.id, name: member.full_name }))}
            services={services.map((service) => ({
              id: service.id,
              name: service.name,
              category: service.category || "Uncategorised",
              duration_minutes: service.duration_minutes,
              color: service.color
            }))}
            disabled={!canCreateAppointment}
          />
        </CardContent>
      </Card>
    </div>
  );
}
