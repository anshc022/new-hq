'use client';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { buildAgentList } from '@/lib/agents';

function hexRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function rgba(hex, a) { const { r, g, b } = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }

function getStatus(a) {
  const s = (a?.status || '').toLowerCase();
  if (['active','working','thinking','talking','running'].includes(s)) return 'active';
  if (['error','degraded'].includes(s)) return 'degraded';
  if (['idle','sleeping'].includes(s)) return 'idle';
  return 'unknown';
}

const STATUS_COLORS = { active: '#22c55e', degraded: '#ef4444', idle: '#f59e0b', unknown: 'rgba(255,255,255,0.20)' };
const REL_COLORS = { spawns: '#c400ff', monitors: '#ff5500', reviews: '#ffcc00', messages: '#00ffaa', depends_on: '#00aaff' };
const REL_LABELS = { spawns: 'SPAWNS', monitors: 'WATCHES', reviews: 'REVIEWS', messages: 'TALKING', depends_on: 'DEPENDS' };

/* ── Force-directed simulation ────────────────────────────────── */
function initForcePositions(W, H, agentList) {
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.30;
  const nodes = {};
  agentList.forEach(([key], i) => {
    const angle = (i / agentList.length) * Math.PI * 2 - Math.PI / 2;
    nodes[key] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 };
  });
  nodes['CORE'] = { x: cx, y: cy, vx: 0, vy: 0 };
  return nodes;
}

function tickForce(nodes, edges, W, H, agentList) {
  const keys = Object.keys(nodes);
  const cx = W / 2, cy = H / 2;
  const repulsion = 12000;
  const attraction = 0.008;
  const centerPull = 0.003;
  const dampening = 0.85;
  const dt = 1;
  const forces = {};
  keys.forEach(k => { forces[k] = { fx: 0, fy: 0 }; });

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = nodes[keys[i]], b = nodes[keys[j]];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 30) dist = 30;
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      forces[keys[i]].fx -= fx; forces[keys[i]].fy -= fy;
      forces[keys[j]].fx += fx; forces[keys[j]].fy += fy;
    }
  }
  edges.forEach(({ source, target, weight }) => {
    const a = nodes[source], b = nodes[target];
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const idealLen = 160 - (weight || 1) * 10;
    const force = attraction * (dist - idealLen);
    const fx = (dx / dist) * force, fy = (dy / dist) * force;
    forces[source].fx += fx; forces[source].fy += fy;
    forces[target].fx -= fx; forces[target].fy -= fy;
  });
  agentList.forEach(([key]) => {
    const n = nodes[key], c = nodes['CORE'];
    if (!n || !c) return;
    forces[key].fx += (c.x - n.x) * attraction * 0.6;
    forces[key].fy += (c.y - n.y) * attraction * 0.6;
  });
  keys.forEach(k => {
    forces[k].fx += (cx - nodes[k].x) * centerPull;
    forces[k].fy += (cy - nodes[k].y) * centerPull;
  });
  forces['CORE'] = { fx: (cx - nodes['CORE'].x) * 0.1, fy: (cy - nodes['CORE'].y) * 0.1 };
  keys.forEach(k => {
    const n = nodes[k];
    n.vx = (n.vx + forces[k].fx * dt) * dampening;
    n.vy = (n.vy + forces[k].fy * dt) * dampening;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    const margin = 50;
    n.x = Math.max(margin, Math.min(W - margin, n.x));
    n.y = Math.max(margin, Math.min(H - margin, n.y));
  });
}

/* ── Sparkline for a node ────────────────────────────────────── */
function drawSparkline(ctx, cx, cy, activityTimes, color, nodeR) {
  if (!activityTimes || activityTimes.length === 0) return;
  const now = Date.now();
  const buckets = new Array(10).fill(0);
  const bucketMs = 12 * 60000;
  activityTimes.forEach(ts => {
    const age = now - new Date(ts).getTime();
    const idx = Math.floor(age / bucketMs);
    if (idx >= 0 && idx < 10) buckets[9 - idx]++;
  });
  const max = Math.max(...buckets, 1);
  const totalW = nodeR * 1.4;
  const barW = totalW / 10;
  const maxH = 8;
  const startX = cx - totalW / 2;
  const startY = cy + nodeR + 6;
  buckets.forEach((v, i) => {
    const bh = Math.max(0.5, (v / max) * maxH);
    ctx.fillStyle = rgba(color, v > 0 ? 0.6 : 0.12);
    ctx.fillRect(startX + i * barW + 0.5, startY + maxH - bh, barW - 1, bh);
  });
}

/* ── Bezier curve helpers ────────────────────────────────────── */
function getCurveControl(ax, ay, bx, by, curvature) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay;
  // Perpendicular offset for curve
  const nx = -dy, ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny) || 1;
  return { cx: mx + (nx / len) * curvature, cy: my + (ny / len) * curvature };
}

function getPointOnQuadBezier(ax, ay, cpx, cpy, bx, by, t) {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cpx + t * t * bx,
    y: u * u * ay + 2 * u * t * cpy + t * t * by,
  };
}

/* ── Draw a curved edge ──────────────────────────────────────── */
function drawCurvedEdge(ctx, ax, ay, bx, by, curvature, color, alpha, lineW, dashPattern, dashOffset) {
  const cp = getCurveControl(ax, ay, bx, by, curvature);
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = lineW;
  if (dashPattern) { ctx.setLineDash(dashPattern); ctx.lineDashOffset = dashOffset || 0; }
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cp.cx, cp.cy, bx, by);
  ctx.stroke();
  ctx.restore();
  return cp;
}

/* ── Draw flowing particles along a curve ────────────────────── */
function drawFlowParticles(ctx, ax, ay, cpx, cpy, bx, by, color, t, count) {
  for (let i = 0; i < count; i++) {
    const phase = ((t * 0.012) + i / count) % 1;
    const pt = getPointOnQuadBezier(ax, ay, cpx, cpy, bx, by, phase);
    const size = 2.5 + Math.sin(phase * Math.PI) * 1.5;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = rgba(color, 0.85);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ── Draw bubble label on a curve ────────────────────────────── */
function drawEdgeBubble(ctx, ax, ay, cpx, cpy, bx, by, label, color, alpha) {
  const pt = getPointOnQuadBezier(ax, ay, cpx, cpy, bx, by, 0.5);
  ctx.save();
  ctx.font = 'bold 7px "JetBrains Mono", monospace';
  const tw = ctx.measureText(label).width;
  const px = 6, py = 4;
  const bw = tw + px * 2, bh = 13;
  const rx = pt.x - bw / 2, ry = pt.y - bh / 2;

  // Bubble background
  ctx.fillStyle = rgba(color, 0.22 * alpha);
  roundRect(ctx, rx, ry, bw, bh, 4);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.45 * alpha);
  ctx.lineWidth = 0.6;
  roundRect(ctx, rx, ry, bw, bh, 4);
  ctx.stroke();

  // Text
  ctx.fillStyle = rgba(color, 0.90 * alpha);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pt.x, pt.y);
  ctx.restore();
}

/* ── Main component ──────────────────────────────────────────── */
export default function NodeGraph({ agents, relationships, nodeConnected, events, activity }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const frameRef = useRef(0);
  const nodesRef = useRef(null);
  const simStartRef = useRef(Date.now());
  const prevAgentCountRef = useRef(0);

  // Store live data in refs so the animation loop never restarts on data changes
  const agentsRef = useRef(agents);
  const agentListRef = useRef([]);
  const agentMapRef = useRef({});
  const edgesRef = useRef([]);
  const agentActivityRef = useRef({});

  // Dynamic agent list — merges Supabase identity with static config
  const agentList = useMemo(() => buildAgentList(agents), [agents]);

  const agentMap = useMemo(() => {
    const m = {};
    agents.forEach(a => { m[a.name] = a; });
    return m;
  }, [agents]);

  const agentActivityTimes = useMemo(() => {
    const map = {};
    (activity || []).forEach(a => {
      if (!map[a.agent]) map[a.agent] = [];
      map[a.agent].push(a.created_at);
    });
    return map;
  }, [activity]);

  const edges = useMemo(() => (relationships || []).map(r => ({
    source: r.source_agent,
    target: r.target_agent,
    type: r.relationship,
    weight: r.weight || 1,
    last_interaction_at: r.last_interaction_at || r.updated_at || r.created_at,
  })), [relationships]);

  // Sync memos into refs (cheap, no animation restart)
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { agentListRef.current = agentList; }, [agentList]);
  useEffect(() => { agentMapRef.current = agentMap; }, [agentMap]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { agentActivityRef.current = agentActivityTimes; }, [agentActivityTimes]);

  // Only re-init force positions when agent COUNT changes, not every data update
  useEffect(() => {
    if (agentList.length !== prevAgentCountRef.current && canvasRef.current) {
      prevAgentCountRef.current = agentList.length;
      nodesRef.current = initForcePositions(canvasRef.current.width, canvasRef.current.height, agentList);
      simStartRef.current = Date.now();
    }
  }, [agentList]);

  // Stable draw — reads from refs, never recreated
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const t = frameRef.current;

    // Read from stable refs
    const agentList = agentListRef.current;
    const agentMap = agentMapRef.current;
    const edges = edgesRef.current;
    const agentActivityTimes = agentActivityRef.current;
    const agents = agentsRef.current;

    if (!nodesRef.current) nodesRef.current = initForcePositions(W, H, agentList);
    const age = Date.now() - simStartRef.current;
    if (age < 8000) tickForce(nodesRef.current, edges, W, H, agentList);
    const pos = nodesRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 0.5;
    const spacing = 40;
    for (let x = 0; x < W; x += spacing) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += spacing) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    const corePos = pos['CORE'];
    const now = Date.now();

    // ── Draw core → agent curved connections ──
    agentList.forEach(([key, meta], idx) => {
      const p = pos[key]; if (!p) return;
      const liveData = agentMap[key] || agentMap[meta.id];
      const st = getStatus(liveData);
      const col = meta.color;
      const isActive = st === 'active';
      const curvature = 25 + (idx % 2 === 0 ? 15 : -15);

      if (isActive) {
        // Glow under the curve for active agents
        const cp = getCurveControl(corePos.x, corePos.y, p.x, p.y, curvature);
        ctx.save();
        ctx.filter = 'blur(4px)';
        ctx.strokeStyle = rgba(col, 0.18);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(corePos.x, corePos.y);
        ctx.quadraticCurveTo(cp.cx, cp.cy, p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }

      // Main core-to-agent curve
      drawCurvedEdge(
        ctx, corePos.x, corePos.y, p.x, p.y,
        curvature, col,
        isActive ? 0.35 : 0.08,
        isActive ? 1.2 : 0.5,
        isActive ? [6, 4] : [2, 8],
        -(t * 0.35)
      );
    });

    // ── Draw relationship edges — curved lines with live communication ──
    // Determine which agents are currently active/working
    const activeAgents = new Set();
    agents.forEach(a => {
      const st = getStatus(a);
      if (st === 'active') activeAgents.add(a.name);
    });

    edges.forEach(({ source, target, type, weight, last_interaction_at }, ei) => {
      const pa = pos[source], pb = pos[target];
      if (!pa || !pb) return;

      const sourceActive = activeAgents.has(source);
      const targetActive = activeAgents.has(target);
      const bothActive = sourceActive && targetActive;
      const eitherActive = sourceActive || targetActive;
      const edgeColor = REL_COLORS[type] || '#888888';

      // Curvature: alternate direction to avoid overlapping edges
      const curvature = (30 + weight * 8) * (ei % 2 === 0 ? 1 : -1);

      // Recency fade
      let recencyAlpha = 0.25;
      if (last_interaction_at) {
        const ageMs = now - new Date(last_interaction_at).getTime();
        const ageHours = ageMs / 3600000;
        recencyAlpha = Math.max(0.08, 0.45 - ageHours * 0.25);
      }

      // Connection line opacity + width based on agent activity
      let lineAlpha, lineW;
      if (bothActive) {
        // Both agents active → live communication line, bright + thick
        lineAlpha = 0.75;
        lineW = Math.min(3.5, 1.2 + weight * 0.2);
      } else if (eitherActive) {
        // One active → warm connection
        lineAlpha = 0.40;
        lineW = Math.min(2.5, 0.8 + weight * 0.15);
      } else {
        // Both idle → subtle ghost line
        lineAlpha = recencyAlpha * 0.6;
        lineW = 0.6;
      }

      // Glow under line for active connections
      if (bothActive) {
        const cp = getCurveControl(pa.x, pa.y, pb.x, pb.y, curvature);
        ctx.save();
        ctx.filter = 'blur(5px)';
        ctx.strokeStyle = rgba(edgeColor, 0.25);
        ctx.lineWidth = lineW + 4;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(cp.cx, cp.cy, pb.x, pb.y);
        ctx.stroke();
        ctx.restore();
      }

      // Draw the curved edge
      const cp = drawCurvedEdge(
        ctx, pa.x, pa.y, pb.x, pb.y,
        curvature, edgeColor, lineAlpha, lineW,
        eitherActive ? [4 + weight, 4] : [2, 10],
        -(t * (bothActive ? 0.5 : 0.2))
      );

      // ── Flowing particles for LIVE connections ──
      if (bothActive) {
        drawFlowParticles(ctx, pa.x, pa.y, cp.cx, cp.cy, pb.x, pb.y, edgeColor, t, 3);
      } else if (eitherActive && type === 'messages') {
        drawFlowParticles(ctx, pa.x, pa.y, cp.cx, cp.cy, pb.x, pb.y, edgeColor, t, 1);
      }

      // ── Bubble showing relationship type + task ──
      if (eitherActive) {
        const sourceData = agentMap[source];
        const targetData = agentMap[target];
        const activeData = sourceActive ? sourceData : targetData;
        const task = activeData?.current_task;

        if (bothActive) {
          // Show relationship label + short task
          const bubbleText = task
            ? `${REL_LABELS[type] || type} · ${task.length > 18 ? task.slice(0, 18) + '…' : task}`
            : REL_LABELS[type] || type;
          drawEdgeBubble(ctx, pa.x, pa.y, cp.cx, cp.cy, pb.x, pb.y, bubbleText, edgeColor, 1.0);
        } else {
          // Just show the type
          drawEdgeBubble(ctx, pa.x, pa.y, cp.cx, cp.cy, pb.x, pb.y, REL_LABELS[type] || type, edgeColor, 0.6);
        }
      }
    });

    // ── Draw agent nodes ──
    agentList.forEach(([key, meta]) => {
      const p = pos[key]; if (!p) return;
      const liveData = agentMap[key] || agentMap[meta.id];
      const st = getStatus(liveData);
      const col = meta.color;
      const nodeR = 28;

      // Glow for active
      if (st === 'active') {
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, nodeR * 2.5);
        grd.addColorStop(0, rgba(col, 0.22));
        grd.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, nodeR * 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Pulse ring for active
      if (st === 'active') {
        const phase = ((t * 16.67) % 600) / 600;
        const pulseScale = 1 + 0.3 * (1 - phase * phase);
        ctx.save();
        ctx.strokeStyle = rgba(col, 0.25 * (1 - phase));
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, nodeR * pulseScale, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // Node body
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = st === 'active' ? 14 : 4;
      ctx.fillStyle = 'rgba(10,10,15,0.92)';
      ctx.beginPath(); ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Border with status color
      const borderColor = STATUS_COLORS[st] || 'rgba(255,255,255,0.15)';
      ctx.strokeStyle = rgba(borderColor, st === 'active' ? 0.70 : 0.30);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2); ctx.stroke();

      // Inner color ring
      ctx.strokeStyle = rgba(col, 0.18);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(p.x, p.y, nodeR - 4, 0, Math.PI * 2); ctx.stroke();

      // Icon
      ctx.font = `${nodeR * 0.80}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.icon || '🤖', p.x, p.y - 2);

      // Status dot
      ctx.fillStyle = '#0a0a0f';
      ctx.beginPath(); ctx.arc(p.x + nodeR * 0.68, p.y + nodeR * 0.68, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = STATUS_COLORS[st] || 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(p.x + nodeR * 0.68, p.y + nodeR * 0.68, 4, 0, Math.PI * 2); ctx.fill();

      // Model badge
      const model = liveData?.model || meta?.model || '';
      if (model) {
        const shortModel = model.replace('claude-', '').replace('gemini-', '').slice(0, 10);
        ctx.save();
        ctx.font = '7px "JetBrains Mono", monospace';
        const tw = ctx.measureText(shortModel).width;
        const bx = p.x - tw / 2 - 4, by = p.y - nodeR - 12;
        ctx.fillStyle = 'rgba(196,0,255,0.18)';
        roundRect(ctx, bx, by, tw + 8, 12, 3); ctx.fill();
        ctx.fillStyle = 'rgba(200,136,255,0.80)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(shortModel, p.x, by + 6);
        ctx.restore();
      }

      // Label
      const labelY = p.y + nodeR + 16;
      ctx.save();
      ctx.fillStyle = st === 'active' ? col : 'rgba(255,255,255,0.70)';
      ctx.font = `bold 11px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(meta.label, p.x, labelY);
      ctx.restore();

      // Sparkline
      drawSparkline(ctx, p.x, p.y + nodeR + 14, agentActivityTimes[key], col, nodeR);

      // Task bubble under active agents
      if (liveData?.current_task && st === 'active') {
        const task = liveData.current_task.length > 30 ? liveData.current_task.slice(0, 30) + '…' : liveData.current_task;
        ctx.save();
        ctx.font = '9px "JetBrains Mono", monospace';
        const tw = ctx.measureText(task).width;
        const px2 = 8;
        const bx = p.x - tw / 2 - px2, by = labelY + 30;
        ctx.fillStyle = rgba(col, 0.18);
        roundRect(ctx, bx, by, tw + px2 * 2, 17, 4); ctx.fill();
        ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 0.8;
        roundRect(ctx, bx, by, tw + px2 * 2, 17, 4); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(task, p.x, by + 8.5);
        ctx.restore();
      }
    });

    // ── CORE node ──
    {
      const p = corePos;
      const coreR = 38;
      ctx.save();
      ctx.strokeStyle = rgba('#c400ff', 0.30); ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]); ctx.lineDashOffset = -(t * 0.2);
      ctx.beginPath(); ctx.arc(p.x, p.y, coreR + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreR * 2.2);
      grd.addColorStop(0, 'rgba(196,0,255,0.18)');
      grd.addColorStop(1, 'rgba(196,0,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, coreR * 2.2, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.shadowColor = '#c400ff'; ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(10,10,15,0.95)';
      ctx.beginPath(); ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(196,0,255,0.70)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(196,0,255,0.25)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(p.x, p.y, coreR - 8, 0, Math.PI * 2); ctx.stroke();

      ctx.save();
      ctx.shadowColor = '#c400ff'; ctx.shadowBlur = 8; ctx.fillStyle = '#c400ff';
      ctx.font = 'bold 9px "Orbitron", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('OPENCLAW', p.x, p.y - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.60)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText('CORE', p.x, p.y + 6);
      ctx.restore();
    }

    // ── Legend ──
    ctx.save();
    const lx = 16, ly = H - 90;
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillText('RELATIONSHIPS', lx, ly);
    let row = 0;
    Object.entries(REL_COLORS).forEach(([type, col]) => {
      ctx.fillStyle = col;
      ctx.fillRect(lx, ly + 12 + row * 13, 8, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillText(type, lx + 14, ly + 14 + row * 13);
      row++;
    });
    ctx.restore();

    // ── Minimap ──
    drawMinimap(ctx, pos, W, H, edges, agentList);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Stable — reads from refs, never needs recreation

  const resize = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const parent = c.parentElement;
    c.width = parent.clientWidth; c.height = parent.clientHeight;
    // Re-init positions on actual canvas resize
    nodesRef.current = initForcePositions(c.width, c.height, agentListRef.current);
    simStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement);
    return () => ro.disconnect();
  }, [resize]);

  useEffect(() => {
    let running = true;
    const loop = () => { if (!running) return; frameRef.current++; draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  return (
    <canvas ref={canvasRef} className="w-full h-full"
      style={{ display: 'block' }} />
  );
}

/* ── Minimap ─────────────────────────────────────────────────── */
function drawMinimap(ctx, pos, W, H, edges, agentList) {
  const mW = 120, mH = 80;
  const mx = W - mW - 16, my = H - mH - 16;
  const pad = 8;

  ctx.save();
  ctx.fillStyle = 'rgba(10,10,15,0.85)';
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  roundRect(ctx, mx, my, mW, mH, 4); ctx.fill(); ctx.stroke();

  const allX = [], allY = [];
  agentList.forEach(([key]) => { const p = pos[key]; if (p) { allX.push(p.x); allY.push(p.y); } });
  const cp = pos['CORE']; if (cp) { allX.push(cp.x); allY.push(cp.y); }
  if (allX.length === 0) { ctx.restore(); return; }
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const scaleX = (mW - pad * 2) / rangeX, scaleY = (mH - pad * 2) / rangeY;
  const scale = Math.min(scaleX, scaleY);
  const toMx = (x) => mx + pad + (x - minX) * scale;
  const toMy = (y) => my + pad + (y - minY) * scale;

  // Curved edges in minimap
  edges.forEach(({ source, target, type }, ei) => {
    const pa = pos[source], pb = pos[target];
    if (!pa || !pb) return;
    const curv = 6 * (ei % 2 === 0 ? 1 : -1);
    const cpc = getCurveControl(toMx(pa.x), toMy(pa.y), toMx(pb.x), toMy(pb.y), curv);
    ctx.strokeStyle = rgba(REL_COLORS[type] || '#888', 0.25);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(toMx(pa.x), toMy(pa.y));
    ctx.quadraticCurveTo(cpc.cx, cpc.cy, toMx(pb.x), toMy(pb.y));
    ctx.stroke();
  });

  agentList.forEach(([key, meta]) => {
    const p = pos[key]; if (!p) return;
    ctx.fillStyle = rgba(meta.color, 0.65);
    ctx.beginPath(); ctx.arc(toMx(p.x), toMy(p.y), 2.5, 0, Math.PI * 2); ctx.fill();
  });

  if (cp) {
    ctx.fillStyle = 'rgba(196,0,255,0.70)';
    ctx.beginPath(); ctx.arc(toMx(cp.x), toMy(cp.y), 3.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.font = 'bold 7px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'right';
  ctx.fillText('MINIMAP', mx + mW - 6, my + 10);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
