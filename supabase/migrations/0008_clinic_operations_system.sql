do $$
begin
  if exists (select 1 from pg_type where typname = 'appointment_status') then
    alter type public.appointment_status add value if not exists 'confirmed';
    alter type public.appointment_status add value if not exists 'arrived';
    alter type public.appointment_status add value if not exists 'in_progress';
    alter type public.appointment_status add value if not exists 'rescheduled';
    alter type public.appointment_status add value if not exists 'archived';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'payment_status'
  ) then
    create type public.payment_status as enum ('paid', 'partial', 'deposit', 'due', 'refunded');
  end if;
end;
$$;

create table if not exists public.status_colours (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  colour_type text not null check (colour_type in ('appointment', 'payment')),
  status_key text not null,
  colour text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, colour_type, status_key)
);

alter table public.appointments add column if not exists original_starts_at timestamptz;
alter table public.appointments add column if not exists original_ends_at timestamptz;
alter table public.appointments add column if not exists cancelled_at timestamptz;
alter table public.appointments add column if not exists cancelled_by uuid references public.users(id) on delete set null;
alter table public.appointments add column if not exists cancellation_reason text;
alter table public.appointments add column if not exists rescheduled_from_id uuid references public.appointments(id) on delete set null;
alter table public.appointments add column if not exists completed_at timestamptz;
alter table public.appointments add column if not exists no_show boolean not null default false;
alter table public.appointments add column if not exists color_code text;
alter table public.appointments add column if not exists treatment_notes text;
alter table public.appointments add column if not exists deleted_at timestamptz;
alter table public.appointments add column if not exists deleted_by uuid references public.users(id) on delete set null;
alter table public.appointments add column if not exists delete_reason text;
alter table public.appointments add column if not exists secondary_staff_id uuid references public.staff(id) on delete set null;
alter table public.appointments add column if not exists session_number integer;
alter table public.appointments add column if not exists total_sessions integer;
alter table public.appointments add column if not exists treatment_price numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists deposit_amount numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists amount_paid numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists balance_due numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists payment_status public.payment_status not null default 'due';
alter table public.appointments add column if not exists appointment_status public.appointment_status not null default 'scheduled';

update public.appointments
set original_starts_at = starts_at
where original_starts_at is null;

update public.appointments
set original_ends_at = ends_at
where original_ends_at is null;

update public.appointments
set appointment_status = status
where appointment_status is distinct from status;

update public.appointments
set no_show = true
where status::text = 'no_show'
  and no_show is false;

create or replace function public.sync_appointment_operational_columns()
returns trigger
language plpgsql
as $$
begin
  if new.status is null and new.appointment_status is not null then
    new.status = new.appointment_status;
  end if;

  if new.appointment_status is null and new.status is not null then
    new.appointment_status = new.status;
  end if;

  if new.status is distinct from new.appointment_status then
    new.appointment_status = new.status;
  end if;

  if new.status::text = 'completed' and new.completed_at is null then
    new.completed_at = now();
  end if;

  if new.status::text = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at = now();
  end if;

  new.no_show = new.status::text = 'no_show';
  new.treatment_notes = coalesce(new.treatment_notes, new.notes);

  return new;
end;
$$;

drop trigger if exists sync_appointment_operational_columns on public.appointments;
create trigger sync_appointment_operational_columns before insert or update on public.appointments for each row execute function public.sync_appointment_operational_columns();

create table if not exists public.appointment_staff (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  staff_order integer not null check (staff_order in (1, 2)),
  created_at timestamptz not null default now(),
  unique (appointment_id, staff_id),
  unique (appointment_id, staff_order)
);

insert into public.appointment_staff (organisation_id, appointment_id, staff_id, staff_order)
select organisation_id, id, staff_id, 1
from public.appointments
where staff_id is not null
on conflict do nothing;

create table if not exists public.treatment_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  treatment_name text not null,
  treatment_category text,
  treatment_date timestamptz not null default now(),
  session_number integer,
  total_sessions integer,
  staff_summary text,
  notes text,
  outcome text,
  before_after_notes text,
  payment_status public.payment_status not null default 'due',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  treatment_record_id uuid references public.treatment_records(id) on delete set null,
  treatment_price numeric(10,2) not null default 0.00,
  deposit_amount numeric(10,2) not null default 0.00,
  amount_paid numeric(10,2) not null default 0.00,
  balance_due numeric(10,2) not null default 0.00,
  payment_status public.payment_status not null default 'due',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_status_colours_updated_at on public.status_colours;
create trigger set_status_colours_updated_at before update on public.status_colours for each row execute function public.set_updated_at();

drop trigger if exists set_treatment_records_updated_at on public.treatment_records;
create trigger set_treatment_records_updated_at before update on public.treatment_records for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

create or replace function public.prevent_staff_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_starts_at timestamptz;
  target_ends_at timestamptz;
begin
  select starts_at, ends_at
  into target_starts_at, target_ends_at
  from public.appointments
  where id = new.appointment_id
    and organisation_id = new.organisation_id
    and status::text not in ('cancelled', 'archived', 'no_show');

  if target_starts_at is null then
    return new;
  end if;

  if exists (
    select 1
    from public.appointment_staff other_link
    join public.appointments other_appointment on other_appointment.id = other_link.appointment_id
    where other_link.staff_id = new.staff_id
      and other_link.id <> new.id
      and other_appointment.organisation_id = new.organisation_id
      and other_appointment.status::text not in ('cancelled', 'archived', 'no_show')
      and other_appointment.starts_at < target_ends_at
      and other_appointment.ends_at > target_starts_at
  ) then
    raise exception 'staff member is already booked at this time';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_staff_double_booking on public.appointment_staff;
create trigger prevent_staff_double_booking before insert or update on public.appointment_staff for each row execute function public.prevent_staff_double_booking();

alter table public.status_colours enable row level security;
alter table public.appointment_staff enable row level security;
alter table public.treatment_records enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "members read status colours" on public.status_colours;
create policy "members read status colours" on public.status_colours for select using (organisation_id is null or public.is_org_member(organisation_id));

drop policy if exists "admins manage status colours" on public.status_colours;
create policy "admins manage status colours" on public.status_colours for all using (organisation_id is null or public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[])) with check (organisation_id is null or public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

drop policy if exists "members read appointment staff" on public.appointment_staff;
create policy "members read appointment staff" on public.appointment_staff for select using (public.is_org_member(organisation_id));

drop policy if exists "staff manage appointment staff" on public.appointment_staff;
create policy "staff manage appointment staff" on public.appointment_staff for all using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[])) with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

drop policy if exists "members read treatment records" on public.treatment_records;
create policy "members read treatment records" on public.treatment_records for select using (public.is_org_member(organisation_id));

drop policy if exists "staff manage treatment records" on public.treatment_records;
create policy "staff manage treatment records" on public.treatment_records for all using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[])) with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

drop policy if exists "members read payments" on public.payments;
create policy "members read payments" on public.payments for select using (public.is_org_member(organisation_id));

drop policy if exists "staff manage payments" on public.payments;
create policy "staff manage payments" on public.payments for all using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[])) with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

drop policy if exists "members read audit logs" on public.audit_logs;
create policy "members read audit logs" on public.audit_logs for select using (organisation_id is null or public.is_org_member(organisation_id));

drop policy if exists "members create audit logs" on public.audit_logs;
create policy "members create audit logs" on public.audit_logs for insert with check (organisation_id is null or public.is_org_member(organisation_id));

insert into public.status_colours (organisation_id, colour_type, status_key, colour)
values
  (null, 'appointment', 'scheduled', '#2563eb'),
  (null, 'appointment', 'confirmed', '#0f766e'),
  (null, 'appointment', 'arrived', '#eab308'),
  (null, 'appointment', 'in_progress', '#8b5cf6'),
  (null, 'appointment', 'completed', '#16a34a'),
  (null, 'appointment', 'cancelled', '#dc2626'),
  (null, 'appointment', 'rescheduled', '#f97316'),
  (null, 'appointment', 'no_show', '#6b7280'),
  (null, 'appointment', 'archived', '#374151'),
  (null, 'payment', 'paid', '#22c55e'),
  (null, 'payment', 'partial', '#f59e0b'),
  (null, 'payment', 'deposit', '#7c3aed'),
  (null, 'payment', 'due', '#e11d48'),
  (null, 'payment', 'refunded', '#64748b')
on conflict (organisation_id, colour_type, status_key) do update set colour = excluded.colour;

notify pgrst, 'reload schema';
