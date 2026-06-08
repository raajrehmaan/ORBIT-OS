# OrbitOS

Production-grade SaaS MVP foundation for organisation-based operations.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, and Row Level Security

## Project Structure

```text
app/
  (auth)/login/          Supabase password login
  auth/callback/         Supabase SSR auth callback
  (dashboard)/           Protected application shell
    dashboard/
    calendar/
    clients/
    staff/
    services/
    settings/
components/
  layout/                Dashboard navigation and top bar
  ui/                    Small reusable UI primitives
lib/
  actions/               Server actions for auth and CRUD
  auth/                  Session and permission helpers
  db/                    Server-side data queries
  supabase/              Browser and server Supabase clients
supabase/
  migrations/            SQL schema, indexes, triggers, RLS policies
types/
  database.ts            Supabase table and enum types
```

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database

Apply `supabase/migrations/0001_initial_schema.sql` to a Supabase project. It creates:

- `organisations`
- `users`
- `staff`
- `clients`
- `services`
- `appointments`

The migration enables Row Level Security on every application table and scopes data through `organisation_id`. Appointment inserts and updates are protected by a trigger that prevents cross-organisation client, staff, or service references.

## Roles

Roles are stored in `public.users.role`:

- `super_admin`
- `organisation_owner`
- `admin`
- `staff`
- `client`

Application permissions are mirrored in `lib/auth/permissions.ts`, while the database remains authoritative through RLS helper functions such as `is_org_member`, `has_min_role`, and `is_super_admin`.

## Authentication Flow

1. Users sign in at `/login` with Supabase Auth.
2. Middleware refreshes SSR sessions and protects application routes.
3. `/auth/callback` exchanges OAuth or magic-link codes when those providers are enabled.
4. A database trigger creates the matching `public.users` profile from Supabase Auth metadata.
5. Protected layouts load the current profile server-side before rendering.

When inviting or creating users, set Auth `app_metadata.organisation_id` and `app_metadata.role` so the profile trigger can place them into the correct tenant.

## MVP Scope

Implemented:

- Multi-tenant schema and RLS
- Organisation-based data isolation
- Role-aware application guards
- Supabase Auth login and SSR session handling
- Dashboard layout
- Client CRUD
- Service CRUD
- Appointment CRUD
- Staff and settings read views
- Responsive Tailwind UI with dark-mode tokens

Not implemented by design:

- AI features
- Payments
- Notifications
