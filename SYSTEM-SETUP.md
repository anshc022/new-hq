# OpenClaw Command Center — System Setup Guide

This covers the ACTUAL SYSTEM setup (not just the UI).
Follow these steps in order.

---

## Step 1: Run the Supabase Schema

1. Go to your Supabase dashboard → **SQL Editor**
2. Open `supabase/schema.sql` from this repo
3. Paste the entire contents and click **Run**

This creates:
- `ops_agents` — live agent state (one row per agent)
- `agent_activity` — append-only activity log (every heartbeat, task, event)
- `agent_relationships` — topology edges for the neural map
- `ops_events` — real-time event feed
- `ops_nodes` — connected execution nodes (EC2, Windows PC)
- `ops_todos`, `ops_goals`, `ops_blockers`, `ops_revenue`, `ops_pipeline`

---

## Step 2: Enable Realtime

In Supabase → **Database → Replication**, enable real-time for:
- `ops_agents`
- `agent_activity`
- `ops_events`

Or run in SQL editor:
```sql
alter publication supabase_realtime add table ops_agents;
alter publication supabase_realtime add table agent_activity;
alter publication supabase_realtime add table ops_events;
```

---

## Step 3: Deploy the Dashboard

```bash
# Local dev
npm run dev

# Deploy to Vercel
vercel --prod
# Set env vars in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GATEWAY_HTTP_URL
vercel env add GATEWAY_TOKEN
vercel env add HEARTBEAT_SECRET
```

The `vercel.json` already sets up a cron that hits `/api/stale-check` every 5 minutes.

---

## Step 4: Set Up Heartbeat Cron on EC2

SSH into your EC2 server (`13.60.96.9`):

```bash
ssh ubuntu@13.60.96.9
```

Copy the heartbeat script:
```bash
# From your local machine:
scp scripts/heartbeat-cron.sh ubuntu@13.60.96.9:~/heartbeat-cron.sh
ssh ubuntu@13.60.96.9 "chmod +x ~/heartbeat-cron.sh"
```

Set environment variables on EC2:
```bash
# Add to /etc/environment or ~/.bashrc
export DASHBOARD_URL="https://your-app.vercel.app"
export HEARTBEAT_SECRET="openclaw-heartbeat-2026"
export OPENCLAW_GATEWAY="http://localhost:18789"
export OPENCLAW_TOKEN="7dd2661047fa7bfe75d082c887b9691ac7d1f7911ee8aace"
```

Add to crontab:
```bash
crontab -e
```

Add these lines:
```cron
# Heartbeat every 15 minutes
*/15 * * * * DASHBOARD_URL=https://your-app.vercel.app HEARTBEAT_SECRET=openclaw-heartbeat-2026 OPENCLAW_GATEWAY=http://localhost:18789 OPENCLAW_TOKEN=7dd2661047fa7bfe75d082c887b9691ac7d1f7911ee8aace /home/ubuntu/heartbeat-cron.sh >> /home/ubuntu/heartbeat.log 2>&1

# Stale check every 5 minutes (also runs on Vercel cron)
*/5 * * * * curl -s -X POST https://your-app.vercel.app/api/stale-check >> /home/ubuntu/stale.log 2>&1
```

---

## Step 5: Add Heartbeat Duty to OpenClaw Agents

The `SOUL.md` file in the project root already contains heartbeat instructions.
Copy this file to your OpenClaw agents directory on EC2:

```bash
# Copy SOUL.md content to each agent's CLAUDE.md or system prompt file
# OpenClaw agents read system prompts from their agent directory

cp SOUL.md /home/ubuntu/.openclaw/agents/main/CLAUDE.md
cp SOUL.md /home/ubuntu/.openclaw/agents/flare/CLAUDE.md
cp SOUL.md /home/ubuntu/.openclaw/agents/bolt/CLAUDE.md
cp SOUL.md /home/ubuntu/.openclaw/agents/nexus/CLAUDE.md
cp SOUL.md /home/ubuntu/.openclaw/agents/vigil/CLAUDE.md
cp SOUL.md /home/ubuntu/.openclaw/agents/forge/CLAUDE.md
```

Now when agents work, they will POST to `/api/agent-heartbeat` themselves.

---

## Step 6: Test the System

```bash
# Test heartbeat manually:
curl -X POST https://your-app.vercel.app/api/agent-heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "echo",
    "status": "active",
    "current_task": "Testing command center",
    "secret": "openclaw-heartbeat-2026"
  }'

# Check agent status:
curl https://your-app.vercel.app/api/agent-heartbeat

# Check activity log:
curl "https://your-app.vercel.app/api/agent-activity?agent=echo&limit=10"

# Check relationships:
curl https://your-app.vercel.app/api/relationships

# Run stale check manually:
curl -X POST https://your-app.vercel.app/api/stale-check
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/agent-heartbeat` | POST | Agent sends its current status |
| `/api/agent-heartbeat` | GET | Get all agents with staleness info |
| `/api/agent-heartbeat?agent=echo` | GET | Get activity log for one agent |
| `/api/agent-activity` | GET/POST | Activity log (full timeline) |
| `/api/relationships` | GET/POST | Agent topology edges |
| `/api/stale-check` | GET/POST | Auto-mark stale agents degraded |
| `/api/gateway-bridge` | POST | Processes events from OpenClaw gateway |
| `/api/node-heartbeat` | GET/POST | Node registration and status |
| `/api/dispatch` | POST | Send a message to an agent |

---

## How Real-Time Data Flows

```
OpenClaw Agent (EC2)
    │
    ├─ Does a task
    ├─ POSTs to /api/agent-heartbeat  →  ops_agents upserted
    │                                    agent_activity inserted
    │                                    ops_events inserted
    │                                         │
    ├─ Uses a tool (spawn/exec/send)           │
    ├─ OpenClaw Gateway emits event            │
    └─ /api/gateway-bridge receives it →  ops_agents updated
                                          agent_activity logged
                                          agent_relationships updated
                                               │
                                               ▼
                               Supabase Realtime → Dashboard
                               (ops_agents subscription → AgentGrid/NodeGraph updates live)
```

---

## Staleness Logic

- Agent is **degraded** if `last_heartbeat_at` is older than `heartbeat_interval_min × 2.5`
- Default interval is 15 min → degraded threshold = 37.5 min
- Stale check runs every 5 min via Vercel cron + EC2 cron
- When degraded: `current_task` is set to "No heartbeat for X min"
- A `status_change` event is logged to `agent_activity`
