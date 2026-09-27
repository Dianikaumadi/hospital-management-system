import { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ModulePage } from './pages/ModulePage';
import { UserManagement } from './pages/UserManagement';
import { ActivateAccount } from './pages/ActivateAccount';
import { canRead, canWrite, ModuleKey } from './utils/permissions';
export function App() {
  const { user } = useAuth();
  if (!user) return <Routes><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/activate/:token" element={<ActivateAccount/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>;
  // Screens a role cannot read redirect to its dashboard; "Add new" is only offered to roles that can write.
  const screen = (module: ModuleKey, page: (canAdd: boolean) => ReactElement) => canRead(user.role, module) ? page(canWrite(user.role, module)) : <Navigate to="/" replace/>;
  return <Routes><Route path="/activate/:token" element={<ActivateAccount/>}/><Route path="*" element={<DashboardLayout><Routes><Route path="/" element={<Dashboard/>}/><Route path="/patients" element={screen('patients', (canAdd) => <ModulePage key="/patients" title="Patients" endpoint="/patients" canAdd={canAdd} columns={['ID','firstName','lastName','phone','gender']} fields={['medicalRecordNumber','firstName','lastName','dateOfBirth','gender','phone']}/>)}/><Route path="/appointments" element={screen('appointments', (canAdd) => <ModulePage key="/appointments" title="Appointments" endpoint="/appointments" canAdd={canAdd} columns={['ID','patientId','patient','doctorId','doctor','startsAt','status']} fields={['patientId','doctorId','startsAt','reason']}/>)}/><Route path="/doctors" element={screen('doctors', (canAdd) => <ModulePage key="/doctors" title="Doctors" endpoint="/doctors" canAdd={canAdd} columns={['ID','specialization','department','licenseNumber']} fields={['userId','specialization','department','licenseNumber','consultationFee']}/>)}/><Route path="/medical-records" element={screen('medicalRecords', (canAdd) => <ModulePage key="/medical-records" title="Medical records" endpoint="/medical-records" canAdd={canAdd} columns={['ID','patientId','patient','doctorId','doctor','diagnosis','treatment']} fields={['patientId','diagnosis','treatment']}/>)}/><Route path="/laboratory" element={screen('laboratory', (canAdd) => <ModulePage key="/laboratory/tests" title="Laboratory tests" endpoint="/laboratory/tests" canAdd={canAdd} columns={['ID','patientId','patient','testName','status']} fields={['patientId','testName']}/>)}/><Route path="/pharmacy" element={screen('pharmacy', (canAdd) => <ModulePage key="/pharmacy/medicines" title="Medicines" endpoint="/pharmacy/medicines" canAdd={canAdd} columns={['ID','name','sku','quantity','expiryDate']} fields={['name','sku','quantity','unitPrice']}/>)}/><Route path="/billing" element={screen('billing', (canAdd) => <ModulePage key="/billing/invoices" title="Invoices" endpoint="/billing/invoices" canAdd={canAdd} columns={['ID','invoiceNumber','patientId','patient','total','status']} fields={['patientId','invoiceNumber','total']}/>)}/><Route path="/users" element={user.role === 'Admin' ? <UserManagement/> : <Navigate to="/" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></DashboardLayout>}/></Routes>;
}
