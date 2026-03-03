'use client';
import { AGENTS } from '@/lib/agents';

export default function MissionBoard({ agents, nodeConnected }) {
  const total = agents?.length || 0;
  const active = agents?.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'working' || s === 'talking' || s === 'thinking' || s === 'researching' || s === 'posting';
  }).length || 0;
  const idle = agents?.filter(a => (a.status || '').toLowerCase() === 'idle').length || 0;
  const errors = agents?.filter(a => (a.status || '').toLowerCase() === 'error').length || 0;
  const uptime = nodeConnected ? '99.7%' : '—';

  const stats = [
    { label: 'TOTAL', value: total, color: '#00f0ff' },
    { label: 'ACTIVE', value: active, color: '#00ff88' },
    { label: 'IDLE', value: idle, color: '#3a5068' },
    { label: 'ERRORS', value: errors, color: errors > 0 ? '#ff0066' : '#1a2535' },
  ];

  const sysInfo = [
    { key: 'Gateway', value: 'EC2 13.60.96.9', icon: '🌐', color: '#0088ff' },
    { key: 'Model', value: 'Gemini Flash', icon: '🧠', color: '#8800ff' },
    { key: 'Engine', value: 'OpenClaw v2026.3', icon: '⚙️', color: '#e67e22' },
    { key: 'Runtime', value: 'Node.js v22.22', icon: '💚', color: '#00ff88' },
    { key: 'Uptime', value: uptime, icon: '📈', color: '#0088ff' },
  ];

  return (
    <div className="hud-panel p-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-[var(--color-cyan)]" style={{ boxShadow: '0 0 6px var(--color-cyan)' }} />
          <span className="text-[10px] font-orbitron font-bold text-[var(--color-cyan)] tracking-[0.2em]">MISSION CONTROL</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
          style={{
            background: nodeConnected ? 'rgba(0, 255, 136, 0.06)' : 'rgba(255, 0, 102, 0.06)',
            border: `1px solid ${nodeConnected ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 0, 102, 0.2)'}`,
          }}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{
              background: nodeConnected ? '#00ff88' : '#ff0066',
              boxShadow: `0 0 4px ${nodeConnected ? '#00ff88' : '#ff0066'}`,
              animation: nodeConnected ? 'glow-pulse 2s ease-in-out infinite' : 'none',
            }} />
          <span className={`text-[8px] font-bold tracking-[0.15em] ${nodeConnected ? 'text-[#00ff88]' : 'text-[#ff0066]'}`}>
            {nodeConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {stats.map((s, i) => (
          <div key={s.label} className="py-3 px-2 text-center rounded-sm transition-all"
            style={{
              background: 'rgba(0, 240, 255, 0.03)',
              border: '1px solid rgba(0, 240, 255, 0.08)',
            }}>
            <div className="text-xl font-bold leading-none tabular font-orbitron" style={{ color: s.color, textShadow: `0 0 10px ${s.color}40` }}>
              {s.value}
            </div>
            <div className="text-[7px] text-white/20 tracking-[0.2em] mt-1.5 font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* System Info Panel */}
      <div className="rounded-sm px-3.5 py-3"
        style={{ background: 'rgba(0, 240, 255, 0.02)', border: '1px solid rgba(0, 240, 255, 0.06)' }}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-0.5 h-3 bg-[#8800ff]" style={{ boxShadow: '0 0 4px #8800ff' }} />
          <span className="text-[8px] font-bold text-white/20 tracking-[0.25em]">SYSTEM INFO</span>
        </div>
        <div className="space-y-2">
          {sysInfo.map(({ key, value, icon, color }) => (
            <div key={key} className="flex items-center gap-2.5 text-[10px]">
              <span className="w-5 text-center text-[11px] opacity-60">{icon}</span>
              <span className="text-white/20 font-bold w-16">{key}</span>
              <span className="flex-1 h-px" style={{ background: 'rgba(0, 240, 255, 0.06)' }} />
              <span className="font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Node Connection Status */}
      <div className="mt-3 flex items-center gap-2 px-3 py-2.5 text-[9px] font-bold tracking-wider rounded-sm"
        style={{
          background: nodeConnected ? 'rgba(0, 255, 136, 0.03)' : 'rgba(255, 0, 102, 0.03)',
          border: `1px solid ${nodeConnected ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 0, 102, 0.15)'}`,
          color: nodeConnected ? '#00ff88' : '#ff0066',
        }}>
        <span className="text-[10px]">{nodeConnected ? '🔗' : '🔌'}</span>
        <span>EC2 NODE</span>
        <span className="flex-1 h-px bg-current opacity-10" />
        <span>{nodeConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
      </div>
    </div>
  );
}
