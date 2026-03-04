'use client';
import { useEffect, useRef, useMemo } from 'react';
import { AGENTS } from '@/lib/agents';

const AGENT_LIST = Object.entries(AGENTS);
const TWO_PI = Math.PI * 2;

function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + 'Ã¢â‚¬Â¦' : (str || ''); }

function getPositions(cx, cy, r) {
  const p = {};
  AGENT_LIST.forEach(([name], i) => {
    const a = (i / AGENT_LIST.length) * TWO_PI - Math.PI / 2;
    p[name] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, angle: a };
  });
  return p;
}

const CONNECTIONS = [
  ['echo','flare'],['echo','bolt'],['echo','nexus'],
  ['echo','vigil'],['echo','forge'],
  ['flare','bolt'],['nexus','vigil'],['bolt','nexus'],
  ['vigil','forge'],['forge','flare'],
];

export default function NodeGraph({ agents, nodeConnected, events }) {
  const canvasRef   = useRef(null);
  const animRef     = useRef(null);
  const timeRef     = useRef(0);
  const radarRef    = useRef(0);
  const particlesRef= useRef([]);

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

    const spawnP = (from, to, bcx, bcy, bright) => {
      particlesRef.current.push({
        fx: from.x, fy: from.y, tx: to.x, ty: to.y,
        cx: bcx, cy: bcy,
        t: 0, speed: 0.007 + Math.random() * 0.012,
        bright: bright ?? 0.7, size: 1.5 + Math.random() * 2,
      });
    };

    const draw = () => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const cx = W / 2, cy = H / 2 + 4;
      const R  = Math.min(W, H) * 0.295;
      const t  = timeRef.current;
      timeRef.current += 0.016;
      radarRef.current = (radarRef.current + 0.007) % TWO_PI;

      ctx.clearRect(0, 0, W, H);

      const pos = getPositions(cx, cy, R);

      // Ã¢â€â‚¬Ã¢â€â‚¬ Fine grid background Ã¢â€â‚¬Ã¢â€â‚¬
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 0.5;
      const step = 40;
      for (let gx = cx % step; gx < W; gx += step) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = cy % step; gy < H; gy += step) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Orbital rings Ã¢â€â‚¬Ã¢â€â‚¬
      for (let rr = 1; rr <= 3; rr++) {
        const ringR = R * (0.28 + rr * 0.26);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, TWO_PI);
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.sin(t * 0.4 + rr) * 0.015})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // tick marks
        for (let k = 0; k < 36; k++) {
          const a  = (k / 36) * TWO_PI;
          const m = k % 9 === 0;
          const r1 = ringR - (m ? 4 : 2);
          const r2 = ringR + (m ? 4 : 2);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.strokeStyle = `rgba(255,255,255,${m ? 0.14 : 0.04})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Radar sweep (very faint white) Ã¢â€â‚¬Ã¢â€â‚¬
      const ra = radarRef.current;
      const sl = Math.PI * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.42, ra - sl, ra);
      ctx.closePath();
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.42);
      rg.addColorStop(0, 'transparent');
      rg.addColorStop(0.6, 'rgba(255,255,255,0.025)');
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ra) * R * 1.42, cy + Math.sin(ra) * R * 1.42);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Ã¢â€â‚¬Ã¢â€â‚¬ Bezier connection lines Ã¢â€â‚¬Ã¢â€â‚¬
      CONNECTIONS.forEach(([a, b]) => {
        const pa = pos[a], pb = pos[b];
        if (!pa||!pb) return;
        const aAct = isActive((agentMap[a]||{}).status);
        const bAct = isActive((agentMap[b]||{}).status);
        const both = aAct && bAct;

        const mx = (pa.x+pb.x)/2, my = (pa.y+pb.y)/2;
        const dx = mx-cx, dy = my-cy;
        const d  = Math.sqrt(dx*dx+dy*dy)||1;
        const bcx2 = mx + (dx/d)*R*0.25;
        const bcy2 = my + (dy/d)*R*0.25;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(bcx2, bcy2, pb.x, pb.y);
        if (both) {
          ctx.strokeStyle = `rgba(255,255,255,${0.55+Math.sin(t*2.5)*0.12})`;
          ctx.lineWidth = 1.5;
        } else if (aAct||bAct) {
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 0.8;
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();

        if ((aAct||bAct) && Math.random() < 0.025) {
          spawnP(aAct?pa:pb, aAct?pb:pa, bcx2, bcy2, both?0.9:0.55);
        }
      });

      // Ã¢â€â‚¬Ã¢â€â‚¬ Particles Ã¢â€â‚¬Ã¢â€â‚¬
      particlesRef.current = particlesRef.current.filter(p => {
        p.t += p.speed;
        if (p.t >= 1) return false;
        const pt   = bz(p.t, p.fx,p.fy, p.cx,p.cy, p.tx,p.ty);
        const prev = bz(Math.max(0,p.t-0.1), p.fx,p.fy, p.cx,p.cy, p.tx,p.ty);
        const fade = 1 - p.t;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size*(1-p.t*0.4), 0, TWO_PI);
        ctx.fillStyle = `rgba(255,255,255,${fade*p.bright})`;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = `rgba(255,255,255,${fade*p.bright*0.4})`;
        ctx.lineWidth = p.size * 0.55;
        ctx.stroke();
        return true;
      });

      // Ã¢â€â‚¬Ã¢â€â‚¬ CORE node Ã¢â€â‚¬Ã¢â€â‚¬
      const cAlpha = nodeConnected ? 1 : 0.4;

      // pulse rings
      if (nodeConnected) {
        for (let p = 0; p < 3; p++) {
          const pt = ((t*0.45)+p*0.33)%1;
          ctx.beginPath();
          ctx.arc(cx, cy, 32+pt*R*0.45, 0, TWO_PI);
          ctx.strokeStyle = `rgba(255,255,255,${(1-pt)*0.07})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // outer accent ring
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, TWO_PI);
      ctx.strokeStyle = `rgba(255,255,255,${(0.18+Math.sin(t)*0.06)*cAlpha})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // glow fill
      const cgrd = ctx.createRadialGradient(cx,cy,0,cx,cy,40);
      cgrd.addColorStop(0, `rgba(255,255,255,${0.12*cAlpha})`);
      cgrd.addColorStop(0.5,`rgba(255,255,255,${0.04*cAlpha})`);
      cgrd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx,cy,40,0,TWO_PI);
      ctx.fillStyle = cgrd; ctx.fill();

      // main circle
      ctx.beginPath(); ctx.arc(cx,cy,28,0,TWO_PI);
      ctx.fillStyle   = '#000';
      ctx.strokeStyle = `rgba(255,255,255,${0.80*cAlpha})`;
      ctx.lineWidth   = 1.8;
      ctx.fill(); ctx.stroke();

      // hex icon
      ctx.beginPath();
      for (let i=0;i<6;i++){
        const a=(i/6)*TWO_PI-Math.PI/6;
        if(i===0) ctx.moveTo(cx+Math.cos(a)*12,cy+Math.sin(a)*12);
        else ctx.lineTo(cx+Math.cos(a)*12,cy+Math.sin(a)*12);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255,255,255,${0.70*cAlpha})`;
      ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,3,0,TWO_PI);
      ctx.fillStyle = `rgba(255,255,255,${0.90*cAlpha})`; ctx.fill();

      // core labels
      ctx.font = '700 8px Orbitron, sans-serif';
      ctx.fillStyle = `rgba(255,255,255,${0.80*cAlpha})`;
      ctx.textAlign = 'center';
      ctx.fillText('OPENCLAW', cx, cy+48);
      ctx.font = '400 7px JetBrains Mono, monospace';
      ctx.fillStyle = `rgba(255,255,255,${0.35*cAlpha})`;
      ctx.fillText('CORE Ã‚Â· GATEWAY', cx, cy+59);
      ctx.font = '400 6.5px JetBrains Mono, monospace';
      ctx.fillStyle = nodeConnected ? 'rgba(74,222,128,0.70)' : 'rgba(248,113,113,0.70)';
      ctx.fillText(nodeConnected ? 'Ã¢â€”Â EC2 CONNECTED' : 'Ã¢â€”Â EC2 OFFLINE', cx, cy+70);

      // Ã¢â€â‚¬Ã¢â€â‚¬ Agent nodes Ã¢â€â‚¬Ã¢â€â‚¬
      AGENT_LIST.forEach(([name]) => {
        const p   = pos[name];
        const d   = agentMap[name] || {};
        const st  = (d.status||'idle').toLowerCase();
        const act = isActive(st);
        const err = st === 'error';
        const nodeR = 23;

        // determine whiteness
        const gBright = err ? 0 : act ? 1.0 : 0.25;
        const strokeAlpha = err ? 0 : act ? 0.85 : 0.20;
        const nodeCol = err ? '#f87171' : `rgba(255,255,255,${strokeAlpha})`;

        // coreÃ¢â€ â€™agent line
        ctx.beginPath();
        ctx.moveTo(cx,cy); ctx.lineTo(p.x,p.y);
        ctx.strokeStyle = act
          ? `rgba(255,255,255,${0.22+Math.sin(t*3+p.angle)*0.07})`
          : 'rgba(255,255,255,0.04)';
        ctx.lineWidth = act ? 1.2 : 0.5;
        ctx.setLineDash(act ? [] : [3, 5]);
        ctx.stroke(); ctx.setLineDash([]);

        // spawn coreÃ¢â€ â€™agent particles when active
        if (act && Math.random() < 0.018) {
          const mid = { x:(cx+p.x)/2, y:(cy+p.y)/2 };
          spawnP({x:cx,y:cy}, p, mid.x, mid.y, 0.60);
        }

        // pulsing status ring
        if (act) {
          const pr = nodeR + 6 + Math.sin(t*3+p.angle)*2;
          ctx.beginPath(); ctx.arc(p.x,p.y,pr,0,TWO_PI);
          ctx.strokeStyle = `rgba(255,255,255,${0.22+Math.sin(t*3+p.angle)*0.10})`;
          ctx.lineWidth = 1.2; ctx.stroke();
        }
        if (err) {
          ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+5,0,TWO_PI);
          ctx.strokeStyle = `rgba(248,113,113,${0.40+Math.sin(t*4)*0.15})`;
          ctx.lineWidth=1; ctx.stroke();
        }

        // glow halo
        const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,nodeR+10);
        g.addColorStop(0, act ? `rgba(255,255,255,0.12)` : err ? 'rgba(248,113,113,0.10)' : 'transparent');
        g.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+10,0,TWO_PI);
        ctx.fillStyle=g; ctx.fill();

        // node circle
        ctx.beginPath(); ctx.arc(p.x,p.y,nodeR,0,TWO_PI);
        ctx.fillStyle='#000';
        ctx.strokeStyle= nodeCol;
        ctx.lineWidth = act||err ? 2.2 : 1;
        ctx.fill(); ctx.stroke();

        // circular health arc
        const hp = err ? 0.12 : act ? 0.80+Math.sin(t+p.angle)*0.12 : 0.40;
        ctx.beginPath();
        ctx.arc(p.x,p.y,nodeR+3,-Math.PI/2,-Math.PI/2+hp*TWO_PI);
        ctx.strokeStyle = err ? '#f87171' : act ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth=2; ctx.lineCap='round';
        ctx.globalAlpha = act||err ? 0.80 : 0.25;
        ctx.stroke(); ctx.globalAlpha=1; ctx.lineCap='butt';

        // icon
        ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.globalAlpha = act ? 1.0 : err ? 0.6 : 0.30;
        ctx.fillText(AGENTS[name]?.icon||'?', p.x, p.y);
        ctx.globalAlpha=1; ctx.textBaseline='alphabetic';

        // name
        const ly = p.y+nodeR+15;
        ctx.font='700 8.5px Orbitron, sans-serif';
        ctx.fillStyle= act ? 'rgba(255,255,255,0.88)' : err ? '#f87171' : 'rgba(255,255,255,0.28)';
        ctx.textAlign='center';
        ctx.fillText(name.toUpperCase(), p.x, ly);

        // role
        ctx.font='400 6.5px JetBrains Mono, monospace';
        ctx.fillStyle= act ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
        ctx.fillText(AGENTS[name]?.role||'', p.x, ly+11);

        // status
        ctx.font='600 7px JetBrains Mono, monospace';
        ctx.fillStyle= err ? '#f87171' : act ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)';
        ctx.fillText(st.toUpperCase(), p.x, ly+22);

        // task
        if (act && d.current_task) {
          ctx.font='400 6px JetBrains Mono, monospace';
          ctx.fillStyle='rgba(255,255,255,0.40)';
          ctx.fillText(truncate(d.current_task,20), p.x, ly+33);
        }

        // status dot top-right
        ctx.beginPath(); ctx.arc(p.x+nodeR*0.68, p.y-nodeR*0.68, 3.5, 0, TWO_PI);
        ctx.fillStyle= err ? '#f87171' : act ? 'rgba(74,222,128,0.90)' : 'rgba(255,255,255,0.18)';
        ctx.fill();
      });

      // Ã¢â€â‚¬Ã¢â€â‚¬ HUD corner brackets Ã¢â€â‚¬Ã¢â€â‚¬
      const len=20;
      ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
      [[14,14,1,1],[W-14,14,-1,1],[14,H-14,1,-1],[W-14,H-14,-1,-1]].forEach(([x,y,sx,sy])=>{
        ctx.beginPath();
        ctx.moveTo(x,y+sy*len); ctx.lineTo(x,y); ctx.lineTo(x+sx*len,y);
        ctx.stroke();
      });

      // Ã¢â€â‚¬Ã¢â€â‚¬ HUD text overlays Ã¢â€â‚¬Ã¢â€â‚¬
      ctx.font='400 8px JetBrains Mono, monospace';
      ctx.fillStyle='rgba(255,255,255,0.30)';
      ctx.textAlign='left';
      ctx.fillText(`T:${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`, 22, H-20);
      const ac=AGENT_LIST.filter(([n])=>isActive((agentMap[n]?.status||''))).length;
      ctx.textAlign='right';
      ctx.fillText(`${ac}/${AGENT_LIST.length} ONLINE`, W-22, H-20);
      ctx.fillStyle='rgba(255,255,255,0.16)'; ctx.font='400 7px JetBrains Mono, monospace';
      ctx.fillText('OPENCLAW Ã‚Â· NEURAL MAP', W-22, 26);

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
