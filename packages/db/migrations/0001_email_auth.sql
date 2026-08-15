CREATE TABLE IF NOT EXISTS pending_registrations (
  email text PRIMARY KEY,
  name text NOT NULL,
  password_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id text PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('registration', 'password_reset', 'password_change')),
  email text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  request_ip_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_challenges_target_idx
  ON auth_challenges(purpose, email, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_challenges_ip_idx
  ON auth_challenges(request_ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_challenges_user_idx ON auth_challenges(user_id);
