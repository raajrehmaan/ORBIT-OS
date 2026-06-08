create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'app_role'
  ) then
    create type public.app_role as enum ('super_admin', 'organisation_owner', 'admin', 'staff', 'client');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'appointment_status'
  ) then
    create type public.appointment_status as enum (
      'scheduled',
      'confirmed',
      'arrived',
      'in_progress',
      'completed',
      'cancelled',
      'rescheduled',
      'no_show',
      'archived'
    );
  else
    alter type public.appointment_status add value if not exists 'confirmed';
    alter type public.appointment_status add value if not exists 'arrived';
    alter type public.appointment_status add value if not exists 'in_progress';
    alter type public.appointment_status add value if not exists 'completed';
    alter type public.appointment_status add value if not exists 'cancelled';
    alter type public.appointment_status add value if not exists 'rescheduled';
    alter type public.appointment_status add value if not exists 'no_show';
    alter type public.appointment_status add value if not exists 'archived';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'payment_status'
  ) then
    create type public.payment_status as enum ('paid', 'partial', 'deposit', 'due', 'refunded');
  else
    alter type public.payment_status add value if not exists 'paid';
    alter type public.payment_status add value if not exists 'partial';
    alter type public.payment_status add value if not exists 'deposit';
    alter type public.payment_status add value if not exists 'due';
    alter type public.payment_status add value if not exists 'refunded';
  end if;
end;
$$;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  email text not null,
  full_name text not null,
  role public.app_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  notes text,
  role text not null default 'staff',
  active boolean not null default true,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  color_tag text,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price numeric(10,2) not null default 0.00,
  category text not null default 'Skin Treatments',
  color text not null default 'teal',
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  color text not null default 'teal',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  staff_id uuid references public.staff(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.appointment_staff (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  staff_order integer not null default 1 check (staff_order in (1, 2)),
  created_at timestamptz not null default now()
);

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

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(10,2) not null default 0.00,
  payment_status public.payment_status not null default 'due',
  notes text,
  created_at timestamptz not null default now()
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

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  action text not null,
  appointment_status public.appointment_status,
  payment_status public.payment_status,
  service_snapshot_name text,
  service_snapshot_price numeric(10,2),
  service_snapshot_category text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.status_colours (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  colour_type text not null check (colour_type in ('appointment', 'payment')),
  status_key text not null,
  colour text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff alter column email drop not null;
alter table public.staff add column if not exists phone text;
alter table public.staff add column if not exists notes text;
alter table public.staff add column if not exists role text not null default 'staff';
alter table public.staff alter column role drop default;
alter table public.staff alter column role type text using role::text;
alter table public.staff alter column role set default 'staff';
alter table public.staff add column if not exists active boolean not null default true;
alter table public.staff add column if not exists deleted_at timestamptz;
alter table public.staff add column if not exists deleted_by uuid references public.users(id) on delete set null;

alter table public.clients add column if not exists color_tag text;
alter table public.clients add column if not exists archived_at timestamptz;
alter table public.clients add column if not exists archived_by uuid references public.users(id) on delete set null;

alter table public.service_categories add column if not exists color text not null default 'teal';
alter table public.service_categories add column if not exists description text;
alter table public.service_categories add column if not exists updated_at timestamptz not null default now();
alter table public.service_categories add column if not exists archived_at timestamptz;
alter table public.service_categories add column if not exists archived_by uuid references public.users(id) on delete set null;

alter table public.services add column if not exists description text;
alter table public.services add column if not exists duration_minutes integer not null default 60;
alter table public.services add column if not exists price numeric(10,2) not null default 0.00;
alter table public.services add column if not exists category text not null default 'Skin Treatments';
alter table public.services add column if not exists color text not null default 'teal';
alter table public.services add column if not exists category_id uuid references public.service_categories(id) on delete set null;
alter table public.services add column if not exists archived_at timestamptz;
alter table public.services add column if not exists archived_by uuid references public.users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'price_cents'
  ) then
    execute 'update public.services set price = coalesce(price, round(price_cents::numeric / 100, 2)) where price is null or price = 0';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'color_tag'
  ) then
    execute 'update public.services set color = coalesce(nullif(color, ''''), nullif(color_tag, ''''), ''teal'')';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'active'
  ) then
    execute 'update public.services set archived_at = coalesce(archived_at, now()) where active = false and archived_at is null';
  end if;
end;
$$;

alter table public.appointments add column if not exists secondary_staff_id uuid references public.staff(id) on delete set null;
alter table public.appointments add column if not exists original_starts_at timestamptz;
alter table public.appointments add column if not exists original_ends_at timestamptz;
alter table public.appointments add column if not exists appointment_status public.appointment_status not null default 'scheduled';
alter table public.appointments add column if not exists payment_status public.payment_status not null default 'due';
alter table public.appointments add column if not exists amount_paid numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists deposit_amount numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists balance_due numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists treatment_price numeric(10,2) not null default 0.00;
alter table public.appointments add column if not exists treatment_notes text;
alter table public.appointments add column if not exists cancellation_reason text;
alter table public.appointments add column if not exists cancelled_at timestamptz;
alter table public.appointments add column if not exists cancelled_by uuid references public.users(id) on delete set null;
alter table public.appointments add column if not exists rescheduled_from_id uuid references public.appointments(id) on delete set null;
alter table public.appointments add column if not exists completed_at timestamptz;
alter table public.appointments add column if not exists no_show boolean not null default false;
alter table public.appointments add column if not exists color_code text;
alter table public.appointments add column if not exists deleted_at timestamptz;
alter table public.appointments add column if not exists deleted_by uuid references public.users(id) on delete set null;
alter table public.appointments add column if not exists delete_reason text;
alter table public.appointments add column if not exists session_number integer;
alter table public.appointments add column if not exists total_sessions integer;
alter table public.appointments add column if not exists service_snapshot_name text;
alter table public.appointments add column if not exists service_snapshot_price numeric(10,2);
alter table public.appointments add column if not exists service_snapshot_category text;

update public.staff
set role = case
  when role in ('organisation_owner', 'admin', 'therapist', 'receptionist', 'staff') then role
  when role = 'reception' then 'receptionist'
  else 'staff'
end;

update public.staff s
set role = 'organisation_owner'
from public.users u
where u.id = s.user_id
  and u.organisation_id = s.organisation_id
  and u.role = 'organisation_owner';

alter table public.staff drop constraint if exists staff_role_clinic_role_check;
alter table public.staff
  add constraint staff_role_clinic_role_check
  check (role in ('organisation_owner', 'admin', 'therapist', 'receptionist', 'staff'));

insert into public.service_categories (organisation_id, name, color)
select distinct s.organisation_id, coalesce(nullif(btrim(s.category), ''), 'Skin Treatments'), coalesce(nullif(s.color, ''), 'teal')
from public.services s
where s.organisation_id is not null
  and not exists (
    select 1
    from public.service_categories c
    where c.organisation_id = s.organisation_id
      and c.name = coalesce(nullif(btrim(s.category), ''), 'Skin Treatments')
  );

insert into public.service_categories (organisation_id, name, color)
select o.id, category_name, category_color
from public.organisations o
cross join (
  values
    ('Laser Hair Removal', 'blue'),
    ('Facials', 'teal'),
    ('PRP', 'rose'),
    ('Massage', 'violet'),
    ('Fat Dissolving', 'amber'),
    ('Tattoo Removal', 'slate'),
    ('Skin Treatments', 'teal'),
    ('Body Contouring', 'amber')
) as defaults(category_name, category_color)
where not exists (
  select 1
  from public.service_categories c
  where c.organisation_id = o.id
    and c.name = defaults.category_name
);

update public.services s
set category_id = c.id,
    category = c.name
from public.service_categories c
where c.organisation_id = s.organisation_id
  and c.name = coalesce(nullif(btrim(s.category), ''), 'Skin Treatments')
  and s.category_id is null;

update public.appointments a
set
  original_starts_at = coalesce(a.original_starts_at, a.starts_at),
  original_ends_at = coalesce(a.original_ends_at, a.ends_at),
  appointment_status = coalesce(a.appointment_status, a.status),
  no_show = coalesce(a.no_show, a.status::text = 'no_show'),
  treatment_notes = coalesce(a.treatment_notes, a.notes);

update public.appointments a
set
  service_snapshot_name = coalesce(a.service_snapshot_name, s.name),
  service_snapshot_price = coalesce(a.service_snapshot_price, s.price),
  service_snapshot_category = coalesce(a.service_snapshot_category, s.category)
from public.services s
where s.id = a.service_id;

insert into public.appointment_staff (organisation_id, appointment_id, staff_id, staff_order)
select a.organisation_id, a.id, a.staff_id, 1
from public.appointments a
where a.staff_id is not null
  and not exists (
    select 1
    from public.appointment_staff ast
    where ast.appointment_id = a.id
      and (ast.staff_id = a.staff_id or ast.staff_order = 1)
  );

insert into public.payment_logs (organisation_id, client_id, appointment_id, payment_id, amount, payment_status, notes, created_at)
select p.organisation_id, p.client_id, p.appointment_id, p.id, p.amount_paid, p.payment_status, 'Recovered from payments table', p.created_at
from public.payments p
where not exists (
  select 1
  from public.payment_logs pl
  where pl.payment_id = p.id
);

insert into public.appointment_history (
  organisation_id,
  appointment_id,
  client_id,
  action,
  appointment_status,
  payment_status,
  service_snapshot_name,
  service_snapshot_price,
  service_snapshot_category,
  metadata,
  created_at
)
select
  a.organisation_id,
  a.id,
  a.client_id,
  'recovered',
  a.appointment_status,
  a.payment_status,
  a.service_snapshot_name,
  a.service_snapshot_price,
  a.service_snapshot_category,
  jsonb_build_object('source', 'master_schema_recovery'),
  a.created_at
from public.appointments a
where not exists (
  select 1
  from public.appointment_history ah
  where ah.appointment_id = a.id
    and ah.action = 'recovered'
);

delete from public.service_categories a
using public.service_categories b
where a.ctid < b.ctid
  and a.organisation_id = b.organisation_id
  and a.name = b.name;

delete from public.appointment_staff a
using public.appointment_staff b
where a.ctid < b.ctid
  and a.appointment_id = b.appointment_id
  and (
    a.staff_id = b.staff_id
    or a.staff_order = b.staff_order
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_categories_organisation_id_name_key'
      and conrelid = 'public.service_categories'::regclass
  ) then
    alter table public.service_categories add constraint service_categories_organisation_id_name_key unique (organisation_id, name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_staff_appointment_id_staff_id_key'
      and conrelid = 'public.appointment_staff'::regclass
  ) then
    alter table public.appointment_staff add constraint appointment_staff_appointment_id_staff_id_key unique (appointment_id, staff_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_staff_appointment_id_staff_order_key'
      and conrelid = 'public.appointment_staff'::regclass
  ) then
    alter table public.appointment_staff add constraint appointment_staff_appointment_id_staff_order_key unique (appointment_id, staff_order);
  end if;
end;
$$;

create index if not exists users_organisation_id_idx on public.users (organisation_id);
create index if not exists staff_organisation_id_idx on public.staff (organisation_id);
create index if not exists staff_organisation_active_idx on public.staff (organisation_id, active) where deleted_at is null;
create index if not exists clients_organisation_id_idx on public.clients (organisation_id);
create index if not exists clients_organisation_archived_idx on public.clients (organisation_id, archived_at);
create index if not exists services_organisation_id_idx on public.services (organisation_id);
create index if not exists services_organisation_category_id_idx on public.services (organisation_id, category_id);
create index if not exists services_organisation_archived_idx on public.services (organisation_id, archived_at);
create index if not exists service_categories_organisation_id_idx on public.service_categories (organisation_id);
create index if not exists service_categories_organisation_archived_idx on public.service_categories (organisation_id, archived_at);
create index if not exists appointments_organisation_id_starts_at_idx on public.appointments (organisation_id, starts_at);
create index if not exists appointments_client_id_idx on public.appointments (client_id);
create index if not exists appointments_status_idx on public.appointments (organisation_id, appointment_status);
create index if not exists appointments_secondary_staff_id_idx on public.appointments (secondary_staff_id);
create index if not exists appointment_staff_organisation_id_idx on public.appointment_staff (organisation_id);
create index if not exists appointment_staff_staff_id_idx on public.appointment_staff (staff_id);
create index if not exists payments_organisation_id_idx on public.payments (organisation_id);
create index if not exists payments_client_id_idx on public.payments (client_id);
create index if not exists payment_logs_organisation_id_idx on public.payment_logs (organisation_id);
create index if not exists appointment_history_organisation_id_idx on public.appointment_history (organisation_id);
create index if not exists appointment_history_appointment_id_idx on public.appointment_history (appointment_id);
create index if not exists audit_logs_organisation_id_idx on public.audit_logs (organisation_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

drop trigger if exists set_organisations_updated_at on public.organisations;
create trigger set_organisations_updated_at before update on public.organisations for each row execute function public.set_updated_at();
drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists set_staff_updated_at on public.staff;
create trigger set_staff_updated_at before update on public.staff for each row execute function public.set_updated_at();
drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at before update on public.services for each row execute function public.set_updated_at();
drop trigger if exists set_service_categories_updated_at on public.service_categories;
create trigger set_service_categories_updated_at before update on public.service_categories for each row execute function public.set_updated_at();
drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
drop trigger if exists set_treatment_records_updated_at on public.treatment_records;
create trigger set_treatment_records_updated_at before update on public.treatment_records for each row execute function public.set_updated_at();
drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

create or replace function public.sync_appointment_operational_columns()
returns trigger
language plpgsql
as $$
begin
  new.appointment_status = coalesce(new.appointment_status, new.status, 'scheduled'::public.appointment_status);
  new.status = coalesce(new.status, new.appointment_status, 'scheduled'::public.appointment_status);

  if new.status is distinct from new.appointment_status then
    new.appointment_status = new.status;
  end if;

  if new.appointment_status::text = 'completed' and new.completed_at is null then
    new.completed_at = now();
  end if;

  if new.appointment_status::text = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at = now();
  end if;

  new.no_show = new.appointment_status::text = 'no_show';
  new.treatment_notes = coalesce(new.treatment_notes, new.notes);
  return new;
end;
$$;

drop trigger if exists sync_appointment_operational_columns on public.appointments;
create trigger sync_appointment_operational_columns before insert or update on public.appointments for each row execute function public.sync_appointment_operational_columns();

alter table public.organisations enable row level security;
alter table public.users enable row level security;
alter table public.staff enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.service_categories enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_staff enable row level security;
alter table public.treatment_records enable row level security;
alter table public.payments enable row level security;
alter table public.payment_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.appointment_history enable row level security;
alter table public.status_colours enable row level security;

drop policy if exists "members read service categories" on public.service_categories;
create policy "members read service categories" on public.service_categories for select using (public.is_org_member(organisation_id));

drop policy if exists "admins manage service categories" on public.service_categories;
create policy "admins manage service categories" on public.service_categories for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

drop policy if exists "members read payment logs" on public.payment_logs;
create policy "members read payment logs" on public.payment_logs for select using (public.is_org_member(organisation_id));

drop policy if exists "staff manage payment logs" on public.payment_logs;
create policy "staff manage payment logs" on public.payment_logs for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

drop policy if exists "members read appointment history" on public.appointment_history;
create policy "members read appointment history" on public.appointment_history for select using (public.is_org_member(organisation_id));

drop policy if exists "staff create appointment history" on public.appointment_history;
create policy "staff create appointment history" on public.appointment_history for insert
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

insert into public.status_colours (organisation_id, colour_type, status_key, colour)
select null::uuid, defaults.colour_type, defaults.status_key, defaults.colour
from (
  values
    ('appointment', 'scheduled', '#eab308'),
    ('appointment', 'confirmed', '#2563eb'),
    ('appointment', 'arrived', '#eab308'),
    ('appointment', 'in_progress', '#8b5cf6'),
    ('appointment', 'completed', '#16a34a'),
    ('appointment', 'cancelled', '#dc2626'),
    ('appointment', 'rescheduled', '#f97316'),
    ('appointment', 'no_show', '#6b7280'),
    ('appointment', 'archived', '#374151'),
    ('payment', 'paid', '#22c55e'),
    ('payment', 'partial', '#f59e0b'),
    ('payment', 'deposit', '#7c3aed'),
    ('payment', 'due', '#e11d48'),
    ('payment', 'refunded', '#64748b')
) as defaults(colour_type, status_key, colour)
where not exists (
  select 1
  from public.status_colours sc
  where sc.organisation_id is null
    and sc.colour_type = defaults.colour_type
    and sc.status_key = defaults.status_key
);

do $$
declare
  missing_items text[];
begin
  select array_agg(item)
  into missing_items
  from (
    values
      ('table:public.service_categories', to_regclass('public.service_categories') is not null),
      ('table:public.appointments', to_regclass('public.appointments') is not null),
      ('table:public.appointment_history', to_regclass('public.appointment_history') is not null),
      ('table:public.clients', to_regclass('public.clients') is not null),
      ('table:public.services', to_regclass('public.services') is not null),
      ('table:public.staff', to_regclass('public.staff') is not null),
      ('table:public.users', to_regclass('public.users') is not null),
      ('table:public.payment_logs', to_regclass('public.payment_logs') is not null),
      ('table:public.audit_logs', to_regclass('public.audit_logs') is not null),
      ('appointments.payment_status', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'payment_status')),
      ('appointments.amount_paid', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'amount_paid')),
      ('appointments.deposit_amount', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'deposit_amount')),
      ('appointments.balance_due', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'balance_due')),
      ('appointments.secondary_staff_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'secondary_staff_id')),
      ('appointments.appointment_status', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'appointment_status')),
      ('appointments.color_code', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'color_code')),
      ('appointments.service_snapshot_name', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'service_snapshot_name')),
      ('appointments.service_snapshot_price', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'service_snapshot_price')),
      ('appointments.cancelled_at', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'cancelled_at')),
      ('appointments.no_show', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'no_show')),
      ('services.category_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'services' and column_name = 'category_id')),
      ('services.archived_at', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'services' and column_name = 'archived_at')),
      ('staff.role', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'role')),
      ('staff.active', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'active')),
      ('staff.notes', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'notes')),
      ('clients.color_tag', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'color_tag')),
      ('clients.archived_at', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'archived_at'))
  ) as checks(item, ok)
  where not ok;

  if missing_items is not null then
    raise exception 'Master schema recovery failed. Missing: %', array_to_string(missing_items, ', ');
  end if;
end;
$$;

notify pgrst, 'reload schema';
