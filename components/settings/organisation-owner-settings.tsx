import { updateOrganisationSettings, uploadOrganisationLogo } from "@/lib/actions/organisation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Json } from "@/types/database";

type Organisation = {
  id: string;
  name: string;
  slug: string;
  business_info?: Json;
  logo_path?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
};

export function OrganisationOwnerSettings({ organisation }: { organisation: Organisation | null }) {
  const businessInfo = readBusinessInfo(organisation?.business_info);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Organisation Owner</h2>
        <p className="text-sm text-muted-foreground">Identity, branding, security, audit, and backup controls.</p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form action={async (formData) => { "use server"; await updateOrganisationSettings(formData); }} className="grid gap-4 md:grid-cols-2">
          <Field label="Organisation name"><Input name="name" defaultValue={organisation?.name ?? ""} required /></Field>
          <Field label="Organisation slug"><Input name="slug" defaultValue={organisation?.slug ?? ""} required /></Field>
          <Field label="Clinic email"><Input name="clinic_email" type="email" defaultValue={businessInfo.clinic_email} /></Field>
          <Field label="Clinic phone"><Input name="clinic_phone" defaultValue={businessInfo.clinic_phone} /></Field>
          <Field label="Primary colour"><Input name="brand_primary_color" type="color" defaultValue={organisation?.brand_primary_color ?? "#0f766e"} /></Field>
          <Field label="Secondary colour"><Input name="brand_secondary_color" type="color" defaultValue={organisation?.brand_secondary_color ?? "#334155"} /></Field>
          <Field label="Business information"><Textarea name="address" defaultValue={businessInfo.address} /></Field>
          <SubmitButton className="md:w-fit" pendingLabel="Saving...">Save organisation</SubmitButton>
        </form>
        <form action={async (formData) => { "use server"; await uploadOrganisationLogo(formData); }} className="grid gap-4 rounded-md border p-4 md:grid-cols-[1fr_0.7fr_auto] md:items-end">
          <Field label="Logo"><Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></Field>
          <Field label="Admin PIN"><Input name="admin_pin" type="password" inputMode="numeric" autoComplete="off" /></Field>
          <SubmitButton pendingLabel="Uploading...">Upload logo</SubmitButton>
        </form>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <InfoBlock title="Owner Security" value="Admin PIN, recovery codes, and owner password controls remain in Security Settings." />
          <InfoBlock title="Audit Logs" value="Organisation, logo, PIN, and photo events are recorded in audit logs." />
          <InfoBlock title="Backup / Export" value="Export infrastructure is reserved here and intentionally non-destructive." />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/50 p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{value}</p>
    </div>
  );
}

function readBusinessInfo(value: Json | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { clinic_email: "", clinic_phone: "", address: "" };
  const record = value as Record<string, unknown>;
  return {
    clinic_email: typeof record.clinic_email === "string" ? record.clinic_email : "",
    clinic_phone: typeof record.clinic_phone === "string" ? record.clinic_phone : "",
    address: typeof record.address === "string" ? record.address : ""
  };
}
