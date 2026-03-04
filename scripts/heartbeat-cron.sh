#!/bin/bash
# ============================================================
# OpenClaw Heartbeat Cron Script
# Runs on EC2 every 15 minutes via crontab.
# Reads openclaw.json for agent identity and sends to dashboard.
#
# When you change openclaw.json on EC2, the next heartbeat will
# automatically push the new identity (name, emoji, role, model)
# to the dashboard — no manual sync needed.
#
# SETUP:
#   1. Copy to EC2:
#      scp scripts/heartbeat-cron.sh ubuntu@13.60.96.9:~/heartbeat-cron.sh
#
#   2. Make executable:
#      chmod +x ~/heartbeat-cron.sh
#
#   3. Add to crontab:
#      crontab -e
#      */15 * * * * DASHBOARD_URL=http://localhost:3000 /home/ubuntu/heartbeat-cron.sh >> /home/ubuntu/heartbeat.log 2>&1
#      */5  * * * * curl -s -X POST http://localhost:3000/api/stale-check >> /home/ubuntu/stale-check.log 2>&1
# ============================================================

set -e

DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
HEARTBEAT_SECRET="${HEARTBEAT_SECRET:-openclaw-heartbeat-2026}"
OPENCLAW_GATEWAY="${OPENCLAW_GATEWAY:-http://localhost:18789}"
OPENCLAW_TOKEN="${OPENCLAW_TOKEN:-f4fa3205270651bb8c68e15614d26112d6e011563359eb0c}"
OPENCLAW_CONFIG="/home/ubuntu/.openclaw/openclaw.json"

echo "=== OpenClaw Heartbeat === $(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# ── Read agent list from openclaw.json ────────────────────────
if [ ! -f "$OPENCLAW_CONFIG" ]; then
  echo "ERROR: Config not found at $OPENCLAW_CONFIG"
  exit 1
fi

AGENT_COUNT=$(jq '.agents.list | length' "$OPENCLAW_CONFIG")
DEFAULT_MODEL=$(jq -r '.agents.defaults.model.primary // "unknown"' "$OPENCLAW_CONFIG" | sed 's|.*/||')

echo "Found $AGENT_COUNT agents, default model: $DEFAULT_MODEL"

# ── Helper: POST a heartbeat for one agent ───────────────────
send_heartbeat() {
  local payload="$1"
  local agent_name="$2"

  local resp
  resp=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-heartbeat-secret: $HEARTBEAT_SECRET" \
    -d "$payload" \
    "${DASHBOARD_URL}/api/agent-heartbeat" \
    --connect-timeout 10 \
    --max-time 15 2>/dev/null || echo "ERROR
000")

  local http_code
  http_code=$(echo "$resp" | tail -1)
  echo "  -> $agent_name: HTTP $http_code"
}

# ── Helper: Check agent status from OpenClaw gateway ─────────
get_agent_status_from_gateway() {
  local agent_id="$1"
  curl -s \
    -H "Authorization: Bearer $OPENCLAW_TOKEN" \
    "${OPENCLAW_GATEWAY}/api/agents/${agent_id}/status" \
    --connect-timeout 5 \
    --max-time 8 2>/dev/null || echo '{}'
}

# ── Helper: Ping node heartbeat ──────────────────────────────
ping_node_heartbeat() {
  local hostname
  hostname=$(hostname 2>/dev/null || echo "ec2-openclaw")
  local ip
  ip=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

  curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"ec2-openclaw\",\"hostname\":\"$hostname\",\"ip\":\"$ip\"}" \
    "${DASHBOARD_URL}/api/node-heartbeat" \
    --connect-timeout 5 \
    --max-time 8 > /dev/null 2>&1 || true
  echo "  -> node: pinged"
}

# ── Main: loop through agents from config ─────────────────────
echo "Checking $AGENT_COUNT agents..."

for i in $(seq 0 $((AGENT_COUNT - 1))); do
  # Read identity from openclaw.json
  agent_id=$(jq -r ".agents.list[$i].id" "$OPENCLAW_CONFIG")
  agent_name=$(jq -r ".agents.list[$i].name" "$OPENCLAW_CONFIG")
  display_name=$(jq -r ".agents.list[$i].identity.name // empty" "$OPENCLAW_CONFIG")
  emoji=$(jq -r ".agents.list[$i].identity.emoji // empty" "$OPENCLAW_CONFIG")
  theme=$(jq -r ".agents.list[$i].identity.theme // empty" "$OPENCLAW_CONFIG")

  # Use agent name for heartbeat (echo, flare, bolt, etc.)
  # If id is "main", heartbeat name is the display_name lowercase
  hb_name="$agent_name"
  if [ "$agent_id" = "main" ]; then
    hb_name=$(echo "$display_name" | tr '[:upper:]' '[:lower:]')
    [ -z "$hb_name" ] && hb_name="$agent_name"
  fi

  # Get live status from gateway
  status="idle"
  task=""
  gateway_resp=$(get_agent_status_from_gateway "$agent_id")

  if echo "$gateway_resp" | jq -e '.status' > /dev/null 2>&1; then
    gw_status=$(echo "$gateway_resp" | jq -r '.status // "idle"')
    gw_task=$(echo "$gateway_resp" | jq -r '.currentTask // empty')

    case "$gw_status" in
      running|thinking|active|working) status="active" ;;
      idle|waiting|ready)              status="idle" ;;
      error|failed)                    status="degraded" ;;
      *)                               status="idle" ;;
    esac

    [ -n "$gw_task" ] && task="$gw_task"
  fi

  # Build payload with identity from config
  payload=$(jq -n \
    --arg agent "$hb_name" \
    --arg status "$status" \
    --arg task "$task" \
    --arg model "$DEFAULT_MODEL" \
    --arg emoji "$emoji" \
    --arg role "$theme" \
    --arg display_name "$display_name" \
    --arg secret "$HEARTBEAT_SECRET" \
    '{
      agent: $agent,
      status: $status,
      current_task: (if $task == "" then null else $task end),
      model: $model,
      emoji: $emoji,
      role: $role,
      display_name: $display_name,
      secret: $secret
    }')

  send_heartbeat "$payload" "$hb_name"
  sleep 0.5
done

# ── Ping node heartbeat ───────────────────────────────────────
echo "Pinging node heartbeat..."
ping_node_heartbeat

# ── Trigger stale check ───────────────────────────────────────
echo "Running stale check..."
curl -s -X POST "${DASHBOARD_URL}/api/stale-check" \
  --connect-timeout 10 \
  --max-time 15 > /dev/null 2>&1 || true
echo "  -> stale check done"

echo "=== Done === $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo ""
