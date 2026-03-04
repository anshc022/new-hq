/**
 * /api/agent-activity
 *
 * GET ?agent=echo&limit=100       → activity log for one agent
 * GET ?limit=200                  → all activity, newest first
 * GET ?event_type=heartbeat       → filter by type
 *
 * POST — insert a custom activity event (used by gateway-bridge)
 * {
 *   agent:      "echo",
 *   event_type: "task_start",
 *   status:     "working",
 *   task:       "Building auth system",
 *   detail:     "...",
 *   metadata:   {}
 * }
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agent      = searchParams.get('agent');
  const eventType  = searchParams.get('event_type');
  const limit      = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

  let q = supabase
    .from('agent_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agent)     q = q.eq('agent', agent);
  if (eventType) q = q.eq('event_type', eventType);

  const { data, error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, activity: data, count: data.length });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { agent, event_type, status, task, detail, metadata } = body;

    if (!agent || !event_type) {
      return Response.json({ ok: false, error: 'agent and event_type required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('agent_activity')
      .insert({ agent, event_type, status, task, detail, metadata: metadata || {} })
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, entry: data });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
