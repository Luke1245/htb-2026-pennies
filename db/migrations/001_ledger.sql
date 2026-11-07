-- Pennies ledger.
-- `users` is used because USER is a reserved word and cannot be an unquoted table name.
-- amount is signed: negative money leaves the account, positive money arrives.
-- Accounts are cash or bank. Credit cards are not accounts in this ledger.

CREATE TABLE users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_auth_subject_trimmed CHECK (
    auth_subject = btrim(auth_subject) AND length(auth_subject) > 0
  ),
  CONSTRAINT users_email_trimmed CHECK (
    email IS NULL OR (email = lower(btrim(email)) AND length(email) > 0)
  ),
  CONSTRAINT users_display_name_trimmed CHECK (
    display_name = btrim(display_name) AND length(display_name) > 0
  )
);

CREATE UNIQUE INDEX users_email_key ON users (email) WHERE email IS NOT NULL;

CREATE TABLE account (
  account_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_user_account_key UNIQUE (user_id, account_id),
  CONSTRAINT account_kind_check CHECK (kind IN ('cash', 'bank')),
  CONSTRAINT account_name_trimmed CHECK (
    name = btrim(name) AND length(name) > 0
  ),
  CONSTRAINT account_currency_code_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX account_user_name_key ON account (user_id, lower(name));

CREATE TABLE category (
  category_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT category_user_category_key UNIQUE (user_id, category_id),
  CONSTRAINT category_name_trimmed CHECK (
    name = btrim(name) AND length(name) > 0
  )
);

CREATE UNIQUE INDEX category_user_name_key ON category (user_id, lower(name));

CREATE TABLE payee (
  payee_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payee_user_payee_key UNIQUE (user_id, payee_id),
  CONSTRAINT payee_name_trimmed CHECK (
    name = btrim(name) AND length(name) > 0
  )
);

CREATE UNIQUE INDEX payee_user_name_key ON payee (user_id, lower(name));

CREATE TABLE transaction (
  transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL,
  category_id BIGINT,
  payee_id BIGINT,
  amount NUMERIC(19, 4) NOT NULL,
  occurred_on DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transaction_user_account_fk
    FOREIGN KEY (user_id, account_id)
    REFERENCES account (user_id, account_id)
    ON DELETE RESTRICT,
  CONSTRAINT transaction_user_category_fk
    FOREIGN KEY (user_id, category_id)
    REFERENCES category (user_id, category_id)
    ON DELETE SET NULL (category_id),
  CONSTRAINT transaction_user_payee_fk
    FOREIGN KEY (user_id, payee_id)
    REFERENCES payee (user_id, payee_id)
    ON DELETE SET NULL (payee_id),
  CONSTRAINT transaction_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT transaction_notes_trimmed CHECK (
    notes IS NULL OR (notes = btrim(notes) AND length(notes) > 0)
  )
);

CREATE INDEX transaction_user_occurred_idx
  ON transaction (user_id, occurred_on DESC, transaction_id DESC);

CREATE INDEX transaction_account_occurred_idx
  ON transaction (account_id, occurred_on DESC);

CREATE INDEX transaction_user_account_idx
  ON transaction (user_id, account_id);

CREATE INDEX transaction_user_category_idx
  ON transaction (user_id, category_id);

CREATE INDEX transaction_user_payee_idx
  ON transaction (user_id, payee_id);

-- Remove a user's transactions before their accounts, so account deletes stay restricted
-- while deleting the user still clears the ledger.
CREATE FUNCTION delete_owned_transactions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM transaction
  WHERE user_id = OLD.user_id;

  RETURN OLD;
END;
$$;

CREATE TRIGGER users_delete_transactions
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION delete_owned_transactions();

CREATE FUNCTION set_transaction_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER transaction_set_updated_at
  BEFORE UPDATE ON transaction
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_updated_at();
