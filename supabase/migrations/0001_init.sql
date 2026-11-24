-- stonkpet schema. Paste into Supabase → SQL Editor → Run. Safe to run once on a new project.
--
-- Access model: only the app's server talks to the database, with the service-role key,
-- and scopes every query to the signed-in wallet. Row-level security is ON for every
-- table, so the public anon key can read nothing. The policies below also let a
-- Supabase-authenticated client read only its own rows, if one is ever added, keyed
-- on a `wallet_address` claim in the JWT.

create extension if not exists pgcrypto;

-- ---------- users ----------
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  address       text not null unique check (address = lower(address) and address ~ '^0x[0-9a-f]{40}$'),
  eligible_at   timestamptz,              -- when they confirmed 18+ and not in the US
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- The current user's id from the JWT's wallet_address claim (null for anon).
create or replace function public.current_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where address = lower(coalesce(auth.jwt() ->> 'wallet_address', ''))
$$;

-- ---------- pet ----------
create table public.pets (
  user_id     uuid primary key references public.users(id) on delete cascade,
  name        text not null default 'Mochi' check (char_length(name) between 1 and 14),
  personality text not null default 'balanced' check (personality in ('calm', 'balanced', 'spicy')),
  level       int  not null default 1 check (level between 1 and 5),
  streak      int  not null default 0 check (streak >= 0),
  updated_at  timestamptz not null default now()
);

-- ---------- what they asked for ----------
create table public.briefs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  text       text not null check (char_length(text) between 3 and 600),
  created_at timestamptz not null default now()
);

create table public.rules (
  user_id          uuid primary key references public.users(id) on delete cascade,
  max_pct          int     not null default 30 check (max_pct between 10 and 60),
  ask_above_usd    numeric not null default 25 check (ask_above_usd >= 0),
  excluded         text[]  not null default '{}',
  paused           boolean not null default false,
  weekly_feed_usd  numeric not null default 0 check (weekly_feed_usd >= 0),
  autopilot        jsonb   not null default '{"rebalance": true, "weekly": false, "ethTakeProfit": false}',
  updated_at       timestamptz not null default now()
);

-- ---------- plans (research output) ----------
create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  brief_id      uuid references public.briefs(id) on delete set null,
  status        text not null default 'proposed' check (status in ('proposed', 'approved', 'superseded')),
  theme         text not null,
  weights       jsonb not null,           -- { ticker: fraction }
  cash          numeric not null default 0,
  lead          text not null,
  price_source  jsonb not null default '{}',  -- { ticker: "chainlink" | "dex" }
  flags         jsonb not null default '[]',
  facts         jsonb not null default '[]',  -- [{ ticker, text, url, title }]
  assumptions   jsonb not null default '[]',
  opinions      jsonb not null default '[]',
  reasons       jsonb not null default '{}',
  model         text,
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);
create index plans_user_created on public.plans (user_id, created_at desc);
-- At most one approved plan per user.
create unique index plans_one_approved on public.plans (user_id) where status = 'approved';

-- ---------- actions: every money-moving proposal and what happened to it ----------
create table public.actions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  plan_id      uuid references public.plans(id) on delete set null,
  type         text not null check (type in ('feed', 'buy', 'sell', 'add', 'drop', 'rebalance', 'setMax', 'setWeeklyFeed', 'trim')),
  params       jsonb not null default '{}',
  source       text not null check (source in ('ui', 'chat', 'autopilot')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed', 'queued')),
  reason       text,                      -- rules-engine refusal or failure reason
  calls_id     text,                      -- EIP-5792 bundle id
  tx_hash      text check (tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  chain_id     int,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  executed_at  timestamptz
);
create index actions_user_created on public.actions (user_id, created_at desc);
create index actions_pending on public.actions (user_id) where status in ('pending', 'queued');

-- ---------- activity feed + receipts ----------
create table public.activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  action_id   uuid references public.actions(id) on delete set null,
  title       text not null,
  detail      text,
  amount_usd  numeric,
  tx_hash     text,
  chain_id    int,
  created_at  timestamptz not null default now()
);
create index activity_user_created on public.activity (user_id, created_at desc);

-- ---------- chat history ----------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     jsonb not null,             -- text, or a card { title, body, actionId }
  action_id   uuid references public.actions(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index messages_user_created on public.messages (user_id, created_at);

-- ---------- holdings snapshots (for charts and the morning note) ----------
create table public.holdings_snapshots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  taken_at   timestamptz not null default now(),
  total_usd  numeric not null,
  holdings   jsonb not null               -- { ticker: { units, priceUsd, valueUsd, source } }
);
create index snapshots_user_taken on public.holdings_snapshots (user_id, taken_at desc);

-- ---------- used sign-in nonces (single use; server only) ----------
create table public.auth_nonces (
  nonce    text primary key,
  used_at  timestamptz not null default now()
);

-- ---------- row-level security ----------
do $$
declare t text;
begin
  foreach t in array array['users', 'pets', 'briefs', 'rules', 'plans', 'actions', 'activity', 'messages', 'holdings_snapshots', 'auth_nonces'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Read-only access to your own rows for an authenticated client. No insert/update/delete
-- policies: writes go through the server (service role), after the rules engine.
create policy users_self   on public.users              for select to authenticated using (id = public.current_user_id());
create policy pets_self    on public.pets               for select to authenticated using (user_id = public.current_user_id());
create policy briefs_self  on public.briefs             for select to authenticated using (user_id = public.current_user_id());
create policy rules_self   on public.rules              for select to authenticated using (user_id = public.current_user_id());
create policy plans_self   on public.plans              for select to authenticated using (user_id = public.current_user_id());
create policy actions_self on public.actions            for select to authenticated using (user_id = public.current_user_id());
create policy activity_self on public.activity          for select to authenticated using (user_id = public.current_user_id());
create policy messages_self on public.messages          for select to authenticated using (user_id = public.current_user_id());
create policy snapshots_self on public.holdings_snapshots for select to authenticated using (user_id = public.current_user_id());

-- anon gets nothing at all.
revoke all on all tables in schema public from anon;
