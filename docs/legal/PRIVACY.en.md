# StarPath Football Privacy Policy

<!-- A lawyer review of this text is recommended before wide release. -->

Last updated: 19 October 2026 · Version 1.0

## 1. In short

- The game is free to play. Your **career and saves stay on your device**.
- Nothing is sent to our server until you open the store, watch an optional rewarded ad, or buy something. When an ad is requested, the Google AdMob SDK contacts Google.
- Opening the store, watching a rewarded ad or buying creates an **anonymous shop account** on our server (a random id and a hashed secret). It holds your diamond balance and purchase records. It does not hold your name, e-mail or career.
- Purchases are processed by Apple or Google; we never see card data.
- Optional **rewarded ads** come from Google AdMob. Declining ad tracking never costs you a reward.
- We do not sell your data and we do not run analytics SDKs.

## 2. Controller

Rüzgar Emir Bulut (individual developer, trading as "StarPath Football"), Istanbul, Türkiye, contact: info@swiip.app. (GDPR Art. 13 / KVKK Art. 10 notice.)

## 3. What data, where, why

| Data | Where it lives | Purpose and lawful basis | Leaves the device? |
|---|---|---|---|
| Career saves (character name, progress), settings, hints, key bindings | On-device storage | Continue where you left off | No (if you enable Steam Cloud, Steam's terms apply) |
| Error log | Local storage; **only if you turn it on in Settings** | Copy a report and send it to us yourself | No; never sent automatically |
| Anonymous shop account: random account id, hashed secret | Our server, created when you first open the store, watch a rewarded ad or buy | Run the shop and recover your balance (contract) | Yes, to our server |
| Diamond balance, purchase ledger, store transaction ids and receipts, subscription state | Our server | Deliver what you bought, refund and fraud handling (contract; legitimate interest) | Yes |
| Rewarded-ad sessions, daily counters, free-diamond claims | Our server | Pay ad rewards once and apply fair-use limits (legitimate interest) | Yes |
| Signed grants (diamond spends applied to your career) | Our server and your save | Prove a spend was paid for once (contract) | Yes |
| Audit log with IP addresses; authentication-failure logs and fail2ban | Our server | Security and fraud prevention. Audit-log IPs are hashed after 30 days; auth-failure logs and fail2ban keep full IP addresses for up to 30 days (legitimate interest) | Yes |
| Web server and system logs (masked IP addresses) | Our server | Operate and secure the service (legitimate interest) | Yes |
| Encrypted backups of the server data | Off-site storage | Recover from failure (legitimate interest) | Yes |
| Birth year asked by the casino and the shop | On-device storage only | Age gate for the casino and cash purchases | No |
| Advertising ID / IDFA, ad requests | Google AdMob | Show rewarded ads. Advertising ID only with your ATT permission on iOS; in the EU/UK only after your consent in Google's consent form (UMP). Personalised ads rely on consent | Yes, to Google |
| Payment data | Apple App Store / Google Play | Payment and receipts | Between you and the store; we receive only transaction ids and receipts |

Our account id is sent to Google as the ad verification user id so a reward can be matched to its ad. Our own app collects no special-category data, precise location, contacts, camera or microphone. The Google AdMob SDK may itself collect device and diagnostic information, an approximate (coarse) location derived from your IP address, and the advertising ID (with your consent / ATT permission). The age flag (under or over 18, not your birth year) is sent to Google AdMob to restrict personalised ads.

## 4. Hosting and transfers

The server runs at DigitalOcean in Frankfurt (EU). Google (AdMob) and Apple process data under their own privacy policies and may transfer data outside the EEA under their safeguards. For users in Turkey, transfers abroad (Google AdMob; DigitalOcean in Frankfurt, EU) rely on your explicit consent (for ads, given in the consent form) and on standard contractual clauses with the provider, in line with KVKK Art. 9.

## 5. Retention and deletion

- IP addresses in the audit log are hashed after 30 days and deleted after 180 days. Authentication-failure logs and fail2ban keep full IP addresses for up to 30 days for security.
- The web server and system logs keep masked IP addresses for at most 30 days.
- Backups are encrypted and kept for 14 days at an off-site EU object-storage provider chosen by the operator.
- Ledger and earn records of accounts without purchases are pseudonymised after 400 days. Store transaction records are kept for 7 years because of tax and refund law; when an account is deleted, only a stub (a random id, no personal data) is kept with those store transactions for 7 years. Inactive accounts with an empty balance are deleted after 30 days.
- The birth year asked by the casino and the shop is stored only on your device and never sent to us.
- On-device data stays until you delete it (Settings > Data) or uninstall the app.
- **Export and deletion:** in Settings > Purchases > Shop account, "Export my shop data" downloads a JSON copy of your shop data, and you can delete your shop account in the same place (this calls `DELETE /v1/account`). Deleting the account removes your balance; unused diamonds cannot be refunded after deletion except where law requires.
- **Ad consent:** you can change your rewarded-ad consent in Settings > Ad privacy choices (EU/UK).

## 6. Children and the casino

The game is for a general audience; ads and purchases are for adults or with a parent's store approval. We do not knowingly collect children's data. Casino mini-games use in-game money, which can be bought with real money but can never be cashed out or won back as real money or prizes; they are closed to young characters and subject to the age rating.

## 7. Your rights (GDPR / KVKK Art. 11)

You may ask whether data is processed and request access, correction, erasure, restriction, portability, or object to processing; you may withdraw consent for personalised ads at any time (iOS Settings > Privacy > Tracking, Android ad settings, or Google's consent form). Contact info@swiip.app. You may complain to your supervisory authority (in Turkey, the Personal Data Protection Board, KVKK).

## 8. Deletion request

To delete your shop account and its data, go to Settings > Purchases > Shop account > Delete, or e-mail info@swiip.app and we will handle the request. Data stored only on your device can be removed in Settings > Data or by uninstalling the app.

## 9. Changes

If this policy changes, this page and the in-app link are updated; significant changes are announced in release notes.
