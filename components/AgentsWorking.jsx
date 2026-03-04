'use client';
import { useMemo } from 'react';
import { AGENTS } from '@/lib/agents';

const STATUS_LABEL = {
  idle: 'IDLE', working: 'WORKING', thinking: 'THINKING',
  talking: 'TALKING', posting: 'POSTING', researching: 'RESEARCH',
  error: 'ERROR', sleeping: 'SLEEP', monitoring: 'MONITOR',
};

function isActive(s) {
  return ['working','thinking','talking','posting','researching','monitoring'].includes((s||'').toLowerCase());
}

export default function AgentsWorking({ agents, events }) {
  const agentEventCounts = useMemo(() => {
    const c = {};
    Object.keys(AGENTS).forEach(n => { c[n] = 0; });
    (events || []).forEach(e => { if (e.agent && c[e.agent] !== undefined) c[e.agent]++; });
    return c;
  }, [events]);

  const activeCount = (agents || []).filter(a => isActive(a.status)).length;
  const totalSignals = events?.length || 0;

  return (
    <div className="mil-panel h-full flex flex-col" style={{ padding: 0 }}>
      {/* Header */}
      <div className="mil-header px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-3.5 bg-white/80" />
          <span className="font-orbitron font-bold text-[10px] tracking-[0.25em] text-white">OPERATOR FLEET</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2 py-0.5 border border-white/10 text-[8px] font-bold tracking-widest text-white/40">
            <span className="live-dot" />
            LIVE
          </span>
          <span className="text-[9px] font-mono text-white/20">
            <span className="text-white/60 font-bold">{activeCount}</span>/{Object.keys(AGENTS).length} active
            <span className="ml-2 text-white/15">·</span>
            <span className="ml-2 text-white/40 font-bold">{totalSignals}</span>
            <span className="text-white/20"> sig</span>
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 px-4 py-3 flex-1">
        {Object.entries(AGENTS).map(([name, cfg]) => {
          const d      = (agents || []).find(a => a.name === name) || {};
          const status = (d.status || 'idle').toLowerCase();
          const busy   = isActive(status);
          const err    = status === 'error';
          const label  = STATUS_LABEL[status] || 'IDLE';
          const evtCnt = agentEventCounts[name] || 0;

          return (
            <div key={name}
              className="flex flex-col items-center gap-1.5 p-3 transition-all duration-300"
              style={{
                background: busy
                  ? 'rgba(255,255,255,0.04)'
                  : err
                    ? 'rgba(248,113,113,0.04)'
                    : 'rgba(255,255,255,0.015)',
                border: `1px solid ${
                  busy  ? 'rgba(255,255,255,0.22)'
                  : err ? 'rgba(248,113,113,0.35)'
                        : 'rgba(255,255,255,0.06)'}`,
              }}>

              {/* Avatar */}
              <div className="relative flex items-center justify-center"
                style={{
                  width: 46, height: 46, borderRadius: '50%',
                  border: `1.5px solid ${busy ? 'rgba(255,255,255,0.55)' : err ? 'rgba(248,113,113,0.40)' : 'rgba(255,255,255,0.14)'}`,
                  background: busy ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}>
                <span style={{ fontSize: 20, opacity: busy ? 1 : err ? 0.6 : 0.30 }}>{cfg.icon}</span>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black"
                  style={{ background: err ? '#f87171' : busy ? '#4ade80' : 'rgba(255,255,255,0.18)' }} />
              </div>

              {/* Name */}
              <span className="font-orbitron font-bold text-[9px] tracking-[0.15em] mt-0.5"
                style={{ color: busy ? 'rgba(255,255,255,0.88)' : err ? '#f87171' : 'rgba(255,255,255,0.22)' }}>
                {name.toUpperCase()}
              </span>

              {/* Role */}
              <span className="text-[7px] font-mono tracking-wide"
                style={{ color: busy ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.10)' }}>
                {cfg.role}
              </span>

              {/* Status badge */}
              <span className="text-[7.5px] font-mono font-bold tracking-widest px-2 py-0.5 border"
                style={{
                  color: err ? '#f87171' : busy ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.18)',
                  borderColor: err ? 'rgba(248,113,113,0.30)' : busy ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
                  background: 'transparent',
                }}>
                {label}
              </span>

              {/* Task / event count */}
              {busy && d.current_task ? (
                <span className="text-[7px] font-mono text-center leading-tight px-1 text-white/35"
                  style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}
                  title={d.current_task}>
                  {d.current_task.length > 18 ? d.current_task.slice(0, 18) + '…' : d.current_task}
                </span>
              ) : (
                <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.12)' }}>
                  {evtCnt} events
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
