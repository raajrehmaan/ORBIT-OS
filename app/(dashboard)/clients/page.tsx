import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClientDirectory } from "@/components/clients/client-directory";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/actions/clients";
import { requireUserProfile } from "@/lib/auth/session";
import { getTenantData } from "@/lib/db/queries";
import { safeArray } from "@/lib/utils";

export default async function ClientsPage() {
  const profile = await requireUserProfile();
  let data: Awaited<ReturnType<typeof getTenantData>>;
  if (profile.organisation_id) {
    data = await getTenantData(profile.organisation_id);
  } else {
    data = { clients: [], staff: [], services: [], serviceCategories: [], appointments: [], colours: [] };
  }
  const { clients, appointments } = data;
  const safeClients = safeArray(clients);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">Create and manage organisation client records.</p>
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">New client</h2></CardHeader>
        <CardContent>
          <form action={createClient} className="grid gap-4 md:grid-cols-2">
            <Field label="Full name"><Input name="full_name" required /></Field>
            <Field label="Email"><Input name="email" type="email" /></Field>
            <Field label="Phone"><Input name="phone" /></Field>
            <Field label="Notes"><Textarea name="notes" /></Field>
            <Button className="md:w-fit" type="submit">Create client</Button>
          </form>
        </CardContent>
      </Card>
      <section className="grid gap-4">
        {!safeClients.length ? (
          <EmptyState title="No clients yet" description="Create your first client to start scheduling organisation appointments." />
        ) : <ClientDirectory clients={safeClients} appointments={safeArray(appointments)} />}
      </section>
    </div>
  );
}
