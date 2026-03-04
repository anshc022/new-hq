/**
 * /api/agent-heartbeat
 *
 * Called by OpenClaw agents (via cron script on EC2 or SOUL duty)
 * to report their current state to the command center.
 *
 * POST body:
 * {
 *   agent:        "echo"           // required — agent name
 *   status:       "active"         // active | idle | thinking | working | degraded
 *   current_task: "Reviewing PR"   // optional
 *   current_room: "warroom"        // optional
 *   model:        "claude-opus-4.6" // optional
 *   tool_count:   5                // optional
 *   metadata:     {}               // optional extra info
 *   secret:       "..."            // must match HEARTBEAT_SECRET env var
 * }
 *
 * GET ?agent=echo  → returns last 50 activity log entries for that agent
 * GET              → returns all agents with staleness check
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET || 'openclaw-heartbeat-2026';
const STALE_THRESHOLD_MIN = 130; // Mark degraded if no heartbeat in X minutes

const VALID_AGENTS = new Set(['echo', 'flare', 'bolt', 'nexus', 'vigil', 'forge']);
const VALID_STATUSES = new Set(['active', 'idle', 'thinking', 'working', 'degraded', 'sleeping', 'error', 'researching', 'talking']);

export async function POST(request) {
  try {
    const body = await request.json();

    // Auth check
    const secret = body.secret || request.headers.get('x-heartbeat-secret');
    if (secret !== HEARTBEAT_SECRET) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const agent = (body.agent || '').toLowerCase().trim();
    if (!agent || !VALID_AGENTS.has(agent)) {
      return Response.json({ ok: false, error: `Unknown agent: ${agent}` }, { status: 400 });
    }

    const status = VALID_STATUSES.has(body.status) ? body.status : 'active';
    const now = new Date().toISOString();

    // 1. Upsert into ops_agents
    const updatePayload = {
      name: agent,
      status,
      last_active_at: now,
      last_heartbeat_at: now,
      updated_at: now,
    };
    if (body.current_task !== undefined) updatePayload.current_task = body.current_task;
    if (body.current_room  !== undefined) updatePayload.current_room  = body.current_room;
    if (body.model         !== undefined) updatePayload.model         = body.model;
    if (body.tool_count    !== undefined) updatePayload.tool_count    = body.tool_count;
    if (body.metadata      !== undefined) updatePayload.metadata      = body.metadata;
    if (body.emoji         !== undefined) updatePayload.emoji         = body.emoji;
    if (body.role          !== undefined) updatePayload.role          = body.role;
    if (body.display_name  !== undefined) updatePayload.display_name  = body.display_name;

    const { error: upsertErr } = await supabase
      .from('ops_agents')
      .upsert(updatePayload, { onConflict: 'name' });

    if (upsertErr) {
      console.error('ops_agents upsert error:', upsertErr);
    }

    // 2. Append to agent_activity log
    const { error: actErr } = await supabase
      .from('agent_activity')
      .insert({
        agent,
        event_type: 'heartbeat',
        status,
        task: body.current_task || null,
        detail: `Heartbeat — status: ${status}${body.current_task ? ` | task: ${body.current_task.slice(0, 80)}` : ''}`,
        metadata: body.metadata || {},
      });

    if (actErr) {
      console.error('agent_activity insert error:', actErr);
    }

    // 3. Write to ops_events for real-time feed
    await supabase.from('ops_events').insert({
      agent,
      event_type: 'heartbeat',
      title: `Heartbeat: ${status}${body.current_task ? ` — ${body.current_task.slice(0, 50)}` : ''}`,
    });

    return Response.json({ ok: true, agent, status, ts: now });
  } catch (err) {
    console.error('agent-heartbeat POST error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}


export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agentFilter = searchParams.get('agent');

  // Return activity log for one agent
  if (agentFilter) {
    const { data, error } = await supabase
      .from('agent_activity')
      .select('*')
      .eq('agent', agentFilter)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, agent: agentFilter, activity: data });
  }

  // Return all agents with staleness check
  const { data: agents, error } = await supabase
    .from('ops_agents')
    .select('*');

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const now = new Date();
  const enriched = (agents || []).map(a => {
    const lastHb = a.last_heartbeat_at ? new Date(a.last_heartbeat_at) : null;
    const minsAgo = lastHb ? (now - lastHb) / 60000 : Infinity;
    const isStale = minsAgo > STALE_THRESHOLD_MIN;
    return {
      ...a,
      heartbeat_age_min: lastHb ? Math.round(minsAgo) : null,
      is_stale: isStale,
    };
  });

  return Response.json({ ok: true, agents: enriched, count: enriched.length });
}
