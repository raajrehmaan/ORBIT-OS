do $$
begin
  if exists (select 1 from pg_type where typname = 'app_role') then
    alter type public.app_role add value if not exists 'manager';
  end if;
end $$;

alter table public.organisations
  add column if not exists business_info jsonb not null default '{}'::jsonb,
  add column if not exists logo_path text,
  add column if not exists brand_primary_color text,
  add column if not exists brand_secondary_color text;

create table if not exists public.client_photos (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  category text not null default 'progress' check (category in ('consultation', 'before', 'after', 'progress', 'consent', 'treatment-area', 'followup')),
  storage_path text not null,
  thumbnail_path text,
  original_filename text,
  mime_type text,
  file_size bigint,
  notes text,
  archived_at timestamptz,
  archived_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_photos_org_client_idx on public.client_photos (organisation_id, client_id, created_at desc);
create index if not exists client_photos_org_archived_idx on public.client_photos (organisation_id, archived_at);

drop trigger if exists set_client_photos_updated_at on public.client_photos;
create trigger set_client_photos_updated_at
before update on public.client_photos
for each row execute function public.set_updated_at();

alter table public.client_photos enable row level security;

drop policy if exists "members read client photos" on public.client_photos;
create policy "members read client photos" on public.client_photos
for select
using (public.is_org_member(organisation_id));

drop policy if exists "staff manage client photos" on public.client_photos;
create policy "staff manage client photos" on public.client_photos
for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin', 'staff']::public.app_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organisation-assets',
  'organisation-assets',
  false,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update public.organisations
set name = 'Laser Treat Esthetica',
    slug = case when slug = 'orbitos-e2e-tester' then 'laser-treat-esthetica' else slug end,
    updated_at = now()
where name = 'OrbitOS E2E Tester';

notify pgrst, 'reload schema';
