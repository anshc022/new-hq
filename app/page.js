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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#050008] text-[#c400ff] relative selection:bg-[#ffcc00] selection:text-black">
      {/* Immersive HUD Overlays */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-10 background-repeat" />
      <div className="scan-overlay pointer-events-none absolute inset-0 z-50 mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-40" />

      {/* Extreme Sci-Fi Top Bar */}
      <div className="z-30 shrink-0 border-b border-[#c400ff25] bg-[#06010c]/80 backdrop-blur-md pb-1 relative">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-[#ffcc00] to-transparent shadow-[0_0_12px_#ffcc00]" />
        <StatsBar agents={agents} nodeConnected={nodeConnected} />
      </div>

      {/* Main Dashboard Layout - Full Screen Grid */}
      <main className="flex-1 w-full mx-auto p-3 z-10 grid grid-cols-12 grid-rows-[1fr_minmax(230px,auto)] gap-3 overflow-hidden h-full max-w-[1920px]">
        
        {/* Left Column: Live Events */}
        <section className="col-span-2 row-span-1 flex flex-col gap-3 overflow-hidden h-full animate-slide-right">
          <div className="flex-1 flex flex-col min-h-0 bg-[#0c0218]/60 border border-[#c400ff22] rounded-sm relative overflow-hidden backdrop-blur-[3px] shadow-[0_0_22px_rgba(196,0,255,0.05)_inset]">
            <DecoCorners color="#ffcc00" />
            <SectionHeader icon="⚡" title="TELEMETRY" glowColor="#ffcc00" glitch />
            <div className="flex-1 overflow-hidden p-1">
              <EventFeed events={events} />
            </div>
          </div>
        </section>

        {/* Center: Neural Map Visualization */}
        <section className="col-span-8 row-span-1 flex flex-col h-full bg-[#04000c]/50 border border-[#c400ff28] rounded-sm relative overflow-hidden backdrop-blur-sm animate-fade-in shadow-[0_0_60px_rgba(196,0,255,0.07)_inset]">
          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-[2px] border-l-[2px] border-[#ffcc00] z-10" />
          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-[2px] border-r-[2px] border-[#ffcc00] z-10" />
          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-[2px] border-l-[2px] border-[#ffcc00] z-10" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-[2px] border-r-[2px] border-[#ffcc00] z-10" />
          <SectionHeader icon="◈" title="OPENCLAW · NEURAL MAP" glowColor="#c400ff" />
          <div className="flex-1 w-full h-full flex items-stretch relative">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] h-[55%] bg-[#c400ff] blur-[120px] opacity-[0.035] rounded-full pointer-events-none" />
             <NodeGraph agents={agents} nodeConnected={nodeConnected} events={events} />
          </div>
        </section>

        {/* Right Column: Mission Control + System */}
        <section className="col-span-2 row-span-1 flex flex-col gap-3 overflow-hidden h-full animate-slide-left">
          <div className="flex-1 flex flex-col min-h-0 bg-[#0c0218]/60 border border-[#c400ff22] rounded-sm relative overflow-hidden backdrop-blur-[3px] shadow-[0_0_22px_rgba(196,0,255,0.05)_inset]">
            <DecoCorners color="#ff00aa" />
            <SectionHeader icon="◆" title="COMMAND" glowColor="#ff00aa" />
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
              <MissionBoard agents={agents} nodeConnected={nodeConnected} />
            </div>
          </div>
        </section>

        {/* Bottom Bar: Agent Fleet & Comms */}
        <section className="col-span-12 row-span-1 grid grid-cols-12 gap-3 min-h-0 h-full animate-slide-up pb-2">
          
          <div className="col-span-8 bg-[#060014]/80 border border-[#ffcc0028] rounded-sm relative flex flex-col overflow-hidden backdrop-blur-sm shadow-[0_0_20px_rgba(255,204,0,0.04)_inset]">
             <DecoCorners color="#ffcc00" thickness="2px" />
             <div className="absolute right-0 top-0 w-24 h-[1px] bg-gradient-to-l from-transparent to-[#ffcc00] opacity-40" />
             <div className="flex-1 overflow-hidden">
               <AgentsWorking agents={agents} events={events} />
             </div>
          </div>

          <div className="col-span-4 bg-[#060014]/80 border border-[#ff550028] rounded-sm relative flex flex-col overflow-hidden backdrop-blur-sm shadow-[0_0_20px_rgba(255,85,0,0.04)_inset]">
            <DecoCorners color="#ff5500" />
            <SectionHeader icon="💬" title="COMM CHANNELS" glowColor="#ff5500" />
            <div className="flex-1 overflow-hidden p-1 bg-[#020104]/50">
              <ChatLog messages={messages} />
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}

// Ultra Cyberpunk Section Header styles
function SectionHeader({ icon, title, glowColor = "#c400ff", glitch = false }) {
  return (
    <div className="relative px-4 py-2 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] flex items-center gap-3">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: glowColor, boxShadow: `0 0 10px ${glowColor}` }} />
      <span className="text-[12px] opacity-80" style={{ color: glowColor, textShadow: `0 0 8px ${glowColor}80` }}>{icon}</span>
      <h2 className={`font-orbitron font-black text-[11px] tracking-[0.25em] ${glitch ? 'animate-pulse' : ''}`}
          style={{ color: glowColor, textShadow: `0 0 10px ${glowColor}50` }}>
        {title}
      </h2>
      
      {/* Decorative tech lines */}
      <div className="flex-1 flex items-center justify-end gap-1 opacity-30">
        <div className="h-[2px] w-2 bg-current" style={{ color: glowColor }} />
        <div className="h-[2px] w-8 bg-current" style={{ color: glowColor }} />
        <div className="h-[2px] w-1 bg-current" style={{ color: glowColor }} />
      </div>
    </div>
  );
}

function DecoCorners({ color = "#c400ff", thickness = "1px" }) {
  const size = "16px";
  return (
    <>
      <div className="absolute top-0 left-0 pointer-events-none" style={{ width: size, height: size, borderTop: `${thickness} solid ${color}`, borderLeft: `${thickness} solid ${color}` }} />
      <div className="absolute top-0 right-0 pointer-events-none" style={{ width: size, height: size, borderTop: `${thickness} solid ${color}`, borderRight: `${thickness} solid ${color}` }} />
      <div className="absolute bottom-0 left-0 pointer-events-none" style={{ width: size, height: size, borderBottom: `${thickness} solid ${color}`, borderLeft: `${thickness} solid ${color}` }} />
      <div className="absolute bottom-0 right-0 pointer-events-none" style={{ width: size, height: size, borderBottom: `${thickness} solid ${color}`, borderRight: `${thickness} solid ${color}` }} />
    </>
  );
}
