import { ReactNode } from 'react';
export function StatCard({ label, value, icon, tone = 'blue', testId }: { label: string; value: string | number; icon: ReactNode; tone?: 'blue' | 'green' | 'purple' | 'orange'; testId?: string }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600' };
  return <div data-testid={testId ? `stat-${testId}` : undefined} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`rounded-xl p-2 ${tones[tone]}`}>{icon}</span></div><p data-testid={testId ? `stat-${testId}-value` : undefined} className="mt-4 text-3xl font-bold text-ink">{value}</p><p className="mt-1 text-xs text-slate-400">Updated just now</p></div>;
}
