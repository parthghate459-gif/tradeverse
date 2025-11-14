CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  virtual_balance BIGINT NOT NULL,
  target_pct NUMERIC(6,3) NOT NULL,
  max_drawdown_pct NUMERIC(6,3) NOT NULL,
  price_inr INTEGER NOT NULL,
  payout_cap INTEGER DEFAULT 5000,
  duration_days INTEGER DEFAULT 30,
  payment_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  challenge_id UUID REFERENCES challenges(id),
  account_login TEXT UNIQUE NOT NULL,
  virtual_balance BIGINT NOT NULL,
  current_equity NUMERIC NOT NULL,
  peak_equity NUMERIC NOT NULL,
  profit_pct NUMERIC(8,4) DEFAULT 0,
  drawdown_pct NUMERIC(8,4) DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  seed TEXT,
  start_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_challenge_id UUID REFERENCES user_challenges(id),
  side TEXT NOT NULL,
  symbol TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  status TEXT DEFAULT 'OPEN',
  pnl NUMERIC DEFAULT 0,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_challenge_id UUID REFERENCES user_challenges(id),
  user_id UUID REFERENCES users(id),
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT now()
);
