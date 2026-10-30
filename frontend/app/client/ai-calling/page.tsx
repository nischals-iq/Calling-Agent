'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Layers,
  Phone,
  Calendar,
  XCircle,
  ExternalLink,
  ChevronRight,
  X,
  PhoneOff,
  PhoneMissed,
  Bot,
  User,
  Copy,
  Check,
  Volume2,
  MessageSquare,
} from 'lucide-react';
import ConversationPlayground from './ConversationPlayground';

export interface AiCallSessionSummary {
  id: string;
  provider: string;
  providerCallId: string;
  status: 'INITIATED' | 'RINGING' | 'CONNECTED' | 'BUSY' | 'NO_ANSWER' | 'FAILED' | 'COMPLETED' | 'CANCELLED';
  outcome?: string | null;
  durationSeconds: number;
  recordingReference?: string | null;
  startedAt?: string | null;
  connectedAt?: string | null;
  endedAt?: string | null;
  isSimulated: boolean;
}

export interface AiCallMessageItem {
  id: string;
  sessionId: string;
  speaker: 'AGENT' | 'PROSPECT' | 'SYSTEM';
  transcriptText: string;
  languageCode?: string | null;
  turnOrder: number;
  createdAt: string;
}

export interface AiCallSessionDetail extends AiCallSessionSummary {
  qualificationScore?: number | null;
  summary?: string | null;
  metadata?: any;
  createdAt: string;
  messages: AiCallMessageItem[];
}

export interface AiCallJobItem {
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
  metadata?: any;
  createdAt: string;
  latestSession?: AiCallSessionSummary | null;
}

export interface AiCallJobDetail extends AiCallJobItem {
  lead?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    source: string;
    stage?: any;
    doNotCall: boolean;
    preferredLanguage?: string | null;
    createdAt: string;
  };
  sessions: AiCallSessionDetail[];
}

/**
 * Deep value comparison between two job arrays to avoid unnecessary React state updates and re-renders
 */
function areJobsEqual(prev: AiCallJobItem[], next: AiCallJobItem[]): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const n = next[i];
    if (
      p.id !== n.id ||
      p.status !== n.status ||
      p.priority !== n.priority ||
      p.attemptNumber !== n.attemptNumber ||
      p.scheduledAt !== n.scheduledAt ||
      p.queuedAt !== n.queuedAt ||
      p.startedAt !== n.startedAt ||
      p.completedAt !== n.completedAt ||
      p.failedAt !== n.failedAt ||
      p.lastError !== n.lastError ||
      p.leadName !== n.leadName ||
      p.phone !== n.phone ||
      p.source !== n.source ||
      p.latestSession?.id !== n.latestSession?.id ||
      p.latestSession?.status !== n.latestSession?.status ||
      p.latestSession?.outcome !== n.latestSession?.outcome ||
      p.latestSession?.durationSeconds !== n.latestSession?.durationSeconds ||
      p.latestSession?.recordingReference !== n.latestSession?.recordingReference ||
      p.latestSession?.isSimulated !== n.latestSession?.isSimulated
    ) {
      return false;
    }
  }
  return true;
}

export default function AiCallingPage() {
  const [activeTab, setActiveTab] = useState<'queue' | 'playground'>('queue');
  const [jobs, setJobs] = useState<AiCallJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Details Drawer State
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<AiCallJobDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Synchronization and concurrency guards
  const isFetchingRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const isFetchingDetailsRef = useRef(false);
  const isMountedRef = useRef(true);
  const jobsRef = useRef<AiCallJobItem[]>([]);
  const selectedJobIdRef = useRef<string | null>(null);

  // Sync ref with selectedJobId state
  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  const fetchJobs = useCallback(async (isManual = false) => {
    // Prevent overlapping background requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isManual) {
      setRefreshing(true);
    } else if (isInitialLoadRef.current) {
      setLoading(true);
    }

    try {
      const data = await apiFetch<AiCallJobItem[]>('/client/ai-calling/jobs');
      if (!isMountedRef.current) return;

      const newJobs = data || [];

      // Only update state if data has meaningfully changed
      if (!areJobsEqual(jobsRef.current, newJobs)) {
        jobsRef.current = newJobs;
        setJobs(newJobs);
      }

      setError(null);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to load call jobs:', err);
      // Only show error on initial load or explicit manual refresh to prevent transient flickering
      if (isManual || isInitialLoadRef.current) {
        setError(err.message || 'Failed to fetch AI call jobs');
      }
    } finally {
      if (isMountedRef.current) {
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          setLoading(false);
        }
        if (isManual) {
          setRefreshing(false);
        }
      }
      isFetchingRef.current = false;
    }
  }, []);

  const fetchJobDetails = useCallback(async (jobId: string, isSilent = false) => {
    if (isFetchingDetailsRef.current) return;
    isFetchingDetailsRef.current = true;

    if (!isSilent) {
      setDetailsLoading(true);
      setDetailsError(null);
    }

    try {
      const data = await apiFetch<AiCallJobDetail>(`/client/ai-calling/jobs/${jobId}`);
      if (!isMountedRef.current) return;

      // Only update details if changed
      setJobDetails((prev) => {
        if (!prev) return data;
        const prevFingerprint = `${prev.status}-${prev.attemptNumber}-${prev.sessions?.length}-${prev.latestSession?.status}-${prev.sessions?.[0]?.messages?.length}`;
        const newFingerprint = `${data.status}-${data.attemptNumber}-${data.sessions?.length}-${data.latestSession?.status}-${data.sessions?.[0]?.messages?.length}`;
        return prevFingerprint === newFingerprint ? prev : data;
      });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Failed to load job details:', err);
      if (!isSilent) {
        setDetailsError(err.message || 'Failed to load call session details');
      }
    } finally {
      if (isMountedRef.current && !isSilent) {
        setDetailsLoading(false);
      }
      isFetchingDetailsRef.current = false;
    }
  }, []);

  const openDetails = (jobId: string) => {
    selectedJobIdRef.current = jobId;
    setSelectedJobId(jobId);
    fetchJobDetails(jobId, false);
  };

  const closeDetails = () => {
    selectedJobIdRef.current = null;
    setSelectedJobId(null);
    setJobDetails(null);
    setDetailsError(null);
  };

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Initial load
    fetchJobs(false);

    // 2. Silent live polling every 2.5 seconds
    const interval = setInterval(() => {
      // Pause polling if browser tab is hidden to save resources and avoid queued renders
      if (typeof document !== 'undefined' && document.hidden) return;

      fetchJobs(false);

      // Silently sync open drawer details if currently viewing a job
      if (selectedJobIdRef.current) {
        fetchJobDetails(selectedJobIdRef.current, true);
      }
    }, 2500);

    // 3. Tab visibility listener: resume immediately when user returns to tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchJobs(false);
        if (selectedJobIdRef.current) {
          fetchJobDetails(selectedJobIdRef.current, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchJobs, fetchJobDetails]);

  // Keyboard shortcut to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedJobId) {
        closeDetails();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJobId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Jobs (memoized)
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesStatus =
        statusFilter === 'ALL' || job.status === statusFilter;
      const matchesSearch =
        job.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.latestSession?.providerCallId &&
          job.latestSession.providerCallId.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [jobs, statusFilter, searchQuery]);

  // Metrics (memoized)
  const totalJobs = jobs.length;
  const pendingJobs = useMemo(() => jobs.filter((j) => j.status === 'PENDING').length, [jobs]);
  const inProgressJobs = useMemo(
    () => jobs.filter((j) => j.status === 'IN_PROGRESS' || j.status === 'QUEUED').length,
    [jobs],
  );
  const completedJobs = useMemo(() => jobs.filter((j) => j.status === 'COMPLETED').length, [jobs]);
  const failedJobs = useMemo(() => jobs.filter((j) => j.status === 'FAILED').length, [jobs]);

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

  const getTelephonyBadge = (status?: string | null) => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
          No Session
        </span>
      );
    }
    switch (status) {
      case 'INITIATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            INITIATED
          </span>
        );
      case 'RINGING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <PhoneCall className="w-3 h-3 text-purple-500 animate-bounce" />
            RINGING
          </span>
        );
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            CONNECTED
          </span>
        );
      case 'BUSY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <PhoneOff className="w-3 h-3 text-orange-500" />
            BUSY
          </span>
        );
      case 'NO_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <PhoneMissed className="w-3 h-3 text-amber-500" />
            NO_ANSWER
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            FAILED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 className="w-3 h-3 text-teal-500" />
            COMPLETED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getOutcomeBadge = (outcome?: string | null) => {
    if (!outcome) return null;
    const isSuccess = outcome === 'QUALIFIED_LEAD' || outcome === 'INTERESTED';
    const isBusyOrNoAns = outcome === 'BUSY' || outcome === 'NO_ANSWER';
    const isOptOut = outcome === 'NOT_INTERESTED' || outcome === 'OPTOUT' || outcome === 'DNC';

    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Sparkles className="w-3 h-3 text-emerald-600" />
          {outcome}
        </span>
      );
    }
    if (isBusyOrNoAns) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          {outcome}
        </span>
      );
    }
    if (isOptOut) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          {outcome}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {outcome}
      </span>
    );
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
              AI Calling Dispatch Queue & Call Lifecycle
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lead-to-Call workflow verification, telephony lifecycle & automated session tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'queue' && (
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
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Dispatch Queue & Call Sessions</span>
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'playground'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Conversation Playground</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
              activeTab === 'playground'
                ? 'bg-indigo-700 text-white'
                : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            
          </span>
        </button>
      </div>

      {activeTab === 'playground' ? (
        <ConversationPlayground />
      ) : (
        <>
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
            {completedJobs} completed &bull; {failedJobs} failed
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
              placeholder="Search lead, phone, provider ID..."
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
                  <th className="py-3.5 pl-5 pr-3 text-left min-w-[170px]">Lead</th>
                  <th className="py-3.5 px-3 text-left min-w-[130px] whitespace-nowrap">Phone</th>
                  <th className="py-3.5 px-3 text-left w-[85px] whitespace-nowrap">Source</th>
                  <th className="py-3.5 px-3 text-left min-w-[130px] whitespace-nowrap">Queue Status</th>
                  <th className="py-3.5 px-3 text-left min-w-[190px] whitespace-nowrap">Telephony & Session</th>
                  <th className="py-3.5 px-3 text-left w-[75px] whitespace-nowrap">Attempt</th>
                  <th className="py-3.5 px-3 text-left min-w-[160px] whitespace-nowrap">Scheduled / Retry</th>
                  <th className="py-3.5 pl-3 pr-5 text-right w-[110px] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const isFutureRetry =
                    job.status === 'QUEUED' &&
                    new Date(job.scheduledAt).getTime() > Date.now();

                  return (
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

                      {/* Queue Status */}
                      <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                        <div>
                          {getStatusBadge(job.status)}
                          {job.lastError && (
                            <div
                              className="text-[10px] text-rose-600 truncate max-w-[150px] mt-1 font-mono"
                              title={job.lastError}
                            >
                              {job.lastError}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Telephony & Session Info */}
                      <td className="py-3 px-3 text-left align-middle">
                        {job.latestSession ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {getTelephonyBadge(job.latestSession.status)}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span>
                                Duration:{' '}
                                <strong className="text-slate-700 font-mono">
                                  {job.latestSession.durationSeconds}s
                                </strong>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Awaiting session
                          </span>
                        )}
                      </td>

                      {/* Attempt */}
                      <td className="py-3 px-3 text-left whitespace-nowrap font-bold text-slate-700 align-middle">
                        {job.attemptNumber}
                      </td>

                      {/* Scheduled / Retry Lifecycle */}
                      <td className="py-3 px-3 text-left whitespace-nowrap text-slate-600 align-middle">
                        {isFutureRetry ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-amber-700 flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                              Retry Scheduled:
                            </span>
                            <span className="text-slate-800 font-mono text-[11px] font-semibold">
                              {new Date(job.scheduledAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Next Attempt #{job.attemptNumber + 1}
                            </span>
                          </div>
                        ) : job.completedAt ? (
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

                      {/* Action */}
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap align-middle">
                        <button
                          onClick={() => openDetails(job.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 hover:text-indigo-700 transition cursor-pointer border border-indigo-100 shadow-2xs"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Call Details Drawer */}
      {selectedJobId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={closeDetails}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 z-10 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    AI Call Session Details
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full lifecycle timeline, telephony session & transcript inspection
                </p>
              </div>

              <button
                onClick={closeDetails}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Close drawer (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
              {detailsLoading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs">Loading call session details...</span>
                </div>
              ) : detailsError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Failed to load details</span>
                  </div>
                  <p>{detailsError}</p>
                  <button
                    onClick={() => fetchJobDetails(selectedJobId)}
                    className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-bold text-[11px] text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : jobDetails ? (
                <>
                  {/* Lead & Job Identity Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Lead Identity
                      </span>
                      {getSourceBadge(jobDetails.source || jobDetails.lead?.source || 'WEBSITE')}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Full Name</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {jobDetails.leadName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Phone Number</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {jobDetails.phone || jobDetails.lead?.phone || '—'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 text-[10px] block">Call Job ID</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700 truncate">
                            {jobDetails.id}
                          </code>
                          <button
                            onClick={() => copyToClipboard(jobDetails.id, 'jobId')}
                            className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            title="Copy Job ID"
                          >
                            {copiedId === 'jobId' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Queue Lifecycle & Retries */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Queue Lifecycle & Attempts
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                        <span className="text-slate-500">Queue Status:</span>
                        <div>{getStatusBadge(jobDetails.status)}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                        <span className="text-slate-500">Attempt Count:</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {jobDetails.attemptNumber} / 3 max
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                        <span className="text-slate-500">Scheduled At:</span>
                        <span className="font-mono text-slate-700">
                          {new Date(jobDetails.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                      {jobDetails.startedAt && (
                        <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                          <span className="text-slate-500">Dispatch Started:</span>
                          <span className="font-mono text-slate-700">
                            {new Date(jobDetails.startedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {jobDetails.completedAt && (
                        <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                          <span className="text-slate-500">Completed At:</span>
                          <span className="font-mono text-emerald-700 font-semibold">
                            {new Date(jobDetails.completedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Retry Schedule Notice */}
                      {jobDetails.status === 'QUEUED' &&
                        new Date(jobDetails.scheduledAt).getTime() > Date.now() && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>Automated Retry Scheduled</span>
                            </div>
                            <p className="text-[11px] text-amber-700">
                              Next attempt will execute at{' '}
                              <strong>
                                {new Date(jobDetails.scheduledAt).toLocaleTimeString()}
                              </strong>
                              . Worker will automatically re-evaluate Module 4.2 calling eligibility before dialing.
                            </p>
                          </div>
                        )}

                      {/* Last Error Notice */}
                      {jobDetails.lastError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>Failure Reason</span>
                          </div>
                          <p className="text-[11px] font-mono text-rose-700 break-all">
                            {jobDetails.lastError}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Telephony Sessions Section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                      <span>Telephony Sessions ({jobDetails.sessions.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Order: Most recent first
                      </span>
                    </h3>

                    {jobDetails.sessions.length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1">
                        <PhoneCall className="w-6 h-6 text-slate-300 mx-auto" />
                        <div className="text-xs font-bold text-slate-700">
                          No Telephony Sessions Recorded
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          When the worker picks up this job and initiates dialing, session records and timestamps will appear here.
                        </p>
                      </div>
                    ) : (
                      jobDetails.sessions.map((session, sIdx) => (
                        <div
                          key={session.id}
                          className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-4 shadow-2xs"
                        >
                          {/* Session Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              {getTelephonyBadge(session.status)}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Attempt #{jobDetails.sessions.length - sIdx}
                            </span>
                          </div>

                          {/* Session Attributes Grid */}
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px] block">Provider</span>
                              <span className="font-bold text-slate-800">
                                {session.provider}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Call Duration</span>
                              <span className="font-bold text-slate-800 font-mono">
                                {session.durationSeconds} seconds
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Business Outcome</span>
                              <div className="mt-0.5">
                                {getOutcomeBadge(session.outcome) || (
                                  <span className="text-slate-500 font-medium">Pending</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Provider Call ID</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <code className="text-[10px] bg-slate-50 px-1.5 py-0.5 rounded font-mono text-slate-700 truncate max-w-[120px]">
                                  {session.providerCallId}
                                </code>
                                <button
                                  onClick={() =>
                                    copyToClipboard(session.providerCallId, session.id)
                                  }
                                  className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                  title="Copy Provider Call ID"
                                >
                                  {copiedId === session.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Lifecycle Timestamps */}
                          <div className="p-3 bg-slate-50/80 rounded-xl space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Initiated:</span>
                              <span className="font-mono text-slate-700">
                                {session.startedAt
                                  ? new Date(session.startedAt).toLocaleTimeString()
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Connected:</span>
                              <span className="font-mono text-slate-700">
                                {session.connectedAt
                                  ? new Date(session.connectedAt).toLocaleTimeString()
                                  : 'Not Connected'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Ended:</span>
                              <span className="font-mono text-slate-700">
                                {session.endedAt
                                  ? new Date(session.endedAt).toLocaleTimeString()
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Recording Reference */}
                          {session.recordingReference && (
                            <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-indigo-600" />
                                <span className="text-[11px] font-bold text-indigo-900">
                                  Call Recording
                                </span>
                              </div>
                              <span className="text-[10px] text-indigo-600 font-mono truncate max-w-[200px]">
                                {session.recordingReference}
                              </span>
                            </div>
                          )}

                          {/* Conversation Transcripts (AiCallMessage) */}
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Bot className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Conversation Transcript</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {session.messages?.length || 0} turns
                              </span>
                            </div>

                            {session.messages && session.messages.length > 0 ? (
                              <div className="space-y-2.5 max-h-72 overflow-y-auto p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                                {session.messages.map((msg) => {
                                  const isAgent = msg.speaker === 'AGENT';
                                  return (
                                    <div
                                      key={msg.id}
                                      className={`flex flex-col ${
                                        isAgent ? 'items-start' : 'items-end'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                                        <span>
                                          {isAgent ? 'AI Calling Assistant' : 'Prospect'}
                                        </span>
                                        <span>&bull; Turn #{msg.turnOrder}</span>
                                      </div>
                                      <div
                                        className={`p-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                                          isAgent
                                            ? 'bg-indigo-600 text-white rounded-tl-sm'
                                            : 'bg-white text-slate-800 border border-slate-200 rounded-tr-sm shadow-2xs'
                                        }`}
                                      >
                                        {msg.transcriptText}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-[11px] text-slate-400">
                                No transcript messages recorded for this session.
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Auto-updates on refresh
              </span>
              <button
                onClick={closeDetails}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}
</div>
);
}
