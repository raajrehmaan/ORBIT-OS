import { notFound } from "next/navigation";
import { ClientPhotoHistory } from "@/components/clients/client-photo-history";
import { FutureSessionActions } from "@/components/clients/future-session-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUserProfile } from "@/lib/auth/session";
import { getClientMasterFile } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currencyFromPrice, humanize, safeArray, safeDate } from "@/lib/utils";

export default async function ClientProfilePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUserProfile();

  if (!profile.organisation_id) notFound();

  const { id } = await params;

  const data = await getClientMasterFile(
    profile.organisation_id,
    id
  );

  if (!data.client) notFound();

  const photos = await getClientPhotos(
    profile.organisation_id,
    id
  );

  const historicalRecords = await getClientHistory(id);

  const appointments = safeArray(data.appointments);
  const payments = safeArray(data.payments);
  const treatments = safeArray(data.treatments);
  const appointmentHistory = safeArray(
    data.appointmentHistory
  );

  const historyByAppointment = new Map(
    appointmentHistory
      .filter((history) => history.appointment_id)
      .map((history) => [
        history.appointment_id,
        history
      ])
  );

  const completed = appointments.filter(
    (appointment) =>
      appointmentStatus(appointment) === "completed"
  ).length;

  const cancelled = appointments.filter(
    (appointment) =>
      ["cancelled", "archived"].includes(
        appointmentStatus(appointment)
      )
  ).length;

  const noShows = appointments.filter(
    (appointment) =>
      appointmentStatus(appointment) === "no_show"
  ).length;

  const upcoming = appointments.filter(
    (appointment) => {
      const startsAt = safeDate(
        appointment.starts_at
      );

      return (
        startsAt &&
        startsAt >= new Date() &&
        ![
          "cancelled",
          "archived",
          "no_show",
          "completed"
        ].includes(
          appointmentStatus(appointment)
        )
      );
    }
  ).length;

  const futureSessions = appointments.filter(
    (appointment) => {
      const startsAt = safeDate(
        appointment.starts_at
      );

      return (
        startsAt &&
        startsAt >= new Date() &&
        ![
          "cancelled",
          "archived",
          "no_show",
          "completed"
        ].includes(
          appointmentStatus(appointment)
        )
      );
    }
  );

  const activeAppointmentIds = new Set(
    appointments
      .filter(
        (appointment) =>
          ![
            "cancelled",
            "archived",
            "no_show"
          ].includes(
            appointmentStatus(appointment)
          )
      )
      .map((appointment) => appointment.id)
  );

  const totalSpent = payments
    .filter(
      (payment) =>
        !payment.appointment_id ||
        activeAppointmentIds.has(
          payment.appointment_id
        )
    )
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_paid ?? 0),
      0
    );

  const totalDue = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.balance_due ?? 0),
    0
  );

  const deposits = payments.reduce(
    (sum, payment) =>
      sum +
      Number(payment.deposit_amount ?? 0),
    0
  );

  const refunds = payments
    .filter(
      (payment) =>
        payment.payment_status === "refunded"
    )
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_paid ?? 0),
      0
    );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {data.client.full_name}
        </h1>

        <p className="text-sm text-muted-foreground">
          Permanent client master file
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">
              Personal
            </h2>
          </CardHeader>

          <CardContent className="grid gap-2 text-sm">
            <p>
              Phone:{" "}
              {data.client.phone ??
                "Not recorded"}
            </p>

            <p>
              Email:{" "}
              {data.client.email ??
                "Not recorded"}
            </p>

            <p className="text-muted-foreground">
              {data.client.notes ??
                "No notes"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">
              Financial
            </h2>
          </CardHeader>

          <CardContent className="grid gap-2 text-sm">
            <p>
              Total spent:{" "}
              {currencyFromPrice(totalSpent)}
            </p>

            <p>
              Total due:{" "}
              {currencyFromPrice(totalDue)}
            </p>

            <p>
              Deposits:{" "}
              {currencyFromPrice(deposits)}
            </p>

            <p>
              Refunds:{" "}
              {currencyFromPrice(refunds)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">
              Appointments
            </h2>
          </CardHeader>

          <CardContent className="grid gap-2 text-sm">
            <p>
              Total: {appointments.length}
            </p>

            <p>
              Completed: {completed}
            </p>

            <p>
              Cancelled: {cancelled}
            </p>

            <p>No shows: {noShows}</p>

            <p>Upcoming: {upcoming}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">
            Historical Records
          </h2>
        </CardHeader>

        <CardContent className="grid gap-3">
          {historicalRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No historical records found.
            </p>
          ) : (
            historicalRecords.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border border-blue-500/30 bg-blue-50/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {record.treatment_name}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {record.treatment_category ??
                        "Historical Treatment"}
                    </p>
                  </div>

                  <span className="rounded-md border border-blue-500/30 px-2 py-1 text-xs font-semibold">
                    HISTORICAL
                  </span>
                </div>

                <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>
                    Date:{" "}
                    {formatHistoryDate(
                      record.session_date
                    )}
                  </p>

                  <p>
                    Time:{" "}
                    {record.session_time ??
                      "--:--"}
                  </p>

                  <p>
                    Practitioner:{" "}
                    {record.practitioner_name ??
                      "Unknown"}
                  </p>

                  <p>
                    Paid:{" "}
                    {currencyFromPrice(
                      Number(
                        record.amount_paid ?? 0
                      )
                    )}
                  </p>
                </div>

                {record.notes ? (
                  <p className="mt-3 text-sm">
                    {record.notes}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ClientPhotoHistory
        clientId={id}
        photos={photos}
      />
    </div>
  );
}

async function getClientPhotos(
  organisationId: string,
  clientId: string
) {
  const supabase =
    await createSupabaseServerClient();

  const { data } = await supabase
    .from("client_photos")
    .select(
      "id, client_id, category, notes, created_at, original_filename, storage_path"
    )
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", {
      ascending: false
    });

  return Promise.all(
    safeArray(data).map(async (photo) => {
      const signed = await supabase.storage
        .from("organisation-assets")
        .createSignedUrl(
          photo.storage_path,
          60 * 10
        );

      return {
        id: photo.id,
        client_id: photo.client_id,
        category: photo.category,
        notes: photo.notes,
        created_at: photo.created_at,
        original_filename:
          photo.original_filename,
        signedUrl:
          signed.data?.signedUrl ?? null
      };
    })
  );
}

async function getClientHistory(
  clientId: string
) {
  const supabase =
    await createSupabaseServerClient();

  const { data } = await supabase
    .from("client_history")
    .select("*")
    .eq("client_id", clientId)
    .order("session_date", {
      ascending: false
    });

  return safeArray(data);
}

function appointmentStatus(
  appointment: {
    appointment_status?: string | null;
    status?: string | null;
  }
) {
  return (
    appointment.appointment_status ??
    appointment.status ??
    "scheduled"
  );
}

function formatHistoryDate(
  value: unknown
) {
  const date = safeDate(value);

  if (!date) return "Date TBC";

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}
