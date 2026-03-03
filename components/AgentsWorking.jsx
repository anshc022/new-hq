'use client';
import { useMemo } from 'react';
import { AGENTS } from '@/lib/agents';

const STATUS_COLORS = {
  idle: '#3a5068',
  working: '#00ff88',
  thinking: '#ffc800',
  talking: '#00f0ff',
  posting: '#e67e22',
  researching: '#8800ff',
  error: '#ff0066',
  sleeping: '#2a3548',
  monitoring: '#00ff88',
};

const STATUS_LABELS = {
  idle: 'IDLE',
  working: 'WORKING',
  thinking: 'THINKING',
  talking: 'RESPONDING',
  posting: 'POSTING',
  researching: 'RESEARCH',
  error: 'ERROR',
  sleeping: 'SLEEPING',
  monitoring: 'MONITORING',
};

export default function AgentsWorking({ agents, events }) {
  const agentEventCounts = useMemo(() => {
    const counts = {};
    Object.keys(AGENTS).forEach(name => { counts[name] = 0; });
    (events || []).forEach(evt => {
      if (evt.agent && counts[evt.agent] !== undefined) {
        counts[evt.agent]++;
      }
    });
    return counts;
  }, [events]);

  const totalSignals = events?.length || 0;
  const activeCount = (agents || []).filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'working' || s === 'thinking' || s === 'talking' || s === 'posting' || s === 'researching';
  }).length;

  return (
    <div className="hud-panel" style={{ padding: 0 }}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-0">
        <div className="flex items-center gap-3">
          <div className="w-0.5 h-4 bg-[var(--color-cyan)]" style={{ boxShadow: '0 0 6px var(--color-cyan)' }} />
          <h2 className="text-[11px] font-orbitron font-bold text-[var(--color-cyan)] tracking-[0.2em]">
            AGENT STATUS
          </h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* LIVE FEED badge */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-sm text-[9px] font-bold tracking-[0.15em]"
            style={{ background: 'rgba(0, 255, 136, 0.06)', border: '1px solid rgba(0, 255, 136, 0.2)', color: '#00ff88' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"
              style={{ animation: 'glow-pulse 2s ease-in-out infinite', boxShadow: '0 0 4px #00ff88' }} />
            LIVE
          </span>
          {/* Signal count */}
          <span className="text-[10px] font-mono text-white/20">
            <span className="text-[var(--color-cyan)] font-bold">{totalSignals}</span> signals
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 my-2.5" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.1), transparent)' }} />

      {/* Agent Cards Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 px-4 pb-4">
        {Object.entries(AGENTS).map(([name, config]) => {
          const agentData = (agents || []).find(a => a.name === name) || {};
          const status = (agentData.status || 'idle').toLowerCase();
          const statusColor = STATUS_COLORS[status] || '#3a5068';
          const statusLabel = STATUS_LABELS[status] || 'IDLE';
          const eventCount = agentEventCounts[name] || 0;
          const isBusy = status === 'working' || status === 'thinking' || status === 'talking' || status === 'posting' || status === 'researching';

          return (
            <div key={name}
              className="flex flex-col items-center gap-1.5 p-3 rounded-sm transition-all duration-300"
              style={{
                background: isBusy ? `${statusColor}08` : 'rgba(0, 240, 255, 0.02)',
                border: `1px solid ${isBusy ? statusColor + '30' : 'rgba(0, 240, 255, 0.06)'}`,
                boxShadow: isBusy ? `0 0 20px ${statusColor}10, inset 0 0 20px ${statusColor}05` : 'none',
              }}>
              {/* Avatar circle */}
              <div className="relative flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: `1.5px solid ${isBusy ? config.color : config.color + '30'}`,
                  background: `${config.color}08`,
                  boxShadow: isBusy ? `0 0 15px ${config.color}20` : 'none',
                  transition: 'all 0.3s',
                }}>
                <span style={{ fontSize: 22 }}>{config.icon}</span>
                {/* Status dot */}
                <span className="absolute bottom-0 right-0"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: statusColor,
                    border: '2px solid #030510',
                    boxShadow: isBusy ? `0 0 6px ${statusColor}` : 'none',
                  }} />
              </div>

              {/* Agent name */}
              <span className="text-[10px] font-orbitron font-bold tracking-[0.15em]"
                style={{ color: isBusy ? config.color : `${config.color}80` }}>
                {config.label.toUpperCase()}
              </span>

              {/* Status */}
              <span className="text-[8px] font-mono font-bold tracking-wider"
                style={{ color: statusColor }}>
                {statusLabel}
              </span>

              {/* Event count */}
              <span className="text-[8px] font-mono text-white/15">
                {eventCount} events
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
