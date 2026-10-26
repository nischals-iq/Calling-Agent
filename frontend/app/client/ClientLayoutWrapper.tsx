'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClientAuth } from '../context/ClientAuthContext';
import {
  Layers,
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  UserCheck,
  LogOut,
  Building2,
  Users2,
  ChevronRight,
  Shield,
  Sparkles,
  Target,
  Radio,
  Megaphone,
  PhoneCall,
} from 'lucide-react';

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, client, loading, logout, hasPermission } = useClientAuth();

  // If on client login page, do not render sidebar
  if (pathname === '/client/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/client/login';
    }
    return null;
  }

  const roleBadgeColors: Record<string, string> = {
    CLIENT_ADMIN: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    SALES_MANAGER: 'bg-blue-50 text-blue-700 border-blue-200',
    SALES_EXECUTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MARKETING_USER: 'bg-amber-50 text-amber-700 border-amber-200',
    VIEWER: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const navItems = [
    {
      name: 'Client Dashboard',
      href: '/client/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'Lead Capture',
      href: '/client/leads',
      icon: Target,
      show: true,
    },
    {
      name: 'AI Calling',
      href: '/client/ai-calling',
      icon: PhoneCall,
      show: true,
    },
    {
      name: 'Campaigns',
      href: '/client/campaigns',
      icon: Megaphone,
      show: true,
    },
    {
      name: 'Integrations',
      href: '/client/integrations',
      icon: Radio,
      show: true,
    },
    {
      name: 'Users',
      href: '/client/users',
      icon: Users,
      show: hasPermission('users:view'),
    },
    {
      name: 'Teams',
      href: '/client/teams',
      icon: Users2,
      show: hasPermission('teams:view'),
    },
    {
      name: 'Roles & Permissions',
      href: '/client/roles',
      icon: ShieldCheck,
      show: true,
    },
    {
      name: 'Activity Logs',
      href: '/client/activity-logs',
      icon: ScrollText,
      show: hasPermission('activity_logs:view'),
    },
    {
      name: 'My Profile',
      href: '/client/profile',
      icon: UserCheck,
      show: true,
    },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 shadow-xs z-20">
        <div>
          {/* Tenant Brand Header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {client?.name || 'Client Portal'}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {client?.plan || 'PRO'} TIER
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              CRM Workspace
            </p>
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
          </div>
        </div>

        {/* Sidebar Footer User Card */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                roleBadgeColors[user.role] || 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {user.role.replace(/_/g, ' ')}
            </span>
            <Link
              href="/client/profile"
              className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
            >
              Profile <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-8 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{client?.name || 'Client Portal'}</span>
            <span>/</span>
            <span className="text-slate-900 font-bold capitalize">
              {pathname.split('/')[2] || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-[11px] text-slate-600 font-semibold">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              Tenant ID: <span className="font-mono text-slate-800">{client?.id?.slice(0, 8)}...</span>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{user.role.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="p-8 flex-1 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
