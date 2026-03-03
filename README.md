# ⚡ OpenClaw HQ — 6 AI Agents Walk Into an Office...

> *"What if your AI dev team had a mission control... but make it pixel art and slightly unhinged?"*

<p align="center">
  <img src="https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif" width="200" />
  <br/>
  <i>me watching my 6 AI agents argue about code architecture at 3am</i>
</p>

![6 Agents • 1 Dashboard](https://img.shields.io/badge/Agents-6-blue?style=for-the-badge)
![Claude Opus 4.6](https://img.shields.io/badge/Model-Claude%20Opus%204.6-purple?style=for-the-badge)
![AWS EC2 t3.large](https://img.shields.io/badge/EC2-t3.large-orange?style=for-the-badge)
![Built in 23hrs](https://img.shields.io/badge/Built%20In-23%20Hours-green?style=for-the-badge)
![Sleep](https://img.shields.io/badge/Sleep-0%20Hours-red?style=for-the-badge)

### 🔴 [LIVE DEMO](https://hq.pranshuchourasia.in) — yes, the agents are probably working right now

---

<p align="center">
  <img src="https://github.com/anshc022/My-hq/blob/main/demo.gif?raw=true" alt="OpenClaw + K2 Demo" width="800" />
  <br/>
  <i>^ 6 AI agents doing more work in 10 seconds than me in a week</i>
</p>

---

## 🤔 The Problem

You spin up 6 AI agents. They're coding, reviewing, deploying, testing — doing actual work. Meanwhile you?

<p align="center">
  <img src="https://media.giphy.com/media/HteV6g0QTNxp6/giphy.gif" width="300" />
  <br/>
  <i>you, reading 47 terminal logs simultaneously</i>
</p>

You're staring at terminal output like it's 1998, scrolling through walls of text trying to figure out *which agent is doing what.* "Is Bolt working? Did Nexus crash? Why is Forge deploying at 3am??"

**That's not observability. That's suffering.**

## 💡 The Solution

**A real-time pixel-art command center where your AI agents are actual characters walking around an office.**

| Status | What You See | Energy |
|--------|-------------|--------|
| Thinking | 🟡 Yellow glow | *"hmm let me think..."* |
| Working | 🟢 Green aura | *"I'M COOKING"* |
| Researching | 🟣 Purple vibes | *"hold on, googling..."* |
| Idle | 😴 Just wandering | *"nothing to see here"* |

When the Tech Lead delegates work, you literally watch agents wake up, walk to their rooms, and start working. When they finish, they go back to wandering aimlessly.

**It's like The Sims, but everyone is an AI and actually productive.**

---

##  Meet the Squad

| Agent | Role | Vibe | What They Actually Do |
|-------|------|------|----------------------|
| 🧠 **Echo** | Tech Lead | *"I delegate, therefore I am"* | Reads your message, decides who works, coordinates everyone |
| 🎨 **Flare** | UI/UX | *"make it pretty or don't ship it"* | Colors, layouts, components that don't look like 2005 |
| ⚡ **Bolt** | Frontend | *"React goes brrr"* | Turns Flare's dreams into actual JSX |
| 🔧 **Nexus** | Backend | *"have you tried turning the API off and on"* | Database schemas, API routes, the stuff nobody sees |
| 🛡️ **Vigil** | QA | *"it works on your machine? cool. it doesn't work on mine"* | Breaks things professionally |
| 🔥 **Forge** | DevOps | *"deployed to prod on a Friday"* | CI/CD, containers, and questionable deployment schedules |

All 6 run on **Claude Opus 4.6** (100k context) via GitHub Copilot, orchestrated by **OpenClaw v2026.2** on an **AWS EC2 `t3.large`** instance (2 vCPU, 8GB RAM).

<p align="center">
  <img src="https://media.giphy.com/media/3o7btNhMBytxAM6YBa/giphy.gif" width="250" />
  <br/>
  <i>Echo delegating work to the team</i>
</p>

---

## 🗺️ The Office

```
┌─────────────────────────┬──────────────────┐
│                         │                  │
│    💻 DEV FLOOR         │   🎯 WAR ROOM    │
│    "we need to talk     │   "this is fine" │
│     about the code"     │                  │
├─────────────────────────┼──────────────────┤
│                         │                  │
│    🧪 CODE LAB          │   🔥 DEPLOY BAY  │
│    "what if we tried—"  │   "SHIP IT NOW"  │
│    "no."                │                  │
└─────────────────────────┴──────────────────┘
```

Agents physically move between rooms based on what they're working on. Idle agents wander around like lost NPCs. Busy agents rush to their rooms like they just got a Slack message from the CEO.

---

## ✨ Features (the actually impressive stuff)

### 🎮 Live Animated Canvas
1500 lines of pixel-art rendering. Each agent has their own speed, preferred rooms, and idle animations. Bolt is the fastest. Forge is the slowest. This is lore.

### 📡 Real-Time Everything
WebSocket bridge → Supabase Realtime → Dashboard. Zero polling. When an agent starts thinking, you see it in **400ms**. Faster than your manager replying to emails.

### 🤝 Delegation Tracking (the cool part)
```
You: "hey echo, check the API and test it"
Echo: *spawns Nexus and Vigil*
Dashboard: "Coordinating: nexus, vigil working..."
Nexus: *checks API* ✅
Vigil: *tests it* ✅  
Dashboard: "All tasks complete"
Echo: *goes back to wandering* 😴
```

Echo stays lit until ALL sub-agents finish. Like a responsible manager who actually waits for the work to be done. *(unlike my real managers)*

### 📊 Dashboard Panels
- **Agent Cards** — who's working, who's slacking
- **Event Feed** — every tool call, in real-time
- **Mission Control** — system status, connection health
- **Gateway Log** — literally every thought every agent has

### 🔐 Protocol v3 Auth
Ed25519 challenge-response authentication. Not just a `Bearer token` — actual cryptographic handshake. Because even AI offices need security guards.

---

## 🏗️ Architecture

```
  YOU (Discord)
      │
      │ "hey echo, do the thing"
      ▼
┌──────────────┐     WebSocket      ┌──────────────┐
│   Gateway    │◄──────────────────►│    Bridge     │
│   (EC2       │   Protocol v3      │   (EC2       │
│   t3.large)  │   Ed25519 Auth     │   t3.large)  │
│  Claude Opus │                    │  Node.js     │
│   × 6 agents │                    │              │
└──────────────┘                    └──────┬───────┘
                                          │ HTTPS POST
                                          ▼
                                   ┌──────────────┐
                                   │   Next.js    │
                                   │   (Vercel)   │
                                   │  API Routes  │
                                   └──────┬───────┘
                                          │ Supabase
                                          ▼
                                   ┌──────────────┐
                                   │   Supabase   │
                                   │  Realtime DB │
                                   └──────┬───────┘
                                          │ Realtime
                                          ▼
                                   ┌──────────────┐
                                   │  Dashboard   │
                                   │  Pixel Art   │
                                   │  "ooh pretty"│
                                   └──────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | Next.js 16.1.6, React 19, Tailwind v4 | because bleeding edge is fun |
| Backend | Next.js API Routes (Vercel) | serverless = no servers to break |
| Database | Supabase Realtime | instant updates, zero polling |
| Bridge | Node.js WebSocket (EC2) | catches every agent heartbeat |
| AI Model | Claude Opus 4.6 × 6 | 100k context via GitHub Copilot |
| Compute | AWS EC2 `t3.large` | 2 vCPU, 8GB RAM, Intel Xeon Platinum |
| Auth | Ed25519 Protocol v3 | because security is not optional |
| Canvas | HTML5 Canvas, 1500 LOC | hand-crafted pixel art engine |
| Hosting | Vercel + AWS EC2 | the classic combo |

---

## 🚀 Getting Started

```bash
# Clone this masterpiece
git clone https://github.com/anshc022/My-hq.git
cd My-hq

# Install the things
npm install

# Set up your secrets
cp .env.example .env.local
# Fill in Supabase URL, keys, gateway details

# Watch the magic
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GATEWAY_URL=ws://your-server:18789
GATEWAY_TOKEN=your_gateway_token
```

---

## 🤖 Claude Opus 4.6 + AWS EC2 Setup

OPS HQ runs on **Claude Opus 4.6** (100k context) via **GitHub Copilot**, orchestrated by **OpenClaw v2026.2** on an **AWS EC2 `t3.large`** instance.

> **Instance Specs:**
>
> | Spec | Detail |
> |------|--------|
> | **Type** | `t3.large` |
> | **CPU** | 2 vCPU — Intel Xeon Platinum 8175M @ 2.50GHz |
> | **RAM** | 8 GB |
> | **Disk** | 48 GB SSD |
> | **OS** | Ubuntu Linux 6.17.0-1007-aws (x64) |
> | **Runtime** | Node.js v22.22.0 |

### 1. EC2 Instance Setup

```bash
# SSH into your EC2 instance (t3.large recommended)
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install OpenClaw CLI
curl -fsSL https://docs.openclaw.ai/install.sh | bash

# Run onboarding
openclaw onboard --non-interactive --mode local
```

### 2. Configure the Model

Edit `~/.openclaw/config.json` on your EC2. The key parts:

```jsonc
{
  "auth": {
    "profiles": {
      "github-copilot:github": {
        "provider": "github-copilot",
        "mode": "token"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "github-copilot/claude-opus-4.6"
      },
      "models": {
        "github-copilot/claude-opus-4.6": {}
      },
      "contextTokens": 100000,
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    }
  }
}
```

### 3. Start the Gateway

```bash
# Start OpenClaw Gateway (runs all 6 agents)
openclaw gateway start

# Verify agents are alive
openclaw status
```

### 4. Connect the Bridge

```bash
# Start the WebSocket bridge (connects Gateway → Vercel dashboard)
node gateway-bridge.mjs
```

The bridge connects to the Gateway via WebSocket (Protocol v3, Ed25519 auth), catches every agent event, and forwards it to your Vercel-hosted dashboard via HTTPS POST. The gateway runs as a **systemd service** — auto-starts on boot, always running.

### Why Claude Opus 4.6?

| Feature | Detail |
|---------|--------|
| **Model** | Claude Opus 4.6 |
| **Context** | 100,000 tokens per agent |
| **Provider** | GitHub Copilot (token auth) |
| **Agents** | 6 concurrent, up to 8 sub-agents |
| **Docs** | [OpenClaw setup](https://docs.openclaw.ai) |

---

## 📁 Project Structure

```
├── app/
│   ├── page.js              # The entire dashboard (it's a lot)
│   ├── layout.js             # Metadata & stuff
│   └── api/
│       ├── gateway-bridge/   # Where events land (810 lines of chaos)
│       ├── dispatch/         # Send commands to agents
│       └── node-heartbeat/   # "are you alive?" check
├── components/
│   ├── OfficeCanvas.jsx      # 1500 lines of pixel-art madness 🎨
│   ├── AgentPanel.jsx        # Pretty agent cards
│   ├── ChatLog.jsx           # Every word every agent says
│   ├── EventFeed.jsx         # Real-time event doom-scroll
│   ├── MissionBoard.jsx      # System vitals
│   └── StatsBar.jsx          # Top bar with the blinky lights
├── lib/
│   ├── agents.js             # Agent DNA (colors, rooms, roles)
│   └── gateway.js            # Gateway connection config
└── gateway-bridge.mjs        # The bridge (lives on EC2, never sleeps)
```

---

## 🧠 How It Actually Works

1. 💬 **You send a message** in Discord → *"hey echo, do the thing"*
2. 🧠 **Echo** reads it, thinks real hard, decides what to do
3. ⚡ Echo **spawns sub-agents** → Bridge goes *"ooh, something happened!"*
4. 📡 Bridge **forwards to Vercel API** → writes to Supabase
5. ✨ Dashboard **subscribes via Realtime** → agents light up and move
6. 💪 Sub-agents **do their work**, post results to Discord
7. ✅ Sub-agents finish → Bridge catches `lifecycle.end`
8. 😴 Dashboard updates → agents go idle, start wandering again
9. 🍿 You watch all of this happen **in real-time** on a pixel-art canvas

The whole loop takes seconds. It's like watching ants building a colony, except the ants are writing TypeScript.

<p align="center">
  <img src="https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif" width="300" />
  <br/>
  <i>the agents when they finally finish a task</i>
</p>

---

## 🤯 Fun Facts

- The `OfficeCanvas.jsx` is **1547 lines**. It started at 200. We don't talk about what happened.
- Forge (DevOps) is the **slowest walker** in the office. This was a deliberate character choice.
- Bolt (Frontend) is the **fastest**. Because... ⚡
- Echo has a special room called **"Echo's Den"** in the top-right corner. He earned it.
- When ALL agents are idle, they literally wander around the office like NPCs waiting for a quest.
- The duplicate-suppression protocol is called `ANNOUNCE_SKIP`. When a sub-agent has already posted, it yells "ANNOUNCE_SKIP" to avoid saying the same thing twice. It works perfectly. Every time.
- This entire dashboard was built with AI assistance. The AI built its own surveillance system. *What could go wrong?*
- All 6 agents run **Claude Opus 4.6** with 100k context each — that's 600k tokens of combined brainpower on a single EC2 `t3.large`.

---

## 📝 License

MIT — do whatever you want with it. Fork it. Clone it. Give your agents better names than ours. We dare you.

---

<p align="center">
  <img src="https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" width="250" />
  <br/>
  <b>OpenClaw HQ</b> — because even AI agents deserve a cool office 🏢
  <br/>
  <i>now stop reading and go watch the demo</i>
</p>
#   n e w - h q  
 