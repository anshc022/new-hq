import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Config ───
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';
const BRIDGE_API = process.env.BRIDGE_API || 'http://localhost:4000/api/gateway-bridge';
const HEARTBEAT_API = process.env.HEARTBEAT_API || 'http://localhost:4000/api/node-heartbeat';

// Device identity for challenge-response auth
const STATE_DIR = process.env.STATE_DIR || path.join(process.env.HOME || '/home/ubuntu', '.openclaw');
const DEVICE_JSON_PATH = path.join(STATE_DIR, 'identity', 'device.json');
const DEVICE_AUTH_PATH = path.join(STATE_DIR, 'identity', 'device-auth.json');

const PROTOCOL_VERSION = 3;
const RECONNECT_DELAY_BASE = 3000;
const RECONNECT_DELAY_MAX = 30000;
const HEARTBEAT_INTERVAL = 45000;
const PING_INTERVAL = 20000;

let ws = null;
let reconnectAttempts = 0;
let heartbeatTimer = null;
let pingTimer = null;
let alive = false;
let connectSent = false;
let connectNonce = null;
let lastTick = null;
let tickTimer = null;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ─── Device identity helpers ───
let deviceIdentity = null;
try {
  const raw = fs.readFileSync(DEVICE_JSON_PATH, 'utf8');
  deviceIdentity = JSON.parse(raw);
  log('📱 Loaded device identity: ' + deviceIdentity.deviceId?.slice(0, 12) + '...');
} catch (err) {
  log('⚠️  No device identity found, will connect without device auth');
}

let deviceAuthToken = null;
try {
  const raw = fs.readFileSync(DEVICE_AUTH_PATH, 'utf8');
  const auth = JSON.parse(raw);
  deviceAuthToken = auth.tokens?.operator?.token || null;
  if (deviceAuthToken) log('🔑 Loaded device auth token');
} catch { }

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}

function derivePublicKeyRaw(pem) {
  const key = crypto.createPublicKey(pem);
  const spki = key.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI is 44 bytes: 12-byte prefix + 32-byte raw key
  return spki.subarray(12);
}

function buildDeviceAuthPayload({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce }) {
  const version = nonce ? 'v2' : 'v1';
  const base = [version, deviceId, clientId, clientMode, role, scopes.join(','), String(signedAtMs), token || ''];
  if (version === 'v2') base.push(nonce || '');
  return base.join('|');
}

function signDevicePayload(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf8'), key));
}

// ─── Agent dispatch mapping (gateway account → our agent name) ───
const AGENT_MAP = {
  main: 'echo',
  echo: 'echo',
  flare: 'flare',
  bolt: 'bolt',
  nexus: 'nexus',
  vigil: 'vigil',
  forge: 'forge',
};

// ─── Message forwarding ───
async function forwardToAPI(payload) {
  try {
    const res = await fetch(BRIDGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      log(`⚠️  Bridge API ${res.status}: ${txt.slice(0, 120)}`);
    }
  } catch (err) {
    log(`❌ Bridge API error: ${err.message}`);
  }
}

async function sendHeartbeat(online = true) {
  try {
    const res = await fetch(HEARTBEAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ec2-main', hostname: 'ec2-main' }),
    });
    const json = await res.json();
    log(`💓 Heartbeat sent → ${res.status} ${JSON.stringify(json)}`);
  } catch (err) {
    log(`⚠️  Heartbeat error: ${err.message}`);
  }
}

// ─── Message parsing ───
function parseMessage(raw) {
  try {
    const data = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

function resolveAgent(data) {
  if (!data) return null;

  // Check payload fields for agent identity (new event frame format)
  const payload = data.payload || {};

  // Check sessionKey first — most reliable for embedded events (format: agent:main:discord:...)
  const sessionKey = payload.sessionKey || data.sessionKey || '';
  if (sessionKey) {
    const parts = sessionKey.split(':');
    if (parts[0] === 'agent' && AGENT_MAP[parts[1]]) return AGENT_MAP[parts[1]];
  }

  const account = data.account || data.agent || data.session_account ||
    payload.account || payload.agent || payload.agentId || '';
  const accountLower = account.toLowerCase();

  // Direct map
  if (AGENT_MAP[accountLower]) return AGENT_MAP[accountLower];

  // Check event type fields
  if (data.event === 'sessions_spawn' || data.event === 'sessions_send' ||
      data.type === 'sessions_spawn' || data.type === 'sessions_send') {
    const target = (data.target_account || data.to || payload.target_account || payload.to || '').toLowerCase();
    if (AGENT_MAP[target]) return AGENT_MAP[target];
  }

  // Check data.agentId
  if (payload.data?.agentId && AGENT_MAP[payload.data.agentId]) return AGENT_MAP[payload.data.agentId];

  // Fallback: check if any known agent name appears in the data
  const str = JSON.stringify(data).toLowerCase();
  for (const [key, val] of Object.entries(AGENT_MAP)) {
    if (key !== 'main' && str.includes(`"${key}"`)) return val;
  }

  return null;
}

// ─── WebSocket connection ───
function sendConnectFrame() {
  if (connectSent || !ws || ws.readyState !== WebSocket.OPEN) return;
  connectSent = true;

  const role = 'operator';
  const authToken = deviceAuthToken || GATEWAY_TOKEN;
  const signedAtMs = Date.now();
  const nonce = connectNonce || undefined;
  const scopes = ['operator.admin'];
  const clientId = 'gateway-client';
  const clientMode = 'backend';

  let device = undefined;
  if (deviceIdentity) {
    const payload = buildDeviceAuthPayload({
      deviceId: deviceIdentity.deviceId,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs,
      token: authToken,
      nonce,
    });
    const signature = signDevicePayload(deviceIdentity.privateKeyPem, payload);
    device = {
      id: deviceIdentity.deviceId,
      publicKey: base64UrlEncode(derivePublicKeyRaw(deviceIdentity.publicKeyPem)),
      signature,
      signedAt: signedAtMs,
      nonce,
    };
  }

  const params = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: clientId,
      displayName: 'Ops HQ Bridge',
      version: '2.0.0',
      platform: process.platform,
      mode: clientMode,
    },
    caps: [],
    auth: { token: authToken },
    role,
    scopes,
    device,
  };

  const id = crypto.randomUUID();
  const frame = { type: 'req', id, method: 'connect', params };
  log('🔑 Sending connect frame...');
  ws.send(JSON.stringify(frame));
}

function connect() {
  log(`🔌 Connecting to ${GATEWAY_URL}...`);

  ws = new WebSocket(GATEWAY_URL, {
    headers: { Authorization: `Bearer ${GATEWAY_TOKEN}` },
  });

  ws.on('open', () => {
    log('✅ Connected to gateway');
    reconnectAttempts = 0;
    alive = true;
    connectSent = false;
    connectNonce = null;

    sendHeartbeat(true);
    heartbeatTimer = setInterval(() => sendHeartbeat(true), HEARTBEAT_INTERVAL);

    pingTimer = setInterval(() => {
      if (!alive) {
        log('💀 No pong — reconnecting...');
        ws.terminate();
        return;
      }
      alive = false;
      try { ws.ping(); } catch {}
    }, PING_INTERVAL);

    // Wait for connect.challenge before sending connect frame
    // (handled in on('message'))
  });

  ws.on('pong', () => { alive = true; });

  ws.on('message', (raw) => {
    const str = raw.toString();
    const data = parseMessage(str);
    if (!data) return;

    // Handle connect.challenge — respond with proper connect frame
    if (data.type === 'event' && data.event === 'connect.challenge') {
      const nonce = data.payload?.nonce;
      if (nonce) {
        connectNonce = nonce;
        log('🔐 Received connect challenge, responding...');
        sendConnectFrame();
      }
      return;
    }

    // Handle response frames (hello.ok from connect, or other RPC responses)
    if (data.type === 'res') {
      if (data.ok && data.payload?.policy) {
        log('🎉 Gateway hello.ok — connected successfully!');
        const tickMs = data.payload.policy?.tickIntervalMs || 30000;
        lastTick = Date.now();
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(() => {
          if (lastTick && Date.now() - lastTick > tickMs * 2) {
            log('⏰ Tick timeout — reconnecting...');
            ws?.close(4000, 'tick timeout');
          }
        }, Math.max(tickMs, 1000));
      } else if (!data.ok) {
        log(`❌ Gateway connect error: ${data.error?.message || JSON.stringify(data.error)}`);
      }
      return;
    }

    // Handle tick events (keepalive)
    if (data.type === 'event' && data.event === 'tick') {
      lastTick = Date.now();
      return;
    }

    // Skip pings/system messages
    if (data.type === 'ping' || data.type === 'pong' || data.type === 'welcome') return;

    const agent = resolveAgent(data);

    // Log ALL events (verbose for debugging)
    const evtType = data.event || data.type || '?';
    const evtStream = data.payload?.stream || '';
    const evtPhase = data.payload?.data?.phase || '';
    const preview = (data.payload?.content || data.payload?.text || data.payload?.data?.text || data.content || data.text || '').slice(0, 80);
    log(`📨 [${agent || '?'}] ${evtType}${evtStream ? '/' + evtStream : ''}${evtPhase ? '.' + evtPhase : ''}: ${preview || JSON.stringify(data).slice(0, 120)}`);

    // Forward everything to the bridge API
    forwardToAPI({
      ...data,
      _agent: agent,
      _raw_type: evtType,
      _ts: Date.now(),
    });
  });

  ws.on('close', (code, reason) => {
    log(`🔌 Disconnected (${code}): ${reason || 'no reason'}`);
    cleanup();
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    log(`❌ WS error: ${err.message}`);
    cleanup();
    scheduleReconnect();
  });
}

function cleanup() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  connectSent = false;
  connectNonce = null;
  lastTick = null;
  sendHeartbeat(false);
}

function scheduleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(1.5, reconnectAttempts - 1), RECONNECT_DELAY_MAX);
  log(`⏳ Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts})`);
  setTimeout(connect, delay);
}

// ─── Graceful shutdown ───
process.on('SIGINT', () => {
  log('👋 Shutting down...');
  cleanup();
  if (ws) ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('👋 SIGTERM — shutting down...');
  cleanup();
  if (ws) ws.close();
  process.exit(0);
});

// ─── Start ───
log('🚀 Gateway Bridge v2');
log(`   Gateway: ${GATEWAY_URL}`);
log(`   Bridge API: ${BRIDGE_API}`);
connect();
