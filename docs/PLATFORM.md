# StarPath Football — Platformlar, Derleme ve Yayın

Tek kod tabanı (`game/`, Vite + Preact + Phaser 4) dört hedefe çıkar:

| Hedef | Kabuk | Kayıt deposu | Çıktı |
|---|---|---|---|
| Web / PWA | tarayıcı + service worker | IndexedDB (→ sıkıştırılmış localStorage) | `game/dist/` |
| Masaüstü (Steam, Win/Mac/Linux) | Electron | `userData/saves/*.json` (atomik dosya yazımı, IPC) | `game/release/` |
| Android | Capacitor 8 | `Directory.Data/saves/*.json` (@capacitor/filesystem) | `game/android/app/build/outputs/…` |
| iOS | Capacitor 8 (SPM) | aynı | Xcode arşivi (yalnızca macOS) |

Tüm komutlar `game/` klasöründe çalıştırılır. Node 24, npm 11.

---

## 1. Platform katmanı (`src/platform/`)

`main.tsx` render'dan önce tek bir çağrı yapar: `await initPlatform()`. Bu çağrı:

- **Platformu algılar** (`detect.ts`): `web` | `electron` | `android` | `ios`; `<html>`'e `platform-<id>` (+ native'de `platform-native`) sınıfı ekler.
- **Kayıt deposunu seçer** (`index.ts` → `useStorage()`):
  - Electron: `ElectronFileStorage` → preload köprüsü → `electron/main.cjs` IPC (`saves:get/set/remove/dir`). Yazım: `<key>.json.tmp` yaz → `fsync` → `rename` (POSIX'te dizin `fsync`). Anahtarlar `^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$` ile doğrulanır, `..` reddedilir, dosya yolu `saves/` dışına çıkamaz; aynı anahtara yazımlar sıraya alınır.
  - Capacitor: `CapacitorFileStorage` → `.tmp` yaz, geri oku/karşılaştır, `rename` (Android'de üzerine yazma emülatörde doğrulandı; reddedilirse önce eskiyi silip yeniden dener, `get()` bu aralıkta `.tmp`'ye düşer).
  - Web: SaveManager'ın varsayılanı (IndexedDB).
  - Native depoya ilk geçişte eski IndexedDB kayıtları bir kez kopyalanır (`sp.migrated.idb` işareti; üzerine yazmaz).
  - SaveManager'ın checksum + staging + 3 yedek rotasyonu tüm platformlarda aynen geçerlidir.
- **Haptik**: Capacitor'da `@capacitor/haptics` sürücüsü `setHapticDriver()` ile takılır (web'de `navigator.vibrate`).
- **Durum çubuğu / güvenli alan**: StatusBar açık ikonlar, şeffaf; edge-to-edge. CSS `--safe-*` token'ları `env(safe-area-inset-*)` ve SystemBars'ın enjekte ettiği `--safe-area-inset-*` değerlerinin büyüğünü alır (`platform.css`).
- **Android geri tuşu** (`back.ts`): masaüstündeki `Escape` ile aynı davranış (modal kapanır, bir ekran geri). `title`/`home` ekranında modal yoksa "StarPath Football kapatılsın mı?" onayı → `App.exitApp()`.
- **Arka plan**: tüm `AudioContext`'ler izlenir; uygulama gizlenince/arka plana geçince askıya alınır, dönünce yalnızca bizim durdurduklarımız devam eder. `sp:app-pause` / `sp:app-resume` olayları yayınlanır (web/Electron'da `visibilitychange`, Capacitor'da ayrıca `App` `pause/resume`).
- **Ekranı açık tut**: `liveMatch` ve `training` ekranlarında otomatik (mobilde `@capacitor-community/keep-awake`, web/Electron'da Screen Wake Lock API).
- **Service worker**: yalnızca web production build'inde ve http(s) altında kaydedilir (`?nosw` ile kapatılabilir).

Kodun diğer kısımları için API:

```ts
import { platform } from './platform'
platform.id                          // 'web' | 'electron' | 'android' | 'ios'
await platform.achievements.unlock('FIRST_GOAL') // Steam yoksa no-op → false
await platform.keepAwake(true)
platform.exit()
```

---

## 2. Web / PWA

```bash
npm run dev        # geliştirme (SW yok)
npm run build      # tsc + vite build → dist/ (+ dist/sw.js)
npm run preview    # build'i yerelde sun
npm run icons      # build-resources/icon.svg → public/icons/*, favicon, Electron ikonları
```

- `public/manifest.webmanifest`: ad, `display: standalone` (+ `fullscreen` override), `orientation: any`, 48–512 ikonlar, maskable 192/512, apple-touch-icon (180).
- `scripts/sw-plugin.ts` (yalnızca build) build sonrası tüm `dist` dosyalarını listeler, içerik hash'inden sürüm üretir ve `dist/sw.js` yazar: kurulumda tam ön önbellek (~3 MB), aktivasyonda eski `starpath-*` önbellekleri silinir, gezinme isteklerinde önce ağ (çevrimdışıyken önbellekteki `index.html`), varlıklarda önce önbellek, Google Fonts için stale-while-revalidate.
- Önbellek eşleşmesi `ignoreVary` kullanır (sunucular `Vary: Origin` gönderir, modül script'leri CORS isteğidir). Çevrimdışı yeniden yükleme `vite preview` + Chrome ile doğrulandı. Google Fonts, SW'nin kontrol ettiği ilk ziyaretten itibaren önbelleğe alınır; ondan önce çevrimdışıysa sistem fontlarına düşülür.
- Dev sunucusu ve e2e'de SW hiç kaydedilmez. Yükleme istemi (install prompt) bilinçli olarak eklenmedi.
- Statik barındırma: `dist/` herhangi bir alt yola konabilir (`base: './'`). `sw.js` ve `index.html` için `Cache-Control: no-cache` verin.

---

## 3. Masaüstü (Electron)

```bash
npm run desktop:dev         # Vite dev sunucusu + Electron (SP_DEV_URL), HMR'li
npm run desktop:start       # build + paketlemeden çalıştır
npm run desktop:build       # build + mevcut işletim sistemi için paket
npm run desktop:build:win   # NSIS kurulum + portable (Windows)
npm run desktop:build:mac   # universal dmg (yalnızca macOS'ta)
npm run desktop:build:linux # AppImage
```

Yapılandırma: `game/electron-builder.yml`. Pakete yalnızca `dist/`, `electron/` ve ikon girer (node_modules yok; app.asar ≈ 3 MB). Çıktılar `game/release/`:

- `StarPath-Football-Setup-<sürüm>-x64.exe` (NSIS, kullanıcı başına, klasör seçilebilir)
- `StarPath-Football-Portable-<sürüm>-x64.exe`
- `StarPath-Football-<sürüm>-mac.dmg`, `StarPath-Football-<sürüm>-linux-x86_64.AppImage`

Notlar:
- Kayıtlar: Windows `%APPDATA%\starpath-football\saves`, macOS `~/Library/Application Support/starpath-football/saves`, Linux `~/.config/starpath-football/saves`.
- Windows'ta electron-builder'ın zip açma adımı Defender yüzünden `EPERM rename …win-unpacked.tmp` verebiliyor; `desktop:build:win` bu yüzden `-c.electronDist=node_modules/electron/dist` kullanır. `node_modules/electron/dist` yoksa (npm postinstall çalışmadıysa) önce `node node_modules/electron/install.js`.
- F11 tam ekran; tek örnek kilidi; dış bağlantılar tarayıcıda açılır; renderer `sandbox + contextIsolation`.
- Kod imzalama: Windows için `CSC_LINK`/`CSC_KEY_PASSWORD` (EV/OV sertifika, SmartScreen), macOS için Developer ID + notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). İmzasız build'ler çalışır ama uyarı gösterir.

### Steamworks (isteğe bağlı)

`steamworks.js` bağımlılık **değildir**. Steam build'i için:

1. `npm i steamworks.js` (native `.node` dosyaları `asarUnpack` ile asar dışında kalır).
2. App ID: `SP_STEAM_APP_ID` ortam değişkeni veya exe'nin yanında `steam_appid.txt` (yalnızca geliştirmede; Steam istemcisi üzerinden başlatıldığında gerekmez).
3. Başarımlar Steamworks panelinde API adlarıyla (ör. `FIRST_GOAL`) tanımlanır; oyun `platform.achievements.unlock('FIRST_GOAL')` çağırır → IPC `steam:unlock` → `client.achievement.activate()`. Steam yoksa/başlatılamazsa her şey sessiz no-op.
4. Steam overlay için `electronEnableSteamOverlay()` otomatik çağrılır.
5. Steam Cloud: Steamworks → Auto-Cloud, kök `WinAppDataRoaming` / `starpath-football/saves`, desen `*.json` (Mac/Linux için kök geçersiz kılmaları).

---

## 4. Android (Capacitor 8)

Gereksinimler: JDK 21 (Android Studio'nun JBR'si yeterli), Android SDK platform 36 + build-tools 36, `ANDROID_HOME`.

```bash
npm run cap:sync       # build + npx cap sync
npm run android:apk    # → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:bundle # release AAB (imzalama yapılandırması gerekir, aşağıda)
npm run android:open   # Android Studio'da aç
npm run icons:native   # başlatıcı ikonları + splash'i yeniden üret
```

- `scripts/android-gradle.mjs`, `JAVA_HOME` 21'den eskiyse Android Studio JBR'sini otomatik kullanır.
- `minSdk 24`, `compileSdk/targetSdk 36` (`android/variables.gradle`) — Google Play'in 31 Ağustos 2026 API 36 şartını karşılar.
- Yönlendirme kilidi yok (Android 16 büyük ekran kuralı); maç canvas'ı yeniden boyutlanmayı kendisi yönetir.
- Debug build'lerde WebView `chrome://inspect` ile denetlenebilir.
- Bu makinede doğrulandı: `assembleDebug` başarılı (APK ≈ 5.8 MB), emülatörde (API 36.1) açılış, dosya kaydı, rename-üzerine-yazma ve geri tuşu onayı test edildi.

Release imzalama: bir upload keystore oluşturun (`keytool -genkey -v -keystore starpath-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`), `android/keystore.properties` (gitignore'da tutun) + `app/build.gradle` içinde `signingConfigs.release` tanımlayın; Play App Signing'i açın.

---

## 5. iOS (Capacitor 8, Swift Package Manager)

`ios/` projesi Windows'ta `npx cap add ios` ile üretildi (CocoaPods yok). Derleme **macOS + Xcode 26** gerektirir (28 Nisan 2026'dan itibaren App Store şartı):

```bash
npm run cap:sync
npm run ios:open        # Xcode → Signing & Capabilities → Team seç → Product › Archive
```

iOS 15+; ikon (1024, alfasız) ve splash `npm run icons:native` ile üretilir.

---

## 6. CI (`.github/workflows/`)

- `ci.yml` (push main / PR): typecheck + Vitest + web build (artefakt `web-build`); **e2e** işi (bundled Chromium, `npx playwright install --with-deps chromium`; engellemez); **Android debug APK** işi (Temurin 21, artefakt `starpath-android-debug-apk`).
- `release.yml` (`v*` etiketi veya elle): Windows/macOS/Linux Electron matrisi + Android APK; etiket build'leri taslak GitHub Release'e eklenir. İmzalama sırları tanımlıysa kullanılır.
- Playwright kanal seçimi: yerelde Chrome kuruluysa `channel: 'chrome'`, CI'da veya Chrome yoksa bundled Chromium; `PW_CHANNEL=chrome|msedge|chromium` ile zorlanır.

---

## 7. Mağaza gönderim kontrol listesi

**Steam** (Steamworks Partner)
- [ ] App ID + depot'lar (Win/Mac/Linux), launch options (`StarPath Football.exe`)
- [ ] `steamworks.js` ekli build, başarım API adları paneldekiyle aynı
- [ ] Steam Cloud yolları (bkz. §3), Steam Deck uyumluluğu (1280×800, kontrolcü/dokunma)
- [ ] Mağaza sayfası: kapsül görseller, ekran görüntüleri, fragman, yaş derecelendirmesi; "Coming Soon" ≥ 2 hafta; build incelemesi
- [ ] Kumarhane mini oyunları gerçek para içermiyor — içerik anketinde "simulated gambling" işaretlenmeli

**Google Play**
- [ ] Release AAB, upload keystore, Play App Signing
- [ ] targetSdk 36 (✔), 16 KB sayfa boyutu uyumu (native kod yok — WebView)
- [ ] Data safety formu (çevrimdışı oyun, veri toplanmıyor), gizlilik politikası URL'si
- [ ] IARC içerik derecelendirmesi (simüle kumar → genelde 12+/PEGI 12+ etkisi)
- [ ] Ekran görüntüleri (telefon + 7"/10" tablet), feature graphic 1024×500
- [ ] Ücretli kilit eklenirse Play Billing Library 8

**Apple App Store**
- [ ] Xcode 26 / iOS 26 SDK ile arşiv, Bundle ID `app.starpath.football`
- [ ] Yeni yaş derecelendirme anketi (4+/9+/13+/16+/18+); simüle kumar → en az 13+/16+ değerlendirin
- [ ] App Privacy etiketleri (veri toplanmıyor), gizlilik politikası URL'si
- [ ] Ekran görüntüleri 6.9" iPhone + 13" iPad; iPad çoklu görev için tüm yönlendirmeler açık
- [ ] TestFlight dahili test → inceleme

**Web / PWA**
- [ ] HTTPS, `sw.js` ve `index.html` için `no-cache`
- [ ] Lighthouse PWA/Installable kontrolü; itch.io HTML5 yüklemesi için `dist/` zip'i

## 8. Monetizasyon ve mağaza politikası (WP-12)

**Model:** para birimi yok, enerji yok, ganimet kutusu yok, reklam yok. Mobilde ilk tam sezon ücretsiz; sonrasında tek seferlik "Tam Kariyer" kilidi (`full_career`, non-consumable). Steam/masaüstü/web: premium, paywall hiç görünmez. İsteğe bağlı yalnızca kozmetik paketler (`pack_celebrations`, `pack_avatar`).

**Kod:** `src/store-iap/` (katalog, `entitlements`, `PurchaseProvider { products, buy, restore }`, `DevProvider`, `CapacitorProvider` = `@capgo/native-purchases`, `npx cap sync` ile doğrulandı). Kilit yalnızca UI arka ucunda (`ui/backend/realActions.ts`: `lockedOut`) uygulanır; `sim/**` ve `core/**` store-iap'i içe aktaramaz (test var), dolayısıyla kilit simülasyon sonucunu etkilemez. Kayıt, kupalar ve Onur Listesi kilitliyken de görüntülenebilir ("şimdi değil" = salt okunur mod).

**Build flavor:** `SP_FLAVOR=trial|premium|auto` (vite define `__SP_FLAVOR__`; `auto` = Android/iOS'ta trial, diğerlerinde premium). Dev'de `?flavor=trial|premium` ile geçersiz kılınır (e2e). Yeni ürün için `catalog.ts`'e ekle ve mağaza panelinde aynı id'yi aç. Kozmetik kapılar için `cosmeticUnlocked(kind, id)` / `hasEntitlement(id)` okunur (örn. maç sunumu: `cosmeticUnlocked('celebration', id)`).

**Güven modeli:** haklar global anahtarda (`starpath.entitlements.v1`, kayıt slotlarının dışında) imzasız yerel olarak tutulur; gerçek kaynak mağazadır, "Satın alımları geri yükle" mağaza hesabından yeniden verir. GELECEK İŞ: sunucu tarafı makbuz doğrulaması (Google Play Developer API purchaseToken, App Store Server API) ve yerel kaydın imzalanması. Önkoşul: Play Console / App Store Connect'te `full_career`, `pack_celebrations`, `pack_avatar` ürünleri.

**Politika uyumu**
- Google Play Faturalandırma: dijital ürünler yalnızca Play Billing ile satılır (harici ödeme yok); fiyat mağazanın yerel para birimi dizgesiyle gösterilir (`priceString`); abonelik yok.
- App Store 3.1.1: kilidi açan ürünler uygulama içi satın alma ile; **Satın alımları geri yükle** düğmesi hem paywall'da hem Ayarlar › Satın alımlar'da bulunur (zorunlu); karanlık örüntü yok (geri sayım, sahte kıtlık, gizli ücret yok; "Şimdi değil" her zaman açık, iptalde ücret alınmadığı belirtilir).
- Gerçek parayla kumar yok: Kumarhane yalnızca oyun içi parayla simüle edilir; oyun parası satın alınamaz, gerçek paraya çevrilemez, ganimet kutusu/şans paketi yok. Kozmetik paketler içeriği açık gösterilen sabit içeriktir (rastgele değil).
- Reklam ve izleme yok; çocuk/aile politikaları için kişisel veri toplanmaz (telemetri yerel ve isteğe bağlı).
