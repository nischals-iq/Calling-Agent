'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import {
  UserPlus,
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Tag,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Flame,
  Layers,
  DollarSign,
} from 'lucide-react';

interface StageItem {
  id: string;
  name: string;
  color?: string;
}

export default function ManualLeadEntryPage() {
  const router = useRouter();

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [source, setSource] = useState('OTHER');
  const [campaign, setCampaign] = useState('');
  const [notes, setNotes] = useState('');
  const [stageId, setStageId] = useState('');
  const [temperature, setTemperature] = useState('COLD');
  const [dealValue, setDealValue] = useState<string>('');

  const [stages, setStages] = useState<StageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const cfg = await apiFetch<{ stages: StageItem[] }>('/client/leads/config');
        setStages(cfg.stages || []);
        if (cfg.stages?.length > 0) {
          setStageId(cfg.stages[0].id);
        }
      } catch (err) {
        console.error('Failed to load stages:', err);
      }
    };
    fetchStages();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateWarning(null);

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch<any>('/client/leads/manual', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          mobile: mobile.trim() || undefined,
          company: company.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          source,
          campaign: campaign.trim() || undefined,
          notes: notes.trim() || undefined,
          stageId: stageId || undefined,
          temperature,
          dealValue: dealValue ? Number(dealValue) : undefined,
        }),
      });

      if (res.isDuplicate) {
        setDuplicateWarning({
          lead: res.lead,
          reason: res.duplicateReason,
          duplicateOfId: res.duplicateOfId,
        });
      } else {
        router.push('/client/leads');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/client/leads"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Captured Leads
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-indigo-600" />
            Manual Lead Entry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create an individual CRM lead record with contact, attribution metadata, and pipeline stage.
          </p>
        </div>
      </div>

      {/* Duplicate Alert Banner */}
      {duplicateWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-amber-900">Lead Saved with Duplicate Flag</h3>
            <p className="mt-0.5 text-amber-700">
              A lead with matching {duplicateWarning.reason === 'MATCHED_EMAIL' ? 'email address' : duplicateWarning.reason === 'MATCHED_PHONE' ? 'phone number' : 'email & phone'} already exists in your workspace.
            </p>
            <p className="mt-1 text-[11px] text-amber-600">
              The new entry was preserved and linked to the existing record without overwriting previous history.
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href="/client/leads"
                className="px-3.5 py-1.5 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 transition"
              >
                View Leads List
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarning(null);
                  setFirstName('');
                  setLastName('');
                  setEmail('');
                  setMobile('');
                  setCompany('');
                  setNotes('');
                }}
                className="px-3 py-1.5 bg-white text-slate-700 border border-amber-200 rounded-xl font-semibold text-xs hover:bg-amber-50"
              >
                Add Another Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Section 1: Contact Details */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            1. Contact Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ananya"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                placeholder="e.g. Deshmukh"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Work Email Address
              </label>
              <input
                type="email"
                placeholder="ananya@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Mobile / Phone
              </label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Company / Organization
              </label>
              <input
                type="text"
                placeholder="Acme Real Estate"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Job Title / Designation
              </label>
              <input
                type="text"
                placeholder="VP of Sales"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Attribution & Source */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            2. Source & Attribution
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Lead Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              >
                <option value="MANUAL">Manual Entry (Direct)</option>
                <option value="WEBSITE">Website Form / Landing Page</option>
                <option value="WHATSAPP">WhatsApp Lead</option>
                <option value="REFERRAL">Customer Referral</option>
                <option value="META">Meta Ads (Facebook/Instagram)</option>
                <option value="GOOGLE">Google Search / Display Ads</option>
                <option value="LINKEDIN">LinkedIn Lead Gen</option>
                <option value="OTHER">Other Channel</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Campaign Name
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Direct Outreach"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>
          </div>
        </div>

        {/* Section 3: CRM Pipeline & Temperature */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            3. Pipeline & Opportunity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Initial Pipeline Stage
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Lead Temperature
              </label>
              <select
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              >
                <option value="COLD">Cold (Initial Inquiry)</option>
                <option value="WARM">Warm (Active Interest)</option>
                <option value="HOT">Hot (Urgent Buyer)</option>
                <option value="QUALIFIED">Qualified</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Estimated Deal Value
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 50000"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Initial Notes & Inquiry Details
            </label>
            <textarea
              rows={3}
              placeholder="Enter meeting notes, specific requirements, or intake remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            href="/client/leads"
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Creating Lead...' : 'Save & Capture Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
