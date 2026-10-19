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

On first start the server creates `data/grant-key.pem` (Ed25519, signs grants) and `data/grant-pub.pem` (the app embeds the public key). **Copy `grant-key.pem` off the droplet once, into the password manager.** It is never in the database backups. If `shop.db` exists but the key does not, the server refuses to start rather than mint a key no installed app trusts.

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
# on a new droplet, also restore the grant key from the password manager:
#   install -o starpath -g starpath -m 600 grant-key.pem /opt/starpath/data/grant-key.pem
systemctl start starpath && curl -s https://206-189-63-64.sslip.io/v1/health
```

## Store callbacks

- App Store Server Notifications v2 URL: `https://206-189-63-64.sslip.io/v1/apple/notifications`.
- Play RTDN: create a Pub/Sub push subscription to `https://206-189-63-64.sslip.io/v1/google/rtdn?token=<RTDN_TOKEN>`. The server also accepts the secret in an `X-RTDN-Token` header, which is preferred wherever the sender can set headers; Pub/Sub push cannot, so the query form stays supported, and Caddy drops query strings from its access log. Voided purchases are also polled every 6 hours when Play is configured.
- AdMob SSV callback: `https://206-189-63-64.sslip.io/v1/admob/ssv`. Then set `REQUIRE_SSV=1`.

## TestFlight

TestFlight purchases are sandbox receipts. In production, set `SANDBOX_POLICY=capped`: sandbox credits are recorded with env `Sandbox` and limited to `SANDBOX_CAP` diamonds and 30 transactions (every product kind: diamonds, cash, Pro, cosmetics) per account, lifetime, and to `SANDBOX_GLOBAL_DAILY` (default 200) sandbox transactions per UTC day across all accounts. Account recovery from a sandbox receipt works only with `on` (development) or for listed `testers`. Use `SANDBOX_POLICY=off` at public launch, or `testers` with `SANDBOX_TESTERS=<account ids>`.

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
- Registration is limited to 30/min per address and 120/min overall (`REG_PER_MIN`, `REG_GLOBAL_PER_MIN`).

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
| Audit rows | deleted after 180 days |

Players can export their data with `GET /v1/account/export` and delete it with `DELETE /v1/account`. Store transactions are kept for refunds (7 years, above), and after a deletion they point at an account that can no longer sign in.

Also watch disk use, for example with a DigitalOcean monitoring alert at 80%.
