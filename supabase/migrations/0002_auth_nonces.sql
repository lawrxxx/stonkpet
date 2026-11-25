-- Adds the single-use sign-in nonce table (added to 0001 after it had already been run).
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
create table if not exists public.auth_nonces (
  nonce    text primary key,
  used_at  timestamptz not null default now()
);
alter table public.auth_nonces enable row level security;
revoke all on public.auth_nonces from anon;
