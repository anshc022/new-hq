'use client';
import { useRef, useEffect } from 'react';
import { AGENTS } from '@/lib/agents';

export default function ChatLog({ messages }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="mil-panel p-6 flex flex-col items-center justify-center gap-2 text-white/15 font-mono text-[11px] min-h-[140px]">
        <span className="text-[8px] tracking-[0.35em] font-orbitron">NO TRANSMISSIONS</span>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="mil-panel overflow-y-auto font-mono text-[11px]"
      style={{ maxHeight: '100%', padding: '2px 0' }}>
      {messages.map((msg, i) => {
        const cfg = AGENTS[msg.agent] || {};
        const ts  = msg.created_at
          ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '';
        return (
          <div key={msg.id || i}
            className="group flex items-start gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: '2px solid transparent' }}
            onMouseEnter={e => { e.currentTarget.style.borderLeftColor = 'rgba(255,255,255,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; }}>
            <span className="text-white/15 text-[8.5px] tabular shrink-0 w-[50px] mt-px">{ts}</span>
            <div className="flex items-center gap-1 shrink-0 min-w-[64px]">
              <span className="text-[11px] opacity-50">{cfg.icon || ''}</span>
              <span className="font-bold text-[9px] text-white/50">{cfg.label || msg.agent || '?'}</span>
            </div>
            <span className="text-white/22 break-words leading-relaxed text-[10px] group-hover:text-white/50 transition-colors">
              {(msg.content || msg.detail || '').slice(0, 300)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
