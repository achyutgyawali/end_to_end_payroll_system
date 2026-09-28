-- Seed data (loaded automatically on first start)

BEGIN;

-- Fiscal year 2083/84 (placeholder AD dates)
INSERT INTO fiscal_years (label, start_date, end_date, is_active)
VALUES ('2083/84', '2026-07-17', '2027-07-16', TRUE);

INSERT INTO ssf_configs (fiscal_year_id, employee_pct, employer_pct)
SELECT id, 11, 20 FROM fiscal_years WHERE label = '2083/84';

-- Tax slabs (last one open-ended)
INSERT INTO tax_slabs (fiscal_year_id, slab_order, upper_bound, rate_pct)
SELECT fy.id, s.slab_order, s.upper_bound, s.rate_pct
FROM fiscal_years fy
CROSS JOIN (VALUES
  (1, 1000000::numeric,  1),
  (2, 1500000::numeric, 10),
  (3, 2500000::numeric, 20),
  (4, 4000000::numeric, 27),
  (5, NULL::numeric,    29)
) AS s (slab_order, upper_bound, rate_pct)
WHERE fy.label = '2083/84';

-- Placeholder security fund rate
INSERT INTO security_fund_configs (fiscal_year_id, percentage)
SELECT id, 1 FROM fiscal_years WHERE label = '2083/84';

-- Fixed monthly allowances for everyone
INSERT INTO fixed_allowances (name, amount, is_active) VALUES
  ('Stay Allowance', 2000, TRUE),
  ('Transport',      1500, TRUE);

-- Sample employees (demo data)
INSERT INTO employees (name, department, employment_type, basic_pay, joining_date, dummy_bank_acc_no) VALUES
  ('Aarav Shrestha', 'Engineering', 'SSF',     85000,  '2024-03-10', 'NIBL-0010-2231-01'),
  ('Sita Gurung',    'Finance',     'NON_SSF', 60000,  '2025-01-15', 'NABIL-0020-7781-02'),
  ('Bikash Thapa',   'Operations',  'SSF',     45000,  '2026-08-04', 'GBIME-0030-1190-03'),
  ('Priya Karki',    'HR',          'NON_SSF', 150000, '2023-11-01', 'SCBL-0040-5512-04'),
  ('Rohan Adhikari', 'Engineering', 'SSF',     250000, '2022-06-20', 'NICA-0050-3309-05');

INSERT INTO dynamic_allowances (employee_id, name, amount, assigned_at)
SELECT id, 'Team Lead Allowance', 5000, '2026-06-15' FROM employees WHERE name = 'Aarav Shrestha';

INSERT INTO recurring_reimbursements (employee_id, amount, description, started_at)
SELECT id, 1200, 'Internet (work from home)', '2026-07-17' FROM employees WHERE name = 'Priya Karki';

INSERT INTO advances (employee_id, fiscal_year_id, total_amount, monthly_deduction_amount,
                      outstanding_balance, started_pay_period, status)
SELECT e.id, fy.id, 32000, 5000, 32000, '2026-08', 'ACTIVE'
FROM employees e, fiscal_years fy
WHERE e.name = 'Sita Gurung' AND fy.label = '2083/84';

INSERT INTO one_time_reimbursements (employee_id, fiscal_year_id, pay_period, amount, description)
SELECT e.id, fy.id, '2026-09', 3500, 'Field visit expenses'
FROM employees e, fiscal_years fy
WHERE e.name = 'Bikash Thapa' AND fy.label = '2083/84';

INSERT INTO secret_salaries (employee_id, amount, assigned_at)
SELECT id, 20000, '2026-07-01' FROM employees WHERE name = 'Rohan Adhikari';

COMMIT;
