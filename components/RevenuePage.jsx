'use client';
import { useEffect, useState, useCallback } from 'react';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };

export default function RevenuePage({ supabase }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({ label: '', amount: '', currency: 'USD', source: '', agent: '' });

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('ops_revenue').select('*').order('created_at', { ascending: false });
    setEntries(data || []); setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel('revenue-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_revenue' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);

  const addEntry = async () => {
    if (!form.label.trim() || !form.amount || !supabase) return;
    await supabase.from('ops_revenue').insert({
      label: form.label.trim(),
      amount: parseFloat(form.amount),
      currency: form.currency,
      source: form.source.trim() || null,
      agent: form.agent.trim() || null,
    });
    setForm({ label: '', amount: '', currency: 'USD', source: '', agent: '' });
    setShowForm(false);
  };

  const deleteEntry = async (id) => {
    if (!supabase) return;
    await supabase.from('ops_revenue').delete().eq('id', id);
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({ label: entry.label, amount: entry.amount, currency: entry.currency || 'USD', source: entry.source || '', agent: entry.agent || '' });
  };

  const saveEdit = async () => {
    if (!editingId || !supabase) return;
    await supabase.from('ops_revenue').update({
      label: editForm.label.trim(),
      amount: parseFloat(editForm.amount),
      currency: editForm.currency,
      source: editForm.source.trim() || null,
      agent: editForm.agent.trim() || null,
    }).eq('id', editingId);
    setEditingId(null);
    setEditForm({});
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  // revenue stats by currency
  const totals = {};
  entries.forEach(e => {
    const c = e.currency || 'USD';
    totals[c] = (totals[c] || 0) + (e.amount || 0);
  });

  // per-agent breakdown (grouped by currency)
  const byAgent = {};
  entries.forEach(e => {
    const a = e.agent || 'uncategorized';
    const c = e.currency || 'USD';
    if (!byAgent[a]) byAgent[a] = {};
    byAgent[a][c] = (byAgent[a][c] || 0) + (e.amount || 0);
  });
  // Flatten for display — total in dominant currency
  const agentTotals = {};
  Object.entries(byAgent).forEach(([agent, currencies]) => {
    const totalAmt = Object.values(currencies).reduce((s, v) => s + v, 0);
    const dominantCur = Object.entries(currencies).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';
    agentTotals[agent] = { amount: totalAmt, currency: dominantCur };
  });

  const fmt = (amt, cur) => `${CURRENCY_SYMBOLS[cur] || cur}${Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Revenue</h1>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{entries.length} entries tracked</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 rounded text-[11px] font-bold"
          style={{ background: 'rgba(34,197,94,0.20)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.30)' }}>
          {showForm ? 'CANCEL' : '+ ADD ENTRY'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {Object.entries(totals).map(([cur, total]) => (
          <div key={cur} className="agent-card flex-1 min-w-[120px]">
            <div className="text-[10px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>Total {cur}</div>
            <div className="text-[22px] font-bold mt-1" style={{ color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(total, cur)}</div>
          </div>
        ))}
        {entries.length === 0 && !loading && (
          <div className="agent-card flex-1">
            <div className="text-[13px] mb-3" style={{ color: 'rgba(255,255,255,0.30)' }}>No revenue data yet</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(196,0,255,0.50)', fontFamily: 'JetBrains Mono, monospace' }}>What is this?</div>
            <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Track revenue generated by your AI agents. Monitor earnings per agent, by source, and across currencies.</p>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Examples</div>
            <ul className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              <li>• Client payment via Stripe — $500.00</li>
              <li>• Freelance gig completed by Bolt — $200.00</li>
              <li>• SaaS subscription renewal — $99.00/mo</li>
              <li>• Consulting invoice by Echo — ₹15,000</li>
            </ul>
          </div>
        )}
      </div>

      {/* Agent Breakdown */}
      {Object.keys(agentTotals).length > 0 && (
        <div className="agent-card mb-5">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace' }}>By Agent</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(agentTotals).sort((a,b) => b[1].amount - a[1].amount).map(([agent, { amount: amt, currency: cur }]) => {
              const maxAmt = Math.max(...Object.values(agentTotals).map(v => v.amount));
              const pct = maxAmt > 0 ? (amt / maxAmt * 100) : 0;
              return (
                <div key={agent} className="flex items-center gap-2">
                  <span className="text-[11px] w-[80px] truncate" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>{agent}</span>
                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)' }} />
                  </div>
                  <span className="text-[11px] w-[70px] text-right" style={{ color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(amt, cur)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="agent-card mb-4 flex flex-col gap-2">
          <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Label (e.g. Client payment)"
            className="bg-transparent text-[13px] text-white outline-none placeholder:text-white/20 border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <div className="flex gap-2">
            <div className="flex items-center gap-1 flex-1">
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                className="bg-transparent text-[12px] outline-none cursor-pointer" style={{ color: '#22c55e' }}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
              <input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Amount" type="number" step="0.01"
                className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Source (optional)"
              className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
            <input value={form.agent} onChange={e => setForm({ ...form, agent: e.target.value })} placeholder="Agent"
              className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
          </div>
          <button onClick={addEntry} className="px-3 py-1.5 rounded text-[11px] font-bold self-end"
            style={{ background: 'rgba(34,197,94,0.20)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.30)' }}>
            ADD
          </button>
        </div>
      )}

      {loading && <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Loading...</div>}

      {/* Entries list */}
      {entries.map(e => editingId === e.id ? (
        <div key={e.id} className="agent-card mb-2 flex flex-col gap-2" style={{ border: '1px solid rgba(34,197,94,0.30)' }}>
          <div className="flex gap-2">
            <input value={editForm.label} onChange={ev => setEditForm({ ...editForm, label: ev.target.value })}
              className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20" placeholder="Label" />
            <select value={editForm.currency} onChange={ev => setEditForm({ ...editForm, currency: ev.target.value })}
              className="bg-transparent text-[11px] outline-none cursor-pointer" style={{ color: '#22c55e' }}>
              <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option>
            </select>
            <input value={editForm.amount} onChange={ev => setEditForm({ ...editForm, amount: ev.target.value })} type="number" step="0.01"
              className="w-24 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20 text-right" placeholder="Amount" />
          </div>
          <div className="flex gap-2">
            <input value={editForm.source} onChange={ev => setEditForm({ ...editForm, source: ev.target.value })}
              className="flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/20" placeholder="Source" />
            <input value={editForm.agent} onChange={ev => setEditForm({ ...editForm, agent: ev.target.value })}
              className="flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/20" placeholder="Agent" />
            <button onClick={saveEdit} className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ background: 'rgba(34,197,94,0.20)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.30)' }}>SAVE</button>
            <button onClick={cancelEdit} className="px-2 py-0.5 rounded text-[10px]"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div key={e.id} className="agent-card mb-2 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white">{e.label}</span>
              {e.source && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>{e.source}</span>}
            </div>
            <div className="flex gap-3 mt-0.5">
              {e.agent && <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>{e.agent}</span>}
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <span className="text-[15px] font-bold" style={{ color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(e.amount, e.currency)}</span>
          <button onClick={() => startEdit(e)} className="text-[11px] hover:opacity-80" style={{ color: 'rgba(255,255,255,0.30)' }} title="Edit">✎</button>
          <button onClick={() => deleteEntry(e.id)} className="text-[12px] hover:text-red-400" style={{ color: 'rgba(255,255,255,0.20)' }}>✕</button>
        </div>
      ))}
    </div>
  );
}
