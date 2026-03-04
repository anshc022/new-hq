'use client';

const NAV = [
  { id: 'agents',     icon: BotIcon,     label: 'Agents'      },
  { id: 'todos',      icon: CheckIcon,   label: 'Todos'       },
  { id: 'cron',       icon: ClockIcon,   label: 'Cron Health' },
  { id: 'goals',      icon: TargetIcon,  label: 'Goals'       },
  { id: 'blockers',   icon: BlockIcon,   label: 'Blockers'    },
  { id: 'revenue',    icon: DollarIcon,  label: 'Revenue'     },
  { id: 'pipeline',   icon: PipeIcon,    label: 'Pipeline'    },
];

function BotIcon()    { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="2" y="5" width="12" height="9" rx="1.5"/><circle cx="5.5" cy="9.5" r="1"/><circle cx="10.5" cy="9.5" r="1"/><path d="M8 5V2.5M6 2.5h4"/></svg>; }
function CheckIcon()  { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3 8l3.5 3.5L13 5"/></svg>; }
function ClockIcon()  { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.5V8l2 2"/></svg>; }
function TargetIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.5"/><circle cx="8" cy="8" r="0.8" fill="currentColor" stroke="none"/></svg>; }
function BlockIcon()  { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="8" cy="8" r="5.5"/><path d="M4.1 4.1l7.8 7.8"/></svg>; }
function DollarIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M8 2v12M5.5 5.5C5.5 4.12 6.62 3 8 3s2.5 1.12 2.5 2.5S9.38 8 8 8 5.5 9.12 5.5 10.5 6.62 13 8 13s2.5-1.12 2.5-2.5"/></svg>; }
function PipeIcon()   { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M2 5h3v6H2zM6.5 5h3v6h-3zM11 5h3v6h-3z"/></svg>; }

export default function Sidebar({ active, setActive }) {
  return (
    <aside
      style={{ width: 220, background: '#0a0a0f', borderRight: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}
      className="flex flex-col h-full select-none"
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(196,0,255,0.20)', border: '1px solid rgba(196,0,255,0.35)' }}>
            <span className="text-sm">⚙️</span>
          </div>
          <div>
            <div className="text-white font-bold text-[13px] tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>OpenClaw</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>Command Center</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className="sidebar-nav-item w-full text-left"
              style={isActive ? { background: 'rgba(255,255,255,0.08)', color: '#fff' } : {}}
            >
              <span style={{ opacity: isActive ? 1 : 0.55 }}><Icon /></span>
              <span>{item.label}</span>
              {isActive && <span className="ml-auto w-1 h-4 rounded-full" style={{ background: '#c400ff', boxShadow: '0 0 6px #c400ff' }} />}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button className="sidebar-nav-item w-full text-left" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M10 3l4 5-4 5M6 8h8M2 3v10"/></svg>
          <span className="text-[13px]">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
