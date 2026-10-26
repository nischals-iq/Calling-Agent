'use client';

import React, { useState } from 'react';
import { useClientAuth } from '../../context/ClientAuthContext';
import { apiFetch } from '../../lib/api';
import {
  UserCheck,
  Mail,
  Phone,
  Building2,
  Lock,
  Bell,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  Save,
} from 'lucide-react';

export default function ClientProfilePage() {
  const { user, client, refreshProfile } = useClientAuth();

  // Profile Form
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  // Notification Preferences
  const [emailAlerts, setEmailAlerts] = useState(user?.preferences?.emailAlerts ?? true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(user?.preferences?.whatsappAlerts ?? false);
  const [dailyDigest, setDailyDigest] = useState(user?.preferences?.dailyDigest ?? true);
  const [soundAlerts, setSoundAlerts] = useState(user?.preferences?.soundAlerts ?? true);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);

    try {
      await apiFetch('/client/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, mobile }),
      });
      await refreshProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match');
      return;
    }

    setPassLoading(true);
    try {
      await apiFetch('/client/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPassSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(false), 4000);
    } catch (err: any) {
      setPassError(err.message || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setPrefLoading(true);
    setPrefSuccess(false);
    try {
      await apiFetch('/client/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: {
            emailAlerts,
            whatsappAlerts,
            dailyDigest,
            soundAlerts,
          },
        }),
      });
      await refreshProfile();
      setPrefSuccess(true);
      setTimeout(() => setPrefSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save preferences');
    } finally {
      setPrefLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 font-sans max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          My Account & Preferences
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your personal identity, login security, and organization notification rules.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xl shadow-md shadow-indigo-600/20">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{user.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> {client?.name || 'Client Org'}
              </span>
              <span>•</span>
              <span>Team: {user.team?.name || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        <div className="sm:text-right">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active Account
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Edit Profile Form */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Personal Details
          </h3>

          {profileSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Profile details updated successfully!</span>
            </div>
          )}
          {profileError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {profileError}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Email (Organization Bound)</label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="mt-2 w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {profileLoading ? 'Saving...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            Security & Password
          </h3>

          {passSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Password changed successfully!</span>
            </div>
          )}
          {passError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password (Min 6 chars)</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={passLoading}
              className="mt-2 w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {passLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              Workspace Notification Preferences
            </h3>
            <p className="text-xs text-slate-500">
              Configure how you receive CRM updates, lead assignment alerts, and activity digests.
            </p>
          </div>
          {prefSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Preferences Saved!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="mt-1 text-indigo-600 rounded"
            />
            <div>
              <p className="text-xs font-bold text-slate-900">Email Alerts on New Leads</p>
              <p className="text-[11px] text-slate-500">
                Receive an immediate email when a lead is assigned to you or your team.
              </p>
            </div>
          </label>

          <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={dailyDigest}
              onChange={(e) => setDailyDigest(e.target.checked)}
              className="mt-1 text-indigo-600 rounded"
            />
            <div>
              <p className="text-xs font-bold text-slate-900">Daily Pipeline Summary Digest</p>
              <p className="text-[11px] text-slate-500">
                Receive a morning recap of pending follow-ups, overdue tasks, and lead status changes.
              </p>
            </div>
          </label>

          <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={whatsappAlerts}
              onChange={(e) => setWhatsappAlerts(e.target.checked)}
              className="mt-1 text-indigo-600 rounded"
            />
            <div>
              <p className="text-xs font-bold text-slate-900">WhatsApp Notification Alerts</p>
              <p className="text-[11px] text-slate-500">
                Receive automated alerts for high-priority hot deals and inbound lead callbacks.
              </p>
            </div>
          </label>

          <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={soundAlerts}
              onChange={(e) => setSoundAlerts(e.target.checked)}
              className="mt-1 text-indigo-600 rounded"
            />
            <div>
              <p className="text-xs font-bold text-slate-900">Browser Audio Chimes</p>
              <p className="text-[11px] text-slate-500">
                Play subtle chimes when new webhook leads arrive in the CRM.
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={prefLoading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {prefLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
