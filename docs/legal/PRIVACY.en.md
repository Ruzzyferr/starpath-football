# StarPath Football Privacy Policy

> **DRAFT: legal review required (TASLAK — hukuki inceleme gerekli).** Do not publish before a lawyer has reviewed it. Bracketed fields must be filled in.

Last updated: [DATE] · Version: draft 0.2

## 1. In short

- The game is free to play. Your **career and saves stay on your device**.
- A player who never opens the store sends nothing to our server.
- Opening the store creates an **anonymous shop account** on our server (a random id and a hashed secret). It holds your diamond balance and purchase records. It does not hold your name, e-mail or career.
- Purchases are processed by Apple or Google; we never see card data.
- Optional **rewarded ads** come from Google AdMob. Declining ad tracking never costs you a reward.
- We do not sell your data and we do not run analytics SDKs.

## 2. Controller

[COMPANY], [ADDRESS], contact: [CONTACT_EMAIL]. (GDPR Art. 13 / KVKK Art. 10 notice.)

## 3. What data, where, why

| Data | Where it lives | Purpose and lawful basis | Leaves the device? |
|---|---|---|---|
| Career saves (character name, progress), settings, hints, key bindings | On-device storage | Continue where you left off | No (if you enable Steam Cloud, Steam's terms apply) |
| Error log | Local storage; **only if you turn it on in Settings** | Copy a report and send it to us yourself | No; never sent automatically |
| Anonymous shop account: random account id, hashed secret | Our server, created when you first open the store | Run the shop and recover your balance (contract) | Yes, to our server |
| Diamond balance, purchase ledger, store transaction ids and receipts, subscription state | Our server | Deliver what you bought, refund and fraud handling (contract; legitimate interest) | Yes |
| Rewarded-ad sessions, daily counters, free-diamond claims | Our server | Pay ad rewards once and apply fair-use limits (legitimate interest) | Yes |
| Signed grants (diamond spends applied to your career) | Our server and your save | Prove a spend was paid for once (contract) | Yes |
| Audit log with IP addresses | Our server | Security and fraud prevention (legitimate interest) | Yes |
| Web server and system logs (masked IP addresses) | Our server | Operate and secure the service (legitimate interest) | Yes |
| Encrypted backups of the server data | Off-site storage | Recover from failure (legitimate interest) | Yes |
| Birth year asked by the casino and the shop | On-device storage only | Age gate for the casino and cash purchases | No |
| Advertising ID / IDFA, ad requests | Google AdMob | Show rewarded ads. Advertising ID only with your ATT permission on iOS; in the EU/UK only after your consent in Google's consent form (UMP). Personalised ads rely on consent | Yes, to Google |
| Payment data | Apple App Store / Google Play | Payment and receipts | Between you and the store; we receive only transaction ids and receipts |

Our account id is sent to Google as the ad verification user id so a reward can be matched to its ad. We do not collect special-category data, location, contacts, camera or microphone.

## 4. Hosting and transfers

The server runs at DigitalOcean in Frankfurt (EU). Google and Apple process data under their own privacy policies and may transfer data outside the EEA under their safeguards.

## 5. Retention and deletion

- IP addresses in the audit log are hashed after 30 days and deleted after 180 days.
- The web server and system logs keep masked IP addresses for at most 30 days.
- Backups are encrypted, kept off-site and retained for 14 days.
- Ledger and earn records of accounts without purchases are anonymised after 400 days. Store transaction records are kept for 7 years because of tax and refund law. Inactive accounts with an empty balance are deleted after 30 days.
- The birth year asked by the casino and the shop is stored only on your device and never sent to us.
- On-device data stays until you delete it (Settings > Data) or uninstall the app.
- **Export and deletion:** in Settings > Purchases > Shop account, "Export my shop data" downloads a JSON copy of your shop data, and you can delete your shop account in the same place (this calls `DELETE /v1/account`). Deleting the account removes your balance; unused diamonds cannot be refunded after deletion except where law requires.
- **Ad consent:** you can change your rewarded-ad consent in Settings > Ad privacy choices (EU/UK).

## 6. Children and the casino

The game is for a general audience; ads and purchases are for adults or with a parent's store approval. We do not knowingly collect children's data. Casino mini-games use in-game money, which can be bought with real money but can never be cashed out or won back as real money or prizes; they are closed to young characters and subject to the age rating. [Age rating to be verified.]

## 7. Your rights (GDPR / KVKK Art. 11)

You may ask whether data is processed and request access, correction, erasure, restriction, portability, or object to processing; you may withdraw consent for personalised ads at any time (iOS Settings > Privacy > Tracking, Android ad settings, or Google's consent form). Contact [CONTACT_EMAIL]. You may complain to your supervisory authority (in Turkey, the KVKK Board). [Authority details to be added.]

## 8. Changes

If this policy changes, this page and the in-app link are updated; significant changes are announced in release notes.
