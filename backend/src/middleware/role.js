// No real auth, the role just comes from the x-role header

import { badRequest, forbidden } from '../lib/httpError.js';

export const ROLES = ['admin', 'employee'];
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function resolveRole(req, res, next) {
  const role = String(req.get('x-role') ?? '').trim().toLowerCase();
  if (!ROLES.includes(role)) {
    return next(badRequest(`Missing or invalid x-role header (expected one of: ${ROLES.join(', ')})`));
  }
  req.role = role;
  next();
}

// Employee role is read-only
export function rejectEmployeeWrites(req, res, next) {
  if (req.role !== 'admin' && !READ_METHODS.includes(req.method)) {
    return next(forbidden('The employee view is read-only'));
  }
  next();
}

// Admin-only reads (secret salary, cost report)
export function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return next(forbidden('Admin role required'));
  next();
}
