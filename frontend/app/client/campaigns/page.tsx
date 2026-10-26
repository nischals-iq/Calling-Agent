'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useClientAuth } from '../../context/ClientAuthContext';
import {
  Megaphone,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Eye,
  X,
  Calendar,
  DollarSign,
  Target,
  Sparkles,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Settings2,
  Globe2,
  ChevronRight,
  Sliders,
  FileText,
  Edit3,
  ExternalLink,
  Info,
  Send,
  UploadCloud,
} from 'lucide-react';

interface InternalCampaignItem {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  totalBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  landingPageUrl: string | null;
  locations: string[] | any;
  minAge: number | null;
  maxAge: number | null;
  gender: string | null;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  callToAction: string | null;
  useMeta: boolean;
  useGoogle: boolean;
  status: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  platformCampaigns?: any[];
}

interface PlatformCampaignItem {
  id: string;
  name: string;
  source: 'META' | 'GOOGLE' | 'LINKEDIN' | string;
  status: string;
  spend: number;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  platformCampaignId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
  adSet?: {
    id: string;
    name: string;
    status: string;
    dailyBudget: number | null;
    billingEvent: string;
    optimizationGoal: string;
    targeting?: any;
    promotedObject?: any;
    createdAt?: string | null;
  } | null;
  integration: {
    id: string;
    name: string | null;
    channel: string;
    adAccountName: string | null;
    adAccountId: string | null;
  } | null;
  leadsCount: number;
  objective: string | null;
}

export default function ClientCampaignsPage() {
  const { client } = useClientAuth();

  // Active view tab: INTERNAL vs PLATFORM
  const [activeTab, setActiveTab] = useState<'INTERNAL' | 'PLATFORM'>('INTERNAL');

  // Internal Master Campaigns State
  const [internalCampaigns, setInternalCampaigns] = useState<InternalCampaignItem[]>([]);
  const [selectedInternalCampaign, setSelectedInternalCampaign] = useState<InternalCampaignItem | null>(null);

  // Platform Campaigns State
  const [platformCampaigns, setPlatformCampaigns] = useState<PlatformCampaignItem[]>([]);
  const [selectedPlatformCampaign, setSelectedPlatformCampaign] = useState<PlatformCampaignItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------
  // 5-STEP CREATE MASTER CAMPAIGN WIZARD STATE
  // -------------------------------------------------------------
  const [createWizardOpen, setCreateWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);

  // Step 1: Basic Details
  const [campName, setCampName] = useState('');
  const [campObjective, setCampObjective] = useState<'LEADS'>('LEADS');
  const [campTotalBudget, setCampTotalBudget] = useState('20000');
  const [campStartDate, setCampStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [campEndDate, setCampEndDate] = useState('');

  // Step 2: Platform Selection
  const [useMeta, setUseMeta] = useState(true);
  const [useGoogle, setUseGoogle] = useState(false);

  // Step 3: Audience & Targeting
  const [country, setCountry] = useState('IN');
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setAgeMax] = useState(65);
  const [gender, setGender] = useState('ALL');

  // Step 4: Creative & Common Copy
  const [headline, setHeadline] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [description, setDescription] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [callToAction, setCallToAction] = useState('LEARN_MORE');

  // Wizard action states
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [saveDraftSuccess, setSaveDraftSuccess] = useState<any | null>(null);

  // -------------------------------------------------------------
  // EDIT DRAFT STATE
  // -------------------------------------------------------------
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<InternalCampaignItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editPrimaryText, setEditPrimaryText] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLandingPage, setEditLandingPage] = useState('');
  const [isUpdatingDraft, setIsUpdatingDraft] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // PUBLISHING MODAL & ACTION STATE
  // -------------------------------------------------------------
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishingCampaign, setPublishingCampaign] = useState<InternalCampaignItem | null>(null);
  const [publishPlatform, setPublishPlatform] = useState<'META' | 'GOOGLE' | 'BOTH'>('META');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<any | null>(null);

  const handleOpenPublish = (campaign: InternalCampaignItem, platform?: 'META' | 'GOOGLE' | 'BOTH') => {
    setPublishingCampaign(campaign);
    const initialPlatform = platform || (campaign.useMeta && campaign.useGoogle ? 'BOTH' : campaign.useMeta ? 'META' : 'GOOGLE');
    setPublishPlatform(initialPlatform);
    setPublishError(null);
    setPublishResult(null);
    setPublishModalOpen(true);
  };

  const handleExecutePublish = async () => {
    if (!publishingCampaign) return;
    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const res = await apiFetch<any>(
        `/client/internal-campaigns/${publishingCampaign.id}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({ platform: publishPlatform }),
        },
      );

      setPublishResult(res);
      await fetchData(true);
    } catch (err: any) {
      console.error('Publishing failed:', err);
      setPublishError(err.message || 'Failed to publish campaign.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Fetch both internal and platform campaigns
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [internals, platforms] = await Promise.all([
        apiFetch<InternalCampaignItem[]>('/client/internal-campaigns'),
        apiFetch<PlatformCampaignItem[]>('/client/campaigns'),
      ]);
      setInternalCampaigns(internals);
      setPlatformCampaigns(platforms);

      // Keep drawer objects in sync if open
      if (selectedInternalCampaign) {
        const fresh = internals.find((c) => c.id === selectedInternalCampaign.id);
        if (fresh) setSelectedInternalCampaign(fresh);
      }
      if (selectedPlatformCampaign) {
        const fresh = platforms.find((c) => c.id === selectedPlatformCampaign.id);
        if (fresh) setSelectedPlatformCampaign(fresh);
      }
    } catch (err: any) {
      console.error('Failed to load campaigns:', err);
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  }, [internalCampaigns, loading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleOpenWizard = () => {
    setWizardStep(1);
    setCampName('');
    setCampObjective('LEADS');
    setCampTotalBudget('20000');
    setCampStartDate(new Date().toISOString().slice(0, 10));
    setCampEndDate('');
    setUseMeta(true);
    setUseGoogle(false);
    setCountry('IN');
    setMinAge(18);
    setAgeMax(65);
    setGender('ALL');
    setHeadline('');
    setPrimaryText('');
    setDescription('');
    setLandingPageUrl('');
    setCallToAction('LEARN_MORE');
    setSaveDraftError(null);
    setSaveDraftSuccess(null);
    setCreateWizardOpen(true);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useMeta && !useGoogle) {
      setSaveDraftError('Please select at least one platform (Meta or Google).');
      return;
    }

    setIsSavingDraft(true);
    setSaveDraftError(null);
    setSaveDraftSuccess(null);

    try {
      const payload: any = {
        name: campName.trim() || 'Untitled Internal Campaign',
        objective: campObjective,
        totalBudget: campTotalBudget ? Number(campTotalBudget) : undefined,
        startDate: campStartDate ? new Date(campStartDate).toISOString() : undefined,
        endDate: campEndDate ? new Date(campEndDate).toISOString() : undefined,
        landingPageUrl: landingPageUrl ? landingPageUrl.trim() : undefined,
        locations: [country],
        minAge: Number(minAge) || 18,
        maxAge: Number(maxAge) || 65,
        gender,
        headline: headline ? headline.trim() : undefined,
        primaryText: primaryText ? primaryText.trim() : undefined,
        description: description ? description.trim() : undefined,
        callToAction,
        useMeta,
        useGoogle,
      };

      const res = await apiFetch<InternalCampaignItem>('/client/internal-campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSaveDraftSuccess(res);
      await fetchData(true);
      setActiveTab('INTERNAL');
    } catch (err: any) {
      console.error('Failed to save master campaign draft:', err);
      setSaveDraftError(err.message || 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleOpenEditDraft = (campaign: InternalCampaignItem) => {
    setEditingDraft(campaign);
    setEditName(campaign.name);
    setEditBudget(campaign.totalBudget ? String(campaign.totalBudget) : '');
    setEditHeadline(campaign.headline || '');
    setEditPrimaryText(campaign.primaryText || '');
    setEditDescription(campaign.description || '');
    setEditLandingPage(campaign.landingPageUrl || '');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleUpdateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDraft) return;

    setIsUpdatingDraft(true);
    setEditError(null);

    try {
      const updated = await apiFetch<InternalCampaignItem>(
        `/client/internal-campaigns/${editingDraft.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editName.trim(),
            totalBudget: editBudget ? Number(editBudget) : null,
            headline: editHeadline.trim() || null,
            primaryText: editPrimaryText.trim() || null,
            description: editDescription.trim() || null,
            landingPageUrl: editLandingPage.trim() || null,
          }),
        },
      );

      setEditModalOpen(false);
      setEditingDraft(null);
      await fetchData(true);
      if (selectedInternalCampaign?.id === updated.id) {
        setSelectedInternalCampaign(updated);
      }
    } catch (err: any) {
      console.error('Failed to update draft:', err);
      setEditError(err.message || 'Failed to update draft');
    } finally {
      setIsUpdatingDraft(false);
    }
  };

  // Metrics - Option 2: Channel-Focused Overview
  const totalMasterCampaigns = internalCampaigns.length;
  const publishedMasterCount = internalCampaigns.filter((c) => c.status === 'PUBLISHED').length;
  const draftMasterCount = internalCampaigns.filter((c) => c.status === 'DRAFT' || !c.status).length;
  const metaCampaignsCount = platformCampaigns.filter((c) => c.source === 'META').length;
  const googleCampaignsCount = platformCampaigns.filter((c) => c.source === 'GOOGLE').length;
  const totalLeads = platformCampaigns.reduce((acc, c) => acc + (c.leadsCount || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            DRAFT
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ACTIVE
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
            PAUSED
          </span>
        );
      case 'READY_TO_PUBLISH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            READY
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            PUBLISHED
          </span>
        );
      case 'PARTIALLY_PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            PARTIAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getPlatformBadges = (useMeta: boolean, useGoogle: boolean) => {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {useMeta && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            META
          </span>
        )}
        {useGoogle && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            GOOGLE
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Marketing Campaigns</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Common master campaign management and multi-platform advertising automation.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh campaigns"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            Refresh
          </button>

          <button
            onClick={handleOpenWizard}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* KPI Overview Cards - Channel-Focused Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Master Campaigns</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalMasterCampaigns}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {publishedMasterCount} Published • {draftMasterCount} Drafts
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Meta Campaigns</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{metaCampaignsCount}</div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">Facebook & Instagram ads</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Google Campaigns</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{googleCampaignsCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Search ads & keywords</div>
        </div>
      </div>

      {/* Tabs Navigation: Internal Master Campaigns */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          className="pb-3 px-1 text-xs font-bold transition flex items-center gap-2 border-b-2 border-indigo-600 text-indigo-600"
        >
          <FileText className="w-4 h-4" />
          <span>Master Campaigns</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700">
            {totalMasterCampaigns}
          </span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION A: INTERNAL MASTER CAMPAIGNS (DRAFTS) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'INTERNAL' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50/60 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Campaign Master Records</h2>
              <p className="text-xs text-slate-500">
                Common business-level campaign blueprints ready to publish across Meta and Google.
              </p>
            </div>
            <button
              onClick={handleOpenWizard}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              New Master Campaign
            </button>
          </div>

          {loading ? (
            <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Loading master campaigns...</span>
            </div>
          ) : internalCampaigns.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No master campaigns created yet</h3>
              <p className="max-w-sm mx-auto text-slate-500 text-xs">
                Create your first unified internal campaign draft. You can specify common targeting, ad copy, and choose Meta, Google, or Both.
              </p>
              <button
                onClick={handleOpenWizard}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Master Campaign
              </button>
            </div>
          ) : (
            <div ref={tableContainerRef} className="w-full overflow-x-auto scroll-smooth">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/90 text-slate-600 font-bold">
                    <th className="py-3.5 pl-5 pr-3 text-left min-w-[180px]">Master Campaign Name</th>
                    <th className="py-3.5 px-3 text-left w-[120px] whitespace-nowrap">Objective</th>
                    <th className="py-3.5 px-3 text-left w-[110px] whitespace-nowrap">Platforms</th>
                    <th className="py-3.5 px-3 text-left w-[115px] whitespace-nowrap">Status</th>
                    <th className="py-3.5 px-3 text-left w-[105px] whitespace-nowrap">Total Budget</th>
                    <th className="py-3.5 px-3 text-left w-[110px] whitespace-nowrap">Schedule</th>
                    <th className="py-3.5 px-3 text-left w-[100px] whitespace-nowrap">Created Date</th>
                    <th className="py-3.5 pl-3 pr-5 text-right w-[235px] whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {internalCampaigns.map((ic) => (
                    <tr
                      key={ic.id}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                      onClick={() => setSelectedInternalCampaign(ic)}
                    >
                      {/* Name */}
                      <td className="py-3 pl-5 pr-3 text-left align-middle">
                        <div className="font-bold text-slate-900 truncate" title={ic.name || 'Untitled Campaign'}>
                          {ic.name && ic.name !== '-' ? ic.name : 'Untitled Campaign'}
                        </div>
                        {ic.headline && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5" title={ic.headline}>
                            Headline: <span className="text-slate-600 font-medium">"{ic.headline}"</span>
                          </div>
                        )}
                      </td>

                      {/* Objective */}
                      <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                          <Target className="w-3 h-3 text-slate-500" />
                          {ic.objective}
                        </span>
                      </td>

                      {/* Platforms */}
                      <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                        {getPlatformBadges(ic.useMeta, ic.useGoogle)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-left whitespace-nowrap align-middle">
                        {getStatusBadge(ic.status)}
                      </td>

                      {/* Budget */}
                      <td className="py-3 px-3 text-left whitespace-nowrap font-bold text-slate-900 align-middle">
                        {ic.totalBudget ? `₹${ic.totalBudget.toLocaleString()}` : '—'}
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-3 text-left whitespace-nowrap text-slate-600 align-middle">
                        {ic.startDate ? (
                          <span>
                            {new Date(ic.startDate).toLocaleDateString()}
                            {ic.endDate ? ` → ${new Date(ic.endDate).toLocaleDateString()}` : ''}
                          </span>
                        ) : (
                          'Continuous'
                        )}
                      </td>

                      {/* Created */}
                      <td className="py-3 px-3 text-left whitespace-nowrap text-slate-500 align-middle">
                        {new Date(ic.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {ic.useMeta && ic.useGoogle ? (
                            <button
                              onClick={() => handleOpenPublish(ic, 'BOTH')}
                              className="px-2.5 py-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:opacity-90 text-white rounded-lg transition font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"
                              title="Publish to Meta & Google"
                            >
                              <Send className="w-3 h-3" />
                              <span>Publish</span>
                            </button>
                          ) : ic.useMeta ? (
                            <button
                              onClick={() => handleOpenPublish(ic, 'META')}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"
                              title="Publish to Meta Ads"
                            >
                              <Send className="w-3 h-3" />
                              <span>Publish Meta</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenPublish(ic, 'GOOGLE')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"
                              title="Publish to Google Ads"
                            >
                              <Send className="w-3 h-3" />
                              <span>Publish Google</span>
                            </button>
                          )}

                          {ic.status === 'DRAFT' && (
                            <button
                              onClick={() => handleOpenEditDraft(ic)}
                              className="px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                              title="Edit Draft"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedInternalCampaign(ic)}
                            className="px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* INTERNAL MASTER CAMPAIGN DETAILS DRAWER */}
      {/* ------------------------------------------------------------- */}
      {selectedInternalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedInternalCampaign(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedInternalCampaign.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getPlatformBadges(selectedInternalCampaign.useMeta, selectedInternalCampaign.useGoogle)}
                  {getStatusBadge(selectedInternalCampaign.status)}
                </div>
              </div>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Campaign Overview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Objective</span>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {selectedInternalCampaign.objective}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Budget</span>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {selectedInternalCampaign.totalBudget ? `₹${selectedInternalCampaign.totalBudget.toLocaleString()}` : 'Not Specified'}
                  </div>
                </div>
              </div>

              {/* Schedule & Audience */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-medium">Schedule</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedInternalCampaign.startDate ? (
                      <span>
                        {new Date(selectedInternalCampaign.startDate).toLocaleDateString()}
                        {selectedInternalCampaign.endDate ? ` → ${new Date(selectedInternalCampaign.endDate).toLocaleDateString()}` : ''}
                      </span>
                    ) : (
                      'Continuous Delivery'
                    )}
                  </div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-medium">Target Demographics</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    Age {selectedInternalCampaign.minAge ?? 18}–{selectedInternalCampaign.maxAge ?? 65}+ • {selectedInternalCampaign.gender || 'ALL'}
                  </div>
                </div>
              </div>

              {/* Creative Copy Preview */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Common Creative Copy</div>
                <div>
                  <span className="text-[11px] text-slate-400">Headline:</span>
                  <div className="font-bold text-slate-800 text-xs mt-0.5">
                    {selectedInternalCampaign.headline || '—'}
                  </div>
                </div>
                {selectedInternalCampaign.primaryText && (
                  <div>
                    <span className="text-[11px] text-slate-400">Primary Text:</span>
                    <div className="text-slate-700 text-xs mt-0.5 leading-relaxed">
                      {selectedInternalCampaign.primaryText}
                    </div>
                  </div>
                )}
                {selectedInternalCampaign.description && (
                  <div>
                    <span className="text-[11px] text-slate-400">Description:</span>
                    <div className="text-slate-600 text-xs mt-0.5">
                      {selectedInternalCampaign.description}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400">Call to Action:</span>
                    <div className="font-bold text-indigo-700 font-mono text-[11px] mt-0.5">
                      {selectedInternalCampaign.callToAction || 'LEARN_MORE'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Landing Page:</span>
                    <div className="font-semibold text-slate-800 text-[11px] truncate mt-0.5">
                      {selectedInternalCampaign.landingPageUrl || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Publishing Status & Linked Deployments */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-indigo-600" />
                    Platform Publishing & Deployments
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Status: {selectedInternalCampaign.status}</span>
                </div>

                {/* Linked Platform Campaigns */}
                {selectedInternalCampaign.platformCampaigns && selectedInternalCampaign.platformCampaigns.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Deployments</div>
                    {selectedInternalCampaign.platformCampaigns.map((pc: any) => (
                      <div key={pc.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${pc.source === 'META' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                              {pc.source}
                            </span>
                            <span className="font-bold text-slate-800 text-xs">{pc.name}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {pc.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                          <div>
                            <span className="text-slate-400">Platform ID: </span>
                            <span className="font-mono text-slate-800">{pc.platformCampaignId || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Budget: </span>
                            <span className="font-semibold text-slate-800">₹{pc.budget?.toLocaleString() || '—'}</span>
                          </div>
                        </div>

                        {pc.metadata && (
                          <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-100 grid grid-cols-2 gap-1 font-mono">
                            {pc.metadata.adSetId && <div>AdSet: {pc.metadata.adSetId}</div>}
                            {pc.metadata.adGroupId && <div>AdGroup: {pc.metadata.adGroupId}</div>}
                            {pc.metadata.adId && <div>Ad: {pc.metadata.adId}</div>}
                            {pc.metadata.creativeId && <div>Creative: {pc.metadata.creativeId}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-center text-slate-500 text-[11px]">
                    No live platform deployments yet. Click a publish action below to deploy safely in PAUSED mode.
                  </div>
                )}

                {/* Publishing Actions */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deploy Campaign</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedInternalCampaign.useMeta && (
                      <button
                        onClick={() => handleOpenPublish(selectedInternalCampaign, 'META')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Send className="w-3 h-3" />
                        Publish to Meta
                      </button>
                    )}

                    {selectedInternalCampaign.useGoogle && (
                      <button
                        onClick={() => handleOpenPublish(selectedInternalCampaign, 'GOOGLE')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Send className="w-3 h-3" />
                        Publish to Google
                      </button>
                    )}

                    {selectedInternalCampaign.useMeta && selectedInternalCampaign.useGoogle && (
                      <button
                        onClick={() => handleOpenPublish(selectedInternalCampaign, 'BOTH')}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:opacity-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Sparkles className="w-3 h-3" />
                        Publish to Both
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Safe mode: All assets are deployed in PAUSED status with ₹0 live spend.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {selectedInternalCampaign.status === 'DRAFT' && (
                <button
                  onClick={() => {
                    handleOpenEditDraft(selectedInternalCampaign);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Draft
                </button>
              )}

              <button
                onClick={() => setSelectedInternalCampaign(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PUBLISH CONFIRMATION & EXECUTION MODAL */}
      {/* ------------------------------------------------------------- */}
      {publishModalOpen && publishingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <button
              onClick={() => {
                if (!isPublishing) setPublishModalOpen(false);
              }}
              disabled={isPublishing}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center font-bold shadow-sm">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Publish Master Campaign</h3>
                <p className="text-xs text-slate-500">Deploy business blueprint directly to ad networks</p>
              </div>
            </div>

            {/* Campaign Summary & Platform Choice */}
            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 text-sm">{publishingCampaign.name}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>Objective: <strong className="text-slate-700">{publishingCampaign.objective}</strong></span>
                  <span>•</span>
                  <span>Budget: <strong className="text-slate-700">₹{publishingCampaign.totalBudget?.toLocaleString() || '100'}</strong></span>
                </div>
              </div>

              {/* Platform Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Target Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {publishingCampaign.useMeta && (
                    <button
                      type="button"
                      onClick={() => setPublishPlatform('META')}
                      disabled={isPublishing}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer ${publishPlatform === 'META'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                    >
                      <div className="font-bold text-xs">Meta Ads</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Campaign → Ad</div>
                    </button>
                  )}

                  {publishingCampaign.useGoogle && (
                    <button
                      type="button"
                      onClick={() => setPublishPlatform('GOOGLE')}
                      disabled={isPublishing}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer ${publishPlatform === 'GOOGLE'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                    >
                      <div className="font-bold text-xs">Google Ads</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Search & Keywords</div>
                    </button>
                  )}

                  {publishingCampaign.useMeta && publishingCampaign.useGoogle && (
                    <button
                      type="button"
                      onClick={() => setPublishPlatform('BOTH')}
                      disabled={isPublishing}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer ${publishPlatform === 'BOTH'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                    >
                      <div className="font-bold text-xs">Both Platforms</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Meta + Google</div>
                    </button>
                  )}
                </div>
              </div>


              {/* Safe Mode Assurance */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="font-bold">Safe Test Mode Active: </strong>
                  All created campaigns, ad sets, and ads are strictly created in <strong>PAUSED</strong> status with ₹0 active spend.
                </div>
              </div>

              {/* Publishing Progress Feedback */}
              {isPublishing && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center space-y-2 animate-pulse">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <div className="font-bold text-indigo-900 text-xs">Publishing across ad networks...</div>
                  <div className="text-[11px] text-indigo-700">Orchestrating campaign, ad groups, creatives, and ads safely.</div>
                </div>
              )}

              {/* Error Banner */}
              {publishError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{publishError}</span>
                </div>
              )}

              {/* Result Success Details */}
              {publishResult && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Publishing Complete!</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 leading-relaxed">
                    Campaign hierarchy successfully created in PAUSED mode.
                  </div>
                  {publishResult.results?.meta && (
                    <div className="p-2 bg-white rounded border border-emerald-100 text-[10px] font-mono text-slate-700">
                      <div>Meta Campaign ID: {publishResult.results.meta.platformCampaignId}</div>
                      <div>Ad Set ID: {publishResult.results.meta.adSetId}</div>
                      <div>Ad ID: {publishResult.results.meta.adId}</div>
                    </div>
                  )}
                  {publishResult.results?.google && (
                    <div className="p-2 bg-white rounded border border-emerald-100 text-[10px] font-mono text-slate-700">
                      <div>Google Campaign ID: {publishResult.results.google.platformCampaignId}</div>
                      <div>Ad Group ID: {publishResult.results.google.adGroupId}</div>
                      <div>Ad ID: {publishResult.results.google.adId}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                disabled={isPublishing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {publishResult ? 'Done' : 'Cancel'}
              </button>

              {!publishResult ? (
                <button
                  type="button"
                  onClick={handleExecutePublish}
                  disabled={isPublishing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Confirm & Publish
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPublishModalOpen(false);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5-STEP COMMON CAMPAIGN CREATION WIZARD MODAL */}
      {/* ------------------------------------------------------------- */}
      {createWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <button
              onClick={() => setCreateWizardOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Stepper Header */}
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Unified Campaign</h3>
                  <p className="text-xs text-slate-500">Master Blueprint for Meta & Google Advertising</p>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="grid grid-cols-5 gap-1.5 mt-4 text-[10px] font-semibold text-center">
                <div
                  className={`p-1.5 rounded-lg border transition ${wizardStep >= 1 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                >
                  1. Details
                </div>
                <div
                  className={`p-1.5 rounded-lg border transition ${wizardStep >= 2 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                >
                  2. Platforms
                </div>
                <div
                  className={`p-1.5 rounded-lg border transition ${wizardStep >= 3 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                >
                  3. Targeting
                </div>
                <div
                  className={`p-1.5 rounded-lg border transition ${wizardStep >= 4 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                >
                  4. Content
                </div>
                <div
                  className={`p-1.5 rounded-lg border transition ${wizardStep >= 5 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                >
                  5. Review
                </div>
              </div>
            </div>

            {/* Wizard Body */}
            <form onSubmit={handleSaveDraft} className="py-4 space-y-4 text-xs text-slate-700">
              {saveDraftSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-800">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Master Campaign Draft Saved Successfully!
                  </div>
                  <p className="text-xs text-emerald-700">
                    Your internal campaign has been stored in FirstCall as a master record with status <strong>DRAFT</strong>.
                  </p>
                  <div className="bg-white/90 p-3 rounded-lg border border-emerald-200 font-mono text-[11px] text-slate-800 space-y-1">
                    <div>Campaign: <span className="font-bold">{saveDraftSuccess.name}</span></div>
                    <div>Objective: <span className="font-bold">{saveDraftSuccess.objective}</span></div>
                    <div>Platforms: <span className="font-bold">
                      {saveDraftSuccess.useMeta && saveDraftSuccess.useGoogle ? 'META + GOOGLE' : saveDraftSuccess.useMeta ? 'META' : 'GOOGLE'}
                    </span></div>
                    <div>Status: <span className="font-bold text-amber-700">DRAFT</span></div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCreateWizardOpen(false)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition"
                    >
                      View Campaigns
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {saveDraftError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs font-semibold">{saveDraftError}</div>
                    </div>
                  )}

                  {/* STEP 1: BASIC DETAILS */}
                  {wizardStep === 1 && (
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Campaign Name *</label>
                        <input
                          type="text"
                          required
                          value={campName}
                          onChange={(e) => setCampName(e.target.value)}
                          placeholder="e.g. Q4 Executive Lead Generation Campaign"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Business Objective *</label>
                        <div className="p-3 rounded-xl border border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold">
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>LEADS</span>
                            <Check className="w-4 h-4 text-indigo-600" />
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 font-normal">
                            Acquire high-intent business enquiries & customer contact forms.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700">Total Campaign Budget (₹ INR)</label>
                        <input
                          type="number"
                          min="1"
                          step="100"
                          value={campTotalBudget}
                          onChange={(e) => setCampTotalBudget(e.target.value)}
                          placeholder="e.g. 20000"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">Start Date</label>
                          <input
                            type="date"
                            value={campStartDate}
                            onChange={(e) => setCampStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700">End Date (Optional)</label>
                          <input
                            type="date"
                            value={campEndDate}
                            onChange={(e) => setCampEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: PLATFORM SELECTION */}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <div className="text-slate-500 text-[11px]">
                        Select which advertising networks this campaign blueprint will deploy to.
                      </div>

                      <div
                        onClick={() => setUseMeta(!useMeta)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          useMeta ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          <span className="font-bold text-slate-900 text-xs">Meta Marketing</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={useMeta}
                          onChange={(e) => setUseMeta(e.target.checked)}
                          className="cursor-pointer w-4 h-4 text-blue-600 rounded"
                        />
                      </div>

                      <div
                        onClick={() => setUseGoogle(!useGoogle)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          useGoogle ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          <span className="font-bold text-slate-900 text-xs">Google Ads</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={useGoogle}
                          onChange={(e) => setUseGoogle(e.target.checked)}
                          className="cursor-pointer w-4 h-4 text-emerald-600 rounded"
                        />
                      </div>

                      {/* Both platforms shortcut */}
                      <button
                        type="button"
                        onClick={() => {
                          setUseMeta(true);
                          setUseGoogle(true);
                        }}
                        className="w-full py-2 px-3 border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Select Both (Meta + Google)
                      </button>
                    </div>
                  )}

                      {/* STEP 3: AUDIENCE & TARGETING */}
                      {wizardStep === 3 && (
                        <div className="space-y-3.5">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Country / Region</label>
                            <select
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                            >
                              <option value="IN">India (IN)</option>
                              <option value="US">United States (US)</option>
                              <option value="AE">United Arab Emirates (AE)</option>
                              <option value="GB">United Kingdom (GB)</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700">Minimum Age</label>
                              <input
                                type="number"
                                min="18"
                                max="65"
                                value={minAge}
                                onChange={(e) => setMinAge(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-slate-700">Maximum Age</label>
                              <input
                                type="number"
                                min="18"
                                max="65"
                                value={maxAge}
                                onChange={(e) => setAgeMax(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Target Gender</label>
                            <select
                              value={gender}
                              onChange={(e) => setGender(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                            >
                              <option value="ALL">All Genders</option>
                              <option value="MALE">Men Only</option>
                              <option value="FEMALE">Women Only</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* STEP 4: CREATIVE & CONTENT */}
                      {wizardStep === 4 && (
                        <div className="space-y-3.5">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Ad Headline</label>
                            <input
                              type="text"
                              value={headline}
                              onChange={(e) => setHeadline(e.target.value)}
                              placeholder="e.g. Elevate Your Sales Pipeline"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Primary Text / Main Copy</label>
                            <textarea
                              rows={2}
                              value={primaryText}
                              onChange={(e) => setPrimaryText(e.target.value)}
                              placeholder="Compelling value proposition for your leads..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-slate-700">Description</label>
                            <input
                              type="text"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Additional context or bullet points..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                            />
                          </div>

                        </div>
                      )}

                      {/* STEP 5: REVIEW */}
                      {wizardStep === 5 && (
                        <div className="space-y-3">
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-500">Campaign Name:</span>
                              <span className="font-bold text-slate-900">{campName || 'Untitled'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-500">Objective:</span>
                              <span className="font-bold font-mono text-slate-800">{campObjective}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-500">Platforms:</span>
                              <span>{getPlatformBadges(useMeta, useGoogle)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-500">Total Budget:</span>
                              <span className="font-bold text-slate-900">
                                {campTotalBudget ? `₹${Number(campTotalBudget).toLocaleString()}` : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-500">Targeting:</span>
                              <span className="font-bold text-slate-800">{country} • Age {minAge}–{maxAge} • {gender}</span>
                            </div>
                            {headline && (
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Headline:</span>
                                <span className="font-bold text-slate-800 truncate max-w-xs">{headline}</span>
                              </div>
                            )}
                          </div>

                          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                            <div className="font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Step 1 Notice: Saving as Internal Campaign Draft
                            </div>
                            <p className="mt-0.5">
                              This campaign will be saved to FirstCall with status <strong>DRAFT</strong>. No external ad publishing will occur until you trigger publishing in subsequent workflow steps.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Navigation Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        {wizardStep > 1 ? (
                          <button
                            type="button"
                            onClick={() => setWizardStep((s) => s - 1)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                          >
                            Back
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCreateWizardOpen(false)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                          >
                            Cancel
                          </button>
                        )}

                        {wizardStep < 5 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (wizardStep === 1 && !campName.trim()) {
                                setSaveDraftError('Campaign Name is required');
                                return;
                              }
                              if (wizardStep === 2 && !useMeta && !useGoogle) {
                                setSaveDraftError('Please select at least one platform');
                                return;
                              }
                              setSaveDraftError(null);
                              setWizardStep((s) => s + 1);
                            }}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1"
                          >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="submit"
                            disabled={isSavingDraft}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                          >
                            {isSavingDraft ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Saving Draft...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Save Draft
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EDIT DRAFT MODAL */}
      {/* ------------------------------------------------------------- */}
      {editModalOpen && editingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Edit3 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Master Campaign Draft</h3>
                <p className="text-xs text-slate-500">Update configuration while in DRAFT status</p>
              </div>
            </div>

            <form onSubmit={handleUpdateDraft} className="py-4 space-y-3.5 text-xs text-slate-700">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs font-semibold">{editError}</div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Total Budget (₹)</label>
                <input
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Headline</label>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Primary Text</label>
                <textarea
                  rows={2}
                  value={editPrimaryText}
                  onChange={(e) => setEditPrimaryText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Landing Page URL</label>
                <input
                  type="url"
                  value={editLandingPage}
                  onChange={(e) => setEditLandingPage(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingDraft}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition"
                >
                  {isUpdatingDraft ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PLATFORM CAMPAIGN DETAILS DRAWER */}
      {/* ------------------------------------------------------------- */}
      {selectedPlatformCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedPlatformCampaign(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedPlatformCampaign.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                    {selectedPlatformCampaign.source}
                  </span>
                  {getStatusBadge(selectedPlatformCampaign.status)}
                </div>
              </div>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Megaphone className="w-4 h-4 text-indigo-600" />
                    Platform Campaign
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    PAUSED / Safe Test Mode
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400">Platform Campaign ID</span>
                    <div className="font-mono text-xs font-bold text-slate-900">
                      {selectedPlatformCampaign.platformCampaignId || '—'}
                    </div>
                  </div>
                  {selectedPlatformCampaign.platformCampaignId && (
                    <button
                      onClick={() => handleCopy(selectedPlatformCampaign.platformCampaignId!, 'plat-camp-copy')}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg bg-white border border-slate-200 transition flex items-center gap-1 font-bold text-[11px]"
                    >
                      {copiedId === 'plat-camp-copy' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy ID
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {selectedPlatformCampaign.adSet && (
                <div className="p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 space-y-2">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-indigo-600" />
                    Connected Ad Set
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-1">
                    <div className="font-bold text-slate-900">{selectedPlatformCampaign.adSet.name}</div>
                    <div className="text-[11px] text-indigo-700 font-mono">ID: {selectedPlatformCampaign.adSet.id}</div>
                    <div className="text-[11px] text-slate-500">
                      Budget: ₹{selectedPlatformCampaign.adSet.dailyBudget}/day • Optimization: {selectedPlatformCampaign.adSet.optimizationGoal}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium">Ad Account</span>
                  <div className="font-bold text-slate-800 mt-0.5 truncate">
                    {selectedPlatformCampaign.integration?.adAccountName || selectedPlatformCampaign.integration?.adAccountId || '—'}
                  </div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-medium">Linked Leads</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedPlatformCampaign.leadsCount} leads
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={`/client/leads?campaignName=${encodeURIComponent(selectedPlatformCampaign.name)}`}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                View Leads in CRM
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedPlatformCampaign(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
