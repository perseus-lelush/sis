import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.get('/auth/me');
        if (active) setUser(data.user);
      } catch {
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restore();

    const handleUnauthorized = () => setUser(null);
    window.addEventListener('sis:unauthorized', handleUnauthorized);
    return () => {
      active = false;
      window.removeEventListener('sis:unauthorized', handleUnauthorized);
    };
  }, []);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
