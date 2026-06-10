import { notFound } from "next/navigation";
import { ClientPhotoHistory } from "@/components/clients/client-photo-history";
import { FutureSessionActions } from "@/components/clients/future-session-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUserProfile } from "@/lib/auth/session";
import { getClientMasterFile } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currencyFromPrice, humanize, safeArray, safeDate } from "@/lib/utils";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id) notFound();
  const { id } = await params;
  const data = await getClientMasterFile(profile.organisation_id, id);
  if (!data.client) notFound();
  const photos = await getClientPhotos(profile.organisation_id, id);

  const appointments = safeArray(data.appointments);
  const payments = safeArray(data.payments);
  const treatments = safeArray(data.treatments);
  const appointmentHistory = safeArray(data.appointmentHistory);
  const historyByAppointment = new Map(appointmentHistory.filter((history) => history.appointment_id).map((history) => [history.appointment_id, history]));
  const completed = appointments.filter((appointment) => appointmentStatus(appointment) === "completed").length;
  const cancelled = appointments.filter((appointment) => ["cancelled", "archived"].includes(appointmentStatus(appointment))).length;
  const noShows = appointments.filter((appointment) => appointmentStatus(appointment) === "no_show").length;
  const upcoming = appointments.filter((appointment) => {
    const startsAt = safeDate(appointment.starts_at);
    return startsAt && startsAt >= new Date() && !["cancelled", "archived", "no_show", "completed"].includes(appointmentStatus(appointment));
  }).length;
  const futureSessions = appointments.filter((appointment) => {
    const startsAt = safeDate(appointment.starts_at);
    return startsAt && startsAt >= new Date() && !["cancelled", "archived", "no_show", "completed"].includes(appointmentStatus(appointment));
  });
  const activeAppointmentIds = new Set(appointments.filter((appointment) => !["cancelled", "archived", "no_show"].includes(appointmentStatus(appointment))).map((appointment) => appointment.id));
  const totalSpent = payments.filter((payment) => !payment.appointment_id || activeAppointmentIds.has(payment.appointment_id)).reduce((sum, payment) => sum + Number(payment.amount_paid ?? 0), 0);
  const totalDue = payments.reduce((sum, payment) => sum + Number(payment.balance_due ?? 0), 0);
  const deposits = payments.reduce((sum, payment) => sum + Number(payment.deposit_amount ?? 0), 0);
  const refunds = payments.filter((payment) => payment.payment_status === "refunded").reduce((sum, payment) => sum + Number(payment.amount_paid ?? 0), 0);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.client.full_name}</h1>
        <p className="text-sm text-muted-foreground">Permanent client master file</p>
      </div>
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><h2 className="font-semibold">Personal</h2></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>Phone: {data.client.phone ?? "Not recorded"}</p>
            <p>Email: {data.client.email ?? "Not recorded"}</p>
            <p className="text-muted-foreground">{data.client.notes ?? "No notes"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Financial</h2></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>Total spent: {currencyFromPrice(totalSpent)}</p>
            <p>Total due: {currencyFromPrice(totalDue)}</p>
            <p>Deposits: {currencyFromPrice(deposits)}</p>
            <p>Refunds: {currencyFromPrice(refunds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Appointments</h2></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>Total: {appointments.length}</p>
            <p>Completed: {completed}</p>
            <p>Cancelled: {cancelled}</p>
            <p>No shows: {noShows}</p>
            <p>Upcoming: {upcoming}</p>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><h2 className="font-semibold">Permanent timeline</h2></CardHeader>
        <CardContent className="grid gap-3">
          {appointments.map((appointment) => {
            const status = appointmentStatus(appointment);
            const appointmentPayments = payments.filter((payment) => payment.appointment_id === appointment.id);
            const paid = appointmentPayments.reduce((sum, payment) => sum + Number(payment.amount_paid ?? 0), 0);
            const due = appointmentPayments.reduce((sum, payment) => sum + Number(payment.balance_due ?? 0), 0);
            return (
            <div key={appointment.id} className={`rounded-lg border p-4 ${statusClass(status)}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">{formatHistoryDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}</p>
                  <p className="mt-1 font-semibold">{appointment.service_snapshot_name ?? appointment.services?.name ?? "Treatment"}</p>
                  <p className="text-sm text-muted-foreground">
                    {humanize(status, "scheduled")} · {humanize(appointment.payment_status, "due")}
                    {appointment.session_number && appointment.total_sessions ? ` · Session ${appointment.session_number} of ${appointment.total_sessions}` : ""}
                  </p>
                </div>
                <span className="rounded-md border bg-background/70 px-2 py-1 text-xs font-semibold capitalize">{humanize(status)}</span>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <p>Staff: {staffNames(appointment, historyByAppointment.get(appointment.id)?.metadata)}</p>
                <p>Paid: {currencyFromPrice(paid)} · Due: {currencyFromPrice(due)}</p>
              </div>
              {appointment.notes ? <p className="mt-2 text-sm">{appointment.notes}</p> : null}
              {appointment.cancellation_reason ? <p className="mt-2 text-sm text-error">Cancellation: {appointment.cancellation_reason}</p> : null}
            </div>
          );})}
          {!appointments.length ? <p className="text-sm text-muted-foreground">No appointment history yet.</p> : null}
        </CardContent>
      </Card>
      <ClientPhotoHistory clientId={id} photos={photos} />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Future Sessions</h2>
          <p className="text-sm text-muted-foreground">Cancel, reschedule, or mark a future session without destroying package history.</p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {futureSessions.map((appointment) => (
            <div key={appointment.id} className="grid gap-3 rounded-lg border bg-background/50 p-4">
              <div>
                <p className="text-sm font-semibold text-primary">{formatHistoryDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}</p>
                <p className="mt-1 font-semibold">{appointment.service_snapshot_name ?? appointment.services?.name ?? "Treatment"}</p>
                <p className="text-sm text-muted-foreground">
                  {appointment.session_number && appointment.total_sessions ? `Session ${appointment.session_number} of ${appointment.total_sessions} · ` : ""}
                  {staffNames(appointment, historyByAppointment.get(appointment.id)?.metadata)}
                </p>
              </div>
              <FutureSessionActions
                session={{
                  id: appointment.id,
                  starts_at: appointment.starts_at,
                  ends_at: appointment.ends_at,
                  label: appointment.service_snapshot_name ?? appointment.services?.name ?? "Future session"
                }}
              />
            </div>
          ))}
          {!futureSessions.length ? <p className="text-sm text-muted-foreground">No future sessions scheduled.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Treatment records</h2></CardHeader>
        <CardContent className="grid gap-3">
          {treatments.map((treatment) => (
            <div key={treatment.id} className="rounded-lg border p-4">
              <p className="font-semibold">{treatment.treatment_name}</p>
              <p className="text-sm text-muted-foreground">
                {treatment.treatment_category ?? "Treatment"} · {humanize(treatment.payment_status, "due")}
                {treatment.session_number && treatment.total_sessions ? ` · ${treatment.session_number} / ${treatment.total_sessions}` : ""}
              </p>
              {treatment.staff_summary ? <p className="text-sm text-muted-foreground">Staff: {treatment.staff_summary}</p> : null}
              {treatment.notes ? <p className="mt-2 text-sm">{treatment.notes}</p> : null}
              {treatment.before_after_notes ? <p className="mt-2 text-sm">{treatment.before_after_notes}</p> : null}
            </div>
          ))}
          {!treatments.length ? <p className="text-sm text-muted-foreground">No treatment records yet.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Status history</h2></CardHeader>
        <CardContent className="grid gap-3">
          {appointmentHistory.map((history) => (
            <div key={history.id} className="rounded-lg border p-4">
              <p className="text-sm font-semibold text-primary">{formatHistoryDate(history.created_at)}</p>
              <p className="mt-1 font-semibold capitalize">{humanize(history.action)}</p>
              <p className="text-sm text-muted-foreground">
                {history.service_snapshot_name ?? "Treatment"} · {humanize(history.appointment_status, "scheduled")} · {humanize(history.payment_status, "due")}
              </p>
              {history.service_snapshot_price !== null ? <p className="text-sm text-muted-foreground">Price: {currencyFromPrice(history.service_snapshot_price)}</p> : null}
            </div>
          ))}
          {!appointmentHistory.length ? <p className="text-sm text-muted-foreground">No lifecycle history yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

async function getClientPhotos(organisationId: string, clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("client_photos")
    .select("id, client_id, category, notes, created_at, original_filename, storage_path")
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return Promise.all(safeArray(data).map(async (photo) => {
    const signed = await supabase.storage.from("organisation-assets").createSignedUrl(photo.storage_path, 60 * 10);
    return {
      id: photo.id,
      client_id: photo.client_id,
      category: photo.category,
      notes: photo.notes,
      created_at: photo.created_at,
      original_filename: photo.original_filename,
      signedUrl: signed.data?.signedUrl ?? null
    };
  }));
}

function appointmentStatus(appointment: { appointment_status?: string | null; status?: string | null }) {
  return appointment.appointment_status ?? appointment.status ?? "scheduled";
}

function statusClass(status: string) {
  if (status === "completed") return "border-green-500/60 bg-green-50 dark:bg-green-950/20";
  if (status === "cancelled" || status === "archived") return "border-red-500/60 bg-red-50 dark:bg-red-950/20";
  if (status === "no_show") return "border-slate-500/60 bg-slate-100 dark:bg-slate-900/30";
  return "border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/20";
}

function staffNames(appointment: { appointment_staff?: { staff: { full_name: string } | null }[]; staff?: { full_name: string } | null }, metadata?: unknown) {
  const linkedStaff = safeArray(appointment.appointment_staff).map((link) => link.staff?.full_name).filter(Boolean).join(", ");
  return linkedStaff || appointment.staff?.full_name || metadataStaffSummary(metadata) || "Unassigned";
}

function metadataStaffSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("staff_summary" in metadata)) return "";
  const value = (metadata as { staff_summary?: unknown }).staff_summary;
  return typeof value === "string" ? value : "";
}

function formatHistoryDate(value: unknown) {
  const date = safeDate(value);
  if (!date) return "Date TBC";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value: unknown) {
  const date = safeDate(value);
  if (!date) return "--:--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
