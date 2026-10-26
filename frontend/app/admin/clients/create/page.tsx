'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Globe,
  Clock,
  Layers,
  UserCheck,
  Lock,
} from 'lucide-react';

export default function CreateClientPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactEmail, setPrimaryContactEmail] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [plan, setPlan] = useState<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('STARTER');

  // CRM Settings
  const [leadSources, setLeadSources] = useState<string[]>([
    'META',
    'GOOGLE',
    'WEBSITE',
    'WHATSAPP',
  ]);
  const [emailNotification, setEmailNotification] = useState(true);
  const [whatsappNotification, setWhatsappNotification] = useState(false);
  const [dailySummary, setDailySummary] = useState(true);

  // Initial Admin User Account
  const [createAdmin, setCreateAdmin] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('Welcome@123');

  const toggleLeadSource = (src: string) => {
    if (leadSources.includes(src)) {
      setLeadSources(leadSources.filter((s) => s !== src));
    } else {
      setLeadSources([...leadSources, src]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !primaryContactName || !primaryContactEmail) {
      setError('Please fill in Company Name, Primary Contact Name, and Primary Contact Email.');
      return;
    }

    if (createAdmin && (!adminEmail || !adminPassword)) {
      setError('Please provide initial admin user email and password.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name,
        businessCategory,
        primaryContactName,
        primaryContactEmail,
        primaryContactPhone,
        companyAddress,
        country,
        timezone,
        status,
        plan,
        settings: {
          leadSources,
          notificationRules: {
            emailOnNewLead: emailNotification,
            whatsappOnNewLead: whatsappNotification,
            dailySummaryEmail: dailySummary,
          },
        },
      };

      if (createAdmin) {
        payload.initialAdmin = {
          name: adminName || primaryContactName,
          email: adminEmail,
          password: adminPassword,
          mobile: primaryContactPhone,
        };
      }

      const res = await apiFetch<{ client: { id: string } }>('/admin/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(`/admin/clients/${res.client.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create client.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans">
      {/* Back button & Page Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clients"
          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Onboard New Client
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Set up an isolated multi-tenant CRM workspace for your client organization.
          </p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Company Profile */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-indigo-600" />
            1. Company Profile & Regional Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Company / Organization Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!adminName) setAdminName(primaryContactName || `${e.target.value} Admin`);
                }}
                placeholder="e.g. Skyline Ventures Real Estate"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Business Category / Industry
              </label>
              <input
                type="text"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                placeholder="e.g. Real Estate, Healthcare, Education"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-600 font-medium"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST - UTC-05:00)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST - UTC-08:00)</option>
                <option value="Europe/London">Europe/London (GMT - UTC+00:00)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Company Address
              </label>
              <input
                type="text"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Suite 500, Prestige Tower, MG Road"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Primary Contact */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            2. Primary Client Contact
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Primary Contact Name *
              </label>
              <input
                type="text"
                value={primaryContactName}
                onChange={(e) => {
                  setPrimaryContactName(e.target.value);
                  if (!adminName) setAdminName(e.target.value);
                }}
                placeholder="Ananya Verma"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Primary Contact Email *
              </label>
              <input
                type="email"
                value={primaryContactEmail}
                onChange={(e) => {
                  setPrimaryContactEmail(e.target.value);
                  if (!adminEmail) setAdminEmail(e.target.value);
                }}
                placeholder="ananya@skyline.com"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Primary Contact Mobile
              </label>
              <input
                type="tel"
                value={primaryContactPhone}
                onChange={(e) => setPrimaryContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Subscription & Status */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-4 h-4 text-indigo-600" />
            3. Subscription Plan & Initial Status
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {(['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const).map((tier) => (
              <div
                key={tier}
                onClick={() => setPlan(tier)}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  plan === tier
                    ? 'bg-indigo-50/80 border-indigo-600 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">{tier}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      plan === tier
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {plan === tier && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  {tier === 'FREE' && 'Max 2 users • 100 leads'}
                  {tier === 'STARTER' && 'Max 5 users • 2,500 leads'}
                  {tier === 'PRO' && 'Max 25 users • 20,000 leads'}
                  {tier === 'ENTERPRISE' && 'Unlimited scale'}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center gap-4">
            <span className="text-xs font-bold text-slate-700">Initial Account Status:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="status"
                  checked={status === 'ACTIVE'}
                  onChange={() => setStatus('ACTIVE')}
                  className="text-indigo-600"
                />
                Active (Instant Access)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="status"
                  checked={status === 'INACTIVE'}
                  onChange={() => setStatus('INACTIVE')}
                  className="text-indigo-600"
                />
                Inactive (Pending Activation)
              </label>
            </div>
          </div>
        </div>

        {/* Section 4: CRM Configuration */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Globe className="w-4 h-4 text-indigo-600" />
            4. CRM Lead Sources & Notification Rules
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Enabled Lead Ingestion Sources
            </label>
            <div className="flex flex-wrap gap-2">
              {['META', 'GOOGLE', 'LINKEDIN', 'WEBSITE', 'WHATSAPP', 'REFERRAL'].map((src) => {
                const isSelected = leadSources.includes(src);
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => toggleLeadSource(src)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {src}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="block text-xs font-bold text-slate-700">Notification Rules</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={emailNotification}
                  onChange={(e) => setEmailNotification(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Email on New Lead</span>
              </label>
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={whatsappNotification}
                  onChange={(e) => setWhatsappNotification(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>WhatsApp on New Lead</span>
              </label>
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={dailySummary}
                  onChange={(e) => setDailySummary(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Daily Digest Summary</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 5: Initial Client Admin Account */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              5. Initial Tenant Admin Account
            </h2>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={createAdmin}
                onChange={(e) => setCreateAdmin(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Create Tenant Admin Account
            </label>
          </div>

          {createAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Admin Full Name
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Ananya Verma"
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Admin Login Email *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="ananya@skyline.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  required={createAdmin}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Temporary Password *
                </label>
                <input
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Welcome@123"
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 font-mono"
                  required={createAdmin}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            href="/admin/clients"
            className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Provisioning Tenant CRM...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Complete Onboarding & Create Client
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
