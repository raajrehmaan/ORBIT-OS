-- OrbitOS auth/data integrity recovery.
-- Safe to rerun. Preserves rows and restores visibility when a tenant has no active services/categories.

alter table if exists public.auth_users
  add column if not exists active boolean not null default true;

alter table if exists public.auth_users
  add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;

alter table if exists public.services
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

alter table if exists public.service_categories
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

create index if not exists auth_users_username_active_idx
  on public.auth_users (lower(username), active);

create index if not exists auth_users_organisation_idx
  on public.auth_users (organisation_id);

create index if not exists services_organisation_archived_repair_idx
  on public.services (organisation_id, archived_at);

create index if not exists service_categories_organisation_archived_repair_idx
  on public.service_categories (organisation_id, archived_at);

update public.auth_users au
set organisation_id = u.organisation_id
from public.users u
where au.id = u.id
  and au.organisation_id is null
  and u.organisation_id is not null;

update public.services s
set archived_at = null,
    archived_by = null
where s.archived_at is not null
  and not exists (
    select 1
    from public.services active_service
    where active_service.organisation_id = s.organisation_id
      and active_service.archived_at is null
  );

update public.service_categories sc
set archived_at = null,
    archived_by = null
where sc.archived_at is not null
  and not exists (
    select 1
    from public.service_categories active_category
    where active_category.organisation_id = sc.organisation_id
      and active_category.archived_at is null
  );

notify pgrst, 'reload schema';
