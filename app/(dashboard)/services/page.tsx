import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createService, createServiceCategory, deleteService, deleteServiceCategory, updateService, updateServiceCategory } from "@/lib/actions/services";
import { requireUserProfile } from "@/lib/auth/session";
import { getTenantData } from "@/lib/db/queries";
import { cn, currencyFromPrice, normalizeCurrencyString, safeArray } from "@/lib/utils";

const serviceColors = ["teal", "blue", "violet", "amber", "rose", "slate"] as const;

const serviceColorClasses: Record<(typeof serviceColors)[number], string> = {
  teal: "bg-primary/10 text-primary border-primary/25",
  blue: "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-300",
  violet: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  amber: "bg-warning/15 text-warning-foreground border-warning/35",
  rose: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
  slate: "bg-muted text-muted-foreground border-border"
};

export default async function ServicesPage() {
  const profile = await requireUserProfile();
  let data: Awaited<ReturnType<typeof getTenantData>>;
  if (profile.organisation_id) {
    data = await getTenantData(profile.organisation_id);
  } else {
    data = { clients: [], staff: [], services: [], serviceCategories: [], appointments: [], colours: [] };
  }
  const { services, serviceCategories } = data;
  const safeServices = safeArray(services);
  const categories = safeArray(serviceCategories);
  const groupedServices = categories.map((category) => ({
    category,
    services: safeServices.filter((service) => service.category_id === category.id || service.category === category.name)
  }));
  const uncategorised = safeServices.filter((service) => !categories.some((category) => service.category_id === category.id || service.category === category.name));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="text-sm text-muted-foreground">Define bookable services for the organisation.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><h2 className="font-semibold">New service</h2></CardHeader>
          <CardContent>
            <form action={createService} className="grid gap-4 md:grid-cols-2">
              <Field label="Name"><Input name="name" required /></Field>
              <CategorySelect categories={categories} />
              <Field label="New category"><Input name="new_category" placeholder="Only if creating a new category" /></Field>
              <Field label="Duration"><Input name="duration_minutes" type="number" min="1" defaultValue="60" required /></Field>
              <Field label="Price"><Input name="price" inputMode="decimal" min="0" step="0.01" defaultValue="0" required /></Field>
              <ColorSelect defaultValue="teal" />
              <Field label="Description"><Textarea name="description" /></Field>
              <SubmitButton className="md:w-fit" pendingLabel="Creating...">Create service</SubmitButton>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">New category</h2></CardHeader>
          <CardContent>
            <form action={createServiceCategory} className="grid gap-4">
              <Field label="Category name"><Input name="name" required /></Field>
              <Field label="Description"><Textarea name="description" /></Field>
              <SubmitButton className="w-fit" pendingLabel="Saving...">Create category</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
      <section className="grid gap-4">
        {!safeServices.length ? (
          <EmptyState title="No services yet" description="Create a service inside a category folder." />
        ) : null}
        {[...groupedServices, ...(uncategorised.length ? [{ category: { id: "uncategorised", name: "Uncategorised", description: null }, services: uncategorised }] : [])].map((group) => (
          <Card key={group.category.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">{group.category.name}</h2>
                  {group.category.description ? <p className="text-sm text-muted-foreground">{group.category.description}</p> : null}
                </div>
                {group.category.id !== "uncategorised" ? (
                  <ConfirmDeleteForm action={deleteServiceCategory} id={group.category.id} label="Archive category" message={`Archive ${group.category.name}?`} requirePin />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {group.category.id !== "uncategorised" ? (
                <details className="group rounded-md border bg-background/50">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground transition group-open:border-b hover:text-foreground">
                    Edit category
                  </summary>
                  <form action={updateServiceCategory} className="grid gap-4 p-3 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
                    <input type="hidden" name="id" value={group.category.id} />
                    <Field label="Name"><Input name="name" defaultValue={group.category.name} required /></Field>
                    <Field label="Description"><Input name="description" defaultValue={group.category.description ?? ""} /></Field>
                    <SubmitButton pendingLabel="Saving...">Save category</SubmitButton>
                  </form>
                </details>
              ) : null}
              <div className="grid gap-3">
                {group.services.map((service) => (
                  <div key={service.id} className="grid gap-4 rounded-lg border bg-background/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", serviceColorClasses[service.color as keyof typeof serviceColorClasses] ?? serviceColorClasses.teal)}>
                            {service.color}
                          </span>
                          <p className="font-semibold">{service.name}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {service.duration_minutes} minutes · {currencyFromPrice(service.price)}
                        </p>
                        {service.description ? <p className="mt-2 text-sm text-muted-foreground">{service.description}</p> : null}
                      </div>
                      <ConfirmDeleteForm action={deleteService} id={service.id} label="Archive service" message={`Archive ${service.name}? Historical appointments will keep their service snapshot.`} requirePin />
                    </div>
                    <details className="group rounded-md border bg-surface">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground transition group-open:border-b hover:text-foreground">
                        Edit service
                      </summary>
                      <form action={updateService} className="grid gap-4 p-3 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr_0.7fr_0.8fr_0.8fr_1.2fr_auto] xl:items-end">
                        <input type="hidden" name="id" value={service.id} />
                        <Field label="Name"><Input name="name" defaultValue={service.name} required /></Field>
                        <CategorySelect categories={categories} defaultValue={service.category_id ?? group.category.id} />
                        <Field label="Minutes"><Input name="duration_minutes" type="number" min="1" defaultValue={service.duration_minutes} required /></Field>
                        <Field label={`Price ${currencyFromPrice(service.price)}`}><Input name="price" inputMode="decimal" min="0" step="0.01" defaultValue={normalizeCurrencyString(service.price)} required /></Field>
                        <ColorSelect defaultValue={(service.color as (typeof serviceColors)[number]) ?? "teal"} />
                        <Field label="Description"><Input name="description" defaultValue={service.description ?? ""} /></Field>
                        <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
                      </form>
                    </details>
                  </div>
                ))}
                {!group.services.length ? <p className="text-sm text-muted-foreground">No active services in this category.</p> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function CategorySelect({ categories, defaultValue }: { categories: { id: string; name: string }[]; defaultValue?: string | null }) {
  return (
    <Field label="Category">
      <Select name="category" defaultValue={defaultValue ?? categories[0]?.id ?? "__new__"}>
        {!categories.length ? <option value="__uncategorised__">Uncategorised</option> : null}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
        <option value="__new__">Create new category</option>
      </Select>
    </Field>
  );
}

function ColorSelect({ defaultValue }: { defaultValue: (typeof serviceColors)[number] }) {
  return (
    <Field label="Color tag">
      <Select name="color" defaultValue={defaultValue}>
        {serviceColors.map((color) => (
          <option key={color} value={color}>{color}</option>
        ))}
      </Select>
    </Field>
  );
}
