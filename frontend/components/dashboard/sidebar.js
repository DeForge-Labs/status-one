'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import ThemeSelector from '@/components/theme-selector';
import clsx from 'clsx';
import {
  LayoutDashboard, Monitor, AlertTriangle, Globe, Bell,
  Wrench, Settings, Users, Key, User, LogOut, ChevronLeft,
  ChevronRight, Activity, Menu, X
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/monitors', icon: Monitor, label: 'Monitors' },
  { href: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { href: '/status-pages', icon: Globe, label: 'Status Pages' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { divider: true },
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/api-keys', icon: Key, label: 'API Keys' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm cursor-pointer"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed top-0 left-0 z-40 h-screen flex flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--color-border)]">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-6 w-6" />
              <span className="text-base font-bold text-[var(--color-text)]">Status One</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto">
              <img src="/logo.png" alt="Logo" className="h-6 w-6" />
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-[var(--color-sidebar-hover)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navItems.map((item, i) => {
            if (item.divider) {
              return <div key={i} className="my-2 border-t border-[var(--color-border)]" />;
            }
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5',
                  isActive
                    ? 'bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-active-text)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] p-3 space-y-2">
          {!collapsed && <ThemeSelector compact />}
          
          <Link
            href="/profile"
            onClick={() => setMobileOpen(false)}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
              'text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]'
            )}
          >
            <User size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{user?.name || 'Profile'}</span>}
          </Link>

          <button
            onClick={logout}
            className={clsx(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer',
              'text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-500'
            )}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>

          {/* Collapse toggle - desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full p-2 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-sidebar-hover)] transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
