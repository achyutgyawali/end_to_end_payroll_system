// Request validators: return the cleaned value or throw a 400

import { isValidDate, isValidPeriod } from '../services/periods.js';
import { badRequest } from './httpError.js';

export const EMPLOYMENT_TYPES = ['SSF', 'NON_SSF'];

const isMissing = (value) => value === undefined || value === null || value === '';

function read(source, field, optional) {
  const value = source?.[field];
  if (isMissing(value)) {
    if (optional) return undefined;
    throw badRequest(`${field} is required`);
  }
  return value;
}

export function text(source, field, { optional = false } = {}) {
  const value = read(source, field, optional);
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') throw badRequest(`${field} must be a non-empty string`);
  return value.trim();
}

export function number(source, field, { optional = false, min, exclusiveMin, max } = {}) {
  const value = read(source, field, optional);
  if (value === undefined) return undefined;
  const parsed = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) throw badRequest(`${field} must be a number`);
  if (exclusiveMin !== undefined && parsed <= exclusiveMin) throw badRequest(`${field} must be greater than ${exclusiveMin}`);
  if (min !== undefined && parsed < min) throw badRequest(`${field} must be at least ${min}`);
  if (max !== undefined && parsed > max) throw badRequest(`${field} must be at most ${max}`);
  return parsed;
}

export const amount = (source, field, options = {}) => number(source, field, { exclusiveMin: 0, ...options });
export const percentage = (source, field, options = {}) => number(source, field, { min: 0, max: 100, ...options });

export function date(source, field, { optional = false } = {}) {
  const value = read(source, field, optional);
  if (value === undefined) return undefined;
  if (!isValidDate(value)) throw badRequest(`${field} must be a date in YYYY-MM-DD format`);
  return value;
}

export function period(source, field, { optional = false } = {}) {
  const value = read(source, field, optional);
  if (value === undefined) return undefined;
  if (!isValidPeriod(value)) throw badRequest(`${field} must be a pay period in YYYY-MM format`);
  return value;
}

export function boolean(source, field, { optional = false } = {}) {
  const value = read(source, field, optional);
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'false') return value === 'true';
  throw badRequest(`${field} must be true or false`);
}

export function oneOf(source, field, allowed, { optional = false } = {}) {
  const value = read(source, field, optional);
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

/** Positive integer route parameter, e.g. /employees/:id. */
export function id(params, field = 'id') {
  const value = params[field];
  if (!/^[1-9]\d{0,9}$/.test(value ?? '')) throw badRequest(`${field} must be a positive integer`);
  return Number(value);
}
