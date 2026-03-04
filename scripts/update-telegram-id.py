import json

CONFIG_PATH = '/home/ubuntu/.openclaw/openclaw.json'
NEW_ID = '8200388318'  # Kenny @Bol1bol11

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

tg = config.get('channels', {}).get('telegram', {})

# Show current config
print(f"Bot: {tg.get('botToken', 'N/A')[:12]}...")
print(f"Enabled: {tg.get('enabled', False)}")

# Find and update all user/chat ID references
old_ids = []
for key in ['adminChatId', 'allowedChatIds', 'chatId', 'userId', 'adminId', 'allowedUsers']:
    if key in tg:
        old_ids.append(f"  {key}: {tg[key]}")

if old_ids:
    print(f"Current ID fields:")
    for o in old_ids:
        print(o)

# Update the relevant ID fields
if 'adminChatId' in tg:
    tg['adminChatId'] = NEW_ID
if 'chatId' in tg:
    tg['chatId'] = NEW_ID
if 'userId' in tg:
    tg['userId'] = NEW_ID
if 'adminId' in tg:
    tg['adminId'] = NEW_ID
if 'allowedChatIds' in tg:
    if isinstance(tg['allowedChatIds'], list):
        tg['allowedChatIds'] = [NEW_ID]
    else:
        tg['allowedChatIds'] = NEW_ID
if 'allowedUsers' in tg:
    if isinstance(tg['allowedUsers'], list):
        tg['allowedUsers'] = [NEW_ID]
    else:
        tg['allowedUsers'] = NEW_ID

# Also check top-level config for telegram user references
for key in ['telegramUserId', 'telegramChatId', 'telegramAdminId']:
    if key in config:
        print(f"  top-level {key}: {config[key]} -> {NEW_ID}")
        config[key] = NEW_ID

config['channels']['telegram'] = tg

with open(CONFIG_PATH, 'w') as f:
    json.dump(config, f, indent=4)

print(f"\nOK - Telegram IDs updated to {NEW_ID} (Kenny @Bol1bol11)")
