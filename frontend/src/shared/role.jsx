import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { setApiRole } from './api.js';

const STORAGE_KEY = 'payroll.role';

function readStoredRole() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'employee' ? 'employee' : 'admin';
  } catch {
    return 'admin';
  }
}

const initialRole = readStoredRole();
setApiRole(initialRole);

const RoleContext = createContext({ role: initialRole, isAdmin: initialRole === 'admin', setRole: () => {} });

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(initialRole);

  const setRole = useCallback((next) => {
    setApiRole(next); // before re-render, so refetches carry the new role
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // no localStorage (private mode), role still works for this session
    }
    setRoleState(next);
  }, []);

  const value = useMemo(() => ({ role, isAdmin: role === 'admin', setRole }), [role, setRole]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
