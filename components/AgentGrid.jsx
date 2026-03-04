'use client';
import { getMergedMeta } from '@/lib/agents';
import AgentCard from './AgentCard';

export default function AgentGrid({ agents, activity, relationships }) {
  return (
    <div className="grid grid-cols-1 gap-4 p-1 animate-fade-in"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
      {agents.map(a => {
        const meta = getMergedMeta(a.name, a);
        const agentActivity = (activity || []).filter(act => act.agent === a.name || act.agent === meta?.key);
        const relCount = (relationships || []).filter(r => r.source_agent === a.name || r.target_agent === a.name).length;
        return (
          <AgentCard
            key={a.name}
            agentData={a}
            meta={meta}
            recentActivity={agentActivity}
            relationshipCount={relCount}
          />
        );
      })}
    </div>
  );
}
