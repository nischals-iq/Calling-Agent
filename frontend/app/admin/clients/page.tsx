'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import {
  Building2,
  Search,
  Filter,
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Layers,
  ShieldCheck,
  RefreshCw,
  Mail,
  Phone,
  Globe,
  Radio,
} from 'lucide-react';

interface ClientItem {
  id: string;
  name: string;
  businessCategory?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  country?: string;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  createdAt: string;
  metrics: {
    usersCount: number;
    leadsCount: number;
    campaignsCount: number;
    integrationsCount: number;
  };
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle confirmation dialog
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    client: ClientItem | null;
    targetStatus: 'ACTIVE' | 'INACTIVE';
  }>({ open: false, client: null, targetStatus: 'ACTIVE' });
  const [actionLoading, setActionLoading] = useState(false);

  // Plan change modal
  const [planModal, setPlanModal] = useState<{
    open: boolean;
    client: ClientItem | null;
    selectedPlan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  }>({ open: false, client: null, selectedPlan: 'STARTER' });

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (planFilter) params.append('plan', planFilter);

      const res = await apiFetch<{
        data: ClientItem[];
        meta: { total: number; page: number; totalPages: number };
      }>(`/admin/clients?${params.toString()}`);

      setClients(res.data);
      setTotal(res.meta.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [page, statusFilter, planFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClients();
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModal.client) return;
    setActionLoading(true);
    try {
      await apiFetch(`/admin/clients/${statusModal.client.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusModal.targetStatus }),
      });
      setStatusModal({ open: false, client: null, targetStatus: 'ACTIVE' });
      fetchClients();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!planModal.client) return;
    setActionLoading(true);
    try {
      await apiFetch(`/admin/clients/${planModal.client.id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan: planModal.selectedPlan }),
      });
      setPlanModal({ open: false, client: null, selectedPlan: 'STARTER' });
      fetchClients();
    } catch (err: any) {
      alert(err.message || 'Failed to update plan');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Client Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage multi-tenant client accounts, subscriptions, activation status, and data settings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchClients}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition shadow-xs"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/admin/clients/create"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Onboard Client
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <form onSubmit={handleSearchSubmit} className="w-full md:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact name, email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
          />
        </form>

        <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-600 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-600 font-medium"
            >
              <option value="">All Plans</option>
              <option value="FREE">Free</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Clients Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No clients match your filter criteria or no clients have been onboarded yet.
            </p>
            <Link
              href="/admin/clients/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Onboard First Client
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">Company</th>
                  <th className="py-3.5 px-4">Primary Contact</th>
                  <th className="py-3.5 px-4">Plan</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Users / Leads</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    {/* Company */}
                    <td className="py-4 px-4">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 transition"
                      >
                        {c.name}
                      </Link>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {c.businessCategory || 'Uncategorized'} • {c.country || 'Global'}
                      </p>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4">
                      <p className="font-semibold text-slate-800">{c.primaryContactName}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{c.primaryContactEmail}</span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-4">
                      <button
                        onClick={() =>
                          setPlanModal({
                            open: true,
                            client: c,
                            selectedPlan: c.plan,
                          })
                        }
                        className="group flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
                        title="Click to change plan"
                      >
                        <Layers className="w-3 h-3 text-indigo-500" />
                        <span>{c.plan}</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {c.status}
                      </span>
                    </td>

                    {/* Usage / Metrics */}
                    <td className="py-4 px-4 text-slate-600 text-[11px] font-medium">
                      <span>{c.metrics.usersCount} Users</span>
                      <span className="mx-1.5 text-slate-300">•</span>
                      <span>{c.metrics.leadsCount} Leads</span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle Status Button */}
                        <button
                          onClick={() =>
                            setStatusModal({
                              open: true,
                              client: c,
                              targetStatus: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            c.status === 'ACTIVE'
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Integrations Tab Direct Link */}
                        <Link
                          href={`/admin/clients/${c.id}?tab=integrations`}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                          title="Configure external platform integrations (Meta, Google, LinkedIn)"
                        >
                          <Radio className="w-3 h-3" /> Integrations
                        </Link>

                        {/* Open Details */}
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Activate / Deactivate */}
      {statusModal.open && statusModal.client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {statusModal.targetStatus === 'ACTIVE' ? 'Activate Client?' : 'Deactivate Client?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {statusModal.targetStatus === 'ACTIVE'
                  ? `Are you sure you want to activate ${statusModal.client.name}? Its users will regain access to the CRM.`
                  : `Are you sure you want to deactivate ${statusModal.client.name}? All tenant users will be blocked from accessing this workspace.`}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusModal({ open: false, client: null, targetStatus: 'ACTIVE' })}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm ${
                  statusModal.targetStatus === 'ACTIVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading ? 'Updating...' : `Confirm ${statusModal.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Change Modal */}
      {planModal.open && planModal.client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Change Subscription Plan
            </h3>
            <p className="text-xs text-slate-500">
              Select a new subscription tier for{' '}
              <span className="text-slate-900 font-bold">{planModal.client.name}</span>:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {(['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPlanModal({ ...planModal, selectedPlan: tier })}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    planModal.selectedPlan === tier
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{tier}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {tier === 'FREE' && 'Max 2 users, 100 leads'}
                    {tier === 'STARTER' && 'Max 5 users, 2.5k leads'}
                    {tier === 'PRO' && 'Max 25 users, 20k leads'}
                    {tier === 'ENTERPRISE' && 'Unlimited scale'}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPlanModal({ open: false, client: null, selectedPlan: 'STARTER' })}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPlanChange}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                {actionLoading ? 'Saving...' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
