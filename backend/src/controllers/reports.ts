import { NextFunction, Request, Response } from 'express';
import { Op, WhereOptions, col, fn, literal, where as sqlWhere } from 'sequelize';
import { Appointment, Doctor, Invoice, LabTest, MedicalRecord, Medicine, Patient, Staff, User } from '../models';
import { AuthenticatedRequest, Role } from '../types/auth';

/** All monetary amounts (fees, prices, invoice totals, revenue) are Sri Lankan Rupees. */
export const CURRENCY = 'LKR';

export const dashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [patients, appointments, invoices, labTests, medicines, staff] = await Promise.all([
      Patient.count(), Appointment.count(), Invoice.sum('total'), LabTest.count(), Medicine.count(), Staff.count()
    ]);
    res.json({ success: true, data: { patients, appointments, revenue: Number(invoices || 0), currency: CURRENCY, labTests, medicines, staff } });
  } catch (error) { next(error); }
};

interface OverviewCard { key: string; label: string; value: number; money?: boolean }
interface OverviewItem { id: number; title: string; subtitle: string; status: string; at?: string; amount?: number }
interface Overview { cards: OverviewCard[]; list: { title: string; empty: string; items: OverviewItem[] } }
interface Window { from: Date; to: Date }

const LIST_SIZE = 8;
const withPatient = { model: Patient, as: 'patient', attributes: ['firstName', 'lastName'] };
const withDoctor = { model: Doctor, as: 'doctor', attributes: ['id'], include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }] };
const patientName = (row: any): string => row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : 'Unknown patient';
const doctorName = (row: any): string => row.doctor?.user ? `Dr. ${row.doctor.user.firstName} ${row.doctor.user.lastName}` : 'Unassigned doctor';
const today = ({ from, to }: Window) => ({ [Op.gte]: from, [Op.lt]: to });
const lowStock = sqlWhere(col('quantity'), Op.lte, col('reorder_level'));

/** Today's appointments, earliest first; `subtitle` picks what the role needs to see next to the patient. */
const appointmentList = async (window: Window, where: WhereOptions, subtitle: (row: any) => string): Promise<OverviewItem[]> => {
  const rows: any[] = await Appointment.findAll({ where: { ...where, startsAt: today(window) }, include: [withPatient, withDoctor], order: [['startsAt', 'ASC']], limit: LIST_SIZE });
  return rows.map((a) => ({ id: a.id, title: patientName(a), subtitle: subtitle(a), status: a.status, at: new Date(a.startsAt).toISOString() }));
};
const todaysAppointments = (items: OverviewItem[]): Overview['list'] => ({ title: "Today's appointments", empty: 'No appointments scheduled for today', items });

const overviews: Record<Role, (userId: number, window: Window) => Promise<Overview>> = {
  Admin: async (_userId, window) => {
    const [patients, appointments, revenue, staff, items] = await Promise.all([
      Patient.count(), Appointment.count({ where: { startsAt: today(window) } }), Invoice.sum('total'), Staff.count(),
      appointmentList(window, {}, doctorName)
    ]);
    return {
      cards: [
        { key: 'patients', label: 'Total patients', value: patients },
        { key: 'appointments-today', label: "Today's appointments", value: appointments },
        { key: 'revenue', label: 'Revenue', value: Number(revenue || 0), money: true },
        { key: 'staff', label: 'Staff', value: staff }
      ],
      list: todaysAppointments(items)
    };
  },

  // A doctor's figures are scoped to their own doctor profile (none yet -> id 0 matches nothing).
  Doctor: async (userId, window) => {
    const doctor: any = await Doctor.findOne({ where: { userId }, attributes: ['id'] });
    const doctorId = doctor?.id ?? 0;
    const [todayCount, upcoming, records, labs, items] = await Promise.all([
      Appointment.count({ where: { doctorId, startsAt: today(window) } }),
      Appointment.count({ where: { doctorId, status: 'Scheduled', startsAt: { [Op.gte]: new Date() } } }),
      MedicalRecord.count({ where: { doctorId } }),
      LabTest.count({ where: { status: { [Op.ne]: 'Completed' } } }),
      appointmentList(window, { doctorId }, (a) => a.reason)
    ]);
    return {
      cards: [
        { key: 'my-appointments-today', label: 'My appointments today', value: todayCount },
        { key: 'my-upcoming', label: 'My upcoming appointments', value: upcoming },
        { key: 'my-medical-records', label: 'My medical records', value: records },
        { key: 'labs-pending', label: 'Lab results pending', value: labs }
      ],
      list: { ...todaysAppointments(items), title: 'My appointments today' }
    };
  },

  Nurse: async (_userId, window) => {
    const [todayCount, patients, requested, inProgress, items] = await Promise.all([
      Appointment.count({ where: { startsAt: today(window) } }), Patient.count(),
      LabTest.count({ where: { status: 'Requested' } }), LabTest.count({ where: { status: { [Op.in]: ['Collected', 'Processing'] } } }),
      appointmentList(window, {}, doctorName)
    ]);
    return {
      cards: [
        { key: 'appointments-today', label: "Today's appointments", value: todayCount },
        { key: 'patients', label: 'Total patients', value: patients },
        { key: 'labs-to-collect', label: 'Samples to collect', value: requested },
        { key: 'labs-in-progress', label: 'Lab tests in progress', value: inProgress }
      ],
      list: todaysAppointments(items)
    };
  },

  Receptionist: async (_userId, window) => {
    const [todayCount, newPatients, patients, unpaid, items] = await Promise.all([
      Appointment.count({ where: { startsAt: today(window) } }), Patient.count({ where: { createdAt: today(window) } }), Patient.count(),
      Invoice.count({ where: { status: { [Op.ne]: 'Paid' } } }), appointmentList(window, {}, doctorName)
    ]);
    return {
      cards: [
        { key: 'appointments-today', label: "Today's appointments", value: todayCount },
        { key: 'patients-today', label: 'Patients registered today', value: newPatients },
        { key: 'patients', label: 'Total patients', value: patients },
        { key: 'invoices-unpaid', label: 'Unpaid invoices', value: unpaid }
      ],
      list: todaysAppointments(items)
    };
  },

  'Laboratory Staff': async () => {
    const [requested, collected, processing, completed, queue] = await Promise.all([
      ...['Requested', 'Collected', 'Processing', 'Completed'].map((status) => LabTest.count({ where: { status } })),
      LabTest.findAll({ where: { status: { [Op.ne]: 'Completed' } }, include: [withPatient], order: [['createdAt', 'ASC']], limit: LIST_SIZE })
    ]) as [number, number, number, number, any[]];
    return {
      cards: [
        { key: 'labs-requested', label: 'Requested', value: requested },
        { key: 'labs-collected', label: 'Collected', value: collected },
        { key: 'labs-processing', label: 'Processing', value: processing },
        { key: 'labs-completed', label: 'Completed', value: completed }
      ],
      list: {
        title: 'Test queue (oldest first)', empty: 'No tests waiting',
        items: queue.map((t) => ({ id: t.id, title: t.testName, subtitle: patientName(t), status: t.status, at: new Date(t.createdAt).toISOString() }))
      }
    };
  },

  Pharmacist: async () => {
    const [medicines, low, out, stock, reorder] = await Promise.all([
      Medicine.count(), Medicine.count({ where: lowStock }), Medicine.count({ where: { quantity: { [Op.lte]: 0 } } }),
      Medicine.findAll({ attributes: [[fn('COALESCE', fn('SUM', literal('quantity * unit_price')), 0), 'value']], raw: true }),
      Medicine.findAll({ where: lowStock, order: [['quantity', 'ASC']], limit: LIST_SIZE })
    ]) as [number, number, number, any[], any[]];
    return {
      cards: [
        { key: 'medicines', label: 'Medicines in catalogue', value: medicines },
        { key: 'low-stock', label: 'Low stock', value: low },
        { key: 'out-of-stock', label: 'Out of stock', value: out },
        { key: 'stock-value', label: 'Stock value', value: Number(stock[0]?.value || 0), money: true }
      ],
      list: {
        title: 'Reorder list', empty: 'All medicines are above their reorder level',
        items: reorder.map((m) => ({ id: m.id, title: m.name, subtitle: `${m.sku} · ${m.quantity} in stock, reorder at ${m.reorderLevel}`, status: m.quantity <= 0 ? 'Out of stock' : 'Low stock' }))
      }
    };
  },

  Accountant: async () => {
    const [revenue, pending, partial, paid, unpaid] = await Promise.all([
      Invoice.sum('total'), ...['Pending', 'Partially Paid', 'Paid'].map((status) => Invoice.count({ where: { status } })),
      Invoice.findAll({ where: { status: { [Op.ne]: 'Paid' } }, include: [withPatient], order: [['createdAt', 'DESC']], limit: LIST_SIZE })
    ]) as [number | null, number, number, number, any[]];
    return {
      cards: [
        { key: 'revenue', label: 'Revenue', value: Number(revenue || 0), money: true },
        { key: 'invoices-pending', label: 'Pending invoices', value: pending },
        { key: 'invoices-partial', label: 'Partially paid', value: partial },
        { key: 'invoices-paid', label: 'Paid invoices', value: paid }
      ],
      list: {
        title: 'Unpaid invoices', empty: 'Every invoice is paid',
        items: unpaid.map((i) => ({ id: i.id, title: i.invoiceNumber, subtitle: patientName(i), status: i.status, amount: Number(i.total) }))
      }
    };
  }
};

/** Dashboard figures for the signed-in user's role only. */
export const overview = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const role = req.user!.role;
    res.json({ success: true, data: { role, currency: CURRENCY, ...(await overviews[role](req.user!.id, { from, to })) } });
  } catch (error) { next(error); }
};
