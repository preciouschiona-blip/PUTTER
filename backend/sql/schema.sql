-- PUTTER database schema (Supabase / Postgres). Run once in the Supabase SQL editor.

create table if not exists config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists fixtures (
  id text primary key,
  league text not null,
  league_id integer,
  home_team text not null,
  away_team text not null,
  kickoff timestamptz not null,
  status text not null default 'NS',
  home_goals integer,
  away_goals integer,
  analysis_status text not null default 'pending',   -- pending | analysed | skipped | no_odds
  analysis_note text,
  quality numeric,
  exp_home numeric,
  exp_away numeric,
  candidates integer default 0,
  qualified integer default 0,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists fixtures_kickoff_idx on fixtures (kickoff);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references fixtures(id),
  kickoff timestamptz not null,
  league text not null,
  home_team text not null,
  away_team text not null,
  market_id text not null,
  market_label text not null,
  selection_label text not null,
  odds numeric not null check (odds >= 1.01),
  bookmaker text,
  odds_updated timestamptz,
  p_model numeric, p_adj numeric, implied_prob numeric, ev numeric,
  confidence integer, quality numeric, score numeric,
  grade text not null check (grade in ('GREEN','AMBER')),
  explanation text,
  key_players jsonb default '[]', factors jsonb default '[]', risks jsonb default '[]',
  score_matrix jsonb,
  sport_key text, odds_event_id text,
  is_demo boolean not null default false,
  published_at timestamptz not null default now(),
  -- mutable result / price-tracking columns
  result text not null default 'PENDING' check (result in ('PENDING','WON','LOST','VOID')),
  profit numeric,
  home_goals integer, away_goals integer, settled_at timestamptz,
  latest_odds numeric, latest_odds_at timestamptz,
  closing_odds numeric,
  unique (fixture_id, market_id)
);
create index if not exists picks_kickoff_idx on picks (kickoff desc);
create index if not exists picks_result_idx on picks (result);

create table if not exists runs (
  id bigint generated always as identity primary key,
  kind text not null,                      -- pipeline | settle | closing
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  fixtures_seen integer default 0,
  fixtures_analysed integer default 0,
  picks_published integer default 0,
  message text,
  api_calls integer default 0
);

-- Track record integrity: a published recommendation can never be deleted or rewritten.
create or replace function picks_protect() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Published picks cannot be deleted';
  end if;
  if (new.id, new.fixture_id, new.kickoff, new.league, new.home_team, new.away_team, new.market_id,
      new.market_label, new.selection_label, new.odds, new.bookmaker, new.odds_updated, new.p_model, new.p_adj,
      new.implied_prob, new.ev, new.confidence, new.quality, new.score, new.grade, new.explanation,
      new.key_players, new.factors, new.risks, new.score_matrix, new.is_demo, new.published_at)
     is distinct from
     (old.id, old.fixture_id, old.kickoff, old.league, old.home_team, old.away_team, old.market_id,
      old.market_label, old.selection_label, old.odds, old.bookmaker, old.odds_updated, old.p_model, old.p_adj,
      old.implied_prob, old.ev, old.confidence, old.quality, old.score, old.grade, old.explanation,
      old.key_players, old.factors, old.risks, old.score_matrix, old.is_demo, old.published_at) then
    raise exception 'Published recommendations are immutable';
  end if;
  if old.result <> 'PENDING' and new.result is distinct from old.result then
    raise exception 'A settled result cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists picks_protect_upd on picks;
create trigger picks_protect_upd before update on picks for each row execute function picks_protect();
drop trigger if exists picks_protect_del on picks;
create trigger picks_protect_del before delete on picks for each row execute function picks_protect();

-- Row level security: the app (anon key) can only read. The backend uses the service role key.
alter table config enable row level security;
alter table fixtures enable row level security;
alter table picks enable row level security;
alter table runs enable row level security;
drop policy if exists read_config on config;   create policy read_config on config for select to anon using (true);
drop policy if exists read_fixtures on fixtures; create policy read_fixtures on fixtures for select to anon using (true);
drop policy if exists read_picks on picks;     create policy read_picks on picks for select to anon using (true);
drop policy if exists read_runs on runs;       create policy read_runs on runs for select to anon using (true);

-- Defaults (edit these rows in Supabase to reconfigure without rebuilding the app).
insert into config (key, value) values
  ('settings', '{"min_odds":2.0,"green_min_ev":0.05,"amber_min_ev":0.02,"green_min_quality":0.6,"green_max_model_spread":0.08,"max_fixtures_per_run":25,"lookahead_days":2}'),
  ('odds_sport_keys', '["soccer_epl","soccer_efl_champ","soccer_spain_la_liga","soccer_italy_serie_a","soccer_germany_bundesliga","soccer_france_ligue_one","soccer_uefa_champs_league","soccer_uefa_europa_league","soccer_uefa_europa_conference_league","soccer_fa_cup","soccer_spain_copa_del_rey"]'),
  ('leagues_enabled', '[]')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Daily tickets (up to three multi-selection slips per day built from published picks)
-- ---------------------------------------------------------------------------
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_date date not null,
  slot integer not null check (slot between 1 and 3),
  name text not null,
  strategy text not null,
  grade text not null check (grade in ('GREEN','AMBER')),
  legs jsonb not null,
  combined_odds numeric not null,
  probability numeric not null,
  ev numeric not null,
  risk text,
  first_kickoff timestamptz not null,
  last_kickoff timestamptz not null,
  note text,
  is_demo boolean not null default false,
  published_at timestamptz not null default now(),
  result text not null default 'PENDING' check (result in ('PENDING','WON','LOST','VOID')),
  profit numeric,
  leg_results jsonb,
  settled_at timestamptz,
  unique (ticket_date, slot, is_demo)
);
create index if not exists tickets_date_idx on tickets (ticket_date desc);

create or replace function tickets_protect() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Published tickets cannot be deleted'; end if;
  if (new.id, new.ticket_date, new.slot, new.name, new.strategy, new.grade, new.legs, new.combined_odds, new.probability,
      new.ev, new.first_kickoff, new.last_kickoff, new.is_demo, new.published_at)
     is distinct from
     (old.id, old.ticket_date, old.slot, old.name, old.strategy, old.grade, old.legs, old.combined_odds, old.probability,
      old.ev, old.first_kickoff, old.last_kickoff, old.is_demo, old.published_at) then
    raise exception 'Published tickets are immutable';
  end if;
  if old.result <> 'PENDING' and new.result is distinct from old.result then
    raise exception 'A settled ticket result cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists tickets_protect_upd on tickets;
create trigger tickets_protect_upd before update on tickets for each row execute function tickets_protect();
drop trigger if exists tickets_protect_del on tickets;
create trigger tickets_protect_del before delete on tickets for each row execute function tickets_protect();
alter table tickets enable row level security;
drop policy if exists read_tickets on tickets; create policy read_tickets on tickets for select to anon using (true);

-- API role privileges (newer Supabase projects do not grant these automatically).
grant usage on schema public to anon, service_role;
grant all on all tables in schema public to service_role;
grant select on all tables in schema public to anon;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on tables to anon;

-- ---------------------------------------------------------------------------
-- Results cache: finished matches saved once per day, used to build team form on API plans without history access
-- ---------------------------------------------------------------------------
create table if not exists results_cache (
  fixture_id text primary key,
  league_id integer,
  league text,
  kickoff timestamptz not null,
  home_id integer not null,
  away_id integer not null,
  home_name text,
  away_name text,
  home_goals integer not null,
  away_goals integer not null
);
create index if not exists results_cache_home_idx on results_cache (home_id, kickoff desc);
create index if not exists results_cache_away_idx on results_cache (away_id, kickoff desc);
create table if not exists results_days (
  day date primary key,
  row_count integer,
  fetched_at timestamptz not null default now()
);
alter table results_cache enable row level security;
alter table results_days enable row level security;
grant all on results_cache, results_days to service_role;
