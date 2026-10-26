'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import {
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  Layers,
  Phone,
  Calendar,
  XCircle,
  ExternalLink,
} from 'lucide-react';

interface AiCallJobItem {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  source: string;
  status: 'PENDING' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  attemptNumber: number;
  scheduledAt: string;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export default function AiCallingPage() {
  const [jobs, setJobs] = useState<AiCallJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchJobs = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (jobs.length === 0) setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<AiCallJobItem[]>('/client/ai-calling/jobs');
      setJobs(data || []);
    } catch (err: any) {
      console.error('Failed to load call jobs:', err);
      setError(err.message || 'Failed to fetch AI call jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Live polling: auto-refresh every 2.5 seconds so status transitions PENDING -> QUEUED -> IN_PROGRESS -> COMPLETED are immediately seen
    const interval = setInterval(() => {
      fetchJobs(false);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Filtered Jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesStatus =
      statusFilter === 'ALL' || job.status === statusFilter;
    const matchesSearch =
      job.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Metrics
  const totalJobs = jobs.length;
  const pendingJobs = jobs.filter((j) => j.status === 'PENDING').length;
  const inProgressJobs = jobs.filter(
    (j) => j.status === 'IN_PROGRESS' || j.status === 'QUEUED',
  ).length;
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED').length;
  const failedJobs = jobs.filter((j) => j.status === 'FAILED').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            PENDING
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            QUEUED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            IN_PROGRESS
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            FAILED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 uppercase tracking-wider">
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 uppercase tracking-wider">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 uppercase tracking-wider">
            LOW
          </span>
        );
    }
  };

  const getSourceBadge = (source: string) => {
    const s = source?.toUpperCase() || 'WEBSITE';
    if (s === 'META') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          META
        </span>
      );
    }
    if (s === 'GOOGLE') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          GOOGLE
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <PhoneCall className="w-4 h-4 text-indigo-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              AI Calling Dispatch Queue
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lead-to-Call workflow verification & automated call job tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchJobs(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Foundation Mode Notice */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <div className="font-bold flex items-center gap-2">
            <span>Lead-to-Call Foundation Active</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
              Module 4 Verification
            </span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Every newly ingested lead automatically triggers eligibility checks and is enqueued as an 
            <strong> AiCallJob</strong> in PostgreSQL. Telephony dispatch, audio streaming, and voice models are currently paused for validation.
          </p>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Call Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalJobs}</div>
          <div className="text-[11px] text-slate-400 mt-1">Queued across all leads</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Pending Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{pendingJobs}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">Awaiting dispatch</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">In Progress</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{inProgressJobs}</div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">Active worker stage</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Processed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {completedJobs + failedJobs}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {completedJobs} completed • {failedJobs} failed
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
            {[
              { id: 'ALL', label: 'All', count: totalJobs },
              { id: 'PENDING', label: 'Pending', count: pendingJobs },
              { id: 'QUEUED', label: 'Queued', count: jobs.filter((j) => j.status === 'QUEUED').length },
              { id: 'IN_PROGRESS', label: 'In Progress', count: jobs.filter((j) => j.status === 'IN_PROGRESS').length },
              { id: 'COMPLETED', label: 'Completed', count: completedJobs },
              { id: 'FAILED', label: 'Failed', count: failedJobs },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    statusFilter === tab.id
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search lead or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-indigo-600 transition"
            />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Loading AI call dispatch jobs...</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          /* Empty State */
          <div className="p-16 text-center text-xs text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No call jobs found</h3>
            <p className="max-w-md mx-auto text-slate-500 text-xs">
              {statusFilter !== 'ALL' || searchQuery
                ? 'No jobs match your current filter criteria.'
                : 'When new leads with valid phone numbers are captured through Meta, Google, or Website forms, AI Call Jobs will automatically appear here.'}
            </p>
          </div>
        ) : (
          /* Jobs Table */
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-600 font-bold">
                  <th className="py-3.5 pl-5 pr-3 text-left min-w-[180px]">Lead</th>
                  <th className="py-3.5 px-3 text-left min-w-[140px] whitespace-nowrap">Phone</th>
                  <th className="py-3.5 px-3 text-left w-[100px] whitespace-nowrap">Source</th>
                  <th className="py-3.5 px-3 text-left w-[120px] whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-3 text-left w-[100px] whitespace-nowrap">Priority</th>
                  <th className="py-3.5 px-3 text-left w-[90px] whitespace-nowrap">Attempt</th>
                  <th className="py-3.5 px-3 text-left min-w-[150px] whitespace-nowrap">Scheduled At</th>
                  <th className="py-3.5 pl-3 pr-5 text-right min-w-[150px] whitespace-nowrap">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/70 transition"
                  >
                    {/* Lead */}
                    <td className="py-3 pl-5 pr-3 text-left align-middle">
                      <div className="font-bold text-slate-900 truncate">
                        {job.leadName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {job.leadId.slice(0, 8)}...
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.phone}</span>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                      {getSourceBadge(job.source)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                      <div>
                        {getStatusBadge(job.status)}
                        {job.lastError && (
                          <div
                            className="text-[10px] text-rose-600 truncate max-w-[160px] mt-1 font-mono"
                            title={job.lastError}
                          >
                            {job.lastError}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                      {getPriorityBadge(job.priority)}
                    </td>

                    {/* Attempt */}
                    <td className="py-3 px-3 text-left whitespace-nowrap font-bold text-slate-700 align-middle">
                      {job.attemptNumber}
                    </td>

                    {/* Scheduled At & Lifecycle */}
                    <td className="py-3 px-3 text-left whitespace-nowrap text-slate-600 align-middle">
                      {job.completedAt ? (
                        <div>
                          <span className="font-semibold text-emerald-700">Completed:</span>{' '}
                          <span className="text-slate-600 font-mono text-[11px]">
                            {new Date(job.completedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : job.startedAt ? (
                        <div>
                          <span className="font-semibold text-indigo-700 animate-pulse">Started:</span>{' '}
                          <span className="text-slate-600 font-mono text-[11px]">
                            {new Date(job.startedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : job.queuedAt ? (
                        <div>
                          <span className="font-semibold text-blue-700">Queued:</span>{' '}
                          <span className="text-slate-600 font-mono text-[11px]">
                            {new Date(job.queuedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : job.scheduledAt ? (
                        <span>
                          {new Date(job.scheduledAt).toLocaleDateString()}{' '}
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(job.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap text-slate-500 align-middle">
                      <span>
                        {new Date(job.createdAt).toLocaleDateString()}{' '}
                        <span className="text-slate-400 font-mono text-[11px]">
                          {new Date(job.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
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
