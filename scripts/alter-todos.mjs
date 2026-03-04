import pg from 'pg';

const client = new pg.Client({
  host: 'db.sitrpcpndildmodynifq.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'xjzAQ8bf7euzNBu1',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('Connected to Supabase Postgres');

  await client.query("ALTER TABLE ops_todos ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'");
  console.log('✅ Added source column');

  await client.query("ALTER TABLE ops_todos ADD COLUMN IF NOT EXISTS assigned_by text");
  console.log('✅ Added assigned_by column');

  await client.query("ALTER TABLE ops_todos ADD COLUMN IF NOT EXISTS run_id text");
  console.log('✅ Added run_id column');

  // Verify
  const { rows } = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ops_todos' ORDER BY ordinal_position");
  console.log('\nops_todos columns:');
  for (const r of rows) console.log(`  ${r.column_name} (${r.data_type})`);

  // Notify Supabase to refresh schema cache
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log('\n✅ Schema cache refreshed');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await client.end();
}
