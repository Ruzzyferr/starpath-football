#!/usr/bin/env bash
# Consistent, encrypted backup of the shop database, kept locally (last $KEEP) and pushed off-site.
#   BACKUP_PASSPHRASE=… /opt/starpath/deploy/backup.sh
# Run daily as root (cron or a systemd timer, see README.md). Exits non-zero on any failure.
set -euo pipefail

DATA_DIR=${DATA_DIR:-/opt/starpath/data}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/starpath}
KEEP=${KEEP:-14}
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE (e.g. in /etc/starpath-backup.env, mode 0600)}"

umask 077
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Online backup API: consistent even while the server writes (WAL mode).
sqlite3 "$DATA_DIR/shop.db" ".backup '$tmp/shop.db'"
[ "$(sqlite3 "$tmp/shop.db" 'PRAGMA integrity_check')" = "ok" ] || { echo "integrity check failed" >&2; exit 1; }

out="$BACKUP_DIR/shop-$stamp.db.gz.enc"
gzip -9 -c "$tmp/shop.db" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$out"

# Off-site copy. The grant key (grant-key.pem) is NOT in this backup: it is kept separately
# (offline, see README.md), so a stolen backup cannot mint grants.
# Example: BACKUP_UPLOAD_CMD='rclone copy "$BACKUP_FILE" b2:starpath-backups/'
if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
  BACKUP_FILE="$out" bash -c "$BACKUP_UPLOAD_CMD"
else
  echo "warning: BACKUP_UPLOAD_CMD not set, backup is on this droplet only" >&2
fi

# Keep the newest $KEEP local copies.
ls -1t "$BACKUP_DIR"/shop-*.db.gz.enc | tail -n +$((KEEP + 1)) | xargs -r rm -f --
echo "backup ok: $out ($(du -h "$out" | cut -f1))"
