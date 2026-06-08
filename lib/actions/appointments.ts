"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/action-result";
import { validateAdminPin } from "@/lib/security/admin-pin";
import { normalizeCurrencyNumber, safeArray } from "@/lib/utils";
import type { AppointmentStatus, Json, PaymentStatus, TablesInsert, TablesUpdate } from "@/types/database";

const appointmentSchema = z.object({
  client_id: z.string().uuid(),
  staff_id: z.string().uuid().optional().or(z.literal("")),
  staff_id_2: z.string().uuid().optional().or(z.literal("")),
  service_id: z.string().uuid().optional().or(z.literal("")),
  starts_at: z.string().min(1).refine(isValidDateTime, "Invalid start time"),
  ends_at: z.string().min(1).refine(isValidDateTime, "Invalid end time"),
  status: z.enum(["scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "rescheduled", "no_show", "archived"]),
  payment_status: z.enum(["paid", "partial", "deposit", "due", "refunded"]),
  treatment_price: z.preprocess(normalizeCurrencyNumber, z.number().min(0)),
  deposit_amount: z.preprocess(normalizeCurrencyNumber, z.number().min(0)),
  amount_paid: z.preprocess(normalizeCurrencyNumber, z.number().min(0)),
  balance_due: z.preprocess(normalizeCurrencyNumber, z.number().min(0)),
  session_number: z.coerce.number().int().positive().optional().or(z.literal("")),
  total_sessions: z.coerce.number().int().positive().optional().or(z.literal("")),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  before_after_notes: z.string().optional()
}).refine((values) => new Date(values.ends_at) > new Date(values.starts_at), {
  message: "End time must be after start time",
  path: ["ends_at"]
}).refine((values) => !values.staff_id || !values.staff_id_2 || values.staff_id !== values.staff_id_2, {
  message: "Staff 1 and Staff 2 must be different",
  path: ["staff_id_2"]
});

export async function createAppointment(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "appointments")) throw new Error("Not authorised");
  const values = appointmentSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  await assertAppointmentRelationsBelongToOrganisation(supabase, profile.organisation_id, values);

  const treatments = await resolveTreatmentBlocks(supabase, profile.organisation_id, formData, values);
  const primaryTreatment = treatments[0];
  const { data: staffRows } = await supabase.from("staff").select("id, full_name").eq("organisation_id", profile.organisation_id);
  const staffSummary = [values.staff_id, values.staff_id_2, ...treatments.map((treatment) => treatment.staff_id)]
    .filter(Boolean)
    .map((staffId) => staffRows?.find((member) => member.id === staffId)?.full_name)
    .filter(Boolean)
    .join(", ");

  const appointmentPayload: TablesInsert<"appointments"> = {
    organisation_id: profile.organisation_id,
    client_id: values.client_id,
    staff_id: values.staff_id || null,
    secondary_staff_id: values.staff_id_2 || null,
    service_id: primaryTreatment.service_id || null,
    service_snapshot_name: primaryTreatment.name,
    service_snapshot_category: primaryTreatment.category,
    service_snapshot_price: primaryTreatment.price,
    starts_at: new Date(values.starts_at).toISOString(),
    ends_at: new Date(values.ends_at).toISOString(),
    original_starts_at: new Date(values.starts_at).toISOString(),
    original_ends_at: new Date(values.ends_at).toISOString(),
    status: values.status as AppointmentStatus,
    appointment_status: values.status as AppointmentStatus,
    notes: values.notes || null,
    treatment_notes: values.notes || null,
    no_show: values.status === "no_show",
    session_number: values.session_number || null,
    total_sessions: values.total_sessions || null,
    treatment_price: values.treatment_price,
    deposit_amount: values.deposit_amount,
    amount_paid: values.amount_paid,
    balance_due: values.balance_due,
    payment_status: values.payment_status as PaymentStatus,
    completed_at: values.status === "completed" ? new Date().toISOString() : null,
    cancelled_at: values.status === "cancelled" ? new Date().toISOString() : null,
    cancellation_reason: values.status === "cancelled" ? "Created as cancelled" : null
  };

  const { data: appointment, error } = await insertAppointmentWithFallback(supabase, appointmentPayload);

  if (error) throw new Error(`Appointment could not be created: ${error.message}`);
  if (!appointment) throw new Error("Appointment could not be created");

  const staffLinks = Array.from(new Set([values.staff_id, values.staff_id_2, ...treatments.map((treatment) => treatment.staff_id)].filter(Boolean))).map((staffId, index) => ({
    organisation_id: profile.organisation_id!,
    appointment_id: appointment.id,
    staff_id: staffId as string,
    staff_order: index + 1
  }));
  if (staffLinks.length) {
    const { error: staffError } = await supabase.from("appointment_staff").insert(staffLinks);
    if (staffError && !isMissingTableError(staffError, "appointment_staff")) throw new Error(`Appointment staff could not be assigned: ${staffError.message}`);
  }

  const treatmentPayload = treatments.map((treatment) => ({
    organisation_id: profile.organisation_id!,
    client_id: values.client_id,
    appointment_id: appointment.id,
    service_id: treatment.service_id || null,
    treatment_name: treatment.name,
    treatment_category: treatment.category,
    treatment_date: appointment.starts_at,
    session_number: values.session_number || null,
    total_sessions: values.total_sessions || null,
    staff_summary: treatment.staff_id ? ((staffRows?.find((member) => member.id === treatment.staff_id)?.full_name ?? staffSummary) || null) : staffSummary || null,
    notes: [treatment.notes, values.notes].filter(Boolean).join(" · ") || null,
    outcome: values.outcome || null,
    before_after_notes: values.before_after_notes || null,
    payment_status: values.payment_status as PaymentStatus
  }));
  const { data: insertedTreatments, error: treatmentError } = await supabase.from("treatment_records").insert(treatmentPayload).select("id");
  if (treatmentError && !isMissingTableError(treatmentError, "treatment_records")) {
    await supabase.from("audit_logs").insert({
      organisation_id: profile.organisation_id,
      user_id: profile.id,
      entity_type: "treatment_records",
      entity_id: appointment.id,
      action: "treatment_write_failed",
      metadata: { error: treatmentError.message, treatments: treatmentPayload.map((treatment) => treatment.treatment_name) }
    });
  }

  const paymentPayload = {
    organisation_id: profile.organisation_id,
    client_id: values.client_id,
    appointment_id: appointment.id,
    treatment_record_id: insertedTreatments?.[0]?.id ?? null,
    treatment_price: values.treatment_price || treatments.reduce((sum, treatment) => sum + treatment.price, 0),
    deposit_amount: values.deposit_amount,
    amount_paid: values.amount_paid,
    balance_due: values.balance_due,
    payment_status: values.payment_status as PaymentStatus,
    paid_at: values.payment_status === "paid" ? new Date().toISOString() : null
  };
  const { error: paymentError } = await supabase.from("payments").insert(paymentPayload);
  if (paymentError && !isMissingTableError(paymentError, "payments")) {
    await supabase.from("audit_logs").insert({
      organisation_id: profile.organisation_id,
      user_id: profile.id,
      entity_type: "payments",
      entity_id: appointment.id,
      action: "payment_write_failed",
      metadata: { error: paymentError.message, amount_paid: values.amount_paid, balance_due: values.balance_due }
    });
  }

  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "appointment",
    entity_id: appointment.id,
    action: "created",
    metadata: { client_id: values.client_id, service_id: primaryTreatment.service_id || null, treatments: treatments.map((treatment) => treatment.name) }
  });
  await insertAppointmentHistory(supabase, {
    organisation_id: profile.organisation_id,
    appointment_id: appointment.id,
    client_id: values.client_id,
    action: "created",
    appointment_status: values.status as AppointmentStatus,
    payment_status: values.payment_status as PaymentStatus,
    service_snapshot_name: primaryTreatment.name,
    service_snapshot_price: primaryTreatment.price,
    service_snapshot_category: primaryTreatment.category,
    metadata: {
      staff_summary: staffSummary || null,
      treatments: treatments.map((treatment) => ({
        name: treatment.name,
        category: treatment.category,
        price: treatment.price,
        duration: treatment.duration,
        notes: treatment.notes,
        staff_id: treatment.staff_id
      }))
    },
    created_by: profile.id
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

type TreatmentBlock = {
  service_id: string | null;
  name: string;
  category: string | null;
  price: number;
  duration: number | null;
  notes: string | null;
  staff_id: string | null;
};
type ServiceLookup = { id: string; name: string; category: string | null; price: number | null; duration_minutes: number | null };

async function resolveTreatmentBlocks(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organisationId: string,
  formData: FormData,
  values: z.infer<typeof appointmentSchema>
): Promise<TreatmentBlock[]> {
  const blocks = [0, 1, 2].map((index) => {
    const serviceId = String(formData.get(index === 0 ? "service_id" : `treatment_${index}_service_id`) ?? "").trim();
    const manualName = String(formData.get(index === 0 ? "manual_treatment_name" : `treatment_${index}_manual_name`) ?? "").trim();
    const price = normalizeCurrencyNumber(formData.get(`treatment_${index}_price`));
    const rawDuration = String(formData.get(`treatment_${index}_duration`) ?? "").trim();
    const duration = rawDuration ? Number(rawDuration) : null;
    const notes = String(formData.get(`treatment_${index}_notes`) ?? "").trim();
    const staffId = String(formData.get(`treatment_${index}_staff_id`) ?? "").trim();
    return { serviceId, manualName, price, duration: Number.isFinite(duration) ? duration : null, notes, staffId };
  }).filter((block, index) => index === 0 || block.serviceId || block.manualName);

  const serviceIds = blocks.map((block) => block.serviceId).filter(Boolean);
  const { data: services } = serviceIds.length
    ? await supabase.from("services").select("id, name, category, price, duration_minutes").eq("organisation_id", organisationId).in("id", serviceIds)
    : { data: [] as ServiceLookup[] };
  const serviceMap = new Map(safeArray(services as ServiceLookup[] | null).map((service) => [service.id, service]));

  const resolved = blocks.map((block, index) => {
    const service = block.serviceId ? serviceMap.get(block.serviceId) : null;
    const name = service?.name ?? (block.manualName || (index === 0 ? "Custom Treatment" : ""));
    return {
      service_id: service?.id ?? null,
      name,
      category: service?.category ?? (service ? "Uncategorised" : "Manual"),
      price: block.price || Number(service?.price ?? 0),
      duration: block.duration || Number(service?.duration_minutes ?? 0) || null,
      notes: block.notes || null,
      staff_id: block.staffId || null
    };
  }).filter((block) => block.name.trim());

  return resolved.length ? resolved : [{
    service_id: null,
    name: "Custom Treatment",
    category: "Manual",
    price: values.treatment_price,
    duration: null,
    notes: values.notes || null,
    staff_id: values.staff_id || null
  }];
}

export async function updateAppointment(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "appointments")) throw new Error("Not authorised");
  const values = appointmentSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  await assertAppointmentRelationsBelongToOrganisation(supabase, profile.organisation_id, values);
  const { data: service } = values.service_id
    ? await supabase.from("services").select("name, category, price").eq("id", values.service_id).eq("organisation_id", profile.organisation_id).single()
    : { data: null };
  const { data: existingAppointmentForUpdate } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", String(formData.get("id")))
    .eq("organisation_id", profile.organisation_id)
    .single();

  const appointmentPayload: TablesUpdate<"appointments"> = {
    client_id: values.client_id,
    staff_id: values.staff_id || null,
    secondary_staff_id: values.staff_id_2 || null,
    service_id: values.service_id || null,
    service_snapshot_name: service?.name ?? null,
    service_snapshot_category: service?.category ?? null,
    service_snapshot_price: service?.price ?? values.treatment_price,
    starts_at: new Date(values.starts_at).toISOString(),
    ends_at: new Date(values.ends_at).toISOString(),
    status: values.status as AppointmentStatus,
    appointment_status: values.status as AppointmentStatus,
    notes: values.notes || null,
    treatment_notes: values.notes || null,
    no_show: values.status === "no_show",
    session_number: values.session_number || null,
    total_sessions: values.total_sessions || null,
    treatment_price: values.treatment_price,
    deposit_amount: values.deposit_amount,
    amount_paid: values.amount_paid,
    balance_due: values.balance_due,
    payment_status: values.payment_status as PaymentStatus,
    completed_at: values.status === "completed" ? new Date().toISOString() : null
  };

  const { error } = await updateAppointmentWithFallback(supabase, String(formData.get("id")), profile.organisation_id, appointmentPayload);

  if (error) throw new Error(`Appointment could not be updated: ${error.message}`);
  await supabase.from("audit_logs").insert({ organisation_id: profile.organisation_id, user_id: profile.id, entity_type: "appointment", entity_id: String(formData.get("id")), action: "edited" });
  await insertAppointmentHistory(supabase, {
    organisation_id: profile.organisation_id,
    appointment_id: String(formData.get("id")),
    client_id: values.client_id,
     action:
  values.status === "rescheduled"
    ? "rescheduled"
    : values.status === "completed"
    ? "completed"
    : values.status === existingAppointmentForUpdate?.status
    ? "minor_update"
    : "edited",
    appointment_status: values.status as AppointmentStatus,
    payment_status: values.payment_status as PaymentStatus,
    service_snapshot_name: service?.name ?? null,
    service_snapshot_price: service?.price ?? values.treatment_price,
    service_snapshot_category: service?.category ?? null,
    metadata: { starts_at: values.starts_at, ends_at: values.ends_at },
    created_by: profile.id
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function deleteAppointment(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "appointments")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "appointment_cancel");
  if (!pinCheck.valid) return fail(pinCheck.message);
  const supabase = await createSupabaseServerClient();
  const appointmentId = String(formData.get("id"));
  const { data: existingAppointment } = await supabase
    .from("appointments")
    .select("client_id, service_snapshot_name, service_snapshot_price, service_snapshot_category, payment_status")
    .eq("id", appointmentId)
    .eq("organisation_id", profile.organisation_id)
    .single();
  const cancellationReason = String(formData.get("cancellation_reason") ?? "").trim();
  const payload: TablesUpdate<"appointments"> = {
    status: "cancelled" as AppointmentStatus,
    appointment_status: "cancelled" as AppointmentStatus,
    cancelled_at: new Date().toISOString(),
    cancelled_by: profile.id,
    cancellation_reason: cancellationReason || "Cancelled by admin",
    no_show: false
  };

  let { error } = await updateAppointmentWithFallback(supabase, appointmentId, profile.organisation_id, payload);

  if (isMissingColumnError(error, "cancelled_at") || isMissingColumnError(error, "cancelled_by") || isMissingColumnError(error, "cancellation_reason")) {
    const retry = await supabase
      .from("appointments")
      .update({ status: "cancelled" as AppointmentStatus })
      .eq("id", appointmentId)
      .eq("organisation_id", profile.organisation_id);
    error = retry.error;
  }

  if (error) return fail(`Appointment could not be cancelled: ${error.message}`);
  await supabase.from("audit_logs").insert({ organisation_id: profile.organisation_id, user_id: profile.id, entity_type: "appointment", entity_id: appointmentId, action: "cancelled", metadata: { reason: payload.cancellation_reason } });
  await insertAppointmentHistory(supabase, {
    organisation_id: profile.organisation_id,
    appointment_id: appointmentId,
    client_id: existingAppointment?.client_id ?? null,
    action: "cancelled",
    appointment_status: "cancelled" as AppointmentStatus,
    payment_status: existingAppointment?.payment_status ?? null,
    service_snapshot_name: existingAppointment?.service_snapshot_name ?? null,
    service_snapshot_price: existingAppointment?.service_snapshot_price ?? null,
    service_snapshot_category: existingAppointment?.service_snapshot_category ?? null,
    metadata: { reason: payload.cancellation_reason },
    created_by: profile.id
  });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return ok("Appointment cancelled.");
}

export async function rescheduleAppointment(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "appointments")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "appointment_reschedule");
  if (!pinCheck.valid) return fail(pinCheck.message);

  const appointmentId = String(formData.get("id"));
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");
  if (!isValidDateTime(startsAt) || !isValidDateTime(endsAt)) return fail("Choose a valid new date and time.");
  if (new Date(endsAt) <= new Date(startsAt)) return fail("End time must be after start time.");

  const supabase = await createSupabaseServerClient();
  const { data: existingAppointment } = await supabase
    .from("appointments")
    .select("client_id, service_snapshot_name, service_snapshot_price, service_snapshot_category, payment_status")
    .eq("id", appointmentId)
    .eq("organisation_id", profile.organisation_id)
    .single();

  const { error } = await updateAppointmentWithFallback(supabase, appointmentId, profile.organisation_id, {
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    status: "rescheduled" as AppointmentStatus,
    appointment_status: "rescheduled" as AppointmentStatus
  });
  if (error) return fail(`Appointment could not be rescheduled: ${error.message}`);

  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "appointment",
    entity_id: appointmentId,
    action: "rescheduled",
    metadata: { starts_at: startsAt, ends_at: endsAt }
  });
  await insertAppointmentHistory(supabase, {
    organisation_id: profile.organisation_id,
    appointment_id: appointmentId,
    client_id: existingAppointment?.client_id ?? null,
    action: "rescheduled",
    appointment_status: "rescheduled" as AppointmentStatus,
    payment_status: existingAppointment?.payment_status ?? null,
    service_snapshot_name: existingAppointment?.service_snapshot_name ?? null,
    service_snapshot_price: existingAppointment?.service_snapshot_price ?? null,
    service_snapshot_category: existingAppointment?.service_snapshot_category ?? null,
    metadata: { starts_at: startsAt, ends_at: endsAt },
    created_by: profile.id
  });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return ok("Future session rescheduled.");
}

export async function markAppointmentNoShow(formData: FormData) {
  const profile = await requireUserProfile();
  if (!profile.organisation_id || !canManage(profile.role, "appointments")) return fail("Not authorised.");
  const pinCheck = await validateAdminPin(profile, formData.get("admin_pin"), "appointment_no_show");
  if (!pinCheck.valid) return fail(pinCheck.message);

  const appointmentId = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { data: existingAppointment } = await supabase
    .from("appointments")
    .select("client_id, service_snapshot_name, service_snapshot_price, service_snapshot_category, payment_status")
    .eq("id", appointmentId)
    .eq("organisation_id", profile.organisation_id)
    .single();
  const { error } = await updateAppointmentWithFallback(supabase, appointmentId, profile.organisation_id, {
    status: "no_show" as AppointmentStatus,
    appointment_status: "no_show" as AppointmentStatus,
    no_show: true
  });
  if (error) return fail(`Appointment could not be marked no-show: ${error.message}`);

  await supabase.from("audit_logs").insert({
    organisation_id: profile.organisation_id,
    user_id: profile.id,
    entity_type: "appointment",
    entity_id: appointmentId,
    action: "no_show"
  });
  await insertAppointmentHistory(supabase, {
    organisation_id: profile.organisation_id,
    appointment_id: appointmentId,
    client_id: existingAppointment?.client_id ?? null,
    action: "no_show",
    appointment_status: "no_show" as AppointmentStatus,
    payment_status: existingAppointment?.payment_status ?? null,
    service_snapshot_name: existingAppointment?.service_snapshot_name ?? null,
    service_snapshot_price: existingAppointment?.service_snapshot_price ?? null,
    service_snapshot_category: existingAppointment?.service_snapshot_category ?? null,
    metadata: {},
    created_by: profile.id
  });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return ok("Future session marked no-show.");
}

async function assertAppointmentRelationsBelongToOrganisation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organisationId: string,
  values: z.infer<typeof appointmentSchema>
) {
  const [client, staff, secondStaff, service] = await Promise.all([
    supabase.from("clients").select("id").eq("id", values.client_id).eq("organisation_id", organisationId).single(),
    values.staff_id ? supabase.from("staff").select("id").eq("id", values.staff_id).eq("organisation_id", organisationId).single() : Promise.resolve({ data: null, error: null }),
    values.staff_id_2 ? supabase.from("staff").select("id").eq("id", values.staff_id_2).eq("organisation_id", organisationId).single() : Promise.resolve({ data: null, error: null }),
    values.service_id ? supabase.from("services").select("id").eq("id", values.service_id).eq("organisation_id", organisationId).single() : Promise.resolve({ data: null, error: null })
  ]);

  if (client.error || !client.data) throw new Error("Client does not belong to this organisation");
  if (staff.error) throw new Error("Staff member does not belong to this organisation");
  if (secondStaff.error) throw new Error("Second staff member does not belong to this organisation");
  if (service.error) throw new Error("Service does not belong to this organisation");
}

function isValidDateTime(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isMissingColumnError(error: { message?: string; code?: string } | null, column: string) {
  if (!error) return false;
  return error.code === "PGRST204" || error.message?.includes(`'${column}' column`);
}

async function insertAppointmentWithFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: TablesInsert<"appointments">
) {
  const strippedPayload = { ...payload };
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await supabase.from("appointments").insert(strippedPayload).select("*").single();
    const missingColumn = extractMissingColumn(result.error);
    if (!missingColumn || !(missingColumn in strippedPayload)) return result;
    delete strippedPayload[missingColumn as keyof typeof strippedPayload];
  }
  return supabase.from("appointments").insert(strippedPayload).select("*").single();
}

async function updateAppointmentWithFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  organisationId: string,
  payload: TablesUpdate<"appointments">
) {
  const strippedPayload = { ...payload };
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await supabase.from("appointments").update(strippedPayload).eq("id", id).eq("organisation_id", organisationId);
    const missingColumn = extractMissingColumn(result.error);
    if (!missingColumn || !(missingColumn in strippedPayload)) return result;
    delete strippedPayload[missingColumn as keyof typeof strippedPayload];
  }
  return supabase.from("appointments").update(strippedPayload).eq("id", id).eq("organisation_id", organisationId);
}

function extractMissingColumn(error: { message?: string; code?: string } | null) {
  if (!error || error.code !== "PGRST204") return null;
  return error.message?.match(/'([^']+)' column/)?.[1] ?? null;
}

function isMissingTableError(error: { message?: string; code?: string } | null, table: string) {
  if (!error) return false;
  return error.message?.includes(table) || error.code === "42P01" || error.code === "PGRST205";
}

async function insertAppointmentHistory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: {
    organisation_id: string;
    appointment_id: string;
    client_id: string | null;
    action: string;
    appointment_status: AppointmentStatus | null;
    payment_status: PaymentStatus | null;
    service_snapshot_name: string | null;
    service_snapshot_price: number | null;
    service_snapshot_category: string | null;
    metadata: Json;
    created_by: string;
  }
) {
  const { error } = await supabase.from("appointment_history").insert(payload);
  if (error && !isMissingTableError(error, "appointment_history")) {
    await supabase.from("audit_logs").insert({
      organisation_id: payload.organisation_id,
      user_id: payload.created_by,
      entity_type: "appointment_history",
      entity_id: payload.appointment_id,
      action: "history_write_failed",
      metadata: { error: error.message, intended_action: payload.action }
    });
  }
}
