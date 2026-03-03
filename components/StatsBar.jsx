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
    <header className="sticky top-0 z-50 font-mono"
      style={{
        background: 'rgba(6, 1, 12, 0.90)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(196, 0, 255, 0.15)',
        boxShadow: '0 2px 24px rgba(196, 0, 255, 0.06)',
      }}>
      <div className="flex items-center justify-between px-5 py-2.5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center relative">
            <div className="absolute inset-0 border border-[var(--color-cyan)] opacity-60" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
            <span className="text-sm text-[var(--color-cyan)]">⚡</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-orbitron font-bold tracking-[0.25em] text-[var(--color-cyan)]">OPS</span>
            <span className="text-[9px] text-[var(--color-neon-green)] font-bold tracking-[0.2em]">HQ</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1 rounded-sm"
            style={{ background: 'rgba(196, 0, 255, 0.04)', border: '1px solid rgba(196, 0, 255, 0.1)' }}>
            <span className="text-[8px] text-[var(--color-cyan)] font-bold tracking-[0.2em] font-orbitron">OPENCLAW</span>
            <span className="text-[var(--color-cyan)] text-[6px] opacity-30">◆</span>
            <span className="text-[8px] text-[var(--color-neon-blue)] font-bold tracking-[0.2em]">K2</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
            style={{ background: 'rgba(0, 255, 170, 0.06)', border: '1px solid rgba(0, 255, 170, 0.28)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-green)]"
              style={{ animation: 'glow-pulse 2s ease-in-out infinite', boxShadow: '0 0 6px var(--color-neon-green)' }} />
            <span className="text-[var(--color-neon-green)] text-[9px] font-bold tracking-[0.25em] font-orbitron">LIVE</span>
          </div>

          {/* Agent count */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
            style={{ background: 'rgba(196, 0, 255, 0.04)', border: '1px solid rgba(196, 0, 255, 0.1)' }}>
            <span className={`font-bold text-sm tabular font-orbitron ${active > 0 ? 'text-[var(--color-neon-green)]' : 'text-white/30'}`}>{active}</span>
            <span className="text-[var(--color-cyan)] text-xs opacity-30">/</span>
            <span className="text-white/50 text-sm tabular font-bold">{total}</span>
            <span className="text-white/20 text-[7px] tracking-[0.25em] font-bold ml-0.5">AGENTS</span>
          </div>

          {/* Node status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
            style={{
            background: nodeConnected ? 'rgba(0, 255, 170, 0.05)' : 'rgba(255, 34, 0, 0.05)',
            border: `1px solid ${nodeConnected ? 'rgba(0, 255, 170, 0.28)' : 'rgba(255, 34, 0, 0.28)'}`,
          
            }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{
                background: nodeConnected ? '#00ffaa' : '#ff2200',
                boxShadow: `0 0 5px ${nodeConnected ? '#00ffaa' : '#ff2200'}`,
              }} />
            <span className={`text-[9px] font-bold tracking-[0.2em] ${nodeConnected ? 'text-[var(--color-neon-green)]' : 'text-[var(--color-neon-pink)]'}`}>NODE</span>
          </div>

          {/* Clock */}
          <div className="px-3 py-1.5 rounded-sm"
            style={{ background: 'rgba(255, 204, 0, 0.04)', border: '1px solid rgba(255, 204, 0, 0.10)' }}>
            <span className="text-[#ffcc00] text-[11px] tabular tracking-wider font-mono font-bold opacity-70">{time}</span>
          </div>
        </div>
      </div>

      {/* Scan line */}
      <div className="scan-overlay" style={{ height: '1px', position: 'relative' }} />
    </header>
  );
}
