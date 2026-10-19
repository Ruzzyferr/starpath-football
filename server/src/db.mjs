// SQLite store (node:sqlite, built into Node 24). One file, WAL, every money change in a transaction.
import { DatabaseSync } from 'node:sqlite'

export function openDb(file) {
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      created INTEGER NOT NULL,
      gems INTEGER NOT NULL DEFAULT 0,
      starter INTEGER NOT NULL DEFAULT 0,
      pass_until INTEGER NOT NULL DEFAULT 0,
      pass_claim_day TEXT,
      banned INTEGER NOT NULL DEFAULT 0,
      platform TEXT
    );
    CREATE TABLE IF NOT EXISTS entitlements (
      account TEXT NOT NULL REFERENCES accounts(id),
      product TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (account, product)
    );
    -- One row per store transaction: a receipt can never be credited twice (replay).
    CREATE TABLE IF NOT EXISTS txns (
      store TEXT NOT NULL,
      txn_id TEXT NOT NULL,
      original_id TEXT,
      account TEXT NOT NULL REFERENCES accounts(id),
      product TEXT NOT NULL,
      env TEXT,
      at INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (store, txn_id)
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT NOT NULL REFERENCES accounts(id),
      delta INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      why TEXT NOT NULL,
      ref TEXT,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ledger_acc ON ledger(account, id);
    -- Signed grants waiting for the client to apply to its career (gear, cash, physio, boosts).
    CREATE TABLE IF NOT EXISTS grants (
      nonce TEXT PRIMARY KEY,
      account TEXT NOT NULL REFERENCES accounts(id),
      payload TEXT NOT NULL,
      token TEXT NOT NULL,
      at INTEGER NOT NULL,
      acked INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS grants_acc ON grants(account, acked);
    -- Per-account daily counters (ads watched, free diamonds earned), UTC day.
    CREATE TABLE IF NOT EXISTS daily (
      account TEXT NOT NULL REFERENCES accounts(id),
      day TEXT NOT NULL,
      key TEXT NOT NULL,
      n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (account, day, key)
    );
    -- Rewarded ad sessions: started → completed once (nonce), optionally confirmed by AdMob SSV.
    CREATE TABLE IF NOT EXISTS ads (
      nonce TEXT PRIMARY KEY,
      account TEXT NOT NULL REFERENCES accounts(id),
      offer TEXT NOT NULL,
      started INTEGER NOT NULL,
      ssv INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0
    );
    -- Free-diamond claims are deduplicated by their in-game reference.
    CREATE TABLE IF NOT EXISTS earn_refs (
      account TEXT NOT NULL REFERENCES accounts(id),
      ref TEXT NOT NULL,
      PRIMARY KEY (account, ref)
    );
    -- Idempotency: a retried request returns the first answer instead of charging twice.
    CREATE TABLE IF NOT EXISTS idem (
      account TEXT NOT NULL,
      key TEXT NOT NULL,
      response TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (account, key)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      account TEXT,
      ip TEXT,
      event TEXT NOT NULL,
      detail TEXT
    );
  `)
  return db
}

/** Runs fn inside BEGIN IMMEDIATE … COMMIT (ROLLBACK on throw). */
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
