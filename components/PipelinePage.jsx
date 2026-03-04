'use client';
import { useEffect, useState, useCallback } from 'react';

const STAGES = ['discovery', 'in_progress', 'review', 'deployed', 'done'];
const STAGE_LABELS = { discovery: 'Discovery', in_progress: 'In Progress', review: 'Review', deployed: 'Deployed', done: 'Done' };
const STAGE_COLORS = { discovery: '#a855f7', in_progress: '#3b82f6', review: '#f59e0b', deployed: '#22c55e', done: 'rgba(255,255,255,0.25)' };
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: 'rgba(255,255,255,0.35)' };

export default function PipelinePage({ supabase }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', agent: '', stage: 'discovery', priority: 'medium' });

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('ops_pipeline').select('*').order('created_at', { ascending: false });
    setItems(data || []); setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel('pipeline-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_pipeline' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);

  const addItem = async () => {
    if (!form.title.trim() || !supabase) return;
    await supabase.from('ops_pipeline').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      agent: form.agent.trim() || null,
      stage: form.stage,
      priority: form.priority,
    });
    setForm({ title: '', description: '', agent: '', stage: 'discovery', priority: 'medium' });
    setShowForm(false);
  };

  const moveStage = async (id, newStage) => {
    if (!supabase) return;
    await supabase.from('ops_pipeline').update({ stage: newStage }).eq('id', id);
  };

  const deleteItem = async (id) => {
    if (!supabase) return;
    await supabase.from('ops_pipeline').delete().eq('id', id);
  };

  // Group by stage
  const byStage = {};
  STAGES.forEach(s => { byStage[s] = []; });
  items.forEach(i => {
    const s = i.stage || 'discovery';
    if (byStage[s]) byStage[s].push(i);
    else byStage.discovery.push(i);
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Pipeline</h1>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{items.length} items across {STAGES.length} stages</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 rounded text-[11px] font-bold"
          style={{ background: 'rgba(59,130,246,0.20)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.30)' }}>
          {showForm ? 'CANCEL' : '+ ADD ITEM'}
        </button>
      </div>

      {showForm && (
        <div className="agent-card mb-5 flex flex-col gap-2">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Pipeline item title"
            className="bg-transparent text-[13px] text-white outline-none placeholder:text-white/20 border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)"
            className="bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
          <div className="flex gap-2">
            <input value={form.agent} onChange={e => setForm({ ...form, agent: e.target.value })} placeholder="Agent"
              className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
            <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}
              className="bg-transparent text-[11px] outline-none cursor-pointer" style={{ color: STAGE_COLORS[form.stage] }}>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="bg-transparent text-[11px] outline-none cursor-pointer" style={{ color: PRIORITY_COLORS[form.priority] }}>
              <option value="high">HIGH</option>
              <option value="medium">MED</option>
              <option value="low">LOW</option>
            </select>
          </div>
          <button onClick={addItem} className="px-3 py-1.5 rounded text-[11px] font-bold self-end"
            style={{ background: 'rgba(59,130,246,0.20)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.30)' }}>
            ADD
          </button>
        </div>
      )}

      {loading && <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Loading...</div>}

      {!loading && items.length === 0 && !showForm && (
        <div className="agent-card mb-5" style={{ maxWidth: 420 }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(196,0,255,0.50)', fontFamily: 'JetBrains Mono, monospace' }}>What is this?</div>
          <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Kanban board to track features, tasks, and deployments through stages: Discovery → In Progress → Review → Deployed → Done.</p>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Examples</div>
          <ul className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
            <li>• WhatsApp bot integration — In Progress</li>
            <li>• Agent auto-scaling on EC2 — Discovery</li>
            <li>• Dashboard real-time analytics — Review</li>
            <li>• Payment gateway setup — Deployed</li>
          </ul>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
        {STAGES.map(stage => {
          const col = STAGE_COLORS[stage];
          const stageItems = byStage[stage];
          return (
            <div key={stage} className="flex-1 min-w-[180px] flex flex-col">
              {/* Stage header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full" style={{ background: col }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: col, fontFamily: 'JetBrains Mono, monospace' }}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>{stageItems.length}</span>
              </div>

              {/* Column */}
              <div className="flex-1 flex flex-col gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                {stageItems.length === 0 && (
                  <div className="text-[11px] text-center py-6" style={{ color: 'rgba(255,255,255,0.15)' }}>No items</div>
                )}
                {stageItems.map(item => {
                  const idx = STAGES.indexOf(stage);
                  const canLeft = idx > 0;
                  const canRight = idx < STAGES.length - 1;
                  const prioCol = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
                  return (
                    <div key={item.id} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.40)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[12px] font-semibold text-white leading-tight">{item.title}</span>
                        <button onClick={() => deleteItem(item.id)} className="text-[10px] hover:text-red-400 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.15)' }}>✕</button>
                      </div>
                      {item.description && <p className="text-[11px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2">
                        {item.agent && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.40)' }}>{item.agent}</span>}
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: prioCol, background: prioCol + '15' }}>{(item.priority || 'med').toUpperCase()}</span>
                      </div>
                      {/* Stage navigation arrows */}
                      <div className="flex justify-between mt-2">
                        {canLeft ? (
                          <button onClick={() => moveStage(item.id, STAGES[idx - 1])} className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-80"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>← {STAGE_LABELS[STAGES[idx - 1]]}</button>
                        ) : <span />}
                        {canRight ? (
                          <button onClick={() => moveStage(item.id, STAGES[idx + 1])} className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-80"
                            style={{ background: col + '20', color: col }}>{STAGE_LABELS[STAGES[idx + 1]]} →</button>
                        ) : <span />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
