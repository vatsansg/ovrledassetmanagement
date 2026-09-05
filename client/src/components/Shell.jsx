import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Settings as SettingsIcon, PlayCircle, History, Menu, Moon, Sun } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/processing', label: 'Processing', icon: PlayCircle },
  { to: '/runs', label: 'Run History', icon: History },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
];

export default function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary text-text-primary">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed z-30 h-full w-56 shrink-0 border-r border-border bg-bg-secondary transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center px-4 text-sm font-semibold">LED Asset Manager</div>
        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-border bg-bg-secondary px-4">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="hidden lg:block" />
          <button className="btn-secondary !px-2 !py-1.5" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
