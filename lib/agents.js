// V2 Agent definitions — Dev Team (Clawathon)
// 6 agents: Echo (lead), Flare (UI/UX + image gen), Bolt (frontend),
//           Nexus (backend), Vigil (QA), Forge (DevOps)

export const AGENTS = {
  echo:  { color: '#c400ff', icon: '🧠', label: 'Echo',  role: 'Tech Lead',          avatar: '🧠' },
  flare: { color: '#ff00aa', icon: '🎨', label: 'Flare', role: 'UI/UX + Image Gen',  avatar: '🎨' },
  bolt:  { color: '#ffcc00', icon: '⚡', label: 'Bolt',  role: 'Frontend Dev',       avatar: '⚡' },
  nexus: { color: '#00ffaa', icon: '🔧', label: 'Nexus', role: 'Backend Dev',        avatar: '🔧' },
  vigil: { color: '#ff5500', icon: '🛡️', label: 'Vigil', role: 'QA Engineer',        avatar: '🛡️' },
  forge: { color: '#ff2200', icon: '🔥', label: 'Forge', role: 'DevOps/Infra',       avatar: '🔥' },
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
