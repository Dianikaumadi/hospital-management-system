import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, FileText, FlaskConical, Hourglass, Package, Pill, Stethoscope, UserPlus, Users } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardStats, Role, RoleOverview } from '../types';
import { formatLKR } from '../utils/currency';
import { canRead, ModuleKey } from '../utils/permissions';

export function Dashboard() {
  const { user } = useAuth();
  return user?.role === 'Admin' ? <HospitalDashboard/> : <RoleDashboard role={user!.role}/>;
}

/** Hospital-wide figures, shown to administrators. */
function HospitalDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ patients: 0, appointments: 0, revenue: 0, labTests: 0, medicines: 0, staff: 0 });
  const [loading, setLoading] = useState(true);
  // Hospital-wide figures are limited to Admin, Doctor and Accountant; other roles get a 403 and see placeholders.
  const [restricted, setRestricted] = useState(false);
  const shown = (value: string | number): string | number => restricted ? '—' : value;
  useEffect(() => { api.get('/reports/dashboard').then(({ data }) => setStats(data.data)).catch((error) => { if (error.response?.status === 403) setRestricted(true); }).finally(() => setLoading(false)); }, []);
  return <div><div className="mb-8"><p className="text-sm font-medium text-primary">Overview</p><h2 data-testid="dashboard-title" className="mt-1 text-3xl font-bold">Hospital dashboard</h2><p className="mt-2 text-slate-500">Monitor today’s operations at a glance.</p>{restricted && <p data-testid="dashboard-restricted" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-primary">Hospital-wide statistics are available to Admin, Doctor and Accountant roles. Use the menu to open the modules you work with.</p>}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{loading ? [1,2,3,4].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200"/>) : <><StatCard label="Total patients" testId="patients" value={shown(stats.patients)} icon={<Users size={20}/>} /><StatCard label="Appointments" testId="appointments" value={shown(stats.appointments)} icon={<CalendarDays size={20}/>} tone="green"/><StatCard label="Revenue" testId="revenue" value={shown(formatLKR(stats.revenue))} icon={<Banknote size={20}/>} tone="purple"/><StatCard label="Lab tests" testId="lab-tests" value={shown(stats.labTests)} icon={<ClipboardList size={20}/>} tone="orange"/></>}</div><div className="mt-8 grid gap-5 lg:grid-cols-3"><div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:col-span-2"><h3 className="font-bold">Operational summary</h3><div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Medicines',stats.medicines],['Staff',stats.staff],['Lab tests',stats.labTests],['Appointments',stats.appointments]].map(([label,value]) => <div key={label as string} data-testid={`summary-${(label as string).toLowerCase().replace(' ', '-')}`} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p data-testid={`summary-${(label as string).toLowerCase().replace(' ', '-')}-value`} className="mt-2 text-xl font-bold">{shown(value)}</p></div>)}</div></div><div className="rounded-2xl bg-ink p-6 text-white"><h3 className="font-bold">Care team status</h3><p className="mt-2 text-sm text-slate-400">Keep your teams aligned with real-time updates.</p><div className="mt-8 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-emerald-400"/><span className="text-sm">All systems operational</span></div></div></div></div>;
}

const INTRO: Record<Exclude<Role, 'Admin'>, string> = {
  Doctor: 'Your appointments, clinical records and pending lab results.',
  Nurse: "Today's ward activity, patients and lab samples.",
  Receptionist: "Today's front desk: appointments, registrations and unpaid bills.",
  'Laboratory Staff': 'Your test queue by stage.',
  Pharmacist: 'Medicine stock and what needs reordering.',
  Accountant: 'Revenue and invoice payment status.'
};
const TONES = ['blue', 'green', 'purple', 'orange'] as const;
const ICONS: Record<string, ReactNode> = {
  'my-appointments-today': <CalendarDays size={20}/>, 'appointments-today': <CalendarDays size={20}/>, 'my-upcoming': <CalendarClock size={20}/>,
  'my-medical-records': <Stethoscope size={20}/>, 'labs-pending': <FlaskConical size={20}/>, 'labs-to-collect': <FlaskConical size={20}/>,
  'labs-in-progress': <Hourglass size={20}/>, patients: <Users size={20}/>, 'patients-today': <UserPlus size={20}/>, 'invoices-unpaid': <FileText size={20}/>,
  'labs-requested': <ClipboardList size={20}/>, 'labs-collected': <FlaskConical size={20}/>, 'labs-processing': <Hourglass size={20}/>, 'labs-completed': <CheckCircle2 size={20}/>,
  medicines: <Pill size={20}/>, 'low-stock': <AlertTriangle size={20}/>, 'out-of-stock': <Package size={20}/>, 'stock-value': <Banknote size={20}/>,
  revenue: <Banknote size={20}/>, 'invoices-pending': <FileText size={20}/>, 'invoices-partial': <Hourglass size={20}/>, 'invoices-paid': <CheckCircle2 size={20}/>
};
const STATUS_STYLES: Record<string, string> = {
  Scheduled: 'bg-blue-50 text-blue-700', Completed: 'bg-emerald-50 text-emerald-700', Paid: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-slate-100 text-slate-600', 'No-show': 'bg-red-50 text-red-600', 'Out of stock': 'bg-red-50 text-red-600',
  Pending: 'bg-orange-50 text-orange-700', 'Low stock': 'bg-orange-50 text-orange-700', Requested: 'bg-orange-50 text-orange-700'
};
const MODULE_LINKS: [ModuleKey, string, string][] = [
  ['patients', '/patients', 'Patients'], ['appointments', '/appointments', 'Appointments'], ['doctors', '/doctors', 'Doctors'],
  ['medicalRecords', '/medical-records', 'Medical records'], ['laboratory', '/laboratory', 'Laboratory'], ['pharmacy', '/pharmacy', 'Pharmacy'], ['billing', '/billing', 'Billing']
];
const time = (iso: string) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Figures and a work list for the signed-in role only (GET /reports/overview). */
function RoleDashboard({ role }: { role: Exclude<Role, 'Admin'> }) {
  const [overview, setOverview] = useState<RoleOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // "Today" is the viewer's local day, not the server's.
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    api.get('/reports/overview', { params: { from: from.toISOString(), to: to.toISOString() } }).then(({ data }) => setOverview(data.data)).catch(() => setFailed(true));
  }, []);
  const modules = MODULE_LINKS.filter(([module]) => canRead(role, module));
  return <div data-testid="role-dashboard"><div className="mb-8"><p className="text-sm font-medium text-primary">Overview</p><h2 data-testid="dashboard-title" className="mt-1 text-3xl font-bold">{role} dashboard</h2><p className="mt-2 text-slate-500">{INTRO[role]}</p>{failed && <p role="alert" data-testid="dashboard-error" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">Unable to load your dashboard. Please refresh the page.</p>}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{!overview ? [1,2,3,4].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200"/>) : overview.cards.map((card, i) => <StatCard key={card.key} label={card.label} testId={card.key} value={card.money ? formatLKR(card.value) : card.value} icon={ICONS[card.key] ?? <ClipboardList size={20}/>} tone={TONES[i % TONES.length]}/>)}</div>
    <div className="mt-8 grid gap-5 lg:grid-cols-3">
      <div data-testid="overview-list" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:col-span-2"><h3 className="font-bold">{overview?.list.title ?? 'Loading…'}</h3>
        {overview && (overview.list.items.length === 0 ? <p data-testid="overview-empty" className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">{overview.list.empty}</p>
          : <ul className="mt-4 divide-y divide-slate-100">{overview.list.items.map(item => <li key={item.id} data-testid="overview-item" className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{item.title}</p><p className="truncate text-xs text-slate-500">{item.subtitle}</p></div><div className="flex shrink-0 items-center gap-3">{item.at && <span className="text-xs text-slate-400">{time(item.at)}</span>}{item.amount != null && <span className="text-sm font-semibold text-ink">{formatLKR(item.amount)}</span>}<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[item.status] ?? 'bg-purple-50 text-purple-700'}`}>{item.status}</span></div></li>)}</ul>)}
      </div>
      <div className="rounded-2xl bg-ink p-6 text-white"><h3 className="font-bold">Your modules</h3><p className="mt-2 text-sm text-slate-400">Screens available to the {role} role.</p><div className="mt-6 flex flex-col gap-2">{modules.map(([module, to, label]) => <Link key={module} to={to} data-testid={`quick-${to.slice(1)}`} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm hover:bg-white/15">{label}</Link>)}</div></div>
    </div>
  </div>;
}
