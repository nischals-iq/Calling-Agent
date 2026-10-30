// API client for communicating with NestJS backend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Platform Admin Tokens
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  // If in client portal, check client token first
  if (window.location.pathname.startsWith('/client')) {
    return localStorage.getItem('client_access_token') || localStorage.getItem('admin_access_token');
  }
  return localStorage.getItem('admin_access_token') || localStorage.getItem('client_access_token');
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_access_token', token);
  }
}

export function removeStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_user');
  }
}

// Client Portal Tokens
export function getClientStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('client_access_token');
}

export function setClientStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('client_access_token', token);
  }
}

export function removeClientStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('client_access_token');
    localStorage.removeItem('client_user');
    localStorage.removeItem('client_info');
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    if (typeof window !== 'undefined') {
      const isClientPath = window.location.pathname.startsWith('/client');
      if (isClientPath && !window.location.pathname.includes('/client/login')) {
        removeClientStoredToken();
        window.location.href = '/client/login';
      } else if (!isClientPath && !window.location.pathname.includes('/admin/login')) {
        removeStoredToken();
        window.location.href = '/admin/login';
      }
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed with status ${response.status}`;
    const error = new Error(Array.isArray(message) ? message.join(', ') : message);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data as T;
}
