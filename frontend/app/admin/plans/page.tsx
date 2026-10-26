'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import {
  Layers,
  CheckCircle2,
  Users,
  Target,
  Megaphone,
  ShieldCheck,
  RefreshCw,
  Building2,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface PlanDefinition {
  id: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  name: string;
  description: string;
  priceMonthly: number;
  maxUsers: number;
  maxLeads: number;
  maxCampaigns: number;
  enabledModules: string[];
  isActive: boolean;
}

interface ClientUsageItem {
  id: string;
  name: string;
  businessCategory?: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  metrics: {
    usersCount: number;
    leadsCount: number;
    campaignsCount: number;
    integrationsCount: number;
  };
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [clients, setClients] = useState<ClientUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<string | null>(null);

  // Plan changer modal
  const [changePlanModal, setChangePlanModal] = useState<{
    open: boolean;
    client: ClientUsageItem | null;
    selectedPlan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  }>({ open: false, client: null, selectedPlan: 'STARTER' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, clientsData] = await Promise.all([
        apiFetch<PlanDefinition[]>('/admin/plans'),
        apiFetch<{ data: ClientUsageItem[] }>('/admin/clients?limit=50'),
      ]);
      setPlans(plansData);
      setClients(clientsData.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load plans and usage data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdatePlan = async () => {
    if (!changePlanModal.client) return;
    setActionLoading(true);
    try {
      await apiFetch(`/admin/clients/${changePlanModal.client.id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan: changePlanModal.selectedPlan }),
      });
      setChangePlanModal({ open: false, client: null, selectedPlan: 'STARTER' });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update plan');
    } finally {
      setActionLoading(false);
    }
  };

  const getPlanDetails = (planId: string) => {
    return plans.find((p) => p.id === planId) || plans[0];
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Subscription & Plan Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure multi-tenant plan tiers, monitor client usage vs quotas, and enforce module entitlements.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 self-start sm:self-auto transition shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Usage
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Section 1: Plan Tiers Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Available Plan Tiers & Resource Limits
            </h2>
            <p className="text-xs text-slate-500">
              Click any plan tier to select it and inspect its resource quotas and enrolled tenants.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setSelectedPlanTier(null)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                selectedPlanTier === null
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Plans ({clients.length})
            </button>
            {(['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const).map((tierId) => {
              const count = clients.filter((c) => c.plan === tierId).length;
              const isSelected = selectedPlanTier === tierId;
              return (
                <button
                  key={tierId}
                  type="button"
                  onClick={() => setSelectedPlanTier(isSelected ? null : tierId)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tierId} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-white border border-slate-200 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p) => {
              const enrolledCount = clients.filter((c) => c.plan === p.id).length;
              const isSelected = selectedPlanTier === p.id;
              const isPopular = p.id === 'PRO';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanTier(isSelected ? null : p.id)}
                  className={`p-6 rounded-3xl border flex flex-col justify-between relative transition-all duration-200 cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-white border-2 border-indigo-600 shadow-lg shadow-indigo-600/15 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  {isSelected ? (
                    <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> SELECTED
                    </span>
                  ) : isPopular ? (
                    <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-xs">
                      MOST POPULAR
                    </span>
                  ) : null}

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600">{p.id}</span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {enrolledCount} active client{enrolledCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{p.name}</h3>
                      <p className="text-[11px] text-slate-500 mt-1 min-h-[32px]">{p.description}</p>
                    </div>

                    <div className="py-2.5 border-y border-slate-100">
                      <span className="text-2xl font-bold text-slate-900">${p.priceMonthly}</span>
                      <span className="text-xs text-slate-500"> / month</span>
                    </div>

                    {/* Limits */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> Max Users:
                        </span>
                        <span className="font-bold text-slate-900">
                          {p.maxUsers >= 1000 ? 'Unlimited' : `${p.maxUsers} seats`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Target className="w-3.5 h-3.5 text-slate-400" /> Max Leads:
                        </span>
                        <span className="font-bold text-slate-900">
                          {p.maxLeads >= 1000000 ? 'Unlimited' : p.maxLeads.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Megaphone className="w-3.5 h-3.5 text-slate-400" /> Ad Campaigns:
                        </span>
                        <span className="font-bold text-slate-900">
                          {p.maxCampaigns >= 1000 ? 'Unlimited' : p.maxCampaigns}
                        </span>
                      </div>
                    </div>

                    {/* Enabled Modules */}
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                        Enabled Modules:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {p.enabledModules.map((m) => (
                          <span
                            key={m}
                            className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize"
                          >
                            {m.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Selection Button */}
                  <div className="pt-4 mt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlanTier(isSelected ? null : p.id);
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                          : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Selected (Click to Clear)
                        </>
                      ) : (
                        <>Select {p.name}</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Tenant Usage Tracking Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Tenant Usage & Quota Tracking
            </h2>
            <p className="text-xs text-slate-500">
              {selectedPlanTier ? (
                <span>
                  Filtering tenants assigned to the{' '}
                  <span className="font-bold text-indigo-600">{selectedPlanTier}</span> plan tier.
                </span>
              ) : (
                'Live capacity monitoring of all tenant organizations against their assigned plan quotas.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPlanTier && (
              <button
                type="button"
                onClick={() => setSelectedPlanTier(null)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Show All Plans
              </button>
            )}
            <span className="text-xs text-slate-500 font-semibold">
              {selectedPlanTier
                ? `${clients.filter((c) => c.plan === selectedPlanTier).length} of ${clients.length} Tenants`
                : `${clients.length} Total Tenants`}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading usage statistics...</div>
        ) : (selectedPlanTier ? clients.filter((c) => c.plan === selectedPlanTier) : clients).length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl space-y-2">
            <p>No tenants currently assigned to the {selectedPlanTier || ''} plan.</p>
            {selectedPlanTier && (
              <button
                type="button"
                onClick={() => setSelectedPlanTier(null)}
                className="text-indigo-600 hover:underline font-bold text-xs"
              >
                Clear filter to view all tenants
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">Client Organization</th>
                  <th className="py-3.5 px-4">Assigned Plan</th>
                  <th className="py-3.5 px-4">User Seats</th>
                  <th className="py-3.5 px-4">Lead Quota</th>
                  <th className="py-3.5 px-4">Campaigns</th>
                  <th className="py-3.5 px-4 text-right">Plan Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedPlanTier ? clients.filter((c) => c.plan === selectedPlanTier) : clients).map((c) => {
                  const plan = getPlanDetails(c.plan);
                  const userPct = Math.min(100, Math.round((c.metrics.usersCount / plan.maxUsers) * 100));
                  const leadPct = Math.min(100, Math.round((c.metrics.leadsCount / plan.maxLeads) * 100));

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      {/* Name */}
                      <td className="py-4 px-4">
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="font-bold text-slate-900 hover:text-indigo-600 transition"
                        >
                          {c.name}
                        </Link>
                        <p className="text-[11px] text-slate-400">{c.businessCategory || 'General'}</p>
                      </td>

                      {/* Plan */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {c.plan}
                        </span>
                      </td>

                      {/* Users Usage */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-900 font-bold">{c.metrics.usersCount}</span>
                            <span className="text-slate-400">/ {plan.maxUsers}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${userPct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                              style={{ width: `${userPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Leads Usage */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 w-36">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-900 font-bold">{c.metrics.leadsCount}</span>
                            <span className="text-slate-400">/ {plan.maxLeads.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${leadPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${leadPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Campaigns */}
                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {c.metrics.campaignsCount} / {plan.maxCampaigns}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() =>
                            setChangePlanModal({
                              open: true,
                              client: c,
                              selectedPlan: c.plan,
                            })
                          }
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                        >
                          Change Plan
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

      {/* Change Plan Modal */}
      {changePlanModal.open && changePlanModal.client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Change Subscription Plan
            </h3>
            <p className="text-xs text-slate-500">
              Select a new plan tier for{' '}
              <span className="text-slate-900 font-bold">{changePlanModal.client.name}</span>:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {plans.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setChangePlanModal({ ...changePlanModal, selectedPlan: tier.id })}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    changePlanModal.selectedPlan === tier.id
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-950 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{tier.id}</p>
                  <p className="text-[10px] text-indigo-600 mt-0.5 font-bold">${tier.priceMonthly}/mo</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {tier.maxUsers} users • {tier.maxLeads.toLocaleString()} leads
                  </p>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setChangePlanModal({ open: false, client: null, selectedPlan: 'STARTER' })}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdatePlan}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? 'Updating...' : 'Confirm Plan Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
