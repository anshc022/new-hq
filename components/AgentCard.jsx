'use client';

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

function Sparkline({ data, color }) {
  if (!data || data.length < 1) return null;
  const now = Date.now();
  const buckets = new Array(12).fill(0);
  const bucketMs = 10 * 60000;
  data.forEach(ts => {
    const age = now - new Date(ts).getTime();
    const idx = Math.floor(age / bucketMs);
    if (idx >= 0 && idx < 12) buckets[11 - idx]++;
  });
  const max = Math.max(...buckets, 1);
  const w = 72, h = 18;
  const bw = w / 12;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      {buckets.map((v, i) => {
        const bh = Math.max(1, (v / max) * (h - 2));
        return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh} rx={1} fill={color} opacity={v > 0 ? 0.7 : 0.15} />;
      })}
    </svg>
  );
}

export default function AgentCard({ agentData, meta, onClick, selected, recentActivity, relationshipCount }) {
  const sb = statusBadge(agentData?.status);
  // Prefer live Supabase data over static config
  const name = agentData?.display_name || meta?.label || agentData?.name || '—';
  const color = meta?.color || '#888';
  const icon = agentData?.emoji || meta?.icon || '🤖';
  const toolCount = meta?.tools?.length || agentData?.tool_count || 0;
  const model = agentData?.model || meta?.model || 'unknown';
  const role = agentData?.role || meta?.role;
  const heartbeatTs = agentData?.last_heartbeat_at || agentData?.last_seen;
  const activityTimes = (recentActivity || []).map(a => a.created_at);
  const relCount = relationshipCount || 0;

  return (
    <div className="agent-card animate-fade-in flex flex-col gap-3"
      onClick={() => onClick?.(agentData?.name)}
      style={selected ? { borderColor: color + '55', background: 'rgba(255,255,255,0.05)' } : {}}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg relative"
            style={{ background: color + '22', border: `1.5px solid ${color}55` }}>
            {icon}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0f]"
              style={{ background: sb.dot }} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-white leading-tight">{name}</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{role}</div>
          </div>
        </div>
        <span className={`badge ${sb.cls} flex-shrink-0`}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sb.dot }} />
          {sb.label}
        </span>
      </div>

      {/* Current task */}
      {agentData?.current_task && (
        <div className="text-[11px] px-3 py-2 rounded flex items-start gap-2"
          style={{ background: color + '14', border: `1px solid ${color}30` }}>
          <span className="flex-shrink-0 mt-0.5">▶</span>
          <span style={{ color: 'rgba(255,255,255,0.70)' }}>{agentData.current_task}</span>
        </div>
      )}

      {/* Stats: model, tools, sparkline */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(196,0,255,0.12)', color: '#c888ff', border: '1px solid rgba(196,0,255,0.20)', fontFamily: 'JetBrains Mono, monospace' }}>
          {model.replace('claude-', '')}
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
          🔧 {toolCount}
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
          🔗 {relCount}
        </span>
        <Sparkline data={activityTimes} color={color} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {meta?.channel && <span className="text-[11px] font-mono" style={{ color, opacity: 0.8 }}>{meta.channel}</span>}
        <span className="text-[11px] ml-auto flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sb.dot, display: 'inline-block', opacity: 0.7 }} />
          {timeAgo(heartbeatTs)}
        </span>
      </div>
    </div>
  );
}
