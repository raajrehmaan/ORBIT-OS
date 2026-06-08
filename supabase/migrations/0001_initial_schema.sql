create extension if not exists pgcrypto;

create type public.app_role as enum (
  'super_admin',
  'organisation_owner',
  'admin',
  'staff',
  'client'
);

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  email text not null,
  full_name text not null,
  role public.app_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, email)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, email)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
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

create index users_organisation_id_idx on public.users (organisation_id);
create index staff_organisation_id_idx on public.staff (organisation_id);
create index clients_organisation_id_idx on public.clients (organisation_id);
create index services_organisation_id_idx on public.services (organisation_id);
create index appointments_organisation_id_starts_at_idx on public.appointments (organisation_id, starts_at);
create index appointments_client_id_idx on public.appointments (client_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_organisations_updated_at before update on public.organisations for each row execute function public.set_updated_at();
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger set_staff_updated_at before update on public.staff for each row execute function public.set_updated_at();
create trigger set_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger set_services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger set_appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.current_user_organisation_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organisation_id from public.users where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

create or replace function public.is_org_member(target_organisation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and organisation_id = target_organisation_id
    )
$$;

create or replace function public.has_min_role(target_organisation_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.users
      where id = auth.uid()
        and organisation_id = target_organisation_id
        and role = any(allowed_roles)
    )
$$;

alter table public.organisations enable row level security;
alter table public.users enable row level security;
alter table public.staff enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

create policy "members can read their organisation"
on public.organisations for select
using (public.is_org_member(id));

create policy "super admins can manage organisations"
on public.organisations for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "members can read users in their organisation"
on public.users for select
using (id = auth.uid() or public.is_org_member(organisation_id));

create policy "owners and admins can manage organisation users"
on public.users for update
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

create policy "super admins can insert users"
on public.users for insert
with check (public.is_super_admin());

create policy "admins manage staff"
on public.staff for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

create policy "members read staff"
on public.staff for select
using (public.is_org_member(organisation_id));

create policy "staff manage clients"
on public.clients for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

create policy "clients read own organisation clients"
on public.clients for select
using (public.is_org_member(organisation_id));

create policy "admins manage services"
on public.services for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

create policy "members read services"
on public.services for select
using (public.is_org_member(organisation_id));

create policy "staff manage appointments"
on public.appointments for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

create policy "members read appointments"
on public.appointments for select
using (public.is_org_member(organisation_id));

create or replace function public.prevent_cross_organisation_appointment()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.clients where id = new.client_id and organisation_id = new.organisation_id) then
    raise exception 'client does not belong to appointment organisation';
  end if;

  if new.staff_id is not null and not exists (select 1 from public.staff where id = new.staff_id and organisation_id = new.organisation_id) then
    raise exception 'staff member does not belong to appointment organisation';
  end if;

  if new.service_id is not null and not exists (select 1 from public.services where id = new.service_id and organisation_id = new.organisation_id) then
    raise exception 'service does not belong to appointment organisation';
  end if;

  return new;
end;
$$;

create trigger prevent_cross_organisation_appointment
before insert or update on public.appointments
for each row execute function public.prevent_cross_organisation_appointment();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role;
  requested_organisation_id uuid;
begin
  requested_role := coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'client');
  requested_organisation_id := nullif(new.raw_app_meta_data ->> 'organisation_id', '')::uuid;

  insert into public.users (id, organisation_id, email, full_name, role)
  values (
    new.id,
    requested_organisation_id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'New user'),
    requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
