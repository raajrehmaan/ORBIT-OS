"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateClient, deleteClient } from "@/lib/actions/clients";
import { humanize, safeArray, safeDate, safeLower, safeText, safeUpper } from "@/lib/utils";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function ClientDirectory({ clients, appointments }: { clients: Client[]; appointments: Appointment[] }) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const safeClients = safeArray(clients);
  const safeAppointments = safeArray(appointments);
  const availableLetters = useMemo(() => new Set(safeClients.map((client) => safeUpper(client.full_name).charAt(0)).filter(Boolean)), [safeClients]);
  const filteredClients = useMemo(() => {
    const normalizedQuery = safeLower(query.trim());
    if (!normalizedQuery && !activeLetter) return [];
    return safeClients
      .filter((client) => {
        if (activeLetter && safeUpper(client.full_name).charAt(0) !== activeLetter) return false;
        if (!normalizedQuery) return Boolean(activeLetter);
        return [client.full_name, client.email, client.phone]
          .filter(Boolean)
          .some((value) => safeLower(value).includes(normalizedQuery));
      })
      .sort((a, b) => safeText(a.full_name).localeCompare(safeText(b.full_name)));
  }, [activeLetter, query, safeClients]);
  const appointmentSummary = useMemo(() => {
    const now = Date.now();
    return new Map(safeClients.map((client) => {
      const clientAppointments = safeAppointments
        .filter((appointment) => appointment.client_id === client.id)
        .sort((a, b) => (safeDate(a.starts_at)?.getTime() ?? 0) - (safeDate(b.starts_at)?.getTime() ?? 0));
      const past = clientAppointments.filter((appointment) => (safeDate(appointment.starts_at)?.getTime() ?? 0) < now);
      const future = clientAppointments.filter((appointment) => (safeDate(appointment.starts_at)?.getTime() ?? 0) >= now);
      return [client.id, {
        last: past.at(-1),
        next: future[0],
        paymentStatus: [...clientAppointments].reverse().find((appointment) => appointment.payment_status)?.payment_status ?? "due"
      }];
    }));
  }, [safeAppointments, safeClients]);

  return (
    <section className="grid gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clients"
          className="pl-9"
          autoComplete="off"
        />
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-surface p-2">
        {letters.map((letter) => {
          const available = availableLetters.has(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={!available}
              onClick={() => setActiveLetter(letter)}
              className={
                activeLetter === letter
                  ? "h-8 min-w-8 rounded-md bg-primary text-xs font-bold text-primary-foreground"
                  : "h-8 min-w-8 rounded-md text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              }
            >
              {letter}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3">
        {filteredClients.map((client) => (
          <Card key={client.id}>
            <CardContent className="grid gap-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/clients/${client.id}`} className="font-semibold text-primary hover:underline">{client.full_name}</Link>
                  <p className="text-sm text-muted-foreground">{client.phone ?? "No phone"}</p>
                </div>
                <ConfirmDeleteForm
                  action={deleteClient}
                  id={client.id}
                  label="Delete"
                  message={`Delete ${client.full_name}?`}
                  requirePin
                />
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span className="rounded-md bg-muted px-2 py-1">Payment: {humanize(appointmentSummary.get(client.id)?.paymentStatus, "due")}</span>
                <span className="rounded-md bg-muted px-2 py-1">Last: {formatDate(appointmentSummary.get(client.id)?.last?.starts_at)}</span>
                <span className="rounded-md bg-muted px-2 py-1">Next: {formatDate(appointmentSummary.get(client.id)?.next?.starts_at)}</span>
              </div>
              {client.notes ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{client.notes}</p> : null}
              <details className="group rounded-md border bg-background/50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground transition group-open:border-b hover:text-foreground">
                  Edit client details
                </summary>
                <form action={updateClient} className="grid gap-4 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_auto] xl:items-end">
                  <input type="hidden" name="id" value={client.id} />
                  <Field label="Name"><Input name="full_name" defaultValue={client.full_name} required /></Field>
                  <Field label="Email"><Input name="email" type="email" defaultValue={client.email ?? ""} /></Field>
                  <Field label="Phone"><Input name="phone" defaultValue={client.phone ?? ""} /></Field>
                  <Field label="Notes"><Input name="notes" defaultValue={client.notes ?? ""} /></Field>
                  <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
                </form>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
      {!filteredClients.length ? (
        <div className="rounded-lg border bg-surface p-6 text-center">
          <p className="font-semibold">{query || activeLetter ? "No clients found" : "Search or choose a letter"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query || activeLetter ? "Try a different name, email, phone, or alphabet filter." : "Client records stay hidden until you search or choose A-Z."}
          </p>
          {query || activeLetter ? <Button variant="ghost" className="mt-3" onClick={() => { setQuery(""); setActiveLetter(null); }}>Clear filters</Button> : null}
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value?: string) {
  const date = safeDate(value);
  if (!date) return "None";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
