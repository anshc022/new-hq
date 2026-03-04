import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://13.60.96.9:18789';
const HOOKS_TOKEN = process.env.OPENCLAW_HOOKS_TOKEN || 'hq-hooks-secret-2026';

// Guess priority from message text
function guessPriority(text) {
  const lower = text.toLowerCase();
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical') || lower.includes('immediately')) return 'high';
  if (lower.includes('when you can') || lower.includes('low priority') || lower.includes('no rush') || lower.includes('whenever')) return 'low';
  return 'medium';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, priority: userPriority } = body;

    if (!title || !title.trim()) {
      return Response.json({ ok: false, error: 'Title is required' }, { status: 400 });
    }

    const cleanTitle = title.trim();
    const priority = userPriority || guessPriority(cleanTitle);

    // 1. Insert todo into Supabase
    const { data: todo, error: insertErr } = await supabase.from('ops_todos').insert({
      title: cleanTitle,
      agent: 'echo',
      priority,
      source: 'dashboard',
      assigned_by: 'user',
      done: false,
    }).select('id').single();

    if (insertErr) {
      console.error('[TodoDispatch] Insert error:', insertErr.message);
      return Response.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    // 2. Dispatch to OpenClaw gateway — Echo (main) will handle and delegate
    let runId = null;
    let dispatchError = null;
    try {
      const hookPayload = {
        message: `HQ Todo #${todo.id} [${priority.toUpperCase()}]: ${cleanTitle}\n\nPlease complete this task. You may delegate to other agents as needed.`,
        agentId: 'main',
        wakeMode: 'now',
        sessionKey: `hook:hq-todo:${todo.id}`,
      };

      const res = await fetch(`${GATEWAY_URL}/hooks/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openclaw-token': HOOKS_TOKEN,
        },
        body: JSON.stringify(hookPayload),
      });

      if (res.ok) {
        const result = await res.json();
        runId = result.runId || null;

        // Save run_id for auto-done tracking
        if (runId) {
          await supabase.from('ops_todos').update({ run_id: runId }).eq('id', todo.id);
        }
      } else {
        const errText = await res.text().catch(() => '');
        dispatchError = `Gateway ${res.status}: ${errText.slice(0, 100)}`;
        console.error('[TodoDispatch] Gateway error:', dispatchError);
      }
    } catch (err) {
      dispatchError = err.message;
      console.error('[TodoDispatch] Dispatch error:', err.message);
    }

    // 3. Log event
    await supabase.from('ops_events').insert({
      agent: 'echo',
      event_type: 'task',
      title: `📋 Todo dispatched: ${cleanTitle.slice(0, 60)}`,
    });

    return Response.json({
      ok: true,
      todoId: todo.id,
      runId,
      dispatched: !dispatchError,
      dispatchError: dispatchError || undefined,
    });
  } catch (err) {
    console.error('[TodoDispatch] Error:', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
