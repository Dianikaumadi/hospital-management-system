import { FormEvent, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../services/api';
import { CURRENCY, formatLKR, MONEY_FIELDS } from '../utils/currency';
// "patient" and "doctor" columns show names from the related rows the API includes in list responses.
const cellValue = (item: any, column: string) => {
  if (column === 'patient') return item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : '';
  if (column === 'doctor') return item.doctor?.user ? `Dr. ${item.doctor.user.firstName} ${item.doctor.user.lastName}` : '';
  if (MONEY_FIELDS.has(column) && item[column] != null && item[column] !== '') return formatLKR(item[column]);
  return item[column];
};
// Money columns and inputs are labelled with the currency, e.g. "total (LKR)".
const withCurrency = (name: string) => MONEY_FIELDS.has(name) ? `${name} (${CURRENCY})` : name;
export function ModulePage({ title, endpoint, columns, fields, canAdd = true }: { title: string; endpoint: string; columns: string[]; fields: string[]; canAdd?: boolean }) {
  const [items, setItems] = useState<any[]>([]); const [search, setSearch] = useState(''); const [open, setOpen] = useState(false); const [form, setForm] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState(''); const [formError, setFormError] = useState(''); const [saving, setSaving] = useState(false);
  const load = () => api.get(endpoint, { params: search ? { search } : undefined }).then(({ data }) => setItems(data.data)).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);
  const close = () => { setOpen(false); setFormError(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try { await api.post(endpoint, form); setOpen(false); setForm({}); setNotice(`${title.slice(0,-1)} saved successfully`); await load(); }
    catch (error: any) { setFormError(error.response?.data?.message || 'Unable to save record'); }
    finally { setSaving(false); }
  };
  return <div data-testid="module-page"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">Management</p><h2 data-testid="module-title" className="mt-1 text-3xl font-bold">{title}</h2></div>{canAdd ? <button data-testid="add-new-button" onClick={() => { setNotice(''); setOpen(true); }} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white"><Plus size={17}/> Add new</button> : <span data-testid="view-only-badge" className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 sm:self-auto">View only</span>}</div>{notice && <div role="status" data-testid="notice-success" className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}<div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="relative mb-5 max-w-sm"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input data-testid="search-input" name="search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Search records..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"/></div><div className="overflow-x-auto"><table data-testid="data-table" className="w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase text-slate-400">{columns.map(c => <th key={c} className="px-3 py-3 font-semibold">{withCurrency(c)}</th>)}</tr></thead><tbody>{items.map(item => <tr key={item.id} data-testid="table-row" data-row-id={item.id} className="border-b border-slate-50"><td data-testid="cell-id" className="px-3 py-4 font-semibold">#{item.id}</td>{columns.slice(1).map(c => <td key={c} data-testid={`cell-${c}`} className="px-3 py-4 text-slate-600">{cellValue(item, c) || '—'}</td>)}</tr>)}{items.length === 0 && <tr><td data-testid="empty-state" colSpan={columns.length} className="px-3 py-12 text-center text-slate-400">No records found</td></tr>}</tbody></table></div></div>{open && <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-5"><form onSubmit={submit} data-testid="record-form" className="w-full max-w-lg rounded-2xl bg-white p-6"><h3 className="text-xl font-bold">Add {title.slice(0,-1)}</h3>{formError && <div role="alert" data-testid="form-error" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</div>}{fields.map(field => <input key={field} name={field} data-testid={`field-${field}`} required placeholder={withCurrency(field)} value={form[field] || ''} onChange={e => setForm({...form, [field]: e.target.value})} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/>) }<div className="mt-6 flex justify-end gap-3"><button type="button" data-testid="record-cancel" onClick={close} className="rounded-xl px-4 py-2 text-sm">Cancel</button><button type="submit" data-testid="record-submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save record</button></div></form></div>}</div>;
}
