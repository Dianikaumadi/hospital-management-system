import { FormEvent, useEffect, useState } from 'react';
import { Activity, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Role } from '../types';
import { useAuth } from '../context/AuthContext';

interface InvitationPreview {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  expiresAt: string;
}

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function ActivateAccount() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { activateInvitation } = useAuth();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvitation = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/auth/invitations/${token}`);
        setInvitation(data.data);
      } catch (requestError: any) {
        setError(requestError.response?.data?.message || 'Invitation is invalid or expired');
      } finally {
        setLoading(false);
      }
    };
    if (token) void loadInvitation();
    else { setError('Activation token is missing'); setLoading(false); }
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setBusy(true);
    try {
      await activateInvitation(token, password);
      navigate('/');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to activate account');
    } finally {
      setBusy(false);
    }
  };

  return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
    <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
      <div className="hidden bg-ink p-10 text-white md:block">
        <div className="flex items-center gap-2"><Activity className="text-blue-400"/><span className="text-xl font-bold">CarePoint</span></div>
        <h1 className="mt-24 text-4xl font-bold leading-tight">Activate your staff account.</h1>
        <p className="mt-5 text-slate-400">Create a secure password to join your hospital workspace.</p>
      </div>
      <div className="p-8 md:p-12">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary"><ShieldCheck size={24}/></div>
        <h2 className="text-2xl font-bold">Activate Account</h2>
        <p className="mt-2 text-sm text-slate-500">Staff onboarding</p>

        {loading && <div className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Checking invitation...</div>}
        {error && <div role="alert" data-testid="activation-error" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {!loading && invitation && <form onSubmit={submit} data-testid="activate-account-form" className="mt-8">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><CheckCircle2 size={17} className="text-emerald-600"/>{invitation.firstName} {invitation.lastName}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Mail size={16}/>{invitation.email}</p>
            <p className="mt-2 text-xs text-slate-500">{invitation.role} invitation expires {formatDate(invitation.expiresAt)}</p>
          </div>
          <label className="mt-6 block text-sm font-medium">Create password<div className="relative"><LockKeyhole size={17} className="absolute left-3 top-3.5 text-slate-400"/><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-primary"/></div></label>
          <label className="mt-5 block text-sm font-medium">Confirm password<div className="relative"><LockKeyhole size={17} className="absolute left-3 top-3.5 text-slate-400"/><input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-primary"/></div></label>
          <button type="submit" disabled={busy} className="mt-8 w-full rounded-xl bg-primary py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Activating...' : 'Create password and sign in'}</button>
        </form>}

        {!loading && !invitation && <p className="mt-6 text-sm text-slate-500"><Link to="/login" className="font-semibold text-primary hover:underline">Return to sign in</Link></p>}
      </div>
    </div>
  </div>;
}
