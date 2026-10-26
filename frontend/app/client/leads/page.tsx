'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiFetch, API_BASE_URL } from '../../lib/api';
import { useClientAuth } from '../../context/ClientAuthContext';
import {
  Target,
  Plus,
  Upload,
  Code,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Globe,
  FileSpreadsheet,
  User,
  Building,
  Mail,
  Phone,
  Tag,
  Clock,
  ExternalLink,
  Copy,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye,
  X,
  Layers,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface LeadItem {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source: string;
  medium?: string;
  campaignName?: string;
  landingPageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  notes?: string;
  temperature: string;
  dealValue?: number;
  isDuplicate: boolean;
  duplicateOfId?: string;
  duplicateReason?: string;
  createdAt: string;
  stage?: { id: string; name: string; color?: string };
  duplicateOf?: { id: string; firstName: string; lastName?: string; email?: string; phone?: string };
  _count?: { duplicates: number; activities: number };
}

interface MetaConfig {
  tenantId: string;
  tenantName: string;
  apiKey: string;
  stages: { id: string; name: string; color?: string }[];
  publicEndpoint: string;
}

export default function CapturedLeadsPage() {
  const { hasPermission } = useClientAuth();

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startCount = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endCount = Math.min(total, page * pageSize);

  // Real-time polling & detection state
  const [isLivePolling, setIsLivePolling] = useState(true);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [newlyArrivedLeadIds, setNewlyArrivedLeadIds] = useState<Set<string>>(new Set());
  const [newLeadBanner, setNewLeadBanner] = useState<{ count: number; name: string } | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [duplicateFilter, setDuplicateFilter] = useState('all');

  // Modals
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [apiSnippetOpen, setApiSnippetOpen] = useState(false);
  const [metaConfig, setMetaConfig] = useState<MetaConfig | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [snippetTab, setSnippetTab] = useState<'js' | 'nextjs'>('js');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Live test website intake state
  const [testName, setTestName] = useState('Rahul Sharma');
  const [testEmail, setTestEmail] = useState('rahul.test@example.com');
  const [testPhone, setTestPhone] = useState('+91 9876500001');
  const [testMsg, setTestMsg] = useState('Testing website form integration');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [savedNotesId, setSavedNotesId] = useState<string | null>(null);
  const [notesState, setNotesState] = useState<Record<string, string>>({});

  const leadsRef = useRef<LeadItem[]>(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const fetchLeads = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setIsBackgroundSyncing(true);
    }

    try {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', String(pageSize));
      if (appliedSearch) q.set('search', appliedSearch);
      if (sourceFilter) q.set('source', sourceFilter);
      if (duplicateFilter === 'duplicates') q.set('isDuplicate', 'true');
      if (duplicateFilter === 'unique') q.set('isDuplicate', 'false');

      const res = await apiFetch<{
        data: LeadItem[];
        meta: { total: number; duplicateCount: number };
      }>(`/client/leads?${q.toString()}`);

      // Detect new leads when running silent polling
      if (silent && leadsRef.current.length > 0) {
        const existingIds = new Set(leadsRef.current.map((l) => l.id));
        const newLeads = res.data.filter((l) => !existingIds.has(l.id));

        if (newLeads.length > 0) {
          const newIds = new Set(newLeads.map((l) => l.id));
          setNewlyArrivedLeadIds(newIds);

          const firstName = `${newLeads[0].firstName} ${newLeads[0].lastName || ''}`.trim();
          setNewLeadBanner({
            count: newLeads.length,
            name: firstName,
          });

          // Clear highlight after 7 seconds
          setTimeout(() => {
            setNewlyArrivedLeadIds(new Set());
          }, 7000);

          // Clear banner after 6 seconds
          setTimeout(() => {
            setNewLeadBanner(null);
          }, 6000);
        }
      }

      setLeads(res.data);
      setTotal(res.meta.total);
      setDuplicateCount(res.meta.duplicateCount);
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Failed to load leads');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setIsBackgroundSyncing(false);
      }
    }
  };

  const fetchConfig = async () => {
    try {
      const cfg = await apiFetch<MetaConfig>('/client/leads/config');
      setMetaConfig(cfg);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const handleUpdateDescription = async (leadId: string, notes: string) => {
    try {
      setSavingNotesId(leadId);
      await apiFetch(`/client/leads/${leadId}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, notes } : lead)),
      );
      setSavedNotesId(leadId);
      setTimeout(() => {
        setSavedNotesId((curr) => (curr === leadId ? null : curr));
      }, 2000);
    } catch (err: any) {
      console.error('Failed to update lead description:', err);
    } finally {
      setSavingNotesId(null);
    }
  };

  // Immediate fetch on filter or page change
  useEffect(() => {
    fetchLeads(false);
  }, [page, pageSize, appliedSearch, sourceFilter, duplicateFilter]);

  // Real-time lightweight polling (every 6 seconds) while page is open
  useEffect(() => {
    if (!isLivePolling) return;

    const intervalId = setInterval(() => {
      fetchLeads(true);
    }, 6000);

    return () => clearInterval(intervalId);
  }, [page, pageSize, appliedSearch, sourceFilter, duplicateFilter, isLivePolling]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleOpenApiModal = () => {
    fetchConfig();
    setApiSnippetOpen(true);
    setTestResult(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSendTestIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaConfig?.apiKey) return;
    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/public/leads/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Key': metaConfig.apiKey,
        },
        body: JSON.stringify({
          firstName: testName,
          email: testEmail,
          phone: testPhone,
          message: testMsg,
          source: 'WEBSITE',
          medium: 'contact-form',
          formId: 'contact-form-test',
          campaignName: 'Website Intake Test',
          utmSource: 'google',
          utmMedium: 'contact-form',
          utmCampaign: 'test_campaign',
          landingPageUrl: typeof window !== 'undefined' ? window.location.href : 'https://example.com/contact',
        }),
      });

      const data = await res.json();
      setTestResult(data);
      fetchLeads(); // refresh captured leads
    } catch (err: any) {
      setTestResult({ error: err.message || 'Network error' });
    } finally {
      setTestLoading(false);
    }
  };

  const getSourceBadge = (src: string) => {
    switch (src) {
      case 'WEBSITE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CSV_IMPORT':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'MANUAL':
      case 'OTHER':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'WHATSAPP':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'META':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'GOOGLE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const canCreate = hasPermission('leads:create');

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" />
            Lead Capture Foundation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Capture, deduplicate, and attribute leads from website forms, CSV imports, and manual entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchLeads(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBackgroundSyncing || loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleOpenApiModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            Website Form & API
          </button>

          {canCreate && (
            <>
              <Link
                href="/client/leads/import"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import CSV
              </Link>

              <Link
                href="/client/leads/new"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Lead Manually
              </Link>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Captured Leads</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{total}</div>
          <span className="text-[11px] text-slate-400">Total ingested across all channels</span>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Website & API Intake</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {leads.filter((l) => l.source === 'WEBSITE').length}
          </div>
          <span className="text-[11px] text-slate-400">Captured via forms & webhook API</span>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">CSV Imports & Manual</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {leads.filter((l) => l.source === 'CSV_IMPORT' || l.source === 'MANUAL' || l.source === 'OTHER').length}
          </div>
          <span className="text-[11px] text-slate-400">Batch imports & direct entries</span>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Flagged Duplicates</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{duplicateCount}</div>
          <span className="text-[11px] text-slate-400">Deduplicated by email & phone</span>
        </div>
      </div>

      {/* Real-time New Lead Toast Banner */}
      {newLeadBanner && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20 text-xs font-semibold transition-all">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>
              {newLeadBanner.count === 1
                ? `New lead received in real-time: ${newLeadBanner.name}`
                : `${newLeadBanner.count} new leads received in real-time!`}
            </span>
          </div>
          <button
            onClick={() => setNewLeadBanner(null)}
            className="text-white/80 hover:text-white transition p-0.5 rounded-lg hover:bg-emerald-700/50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, email, phone, company, campaign..."
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (!val && appliedSearch) {
                  setPage(1);
                  setAppliedSearch('');
                }
              }}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setPage(1);
              setSourceFilter(e.target.value);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="">All Sources</option>
            <option value="WEBSITE">Website Form / API</option>
            <option value="CSV_IMPORT">CSV Import</option>
            <option value="OTHER">Manual / Other</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="REFERRAL">Referral</option>
            <option value="META">Meta Ads</option>
            <option value="GOOGLE">Google Ads</option>
          </select>

          <select
            value={duplicateFilter}
            onChange={(e) => {
              setPage(1);
              setDuplicateFilter(e.target.value);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="all">All Records</option>
            <option value="unique">New / Unique Leads</option>
            <option value="duplicates">Flagged Duplicates Only</option>
          </select>

          <button
            type="submit"
            className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Showing {startCount}–{endCount} of {total} Leads
          </span>
          {totalPages > 1 && (
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              Page {page} of {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading captured leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-3">
            <Target className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Leads Captured Yet</h3>
            <p className="max-w-md mx-auto text-slate-500">
              Capture leads automatically using website form webhook API, import a CSV list, or add leads manually.
            </p>
            {canCreate && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Link
                  href="/client/leads/new"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-xs"
                >
                  Create First Lead
                </Link>
                <Link
                  href="/client/leads/import"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Upload CSV
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">Lead Contact</th>
                  <th className="py-3.5 px-4">Company</th>
                  <th className="py-3.5 px-4">Channel / Source</th>
                  <th className="py-3.5 px-4">Attribution / Campaign</th>
                  <th className="py-3.5 px-4">Pipeline Stage</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Captured At</th>
                  <th className="py-3.5 px-4 min-w-[280px]">Description</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => {
                  const isJustArrived = newlyArrivedLeadIds.has(l.id);
                  return (
                    <tr
                      key={l.id}
                      className={`transition-colors duration-700 ${
                        isJustArrived
                          ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500 hover:bg-emerald-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                              isJustArrived
                                ? 'bg-emerald-200 text-emerald-900 ring-2 ring-emerald-400'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {l.firstName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900">
                                {l.firstName} {l.lastName || ''}
                              </p>
                              {isJustArrived && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500 text-white animate-pulse">
                                  NEW
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{l.email || 'No email'}</p>
                            {l.phone && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> {l.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                    {/* Company */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {l.company ? (
                        <div>
                          <p className="font-semibold text-slate-800">{l.company}</p>
                          {l.jobTitle && <p className="text-[10px] text-slate-400">{l.jobTitle}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getSourceBadge(
                          l.source,
                        )}`}
                      >
                        {l.source}
                      </span>
                      {l.medium && (
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          medium: {l.medium}
                        </span>
                      )}
                    </td>

                    {/* Attribution / Campaign */}
                    <td className="py-3.5 px-4">
                      {l.campaignName ? (
                        <div>
                          <p className="font-semibold text-slate-800 text-[11px] truncate max-w-[150px]">
                            {l.campaignName}
                          </p>
                          {l.utmSource && (
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              utm: {l.utmSource}
                            </span>
                          )}
                        </div>
                      ) : l.utmSource ? (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {l.utmSource} / {l.utmCampaign || 'organic'}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">Direct</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                        style={{
                          backgroundColor: l.stage?.color ? `${l.stage.color}15` : undefined,
                          borderColor: l.stage?.color ? `${l.stage.color}40` : undefined,
                          color: l.stage?.color || undefined,
                        }}
                      >
                        {l.stage?.name || 'New'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {l.isDuplicate ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer"
                          title={`Matched reason: ${l.duplicateReason || 'Existing Lead'}`}
                          onClick={() => setSelectedLead(l)}
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Duplicate
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> New
                        </span>
                      )}
                    </td>

                    {/* Captured At */}
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 min-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Add description..."
                          value={notesState[l.id] !== undefined ? notesState[l.id] : (l.notes || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNotesState((prev) => ({ ...prev, [l.id]: val }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = notesState[l.id] !== undefined ? notesState[l.id] : (l.notes || '');
                              handleUpdateDescription(l.id, val);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                        />
                        <button
                          type="button"
                          disabled={savingNotesId === l.id}
                          onClick={() => {
                            const val = notesState[l.id] !== undefined ? notesState[l.id] : (l.notes || '');
                            handleUpdateDescription(l.id, val);
                          }}
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1 shrink-0 ${
                            savedNotesId === l.id
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : notesState[l.id] !== undefined && notesState[l.id] !== (l.notes || '')
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer'
                          }`}
                        >
                          {savingNotesId === l.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : savedNotesId === l.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Saved
                            </>
                          ) : (
                            'Save'
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedLead(l)}
                        className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <span className="text-slate-600 font-medium">
                Showing <span className="font-bold text-slate-900">{startCount}–{endCount}</span> of <span className="font-bold text-slate-900">{total}</span> leads
              </span>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                10 per page
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - page) <= 1
                    );
                  })
                  .reduce((acc: (number | string)[], p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    typeof item === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                          page === item
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>

      {/* LEAD DETAILS DRAWER / MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedLead.firstName} {selectedLead.lastName || ''}
                </h3>
                <p className="text-xs text-slate-500">
                  Captured lead record and attribution metadata
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Duplicate Flag Alert */}
            {selectedLead.isDuplicate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Duplicate Lead Detected</p>
                  <p className="mt-0.5 text-amber-700">
                    Match criterion: <span className="font-mono">{selectedLead.duplicateReason || 'Email / Mobile'}</span>
                  </p>
                  {selectedLead.duplicateOf && (
                    <p className="mt-1 text-[11px]">
                      Original record:{' '}
                      <span className="font-bold">
                        {selectedLead.duplicateOf.firstName} {selectedLead.duplicateOf.lastName || ''}
                      </span>{' '}
                      ({selectedLead.duplicateOf.email || selectedLead.duplicateOf.phone})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Contact Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Email</span>
                <p className="font-semibold text-slate-800">{selectedLead.email || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Phone / Mobile</span>
                <p className="font-semibold text-slate-800">{selectedLead.phone || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Company</span>
                <p className="font-semibold text-slate-800">{selectedLead.company || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Stage</span>
                <p className="font-semibold text-slate-800">{selectedLead.stage?.name || 'New'}</p>
              </div>
            </div>

            {/* Marketing Attribution Metadata */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Attribution & Source Metadata
              </h4>
              <div className="p-3 border border-slate-200 rounded-2xl grid grid-cols-2 gap-2.5 text-[11px]">
                <div>
                  <span className="text-slate-400">Source Channel:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedLead.source}</span>
                </div>
                <div>
                  <span className="text-slate-400">Medium:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedLead.medium || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Campaign Name:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedLead.campaignName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400">UTM Source:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedLead.utmSource || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400">UTM Medium:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedLead.utmMedium || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400">UTM Campaign:</span>{' '}
                  <span className="font-bold text-slate-800">{selectedLead.utmCampaign || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Landing Page:</span>{' '}
                  <span className="font-mono text-slate-800 truncate block">
                    {selectedLead.landingPageUrl || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes / Message */}
            {selectedLead.notes && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">Notes / Inquiry Message</h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                  {selectedLead.notes}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBSITE FORM & API EMBED MODAL */}
      {apiSnippetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Code className="w-5 h-5 text-indigo-600" />
                  Website Forms & Public API Lead Intake
                </h3>
                <p className="text-xs text-slate-500">
                  Capture leads automatically from your website, landing pages, and webhooks into CRM
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApiSnippetOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* API Key */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Tenant Public API Key
                </label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(metaConfig?.apiKey || '')}
                  className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedKey ? 'Copied!' : 'Copy Key'}
                </button>
              </div>
              <div className="font-mono text-xs text-slate-900 bg-white p-2 rounded-xl border border-slate-200 break-all select-all">
                {metaConfig?.apiKey || 'Loading...'}
              </div>
              <p className="text-[10px] text-slate-500">
                Send this key in HTTP Header <span className="font-mono font-bold">X-Tenant-Key</span> or in request payload as <span className="font-mono font-bold">apiKey</span>.
              </p>
            </div>

            {/* Reusable External Form Integration Snippets */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSnippetTab('js')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      snippetTab === 'js'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    HTML / Vanilla JS
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnippetTab('nextjs')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      snippetTab === 'nextjs'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Next.js / React
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const code =
                      snippetTab === 'js'
                        ? `// Add to external website <script> or existing submit handler:\ndocument.getElementById('contact-form')?.addEventListener('submit', async function(e) {\n  const formData = new FormData(e.target);\n  const urlParams = new URLSearchParams(window.location.search);\n\n  const payload = {\n    firstName: formData.get('firstName') || formData.get('name'),\n    lastName: formData.get('lastName') || undefined,\n    email: formData.get('email'),\n    phone: formData.get('phone') || formData.get('mobile'),\n    company: formData.get('company') || undefined,\n    message: formData.get('message'),\n    source: 'WEBSITE',\n    medium: 'contact-form',\n    formId: 'contact-form-main',\n    landingPageUrl: window.location.href,\n    utmSource: urlParams.get('utm_source') || undefined,\n    utmMedium: urlParams.get('utm_medium') || undefined,\n    utmCampaign: urlParams.get('utm_campaign') || undefined,\n    utmContent: urlParams.get('utm_content') || undefined,\n    utmTerm: urlParams.get('utm_term') || undefined,\n  };\n\n  try {\n    await fetch('${typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':8000') : 'http://localhost:8000'}/api/public/leads/capture', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n        'X-Tenant-Key': '${metaConfig?.apiKey || 'YOUR_TENANT_API_KEY'}',\n      },\n      body: JSON.stringify(payload),\n    });\n  } catch (err) {\n    console.warn('FirstCall ingestion notice:', err);\n  }\n});`
                        : `// Next.js / React Form Submit Handler:\nconst handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {\n  e.preventDefault();\n  const searchParams = new URLSearchParams(window.location.search);\n\n  try {\n    await fetch('${typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':8000') : 'http://localhost:8000'}/api/public/leads/capture', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n        'X-Tenant-Key': '${metaConfig?.apiKey || 'YOUR_TENANT_API_KEY'}',\n      },\n      body: JSON.stringify({\n        firstName: formData.firstName,\n        lastName: formData.lastName || undefined,\n        email: formData.email,\n        phone: formData.phone,\n        company: formData.company || undefined,\n        message: formData.message,\n        source: 'WEBSITE',\n        medium: 'contact-form',\n        formId: 'nextjs-contact-form',\n        landingPageUrl: window.location.href,\n        utmSource: searchParams.get('utm_source') || undefined,\n        utmMedium: searchParams.get('utm_medium') || undefined,\n        utmCampaign: searchParams.get('utm_campaign') || undefined,\n      }),\n    });\n    // Keep existing success UI/notifications intact\n  } catch (err) {\n    console.error(err);\n  }\n};`;
                    navigator.clipboard.writeText(code);
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedSnippet ? 'Copied Snippet!' : 'Copy Snippet'}
                </button>
              </div>

              <pre className="font-mono text-[11px] leading-relaxed p-3 bg-slate-950 rounded-xl overflow-x-auto text-slate-300 border border-slate-800">
                {snippetTab === 'js' ? (
`// Add to external website <script> or existing submit handler:
document.getElementById('contact-form')?.addEventListener('submit', async function(e) {
  const formData = new FormData(e.target);
  const urlParams = new URLSearchParams(window.location.search);

  const payload = {
    firstName: formData.get('firstName') || formData.get('name'),
    lastName: formData.get('lastName') || undefined,
    email: formData.get('email'),
    phone: formData.get('phone') || formData.get('mobile'),
    company: formData.get('company') || undefined,
    message: formData.get('message'),
    source: 'WEBSITE',
    medium: 'contact-form',
    formId: 'contact-form-main',
    landingPageUrl: window.location.href,
    utmSource: urlParams.get('utm_source') || undefined,
    utmMedium: urlParams.get('utm_medium') || undefined,
    utmCampaign: urlParams.get('utm_campaign') || undefined,
    utmContent: urlParams.get('utm_content') || undefined,
    utmTerm: urlParams.get('utm_term') || undefined,
  };

  try {
    await fetch('${typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':8000') : 'http://localhost:8000'}/api/public/leads/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': '${metaConfig?.apiKey || 'YOUR_TENANT_API_KEY'}',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('FirstCall ingestion notice:', err);
  }
});`
                ) : (
`// Next.js / React Form Submit Handler:
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const searchParams = new URLSearchParams(window.location.search);

  try {
    await fetch('${typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':8000') : 'http://localhost:8000'}/api/public/leads/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': '${metaConfig?.apiKey || 'YOUR_TENANT_API_KEY'}',
      },
      body: JSON.stringify({
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        email: formData.email,
        phone: formData.phone,
        company: formData.company || undefined,
        message: formData.message,
        source: 'WEBSITE',
        medium: 'contact-form',
        formId: 'nextjs-contact-form',
        landingPageUrl: window.location.href,
        utmSource: searchParams.get('utm_source') || undefined,
        utmMedium: searchParams.get('utm_medium') || undefined,
        utmCampaign: searchParams.get('utm_campaign') || undefined,
      }),
    });
    // Keep existing success UI/notifications intact
  } catch (err) {
    console.error(err);
  }
};`
                )}
              </pre>
            </div>

            {/* Interactive Live Testing Tool */}
            <div className="p-4 border border-indigo-100 bg-indigo-50/40 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                Live Test Ingestion Right Now
              </h4>
              <form onSubmit={handleSendTestIntake} className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    required
                    placeholder="Name"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-xl"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-xl"
                  />
                  <input
                    type="text"
                    placeholder="Mobile"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Message"
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                  <button
                    type="submit"
                    disabled={testLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {testLoading ? 'Sending...' : 'Test Send'}
                  </button>
                </div>
              </form>

              {testResult && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <span>
                    {testResult.success
                      ? `Lead Ingested Successfully! ID: ${testResult.lead?.id || 'OK'} ${
                          testResult.isDuplicate ? '(⚠️ Duplicate Detected)' : ''
                        }`
                      : `Error: ${testResult.error || testResult.message || 'Failed'}`}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setApiSnippetOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
