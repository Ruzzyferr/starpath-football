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
    -- Device tokens: an account may be open on up to 5 devices (recover adds one, never rotates the others out).
    CREATE TABLE IF NOT EXISTS account_tokens (
      hash TEXT PRIMARY KEY,
      account TEXT NOT NULL REFERENCES accounts(id),
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS account_tokens_acc ON account_tokens(account, created);
    -- One-time recovery code per account (sha256 of the normalised code).
    CREATE TABLE IF NOT EXISTS recovery (
      account TEXT PRIMARY KEY REFERENCES accounts(id),
      hash TEXT NOT NULL UNIQUE,
      created INTEGER NOT NULL
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
    CREATE INDEX IF NOT EXISTS txns_orig ON txns(store, original_id);
    -- Refund / revoke notices for transactions we have not credited (yet): key = 't:<txn id>' or
    -- 'o:<original id / order id>'. A later credit or recover of a matching receipt gets 410.
    CREATE TABLE IF NOT EXISTS tombstones (
      store TEXT NOT NULL,
      key TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (store, key)
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
    -- acked: 0 open, 1 applied (acked by the app), 2 withdrawn by a refund, 3 voided (diamonds returned).
    CREATE TABLE IF NOT EXISTS grants (
      nonce TEXT PRIMARY KEY,
      account TEXT NOT NULL REFERENCES accounts(id),
      payload TEXT NOT NULL,
      token TEXT NOT NULL,
      at INTEGER NOT NULL,
      acked INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS grants_acc ON grants(account, acked);
    -- Per-account daily counters (ads watched, free diamonds earned), UTC day. Caps only.
    CREATE TABLE IF NOT EXISTS daily (
      account TEXT NOT NULL REFERENCES accounts(id),
      day TEXT NOT NULL,
      key TEXT NOT NULL,
      n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (account, day, key)
    );
    -- Durable per-account counters (a pending physio discount, season x2 eligibility, sandbox totals).
    CREATE TABLE IF NOT EXISTS counters (
      account TEXT NOT NULL REFERENCES accounts(id),
      key TEXT NOT NULL,
      n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (account, key)
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
    CREATE INDEX IF NOT EXISTS audit_at ON audit(at);
    -- Free diamonds and ad diamonds per (hashed) client address /64 and UTC day, across accounts.
    CREATE TABLE IF NOT EXISTS ip_daily (
      key TEXT NOT NULL,
      day TEXT NOT NULL,
      n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, day)
    );
    -- Store notifications already processed (Apple notificationUUID), for dedupe.
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      at INTEGER NOT NULL
    );
    -- Small key/value state (last voided-purchases poll time).
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    -- Why an account owns an entitlement: 'txn:<store>:<txn id>' (a purchase), 'grant:<nonce>' (bought
    -- with diamonds) or 'legacy' (owned before sources were tracked). A refund or void removes only its
    -- own source; the entitlement goes when no source is left.
    CREATE TABLE IF NOT EXISTS entitlement_sources (
      account TEXT NOT NULL REFERENCES accounts(id),
      product TEXT NOT NULL,
      source TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (account, product, source)
    );
    -- Play purchases credited here whose consume / acknowledge failed: retried by a timer until done
    -- (Play refunds an unacknowledged purchase after 3 days). The raw token is needed for the API call
    -- and is deleted with the row.
    CREATE TABLE IF NOT EXISTS finalize_pending (
      token_hash TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      product TEXT NOT NULL,
      account TEXT NOT NULL,
      at INTEGER NOT NULL,
      tries INTEGER NOT NULL DEFAULT 0,
      last INTEGER
    );
    -- AdMob SSV transaction ids already seen (a replayed callback is ignored).
    CREATE TABLE IF NOT EXISTS ssv_txns (
      id TEXT PRIMARY KEY,
      at INTEGER NOT NULL
    );
    -- Newest App Store notification signedDate applied per transaction (refund / reversal ordering).
    CREATE TABLE IF NOT EXISTS note_order (
      key TEXT PRIMARY KEY,
      signed INTEGER NOT NULL
    );
  `)
  // Columns added after the first deployment (live databases are migrated in place).
  addColumn(db, 'accounts', 'deleted', 'INTEGER NOT NULL DEFAULT 0')
  addColumn(db, 'grants', 'ref', 'TEXT')
  addColumn(db, 'ads', 'ref', 'TEXT')
  addColumn(db, 'idem', 'item', 'TEXT')
  // Last time a device token was used (refreshed at most every few hours): stale empty accounts are pruned.
  addColumn(db, 'accounts', 'seen', 'INTEGER NOT NULL DEFAULT 0')
  // A subscription period's expiry, per transaction (a refund of one period recomputes the pass).
  addColumn(db, 'txns', 'expires', 'INTEGER')
  // Diamonds paid for a spend grant (only those can be voided for a refund); NULL for purchases and ads.
  addColumn(db, 'grants', 'price', 'INTEGER')
  // When a free-diamond reference was claimed (old references are pruned). Existing rows count from now.
  if (addColumn(db, 'earn_refs', 'at', 'INTEGER NOT NULL DEFAULT 0')) db.prepare('UPDATE earn_refs SET at = ? WHERE at = 0').run(Date.now())
  // Accounts created before account_tokens existed keep their one secret as a device token.
  // The column is then cleared so a token dropped later (6th device) is not re-added on restart.
  tx(db, () => {
    db.exec("INSERT OR IGNORE INTO account_tokens (hash, account, created) SELECT secret_hash, id, created FROM accounts WHERE secret_hash != '' AND deleted = 0")
    db.exec("UPDATE accounts SET secret_hash = '' WHERE secret_hash != ''")
    // Entitlements from before sources were tracked: derive them from live purchases and open or
    // applied cosmetic grants; whatever is left over is kept as 'legacy' (never removed by a refund).
    db.exec(`INSERT OR IGNORE INTO entitlement_sources (account, product, source, at)
      SELECT e.account, e.product, 'txn:' || t.store || ':' || t.txn_id, e.at FROM entitlements e
      JOIN txns t ON t.account = e.account AND t.product = e.product AND t.revoked = 0
      WHERE NOT EXISTS (SELECT 1 FROM entitlement_sources s WHERE s.account = e.account AND s.product = e.product)`)
    db.exec(`INSERT OR IGNORE INTO entitlement_sources (account, product, source, at)
      SELECT e.account, e.product, 'grant:' || g.nonce, e.at FROM entitlements e
      JOIN grants g ON g.account = e.account AND g.acked IN (0, 1) AND json_extract(g.payload, '$.k') = 'cosmetic' AND json_extract(g.payload, '$.id') = e.product
      WHERE NOT EXISTS (SELECT 1 FROM entitlement_sources s WHERE s.account = e.account AND s.product = e.product)`)
    db.exec(`INSERT OR IGNORE INTO entitlement_sources (account, product, source, at)
      SELECT account, product, 'legacy', at FROM entitlements e
      WHERE NOT EXISTS (SELECT 1 FROM entitlement_sources s WHERE s.account = e.account AND s.product = e.product)`)
  })
  return db
}

function addColumn(db, table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (cols.includes(col)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
  return true
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
