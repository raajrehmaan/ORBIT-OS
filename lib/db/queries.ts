import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeArray, safeDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];
type Client = Tables["clients"]["Row"];
type Staff = Tables["staff"]["Row"];
type Service = Tables["services"]["Row"];
type ServiceCategory = Tables["service_categories"]["Row"];
type AppointmentStaff = Tables["appointment_staff"]["Row"] & { staff: Pick<Staff, "full_name"> | null };
type Appointment = Tables["appointments"]["Row"] & {
  clients: Pick<Client, "full_name"> | null;
  staff: Pick<Staff, "full_name"> | null;
  services: Pick<Service, "name" | "color" | "category" | "price"> | null;
  appointment_staff: AppointmentStaff[];
  history_staff_summary?: string | null;
};
type AppointmentHistory = Tables["appointment_history"]["Row"];
type Payment = Tables["payments"]["Row"];
type TreatmentRecord = Tables["treatment_records"]["Row"];
type AuditLog = Tables["audit_logs"]["Row"];

export async function getTenantData(organisationId: string) {
  const supabase = await createSupabaseServerClient();
  const [clients, staff, users, servicesResult, appointmentsResult, appointmentStaffResult, appointmentHistoryResult, legacyColours, appointmentColours, categories] = await Promise.all([
    supabase.from("clients").select("*").eq("organisation_id", organisationId).is("archived_at", null).order("full_name"),
    supabase.from("staff").select("*").eq("organisation_id", organisationId).order("full_name"),
    supabase.from("users").select("id, role").eq("organisation_id", organisationId),
    supabase.from("services").select("*").eq("organisation_id", organisationId).order("name"),
    supabase.from("appointments").select("*").eq("organisation_id", organisationId).order("starts_at"),
    supabase.from("appointment_staff").select("*").eq("organisation_id", organisationId),
    supabase.from("appointment_history").select("appointment_id, metadata, created_at").eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    supabase.from("status_colours").select("*").or(`organisation_id.is.null,organisation_id.eq.${organisationId}`),
    supabase.from("appointment_status_colours").select("*").eq("organisation_id", organisationId),
    supabase.from("service_categories").select("*").eq("organisation_id", organisationId).is("archived_at", null).order("name")
  ]);
  const services = servicesResult.data ?? [];

  const userRoles = new Map(safeArray(users.data).map((user) => [user.id, user.role]));
  const activeStaff = safeArray(staff.data)
    .filter((member) => !("deleted_at" in member) || !member.deleted_at)
    .map((member) => ({
      ...member,
      role: member.user_id ? normalizeTenantStaffRole(userRoles.get(member.user_id) ?? member.role) : member.role
    }));
  const clientNames = new Map(safeArray(clients.data).map((client) => [client.id, { full_name: client.full_name }]));
  const staffNames = new Map(activeStaff.map((member) => [member.id, { full_name: member.full_name }]));
  const categoryNames = new Map(safeArray(categories.data).map((category) => [category.id, normalizeServiceCategory(category.name)]));
  const normalizedServices = safeArray(services).map((service) => ({
    ...service,
    category: service.category_id ? categoryNames.get(service.category_id) ?? normalizeServiceCategory(service.category) : normalizeServiceCategory(service.category)
  }));
  const activeServices = normalizedServices
    .filter((service) => !service.archived_at)
    .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`));
  const visibleServices = activeServices.length ? activeServices : normalizedServices;
  const serviceNames = new Map(normalizedServices.map((service) => [service.id, { name: service.name, color: service.color, category: service.category, price: service.price }]));
  const staffLinks = safeArray(appointmentStaffResult.data).map((link) => ({
    ...link,
    staff: staffNames.get(link.staff_id) ?? null
  }));
  const historyStaffSummaries = new Map<string, string>();
  for (const history of safeArray(appointmentHistoryResult.data)) {
    if (!history.appointment_id || historyStaffSummaries.has(history.appointment_id)) continue;
    const summary = metadataStaffSummary(history.metadata);
    if (summary) historyStaffSummaries.set(history.appointment_id, summary);
  }
  const appointments = safeArray(appointmentsResult.data).map((appointment) => ({
    ...appointment,
    clients: clientNames.get(appointment.client_id) ?? null,
    staff: appointment.staff_id ? staffNames.get(appointment.staff_id) ?? null : null,
    services: appointment.service_id ? serviceNames.get(appointment.service_id) ?? null : null,
    appointment_staff: staffLinks.filter((link) => link.appointment_id === appointment.id),
    history_staff_summary: historyStaffSummaries.get(appointment.id) ?? null
  }));
  const colours = [
    ...safeArray(legacyColours.data),
    ...safeArray(appointmentColours.data).map((colour) => ({
      id: colour.id,
      organisation_id: colour.organisation_id,
      colour_type: "appointment" as const,
      status_key: colour.status,
      colour: colour.text_color,
      created_at: colour.created_at,
      updated_at: colour.created_at
    }))
  ];

  return {
    clients: safeArray(clients.data),
    staff: activeStaff,
    services: visibleServices,
    serviceCategories: safeArray(categories.data) as ServiceCategory[],
    appointments: appointments as Appointment[],
    colours
  };
}

function normalizeServiceCategory(value: string | null | undefined) {
  const category = value?.trim();
  if (!category || category.toLowerCase() === "general") return "Uncategorised";
  return category;
}

function normalizeTenantStaffRole(value: unknown) {
  if (value === "organisation_owner" || value === "admin" || value === "therapist" || value === "receptionist" || value === "staff") return value;
  return "staff";
}

function metadataStaffSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("staff_summary" in metadata)) return "";
  const value = (metadata as { staff_summary?: unknown }).staff_summary;
  return typeof value === "string" ? value : "";
}

export async function getClientMasterFile(organisationId: string, clientId: string) {
  const tenantData = await getTenantData(organisationId);
  const supabase = await createSupabaseServerClient();
  const directClient = await supabase.from("clients").select("*").eq("organisation_id", organisationId).eq("id", clientId).single();
  const client = tenantData.clients.find((item) => item.id === clientId) ?? directClient.data ?? null;
  const appointments = safeArray(tenantData.appointments)
    .filter((appointment) => appointment.client_id === clientId)
    .sort((a, b) => (safeDate(b.starts_at)?.getTime() ?? 0) - (safeDate(a.starts_at)?.getTime() ?? 0));
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const [treatments, payments, appointmentAudits, clientAudits, appointmentHistory] = await Promise.all([
    supabase.from("treatment_records").select("*").eq("organisation_id", organisationId).eq("client_id", clientId).order("treatment_date", { ascending: false }),
    supabase.from("payments").select("*").eq("organisation_id", organisationId).eq("client_id", clientId).order("created_at", { ascending: false }),
    appointmentIds.length
      ? supabase.from("audit_logs").select("*").eq("organisation_id", organisationId).in("entity_id", appointmentIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("audit_logs").select("*").eq("organisation_id", organisationId).eq("entity_id", clientId).order("created_at", { ascending: false }),
    supabase.from("appointment_history").select("*").eq("organisation_id", organisationId).eq("client_id", clientId).order("created_at", { ascending: false })
  ]);
  const historyRows = safeArray(appointmentHistory.data as AppointmentHistory[] | null);
  const treatmentRows = mergeTreatmentFallbacks(safeArray(treatments.data as TreatmentRecord[] | null), appointments, historyRows);
  const paymentRows = mergePaymentFallbacks(safeArray(payments.data as Payment[] | null), appointments);

  return {
    client,
    appointments,
    treatments: treatmentRows,
    payments: paymentRows,
    appointmentHistory: historyRows,
    audits: [...safeArray(clientAudits.data as AuditLog[] | null), ...safeArray(appointmentAudits.data as AuditLog[] | null)],
    colours: tenantData.colours
  };
}

function mergePaymentFallbacks(payments: Payment[], appointments: Appointment[]) {
  const paymentAppointmentIds = new Set(payments.map((payment) => payment.appointment_id).filter(Boolean));
  const fallbacks = appointments
    .filter((appointment) => !paymentAppointmentIds.has(appointment.id))
    .map((appointment) => ({
      id: `appointment-payment-${appointment.id}`,
      organisation_id: appointment.organisation_id,
      client_id: appointment.client_id,
      appointment_id: appointment.id,
      treatment_record_id: null,
      treatment_price: Number(appointment.treatment_price ?? appointment.service_snapshot_price ?? 0),
      deposit_amount: Number(appointment.deposit_amount ?? 0),
      amount_paid: Number(appointment.amount_paid ?? 0),
      balance_due: Number(appointment.balance_due ?? 0),
      payment_status: appointment.payment_status ?? "due",
      paid_at: appointment.payment_status === "paid" ? appointment.completed_at ?? appointment.starts_at : null,
      created_at: appointment.created_at,
      updated_at: appointment.updated_at
    })) as Payment[];
  return [...payments, ...fallbacks].sort((a, b) => (safeDate(b.created_at)?.getTime() ?? 0) - (safeDate(a.created_at)?.getTime() ?? 0));
}

function mergeTreatmentFallbacks(treatments: TreatmentRecord[], appointments: Appointment[], historyRows: AppointmentHistory[]) {
  const treatmentAppointmentIds = new Set(treatments.map((treatment) => treatment.appointment_id).filter(Boolean));
  const historyByAppointment = new Map<string, AppointmentHistory[]>();
  for (const row of historyRows) {
    if (!row.appointment_id) continue;
    historyByAppointment.set(row.appointment_id, [...(historyByAppointment.get(row.appointment_id) ?? []), row]);
  }

  const fallbacks = appointments.flatMap((appointment) => {
    if (treatmentAppointmentIds.has(appointment.id)) return [];
    const metadataTreatments = historyByAppointment.get(appointment.id)
      ?.flatMap((row) => extractMetadataTreatments(row.metadata))
      .filter((treatment) => treatment.name.trim()) ?? [];
    const treatmentList = metadataTreatments.length
      ? metadataTreatments
      : [{
          name: appointment.service_snapshot_name ?? appointment.services?.name ?? "Treatment",
          category: appointment.service_snapshot_category ?? appointment.services?.category ?? null,
          price: Number(appointment.service_snapshot_price ?? appointment.treatment_price ?? 0),
          notes: appointment.notes ?? null
        }];
    return treatmentList.map((treatment, index) => ({
      id: `appointment-treatment-${appointment.id}-${index}`,
      organisation_id: appointment.organisation_id,
      client_id: appointment.client_id,
      appointment_id: appointment.id,
      service_id: index === 0 ? appointment.service_id ?? null : null,
      treatment_name: treatment.name,
      treatment_category: treatment.category,
      treatment_date: appointment.starts_at,
      session_number: appointment.session_number,
      total_sessions: appointment.total_sessions,
      staff_summary: safeArray(appointment.appointment_staff).map((link) => link.staff?.full_name).filter(Boolean).join(", ") || appointment.staff?.full_name || null,
      notes: treatment.notes ?? appointment.notes ?? null,
      outcome: null,
      before_after_notes: (appointment as { before_after_notes?: string | null }).before_after_notes ?? null,
      payment_status: appointment.payment_status ?? "due",
      created_at: appointment.created_at,
      updated_at: appointment.updated_at
    })) as TreatmentRecord[];
  });
  return [...treatments, ...fallbacks].sort((a, b) => (safeDate(b.treatment_date)?.getTime() ?? 0) - (safeDate(a.treatment_date)?.getTime() ?? 0));
}

function extractMetadataTreatments(metadata: unknown): { name: string; category: string | null; price: number; notes: string | null }[] {
  if (!metadata || typeof metadata !== "object" || !("treatments" in metadata)) return [];
  const treatments = (metadata as { treatments?: unknown }).treatments;
  if (!Array.isArray(treatments)) return [];
  return treatments.flatMap((treatment) => {
    if (typeof treatment === "string") return [{ name: treatment, category: null, price: 0, notes: null }];
    if (!treatment || typeof treatment !== "object") return [];
    const item = treatment as { name?: unknown; category?: unknown; price?: unknown; notes?: unknown };
    return [{
      name: typeof item.name === "string" ? item.name : "",
      category: typeof item.category === "string" ? item.category : null,
      price: Number(item.price ?? 0),
      notes: typeof item.notes === "string" ? item.notes : null
    }];
  });
}
