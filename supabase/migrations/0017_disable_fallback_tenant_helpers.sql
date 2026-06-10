do $$
begin
  if exists (select 1 from pg_type where typname = 'app_role') then
    alter type public.app_role add value if not exists 'manager';
  end if;
end $$;

alter table if exists public.staff
  drop constraint if exists staff_role_allowed;

alter table if exists public.staff
  add constraint staff_role_allowed
  check (role in ('organisation_owner', 'admin', 'manager', 'therapist', 'receptionist', 'staff'));

create or replace function public.ensure_user_organisation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Automatic organisation onboarding is disabled. Assign auth_users.organisation_id explicitly.';
end;
$$;

revoke all on function public.ensure_user_organisation() from public;
revoke all on function public.ensure_user_organisation() from authenticated;

create or replace function public.seed_default_services(target_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Automatic service seeding is disabled. Manage services explicitly per organisation.';
end;
$$;

revoke all on function public.seed_default_services(uuid) from public;
revoke all on function public.seed_default_services(uuid) from authenticated;

notify pgrst, 'reload schema';
