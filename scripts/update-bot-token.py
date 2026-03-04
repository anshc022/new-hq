import json

CONFIG_PATH = '/home/ubuntu/.openclaw/openclaw.json'

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

old_token = config.get('channels', {}).get('telegram', {}).get('botToken', '')
new_token = '8622785060:AAE-jp3MkMsnaSzVAnt9ngH1723_VA89IWk'

print(f'Old token: {old_token[:12]}...')
print(f'New token: {new_token[:12]}...')

config['channels']['telegram']['botToken'] = new_token

with open(CONFIG_PATH, 'w') as f:
    json.dump(config, f, indent=4)

print('OK - Telegram bot token updated to @OracI3_bot')
