#!/bin/bash
cat > /tmp/hooks-test.json << 'EOF'
{"message":"ping test from HQ dashboard","agentId":"main","wakeMode":"now"}
EOF
echo "JSON payload:"
cat /tmp/hooks-test.json
echo ""
echo "Sending to hooks/agent..."
curl -s -X POST http://localhost:18789/hooks/agent \
  -H "x-openclaw-token:hq-hooks-secret-2026" \
  -H "Content-Type:application/json" \
  -d @/tmp/hooks-test.json
echo ""
