'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from './icon';
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const [health, setHealth] = useState<{ mode: string } | null>(null);
  useEffect(() => { void api<{ mode: string }>('/health').then(setHealth).catch(() => setHealth(null)); }, [path]);
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar">
    <Link href="/" className="brand"><span className="brand-mark"><Icon name="graph" size={23}/></span><span>Orchestrator<span className="brand-sub">AI agent workspace</span></span></Link>
    <div className="workspace-label"><span className="workspace-avatar">P</span><span>Personal workspace<small>Local environment</small></span></div>
    <nav aria-label="Main navigation"><Link href="/" className={path === '/' || path.startsWith('/runs') ? 'nav-link active' : 'nav-link'}><Icon name="graph"/> Playground <span className="nav-key">⌘ 1</span></Link><Link href="/history" className={`nav-link ${path === '/history' ? 'active' : ''}`}><Icon name="history"/> Run history</Link></nav>
    <div className="sidebar-note"><div className="tiny-graph"><i/><i/><i/></div><h3>Built to be observable.</h3><p>Every delegation, token, and decision. All in one trace.</p></div>
    <div className="sidebar-bottom"><span className={`dot ${health ? 'green' : ''}`}/><span>{health ? 'All systems operational' : 'Connecting to API'}</span><small>v0.1</small></div>
  </aside><div className="main-shell"><header className="topbar"><div className="breadcrumbs">Workspace <Icon name="chevron" size={12}/><span>{path === '/history' ? 'Run history' : 'Playground'}</span></div><div className="topbar-right"><span className="environment"><span className={`dot ${health ? 'green' : ''}`}/>{health ? health.mode === 'mock' ? 'Mock mode' : 'Live providers' : 'API offline'}</span><span className="profile">DE</span></div></header><main id="main">{children}</main><footer className="app-footer"><span>AI Agent Orchestrator</span><span>Multi-agent execution. Full visibility.</span></footer></div></div>;
}
