import { TestInfo } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { endpoints } from '../api/endpoints';
import type {
  Appointment, AuthResult, Doctor, InvitationCreateResult, Invoice, LabTest, MedicalRecord, Medicine, Patient, Role, Staff
} from '../api/types';
import { deleteTracked, cleanupConfigured, Tracked, TrackedTable } from '../utils/db';
import { env } from '../config/env';
import { uid } from '../utils/random';
import type { Session } from '../utils/session';
import type { RoleKey } from './users';
import { buildAppointment, AppointmentInput } from './appointments';
import { buildDoctor, DoctorInput } from './doctors';
import { buildInvitation, InvitationInput } from './invitations';
import { buildInvoice, InvoiceInput } from './invoices';
import { buildLabTest, LabTestInput } from './lab-tests';
import { buildMedicalRecord, MedicalRecordInput } from './medical-records';
import { buildMedicine, MedicineInput } from './medicines';
import { buildPatient, PatientInput } from './patients';
import { buildStaff, StaffInput } from './staff';

type ApiFor = (role: RoleKey) => ApiClient;

/**
 * Creates test data through the API (much faster than clicking through forms) and remembers what
 * it created so it can be reported in the test attachments and, optionally, deleted afterwards.
 */
export class TestData {
  private readonly created: Tracked[] = [];

  constructor(private readonly apiFor: ApiFor, private readonly session: Session) {}

  /** Records a row created outside this class (e.g. through the UI). */
  track(table: TrackedTable, id: number): void {
    this.created.push({ table, id });
  }

  async patient(overrides: Partial<PatientInput> = {}, as: RoleKey = 'receptionist'): Promise<Patient> {
    const patient = await this.apiFor(as).postData<Patient>(endpoints.patients, buildPatient(overrides));
    this.track('patients', patient.id);
    return patient;
  }

  /** Registers a new user with the given role (needed because a doctor row references a user). */
  async user(role: Role = 'Doctor'): Promise<AuthResult['user']> {
    const id = uid();
    // Admin token is sent so this also works when registration is admin-only.
    const result = await this.apiFor('admin').postData<AuthResult>(endpoints.register, {
      firstName: 'E2E', lastName: `${role.replace(/\s/g, '')}${id}`, email: `e2e.${id}@${env.emailDomain}`,
      password: env.userPassword, role
    });
    this.track('users', result.user.id);
    return result.user;
  }

  async doctor(overrides: Partial<DoctorInput> = {}): Promise<Doctor> {
    const user = overrides.userId ? { id: overrides.userId } : await this.user('Doctor');
    const doctor = await this.apiFor('admin').postData<Doctor>(endpoints.doctors, buildDoctor(user.id, overrides));
    this.track('doctors', doctor.id);
    return doctor;
  }

  /** Uses the shared doctor profile and a fresh patient unless told otherwise. */
  async appointment(overrides: Partial<AppointmentInput> = {}, as: RoleKey = 'receptionist'): Promise<Appointment> {
    const patientId = overrides.patientId ?? (await this.patient()).id;
    const appointment = await this.apiFor(as).postData<Appointment>(
      endpoints.appointments,
      buildAppointment(patientId, overrides.doctorId ?? this.session.doctorId, overrides)
    );
    this.track('appointments', appointment.id);
    return appointment;
  }

  async medicalRecord(overrides: Partial<MedicalRecordInput> = {}, as: RoleKey = 'doctor'): Promise<MedicalRecord> {
    const patientId = overrides.patientId ?? (await this.patient()).id;
    const record = await this.apiFor(as).postData<MedicalRecord>(
      endpoints.medicalRecords,
      buildMedicalRecord(patientId, { doctorId: this.session.doctorId, ...overrides })
    );
    this.track('medical_records', record.id);
    return record;
  }

  async labTest(overrides: Partial<LabTestInput> = {}, as: RoleKey = 'doctor'): Promise<LabTest> {
    const patientId = overrides.patientId ?? (await this.patient()).id;
    const test = await this.apiFor(as).postData<LabTest>(
      endpoints.labTests,
      buildLabTest(patientId, { requestedBy: this.session.users.doctor.id, ...overrides })
    );
    this.track('lab_tests', test.id);
    return test;
  }

  async medicine(overrides: Partial<MedicineInput> = {}, as: RoleKey = 'pharmacist'): Promise<Medicine> {
    const medicine = await this.apiFor(as).postData<Medicine>(endpoints.medicines, buildMedicine(overrides));
    this.track('medicines', medicine.id);
    return medicine;
  }

  async invoice(overrides: Partial<InvoiceInput> = {}, as: RoleKey = 'accountant'): Promise<Invoice> {
    const patientId = overrides.patientId ?? (await this.patient()).id;
    const input = buildInvoice(patientId, overrides.items, overrides);
    const invoice = await this.apiFor(as).postData<Invoice>(endpoints.invoices, input);
    this.track('invoices', invoice.id);
    return invoice;
  }

  async staffMember(overrides: Partial<StaffInput> = {}): Promise<Staff> {
    const user = overrides.userId ? { id: overrides.userId } : await this.user('Nurse');
    const staff = await this.apiFor('admin').postData<Staff>(endpoints.staff, buildStaff(user.id, overrides));
    this.track('staff', staff.id);
    return staff;
  }

  /** Creates a staff invitation as Admin (POST /users/invitations). */
  async invitation(overrides: Partial<InvitationInput> = {}): Promise<InvitationCreateResult & InvitationInput> {
    const input = buildInvitation(overrides);
    const result = await this.apiFor('admin').postData<InvitationCreateResult>(endpoints.invitations, input);
    this.track('invitations', result.invitationId);
    return { ...result, ...input };
  }

  /**
   * Call from afterEach (the `data` fixture also calls it automatically): attaches what the test
   * created to the report and, when E2E_CLEANUP=test and a database is configured, deletes it.
   */
  async finish(testInfo: TestInfo): Promise<void> {
    if (this.created.length === 0) return;
    await testInfo.attach('created-test-data.json', {
      body: JSON.stringify(this.created, null, 2), contentType: 'application/json'
    });
    if (env.cleanup === 'test' && cleanupConfigured()) {
      const problems = await deleteTracked(this.created);
      if (problems.length) {
        await testInfo.attach('cleanup-problems.txt', { body: problems.join('\n'), contentType: 'text/plain' });
      }
    }
    this.created.length = 0;
  }
}
