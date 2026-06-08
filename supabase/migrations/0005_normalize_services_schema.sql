create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price numeric(10,2) not null default 0.00 check (price >= 0),
  category text not null default 'General',
  color text not null default 'teal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services
add column if not exists id uuid default gen_random_uuid();

alter table public.services
add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;

alter table public.services
add column if not exists name text;

alter table public.services
add column if not exists description text;

alter table public.services
add column if not exists duration_minutes integer default 60;

alter table public.services
add column if not exists price numeric(10,2);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'price_cents'
  ) then
    execute 'update public.services set price = round((price_cents::numeric / 100.0), 2) where price is null';
  end if;
end;
$$;

notify pgrst, 'reload schema';

update public.services
set price = 0.00
where price is null;

alter table public.services
alter column price set default 0.00,
alter column price set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_price_non_negative'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
    add constraint services_price_non_negative check (price >= 0);
  end if;
end;
$$;

alter table public.services
add column if not exists category text;

update public.services
set category = 'General'
where category is null
   or btrim(category) = '';

alter table public.services
alter column category set default 'General',
alter column category set not null;

alter table public.services
add column if not exists color text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'color_tag'
  ) then
    execute 'update public.services set color = coalesce(nullif(color, ''''), nullif(color_tag, ''''), ''teal'')';
  end if;
end;
$$;

update public.services
set color = 'teal'
where color is null
   or btrim(color) = '';

alter table public.services
alter column color set default 'teal',
alter column color set not null;

alter table public.services
add column if not exists created_at timestamptz not null default now();

alter table public.services
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

drop trigger if exists set_services_updated_at on public.services;

create trigger set_services_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_color_allowed'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
    add constraint services_color_allowed check (color in ('teal', 'blue', 'violet', 'amber', 'rose', 'slate'));
  end if;
end;
$$;

create or replace function public.seed_default_services(target_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_organisation_id is null then
    raise exception 'organisation required';
  end if;

  if exists (
    select 1
    from public.services
    where organisation_id = target_organisation_id
  ) then
    return;
  end if;

  insert into public.services (
    organisation_id,
    name,
    description,
    duration_minutes,
    price,
    category,
    color
  )
  values
    (target_organisation_id, 'Laser Hair Removal', null, 30, 60.00, 'Laser', 'violet'),
    (target_organisation_id, 'Hydra Facial', null, 60, 120.00, 'Facials', 'blue'),
    (target_organisation_id, 'PRP Face', null, 60, 180.00, 'PRP', 'rose'),
    (target_organisation_id, 'PRP Hair', null, 60, 180.00, 'PRP', 'rose'),
    (target_organisation_id, 'Tattoo Removal', null, 45, 110.00, 'Laser', 'slate'),
    (target_organisation_id, 'Fat Dissolving', null, 45, 150.00, 'Body', 'amber'),
    (target_organisation_id, 'Microneedling', null, 60, 130.00, 'Skin', 'blue'),
    (target_organisation_id, 'Chemical Peel', null, 45, 95.00, 'Skin', 'teal'),
    (target_organisation_id, 'Radiofrequency Skin Tightening', null, 60, 140.00, 'Skin Tightening', 'violet'),
    (target_organisation_id, 'Massage Therapy', null, 60, 80.00, 'Wellness', 'teal'),
    (target_organisation_id, 'Laser Carbon Peel', null, 45, 105.00, 'Laser', 'slate'),
    (target_organisation_id, 'Aqualyx', null, 45, 160.00, 'Injectables', 'amber'),
    (target_organisation_id, 'Full Body Laser', null, 120, 250.00, 'Laser', 'violet'),
    (target_organisation_id, 'Full Face Laser', null, 45, 90.00, 'Laser', 'blue');
end;
$$;

revoke all on function public.seed_default_services(uuid) from public;
grant execute on function public.seed_default_services(uuid) to authenticated;

do $$
declare
  organisation_record record;
begin
  for organisation_record in
    select id
    from public.organisations o
    where not exists (
      select 1
      from public.services s
      where s.organisation_id = o.id
    )
  loop
    perform public.seed_default_services(organisation_record.id);
  end loop;
end;
$$;
