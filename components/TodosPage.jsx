'use client';
import { useEffect, useState, useCallback } from 'react';

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

export default function TodosPage({ supabase }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [agent, setAgent] = useState('');
  const [priority, setPriority] = useState('medium');

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('ops_todos').select('*').order('created_at', { ascending: false });
    setTodos(data || []); setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel('todos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_todos' }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [supabase, load]);

  const addTodo = async () => {
    if (!title.trim() || !supabase) return;
    await supabase.from('ops_todos').insert({ title: title.trim(), agent: agent.trim() || null, priority });
    setTitle(''); setAgent(''); setPriority('medium');
  };

  const toggleTodo = async (id, done) => {
    if (!supabase) return;
    await supabase.from('ops_todos').update({ done: !done }).eq('id', id);
  };

  const deleteTodo = async (id) => {
    if (!supabase) return;
    await supabase.from('ops_todos').delete().eq('id', id);
  };

  const done = todos.filter(t => t.done);
  const open = todos.filter(t => !t.done);

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageTitle icon="✅" title="Todos" subtitle={`${open.length} open · ${done.length} completed`} />

      {/* Add form */}
      <div className="agent-card mb-4">
        <div className="flex gap-2">
          <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="What needs to be done?" className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20" />
          <input value={agent} onChange={e => setAgent(e.target.value)}
            placeholder="Agent" className="w-20 bg-transparent text-[12px] text-white outline-none placeholder:text-white/20 text-center border-l" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <select value={priority} onChange={e => setPriority(e.target.value)}
            className="bg-transparent text-[11px] outline-none cursor-pointer" style={{ color: PRIORITY_COLORS[priority] }}>
            <option value="high">HIGH</option>
            <option value="medium">MED</option>
            <option value="low">LOW</option>
          </select>
          <button onClick={addTodo} className="px-3 py-1 rounded text-[11px] font-bold"
            style={{ background: 'rgba(196,0,255,0.20)', color: '#c400ff', border: '1px solid rgba(196,0,255,0.30)' }}>
            ADD
          </button>
        </div>
      </div>

      {loading && <EmptyState msg="Loading..." />}
      {!loading && todos.length === 0 && (
        <div className="py-8 text-center">
          <div className="text-[14px] mb-3" style={{ color: 'rgba(255,255,255,0.30)' }}>No todos yet. Add one above.</div>
          <div className="inline-block text-left agent-card" style={{ maxWidth: 380 }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(196,0,255,0.50)', fontFamily: 'JetBrains Mono, monospace' }}>What is this?</div>
            <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Track tasks assigned to your AI agents. Prioritize work and monitor completion across the fleet.</p>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Examples</div>
            <ul className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              <li>• Review PRs for openclaw-hq</li>
              <li>• Deploy WhatsApp bot to production</li>
              <li>• Fix authentication bug in gateway</li>
              <li>• Write unit tests for heartbeat API</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {open.map(t => <TodoItem key={t.id} todo={t} onToggle={toggleTodo} onDelete={deleteTodo} />)}
        {done.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-bold tracking-widest mb-2 uppercase" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>Completed ({done.length})</div>
            {done.map(t => <TodoItem key={t.id} todo={t} done onToggle={toggleTodo} onDelete={deleteTodo} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TodoItem({ todo, done, onToggle, onDelete }) {
  const pri = todo.priority || 'medium';
  const col = PRIORITY_COLORS[pri] || PRIORITY_COLORS.medium;
  return (
    <div className="agent-card flex items-start gap-3" style={{ opacity: done ? 0.5 : 1 }}>
      <button onClick={() => onToggle(todo.id, todo.done)} className="mt-0.5 text-base flex-shrink-0 cursor-pointer hover:scale-110 transition-transform">
        {done ? '☑' : '☐'}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-white" style={{ textDecoration: done ? 'line-through' : '' }}>
          {todo.title}
        </div>
        {todo.agent && <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Agent: {todo.agent}</div>}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
        style={{ background: col + '20', color: col, border: `1px solid ${col}35` }}>
        {pri.toUpperCase()}
      </span>
      <button onClick={() => onDelete(todo.id)} className="text-[12px] flex-shrink-0 hover:text-red-400 transition-colors" style={{ color: 'rgba(255,255,255,0.20)' }}>✕</button>
    </div>
  );
}

function PageTitle({ icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <h1 className="text-[20px] font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>{title}</h1>
      </div>
      {subtitle && <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{subtitle}</p>}
    </div>
  );
}

function EmptyState({ msg }) {
  return <div className="text-[13px] py-10 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>{msg}</div>;
}
