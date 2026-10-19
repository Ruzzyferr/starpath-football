# Data Safety and Privacy Label Mapping (DRAFT, verify before submitting)

Derived from `docs/legal/PRIVACY.en.md` and `game/ios/App/App/PrivacyInfo.xcprivacy`. Keep all three consistent. Store forms change; re-check the live questionnaire.

## Google Play: Data safety

| Play data type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| Device or other IDs (advertising ID) | Yes | Yes (Google AdMob) | Advertising | Only with consent where required; Play `AD_ID` permission declared |
| Purchase history | Yes | No | App functionality | Ledger and store transaction ids on our server |
| User IDs (anonymous shop account id) | Yes | Yes (sent to AdMob as the SSV user id) | App functionality, advertising (reward verification) | Random id, no name or e-mail |
| App interactions (rewarded-ad sessions, claims) | Yes | No | App functionality, fraud prevention | |
| Diagnostics (crash logs, performance) | No | No | n/a | Error log is local and opt-in, never sent automatically |
| Location, contacts, photos, audio, health, financial info, name, e-mail | No | n/a | n/a | |

Security section:
- Data encrypted in transit: **Yes** (HTTPS only).
- Users can request data deletion: **Yes** (Settings > Purchases > Shop account > delete; also by e-mail). Provide the hosted privacy URL for the deletion request link.
- Committed to the Play Families policy: No (general audience, not child-directed).

## Apple: App Privacy ("nutrition label")

| Apple data type | Linked to user | Used for tracking | Purpose |
|---|---|---|---|
| Identifiers > Device ID (IDFA) | No | Yes | Third-party advertising |
| Identifiers > User ID (anonymous account) | Yes | No | App functionality |
| Purchases > Purchase history | Yes | No | App functionality |
| Usage data > Product interaction (ad interaction) | No | Yes | Third-party advertising |
| Usage data > Advertising data | No | Yes | Third-party advertising |
| Diagnostics | none declared | | |

`PrivacyInfo.xcprivacy` carries `NSPrivacyTracking = true` with the AdMob tracking domains. ATT prompt is shown before the advertising ID is read. The manifest still lists `OtherDiagnosticData` (not linked, not tracking, app functionality); decide at submission whether that matches the "diagnostics none" answer and remove it from one side.

## app-ads.txt

Template line (replace the publisher id with the real AdMob one):

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Host it at the root of the developer website domain that is listed in the App Store and Google Play store listings, i.e. `https://<developer-domain>/app-ads.txt` (not under a path, plain text, HTTP 200). The domain must be the one in the "Developer website" field of the store listing. Allow a few days for AdMob to crawl it.

## Launch checklist

- [ ] Hosted privacy policy URL (lawyer-reviewed, placeholders [COMPANY]/[ADDRESS]/[CONTACT_EMAIL] filled)
- [ ] Hosted support URL
- [ ] AdMob account created; app ids and rewarded ad unit ids in the build; `app-ads.txt` hosted
- [ ] AdMob SSV callback URL set on the ad unit: `https://206-189-63-64.sslip.io/v1/admob/ssv`
- [ ] Server env `REQUIRE_SSV=1`
- [ ] Google Play service account created, granted to the Play Console, key on the server
- [ ] Play RTDN topic push subscription to `https://206-189-63-64.sslip.io/v1/google/rtdn` with header `X-RTDN-Token`
- [ ] `SANDBOX_POLICY=off`, or only real testers allowed, at public launch
- [ ] Data safety form and App Privacy label filled from the tables above
- [ ] Age rating questionnaires filled (see `AGE-RATING.md`)
- [ ] Legal texts regenerated (`cd game && npm run legal`) and linked in the app
