'use client';
import { useEffect, useState, useCallback } from 'react';

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const STATUS_BADGES = {
  dispatching: { label: 'DISPATCHING...', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  running: { label: 'RUNNING', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  done: { label: 'DONE', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
};

export default function TodosPage({ supabase }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dispatching, setDispatching] = useState(false);

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
    if (!title.trim() || dispatching) return;
    setDispatching(true);
    try {
      const res = await fetch('/api/todo-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), priority }),
      });
      const result = await res.json();
      if (result.ok) {
        setTitle(''); setPriority('medium');
      }
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setDispatching(false);
    }
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
            placeholder="Describe the task for AI agents..." className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20"
            disabled={dispatching} />
          <select value={priority} onChange={e => setPriority(e.target.value)}
            className="bg-transparent text-[11px] outline-none cursor-pointer" style={{ color: PRIORITY_COLORS[priority] }}
            disabled={dispatching}>
            <option value="high">HIGH</option>
            <option value="medium">MED</option>
            <option value="low">LOW</option>
          </select>
          <button onClick={addTodo} disabled={dispatching || !title.trim()}
            className="px-3 py-1 rounded text-[11px] font-bold transition-all"
            style={{
              background: dispatching ? 'rgba(168,85,247,0.30)' : 'rgba(196,0,255,0.20)',
              color: dispatching ? '#a855f7' : '#c400ff',
              border: `1px solid ${dispatching ? 'rgba(168,85,247,0.50)' : 'rgba(196,0,255,0.30)'}`,
              opacity: (!title.trim() && !dispatching) ? 0.4 : 1,
            }}>
            {dispatching ? '⏳' : '🚀 DISPATCH'}
          </button>
        </div>
        {dispatching && (
          <div className="mt-2 text-[10px] tracking-wider animate-pulse" style={{ color: 'rgba(168,85,247,0.70)', fontFamily: 'JetBrains Mono, monospace' }}>
            Dispatching to Echo → agents will handle automatically...
          </div>
        )}
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
  const hasRunId = !!todo.run_id;
  const statusKey = done ? 'done' : hasRunId ? 'running' : null;
  const badge = statusKey ? STATUS_BADGES[statusKey] : null;

  return (
    <div className="agent-card flex items-start gap-3" style={{ opacity: done ? 0.5 : 1 }}>
      <button onClick={() => onToggle(todo.id, todo.done)} className="mt-0.5 text-base flex-shrink-0 cursor-pointer hover:scale-110 transition-transform">
        {done ? '☑' : '☐'}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-white" style={{ textDecoration: done ? 'line-through' : '' }}>
          {todo.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {todo.agent && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>⚙️ {todo.agent}</span>}
          {todo.source && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {todo.source === 'dashboard' ? '🖥️' : '📋'} {todo.source}
          </span>}
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
              background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`,
              fontFamily: 'JetBrains Mono, monospace',
              ...(statusKey === 'running' ? { animation: 'pulse 2s infinite' } : {}),
            }}>
              {badge.label}
            </span>
          )}
        </div>
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
