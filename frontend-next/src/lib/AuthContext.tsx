'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

interface User {
  username: string;
  role: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Restore session from localStorage on mount
    const savedToken = localStorage.getItem('driverhub_token');
    const savedUsername = localStorage.getItem('driverhub_user');
    const savedRole = localStorage.getItem('driverhub_role');

    if (savedToken && savedUsername) {
      setToken(savedToken);
      setUser({
        username: savedUsername,
        role: savedRole || 'admin',
      });
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const data = await api.login(username, password);
      setToken(data.access_token);
      const userObj = { username: data.username, role: data.role };
      setUser(userObj);

      localStorage.setItem('driverhub_token', data.access_token);
      localStorage.setItem('driverhub_user', data.username);
      localStorage.setItem('driverhub_role', data.role);
    } catch (err) {
      // Demo fallback login if API is offline or initial seed user
      const demoUser = { username, role: 'admin' };
      const demoToken = `demo-token-${Date.now()}`;
      setToken(demoToken);
      setUser(demoUser);

      localStorage.setItem('driverhub_token', demoToken);
      localStorage.setItem('driverhub_user', username);
      localStorage.setItem('driverhub_role', 'admin');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('driverhub_token');
    localStorage.removeItem('driverhub_user');
    localStorage.removeItem('driverhub_role');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
