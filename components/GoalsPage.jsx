'use client';
import { useEffect, useState, useCallback } from 'react';

export default function GoalsPage({ supabase }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', owner: '', deadline: '', progress: 0 });

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('ops_goals').select('*').order('created_at', { ascending: false });
    setGoals(data || []); setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel('goals-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_goals' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);

  const addGoal = async () => {
    if (!form.title.trim() || !supabase) return;
    await supabase.from('ops_goals').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      owner: form.owner.trim() || null,
      deadline: form.deadline || null,
      progress: parseInt(form.progress) || 0,
      status: 'active',
    });
    setForm({ title: '', description: '', owner: '', deadline: '', progress: 0 });
    setShowForm(false);
  };

  const updateProgress = async (id, progress) => {
    if (!supabase) return;
    const status = progress >= 100 ? 'completed' : 'active';
    await supabase.from('ops_goals').update({ progress, status }).eq('id', id);
  };

  const deleteGoal = async (id) => {
    if (!supabase) return;
    await supabase.from('ops_goals').delete().eq('id', id);
  };

  const active = goals.filter(g => g.status !== 'completed');
  const completed = goals.filter(g => g.status === 'completed');

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Goals</h1>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>OKRs and mission objectives · {active.length} active</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 rounded text-[11px] font-bold"
          style={{ background: 'rgba(196,0,255,0.20)', color: '#c400ff', border: '1px solid rgba(196,0,255,0.30)' }}>
          {showForm ? 'CANCEL' : '+ NEW GOAL'}
        </button>
      </div>

      {showForm && (
        <div className="agent-card mb-4 flex flex-col gap-2">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Goal title"
            className="bg-transparent text-[13px] text-white outline-none placeholder:text-white/20 border-b pb-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)"
            className="bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
          <div className="flex gap-2">
            <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Owner agent"
              className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/20" />
            <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="bg-transparent text-[12px] text-white outline-none" style={{ colorScheme: 'dark' }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Progress:</span>
            <input type="range" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} className="flex-1" />
            <span className="text-[11px] tabular" style={{ color: '#22c55e', fontFamily: 'JetBrains Mono, monospace', minWidth: 32 }}>{form.progress}%</span>
          </div>
          <button onClick={addGoal} className="px-3 py-1.5 rounded text-[11px] font-bold self-end"
            style={{ background: 'rgba(34,197,94,0.20)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.30)' }}>
            CREATE GOAL
          </button>
        </div>
      )}

      {loading && <Empty msg="Loading..." />}
      {!loading && goals.length === 0 && !showForm && (
        <div className="py-8 text-center">
          <div className="text-[14px] mb-3" style={{ color: 'rgba(255,255,255,0.30)' }}>No goals yet. Click + NEW GOAL to create one.</div>
          <div className="inline-block text-left agent-card" style={{ maxWidth: 380 }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(196,0,255,0.50)', fontFamily: 'JetBrains Mono, monospace' }}>What is this?</div>
            <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Define OKRs and mission objectives for the fleet. Track progress with percentage bars and deadlines.</p>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Examples</div>
            <ul className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              <li>• Launch MVP by March 15 — 60% complete</li>
              <li>• Reduce API response latency to &lt;500ms</li>
              <li>• Onboard 100 active users this month</li>
              <li>• Achieve 99.9% agent uptime</li>
            </ul>
          </div>
        </div>
      )}

      {active.map(g => (
        <GoalCard key={g.id} goal={g} onProgress={updateProgress} onDelete={deleteGoal} />
      ))}

      {completed.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Completed ({completed.length})</div>
          {completed.map(g => <GoalCard key={g.id} goal={g} completed onDelete={deleteGoal} />)}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, completed, onProgress, onDelete }) {
  const progress = goal.progress || 0;
  const barColor = progress >= 100 ? '#22c55e' : progress >= 50 ? '#f59e0b' : '#c400ff';
  return (
    <div className="agent-card mb-3" style={{ opacity: completed ? 0.5 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-white">{goal.title}</div>
          {goal.description && <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)' }}>{goal.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[12px] font-bold tabular" style={{ color: barColor, fontFamily: 'JetBrains Mono, monospace' }}>{progress}%</span>
          <button onClick={() => onDelete(goal.id)} className="text-[12px] hover:text-red-400 transition-colors" style={{ color: 'rgba(255,255,255,0.20)' }}>✕</button>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded" style={{ width: `${progress}%`, background: barColor, transition: 'width 0.6s ease' }} />
      </div>
      {!completed && onProgress && (
        <div className="flex items-center gap-2 mt-2">
          <input type="range" min="0" max="100" value={progress}
            onChange={e => onProgress(goal.id, parseInt(e.target.value))}
            className="flex-1" style={{ height: 4 }} />
        </div>
      )}
      <div className="flex items-center gap-3 mt-2">
        {goal.owner && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>Owner: {goal.owner}</span>}
        {goal.deadline && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Due: {goal.deadline}</span>}
      </div>
    </div>
  );
}

function Empty({ msg }) { return <div className="py-10 text-center text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{msg}</div>; }
