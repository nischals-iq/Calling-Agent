'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useClientAuth } from '../../context/ClientAuthContext';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Key,
  Edit,
  Trash2,
  Shield,
  Building2,
  Users2,
  RefreshCw,
  Mail,
  Phone,
  Lock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface ClientUserItem {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: 'CLIENT_ADMIN' | 'SALES_MANAGER' | 'SALES_EXECUTIVE' | 'MARKETING_USER' | 'VIEWER';
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  permissions?: string[];
  teamId?: string | null;
  team?: {
    id: string;
    name: string;
    type?: string;
  } | null;
  _count?: {
    assignedLeads: number;
    assignedTasks: number;
  };
}

interface TeamItem {
  id: string;
  name: string;
  type?: string;
}

const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  CLIENT_ADMIN: ['*'],
  SALES_MANAGER: [
    'leads:view',
    'leads:create',
    'leads:edit',
    'leads:assign',
    'leads:export',
    'pipeline:view',
    'pipeline:edit',
    'teams:view',
    'teams:edit',
    'teams:assign',
    'users:view',
    'reports:view',
    'reports:export',
    'activity_logs:view',
  ],
  SALES_EXECUTIVE: [
    'leads:view',
    'leads:create',
    'leads:edit',
    'pipeline:view',
    'teams:view',
    'users:view',
    'activity_logs:view',
  ],
  MARKETING_USER: [
    'campaigns:view',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'leads:view',
    'leads:export',
    'reports:view',
    'reports:export',
    'teams:view',
    'activity_logs:view',
  ],
  VIEWER: [
    'leads:view',
    'pipeline:view',
    'reports:view',
    'campaigns:view',
    'teams:view',
  ],
};

const AVAILABLE_PERMISSIONS = [
  { key: 'leads:view', label: 'View Leads' },
  { key: 'leads:create', label: 'Create Leads' },
  { key: 'leads:edit', label: 'Edit Leads' },
  { key: 'leads:assign', label: 'Assign Leads' },
  { key: 'leads:export', label: 'Export Leads' },
  { key: 'pipeline:view', label: 'View Pipeline' },
  { key: 'pipeline:edit', label: 'Manage Deals' },
  { key: 'teams:view', label: 'View Teams' },
  { key: 'teams:edit', label: 'Manage Teams' },
  { key: 'campaigns:view', label: 'View Campaigns' },
  { key: 'campaigns:create', label: 'Create Campaigns' },
  { key: 'reports:view', label: 'View Reports' },
  { key: 'reports:export', label: 'Export Reports' },
  { key: 'activity_logs:view', label: 'View Activity Logs' },
];

export default function ClientUsersPage() {
  const { user: currentUser, client, hasPermission } = useClientAuth();

  const [users, setUsers] = useState<ClientUserItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<ClientUserItem | null>(null);
  const [resetPassUser, setResetPassUser] = useState<ClientUserItem | null>(null);

  // Form State for Create/Edit
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formRole, setFormRole] = useState<'CLIENT_ADMIN' | 'SALES_MANAGER' | 'SALES_EXECUTIVE' | 'MARKETING_USER' | 'VIEWER'>('SALES_EXECUTIVE');
  const [formTeamId, setFormTeamId] = useState('');
  const [formStatus, setFormStatus] = useState(true);
  const [formPassword, setFormPassword] = useState('Welcome@123');
  const [formPermissions, setFormPermissions] = useState<string[]>(DEFAULT_ROLE_PERMS['SALES_EXECUTIVE']);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Password reset modal state
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (roleFilter) queryParams.set('role', roleFilter);
      if (teamFilter) queryParams.set('teamId', teamFilter);
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);

      const [usersRes, teamsRes] = await Promise.all([
        apiFetch<{ data: ClientUserItem[] }>(`/client/users?${queryParams.toString()}`),
        apiFetch<TeamItem[]>('/client/teams'),
      ]);
      setUsers(usersRes.data);
      setTeams(teamsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, teamFilter, statusFilter]);

  const openCreateModal = () => {
    setFormName('');
    setFormEmail('');
    setFormMobile('');
    setFormRole('SALES_EXECUTIVE');
    setFormTeamId('');
    setFormStatus(true);
    setFormPassword('Welcome@123');
    setFormPermissions(DEFAULT_ROLE_PERMS['SALES_EXECUTIVE']);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const openEditModal = (u: ClientUserItem) => {
    setEditUser(u);
    setFormName(u.name);
    setFormMobile(u.mobile || '');
    setFormRole(u.role);
    setFormTeamId(u.teamId || '');
    setFormStatus(u.isActive);
    setFormPermissions(u.permissions?.length ? u.permissions : DEFAULT_ROLE_PERMS[u.role] || []);
    setFormError(null);
  };

  const handleRoleChange = (newRole: any) => {
    setFormRole(newRole);
    setFormPermissions(DEFAULT_ROLE_PERMS[newRole] || []);
  };

  const togglePermission = (permKey: string) => {
    if (formPermissions.includes('*')) {
      const allKeys = AVAILABLE_PERMISSIONS.map((p) => p.key).filter((k) => k !== permKey);
      setFormPermissions(allKeys);
      return;
    }
    if (formPermissions.includes(permKey)) {
      setFormPermissions(formPermissions.filter((p) => p !== permKey));
    } else {
      setFormPermissions([...formPermissions, permKey]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      await apiFetch('/client/users', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          mobile: formMobile,
          role: formRole,
          teamId: formTeamId || undefined,
          isActive: formStatus,
          password: formPassword,
          permissions: formPermissions,
        }),
      });
      setCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setFormError(null);
    setFormLoading(true);

    try {
      await apiFetch(`/client/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formName,
          mobile: formMobile,
          role: formRole,
          teamId: formTeamId || null,
          isActive: formStatus,
          permissions: formPermissions,
        }),
      });
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (u: ClientUserItem) => {
    try {
      await apiFetch(`/client/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser || !newPassword) return;
    setFormLoading(true);

    try {
      await apiFetch(`/client/users/${resetPassUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      alert(`Password successfully updated for ${resetPassUser.email}`);
      setResetPassUser(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setFormLoading(false);
    }
  };

  const roleBadgeStyles: Record<string, string> = {
    CLIENT_ADMIN: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    SALES_MANAGER: 'bg-blue-50 text-blue-700 border-blue-200',
    SALES_EXECUTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MARKETING_USER: 'bg-amber-50 text-amber-700 border-amber-200',
    VIEWER: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const canCreate = hasPermission('users:create');
  const canEdit = hasPermission('users:edit');

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Users
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization users, roles, account status, and system access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
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
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, email, or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="">All Roles</option>
            <option value="CLIENT_ADMIN">Client Admin</option>
            <option value="SALES_MANAGER">Sales Manager</option>
            <option value="SALES_EXECUTIVE">Sales Executive</option>
            <option value="MARKETING_USER">Marketing User</option>
            <option value="VIEWER">Viewer</option>
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        <span className="text-xs font-semibold text-slate-500">
          {users.length} Users Found
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading user accounts...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-semibold">No users matching current filters.</p>
            {canCreate && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-xs"
              >
                Create Your First User
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Assigned Team</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned Leads</th>
                  <th className="py-3.5 px-4">Last Active</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    {/* Name & Contact */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                          {u.mobile && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" /> {u.mobile}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                          roleBadgeStyles[u.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="py-4 px-4">
                      {u.team ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {u.team.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    {/* Assigned Leads */}
                    <td className="py-4 px-4 font-bold text-slate-900">
                      {u._count?.assignedLeads || 0}
                    </td>

                    {/* Last Active */}
                    <td className="py-4 px-4 text-slate-500 text-[11px]">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never logged in'}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(u)}
                              title="Edit User"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setResetPassUser(u);
                                setNewPassword('');
                              }}
                              title="Reset Password"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                title={u.isActive ? 'Deactivate Account' : 'Activate Account'}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  u.isActive
                                    ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                    : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {u.isActive ? (
                                  <XCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Create User
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="CLIENT_ADMIN">Client Admin</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="SALES_EXECUTIVE">Sales Executive</option>
                    <option value="MARKETING_USER">Marketing User</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assign Team</label>
                  <select
                    value={formTeamId}
                    onChange={(e) => setFormTeamId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>

              {/* Permissions Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Permissions & Access Rights
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {formPermissions.includes('*') ? 'Full System Access' : `${formPermissions.length} selected`}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl max-h-32 overflow-y-auto grid grid-cols-2 gap-1.5">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = formPermissions.includes('*') || formPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer transition ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm.key)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                        />
                        <span className="truncate">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Creating User...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                Edit User: {editUser.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile</label>
                  <input
                    type="text"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="CLIENT_ADMIN">Client Admin</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="SALES_EXECUTIVE">Sales Executive</option>
                    <option value="MARKETING_USER">Marketing User</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Team</label>
                <select
                  value={formTeamId}
                  onChange={(e) => setFormTeamId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                >
                  <option value="">No Team Assigned</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Permissions Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Permissions & Access Rights
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {formPermissions.includes('*') ? 'Full System Access' : `${formPermissions.length} selected`}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl max-h-32 overflow-y-auto grid grid-cols-2 gap-1.5">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = formPermissions.includes('*') || formPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer transition ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm.key)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                        />
                        <span className="truncate">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              Reset Temporary Password
            </h3>
            <p className="text-xs text-slate-500">
              Set a temporary password for{' '}
              <span className="font-bold text-slate-800">{resetPassUser.name}</span>:
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="text"
                required
                placeholder="New temporary password..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPassUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !newPassword}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {formLoading ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
