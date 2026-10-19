# Deploying the shop server

One DigitalOcean droplet (Ubuntu): Caddy terminates TLS and proxies to Node on `127.0.0.1:8787`, which systemd runs as user `starpath`. Firewall: ufw allows 22, 80 and 443 only.

| File | Goes to |
|---|---|
| `Caddyfile` | `/etc/caddy/Caddyfile` |
| `starpath.service` | `/etc/systemd/system/starpath.service` |
| `starpath.env.example` | `/etc/starpath.env` (fill in; `root:starpath`, mode `0640`) |
| `backup.sh` | `/opt/starpath/deploy/backup.sh` |

## First install

```sh
apt install caddy sqlite3 fail2ban
snap install node --classic --channel=24
useradd --system --home /opt/starpath --shell /usr/sbin/nologin starpath
mkdir -p /opt/starpath/data && chown -R starpath:starpath /opt/starpath && chmod 700 /opt/starpath/data
# copy server/ (src/, catalog.json, package.json, deploy/) to /opt/starpath, then:
cp deploy/starpath.service /etc/systemd/system/ && cp deploy/Caddyfile /etc/caddy/Caddyfile
cp deploy/starpath.env.example /etc/starpath.env && chgrp starpath /etc/starpath.env && chmod 640 /etc/starpath.env
systemctl daemon-reload && systemctl enable --now starpath && systemctl reload caddy
curl -s https://206-189-63-64.sslip.io/v1/health   # {"ok":true,"apple":true,"google":false,"sandbox":"capped"} (503 if the DB or disk fails)
```

On first start the server creates `data/grant-key.pem` (Ed25519, signs grants) and `data/grant-pub.pem` (the app embeds the public key). If `shop.db` exists but the key does not, the server refuses to start rather than mint a key no installed app trusts.

### Grant signing keys: backup and rotation

- **Back the grant keys up separately from the database, encrypted.** They are never in the database backups. Once after the first start (and after every rotation), encrypt each key with its own passphrase and keep the result off the droplet (password manager or a second off-site location; not the same bucket as the database backups):

  ```sh
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -pass env:GRANT_KEY_PASSPHRASE -in /opt/starpath/data/grant-key.pem -out grant-key.pem.enc
  ```

  `GRANT_KEY_PASSPHRASE` is a different secret from `BACKUP_PASSPHRASE`, so one leaked passphrase does not give both the data and the signing key.
- Every grant carries `kid`: the first 8 hex digits of sha256 of the raw 32-byte public key. The startup log prints the signing kid (`grant keys signing kid=...`).
- `GET /v1/keys` (no auth) returns `{ kid, keys: [{ kid, alg: "Ed25519", key: <raw public key, base64> }] }`, signing key first.
- Rotation: create a new key (`openssl genpkey -algorithm ed25519 -out /opt/starpath/data/grant-key-2.pem`), ship an app build that trusts both kids, then set `GRANT_KEY_FILES=/opt/starpath/data/grant-key-2.pem,/opt/starpath/data/grant-key.pem` (first signs, the rest stay published) and restart. Open grants older than 60 days are re-signed with the new key when the app calls `POST /v1/inbox/refresh`. Drop the old file from the list once no supported app version needs it.

## Updating

```sh
rsync -a --delete --exclude data/ server/ root@<droplet>:/opt/starpath/   # never touches data/
ssh root@<droplet> 'chown -R starpath:starpath /opt/starpath && systemctl restart starpath'
curl -s https://206-189-63-64.sslip.io/v1/health
```

Schema changes migrate in place at startup (`src/db.mjs`). Before an update, take a backup (below).

## Backups

`backup.sh` uses SQLite's online backup, checks integrity, then gzips and encrypts with `BACKUP_PASSPHRASE` (AES-256, PBKDF2). It keeps the newest 14 copies in `/var/backups/starpath` and runs `BACKUP_UPLOAD_CMD` for the off-site copy.

- `BACKUP_UPLOAD_CMD` is **mandatory**: without it the script exits 1 (no silent droplet-only backups). `BACKUP_LOCAL_ONLY=1` allows a local-only run on a test box.
- `HEALTHCHECK_URL` (optional, recommended): pinged only after a fully successful backup. Point it at a dead-man's switch (for example a healthchecks.io check with a 1-day period and 2-hour grace) so a backup that fails or stops running raises an alert.
- Off-site retention: set a lifecycle rule on the bucket that deletes copies after 30 days. Note the storage provider and region; the privacy policy must name them (processor, retention).

`/etc/starpath-backup.env` (root, `0600`):

```sh
BACKUP_PASSPHRASE=<long random, also in the password manager>
BACKUP_UPLOAD_CMD='rclone copy "$BACKUP_FILE" offsite:starpath-backups/'
HEALTHCHECK_URL=https://hc-ping.com/<uuid>
```

Root crontab:

```
17 3 * * * set -a; . /etc/starpath-backup.env; /opt/starpath/deploy/backup.sh >> /var/log/starpath-backup.log 2>&1
```

## Restore (test it once after setting up)

```sh
set -a; . /etc/starpath-backup.env
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in shop-<stamp>.db.gz.enc | gunzip > /tmp/shop.db
sqlite3 /tmp/shop.db 'PRAGMA integrity_check'          # must print: ok
systemctl stop starpath
mv /opt/starpath/data/shop.db /opt/starpath/data/shop.db.before-restore
rm -f /opt/starpath/data/shop.db-wal /opt/starpath/data/shop.db-shm
install -o starpath -g starpath -m 600 /tmp/shop.db /opt/starpath/data/shop.db
# on a new droplet, also restore the grant key(s) from the encrypted key backup:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:GRANT_KEY_PASSPHRASE -in grant-key.pem.enc -out /tmp/grant-key.pem
#   install -o starpath -g starpath -m 600 /tmp/grant-key.pem /opt/starpath/data/grant-key.pem && shred -u /tmp/grant-key.pem
systemctl start starpath && curl -s https://206-189-63-64.sslip.io/v1/health
```

## Store callbacks

- App Store Server Notifications v2 URL: `https://206-189-63-64.sslip.io/v1/apple/notifications`.
- Play RTDN: create a Pub/Sub push subscription to `https://206-189-63-64.sslip.io/v1/google/rtdn?token=<RTDN_TOKEN>`. The server also accepts the secret in an `X-RTDN-Token` header, which is preferred wherever the sender can set headers; Pub/Sub push cannot, so the query form stays supported, and Caddy drops query strings from its access log. Voided purchases are also polled every 6 hours when Play is configured.
  - A void, cancel or revoke notice is acted on only after Play confirms it (the voided purchases list, or the purchase / subscription no longer being purchased / active); otherwise it is ignored with audit `rtdn_unconfirmed`. When Play does not answer, the push gets `503` and Pub/Sub delivers it again.
  - A Play purchase whose server-side consume / acknowledge failed after the credit is kept in `finalize_pending` and retried every 10 minutes (Play refunds unacknowledged purchases after 3 days). The diamonds stay credited. Rows still failing after 7 days are dropped with audit `finalize_gave_up`; purchases Play now reports cancelled are dropped with `finalize_dropped`.
  - Play not answering (5xx, 429, transport errors, our service account refused with 401/403), and "unknown token" (404) within 10 minutes of the purchase time the app sends, are `503 play_unavailable` (the app retries). Only a definitive "not purchased / cancelled" is `400 invalid_receipt`; a pending purchase is `409 purchase_pending`.
- AdMob SSV callback: `https://206-189-63-64.sslip.io/v1/admob/ssv`. Set `ADMOB_AD_UNITS` to the app's rewarded ad unit ids (comma list; unset = any unit), then `REQUIRE_SSV=1`. Callbacks for another ad unit, with a `timestamp` more than an hour off, or with a `transaction_id` already seen are refused (audit `ad_ssv_rejected`, still answered 200).
- App Store notifications: a refund, revoke or refund-reversal signed before the last one applied to the same purchase (one-time products: original transaction id; subscriptions: per period) is ignored (audit `apple_note_stale`).

## TestFlight

TestFlight purchases are sandbox receipts. In production, set `SANDBOX_POLICY=capped`: sandbox credits are recorded with env `Sandbox` and limited to `SANDBOX_CAP` diamonds and 30 transactions (every product kind: diamonds, cash, Pro, cosmetics) per account, lifetime, and to `SANDBOX_GLOBAL_DAILY` (default 200) sandbox transactions per UTC day across all accounts. Account recovery from a sandbox receipt works only with `on` (development) or for listed `testers`. Use `SANDBOX_POLICY=off` at public launch, or `testers` with `SANDBOX_TESTERS=<account ids>`.

Set `SANDBOX_UNTIL` (ISO date, e.g. `2026-12-01T00:00:00Z`) to the planned launch: after it, `capped` and `testers` behave as `off` without a redeploy (`/v1/health` then reports `"sandbox":"off"`). The startup log warns while `capped` or `testers` is active, and says when the date has passed.

## Refund hold

An account is on refund hold (no diamond spending, no rewarded-ad rewards; store purchases, cash packs included, stay on sale) while its diamond balance is negative, or after 3 refunds (`limits.refundHoldAfter`). The refund-count hold lifts by itself 90 days after the last refund (`limits.refundHoldDays`) if the balance is not negative; the wallet shows `refundHoldUntil`. A further refund puts the account back on hold for another 90 days (the count is kept). Holds from before this rule was deployed have no recorded last-refund time and stay until the next refund.

## Free-diamond limits

- Per account: per-source and daily caps (`catalog.json` `earn`, `limits.earnPerDay`), halved for the first day; achievement diamonds (`first`) stop at 600 per account, lifetime.
- Per client address (IPv4, or IPv6 /64): `limits.ipEarnPerDay` (600) diamonds a day across accounts, counted and enforced only for accounts younger than `limits.ipCapAccountAgeDays` (7) days, so established players behind one carrier NAT address do not starve each other. Each account stopped by it logs one `ip_cap` audit row a day.

## fail2ban

Each failed sign-in logs one line, `auth_fail ip=<address> acct=<first 8 hex of the claimed account id> <route>`, to the journal. Inside the server, more than 60 failures in 10 minutes for one account id prefix answer `429` (and log `auth_flood acct=<prefix>`), whatever the address. Recovery-code attempts are limited per address (5/min), per prefix of the code's hash (5/min) and globally. Filter `/etc/fail2ban/filter.d/starpath.conf`:

```
[Definition]
failregex = auth_fail ip=<HOST> 
journalmatch = _SYSTEMD_UNIT=starpath.service
```

Jail: `[starpath] enabled=true, backend=systemd, maxretry=30, findtime=10m, bantime=15m`. Mobile carriers put many players behind one address (CGNAT), so bans stay short.

## Logs

- Caddy access log (`/var/log/caddy/starpath.log`): client addresses masked to /16 (IPv4) and /32 (IPv6), query strings and secret headers removed, rolled at 10 MiB and deleted after 30 days (`roll_keep_for 720h`).
- journald (server log, fail2ban lines with full addresses): keep 30 days at most. `/etc/systemd/journald.conf`:

  ```
  [Journal]
  MaxRetentionSec=30day
  SystemMaxUse=500M
  ```

  then `systemctl restart systemd-journald`.

## Monitoring

- `GET /v1/health` runs a database query and checks free disk space on `DATA_DIR` (fails below 5% or 100 MB free) and answers `503` when either fails. Register it with an external uptime monitor (for example UptimeRobot or healthchecks.io, every 5 minutes).
- With `X-Ops-Token: <OPS_TOKEN>` the answer also carries `ops`: database and disk status, database size, row counts per table and today's sandbox transactions. Alert on fast growth of `accounts` (registration abuse) and on disk use.
- Registration is limited to 30/min per address and 600/min overall (`REG_PER_MIN`, `REG_GLOBAL_PER_MIN`); the global bucket only smooths floods. Past `limits.regDailyAlert` (5000) registrations in a UTC day the server writes one `register_budget` audit row and log line: alert on it (and on `accounts` growth in the ops rows).

## Retention

The server prunes data once a day:

| Data | Rule |
|---|---|
| Unfinished ad sessions | deleted after 1 day |
| Ad sessions | deleted after 30 days |
| Idempotency records | deleted after 30 days |
| Applied, withdrawn and voided grants | deleted after 30 days |
| Daily counters | deleted after 14 days |
| Per-address daily free-diamond totals (keyed hash of the /64 or IPv4) | deleted after 2 days |
| Empty accounts (0 diamonds, no purchases, entitlements or open grants, unused for 30 days) | deleted with their device tokens, recovery code, counters and claims |
| Free-diamond claim references | deleted after 400 days |
| Ledger references of accounts that never bought anything | removed after 400 days (amounts stay) |
| Store transactions and refund tombstones | kept 7 years (business and tax records), then deleted |
| Audit IPs | replaced by a keyed hash after 30 days |
| Audit rows | deleted after 180 days; `register` rows after 30 days |
| AdMob SSV transaction ids | deleted after 2 days |
| App Store refund ordering (latest signedDate per purchase) | deleted after 400 days |
| Play purchases awaiting consume / acknowledge (`finalize_pending`, holds the purchase token) | deleted when finished, dropped, or after 7 days |

The prune runs in chunks of 2000 rows per statement and yields to the event loop between chunks, so requests keep being served while it runs.

Players can export their data with `GET /v1/account/export` and delete it with `DELETE /v1/account`. Store transactions are kept for refunds (7 years, above), and after a deletion they point at an account that can no longer sign in.

Also watch disk use, for example with a DigitalOcean monitoring alert at 80%.
