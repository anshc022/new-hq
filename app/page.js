'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '@/components/Sidebar';
import FleetHeader from '@/components/FleetHeader';
import AgentGrid from '@/components/AgentGrid';
import NodeGraph from '@/components/NodeGraph';
import CommandView from '@/components/CommandView';
import TodosPage from '@/components/TodosPage';
import CronHealthPage from '@/components/CronHealthPage';
import GoalsPage from '@/components/GoalsPage';
import BlockersPage from '@/components/BlockersPage';
import RevenuePage from '@/components/RevenuePage';
import PipelinePage from '@/components/PipelinePage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NAV_LABELS = {
  agents: 'Agent Fleet',
  todos: 'Todos',
  cron: 'Cron Health',
  goals: 'Goals',
  blockers: 'Blockers',
  revenue: 'Revenue',
  pipeline: 'Pipeline',
};

export default function Page() {
  const [nav, setNav] = useState('agents');
  const [view, setView] = useState('GRID');
  const [agents, setAgents] = useState([]);
  const [events, setEvents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [nodeConnected, setNodeConnected] = useState(false);
  const [time, setTime] = useState('');

  // clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // load agents
  const loadAgents = useCallback(async () => {
    const { data } = await supabase.from('ops_agents').select('*');
    if (data) setAgents(data);
  }, []);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('ops_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setEvents(data);
  }, []);

  const loadActivity = useCallback(async () => {
    const { data } = await supabase
      .from('agent_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setActivity(data);
  }, []);

  const loadRelationships = useCallback(async () => {
    const { data } = await supabase.from('agent_relationships').select('*');
    if (data) setRelationships(data);
  }, []);

  useEffect(() => {
    loadAgents();
    loadEvents();
    loadActivity();
    loadRelationships();

    const agentSub = supabase
      .channel('ops_agents_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agents' }, loadAgents)
      .subscribe();

    const eventSub = supabase
      .channel('ops_events_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events' }, (payload) => {
        setEvents(prev => [payload.new, ...prev].slice(0, 60));
      })
      .subscribe((status) => {
        setNodeConnected(status === 'SUBSCRIBED');
      });

    const activitySub = supabase
      .channel('agent_activity_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activity' }, (payload) => {
        setActivity(prev => [payload.new, ...prev].slice(0, 200));
      })
      .subscribe();

    const relSub = supabase
      .channel('agent_relationships_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_relationships' }, loadRelationships)
      .subscribe();

    return () => {
      supabase.removeChannel(agentSub);
      supabase.removeChannel(eventSub);
      supabase.removeChannel(activitySub);
      supabase.removeChannel(relSub);
    };
  }, [loadAgents, loadEvents, loadActivity, loadRelationships]);

  // Compute late crons
  const lateCrons = agents.filter(a => {
    const last = a.last_heartbeat_at || a.last_seen;
    if (!last) return true;
    const interval = (a.heartbeat_interval_min || 15) * 60000;
    return (Date.now() - new Date(last).getTime()) > interval * 2.5;
  }).length;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0a0f', color: '#e8e8e8' }}>
      <Sidebar active={nav} setActive={setNav} />

      <main className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <span style={{ color: '#c400ff', fontFamily: 'Orbitron, monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
              {NAV_LABELS[nav] || nav}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {time}
            </span>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: nodeConnected ? '#22c55e' : '#ef4444', display: 'inline-block', boxShadow: nodeConnected ? '0 0 6px #22c55e' : 'none' }} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: nodeConnected ? '#22c55e' : '#ef4444', letterSpacing: 1 }}>
                {nodeConnected ? 'NODE ONLINE' : 'NODE OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
          {nav === 'agents' && (
            <div className="flex flex-col h-full">
              <FleetHeader agents={agents} view={view} setView={setView} nodeConnected={nodeConnected} lateCrons={lateCrons} />
              <div className="flex-1 overflow-auto p-6" style={{ minHeight: 0 }}>
                {view === 'GRID' && <AgentGrid agents={agents} activity={activity} relationships={relationships} />}
                {view === 'NEURAL' && (
                  <div style={{ width: '100%', height: '100%', minHeight: 480 }}>
                    <NodeGraph agents={agents} relationships={relationships} nodeConnected={nodeConnected} events={events} activity={activity} />
                  </div>
                )}
                {view === 'COMMAND' && <CommandView agents={agents} events={events} activity={activity} supabase={supabase} />}
              </div>
            </div>
          )}
          {nav === 'todos'    && <div className="p-6 h-full overflow-auto"><TodosPage supabase={supabase} /></div>}
          {nav === 'cron'     && <div className="p-6 h-full overflow-auto"><CronHealthPage agents={agents} activity={activity} /></div>}
          {nav === 'goals'    && <div className="p-6 h-full overflow-auto"><GoalsPage supabase={supabase} /></div>}
          {nav === 'blockers' && <div className="p-6 h-full overflow-auto"><BlockersPage supabase={supabase} /></div>}
          {nav === 'revenue'  && <div className="p-6 h-full overflow-auto"><RevenuePage supabase={supabase} /></div>}
          {nav === 'pipeline' && <div className="p-6 h-full overflow-auto"><PipelinePage supabase={supabase} /></div>}
        </div>
      </main>
    </div>
  );
}
