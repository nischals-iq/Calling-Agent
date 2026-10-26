'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mobile?: string;
  avatarUrl?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const stored = getStoredToken();
      if (!stored) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }
      setToken(stored);
      const profile = await apiFetch<AdminUser>('/admin/auth/me');
      setUser(profile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_user', JSON.stringify(profile));
      }
    } catch {
      setUser(null);
      setToken(null);
      removeStoredToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: AdminUser }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setStoredToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_user', JSON.stringify(res.user));
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/admin/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      removeStoredToken();
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
