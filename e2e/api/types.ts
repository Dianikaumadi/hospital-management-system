export type Role = 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'Laboratory Staff' | 'Pharmacist' | 'Accountant';

export interface Envelope<T> { success: boolean; data: T; meta?: { total: number }; message?: string; details?: unknown }

export interface AuthUser { id: number; firstName: string; lastName: string; email: string; role: Role }
export interface AuthResult { user: AuthUser; token: string }

export interface PatientDocument { name: string; url: string; uploadedAt: string }
export interface Patient {
  id: number; medicalRecordNumber: string; firstName: string; lastName: string; dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other'; phone: string; email: string | null; address: string | null;
  bloodGroup: string | null; emergencyContact: string | null; documents: PatientDocument[];
  createdAt: string; updatedAt: string;
}
export interface Doctor {
  id: number; userId: number; specialization: string; department: string; licenseNumber: string;
  consultationFee: string; schedule: Record<string, unknown>;
}
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No-show';
export interface Appointment { id: number; patientId: number; doctorId: number; startsAt: string; reason: string; status: AppointmentStatus }
export interface PrescriptionItem { medicine: string; dosage: string; frequency: string; durationDays: number }
export interface MedicalRecord {
  id: number; patientId: number; doctorId: number | null; diagnosis: string; treatment: string | null;
  prescription: PrescriptionItem[] | null; reportUrl: string | null; createdAt: string;
}
export type LabStatus = 'Requested' | 'Collected' | 'Processing' | 'Completed';
export interface LabTest {
  id: number; patientId: number; requestedBy: number | null; testName: string; status: LabStatus;
  result: string | null; reportUrl: string | null;
}
export interface Medicine {
  id: number; name: string; sku: string; quantity: number; reorderLevel: number; unitPrice: string; expiryDate: string | null;
}
export type InvoiceStatus = 'Pending' | 'Partially Paid' | 'Paid';
export interface Invoice {
  id: number; patientId: number; invoiceNumber: string; items: { description: string; quantity: number; unitPrice: number }[];
  total: string; status: InvoiceStatus; paidAt: string | null;
}
export interface Staff { id: number; userId: number; employeeNumber: string; department: string; hireDate: string }
export interface DashboardStats { patients: number; appointments: number; revenue: number; labTests: number; medicines: number; staff: number }
