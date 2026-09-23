import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(firstName: string, lastName: string, email: string, password: string): Promise<void>;
  activateInvitation(token: string, password: string): Promise<void>;
  logout(): void;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const savedUser = (): User | null => { try { return JSON.parse(localStorage.getItem('hms_user') || 'null'); } catch { return null; } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(savedUser);
  const [loading] = useState(false);
  const saveSession = (data: { token: string; user: User }) => { localStorage.setItem('hms_token', data.token); localStorage.setItem('hms_user', JSON.stringify(data.user)); setUser(data.user); };
  const login = async (email: string, password: string) => { const { data } = await api.post('/auth/login', { email, password }); saveSession(data.data); };
  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { firstName, lastName, email, password });
    saveSession(data.data);
  };
  const activateInvitation = async (token: string, password: string) => {
    const { data } = await api.post(`/auth/invitations/${token}/activate`, { password });
    saveSession(data.data);
  };
  const logout = () => { localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); setUser(null); };
  return <AuthContext.Provider value={useMemo(() => ({ user, loading, login, register, activateInvitation, logout }), [user, loading])}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; };
