import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Activity log helper: writes to agent_activity table ─────
// Called whenever an agent changes status so the command center has a full timeline.
async function logActivity(agent, event_type, status, task, detail) {
  try {
    await supabase.from('agent_activity').insert({
      agent,
      event_type,
      status,
      task: task ? String(task).slice(0, 120) : null,
      detail: detail ? String(detail).slice(0, 255) : null,
    });
  } catch (_) { /* non-critical — do not break main flow */ }
}

// ─── Relationship tracker: increments edge weight ────────────
async function trackRelationship(source, target, relationship) {
  try {
    const { data: existing } = await supabase
      .from('agent_relationships')
      .select('id, interaction_count, weight')
      .eq('source_agent', source)
      .eq('target_agent', target)
      .eq('relationship', relationship)
      .single();

    if (existing) {
      await supabase.from('agent_relationships').update({
        interaction_count: (existing.interaction_count || 0) + 1,
        weight: Math.min(5.0, (existing.weight || 1.0) + 0.05),
        last_interaction_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('agent_relationships').insert({
        source_agent: source, target_agent: target, relationship,
        weight: 1.0, interaction_count: 1,
      });
    }
  } catch (_) { /* non-critical */ }
}

// ─── Agent ID mapping (gateway agentId → display name) ───
// V2: Names = IDs (except main → echo)
const AGENT_MAP = {
  main: 'echo', echo: 'echo',
  flare: 'flare', bolt: 'bolt',
  nexus: 'nexus', vigil: 'vigil',
  forge: 'forge',
};

// ─── Telegram → Todo sync ────────────────────────────────────
// Detects channel from sessionKey or payload metadata
function detectChannel(payload) {
  const sessionKey = payload?.sessionKey || '';
  if (sessionKey.includes('telegram')) return 'telegram';
  if (sessionKey.includes('discord')) return 'discord';
  if (sessionKey.includes('whatsapp')) return 'whatsapp';
  const channel = payload?.channel || payload?.data?.channel || '';
  if (channel) return channel.toLowerCase();
  const str = JSON.stringify(payload || {}).toLowerCase();
  if (str.includes('telegram')) return 'telegram';
  return null;
}

// Extract sender info from payload
function extractSender(payload) {
  const from = payload?.data?.from || payload?.from || payload?.sender || '';
  if (from) return String(from);
  const sessionKey = payload?.sessionKey || '';
  // sessionKey format: agent:main:telegram:dm:1710652280
  const parts = sessionKey.split(':');
  const tgIdx = parts.indexOf('telegram');
  if (tgIdx >= 0 && parts[tgIdx + 2]) return `tg:${parts[tgIdx + 2]}`;
  return null;
}

// Skip messages that are just greetings, commands, or too short to be tasks
const SKIP_PATTERNS = [
  /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|k|bye|gm|gn|good morning|good night)\s*[!.?]*$/i,
  /^\/(start|help|status|model|config|debug|restart|new|reset|todo|done|session)\b/i,
  /^[^a-zA-Z]*$/,  // no letter content
];

function isActionableMessage(text) {
  if (!text || text.trim().length < 8) return false;
  const trimmed = text.trim();
  for (const pat of SKIP_PATTERNS) {
    if (pat.test(trimmed)) return false;
  }
  return true;
}

// Guess priority from message text
function guessPriority(text) {
  const lower = text.toLowerCase();
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical') || lower.includes('immediately')) return 'high';
  if (lower.includes('when you can') || lower.includes('low priority') || lower.includes('no rush') || lower.includes('whenever')) return 'low';
  return 'medium';
}

// Create a todo from an incoming chat message
async function createTodoFromChat(agent, text, channel, sender, runId) {
  if (!isActionableMessage(text)) return null;

  const title = text.trim().length > 120 ? text.trim().slice(0, 117) + '...' : text.trim();
  const priority = guessPriority(text);
  const assignedBy = sender || (channel === 'telegram' ? '@anshc022' : 'user');

  try {
    const { data, error } = await supabase.from('ops_todos').insert({
      title,
      agent: agent || 'echo',
      priority,
      source: channel || 'chat',
      assigned_by: assignedBy,
      run_id: runId || null,
      done: false,
    }).select('id').single();

    if (error) {
      console.error('[TodoSync] Insert error:', error.message);
      return null;
    }

    console.log(`[TodoSync] Created todo #${data.id} for ${agent} from ${channel}: ${title.slice(0, 50)}`);

    // Log event
    await supabase.from('ops_events').insert({
      agent: agent || 'echo',
      event_type: 'task',
      title: `📋 New todo from ${channel}: ${title.slice(0, 60)}`,
    });

    return data.id;
  } catch (err) {
    console.error('[TodoSync] Error:', err.message);
    return null;
  }
}

// Mark the most recent pending todo for an agent as done
async function markAgentTodoDone(agent, runId) {
  try {
    // First try to match by run_id for exact match
    if (runId) {
      const { data: byRun } = await supabase.from('ops_todos')
        .select('id, title')
        .eq('run_id', runId)
        .eq('done', false)
        .limit(1);

      if (byRun && byRun.length > 0) {
        await supabase.from('ops_todos').update({
          done: true,
          updated_at: new Date().toISOString(),
        }).eq('id', byRun[0].id);

        console.log(`[TodoSync] ✅ Marked todo #${byRun[0].id} done (run_id match): ${byRun[0].title.slice(0, 50)}`);

        await supabase.from('ops_events').insert({
          agent,
          event_type: 'complete',
          title: `✅ Todo done: ${byRun[0].title.slice(0, 60)}`,
        });
        return byRun[0].id;
      }
    }

    // Fallback: mark the oldest pending todo for this agent from telegram/chat
    const { data: pending } = await supabase.from('ops_todos')
      .select('id, title')
      .eq('agent', agent)
      .eq('done', false)
      .in('source', ['telegram', 'chat', 'discord', 'whatsapp'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (pending && pending.length > 0) {
      await supabase.from('ops_todos').update({
        done: true,
        updated_at: new Date().toISOString(),
      }).eq('id', pending[0].id);

      console.log(`[TodoSync] ✅ Marked todo #${pending[0].id} done (oldest pending): ${pending[0].title.slice(0, 50)}`);

      await supabase.from('ops_events').insert({
        agent,
        event_type: 'complete',
        title: `✅ Todo done: ${pending[0].title.slice(0, 60)}`,
      });
      return pending[0].id;
    }

    return null;
  } catch (err) {
    console.error('[TodoSync] markDone error:', err.message);
    return null;
  }
}
// ─── End Telegram → Todo sync ────────────────────────────────

// Reverse map: display name → gateway agentId
const DISPLAY_TO_GW = {
  echo: 'main', flare: 'flare', bolt: 'bolt',
  nexus: 'nexus', vigil: 'vigil', forge: 'forge',
};

// Each agent has their own work room
const AGENT_WORK_ROOM = {
  echo:  'warroom',
  flare: 'workspace',
  bolt:  'workspace',
  nexus: 'lab',
  vigil: 'lab',
  forge: 'forge',
};

const AGENT_TALK_ROOM = {
  echo:  'warroom',
  flare: 'warroom',
  bolt:  'warroom',
  nexus: 'warroom',
  vigil: 'warroom',
  forge: 'warroom',
};

function getWorkRoom(agent) { return AGENT_WORK_ROOM[agent] || 'workspace'; }
function getTalkRoom(agent) { return AGENT_TALK_ROOM[agent] || 'warroom'; }

// Extract agent display name from gateway event payload
function extractAgent(payload) {
  if (payload?.agentId && AGENT_MAP[payload.agentId]) return AGENT_MAP[payload.agentId];
  if (payload?.sessionKey) {
    const parts = payload.sessionKey.split(':');
    if (parts[0] === 'agent' && AGENT_MAP[parts[1]]) return AGENT_MAP[parts[1]];
  }
  if (payload?.data?.agentId && AGENT_MAP[payload.data.agentId]) return AGENT_MAP[payload.data.agentId];
  return null;
}

// ─── Native spawn detection ───
async function detectNativeSpawn(sourceAgent, toolName, toolData) {
  if (!toolName) return;
  const name = toolName.toLowerCase();

  if (name === 'sessions_spawn') {
    const targetAgentId = toolData?.agentId || toolData?.agent_id;
    const task = toolData?.task || toolData?.label || 'Sub-agent task';
    if (targetAgentId && AGENT_MAP[targetAgentId]) {
      const displayName = AGENT_MAP[targetAgentId];

      // Track this spawn so Echo stays working until all subs finish
      if (sourceAgent === 'echo') {
        echoSpawnTracker.spawn(displayName, task.slice(0, 70));
        // Update Echo to show coordination status
        await supabase.from('ops_agents').update({
          status: 'researching',
          current_task: echoSpawnTracker.progressText(),
          current_room: 'warroom',
          last_active_at: new Date().toISOString(),
        }).eq('name', 'echo');
      }

      await supabase.from('ops_agents').update({
        status: 'thinking',
        current_task: `${sourceAgent} → ${displayName}: ${task.slice(0, 55)}`,
        current_room: getWorkRoom(displayName),
        last_active_at: new Date().toISOString(),
      }).eq('name', displayName);

      await supabase.from('ops_events').insert({
        agent: displayName,
        event_type: 'task',
        title: `${sourceAgent} spawned: ${task.slice(0, 50)}`,
      });

      // Activity log + relationship tracking
      await logActivity(displayName, 'task_start', 'thinking',
        `${sourceAgent} → ${displayName}: ${task.slice(0, 55)}`,
        `Spawned by ${sourceAgent}`);
      await trackRelationship(sourceAgent, displayName, 'spawns');
    }
    return;
  }

  if (name === 'sessions_send') {
    const sessionKey = toolData?.sessionKey || toolData?.session_key || '';
    const msg = toolData?.message || '';
    const m = sessionKey.match(/^agent:([^:]+)/);
    if (m && AGENT_MAP[m[1]]) {
      const displayName = AGENT_MAP[m[1]];
      if (displayName !== sourceAgent) {
        await supabase.from('ops_agents').update({
          status: 'thinking',
          current_task: `Message from ${sourceAgent}: ${msg.slice(0, 45)}`,
          current_room: getWorkRoom(displayName),
          last_active_at: new Date().toISOString(),
        }).eq('name', displayName);
        await logActivity(displayName, 'message', 'thinking',
          `Message from ${sourceAgent}: ${msg.slice(0, 45)}`, null);
        await trackRelationship(sourceAgent, displayName, 'messages');
      }
    }
    return;
  }

  if (name === 'agents_list') {
    await supabase.from('ops_events').insert({
      agent: sourceAgent,
      event_type: 'system',
      title: 'Checking available agents',
    });
    return;
  }

  // Exec/Node tools — show Forge as working (infra domain)
  const EXEC_TOOLS = [
    'exec_run', 'exec', 'shell', 'terminal',
    'fs_read', 'fs_write', 'fs_delete', 'fs_list', 'fs_mkdir',
    'file_read', 'file_write', 'file_delete', 'file_list',
    'read_file', 'write_file', 'list_directory',
    'run_command', 'execute', 'powershell',
  ];
  if (EXEC_TOOLS.some(t => name.includes(t))) {
    const cmd = toolData?.command || toolData?.path || toolData?.cmd || name;
    const preview = typeof cmd === 'string' ? cmd.slice(0, 60) : name;
    await supabase.from('ops_agents').update({
      status: 'working',
      current_task: `Node exec: ${preview}`,
      current_room: 'forge',
      last_active_at: new Date().toISOString(),
    }).eq('name', 'forge');

    await supabase.from('ops_events').insert({
      agent: 'forge',
      event_type: 'task',
      title: `${sourceAgent} → Node: ${preview}`,
    });
    await logActivity('forge', 'task_start', 'working', `Node exec: ${preview}`, `Triggered by ${sourceAgent}`);
    if (sourceAgent !== 'forge') await trackRelationship(sourceAgent, 'forge', 'depends_on');
  }
}

// ─── Delegation detection from Echo's text ───
const delegatedAgents = new Set();
const delegationTracker = new Map();
const MIN_DELEGATION_DURATION = 60_000;

async function detectDelegationFromText(text) {
  if (!text) return;
  const lower = text.toLowerCase();

  const AGENT_KEYWORDS = {
    flare: 'flare', bolt: 'bolt',
    nexus: 'nexus', vigil: 'vigil',
    forge: 'forge',
  };

  const isCompletion = lower.includes('has completed') || lower.includes('finished') ||
    lower.includes('completed the') || lower.includes('done with') ||
    lower.includes('has delivered') || lower.includes('is done') ||
    lower.includes('result:') || lower.includes('report:');

  const isDelegation = lower.includes('delegat') || lower.includes('team mobilized') ||
    lower.includes('assigning') || lower.includes('task') ||
    lower.includes('spawning') || lower.includes('is working') ||
    lower.includes('will handle') || lower.includes('dispatching') ||
    lower.includes('is going') || lower.includes('in progress') ||
    lower.includes('is updating') || lower.includes('is checking') ||
    lower.includes('is creating') || lower.includes('is building') ||
    lower.includes('is redesign') || lower.includes('is writing') ||
    lower.includes('is fixing') || lower.includes('is running') ||
    lower.includes('is generating') || lower.includes('is analyzing') ||
    lower.includes('is testing') || lower.includes('is deploying') ||
    lower.includes('is designing') || lower.includes('is reviewing') ||
    lower.includes('relaunched') || lower.includes('re-launched') ||
    lower.includes('asked') || lower.includes('told') ||
    lower.includes('overhaul') || lower.includes('upgrade');

  const AGENT_NAMES_IN_TEXT = ['flare', 'bolt', 'nexus', 'vigil', 'forge'];
  const mentionsAgent = AGENT_NAMES_IN_TEXT.some(n => lower.includes(n));
  const hasActionContext = lower.includes(' is ') || lower.includes(' will ') ||
    lower.includes(' has ') || lower.includes('going') || lower.includes('working') ||
    lower.includes('updat') || lower.includes('creat') || lower.includes('build') ||
    lower.includes('fix') || lower.includes('check') || lower.includes('design') ||
    lower.includes('writ') || lower.includes('generat') || lower.includes('deploy') ||
    lower.includes('test') || lower.includes('review');

  if (!isDelegation && !isCompletion && !(mentionsAgent && hasActionContext)) return;

  const now = new Date().toISOString();
  const foundAgents = new Set();

  for (const [keyword, displayName] of Object.entries(AGENT_KEYWORDS)) {
    if (lower.includes(keyword) && !foundAgents.has(displayName)) {
      foundAgents.add(displayName);

      const taskPatterns = [
        new RegExp('\\*\\*' + keyword + '\\*\\*\\s*(?:\\([^)]*\\))?\\s*(?:is|will|has been|was)\\s+(.{5,100})', 'i'),
        new RegExp(keyword + '\\s*[:\\→—]+\\s*(.{5,100})', 'i'),
        new RegExp(keyword + '\\s+(?:is|will)\\s+(.{5,100})', 'i'),
      ];
      let task = null;
      for (const pat of taskPatterns) {
        const m = text.match(pat);
        if (m) {
          task = m[1].replace(/\*\*/g, '').replace(/[#`\n]/g, ' ').replace(/\s+/g, ' ').trim();
          const sentEnd = task.match(/^(.{10,70}?)[.!\n]/);
          if (sentEnd) task = sentEnd[1];
          break;
        }
      }

      if (isCompletion) {
        const completionMsg = task || 'Task completed';
        const cleanMsg = completionMsg.length > 70 ? completionMsg.slice(0, 70) + '...' : completionMsg;

        await supabase.from('ops_agents').update({
          status: 'talking',
          current_task: `Done: ${cleanMsg}`,
          current_room: getTalkRoom(displayName),
          last_active_at: now,
        }).eq('name', displayName);

        await supabase.from('ops_events').insert({
          agent: displayName,
          event_type: 'system',
          title: `Completed: ${cleanMsg.slice(0, 60)}`,
        });
        await logActivity(displayName, 'task_end', 'talking', `Done: ${cleanMsg}`, 'Task completed');

        activeAgents.set(displayName, { startedAt: Date.now(), runId: null });
        delegatedAgents.delete(displayName);
        delegationTracker.delete(displayName);
      } else if (!delegatedAgents.has(displayName)) {
        delegatedAgents.add(displayName);
        const cleanTask = (task || 'Working on delegated task...').slice(0, 70);

        await supabase.from('ops_agents').update({
          status: 'working',
          current_task: cleanTask,
          current_room: getWorkRoom(displayName),
          last_active_at: now,
        }).eq('name', displayName);

        await supabase.from('ops_events').insert({
          agent: displayName,
          event_type: 'task',
          title: `Echo delegated: ${cleanTask.slice(0, 60)}`,
        });
        await logActivity(displayName, 'task_start', 'working', cleanTask, 'Delegated by Echo');
        await trackRelationship('echo', displayName, 'spawns');

        activeAgents.set(displayName, { startedAt: Date.now(), runId: null });
        delegationTracker.set(displayName, { delegatedAt: Date.now(), task: cleanTask });
      }
    }
  }

  if (foundAgents.size > 0 && !isCompletion) {
    const workingNames = [...foundAgents].join(', ');
    await supabase.from('ops_agents').update({
      status: 'researching',
      current_task: `Coordinating: ${workingNames}`,
      current_room: 'warroom',
      last_active_at: now,
    }).eq('name', 'echo');
    activeAgents.set('echo', { startedAt: Date.now(), runId: null });
  }
}

// ─── Track active runs ───
const activeRuns = new Map();
const activeAgents = new Map();
const cooldownTimers = new Map();
let lastPulseAlertAt = 0;
let pulseAlertCount = 0;

// ─── Spawn tracker: keeps Echo working while sub-agents run ───
const echoSpawnTracker = {
  activeSpawns: new Map(),   // agentName → { task, spawnedAt }
  echoRunId: null,
  clear() { this.activeSpawns.clear(); this.echoRunId = null; },
  spawn(agent, task) { this.activeSpawns.set(agent, { task, spawnedAt: Date.now() }); },
  complete(agent) { this.activeSpawns.delete(agent); },
  hasActive() { return this.activeSpawns.size > 0; },
  activeNames() { return [...this.activeSpawns.keys()]; },
  progressText() {
    const names = this.activeNames();
    if (names.length === 0) return null;
    return `Coordinating: ${names.join(', ')} working...`;
  },
};

// ─── Stuck run watchdog ───
const STUCK_TIMEOUT_MS = 120_000;
let watchdogInterval = null;

function startWatchdog() {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(async () => {
    const now = Date.now();
    for (const [runId, run] of activeRuns.entries()) {
      if (run.recovered) continue;
      const age = now - run.startedAt;
      if (age > STUCK_TIMEOUT_MS) {
        run.recovered = true;
        await supabase.from('ops_agents').update({
          status: 'idle',
          current_task: null,
          current_room: 'desk',
          last_active_at: new Date().toISOString(),
        }).eq('name', run.agent);

        await supabase.from('ops_events').insert({
          agent: run.agent,
          event_type: 'alert',
          title: `Run timed out after ${Math.round(age / 1000)}s`,
        });

        setTimeout(() => activeRuns.delete(runId), 5000);
      }
    }
  }, 15_000);
}
startWatchdog();

// ─── Stale agent cleanup ───
const COOLDOWN_MS = 45_000;
const ACTIVE_TIMEOUT_MS = 300_000;
let lastCleanupAt = 0;
let lastDelegationClearAt = 0;

async function cleanupStaleAgents() {
  if (Date.now() - lastCleanupAt < 8_000) return;
  lastCleanupAt = Date.now();

  if (Date.now() - lastDelegationClearAt > 120_000) {
    lastDelegationClearAt = Date.now();
    delegatedAgents.clear();
    for (const [name, info] of delegationTracker) {
      if (Date.now() - info.delegatedAt > MIN_DELEGATION_DURATION) {
        delegationTracker.delete(name);
      }
    }
  }

  const cooldownCutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: staleResearching } = await supabase
    .from('ops_agents')
    .select('name, status, last_active_at')
    .eq('status', 'researching')
    .lt('last_active_at', cooldownCutoff)
    .neq('name', 'echo');

  const activeCutoff = new Date(Date.now() - ACTIVE_TIMEOUT_MS).toISOString();
  const { data: staleActive } = await supabase
    .from('ops_agents')
    .select('name, status, last_active_at')
    .in('status', ['working', 'talking', 'thinking'])
    .lt('last_active_at', activeCutoff)
    .neq('name', 'echo');

  const allStale = [...(staleResearching || []), ...(staleActive || [])];
  if (allStale.length > 0) {
    for (const agent of allStale) {
      const delegation = delegationTracker.get(agent.name);
      if (delegation && Date.now() - delegation.delegatedAt < MIN_DELEGATION_DURATION) {
        await supabase.from('ops_agents').update({
          last_active_at: new Date().toISOString(),
        }).eq('name', agent.name);
        continue;
      }
      delegationTracker.delete(agent.name);
      activeAgents.delete(agent.name);
      cooldownTimers.delete(agent.name);
      await supabase.from('ops_agents').update({
        status: 'idle',
        current_task: null,
        current_room: 'desk',
        last_active_at: new Date().toISOString(),
      }).eq('name', agent.name);
    }

    const { data: echoData } = await supabase.from('ops_agents')
      .select('status, current_task').eq('name', 'echo').single();
    if (echoData?.status === 'researching' && (echoData?.current_task?.startsWith('Monitoring:') || echoData?.current_task?.startsWith('Coordinating:'))) {
      // Don't idle Echo if spawn tracker still has active sub-agents
      if (echoSpawnTracker.hasActive()) return;
      const { data: anyActive } = await supabase.from('ops_agents')
        .select('name').neq('name', 'echo')
        .in('status', ['working', 'thinking', 'talking', 'researching']);
      if (!anyActive || anyActive.length === 0) {
        activeAgents.delete('echo');
        echoSpawnTracker.clear();
        await supabase.from('ops_agents').update({
          status: 'idle', current_task: null, current_room: 'desk',
          last_active_at: new Date().toISOString(),
        }).eq('name', 'echo');
      }
    }
  }
}

// ─── Process gateway events ───
async function processGatewayMessage(msg) {
  try {
    if (msg.type === 'node:connected' || msg.type === 'node:disconnected') {
      const isConnected = msg.type === 'node:connected';
      await supabase.from('ops_events').insert({
        agent: 'forge',
        event_type: isConnected ? 'system' : 'alert',
        title: isConnected ? 'Node connected — monitoring active' : `Node disconnected! (${msg.message || 'unknown'})`,
      });

      if (isConnected) {
        // Forge stays idle at desk — silent monitoring, only activates when needed
        await supabase.from('ops_agents').update({
          status: 'idle',
          current_task: null,
          current_room: 'desk',
          last_active_at: new Date().toISOString(),
        }).eq('name', 'forge');
      } else {
        await supabase.from('ops_agents').update({
          status: 'working',
          current_task: 'Node offline — investigating...',
          current_room: 'forge',
          last_active_at: new Date().toISOString(),
        }).eq('name', 'forge');
        activeAgents.set('forge', { startedAt: Date.now(), runId: null });
      }
      return { type: msg.type };
    }

    if (msg.type === 'event' && msg.event === 'heartbeat') {
      const hb = msg.payload || {};
      const status = hb.status || hb.data?.status;
      const reason = hb.reason || hb.data?.reason || '';

      if (status === 'error' || status === 'failed' || reason.includes('error')) {
        await supabase.from('ops_agents').update({
          status: 'working',
          current_task: `Fixing: ${reason.slice(0, 50)}`,
          current_room: 'forge',
          last_active_at: new Date().toISOString(),
        }).eq('name', 'forge');

        await supabase.from('ops_events').insert({
          agent: 'forge',
          event_type: 'alert',
          title: `Heartbeat error: ${reason.slice(0, 60)}`,
        });
        activeAgents.set('forge', { startedAt: Date.now(), runId: null });
      } else {
        // Normal heartbeat — don't touch Forge status, just update timestamp silently
        // Only update last_active_at if Forge is currently idle (don't interrupt active work)
        await supabase.from('ops_agents').update({
          last_active_at: new Date().toISOString(),
        }).eq('name', 'forge').eq('status', 'idle');
      }
      return { type: 'heartbeat', status };
    }

    if (msg.type !== 'event') return null;

    const eventName = msg.event;
    const payload = msg.payload || {};
    const agent = extractAgent(payload) || 'echo';
    const runId = payload.runId;

    // lifecycle:start
    if (eventName === 'agent' && payload.stream === 'lifecycle' && payload.data?.phase === 'start') {
      const isSubagent = agent !== 'echo';

      if (runId) {
        activeRuns.set(runId, {
          agent, text: '', startedAt: Date.now(),
          toolCalls: [], chatLogged: false, recovered: false,
          isSubagent,
        });
      }

      activeAgents.set(agent, { startedAt: Date.now(), runId });

      if (!isSubagent) {
        delegationTracker.clear();
        delegatedAgents.clear();
        // New Echo run starting — clear spawn tracker from previous run
        echoSpawnTracker.clear();
        echoSpawnTracker.echoRunId = runId;
      }

      let spawner = null;
      if (isSubagent) {
        for (const [otherAgent, info] of activeAgents.entries()) {
          if (otherAgent !== agent && (Date.now() - info.startedAt) < 120_000) {
            spawner = otherAgent;
            break;
          }
        }

        for (const [cooldownAgent] of cooldownTimers.entries()) {
          if (cooldownAgent !== agent) {
            await supabase.from('ops_agents').update({
              status: 'researching',
              current_task: `Syncing with ${agent}...`,
              last_active_at: new Date().toISOString(),
            }).eq('name', cooldownAgent);
          }
        }

        if (spawner) {
          await supabase.from('ops_agents').update({
            status: 'working',
            last_active_at: new Date().toISOString(),
          }).eq('name', spawner).in('status', ['working', 'talking', 'thinking']);

          await supabase.from('ops_events').insert({
            agent,
            event_type: 'collab',
            title: `${spawner} → ${agent}: collaboration started`,
          });
        }
      }

      await supabase.from('ops_agents').update({
        status: 'working',
        current_task: spawner
          ? `Task from ${spawner}...`
          : (isSubagent ? 'Working on delegated sub-task...' : 'Processing request...'),
        current_room: getWorkRoom(agent),
        last_active_at: new Date().toISOString(),
      }).eq('name', agent);

      await supabase.from('ops_events').insert({
        agent,
        event_type: 'task',
        title: spawner
          ? `Spawned by ${spawner}`
          : (isSubagent ? 'Sub-agent started working' : 'Started processing request'),
      });

      return { type: 'lifecycle_start', agent, isSubagent, spawner };
    }

    // lifecycle:end
    if (eventName === 'agent' && payload.stream === 'lifecycle' && payload.data?.phase === 'end') {
      const run = runId ? activeRuns.get(runId) : null;
      const isSubagent = agent !== 'echo';

      if (run?.text) {
        await supabase.from('ops_messages').insert({
          from_agent: agent,
          to_agent: 'user',
          message: run.text.slice(0, 1500),
        });
      }

      const runDuration = run ? (Date.now() - run.startedAt) : 0;
      const responseText = run?.text || '';
      const isErrorResponse = responseText === 'NO...' || responseText === 'NO' || (responseText.length < 5 && responseText.length > 0);

      if (agent === 'echo' && !isErrorResponse && responseText.length >= 10) {
        pulseAlertCount = 0;
      }

      const now5 = Date.now();
      if (agent === 'echo' && isErrorResponse && (now5 - lastPulseAlertAt > 300_000)) {
        lastPulseAlertAt = now5;
        pulseAlertCount++;
        await supabase.from('ops_events').insert({
          agent: 'vigil',
          event_type: 'alert',
          title: `Echo error response (${pulseAlertCount}x): "${responseText.slice(0, 20)}"`,
        });
        // Vigil logs alert but stays idle — no status change
      }

      if (isSubagent) {
        // Sub-agent finished — go idle immediately
        delegationTracker.delete(agent);
        delegatedAgents.delete(agent);
        activeAgents.delete(agent);
        await supabase.from('ops_agents').update({
          status: 'idle',
          current_task: null,
          current_room: 'desk',
          last_active_at: new Date().toISOString(),
        }).eq('name', agent);

        // Update Echo's spawn tracker — sub-agent completed
        if (echoSpawnTracker.activeSpawns.has(agent)) {
          echoSpawnTracker.complete(agent);
          await supabase.from('ops_events').insert({
            agent: 'echo',
            event_type: 'system',
            title: `${agent} completed task`,
          });

          if (echoSpawnTracker.hasActive()) {
            // Still waiting on other sub-agents — update Echo's progress
            await supabase.from('ops_agents').update({
              current_task: echoSpawnTracker.progressText(),
              last_active_at: new Date().toISOString(),
            }).eq('name', 'echo').in('status', ['researching', 'working']);
          } else {
            // All sub-agents done — Echo goes idle
            activeAgents.delete('echo');
            await supabase.from('ops_agents').update({
              status: 'idle',
              current_task: 'All delegated tasks completed',
              current_room: 'warroom',
              last_active_at: new Date().toISOString(),
            }).eq('name', 'echo');

            await supabase.from('ops_events').insert({
              agent: 'echo',
              event_type: 'complete',
              title: 'All sub-agent tasks completed',
            });

            // Clear task text after a short delay
            setTimeout(async () => {
              await supabase.from('ops_agents').update({
                current_task: null,
                current_room: 'desk',
              }).eq('name', 'echo').eq('status', 'idle');
            }, 10_000);
          }
        }
      } else {
        // Echo finished its own run
        activeAgents.delete(agent);
        if (agent === 'echo' && echoSpawnTracker.hasActive()) {
          // Echo has active sub-agents — stay in researching/coordinating mode
          await supabase.from('ops_agents').update({
            status: 'researching',
            current_task: echoSpawnTracker.progressText(),
            current_room: 'warroom',
            last_active_at: new Date().toISOString(),
          }).eq('name', 'echo');
        } else {
          // No active sub-agents — go idle
          await supabase.from('ops_agents').update({
            status: 'idle', current_task: null, current_room: 'desk',
            last_active_at: new Date().toISOString(),
          }).eq('name', agent);
        }
      }

      if (agent === 'echo') {
        const { data: forgeData } = await supabase.from('ops_agents')
          .select('status, current_task').eq('name', 'forge').single();
        if (forgeData?.current_task?.startsWith('Node exec:')) {
          await supabase.from('ops_agents').update({
            status: 'idle', current_task: null, current_room: 'desk',
            last_active_at: new Date().toISOString(),
          }).eq('name', 'forge');
        }
      }

      await supabase.from('ops_events').insert({
        agent,
        event_type: 'complete',
        title: `Completed${run?.toolCalls.length ? ` (${run.toolCalls.length} tools used)` : ''}`,
      });

      // ─── Auto-mark todo done when agent finishes ───
      await markAgentTodoDone(agent, runId);

      if (runId) setTimeout(() => activeRuns.delete(runId), 5000);
      return { type: 'lifecycle_end', agent, isSubagent };
    }

    // assistant — streaming response
    if (eventName === 'agent' && payload.stream === 'assistant') {
      const text = payload.data?.text || '';
      if (!text) return null;

      if (runId) {
        const run = activeRuns.get(runId);
        if (run) run.text = text;
      }

      const clean = text.replace(/\*\*/g, '').replace(/[#`]/g, '').replace(/\n+/g, ' ').trim();
      const preview = clean.length > 120 ? clean.slice(0, 120) + '...' : clean;

      // Update task preview only — don't change status (avoids race with lifecycle.end)
      await supabase.from('ops_agents').update({
        current_task: preview,
        last_active_at: new Date().toISOString(),
      }).eq('name', agent).in('status', ['working', 'thinking', 'talking']);

      return { type: 'assistant_stream', agent };
    }

    // tool-call
    if (eventName === 'agent' && payload.stream === 'tool-call') {
      const toolName = payload.data?.name || payload.data?.tool || 'unknown';

      if (runId) {
        const run = activeRuns.get(runId);
        if (run) run.toolCalls.push(toolName);
      }

      await supabase.from('ops_agents').update({
        status: 'working',
        current_task: `Using: ${toolName}`,
        current_room: getWorkRoom(agent),
        last_active_at: new Date().toISOString(),
      }).eq('name', agent);

      await supabase.from('ops_events').insert({
        agent,
        event_type: 'task',
        title: `Tool: ${toolName}`,
      });

      await detectNativeSpawn(agent, toolName, payload.data?.arguments || payload.data?.input || payload.data);
      return { type: 'tool_call', agent, tool: toolName };
    }

    // tool-result
    if (eventName === 'agent' && payload.stream === 'tool-result') {
      await supabase.from('ops_events').insert({
        agent,
        event_type: 'complete',
        title: 'Tool result received',
      });
      return { type: 'tool_result', agent };
    }

    // chat — user message or chat final/delta
    if (eventName === 'chat') {
      const run = runId ? activeRuns.get(runId) : null;
      if (run?.chatLogged) return null;
      if (run) run.chatLogged = true;

      // Extract text from various chat event formats
      let text = payload.data?.text || payload.text || '';
      if (!text && payload.message?.content) {
        const content = payload.message.content;
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) {
          text = content.filter(c => c.type === 'text').map(c => c.text).join('');
        }
      }
      if (!text && typeof payload.content === 'string') text = payload.content;

      if (text) {
        await supabase.from('ops_messages').insert({
          from_agent: 'user',
          to_agent: agent,
          message: text.slice(0, 1500),
        });

        // ─── Auto-create todo from incoming chat messages ───
        const channel = detectChannel(payload);
        const sender = extractSender(payload);
        const todoId = await createTodoFromChat(agent, text, channel, sender, runId);
        if (todoId && run) run.todoId = todoId;
      }

      await supabase.from('ops_events').insert({
        agent,
        event_type: 'chat',
        title: `Message: ${(text || '...').slice(0, 80)}`,
      });

      return { type: 'chat', agent };
    }

    return null;
  } catch (err) {
    console.error('[Bridge] Error:', err.message);
    return null;
  }
}

// GET — Bridge status
export async function GET() {
  return Response.json({
    status: 'ready',
    gateway: process.env.GATEWAY_URL || '',
    agents: [...new Set(Object.values(AGENT_MAP))],
    activeRuns: activeRuns.size,
    timestamp: new Date().toISOString(),
  });
}

// POST — Receive gateway events
export async function POST(request) {
  try {
    const body = await request.json();

    if (body.type && !body.events) {
      const result = await processGatewayMessage(body);
      return Response.json({ ok: true, processed: result ? 1 : 0, result });
    }

    if (Array.isArray(body.events)) {
      await cleanupStaleAgents();
      const results = [];
      for (const evt of body.events) {
        const r = await processGatewayMessage(evt);
        if (r) results.push(r);
      }
      return Response.json({ ok: true, processed: results.length, results });
    }

    return Response.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  } catch (err) {
    console.error('[Bridge API] Error:', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
