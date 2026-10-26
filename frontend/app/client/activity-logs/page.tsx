'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Activity,
  User,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Clock,
  Layers,
} from 'lucide-react';

interface ActivityLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function ClientActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', '25');
      if (search) q.set('search', search);
      if (actionFilter) q.set('action', actionFilter);
      if (resourceFilter) q.set('resource', resourceFilter);

      const res = await apiFetch<{
        data: ActivityLogItem[];
        meta: { total: number; totalPages: number };
      }>(`/client/activity-logs?${q.toString()}`);
      setLogs(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadge = (action: string) => {
    if (action.includes('LOGIN_SUCCESS')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('FAILED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('CREATED')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (action.includes('DELETED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('UPDATED') || action.includes('RESET')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatDetails = (details: any) => {
    if (!details) return '—';
    if (typeof details === 'string') return details;
    if (details.message) return details.message;
    if (details.reason) return `Reason: ${details.reason}`;
    return Object.entries(details)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Workspace Activity Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time audit trail of client user logins, member creations, role edits, and security events.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by action or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
          >
            <option value="">All Actions</option>
            <option value="CLIENT_LOGIN_SUCCESS">Login Success</option>
            <option value="CLIENT_LOGIN_FAILED">Login Failed</option>
            <option value="CLIENT_USER_CREATED">User Created</option>
            <option value="CLIENT_USER_UPDATED">User Updated</option>
            <option value="TEAM_CREATED">Team Created</option>
            <option value="TEAM_UPDATED">Team Updated</option>
            <option value="PROFILE_UPDATED">Profile Updated</option>
            <option value="PASSWORD_CHANGED">Password Changed</option>
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
          >
            <option value="">All Entities</option>
            <option value="User">User</option>
            <option value="Team">Team</option>
            <option value="Client">Client</option>
          </select>
        </form>

        <span className="text-xs font-semibold text-slate-500">{total} Total Log Records</span>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading activity trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <ScrollText className="w-8 h-8 mx-auto text-slate-300" />
            <p>No activity logs recorded matching current criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-4 px-4">
                      {log.user ? (
                        <div>
                          <p className="font-bold text-slate-900">{log.user.name}</p>
                          <p className="text-[10px] text-slate-400">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System / Anonymous</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadge(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-semibold text-slate-700">{log.resource}</td>

                    <td className="py-4 px-4 text-slate-600 text-[11px] max-w-xs truncate">
                      {formatDetails(log.details)}
                    </td>

                    <td className="py-4 px-4 text-right text-slate-400 font-mono text-[10px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
