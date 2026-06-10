import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrganisationOwnerSettings } from "@/components/settings/organisation-owner-settings";
import { SecuritySettingsForm } from "@/components/settings/security-settings-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changeOwnPassword } from "@/lib/actions/auth";
import { updateStatusColours } from "@/lib/actions/settings";
import { roleLabels } from "@/lib/auth/permissions";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { humanize } from "@/lib/utils";

export default async function SettingsPage() {
  const profile = await requireUserProfile();
  const supabase = await createSupabaseServerClient();
  const { data: organisation } = profile.organisation_id
    ? await supabase.from("organisations").select("*").eq("id", profile.organisation_id).single()
    : { data: null };
  const { data: colours } = profile.organisation_id
    ? await supabase.from("appointment_status_colours").select("*").eq("organisation_id", profile.organisation_id)
    : { data: [] };
  const { data: securitySettings } = profile.organisation_id
    ? await supabase.from("organisation_security_settings").select("*").eq("organisation_id", profile.organisation_id).single()
    : { data: null };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Organisation and account context.</p>
      </div>
      {profile.role === "organisation_owner" || profile.role === "super_admin" ? (
        <OrganisationOwnerSettings organisation={organisation} />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Organisation</h2></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row label="Name" value={organisation?.name ?? "No organisation"} />
            <Row label="Slug" value={organisation?.slug ?? "-"} />
            <Row label="Tenant ID" value={organisation?.id ?? "-"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Account</h2></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row label="Name" value={profile.full_name} />
            <Row label="Email" value={profile.email} />
            <Row label="Role" value={roleLabels[profile.role]} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Status colours</h2></CardHeader>
        <CardContent>
          <form action={updateStatusColours} className="grid gap-6">
            <ColourGroup statuses={["scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "rescheduled", "no_show", "archived"]} colours={colours ?? []} />
            <SubmitButton className="w-fit" pendingLabel="Saving colours...">Save colours</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Change password</h2></CardHeader>
        <CardContent>
          <form action={changeOwnPassword} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="Current password">
              <Input name="current_password" type="password" autoComplete="current-password" required />
            </Field>
            <Field label="New password">
              <Input name="new_password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <SubmitButton className="md:w-fit" pendingLabel="Changing...">Change password</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <SecuritySettingsForm settings={securitySettings} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ColourGroup({ statuses, colours }: { statuses: string[]; colours: { status: string; background_color: string; text_color: string }[] }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold">Appointment status</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((status) => {
          const colour = colours.find((item) => item.status === status)?.background_color ?? defaultAppointmentColour(status);
          return (
            <label key={status} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm font-medium">
              <span className="capitalize">{humanize(status)}</span>
              <input name={`appointment_colour:${status}`} type="color" defaultValue={colour} className="h-9 w-12 rounded-md border bg-transparent" />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function defaultAppointmentColour(status: string) {
  return {
    scheduled: "#eab308",
    confirmed: "#2563eb",
    arrived: "#eab308",
    in_progress: "#8b5cf6",
    completed: "#16a34a",
    cancelled: "#dc2626",
    rescheduled: "#2563eb",
    no_show: "#f97316",
    archived: "#374151"
  }[status] ?? "#64748b";
}
