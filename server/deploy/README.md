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
curl -s https://206-189-63-64.sslip.io/v1/health   # {"ok":true,"apple":true,"google":false,"sandbox":"capped"}
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

`/etc/starpath-backup.env` (root, `0600`):

```sh
BACKUP_PASSPHRASE=<long random, also in the password manager>
BACKUP_UPLOAD_CMD='rclone copy "$BACKUP_FILE" offsite:starpath-backups/'
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
- Play RTDN: create a Pub/Sub push subscription to `https://206-189-63-64.sslip.io/v1/google/rtdn?token=<RTDN_TOKEN>`. Voided purchases are also polled every 6 hours when Play is configured.
- AdMob SSV callback: `https://206-189-63-64.sslip.io/v1/admob/ssv`. Then set `REQUIRE_SSV=1`.

## TestFlight

TestFlight purchases are sandbox receipts. In production, set `SANDBOX_POLICY=capped`: sandbox credits are recorded with env `Sandbox` and limited to `SANDBOX_CAP` diamonds and 30 transactions per account, lifetime. Use `SANDBOX_POLICY=off` at public launch, or `testers` with `SANDBOX_TESTERS=<account ids>`.

## fail2ban

Each failed sign-in logs one line, `auth_fail ip=<address> <route>`, to the journal. Filter `/etc/fail2ban/filter.d/starpath.conf`:

```
[Definition]
failregex = auth_fail ip=<HOST> 
journalmatch = _SYSTEMD_UNIT=starpath.service
```

Jail: `[starpath] enabled=true, backend=systemd, maxretry=30, findtime=600, bantime=3600`.

## Retention

The server prunes data once a day:

| Data | Rule |
|---|---|
| Unfinished ad sessions | deleted after 1 day |
| Ad sessions | deleted after 30 days |
| Idempotency records | deleted after 30 days |
| Applied grants | deleted after 30 days |
| Daily counters | deleted after 14 days |
| Audit IPs | replaced by a keyed hash after 30 days |
| Audit rows | deleted after 180 days |

Players can export their data with `GET /v1/account/export` and delete it with `DELETE /v1/account`. Store transactions are kept for refunds, and after a deletion they point at an account that can no longer sign in.

Also watch disk use, for example with a DigitalOcean monitoring alert at 80%.
