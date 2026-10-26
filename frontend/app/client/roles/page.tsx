'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Shield,
  Layers,
  Sparkles,
  Users,
  Target,
  Megaphone,
  BarChart3,
  Settings,
  ScrollText,
} from 'lucide-react';

interface RoleDetail {
  id: string;
  name: string;
  description: string;
  scope: string;
  badgeColor: string;
  defaultPermissions: string[];
}

interface PermissionModuleItem {
  id: string;
  name: string;
  actions: string[];
}

export default function ClientRolesPage() {
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [modules, setModules] = useState<PermissionModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('CLIENT_ADMIN');

  useEffect(() => {
    const fetchMatrix = async () => {
      try {
        const res = await apiFetch<{
          roles: RoleDetail[];
          modules: PermissionModuleItem[];
        }>('/client/roles/matrix');
        setRoles(res.roles);
        setModules(res.modules);
      } catch (err) {
        console.error('Failed to load matrix:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatrix();
  }, []);

  const actions = ['view', 'create', 'edit', 'delete', 'assign', 'export'];

  const checkHasAction = (roleId: string, modId: string, act: string) => {
    if (roleId === 'CLIENT_ADMIN') return true;
    const role = roles.find((r) => r.id === roleId);
    if (!role) return false;
    const key = `${modId}:${act}`;
    return role.defaultPermissions.includes('*') || role.defaultPermissions.includes(key);
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          Roles & Permission Scopes
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tenant-level Role-Based Access Control (RBAC) matrix and action authorization policies.
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {roles.map((r) => {
          const isSelected = selectedRole === r.id;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`p-5 rounded-3xl border flex flex-col justify-between transition cursor-pointer shadow-xs ${
                isSelected
                  ? 'bg-white border-2 border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                  : 'bg-white border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${r.badgeColor}`}
                  >
                    {r.id.replace(/_/g, ' ')}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{r.name}</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {r.description}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Scope
                </span>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">{r.scope}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Permission Matrix Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Role Authorization Matrix (Modules vs Actions)
            </h2>
            <p className="text-xs text-slate-500">
              Active permission coverage across standard CRM modules and system actions
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                  selectedRole === r.id
                    ? 'bg-white text-indigo-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                <th className="py-3.5 px-4">CRM Module</th>
                {actions.map((act) => (
                  <th key={act} className="py-3.5 px-4 text-center uppercase tracking-wider">
                    {act}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modules.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {m.name}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      module: {m.id}
                    </span>
                  </td>
                  {actions.map((act) => {
                    const isAllowed = checkHasAction(selectedRole, m.id, act);
                    const isApplicable = m.actions.includes(act);

                    return (
                      <td key={act} className="py-3.5 px-4 text-center">
                        {!isApplicable ? (
                          <span className="text-slate-300 text-[10px]">—</span>
                        ) : isAllowed ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-300">
                            <XCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
