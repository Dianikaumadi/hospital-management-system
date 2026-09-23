export type Role = 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'Laboratory Staff' | 'Pharmacist' | 'Accountant';
export interface User { id: number; firstName: string; lastName: string; email: string; role: Role; isActive?: boolean; createdAt?: string; updatedAt?: string; }
export interface DashboardStats { patients: number; appointments: number; revenue: number; labTests: number; medicines: number; staff: number; }
