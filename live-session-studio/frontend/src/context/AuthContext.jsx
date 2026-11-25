import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('lss_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => {
    return sessionStorage.getItem('lss_access_token') || null;
  });

  const [loading, setLoading] = useState(false);

  const login = async (role, profileId) => {
    setLoading(true);
    try {
      const res = await axiosInstance.post('/demo/login', {
        role,
        profile_id: profileId,
      });
      const data = res.data;
      const token = data.access_token;
      const userData = data.user;

      sessionStorage.setItem('lss_access_token', token);
      sessionStorage.setItem('lss_user', JSON.stringify(userData));

      setAccessToken(token);
      setUser(userData);
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('lss_access_token');
    sessionStorage.removeItem('lss_user');
    setAccessToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isAuthenticated: !!accessToken && !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
