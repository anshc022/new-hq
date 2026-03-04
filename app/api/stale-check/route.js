/**
 * /api/stale-check
 *
 * Called automatically every ~5 minutes by the EC2 cron (or Vercel cron).
 * Scans ops_agents and marks any agent as 'degraded' if:
 *   - last_heartbeat_at is older than heartbeat_interval_min * 2
 *   - AND current status is not already degraded/unknown
 *
 * GET  → run the stale check, return results
 * POST → same (for cron job POST requests)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runStaleCheck() {
  const { data: agents, error } = await supabase
    .from('ops_agents')
    .select('name, status, last_heartbeat_at, heartbeat_interval_min');

  if (error) return { ok: false, error: error.message };

  const now = new Date();
  const degraded = [];
  const alreadyDegraded = [];
  const healthy = [];

  for (const agent of agents || []) {
    const lastHb = agent.last_heartbeat_at ? new Date(agent.last_heartbeat_at) : null;

    if (!lastHb) {
      // Never sent a heartbeat — mark unknown only if not already
      if (agent.status !== 'unknown' && agent.status !== 'degraded') {
        await supabase
          .from('ops_agents')
          .update({ status: 'unknown', updated_at: now.toISOString() })
          .eq('name', agent.name);
      }
      continue;
    }

    const minsAgo = (now - lastHb) / 60000;
    const threshold = (agent.heartbeat_interval_min || 15) * 2.5; // grace period = 2.5x interval

    if (minsAgo > threshold) {
      if (agent.status !== 'degraded') {
        await supabase
          .from('ops_agents')
          .update({
            status: 'degraded',
            current_task: `No heartbeat for ${Math.round(minsAgo)} min`,
            updated_at: now.toISOString(),
          })
          .eq('name', agent.name);

        // Log the degradation event
        await supabase.from('agent_activity').insert({
          agent: agent.name,
          event_type: 'status_change',
          status: 'degraded',
          detail: `Auto-degraded: no heartbeat for ${Math.round(minsAgo)} min (threshold: ${threshold} min)`,
        });

        await supabase.from('ops_events').insert({
          agent: agent.name,
          event_type: 'alert',
          title: `⚠ ${agent.name} degraded — no heartbeat for ${Math.round(minsAgo)} min`,
        });

        degraded.push({ name: agent.name, minsAgo: Math.round(minsAgo) });
      } else {
        alreadyDegraded.push(agent.name);
      }
    } else {
      healthy.push(agent.name);
    }
  }

  return {
    ok: true,
    checked: (agents || []).length,
    newlyDegraded: degraded,
    alreadyDegraded,
    healthy,
    ts: now.toISOString(),
  };
}

export async function GET() {
  const result = await runStaleCheck();
  if (!result.ok) return Response.json(result, { status: 500 });
  return Response.json(result);
}

export async function POST() {
  const result = await runStaleCheck();
  if (!result.ok) return Response.json(result, { status: 500 });
  return Response.json(result);
}
