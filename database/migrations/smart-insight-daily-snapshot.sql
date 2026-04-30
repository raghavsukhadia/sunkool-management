-- Smart Insight daily cache for fast dashboard rendering.
create table if not exists public.smart_insight_daily_snapshot (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  timeframe text not null check (timeframe in ('today', 'next24h', 'week')),
  generated_at timestamptz not null default now(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_date, timeframe)
);

create index if not exists idx_smart_insight_snapshot_date
  on public.smart_insight_daily_snapshot(snapshot_date desc, timeframe);

alter table public.smart_insight_daily_snapshot enable row level security;

drop policy if exists "smart insight snapshot read auth" on public.smart_insight_daily_snapshot;
create policy "smart insight snapshot read auth"
  on public.smart_insight_daily_snapshot
  for select
  to authenticated
  using (true);

drop policy if exists "smart insight snapshot write auth" on public.smart_insight_daily_snapshot;
create policy "smart insight snapshot write auth"
  on public.smart_insight_daily_snapshot
  for all
  to authenticated
  using (true)
  with check (true);
