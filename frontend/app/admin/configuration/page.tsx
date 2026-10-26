'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import {
  Sliders,
  Building2,
  Clock,
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ClientOption {
  id: string;
  name: string;
  businessCategory?: string;
}

interface LeadStageConfig {
  id?: string;
  name: string;
  color?: string;
  order: number;
  probability?: number;
}

function ConfigurationContent() {
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('clientId');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuration Form State
  const [companyName, setCompanyName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');

  // Lead Stages
  const [stages, setStages] = useState<LeadStageConfig[]>([]);

  // Lead Sources
  const [sources, setSources] = useState<string[]>([
    'META',
    'GOOGLE',
    'LINKEDIN',
    'WEBSITE',
    'WHATSAPP',
    'REFERRAL',
  ]);
  const [newSourceInput, setNewSourceInput] = useState('');

  // Notification Rules
  const [emailOnNewLead, setEmailOnNewLead] = useState(true);
  const [whatsappOnNewLead, setWhatsappNotification] = useState(false);
  const [dailySummaryEmail, setDailySummaryEmail] = useState(true);

  // Fetch client list
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const res = await apiFetch<{ data: ClientOption[] }>('/admin/clients?limit=100');
        setClients(res.data);
        if (res.data.length > 0) {
          const match = initialClientId && res.data.find((c) => c.id === initialClientId);
          setSelectedClientId(match ? match.id : res.data[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch clients');
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, [initialClientId]);

  // Fetch configuration for selected client
  const fetchClientConfig = async (cid: string) => {
    if (!cid) return;
    setLoadingConfig(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await apiFetch<any>(`/admin/clients/${cid}`);
      const client = res.client;
      setCompanyName(client.name);
      setBusinessCategory(client.businessCategory || '');
      setTimezone(client.timezone || 'Asia/Kolkata');

      const settings = client.settings || {};
      const profile = settings.companyProfile || {};
      setWebsite(profile.website || '');
      setIndustry(profile.industry || client.businessCategory || '');
      setDescription(profile.description || '');

      setStages(client.leadStages || []);
      setSources(settings.leadSources || ['META', 'GOOGLE', 'LINKEDIN', 'WEBSITE', 'WHATSAPP', 'REFERRAL']);

      const notifs = settings.notificationRules || {};
      setEmailOnNewLead(notifs.emailOnNewLead ?? true);
      setWhatsappNotification(notifs.whatsappOnNewLead ?? false);
      setDailySummaryEmail(notifs.dailySummaryEmail ?? true);
    } catch (err: any) {
      setError(err.message || 'Failed to load client configuration');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      fetchClientConfig(selectedClientId);
    }
  }, [selectedClientId]);

  // Stage Handlers
  const handleStageChange = (index: number, field: string, val: any) => {
    const updated = [...stages];
    (updated[index] as any)[field] = val;
    setStages(updated);
  };

  const handleAddStage = () => {
    const newStage: LeadStageConfig = {
      name: 'New Stage',
      color: '#4F46E5',
      order: stages.length + 1,
      probability: 50,
    };
    setStages([...stages, newStage]);
  };

  const handleRemoveStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  // Source Handlers
  const handleToggleSource = (src: string) => {
    if (sources.includes(src)) {
      setSources(sources.filter((s) => s !== src));
    } else {
      setSources([...sources, src]);
    }
  };

  const handleAddCustomSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceInput.trim()) return;
    const clean = newSourceInput.trim().toUpperCase();
    if (!sources.includes(clean)) {
      setSources([...sources, clean]);
    }
    setNewSourceInput('');
  };

  // Save Configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    setSaveLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/admin/clients/${selectedClientId}/config`, {
        method: 'PATCH',
        body: JSON.stringify({
          businessCategory,
          timezone,
          companyProfile: {
            website,
            industry,
            description,
          },
          leadStages: stages.map((s, idx) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            order: idx + 1,
            probability: s.probability ? Number(s.probability) : 10,
          })),
          leadSources: sources,
          notificationRules: {
            emailOnNewLead,
            whatsappOnNewLead,
            dailySummaryEmail,
          },
        }),
      });

      setSuccessMessage('Client configuration saved and synchronized successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-8 font-sans pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-indigo-600" />
            Client Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure tenant-specific parameters: company profile, business category, timezone, lead stages, lead sources, and notification rules.
          </p>
        </div>

        {/* Client Selector Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">Configuring Client:</span>
          {loadingClients ? (
            <div className="w-48 h-9 bg-slate-200 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.businessCategory ? `(${c.businessCategory})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {loadingConfig ? (
        <div className="p-16 text-center text-xs text-slate-400 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading tenant configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Company Profile, Business Category & Timezone */}
          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                1. Company Profile, Category & Timezone
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">Tenant-Isolated Settings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Business Category *
                </label>
                <input
                  type="text"
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  placeholder="e.g. Real Estate & Properties"
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Operating Timezone *
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:border-indigo-600"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST - UTC-05:00)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST - UTC-08:00)</option>
                  <option value="Europe/London">Europe/London (GMT - UTC+00:00)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://clientwebsite.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Company Bio / Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of the client business and target customer profile..."
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Lead Stages Configuration */}
          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  2. Lead Pipeline Stages & Probabilities
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define custom stages for this client's sales funnel and Kanban board.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddStage}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stage
              </button>
            </div>

            <div className="space-y-2.5">
              {stages.map((stage, idx) => (
                <div
                  key={stage.id || idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => handleStageChange(idx, 'name', e.target.value)}
                      placeholder="Stage Name"
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Probability */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-medium">Win %:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={stage.probability ?? 10}
                        onChange={(e) => handleStageChange(idx, 'probability', e.target.value)}
                        className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-bold text-slate-900"
                      />
                    </div>

                    {/* Delete stage */}
                    {stages.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Stage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Lead Sources */}
          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  3. Allowed Lead Sources & Ingestion Channels
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active marketing and attribution channels enabled for this tenant.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {['META', 'GOOGLE', 'LINKEDIN', 'WEBSITE', 'WHATSAPP', 'REFERRAL', 'CSV_IMPORT', ...sources.filter(s => !['META', 'GOOGLE', 'LINKEDIN', 'WEBSITE', 'WHATSAPP', 'REFERRAL', 'CSV_IMPORT'].includes(s))].map((src) => {
                const isSelected = sources.includes(src);
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => handleToggleSource(src)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {src}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={newSourceInput}
                onChange={(e) => setNewSourceInput(e.target.value)}
                placeholder="Add custom source (e.g. TIKTOK)..."
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={handleAddCustomSource}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Section 4: Notification Rules */}
          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bell className="w-4 h-4 text-indigo-600" />
              4. Tenant Notification Rules
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={emailOnNewLead}
                  onChange={(e) => setEmailOnNewLead(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Email on New Lead Ingestion</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={whatsappOnNewLead}
                  onChange={(e) => setWhatsappNotification(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>WhatsApp Notification on New Lead</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={dailySummaryEmail}
                  onChange={(e) => setDailySummaryEmail(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Daily Activity Digest Email</span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={saveLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {saveLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Tenant Settings...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save & Apply Configuration
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AdminConfigurationPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Loading Configuration...</div>}>
      <ConfigurationContent />
    </Suspense>
  );
}
