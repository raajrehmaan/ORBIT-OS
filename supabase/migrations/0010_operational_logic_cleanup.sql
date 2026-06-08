alter table public.staff drop constraint if exists staff_role_clinic_role_check;

update public.staff
set role = case
  when role = 'reception' then 'receptionist'
  when role in ('admin', 'therapist', 'receptionist', 'staff', 'organisation_owner') then role
  else 'staff'
end;

update public.staff s
set role = 'organisation_owner'
from public.users u
where u.id = s.user_id
  and u.organisation_id = s.organisation_id
  and u.role = 'organisation_owner';

alter table public.staff
  alter column role set default 'staff';

alter table public.staff
  add constraint staff_role_clinic_role_check
  check (role in ('organisation_owner', 'admin', 'therapist', 'receptionist', 'staff'));

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  archived_at timestamptz,
  archived_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

alter table public.services add column if not exists category_id uuid references public.service_categories(id) on delete set null;
alter table public.services add column if not exists archived_at timestamptz;
alter table public.services add column if not exists archived_by uuid references public.users(id) on delete set null;

alter table public.appointments add column if not exists service_snapshot_name text;
alter table public.appointments add column if not exists service_snapshot_price numeric(10,2);
alter table public.appointments add column if not exists service_snapshot_category text;

insert into public.service_categories (organisation_id, name)
select distinct s.organisation_id, s.category
from public.services s
where s.category is not null
  and btrim(s.category) <> ''
on conflict (organisation_id, name) do nothing;

insert into public.service_categories (organisation_id, name)
select o.id, category_name
from public.organisations o
cross join (
  values
    ('Laser Hair Removal'),
    ('Facials'),
    ('PRP'),
    ('Massage'),
    ('Fat Dissolving'),
    ('Tattoo Removal'),
    ('Skin Treatments'),
    ('Body Contouring')
) as defaults(category_name)
on conflict (organisation_id, name) do nothing;

update public.services s
set category_id = c.id
from public.service_categories c
where c.organisation_id = s.organisation_id
  and c.name = s.category
  and s.category_id is null;

update public.appointments a
set
  service_snapshot_name = coalesce(a.service_snapshot_name, s.name),
  service_snapshot_price = coalesce(a.service_snapshot_price, s.price),
  service_snapshot_category = coalesce(a.service_snapshot_category, s.category)
from public.services s
where s.id = a.service_id;

drop trigger if exists set_service_categories_updated_at on public.service_categories;
create trigger set_service_categories_updated_at before update on public.service_categories for each row execute function public.set_updated_at();

alter table public.service_categories enable row level security;

drop policy if exists "members read service categories" on public.service_categories;
create policy "members read service categories" on public.service_categories for select using (public.is_org_member(organisation_id));

drop policy if exists "admins manage service categories" on public.service_categories;
create policy "admins manage service categories" on public.service_categories for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

notify pgrst, 'reload schema';
