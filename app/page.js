'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import NodeGraph from '@/components/NodeGraph';
import AgentsWorking from '@/components/AgentsWorking';
import ChatLog from '@/components/ChatLog';
import EventFeed from '@/components/EventFeed';
import MissionBoard from '@/components/MissionBoard';
import StatsBar from '@/components/StatsBar';
import { AGENTS } from '@/lib/agents';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function Home() {
  const [agents, setAgents] = useState(
    Object.keys(AGENTS).map(name => ({ name, status: 'idle', current_task: null }))
  );
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [nodeConnected, setNodeConnected] = useState(false);
  const supabaseRef = useRef(null);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    supabaseRef.current = sb;

    sb.from('ops_agents').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setAgents(prev => {
          const merged = [...prev];
          data.forEach(row => {
            const idx = merged.findIndex(a => a.name === row.name);
            if (idx >= 0) merged[idx] = { ...merged[idx], ...row };
            else merged.push(row);
          });
          return merged;
        });
      }
    });

    sb.from('ops_events').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      if (data) setEvents(data.reverse());
    });

    sb.from('ops_messages').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      if (data) setMessages(data.reverse());
    });

    sb.from('ops_nodes').select('*').eq('name', 'ec2-main').single().then(({ data }) => {
      if (data) {
        setNodeConnected(Date.now() - new Date(data.last_seen || 0).getTime() < 120000);
      }
    });

    const agentChannel = sb.channel('agents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_agents' }, payload => {
        const row = payload.new;
        if (!row?.name) return;
        setAgents(prev => {
          const idx = prev.findIndex(a => a.name === row.name);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...row };
            return updated;
          }
          return [...prev, row];
        });
      }).subscribe();

    const eventChannel = sb.channel('events-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events' }, payload => {
        if (payload.new) setEvents(prev => [...prev.slice(-99), payload.new]);
      }).subscribe();

    const msgChannel = sb.channel('messages-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_messages' }, payload => {
        if (payload.new) setMessages(prev => [...prev.slice(-99), payload.new]);
      }).subscribe();

    const nodeChannel = sb.channel('nodes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_nodes' }, payload => {
        const row = payload.new;
        if (row?.name === 'ec2-main') {
          setNodeConnected(Date.now() - new Date(row.last_seen || 0).getTime() < 120000);
        }
      }).subscribe();

    const hbInterval = setInterval(() => {
      sb.from('ops_nodes').select('*').eq('name', 'ec2-main').single().then(({ data }) => {
        if (data) {
          setNodeConnected(Date.now() - new Date(data.last_seen || 0).getTime() < 120000);
        } else {
          setNodeConnected(false);
        }
      });
    }, 30000);

    return () => {
      sb.removeChannel(agentChannel);
      sb.removeChannel(eventChannel);
      sb.removeChannel(msgChannel);
      sb.removeChannel(nodeChannel);
      clearInterval(hbInterval);
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-black text-white relative selection:bg-white selection:text-black">
      {/* Scanline overlay */}
      <div className="scanline-overlay pointer-events-none fixed inset-0 z-50" />

      {/* Header */}
      <StatsBar agents={agents} nodeConnected={nodeConnected} />

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-12 grid-rows-[1fr_minmax(220px,auto)] gap-2 p-2 overflow-hidden">

        {/* INTEL FEED — left */}
        <section className="col-span-2 row-span-1 flex flex-col overflow-hidden animate-slide-right">
          <div className="mil-panel flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="mil-header px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-[3px] h-3 bg-white/70" />
                <span className="font-orbitron font-bold text-[9px] tracking-[0.25em] text-white/70">INTEL FEED</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <EventFeed events={events} />
            </div>
          </div>
        </section>

        {/* NEURAL MAP — center */}
        <section className="col-span-8 row-span-1 flex flex-col overflow-hidden animate-fade-in relative">
          <div className="mil-panel flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
            <div className="mil-header px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-[3px] h-3 bg-white/70" />
                <span className="font-orbitron font-bold text-[9px] tracking-[0.25em] text-white/70">NEURAL TOPOLOGY</span>
              </div>
              <span className="font-mono text-[8px] text-white/20 tracking-widest">OPENCLAW · OPSCENTER</span>
            </div>
            <div className="flex-1 w-full h-full flex items-stretch relative min-h-0">
              <NodeGraph agents={agents} nodeConnected={nodeConnected} events={events} />
            </div>
          </div>
        </section>

        {/* SITREP — right */}
        <section className="col-span-2 row-span-1 flex flex-col overflow-hidden animate-slide-left">
          <MissionBoard agents={agents} nodeConnected={nodeConnected} />
        </section>

        {/* OPERATOR FLEET — bottom left */}
        <section className="col-span-8 row-span-1 overflow-hidden animate-slide-up">
          <AgentsWorking agents={agents} events={events} />
        </section>

        {/* COMMS — bottom right */}
        <section className="col-span-4 row-span-1 flex flex-col overflow-hidden animate-slide-up">
          <div className="mil-panel h-full flex flex-col" style={{ padding: 0 }}>
            <div className="mil-header px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-[3px] h-3 bg-white/70" />
                <span className="font-orbitron font-bold text-[9px] tracking-[0.25em] text-white/70">COMMS</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <ChatLog messages={messages} />
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
