// Direct table creation — run with: node scripts/create-tables.mjs
import pg from 'pg';

async function main() {
  const client = new pg.Client({
    host: 'db.sitrpcpndildmodynifq.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'xjzAQ8bf7euzNBu1',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  console.log('Connected!\n');

  const queries = [
    // 1. Add missing columns to ops_agents
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS heartbeat_interval_min int DEFAULT 15`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS tool_count int DEFAULT 0`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS display_name text`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS model text DEFAULT 'claude-opus-4.6'`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS role text`,
    `ALTER TABLE ops_agents ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,

    // 2. agent_activity
    `CREATE TABLE IF NOT EXISTS agent_activity (
      id bigserial PRIMARY KEY,
      agent text NOT NULL,
      event_type text NOT NULL,
      status text,
      task text,
      detail text,
      metadata jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    )`,

    // 3. agent_relationships
    `CREATE TABLE IF NOT EXISTS agent_relationships (
      id bigserial PRIMARY KEY,
      source_agent text NOT NULL,
      target_agent text NOT NULL,
      relationship text NOT NULL,
      weight float DEFAULT 1.0,
      last_interaction_at timestamptz DEFAULT now(),
      interaction_count int DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      UNIQUE(source_agent, target_agent, relationship)
    )`,

    // 4. ops_todos
    `CREATE TABLE IF NOT EXISTS ops_todos (
      id bigserial PRIMARY KEY,
      title text NOT NULL,
      agent text,
      priority text DEFAULT 'medium',
      done boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,

    // 5. ops_goals
    `CREATE TABLE IF NOT EXISTS ops_goals (
      id bigserial PRIMARY KEY,
      title text NOT NULL,
      description text,
      progress int DEFAULT 0,
      status text DEFAULT 'active',
      owner text,
      deadline date,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,

    // 6. ops_blockers
    `CREATE TABLE IF NOT EXISTS ops_blockers (
      id bigserial PRIMARY KEY,
      title text NOT NULL,
      detail text,
      severity text DEFAULT 'medium',
      agent text,
      resolved boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,

    // 7. ops_revenue
    `CREATE TABLE IF NOT EXISTS ops_revenue (
      id bigserial PRIMARY KEY,
      label text NOT NULL,
      amount numeric(12,2) NOT NULL DEFAULT 0,
      currency text DEFAULT 'USD',
      source text,
      agent text,
      date date DEFAULT CURRENT_DATE,
      created_at timestamptz DEFAULT now()
    )`,

    // 8. ops_pipeline
    `CREATE TABLE IF NOT EXISTS ops_pipeline (
      id bigserial PRIMARY KEY,
      title text NOT NULL,
      description text,
      stage text DEFAULT 'discovery',
      agent text,
      priority text DEFAULT 'medium',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,

    // 9. updated_at trigger function
    `CREATE OR REPLACE FUNCTION set_updated_at()
     RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN NEW.updated_at = now(); RETURN NEW; END; $$`,

    // 10. Trigger on ops_agents
    `DROP TRIGGER IF EXISTS ops_agents_updated_at ON ops_agents`,
    `CREATE TRIGGER ops_agents_updated_at
     BEFORE UPDATE ON ops_agents
     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

    // 11. Indexes
    `CREATE INDEX IF NOT EXISTS agent_activity_agent_idx ON agent_activity(agent)`,
    `CREATE INDEX IF NOT EXISTS agent_activity_created_idx ON agent_activity(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS agent_activity_type_idx ON agent_activity(event_type)`,

    // 12. Seed relationships
    `INSERT INTO agent_relationships (source_agent, target_agent, relationship, weight) VALUES
      ('echo', 'flare', 'spawns', 1.0),
      ('echo', 'bolt',  'spawns', 1.0),
      ('echo', 'nexus', 'spawns', 1.0),
      ('echo', 'vigil', 'spawns', 1.0),
      ('echo', 'forge', 'spawns', 1.0),
      ('vigil', 'echo',  'monitors', 0.6),
      ('vigil', 'flare', 'monitors', 0.6),
      ('vigil', 'bolt',  'monitors', 0.6),
      ('vigil', 'nexus', 'monitors', 0.6),
      ('vigil', 'forge', 'monitors', 0.6),
      ('flare', 'bolt',  'reviews', 0.8),
      ('bolt',  'flare', 'messages', 0.5),
      ('nexus', 'forge', 'depends_on', 0.7),
      ('forge', 'nexus', 'messages', 0.5)
     ON CONFLICT (source_agent, target_agent, relationship) DO NOTHING`,

    // 13. RLS
    `ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ops_todos ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ops_goals ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ops_blockers ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ops_revenue ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ops_pipeline ENABLE ROW LEVEL SECURITY`,

    // 14. Policies (anon read)
    `DO $$ BEGIN
      CREATE POLICY anon_read_activity ON agent_activity FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_relationships ON agent_relationships FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_agents ON ops_agents FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_todos ON ops_todos FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_goals ON ops_goals FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_blockers ON ops_blockers FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_revenue ON ops_revenue FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY anon_read_pipeline ON ops_pipeline FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,

    // 15. Enable Realtime
    `ALTER PUBLICATION supabase_realtime ADD TABLE ops_agents`,
    `ALTER PUBLICATION supabase_realtime ADD TABLE agent_activity`,
    `ALTER PUBLICATION supabase_realtime ADD TABLE ops_events`,
  ];

  let ok = 0, fail = 0;
  for (const q of queries) {
    const preview = q.replace(/\s+/g, ' ').slice(0, 85);
    try {
      await client.query(q);
      console.log(`✓ ${preview}`);
      ok++;
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('already member') || e.message.includes('duplicate')) {
        console.log(`~ ${preview} (already done)`);
        ok++;
      } else {
        console.log(`✗ ${preview}`);
        console.log(`  ${e.message.slice(0, 120)}`);
        fail++;
      }
    }
  }

  // Verify
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log(`\n=== Result: ${ok} OK, ${fail} FAIL ===`);
  console.log(`Tables in database:`);
  rows.forEach(r => console.log(`  • ${r.table_name}`));

  // Check agent_activity
  const { rows: actRows } = await client.query('SELECT count(*) as cnt FROM agent_activity');
  console.log(`\nagent_activity rows: ${actRows[0].cnt}`);
  const { rows: relRows } = await client.query('SELECT count(*) as cnt FROM agent_relationships');
  console.log(`agent_relationships rows: ${relRows[0].cnt}`);

  await client.end();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
