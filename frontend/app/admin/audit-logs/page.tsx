'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  User,
  Building2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AuditLogItem {
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
  client?: {
    id: string;
    name: string;
  };
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (search.trim()) params.append('search', search.trim());
      if (actionFilter) params.append('action', actionFilter);

      const res = await apiFetch<{
        data: AuditLogItem[];
        meta: { total: number; page: number; totalPages: number };
      }>(`/admin/audit-logs?${params.toString()}`);

      setLogs(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('FAILED') || action.includes('FORBIDDEN') || action.includes('DEACTIVATED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('SUCCESS') || action.includes('CREATED') || action.includes('ACTIVATED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('CHANGED') || action.includes('UPDATED')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-indigo-600" />
            Platform Security & Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable system logs capturing administrative actions, tenant onboarding, status changes, and auth events.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 shadow-xs self-start sm:self-auto cursor-pointer"
          title="Refresh Logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Action Filter */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <form onSubmit={handleSearchSubmit} className="w-full md:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, target entity, user email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
          />
        </form>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">Action Type:</span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-600 font-medium"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">Logins & Auth</option>
            <option value="CLIENT_CREATED">Client Created</option>
            <option value="CLIENT_UPDATED">Client Updated</option>
            <option value="CLIENT_ACTIVATED">Client Activated</option>
            <option value="CLIENT_DEACTIVATED">Client Deactivated</option>
            <option value="CLIENT_PLAN_CHANGED">Plan Changed</option>
            <option value="ADMIN_USER">Admin User Changes</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <ScrollText className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Audit Logs Found</h3>
            <p className="text-xs text-slate-500">No events matched your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Actor (Admin User)</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">Details / Metadata</th>
                  <th className="py-3.5 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-sans text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 font-sans">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4 font-sans text-slate-700">
                      {log.user ? (
                        <div>
                          <p className="font-bold text-slate-900">{log.user.name}</p>
                          <p className="text-[10px] text-slate-400">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System Event</span>
                      )}
                    </td>

                    {/* Target Entity */}
                    <td className="py-3.5 px-4 font-sans text-slate-700">
                      <div>
                        <span className="font-bold text-slate-900">{log.resource}</span>
                        {log.client && (
                          <p className="text-[10px] text-indigo-600 font-medium">{log.client.name}</p>
                        )}
                      </div>
                    </td>

                    {/* Details JSON */}
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate font-sans">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>

                    {/* IP */}
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {log.ipAddress || 'internal'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Showing page {page} of {totalPages} ({total} events)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 shadow-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 shadow-xs cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
