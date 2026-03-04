'use client';
import { useEffect, useState } from 'react';

export default function StatsBar({ agents, nodeConnected }) {
  const total = agents?.length || 0;
  const active = agents?.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s !== 'idle' && s !== 'sleeping';
  }).length || 0;

  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="shrink-0 z-50 flex items-center justify-between px-4 py-2.5 bg-black border-b border-white/[0.08] font-mono">
      {/* Left: brand */}
      <div className="flex items-center gap-4">
        <span className="font-orbitron font-black text-[13px] tracking-[0.30em] text-white">OPENCLAW</span>
        <span className="text-white/20 text-[9px]">·</span>
        <span className="font-orbitron text-[9px] tracking-[0.25em] text-white/40">OPSCENTER</span>
      </div>

      {/* Right: pills */}
      <div className="flex items-center gap-2">
        {/* Live */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 border border-white/10 bg-white/[0.025]">
          <span className="live-dot" />
          <span className="text-[#4ade80] font-bold text-[8px] tracking-[0.25em]">LIVE</span>
        </div>

        {/* Agents count */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 border border-white/10 bg-white/[0.025]">
          <span className="text-white font-bold text-[11px] tabular">{active}</span>
          <span className="text-white/20 text-[9px]">/</span>
          <span className="text-white/40 text-[11px] tabular">{total}</span>
          <span className="text-white/20 text-[7px] tracking-[0.25em] ml-0.5">AGENTS</span>
        </div>

        {/* Node */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 border"
          style={{ borderColor: nodeConnected ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.28)' }}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: nodeConnected ? '#4ade80' : '#f87171' }} />
          <span className="text-[8px] font-bold tracking-[0.2em]"
            style={{ color: nodeConnected ? '#4ade80' : '#f87171' }}>
            NODE
          </span>
        </div>

        {/* Clock */}
        <div className="px-2.5 py-1 border border-white/10 bg-white/[0.025]">
          <span className="text-white/50 text-[11px] tabular font-mono tracking-wider">{time}</span>
        </div>
      </div>
    </header>
  );
}
