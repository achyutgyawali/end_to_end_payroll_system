-- Nepal Payroll schema (loaded automatically on first start)
-- Money is NPR NUMERIC(14,2), percentages NUMERIC(5,2), pay periods 'YYYY-MM'.

BEGIN;

CREATE DOMAIN pay_period AS TEXT
  CHECK (VALUE ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Employees (soft delete only)
CREATE TABLE employees (
  id                SERIAL PRIMARY KEY,
  name              TEXT          NOT NULL CHECK (btrim(name) <> ''),
  department        TEXT          NOT NULL CHECK (btrim(department) <> ''),
  employment_type   TEXT          NOT NULL CHECK (employment_type IN ('SSF', 'NON_SSF')),
  basic_pay         NUMERIC(14,2) NOT NULL CHECK (basic_pay >= 0),
  joining_date      DATE          NOT NULL,
  dummy_bank_acc_no TEXT          NOT NULL CHECK (btrim(dummy_bank_acc_no) <> ''),
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX employees_employment_type_idx ON employees (employment_type) WHERE deleted_at IS NULL;

-- Fiscal years (AD dates, no overlaps, at most one active)
CREATE TABLE fiscal_years (
  id         SERIAL PRIMARY KEY,
  label      TEXT        NOT NULL CHECK (btrim(label) <> ''),
  start_date DATE        NOT NULL,
  end_date   DATE        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_years_label_unique UNIQUE (label),
  CONSTRAINT fiscal_years_valid_range CHECK (end_date > start_date),
  CONSTRAINT fiscal_years_no_overlap EXCLUDE USING gist (daterange(start_date, end_date, '[]') WITH &&)
);

CREATE UNIQUE INDEX fiscal_years_one_active ON fiscal_years (is_active) WHERE is_active;

-- SSF rates per fiscal year
CREATE TABLE ssf_configs (
  id             SERIAL PRIMARY KEY,
  fiscal_year_id INT          NOT NULL REFERENCES fiscal_years (id) ON DELETE CASCADE,
  employee_pct   NUMERIC(5,2) NOT NULL CHECK (employee_pct BETWEEN 0 AND 100),
  employer_pct   NUMERIC(5,2) NOT NULL CHECK (employer_pct BETWEEN 0 AND 100),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ssf_configs_one_per_fiscal_year UNIQUE (fiscal_year_id)
);

-- Tax slabs per fiscal year
CREATE TABLE tax_slabs (
  id             SERIAL PRIMARY KEY,
  fiscal_year_id INT           NOT NULL REFERENCES fiscal_years (id) ON DELETE CASCADE,
  slab_order     INT           NOT NULL CHECK (slab_order > 0),
  upper_bound    NUMERIC(14,2) CHECK (upper_bound > 0),
  rate_pct       NUMERIC(5,2)  NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
  CONSTRAINT tax_slabs_order_unique UNIQUE (fiscal_year_id, slab_order)
);

CREATE UNIQUE INDEX tax_slabs_one_open_ended ON tax_slabs (fiscal_year_id) WHERE upper_bound IS NULL;

-- In-house security fund % per fiscal year (on basic pay)
CREATE TABLE security_fund_configs (
  id             SERIAL PRIMARY KEY,
  fiscal_year_id INT          NOT NULL REFERENCES fiscal_years (id) ON DELETE CASCADE,
  percentage     NUMERIC(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT security_fund_configs_one_per_fiscal_year UNIQUE (fiscal_year_id)
);

-- Fixed allowances (everyone, every month)
CREATE TABLE fixed_allowances (
  id         SERIAL PRIMARY KEY,
  name       TEXT          NOT NULL CHECK (btrim(name) <> ''),
  amount     NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Dynamic allowances (per employee, until stopped)
CREATE TABLE dynamic_allowances (
  id          SERIAL PRIMARY KEY,
  employee_id INT           NOT NULL REFERENCES employees (id),
  name        TEXT          NOT NULL CHECK (btrim(name) <> ''),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  assigned_at DATE          NOT NULL DEFAULT CURRENT_DATE,
  stopped_at  DATE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (stopped_at IS NULL OR stopped_at >= assigned_at)
);

CREATE INDEX dynamic_allowances_employee_idx ON dynamic_allowances (employee_id);

-- Overtime (many entries per month, each with its own multiplier)
CREATE TABLE overtime_entries (
  id          SERIAL PRIMARY KEY,
  employee_id INT          NOT NULL REFERENCES employees (id),
  pay_period  pay_period   NOT NULL,
  hours       NUMERIC(6,2) NOT NULL CHECK (hours > 0 AND hours <= 744),
  multiplier  NUMERIC(4,2) NOT NULL DEFAULT 1.5 CHECK (multiplier > 0),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX overtime_entries_employee_period_idx ON overtime_entries (employee_id, pay_period);

-- One-time reimbursements (single month, one per employee per fiscal year)
CREATE TABLE one_time_reimbursements (
  id             SERIAL PRIMARY KEY,
  employee_id    INT           NOT NULL REFERENCES employees (id),
  fiscal_year_id INT           NOT NULL REFERENCES fiscal_years (id),
  pay_period     pay_period    NOT NULL,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description    TEXT          NOT NULL CHECK (btrim(description) <> ''),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT one_time_reimbursements_one_per_fiscal_year UNIQUE (employee_id, fiscal_year_id)
);

CREATE INDEX one_time_reimbursements_employee_period_idx ON one_time_reimbursements (employee_id, pay_period);

-- Recurring reimbursements (every month until stopped)
CREATE TABLE recurring_reimbursements (
  id          SERIAL PRIMARY KEY,
  employee_id INT           NOT NULL REFERENCES employees (id),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT          NOT NULL CHECK (btrim(description) <> ''),
  started_at  DATE          NOT NULL DEFAULT CURRENT_DATE,
  stopped_at  DATE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (stopped_at IS NULL OR stopped_at >= started_at)
);

CREATE INDEX recurring_reimbursements_employee_idx ON recurring_reimbursements (employee_id);

-- Advances (one per employee per fiscal year, ever)
CREATE TABLE advances (
  id                       SERIAL PRIMARY KEY,
  employee_id              INT           NOT NULL REFERENCES employees (id),
  fiscal_year_id           INT           NOT NULL REFERENCES fiscal_years (id),
  total_amount             NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  monthly_deduction_amount NUMERIC(14,2) NOT NULL CHECK (monthly_deduction_amount > 0),
  outstanding_balance      NUMERIC(14,2) NOT NULL,
  started_pay_period       pay_period    NOT NULL,
  status                   TEXT          NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED')),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT advances_one_per_fiscal_year UNIQUE (employee_id, fiscal_year_id),
  CHECK (monthly_deduction_amount <= total_amount),
  CHECK (outstanding_balance >= 0 AND outstanding_balance <= total_amount),
  CHECK ((status = 'COMPLETED') = (outstanding_balance = 0))
);

-- Secret salary (internal cost tracking only, never paid)
CREATE TABLE secret_salaries (
  id          SERIAL PRIMARY KEY,
  employee_id INT           NOT NULL REFERENCES employees (id),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  assigned_at DATE          NOT NULL DEFAULT CURRENT_DATE,
  revoked_at  DATE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

CREATE UNIQUE INDEX secret_salaries_one_active ON secret_salaries (employee_id) WHERE revoked_at IS NULL;

-- Payslips (one per employee per month, immutable snapshot)
CREATE TABLE payslips (
  id                  SERIAL PRIMARY KEY,
  employee_id         INT           NOT NULL REFERENCES employees (id),
  pay_period          pay_period    NOT NULL,
  fiscal_year_id      INT           NOT NULL REFERENCES fiscal_years (id),
  fiscal_year_label   TEXT          NOT NULL,

  -- Employee snapshot at generation time
  employee_name       TEXT          NOT NULL,
  department          TEXT          NOT NULL,
  employment_type     TEXT          NOT NULL CHECK (employment_type IN ('SSF', 'NON_SSF')),
  basic_pay           NUMERIC(14,2) NOT NULL,
  joining_date        DATE          NOT NULL,
  dummy_bank_acc_no   TEXT          NOT NULL,

  -- Itemized breakdowns (see services/payrollCalculator.js for the shape)
  earnings            JSONB         NOT NULL,
  deductions          JSONB         NOT NULL,

  gross_earnings      NUMERIC(14,2) NOT NULL,
  total_deductions    NUMERIC(14,2) NOT NULL,
  net_pay             NUMERIC(14,2) NOT NULL,

  -- employer cost, admin only
  ssf_employer_pct    NUMERIC(5,2),
  ssf_employer_amount NUMERIC(14,2) NOT NULL DEFAULT 0,

  generated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT payslips_one_per_period UNIQUE (employee_id, pay_period),
  CHECK (net_pay = gross_earnings - total_deductions)
);

CREATE INDEX payslips_pay_period_idx ON payslips (pay_period);
CREATE INDEX payslips_employment_type_idx ON payslips (employment_type);

-- Payslips can never be updated or deleted
CREATE FUNCTION payslips_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Payslips are immutable: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER payslips_immutable
  BEFORE UPDATE OR DELETE ON payslips
  FOR EACH ROW EXECUTE FUNCTION payslips_block_mutation();

-- A new payslip must be for the month right after the employee's latest one
CREATE FUNCTION payslips_enforce_forward_only() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  latest pay_period;
  expected TEXT;
BEGIN
  SELECT max(pay_period) INTO latest FROM payslips WHERE employee_id = NEW.employee_id;
  IF latest IS NOT NULL THEN
    expected := to_char(to_date(latest || '-01', 'YYYY-MM-DD') + INTERVAL '1 month', 'YYYY-MM');
    IF NEW.pay_period <> expected THEN
      RAISE EXCEPTION 'Payslips are forward-only: next period for employee % is %, got %',
        NEW.employee_id, expected, NEW.pay_period
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payslips_forward_only
  BEFORE INSERT ON payslips
  FOR EACH ROW EXECUTE FUNCTION payslips_enforce_forward_only();

COMMIT;
