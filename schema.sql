CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_otps (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,              -- bcrypt でハッシュ化した OTP
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps (email, created_at DESC);

-- セッションテーブルは connect-pg-simple が自動作成します (createTableIfMissing: true)
