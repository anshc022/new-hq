'use client';
import { useEffect, useRef, useMemo } from 'react';
import { AGENTS, STATUS_VISUALS } from '@/lib/agents';

const AGENT_LIST = Object.entries(AGENTS);
const TWO_PI = Math.PI * 2;

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function getAgentPositions(cx, cy, radius) {
  const positions = {};
  AGENT_LIST.forEach(([name], i) => {
    const angle = (i / AGENT_LIST.length) * TWO_PI - Math.PI / 2;
    positions[name] = {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    };
  });
  return positions;
}

// Connection pairs (agent-to-agent neural links)
const CONNECTIONS = [
  ['echo', 'flare'], ['echo', 'bolt'], ['echo', 'nexus'],
  ['echo', 'vigil'], ['echo', 'forge'],
  ['flare', 'bolt'], ['nexus', 'vigil'], ['bolt', 'nexus'],
  ['vigil', 'forge'], ['forge', 'flare'],
];

export default function NodeGraph({ agents, nodeConnected, events }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const particlesRef = useRef([]);
  const radarRef = useRef(0);

  const agentMap = useMemo(() => {
    const m = {};
    (agents || []).forEach(a => { m[a.name] = a; });
    return m;
  }, [agents]);

  const recentEvents = useMemo(() => (events || []).slice(-10), [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Bezier helper
    const bezierPoint = (t, x0, y0, x1, y1, x2, y2) => {
      const mt = 1 - t;
      return {
        x: mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
        y: mt * mt * y0 + 2 * mt * t * y1 + t * t * y2,
      };
    };

    // Spawn data particles trailing along bezier
    const spawnParticle = (from, to, color, bcx, bcy) => {
      particlesRef.current.push({
        fx: from.x, fy: from.y,
        tx: to.x, ty: to.y,
        cx: bcx !== undefined ? bcx : (from.x + to.x) / 2,
        cy: bcy !== undefined ? bcy : (from.y + to.y) / 2,
        t: 0, speed: 0.006 + Math.random() * 0.011,
        color, size: 2 + Math.random() * 2.5,
      });
    };

    const draw = () => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2 + 5;
      const radius = Math.min(w, h) * 0.30;
      const now = timeRef.current;
      timeRef.current += 0.016;
      radarRef.current = (radarRef.current + 0.008) % TWO_PI;

      ctx.clearRect(0, 0, w, h);
      const positions = getAgentPositions(cx, cy, radius);

      // ── Deep space radial bg ──
      const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.2);
      bgGrd.addColorStop(0, 'rgba(28, 0, 48, 0.18)');
      bgGrd.addColorStop(0.5, 'rgba(8, 0, 16, 0.08)');
      bgGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrd;
      ctx.fillRect(0, 0, w, h);

      // ── Orbital rings with tick marks ──
      for (let r = 1; r <= 3; r++) {
        const ringR = radius * (0.28 + r * 0.27);
        const alpha = 0.07 + Math.sin(now * 0.4 + r) * 0.025;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, TWO_PI);
        ctx.strokeStyle = `rgba(196, 0, 255, ${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        for (let tick = 0; tick < 24; tick++) {
          const a = (tick / 24) * TWO_PI;
          const major = tick % 4 === 0;
          const inner = cx + Math.cos(a) * (ringR - (major ? 4 : 2));
          const innerY = cy + Math.sin(a) * (ringR - (major ? 4 : 2));
          const outer = cx + Math.cos(a) * (ringR + (major ? 4 : 2));
          const outerY = cy + Math.sin(a) * (ringR + (major ? 4 : 2));
          ctx.beginPath();
          ctx.moveTo(inner, innerY);
          ctx.lineTo(outer, outerY);
          ctx.strokeStyle = `rgba(196, 0, 255, ${major ? 0.22 : 0.07})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // ── Radar sweep ──
      const radarAngle = radarRef.current;
      const sweepLen = Math.PI * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius * 1.45, radarAngle - sweepLen, radarAngle);
      ctx.closePath();
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.45);
      rg.addColorStop(0, 'transparent');
      rg.addColorStop(0.55, 'rgba(196, 0, 255, 0.035)');
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.restore();
      // Sweep leading edge
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(radarAngle) * radius * 1.45, cy + Math.sin(radarAngle) * radius * 1.45);
      ctx.strokeStyle = 'rgba(196, 0, 255, 0.40)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── Grid crosshairs ──
      ctx.strokeStyle = 'rgba(196, 0, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius * 1.6); ctx.lineTo(cx, cy + radius * 1.6);
      ctx.moveTo(cx - radius * 1.6, cy); ctx.lineTo(cx + radius * 1.6, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Bezier connection lines ──
      CONNECTIONS.forEach(([a, b]) => {
        const pa = positions[a]; const pb = positions[b];
        if (!pa || !pb) return;
        const aActive = isActive((agentMap[a] || {}).status);
        const bActive = isActive((agentMap[b] || {}).status);
        const bothActive = aActive && bActive;

        // Bezier control point (bulge outward from center)
        const midX = (pa.x + pb.x) / 2;
        const midY = (pa.y + pb.y) / 2;
        const dx = midX - cx; const dy = midY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const bcx = midX + (dx / dist) * radius * 0.28;
        const bcy = midY + (dy / dist) * radius * 0.28;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(bcx, bcy, pb.x, pb.y);
        if (bothActive) {
          ctx.strokeStyle = `rgba(255, 204, 0, ${0.50 + Math.sin(now * 2.5) * 0.12})`;
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 5;
        } else if (aActive || bActive) {
          ctx.strokeStyle = 'rgba(196, 0, 255, 0.24)';
          ctx.lineWidth = 0.9;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = 'rgba(196, 0, 255, 0.05)';
          ctx.lineWidth = 0.5;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        if ((aActive || bActive) && Math.random() < 0.028) {
          const color = bothActive ? '#ffcc00' : (aActive ? AGENTS[a]?.color : AGENTS[b]?.color) || '#c400ff';
          spawnParticle(aActive ? pa : pb, aActive ? pb : pa, color, bcx, bcy);
        }
      });

      // ── Bezier particles ──
      particlesRef.current = particlesRef.current.filter(p => {
        p.t += p.speed;
        if (p.t >= 1) return false;
        const pt = bezierPoint(p.t, p.fx, p.fy, p.cx, p.cy, p.tx, p.ty);
        const ptPrev = bezierPoint(Math.max(0, p.t - 0.10), p.fx, p.fy, p.cx, p.cy, p.tx, p.ty);

        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, p.size * 2.5);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size * (1 - p.t * 0.5), 0, TWO_PI);
        ctx.fillStyle = grd;
        ctx.globalAlpha = (1 - p.t) * 0.85;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(ptPrev.x, ptPrev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = (1 - p.t) * 0.40;
        ctx.lineWidth = p.size * 0.55;
        ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      });

      // ── Central CORE node ──
      const coreColor = nodeConnected ? '#c400ff' : '#ff5500';
      const coreAlt = nodeConnected ? '#ffcc00' : '#ff2200';

      // Pulse rings from core while online
      if (nodeConnected) {
        for (let pulse = 0; pulse < 3; pulse++) {
          const pt = ((now * 0.5) + pulse * 0.33) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 32 + pt * radius * 0.55, 0, TWO_PI);
          ctx.strokeStyle = `rgba(196, 0, 255, ${(1 - pt) * 0.10})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Core multi-rings
      for (let rr = 0; rr < 3; rr++) {
        const rRad = 46 + rr * 10;
        const rA = (0.10 - rr * 0.025) + Math.sin(now * 1.2 + rr) * 0.04;
        ctx.beginPath();
        ctx.arc(cx, cy, rRad, 0, TWO_PI);
        ctx.strokeStyle = rr === 0 ? coreAlt : `rgba(196, 0, 255, ${rA})`;
        ctx.globalAlpha = rA;
        ctx.lineWidth = rr === 0 ? 1.5 : 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Core glow
      const cGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 42);
      cGrd.addColorStop(0, nodeConnected ? 'rgba(196, 0, 255, 0.38)' : 'rgba(255, 85, 0, 0.38)');
      cGrd.addColorStop(0.55, nodeConnected ? 'rgba(196, 0, 255, 0.12)' : 'rgba(255, 85, 0, 0.12)');
      cGrd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, TWO_PI);
      ctx.fillStyle = cGrd;
      ctx.fill();

      // Core circle
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, TWO_PI);
      ctx.fillStyle = 'rgba(5, 0, 10, 0.96)';
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 14;
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      // Hex icon
      drawHexIcon(ctx, cx, cy, 13, coreColor);

      // Core labels
      ctx.font = '700 8.5px Orbitron, sans-serif';
      ctx.fillStyle = coreColor;
      ctx.textAlign = 'center';
      ctx.shadowColor = coreColor; ctx.shadowBlur = 8;
      ctx.fillText('OPENCLAW', cx, cy + 52);
      ctx.shadowBlur = 0;
      ctx.font = '400 7px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(255, 204, 0, 0.55)';
      ctx.fillText('CORE · GATEWAY', cx, cy + 63);
      ctx.font = '400 6.5px JetBrains Mono, monospace';
      ctx.fillStyle = nodeConnected ? 'rgba(0, 255, 170, 0.55)' : 'rgba(255, 34, 0, 0.55)';
      ctx.fillText(nodeConnected ? '● EC2 CONNECTED' : '● EC2 OFFLINE', cx, cy + 74);

      // ── Agent nodes ──
      AGENT_LIST.forEach(([name, config]) => {
        const pos = positions[name];
        const data = agentMap[name] || {};
        const status = (data.status || 'idle').toLowerCase();
        const active = isActive(status);
        const statusGlow = STATUS_VISUALS[status]?.glow || '#3d2050';
        const nodeR = 24;

        // Core→agent line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = active
          ? `rgba(255, 204, 0, ${0.22 + Math.sin(now * 3 + pos.angle) * 0.08})`
          : 'rgba(196, 0, 255, 0.06)';
        ctx.lineWidth = active ? 1.3 : 0.6;
        ctx.setLineDash(active ? [] : [3, 5]);
        ctx.shadowColor = active ? '#ffcc00' : 'transparent';
        ctx.shadowBlur = active ? 3 : 0;
        ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0;

        // Spawn core→agent particles
        if (active && Math.random() < 0.022) {
          spawnParticle({ x: cx, y: cy }, pos, config.color);
        }

        // Active pulsing rings
        if (active) {
          const pr = nodeR + 7 + Math.sin(now * 3 + pos.angle * 2) * 2.5;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, pr, 0, TWO_PI);
          ctx.strokeStyle = statusGlow;
          ctx.globalAlpha = 0.28 + Math.sin(now * 3 + pos.angle) * 0.12;
          ctx.lineWidth = 1.5; ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nodeR + 14, 0, TWO_PI);
          ctx.strokeStyle = statusGlow;
          ctx.globalAlpha = 0.08; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Glow halo
        const aGrd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR + 12);
        aGrd.addColorStop(0, active ? config.color + '38' : config.color + '0c');
        aGrd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR + 12, 0, TWO_PI);
        ctx.fillStyle = aGrd; ctx.fill();

        // Main circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR, 0, TWO_PI);
        ctx.fillStyle = 'rgba(5, 0, 10, 0.96)';
        ctx.strokeStyle = active ? config.color : config.color + '40';
        ctx.lineWidth = active ? 2.5 : 1.2;
        ctx.shadowColor = active ? config.color : 'transparent';
        ctx.shadowBlur = active ? 10 : 0;
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        // Circular health arc
        const health = status === 'error' ? 0.15 : active ? 0.82 + Math.sin(now + pos.angle) * 0.1 : 0.45;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR + 3, -Math.PI / 2, -Math.PI / 2 + health * TWO_PI);
        ctx.strokeStyle = status === 'error' ? '#ff2200' : active ? statusGlow : '#3d2050';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.globalAlpha = active ? 0.80 : 0.28;
        ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineCap = 'butt';

        // Agent icon
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, pos.x, pos.y);
        ctx.textBaseline = 'alphabetic';

        // Name label
        const labelY = pos.y + nodeR + 16;
        ctx.font = '700 9px Orbitron, sans-serif';
        ctx.fillStyle = active ? config.color : config.color + '70';
        ctx.textAlign = 'center';
        ctx.shadowColor = active ? config.color : 'transparent';
        ctx.shadowBlur = active ? 7 : 0;
        ctx.fillText(name.toUpperCase(), pos.x, labelY);
        ctx.shadowBlur = 0;

        // Role
        ctx.font = '400 6.5px JetBrains Mono, monospace';
        ctx.fillStyle = active ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.12)';
        ctx.fillText(config.role, pos.x, labelY + 11);

        // Status
        ctx.font = '600 7px JetBrains Mono, monospace';
        ctx.fillStyle = active ? statusGlow : '#3d2050';
        ctx.fillText(status.toUpperCase(), pos.x, labelY + 22);

        // Current task
        if (active && data.current_task) {
          ctx.font = '400 6px JetBrains Mono, monospace';
          ctx.fillStyle = 'rgba(255, 204, 0, 0.52)';
          ctx.fillText(truncate(data.current_task, 20), pos.x, labelY + 33);
        }

        // Status dot (top-right of node)
        ctx.beginPath();
        ctx.arc(pos.x + nodeR * 0.68, pos.y - nodeR * 0.68, 4, 0, TWO_PI);
        ctx.fillStyle = statusGlow;
        ctx.shadowColor = statusGlow;
        ctx.shadowBlur = active ? 7 : 0;
        ctx.fill(); ctx.shadowBlur = 0;
      });

      // ── HUD corner brackets ──
      drawHUDCorners(ctx, 14, 14, w - 28, h - 28);

      // ── Overlay timestamps & stats ──
      ctx.font = '400 8px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(255, 204, 0, 0.44)';
      ctx.textAlign = 'left';
      ctx.fillText(`T:${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`, 22, h - 22);

      const activeCount = AGENT_LIST.filter(([n]) => isActive((agentMap[n]?.status || ''))).length;
      ctx.textAlign = 'right';
      ctx.fillText(`${activeCount}/${AGENT_LIST.length} ACTIVE`, w - 22, h - 22);

      ctx.fillStyle = 'rgba(196, 0, 255, 0.32)';
      ctx.font = '400 7px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('NEURAL MAP · OPENCLAW v2026', w - 22, 28);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [agentMap, nodeConnected, recentEvents]);

  return (
    <div className="relative w-full h-full min-h-[380px]">
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}

function isActive(status) {
  const s = (status || '').toLowerCase();
  return s === 'working' || s === 'thinking' || s === 'talking' || s === 'posting' || s === 'researching' || s === 'monitoring';
}

function drawHexIcon(ctx, cx, cy, size, color) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TWO_PI - Math.PI / 6;
    if (i === 0) ctx.moveTo(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
    else ctx.lineTo(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, TWO_PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHUDCorners(ctx, x, y, w, h) {
  const len = 22;
  ctx.strokeStyle = 'rgba(255, 204, 0, 0.24)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len); ctx.stroke();
}
