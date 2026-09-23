import { NextFunction, Request, Response } from 'express';
import { Appointment, Invoice, LabTest, Medicine, Patient, Staff } from '../models';

export const dashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [patients, appointments, invoices, labTests, medicines, staff] = await Promise.all([
      Patient.count(), Appointment.count(), Invoice.sum('total'), LabTest.count(), Medicine.count(), Staff.count()
    ]);
    res.json({ success: true, data: { patients, appointments, revenue: Number(invoices || 0), labTests, medicines, staff } });
  } catch (error) { next(error); }
};
