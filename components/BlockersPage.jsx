'use client';
import { useEffect, useState, useCallback } from 'react';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#c400ff', low: 'rgba(255,255,255,0.40)' };

export default function BlockersPage({ supabase }) {
  const [blockers, setBlockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', detail: '', severity: 'medium', agent: '' });

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('ops_blockers').select('*').order('created_at', { ascending: false });
    setBlockers(data || []); setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel('blockers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_blockers' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);

  const addBlocker = async () => {
    if (!form.title.trim() || !supabase) return;
    await supabase.from('ops_blockers').insert({
      title: form.title.trim(),
      detail: form.detail.trim() || null,
      severity: form.severity,
      agent: form.agent.trim() || null,
    });
    setForm({ title: '', detail: '', severity: 'medium', agent: '' });
    setShowForm(false);
  };

  const resolveBlocker = async (id) => {
    if (!supabase) return;
    await supabase.from('ops_blockers').update({ resolved: true }).eq('id', id);
  };

  const deleteBlocker = async (id) => {
    if (!supabase) return;
    await supabase.from('ops_blockers').delete().eq('id', id);
  };

  const open = blockers.filter(b => !b.resolved);
  const resolved = blockers.filter(b => b.resolved);

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Blockers</h1>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Active issues preventing progress — {open.length} open</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 rounded text-[11px] font-bold"
          style={{ background: 'rgba(239,68,68,0.20)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
          {showForm ? 'CANCEL' : '+ REPORT BLOCKER'}
        </button>
      </div>

      {showForm && (
        <div className="agent-card mb-4 flex flex-col gap-2">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What's blocking progress?"
            className="bg-transparent text-[13px] text-white outline-none placeholder:text-white/20 border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <input value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} placeholder="Details (optional)"
            className="bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
          <div className="flex gap-2">
            <input value={form.agent} onChange={e => setForm({ ...form, agent: e.target.value })} placeholder="Affected agent"
              className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
              className="bg-transparent text-[11px] outline-none cursor-pointer" style={{ color: SEVERITY_COLORS[form.severity] }}>
              <option value="critical">CRITICAL</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
          </div>
          <button onClick={addBlocker} className="px-3 py-1.5 rounded text-[11px] font-bold self-end"
            style={{ background: 'rgba(239,68,68,0.20)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.30)' }}>
            REPORT
          </button>
        </div>
      )}

      {loading && <Empty msg="Loading..." />}
      {!loading && blockers.length === 0 && !showForm && (
        <div className="py-8 text-center">
          <div className="text-[14px] mb-3" style={{ color: 'rgba(255,255,255,0.30)' }}>No blockers 🎉 — clear runway</div>
          <div className="inline-block text-left agent-card" style={{ maxWidth: 380 }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(196,0,255,0.50)', fontFamily: 'JetBrains Mono, monospace' }}>What is this?</div>
            <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Report and track issues blocking agent progress. Categorize by severity and resolve them to keep the fleet moving.</p>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Examples</div>
            <ul className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              <li>• API rate limit hit on OpenAI — CRITICAL</li>
              <li>• Supabase connection timeout during peak — HIGH</li>
              <li>• Missing .env variable on EC2 instance — MEDIUM</li>
              <li>• Docs not updated for new endpoint — LOW</li>
            </ul>
          </div>
        </div>
      )}

      {open.map(b => {
        const sev = b.severity || 'medium';
        const col = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
        return (
          <div key={b.id} className="agent-card mb-3" style={{ borderLeftWidth: 3, borderLeftColor: col, borderLeftStyle: 'solid' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-white">{b.title}</div>
                {b.detail && <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.50)' }}>{b.detail}</p>}
                {b.agent && <div className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.30)' }}>Agent: {b.agent}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: col + '18', color: col, border: `1px solid ${col}35` }}>
                  {sev.toUpperCase()}
                </span>
                <button onClick={() => resolveBlocker(b.id)} className="text-[11px] px-2 py-0.5 rounded hover:opacity-80"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                  ✓ Resolve
                </button>
                <button onClick={() => deleteBlocker(b.id)} className="text-[12px] hover:text-red-400" style={{ color: 'rgba(255,255,255,0.20)' }}>✕</button>
              </div>
            </div>
          </div>
        );
      })}

      {resolved.length > 0 && (
        <div className="mt-6 opacity-50">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>Resolved ({resolved.length})</div>
          {resolved.map(b => (
            <div key={b.id} className="agent-card mb-2 flex items-center gap-3">
              <span className="text-base">✅</span>
              <span className="text-[13px] text-white flex-1" style={{ textDecoration: 'line-through' }}>{b.title}</span>
              <button onClick={() => deleteBlocker(b.id)} className="text-[12px] hover:text-red-400" style={{ color: 'rgba(255,255,255,0.20)' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ msg }) { return <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{msg}</div>; }
