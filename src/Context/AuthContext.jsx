import React, { createContext, useContext, useState } from 'react';

// 1. Created the Context
const AuthContext = createContext({
  userId: '',
  jwtToken: '',
  setAuth: () => { },
  logout: () => { },
});

// 2. Created a Custom Hook for easy access in components
export const useAuth = () => {
  return useContext(AuthContext);
};

// 3. Created the Provider Component
export const AuthProvider = ({ children }) => {
  // Initialize from localStorage
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || '');
  const [jwtToken, setJwtToken] = useState(() => localStorage.getItem('jwtToken') || '');

  const setAuth = ({ userId, jwtToken }) => {
    setUserId(userId);
    setJwtToken(jwtToken);
    try {
      if (jwtToken) localStorage.setItem('jwtToken', jwtToken);
      if (userId) localStorage.setItem('userId', userId);
    } catch (e) {
      console.warn('AuthContext: failed to persist auth to localStorage', e);
    }
    console.log('✅ Auth state updated:', { userId, hasToken: !!jwtToken });
  };

  const logout = () => {
    setUserId('');
    setJwtToken('');
    try {
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      // Clear session authentication flag to require re-login
      sessionStorage.removeItem('factory_session_authenticated');
    } catch (e) {
      console.warn('AuthContext: failed to clear localStorage', e);
    }
    window.location.href = '/';
  };

  const value = { userId, jwtToken, setAuth, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
