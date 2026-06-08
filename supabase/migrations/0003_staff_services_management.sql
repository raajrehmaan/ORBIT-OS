alter table public.staff
add column if not exists role public.app_role not null default 'staff';

alter table public.services
add column if not exists color_tag text not null default 'teal'
check (color_tag in ('teal', 'blue', 'violet', 'amber', 'rose', 'slate'));
