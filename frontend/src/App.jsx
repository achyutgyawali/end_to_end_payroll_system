import { Link, Navigate, Route, Routes } from 'react-router-dom';
import ConfigPage from './admin/ConfigPage.jsx';
import CostReportPage from './admin/CostReportPage.jsx';
import AdminEmployeeDetailPage from './admin/EmployeeDetailPage.jsx';
import AdminEmployeesPage from './admin/EmployeesPage.jsx';
import PayrollRunPage from './admin/PayrollRunPage.jsx';
import ViewEmployeeDetailPage from './employee-view/EmployeeDetailPage.jsx';
import ViewEmployeesPage from './employee-view/EmployeesPage.jsx';
import Layout from './shared/Layout.jsx';
import { PayslipDetailPage, PayslipsPage } from './shared/PayslipPages.jsx';
import { useRole } from './shared/role.jsx';
import { Alert } from './shared/ui.jsx';

function AdminOnly({ children }) {
  const { isAdmin } = useRole();
  if (isAdmin) return children;
  return (
    <Alert kind="info">
      This page is only available to the admin role. <Link to="/employees">Go to employees</Link>
    </Alert>
  );
}

export default function App() {
  const { isAdmin } = useRole();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={isAdmin ? <AdminEmployeesPage /> : <ViewEmployeesPage />} />
        <Route path="employees/:id" element={isAdmin ? <AdminEmployeeDetailPage /> : <ViewEmployeeDetailPage />} />
        <Route path="employees/:id/payslips/:payslipId" element={<PayslipDetailPage />} />
        <Route path="payslips" element={<PayslipsPage />} />
        <Route path="payroll" element={<AdminOnly><PayrollRunPage /></AdminOnly>} />
        <Route path="cost-report" element={<AdminOnly><CostReportPage /></AdminOnly>} />
        <Route path="configuration" element={<AdminOnly><ConfigPage /></AdminOnly>} />
        <Route path="*" element={<Alert kind="info">Page not found. <Link to="/employees">Go to employees</Link></Alert>} />
      </Route>
    </Routes>
  );
}
