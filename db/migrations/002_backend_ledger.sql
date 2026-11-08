-- Align the database with the backend-owned ledger schema on main.
--
-- Migration 001 created an unused, incompatible schema (singular table names,
-- a users table, surrogate-key foreign keys, payee/category tables, DATE-only
-- timestamps). The backend on main (backend/pennies/models.py) instead keys
-- every row to the Auth0 subject (`user_sub`), uses plural table names, UUID
-- primary keys, NUMERIC(14,2) money, and timestamptz occurred_at. Nothing has
-- ever written to the 001 schema in production, so it is dropped and replaced
-- rather than migrated row-by-row.
--
-- Tables created here mirror Base.metadata in backend/pennies/models.py
-- exactly: names, columns, types, nullability, uniqueness, and indexes.
-- The backend declares no foreign keys, so none are added here.
-- CREATEs are IF NOT EXISTS because a live database may already hold these
-- tables: the backend's ensure_schema() runs Base.metadata.create_all on
-- startup. Where that happened, this migration is a no-op and existing data
-- is preserved; on a fresh database it builds the full schema.

-- Tear down the 001 schema.
DROP TRIGGER IF EXISTS users_delete_transactions ON users;
DROP TRIGGER IF EXISTS transaction_set_updated_at ON transaction;
DROP FUNCTION IF EXISTS delete_owned_transactions();
DROP FUNCTION IF EXISTS set_transaction_updated_at();
DROP TABLE IF EXISTS transaction;
DROP TABLE IF EXISTS payee;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS users;

-- Accounts: a user-owned place money is held, with its opening balance.
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  user_sub VARCHAR(128) NOT NULL,
  name VARCHAR(80) NOT NULL,
  opening_balance NUMERIC(14, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_accounts_user_sub ON accounts (user_sub);

-- Transactions: signed movements of money, including transfer and adjustment kinds.
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_sub VARCHAR(128) NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  category VARCHAR(40) NOT NULL,
  vendor VARCHAR(120),
  note VARCHAR(500),
  occurred_at TIMESTAMPTZ NOT NULL,
  kind VARCHAR(20) NOT NULL,
  transfer_id UUID,
  category_source VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS ix_transactions_user_sub ON transactions (user_sub);
CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions (account_id);
CREATE INDEX IF NOT EXISTS ix_transactions_occurred_at ON transactions (occurred_at);

-- Monthly budgets: one spending limit per user per calendar month.
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id UUID PRIMARY KEY,
  user_sub VARCHAR(128) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  CONSTRAINT monthly_budgets_user_sub_year_month_key UNIQUE (user_sub, year, month)
);

CREATE INDEX IF NOT EXISTS ix_monthly_budgets_user_sub ON monthly_budgets (user_sub);

-- Subscriptions: monthly outflows logged apart from ordinary transactions.
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY,
  user_sub VARCHAR(128) NOT NULL,
  name VARCHAR(120) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_subscriptions_user_sub ON subscriptions (user_sub);

-- Sharing preferences: the user's AI sharing mode (raw or sanitised).
CREATE TABLE IF NOT EXISTS sharing_preferences (
  user_sub VARCHAR(128) PRIMARY KEY,
  mode VARCHAR(20) NOT NULL
);

-- Financial portraits and their derived content.
CREATE TABLE IF NOT EXISTS portraits (
  id UUID PRIMARY KEY,
  user_sub VARCHAR(128) NOT NULL UNIQUE,
  sharing_mode VARCHAR(20) NOT NULL,
  reading TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_portraits_user_sub ON portraits (user_sub);

CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY,
  portrait_id UUID NOT NULL,
  kind VARCHAR(20) NOT NULL,
  description TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_habits_portrait_id ON habits (portrait_id);

CREATE TABLE IF NOT EXISTS educations (
  id UUID PRIMARY KEY,
  portrait_id UUID NOT NULL,
  subject VARCHAR(160) NOT NULL,
  guide_id VARCHAR(80),
  body TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_educations_portrait_id ON educations (portrait_id);

CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY,
  portrait_id UUID NOT NULL,
  education_id UUID NOT NULL,
  body TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_suggestions_portrait_id ON suggestions (portrait_id);
CREATE INDEX IF NOT EXISTS ix_suggestions_education_id ON suggestions (education_id);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY,
  portrait_id UUID NOT NULL,
  position INTEGER NOT NULL,
  kind VARCHAR(20) NOT NULL,
  guide_id VARCHAR(80),
  resource_id VARCHAR(80),
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_recommendations_portrait_id ON recommendations (portrait_id);
