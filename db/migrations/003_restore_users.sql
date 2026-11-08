-- Restore the users table dropped by 002.
--
-- 002 treated 001's schema as dead weight and dropped it, including `users`.
-- That table is the durable record tying an Auth0 subject (auth_subject)
-- to a Pennies identity (user_id, email, display_name) and must persist.
-- Nothing in the backend's model schema (user_sub-keyed tables) references
-- it, so it stands alone; recreate it exactly as 001 defined it.
--
-- 001's delete_owned_transactions trigger is NOT restored: it referenced
-- 001's `transaction` table, which no longer exists.

CREATE TABLE IF NOT EXISTS users (
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

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
  ON users (email) WHERE email IS NOT NULL;
