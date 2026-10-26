'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import {
  Radio,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  Target,
  Sparkles,
  Info,
} from 'lucide-react';

interface ClientIntegrationItem {
  id: string;
  channel: 'META' | 'GOOGLE' | 'LINKEDIN' | 'WHATSAPP' | 'WEBSITE';
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  connectedAccount: string | null;
  selectedForm: string | null;
  lastSyncedAt: string | null;
}

export default function ClientIntegrationsPage() {
  const [integrations, setIntegrations] = useState<ClientIntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ClientIntegrationItem[]>('/client/integrations');
      setIntegrations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load integration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const getChannelItem = (channel: string) => {
    return integrations.find((i) => i.channel === channel);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                External Platform Integrations
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Live advertising and lead generation channels connected to your CRM tenant.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
          <Link
            href="/client/leads"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Target className="w-3.5 h-3.5" />
            View Leads
          </Link>
        </div>
      </div>


      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Meta / Facebook & Instagram */}
        {(() => {
          const item = getChannelItem('META');
          const isConnected = item?.status === 'CONNECTED';
          return (
            <div className="p-6 bg-white border border-slate-200/90 rounded-3xl flex flex-col justify-between space-y-5 shadow-xs hover:border-slate-300 transition">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 font-bold text-lg shadow-xs">
                      f
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Meta Lead Ads</h3>
                      <p className="text-[11px] text-slate-500">Facebook & Instagram Instant Forms</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item?.status === 'ERROR'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {item?.status || 'DISCONNECTED'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Connected Page</span>
                    <span className="font-bold text-slate-900">
                      {item?.connectedAccount || 'Not Selected'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Selected Lead Form</span>
                    <span className="font-bold text-slate-900">
                      {item?.selectedForm || 'All Forms / Default'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Last Sync</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {item?.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-[11px] text-slate-400">Leads tagged with source: META</span>
                <Link
                  href="/client/leads?source=META"
                  className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px]"
                >
                  View Meta Leads <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })()}

        {/* 2. Google Ads */}
        {(() => {
          const item = getChannelItem('GOOGLE');
          const isConnected = item?.status === 'CONNECTED';
          return (
            <div className="p-6 bg-white border border-slate-200/90 rounded-3xl flex flex-col justify-between space-y-5 shadow-xs hover:border-slate-300 transition">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 font-bold text-lg shadow-xs">
                      G
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Google Ads</h3>
                      <p className="text-[11px] text-slate-500">Search, Performance Max & Lead Form Extensions</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item?.status === 'ERROR'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {item?.status || 'DISCONNECTED'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Customer Account</span>
                    <span className="font-bold text-slate-900">
                      {item?.connectedAccount || 'Not Selected'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Attribution ID</span>
                    <span className="font-bold text-slate-900">
                      GCLID / Lead Extension
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Last Sync</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {item?.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-[11px] text-slate-400">Leads tagged with source: GOOGLE</span>
                <Link
                  href="/client/leads?source=GOOGLE"
                  className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px]"
                >
                  View Google Leads <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })()}

        {/* 3. LinkedIn Ads */}
        {(() => {
          const item = getChannelItem('LINKEDIN');
          const isConnected = item?.status === 'CONNECTED';
          return (
            <div className="p-6 bg-white border border-slate-200/90 rounded-3xl flex flex-col justify-between space-y-5 shadow-xs hover:border-slate-300 transition">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-700 font-bold text-base shadow-xs">
                      in
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">LinkedIn Lead Gen Forms</h3>
                      <p className="text-[11px] text-slate-500">Sponsored Content & B2B InMail Forms</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item?.status === 'ERROR'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {item?.status || 'DISCONNECTED'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Organization</span>
                    <span className="font-bold text-slate-900">
                      {item?.connectedAccount || 'Not Selected'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Lead Gen Form</span>
                    <span className="font-bold text-slate-900">
                      {item?.selectedForm || 'All Forms'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Last Sync</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {item?.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-[11px] text-slate-400">Leads tagged with source: LINKEDIN</span>
                <Link
                  href="/client/leads?source=LINKEDIN"
                  className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px]"
                >
                  View LinkedIn Leads <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })()}

        {/* 4. WhatsApp (Architecture Placeholder) */}
        <div className="p-6 bg-slate-50/60 border border-dashed border-slate-300 rounded-3xl flex flex-col justify-between space-y-5 opacity-90">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-sm shadow-xs">
                  WA
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">WhatsApp Business Cloud</h3>
                  <p className="text-[11px] text-slate-500">Inbound Click-to-WhatsApp Leads & Conversational CRM</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Coming Soon
              </span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs">
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Architecture placeholder prepared for Module 5. Message dispatch is intentionally disabled in this phase.
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-slate-500">
                <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Supports WhatsApp Cloud API & Twilio BSP in future release</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-xs">
            <span className="text-[11px] text-slate-400">Status: Architecture Reserved</span>
            <span className="text-[11px] font-bold text-slate-400">Module 5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
