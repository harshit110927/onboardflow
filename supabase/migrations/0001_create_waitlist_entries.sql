-- Create this table in Supabase before enabling the v2 landing-page waitlist form.
-- The app writes through the server-only DATABASE_URL/Drizzle connection in
-- app/api/waitlist/route.ts; no Supabase service-role key is exposed to the client.
create table if not exists public.waitlist_entries (
  id serial primary key,
  email varchar(255) not null,
  source varchar(100) not null default 'v2_landing',
  user_agent text,
  created_at timestamp not null default now()
);

create unique index if not exists waitlist_entries_email_idx
  on public.waitlist_entries (email);

-- Safe-by-default Supabase posture: browser clients using anon/authenticated keys cannot
-- read or write this table unless a future migration explicitly adds policies.
alter table public.waitlist_entries enable row level security;
