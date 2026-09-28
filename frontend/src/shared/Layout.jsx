import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useRole } from './role.jsx';

const ADMIN_NAV = [
  ['/employees', 'Employees'],
  ['/payroll', 'Payroll run'],
  ['/payslips', 'Payslips'],
  ['/cost-report', 'Cost report'],
  ['/configuration', 'Configuration'],
];

const EMPLOYEE_NAV = [
  ['/employees', 'Employees'],
  ['/payslips', 'Payslips'],
];

export default function Layout() {
  const { role, isAdmin, setRole } = useRole();
  const navigate = useNavigate();

  const switchRole = (event) => {
    setRole(event.target.value);
    navigate('/employees');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark">₨</span> Nepal Payroll
          </span>
          <nav className="nav">
            {(isAdmin ? ADMIN_NAV : EMPLOYEE_NAV).map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <label className="role-switcher">
            <span>View as</span>
            <select value={role} onChange={switchRole} aria-label="Role">
              <option value="admin">Admin</option>
              <option value="employee">Employee view</option>
            </select>
          </label>
        </div>
      </header>
      {!isAdmin && <div className="role-banner">Employee view · read-only</div>}
      {/* Keyed by role so every page refetches under the new role. */}
      <main className="content" key={role}>
        <Outlet />
      </main>
    </div>
  );
}
