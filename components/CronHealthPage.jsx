'use client';
import { useEffect, useState, useMemo } from 'react';
import { getMergedMeta } from '@/lib/agents';

export default function CronHealthPage({ agents, activity, supabase }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 15000); return () => clearInterval(id); }, []);

  const heartbeatMap = useMemo(() => {
    const map = {};
    (activity || []).forEach(a => {
      if (a.event_type === 'heartbeat' || a.event_type === 'status_change') {
        if (!map[a.agent]) map[a.agent] = [];
        map[a.agent].push(a);
      }
    });
    return map;
  }, [activity]);

  const cronEntries = agents.map(a => {
    const meta = getMergedMeta(a.name, a);
    const lastHB = a.last_heartbeat_at || a.last_seen;
    const lastTs = lastHB ? new Date(lastHB) : null;
    const intervalMin = a.heartbeat_interval_min || 15;
    const diffMin = lastTs ? Math.floor((time - lastTs) / 60000) : null;
    const late = diffMin === null || diffMin > intervalMin * 2.5;
    const heartbeats = heartbeatMap[a.name] || [];
    return { agent: a, meta, lastTs, intervalMin, diffMin, late, heartbeats };
  });

  const totalLate = cronEntries.filter(c => c.late).length;
  const totalOk = cronEntries.filter(c => !c.late).length;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Cron Health</h1>
        <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Heartbeat monitoring and scheduled process status</p>
      </div>

      <div className="flex gap-3 mb-6">
        <MiniStat icon="✅" label="On Time" value={totalOk} color="#22c55e" />
        <MiniStat icon="⚠️" label="Late" value={totalLate} color="#ef4444" />
        <MiniStat icon="⏱️" label="Interval" value={(() => { const intervals = agents.map(a => a.heartbeat_interval_min || 15); const unique = [...new Set(intervals)]; return unique.length === 1 ? `${unique[0]}m` : unique.map(i => `${i}m`).join('/'); })()} color="rgba(255,255,255,0.50)" />
        <MiniStat icon="📊" label="Total HBs" value={(activity || []).filter(a => a.event_type === 'heartbeat').length} color="#c400ff" />
      </div>

      <div className="flex flex-col gap-3 max-w-3xl">
        <div className="text-[10px] font-bold tracking-widest mb-1 uppercase" style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'JetBrains Mono, monospace' }}>Agent Heartbeats</div>
        {cronEntries.map(({ agent: a, meta, lastTs, intervalMin, diffMin, late, heartbeats }) => {
          const statusColor = late ? '#ef4444' : '#22c55e';
          const color = meta?.color || '#888';
          return (
            <div key={a.name} className="agent-card flex items-center gap-4">
              <div className="flex items-center gap-3" style={{ minWidth: 140 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: color + '22', border: `1px solid ${color}44` }}>
                  {meta?.icon || '🤖'}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{meta?.label || a.name}</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>Every {intervalMin}m</div>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-0.5">
                <HeartbeatTimeline heartbeats={heartbeats} intervalMin={intervalMin} now={time} color={color} />
              </div>
              <div className="text-right" style={{ minWidth: 100 }}>
                <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {lastTs ? lastTs.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'never'}
                  {diffMin !== null && <span style={{ color: 'rgba(255,255,255,0.25)' }}> ({diffMin}m)</span>}
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded flex-shrink-0"
                style={{ background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}35` }}>
                {late ? 'LATE' : 'OK'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 max-w-3xl">
        <div className="text-[10px] font-bold tracking-widest mb-3 uppercase" style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'JetBrains Mono, monospace' }}>Recent Heartbeat Events</div>
        <div className="flex flex-col gap-1">
          {(activity || []).filter(a => a.event_type === 'heartbeat' || a.event_type === 'status_change').slice(0, 20).map((a, i) => {
            const agentData = agents.find(ag => ag.name === a.agent);
            const meta = getMergedMeta(a.agent, agentData);
            const col = meta?.color || '#888';
            return (
              <div key={a.id || i} className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-[9px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.22)', fontFamily: 'JetBrains Mono, monospace', minWidth: 56 }}>
                  {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--'}
                </span>
                <span className="text-[10px] font-bold" style={{ color: col, minWidth: 48 }}>{a.agent}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: a.event_type === 'status_change' ? '#f59e0b' : '#22c55e' }}>{a.event_type}</span>
                {a.status && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{a.status}</span>}
                {a.task && <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.30)' }}>{a.task}</span>}
              </div>
            );
          })}
          {(!activity || activity.filter(a => a.event_type === 'heartbeat').length === 0) && (
            <div className="py-6 text-center">
              <div className="text-[12px] mb-3" style={{ color: 'rgba(255,255,255,0.20)' }}>No heartbeat events yet. Waiting for agents...</div>
              <div className="inline-block text-left agent-card" style={{ maxWidth: 380 }}>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(196,0,255,0.50)', fontFamily: 'JetBrains Mono, monospace' }}>What is this?</div>
                <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Monitor agent heartbeat cron jobs. Each agent pings this dashboard at set intervals — if a heartbeat is late, it flags as degraded.</p>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>How it works</div>
                <ul className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  <li>• Agents send heartbeat POST to /api/agent-heartbeat</li>
                  <li>• EC2 cron runs every 15 min to ping all agents</li>
                  <li>• Green = on time · Red = late/missed heartbeat</li>
                  <li>• Timeline bars show heartbeat history over 2 hours</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeartbeatTimeline({ heartbeats, intervalMin, now, color }) {
  const slots = 12;
  const slotMs = intervalMin * 60000;
  const buckets = new Array(slots).fill(false);
  heartbeats.forEach(hb => {
    const age = now - new Date(hb.created_at).getTime();
    const idx = Math.floor(age / slotMs);
    if (idx >= 0 && idx < slots) buckets[slots - 1 - idx] = true;
  });
  return (
    <div className="flex items-center gap-1">
      {buckets.map((hit, i) => (
        <div key={i} className="rounded-sm" style={{ width: 8, height: 14, background: hit ? color : 'rgba(255,255,255,0.06)', opacity: hit ? 0.8 : 1, border: `1px solid ${hit ? color + '55' : 'rgba(255,255,255,0.08)'}`, transition: 'background 0.3s' }} />
      ))}
      <span className="text-[8px] ml-1" style={{ color: 'rgba(255,255,255,0.20)' }}>2h</span>
    </div>
  );
}

function MiniStat({ icon, label, value, color }) {
  return (
    <div className="stat-card flex items-center gap-3">
      <div className="w-8 h-8 rounded flex items-center justify-center text-base flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>{icon}</div>
      <div>
        <div className="text-[10px] mb-0.5 uppercase" style={{ color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>{label}</div>
        <div className="text-[20px] font-bold leading-tight tabular" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      </div>
    </div>
  );
}
