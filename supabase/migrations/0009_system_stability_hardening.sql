alter table public.staff
  alter column role type text using coalesce(role::text, 'staff');

update public.staff
set role = 'staff'
where role in ('organisation_owner', 'super_admin', 'client')
   or role is null
   or btrim(role) = '';

alter table public.staff
  alter column role set default 'staff';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_role_clinic_role_check'
      and conrelid = 'public.staff'::regclass
  ) then
    alter table public.staff
      add constraint staff_role_clinic_role_check
      check (role in ('admin', 'staff', 'therapist', 'reception', 'manager'));
  end if;
end;
$$;

alter table public.staff add column if not exists deleted_at timestamptz;
alter table public.staff add column if not exists deleted_by uuid references public.users(id) on delete set null;

notify pgrst, 'reload schema';
