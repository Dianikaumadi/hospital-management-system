export type Role = 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'Laboratory Staff' | 'Pharmacist' | 'Accountant';
export interface User { id: number; firstName: string; lastName: string; email: string; role: Role; isActive?: boolean; createdAt?: string; updatedAt?: string; }
export interface DashboardStats { patients: number; appointments: number; revenue: number; currency?: string; labTests: number; medicines: number; staff: number; }
/** GET /reports/overview: dashboard figures and a work list for the signed-in role. */
export interface RoleOverview {
  role: Role;
  currency: string;
  cards: { key: string; label: string; value: number; money?: boolean }[];
  list: { title: string; empty: string; items: { id: number; title: string; subtitle: string; status: string; at?: string; amount?: number }[] };
}
