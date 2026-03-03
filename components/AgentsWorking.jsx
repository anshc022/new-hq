'use client';
import { useMemo } from 'react';
import { AGENTS } from '@/lib/agents';

const STATUS_COLORS = {
  idle: '#3d2050',
  working: '#00ffaa',
  thinking: '#ffcc00',
  talking: '#c400ff',
  posting: '#ff5500',
  researching: '#ff00aa',
  error: '#ff2200',
  sleeping: '#1a0525',
  monitoring: '#00ffaa',
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
          <div className="w-0.5 h-4 bg-[#c400ff]" style={{ boxShadow: '0 0 6px #c400ff' }} />
          <h2 className="text-[11px] font-orbitron font-bold text-[#c400ff] tracking-[0.2em]">
            AGENT FLEET
          </h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-sm text-[9px] font-bold tracking-[0.15em]"
            style={{ background: 'rgba(0, 255, 170, 0.07)', border: '1px solid rgba(0, 255, 170, 0.22)', color: '#00ffaa' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa]"
              style={{ animation: 'glow-pulse 2s ease-in-out infinite', boxShadow: '0 0 4px #00ffaa' }} />
            LIVE
          </span>
          <span className="text-[10px] font-mono text-white/20">
            <span className="text-[#ffcc00] font-bold">{activeCount}</span>/{Object.keys(AGENTS).length} active · <span className="text-[#c400ff] font-bold">{totalSignals}</span> signals
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 my-2.5" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(196, 0, 255, 0.15), transparent)' }} />

      {/* Agent Cards Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 px-4 pb-4">
        {Object.entries(AGENTS).map(([name, config]) => {
          const agentData = (agents || []).find(a => a.name === name) || {};
          const status = (agentData.status || 'idle').toLowerCase();
          const statusColor = STATUS_COLORS[status] || '#3a5068';
          const statusLabel = STATUS_LABELS[status] || 'IDLE';
          const eventCount = agentEventCounts[name] || 0;
          const isBusy = status === 'working' || status === 'thinking' || status === 'talking' || status === 'posting' || status === 'researching';
          const currentTask = agentData.current_task || null;

          return (
            <div key={name}
              className="flex flex-col items-center gap-1.5 p-3 rounded-sm transition-all duration-300"
              style={{
                background: isBusy ? `${statusColor}0c` : 'rgba(196, 0, 255, 0.02)',
                border: `1px solid ${isBusy ? statusColor + '35' : 'rgba(196, 0, 255, 0.07)'}`,
                boxShadow: isBusy ? `0 0 22px ${statusColor}12, inset 0 0 18px ${statusColor}06` : 'none',
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

              {/* Role */}
              <span className="text-[7px] font-mono tracking-[0.12em] text-white/20 -mt-0.5">{config.role}</span>
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

              {/* Current task */}
              {isBusy && currentTask ? (
                <span className="text-[7px] font-mono text-center leading-tight px-1"
                  style={{ color: 'rgba(255, 204, 0, 0.55)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}
                  title={currentTask}>
                  {currentTask.length > 18 ? currentTask.slice(0, 18) + '…' : currentTask}
                </span>
              ) : (
                <span className="text-[8px] font-mono text-white/12">
                  {eventCount} events
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
