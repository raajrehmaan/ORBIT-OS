create table if not exists public.appointment_status_colours (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  status text not null,
  background_color text not null,
  text_color text not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, status)
);

create index if not exists appointment_status_colours_organisation_id_idx
  on public.appointment_status_colours (organisation_id);

delete from public.appointment_status_colours a
using public.appointment_status_colours b
where a.ctid < b.ctid
  and a.organisation_id = b.organisation_id
  and a.status = b.status;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointment_status_colours'::regclass
      and contype = 'u'
      and conname = 'appointment_status_colours_organisation_id_status_key'
  ) then
    alter table public.appointment_status_colours
      add constraint appointment_status_colours_organisation_id_status_key unique (organisation_id, status);
  end if;
end;
$$;

alter table public.appointment_status_colours enable row level security;

drop policy if exists "members read appointment status colours" on public.appointment_status_colours;
create policy "members read appointment status colours" on public.appointment_status_colours
for select using (public.is_org_member(organisation_id));

drop policy if exists "admins manage appointment status colours" on public.appointment_status_colours;
create policy "admins manage appointment status colours" on public.appointment_status_colours
for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

insert into public.appointment_status_colours (organisation_id, status, background_color, text_color)
select o.id, defaults.status, defaults.background_color, defaults.text_color
from public.organisations o
cross join (
  values
    ('scheduled', '#fef3c7', '#92400e'),
    ('confirmed', '#dbeafe', '#1d4ed8'),
    ('arrived', '#fef3c7', '#92400e'),
    ('in_progress', '#ede9fe', '#6d28d9'),
    ('completed', '#dcfce7', '#166534'),
    ('cancelled', '#fee2e2', '#991b1b'),
    ('rescheduled', '#dbeafe', '#1d4ed8'),
    ('no_show', '#ffedd5', '#9a3412'),
    ('archived', '#e5e7eb', '#374151')
) as defaults(status, background_color, text_color)
where not exists (
  select 1
  from public.appointment_status_colours existing
  where existing.organisation_id = o.id
    and existing.status = defaults.status
);

insert into public.appointment_status_colours (organisation_id, status, background_color, text_color)
select sc.organisation_id, sc.status_key, sc.colour || '18', sc.colour
from public.status_colours sc
where sc.organisation_id is not null
  and sc.colour_type = 'appointment'
  and not exists (
    select 1
    from public.appointment_status_colours existing
    where existing.organisation_id = sc.organisation_id
      and existing.status = sc.status_key
  );

insert into public.service_categories (organisation_id, name, color)
select o.id, 'Uncategorised', 'slate'
from public.organisations o
where to_regclass('public.service_categories') is not null
  and not exists (
    select 1
    from public.service_categories c
    where c.organisation_id = o.id
      and c.name = 'Uncategorised'
  );

update public.services s
set category = 'Uncategorised'
where to_regclass('public.services') is not null
  and (s.category is null or btrim(s.category) = '' or lower(btrim(s.category)) = 'general');

update public.services s
set category_id = c.id
from public.service_categories c
where c.organisation_id = s.organisation_id
  and c.name = s.category
  and s.category_id is null;

do $$
declare
  missing_items text[];
begin
  select array_agg(item)
  into missing_items
  from (
    values
      ('table:public.appointment_status_colours', to_regclass('public.appointment_status_colours') is not null),
      ('appointment_status_colours.organisation_id', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointment_status_colours' and column_name = 'organisation_id')),
      ('appointment_status_colours.status', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointment_status_colours' and column_name = 'status')),
      ('appointment_status_colours.background_color', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointment_status_colours' and column_name = 'background_color')),
      ('appointment_status_colours.text_color', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointment_status_colours' and column_name = 'text_color')),
      ('appointment_status_colours_unique', exists (
        select 1
        from pg_constraint
        where conrelid = 'public.appointment_status_colours'::regclass
          and contype = 'u'
          and conname = 'appointment_status_colours_organisation_id_status_key'
      ) or exists (
        select 1
        from pg_constraint
        where conrelid = 'public.appointment_status_colours'::regclass
          and contype = 'u'
          and conname = 'appointment_status_colours_organisation_id_status_key1'
      ) or exists (
        select 1
        from pg_constraint
        where conrelid = 'public.appointment_status_colours'::regclass
          and contype = 'u'
          and conname = 'appointment_status_colours_organisation_id_status_key2'
      ) or exists (
        select 1
        from pg_constraint
        where conrelid = 'public.appointment_status_colours'::regclass
          and contype = 'u'
          and conkey = array[
            (select attnum from pg_attribute where attrelid = 'public.appointment_status_colours'::regclass and attname = 'organisation_id'),
            (select attnum from pg_attribute where attrelid = 'public.appointment_status_colours'::regclass and attname = 'status')
          ]::smallint[]
      ))
  ) as checks(item, ok)
  where not ok;

  if missing_items is not null then
    raise exception 'Status colour schema recovery failed. Missing: %', array_to_string(missing_items, ', ');
  end if;
end;
$$;

notify pgrst, 'reload schema';
