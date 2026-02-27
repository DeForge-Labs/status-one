'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, checkSetupStatus } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const initialize = useCallback(async () => {
    try {
      const setupRes = await checkSetupStatus();
      if (setupRes.needsSetup) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }
      setNeedsSetup(false);

      const token = localStorage.getItem('status_one_token');
      if (token) {
        try {
          const res = await getMe();
          setUser(res.user);
        } catch {
          localStorage.removeItem('status_one_token');
          localStorage.removeItem('status_one_user');
          setUser(null);
        }
      }
    } catch {
      // If backend is unreachable, don't crash
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const login = async (email, password) => {
    const res = await apiLogin({ email, password });
    localStorage.setItem('status_one_token', res.token);
    localStorage.setItem('status_one_user', JSON.stringify(res.user));
    setUser(res.user);
    return res;
  };

  const loginWithToken = (token, userData) => {
    localStorage.setItem('status_one_token', token);
    localStorage.setItem('status_one_user', JSON.stringify(userData));
    setUser(userData);
    setNeedsSetup(false);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('status_one_token');
    localStorage.removeItem('status_one_user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await getMe();
      setUser(res.user);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, loginWithToken, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
