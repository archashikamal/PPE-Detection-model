import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Video, Map, AlertTriangle, Settings } from 'lucide-react';

const Layout = () => {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/monitor', icon: Video, label: 'Live Monitor' },
    { to: '/zones', icon: Map, label: 'Zone Config' },
    { to: '/violations', icon: AlertTriangle, label: 'Violations' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-raised border-r border-surface-border flex flex-col h-full shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-black text-safety-yellow tracking-wider">PPE WATCH</h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">Compliance Monitor</p>
        </div>
        
        <nav className="flex-1 px-4 mt-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-surface text-safety-yellow' 
                    : 'text-gray-300 hover:text-white hover:bg-surface/50'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-border text-xs text-gray-500 font-mono">
          <p>System Status: <span className="text-compliant-green">Online</span></p>
          <p className="mt-1">v1.0.0-beta</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-surface relative">
        <div className="p-8 pb-20 max-w-7xl mx-auto min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
