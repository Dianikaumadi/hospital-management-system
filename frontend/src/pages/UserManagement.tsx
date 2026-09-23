import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Copy, Mail, RefreshCw, Search, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react';
import { api } from '../services/api';
import { Role, User } from '../types';
import { useAuth } from '../context/AuthContext';

const roles: Role[] = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant'];

interface InviteResult {
  invitationId: number;
  email: string;
  expiresAt: string;
  token: string;
  emailSent?: boolean;
  emailDeliveryReason?: 'not_configured' | 'send_failed';
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available';

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'Receptionist' as Role });

  const activationLink = useMemo(() => inviteResult ? `${window.location.origin}/activate/${inviteResult.token}` : '', [inviteResult]);
  const filteredUsers = users.filter((member) => {
    const haystack = `${member.firstName} ${member.lastName} ${member.email} ${member.role}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data.data.users);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setInviteResult(null);
    try {
      const { data } = await api.post('/users/invitations', form);
      setInviteResult(data.data);
      setNotice(data.data.emailSent ? `Invitation email sent to ${form.email}` : `Invitation created for ${form.email}`);
      setForm({ firstName: '', lastName: '', email: '', role: 'Receptionist' });
      await loadUsers();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to create invitation');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!activationLink) return;
    try {
      await navigator.clipboard.writeText(activationLink);
      setNotice('Invitation link copied');
    } catch {
      setError('Copy failed. Select and copy the link manually.');
    }
  };

  const updateStatus = async (member: User, isActive: boolean) => {
    setUpdatingId(member.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/users/${member.id}/status`, { isActive });
      setUsers((existing) => existing.map((item) => item.id === member.id ? { ...item, isActive: data.data.isActive } : item));
      setNotice(`${member.firstName} ${member.lastName} is now ${isActive ? 'active' : 'inactive'}`);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to update user status');
    } finally {
      setUpdatingId(null);
    }
  };

  const mailSubject = inviteResult ? encodeURIComponent('CarePoint account invitation') : '';
  const mailBody = inviteResult ? encodeURIComponent(`Hello,\n\nYou have been invited to CarePoint. Use this secure link to activate your account and create your password:\n\n${activationLink}\n\nThis invitation expires ${formatDate(inviteResult.expiresAt)}.`) : '';

  return <div data-testid="user-management-page">
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck size={16}/> Admin</p><h2 className="mt-1 text-3xl font-bold">User Management</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Staff access and onboarding</p></div>
      <button type="button" onClick={loadUsers} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"><RefreshCw size={16}/> Refresh</button>
    </div>

    {error && <div role="alert" data-testid="user-management-error" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
    {notice && <div role="status" data-testid="user-management-notice" className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-lg font-bold">Staff accounts</h3>
          <div className="relative w-full sm:max-w-xs"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} data-testid="user-search" placeholder="Search users..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"/></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="users-table">
            <thead><tr className="border-b border-slate-100 text-xs uppercase text-slate-400"><th className="px-3 py-3 font-semibold">Name</th><th className="px-3 py-3 font-semibold">Email</th><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Created</th><th className="px-3 py-3 text-right font-semibold">Access</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-400">Loading users...</td></tr>}
              {!loading && filteredUsers.map((member) => {
                const isActive = member.isActive !== false;
                const isSelf = member.id === currentUser?.id;
                return <tr key={member.id} data-testid="user-row" className="border-b border-slate-50">
                  <td className="px-3 py-4 font-semibold text-ink">{member.firstName} {member.lastName}</td>
                  <td className="px-3 py-4 text-slate-600">{member.email}</td>
                  <td className="px-3 py-4 text-slate-600">{member.role}</td>
                  <td className="px-3 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isActive ? <UserCheck size={14}/> : <UserX size={14}/>}{isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-4 text-slate-500">{formatDate(member.createdAt)}</td>
                  <td className="px-3 py-4 text-right"><button type="button" data-testid={`toggle-user-${member.id}`} disabled={isSelf || updatingId === member.id} onClick={() => updateStatus(member, !isActive)} className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${isActive ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{isActive ? 'Deactivate' : 'Activate'}</button></td>
                </tr>;
              })}
              {!loading && filteredUsers.length === 0 && <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-400">No users found</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="space-y-6">
        <form onSubmit={createInvite} data-testid="invite-staff-form" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h3 className="flex items-center gap-2 text-lg font-bold"><UserPlus size={18}/> Invite Staff</h3>
          <label className="mt-5 block text-sm font-medium">First name<input required minLength={2} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"/></label>
          <label className="mt-4 block text-sm font-medium">Last name<input required minLength={2} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"/></label>
          <label className="mt-4 block text-sm font-medium">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"/></label>
          <label className="mt-4 block text-sm font-medium">Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <button type="submit" disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Mail size={16}/>{saving ? 'Creating invitation...' : 'Create invitation'}</button>
        </form>

        {inviteResult && <section data-testid="invitation-delivery" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Invitation Delivery</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inviteResult.emailSent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{inviteResult.emailSent ? 'Email sent' : 'Manual delivery'}</span></div>
          <p className="mt-2 text-sm text-slate-500">{inviteResult.email}</p>
          <input readOnly value={activationLink} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"/>
          <p className="mt-3 text-xs text-slate-500">Expires {formatDate(inviteResult.expiresAt)}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={copyLink} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"><Copy size={16}/> Copy link</button>
            <a href={`mailto:${inviteResult.email}?subject=${mailSubject}&body=${mailBody}`} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"><Mail size={16}/> Open email</a>
          </div>
        </section>}
      </aside>
    </div>
  </div>;
}
