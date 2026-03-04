import json

CONFIG_PATH = '/home/ubuntu/.openclaw/openclaw.json'
NEW_ID = '8200388318'

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

tg = config['channels']['telegram']

# Update allowFrom
old_allow = tg.get('allowFrom', [])
print(f"Old allowFrom: {old_allow}")
tg['allowFrom'] = [f'tg:{NEW_ID}']
print(f"New allowFrom: {tg['allowFrom']}")

config['channels']['telegram'] = tg

with open(CONFIG_PATH, 'w') as f:
    json.dump(config, f, indent=4)

print(f"\nOK - allowFrom updated to tg:{NEW_ID} (Kenny @Bol1bol11)")
