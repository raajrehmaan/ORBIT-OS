alter table public.staff
add column if not exists role public.app_role not null default 'staff';

alter table public.staff
add column if not exists notes text;

alter table public.staff
alter column email drop not null;

alter table public.staff
add column if not exists active boolean not null default true;

alter table public.staff
add column if not exists created_at timestamptz not null default now();

alter table public.staff
add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_staff_updated_at on public.staff;

create trigger set_staff_updated_at
before update on public.staff
for each row
execute function public.set_updated_at();

alter table public.staff enable row level security;

drop policy if exists "admins manage staff" on public.staff;

create policy "admins manage staff"
on public.staff
for all
using (
  public.has_min_role(
    organisation_id,
    array['organisation_owner', 'admin']::public.app_role[]
  )
)
with check (
  public.has_min_role(
    organisation_id,
    array['organisation_owner', 'admin']::public.app_role[]
  )
);

drop policy if exists "members read staff" on public.staff;

create policy "members read staff"
on public.staff
for select
using (public.is_org_member(organisation_id));

notify pgrst, 'reload schema';
