// Run Supabase schema migration — execute with: node scripts/run-schema.mjs
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = `postgresql://postgres.sitrpcpndildmodynifq:xjzAQ8bf7euzNBu1@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;

// Try multiple pooler regions
const REGIONS = [
  'aws-0-ap-south-1',
  'aws-0-us-east-1',
  'aws-0-us-west-1', 
  'aws-0-eu-west-1',
  'aws-0-eu-central-1',
  'aws-0-ap-southeast-1',
];

async function tryConnect() {
  for (const region of REGIONS) {
    const url = `postgresql://postgres.sitrpcpndildmodynifq:xjzAQ8bf7euzNBu1@${region}.pooler.supabase.com:6543/postgres`;
    console.log(`Trying ${region}...`);
    try {
      const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
      await client.connect();
      console.log(`  Connected via ${region}!`);
      return client;
    } catch (e) {
      console.log(`  Failed: ${e.message.slice(0, 80)}`);
    }
  }
  // Try direct connection
  console.log('Trying direct connection...');
  try {
    const client = new pg.Client({
      host: 'db.sitrpcpndildmodynifq.supabase.co',
      port: 5432,
      user: 'postgres',
      password: 'xjzAQ8bf7euzNBu1',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await client.connect();
    console.log('  Connected direct!');
    return client;
  } catch (e) {
    console.log(`  Direct failed: ${e.message.slice(0, 80)}`);
  }
  return null;
}

async function main() {
  const client = await tryConnect();
  if (!client) {
    console.error('Could not connect to any endpoint');
    process.exit(1);
  }

  // Read and execute schema
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  // Split into statements (simple split on semicolons at start of line or after newline)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith('--'));

  console.log(`\nExecuting ${statements.length} statements...\n`);

  let ok = 0, fail = 0;
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
    try {
      await client.query(stmt);
      console.log(`  ✓ ${preview}`);
      ok++;
    } catch (e) {
      // Skip "already exists" errors
      if (e.message.includes('already exists') || e.message.includes('duplicate key')) {
        console.log(`  ~ ${preview} (already exists)`);
        ok++;
      } else {
        console.log(`  ✗ ${preview}`);
        console.log(`    Error: ${e.message.slice(0, 120)}`);
        fail++;
      }
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${fail} failed`);

  // Verify tables
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  console.log('\nExisting tables:');
  rows.forEach(r => console.log(`  • ${r.table_name}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
