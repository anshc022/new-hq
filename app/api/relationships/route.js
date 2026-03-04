/**
 * /api/relationships
 *
 * GET  → returns all agent_relationships (edges for neural map)
 * POST → upsert or increment an interaction edge
 * {
 *   source_agent: "echo",
 *   target_agent: "bolt",
 *   relationship: "spawns",    // spawns | reviews | messages | depends_on | monitors
 *   weight:       1.0          // optional, default 1
 * }
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const { data, error } = await supabase
    .from('agent_relationships')
    .select('*')
    .order('weight', { ascending: false });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, relationships: data, count: data.length });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { source_agent, target_agent, relationship, weight } = body;

    if (!source_agent || !target_agent || !relationship) {
      return Response.json({ ok: false, error: 'source_agent, target_agent, relationship required' }, { status: 400 });
    }

    // Upsert — if exists increment interaction_count and update last_interaction_at
    const { data: existing } = await supabase
      .from('agent_relationships')
      .select('id, interaction_count, weight')
      .eq('source_agent', source_agent)
      .eq('target_agent', target_agent)
      .eq('relationship', relationship)
      .single();

    if (existing) {
      const newCount = (existing.interaction_count || 0) + 1;
      // Weight grows slowly with interaction frequency, max 5.0
      const newWeight = Math.min(5.0, (existing.weight || 1.0) + 0.05);
      await supabase
        .from('agent_relationships')
        .update({
          interaction_count: newCount,
          weight: newWeight,
          last_interaction_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return Response.json({ ok: true, action: 'incremented', interaction_count: newCount });
    }

    const { data, error } = await supabase
      .from('agent_relationships')
      .insert({ source_agent, target_agent, relationship, weight: weight || 1.0 })
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, action: 'created', edge: data });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
