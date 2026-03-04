'use client';

function statusOf(a) {
  const s = (a.status || '').toLowerCase();
  if (['active','working','thinking','talking','running'].includes(s)) return 'active';
  if (['error','degraded'].includes(s)) return 'degraded';
  if (['idle','sleeping'].includes(s)) return 'stale';
  return 'unknown';
}

export default function FleetHeader({ agents, nodeConnected, view, setView, lateCrons = 0 }) {
  const total = agents.length;
  const healthy = agents.filter(a => statusOf(a) === 'active').length;
  const degraded = agents.filter(a => statusOf(a) === 'degraded').length;
  const stale = agents.filter(a => statusOf(a) === 'stale').length;

  const healthyPct = total ? (healthy / total) * 100 : 0;
  const degradedPct = total ? (degraded / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 px-6 pt-5">
      {/* Title row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Command Center
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Agent fleet overview and operational status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="live-dot" />
            <span className="text-[11px] font-bold tracking-widest" style={{ color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${nodeConnected ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            <span className="w-2 h-2 rounded-full" style={{ background: nodeConnected ? '#22c55e' : '#ef4444' }} />
            <span className="text-[11px] font-bold" style={{ color: nodeConnected ? '#22c55e' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
              NODE {nodeConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Fleet health bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>Fleet Health</span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>
            {healthy} healthy · {degraded} degraded · {stale} stale
          </span>
        </div>
        <div className="fleet-health-bar">
          <div className="h-full flex">
            <div style={{ width: `${healthyPct}%`, background: '#22c55e', transition: 'width 0.6s ease' }} />
            <div style={{ width: `${degradedPct}%`, background: '#f59e0b', transition: 'width 0.6s ease' }} />
            <div style={{ flex: 1, background: 'rgba(239,68,68,0.3)' }} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="flex gap-3">
        <StatCard icon="🤖" label="Total Agents" value={total} color="rgba(255,255,255,0.70)" />
        <StatCard icon="❤️" label="Healthy" value={healthy} color="#22c55e" />
        <StatCard icon="⚠️" label="Degraded" value={degraded} color="#f59e0b" />
        <StatCard icon="🕐" label="Late Crons" value={lateCrons} color={lateCrons > 0 ? '#ef4444' : 'rgba(255,255,255,0.50)'} />
      </div>

      {/* View switcher */}
      <div className="flex items-center justify-between mt-1">
        <h2 className="text-[16px] font-semibold text-white">Agent Fleet</h2>
        <div className="flex items-center gap-1">
          {['GRID', 'NEURAL', 'COMMAND'].map(v => (
            <button key={v} className={`view-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'GRID' && <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><rect x="1" y="1" width="5" height="5" rx="0.5"/><rect x="8" y="1" width="5" height="5" rx="0.5"/><rect x="1" y="8" width="5" height="5" rx="0.5"/><rect x="8" y="8" width="5" height="5" rx="0.5"/></svg>}
              {v === 'NEURAL' && <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><circle cx="7" cy="7" r="2"/><circle cx="2" cy="2" r="1.2"/><circle cx="12" cy="2" r="1.2"/><circle cx="2" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><line x1="5.5" y1="5.5" x2="3" y2="3"/><line x1="8.5" y1="5.5" x2="11" y2="3"/><line x1="5.5" y1="8.5" x2="3" y2="11"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>}
              {v === 'COMMAND' && <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="7" x2="9" y2="7"/><line x1="1" y1="11" x2="11" y2="11"/></svg>}
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card flex items-center gap-3">
      <div className="w-8 h-8 rounded flex items-center justify-center text-base flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        {icon}
      </div>
      <div>
        <div className="text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>{label.toUpperCase()}</div>
        <div className="text-[22px] font-bold leading-tight tabular" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      </div>
    </div>
  );
}
