'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useClientAuth } from '../../context/ClientAuthContext';
import {
  Users,
  Users2,
  Target,
  Trophy,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Building2,
  Layers,
  ChevronRight,
  Shield,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface DashboardData {
  client: {
    id: string;
    name: string;
    plan: string;
    businessCategory?: string;
    status: string;
    timezone?: string;
  };
  kpis: {
    totalUsers: number;
    activeUsers: number;
    totalTeams: number;
    totalLeads: number;
    wonLeads: number;
    conversionRate: number;
  };
  funnel: Array<{
    id: string;
    name: string;
    order: number;
    color: string;
    probability: number;
    isWon: boolean;
    isLost: boolean;
    count: number;
  }>;
  teams: Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    _count: { members: number; leads: number };
  }>;
  teamPerformance: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    teamName: string;
    assignedLeads: number;
    assignedTasks: number;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    resource: string;
    details?: any;
    createdAt: string;
    user?: { name: string; email: string; role: string };
  }>;
}

export default function ClientDashboardPage() {
  const { user } = useClientAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>('/client/dashboard/stats');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load client dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Workspace Telemetry Unavailable</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { client, kpis, funnel, teams, teamPerformance, recentActivities } = data;

  const kpiCards = [
    {
      title: 'Total Users',
      value: kpis.totalUsers,
      sub: `${kpis.activeUsers} Active Accounts`,
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      href: '/client/users',
    },
    {
      title: 'Active Teams',
      value: kpis.totalTeams,
      sub: 'Sales & Marketing Units',
      icon: Users2,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      href: '/client/teams',
    },
    {
      title: 'Pipeline Leads',
      value: kpis.totalLeads,
      sub: 'Tenant Sales Pipeline',
      icon: Target,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      href: '#funnel',
    },
    {
      title: 'Conversion Win Rate',
      value: `${kpis.conversionRate}%`,
      sub: `${kpis.wonLeads} Won Opportunities`,
      icon: Trophy,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      href: '#funnel',
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {client.name}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {client.plan} TIER
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tenant workspace telemetry, sales funnel pipeline, and team performance overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              href={kpi.href}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between group shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500">{kpi.title}</span>
                <div className={`w-8 h-8 rounded-xl ${kpi.color} border flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition">
                  {kpi.value}
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">{kpi.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Lead Funnel Pipeline Breakdown */}
      <div id="funnel" className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Lead Conversion Funnel & Pipeline Stages
            </h2>
            <p className="text-xs text-slate-500">
              Live deal distribution across custom Kanban pipeline stages
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {funnel.length} Configured Stages
          </span>
        </div>

        {funnel.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
            No pipeline stages configured for this tenant.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {funnel.map((stage) => (
              <div
                key={stage.id}
                className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400">#{stage.order}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate">{stage.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{stage.probability}% Win Prob</p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{stage.count}</span>
                  <span className="text-[10px] text-slate-400">Leads</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2-Column Grid: Team Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Performance Leaderboard */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Team Member Allocation & Performance
              </h2>
              <p className="text-xs text-slate-500">
                Active sales executives, assigned leads, and team units
              </p>
            </div>
            <Link
              href="/client/users"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              All Users <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {teamPerformance.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
              No team members registered in this workspace yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-500 font-bold bg-slate-50/60">
                    <th className="py-3 px-3">Team Member</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Assigned Team</th>
                    <th className="py-3 px-3 text-right">Assigned Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamPerformance.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-600">{u.teamName}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                        {u.assignedLeads}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity Log Feed */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Activity Trail Feed
              </h2>
              <Link
                href="/client/activity-logs"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                All Logs
              </Link>
            </div>

            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No recent activity logs.</div>
              ) : (
                recentActivities.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px] truncate max-w-[150px]">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      {log.user?.name || 'User'} • {log.resource}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            href="/client/activity-logs"
            className="mt-4 pt-4 border-t border-slate-100 text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1"
          >
            Review Full Organization Trail <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
