import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ModulePage } from './pages/ModulePage';
import { UserManagement } from './pages/UserManagement';
import { ActivateAccount } from './pages/ActivateAccount';
export function App() {
  const { user } = useAuth();
  if (!user) return <Routes><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/activate/:token" element={<ActivateAccount/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>;
  return <Routes><Route path="/activate/:token" element={<ActivateAccount/>}/><Route path="*" element={<DashboardLayout><Routes><Route path="/" element={<Dashboard/>}/><Route path="/patients" element={<ModulePage key="/patients" title="Patients" endpoint="/patients" columns={['ID','firstName','lastName','phone','gender']} fields={['medicalRecordNumber','firstName','lastName','dateOfBirth','gender','phone']}/>}/><Route path="/appointments" element={<ModulePage key="/appointments" title="Appointments" endpoint="/appointments" columns={['ID','patientId','doctorId','startsAt','status']} fields={['patientId','doctorId','startsAt','reason']}/>}/><Route path="/doctors" element={<ModulePage key="/doctors" title="Doctors" endpoint="/doctors" columns={['ID','specialization','department','licenseNumber']} fields={['userId','specialization','department','licenseNumber','consultationFee']}/>}/><Route path="/medical-records" element={<ModulePage key="/medical-records" title="Medical records" endpoint="/medical-records" columns={['ID','patientId','doctorId','diagnosis','treatment']} fields={['patientId','diagnosis','treatment']}/>}/><Route path="/laboratory" element={<ModulePage key="/laboratory/tests" title="Laboratory tests" endpoint="/laboratory/tests" columns={['ID','patientId','testName','status']} fields={['patientId','testName']}/>}/><Route path="/pharmacy" element={<ModulePage key="/pharmacy/medicines" title="Medicines" endpoint="/pharmacy/medicines" columns={['ID','name','sku','quantity','expiryDate']} fields={['name','sku','quantity','unitPrice']}/>}/><Route path="/billing" element={<ModulePage key="/billing/invoices" title="Invoices" endpoint="/billing/invoices" columns={['ID','invoiceNumber','patientId','total','status']} fields={['patientId','invoiceNumber','total']}/>}/><Route path="/users" element={user.role === 'Admin' ? <UserManagement/> : <Navigate to="/" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></DashboardLayout>}/></Routes>;
}
