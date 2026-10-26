-- 002: user accounts, login sessions, and task ownership.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored lower-cased by the API; the CHECK keeps the database honest too.
  email         TEXT NOT NULL CHECK (email = lower(email) AND char_length(email) <= 254),
  -- Argon2id hash in PHC string format ($argon2id$v=19$m=...). Never the password itself.
  password_hash TEXT NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);

-- One row per signed-in browser. The cookie holds a random token; only its
-- SHA-256 hash is stored, so a leaked database cannot be used to hijack sessions.
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- Every task belongs to exactly one user.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE CASCADE;

-- Tasks created before accounts existed have no owner, so no one could ever reach
-- them through the API. Remove them so the column can be made mandatory.
-- (To keep old rows instead, assign them to a user before running this migration.)
DELETE FROM tasks WHERE user_id IS NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;

-- Every query filters by owner first; these indexes serve the list and stats queries.
DROP INDEX IF EXISTS tasks_status_idx;
DROP INDEX IF EXISTS tasks_assignee_idx;
DROP INDEX IF EXISTS tasks_created_idx;
CREATE INDEX IF NOT EXISTS tasks_user_status_idx  ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS tasks_user_created_idx ON tasks (user_id, created_at DESC);
