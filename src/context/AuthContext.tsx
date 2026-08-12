import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, loginApi, registerApi, fetchMeApi, logoutApi } from '../api/authApi.js';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage or seed default admin session
  useEffect(() => {
    const savedToken = localStorage.getItem('orderflow_auth_token');
    const savedUser = localStorage.getItem('orderflow_auth_user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);

        // Verify with backend
        fetchMeApi(savedToken)
          .then((res) => {
            setUser(res.user);
            localStorage.setItem('orderflow_auth_user', JSON.stringify(res.user));
          })
          .catch(() => {
            // If token invalid, clear
            localStorage.removeItem('orderflow_auth_token');
            localStorage.removeItem('orderflow_auth_user');
            setToken(null);
            setUser(null);
          })
          .finally(() => setIsLoading(false));
        return;
      } catch (e) {
        console.error('Session restore error:', e);
      }
    }

    // Default seed session for instant preview
    const defaultUser: UserProfile = {
      id: 'usr_admin_001',
      name: 'Enterprise System Admin',
      email: 'admin@orderflow.io',
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    const defaultToken = 'bearer_admin_default_token';

    setUser(defaultUser);
    setToken(defaultToken);
    localStorage.setItem('orderflow_auth_token', defaultToken);
    localStorage.setItem('orderflow_auth_user', JSON.stringify(defaultUser));
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await loginApi(email, password);
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('orderflow_auth_token', res.token);
      localStorage.setItem('orderflow_auth_user', JSON.stringify(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await registerApi(name, email, password);
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('orderflow_auth_token', res.token);
      localStorage.setItem('orderflow_auth_user', JSON.stringify(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (token) {
      logoutApi(token);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('orderflow_auth_token');
    localStorage.removeItem('orderflow_auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
