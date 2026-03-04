'use client';
import { AGENTS } from '@/lib/agents';

const TYPE_STYLES = {
  error:       { text: '#f87171', border: 'rgba(248,113,113,0.35)', bg: 'rgba(248,113,113,0.06)' },
  lifecycle:   { text: 'rgba(255,255,255,0.80)', border: 'rgba(255,255,255,0.22)', bg: 'rgba(255,255,255,0.03)' },
  'tool-call': { text: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.14)', bg: 'transparent' },
  delegation:  { text: 'rgba(255,255,255,0.60)', border: 'rgba(255,255,255,0.16)', bg: 'transparent' },
  chat:        { text: 'rgba(255,255,255,0.65)', border: 'rgba(255,255,255,0.18)', bg: 'rgba(255,255,255,0.02)' },
  task:        { text: 'rgba(255,255,255,0.60)', border: 'rgba(255,255,255,0.15)', bg: 'transparent' },
  system:      { text: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.06)', bg: 'transparent' },
};
const DEF = TYPE_STYLES.system;

export default function EventFeed({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="mil-panel p-6 flex flex-col items-center justify-center gap-2 text-white/15 font-mono text-[11px] min-h-[120px]">
        <span className="text-[8px] tracking-[0.35em] font-orbitron">AWAITING SIGNAL</span>
      </div>
    );
  }

  return (
    <div className="mil-panel max-h-full overflow-y-auto font-mono text-[11px]" style={{ padding: '2px 0' }}>
      {events.slice(-40).reverse().map((evt, i) => {
        const cfg      = AGENTS[evt.agent] || {};
        const ts       = evt.created_at
          ? new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '';
        const typeKey  = (evt.event_type || evt.type || 'event').toLowerCase();
        const s        = TYPE_STYLES[typeKey] || DEF;

        return (
          <div key={evt.id || i}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.025] group transition-colors"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-white/15 text-[8.5px] tabular shrink-0 w-[50px]">{ts}</span>
            <span className="shrink-0 min-w-[56px] text-center text-[7.5px] font-bold tracking-wider px-1.5 py-px border"
              style={{ background: s.bg, color: s.text, borderColor: s.border }}>
              {typeKey.toUpperCase().slice(0, 10)}
            </span>
            <span className="font-bold shrink-0 text-[9px] text-white/45 flex items-center gap-1">
              <span className="text-[10px] opacity-60">{cfg.icon || ''}</span>
              {cfg.label || evt.agent || ''}
            </span>
            <span className="text-white/18 text-[9px] truncate group-hover:text-white/45 transition-colors flex-1">
              {evt.title || evt.detail || ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
