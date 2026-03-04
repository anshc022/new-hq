'use client';
import { useEffect, useRef, useMemo } from 'react';
import { AGENTS } from '@/lib/agents';

const AGENT_LIST = Object.entries(AGENTS);
const TWO_PI = Math.PI * 2;

function wrap(str, maxW, ctx) {
  if (!str) return [];
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur); cur = w;
    } else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines;
}

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
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

export default function NodeGraph({ agents, nodeConnected, events }) {
  const canvasRef      = useRef(null);
  const animRef        = useRef(null);
  const timeRef        = useRef(0);
  const particlesRef   = useRef([]);
  const burstRef       = useRef([]);
  const lastEvRef      = useRef(0);
  const taskStartRef   = useRef({});  // { agentName: { task, startT } }

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

    const spawnP = (from, to, cpx, cpy, color, bright = 0.95) => {
      particlesRef.current.push({
        fx: from.x, fy: from.y, tx: to.x, ty: to.y,
        cx: cpx, cy: cpy,
        t: 0, speed: 0.009 + Math.random() * 0.016,
        bright, size: 2.2 + Math.random() * 2.8, color,
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

      // ── Ambient background glow from active agents ──
      AGENT_LIST.forEach(([name]) => {
        const p = pos[name];
        if (!p) return;
        const d  = agentMap[name] || {};
        const act = isActive((d.status||'').toLowerCase());
        if (!act) return;
        const col = AGENTS[name]?.color || '#ffffff';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 120);
        g.addColorStop(0, rgba(col, 0.12 + Math.sin(t*1.5+p.x)*0.04));
        g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(p.x, p.y, 120, 0, TWO_PI);
        ctx.fillStyle = g; ctx.fill();
      });

      // ── Bright dot grid ──
      const step = 32;
      for (let gx = step/2; gx < W; gx += step) {
        for (let gy = step/2; gy < H; gy += step) {
          ctx.beginPath(); ctx.arc(gx, gy, 0.9, 0, TWO_PI);
          ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fill();
        }
      }

      // ── Tier separator lines ──
      [0.40, 0.75].forEach((yPct, i) => {
        const y = H * yPct;
        ctx.beginPath(); ctx.moveTo(W*0.05, y); ctx.lineTo(W*0.95, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1; ctx.setLineDash([6,10]);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '600 8px JetBrains Mono, monospace';
        ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText(`TIER-${i+1}  ${i===0?'LEAD':'EXEC'} AGENTS`, W*0.05, H*yPct - 8);
      });

      // ── Detect new events → burst ──
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

      // ── Track task start times ──
      AGENT_LIST.forEach(([name]) => {
        const d = agentMap[name] || {};
        const task = d.current_task || null;
        const act  = isActive((d.status||'').toLowerCase());
        const ts   = taskStartRef.current;
        if (act && task) {
          if (!ts[name] || ts[name].task !== task) {
            ts[name] = { task, startT: t };
          }
        } else {
          if (ts[name]) delete ts[name];
        }
      });

      // ── Draw connections ──
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
        const cpx = mx + (isCore ? 0 : (pa.x < pb.x ? -22 : 22));
        const cpy = my + (isCore ? (pb.y - pa.y)*0.28 : 0);

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(cpx, cpy, pb.x, pb.y);

        if (both) {
          const gr = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
          gr.addColorStop(0, rgba(agCol, 0.90 + Math.sin(t*2.5)*0.08));
          gr.addColorStop(0.5, rgba(agCol, 1.0));
          gr.addColorStop(1, rgba(agCol, 0.70 + Math.sin(t*2.5)*0.08));
          ctx.strokeStyle = gr; ctx.lineWidth = 3.0;
        } else if (either) {
          ctx.strokeStyle = rgba(agCol, 0.55); ctx.lineWidth = 1.8;
        } else {
          ctx.strokeStyle = rgba(agCol, 0.14); ctx.lineWidth = 0.9;
          ctx.setLineDash([5,10]);
        }
        ctx.stroke(); ctx.setLineDash([]);

        // Shadow/glow for active lines
        if (both) {
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo(cpx, cpy, pb.x, pb.y);
          ctx.strokeStyle = rgba(agCol, 0.25); ctx.lineWidth = 8; ctx.stroke();
        }

        if (either && Math.random() < (both ? 0.07 : 0.03)) {
          const from = aAct ? pa : pb;
          const to   = aAct ? pb : pa;
          spawnP(from, to, cpx, cpy, agCol, both ? 1.0 : 0.75);
        }
      });

      // ── Particles ──
      particlesRef.current = particlesRef.current.filter(p => {
        p.t += p.speed;
        if (p.t >= 1) return false;
        const pt   = bz(p.t, p.fx,p.fy, p.cx,p.cy, p.tx,p.ty);
        const prev = bz(Math.max(0, p.t-0.08), p.fx,p.fy, p.cx,p.cy, p.tx,p.ty);
        const fade = Math.sin(p.t * Math.PI);
        const glowR = p.size * 4;
        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
        grd.addColorStop(0, rgba(p.color, fade * p.bright));
        grd.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(pt.x, pt.y, glowR, 0, TWO_PI); ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(pt.x, pt.y, p.size*(1-p.t*0.3), 0, TWO_PI);
        ctx.fillStyle = rgba(p.color, Math.min(1, fade * p.bright * 1.2)); ctx.fill();
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = rgba(p.color, fade * p.bright * 0.6);
        ctx.lineWidth = p.size * 0.7; ctx.stroke();
        return true;
      });

      // ── Event bursts ──
      burstRef.current = burstRef.current.filter(b => {
        b.t += 0.016;
        if (b.t >= 1) return false;
        const np = pos[b.node]; if (!np) return false;
        const fade = 1 - b.t;
        for (let ri = 0; ri < 2; ri++) {
          const r = 24 + (b.t + ri*0.2) * 80;
          ctx.beginPath(); ctx.arc(np.x, np.y, r, 0, TWO_PI);
          ctx.strokeStyle = rgba(b.color, fade * (ri===0 ? 0.7 : 0.3));
          ctx.lineWidth = (3 - ri) * fade; ctx.stroke();
        }
        return true;
      });

      // ── CORE node ──
      const cAlpha = nodeConnected ? 1.0 : 0.45;
      if (nodeConnected) {
        for (let pi = 0; pi < 4; pi++) {
          const pf = ((t*0.45) + pi*0.25) % 1;
          ctx.beginPath(); ctx.arc(cx, cy, 26+pf*65, 0, TWO_PI);
          ctx.strokeStyle = `rgba(255,255,255,${(1-pf)*0.14*cAlpha})`;
          ctx.lineWidth = 2; ctx.stroke();
        }
      }
      // Strong outer ring
      ctx.beginPath(); ctx.arc(cx, cy, 40, 0, TWO_PI);
      ctx.strokeStyle = `rgba(255,255,255,${(0.55+Math.sin(t)*0.12)*cAlpha})`;
      ctx.lineWidth = 2.0; ctx.stroke();
      // Glow shadow
      const cshadow = ctx.createRadialGradient(cx,cy,0,cx,cy,55);
      cshadow.addColorStop(0, `rgba(255,255,255,${0.30*cAlpha})`);
      cshadow.addColorStop(0.4,`rgba(255,255,255,${0.10*cAlpha})`);
      cshadow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx,cy,55,0,TWO_PI); ctx.fillStyle=cshadow; ctx.fill();
      // Node body
      ctx.beginPath(); ctx.arc(cx,cy,27,0,TWO_PI);
      ctx.fillStyle='#080808';
      ctx.strokeStyle=`rgba(255,255,255,${0.95*cAlpha})`;
      ctx.lineWidth=2.5; ctx.fill(); ctx.stroke();
      // Hex
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a=(i/6)*TWO_PI-Math.PI/6;
        if(i===0) ctx.moveTo(cx+Math.cos(a)*12,cy+Math.sin(a)*12);
        else       ctx.lineTo(cx+Math.cos(a)*12,cy+Math.sin(a)*12);
      }
      ctx.closePath();
      ctx.strokeStyle=`rgba(255,255,255,${0.88*cAlpha})`; ctx.lineWidth=1.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,3.5,0,TWO_PI);
      ctx.fillStyle=`rgba(255,255,255,${cAlpha})`; ctx.fill();
      // Labels
      ctx.font='700 10px Orbitron, sans-serif';
      ctx.fillStyle=`rgba(255,255,255,${0.95*cAlpha})`;
      ctx.textAlign='center';
      ctx.fillText('OPENCLAW', cx, cy+46);
      ctx.font='500 7.5px JetBrains Mono, monospace';
      ctx.fillStyle=`rgba(255,255,255,${0.50*cAlpha})`;
      ctx.fillText('CORE  GATEWAY', cx, cy+58);
      ctx.font='700 8px JetBrains Mono, monospace';
      ctx.fillStyle=nodeConnected?'rgba(74,222,128,1.0)':'rgba(248,113,113,0.95)';
      ctx.fillText(nodeConnected?'  EC2 LIVE':'  EC2 OFFLINE', cx, cy+70);

      // ── AGENT NODES ──
      AGENT_LIST.forEach(([name]) => {
        const p   = pos[name];
        if (!p) return;
        const d   = agentMap[name] || {};
        const st  = (d.status||'idle').toLowerCase();
        const act = isActive(st);
        const err = st === 'error';
        const col = AGENTS[name]?.color || '#ffffff';
        const nodeR = 28;
        const alpha = err ? 1.0 : act ? 1.0 : 0.38;
        const ts    = taskStartRef.current[name];

        // ── Ambient glow layer ──
        if (act) {
          const gBig = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,nodeR+40);
          gBig.addColorStop(0, rgba(col, 0.35+Math.sin(t*2+p.x)*0.08));
          gBig.addColorStop(0.5, rgba(col, 0.12));
          gBig.addColorStop(1, 'transparent');
          ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+40,0,TWO_PI); ctx.fillStyle=gBig; ctx.fill();
        }

        // ── Outer pulsing ring ──
        if (act) {
          for (let ri=0; ri<2; ri++) {
            const pr = nodeR + 8 + ri*8 + Math.sin(t*3+p.x+ri)*3;
            ctx.beginPath(); ctx.arc(p.x,p.y,pr,0,TWO_PI);
            ctx.strokeStyle=rgba(col, (0.5-ri*0.2)+Math.sin(t*2.8+p.x)*0.12);
            ctx.lineWidth=2.0-ri*0.5; ctx.stroke();
          }
        }
        if (err) {
          ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+7,0,TWO_PI);
          ctx.strokeStyle=`rgba(248,113,113,${0.6+Math.sin(t*5)*0.2})`;
          ctx.lineWidth=2; ctx.stroke();
        }

        // ── Node body ──
        const bg = ctx.createRadialGradient(p.x-5,p.y-5,0,p.x,p.y,nodeR);
        bg.addColorStop(0, rgba(col, act ? 0.28 : 0.06));
        bg.addColorStop(0.6, rgba(col, act ? 0.10 : 0.02));
        bg.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.beginPath(); ctx.arc(p.x,p.y,nodeR,0,TWO_PI);
        ctx.fillStyle=bg;
        ctx.strokeStyle=rgba(col, alpha*(act ? 1.0 : err ? 0.95 : 0.45));
        ctx.lineWidth=act||err ? 3.0 : 1.5; ctx.fill(); ctx.stroke();

        // ── TASK PROGRESS ARC ──
        // Outer track
        ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+5,0,TWO_PI);
        ctx.strokeStyle=rgba(col, 0.12); ctx.lineWidth=4; ctx.stroke();
        // Progress fill
        let prog = 0;
        if (act && ts) {
          const elapsed = t - ts.startT;
          prog = Math.min(0.98, (elapsed % 120) / 120); // 120s cycle
        } else if (act) {
          prog = (t * 0.008) % 1;
        }
        if (act || prog > 0) {
          const startA = -Math.PI/2;
          const endA   = startA + prog * TWO_PI;
          // Glow shadow behind arc
          ctx.shadowColor = col;
          ctx.shadowBlur  = 8;
          ctx.beginPath(); ctx.arc(p.x,p.y,nodeR+5,startA,endA);
          ctx.strokeStyle=rgba(col, act ? 1.0 : 0.40);
          ctx.lineWidth=4; ctx.lineCap='round'; ctx.stroke();
          ctx.lineCap='butt'; ctx.shadowBlur=0; ctx.shadowColor='transparent';

          // Animated leading dot at arc tip
          if (act) {
            const dotX = p.x + Math.cos(endA) * (nodeR+5);
            const dotY = p.y + Math.sin(endA) * (nodeR+5);
            ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, TWO_PI);
            ctx.fillStyle = col;
            ctx.shadowColor = col; ctx.shadowBlur = 14;
            ctx.fill(); ctx.shadowBlur=0; ctx.shadowColor='transparent';
          }
        }

        // ── Percent label inside arc ──
        if (act) {
          const pct = Math.round(prog * 100);
          ctx.font = '700 8px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = rgba(col, 0.90);
          ctx.fillText(`${pct}%`, p.x, p.y - nodeR - 12);
        }

        // ── Icon ──
        ctx.font='20px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.globalAlpha=act?1.0:err?0.70:0.45;
        ctx.shadowColor = act ? col : 'transparent';
        ctx.shadowBlur  = act ? 10 : 0;
        ctx.fillText(AGENTS[name]?.icon||'?', p.x, p.y);
        ctx.globalAlpha=1; ctx.textBaseline='alphabetic';
        ctx.shadowBlur=0; ctx.shadowColor='transparent';

        // ── Labels ──
        const ly = p.y + nodeR + 22;
        // Name (bright + colored when active)
        ctx.font = '700 10px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        if (act) {
          ctx.shadowColor = col; ctx.shadowBlur = 10;
          ctx.fillStyle = col;
        } else {
          ctx.fillStyle = err ? '#f87171' : rgba(col, 0.45);
        }
        ctx.fillText(name.toUpperCase(), p.x, ly);
        ctx.shadowBlur=0; ctx.shadowColor='transparent';

        // Role
        ctx.font='400 7px JetBrains Mono, monospace';
        ctx.fillStyle=act?rgba(col,0.65):'rgba(255,255,255,0.25)';
        ctx.fillText(AGENTS[name]?.role||'', p.x, ly+13);

        // Status
        ctx.font='700 8px JetBrains Mono, monospace';
        ctx.fillStyle=err?'#f87171':act?rgba(col,1.0):'rgba(255,255,255,0.28)';
        if (act) { ctx.shadowColor=col; ctx.shadowBlur=6; }
        ctx.fillText(st.toUpperCase(), p.x, ly+26);
        ctx.shadowBlur=0; ctx.shadowColor='transparent';

        // ── TASK DISPLAY (per agent) ──
        if (act && d.current_task) {
          const isEcho = name === 'echo';
          // Background pill for task
          const taskMaxW = isEcho ? 160 : 130;
          ctx.font = isEcho ? '500 7.5px JetBrains Mono, monospace' : '400 6.5px JetBrains Mono, monospace';
          const lines = wrap(d.current_task, taskMaxW, ctx);
          const lineH = isEcho ? 11 : 10;
          const boxH  = lines.length * lineH + 10;
          const boxW  = taskMaxW + 16;
          const bx    = p.x - boxW/2;
          const by    = ly + 30;

          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 4);
          ctx.fillStyle = rgba(col, isEcho ? 0.12 : 0.08);
          ctx.strokeStyle = rgba(col, isEcho ? 0.50 : 0.30);
          ctx.lineWidth = isEcho ? 1.5 : 1;
          ctx.fill(); ctx.stroke();

          lines.forEach((line, li) => {
            ctx.font = isEcho ? '500 7.5px JetBrains Mono, monospace' : '400 6.5px JetBrains Mono, monospace';
            ctx.fillStyle = isEcho ? rgba(col, 0.95) : rgba(col, 0.70);
            ctx.textAlign = 'center';
            ctx.fillText(line, p.x, by + 8 + li * lineH);
          });

          // Echo: also show "ASKING:" header
          if (isEcho) {
            ctx.font = '700 7px Orbitron, sans-serif';
            ctx.fillStyle = rgba(col, 1.0);
            ctx.shadowColor = col; ctx.shadowBlur = 8;
            ctx.fillText('ASKING:', p.x, by - 6);
            ctx.shadowBlur=0; ctx.shadowColor='transparent';
          }

          // Animated thinking dots for all active
          const dots = '.'.repeat(1 + Math.floor((t * 2.5) % 3));
          ctx.font='600 9px JetBrains Mono, monospace';
          ctx.fillStyle=rgba(col,0.75);
          ctx.fillText(dots, p.x + 4 + ctx.measureText(lines[lines.length-1]||'').width/2, by + (lines.length) * lineH + 1);
        }

        // ── Status dot (top-right) ──
        const dotX = p.x + nodeR*0.72, dotY = p.y - nodeR*0.72;
        ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, TWO_PI);
        ctx.shadowColor = err?'#f87171':act?col:'transparent';
        ctx.shadowBlur  = act||err ? 10 : 0;
        ctx.fillStyle = err?'#f87171':act?col:'rgba(255,255,255,0.20)'; ctx.fill();
        ctx.shadowBlur=0; ctx.shadowColor='transparent';
        if (act) {
          const pr2 = 5 + Math.sin(t*5+p.x)*2;
          ctx.beginPath(); ctx.arc(dotX, dotY, pr2+4, 0, TWO_PI);
          ctx.strokeStyle=rgba(col, 0.35+Math.sin(t*4)*0.15); ctx.lineWidth=1.5; ctx.stroke();
        }
      });

      // ── HUD corners ──
      ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=1.5;
      const bl=20;
      [[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(([x,y,sx,sy])=>{
        ctx.beginPath(); ctx.moveTo(x,y+sy*bl); ctx.lineTo(x,y); ctx.lineTo(x+sx*bl,y); ctx.stroke();
      });

      // ── HUD footer ──
      const timeStr = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
      const activeCt = AGENT_LIST.filter(([n])=>isActive((agentMap[n]?.status||''))).length;
      ctx.font='500 9px JetBrains Mono, monospace';
      ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,0.50)';
      ctx.fillText(`T: ${timeStr}`, 20, H-16);
      ctx.textAlign='right';
      ctx.fillStyle=activeCt>0?'rgba(74,222,128,1.0)':'rgba(255,255,255,0.35)';
      if(activeCt>0){ctx.shadowColor='#4ade80';ctx.shadowBlur=8;}
      ctx.fillText(`${activeCt}/${AGENT_LIST.length} ACTIVE`, W-20, H-16);
      ctx.shadowBlur=0; ctx.shadowColor='transparent';
      ctx.font='400 8px JetBrains Mono, monospace';
      ctx.fillStyle='rgba(255,255,255,0.28)';
      ctx.fillText('OPENCLAW  COMMAND TOPOLOGY', W-20, 20);

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
