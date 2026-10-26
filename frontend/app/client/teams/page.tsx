'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useClientAuth } from '../../context/ClientAuthContext';
import {
  Users2,
  Plus,
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Shield,
  Layers,
  Sparkles,
  AlertCircle,
  Building2,
  RefreshCw,
  Search,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  isActive: boolean;
}

interface TeamItem {
  id: string;
  name: string;
  description?: string;
  type: string; // 'SALES', 'MARKETING', 'SUPPORT'
  isActive: boolean;
  managerId?: string | null;
  manager?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  members: TeamMember[];
  _count: {
    members: number;
    leads: number;
  };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId?: string | null;
}

export default function ClientTeamsPage() {
  const { hasPermission } = useClientAuth();

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('SALES');
  const [formManagerId, setFormManagerId] = useState('');
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamsData, usersData] = await Promise.all([
        apiFetch<TeamItem[]>('/client/teams'),
        apiFetch<{ data: UserOption[] }>('/client/users?limit=100'),
      ]);
      setTeams(teamsData);
      setAvailableUsers(usersData.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setFormName('');
    setFormDesc('');
    setFormType('SALES');
    setFormManagerId('');
    setFormMemberIds([]);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const openEditModal = (t: TeamItem) => {
    setEditTeam(t);
    setFormName(t.name);
    setFormDesc(t.description || '');
    setFormType(t.type || 'SALES');
    setFormManagerId(t.managerId || '');
    setFormMemberIds(t.members.map((m) => m.id));
    setFormError(null);
  };

  const toggleMemberSelection = (userId: string) => {
    if (formMemberIds.includes(userId)) {
      setFormMemberIds(formMemberIds.filter((id) => id !== userId));
    } else {
      setFormMemberIds([...formMemberIds, userId]);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      await apiFetch('/client/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          type: formType,
          managerId: formManagerId || undefined,
          memberIds: formMemberIds,
        }),
      });
      setCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create team');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeam) return;
    setFormError(null);
    setFormLoading(true);

    try {
      await apiFetch(`/client/teams/${editTeam.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          type: formType,
          managerId: formManagerId || null,
          memberIds: formMemberIds,
        }),
      });
      setEditTeam(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update team');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (t: TeamItem) => {
    try {
      await apiFetch(`/client/teams/${t.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update team status');
    }
  };

  const handleDeleteTeam = async (t: TeamItem) => {
    if (!confirm(`Are you sure you want to delete "${t.name}"? Members will be unassigned.`)) {
      return;
    }
    try {
      await apiFetch(`/client/teams/${t.id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete team');
    }
  };

  const canCreate = hasPermission('teams:create');
  const canEdit = hasPermission('teams:edit');
  const canDelete = hasPermission('teams:delete');

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Teams
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize sales and marketing divisions, assign team managers, and assign users to teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {canCreate && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Team
            </button>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 bg-white border border-slate-200 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center space-y-4">
          <Users2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Teams Created Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Group your sales executives and marketing managers into specialized working teams.
          </p>
          {canCreate && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Create First Team
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((t) => (
            <div
              key={t.id}
              className={`bg-white border rounded-3xl p-6 flex flex-col justify-between transition shadow-xs ${
                t.isActive ? 'border-slate-200/90 hover:border-slate-300' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="space-y-4">
                {/* Header & Badges */}
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${
                        t.type === 'MARKETING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : t.type === 'SUPPORT'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {t.type} TEAM
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{t.name}</h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        t.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {t.description && (
                  <p className="text-xs text-slate-500 min-h-[32px]">{t.description}</p>
                )}

                {/* Team Lead */}
                <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Team Lead / Manager
                  </span>
                  {t.manager ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                        {t.manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{t.manager.name}</p>
                        <p className="text-[10px] text-slate-400">{t.manager.email}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No manager assigned</span>
                  )}
                </div>

                {/* Members List */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-700">Members ({t.members.length})</span>
                    <span className="text-slate-400 text-[11px]">{t._count.leads} Leads Assigned</span>
                  </div>

                  {t.members.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No members assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {t.members.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/80"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(t)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>

                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <button
                      onClick={() => openEditModal(t)}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteTeam(t)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Team Modal */}
      {(createModalOpen || editTeam) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users2 className="w-5 h-5 text-indigo-600" />
                {editTeam ? `Edit Team: ${editTeam.name}` : 'Create New Team Unit'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditTeam(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={editTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inbound Sales West"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Team Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="SALES">Sales Unit</option>
                    <option value="MARKETING">Marketing Squad</option>
                    <option value="SUPPORT">Customer Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Team Lead / Manager</label>
                  <select
                    value={formManagerId}
                    onChange={(e) => setFormManagerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="">No Manager Assigned</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Focus area, territory, or objective..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assign Members ({formMemberIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  {availableUsers.map((u) => {
                    const isSelected = formMemberIds.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleMemberSelection(u.id)}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-50 border border-indigo-300 text-indigo-900 font-semibold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold">{u.name}</p>
                          <p className="text-[10px] text-slate-400">{u.email}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="text-indigo-600 rounded"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setEditTeam(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : editTeam ? 'Save Team' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
