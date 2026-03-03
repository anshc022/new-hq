'use client';
import { AGENTS } from '@/lib/agents';

const TYPE_COLORS = {
  error:       { bg: 'rgba(255, 0, 102, 0.08)', text: '#ff0066', border: 'rgba(255, 0, 102, 0.3)' },
  lifecycle:   { bg: 'rgba(0, 136, 255, 0.08)', text: '#0088ff', border: 'rgba(0, 136, 255, 0.3)' },
  'tool-call': { bg: 'rgba(136, 0, 255, 0.08)', text: '#8800ff', border: 'rgba(136, 0, 255, 0.3)' },
  delegation:  { bg: 'rgba(255, 200, 0, 0.08)', text: '#ffc800', border: 'rgba(255, 200, 0, 0.3)' },
  chat:        { bg: 'rgba(0, 255, 136, 0.08)', text: '#00ff88', border: 'rgba(0, 255, 136, 0.3)' },
  task:        { bg: 'rgba(0, 240, 255, 0.08)', text: '#00f0ff', border: 'rgba(0, 240, 255, 0.3)' },
  system:      { bg: 'rgba(255,255,255,0.03)', text: '#556677', border: 'rgba(255,255,255,0.08)' },
};

export default function EventFeed({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="hud-panel p-6 flex flex-col items-center justify-center gap-2 text-white/20 font-mono text-[11px] min-h-[120px]">
        <span className="text-2xl opacity-30">📡</span>
        <span className="text-[9px] tracking-[0.3em] font-orbitron">AWAITING SIGNAL</span>
      </div>
    );
  }

  return (
    <div className="hud-panel p-1 max-h-[300px] overflow-y-auto font-mono text-[11px] smooth-scroll">
      {events.slice(-30).reverse().map((evt, i) => {
        const cfg = AGENTS[evt.agent] || {};
        const ts = evt.created_at ? new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
        const typeKey = (evt.event_type || evt.type || 'event').toLowerCase();
        const typeStyle = TYPE_COLORS[typeKey] || TYPE_COLORS.system;

        return (
          <div key={evt.id || i} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.02] group transition-colors"
            style={{ borderBottom: '1px solid rgba(0, 240, 255, 0.04)' }}>
            <span className="text-white/15 text-[9px] tabular shrink-0 w-[52px] font-mono">{ts}</span>
            <span className="shrink-0 min-w-[58px] text-center text-[8px] font-bold tracking-wider px-2 py-0.5 rounded-sm"
              style={{ background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}` }}>
              {typeKey.toUpperCase()}
            </span>
            <span className="font-bold shrink-0 text-[10px] flex items-center gap-1" style={{ color: cfg.color || '#556677' }}>
              <span className="text-[11px]">{cfg.icon || ''}</span>
              {cfg.label || evt.agent || ''}
            </span>
            <span className="text-white/20 text-[10px] truncate group-hover:text-white/50 transition-colors">
              {evt.title || evt.detail || ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
