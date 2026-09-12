PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL CHECK (category IN ('資産', '負債', '収益', '費用')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_date TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('売上', '仕入', '経費', '入金', '出金', 'その他')),
  amount           INTEGER NOT NULL CHECK (amount > 0),
  payment_method   TEXT NOT NULL,
  account_id       INTEGER NOT NULL REFERENCES accounts(id),
  partner_name     TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  memo             TEXT NOT NULL DEFAULT '',
  is_deleted       INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journals (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id     INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
  journal_date       TEXT NOT NULL,
  debit_account_id   INTEGER NOT NULL REFERENCES accounts(id),
  debit_amount       INTEGER NOT NULL CHECK (debit_amount > 0),
  credit_account_id  INTEGER NOT NULL REFERENCES accounts(id),
  credit_amount      INTEGER NOT NULL CHECK (credit_amount > 0),
  description        TEXT NOT NULL DEFAULT '',
  is_deleted         INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  CHECK (debit_amount = credit_amount)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_active ON transactions(is_deleted, transaction_date);
CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(journal_date);
