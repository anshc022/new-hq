/**
 * /api/run-schema — ONE-TIME route to create missing tables.
 * DELETE THIS FILE after running it once.
 * 
 * GET /api/run-schema → creates all missing tables
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTable(name, columns, extra = '') {
  // Try a select first — if table exists, skip
  const { error: checkErr } = await supabase.from(name).select('*').limit(1);
  if (!checkErr) return { table: name, status: 'exists' };

  // Table doesn't exist — we need to create via individual inserts
  // But Supabase REST can't create tables. We'll use a workaround.
  return { table: name, status: 'needs_creation', error: checkErr.message };
}

export async function GET() {
  const results = {};

  // Check which tables already exist
  const tables = [
    'ops_agents', 'agent_activity', 'agent_relationships', 
    'ops_events', 'ops_nodes', 'ops_todos', 'ops_goals', 
    'ops_blockers', 'ops_revenue', 'ops_pipeline'
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1);
    results[t] = error ? `MISSING — ${error.message}` : 'OK';
  }

  // For missing tables, try to create them using Supabase SQL via the management API
  // This requires the service role key + the SQL endpoint
  const missingTables = Object.entries(results)
    .filter(([, v]) => v.startsWith('MISSING'))
    .map(([k]) => k);

  if (missingTables.length === 0) {
    return Response.json({ ok: true, message: 'All tables exist!', tables: results });
  }

  // Build SQL for missing tables only
  const sqlParts = [];

  if (missingTables.includes('agent_activity')) {
    sqlParts.push(`
      create table agent_activity (
        id bigserial primary key,
        agent text not null,
        event_type text not null,
        status text,
        task text,
        detail text,
        metadata jsonb default '{}'::jsonb,
        created_at timestamptz default now()
      );
      create index agent_activity_agent_idx on agent_activity(agent);
      create index agent_activity_created_idx on agent_activity(created_at desc);
    `);
  }

  if (missingTables.includes('agent_relationships')) {
    sqlParts.push(`
      create table agent_relationships (
        id bigserial primary key,
        source_agent text not null,
        target_agent text not null,
        relationship text not null,
        weight float default 1.0,
        last_interaction_at timestamptz default now(),
        interaction_count int default 0,
        created_at timestamptz default now(),
        unique(source_agent, target_agent, relationship)
      );
    `);
  }

  if (missingTables.includes('ops_todos')) {
    sqlParts.push(`
      create table ops_todos (
        id bigserial primary key,
        title text not null,
        agent text,
        priority text default 'medium',
        done boolean default false,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
  }

  if (missingTables.includes('ops_goals')) {
    sqlParts.push(`
      create table ops_goals (
        id bigserial primary key,
        title text not null,
        description text,
        progress int default 0,
        status text default 'active',
        owner text,
        deadline date,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
  }

  if (missingTables.includes('ops_blockers')) {
    sqlParts.push(`
      create table ops_blockers (
        id bigserial primary key,
        title text not null,
        detail text,
        severity text default 'medium',
        agent text,
        resolved boolean default false,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
  }

  if (missingTables.includes('ops_revenue')) {
    sqlParts.push(`
      create table ops_revenue (
        id bigserial primary key,
        label text not null,
        amount numeric(12,2) not null default 0,
        currency text default 'USD',
        source text,
        agent text,
        date date default current_date,
        created_at timestamptz default now()
      );
    `);
  }

  if (missingTables.includes('ops_pipeline')) {
    sqlParts.push(`
      create table ops_pipeline (
        id bigserial primary key,
        title text not null,
        description text,
        stage text default 'discovery',
        agent text,
        priority text default 'medium',
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
  }

  // Try executing via Supabase pg endpoint
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)/)?.[1];
  
  if (ref && sqlParts.length > 0) {
    const fullSQL = sqlParts.join('\n');
    
    try {
      // Use the Supabase SQL API (available with service role)
      const pgRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc`, {
        method: 'POST', 
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: fullSQL }),
      });

      if (!pgRes.ok) {
        return Response.json({
          ok: false,
          message: 'Cannot create tables via REST API. Please run supabase/schema.sql manually in Supabase SQL Editor.',
          missing: missingTables,
          sql_to_run: fullSQL,
          tables: results,
        });
      }
    } catch (e) {
      return Response.json({
        ok: false,
        message: 'Cannot create tables via REST API. Please run supabase/schema.sql manually in Supabase SQL Editor.',
        missing: missingTables,
        sql_to_run: sqlParts.join('\n'),
        tables: results,
      });
    }
  }

  return Response.json({
    ok: false,
    message: 'Some tables are missing. Run supabase/schema.sql in Supabase SQL Editor.',
    missing: missingTables,
    sql_to_run: sqlParts.join('\n'),
    tables: results,
  });
}
