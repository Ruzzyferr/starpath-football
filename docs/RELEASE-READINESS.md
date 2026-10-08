# StarPath Football: Yayın Hazırlığı (RELEASE-READINESS)

> Tarih: 2026-10-08 · Hazırlayan: Yapımcı · Kaynak: `docs/GAP-AUDIT.md` bölüm 0.00 (S30 son sayım). Kod bu turda değiştirilmedi, testler koşturulmadı; sayılar belge ve hedefli kod kontrolüne dayanır.

## 1. Özet

Oyun, kodla yapılabilecek kısmın büyük bölümünü tamamladı: 569 P0 maddenin 389'u (%68) TAMAM, 128 GDD [v1] maddesinin 126'sı TAMAM. Kalanın önemli kısmı dış hesap, cihaz, hukuk ve insan emeği ister; kod tarafı bunlara hazır bekliyor.

| Ölçüt | Sayı |
|---|---:|
| P0 maddeleri (ANALIZ-VE-PLAN §2) | 569 |
| TAMAM | 389 |
| KISMİ | 47 |
| EKSİK | 10 |
| ERTELENDİ, BLOCKED-EXTERNAL | 28 (+8 KISMİ/EKSİK satır dış bağımlı = 36) |
| ERTELENDİ, iç | 55 |
| N/A-süreç (hukuk, mağaza, operasyon) | 40 |
| GDD [v1] (128): TAMAM / KISMİ / EKSİK | 126 / 1 / 0 (+1 Steam doğrulaması dış bağımlı) |
| İç backlog (dış hizmet gerektirmeyen açık satır) | 104 |

İç backlog 104 satırdır ama ağırlığı düşüktür: 2.7'deki 32 ertelenmiş satırın çoğu cila ya da bilinçli tasarım kararı, 2.4/2.5 satırlarının çoğu "v1.1 / v2" içerik ve denge işi. 1.0'ı bloke eden bir iç kod açığı **görünmüyor**. 1.0'ı bloke eden şey dış süreçlerdir (bölüm 4).

Sayım uyarısı: 2.1-2.5, 2.8, 2.9, 2.12 ham tablo satırlarının metni bayat; güncel durum 2.0/2.0b bölümlerinde. Rastgele 44 TAMAM satırı koda karşı kontrol edildi, hiçbiri düşürülmedi.

## 2. Yapılanlar (özet)

- Maç motoru: seed'li deterministik sim, 5 yeni an tipi (çalım, kafa, kaleci 1v1/çıkış, bek arka direk), duran toplar, hakem kişilikleri, bullet-time, pas/şut/kafa fiziği, kalibrasyon testleri (xG bantları, sezon gol bandı), bot ve e2e demo.
- Kariyer: antrenman mini oyunları (rondo, koni, 9 bölgeli şut, falso kapısı, refleks duvarı), sakatlık tablosu, sözleşme pazarlığı, itibar modeli, perk ağacı, emeklilik, Onur Listesi, özel zorluk.
- Dünya: tam seed'li dünya, ülke bazlı kurallar, kupalar, milli takım turnuvası, kadın piramidi, 50/100 sezon kararlılık testi, veri modları.
- Yaşam/ekonomi: olay motoru, ilişkiler, sosyal, kumarhane (derleme bayrağıyla kapatılabilir), vadeli mevduat, sponsorlar, varlıklar.
- Sunum/ses: HUD, TV skor bandı, hava, kalabalık sesi, müzik, menü sesleri (hepsi WebAudio sentezi).
- Platform/QA: Electron (CSP, fuse, izinler), Capacitor sağlayıcısı, kayıt yedekleri/sağlama, determinizm ve çapraz motor testleri, bütçe/lisans CI, 28 e2e spec, erişilebilirlik (axe, 200% ölçek, uzun metin), yerelleştirme (TR/EN, ICU alt kümesi), yerel topluluk ve canlı operasyon (takvim, geri bildirim, imzalı mod).
- Hukuk/mağaza taslakları: `docs/legal/*`, `docs/store/LISTING.md`, `AGE-RATING.md`, `docs/PLATFORM.md`.

## 3. İç backlog: iş paketleri (dış hizmet gerektirmez)

Hepsi tek başına yapılabilir; sim dosyalarına dokunanlar golden master'ı bilinçli yeniler (`UPDATE_GOLDEN=1`) ve `docs/BALANCE.md` hedeflerini korur.

### WP-S · Belge/tablo reconcile (0.5 gün, sıfır risk)
- Satırlar: 2.1-2.5, 2.8, 2.9, 2.12 ham tabloları. Dosya: `docs/GAP-AUDIT.md`.
- Kabul: ham tablo durumları 2.0/2.0b ile aynı; bir betik (`scripts/gap-count.mjs`) sayıları üretir ve bölüm 0.00 ile eşleşir; 2.9#57/#60/#87/#88/#94 ERTELENDİ-BLOCKED olarak ayrı satır.

### WP-T · Tip ve kod borcu (3-5 gün)
- Satırlar: 2.9#2 (`noUncheckedIndexedAccess`, 1.714 hata), 2.7#2 (138 sabit hex), #8 (40 yarıçap), #7 (aralık ölçeği linti), #128 (`Price` tipi), 2.9#97 (odak halkası denetimi), 2.9#70 (iOS ses oturumu kodu var, cihaz doğrulaması ayrı).
- Dosyalar: `game/tsconfig.app.json`, `ui/styleAudit.node.test.ts`, `styles/*.css`, `ui/format.ts`.
- Kabul: dizin dizin `noUncheckedIndexedAccess` açık ve `tsc -b` yeşil; styleAudit sayaçları sıfıra ya da düşürülmüş tavana iner; stylelint ya da eşdeğer test boşluk ölçeğini zorlar.

### WP-V · Kayıt formatı ve tekrar (4-6 gün, tek migrasyon paketi)
- Satırlar: 2.2#48 (tekrar kalıcı), 2.10#34 (seed+girdi kaydı; `game/inputReplay.ts` zaten var, bağla ve doğrula), 2.7#55 (sezon bazlı özellik geçmişi), 2.7#98 (slot küçük resmi), 2.9#40 (zarf alanları, SHA-256), 2.9#36 (sürümlü veri paketi), 2.9#26/#31 (rng.fork akışı, gecelik 10.000 sezon istatistik koruması), 2.12#73 (klip kaydı: `MediaRecorder`), 2.10#40 kalan (video klip).
- Dosyalar: `state/save.ts`, `game/runtime.ts`, `game/inputReplay.ts`, `core/rng.ts`, `.github/workflows/nightly.yml`.
- Kabul: eski kayıt migrasyon testiyle yüklenir (`.premigrate` yedeği); aynı seed+girdi kaydı bire bir aynı maçı yeniden oynatır (e2e); golden bilinçli yenilenir; nightly istatistik koruması CI'da yeşil.

### WP-B · Denge turu v1.1 (3-4 gün)
- Satırlar: 2.1#6 (güç farkı kalibrasyonu), 2.3#3 (arketip 40 puan), #13 (yaş çarpanları), 2.4#4 (ilişki sönümü %2), 2.5#15, #18, #24, #60 (harcama eğrisi, uyku, sponsor formülü), 2.5#92/#99/#102 (10M spin betiği, sızıntı kuralı, men süreleri), 2.5#125 (CI denge raporu).
- Dosyalar: `sim/match/engine.ts`, `sim/career/createHero.ts`, `progression.ts`, `sim/life/relationships.ts`, `sponsors.ts`, `casino.ts`, `sim/game/balanceSim.ts`, `docs/BALANCE.md`.
- Kabul: `BALANCE.md` hedefleri (18/21/25 itibar = 15/52/79, ST 66-70 gol, sakatlık 3,4-4,1 hf/sezon) korunur; 50/100 sezon kararlılık testi yeşil; her değişiklik BALANCE.md'de gerekçeli.

### WP-U · Ayarlar ve UI bağlama (4-5 gün)
- Satırlar: 2.4#3, #24, #113 (bant açıklaması, partner tercihi, şeffaflık ayarı), 2.5#1-#3 (para biçimi, simgesiz fiyat linti, kazanç dökümü ekranı; `EconomyBreakdown` verisi hazır), 2.7#22, #38, #39, #42 (tek CTA, danger, chip ikonu denetimi), #16 (tip ölçeği), #48 (satış geri al), #83, #87-#90, #94 (neden paneli genişletme, kayıp limiti zorlaması, sabır tahmini, kulüp ilgisi, haber-olay bağı, kulüp kırılımı), #81/#82/#84/#86 (yaşam ekranları), 2.3#11 (OVR açıklama ekranı).
- Dosyalar: `ui/screens/SettingsScreen.tsx`, `ui/screens/life/*`, `ui/screens/WorldScreen.tsx`, `InboxScreen.tsx`, `ContractScreen.tsx`, `ui/components/*`, `sim/life/casino.ts`.
- Kabul: her madde için ilgili ekranda görünür kontrol ve en az bir e2e/birim test; 390 px ve 1280 px'te taşma yok; axe ihlali 0.

### WP-C · Kariyer ve sözleşme derinliği (3-4 gün)
- Satırlar: 2.3#2 (Altın Eldiven ve kaleci reyting formülü, ek kaleci dril), #10 (kadın ligi yapısı + cinsiyet metin testi), #39 (3 dal × 3 kademe perk), #60 (garanti/sigorta/imaj hakkı UI), #70 (kış penceresi 4 hafta), #82 (TD güveni eşikleri, 2.4#46 ile çelişki çözümü), 2.5#55 (performans bonusu şablonu), 2.1#85 (kaleci tutma/atma/çıkış kontrolü), GDD kaleci özellik grupları.
- Dosyalar: `sim/career/contract.ts`, `progression.ts`, `squadRole.ts`, `sim/game/internal.ts`, `game/ai.ts`, `highlightGen.ts`, `core/types.ts`.
- Kabul: kural başına birim test; kayıt migrasyonu varsa WP-V ile birlikte; golden yenilenir.

### WP-E · Olay ve içerik v1.1 (5-8 gün, sırayla bölünebilir)
- Satırlar: 2.4#7 (olay DSL linter), #11, #14, #36, #37, #47, #52, #53, #79, #99, #100, #110, #114, #118; 2.5#29, #63, #64, #71, #84; 2.12#13 (arma kara listesi), #52 (kendi maçına bahis); 2.6#16 (itibar görünüm ölçeği); 2.11#47 (olay metinleri veri dosyasına).
- Dosyalar: `sim/life/events/**`, `data/assets.ts`, `ui/screens/life/Relations.tsx`, `sim/world/generate.ts`.
- Kabul: `content.test.ts` yeni şemayı doğrular; TR ve EN metin cinsiyet testi geçer; içerik başına en az bir olay tetikleme testi.

### WP-P · Performans ve sunum (3-4 gün)
- Satırlar: 2.9#12, #13, #16 (FIT tasarım alanı, mobil DPR profili, nesne havuzu), 2.2#24, #26 (oyuncu animasyon atlası, vuruş pozu; prosedürel çizimle), 2.7#66-#68 (Phaser sahnesi UI), 2.9#30 (v2; isteğe bağlı Web Worker).
- Dosyalar: `game/MatchScene.ts`, `game/view.ts`, `game/physics.ts`.
- Kabul: `perf.spec.ts` p5 kare süresi bütçede (masaüstü Low <%2 kare 30 fps altı), 10 maç montajı yığın artışı <5 MB; DPR profili birim testli.

### Bilinçli sapmalar (iş paketi değil, kararı imzalayın)
2.7#21 (sekme yapısı), #78 (hub sırası), #79 (7 adımlı sihirbaz), #114 (özel avatar editörü), 2.9#1 (monorepo yok), 2.12#118 (menüde 30 FPS sınırı gereksiz), 2.9#15 (atlas: doku yok). Yapımcı olarak "böyle kalsın" öneriyorum; onaylanırsa satırlar "KABUL EDİLEN SAPMA" olur.

## 4. BLOCKED-EXTERNAL: sahibin yapacakları

| # | Konu | Sahibin yapması gereken | Kod tarafı / hazır olan | Madde |
|---|---|---|---|---|
| 1 | Windows imzalama | EV ya da OV kod imzalama sertifikası satın al; CI sırlarına `CSC_LINK`, `CSC_KEY_PASSWORD` ekle | `electron-builder.yml`, `release.yml` | 2.9 |
| 2 | macOS imza + notarization | Apple Developer Program (99 USD/yıl), Developer ID Application sertifikası, `APPLE_ID`, uygulama parolası, `APPLE_TEAM_ID` | notarize adımı iş akışında hazır | 2.9#63, #99 |
| 3 | iOS yayın hattı | Apple Developer hesabı, App ID, provisioning profile, TestFlight, gerçek iPhone | `capacitorProvider.ts`, Capacitor projesi; iOS CI ve TestFlight hattı henüz yok (hesap gelince eklenir) | 2.9#63, #116 |
| 4 | Android imzalı yayın | Google Play Console (25 USD), upload keystore üret (`PLATFORM.md` komutu), Play App Signing, imzalı AAB | yalnızca debug APK CI'da | 2.9#115 |
| 5 | Steam | Steamworks partner hesabı + app id (100 USD), depot/branch, `steamcmd` hesabı, gerçek başarım ve Auto-Cloud doğrulaması | `steamworks.js` isteğe bağlı bağımlılık, `main.cjs` entegrasyonu, depot betiği | 2.9#57, #87, #88, #118; 2.10 |
| 6 | Steam Deck / gamepad | Fiziksel Steam Deck ve en az bir gamepad ile test oturumu | menü navigasyonu ve eşlemeler kodda | 2.9#94 |
| 7 | Uygulama içi satın alma | App Store Connect ve Play Console'da ürün kimlikleri (tam kariyer, kozmetik paketler); sunucu tarafı makbuz doğrulaması için küçük backend ve mağaza API anahtarları | `store-iap/catalog.ts`, `capacitorProvider.ts` (`TODO(server)`), deneme kilidi | 2.5#112-#120; 2.9#127 |
| 8 | Çevrimiçi lider tablosu, haftalık meydan okuma, sunucu seed | Backend (sunucu, veritabanı, kötüye kullanım önlemi), oyun hizmeti kimliği (Steam / Game Center / Play Games) | yerelde seed haftadan türetilir; çevrimiçi anahtar varsayılan kapalı | 2.10#2, #101-#103, #76 |
| 9 | Bulut kayıt | Backend + hesap sistemi (ya da yalnızca Steam Auto-Cloud + iCloud/Play bulut yedeği) | Ayarlarda yer tutucu | 2.9#6, #60; 2.7#99 |
| 10 | Çökme raporu / analitik | Toplama uç noktası (Sentry vb.) ve rıza metni | yerel opt-in günlük, FPS özeti | 2.9#107; 2.10#88 |
| 11 | Hukuk incelemesi | Avukat: gizlilik politikası, kullanım şartları (`docs/legal/*` TASLAK), kumarhane/simüle kumar ve yaş sınırı, ödül ve kıta adları, marka taraması (StarPath adı, "Anadolu Ligi", kulüp adları), arma/isim gerçek kişi taraması | taslaklar, `npm run legal`, `AGE-RATING.md`, kumarhane derleme bayrağı | 2.9#111; 2.12 (39 N/A-süreç), #11, #58 |
| 12 | Mağaza sayfaları | Ekran görüntüleri ve fragman, simge, yaş derecelendirme anketleri (IARC, ESRB/PEGI/USK), Apple gizlilik etiketi, Play veri güvenliği formu, mağaza beyanı (2.5#105) | `docs/store/LISTING.md` taslağı | 2.12 mağaza maddeleri |
| 13 | Çeviri | Profesyonel TR/EN pazarlama ve olay metni gözden geçirmesi (ek diller istenirse çevirmen) | TR/EN anahtarlar, ICU alt kümesi, cinsiyet testi | 2.11#47, #58 |
| 14 | Ses ve sanat varlıkları | Kayıtlı ses/müzik (ses sanatçısı ya da lisanslı paket; `LICENSES.csv` kapısı hazır, 2 MB bütçe), maç görselleri için sanatçı (atlas), mağaza görselleri | tüm sesler WebAudio sentezi, tüm görseller prosedürel | 2.8#57; 2.9#15 |
| 15 | Gerçek cihaz testi | Orta/düşük sınıf Android, iPhone, iPad: FPS, ısınma, pil, güvenli alan, dokunma ergonomisi, haptik, sistem yazı boyutu, paylaşım/dosya diyaloğu | 390 px e2e, CPU 4x kısıtlı profil | 2.8#51; 2.9#23, #50; 2.11#6; 2.2#119 |
| 16 | Ekran okuyucu oturumu | NVDA, VoiceOver, TalkBack ile gerçek kullanıcı oturumu | `docs/ACCESSIBILITY.md` senaryosu, axe e2e | 2.11#13 |
| 17 | Canlı operasyon | Topluluk yöneticisi, destek kanalı, sezonluk etkinlik takvimi, analitik paneli, yorum/puan istemi (StoreKit/Play API) | yerel olay takvimi, haber, geri bildirim formu | 2.10 (EKSİK 15), 2.7#129 |

## 5. 1.0 Go / No-Go kontrol listesi

Kod (şimdi doğrulanabilir; sahibi: mühendislik)
- [ ] `npm run lint`, `tsc -b`, `npx vitest run` temiz (golden master bilinçli yenilenmiş).
- [ ] Playwright e2e süiti tam geçiyor (28 spec), `perf.spec.ts` ve `hardening.spec.ts` eşikleri geçiyor.
- [ ] 50/100 sezon kararlılık ve gecelik soak yeşil; kayıt fuzz/crash-injection yeşil.
- [ ] Paket boyutu ve ses bütçesi CI kapıları yeşil; `LICENSES.csv` eşitliği geçiyor.
- [ ] Release build'de `FEATURE_CASINO` kararı verilmiş (bölgesel yaş/yasa için bayrak), `VITE_` sırları yok.
- [ ] WP-S tamam (belge sayımı tekrar üretilebilir).
- [ ] Bilinçli sapmalar (bölüm 3 sonu) yazılı onaylandı.

Hukuk ve süreç (sahibi: yapımcı/hukuk)
- [ ] Gizlilik politikası ve kullanım şartları avukat onaylı, `npm run legal` ile yeniden üretilmiş.
- [ ] Marka taraması (StarPath, lig/kulüp adları, "New Star" benzerliği yok) ve gerçek kişi/arma taraması temiz.
- [ ] Yaş derecelendirmesi alınmış (simüle kumarhane içeriği beyan edilmiş).
- [ ] Ödül/kıta adı doğrulaması (2.12#11) imzalı.

Platform (en az hedeflenen kanal için; web/Steam ile başlanabilir)
- [ ] Windows kod imzası ve SmartScreen testi (Steam dışı dağıtım için).
- [ ] Steam: app id, depot, başarımlar, Auto-Cloud ve overlay gerçek istemcide test edildi; Steam Deck doğrulaması (isteğe bağlı).
- [ ] iOS/Android: imzalı sürüm, TestFlight/dahili test, gerçek cihaz FPS ve güvenli alan testi geçti.
- [ ] IAP ürünleri ve makbuz doğrulaması (mobil için zorunlu, Steam için gerekmez); deneme kilidi mağaza ürünleriyle denendi.

Kalite ve içerik
- [ ] Gerçek cihazda en az 10 kişilik kapalı oyun testi: ilk 30 dakika, ilk sezon, emeklilik akışı, çökme ve yarım kalan kayıt bildirimi yok.
- [ ] Ekran okuyucu oturumu raporu (2.11#13), kritik bulgu yok.
- [ ] Mağaza sayfası: ekran görüntüleri, fragman, TR/EN profesyonel metin.
- [ ] Çökme raporu ve geri bildirim kanalı canlı (en azından yerel günlük + destek e-postası).

Karar kuralı
- **GO**: kod listesi tamam VE hedef kanal için hukuk + imzalama + gerçek cihaz kutuları tamam.
- **Web/itch/Steam-only soft launch**: mobil IAP, bulut, çevrimiçi tablo hariç tutularak (bu özellikler 1.0'da kapalı kalır) yalnızca hukuk, marka ve Steam kutularıyla çıkılabilir.
- **NO-GO**: hukuk onayı yok, imzasız masaüstü paket, gerçek cihaz testi yapılmamış mobil sürüm ya da kayıt kaybı/determinizm hatası açık.
