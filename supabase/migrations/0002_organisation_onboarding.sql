create or replace function public.ensure_user_organisation()
returns public.users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
  auth_user record;
  existing_profile public.users;
  new_organisation_id uuid;
  organisation_name text;
  organisation_slug text;
  profile_role public.app_role;
  ensured_profile public.users;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'authenticated user required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select * into existing_profile
  from public.users
  where id = current_user_id;

  if existing_profile.id is not null and existing_profile.organisation_id is not null then
    return existing_profile;
  end if;

  select *
  into auth_user
  from auth.users
  where id = current_user_id;

  if auth_user.id is null then
    raise exception 'auth user not found';
  end if;

  new_organisation_id := gen_random_uuid();
  organisation_name := coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'organisation_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'company_name', ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'My Organisation'
  );
  organisation_slug := lower(regexp_replace(organisation_name, '[^a-zA-Z0-9]+', '-', 'g'));
  organisation_slug := trim(both '-' from organisation_slug);
  organisation_slug := coalesce(nullif(organisation_slug, ''), 'organisation') || '-' || substr(replace(new_organisation_id::text, '-', ''), 1, 8);

  insert into public.organisations (id, name, slug)
  values (new_organisation_id, organisation_name, organisation_slug);

  profile_role := case
    when existing_profile.role is not null and existing_profile.role <> 'client' then existing_profile.role
    when auth_user.raw_app_meta_data ->> 'role' in ('super_admin', 'organisation_owner', 'admin', 'staff', 'client')
      then (auth_user.raw_app_meta_data ->> 'role')::public.app_role
    else 'organisation_owner'
  end;

  if existing_profile.id is not null then
    update public.users
    set
      organisation_id = new_organisation_id,
      email = coalesce(nullif(existing_profile.email, ''), auth_user.email, ''),
      full_name = coalesce(
        nullif(existing_profile.full_name, ''),
        nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
        auth_user.email,
        'Organisation owner'
      ),
      role = case when profile_role = 'client' then 'organisation_owner' else profile_role end
    where id = current_user_id
    returning * into ensured_profile;
  else
    insert into public.users (id, organisation_id, email, full_name, role)
    values (
      current_user_id,
      new_organisation_id,
      coalesce(auth_user.email, ''),
      coalesce(nullif(auth_user.raw_user_meta_data ->> 'full_name', ''), auth_user.email, 'Organisation owner'),
      case when profile_role = 'client' then 'organisation_owner' else profile_role end
    )
    returning * into ensured_profile;
  end if;

  insert into public.staff (organisation_id, user_id, full_name, email, active)
  values (
    new_organisation_id,
    current_user_id,
    ensured_profile.full_name,
    ensured_profile.email,
    true
  )
  on conflict (organisation_id, email) do nothing;

  return ensured_profile;
end;
$$;

revoke all on function public.ensure_user_organisation() from public;
grant execute on function public.ensure_user_organisation() to authenticated;
