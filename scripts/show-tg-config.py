import json
with open('/home/ubuntu/.openclaw/openclaw.json') as f:
    c = json.load(f)
tg = c.get('channels', {}).get('telegram', {})
print(json.dumps(tg, indent=2))
