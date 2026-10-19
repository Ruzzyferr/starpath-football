# Kickborn site

The marketing site for https://kickborn.swiip.app (starpath.swiip.app is an alias): a full-screen WebGL night stadium (three.js) with a
playable penalty, then the key moments, the career, life off the pitch, fair play, platforms. Turkish at
`/`, English at `/en/`. The real game, built for the browser, at `/play/`.

Design rules and tokens: `DESIGN.md`. Words: `content/copy.json` (TR + EN). The two HTML pages are
generated from `index.template.html` by `scripts/render.mjs` (run by every `dev` and `build`), so they
are complete static pages that read without JavaScript.

```
site/
  index.template.html   page template ({{key}} from content/copy.json)
  content/copy.json     every word on the page, TR and EN
  src/main.ts           page script: entrances, moments device, career slider, penalty HUD, world boot,
                        section anchors for the camera path
  src/world/            three.js world (lazy chunk), one scene the camera travels through:
    index.ts            World: renderer, camera on the path, frame-rate guard, the penalty
    path.ts             camera stops (one per section) and waypoints: sky, penalty spot, touchline,
                        players' tunnel, dressing room, city, back over the stadium, the stars
    stadium.ts          pitch, goals and net, stands with sprite crowd and camera flashes, roofs,
                        floodlight towers with light cones and haze, LED boards, video board (live score)
    figures.ts          low-poly players: jointed rig, shooter idle/run-up/strike, keeper stance/dives
    rooms.ts            tunnel and dressing room (lockers, shirts, tactics board)
    city.ts             night city: lit towers, streets, car lights, billboards with real game screens
    sky.ts              stars and moon
    streak.ts           the strike streak (the identity): a ribbon of light from the boot
    post.ts             post-processing tiers: high (bloom, depth of field, vignette, grain),
                        mid (phones: lighter bloom, vignette, grain), low (reduced motion or low FPS)
  src/penalty.ts        penalty rules (from game/src/game/kick.ts + ai.ts), shared by 3D and fallback
  src/styles.css        all styles (tokens on :root)
  public/media/         real game pictures: in-game frames (TR/EN), store-screen crops, gameplay clip,
                        posters rendered from the 3D scene (no-WebGL fallback), icons, og.jpg
  scripts/build-play.mjs  builds ../game for the web into dist/play
  test/penalty.test.ts  node --test test/penalty.test.ts
# Viewport matrix (phones portrait/landscape, tablets, desktops to 3440, tall monitors): no overflow,
# no text off-screen, no scrim over 60% of the screen, every heading fully visible. Needs a running
# preview; writes screenshots for a subset. Exit 1 on any problem. --lang=en, --nowebgl, --only=WxH,...
npm run build && npm run preview &
node test/viewports.mjs http://localhost:5794/ viewport-shots
```

## Develop

```bash
cd site
npm ci
npm run dev            # http://localhost:5794 (never port 6000)
node --test test/penalty.test.ts
```

## Build

```bash
cd game && npm ci && cd ../site   # /play needs the game's dependencies
npm ci
npm run build:all                  # = npm run build (site -> dist/) + npm run build:play (game -> dist/play/)
```

`npm run build` empties `dist/`, so always run `build:all` (or `build:play` after `build`).

`/play/` is the real game in its `premium` web flavour (`SP_FLAVOR=premium`), not `demo`: the demo
flavour is a kiosk build that wipes the career after 90 s idle and after 15 minutes. On the web the
game's purchase provider is `none` (`game/src/store-iap/service.ts`), so there is no shop, no IAP, no
ads and no request to the shop server; `VITE_SHOP_API` is also set to `https://shop.invalid` as a
second lock. Saves stay in the visitor's browser. The build uses `game/` as it is in the working tree:
rebuild after game changes land.

## Deploy (manual)

Caddy serves `/srv/starpath-site` (see `server/deploy/Caddyfile`). The site goes into the same root as
the legal pages, so the upload must never delete `legal/`, `support.html` or `app-ads.txt`. `dist/`
contains none of those three at its top level, so extracting over the root cannot clobber them. The
upload **does overwrite `index.html`**, which replaces the temporary placeholder page on the server.

From the repo root on your machine (Git Bash):

```bash
# 1. Build
cd site && npm run build:all && cd ..

# 2. Pack and upload the site and the Caddyfile over ssh stdin (/tmp on the server is not writable)
SSH="ssh -i ~/.ssh/starpath_api root@206.189.63.64"
tar -C site/dist -czf kickborn-site.tgz .
$SSH 'mkdir -p /root/deploy && cat > /root/deploy/kickborn-site.tgz' < kickborn-site.tgz
$SSH 'cat > /root/deploy/Caddyfile.new' < server/deploy/Caddyfile
$SSH 'caddy validate --config /root/deploy/Caddyfile.new --adapter caddyfile'

# 3. On the server: back up, swap the old site build (only the files this build owns), extract, reload
$SSH '
  set -e
  stamp=$(date +%Y%m%d-%H%M)
  mkdir -p /root/site-backups
  tar -czf /root/site-backups/starpath-site-$stamp.tgz -C /srv/starpath-site .
  cd /srv/starpath-site
  rm -rf assets en media play favicon.svg   # previous site build only; legal/, support.html, app-ads.txt stay
  tar -xzf /root/deploy/kickborn-site.tgz -C /srv/starpath-site
  chmod -R a+rX /srv/starpath-site
  cp /etc/caddy/Caddyfile /root/site-backups/Caddyfile.$stamp
  cp /root/deploy/Caddyfile.new /etc/caddy/Caddyfile
  systemctl reload caddy
'

# 4. Smoke test
for u in / /en/ /play/ /legal/privacy-tr.html /legal/terms-en.html /support /app-ads.txt /v1/health; do
  printf "%-24s" "$u"; curl -s -o /dev/null -w "%{http_code}\n" "https://kickborn.swiip.app$u"
done
curl -sI https://kickborn.swiip.app/assets/ | head -1   # 404 is fine; hashed files are cached for a year
```

All of the above must return 200 (`/v1/health` 200 when the shop server is up). With rsync (WSL, macOS,
Linux) step 2–3 can instead be:

```bash
rsync -a --delete --exclude '/legal/' --exclude '/support.html' --exclude '/app-ads.txt' \
  -e "ssh -i ~/.ssh/starpath_api" site/dist/ root@206.189.63.64:/srv/starpath-site/
```

(`--exclude` protects those paths from `--delete`; do not add `--delete-excluded`.)

**Rollback:** `tar -xzf /root/site-backups/starpath-site-<stamp>.tgz -C /srv/starpath-site` and copy the
saved `Caddyfile.<stamp>` back, then `systemctl reload caddy`.

### What the Caddyfile does

- `/v1/*` → shop server (unchanged limits; `/v1/apple/notifications` keeps its 128 KB body).
- `/legal/*`, `/support`, `/app-ads.txt` → unchanged.
- Everything else → static files from `/srv/starpath-site` with clean URLs
  (`try_files {path} {path}/index.html {path}.html`).
- `Cache-Control`: `/assets/*` and `/play/assets/*` (content-hashed) one year immutable; `/media/*` one
  week; pages, `/play/sw.js` and manifests `no-cache`.

## Pictures

All pictures are Kickborn's own: live frames captured from the game's highlight player
(`game/match-demo.html`, seed 3), crops of the owner's store screenshots
(the current game build, captured from its dev server at 430×932), one raw gameplay clip recorded from the same player, and
stills rendered from the site's own three.js scene. No external or stock images, so there are no
credits to show.

To re-render the posters after changing the scene: `npm run dev`, open
`/dev/still.html?leg=0` (hero) or `?leg=1` (play) at 1920×1080 / 720×1560 / 1600×900, screenshot, and save
as `public/media/poster-hero.webp`, `poster-hero-phone.webp`, `poster-play.webp`.

Server-side names (`/srv/starpath-site`, `~/.ssh/starpath_api`) predate the Kickborn rename and are kept as they are.

## Brand icon slot

Until the Kickborn key art is chosen, every icon slot carries the wordmark (KICK white over BORN
green on night navy). To swap in the key art, replace these files, keeping names and sizes:

- `public/media/brand/mark-96.png` (favicon), `mark-180.png` (apple-touch-icon), `mark-192.png`,
  `mark-512.png` (square, opaque);
- `public/media/og.jpg` (1200×630, the social card).

The nav and the footer use the text wordmark; add the art next to it in `index.template.html`
(`.wordmark`) if the chosen piece works small.
