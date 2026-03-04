'use client';
import { AGENTS } from '@/lib/agents';

export default function MissionBoard({ agents, nodeConnected }) {
  const total    = agents?.length || 0;
  const active   = agents?.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'working' || s === 'talking' || s === 'thinking' || s === 'researching' || s === 'posting';
  }).length || 0;
  const idle     = agents?.filter(a => (a.status || '').toLowerCase() === 'idle').length || 0;
  const errors   = agents?.filter(a => (a.status || '').toLowerCase() === 'error').length || 0;
  const uptime   = nodeConnected ? '99.7%' : '—';

  const stats = [
    { label: 'TOTAL',  value: total  },
    { label: 'ACTIVE', value: active },
    { label: 'IDLE',   value: idle   },
    { label: 'ERR',    value: errors, danger: errors > 0 },
  ];

  const sysInfo = [
    { key: 'GATEWAY', value: 'EC2 13.60.96.9' },
    { key: 'MODEL',   value: 'Gemini Flash'    },
    { key: 'ENGINE',  value: 'OpenClaw v2026.3'},
    { key: 'RUNTIME', value: 'Node.js v22'     },
    { key: 'UPTIME',  value: uptime            },
  ];

  return (
    <div className="mil-panel h-full flex flex-col font-mono" style={{ padding: 0 }}>
      {/* Header */}
      <div className="mil-header px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-3.5 bg-white/80" />
          <span className="font-orbitron font-bold text-[10px] tracking-[0.25em] text-white">SITREP</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 border"
          style={{
            borderColor: nodeConnected ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.28)',
          }}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: nodeConnected ? '#4ade80' : '#f87171' }} />
          <span className="text-[8px] font-bold tracking-[0.2em]"
            style={{ color: nodeConnected ? '#4ade80' : '#f87171' }}>
            {nodeConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-1.5">
          {stats.map(s => (
            <div key={s.label} className="py-2.5 px-1 text-center border border-white/[0.07] bg-white/[0.02]">
              <div className="font-orbitron font-bold text-lg leading-none tabular"
                style={{ color: s.danger ? '#f87171' : 'rgba(255,255,255,0.88)' }}>
                {s.value}
              </div>
              <div className="text-[7px] text-white/20 tracking-[0.2em] mt-1 font-bold">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        {/* System info */}
        <div className="space-y-1.5">
          <div className="text-[7.5px] font-bold text-white/20 tracking-[0.3em] mb-2">SYSTEM INFO</div>
          {sysInfo.map(({ key, value }) => (
            <div key={key} className="flex items-center gap-2 text-[9px]">
              <span className="text-white/25 font-bold w-14 shrink-0">{key}</span>
              <span className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-white/60 font-mono">{value}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        {/* EC2 node pill */}
        <div className="flex items-center gap-2 px-3 py-2 border text-[9px] font-bold tracking-widest"
          style={{
            borderColor: nodeConnected ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)',
            color: nodeConnected ? '#4ade80' : '#f87171',
            background: nodeConnected ? 'rgba(74,222,128,0.03)' : 'rgba(248,113,113,0.03)',
          }}>
          <span>EC2 NODE</span>
          <span className="flex-1 h-px bg-current opacity-15" />
          <span>{nodeConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
        </div>
      </div>
    </div>
  );
}
