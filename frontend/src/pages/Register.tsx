import { FormEvent, useState } from 'react';
import { Activity, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await register(form.firstName, form.lastName, form.email, form.password);
      navigate('/');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to create your account');
    } finally {
      setBusy(false);
    }
  };

  return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2"><div className="hidden bg-ink p-10 text-white md:block"><div className="flex items-center gap-2"><Activity className="text-blue-400"/><span className="text-xl font-bold">CarePoint</span></div><h1 className="mt-24 text-4xl font-bold leading-tight">Join your connected care team.</h1><p className="mt-5 text-slate-400">Create your account to securely manage hospital operations.</p></div><form onSubmit={submit} data-testid="register-form" className="p-8 md:p-12"><h2 className="text-2xl font-bold">Create your account</h2><p className="mt-2 text-sm text-slate-500">Get started with CarePoint</p>{error && <div role="alert" data-testid="register-error" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}<div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">First name<input required minLength={2} type="text" name="firstName" data-testid="register-first-name" value={form.firstName} onChange={update('firstName')} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary" autoComplete="given-name"/></label><label className="block text-sm font-medium">Last name<input required minLength={2} type="text" name="lastName" data-testid="register-last-name" value={form.lastName} onChange={update('lastName')} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary" autoComplete="family-name"/></label></div><label className="mt-5 block text-sm font-medium">Email<div className="relative"><Mail size={17} className="absolute left-3 top-3.5 text-slate-400"/><input required type="email" name="email" data-testid="register-email" value={form.email} onChange={update('email')} className="mt-2 w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-primary" placeholder="you@hospital.com" autoComplete="email"/></div></label><label className="mt-5 block text-sm font-medium">Password<div className="relative"><LockKeyhole size={17} className="absolute left-3 top-3.5 text-slate-400"/><input required minLength={8} type="password" name="password" data-testid="register-password" value={form.password} onChange={update('password')} className="mt-2 w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-primary" autoComplete="new-password"/></div></label><label className="mt-5 block text-sm font-medium">Confirm password<div className="relative"><UserRound size={17} className="absolute left-3 top-3.5 text-slate-400"/><input required minLength={8} type="password" name="confirmPassword" data-testid="register-confirm-password" value={form.confirmPassword} onChange={update('confirmPassword')} className="mt-2 w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-primary" autoComplete="new-password"/></div></label><button type="submit" data-testid="register-submit" disabled={busy} className="mt-8 w-full rounded-xl bg-primary py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Creating account...' : 'Create account'}</button><p className="mt-5 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p></form></div></div>;
}
