// OpenClaw Agent definitions — Full metadata
// 6 agents: Echo (lead), Flare (UI/UX), Bolt (frontend),
//           Nexus (backend), Vigil (QA), Forge (DevOps)

export const AGENTS = {
  echo: {
    id: 'main', key: 'echo',
    color: '#c400ff', icon: '⚙️', label: 'Echo', role: 'Tech Lead & Coordinator',
    model: 'gemini-flash-latest',
    description: 'Tech Lead and Coordinator. Runs the project, assigns tasks, reviews work, and coordinates the entire team. First responder to Commander. Manages all agent-to-agent communication and task delegation.',
    tools: ['Claude API', 'GitHub', 'Discord', 'OpenClaw Gateway', 'Memory Tools'],
    output: 'Task assignments, code reviews, team coordination reports',
    revenue: 'Core infrastructure — enables all revenue agents',
    channel: '#war-room',
    subagents: ['flare', 'bolt', 'nexus', 'vigil', 'forge'],
  },
  flare: {
    id: 'flare', key: 'flare',
    color: '#ff00aa', icon: '🎨', label: 'Flare', role: 'UI/UX + Image Gen',
    model: 'gemini-flash-latest',
    description: 'UI/UX Designer and Image Generator. Designs interfaces, creates mockups, generates visual assets with nano-banana-pro. Makes everything look stunning and production-ready.',
    tools: ['nano-banana-pro', 'Claude API', 'Figma Export', 'Discord'],
    output: 'UI mockups, design assets, generated images, style guides',
    revenue: 'Visual assets for client deliverables',
    channel: '#content-drop',
    subagents: ['bolt', 'nexus'],
  },
  bolt: {
    id: 'bolt', key: 'bolt',
    color: '#ffcc00', icon: '⚡', label: 'Bolt', role: 'Frontend Developer',
    model: 'gemini-flash-latest',
    description: 'Frontend Developer. Builds UI components, pages, and interactions. React, Next.js, Tailwind, HTML/CSS. Turns designs into working interfaces. Fast and pixel-perfect.',
    tools: ['Next.js', 'React', 'Tailwind', 'Vercel CLI', 'GitHub'],
    output: 'Deployed frontend pages, UI components, Vercel previews',
    revenue: 'Client-facing interfaces on Vercel',
    channel: '#published',
    subagents: ['nexus', 'vigil'],
  },
  nexus: {
    id: 'nexus', key: 'nexus',
    color: '#00ffaa', icon: '🧠', label: 'Nexus', role: 'Backend Developer',
    model: 'gemini-flash-latest',
    description: 'Backend Developer. APIs, databases, server logic, Node.js, Python. The brains behind the system. Makes everything actually work, handles data pipelines and integrations.',
    tools: ['Node.js', 'Python', 'Supabase', 'MongoDB', 'REST APIs', 'GitHub'],
    output: 'APIs, database schemas, server logic, integrations',
    revenue: 'Backend services powering all agent operations',
    channel: '#team-chat',
    subagents: ['vigil', 'forge'],
  },
  vigil: {
    id: 'vigil', key: 'vigil',
    color: '#ff5500', icon: '🔍', label: 'Vigil', role: 'QA Engineer',
    model: 'gemini-flash-latest',
    description: 'QA Engineer. Tests everything, finds bugs, reviews code, validates features. Zero tolerance for broken code or bad UX. Writes test suites and validates all deployments.',
    tools: ['Jest', 'Playwright', 'GitHub', 'Claude API', 'Browser Tools'],
    output: 'Test reports, bug tickets, deployment validations',
    revenue: 'Quality gate — prevents costly production bugs',
    channel: '#alerts',
    subagents: ['bolt', 'nexus'],
  },
  forge: {
    id: 'forge', key: 'forge',
    color: '#ff2200', icon: '🚀', label: 'Forge', role: 'DevOps / Infra',
    model: 'gemini-flash-latest',
    description: 'DevOps Engineer. Deploys, monitors, and manages infrastructure. Docker, AWS EC2, CI/CD, servers. Keeps everything running smooth. Handles the OpenClaw gateway and all cloud operations.',
    tools: ['AWS EC2', 'Docker', 'GitHub Actions', 'Vercel', 'OpenClaw Gateway'],
    output: 'Live deployments, infra configs, monitoring dashboards',
    revenue: 'Infrastructure reliability — zero downtime operations',
    channel: '#live-feed',
    subagents: ['nexus', 'vigil'],
  },
};

// Room definitions — 4 rooms in a 2x2 grid inside one unified box
export const ROOMS = {
  workspace: {
    x: 0.02, y: 0.03, w: 0.57, h: 0.47,
    label: 'DEV FLOOR', bg: 'rgba(12,14,35,0.6)', border: '#3344aa',
    accent: '#4a6aff', icon: '💻',
  },
  warroom: {
    x: 0.59, y: 0.03, w: 0.39, h: 0.47,
    label: 'WAR ROOM', bg: 'rgba(28,18,12,0.55)', border: '#8a5a2a',
    accent: '#d4915a', icon: '🎯',
  },
  lab: {
    x: 0.02, y: 0.50, w: 0.57, h: 0.47,
    label: 'CODE LAB', bg: 'rgba(10,20,18,0.55)', border: '#2a7a5a',
    accent: '#2ecc71', icon: '🧪',
  },
  forge: {
    x: 0.59, y: 0.50, w: 0.39, h: 0.47,
    label: 'DEPLOY BAY', bg: 'rgba(20,12,8,0.55)', border: '#8a4a1a',
    accent: '#E67E22', icon: '🔥',
  },
};

// Combined outer bounds for the unified box
export const UNIFIED_BOX = { x: 0.02, y: 0.03, w: 0.96, h: 0.94, dividerX: 0.59, dividerY: 0.50 };

// Desk positions per agent (percentage of canvas)
export const DESK_POSITIONS = {
  echo:  { x: 0.14, y: 0.18 },
  flare: { x: 0.32, y: 0.18 },
  bolt:  { x: 0.50, y: 0.18 },
  nexus: { x: 0.14, y: 0.35 },
  vigil: { x: 0.32, y: 0.35 },
  forge: { x: 0.78, y: 0.72 },
};

// Room center positions for when agents move rooms
export const ROOM_POSITIONS = {
  workspace: { x: 0.28, y: 0.25 },
  desk:      null, // alias — uses DESK_POSITIONS
  warroom:   { x: 0.78, y: 0.25 },
  lab:       { x: 0.28, y: 0.72 },
  forge:     { x: 0.78, y: 0.72 },
};

// Merge static AGENTS config with live Supabase agent data
// Supabase fields (emoji, role, model, display_name) override static defaults
export function getMergedMeta(name, supabaseAgent) {
  const staticMeta = AGENTS[name] || Object.values(AGENTS).find(v => v.id === name) || {};
  if (!supabaseAgent) return { ...staticMeta };
  return {
    ...staticMeta,
    icon: supabaseAgent.emoji || staticMeta.icon || '🤖',
    label: supabaseAgent.display_name || staticMeta.label || name,
    role: supabaseAgent.role || staticMeta.role || '',
    model: supabaseAgent.model || staticMeta.model || 'unknown',
  };
}

// Build dynamic agent list from Supabase agents, merged with static config
export function buildAgentList(agents) {
  if (!agents || agents.length === 0) return Object.entries(AGENTS);
  return agents.map(a => {
    const merged = getMergedMeta(a.name, a);
    return [a.name, merged];
  });
}

// Status visual mapping
export const STATUS_VISUALS = {
  idle:        { glow: '#3d2050' },
  working:     { glow: '#00ffaa' },
  thinking:    { glow: '#ffcc00' },
  talking:     { glow: '#c400ff' },
  posting:     { glow: '#ff5500' },
  researching: { glow: '#ff00aa' },
  error:       { glow: '#ff2200' },
  sleeping:    { glow: '#1a0525' },
  monitoring:  { glow: '#00ffaa' },
};
