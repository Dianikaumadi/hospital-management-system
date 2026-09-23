import { Router } from 'express';
import { body } from 'express-validator';
import { activateInvitation, createInvitation, inspectInvitation, listUsers, login, me, register, updateUserStatus } from '../controllers/auth';
import { resourceController } from '../controllers/resource';
import { dashboard } from '../controllers/reports';
import { Appointment, Doctor, Invoice, LabTest, MedicalRecord, Medicine, Patient, Staff } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadDocument } from '../middleware/upload';
import { AppError } from '../middleware/error';

const router = Router();
const crud = (path: string, model: any, roles = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant'], searchable: string[] = []) => {
  const controller = resourceController(model, searchable);
  router.route(path).get(authenticate, controller.list).post(authenticate, authorize(...roles as any), controller.create);
  router.route(`${path}/:id`).get(authenticate, controller.get).patch(authenticate, authorize(...roles as any), controller.update);
};

router.post('/auth/register', authenticate, authorize('Admin'), [
  body('firstName').trim().isLength({ min: 2 }), body('lastName').trim().isLength({ min: 2 }),
  body('email').isEmail(), body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant']), validate
], register);
router.post('/auth/login', [body('email').isEmail(), body('password').notEmpty(), validate], login);
router.get('/auth/me', authenticate, me);
router.get('/auth/invitations/:token', inspectInvitation);
router.post('/auth/invitations/:token/activate', [body('password').isLength({ min: 8 }), validate], activateInvitation);
router.get('/users', authenticate, authorize('Admin'), listUsers);
router.post('/users/invitations', authenticate, authorize('Admin'), [
  body('firstName').trim().isLength({ min: 2 }), body('lastName').trim().isLength({ min: 2 }),
  body('email').isEmail(), body('role').optional().isIn(['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant']), validate
], createInvitation);
router.patch('/users/:id/status', authenticate, authorize('Admin'), body('isActive').isBoolean(), validate, updateUserStatus);

router.post('/patients/:id/documents', authenticate, authorize('Admin', 'Doctor', 'Nurse', 'Receptionist'), uploadDocument, async (req: any, res, next) => {
  try {
    if (!req.file) throw new AppError(422, 'A document file is required');
    const patient: any = await Patient.findByPk(String(req.params.id));
    if (!patient) throw new AppError(404, 'Patient not found');
    const documents = [...(patient.documents || []), { name: req.file.originalname, url: `/uploads/${req.file.filename}`, uploadedAt: new Date().toISOString() }];
    await patient.update({ documents });
    res.status(201).json({ success: true, data: documents[documents.length - 1] });
  } catch (error) { next(error); }
});

crud('/patients', Patient, ['Admin', 'Doctor', 'Nurse', 'Receptionist'], ['medicalRecordNumber']);
crud('/doctors', Doctor, ['Admin', 'Receptionist'], ['department']);
crud('/appointments', Appointment, ['Admin', 'Doctor', 'Receptionist', 'Nurse']);
crud('/medical-records', MedicalRecord, ['Admin', 'Doctor', 'Nurse']);
crud('/laboratory/tests', LabTest, ['Admin', 'Doctor', 'Nurse', 'Laboratory Staff']);
crud('/pharmacy/medicines', Medicine, ['Admin', 'Pharmacist'], ['name', 'sku']);
crud('/billing/invoices', Invoice, ['Admin', 'Accountant', 'Receptionist']);
crud('/staff', Staff, ['Admin']);
router.get('/reports/dashboard', authenticate, authorize('Admin', 'Accountant', 'Doctor'), dashboard);

export default router;
