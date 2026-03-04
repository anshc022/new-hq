'use client';
import { useState } from 'react';
import { getMergedMeta } from '@/lib/agents';

function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (['active','working','thinking','talking','running'].includes(s))
    return { cls: 'badge-active', dot: '#22c55e', label: 'ACTIVE' };
  if (['idle','sleeping'].includes(s))
    return { cls: 'badge-stale', dot: '#f59e0b', label: 'IDLE' };
  if (['error','degraded'].includes(s))
    return { cls: 'badge-degraded', dot: '#ef4444', label: 'DEGRADED' };
  return { cls: 'badge-unknown', dot: 'rgba(255,255,255,0.30)', label: 'UNKNOWN' };
}

const EVENT_ICONS = {
  heartbeat: '💓', task_start: '▶️', task_end: '✅', status_change: '🔄',
  delegation: '📤', completion: '📥', error: '❌', message: '💬',
};

export default function CommandView({ agents, events, activity, supabase }) {
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('events'); // events | activity

  const selectedAgent = agents.find(a => a.name === selected) || agents[0];
  const selectedMeta = selectedAgent
    ? getMergedMeta(selectedAgent.name, selectedAgent)
    : null;
  const sb = statusBadge(selectedAgent?.status);

  // Filter events/activity for this agent
  const sel = selected || agents[0]?.name;
  const agentEvents = (events || []).filter(e =>
    !sel || (e.agent === sel || e.agent_name === sel || (e.message || '').toLowerCase().includes(sel))
  ).slice(0, 50);

  const agentActivity = (activity || []).filter(a =>
    !sel || a.agent === sel
  ).slice(0, 50);

  return (
    <div className="flex gap-0 h-full min-h-0 animate-fade-in" style={{ height: '100%' }}>
      {/* LEFT — agent list */}
      <div className="flex flex-col overflow-y-auto" style={{ width: 320, borderRight: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div className="px-4 py-3 border-b text-[10px] font-bold tracking-widest uppercase" style={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>
          Fleet Roster — {agents.length} agents
        </div>
        {agents.map(a => {
          const meta = getMergedMeta(a.name, a);
          const sb2 = statusBadge(a.status);
          const color = meta?.color || '#888';
          const isActive = selected === a.name || (!selected && a === agents[0]);
          return (
            <div key={a.name} onClick={() => setSelected(a.name)}
              className="flex items-start gap-3 px-4 py-3 cursor-pointer"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.15s' }}>
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-base mt-0.5"
                style={{ background: color + '22', border: `1px solid ${color}44` }}>
                {meta?.icon || '🤖'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white truncate">{meta?.label || a.name}</span>
                  <span className={`badge ${sb2.cls} text-[9px]`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sb2.dot }} />
                    {sb2.label}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {a.current_task || meta?.role || '—'}
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.22)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {timeAgo(a.last_heartbeat_at || a.last_seen)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RIGHT — detail panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedAgent && selectedMeta ? (
          <>
            {/* Agent detail header */}
            <div className="px-6 py-4 border-b flex items-start justify-between gap-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: selectedMeta.color + '22', border: `1.5px solid ${selectedMeta.color}55` }}>
                  {selectedMeta.icon}
                </div>
                <div>
                  <div className="text-[18px] font-bold text-white leading-tight">{selectedMeta.label}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{selectedMeta.role}</div>
                  <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>
                    Model: {selectedMeta.model} · Heartbeat: {timeAgo(selectedAgent.last_heartbeat_at || selectedAgent.last_seen)}
                  </div>
                </div>
              </div>
              <span className={`badge ${sb.cls} text-[11px]`}>
                <span className="w-2 h-2 rounded-full" style={{ background: sb.dot }} />
                {sb.label}
              </span>
            </div>

            {/* Description + task + tools */}
            <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.60)' }}>{selectedMeta.description}</p>
              {selectedAgent.current_task && (
                <div className="mt-3 px-3 py-2 rounded text-[12px]"
                  style={{ background: selectedMeta.color + '14', border: `1px solid ${selectedMeta.color}30`, color: 'rgba(255,255,255,0.75)' }}>
                  ▶ {selectedAgent.current_task}
                </div>
              )}
              {selectedMeta.tools?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selectedMeta.tools.map(t => <span key={t} className="tool-tag">{t}</span>)}
                </div>
              )}
            </div>

            {/* Tab switcher: Events | Activity Timeline */}
            <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <button onClick={() => setTab('events')} className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: tab === 'events' ? '#c400ff' : 'rgba(255,255,255,0.35)', borderBottom: tab === 'events' ? '2px solid #c400ff' : '2px solid transparent', fontFamily: 'JetBrains Mono, monospace' }}>
                System Log
              </button>
              <button onClick={() => setTab('activity')} className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: tab === 'activity' ? '#c400ff' : 'rgba(255,255,255,0.35)', borderBottom: tab === 'activity' ? '2px solid #c400ff' : '2px solid transparent', fontFamily: 'JetBrains Mono, monospace' }}>
                Activity Timeline
              </button>
            </div>

            {/* Log content */}
            <div className="flex-1 overflow-y-auto px-4 py-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {tab === 'events' && (
                <>
                  {agentEvents.length === 0 && <EmptyMsg msg="No events" />}
                  {agentEvents.map((e, i) => (
                    <div key={e.id || i} className="sys-log-entry">
                      <span className="ts">{formatTs(e.created_at)}</span>
                      {e.agent && <span className="agent-tag" style={{ color: selectedMeta.color }}>[{e.agent}]</span>}
                      <span className="flex-1 break-all">{e.message || e.content || e.event_type || JSON.stringify(e)}</span>
                    </div>
                  ))}
                </>
              )}
              {tab === 'activity' && (
                <>
                  {agentActivity.length === 0 && <EmptyMsg msg="No activity recorded yet" />}
                  {agentActivity.map((a, i) => (
                    <div key={a.id || i} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <span className="text-base flex-shrink-0 mt-0.5">{EVENT_ICONS[a.event_type] || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold" style={{ color: selectedMeta.color }}>{a.event_type}</span>
                          {a.status && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.50)' }}>{a.status}</span>
                          )}
                        </div>
                        {a.task && <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{a.task}</div>}
                        {a.detail && <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{a.detail}</div>}
                      </div>
                      <span className="text-[9px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>{timeAgo(a.created_at)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.20)' }}>Select an agent</div>
        )}
      </div>
    </div>
  );
}

function formatTs(ts) {
  if (!ts) return '--:--:--';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function EmptyMsg({ msg }) {
  return <div className="text-[11px] py-4 text-center" style={{ color: 'rgba(255,255,255,0.20)' }}>{msg}</div>;
}
