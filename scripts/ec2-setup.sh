#!/bin/bash
set -e

echo "=== OpenClaw EC2 Setup ==="

# 1. Copy SOUL.md to all agent CLAUDE.md files
AGENTS="main flare bolt nexus vigil forge"
for agent in $AGENTS; do
  mkdir -p /home/ubuntu/.openclaw/agents/$agent/agent
  cp /home/ubuntu/SOUL.md /home/ubuntu/.openclaw/agents/$agent/agent/CLAUDE.md
  echo "  CLAUDE.md -> $agent"
done

# 2. Verify
echo ""
echo "=== Verification ==="
for agent in $AGENTS; do
  if [ -f /home/ubuntu/.openclaw/agents/$agent/agent/CLAUDE.md ]; then
    SIZE=$(wc -c < /home/ubuntu/.openclaw/agents/$agent/agent/CLAUDE.md)
    echo "  $agent: CLAUDE.md OK ($SIZE bytes)"
  else
    echo "  $agent: MISSING!"
  fi
done

# 3. Set up crontab
echo ""
echo "=== Setting up crontab ==="

# Get current dashboard URL
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"

# Write crontab
(crontab -l 2>/dev/null | grep -v heartbeat-cron | grep -v stale-check || true; cat <<CRON
# OpenClaw Heartbeat — every 15 minutes
*/15 * * * * DASHBOARD_URL=$DASHBOARD_URL HEARTBEAT_SECRET=openclaw-heartbeat-2026 OPENCLAW_GATEWAY=http://localhost:18789 OPENCLAW_TOKEN=7dd2661047fa7bfe75d082c887b9691ac7d1f7911ee8aace /home/ubuntu/heartbeat-cron.sh >> /home/ubuntu/heartbeat.log 2>&1
# Stale check — every 5 minutes  
*/5 * * * * curl -s -X POST $DASHBOARD_URL/api/stale-check >> /home/ubuntu/stale-check.log 2>&1
CRON
) | crontab -

echo "  Crontab installed:"
crontab -l

# 4. Test heartbeat script (dry run)
echo ""
echo "=== Heartbeat script exists ==="
ls -la /home/ubuntu/heartbeat-cron.sh

echo ""
echo "=== Setup Complete ==="
echo "Run: ~/heartbeat-cron.sh  to test immediately"
