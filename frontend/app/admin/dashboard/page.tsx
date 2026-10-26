'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import {
  Building2,
  Users,
  Target,
  Megaphone,
  CheckCircle2,
  ArrowUpRight,
  ShieldAlert,
  Layers,
  Sparkles,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  ScrollText,
} from 'lucide-react';

interface DashboardStats {
  overview: {
    totalClients: number;
    activeClients: number;
    inactiveClients: number;
    activeUsers: number;
    totalUsers: number;
    totalLeads: number;
    totalCampaigns: number;
    totalConversions: number;
    conversionRate: number;
  };
  systemHealth: {
    status: string;
    database: {
      status: string;
      latencyMs: number;
      engine: string;
    };
    services: Array<{ name: string; status: string; latency: string }>;
    uptimeSeconds: number;
  };
  planDistribution: Array<{ plan: string; count: number }>;
  recentClients: Array<{
    id: string;
    name: string;
    businessCategory?: string;
    status: string;
    plan: string;
    createdAt: string;
    _count: { users: number; leads: number };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    resource: string;
    createdAt: string;
    user?: { name: string; email: string };
    client?: { name: string };
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await apiFetch<DashboardStats>('/admin/dashboard/stats');
      setData(stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard statistics.');
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
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-8 w-24 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse shadow-xs" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-sm">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Dashboard Unavailable</h2>
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

  const { overview, planDistribution, recentClients, recentAuditLogs } = data;

  const kpis = [
    {
      title: 'Total Clients',
      value: overview.totalClients,
      sub: `${overview.activeClients} Active Tenants`,
      icon: Building2,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      href: '/admin/clients',
    },
    {
      title: 'Active Users',
      value: overview.activeUsers,
      sub: `${overview.totalUsers} Registered Total`,
      icon: Users,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      href: '/admin/users',
    },
    {
      title: 'Total Leads',
      value: overview.totalLeads,
      sub: 'Across All Tenants',
      icon: Target,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      href: '/admin/clients',
    },
    {
      title: 'Total Campaigns',
      value: overview.totalCampaigns,
      sub: 'Ad Integrations Active',
      icon: Megaphone,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      href: '/admin/clients',
    },
    {
      title: 'Total Conversions',
      value: overview.totalConversions,
      sub: `${overview.conversionRate}% Win Rate`,
      icon: CheckCircle2,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      href: '/admin/clients',
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Platform Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-tenant telemetry and client onboarding status.
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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              href={kpi.href}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between group shadow-xs"
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

      {/* Active Plans Distribution */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Active Plans Distribution
            </h2>
            <p className="text-xs text-slate-500">
              Live breakdown of client organizations enrolled across subscription tiers
            </p>
          </div>
          <Link
            href="/admin/plans"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-start sm:self-auto"
          >
            Manage Subscription Plans <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { tier: 'FREE', name: 'Free Trial', barColor: 'bg-slate-400' },
            { tier: 'STARTER', name: 'Starter Plan', barColor: 'bg-blue-500' },
            { tier: 'PRO', name: 'Professional Plan', barColor: 'bg-indigo-600' },
            { tier: 'ENTERPRISE', name: 'Enterprise Plan', barColor: 'bg-purple-600' },
          ].map((item) => {
            const found = planDistribution.find((p) => p.plan === item.tier);
            const count = found ? found.count : 0;
            const percentage =
              overview.totalClients > 0
                ? Math.round((count / overview.totalClients) * 100)
                : 0;

            return (
              <div
                key={item.tier}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{item.tier}</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {count} client{count !== 1 ? 's' : ''} ({percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.barColor} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{item.name}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Grid: Recent Clients & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Clients Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Recently Onboarded Clients
              </h2>
              <p className="text-xs text-slate-500">Newly registered tenant accounts</p>
            </div>
            <Link
              href="/admin/clients"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentClients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
              No clients registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-500 font-bold bg-slate-50/60">
                    <th className="py-3 px-3">Company</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Users</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentClients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-[11px] text-slate-400">{c.businessCategory || 'General'}</p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {c.plan}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">{c._count.users}</td>
                      <td className="py-3.5 px-3 text-right">
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Audit Activity */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-indigo-600" />
                Audit Trail Feed
              </h2>
              <Link
                href="/admin/audit-logs"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                All Logs
              </Link>
            </div>

            <div className="space-y-3">
              {recentAuditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] truncate max-w-[150px]">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {log.user?.name || 'System'} • {log.client?.name || log.resource}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/admin/audit-logs"
            className="mt-4 pt-4 border-t border-slate-100 text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1"
          >
            Review Security Audit Trail <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
