'use client';
import { useEffect, useRef, useMemo } from 'react';
import { AGENTS, STATUS_VISUALS } from '@/lib/agents';

const AGENT_LIST = Object.entries(AGENTS);
const TWO_PI = Math.PI * 2;

// Agent orbital positions (hex layout around center)
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

// Connection pairs (agent-to-agent communication links)
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

  const agentMap = useMemo(() => {
    const m = {};
    (agents || []).forEach(a => { m[a.name] = a; });
    return m;
  }, [agents]);

  const recentEvents = useMemo(() => {
    return (events || []).slice(-10);
  }, [events]);

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

    // Spawn data particles along connections
    const spawnParticle = (from, to, color) => {
      particlesRef.current.push({
        fx: from.x, fy: from.y,
        tx: to.x, ty: to.y,
        t: 0, speed: 0.005 + Math.random() * 0.01,
        color, size: 1.5 + Math.random() * 1.5,
        life: 1,
      });
    };

    const draw = () => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.32;
      const now = timeRef.current;
      timeRef.current += 0.016;

      ctx.clearRect(0, 0, w, h);

      const positions = getAgentPositions(cx, cy, radius);

      // ── Draw orbital rings ──
      for (let r = 1; r <= 3; r++) {
        const ringR = radius * (0.3 + r * 0.25);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, TWO_PI);
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.04 + Math.sin(now * 0.5 + r) * 0.02})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Draw grid crosshairs ──
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius * 1.4);
      ctx.lineTo(cx, cy + radius * 1.4);
      ctx.moveTo(cx - radius * 1.4, cy);
      ctx.lineTo(cx + radius * 1.4, cy);
      ctx.stroke();

      // ── Draw connection lines ──
      CONNECTIONS.forEach(([a, b]) => {
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) return;

        const aData = agentMap[a] || {};
        const bData = agentMap[b] || {};
        const aActive = isActive(aData.status);
        const bActive = isActive(bData.status);
        const bothActive = aActive && bActive;
        const anyActive = aActive || bActive;

        // Connection line
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = bothActive
          ? `rgba(0, 240, 255, ${0.25 + Math.sin(now * 2) * 0.1})`
          : anyActive
            ? 'rgba(0, 240, 255, 0.12)'
            : 'rgba(0, 240, 255, 0.05)';
        ctx.lineWidth = bothActive ? 1.5 : 0.8;
        ctx.stroke();

        // Spawn particles on active connections
        if (anyActive && Math.random() < 0.02) {
          const color = bothActive ? '#00f0ff' : (aActive ? AGENTS[a]?.color : AGENTS[b]?.color) || '#00f0ff';
          spawnParticle(aActive ? pa : pb, aActive ? pb : pa, color);
        }
      });

      // ── Draw & update particles ──
      particlesRef.current = particlesRef.current.filter(p => {
        p.t += p.speed;
        p.life = 1 - p.t;
        if (p.t >= 1) return false;

        const x = p.fx + (p.tx - p.fx) * p.t;
        const y = p.fy + (p.ty - p.fy) * p.t;

        ctx.beginPath();
        ctx.arc(x, y, p.size * p.life, 0, TWO_PI);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Trail
        const trail = 0.15;
        const tx = p.fx + (p.tx - p.fx) * Math.max(0, p.t - trail);
        const ty = p.fy + (p.ty - p.fy) * Math.max(0, p.t - trail);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.life * 0.3;
        ctx.lineWidth = p.size * 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        return true;
      });

      // ── Draw central CORE node ──
      const coreGlow = 15 + Math.sin(now * 1.5) * 5;
      const coreColor = nodeConnected ? '#00f0ff' : '#ff2244';

      // Core outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, TWO_PI);
      ctx.strokeStyle = coreColor;
      ctx.globalAlpha = 0.15 + Math.sin(now) * 0.05;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Core glow
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
      coreGrad.addColorStop(0, nodeConnected ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 34, 68, 0.25)');
      coreGrad.addColorStop(0.6, nodeConnected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 34, 68, 0.08)');
      coreGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, TWO_PI);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Core inner circle
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, TWO_PI);
      ctx.fillStyle = 'rgba(3, 5, 8, 0.9)';
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Core hex icon
      drawHexIcon(ctx, cx, cy, 14, coreColor);

      // Core label
      ctx.font = '600 8px Orbitron, sans-serif';
      ctx.fillStyle = coreColor;
      ctx.textAlign = 'center';
      ctx.fillText('OPENCLAW', cx, cy + 48);
      ctx.font = '400 7px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.fillText('CORE', cx, cy + 58);

      // ── Draw agent nodes ──
      AGENT_LIST.forEach(([name, config]) => {
        const pos = positions[name];
        const data = agentMap[name] || {};
        const status = (data.status || 'idle').toLowerCase();
        const active = isActive(status);
        const statusGlow = STATUS_VISUALS[status]?.glow || '#666';
        const nodeR = 22;

        // Connection to core (always)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = active
          ? `rgba(0, 240, 255, ${0.15 + Math.sin(now * 3 + pos.angle) * 0.05})`
          : 'rgba(0, 240, 255, 0.04)';
        ctx.lineWidth = active ? 1 : 0.5;
        ctx.setLineDash(active ? [] : [4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Spawn core→agent particles
        if (active && Math.random() < 0.015) {
          spawnParticle({ x: cx, y: cy }, pos, config.color);
        }

        // Agent outer ring (status indicator)
        if (active) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nodeR + 6, 0, TWO_PI);
          ctx.strokeStyle = statusGlow;
          ctx.globalAlpha = 0.2 + Math.sin(now * 2 + pos.angle) * 0.1;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Agent glow
        const agentGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR + 2);
        agentGrad.addColorStop(0, active ? config.color + '30' : config.color + '10');
        agentGrad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR + 2, 0, TWO_PI);
        ctx.fillStyle = agentGrad;
        ctx.fill();

        // Agent main circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR, 0, TWO_PI);
        ctx.fillStyle = 'rgba(3, 5, 8, 0.9)';
        ctx.strokeStyle = active ? config.color : config.color + '50';
        ctx.lineWidth = active ? 2 : 1;
        ctx.fill();
        ctx.stroke();

        // Agent icon
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, pos.x, pos.y);
        ctx.textBaseline = 'alphabetic';

        // Agent name
        const labelY = pos.y + nodeR + 14;
        ctx.font = '600 9px Orbitron, sans-serif';
        ctx.fillStyle = active ? config.color : config.color + '80';
        ctx.textAlign = 'center';
        ctx.fillText(config.label.toUpperCase(), pos.x, labelY);

        // Status text
        ctx.font = '400 7px JetBrains Mono, monospace';
        ctx.fillStyle = active ? statusGlow : '#3a5068';
        ctx.fillText(status.toUpperCase(), pos.x, labelY + 12);

        // Health bar
        const barW = 30;
        const barH = 2;
        const barX = pos.x - barW / 2;
        const barY = labelY + 16;
        const health = status === 'error' ? 0.2 : active ? 0.9 : 0.5;

        ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = status === 'error' ? '#ff2244' : active ? statusGlow : '#3a5068';
        ctx.fillRect(barX, barY, barW * health, barH);
      });

      // ── HUD corner brackets ──
      drawHUDCorners(ctx, 20, 20, w - 40, h - 40);

      // ── Timestamp HUD overlay ──
      ctx.font = '400 8px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.textAlign = 'left';
      ctx.fillText(`SYS.T: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`, 30, h - 30);
      
      ctx.textAlign = 'right';
      const activeCount = AGENT_LIST.filter(([n]) => isActive((agentMap[n]?.status || ''))).length;
      ctx.fillText(`AGENTS: ${activeCount}/${AGENT_LIST.length} ACTIVE`, w - 30, h - 30);

      ctx.textAlign = 'left';
      ctx.fillText(`NODE: ${nodeConnected ? 'ONLINE' : 'OFFLINE'}`, 30, 35);
      ctx.fillStyle = nodeConnected ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 34, 68, 0.5)';
      ctx.fillRect(30, 38, 4, 4);

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
    <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
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
    const x = cx + Math.cos(angle) * size;
    const y = cy + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, TWO_PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHUDCorners(ctx, x, y, w, h) {
  const len = 20;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = 1;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
}
