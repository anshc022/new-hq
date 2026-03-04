import json

with open("/home/ubuntu/.openclaw/openclaw.json", "r") as f:
    config = json.load(f)

config["hooks"]["enabled"] = True
config["hooks"]["token"] = "hq-hooks-secret-2026"
config["hooks"]["path"] = "/hooks"
config["hooks"]["maxBodyBytes"] = 262144
config["hooks"]["defaultSessionKey"] = "hook:hq-todo"
config["hooks"]["allowRequestSessionKey"] = True
config["hooks"]["allowedAgentIds"] = ["main", "echo", "flare", "bolt", "nexus", "vigil", "forge"]

with open("/home/ubuntu/.openclaw/openclaw.json", "w") as f:
    json.dump(config, f, indent=2)

print("OK - hooks HTTP endpoint enabled")
print(json.dumps(config["hooks"], indent=2))
