# 04 — Platform ve Teknik Altyapı Araştırması

> Proje: 2D futbol kariyer / yaşam simülasyonu (New Star Soccer'ın manevi halefi)
> Hedef platformlar: PC (Windows / macOS / Linux, Steam) + Mobil (Android / iOS) + PWA (temel/demo)
> Tarih: 7 Ekim 2026
> Durum: Araştırma raporu — karar önerileri içerir, kesinleşmiş tasarım değildir.

---

## 0. Yönetici Özeti

| Konu | Öneri |
|---|---|
| Motor | **Phaser 4 (v4.2.x)** + TypeScript + Vite. Phaser 4 Nisan 2026'da kararlı sürüme ulaştı (v4.0.0 "Caladan", 10 Nisan 2026; v4.1.0 30 Nisan; v4.2.1 9 Temmuz 2026). |
| UI katmanı | Menü/yönetim ekranları (kariyer, transfer, yaşam simülasyonu) için DOM tabanlı UI (Preact/Solid veya hafif lit-html) + maç sahnesi Phaser canvas'ta. |
| Mobil | **Capacitor 8** (minSdk 24, target/compileSdk 36, iOS 15+, Xcode 26). |
| Masaüstü (Steam) | **Electron** + **steamworks.js** (Steam overlay, başarımlar, Steam Cloud). Tauri 2, Steam dışı mağazalar (itch.io, GOG) için ikincil seçenek. |
| Kayıt sistemi | Saf TS "SaveStore" soyutlaması; web'de IndexedDB, mobilde Capacitor Filesystem, masaüstünde Node `fs` atomik yazma + rotasyonlu yedekler + checksum + şema versiyonu ve migrasyon zinciri. |
| Monetizasyon | Premium (Steam) + mobilde "ücretsiz dene, tek seferlik tam sürüm kilidi" + yalnızca kozmetik DLC. **Para ile güç satın alma yok, enerji/zaman kapısı yok.** |
| Simülasyon | Deterministik, seed'li RNG (PCG32 / xoshiro128**), sabit zaman adımı, simülasyon çekirdeği render'dan tamamen ayrık ve saf TS. |
| Test / CI | Vitest (birim + simülasyon snapshot), Playwright (E2E, görsel regresyon), GitHub Actions matrisi (AAB, IPA, Win/Mac/Linux). |

Önemli 2026 tarihleri:
- **Google Play:** 31 Ağustos 2026'dan itibaren yeni uygulama ve güncellemeler **Android 16 (API 36)** hedeflemeli (uzatma 1 Kasım 2026'ya kadar). Ayrıca 31 Ağustos 2026'dan itibaren **Play Billing Library 7 ve altı** ile güncelleme kabul edilmiyor → PBL 8 zorunlu. PBL 8.x için son tarih 31 Ağustos 2027.
- **Android 16 davranış değişikliği:** API 36 hedefleyen uygulamalar 600dp ve üzeri büyük ekranlarda (tablet, katlanabilir) **yönlendirme/en-boy kilidi uygulayamaz**; edge-to-edge'den çıkış (opt-out) kaldırıldı. → Oyun hem dikey hem yatayda düzgün çalışmalı ya da büyük ekranda letterbox ile esnek ölçeklenmeli.
- **Apple:** 28 Nisan 2026'dan itibaren App Store'a yüklenen uygulamalar **iOS 26 SDK / Xcode 26** ile derlenmeli. Yeni yaş derecelendirme sistemi: 4+, 9+, **13+, 16+, 18+** (12+ ve 17+ kaldırıldı); anket 31 Ocak 2026'dan beri zorunlu.

---

## 1. Motor Karşılaştırması

### 1.1 Oyunun teknik profili

New Star Soccer tarzı bir oyunun yükü şunlardır:
- **%60–70 menü / yönetim UI**: kariyer takvimi, ilişkiler, finans, ev/araba alımları, sponsorlar, haber akışı, istatistik tabloları. Metin yoğun, yerelleştirilmesi gereken, erişilebilir olması gereken arayüz.
- **%30–40 maç anları**: 2D üstten/izometrik saha, birkaç düzine sprite, top fiziği (basit 2.5D: x, y, z yüksekliği + spin), swipe/sürükle ile şut ve pas, kısa "an" sekansları.
- **Simülasyon çekirdeği**: maç sonucu, lig, transfer, yaşlanma, sakatlık; deterministik ve test edilebilir olmalı.

Bu profil "GPU ağır" değil; asıl riskler: **UI üretkenliği, yerelleştirme, kayıt güvenilirliği, düşük donanımlı Android'de pil/termal tüketim, mağaza uyumluluğu**.

### 1.2 Karşılaştırma tablosu

| Kriter | Phaser 4 | PixiJS v8 | Godot 4.5+ | Unity 6 | Defold | Cocos Creator 3.8 |
|---|---|---|---|---|---|---|
| Dil | TypeScript | TypeScript | GDScript / C# | C# | Lua | TypeScript |
| Tür | Tam 2D oyun çatısı (sahne, input, ses, tween, fizik, kamera) | Yalnızca renderer | Tam motor + editör | Tam motor + editör | Hafif tam motor + editör | Tam motor + editör |
| 2D uygunluğu | Çok iyi | Çok iyi (ama altyapı yazmak gerekir) | Çok iyi | İyi (2D araçları ağır) | Çok iyi | İyi |
| UI yoğun ekranlar | DOM ile hibrit → çok güçlü (HTML/CSS, a11y, i18n, RTL, metin) | DOM ile hibrit | Control node'ları iyi, ama kendi UI sistemi | UI Toolkit/uGUI, kendi sistemi | GUI sistemi sınırlı | Kendi UI sistemi |
| Web/PWA | Yerel | Yerel | WASM export; **C# web export'ta desteklenmiyor**; büyük ilk yükleme (~25–40 MB), SharedArrayBuffer/COOP-COEP gereksinimleri (4.3+ tek-thread seçenek ile azaldı) | WebGL/WebGPU build ağır, mobil web zayıf | İyi, küçük | İyi |
| Mobil yerel | Capacitor sarmalayıcı (WebView) | Capacitor | Yerel export (çok iyi) | Yerel (çok iyi) | Yerel (çok iyi, ~2–5 MB) | Yerel |
| Masaüstü | Electron/Tauri | Electron/Tauri | Yerel | Yerel | Yerel | Yerel |
| Steamworks | steamworks.js | steamworks.js | GodotSteam (olgun) | Steamworks.NET / Facepunch | defold-steam eklentisi | Topluluk |
| Uygulama boyutu (mobil) | ~8–25 MB (asset'e göre) | Benzer | ~30–45 MB taban | ~25–40 MB taban | ~3–6 MB taban | ~10–20 MB |
| Düşük uçlu Android perf | Orta-İyi (WebView + WebGL; dikkatli olunmalı) | Orta-İyi | İyi (yerel), GLES3/Compatibility renderer | İyi | Çok iyi | İyi |
| Lisans/maliyet | MIT, ücretsiz | MIT | MIT | Ücretsiz katman + gelir eşiği, geçmiş güven sorunu (2023 runtime fee krizi) | Ücretsiz (Defold Foundation) | Ücretsiz |
| Ekip yetkinliği (TS/web) | Doğrudan | Doğrudan | Yeni dil/araç | Yeni dil/araç | Lua öğrenmek | TS ama farklı ekosistem |
| Test (Vitest/Playwright) | Doğal | Doğal | Ayrı test altyapısı (GUT/gdUnit) | Unity Test Framework | Sınırlı | Sınırlı |
| Hot reload / iterasyon | Vite HMR (saniyenin altında) | Vite HMR | Editör içi iyi | Domain reload yavaş | İyi | İyi |

### 1.3 Değerlendirme

- **Phaser 4**: Nisan 2026'dan beri kararlı. Yeni WebGL renderer (render node mimarisi), daha iyi batching, filtreler/efektler, Phaser 3'e büyük ölçüde benzer API. 4.0 → 4.2 arasında hızlı yama döngüsü sürüyor; bu nedenle **küçük sürümü sabitlemek (`~4.2.x`) ve güncellemeleri test sonrası almak** önerilir. Phaser 3.90 son 3.x sürümüdür; yeni projede Phaser 3 seçmek için tek neden belirli bir 3. parti eklentiye bağımlılık olabilir.
- **PixiJS**: Yalın ve hızlı, ancak sahne yönetimi, input, ses, tween, kamera, asset loader gibi parçaları biz kurarız. Ekip küçükse Phaser'ın "piller dahil" yaklaşımı zamandan kazandırır.
- **Godot 4**: Mobil/masaüstü yerel export'ta en güçlü rakip; GodotSteam olgun. Ancak (a) web export'ta C# yok, (b) web build büyük ve iOS Safari'de hassas, (c) UI yoğun, çok dilli metin ekranlarında HTML/CSS kadar üretken değil, (d) TS test/CI ekosisteminden kopuş. Web baseline bir gereksinim olmasaydı Godot güçlü bir aday olurdu.
- **Unity**: 2D'de aşırı ağır, lisans geçmişi risk yaratıyor, web hedefi zayıf. Bu tür için gereksiz.
- **Defold**: Mobil boyut/performans şampiyonu; ama Lua, sınırlı UI ve küçük ekosistem.
- **Cocos Creator**: Asya mobil pazarında güçlü, TS kullanıyor; fakat Batı'da topluluk/belgeleme zayıf, editör bağımlılığı yüksek.

### 1.4 Nihai seçim ve gerekçe

**TypeScript + Vite + Phaser 4 + DOM tabanlı UI katmanı + Capacitor (mobil) + Electron (Steam).**

Gerekçe:
1. Oyunun çoğunluğu metin/menü ağırlıklı; HTML/CSS ile **erişilebilirlik (ekran okuyucu, font ölçekleme), i18n, dinamik metin uzunluğu** çok daha kolay.
2. Tek kod tabanı → web, PWA, mobil, masaüstü. Simülasyon çekirdeği saf TS olduğundan Node'da Vitest ile saniyeler içinde binlerce sezon simüle edilebilir.
3. Phaser 4 kararlı ve maç sahnesi için gereken her şeyi (sprite, tween, partikül, kamera, input, ses) sağlıyor.
4. Riskler (WebView performansı, Steam overlay) bilinen ve yönetilebilir riskler (aşağıda).

**Risk azaltma / kaçış planı:** Simülasyon çekirdeği (`packages/sim`) render motorundan bağımsız saf TS olarak tasarlanır. Böylece ileride maç görselleştirmesi PixiJS'e taşınabilir veya mobil performans yetersiz kalırsa yalnızca render katmanı değiştirilir.

**Önerilen monorepo yapısı:**
```
/apps/web        (Vite + Phaser + UI; PWA)
/apps/mobile     (Capacitor: android/ ios/)
/apps/desktop    (Electron main + preload; steamworks.js)
/packages/sim    (deterministik simülasyon, saf TS, DOM yok)
/packages/save   (SaveStore arayüzü + adaptörler + migrasyonlar)
/packages/i18n   (sözlükler, ICU mesajları)
/packages/platform (Platform arayüzü: haptics, IAP, achievements, cloud, share)
```

---

## 2. Mobil (Capacitor)

### 2.1 Kurulum

- **Capacitor 8**: Android minSdk **24**, compileSdk/targetSdk **36**; iOS deployment target **15.0**; Xcode **26+** gerekli. Bu, Google Play'in API 36 ve Apple'ın iOS 26 SDK şartlarıyla uyumlu.
- Adımlar: `npm i @capacitor/core @capacitor/cli` → `npx cap init` → `npx cap add android` / `ios` → `vite build` → `npx cap sync`.
- Önerilen resmi eklentiler: `@capacitor/app` (geri tuşu, yaşam döngüsü), `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/filesystem`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/screen-orientation`, `@capacitor/keyboard`, `@capacitor/share`, `@capacitor/local-notifications` (isteğe bağlı, "maç günü" hatırlatma — spam yapmadan).
- IAP: `@revenuecat/purchases-capacitor` veya `cordova-plugin-purchase` (CdvPurchase v13+). **PBL 8 kullandığı doğrulanmalı.**
- Asset'ler `webDir` içinde paketlenir → **tamamen çevrimdışı** çalışır; uzaktan URL'den yükleme (live reload hariç) kullanılmamalı.

### 2.2 Düşük uçlu Android performansı

Hedef referans cihaz: 2–3 GB RAM, Mali-G52 / Adreno 610 sınıfı GPU, Android 10–12, Android System WebView (Chromium) güncel.

Öneriler:
- **WebGL renderer**, Canvas fallback yalnızca acil durum için.
- **Sabit 30 FPS modu** (menülerde) + maçta 60 FPS; ayarlarda "Pil tasarrufu" seçeneği. Menülerde Phaser oyun döngüsünü durdurmak (`game.loop.sleep()`) veya düşük FPS'e çekmek pil/termalde büyük fark yaratır.
- **Dinamik çözünürlük**: `devicePixelRatio` en fazla 2 ile sınırlansın; düşük uçta 1.5 veya 1.
- Texture atlas (TexturePacker / free-tex-packer), 2048×2048'i aşmayan sayfalar, mümkünse sıkıştırılmış doku (KTX2/Basis) — Phaser 4'te compressed texture desteği.
- GC baskısını azalt: maç döngüsünde nesne havuzu (object pool), her frame'de dizi/obje oluşturmama.
- Ses: OGG/M4A ikili kodlama; Web Audio unlock (ilk dokunuş).
- Ağır simülasyon (sezon sonu toplu lig simülasyonu) **Web Worker**'da çalışsın; UI donmasın.
- Bellek bütçesi: toplam JS heap < 150 MB, texture < 128 MB.
- Ölçüm: Chrome DevTools remote debugging (`chrome://inspect`), Android GPU Inspector, Perfetto.

### 2.3 WebView kısıtları

- **Android**: Android System WebView güncellemeleri Play Store'dan gelir; çok eski cihazlarda eski WebView olabilir → minimum Chromium sürümü kontrolü ve kullanıcıya uyarı.
- **iOS WKWebView**: JIT var ama bellek limiti katı (ağır kullanımda WebContent süreci sonlandırılabilir → "beyaz ekran"). `visibilitychange` ile durum kaydet; yeniden yüklemede kurtarma.
- **iOS ses**: Sessiz anahtarı ve audio session kategorisi; arka plana geçince ses context'ini askıya al.
- **IndexedDB / localStorage eviction**: WebView depoları işletim sistemi tarafından temizlenebilir (özellikle iOS'ta düşük disk). **Bu yüzden mobilde kayıt verisi IndexedDB'de değil, Capacitor Filesystem (`Directory.Data` / `Library`) içinde tutulmalı.**
- `navigator.storage.persist()` web/PWA için çağrılmalı.
- Uzun basma ile metin seçimi, büyüteç, bağlam menüsü, çift dokunma zoom'u CSS ile kapatılmalı (`user-select:none`, `touch-action:none`, `-webkit-touch-callout:none`).

### 2.4 Dokunmatik giriş (swipe-to-shoot)

- **Pointer Events** (Phaser input zaten bu temelde) — `pointerdown/move/up`, çoklu dokunuş için `input.addPointer(2)`.
- Swipe şut modeli: başlangıç noktası, son N örnek (ör. son 80 ms) üzerinden hız vektörü, yay eğriliği (curve) için yol sapması, yükseklik için swipe uzunluğu/hızı. Örnekleri **zaman damgasıyla** kaydet; frame hızına bağlı olmasın.
- Ölü bölge (dead zone) ve minimum mesafe; yanlış tetiklemeleri önler.
- Sol/sağ el modu, dokunma alanı ölçeği (erişilebilirlik).
- Kullanıcı ayarı: "swipe" vs. "dokun-ve-güç çubuğu" alternatif şema (motor becerisi farklı kullanıcılar için).
- Şut girdisi simülasyona **deterministik girdi olayı** olarak verilsin (`{t, dx, dy, curve}`) → replay ve test mümkün.

### 2.5 Haptik

- `@capacitor/haptics`: `impact({style: Light|Medium|Heavy})`, `notification({type})`, `selectionChanged()`.
- Kullanım: top vuruşu (Medium), direk (Heavy), gol (notification success), menü seçimi (selection). Ayarlardan kapatılabilir; iOS'ta sistem ayarına saygı.
- Masaüstünde Gamepad API `vibrationActuator.playEffect('dual-rumble')` (Chromium/Electron'da destekli).

### 2.6 Safe area / çentik / edge-to-edge

- `viewport-fit=cover` meta etiketi + CSS `env(safe-area-inset-*)`.
- Android 15+ (API 35) ve özellikle API 36'da **edge-to-edge zorunlu**, opt-out yok → Android'de inset'ler doğru alınmalı (Capacitor 8 SystemBars/EdgeToEdge yaklaşımları; gerekirse `@capawesome/capacitor-android-edge-to-edge-support`).
- Phaser canvas tam ekran çizer; HUD ve dokunma kontrolleri safe-area içine yerleştirilir. Safe area değerleri JS'e CSS değişkeni olarak okunup Phaser kamerasına/UI yerleşimine aktarılır.

### 2.7 Yönlendirme (orientation)

- Maç: yatay tercih; menü: hem dikey hem yatay destekleyen duyarlı DOM UI önerilir.
- **Android 16 (API 36) + ≥600dp ekranlarda yönlendirme kilidi yok sayılır** → tablet/katlanabilirde oyun dikey açılabilir; "Döndürün" ekranı yerine yatay sahneyi letterbox ile dikeyde de oynanabilir (veya dikey kamera modu) tasarlanmalı.
- Telefonlarda `@capacitor/screen-orientation` ile maç sahnesinde yatay kilit kullanılabilir.

### 2.8 Uygulama boyutu

- Hedef: Android AAB indirme boyutu < 40 MB, iOS < 60 MB.
- Ses dosyalarını sıkıştır (OGG 96 kbps müzik, 64 kbps efekt), PNG yerine WebP/AVIF (WebView desteği iyi), font alt kümeleme (yalnızca Latin + Türkçe karakterler: ç ğ ı İ ö ş ü).
- Vite: tree-shaking, `build.target: 'es2020'`, Phaser'ın özel build'i (kullanılmayan fizik motorlarını çıkar; Matter.js gerekmiyorsa dahil etme).
- Android: AAB + Play Asset Delivery gerekmez (küçük oyun).

### 2.9 Play Store gereksinimleri (2026)

| Gereksinim | Ayrıntı |
|---|---|
| Target SDK | 31 Ağustos 2026'dan itibaren **API 36** (uzatma 1 Kasım 2026). Mevcut uygulamalar yeni kullanıcılara görünmek için en az API 35. |
| Format | AAB zorunlu; Play App Signing. |
| Play Billing | **PBL 8+** (31 Ağustos 2026'dan itibaren PBL 7 ve altı ile güncelleme yok). Dijital içerik satışı Play Billing üzerinden (bazı bölgelerde alternatif faturalama programları, ABD'de 2025 sonrası mahkeme kararlarıyla değişen kurallar — yayın öncesi güncel politika kontrolü). |
| Data safety formu | Toplanan veri (analitik, crash, cihaz kimliği, satın alma geçmişi), paylaşım, şifreleme, silme talebi. Üçüncü taraf SDK'ların (reklam, analitik) verisi dahil. |
| Hesap silme | Uygulama içi hesap oluşturuluyorsa uygulama içinden ve web üzerinden silme yolu zorunlu. (Hesapsız tasarım bu yükü ortadan kaldırır.) |
| İçerik derecelendirme | IARC anketi. Kumar/bahis, alkol, sigara, "lootbox" mekanikleri içerik derecelendirmesini etkiler. Yaşam simülasyonunda alkol/gece hayatı varsa beyan edilmeli. |
| Hedef kitle ve içerik | Çocuklara yönelik değilse "13+" hedef kitle seçimi; Families politikası dışı kalmak reklam/analitik özgürlüğü sağlar. |
| Lootbox | Rastgele ödüllü ücretli öğeler için olasılık açıklaması zorunlu. **Öneri: hiç lootbox yok.** |
| Reklam SDK politikası | Yanıltıcı/zorla reklam yasak, tam ekran reklamlarda kapatma butonu, oyun ortasında beklenmedik interstitial yok; Families kapsamında yalnızca sertifikalı reklam SDK'ları. |
| Geliştirici doğrulama | Google'ın 2026'dan itibaren kademeli olarak devreye aldığı geliştirici kimlik doğrulama gereksinimleri (sideload dahil) — hesap bilgileri güncel tutulmalı. |
| Test kanalı | Yeni kişisel geliştirici hesaplarında üretime çıkmadan önce kapalı testte en az 12 test kullanıcısı / 14 gün şartı. |

### 2.10 App Store gereksinimleri (2026)

| Gereksinim | Ayrıntı |
|---|---|
| SDK | 28 Nisan 2026'dan itibaren **iOS 26 SDK / Xcode 26**. |
| Yaş derecelendirmesi | Yeni sistem: 4+, 9+, 13+, 16+, 18+. Kumar teması, alkol, olgun içerik soruları. |
| Privacy Nutrition Labels | App Store Connect'te veri türleri ve amaçları. |
| Privacy Manifest | `PrivacyInfo.xcprivacy` zorunlu; "required reason API" kullanımları (UserDefaults, dosya zaman damgası, disk alanı vb.) beyan edilmeli. Capacitor ve eklentileri kendi manifestlerini getirir; birleştirilmiş raporu kontrol et. |
| ATT | IDFA veya uygulamalar arası takip yapılıyorsa `AppTrackingTransparency` izni şart. **Öneri: takip yok → ATT istemine gerek yok**, reklam varsa kişiselleştirilmemiş reklam. |
| IAP | Dijital içerik/kilit açma StoreKit ile (ABD'de harici bağlantıya izin veren 2025 kararları sonrası kurallar bölgeye göre farklı; AB'de DMA kapsamında alternatifler). Tek seferlik kilit = "Non-Consumable"; **"Satın Alımları Geri Yükle" butonu zorunlu**. |
| Guideline 4.2 / 4.7 | WebView tabanlı uygulama "yalnızca web sitesi sarmalayıcı" olarak görülmemeli; oyun tam çevrimdışı, yerel özellikler (haptik, Game Center isteğe bağlı) kullanmalı. |
| Game Center | İsteğe bağlı; başarımlar/lider tabloları için Capacitor topluluk eklentileri. |
| iCloud | Bulut kayıt için CloudKit veya iCloud Documents (bkz. §4). |

### 2.11 Çevrimdışı oyun

- Tüm çekirdek oyun çevrimdışı oynanabilir olmalı (NSS oyuncuları metro/uçakta oynuyor).
- Satın alma doğrulaması önbelleğe alınır; çevrimdışıyken kilit durumu yerel makbuzdan okunur.
- Analitik olayları kuyruklanır, çevrimiçi olunca gönderilir (ve kullanıcı onayı varsa).
- PWA: Workbox ile service worker, tüm asset'ler precache; sürüm değişiminde "Güncelleme hazır" bildirimi (oyun ortasında zorla yenileme yok).

---

## 3. Masaüstü (PC / Steam)

### 3.1 Tauri 2 vs Electron

| Kriter | Electron | Tauri 2 |
|---|---|---|
| Render motoru | Paketlenmiş Chromium (her OS'ta aynı) | Sistem WebView: Windows WebView2 (Chromium), macOS WKWebView (WebKit), Linux **WebKitGTK** |
| Boyut | ~90–150 MB kurulum | ~5–15 MB |
| RAM | Daha yüksek | Daha düşük |
| WebGL tutarlılığı | Yüksek, öngörülebilir | Linux'ta WebKitGTK ile WebGL/canvas sessizce yavaş yola düşebiliyor (Tauri belgeleri bunu kabul ediyor) → Steam Deck/Linux riski |
| Steamworks | **steamworks.js** (aktif, Nisan 2026'da güncellendi; Electron overlay yardımcısı var), alternatif: steamworks-ffi-node (Koffi FFI) | Rust tarafında `steamworks` crate (steamworks-rs) ile kendi komutlarını yazmak gerekir |
| Steam Overlay | Electron'da `electronEnableSteamOverlay()` ile çalışır | Windows WebView2 mimarisi (ayrı süreç, ayrı D3D cihazı) nedeniyle Steam Overlay doğal olarak çalışmıyor; yalnızca karmaşık geçici çözümler |
| Gamepad API | Chromium → tam | WebView2 tam; WKWebView/WebKitGTK sınırlı/değişken |
| Güvenlik | Dikkatli konfigürasyon gerekir (contextIsolation, sandbox) | Varsayılan olarak daha güvenli |

**Karar:** Steam sürümü için **Electron**. Gerekçeler: Steam Overlay, steamworks.js olgunluğu, Linux/Steam Deck'te tutarlı Chromium WebGL, Gamepad API tutarlılığı. Boyut farkı oyun için kabul edilebilir (Steam oyunları için 150 MB sorun değil). Tauri 2, overlay gerekmeyen itch.io/GOG sürümleri için ikinci seçenek olarak açık tutulabilir; Platform soyutlaması bunu ucuz kılar.

Electron güvenlik ayarları: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (steamworks.js main süreçte), IPC yalnızca `contextBridge` ile beyaz listeli API. `electron-builder` veya `electron-forge` ile paketleme; ASAR + Electron Fuses (RunAsNode kapalı vb.).

### 3.2 Steamworks entegrasyonu

- **steamworks.js** main süreçte `init(appId)`; renderer'a IPC ile `achievement.activate`, `stats`, `cloud.*`, `overlay`, `localplayer.getName()` açılır.
- **Başarımlar**: ID'ler Steamworks panelinde tanımlanır; oyun içi olay → `achievement.activate('FIRST_HATTRICK')`. Çevrimdışıyken Steam istemcisi senkronize eder.
- **İstatistikler**: toplam gol, sezon sayısı (progress achievement'lar için).
- **Steam Cloud**: İki yol:
  1. **Steam Auto-Cloud** (kod gerektirmez): Steamworks panelinde kayıt klasörü (ör. `%APPDATA%/NewStarFutbol/saves`, `~/Library/Application Support/...`, `~/.local/share/...`) tanımlanır. Basit ve güvenilir. **Önerilen başlangıç.**
  2. **ISteamRemoteStorage API** (`cloud.writeFile/readFile`) — çakışma çözümü üzerinde tam kontrol.
- Steam Deck: "Verified" için 1280×800 desteği, kontrolcü ile tam gezinti, sanal klavye (`ShowGamepadTextInput`), metin okunabilirliği (min 9 px @ 1280×800 yerine pratikte ≥ 12 px).
- `steam_appid.txt` yalnızca geliştirmede; yayında Steam başlatır. Steam olmadan başlatılırsa `restartAppIfNecessary`.
- DRM: Steam DRM wrapper isteğe bağlı; Electron'da gereksiz/sorunlu olabilir — kullanma.

### 3.3 Klavye / fare ve gamepad

- Tüm menüler klavye ile gezilebilir (Tab/ok tuşları/Enter/Esc), odak görünürlüğü.
- Maç: fare ile sürükle-bırak şut (dokunmatik şemanın masaüstü karşılığı) + klavye alternatifi (güç çubuğu + yön).
- **Gamepad API** (`navigator.getGamepads()`, standard mapping): sol çubuk ile nişan, tetik basınç = güç, sağ çubuk = falso. Phaser'ın gamepad plugin'i kullanılabilir.
- Steam Input: Steamworks panelinde gamepad'i "XInput gibi" geçir ayarı veya Steam Input API; en azından Xbox/PlayStation/Switch Pro/Steam Deck test edilmeli.
- Buton ikonları aktif giriş cihazına göre dinamik (klavye/Xbox/PS).
- Tüm kontroller yeniden atanabilir (remapping) — erişilebilirlik.

### 3.4 Çözünürlük, ultrawide, tam ekran

- Mantıksal tasarım çözünürlüğü: **1920×1080 (16:9)**. Phaser Scale Manager: `Scale.FIT` + "genişletilmiş alan" yaklaşımı (saha kamerası 16:9'dan geniş oranlarda daha fazla saha gösterir, HUD kenarlara sabitlenir).
- 16:10 (Steam Deck, MacBook), 21:9, 32:9 test edilmeli; UI'nın maksimum içerik genişliği sınırlansın (ultrawide'da ortada sütun).
- HiDPI: `resolution`/DPR ölçekleme; metin keskinliği için DOM UI avantajlı.
- Tam ekran: Electron `BrowserWindow.setFullScreen`, borderless windowed varsayılan; `F11`/`Alt+Enter`. macOS'ta native fullscreen.
- V-Sync: tarayıcı rAF ekran yenilemeye kilitlidir; 120/144 Hz ekranlarda sabit adımlı simülasyon + interpolasyon (bkz. §6.6).
- Pencere boyutu/konumu kaydedilsin.

---

## 4. Kayıt Sistemi

> NSS'nin en çok şikâyet edilen sorunlarından biri **kayıt kaybı** (güncelleme sonrası silinen kariyerler, yarıda kesilen yazmalar, cihaz değişiminde aktarılamayan ilerleme). Bu nedenle kayıt sistemi "kritik altyapı" olarak ele alınmalıdır.

### 4.1 Depolama seçenekleri

| Ortam | Birincil depo | Not |
|---|---|---|
| Web/PWA | **IndexedDB** (`idb` küçük sarmalayıcısı) | localStorage ~5 MB, senkron, string-only → yalnızca küçük ayarlar. `navigator.storage.persist()` iste. Safari'de 7 gün ziyaret edilmeyen siteler için ITP veri silme riski → kullanıcıya "Kayıtı dışa aktar" seçeneği. |
| Android/iOS (Capacitor) | **@capacitor/filesystem** `Directory.Data` (Android iç depolama, iOS `Library/Application Support` benzeri; iOS'ta `Documents` yalnızca kullanıcıya görünür dışa aktarma için) | WebView depolarına güvenme. Küçük ayarlar için `@capacitor/preferences` (Android SharedPreferences / iOS UserDefaults). |
| Masaüstü (Electron) | Node `fs` → `app.getPath('userData')/saves` | Steam Auto-Cloud bu klasörü senkronlar. |

`SaveStore` arayüzü:
```ts
interface SaveStore {
  list(): Promise<SlotMeta[]>;
  read(slot: string): Promise<Uint8Array | null>;
  writeAtomic(slot: string, data: Uint8Array): Promise<void>;
  remove(slot: string): Promise<void>;
}
```

### 4.2 Kayıt formatı

- Zarf (envelope): `{ magic: "NSF1", schemaVersion, gameVersion, createdAt, updatedAt, platform, seed, checksum (CRC32/SHA-256), payload }`.
- Payload: JSON → `CompressionStream('gzip')` (veya fflate) → isteğe bağlı base64. Tipik kariyer kaydı 200 KB–2 MB.
- Ayrı **meta dosyası** (slot listesi için oyuncu adı, kulüp, sezon, ekran görüntüsü küçük resmi) → tüm kaydı açmadan listeleme.
- Şema doğrulama: Zod/Valibot ile yükleme sonrası doğrulama.

### 4.3 Atomik yazma ve bozulma önleme

1. Yeni veriyi `slot.tmp` dosyasına yaz → `fsync` (Node: `fs.promises.open` + `filehandle.sync()`).
2. Okuyup checksum doğrula (read-after-write).
3. Mevcut `slot.sav` → `slot.bak1` (rotasyon: bak1→bak2→bak3).
4. `slot.tmp` → `slot.sav` **rename** (aynı dosya sisteminde atomik).
5. IndexedDB'de: tek `readwrite` transaction içinde `current` ve `backup` anahtarlarını güncelle; transaction atomiktir. Yine de 2 nesil yedek tut.
6. Yüklemede: `sav` checksum hatalı → `bak1` → `bak2` → `bak3`; kullanıcıya "Son sağlam yedek yüklendi (X tarihli)" mesajı.
7. **Otomatik kayıt zamanlaması**: maç sonu, gün geçişi, menü değişimleri; uygulama arka plana geçtiğinde (`visibilitychange`, Capacitor `appStateChange`, Electron `before-quit`). Arka plana geçişte iOS'un birkaç saniyelik süresi içinde bitecek kadar hızlı olmalı (önceden serileştirilmiş "kirli" durum).
8. Yazma kuyruğu (mutex): aynı anda iki yazma olamaz.
9. Disk dolu (`QuotaExceededError`, ENOSPC) hatası yakalanıp kullanıcıya bildirilir; eski kayıt asla önce silinmez.
10. Kalıcı **"Kaydı dışa aktar / içe aktar"** (dosya, paylaşım sayfası) — kullanıcının kendi yedeği; cihaz değişiminde kurtarıcı.
11. Kalıcı haftalık "kilometre taşı" yedeği (ör. her sezon başı) ayrı slotta, 3 adet.

### 4.4 Versiyonlama ve migrasyon

- `schemaVersion` tamsayı. `migrations: Record<number, (old) => new>`; yüklemede `v → v+1 → ... → current` zinciri.
- Her migrasyon için **fixture kayıt dosyaları** depoda tutulur (`/packages/save/fixtures/v1.sav` ...) ve CI'da hepsi en güncel sürüme migrate edilip doğrulanır. **Hiçbir sürüm, önceki tüm şema sürümlerinin fixture testini geçmeden yayınlanmaz.**
- Migrasyondan önce orijinal dosyanın `pre-migration-vN.bak` kopyası.
- İleri uyumsuzluk: daha yeni sürümün kaydı eski istemcide açılırsa "Lütfen oyunu güncelleyin" (asla üzerine yazma).
- Simülasyon verisi (oyuncu veritabanı, lig yapısı) ile kullanıcı ilerlemesi ayrılsın; veri paketi güncellemesi ilerlemeyi bozmasın.

### 4.5 Bulut senkronizasyonu

| Seçenek | Platform | Not |
|---|---|---|
| Steam Auto-Cloud | Steam | Sıfır kod, önerilen. |
| iCloud (CloudKit / iCloud Documents) | iOS/macOS | Capacitor topluluk eklentileri veya küçük Swift eklentisi. |
| Google Play Games Services v2 – Saved Games | Android | Snapshots API; PGS v2 oturum açma otomatik. Capacitor için özel eklenti gerekebilir. |
| Kendi backend (Supabase/Firebase) | Tümü (çapraz platform) | Hesap gerektirir → Data safety ve hesap silme yükümlülükleri. Faz 2. |
| Manuel dışa/içe aktarma | Tümü | Her zaman mevcut olmalı. |

Çakışma çözümü: `updatedAt` + `playTimeSeconds` + cihaz adı gösterilerek **kullanıcıya seçtir** ("Bu cihaz: 12. sezon, 41 saat / Bulut: 11. sezon, 38 saat"). Asla sessizce üzerine yazma.

---

## 5. Adil Monetizasyon

### 5.1 NSS'den ders

New Star Soccer ve özellikle sonraki mobil sürümler (New Star Soccer G-Story, New Star Manager) için oyuncu şikâyetleri: enerji/ilişki barlarının "Star Bucks" ile hızla doldurulabilmesi, ilerlemenin para ile hızlandırılması (pay-to-win), reklam ve satın alma baskısı. Hedef: "**Paran oyunu kazandırmaz; yalnızca oyunu alırsın.**"

### 5.2 Modeller

| Model | Artı | Eksi | Öneri |
|---|---|---|---|
| **Premium (Steam)** $9.99–14.99 | Temiz, güven verici, Steam'de standart | Ön ödeme bariyeri | **Evet — PC birincil model.** Steam demo + Next Fest. |
| **Mobil: Ücretsiz deneme + tek seferlik tam sürüm kilidi** ($4.99–6.99) | Mağazada keşfedilebilir; tek ödeme ile her şey | Dönüşüm oranı düşük olabilir | **Evet — mobil birincil model.** Deneme: ilk 1–2 sezon veya belirli kariyer basamağı; kayıt tam sürüme aktarılır. |
| Mobil premium (ücretli indirme) | En basit | Mobilde keşfedilebilirlik çok düşük | Alternatif. |
| **Kozmetik-yalnız DLC/IAP** | Ek gelir, oyun dengesine dokunmaz | İçerik üretimi gerekir | Evet: forma/krampon tasarım paketleri, stadyum temaları, kutlama animasyonları, ev dekorasyonu. **İstatistik etkisi sıfır.** |
| İçerik genişletme (expansion) | Adil, Steam'de kabul görür | — | Yeni ligler, menajerlik modu, kadın futbolu kariyeri vb. |
| "Destekçi paketi" (soundtrack, artbook) | Topluluk sevgisi | Küçük gelir | Evet (Steam). |
| Ödüllü reklam | Gelir | Rahatsızlık, gizlilik yükü, ATT/Data safety | **Varsayılan olarak hayır.** Olursa yalnızca deneme sürümünde, isteğe bağlı, kozmetik ödüllü, tam sürümde tamamen kapalı. |
| Lootbox / gacha | — | Etik, yasal risk (Belçika, Hollanda geçmişi; olasılık açıklama zorunlulukları) | **Kesinlikle hayır.** |
| Enerji sistemi / zaman kapısı / premium para birimi | — | NSS'nin eleştirildiği nokta | **Kesinlikle hayır.** Oyun içi para yalnızca oynayarak kazanılır. |
| Abonelik | — | Tek oyunculu oyunda haksız | Hayır. |

### 5.3 Uygulama kuralları

- Tüm IAP'ler **non-consumable** (bir kez al, sonsuza dek; cihazlar arası geri yükleme).
- Fiyat şeffaflığı, yerelleştirilmiş fiyat (Türkiye için bölgesel fiyatlandırma; Steam TRY yerine USD fiyatlandırmaya 2023'te geçti — Steam bölge önerisi kontrol edilmeli).
- Ebeveyn kontrollerine uyum, satın alma onayı, "Geri yükle" butonu.
- Satın alma doğrulaması: başlangıçta yerel makbuz (StoreKit 2 `Transaction.currentEntitlements`, PBL `queryPurchasesAsync`); sunucusuz. Kırma (crack) önleme için aşırı çaba harcama — tek oyunculu oyunda kullanıcıyı cezalandırmasın.

---

## 6. Yerelleştirme, Erişilebilirlik, Analitik, CI/CD, Test, Determinizm

### 6.1 Yerelleştirme (i18n)

- Kütüphane: **i18next** (+ ICU MessageFormat eklentisi) veya **FormatJS / @formatjs/intl**. Çoğul kuralları, cinsiyet, sayı/para/tarih biçimleri için `Intl.*` API'leri.
- Başlangıç dilleri: **Türkçe, İngilizce**. Sonra: İspanyolca, Portekizce (BR), Almanca, Fransızca, İtalyanca, Endonezce.
- **Türkçe tuzakları**: `toUpperCase()` → `toLocaleUpperCase('tr-TR')` (i/İ, ı/I); sıralama için `Intl.Collator('tr')`; font'ta ğ ş ı İ glifleri; büyük harf başlıklarda locale'e duyarlı dönüşüm. Türkçe ekler (bulunma/yönelme hâli, ünlü uyumu) değişken isimlerle birleştiğinde sorun yaratır: "{kulüp}'e transfer oldu" → kulüp adının son ünlüsüne göre -a/-e, -ya/-ye. **Çözüm:** cümleleri ekten bağımsız kuracak şekilde yaz ("Transfer: {kulüp}") veya Türkçe için küçük bir ek-üreten yardımcı fonksiyon (`suffix(name, 'dative')`).
- Metin genişlemesi: Almanca ~%30 uzun → UI esnek; sabit genişlikli butonlardan kaçın.
- Metinler kodda değil JSON/YAML'da; anahtar tabanlı; eksik anahtar CI'da hata.
- Çeviri yönetimi: Crowdin/Weblate/Tolgee (topluluk çevirisi için Weblate açık kaynak).
- Phaser canvas içindeki metin minimumda tutulsun; mümkünse DOM overlay.
- Mağaza listeleri (store listing) ve ekran görüntüleri her dil için.

### 6.2 Erişilebilirlik

- **Renk körlüğü**: Takım renkleri yalnızca renge dayanmasın (forma deseni, şekil/ikon, harf etiketi). Deuteranopi/protanopi/tritanopi için palet ön ayarları; renk kontrastı WCAG AA (4.5:1 metin).
- **Font ölçeği**: %80–200 arası UI ölçeklendirme; CSS `rem` tabanlı; mobilde işletim sistemi font ölçeğine saygı (Capacitor `TextZoom` Android). Disleksi dostu font seçeneği (ör. Atkinson Hyperlegible, OpenDyslexic).
- Altyazı ve görsel ipuçları (ses efektleri için).
- Hareket azaltma: `prefers-reduced-motion`, kamera sarsıntısı/flash kapatma.
- Zaman baskısı ayarı: şut zamanlama penceresi genişletme, "yardımlı nişan" modu.
- Kontrol yeniden atama, tek elle oynanabilirlik.
- Ekran okuyucu: DOM UI'da semantik HTML/ARIA → menüler VoiceOver/TalkBack ile kullanılabilir (WebView bunu destekler).
- Referans: Game Accessibility Guidelines (basic + intermediate), Xbox Accessibility Guidelines.

### 6.3 Analitik ve çökme raporlama (gizlilik dostu)

- İlke: **varsayılan olarak minimum, açık onay (opt-in) ile ek**; reklam kimliği yok, uygulamalar arası takip yok → ATT gerekmez, Data safety basit.
- Çökme raporlama: **Sentry** (JS + Capacitor SDK + Electron SDK; `sendDefaultPii: false`, IP saklamama, kaynak haritası yükleme) veya kendi barındırılan **GlitchTip** (Sentry uyumlu, açık kaynak). Kayıt dosyası hash'i/şema sürümü bağlamı → kayıt bozulma hatalarını yakala.
- Ürün analitiği: kendi barındırılan **PostHog** (anonim mod) / **Aptabase** (oyunlar/uygulamalar için gizlilik odaklı, Tauri/Electron/Capacitor SDK'ları) / **Plausible** (web).
- Olaylar: oturum başlangıcı, öğretici adımları, sezon ilerlemesi, maç süresi, kayıt hata kodu, kilit açma. Kişisel veri yok.
- KVKK (Türkiye) ve GDPR: aydınlatma metni, gizlilik politikası URL'si (mağazalarda zorunlu), veri silme talebi e-posta adresi.

### 6.4 CI/CD (GitHub Actions)

| İş | Runner | Araçlar |
|---|---|---|
| Lint + typecheck + Vitest | ubuntu-latest | pnpm, `tsc --noEmit`, ESLint, Vitest (coverage) |
| Playwright E2E | ubuntu-latest (+ webkit) | `npx playwright install --with-deps`; Chromium + WebKit + mobil emülasyon |
| Web/PWA build & deploy | ubuntu-latest | Vite → Cloudflare Pages / Netlify / GitHub Pages (itch.io için butler) |
| **Android AAB** | ubuntu-latest | JDK 21, Android SDK 36, `npx cap sync android`, `./gradlew bundleRelease`, upload keystore GitHub Secrets'tan (base64), **Fastlane supply** veya `r0adkll/upload-google-play` ile internal track |
| **iOS IPA** | macos-latest (Xcode 26) | `npx cap sync ios`, **Fastlane match** (sertifikalar şifreli repo) + `gym` + `pilot` ile TestFlight; App Store Connect API anahtarı |
| **Windows** | windows-latest | electron-builder (NSIS/zip), kod imzalama (Azure Trusted Signing veya EV sertifika), Steam için zip deposu |
| **macOS** | macos-latest | electron-builder, universal (arm64+x64) veya ayrı, **notarization** (`notarytool`), hardened runtime |
| **Linux** | ubuntu-latest (eski glibc için ubuntu-22.04) | AppImage + Steam için dizin; Steam Linux Runtime (sniper) altında test |
| Steam yükleme | ubuntu-latest | `steamcmd` + `game-ci/steam-deploy` action, beta branch'e otomatik, default'a manuel |
| Sürümleme | — | Changesets veya semantic-release; `versionCode` otomatik artış |

Ek: Önbellek (pnpm, Gradle, CocoaPods), artefakt saklama, PR'larda önizleme web build'i, etiketle (tag) tetiklenen sürüm boru hattı, gizli anahtarlar yalnızca `environment: production` korumalı ortamda.

### 6.5 Test stratejisi

- **Vitest**: simülasyon birim testleri; **golden master / snapshot**: sabit seed ile 10 sezon simüle et, çıktının hash'i değişirse test başarısız (kasıtlı değişikliklerde snapshot güncellenir). Özellik tabanlı test (fast-check) ile değişmezler (gol sayısı ≥ 0, bütçe tutarlılığı, yaş artışı).
- Kayıt migrasyon fixture testleri (§4.4); bozuk dosya fuzz testi (rastgele bayt çevirme → yedekten kurtarma doğrulanır).
- **Playwright**: menü akışları, yeni kariyer → ilk maç → kaydet → yeniden yükle; görsel regresyon (canvas ekran görüntüsü, deterministik seed + `?testMode=1` ile animasyon sabitleme); mobil viewport'lar; çevrimdışı mod (`context.setOffline(true)`).
- Phaser sahne testleri: sahnelerden test kancası (`window.__game`) açığa çıkar; yalnızca test build'inde.
- Cihaz testleri: Firebase Test Lab / BrowserStack App Automate (düşük uçlu Android listesi), gerçek cihaz havuzu (en az 1 düşük uçlu Android, 1 eski iPhone, Steam Deck).
- Performans bütçesi testleri: Lighthouse CI (PWA), FPS ölçümü otomasyonu.

### 6.6 Deterministik simülasyon ve seed'li RNG

- `Math.random()` simülasyonda **yasak** (ESLint `no-restricted-properties` kuralı).
- RNG: **PCG32** veya **xoshiro128\*\*** / **sfc32** (32-bit, saf JS, hızlı). Durum (state) kaydın parçası → yükleme sonrası aynı sonuçlar (save-scum davranışı tasarım kararı: maç sonucu kayıttan önce mi belirlenecek?).
- Alt akışlar (substreams): `rng.fork('transfer')`, `rng.fork('match:1234')` → bir sistemdeki değişiklik diğerlerinin rastgele dizisini kaydırmaz.
- **Kayan nokta**: JS `number` IEEE-754 double; temel aritmetik platformlar arasında deterministik, ancak `Math.sin/cos/exp/pow` motorlara göre son bitte farklılaşabilir. Kritik simülasyonda: tamsayı/sabit nokta (fixed-point) aritmetik veya kendi trigonometri tablo/polinomları. Görsel-only fizik bu kısıta tabi değildir.
- **Sabit zaman adımı** (ör. 1/60 s) + birikimli zamanlayıcı + render interpolasyonu; simülasyon frame hızından bağımsız.
- Girdi kaydı + seed = **replay** (hata raporlarında yeniden üretim; "gol tekrarı" özelliği).
- Nesne üzerinde iterasyon sırası: `Map`/dizi kullan, sıralı anahtarlar; `Object.keys` sırasına güvenme (tamsayı benzeri anahtar tuzağı).
- Simülasyon ve oyun durumunda tarih/saat (`Date.now()`) kullanılmaz; oyun içi takvim kullanılır.

---

## 7. PC + Mobil Yayın İçin Teknik Gereksinim / Görev Kontrol Listesi

### A. Proje altyapısı
1. pnpm workspaces monorepo kur (`apps/*`, `packages/*`).
2. TypeScript `strict: true`, `noUncheckedIndexedAccess: true`.
3. Vite yapılandırması: `base: './'` (Capacitor/Electron `file://` uyumu), `build.target: 'es2020'`.
4. Phaser 4 sürümünü `~4.2.x` olarak sabitle; güncellemeleri ayrı PR ile al.
5. ESLint + Prettier + `no-restricted-properties` ile `Math.random`/`Date.now` simülasyonda yasak.
6. `packages/sim` içinde DOM/Phaser import'u yasak (ESLint `import/no-restricted-paths`).
7. `Platform` arayüzü (haptics, IAP, achievements, cloud, share, storage) ve web/capacitor/electron implementasyonları.
8. Ortam bayrakları: `__PLATFORM__`, `__STEAM__`, `__DEMO__` derleme zamanı sabitleri.
9. Kaynak haritaları (source maps) üret, yayın paketine koyma, Sentry'ye yükle.
10. Lisans uyumluluk taraması (font, ses, kütüphane lisansları) — `license-checker`.

### B. Motor ve render
11. Phaser Scale Manager: 1920×1080 mantıksal, FIT + genişletilmiş alan.
12. DPR üst sınırı (masaüstü 2, mobil düşük kalite 1.5/1).
13. Texture atlas boru hattı (otomatik paketleme script'i).
14. Grafik kalite ön ayarları: Düşük/Orta/Yüksek + otomatik algılama.
15. Menülerde oyun döngüsünü uyut veya 30 FPS'e düşür.
16. Object pool'lar (top izleri, partiküller, oyuncu sprite'ları).
17. WebGL context kaybı (`webglcontextlost/restored`) yönetimi.
18. Sabit adımlı simülasyon + render interpolasyonu.
19. FPS/bellek debug overlay'i (yalnızca dev).
20. 120/144 Hz ekranlarda doğru davranış testi.

### C. UI ve UX
21. DOM UI katmanı + Phaser canvas birleşimi (z-index, input yönlendirme).
22. Tüm ekranlar klavye, fare, dokunmatik ve gamepad ile gezilebilir.
23. Gamepad odak sistemi (spatial navigation).
24. Dinamik buton ikonları (klavye/Xbox/PS/Deck).
25. Safe-area inset'lerine saygı (iOS çentik, Android kesik, Dynamic Island).
26. Dikey ve yatay duyarlı yerleşim; ≥600dp ekranlarda yönlendirme kilidi olmadan çalışma.
27. Metin seçimi, uzun basma menüsü, çift dokunma zoom'u devre dışı.
28. Android geri tuşu/geri hareketi (predictive back) ile doğru menü geri gezinmesi.
29. Duraklat menüsü: uygulama arka plana geçince otomatik duraklat.
30. Yükleme ekranları < 3 sn (orta segment cihaz).

### D. Giriş
31. Swipe-to-shoot: zaman damgalı örnekleme, frame bağımsız hız hesaplama.
32. Alternatif şut kontrol şeması (dokun + güç çubuğu).
33. Fare sürükleme şut + klavye alternatifi.
34. Gamepad API eşlemesi (standard mapping), ölü bölge ayarı.
35. Tüm kontrollerin yeniden atanabilmesi.
36. Sol el modu / dokunma alanı ölçeği.
37. Haptik geri bildirim (ayarlardan kapatılabilir).
38. Gamepad titreşimi (destekleniyorsa).
39. Girdi olaylarının deterministik replay formatında kaydı.
40. Steam Deck sanal klavye entegrasyonu (isim girişi).

### E. Simülasyon ve determinizm
41. Seed'li RNG (PCG32/xoshiro) + alt akış (fork) desteği.
42. RNG durumu kayıt dosyasında saklanır.
43. Kritik simülasyonda platform bağımsız matematik (sabit nokta veya kendi trig).
44. Sezon toplu simülasyonu Web Worker'da.
45. Golden master snapshot testi (sabit seed, N sezon).
46. Özellik tabanlı testler (fast-check) ile değişmezler.
47. Replay sistemi (seed + girdi) ile hata yeniden üretimi.
48. Oyun içi takvim; gerçek saat simülasyona sızmaz.
49. Simülasyon performans bütçesi: 1 sezon < 2 sn (düşük uçlu Android, Worker).
50. Veri paketleri (oyuncu/lig verisi) ilerlemeden ayrı ve sürümlü.

### F. Kayıt sistemi
51. `SaveStore` arayüzü + IndexedDB / Capacitor Filesystem / Node fs adaptörleri.
52. Kayıt zarfı: magic, schemaVersion, gameVersion, checksum, timestamp.
53. Atomik yazma: tmp → fsync → doğrula → rename.
54. 3 nesil rotasyonlu yedek + sezon başı kilometre taşı yedekleri.
55. Yüklemede checksum doğrulama ve yedekten otomatik kurtarma + kullanıcı bildirimi.
56. Yazma kuyruğu / mutex.
57. Arka plana geçiş, kapanış ve maç sonu otomatik kayıt.
58. Disk dolu / kota hatası yönetimi (eski kayıt korunur).
59. Şema migrasyon zinciri + her sürüm için fixture testleri.
60. Migrasyon öncesi orijinal kopya (`pre-migration` yedeği).
61. Daha yeni sürüm kaydı için "güncelle" uyarısı; üzerine yazmama.
62. Kayıt dışa/içe aktarma (dosya + paylaşım sayfası).
63. Kayıt sıkıştırma (gzip) + Zod/Valibot şema doğrulama.
64. Bozuk dosya fuzz testi CI'da.
65. Web: `navigator.storage.persist()` çağrısı ve sonucu kullanıcıya bildirme.
66. Steam Auto-Cloud yapılandırması (Windows/macOS/Linux yolları).
67. iCloud ve Google Play Games Saved Games entegrasyonu (Faz 2).
68. Bulut çakışma çözüm ekranı (kullanıcı seçer).
69. Ayarlar (Preferences) ve kariyer kayıtları ayrı depolarda.
70. Kayıt hata kodlarının Sentry'ye anonim raporlanması.

### G. Mobil (Capacitor)
71. Capacitor 8; Android minSdk 24, target/compileSdk 36; iOS 15+.
72. Xcode 26 / iOS 26 SDK ile derleme.
73. Edge-to-edge uyumu (Android 15/16), status/navigation bar inset'leri.
74. Splash screen ve uygulama ikonları (adaptive icon, iOS tüm boyutlar) — `@capacitor/assets`.
75. Ses oturumu yönetimi (iOS sessiz anahtar, arka plan duraklatma).
76. WKWebView süreç sonlanması sonrası kurtarma.
77. Düşük uçlu Android referans cihazında 30+ FPS maç, < 5 sn soğuk açılış.
78. AAB boyutu < 40 MB, IPA < 60 MB.
79. Tam çevrimdışı çalışma (uzaktan asset yok).
80. Android TextZoom / iOS Dynamic Type etkileşiminin kontrolü.
81. Play Billing Library 8+ ile IAP (non-consumable tam sürüm kilidi).
82. StoreKit 2 ile IAP + "Satın Alımları Geri Yükle".
83. Çevrimdışı satın alma durumunun önbelleklenmesi.
84. Privacy Manifest (`PrivacyInfo.xcprivacy`) ve required-reason API beyanları.
85. App Store Privacy Nutrition Labels doldurulması.
86. Google Play Data safety formu.
87. IARC (Play) ve Apple yeni yaş derecelendirme anketi (13+/16+ değerlendirmesi: alkol/gece hayatı/kumar teması).
88. ATT gerekmeyecek şekilde takip/IDFA kullanmama; reklam eklenirse kişiselleştirilmemiş.
89. Play kapalı test (yeni hesaplarda 12 test kullanıcısı / 14 gün) planı.
90. Mağaza listeleri: TR + EN açıklama, ekran görüntüleri (telefon, 7"/10" tablet, iPad), tanıtım videosu.

### H. Masaüstü (Electron + Steam)
91. Electron güvenlik: contextIsolation, sandbox, nodeIntegration kapalı, Fuses.
92. steamworks.js main süreçte; IPC beyaz listesi.
93. Steam Overlay etkinleştirme ve test (Windows/Linux).
94. Başarımlar ve istatistikler (Steamworks panelinde tanımlı, oyun içinde tetiklenir).
95. Steam olmadan başlatılınca `restartAppIfNecessary`.
96. Borderless/tam ekran/pencereli modlar; `Alt+Enter`/`F11`.
97. 16:10, 21:9, 32:9 ve 1280×800 (Steam Deck) yerleşim testleri.
98. Steam Deck Verified kriterleri (kontrolcü, metin boyutu, sanal klavye, varsayılan yapılandırma).
99. Windows kod imzalama (SmartScreen uyarısını önleme).
100. macOS imzalama + notarization + hardened runtime; Apple Silicon yerel build.
101. Linux build Steam Linux Runtime (sniper) üzerinde test.
102. Pencere boyutu/konumu ve ekran seçimi kalıcılığı.
103. Steam Input / gamepad yapılandırma şablonu.
104. Steam sayfası: kapsül görseller, demo, Next Fest katılımı, mağaza yerelleştirmesi (TR/EN).

### I. Yerelleştirme ve erişilebilirlik
105. i18next/FormatJS + ICU çoğul/cinsiyet desteği.
106. Türkçe locale'e duyarlı büyük/küçük harf ve sıralama (`tr-TR`).
107. Türkçe ek üretici yardımcı veya eksiz cümle tasarımı.
108. Eksik çeviri anahtarı CI kontrolü.
109. Font alt kümeleri (Türkçe glifler dahil) ve disleksi dostu font seçeneği.
110. Renk körlüğü paletleri + renk dışı ayırt edici işaretler.
111. UI ölçeklendirme %80–200.
112. Hareket azaltma, ekran sarsıntısı/flash kapatma.
113. Zamanlama penceresi / yardımlı nişan ayarları.
114. Ekran okuyucu ile menü gezinme testi (VoiceOver, TalkBack, NVDA).

### J. Analitik, gizlilik, uyumluluk
115. Sentry/GlitchTip entegrasyonu (web, Capacitor, Electron) — PII kapalı.
116. Opt-in analitik (Aptabase/PostHog), ilk açılışta açık onay ekranı.
117. Gizlilik politikası (TR/EN), KVKK aydınlatma metni, GDPR uyumu.
118. Veri silme/iletişim kanalı.
119. Analitik olayların çevrimdışı kuyruklanması.

### K. CI/CD ve test
120. GitHub Actions: lint, typecheck, Vitest her PR'da.
121. Playwright E2E (Chromium + WebKit + mobil viewport) her PR'da.
122. Android AAB imzalı build + Play internal track yükleme (Fastlane).
123. iOS build + TestFlight yükleme (Fastlane match/gym/pilot, App Store Connect API anahtarı).
124. Windows/macOS/Linux Electron build'leri + imzalama/notarization.
125. Steam beta branch'e otomatik yükleme (steamcmd / steam-deploy).
126. PWA build + önizleme deploy (PR başına).
127. Sürüm numarası ve `versionCode`/`CFBundleVersion` otomatik artış.
128. Gizli anahtarlar korumalı ortamlarda; keystore yedeği güvenli kasada (kaybı = Play güncellemesi yapamama riski, Play App Signing ile hafifletilir).
129. Gerçek cihaz test matrisi (düşük uçlu Android, eski iPhone, tablet, Steam Deck, Mac, Windows dizüstü).
130. Performans bütçesi CI kontrolleri (bundle boyutu, Lighthouse PWA skoru).

### L. Monetizasyon ve yayın
131. Mobil deneme → tam sürüm kilidi akışı; deneme kaydı tam sürüme aktarılır.
132. Kozmetik içeriğin oyun istatistiklerine etkisinin sıfır olduğunun kodda zorlanması (kozmetik ID'ler sim'e girmez).
133. Lootbox, enerji sistemi, premium para birimi olmadığının tasarım kuralı olarak belgelenmesi.
134. Bölgesel fiyatlandırma (Steam, Play, App Store fiyat katmanları).
135. Yayın sonrası güncelleme politikası: her güncellemede kayıt uyumluluğu garantisi ve sürüm notları.

---

## 8. Açık Kararlar / Sonraki Adımlar

1. **Teknik prototip (2 hafta):** Phaser 4 + Capacitor ile swipe şut prototipi; hedef düşük uçlu Android cihazda FPS ve pil ölçümü. Başarısızlık kriteri: maç sahnesinde < 30 FPS → render optimizasyonu veya PixiJS değerlendirmesi.
2. Electron + steamworks.js "hello Steam" (başarım + overlay + Auto-Cloud) Steam Deck'te test.
3. Kayıt sistemi paketinin (`packages/save`) her şeyden önce, testleriyle birlikte yazılması.
4. Save-scum politikası (maç sonucu kayıttan önce mi belirlenir?) — oyun tasarımı kararı.
5. Bulut kaydın Faz 1 kapsamı: yalnızca Steam Auto-Cloud + manuel dışa aktarma; iCloud/PGS Faz 2.
6. Ödüllü reklamın tamamen dışarıda bırakılması kararının onaylanması.

---

## Kaynaklar

- Phaser 4 sürümleri: https://phaser.io/download/stable · https://phaser.io/download/phaser4 · https://gamedev.net/news/4825-phaser-v421-released/
- Google Play hedef API: https://developer.android.com/google/play/requirements/target-sdk · https://support.google.com/googleplay/android-developer/answer/11926878 · https://dev.to/mr_manushukla/android-target-api-36-is-due-aug-31-2026-api-37-is-next-the-play-store-migration-checklist-2f9i
- Play Billing Library 8: https://www.revenuecat.com/blog/engineering/play-billing-8-migration · https://foresightmobile.com/blog/google-play-billing-library-8-migration
- Capacitor 8: https://capawesome.io/docs/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8/ · https://capgo.app/docs/upgrade/from-v7-to-v8/ · https://capgo.app/blog/xcode-26-requirement-for-capacitor-apps/
- Apple SDK gereksinimleri: https://developer.apple.com/news/upcoming-requirements/
- Apple yaş derecelendirmesi: https://www.pocketgamer.biz/apple-overhauls-app-store-age-ratings-with-new-categories · https://www.igeeksblog.com/apple-app-store-age-ratings/
- steamworks.js: https://www.npmjs.com/package/steamworks.js · https://gittrend.io/repo/ceifa/steamworks.js · steamworks-ffi-node: https://alternativeto.net/software/steamworks-ffi-node
- Steam Overlay / WebView2 kısıtları: https://github.com/MicrosoftEdge/WebView2Feedback/discussions/4019 · https://construct.net/en/make-games/addons/1105/steamworks-webview2/documentation
- Tauri Linux grafik sorunları: https://v2.tauri.app/develop/debug/linux-graphics/
- Tauri + Steam: https://forum.gdevelop.io/t/implementing-steam-achievements-with-tauri/73202
- Godot web export (C# yok): https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html · https://app.cinevva.com/news/2025-09-18-godot-4-5-release

> Not: Mağaza politikaları (özellikle ABD/AB'de harici ödeme bağlantıları, Google geliştirici doğrulaması) hızla değişiyor; yayından 4–6 hafta önce Play Console Policy Center ve App Store Review Guidelines yeniden kontrol edilmelidir. Bazı ayrıntılar (Steam Deck metin boyutu, PGS Saved Games Capacitor eklentisi durumu, Phaser 4 KTX2 desteği) bu raporda genel bilgiye dayanır ve prototip aşamasında doğrulanmalıdır.
