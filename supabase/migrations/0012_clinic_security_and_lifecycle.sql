create extension if not exists pgcrypto;

create table if not exists public.organisation_security_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  admin_pin_hash text,
  recovery_code_hashes jsonb not null default '[]'::jsonb,
  recovery_email text,
  two_step_enabled boolean not null default false,
  owner_password_verification_enabled boolean not null default false,
  protect_client_archive boolean not null default true,
  protect_staff_changes boolean not null default true,
  protect_appointments boolean not null default true,
  protect_services boolean not null default true,
  protect_financials boolean not null default true,
  protect_settings boolean not null default true,
  pin_updated_at timestamptz,
  pin_reset_requested_at timestamptz,
  pin_reset_token_hash text,
  pin_reset_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organisation_security_settings
  add column if not exists recovery_code_hashes jsonb not null default '[]'::jsonb,
  add column if not exists owner_password_verification_enabled boolean not null default false;

create table if not exists public.admin_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  plan_name text not null,
  total_sessions integer not null default 1 check (total_sessions > 0),
  completed_sessions integer not null default 0 check (completed_sessions >= 0),
  cancelled_sessions integer not null default 0 check (cancelled_sessions >= 0),
  no_show_sessions integer not null default 0 check (no_show_sessions >= 0),
  plan_status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  session_number integer,
  treatment_name text not null,
  session_status text not null default 'scheduled',
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show_at timestamptz,
  staff_summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organisation_security_settings_org_idx on public.organisation_security_settings (organisation_id);
create index if not exists admin_pin_attempts_org_created_idx on public.admin_pin_attempts (organisation_id, created_at desc);
create index if not exists treatment_plans_org_client_idx on public.treatment_plans (organisation_id, client_id);
create index if not exists treatment_sessions_org_client_idx on public.treatment_sessions (organisation_id, client_id);
create index if not exists treatment_sessions_appointment_idx on public.treatment_sessions (appointment_id);

drop trigger if exists organisation_security_settings_set_updated_at on public.organisation_security_settings;
create trigger organisation_security_settings_set_updated_at
before update on public.organisation_security_settings
for each row execute function public.set_updated_at();

drop trigger if exists treatment_plans_set_updated_at on public.treatment_plans;
create trigger treatment_plans_set_updated_at
before update on public.treatment_plans
for each row execute function public.set_updated_at();

drop trigger if exists treatment_sessions_set_updated_at on public.treatment_sessions;
create trigger treatment_sessions_set_updated_at
before update on public.treatment_sessions
for each row execute function public.set_updated_at();

insert into public.organisation_security_settings (organisation_id, recovery_email)
select o.id, null
from public.organisations o
where not exists (
  select 1
  from public.organisation_security_settings s
  where s.organisation_id = o.id
);

alter table public.organisation_security_settings enable row level security;
alter table public.admin_pin_attempts enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.treatment_sessions enable row level security;

drop policy if exists "owners manage security settings" on public.organisation_security_settings;
create policy "owners manage security settings" on public.organisation_security_settings
for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

drop policy if exists "owners read pin attempts" on public.admin_pin_attempts;
create policy "owners read pin attempts" on public.admin_pin_attempts
for select
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

drop policy if exists "members create pin attempts" on public.admin_pin_attempts;
create policy "members create pin attempts" on public.admin_pin_attempts
for insert
with check (public.is_org_member(organisation_id));

drop policy if exists "members read treatment plans" on public.treatment_plans;
create policy "members read treatment plans" on public.treatment_plans
for select
using (public.is_org_member(organisation_id));

drop policy if exists "staff manage treatment plans" on public.treatment_plans;
create policy "staff manage treatment plans" on public.treatment_plans
for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

drop policy if exists "members read treatment sessions" on public.treatment_sessions;
create policy "members read treatment sessions" on public.treatment_sessions
for select
using (public.is_org_member(organisation_id));

drop policy if exists "staff manage treatment sessions" on public.treatment_sessions;
create policy "staff manage treatment sessions" on public.treatment_sessions
for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

select pg_notify('pgrst', 'reload schema');
