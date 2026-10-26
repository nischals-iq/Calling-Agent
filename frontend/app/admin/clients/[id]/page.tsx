'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import {
  Building2,
  ArrowLeft,
  Users,
  Layers,
  Activity,
  Radio,
  Sliders,
  Mail,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  RefreshCw,
  Target,
  Megaphone,
  Settings,
  Key,
  Lock,
  Link2,
  Unlink,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface IntegrationDetail {
  id: string;
  clientId: string;
  channel: 'META' | 'GOOGLE' | 'LINKEDIN' | 'WEBSITE' | 'WHATSAPP';
  name?: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  credentials: Record<string, any>;
  metadata: Record<string, any>;
  lastSyncedAt?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ClientDetailResponse {
  client: {
    id: string;
    name: string;
    businessCategory?: string;
    primaryContactName: string;
    primaryContactEmail: string;
    primaryContactPhone?: string;
    companyAddress?: string;
    country?: string;
    timezone: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    settings?: any;
    createdAt: string;
    users: Array<{
      id: string;
      name: string;
      email: string;
      mobile?: string;
      role: string;
      isActive: boolean;
      lastLoginAt?: string;
      createdAt: string;
    }>;
    integrations: Array<{
      id: string;
      channel: string;
      name?: string;
      status: string;
      lastSyncedAt?: string;
      errorMessage?: string;
    }>;
    leadStages: Array<{
      id: string;
      name: string;
      order: number;
      color?: string;
      probability?: number;
      isWon: boolean;
      isLost: boolean;
    }>;
  };
  usage: {
    plan: {
      name: string;
      maxUsers: number;
      maxLeads: number;
      maxCampaigns: number;
      enabledModules: string[];
    };
    metrics: {
      users: { current: number; max: number };
      leads: { current: number; max: number };
      campaigns: { current: number; max: number };
    };
    enabledModules: string[];
  };
  recentActivity: Array<{
    id: string;
    action: string;
    resource: string;
    details?: any;
    createdAt: string;
    user?: { name: string; email: string };
  }>;
}

export default function ClientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');

  const [data, setData] = useState<ClientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'integrations' | 'usage' | 'activity' | 'config'>(
    urlTab && ['profile', 'users', 'integrations', 'usage', 'activity', 'config'].includes(urlTab)
      ? (urlTab as any)
      : 'profile',
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'users', 'integrations', 'usage', 'activity', 'config'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // Edit Profile Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchClientDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ClientDetailResponse>(`/admin/clients/${clientId}`);
      setData(res);
      // Initialize edit fields
      setEditName(res.client.name);
      setEditCategory(res.client.businessCategory || '');
      setEditContactName(res.client.primaryContactName);
      setEditContactEmail(res.client.primaryContactEmail);
      setEditContactPhone(res.client.primaryContactPhone || '');
      setEditAddress(res.client.companyAddress || '');
      setEditTimezone(res.client.timezone);
    } catch (err: any) {
      setError(err.message || 'Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientDetails();
    fetchIntegrations();
  }, [clientId]);

  // Integrations Tab State
  const [integrationsList, setIntegrationsList] = useState<IntegrationDetail[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [configModalChannel, setConfigModalChannel] = useState<'META' | 'GOOGLE' | 'LINKEDIN' | null>(null);
  const [configSaveLoading, setConfigSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [configFormError, setConfigFormError] = useState<string | null>(null);

  // Meta Form Fields
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaRedirectUri, setMetaRedirectUri] = useState('http://localhost:8000/api/integrations/meta/callback');
  const [metaVerifyToken, setMetaVerifyToken] = useState('calling_agent_meta_verify_token_2026');
  const [metaApiVersion, setMetaApiVersion] = useState('v19.0');
  const [metaPageId, setMetaPageId] = useState('');
  const [metaPageName, setMetaPageName] = useState('');
  const [metaFormId, setMetaFormId] = useState('');
  const [metaFormName, setMetaFormName] = useState('');

  // Google Ads Form Fields
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleDevToken, setGoogleDevToken] = useState('');
  const [googleRedirectUri, setGoogleRedirectUri] = useState('http://localhost:8000/api/integrations/google/callback');
  const [googleCustomerId, setGoogleCustomerId] = useState('');
  const [googleManagerId, setGoogleManagerId] = useState('');
  const [googleAccountName, setGoogleAccountName] = useState('');

  // LinkedIn Form Fields
  const [linkedinClientId, setLinkedinClientId] = useState('');
  const [linkedinClientSecret, setLinkedinClientSecret] = useState('');
  const [linkedinRedirectUri, setLinkedinRedirectUri] = useState('http://localhost:8000/api/integrations/linkedin/callback');
  const [linkedinOrgId, setLinkedinOrgId] = useState('');
  const [linkedinOrgName, setLinkedinOrgName] = useState('');
  const [linkedinFormId, setLinkedinFormId] = useState('');
  const [linkedinFormName, setLinkedinFormName] = useState('');

  const fetchIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const res = await apiFetch<IntegrationDetail[]>(`/admin/clients/${clientId}/integrations`);
      setIntegrationsList(res);
    } catch {
      // Fallback
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const getChannelData = (channel: 'META' | 'GOOGLE' | 'LINKEDIN'): IntegrationDetail => {
    return (
      integrationsList.find((i) => i.channel === channel) || {
        id: '',
        clientId,
        channel,
        status: 'DISCONNECTED',
        credentials: {},
        metadata: {},
        lastSyncedAt: null,
        errorMessage: null,
      }
    );
  };

  const openConfigModal = (channel: 'META' | 'GOOGLE' | 'LINKEDIN') => {
    setConfigModalChannel(channel);
    setTestResult(null);
    setConfigFormError(null);

    const existing = integrationsList.find((i) => i.channel === channel);
    if (channel === 'META') {
      setMetaAppId(existing?.credentials?.appId || '');
      setMetaAppSecret(existing?.credentials?.appSecret || '');
      setMetaRedirectUri(existing?.credentials?.redirectUri || 'http://localhost:8000/api/integrations/meta/callback');
      setMetaVerifyToken(existing?.credentials?.webhookVerifyToken || '');
      setMetaApiVersion(existing?.credentials?.apiVersion || 'v19.0');
      setMetaPageId(existing?.metadata?.pageId || '');
      setMetaPageName(existing?.metadata?.pageName || '');
      setMetaFormId(existing?.metadata?.formId || existing?.metadata?.leadFormId || '');
      setMetaFormName(existing?.metadata?.formName || existing?.metadata?.leadFormName || '');
    } else if (channel === 'GOOGLE') {
      setGoogleClientId(existing?.credentials?.clientId || '');
      setGoogleClientSecret(existing?.credentials?.clientSecret || '');
      setGoogleDevToken(existing?.credentials?.developerToken || '');
      setGoogleRedirectUri(existing?.credentials?.redirectUri || 'http://localhost:8000/api/integrations/google/callback');
      setGoogleCustomerId(existing?.credentials?.customerId || '');
      setGoogleManagerId(existing?.credentials?.managerAccountId || '');
      setGoogleAccountName(existing?.metadata?.accountName || '');
    } else if (channel === 'LINKEDIN') {
      setLinkedinClientId(existing?.credentials?.clientId || '');
      setLinkedinClientSecret(existing?.credentials?.clientSecret || '');
      setLinkedinRedirectUri(existing?.credentials?.redirectUri || 'http://localhost:8000/api/integrations/linkedin/callback');
      setLinkedinOrgId(existing?.metadata?.organizationId || '');
      setLinkedinOrgName(existing?.metadata?.organizationName || '');
      setLinkedinFormId(existing?.metadata?.formId || '');
      setLinkedinFormName(existing?.metadata?.formName || '');
    }
  };

  const handleSaveIntegrationConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configModalChannel) return;
    setConfigFormError(null);
    setTestResult(null);

    // Meta-specific strict validation
    if (configModalChannel === 'META') {
      const trimmedAppId = metaAppId.trim();
      if (!trimmedAppId || !/^\d+$/.test(trimmedAppId)) {
        setConfigFormError('Enter a valid numeric Meta App ID.');
        return;
      }
      if (metaPageId.trim() && !/^\d+$/.test(metaPageId.trim())) {
        setConfigFormError('Connected Page ID must be numeric.');
        return;
      }
      if (metaFormId.trim() && !/^\d+$/.test(metaFormId.trim())) {
        setConfigFormError('Lead Form ID must be numeric.');
        return;
      }
    }

    setConfigSaveLoading(true);

    let payload: Record<string, any> = {};
    if (configModalChannel === 'META') {
      payload = {
        appId: metaAppId.trim(),
        appSecret: metaAppSecret.trim(),
        redirectUri: metaRedirectUri.trim(),
        webhookVerifyToken: metaVerifyToken.trim(),
        apiVersion: metaApiVersion.trim(),
        pageId: metaPageId.trim(),
        pageName: metaPageName.trim(),
        formId: metaFormId.trim(),
        leadFormId: metaFormId.trim(),
        formName: metaFormName.trim(),
        leadFormName: metaFormName.trim(),
      };
    } else if (configModalChannel === 'GOOGLE') {
      payload = {
        clientId: googleClientId.trim(),
        clientSecret: googleClientSecret.trim(),
        developerToken: googleDevToken.trim(),
        redirectUri: googleRedirectUri.trim(),
        customerId: googleCustomerId.trim(),
        managerAccountId: googleManagerId.trim(),
        accountName: googleAccountName.trim(),
      };
    } else if (configModalChannel === 'LINKEDIN') {
      payload = {
        clientId: linkedinClientId.trim(),
        clientSecret: linkedinClientSecret.trim(),
        redirectUri: linkedinRedirectUri.trim(),
        organizationId: linkedinOrgId.trim(),
        organizationName: linkedinOrgName.trim(),
        formId: linkedinFormId.trim(),
        formName: linkedinFormName.trim(),
      };
    }

    try {
      await apiFetch(`/admin/clients/${clientId}/integrations/${configModalChannel}/config`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      alert(`${configModalChannel} configuration saved securely.`);
      setConfigModalChannel(null);
      fetchIntegrations();
      fetchClientDetails();
    } catch (err: any) {
      setConfigFormError(err.message || 'Failed to save configuration');
    } finally {
      setConfigSaveLoading(false);
    }
  };

  const handleTestIntegration = async (channel: 'META' | 'GOOGLE' | 'LINKEDIN') => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>(
        `/admin/clients/${clientId}/integrations/${channel}/test`,
        { method: 'POST' },
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Test failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleConnectIntegration = async (channel: 'META' | 'GOOGLE' | 'LINKEDIN') => {
    try {
      const res = await apiFetch<{ authUrl?: string; message: string }>(
        `/admin/clients/${clientId}/integrations/${channel}/connect`,
        { method: 'POST' },
      );
      if (res.authUrl) {
        window.open(res.authUrl, '_blank', 'width=600,height=700');
      } else {
        alert(res.message);
      }
      fetchIntegrations();
    } catch (err: any) {
      alert(err.message || 'Failed to initiate connection');
    }
  };

  const handleDisconnectIntegration = async (channel: 'META' | 'GOOGLE' | 'LINKEDIN') => {
    if (!confirm(`Are you sure you want to disconnect ${channel}? Live lead sync will be paused.`)) return;
    try {
      await apiFetch(`/admin/clients/${clientId}/integrations/${channel}/disconnect`, {
        method: 'POST',
      });
      fetchIntegrations();
      fetchClientDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await apiFetch(`/admin/clients/${clientId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          businessCategory: editCategory,
          primaryContactName: editContactName,
          primaryContactEmail: editContactEmail,
          primaryContactPhone: editContactPhone,
          companyAddress: editAddress,
          timezone: editTimezone,
        }),
      });
      setEditModalOpen(false);
      fetchClientDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!data) return;
    const newStatus = data.client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

    try {
      await apiFetch(`/admin/clients/${clientId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchClientDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Client Not Found</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Client List
        </Link>
      </div>
    );
  }

  const { client, usage, recentActivity } = data;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Building2 },
    { id: 'users', label: `Users (${client.users.length})`, icon: Users },
    { id: 'integrations', label: 'Integrations', icon: Radio },
    { id: 'usage', label: 'Usage & Plan', icon: Layers },
    { id: 'activity', label: 'Activity Trail', icon: Activity },
    { id: 'config', label: 'CRM Config', icon: Sliders },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/clients"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{client.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  client.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {client.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {client.plan} PLAN
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tenant ID: <span className="font-mono text-slate-700">{client.id}</span> • Created on{' '}
              {new Date(client.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/configuration?clientId=${client.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5" />
            Configure CRM
          </Link>
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition shadow-xs cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          <button
            onClick={handleToggleStatus}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow-xs ${
              client.status === 'ACTIVE'
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {client.status === 'ACTIVE' ? 'Deactivate Tenant' : 'Activate Tenant'}
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Company Information
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Business Category</span>
                <span className="font-bold text-slate-900">{client.businessCategory || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Country</span>
                <span className="font-bold text-slate-900">{client.country || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Timezone</span>
                <span className="font-bold text-slate-900">{client.timezone}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Address</span>
                <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">
                  {client.companyAddress || 'Not specified'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Primary Contact Details
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Full Name</span>
                <span className="font-bold text-slate-900">{client.primaryContactName}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Email Address</span>
                <span className="font-bold text-slate-900">{client.primaryContactEmail}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Mobile Phone</span>
                <span className="font-bold text-slate-900">{client.primaryContactPhone || 'Not provided'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Tenant Users Directory
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {client.users.length} of {usage.plan.maxUsers} Allowed Seats
            </span>
          </div>

          {client.users.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No users have been created for this client yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/60">
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-bold text-slate-900">{u.name}</td>
                      <td className="py-3 px-3 text-slate-600">{u.email}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Integrations */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">External Advertising & Channel Integrations</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Configure client-level API credentials, manage OAuth tokens, and ingest leads directly into the CRM.
              </p>
            </div>
            <button
              onClick={() => {
                fetchIntegrations();
                fetchClientDetails();
              }}
              disabled={loadingIntegrations}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingIntegrations ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Meta (Facebook / Instagram) */}
            {(() => {
              const meta = getChannelData('META');
              const isConnected = meta.status === 'CONNECTED';
              return (
                <div className="p-6 bg-white border border-slate-200/90 rounded-3xl flex flex-col justify-between space-y-4 shadow-xs hover:border-slate-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 font-bold text-base">
                        f
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">Meta / Facebook & Instagram</h3>
                        <p className="text-[11px] text-slate-500">Facebook Lead Ads, Instagram Ads, Instant Forms</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isConnected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : meta.status === 'ERROR'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {meta.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">App ID:</span>
                      <span className="font-mono font-bold text-slate-800">{meta.credentials?.appId || 'Not Configured'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Connected Page:</span>
                      <span className="font-bold text-slate-800">{meta.metadata?.pageName || meta.metadata?.pageId || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Selected Form:</span>
                      <span className="font-bold text-slate-800">{meta.metadata?.formName || meta.metadata?.formId || 'All Forms'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Token Health:</span>
                      <span className="font-bold text-slate-800">
                        {meta.credentials?.accessToken ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active (Encrypted)
                          </span>
                        ) : (
                          <span className="text-slate-400">Token Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Last Synced:</span>
                      <span className="text-slate-700 font-medium">
                        {meta.lastSyncedAt ? new Date(meta.lastSyncedAt).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    {meta.errorMessage && (
                      <p className="text-rose-600 font-medium pt-1 border-t border-slate-200">{meta.errorMessage}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openConfigModal('META')}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configure
                    </button>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnectIntegration('META')}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectIntegration('META')}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 2. Google Ads */}
            {(() => {
              const google = getChannelData('GOOGLE');
              const isConnected = google.status === 'CONNECTED';
              return (
                <div className="p-6 bg-white border border-slate-200/90 rounded-3xl flex flex-col justify-between space-y-4 shadow-xs hover:border-slate-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 font-bold text-base">
                        G
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">Google Ads</h3>
                        <p className="text-[11px] text-slate-500">Lead Form Extensions, Performance Max, Search Campaigns</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isConnected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : google.status === 'ERROR'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {google.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer ID:</span>
                      <span className="font-mono font-bold text-slate-800">{google.credentials?.customerId || 'Not Configured'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Name:</span>
                      <span className="font-bold text-slate-800">{google.metadata?.accountName || 'Primary Ads Account'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Developer Token:</span>
                      <span className="font-mono text-slate-700">{google.credentials?.developerToken ? '••••••••' : 'Missing'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Token Health:</span>
                      <span className="font-bold text-slate-800">
                        {google.credentials?.refreshToken ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Refresh Token Active
                          </span>
                        ) : (
                          <span className="text-slate-400">Offline Access Pending</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Last Synced:</span>
                      <span className="text-slate-700 font-medium">
                        {google.lastSyncedAt ? new Date(google.lastSyncedAt).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openConfigModal('GOOGLE')}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configure
                    </button>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnectIntegration('GOOGLE')}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectIntegration('GOOGLE')}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3. LinkedIn Lead Gen Forms */}
            {(() => {
              const li = getChannelData('LINKEDIN');
              const isConnected = li.status === 'CONNECTED';
              return (
                <div className="p-6 bg-white border border-slate-200/90 rounded-3xl flex flex-col justify-between space-y-4 shadow-xs hover:border-slate-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600 font-bold text-base">
                        in
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">LinkedIn</h3>
                        <p className="text-[11px] text-slate-500">Sponsored Content, Lead Gen Forms, InMail Ads</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isConnected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : li.status === 'ERROR'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {li.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Client ID:</span>
                      <span className="font-mono font-bold text-slate-800">{li.credentials?.clientId || 'Not Configured'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Organization:</span>
                      <span className="font-bold text-slate-800">{li.metadata?.organizationName || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Selected Form:</span>
                      <span className="font-bold text-slate-800">{li.metadata?.formName || 'All Forms'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Token Health:</span>
                      <span className="font-bold text-slate-800">
                        {li.credentials?.accessToken ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> OAuth Token Active
                          </span>
                        ) : (
                          <span className="text-slate-400">Not Authorized</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Last Synced:</span>
                      <span className="text-slate-700 font-medium">
                        {li.lastSyncedAt ? new Date(li.lastSyncedAt).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openConfigModal('LINKEDIN')}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configure
                    </button>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnectIntegration('LINKEDIN')}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectIntegration('LINKEDIN')}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 4. WhatsApp Architecture Placeholder */}
            <div className="p-6 bg-slate-50/70 border border-dashed border-slate-300 rounded-3xl flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">WhatsApp Business Cloud API</h3>
                    <p className="text-[11px] text-slate-500">Automated Messaging & Chatbot Intake</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  COMING SOON
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Cloud API and WhatsApp Business Solution Provider (BSP) architecture. Supports template messaging, inbound conversational routing, and two-way CRM engagement.
              </p>

              <div className="pt-2">
                <button
                  disabled
                  className="w-full py-2 px-3 bg-slate-200 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed text-center"
                >
                  Architecture Placeholder (Module 5)
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Endpoints & Security Telemetry Summary */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-3xl space-y-3 shadow-xs text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Tenant Credential Vault & Webhook Ingestion Engine</h3>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                AES-256-GCM Encrypted
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-800">Meta Webhook Target:</span>
                <p className="font-mono text-slate-600 text-[10px] break-all select-all">
                  http://localhost:8000/api/webhooks/meta
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-800">Google Ads Webhook Target:</span>
                <p className="font-mono text-slate-600 text-[10px] break-all select-all">
                  http://localhost:8000/api/webhooks/google
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-800">LinkedIn Lead Gen Target:</span>
                <p className="font-mono text-slate-600 text-[10px] break-all select-all">
                  http://localhost:8000/api/webhooks/linkedin
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Usage & Plan */}
      {activeTab === 'usage' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Plan Limits & Quotas
            </h2>
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-700 font-bold">User Seats</span>
                  <span className="text-slate-500">
                    {usage.metrics.users.current} / {usage.metrics.users.max} seats
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (usage.metrics.users.current / usage.metrics.users.max) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-700 font-bold">Lead Storage Quota</span>
                  <span className="text-slate-500">
                    {usage.metrics.leads.current} / {usage.metrics.leads.max.toLocaleString()} leads
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (usage.metrics.leads.current / usage.metrics.leads.max) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-700 font-bold">Active Campaigns</span>
                  <span className="text-slate-500">
                    {usage.metrics.campaigns.current} / {usage.metrics.campaigns.max} campaigns
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (usage.metrics.campaigns.current / usage.metrics.campaigns.max) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Enabled Modules & Entitlements
            </h2>
            <div className="flex flex-wrap gap-2">
              {usage.enabledModules.map((mod) => (
                <span
                  key={mod}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize"
                >
                  {mod.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Activity Trail */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Audit Activity for {client.name}
          </h2>

          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No audit logs recorded for this tenant yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((log) => (
                <div key={log.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Triggered by: {log.user?.name || log.user?.email || 'System'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: CRM Config (Lead Stages & Sources) */}
      {activeTab === 'config' && (
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            Configured Lead Pipeline Stages
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {client.leadStages.map((stage) => (
              <div
                key={stage.id}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs"
              >
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: stage.color || '#4F46E5' }}
                />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{stage.name}</p>
                  <p className="text-[10px] text-slate-500">{stage.probability}% win probability</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Client Profile</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={editTimezone}
                    onChange={(e) => setEditTimezone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={editContactName}
                    onChange={(e) => setEditContactName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile</label>
                <input
                  type="text"
                  value={editContactPhone}
                  onChange={(e) => setEditContactPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm"
                >
                  {saveLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integration Configuration Modal */}
      {configModalChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  {configModalChannel === 'META' ? 'f' : configModalChannel === 'GOOGLE' ? 'G' : 'in'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Configure {configModalChannel === 'META' ? 'Meta / Facebook' : configModalChannel === 'GOOGLE' ? 'Google Ads' : 'LinkedIn'} Credentials
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Stored in AES-256 encrypted vault. Secrets are masked on read.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalChannel(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span className="leading-relaxed">{testResult.message}</span>
              </div>
            )}

            {configFormError && (
              <div className="p-3 rounded-2xl text-xs flex items-start gap-2 border bg-rose-50 border-rose-200 text-rose-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed font-semibold">{configFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveIntegrationConfig} className="space-y-3.5 text-xs">
              {/* Meta Fields */}
              {configModalChannel === 'META' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Meta App ID *</label>
                    <input
                      type="text"
                      required
                      value={metaAppId}
                      onChange={(e) => {
                        setMetaAppId(e.target.value);
                        if (configFormError) setConfigFormError(null);
                      }}
                      placeholder="e.g. 109283746501928"
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-slate-900 focus:bg-white focus:outline-none ${
                        metaAppId.trim() !== '' && !/^\d+$/.test(metaAppId.trim())
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 focus:border-indigo-600'
                      }`}
                    />
                    {metaAppId.trim() !== '' && !/^\d+$/.test(metaAppId.trim()) ? (
                      <p className="text-[11px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Enter a valid numeric Meta App ID.
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-0.5">Numeric App ID from Meta Developer Portal.</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Meta App Secret *</label>
                    <input
                      type="password"
                      required
                      value={metaAppSecret}
                      onChange={(e) => setMetaAppSecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Password / Masked. Never exposed after saving. Leave as dots to preserve existing secret.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Webhook Verify Token</label>
                      <input
                        type="password"
                        value={metaVerifyToken}
                        onChange={(e) => setMetaVerifyToken(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Masked sensitive credential. Never exposed after saving.</p>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Graph API Version</label>
                      <input
                        type="text"
                        value={metaApiVersion}
                        onChange={(e) => setMetaApiVersion(e.target.value)}
                        placeholder="e.g. v19.0 or v20.0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Configurable API version (e.g. v19.0, v20.0, v21.0).</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Connected Page ID</label>
                      <input
                        type="text"
                        value={metaPageId}
                        onChange={(e) => setMetaPageId(e.target.value)}
                        placeholder="e.g. 109283746501928"
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-slate-900 focus:bg-white focus:outline-none ${
                          metaPageId.trim() !== '' && !/^\d+$/.test(metaPageId.trim())
                            ? 'border-rose-400 focus:border-rose-500'
                            : 'border-slate-200 focus:border-indigo-600'
                        }`}
                      />
                      {metaPageId.trim() !== '' && !/^\d+$/.test(metaPageId.trim()) && (
                        <p className="text-[11px] text-rose-600 mt-1 font-semibold">Connected Page ID must be numeric.</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Page Name</label>
                      <input
                        type="text"
                        value={metaPageName}
                        onChange={(e) => setMetaPageName(e.target.value)}
                        placeholder="e.g. Main Real Estate Page"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Lead Form ID</label>
                      <input
                        type="text"
                        value={metaFormId}
                        onChange={(e) => setMetaFormId(e.target.value)}
                        placeholder="e.g. 772819203948571"
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-slate-900 focus:bg-white focus:outline-none ${
                          metaFormId.trim() !== '' && !/^\d+$/.test(metaFormId.trim())
                            ? 'border-rose-400 focus:border-rose-500'
                            : 'border-slate-200 focus:border-indigo-600'
                        }`}
                      />
                      {metaFormId.trim() !== '' && !/^\d+$/.test(metaFormId.trim()) && (
                        <p className="text-[11px] text-rose-600 mt-1 font-semibold">Lead Form ID must be numeric.</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Lead Form Name</label>
                      <input
                        type="text"
                        value={metaFormName}
                        onChange={(e) => setMetaFormName(e.target.value)}
                        placeholder="e.g. Instant Quote Form"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Google Ads Fields */}
              {configModalChannel === 'GOOGLE' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">OAuth Client ID *</label>
                    <input
                      type="text"
                      required
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="e.g. 123456-apps.googleusercontent.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">OAuth Client Secret *</label>
                    <input
                      type="password"
                      required
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Developer Token *</label>
                    <input
                      type="password"
                      required
                      value={googleDevToken}
                      onChange={(e) => setGoogleDevToken(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Google Ads Customer ID *</label>
                      <input
                        type="text"
                        required
                        value={googleCustomerId}
                        onChange={(e) => setGoogleCustomerId(e.target.value)}
                        placeholder="e.g. 123-456-7890"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Connected Account Name</label>
                      <input
                        type="text"
                        value={googleAccountName}
                        onChange={(e) => setGoogleAccountName(e.target.value)}
                        placeholder="e.g. Production Ads Account"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Manager Account ID (MCC - Optional)</label>
                    <input
                      type="text"
                      value={googleManagerId}
                      onChange={(e) => setGoogleManagerId(e.target.value)}
                      placeholder="e.g. 987-654-3210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                </>
              )}

              {/* LinkedIn Fields */}
              {configModalChannel === 'LINKEDIN' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">LinkedIn Client ID *</label>
                    <input
                      type="text"
                      required
                      value={linkedinClientId}
                      onChange={(e) => setLinkedinClientId(e.target.value)}
                      placeholder="e.g. 78a9bcdef012"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">LinkedIn Client Secret *</label>
                    <input
                      type="password"
                      required
                      value={linkedinClientSecret}
                      onChange={(e) => setLinkedinClientSecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Organization ID</label>
                      <input
                        type="text"
                        value={linkedinOrgId}
                        onChange={(e) => setLinkedinOrgId(e.target.value)}
                        placeholder="e.g. urn:li:organization:12345"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Organization Name</label>
                      <input
                        type="text"
                        value={linkedinOrgName}
                        onChange={(e) => setLinkedinOrgName(e.target.value)}
                        placeholder="e.g. Global Tech Solutions"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Lead Gen Form ID</label>
                      <input
                        type="text"
                        value={linkedinFormId}
                        onChange={(e) => setLinkedinFormId(e.target.value)}
                        placeholder="e.g. urn:li:leadGenForm:771829"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Form Name</label>
                      <input
                        type="text"
                        value={linkedinFormName}
                        onChange={(e) => setLinkedinFormName(e.target.value)}
                        placeholder="e.g. Executive Whitepaper Download"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleTestIntegration(configModalChannel)}
                  disabled={testLoading}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testLoading ? 'animate-spin' : ''}`} />
                  {testLoading ? 'Testing...' : 'Test Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfigModalChannel(null)}
                    className="px-3 py-2 text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={configSaveLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer shadow-xs"
                  >
                    {configSaveLoading ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
