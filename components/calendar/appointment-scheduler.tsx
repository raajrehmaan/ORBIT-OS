"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn, humanize, normalizeCurrencyString, safeArray, safeLower } from "@/lib/utils";
import type { AppointmentStatus, PaymentStatus } from "@/types/database";

type Option = { id: string; name: string };
type ServiceOption = Option & { duration_minutes: number; color?: string; category?: string };

const intervals = [15, 30, 60] as const;
const durations = [15, 30, 45, 60, 90, 120] as const;
const statuses: AppointmentStatus[] = ["scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "rescheduled", "no_show", "archived"];
const paymentStatuses: PaymentStatus[] = ["paid", "partial", "deposit", "due", "refunded"];

export function AppointmentScheduler({
  action,
  clients,
  staff,
  services,
  disabled
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Option[];
  staff: Option[];
  services: ServiceOption[];
  disabled?: boolean;
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [date, setDate] = useState(today);
  const [interval, setInterval] = useState<(typeof intervals)[number]>(30);
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState(() => roundToInterval(new Date(), 30));
  const [selectedClient, setSelectedClient] = useState<Option | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [localClients, setLocalClients] = useState(safeArray(clients));
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const timeSlots = useMemo(() => buildTimeSlots(interval), [interval]);
  const filteredClients = useMemo(() => {
    const query = safeLower(clientSearch.trim());
    if (!query) return [];
    return safeArray(localClients).filter((client) => safeLower(client.name).includes(query)).slice(0, 6);
  }, [clientSearch, localClients]);
  const startsAt = `${date}T${startTime}`;
  const endsAt = addMinutesToLocalInput(startsAt, duration);

  function handleServiceChange(serviceId: string) {
    const service = safeArray(services).find((item) => item.id === serviceId);
    if (service?.duration_minutes) setDuration(service.duration_minutes);
  }

  function handleIntervalChange(nextInterval: (typeof intervals)[number]) {
    setInterval(nextInterval);
    setStartTime(roundTimeValue(startTime, nextInterval));
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (!selectedClient) {
          setFeedback({ type: "error", message: "Select or create a client before booking." });
          return;
        }
        const formData = new FormData(event.currentTarget);
        setFeedback(null);
        startTransition(async () => {
          try {
            await action(formData);
            formRef.current?.reset();
            setSelectedClient(null);
            setClientSearch("");
            setDate(today);
            setDuration(60);
            setStartTime(roundToInterval(new Date(), interval));
            setFeedback({ type: "success", message: "Appointment created." });
            router.refresh();
          } catch (error) {
            setFeedback({ type: "error", message: error instanceof Error ? error.message : "Appointment could not be created." });
          }
        });
      }}
      className="grid gap-5"
    >
      <input type="hidden" name="client_id" value={selectedClient?.id ?? ""} />
      <input type="hidden" name="starts_at" value={startsAt} />
      <input type="hidden" name="ends_at" value={endsAt} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="grid gap-4 rounded-lg border bg-background/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Appointment details
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ClientSearchField
              clients={filteredClients}
              query={clientSearch}
              selectedClient={selectedClient}
              disabled={disabled}
              onCreated={(client) => {
                setLocalClients((current) => [...current, client].sort((a, b) => a.name.localeCompare(b.name)));
                setSelectedClient(client);
                setClientSearch(client.name);
                setFeedback({ type: "success", message: `${client.name} added and selected.` });
              }}
              onQueryChange={(value) => {
                setClientSearch(value);
                if (selectedClient) setSelectedClient(null);
              }}
              onSelect={(client) => {
                setSelectedClient(client);
                setClientSearch(client.name);
              }}
            />
            <SelectField label="Staff 1" name="staff_id" items={staff} placeholder="Unassigned" />
            <SelectField label="Staff 2" name="staff_id_2" items={staff} placeholder="Unassigned" />
            <SelectField label="Status" name="status" items={statuses.map((status) => ({ id: status, name: humanize(status) }))} required defaultValue="scheduled" />
          </div>
          <TreatmentBlocks
            services={services}
            staff={staff}
            query={serviceSearch}
            onQueryChange={setServiceSearch}
            onPrimaryServiceChange={handleServiceChange}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Session number">
              <Input name="session_number" type="number" min="1" placeholder="e.g. 4" />
            </Field>
            <Field label="Total sessions">
              <Input name="total_sessions" type="number" min="1" placeholder="e.g. 8" />
            </Field>
            <SelectField label="Payment status" name="payment_status" items={paymentStatuses.map((status) => ({ id: status, name: humanize(status) }))} required defaultValue="due" />
            <Field label="Treatment price">
              <PriceInput name="treatment_price" defaultValue="0" required />
            </Field>
            <Field label="Deposit">
              <PriceInput name="deposit_amount" defaultValue="0" required />
            </Field>
            <Field label="Amount paid">
              <PriceInput name="amount_paid" defaultValue="0" required />
            </Field>
            <Field label="Balance due">
              <PriceInput name="balance_due" defaultValue="0" required />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Internal appointment notes" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Outcome">
              <Input name="outcome" placeholder="Optional" />
            </Field>
            <Field label="Before/after notes">
              <Input name="before_after_notes" placeholder="Optional" />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border bg-background/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            Schedule
          </div>
          <Field label="Date">
            <Input type="date" value={date} min={today} onChange={(event) => setDate(event.target.value)} required />
          </Field>
          <Field label="Start time">
            <TimeSelector value={startTime} interval={interval} onChange={setStartTime} />
          </Field>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Time interval</span>
            <div className="grid grid-cols-3 gap-2">
              {intervals.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleIntervalChange(item)}
                  className={cn(
                    "h-10 rounded-md border text-sm font-medium transition",
                    interval === item ? "border-primary bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item}m
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Quick start times</span>
            <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setStartTime(slot)}
                  className={cn(
                    "h-9 rounded-md border text-sm font-medium transition",
                    startTime === slot ? "border-primary bg-primary/10 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Duration</span>
            <div className="grid grid-cols-3 gap-2">
              {durations.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDuration(item)}
                  className={cn(
                    "h-10 rounded-md border text-sm font-medium transition",
                    duration === item ? "border-primary bg-primary/10 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-surface px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Timer className="h-4 w-4" />
              Ends automatically
            </span>
            <span className="font-semibold">{formatTime(endsAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {feedback ? (
          <p className={cn("text-sm font-medium", feedback.type === "success" ? "text-success" : "text-error")}>{feedback.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {formatDate(date)} · {startTime} to {formatTime(endsAt)}
          </p>
        )}
        <Button className="sm:w-fit" type="submit" disabled={disabled || !selectedClient || isPending}>
          {isPending ? "Creating..." : "Create appointment"}
        </Button>
      </div>
    </form>
  );
}

function ClientSearchField({
  clients,
  query,
  selectedClient,
  disabled,
  onCreated,
  onQueryChange,
  onSelect
}: {
  clients: Option[];
  query: string;
  selectedClient: Option | null;
  disabled?: boolean;
  onCreated: (client: Option) => void;
  onQueryChange: (value: string) => void;
  onSelect: (client: Option) => void;
}) {
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [isCreating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);

        return (
          <div className="grid gap-1.5 text-sm font-medium">
            <div className="flex items-center justify-between gap-3">
             <span>Client</span>
          
         <button 
           type="button" 
           onClick={() => 
           setShowQuickCreate((value) => !value)} 
           className="text-xs font-semibold text-primary">
          {showQuickCreate ? "Search clients" : "Quick create"}
        </button>
      </div>
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search client"
        autoComplete="off"
        disabled={disabled}
        required
      />
      {selectedClient ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          {selectedClient.name}
        </div>
      ) : null}
      {query.trim() && !selectedClient ? (
        <div className="overflow-hidden rounded-md border bg-surface shadow-soft">
          {safeArray(clients).length ? safeArray(clients).map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onSelect(client)}
              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-muted"
            >
              {client.name}
            </button>
          )) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No clients found</p>
          )}
        </div>
      ) : null}
      {showQuickCreate ? (
        <div className="grid gap-3 rounded-lg border bg-background/70 p-3">
          <QuickCreateInput name="quick_full_name" placeholder="Client full name" />
          <QuickCreateInput name="quick_email" placeholder="Email" type="email" />
          <QuickCreateInput name="quick_phone" placeholder="Phone" />
          {error ? <p className="text-xs font-medium text-error">{error}</p> : null}
          <Button
            type="button"
            size="sm"
            disabled={isCreating}
            onClick={(event) => {
              const container = event.currentTarget.closest("div");
              const fullName = (container?.querySelector("[name='quick_full_name']") as HTMLInputElement | null)?.value ?? "";
              const email = (container?.querySelector("[name='quick_email']") as HTMLInputElement | null)?.value ?? "";
              const phone = (container?.querySelector("[name='quick_phone']") as HTMLInputElement | null)?.value ?? "";
              if (!fullName.trim()) {
                setError("Client name is required.");
                return;
              }
              setError(null);
              startCreating(async () => {
                const response = await fetch("/api/clients", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ full_name: fullName, email, phone })
                });
                const payload = await response.json();
                if (!response.ok) {
                  setError(payload.error ?? "Client could not be created.");
                  return;
                }
                onCreated(payload.client);
                setShowQuickCreate(false);
              });
            }}
          >
            {isCreating ? "Creating..." : "Create and select"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function QuickCreateInput({ name, placeholder, type = "text" }: { name: string; placeholder: string; type?: string }) {
  return <Input name={name} type={type} placeholder={placeholder} autoComplete="off" />;
}

function TimeSelector({ value, interval, onChange }: { value: string; interval: number; onChange: (value: string) => void }) {
  const [rawHour, rawMinute] = String(value ?? "09:00").split(":");
  const hour24 = Number(rawHour);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12Number = hour24 % 12 || 12;
  const hour = String(hour12Number).padStart(2, "0");
  const minute = rawMinute ?? "00";
  const minutes = Array.from({ length: Math.floor(60 / interval) }, (_, index) => String(index * interval).padStart(2, "0"));

  function update(nextHour: string, nextMinute: string, nextPeriod: string) {
    const numericHour = Number(nextHour);
    const nextHour24 = nextPeriod === "PM" ? (numericHour % 12) + 12 : numericHour % 12;
    onChange(`${String(nextHour24).padStart(2, "0")}:${nextMinute}`);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select value={hour} onChange={(event) => update(event.target.value, minute, period)}>
        {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </Select>
      <Select value={minutes.includes(minute) ? minute : minutes[0]} onChange={(event) => update(hour, event.target.value, period)}>
        {minutes.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </Select>
      <Select value={period} onChange={(event) => update(hour, minutes.includes(minute) ? minute : minutes[0], event.target.value)}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </Select>
    </div>
  );
}

function ServiceSelectField({
  services,
  query,
  onQueryChange,
  onChange,
  name = "service_id"
}: {
  services: ServiceOption[];
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (value: string) => void;
  name?: string;
}) {
  const filteredServices = useMemo(() => {
    const normalizedQuery = safeLower(query);
    return safeArray(services)
      .filter((service) => {
        if (!normalizedQuery) return true;
        return safeLower(`${service.name} ${service.category ?? ""}`).includes(normalizedQuery);
      })
      .sort((a, b) => `${a.category ?? "Uncategorised"} ${a.name}`.localeCompare(`${b.category ?? "Uncategorised"} ${b.name}`));
  }, [query, services]);
  const groupedServices = useMemo(() => {
    const groups = new Map<string, ServiceOption[]>();
    for (const service of filteredServices) {
      const category = service.category?.trim() || "Uncategorised";
      groups.set(category, [...(groups.get(category) ?? []), service]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredServices]);

  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>Service</span>
      <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search services" autoComplete="off" />
      <Select name={name} defaultValue="" onChange={(event) => onChange(event.target.value)}>
        <option value="">No service</option>
        {groupedServices.map(([category, categoryServices]) => (
          <optgroup key={category} label={category}>
            {categoryServices.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </optgroup>
        ))}
      </Select>
    </label>
  );
}

function TreatmentBlocks({
  services,
  staff,
  query,
  onQueryChange,
  onPrimaryServiceChange
}: {
  services: ServiceOption[];
  staff: Option[];
  query: string;
  onQueryChange: (value: string) => void;
  onPrimaryServiceChange: (value: string) => void;
}) {
  const [visibleTreatments, setVisibleTreatments] = useState(1);
  return (
    <div className="grid gap-3 rounded-lg border bg-surface/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Treatments</p>
          <p className="text-xs text-muted-foreground">Use a saved service or type a manual treatment. Manual treatments keep booking available even if services are unavailable.</p>
        </div>
        {visibleTreatments < 3 ? (
          <button
            type="button"
            onClick={() => setVisibleTreatments((current) => Math.min(3, current + 1))}
            className="h-9 rounded-md border px-3 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            Add Treatment {visibleTreatments + 1}
          </button>
        ) : null}
      </div>
      {Array.from({ length: visibleTreatments }, (_, index) => (
        <div key={index} className="grid gap-3 rounded-md border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Treatment {index + 1}</p>
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setVisibleTreatments(index)}
                className="text-xs font-semibold text-muted-foreground transition hover:text-error"
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ServiceSelectField
              services={services}
              query={index === 0 ? query : ""}
              onQueryChange={index === 0 ? onQueryChange : () => undefined}
              onChange={index === 0 ? onPrimaryServiceChange : () => undefined}
              name={index === 0 ? "service_id" : `treatment_${index}_service_id`}
            />
            <Field label="Manual treatment">
              <Input name={index === 0 ? "manual_treatment_name" : `treatment_${index}_manual_name`} placeholder="e.g. PRP Hair" />
            </Field>
            <Field label="Price">
              <PriceInput name={index === 0 ? "treatment_0_price" : `treatment_${index}_price`} defaultValue={index === 0 ? "0" : ""} />
            </Field>
            <Field label="Duration">
              <Input name={index === 0 ? "treatment_0_duration" : `treatment_${index}_duration`} type="number" min="1" placeholder="Minutes" />
            </Field>
            <SelectField label="Treatment staff" name={index === 0 ? "treatment_0_staff_id" : `treatment_${index}_staff_id`} items={staff} placeholder="Unassigned" />
            <Field label="Treatment notes">
              <Input name={index === 0 ? "treatment_0_notes" : `treatment_${index}_notes`} placeholder="Optional" />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceInput({ name, defaultValue, required }: { name: string; defaultValue?: string; required?: boolean }) {
  const [value, setValue] = useState(normalizeCurrencyString(defaultValue ?? "0"));
  return (
    <Input
      name={name}
      value={value}
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      required={required}
      onChange={(event) => {
        const next = event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
        setValue(next);
      }}
      onBlur={() => setValue(normalizeCurrencyString(value))}
    />
  );
}

function SelectField({
  label,
  name,
  items,
  placeholder,
  required,
  disabled,
  defaultValue = "",
  onChange
}: {
  label: string;
  name: string;
  items: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <Select
        name={name}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {!required ? <option value="">{placeholder ?? "None"}</option> : null}
        {safeArray(items).map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function buildTimeSlots(interval: number) {
  const slots: string[] = [];
  for (let minutes = 8 * 60; minutes <= 18 * 60; minutes += interval) {
    slots.push(minutesToTime(minutes));
  }
  return slots;
}

function roundToInterval(date: Date, interval: number) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.ceil(totalMinutes / interval) * interval;
  const bounded = Math.min(Math.max(rounded, 8 * 60), 18 * 60);
  return minutesToTime(bounded);
}

function roundTimeValue(time: string, interval: number) {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;
  return minutesToTime(Math.min(Math.ceil(totalMinutes / interval) * interval, 23 * 60 + 59));
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutesToLocalInput(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return `${toDateInputValue(date)}T${minutesToTime(date.getHours() * 60 + date.getMinutes())}`;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00`));
}

function formatTime(value: string) {
  return value.slice(11, 16);
}
