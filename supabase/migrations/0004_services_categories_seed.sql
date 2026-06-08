alter table public.services
add column if not exists category text not null default 'General';

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

  insert into public.services (organisation_id, name, category, duration_minutes, price_cents, color_tag, active)
  values
    (target_organisation_id, 'Laser Hair Removal', 'Laser', 30, 6000, 'violet', true),
    (target_organisation_id, 'Hydra Facial', 'Facials', 60, 12000, 'blue', true),
    (target_organisation_id, 'PRP Face', 'PRP', 60, 18000, 'rose', true),
    (target_organisation_id, 'PRP Hair', 'PRP', 60, 18000, 'rose', true),
    (target_organisation_id, 'Tattoo Removal', 'Laser', 45, 11000, 'slate', true),
    (target_organisation_id, 'Fat Dissolving', 'Body', 45, 15000, 'amber', true),
    (target_organisation_id, 'Microneedling', 'Skin', 60, 13000, 'blue', true),
    (target_organisation_id, 'Chemical Peel', 'Skin', 45, 9500, 'teal', true),
    (target_organisation_id, 'Radiofrequency Skin Tightening', 'Skin Tightening', 60, 14000, 'violet', true),
    (target_organisation_id, 'Massage Therapy', 'Wellness', 60, 8000, 'teal', true),
    (target_organisation_id, 'Laser Carbon Peel', 'Laser', 45, 10500, 'slate', true),
    (target_organisation_id, 'Aqualyx', 'Injectables', 45, 16000, 'amber', true),
    (target_organisation_id, 'Full Body Laser', 'Laser', 120, 25000, 'violet', true),
    (target_organisation_id, 'Full Face Laser', 'Laser', 45, 9000, 'blue', true);
end;
$$;

revoke all on function public.seed_default_services(uuid) from public;
grant execute on function public.seed_default_services(uuid) to authenticated;
