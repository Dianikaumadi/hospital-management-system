import { Router } from 'express';
import { body, query } from 'express-validator';
import { activateInvitation, createInvitation, inspectInvitation, listUsers, login, me, register, updateUserStatus } from '../controllers/auth';
import { resourceController } from '../controllers/resource';
import { dashboard, overview } from '../controllers/reports';
import { Includeable } from 'sequelize';
import { Appointment, Doctor, Invoice, LabTest, MedicalRecord, Medicine, Patient, PatientDocument, Staff, User } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { storedFileName, uploadDocument } from '../middleware/upload';
import { AppError } from '../middleware/error';
import { MODULE_ACCESS, ModuleAccess } from '../config/permissions';

const router = Router();
const crud = (path: string, model: any, access: ModuleAccess, searchable: string[] = [], include: Includeable[] = []) => {
  const controller = resourceController(model, searchable, include);
  router.route(path).get(authenticate, authorize(...access.read), controller.list).post(authenticate, authorize(...access.write), controller.create);
  router.route(`${path}/:id`).get(authenticate, authorize(...access.read), controller.get).patch(authenticate, authorize(...access.write), controller.update);
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
    const fileName = storedFileName(req.file.originalname);
    await PatientDocument.create({ patientId: patient.id, fileName, originalName: req.file.originalname, size: req.file.size, content: req.file.buffer });
    const documents = [...(patient.documents || []), { name: req.file.originalname, url: `/uploads/${fileName}`, uploadedAt: new Date().toISOString() }];
    await patient.update({ documents });
    res.status(201).json({ success: true, data: documents[documents.length - 1] });
  } catch (error) { next(error); }
});

crud('/patients', Patient, MODULE_ACCESS.patients, ['medicalRecordNumber']);
crud('/doctors', Doctor, MODULE_ACCESS.doctors, ['department']);
// Names shown next to the IDs in list screens; only name fields are exposed.
const withPatient: Includeable = { model: Patient, as: 'patient', attributes: ['id', 'firstName', 'lastName'] };
const withDoctor: Includeable = { model: Doctor, as: 'doctor', attributes: ['id'], include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }] };
crud('/appointments', Appointment, MODULE_ACCESS.appointments, [], [withPatient, withDoctor]);
crud('/medical-records', MedicalRecord, MODULE_ACCESS.medicalRecords, [], [withPatient, withDoctor]);
crud('/laboratory/tests', LabTest, MODULE_ACCESS.laboratory, [], [withPatient]);
crud('/pharmacy/medicines', Medicine, MODULE_ACCESS.pharmacy, ['name', 'sku']);
crud('/billing/invoices', Invoice, MODULE_ACCESS.billing, [], [withPatient]);
crud('/staff', Staff, MODULE_ACCESS.staff);
router.get('/reports/dashboard', authenticate, authorize('Admin', 'Accountant', 'Doctor'), dashboard);
// Role-specific dashboard for every signed-in user; `from`/`to` bound "today" in the browser's time zone.
router.get('/reports/overview', authenticate, [query('from').optional().isISO8601(), query('to').optional().isISO8601(), validate], overview);

export default router;
