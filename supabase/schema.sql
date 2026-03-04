-- ============================================================
-- OpenClaw Command Center — Full Supabase Schema
-- Run this in your Supabase SQL editor (Project > SQL Editor)
-- ============================================================

-- ── 1. ops_agents ─────────────────────────────────────────────
-- One row per agent. Source of truth for current state.
-- ──────────────────────────────────────────────────────────────
create table if not exists ops_agents (
  id            text primary key,          -- same as name (echo, flare, bolt…)
  name          text unique not null,
  display_name  text,
  model         text default 'claude-opus-4.6',
  role          text,
  status        text default 'unknown',    -- active | idle | thinking | working | degraded | unknown
  current_task  text,
  current_room  text,
  last_active_at timestamptz default now(),
  last_heartbeat_at timestamptz,           -- last time agent pinged /api/agent-heartbeat
  heartbeat_interval_min int default 15,   -- expected heartbeat cadence (minutes)
  tool_count    int default 0,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Seed the 6 agents
insert into ops_agents (id, name, display_name, model, role, status)
values
  ('echo',  'echo',  'Echo',  'claude-opus-4.6', 'Tech Lead & Coordinator',  'unknown'),
  ('flare', 'flare', 'Flare', 'claude-opus-4.6', 'UI/UX + Image Gen',        'unknown'),
  ('bolt',  'bolt',  'Bolt',  'claude-opus-4.6', 'Frontend Developer',       'unknown'),
  ('nexus', 'nexus', 'Nexus', 'claude-opus-4.6', 'Backend Developer',        'unknown'),
  ('vigil', 'vigil', 'Vigil', 'claude-opus-4.6', 'QA Engineer',              'unknown'),
  ('forge', 'forge', 'Forge', 'claude-opus-4.6', 'DevOps / Infra',           'unknown')
on conflict (name) do nothing;

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists ops_agents_updated_at on ops_agents;
create trigger ops_agents_updated_at
  before update on ops_agents
  for each row execute function set_updated_at();


-- ── 2. agent_activity ─────────────────────────────────────────
-- Append-only. Every heartbeat, status change, task event.
-- ──────────────────────────────────────────────────────────────
create table if not exists agent_activity (
  id          bigserial primary key,
  agent       text not null references ops_agents(name) on delete cascade,
  event_type  text not null,   -- heartbeat | status_change | task_start | task_end | error | spawn | message
  status      text,            -- agent status at time of event
  task        text,            -- current_task at time of event
  detail      text,            -- human-readable description
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);

create index if not exists agent_activity_agent_idx    on agent_activity(agent);
create index if not exists agent_activity_created_idx  on agent_activity(created_at desc);
create index if not exists agent_activity_type_idx     on agent_activity(event_type);


-- ── 3. agent_relationships ────────────────────────────────────
-- Directional edges. Defines the topology / neural map.
-- ──────────────────────────────────────────────────────────────
create table if not exists agent_relationships (
  id              bigserial primary key,
  source_agent    text not null references ops_agents(name) on delete cascade,
  target_agent    text not null references ops_agents(name) on delete cascade,
  relationship    text not null,   -- spawns | reviews | messages | depends_on | monitors
  weight          float default 1.0,  -- interaction frequency / edge thickness
  last_interaction_at timestamptz default now(),
  interaction_count   int default 0,
  created_at      timestamptz default now(),
  unique(source_agent, target_agent, relationship)
);

-- Seed the known relationships from v3-config.json
insert into agent_relationships (source_agent, target_agent, relationship, weight)
values
  -- Echo is the hub — can spawn all others
  ('echo', 'flare', 'spawns',  1.0),
  ('echo', 'bolt',  'spawns',  1.0),
  ('echo', 'nexus', 'spawns',  1.0),
  ('echo', 'vigil', 'spawns',  1.0),
  ('echo', 'forge', 'spawns',  1.0),
  -- Vigil monitors/reviews all agents
  ('vigil', 'echo',  'monitors', 0.6),
  ('vigil', 'flare', 'monitors', 0.6),
  ('vigil', 'bolt',  'monitors', 0.6),
  ('vigil', 'nexus', 'monitors', 0.6),
  ('vigil', 'forge', 'monitors', 0.6),
  -- Bolt/Flare collaborate on frontend
  ('flare', 'bolt',  'reviews',  0.8),
  ('bolt',  'flare', 'messages', 0.5),
  -- Nexus/Forge backend-infra
  ('nexus', 'forge', 'depends_on', 0.7),
  ('forge', 'nexus', 'messages',   0.5)
on conflict (source_agent, target_agent, relationship) do nothing;


-- ── 4. ops_events ─────────────────────────────────────────────
-- Already exists — ensure schema is right.
-- ──────────────────────────────────────────────────────────────
create table if not exists ops_events (
  id          bigserial primary key,
  agent       text,
  event_type  text,
  title       text,
  detail      text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);

create index if not exists ops_events_agent_idx   on ops_events(agent);
create index if not exists ops_events_created_idx on ops_events(created_at desc);


-- ── 5. ops_nodes ──────────────────────────────────────────────
-- Connected execution nodes (EC2, Windows-Startup-PC, etc.)
-- ──────────────────────────────────────────────────────────────
create table if not exists ops_nodes (
  name         text primary key,
  hostname     text,
  ip           text,
  os           text,
  last_seen    timestamptz default now(),
  connected_at timestamptz default now(),
  metadata     jsonb default '{}'::jsonb
);


-- ── 6. ops_todos ──────────────────────────────────────────────
create table if not exists ops_todos (
  id          bigserial primary key,
  title       text not null,
  agent       text,
  priority    text default 'medium',   -- high | medium | low
  done        boolean default false,
  source      text default 'manual',   -- manual | telegram | discord | whatsapp | chat
  assigned_by text,                    -- who assigned the task (e.g. @anshc022)
  run_id      text,                    -- OpenClaw run ID for auto-done tracking
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- ── 7. ops_goals ──────────────────────────────────────────────
create table if not exists ops_goals (
  id          bigserial primary key,
  title       text not null,
  description text,
  progress    int default 0,            -- 0-100
  status      text default 'active',    -- active | completed | paused
  owner       text,
  deadline    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- ── 8. ops_blockers ───────────────────────────────────────────
create table if not exists ops_blockers (
  id          bigserial primary key,
  title       text not null,
  detail      text,
  severity    text default 'medium',    -- critical | high | medium | low
  agent       text,
  resolved    boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- ── 9. ops_revenue ────────────────────────────────────────────
create table if not exists ops_revenue (
  id          bigserial primary key,
  label       text not null,
  amount      numeric(12,2) not null default 0,
  currency    text default 'USD',
  source      text,
  agent       text,
  date        date default current_date,
  created_at  timestamptz default now()
);


-- ── 10. ops_pipeline ──────────────────────────────────────────
create table if not exists ops_pipeline (
  id          bigserial primary key,
  title       text not null,
  description text,
  stage       text default 'discovery',  -- discovery | in_progress | review | deployed | done
  agent       text,
  priority    text default 'medium',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- ── Enable Realtime on key tables ────────────────────────────
-- Run each line in Supabase Dashboard → Database → Replication
-- OR: alter publication supabase_realtime add table ops_agents;
-- alter publication supabase_realtime add table agent_activity;
-- alter publication supabase_realtime add table ops_events;


-- ── Row Level Security (allow anon read for dashboard) ────────
alter table ops_agents         enable row level security;
alter table agent_activity     enable row level security;
alter table agent_relationships enable row level security;
alter table ops_events         enable row level security;
alter table ops_nodes          enable row level security;
alter table ops_todos          enable row level security;
alter table ops_goals          enable row level security;
alter table ops_blockers       enable row level security;
alter table ops_revenue        enable row level security;
alter table ops_pipeline       enable row level security;

-- Allow dashboard (anon key) to SELECT
create policy "anon_read_agents"         on ops_agents         for select using (true);
create policy "anon_read_activity"       on agent_activity     for select using (true);
create policy "anon_read_relationships"  on agent_relationships for select using (true);
create policy "anon_read_events"         on ops_events         for select using (true);
create policy "anon_read_nodes"          on ops_nodes          for select using (true);
create policy "anon_read_todos"          on ops_todos          for select using (true);
create policy "anon_read_goals"          on ops_goals          for select using (true);
create policy "anon_read_blockers"       on ops_blockers       for select using (true);
create policy "anon_read_revenue"        on ops_revenue        for select using (true);
create policy "anon_read_pipeline"       on ops_pipeline       for select using (true);

-- Allow service_role (used by API routes) full access
-- Service role bypasses RLS by default — no extra policy needed.
