'use client';
import { useEffect, useRef, useMemo } from 'react';
import { AGENTS } from '@/lib/agents';

const AGENT_LIST = Object.entries(AGENTS);
const TWO_PI = Math.PI * 2;

function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + '...' : (str || ''); }

function getPositions(W, H) {
  return {
    echo:  { x: W * 0.20, y: H * 0.40 },
    flare: { x: W * 0.50, y: H * 0.40 },
    bolt:  { x: W * 0.80, y: H * 0.40 },
    nexus: { x: W * 0.20, y: H * 0.75 },
    vigil: { x: W * 0.50, y: H * 0.75 },
    forge: { x: W * 0.80, y: H * 0.75 },
    CORE:  { x: W * 0.50, y: H * 0.12 },
  };
}

const CONNECTIONS = [
  ['CORE','echo'], ['CORE','flare'], ['CORE','bolt'],
  ['echo','nexus'], ['flare','vigil'], ['bolt','forge'],
  ['echo','flare'], ['flare','bolt'],
  ['nexus','vigil'], ['vigil','forge'],
  ['echo','vigil'], ['bolt','nexus'],
];

function hexRgb(hex) {
  const h = hex.replace('#','');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function rgba(hex, a) {
  const { r, g, b } = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export default function NodeGraph({ agents, nodeConnected, events }) {
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const timeRef      = useRef(0);
  const particlesRef = useRef([]);
  const burstRef     = useRef([]);
  const lastEvRef    = useRef(0);

  const agentMap = useMemo(() => {
    const m = {};
    (agents || []).forEach(a => { m[a.name] = a; });
    return m;
  }, [agents]);

  const recentEvents = useMemo(() => (events || []).slice(-20), [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r   = canvas.getBoundingClientRect();
      canvas.width  = r.width  * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const bz = (t, x0, y0, x1, y1, x2, y2) => {
      const m = 1 - t;
      return { x: m*m*x0 + 2*m*t*x1 + t*t*x2, y: m*m*y0 + 2*m*t*y1 + t*t*y2 };
    };

    const spawnP = (from, to, cpx, cpy, color, bright = 0.85) => {
      particlesRef.current.push({
        fx: from.x, fy: from.y, tx: to.x, ty: to.y,
        cx: cpx, cy: cpy,
        t: 0, speed: 0.008 + Math.random() * 0.014,
        bright, size: 2.0 + Math.random() * 2.5, color,
      });
    };

    const draw = () => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const t  = timeRef.current;
      timeRef.current += 0.016;

      ctx.clearRect(0, 0, W, H);
      const pos = getPositions(W, H);
      const corePt = pos.CORE;
      const cx = corePt.x, cy = corePt.y;

      // dot grid background
      const step = 36;
      for (let gx = step/2; gx < W; gx += step) {
        for (let gy = step/2; gy < H; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.7, 0, TWO_PI);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fill();
        }
      }

      // horizontal tier separator lines
      [0.40, 0.75].forEach(yPct => {
        const y = H * yPct;
        ctx.beginPath(); ctx.moveTo(W*0.06, y); ctx.lineTo(W*0.94, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.8; ctx.setLineDash([6,10]);
        ctx.stroke(); ctx.setLineDash([]);
      });

      // tier labels
      ctx.font = '500 7px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillText('TIER-1  LEAD AGENTS', W*0.06, H*0.40 - 10);
      ctx.fillText('TIER-2  EXEC AGENTS', W*0.06, H*0.75 - 10);

      // detect new events -> burst animation
      if (recentEvents.length > lastEvRef.current) {
        const newEvs = recentEvents.slice(lastEvRef.current);
        newEvs.forEach(ev => {
          const agentName = (ev.agent || '').toLowerCase();
          const aCol = AGENTS[agentName]?.color || '#ffffff';
          if (pos[agentName]) burstRef.current.push({ node: agentName, t: 0, color: aCol });
          burstRef.current.push({ node: 'CORE', t: 0, color: '#ffffff' });
        });
        lastEvRef.current = recentEvents.length;
      }

      // draw connections
      CONNECTIONS.forEach(([a, b]) => {
        const pa = pos[a], pb = pos[b];
        if (!pa || !pb) return;
        const isCore = a === 'CORE' || b === 'CORE';
        const agName = a === 'CORE' ? b : a;
        const agCol  = AGENTS[agName]?.color || '#ffffff';
        const aAct   = a === 'CORE' ? nodeConnected : isActive((agentMap[a]||{}).status);
        const bAct   = b === 'CORE' ? nodeConnected : isActive((agentMap[b]||{}).status);
        const either = aAct || bAct;
        const both   = aAct && bAct;

        const mx = (pa.x+pb.x)/2, my = (pa.y+pb.y)/2;
        const cpx = mx + (isCore ? 0 : (pa.x < pb.x ? -18 : 18));
        const cpy = my + (isCore ? (pb.y - pa.y)*0.28 : 0);

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(cpx, cpy, pb.x, pb.y);

        if (both) {
          const gr = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
          gr.addColorStop(0, rgba(agCol, 0.72 + Math.sin(t*2.5)*0.12));
          gr.addColorStop(1, rgba(agCol, 0.48 + Math.sin(t*2.5)*0.10));
          ctx.strokeStyle = gr; ctx.lineWidth = 2.4;
        } else if (either) {
          ctx.strokeStyle = rgba(agCol, 0.35); ctx.lineWidth = 1.3;
        } else {
          ctx.strokeStyle = rgba(agCol, 0.09); ctx.lineWidth = 0.7;
          ctx.setLineDash([4,8]);
        }
        ctx.stroke(); ctx.setLineDash([]);

        if (either && Math.random() < (both ? 0.05 : 0.02)) {
          const from = aAct ? pa : pb;
          const to   = aAct ? pb : pa;
          spawnP(from, to, cpx, cpy, agCol, both ? 1.0 : 0.65);
        }
      });

      // draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.t += p.speed;
        if (p.t >= 1) return false;
        const pt   = bz(p.t, p.fx,p.fy, p.cx,p.cy, p.tx,p.ty);
        const prev = bz(Math.max(0, p.t-0.09), p.fx,p.fy, p.cx,p.cy, p.tx,p.ty);
        const fade = Math.sin(p.t * Math.PI);

        const glowR = p.size * 3;
        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
        grd.addColorStop(0, rgba(p.color, fade * p.bright * 0.8));
        grd.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(pt.x, pt.y, glowR, 0, TWO_PI);
        ctx.fillStyle = grd; ctx.fill();

        ctx.beginPath(); ctx.arc(pt.x, pt.y, p.size*(1-p.t*0.3), 0, TWO_PI);
        ctx.fillStyle = rgba(p.color, fade * p.bright); ctx.fill();

        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = rgba(p.color, fade * p.bright * 0.45);
        ctx.lineWidth = p.size * 0.6; ctx.stroke();
        return true;
      });

      // draw event bursts
      burstRef.current = burstRef.current.filter(b => {
        b.t += 0.018;
        if (b.t >= 1) return false;
        const np = pos[b.node];
        if (!np) return false;
        const fade = 1 - b.t;
        const r = 28 + b.t * 60;
        ctx.beginPath(); ctx.arc(np.x, np.y, r, 0, TWO_PI);
        ctx.strokeStyle = rgba(b.color, fade * 0.55);
        ctx.lineWidth = 2.5 * fade; ctx.stroke();
        return true;
      });

      // CORE node
      const cAlpha = nodeConnected ? 1.0 : 0.38;
      if (nodeConnected) {
        for (let pi = 0; pi < 3; pi++) {
          const pf = ((t*0.5) + pi*0.33) % 1;
          ctx.beginPath(); ctx.arc(cx, cy, 26+pf*55, 0, TWO_PI);
          ctx.strokeStyle = `rgba(255,255,255,${(1-pf)*0.09*cAlpha})`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.arc(cx, cy, 38, 0, TWO_PI);
      ctx.strokeStyle = `rgba(255,255,255,${(0.22+Math.sin(t)*0.06)*cAlpha})`;
      ctx.lineWidth = 1.5; ctx.stroke();

      const cgrd = ctx.createRadialGradient(cx,cy,0,cx,cy,44);
      cgrd.addColorStop(0, `rgba(255,255,255,${0.22*cAlpha})`);
      cgrd.addColorStop(0.5,`rgba(255,255,255,${0.07*cAlpha})`);
      cgrd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx,cy,44,0,TWO_PI); ctx.fillStyle=cgrd; ctx.fill();

      ctx.beginPath(); ctx.arc(cx,cy,26,0,TWO_PI);
      ctx.fillStyle='#050505';
      ctx.strokeStyle=`rgba(255,255,255,${0.90*cAlpha})`;
      ctx.lineWidth=2.2; ctx.fill(); ctx.stroke();

      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=(i/6)*TWO_PI-Math.PI/6;
        if(i===0) ctx.moveTo(cx+Math.cos(a)*11,cy+Math.sin(a)*11);
        else       ctx.lineTo(cx+Math.cos(a)*11,cy+Math.sin(a)*11);
      }
      ctx.closePath();
      ctx.strokeStyle=`rgba(255,255,255,${0.75*cAlpha})`; ctx.lineWidth=1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,3,0,TWO_PI);
      ctx.fillStyle=`rgba(255,255,255,${0.95*cAlpha})`; ctx.fill();

      ctx.font='700 9px Orbitron, sans-serif';
      ctx.fillStyle=`rgba(255,255,255,${0.90*cAlpha})`;
      ctx.textAlign='center';
      ctx.fillText('OPENCLAW', cx, cy+42);
      ctx.font='400 7px JetBrains Mono, monospace';
      ctx.fillStyle=`rgba(255,255,255,${0.38*cAlpha})`;
      ctx.fillText('CORE  GATEWAY', cx, cy+53);
      ctx.font='600 7.5px JetBrains Mono, monospace';
      ctx.fillStyle=nodeConnected?'rgba(74,222,128,0.90)':'rgba(248,113,113,0.80)';
      ctx.fillText(nodeConnected?'EC2 LIVE':'EC2 OFFLINE', cx, cy+65);

      // agent nodes
      AGENT_LIST.forEach(([name]) => {
        const p   = pos[name];
        if (!p) return;
        const d   = agentMap[name] || {};
        const st  = (d.status||'idle').toLowerCase();
        const act = isActive(st);
        const err = st === 'error';
        const col = AGENTS[name]?.color || '#ffffff';
        const nodeR = 27;
        const alpha = err ? 0.95 : act ? 1.0 : 0.30;

        if (act) {
          const pr = nodeR+7+Math.sin(t*3+p.x)*2.5;
          ctx.beginPath(); ctx.arc(p.x,p.y,pr,0,TWO_PI);
          ctx.strokeStyle=rgba(col, 0.32+Math.sin(t*2.8+p.x)*0.10);
          ctx.lineWidth=1.8; ctx.stroke();
        }
        if (err) {
          ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+6,0,TWO_PI);
          ctx.strokeStyle=`rgba(248,113,113,${0.45+Math.sin(t*5)*0.15})`;
          ctx.lineWidth=1.4; ctx.stroke();
        }

        const glowSz = act ? nodeR+20 : nodeR+8;
        const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,glowSz);
        g.addColorStop(0, rgba(col, act?0.25:err?0.15:0.04));
        g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(p.x,p.y,glowSz,0,TWO_PI); ctx.fillStyle=g; ctx.fill();

        const bg = ctx.createRadialGradient(p.x-4,p.y-4,0,p.x,p.y,nodeR);
        bg.addColorStop(0, rgba(col, act?0.16:0.04));
        bg.addColorStop(1, 'rgba(0,0,0,0.93)');
        ctx.beginPath(); ctx.arc(p.x,p.y,nodeR,0,TWO_PI);
        ctx.fillStyle=bg;
        ctx.strokeStyle=rgba(col, alpha*(act?0.95:err?0.90:0.38));
        ctx.lineWidth=act||err?2.6:1.2; ctx.fill(); ctx.stroke();

        const hp = err?0.10:act?0.75+Math.sin(t*2+p.x*0.05)*0.22:0.35;
        ctx.beginPath();
        ctx.arc(p.x,p.y,nodeR+4,-Math.PI/2,-Math.PI/2+hp*TWO_PI);
        ctx.strokeStyle=rgba(col, act?0.85:err?0.55:0.20);
        ctx.lineWidth=3; ctx.lineCap='round'; ctx.stroke(); ctx.lineCap='butt';

        ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.globalAlpha=act?1.0:err?0.65:0.40;
        ctx.fillText(AGENTS[name]?.icon||'?', p.x, p.y);
        ctx.globalAlpha=1; ctx.textBaseline='alphabetic';

        const ly = p.y+nodeR+17;
        ctx.font='700 9px Orbitron, sans-serif';
        ctx.fillStyle=act?col:err?'#f87171':rgba(col,0.35);
        ctx.textAlign='center';
        ctx.fillText(name.toUpperCase(), p.x, ly);

        ctx.font='400 6.5px JetBrains Mono, monospace';
        ctx.fillStyle=act?rgba(col,0.55):'rgba(255,255,255,0.18)';
        ctx.fillText(AGENTS[name]?.role||'', p.x, ly+12);

        ctx.font='600 7.5px JetBrains Mono, monospace';
        ctx.fillStyle=err?'#f87171':act?rgba(col,0.92):'rgba(255,255,255,0.22)';
        ctx.fillText(st.toUpperCase(), p.x, ly+24);

        if (act && d.current_task) {
          ctx.font='400 6.5px JetBrains Mono, monospace';
          ctx.fillStyle=rgba(col,0.55);
          ctx.fillText(truncate(d.current_task,22), p.x, ly+36);
        }

        ctx.beginPath(); ctx.arc(p.x+nodeR*0.70, p.y-nodeR*0.70, 4.5, 0, TWO_PI);
        ctx.fillStyle=err?'#f87171':act?col:'rgba(255,255,255,0.18)'; ctx.fill();
        if (act) {
          ctx.beginPath(); ctx.arc(p.x+nodeR*0.70, p.y-nodeR*0.70, 8, 0, TWO_PI);
          ctx.fillStyle=rgba(col, 0.28+Math.sin(t*4)*0.12); ctx.fill();
        }
      });

      // HUD corners
      ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
      const bl=18;
      [[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(([x,y,sx,sy])=>{
        ctx.beginPath(); ctx.moveTo(x,y+sy*bl); ctx.lineTo(x,y); ctx.lineTo(x+sx*bl,y); ctx.stroke();
      });

      const timeStr = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
      const activeCt = AGENT_LIST.filter(([n])=>isActive((agentMap[n]?.status||''))).length;
      ctx.font='400 8px JetBrains Mono, monospace';
      ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,0.35)';
      ctx.fillText(`T: ${timeStr}`, 20, H-18);
      ctx.textAlign='right';
      ctx.fillStyle=activeCt>0?'rgba(74,222,128,0.80)':'rgba(255,255,255,0.25)';
      ctx.fillText(`${activeCt}/${AGENT_LIST.length} ACTIVE`, W-20, H-18);
      ctx.font='400 7px JetBrains Mono, monospace';
      ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.fillText('OPENCLAW  COMMAND TOPOLOGY', W-20, 22);

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
    <div className="relative w-full h-full min-h-[360px]">
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}

function isActive(s) {
  const v = (s||'').toLowerCase();
  return v==='working'||v==='thinking'||v==='talking'||v==='posting'||v==='researching'||v==='monitoring';
}
