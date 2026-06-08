alter table public.appointments
add column if not exists cancelled_at timestamptz;

alter table public.appointments
add column if not exists cancelled_by uuid references public.users(id) on delete set null;

alter table public.appointments
add column if not exists cancellation_reason text;

notify pgrst, 'reload schema';
