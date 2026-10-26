'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  apiFetch,
  getClientStoredToken,
  setClientStoredToken,
  removeClientStoredToken,
} from '../lib/api';

export interface ClientOrgInfo {
  id: string;
  name: string;
  businessCategory?: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  timezone?: string;
}

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: 'CLIENT_ADMIN' | 'SALES_MANAGER' | 'SALES_EXECUTIVE' | 'MARKETING_USER' | 'VIEWER';
  mobile?: string;
  avatarUrl?: string;
  teamId?: string | null;
  team?: {
    id: string;
    name: string;
    type?: string;
  } | null;
  permissions?: string[];
  preferences?: {
    emailAlerts?: boolean;
    whatsappAlerts?: boolean;
    dailyDigest?: boolean;
    soundAlerts?: boolean;
    theme?: string;
  };
}

interface ClientAuthContextType {
  user: ClientUser | null;
  client: ClientOrgInfo | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
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

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [client, setClient] = useState<ClientOrgInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const stored = getClientStoredToken();
      if (!stored) {
        setUser(null);
        setClient(null);
        setToken(null);
        setLoading(false);
        return;
      }
      setToken(stored);
      const res = await apiFetch<any>('/client/auth/me');
      setUser(res);
      if (res.client) {
        setClient(res.client);
      }
    } catch {
      setUser(null);
      setClient(null);
      setToken(null);
      removeClientStoredToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{
      accessToken: string;
      user: ClientUser;
      client: ClientOrgInfo;
    }>('/client/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setClientStoredToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    setClient(res.client);

    if (typeof window !== 'undefined') {
      localStorage.setItem('client_user', JSON.stringify(res.user));
      localStorage.setItem('client_info', JSON.stringify(res.client));
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/client/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      removeClientStoredToken();
      setUser(null);
      setClient(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/client/login';
      }
    }
  };

  const hasPermission = (requiredPermission: string): boolean => {
    if (!user) return false;
    if (user.role === 'CLIENT_ADMIN') return true;

    // 1. Check custom permissions
    const custom = user.permissions || [];
    if (custom.includes('*') || custom.includes(requiredPermission)) return true;
    const [mod] = requiredPermission.split(':');
    if (custom.includes(`${mod}:*`)) return true;

    // 2. Fall back to role defaults
    const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] || [];
    if (defaults.includes('*') || defaults.includes(requiredPermission)) return true;
    if (defaults.includes(`${mod}:*`)) return true;

    return false;
  };

  return (
    <ClientAuthContext.Provider
      value={{
        user,
        client,
        token,
        loading,
        login,
        logout,
        refreshProfile,
        hasPermission,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
}
