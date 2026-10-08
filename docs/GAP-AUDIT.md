# StarPath Football: Uygulama ve Plan Boşluk Denetimi (GAP-AUDIT)

> Tarih: 2026-10-07 · Hazırlayan: Yapımcı / QA · Kapsam: `docs/GDD.md` içindeki tüm **[v1]** maddeleri ve `docs/ANALIZ-VE-PLAN.md` bölüm 2'deki tüm **[v1][P0]** maddeleri.
> Yöntem: Her madde koda karşı kontrol edildi (graphify, ardından Grep/Read). Uygulama da çalıştırıldı: `vite --port 5301`, headless Chrome ve 390 px iframe ile Ana Sayfa, Canlı Maç, Maç Sonu ve Sezon Sonu ekranlarına bakıldı. `npx vitest run` de koşturuldu.
> Durumlar: **TAMAM** = gerçek oyun akışına bağlı ve çalışıyor. **KISMİ** = bir kısmı var, ya da var ama bağlı değil veya plandaki sayıları tutmuyor. **EKSİK** = anlamlı bir uygulama yok. **N/A-süreç** = kod beklenmeyen iş/süreç maddesi.
> Kanıt yolları `game/src/` köküne görelidir. 2.9, 2.10 ve 2.12 bölümlerinde yollar depo köküne görelidir.
> Not: Denge kodu bu denetim sırasında başka bir ajan tarafından düzenleniyordu. Dengeyle ilgili satır numaraları kayabilir.

---

## 0. Durum özeti

> **Yeniden denetim: 2026-10-07, WP-1..WP-12 sonrası.** İlk denetimde KISMİ ya da EKSİK olan her satır koda karşı yeniden kontrol edildi (graphify + hedefli grep). Testler ve e2e bu turda koşturulmadı (e2e başka süreçte koşuyor). Bölüm 1 ve bölüm 2'deki ilk tablolar **tarihsel taban** olarak olduğu gibi bırakıldı. Bir satırın güncel durumu için önce bölüm 2.0'a bakılır. Orada yoksa ilk tablodaki durum geçerlidir.

### 0.1 ANALIZ-VE-PLAN [v1][P0]: önce / şimdi

| Bölüm | TAMAM önce → şimdi | KISMİ önce → şimdi | EKSİK önce → şimdi |
|---|---|---|---|
| 2.1 Maç motoru, his, kontroller | 3 → 11 | 49 → 50 | 10 → 5 |
| 2.2 Animasyon, kamera, sunum | 1 → 10 | 16 → 16 | 13 → 4 |
| 2.3 Kariyer | 2 → 19 | 31 → 23 | 10 → 1 |
| 2.4 Sosyal, olaylar | 5 → 14 | 25 → 20 | 9 → 5 |
| 2.5 Ekonomi, monetizasyon | 11 → 15 | 21 → 24 | 17 → 10 |
| 2.6 Dünya, kupalar, milli takım | 2 → 21 | 32 → 22 | 15 → 6 |
| 2.7 UI/UX | 7 → 21 | 45 → 39 | 13 → 5 |
| 2.8 Ses ve müzik | 0 → 10 | 9 → 4 | 10 → 5 |
| 2.9 Platform ve teknik | 14 → 25 | 38 → 34 | 27 → 20 |
| 2.10 Meta, online, canlı operasyon | 5 → 6 | 1 → 3 | 18 → 15 |
| 2.11 Erişilebilirlik, yerelleştirme | 1 → 10 | 15 → 12 | 17 → 11 |
| 2.12 Risk, hukuk, mağaza, QA | 9 → 17 | 13 → 13 | 15 → 7 |
| **Toplam** | **60 → 179** (%11 → %31) | **295 → 260** | **174 → 94** (+ 40 N/A-süreç) |

Not: Bölüm toplamları satır sayımından geldiği için eski toplam (569) ile yeni toplam (573) arasında ±4 sayım farkı var. Yön ve büyüklük etkilenmez.

### 0.2 GDD [v1] (129 satırlık denetim listesi): önce / şimdi

| | TAMAM | KISMİ | EKSİK |
|---|---:|---:|---:|
| Önce | 102 | 16 | 11 |
| **Şimdi** | **117** | **10** | **2** |

GDD bölümleri şimdi (TAMAM/KISMİ/EKSİK): 2 Karakter 20/4/2, 3 Maç 34/3/0, 4 Yaşam 19/1/0, 5 Olaylar 7/0/0, 6 Dünya 13/0/0, 7 Ekonomi 4/0/0, 8 Sunum 8/0/0, 9 Teknik 12/2/0. (Bölüm 1.2'deki eski "142 madde" farklı bir sayım yöntemiydi. Karşılaştırma için 129 satırlık liste kullanıldı.)

### 0.3 Ana çıkarımlar

- Büyük kapanışlar: oynanabilir milli takım ve turnuva, maç adaleti ve kalem kalem maç sonu, ses motoru, stadyum kademeleri ve kutlamalar, ödül töreni ve kupa kurası, başarım ve emeklilik akışı, tutorial, hukuki temizlik, kayıt yedekleri, erişilebilirlik ayarları, deneme/paywall.
- Kalan açıkların büyük kısmı **cila ve derinlik** (kontrol şemaları, hakem kuralları, sim kalibrasyon testleri) ile **dış hizmet gerektirenler** (online, mağaza, Steam). Dış bağımlı olanlar bölüm 3.2'de ayrı listelendi.
- Açık teknik borç: `newGame.ts:128,142` içinde `Date.now` var (sim determinizmi), ESLint kuralı yalnızca `warn`.
- Bölüm 1.3'teki eski QA bulguları: maç günü onay penceresi **kapandı** (`ui/tutorial/MatchdayConfirm.tsx`). 390 px hız düğmesi düzeltmesi WP-6 commit'inde yapıldı. "New Star" ve "manevi halef" ifadeleri **temizlendi**, lig adı "Anadolu Ligi" oldu. Birim test kırmızısı (feel, backend) bu turda koşturulmadı. "feel bands green" commit'leri yeşile çekildiğini gösteriyor ama doğrulanmalı.

---

## 1. Özet Sayılar (ilk denetim tabanı, WP-1..12 öncesi)

### 1.1 ANALIZ-VE-PLAN §2, [v1][P0] maddeleri

| Bölüm | Konu | Madde | TAMAM | KISMİ | EKSİK | N/A |
|---|---|---:|---:|---:|---:|---:|
| 2.1 | Maç motoru, his, kontroller | 62 | 3 | 49 | 10 | 0 |
| 2.2 | Animasyon, kamera, efekt, sunum | 30 | 1 | 16 | 13 | 0 |
| 2.3 | Kariyer ve oyun mantığı | 43 | 2 | 31 | 10 | 0 |
| 2.4 | Sosyal hayat, ilişkiler, olaylar | 39 | 5 | 25 | 9 | 0 |
| 2.5 | Ekonomi, lüks, kumarhane, monetizasyon | 49 | 11 | 21 | 17 | 0 |
| 2.6 | Dünya, ligler, kupalar, milli takım | 49 | 2 | 32 | 15 | 0 |
| 2.7 | UI/UX ve görsellik | 65 | 7 | 45 | 13 | 0 |
| 2.8 | Ses ve müzik | 19 | 0 | 9 | 10 | 0 |
| 2.9 | Platform ve teknik | 79 | 14 | 38 | 27 | 0 |
| 2.10 | Meta, online, canlı operasyon | 25 | 5 | 1 | 18 | 1 |
| 2.11 | Erişilebilirlik ve yerelleştirme | 33 | 1 | 15 | 17 | 0 |
| 2.12 | Risk, hukuk, mağaza, QA, etik | 76 | 9 | 13 | 15 | 39 |
| **Toplam** | | **569** | **60** | **295** | **174** | **40** |

**Yorum:** P0 maddelerinin yalnızca ~%11'i tam. Buna karşılık ~%52'si kısmen var. Çekirdek döngünün iskeleti büyük ölçüde kurulu (maç, antrenman, yaşam, kumarhane, kayıt). Asıl açık, plandaki **sayısal kurallarda**, **şeffaflık katmanlarında** (döküm, "neden" ekranları) ve **hiç başlanmamış alt sistemlerde**. Hiç başlanmamış olanlar şunlar: oynanabilir milli takım, müzik ve UI sesleri, başarımlar, tutorial, emeklilik akışı, monetizasyon ve online.

### 1.2 GDD [v1] maddeleri

| GDD bölümü | Madde | TAMAM | KISMİ | EKSİK |
|---|---:|---:|---:|---:|
| 2. Karakter & Kariyer | 26 | 17 | 6 | 3 |
| 3. Maç Motoru | 37 | 30 | 4 | 3 |
| 4. Yaşam Simülasyonu | 20 | 19 | 1 | 0 |
| 5. Olaylar | 20 | 19 | 1 | 0 |
| 6. Dünya | 13 | 10 | 2 | 1 |
| 7. Ekonomi / Para modeli | 4 | 2 | 0 | 2 |
| 8. Sunum | 8 | 6 | 0 | 2 |
| 9. Teknik | 14 | 12 | 2 | 0 |
| **Toplam** | **142** | **115** | **16** | **11** |

**Yorum:** GDD kaba hatlarıyla karşılanmış (~%81). Plan maddelerine göre çok daha olumlu görünmesinin sebebi, GDD'nin "özellik var mı" düzeyinde yazılmış olması. Plan ise sayısal kabul kriterleri koyuyor.

### 1.3 Ek QA bulguları (denetim sırasında)

- **Birim testler kırmızı:** 604 testin 4'ü başarısız. Üçü `game/feel.test.ts` içinde (cross, corner ve defend "converts within band"), biri `ui/backend/backend.test.ts:169` içinde (`blackjackDeal` boş el döndürüyor). Bunlar muhtemelen şu an süren denge düzenlemesinden kaynaklanıyor. O iş bitince yeniden koşturulmalı.
- **Maç günü "İlerle" tuşu** maçı onaysız ve sessizce simüle ediyor (`ui/backend/realActions.ts:89`). Bu bilinçli bir tasarım, ama yanlışlıkla dokunmak NSS oyuncusu için en can sıkıcı kayıp olur. Onay penceresi gerekiyor.
- **390 px genişlik:** Canlı maç alt çubuğunda "4×" hız düğmesi kesiliyor ve "SONA KADAR SİM…" kırpılıyor. Diğer ekranlar düzgün.
- **Hukuki acil konu:** `public/manifest.webmanifest:5` ve `i18n/sections/title.ts:19,52` içinde "New Star Soccer" ve "manevi halefi" geçiyor. Lig adı da plandaki yasak örnek olan "Anadolu Süper Ligi" (`data/world/countries.ts:21`).

---

## 2. Madde Bazında Denetim Tablosu

### 2.0 Yeniden denetim: durumu değişen satırlar (WP-1..12 sonrası)

Kanıt yolları `game/src/` köküne göredir; 2.9, 2.10, 2.12 satırlarında `game/...` ile başlayanlar depo köküne göredir. `~` işareti sembol düzeyinde doğrulandı, uçtan uca izlenmedi anlamına gelir.

| Madde | Yeni durum | Kanıt | Not |
|---|---|---|---|
| 2.1#7 | TAMAM | sim/match/fairness.ts:23, engine.ts:1193 | 15 dk erken skor freni, 300 maçlık test |
| 2.1#8 | TAMAM | sim/match/fairness.ts:15, engine.ts:1221 | %8 altı an yeniden üretiliyor |
| 2.1#14 | TAMAM | sim/match/rating.ts:134, ui/screens/match/PostMatchScreen.tsx:150 | Kalem kalem döküm, 7,0 tabanı testli |
| 2.1#60 | KISMİ | game/MatchScene.ts:1651,1748 | Ofsayt çerçevesi var; Vizyon'a göre pas hedefi vurgusu doğrulanamadı |
| 2.1#68 | TAMAM | game/runtime.ts:759,787 | Kafa yönü kaydırma ile |
| 2.1#86 | TAMAM~ | game/runtime.ts:963 | Uzanma penceresi Refleks'e bağlı |
| 2.1#103 | TAMAM | game/MatchScene.ts:1546,1557 | Ofsayt çizgisi çiziliyor |
| 2.1#121, #125 | TAMAM | sim/match/highlightGen.ts:598,603 | Kanatta ≥2 orta, stoperde ≥3 savunma anı, testli |
| 2.2#25 | TAMAM | game/MatchScene.ts:1582 | Forma numarası ve isim etiketi |
| 2.2#37 | TAMAM | game/presentation.ts:98,168 | Kutlama yönü, ilişkiye göre yanına gelenler |
| 2.2#38 | TAMAM | game/presentation.ts (CELEBRATIONS) | WP-16: 12 kutlama (robot, heart_hands, ice_cold, cartwheel eklendi); pakette 5 kozmetik |
| 2.2#47, #49 | TAMAM | ui/screens/match/Moments.tsx:92, game/presentation.ts:222 | Anlar listesi, en iyi 3 an, çok açılı tekrar |
| 2.2#63 | TAMAM | game/quality.ts (ParticleBudget), MatchScene.fxN | WP-16: profil başına sabit canlı parçacık bütçesi (120/260/480) |
| 2.2#74 | TAMAM | game/MatchScene.ts:756 | Rüzgâr km/sa göstergesi |
| 2.2#82 | TAMAM | game/presentation.ts:16 | 4 stadyum kademesi |
| 2.2#102, #103 | TAMAM | PostMatchScreen.tsx:370,158, postFlow.ts:7 | Adım adım maç sonu, count-up reyting |
| 2.2#118 | TAMAM | game/quality.ts, ui/store.ts (quality/qualityAuto) | WP-16: Düşük/Orta/Yüksek/Otomatik (cihaz testi); seyirci yoğunluğu, tifo, hava, parlama |
| 2.2#121 | TAMAM | game/MatchScene.ts:303 | Hareketi azalt sahnede ~26 yerde uygulanıyor |
| 2.3#7 | TAMAM | sim/game/trials.ts:2 | Seçmeler ve akademi daveti, varsayılan açık |
| 2.3#12 | TAMAM | sim/career/scouting.ts:32 | PA yıldızı ve izci bandı |
| 2.3#14 | TAMAM | sim/career/decay.ts:32 | Özellik erimesi + uyarı |
| 2.3#26-#28 | TAMAM | game/training/drills/{crossing,heading,tackling}.ts | 3 yeni drill |
| 2.3#40 | TAMAM | sim/career/matchPerks.ts:15 | Maç perkleri maça etki ediyor |
| 2.3#62, #63 | TAMAM | sim/career/market.ts:39, contract.ts:474 | Piyasa referansı, son teklif kuralı |
| 2.3#81, #83 | TAMAM | ui/screens/legacy/CareerCards.tsx:14, sim/career/squadRole.ts:200 | Beklenen dakika, form maddesi (≥7,5) |
| 2.3#84 | TAMAM | PostMatchScreen.tsx:267 | Güven değişim nedenleri |
| 2.3#91, #92 | TAMAM | sim/game/national.ts:33,116 | A/U21/U19, çağrı göstergesi |
| 2.3#98, #99 | TAMAM | ui/screens/awards/AwardsScreen.tsx:79, sim/world/awards.ts:28 | Aday listesi, 100 gazeteci oylaması |
| 2.3#106 | TAMAM | ui/screens/legacy/CareerCards.tsx:59 | Emeklilik girişi UI'da |
| 2.4#2, #5 | TAMAM | sim/life/relationships.ts:20,47 | İlişki defteri, "neden" paneli |
| 2.4#60, #61 | TAMAM | sim/game/interview.ts:294,254 | 3 soruluk röportaj, etki tavanı, tuzak soru |
| 2.4#65, #90 | TAMAM | sim/life/casino.ts:916,992 | Tek ziyaret manşet değil, yardım hattı |
| 2.4#101, #111, #112 | TAMAM | events/content/abroad.ts, events/types.ts:34, events/engine.ts:383 | Zincir, yeni kategoriler (252 olay), kariyer başı sınır |
| 2.5#90 | TAMAM | ui/screens/SettingsScreen.tsx:120 | Kumarhaneyi gizle |
| 2.5#105 | KISMİ | docs/PLATFORM.md:148 | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#112-#114 | TAMAM | store-iap/entitlements.ts:46, catalog.ts:12, capacitorProvider.ts:38 | Deneme kilidi, kozmetikler, satın alma/geri yükleme |
| 2.5#119, #120 | KISMİ | ui/screens/store/PurchasesPanel.tsx:20, StoreScreen.tsx:8 | Satın alma geçmişi ve mağaza varlıkları eksik |
| 2.6#17, #32, #46, #55 | TAMAM | sim/world/quickSim.test.ts:21, ClubScreen.tsx:112, season.test.ts:211, gender.test.ts:30 | Testler, forma numarası |
| 2.6#63, #76, #79, #84, #87 | TAMAM | sim/world/competitions.ts:429,311,299, ui/screens/cup/CupDrawScreen.tsx, sim/world/coefficients.ts:87 | Play-off, kura, ön eleme, çift maç, kupa kontenjanı, katsayı |
| 2.6#68, #72 | TAMAM | ui/screens/national/NationalCard.tsx:29, ui/tutorial/MatchdayConfirm.tsx:31 | Turnuva geri sayımı, maç günü onayı |
| 2.6#91-#94 | TAMAM | sim/world/national.ts:236,326,64 | Milli kadro, çağrı sayacı, eleme, turnuva |
| 2.6#102, #103, #106, #107 | TAMAM | sim/world/awards.ts:156,335, CupsPanel.tsx:44, sim/game/records.ts | Ayın Oyuncusu, Altın Yıldız, krallıklar, rekorlar |
| 2.7#14, #32, #44, #50, #67 | TAMAM | styles/fonts.css, input/gamepadNav.ts, Chip.tsx:42, Controls.tsx:41, MatchScene.ts:321 | Self-host font, gamepad menü, delta glifi, slider adımı, takım çizgisi |
| 2.7#72, #82, #83, #85, #86, #87 | TAMAM~ | PostMatchScreen.tsx:174, Relations.tsx:55,124, StoreScreen.tsx, Assets.tsx:88, ResponsiblePanel.tsx:19 | Reyting dökümü, neden panelleri, mağaza, raf, günlük kayıp limiti |
| 2.7#122, #123, #131 | TAMAM | ui/tutorial/CoachTour.tsx:47, UnlockGate.tsx, PaywallScreen.tsx | Rehber, kademeli açılış, paywall |
| 2.8#1, #12, #13, #14 | TAMAM | audio/mixer.ts:14, crowd.ts:3,32, director.ts:37 | Mikser, kalabalık katmanları, kapasite, gerilim |
| 2.8#23, #25, #26, #35, #45 | TAMAM | game/audio.ts:154,302,240, audio/music.ts:21, audio/uiSfx.ts:13 | Vuruş, direk, düdük, müzik, UI sesleri |
| 2.8#51 | TAMAM~ | platform/capacitor.ts:20 | Haptics eşlemesi var; **gerçek cihazda doğrulanmadı** |
| 2.9#5 | TAMAM | game/eslint.config.js:30 | sim/core kısıtları |
| 2.9#27 | KISMİ | game/eslint.config.js:1 | `Date.now` yalnızca warn; newGame.ts:128,142 ihlal |
| 2.9#46, #48, #49 | TAMAM | game/src/state/save.ts:147,193, ui/backend/persistence.ts:35 | Kota koruması, `.premigrate`, "oyunu güncelleyin" |
| 2.9#65 | TAMAM | game/package.json:27 | @capgo/native-purchases |
| 2.9#71 | TAMAM | game/src/styles/fonts.css:1 | Font self-host |
| 2.9#77 | TAMAM | ui/backend/liveMatch.ts:335 | Arka planda otomatik duraklat |
| 2.9#82, #83 | TAMAM | store-iap/service.ts:43, entitlements.ts:53 | Geri yükleme, yetki önbelleği |
| 2.9#89, #95 | TAMAM | ui/backend/meta.ts:62, ui/App.tsx:176 | 79 başarım → platform sink, gamepad menü |
| 2.9#107 | KISMİ | telemetry/errorLog.ts:1 | Yerel opt-in günlük, gönderim yok |
| 2.10#3 | KISMİ | styles/fonts.css:1 | Font isteği yok; çevrimiçi anahtar yok |
| 2.10#88 | KISMİ | telemetry/ErrorReportPanel.tsx:31 | Elle kopyalanan rapor |
| 2.10#111 | TAMAM | sim/game/achievements.ts:140 | Başarım sistemi |
| 2.11#1, #17, #19-#22 | TAMAM | styles/tokens.css:201, input/bindings.ts:103, i18n/sections/settings.ts:46,48, game/input.ts:166, SettingsScreen.tsx:92 | Renk körü paletleri, tuş atama, sol/tek el, dokunma ölçeği, maç hızı |
| 2.11#31, #49, #50 | TAMAM | MatchScene.ts:1602, i18n/index.ts:78, ui/a11y/collate.ts:6 | Sarsıntı kapanıyor, tr-TR büyük harf, Collator('tr') |
| 2.11#32 | TAMAM | ui/store.ts reduceFlashes, SettingsScreen (Grafik) | Ayrı anahtar; WP-16 Grafik grubunda, her profilde geçerli |
| 2.12#1, #2, #10 | TAMAM | game/public/manifest.webmanifest, game/src/data/world/countries.ts:21 | Marka ifadeleri temiz, "Anadolu Ligi" |
| 2.12#32, #33 | TAMAM | styles/fonts.css, THIRD_PARTY_LICENSES.md | Self-host, lisans dosyası (yalnızca fontlar) |
| 2.12#42 | KISMİ | core/contentFlags.ts:5 | Derleme bayrağı yok, oyuncu ayarı var |
| 2.12#43, #45, #121 | TAMAM | SettingsScreen.tsx:120, casino/CasinoScreen.tsx:104, state/save.ts:193 | Kumarhane gizle, sorumlu oyun paneli, migrasyon öncesi kopya |
| 2.12#70 | KISMİ | store-iap/flavor.ts:1 | Mobilde ilk sezon deneme, ayrı demo yok |

Kısmen ilerleyip durumu değişmeyenler: 2.3#2 (Altın Eldiven var, kaleci formülü yok), 2.3#60 (form maddesi var, garanti/sigorta/imaj hakkı yok), 2.5#117 (makbuz doğrulama `TODO(server)`), 2.6#34 ve #71, 2.7#1, #71, #73, #99, 2.9#111 ve #112 (lint + bloklayan e2e eklendi, coverage yok), 2.11#10 (axe e2e var), 2.12#91 (19 spec, hedef 40).

**GDD (2.13), TAMAM'a dönenler:** gizli potansiyel yıldızı (`legacy/CareerCards.tsx:69`), emeklilik kararı ve Onur Listesi (`ui/backend/meta.ts:205`, `HallOfFameScreen.tsx:28`), ısı ve şut haritası (`PostMatchScreen.tsx:223`), kalabalık/tezahürat/ıslık/yuhalama (`audio/crowd.ts`), hukuk olayları (`events/content/legal.ts`), milli turnuva + Ayın Oyuncusu + Yılın Golü (`sim/game/national.ts`, `awards.ts`), deneme + Tam Kariyer kilidi + kozmetikler (`store-iap/catalog.ts`), menü sesleri ve dinamik müzik (`audio/uiSfx.ts`, `music.ts`).

**GDD hâlâ açık (10 KISMİ + 2 EKSİK):** doğum şehri (EKSİK), emeklilik sonrası yollar (EKSİK), kaleci özellik grupları yalnız 2, sözleşme sigorta/süre garantisi, yedekte şikayet UI çağrısı yok, ilişki → pas sıklığı mesajı yok, yardım seviyesi ödül çarpanı yok (3.3 ve 9), takım arkadaşı el kaldırma/pas isteme yok, hakem avantaj ve sertlik yok, vadeli mevduat yok, `steamworks.js` bağımlılık değil (isteğe bağlı).

---

### 2.1 Maç Motoru, Oyun Hissi ve Kontroller

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.1#1 | KISMİ | sim/game/match.ts:176, sim/match/engine.test.ts:21 | Seed'li ve deterministik; `fork('match:id')` ve 1.000 maçlık golden master yok |
| 2.1#2 | KISMİ | sim/match/engine.ts:1219 | An sonucu skora yazılıyor; momentum ve kaçan fırsat raporu yok |
| 2.1#3 | KISMİ | sim/match/engine.ts:590 | Sonuç önceden hesaplanmıyor; %70 telemetri testi yok |
| 2.1#4 | TAMAM | ui/backend/liveMatch.ts:248, game/runtime.ts:296 | Bekleyen an kayda yazılıyor, an RNG'si seed'li, restore testi var |
| 2.1#6 | KISMİ | sim/match/engine.ts:645 | Güç farkı şansı etkiliyor; %18/%6 kalibrasyonu ve %12 testi yok |
| 2.1#7 | EKSİK | - | İlk 15 dk erken skor freni yok |
| 2.1#8 | EKSİK | - | %8 altı imkânsız fırsat filtresi yok |
| 2.1#9 | KISMİ | sim/match/highlightGen.ts:509 | 4–9 an var; odak modu, Pozisyon Alma ve "beklenen an" gösterimi yok |
| 2.1#12 | KISMİ | sim/match/teamModel.ts:79 | Yorgunluk takım reytingini düşürüyor; 70'/%40 kuralı yok, ana yansımıyor |
| 2.1#14 | KISMİ | sim/match/rating.ts:57 | Formül var; kalem kalem döküm ekranı ve 7,0 tabanı yok |
| 2.1#18 | KISMİ | game/kick.ts:84 | İleri swipe var; sapan (geri çekme) yok, 80 ms örnekleme yok |
| 2.1#19 | KISMİ | game/MatchScene.ts:830 | Renkli güç halkası var; eşikler farklı, Soğukkanlılık sapması yok |
| 2.1#20 | KISMİ | game/MatchScene.ts:757 | Noktalı yol var; Vizyon ölçeği yok, Zor/manuel modda kapanmıyor |
| 2.1#21 | KISMİ | game/kick.ts:117, game/kick.ts:206 | Güç uzunluk ve hız karışımı; sayısal güç ayarı yok |
| 2.1#22 | EKSİK | - | Dokun + salınan güç çubuğu şeması yok |
| 2.1#23 | KISMİ | game/input.ts:8 | PC'de bas-bırak şut var; aşırtma Ctrl/E'de, tekerle falso yok |
| 2.1#24 | KISMİ | game/input.ts:408 | Gamepad tuşları var; analog güç, sağ analog falso, ölü bölge ayarı yok |
| 2.1#26 | KISMİ | game/runtime.ts:490 | 0,25x bullet-time var; süre formülü farklı, baskıda yarılanma yok |
| 2.1#28 | KISMİ | game/kick.ts:44 | Tam/yarı/manuel yardım var; ödül çarpanı yok |
| 2.1#29 | KISMİ | game/kick.ts:446, game/runtime.ts:1543 | Mıknatıs ve İlk Dokunuş'a bağlı alım var; 1,5 m kuralı yok |
| 2.1#34 | EKSİK | game/runtime.ts:1896 | Yalnızca görsel kare kaydı var; girdi kaydı yok |
| 2.1#36 | KISMİ | game/runtime.ts:1339 | Top sürme Dribbling'e bağlı; ayrı an tipi yok |
| 2.1#37 | KISMİ | game/ai.ts:253 | Top kapma ve top uzaklığı hesaplanıyor; 1,2 m ve %25 kuralı yok |
| 2.1#44 | TAMAM | game/physics.ts:25 | 2.5D top, yerçekimi, hava direnci; şut hızı Şut özelliğine bağlı |
| 2.1#45 | KISMİ | game/physics.ts:230 | Magnus falso var; 3,5 m sınırı ve Teknik ölçeği yok |
| 2.1#47 | KISMİ | game/runtime.ts:604 | Plase ve aşırtma var; yüzde kuralları yok |
| 2.1#51 | KISMİ | game/physics.ts:305 | Direk modeli var; 200 regresyon testi yok |
| 2.1#57 | KISMİ | game/kick.ts:126 | Pas tipleri var; tip başına hız aralığı yok |
| 2.1#58 | KISMİ | game/runtime.ts:937 | Başka arkadaşa giden pas başarısız sayılıyor |
| 2.1#59 | EKSİK | game/runtime.ts:729 | Ver-kaç mekaniği yok |
| 2.1#60 | EKSİK | - | Vizyon'a göre pas hedefi vurgusu ve ofsayt çerçevesi yok |
| 2.1#62 | KISMİ | game/view.ts (crossCamFit), game/MatchScene.ts | WP-16: gerçek yan açı yapılmadı (saha, tribün, reklam panoları ve kaleler sabit arka-kale projeksiyonunda çiziliyor; dokunmatik nişan `project`in tersini kullanıyor). Yerine orta anında sabit geniş kadraj: orta açan, düşüş noktası ve kale ağzı tek karede (yatayda hepsi, dikeyde düşüş + kale) |
| 2.1#67 | KISMİ | game/runtime.ts:1890 | Kafa zamanlama halkası var; ayrı kafa an tipi yok |
| 2.1#68 | EKSİK | - | Kafa yönü kontrolü yok |
| 2.1#71 | TAMAM | game/kick.ts (HEADER_RANGE) | Kafa vuruşu en fazla 18 m taşır; ötesi kısa indirme (kick.test) |
| 2.1#72 | TAMAM | sim/match/highlightGen.ts (placeDefend1v1, placeBlock) | WP-14: defend, interception, defend_1v1, block ayrı an tipleri |
| 2.1#73 | TAMAM | game/ai.ts (tackleOdds, cardForFoul) | Arkadan müdahale faul/kart olasılığını artırıyor; kartlar hakem sertliğiyle ölçekli; avantaj kuralı (runtime.tryAdvantage) |
| 2.1#74 | KISMİ | game/ai.ts:253 | Zamanlamaya bağlı müdahale var; 0,8 m/%70 kuralı yok |
| 2.1#81 | TAMAM | game/ai.ts:408 | Kaleci 2D hareket ediyor, tepki Refleks'e bağlı |
| 2.1#82 | TAMAM | game/ai.ts (punchChance), game/runtime.ts (punch) | Yüksek topta kalabalık/yükseklik/hız/tutuş: yumruk ya da tutma |
| 2.1#83 | KISMİ | game/ai.ts:478 | Kurtarış fonksiyonu var; 1.000 şut tutarlılık testi yok |
| 2.1#85 | KISMİ | sim/match/highlightGen.ts:456 | Kaleci kariyerinde yalnızca kurtarış ve penaltı anı var |
| 2.1#86 | KISMİ | game/input.ts:426 | Uzanma var; Refleks'e bağlı pencere yok |
| 2.1#87 | KISMİ | game/runtime.ts:1238 | Vücut açısı ipucu var; erken ipucu ve ceza yok |
| 2.1#93 | KISMİ | game/runtime.ts:377 | Penaltı panik titremesi var; eşik ve değerler farklı |
| 2.1#94 | TAMAM | sim/match/referee.ts (ShotBook), game/runtime.ts (keeperRead) | Kaleciler kahramanın penaltı/şut yönlerini maç ve sezon boyunca hatırlıyor; penaltıda eğilme + "KÖŞENİ BİLİYOR" ipucu |
| 2.1#95 | TAMAM | game/setPieceChoice.ts, game/setPiecePicker.ts, sim/match/engine.ts (heroOrganisesWall) | fk_wall anı: kaleci ya da kaptan kahraman barajı kurar (2–5 kişi, ±1,5 m kaydırma, canlı önizleme); serbest vurucu barajı ve kaleciyi okuyup şut seçer (yakın alt, barajın üstü, uzak köşe, ince baraja sert, kalabalık barajda boştaki adama orta); büyük baraj kaleciyi kör eder |
| 2.1#97 | TAMAM | game/setPieceChoice.ts, game/setPiecePicker.ts, sim/match/engine.ts (corner) | corner_kick anı: korner atıcısı kahraman bölge (yakın/arka direk, penaltı noktası, kısa), yükseklik (sert/havalı) ve kavis (içe/dışa) seçer (dokunmatikte radyal seçici, PC tuşları, gamepad); arkadaşlar bölgeye koşar; sonuç asist/gol/uzaklaştırıldı |
| 2.1#98 | KISMİ | game/runtime.ts:889 | Kornerde ofsayt atlanıyor; birim test yok |
| 2.1#102 | KISMİ | game/offside.ts:1 | Ofsayt var; 500 değil ~11 test |
| 2.1#103 | EKSİK | - | Ofsayt çizgisi çizilmiyor |
| 2.1#104 | TAMAM | sim/match/referee.ts, sim/world/referees.ts | Hakem sertliği 1-5 + avantaj eğilimi; maç önü kartı; sim ve anlarda faul/kart çarpanı |
| 2.1#105 | TAMAM | sim/match/referee.ts (banMatches) | Kırmızı 1-3 maç (ikinci sarı/son adam 1, sert faul 2, şiddet 3); 5 sarı = 1 maç; kahraman ve NPC'ler |
| 2.1#111 | KISMİ | game/runtime.ts:1108 | Arkadaşlar kesişme noktasına koşuyor; kabul testi yok |
| 2.1#112 | TAMAM | game/runtime.ts (callForBall), game/input.ts | El kaldırıp pas isteme: uzun bas / G / gamepad Y; ilişki-vizyon-pas yolu; "PAS VERMİYOR" |
| 2.1#119 | KISMİ | sim/match/highlightGen.ts:446 | Mevkiye göre ağırlık var; kafa ve dribbling tipleri yok |
| 2.1#120 | TAMAM | sim/match/highlightGen.ts (placeHoldUp) | WP-14: hold_up (top saklama) anı |
| 2.1#121 | KISMİ | sim/match/highlightGen.ts:448 | Kanat ortası ağırlıklı; 2 orta garantisi yok |
| 2.1#124 | KISMİ | sim/match/highlightGen.ts (KIND_WEIGHTS) | Beklere defend_1v1 ve block eklendi; plan oranlarıyla tam kalibrasyon yok |
| 2.1#125 | KISMİ | sim/match/highlightGen.ts:455 | Stoper için 3 savunma anı garantisi yok |
| 2.1#128 | KISMİ | core/types.ts:437 | 4 zorluk var; "Özel" mod yok |
| 2.1#129 | KISMİ | sim/game/balance.test.ts:84 | Sezon gol medyanı raporlanıyor; 25–45 bandı kontrolü yok |

### 2.2 Animasyon, Kamera, Efektler ve Sunum

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.2#1 | TAMAM | game/MatchScene.ts:847 | Tek kamera, tek projeksiyon |
| 2.2#2 | KISMİ | game/MatchScene.ts:862 | Üstel yumuşatma var; sönüm ve hız sınırı yok |
| 2.2#3 | KISMİ | game/MatchScene.ts:853 | Önden bakış var; %18 kuralı yok |
| 2.2#4 | EKSİK | game/MatchScene.ts:528 | An başı kadrajı (kahraman + 3 pas seçeneği) yok |
| 2.2#7 | KISMİ | game/MatchScene.ts:874 | Kamera sınırı 13 m (hedef 6 m) |
| 2.2#14 | KISMİ | game/runtime.ts:416 | 0,25x ve vinyet var; geçiş eğrisi ve doygunluk yok |
| 2.2#15 | KISMİ | game/MatchScene.ts:1123 | Süre Soğukkanlılığa bağlı; topta daralan halka yok |
| 2.2#16 | KISMİ | game/MatchScene.ts:757 | Önizleme var; Teknik/Vizyon'a göre uzunluk yok |
| 2.2#17 | KISMİ | game/MatchScene.ts:830 | 3 renk; sarı bant ve renk körü deseni yok |
| 2.2#18 | KISMİ | game/MatchScene.ts:778 | İniş halkası var; X işareti ve elips yok |
| 2.2#24 | EKSİK | game/MatchScene.ts:644 | Oyuncular Graphics ile çiziliyor; 8 yön animasyon atlası yok |
| 2.2#25 | KISMİ | game/MatchScene.ts:394 | Halka ve isim var; forma numarası yok |
| 2.2#26 | EKSİK | - | Vuruş pozu animasyonu yok |
| 2.2#37 | EKSİK | game/runtime.ts:1005 | Yalnızca zıplama; kutlama yönü seçimi ve ilişki etkisi yok |
| 2.2#38 | TAMAM | game/presentation.ts | WP-16: 12 kutlama |
| 2.2#47 | EKSİK | game/MatchScene.ts:596 | Yalnızca gol sonrası tekrar var; "Anlar" listesi ve en iyi 3 an yok |
| 2.2#48 | KISMİ | game/runtime.ts:368 | Tekrar kare kaydından; kalıcı değil |
| 2.2#49 | KISMİ | game/MatchScene.ts:852 | Tekrar kamerası topu izliyor |
| 2.2#63 | TAMAM | game/quality.ts | WP-16: ParticleBudget |
| 2.2#66 | KISMİ | game/art.ts:430 | File dalgası var; verlet ızgara yok |
| 2.2#73 | KISMİ | game/MatchScene.ts:489 | Yağmur ve sürtünme var; sıçrama ve HUD ikonu yok |
| 2.2#74 | EKSİK | game/physics.ts:116 | Rüzgâr fiziği var; ok/km-sa göstergesi ve bayrak yok |
| 2.2#82 | EKSİK | game/MatchScene.ts:318 | Tek stadyum; kapasiteye göre 4 kademe yok |
| 2.2#92 | KISMİ | game/MatchScene.ts:515 | Skor bandı var; TV grafiği stili yok |
| 2.2#102 | EKSİK | ui/screens/match/PostMatchScreen.tsx:80 | Tek ekran; adım adım maç sonu akışı yok |
| 2.2#103 | EKSİK | ui/screens/match/PostMatchScreen.tsx:81 | Reyting count-up katkı dökümü yok |
| 2.2#106 | KISMİ | ui/screens/match/LiveMatchScreen.tsx:212 | 1/2/4x var; "sonraki anıma geç" yok |
| 2.2#118 | TAMAM | game/quality.ts | WP-16: kalite profilleri |
| 2.2#119 | EKSİK | - | Düşük cihaz kabul testi yok |
| 2.2#121 | KISMİ | ui/hooks/motion.ts:7 | Hareketi azalt maçta yalnızca tekrarı kapatıyor |

### 2.3 Kariyer ve Oyun Mantığı

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.3#1 | TAMAM | core/types.ts:18, sim/match/highlightGen.ts:85 | 10 mevki, mevkiye göre an havuzu |
| 2.3#2 | KISMİ | game/training/drills/goalkeeping.ts:1 | Tek GK drili; Altın Eldiven ve GK reyting formülü yok |
| 2.3#3 | KISMİ | sim/career/createHero.ts:48 | Arketip bonusu 80–90 puan (plan 40); uyumsuzluk kuralı yok |
| 2.3#7 | EKSİK | sim/game/newGame.ts:64 | Başlangıç kulübü otomatik; deneme daveti, akademi ve seçme yok |
| 2.3#10 | KISMİ | ui/screens/NewCareerScreen.tsx:173 | Cinsiyet seçimi var; ayrı lig yapısı ve metin testi eksik |
| 2.3#11 | KISMİ | sim/career/progression.ts:33 | 21 özellik (GK 2); OVR açıklama ekranı yok |
| 2.3#12 | KISMİ | sim/career/progression.ts:310 | PA ve yıldız fonksiyonu var, UI'da gösterilmiyor |
| 2.3#13 | KISMİ | sim/career/progression.ts:104 | Yaş çarpanları plandan farklı |
| 2.3#14 | EKSİK | - | Özellik erimesi ve önceden uyarı yok |
| 2.3#15 | KISMİ | sim/career/matchOutcome.ts:202 | Maç XP'si var; aksiyon başına XP yok |
| 2.3#21 | KISMİ | sim/career/training.ts:102 | Puanlama ve formül farklı |
| 2.3#22 | KISMİ | game/training/drills/dribbling.ts:1 | Koni slalomu var; plandaki kurallar yok |
| 2.3#23 | KISMİ | game/training/drills/finishing.ts:5 | Hedef şut var; 9 bölge ve 10 şut yok |
| 2.3#24 | KISMİ | game/training/drills/passing.ts:1 | Pas drili var; 4'e 2 rondo yok |
| 2.3#25 | KISMİ | game/training/scoring.ts:38 | Falso kapısı ve rüzgâr göstergesi yok |
| 2.3#26 | EKSİK | - | Orta İstasyonu yok |
| 2.3#27 | EKSİK | - | Kafa Topu Makinesi yok |
| 2.3#28 | EKSİK | game/ai.ts:253 | Top Kapma Düellosu yok |
| 2.3#29 | KISMİ | game/training/drills/goalkeeping.ts:1 | Refleks drili var; formül farklı |
| 2.3#39 | KISMİ | sim/career/progression.ts:203 | Perk puanı var; 3 dal × 3 kademe değil |
| 2.3#40 | KISMİ | data/perks.ts:55 | Plase Uzmanı tanımlı ama maç kodu etkisini okumuyor |
| 2.3#55 | KISMİ | sim/career/condition.ts:51, sim/match/engine.ts:1374 | Maçta ve antrenmanda sakatlık ve rehab var; süreler ve risk faktörleri farklı |
| 2.3#60 | KISMİ | sim/career/contract.ts:40 | Temel maddeler var; garanti, sigorta ve imaj hakkı yok |
| 2.3#61 | KISMİ | sim/career/contract.ts:319 | Sabır ve tur var; maddeler arası takas yok |
| 2.3#62 | EKSİK | ui/screens/ContractScreen.tsx | Piyasa referansı yok |
| 2.3#63 | KISMİ | sim/game/actions.ts:403 | Sabır bitince teklif siliniyor; son teklif sunulmuyor |
| 2.3#70 | KISMİ | sim/game/internal.ts:136 | Kış penceresi 3 hafta (plan 4) |
| 2.3#71 | KISMİ | ui/backend/realData.ts:389 | İlgi listesi var; neden ve 1–5 ölçeği yok |
| 2.3#72 | KISMİ | sim/career/transfers.ts:109 | Yumuşak uyum var; −6 OVR kuralı yok |
| 2.3#73 | KISMİ | ui/backend/realData.ts:406 | Bonservis var; değer dökümü yok |
| 2.3#74 | KISMİ | sim/career/transfers.ts:254 | Transfer talebi var; değerler farklı |
| 2.3#81 | KISMİ | sim/career/squadRole.ts:21 | 6 rol var; beklenen dakika metni yok |
| 2.3#82 | KISMİ | sim/career/squadRole.ts:109 | TD güveni eşikleri plandaki gibi değil |
| 2.3#83 | EKSİK | - | Reyting ≥7,5 rotasyon garantisi yok |
| 2.3#84 | KISMİ | sim/career/matchOutcome.ts:181 | Güven değişiminin nedenleri listelenmiyor |
| 2.3#91 | KISMİ | sim/game/season.ts:38, sim/game/season.ts:63 | Yalnızca A Milli var ve **maçlar zarla simüle ediliyor, oynanamıyor** |
| 2.3#92 | EKSİK | - | Milli takım ilgi göstergesi yok |
| 2.3#98 | KISMİ | sim/game/season.ts:236, ui/screens/SeasonEndScreen.tsx:135 | Ödül töreni ekranı var; formül, aday listesi ve puanlar yok |
| 2.3#99 | EKSİK | - | 100 gazeteci oylaması yok |
| 2.3#106 | KISMİ | sim/game/actions.ts:503 | `retire()` var ama **UI'dan çağrılamıyor** |
| 2.3#117 | KISMİ | ui/screens/NewCareerScreen.tsx:364 | 4 zorluk yalnızca an zorluğunu etkiliyor; özel ayar yok |
| 2.3#118 | EKSİK | - | Ertelendi: maç sim kalibrasyonu, WP-17 (2.1#129) |
| 2.3#119 | TAMAM | sim/game/match.ts:176 | Maç seed'i maçtan önce kayda yazılıyor |

### 2.4 Sosyal Hayat, İlişkiler, Kararlar ve Olaylar

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.4#1 | TAMAM | sim/life/relationships.ts:125 | Her takım arkadaşı ayrı −100..100 |
| 2.4#2 | TAMAM | ui/screens/life/Relations.tsx (rel-memories) | Kart son 5 anıyı listeler |
| 2.4#3 | KISMİ | sim/life/relationships.ts:176 | Ertelendi: bant etkisi şimdilik yalnızca pas faktörü ve etiket; bant açıklama metni UI işi |
| 2.4#4 | KISMİ | sim/life/relationships.ts:77 | Ertelendi: sönüm sabit/hafta ayarlı; %2 oranına geçiş denge ve golden değişikliği gerektirir, BALANCE turu ile v1.1 |
| 2.4#5 | TAMAM | sim/life/relationLedger.test.ts; relationships.ts:47 | WP-sweep: ilişki değişim defteri (son 10, ardışık sönüm birleşir) |
| 2.4#6 | TAMAM | sim/career/matchOutcome.ts:176 | İyi maçta net negatif ilişki yok |
| 2.4#7 | EKSİK | - | Ertelendi: etkiler fonksiyon olduğundan statik linter için olay DSL yeniden yazımı gerekir (v2) |
| 2.4#11 | KISMİ | ui/screens/life/Relations.tsx:24 | Ertelendi: 3 seçenekli sahne yeni içerik ve UI akışı; v2 |
| 2.4#14 | KISMİ | sim/career/createHero.ts:208 | Ertelendi: başlangıç ailesi çeşitliliği createHero + hikâye şablonları + UI metni; v2 |
| 2.4#15 | TAMAM | sim/life/relationships.ts:189 | Yakın çevre etkisi tavanlı |
| 2.4#23 | TAMAM | sim/life/wellbeing.ts:67 | Partner yokluğu ceza vermiyor |
| 2.4#24 | KISMİ | sim/life/events/dsl.ts:142 | Ertelendi: partner tercihi Ayarlar ekranı gerektirir (UI ajanı sahibi) |
| 2.4#25 | TAMAM | sim/life/events/content/romance.ts:415 | TD etkisi −4 (tavan −5) |
| 2.4#36 | KISMİ | game/ai.ts:338 | Ertelendi: maç içi ikon sim/match ve match UI (başka ajanın alanı) |
| 2.4#37 | EKSİK | - | Ertelendi: Sosyal ekranı yakın arkadaş listesi; v2 |
| 2.4#46 | TAMAM | sim/career/squadRole.ts formTerm/ratingTerm/trustTerm; life/sweep2.test.ts | Form+reyting %75, güven/ilişki en çok %25 |
| 2.4#47 | EKSİK | - | Ertelendi: TD beklenti sistemi 2.7#71 ile birlikte (UI ajanı) |
| 2.4#52 | KISMİ | sim/life/events/content/teammates.ts:92 | Ertelendi: maç içi penaltı seçimi match motoru (başka ajanın alanı) |
| 2.4#53 | KISMİ | sim/life/events/content/teammates.ts:128 | Ertelendi: sezon başı oylama yeni akış + UI; v2 |
| 2.4#60 | TAMAM | sim/game/interview.ts:296 IV_CAP; interview3.test.ts:95 | Oturum başı fans/itibar tavanı |
| 2.4#61 | TAMAM | sim/game/interview.ts (3 soru, 5 ton + joke, trap); interview3.test.ts | Mini oyun tam |
| 2.4#65 | TAMAM | sim/life/casino.ts:903 casinoHeadlineWorthy; casinoRg.test.ts:28 | Tek ziyaret manşet olmaz, örüntü olur |
| 2.4#69 | TAMAM | sim/life/social.ts:153 SPAM_DECAY (haftalık paylaşım sayacı) | Haftada tekrar eden paylaşımın getirisi üstel düşer |
| 2.4#70 | TAMAM | sim/life/social.ts POST_TYPES.thanks/rival; Social.tsx | Taraftara teşekkür ve rakibe gönderme eklendi |
| 2.4#79 | EKSİK | - | Ertelendi: taraftar grupları içerik + ilişki grubu; v2 |
| 2.4#84 | TAMAM | sim/life/events/content/casino.ts:51 | Reddetmek yalnız stres; ceza yok |
| 2.4#85 | TAMAM | sim/life/sponsors.ts (ScandalLevel 1-4) | WP-15: seviye 4 tüm sponsorları bitirir |
| 2.4#90 | TAMAM | sim/life/events/content/health.ts:health.burnout + casino.ts HELPLINE_MESSAGE | Destek hattı bilgisi metinde |
| 2.4#98 | TAMAM | sim/life/events/content/friends.ts debt_trouble>aftermath>debt_press>debt_reunion | 4 adımlı zincir |
| 2.4#99 | KISMİ | sim/life/events/content/teammates.ts:92 | Ertelendi: penaltı zinciri maç içi kanca gerektirir (match motoru, başka ajan) |
| 2.4#100 | KISMİ | sim/life/events/content/nightlife.ts:47 | Ertelendi: paparazzi görevi yeni mini görev UI; v2 |
| 2.4#101 | TAMAM | sim/life/events/content/abroad.ts friends.abroad_lonely/homesick/language/settled | Yurt dışı zinciri var |
| 2.4#102 | TAMAM | sim/life/events/content/casino.ts:23 | Bahis çetesi zinciri tam |
| 2.4#110 | KISMİ | sim/life/events/types.ts:150 | Ertelendi: Zod yeni bağımlılık; TS şeması + content.test.ts doğrulaması yeterli, v2 |
| 2.4#111 | TAMAM | sim/life/events/content/ (257 olay; legal, scam, business dahil) | v1 hedefi aşıldı |
| 2.4#112 | KISMİ | sim/life/events/engine.ts:360 | Ertelendi: varsayılan 2 sınırı zincir ve ardışık olayları sessizleştirir; olay bazlı maxPerCareer ile yönetiliyor, v2 |
| 2.4#113 | KISMİ | ui/screens/EventModal.tsx:78 | Ertelendi: şeffaflık ayarı Ayarlar ekranı (UI ajanı) |
| 2.4#114 | KISMİ | sim/life/events/types.ts:118 | Ertelendi: geçmiş hatırlatma tüm gecikmeli olay metinlerinin yeniden yazımı; v2 |
| 2.4#118 | KISMİ | sim/life/events/engine.ts:180 | Ertelendi: ICU select i18n altyapı değişikliği; mevcut {g:} kalıbı çalışıyor, v2 |

### 2.5 Ekonomi, Lüks, Yatırım, Kumarhane, Monetizasyon

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.5#1 | KISMİ | sim/career/contract.ts:5 | Ertelendi: kurgusal para birimi simge/biçim Ayarlar (UI ajanı) |
| 2.5#2 | KISMİ | sim/life/events/engine.ts:83 | Ertelendi: simgesiz fiyat lint kuralı UI lint altyapısı (UI ajanı) |
| 2.5#3 | KISMİ | sim/career/matchOutcome.ts:196 | Ertelendi: kazanç dökümü ekranı Kariyer/Finans UI (UI ajanı); veri hazır: EconomyBreakdown |
| 2.5#4 | TAMAM | sim/career/matchPay.ts:matchBonuses cleanSheet | Kaleci temiz kasa primi |
| 2.5#5 | TAMAM | sim/game/season.ts:paySeasonEndBonuses | Kupa başına 4 haftalık takım primi |
| 2.5#8 | TAMAM | sim/life/economy.ts COUNTRY_TAX/incomeTaxRate; sweep2.test.ts | Kulüp ülkesine göre %27–40 vergi |
| 2.5#10 | TAMAM | sim/life/economy.ts agentFee (maaş+sponsor); matchPay.ts | Komisyon sponsor gelirinden de kesilir |
| 2.5#11 | TAMAM | sim/life/economy.ts tickTrainerContract; sweep2.test.ts | Antrenör sözleşmesi 44 hafta, 4 hafta kala uyarı, bitince ayrılır (UI çubuğu: TrainingScreen, UI ajanı) |
| 2.5#15 | KISMİ | sim/game/balanceSim.ts:76 | Ertelendi: temel yaşam gideri denge değişikliği, BALANCE turu gerektirir; v1.1 |
| 2.5#16 | TAMAM | data/activities.ts energy_drink; activities.test.ts | Enerji içeceği aktivitesi (hızlı enerji, yorgunluk bedeli) |
| 2.5#17 | TAMAM | data/activities.ts:2 | Günde 3 dilim |
| 2.5#18 | KISMİ | sim/life/activities.ts:337 | Ertelendi: uyku %70–100 ev kalitesi tüm erken kariyerlere ceza olur; denge turu gerektirir (sleep varlık bonusu mevcut) |
| 2.5#19 | TAMAM | data/activities.ts, data/assets.ts | Fiyatlar sabit tasarım gereği; enflasyon yok |
| 2.5#22 | TAMAM | data/assets.ts:143 | Para ile hızlandırma satılmıyor |
| 2.5#23 | TAMAM | sim/life/economy.ts:124 | Gider varlık bakımından |
| 2.5#24 | KISMİ | sim/career/wp15.test.ts | Ertelendi: tam harcama eğrisi telemetri ile; v1.1 denge turu |
| 2.5#29 | KISMİ | data/assets.ts | Ertelendi: geç oyun para yutucuları yeni içerik; v2 |
| 2.5#42 | TAMAM | sim/game/internal.ts:93 | Piyasa kayıtlı RNG ile |
| 2.5#53 | TAMAM | sim/life/business.ts (businessRevenueCap) | WP-15: haftalık gelir 3x tavan |
| 2.5#54 | TAMAM | sim/life/sponsors.ts (10 kategori, 6 anlaşma tavanı); sponsors.test.ts | 4 yeni kategori |
| 2.5#55 | KISMİ | core/types.ts:365 | Ertelendi: performans bonusu şablonu sözleşme UI; v2 |
| 2.5#60 | KISMİ | sim/life/sponsors.ts:68 | Ertelendi: sponsor formülü (rep+takipçi) denge testli; plan formülüne geçiş v1.1 |
| 2.5#62 | TAMAM | sim/life/sponsors.ts:16 | Bahis sponsoru yok |
| 2.5#63 | KISMİ | data/assets.ts:30 | Ertelendi: katalog özel etkileri içerik işi; v2 |
| 2.5#64 | KISMİ | data/assets.ts | Ertelendi: kategori dağılımı içerik işi; v2 |
| 2.5#71 | EKSİK | - | Ertelendi: ayrı yıpranma modeli denge riski; v2 |
| 2.5#80 | TAMAM | ui/screens/life/Assets.tsx | WP-15: satın alma onayında "net maaşın ~N haftası" |
| 2.5#84 | EKSİK | - | Ertelendi: at sahipliği yeni içerik; v2 |
| 2.5#89 | TAMAM | - | Fiş/IAP satışı yok |
| 2.5#90 | EKSİK | ui/screens/SettingsScreen.tsx | Ertelendi: Ayarlar öğesi (UI ajanı) |
| 2.5#91 | TAMAM | ui/backend/casinoView.ts:47 | 18 yaş kilidi |
| 2.5#92 | KISMİ | sim/life/casino.ts:513 | Ertelendi: 200k spin testi CI süresi için yeterli; 10M yerel betik olarak v1.1 |
| 2.5#99 | KISMİ | sim/life/casino.ts:772 | Ertelendi: sızıntı kuralı casino.ts bağımlılık modeli ayarı, v1.1 |
| 2.5#102 | KISMİ | sim/life/events/content/casino.ts:301 | Ertelendi: men süreleri olay içeriği ve denge; v1.1 |
| 2.5#103 | TAMAM | sim/life/events/content/casino.ts:51 | Sessiz ret cezasız |
| 2.5#105 | EKSİK | - | Mağaza beyanı yok |
| 2.5#109 | TAMAM | sim/life/economy.ts lowCashRisk/lowCashWarning; economy.test.ts | Zorunlu satıştan önce 4 haftada bir uyarı |
| 2.5#112 | EKSİK | - | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#113 | EKSİK | - | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#114 | EKSİK | - | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#115 | TAMAM | - | Kariyer parası satılmıyor |
| 2.5#116 | TAMAM | - | Reklam yok |
| 2.5#117 | EKSİK | - | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#118 | TAMAM | - | Ödüllü yorum istemi yok |
| 2.5#119 | EKSİK | - | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#120 | EKSİK | - | Ertelendi: monetizasyon: store-iap ajanı |
| 2.5#122 | TAMAM | - | Karanlık örüntü yok |
| 2.5#125 | KISMİ | sim/game/balanceSim.ts:29 | Ertelendi: CI raporu CI altyapısı (dış hizmet) |
| 2.5#126 | TAMAM | sim/career/wp15.test.ts | WP-15: 20 tohum x 5 sezon ekonomi değişmezleri |

### 2.6 Dünya, Ligler, Kupalar, NPC'ler, Milli Takımlar, Veri

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.6#1 | KISMİ | sim/world/generate.ts:281 | Deterministik üretim var; cihazlar arası hash testi yok |
| 2.6#2 | KISMİ | data/world/countries.ts:18 | 12 ülke, gerçek ülke adlarıyla |
| 2.6#5 | KISMİ | data/world/names.ts:49 | İsim tekilliği yok |
| 2.6#7 | KISMİ | data/world/names.ts:286 | Nüfus kademesi yok |
| 2.6#9 | KISMİ | sim/world/generate.ts:105 | Kuruluş yılı ve kısa ad yok |
| 2.6#10 | KISMİ | data/world/names.ts:487 | Kara liste yalnızca kulüp adlarında |
| 2.6#11 | EKSİK | - | Arma benzerlik kontrolü yok |
| 2.6#16 | KISMİ | sim/world/generate.ts:220 | İtibar ölçeği farklı |
| 2.6#17 | KISMİ | sim/world/quickSim.test.ts:45 | Eşikli 1.000 maç testi yok |
| 2.6#18 | EKSİK | - | Kupa sürpriz oranı testi yok |
| 2.6#19 | KISMİ | sim/world/season.ts:696 | Gelir/gider kalemleri yok |
| 2.6#32 | KISMİ | ui/screens/ClubScreen.tsx:74 | Forma numarası yok |
| 2.6#33 | KISMİ | ui/screens/ClubScreen.tsx:130 | İlk 11, ceza ve sözleşme yok |
| 2.6#34 | KISMİ | ui/screens/match/PreMatchScreen.tsx:97 | Formdaki rakip oyuncu yok |
| 2.6#36 | KISMİ | core/types.ts:119 | 2–4 trait yok |
| 2.6#39 | KISMİ | sim/world/generate.ts:223 | TD yalnızca bir isim |
| 2.6#40 | EKSİK | - | TD kovulma ve atama yok |
| 2.6#45 | TAMAM | sim/world/season.ts:539 | NPC gelişimi ve düşüşü var |
| 2.6#46 | KISMİ | sim/world/season.ts:409 | AI transferleri var; hacim testi yok |
| 2.6#47 | KISMİ | sim/world/season.ts:554 | Emeklilik var; efsane listesi yok |
| 2.6#48 | KISMİ | sim/world/season.ts:634 | Altyapı var; akademi seviyesi yok |
| 2.6#54 | TAMAM | sim/world/players.ts:81 | Kadın dünyasında sakal yok |
| 2.6#55 | KISMİ | sim/life/events/content.test.ts:149 | Maç anlatımı zamir kapsamı belirsiz |
| 2.6#62 | KISMİ | sim/world/season.ts:493 | Yükselme ve düşme sabit 3 takım |
| 2.6#63 | EKSİK | - | Play-off yok |
| 2.6#65 | KISMİ | sim/world/table.ts:83 | Ülkeye özel kural yok |
| 2.6#68 | KISMİ | ui/screens/HomeScreen.tsx:72 | Sonraki turnuva bilgisi yok |
| 2.6#69 | KISMİ | sim/world/fixtures.ts:77 | Derbi kuralı yok |
| 2.6#70 | KISMİ | sim/world/fixtures.ts:22 | Dinlenme kuralları yok |
| 2.6#71 | KISMİ | sim/world/season.test.ts:43 | 100 sezonluk test yok |
| 2.6#72 | KISMİ | ui/backend/realActions.ts:89 | Kupa maçları oynanabiliyor; ama "İlerle" maçı sessizce simüle ediyor |
| 2.6#76 | KISMİ | sim/world/competitions.ts:240 | Yerel kupa oynanıyor; kura ekranı yok |
| 2.6#79 | KISMİ | sim/world/competitions.ts:186 | Kıtasal kupa oynanıyor; ön eleme ve çift maç yok |
| 2.6#84 | EKSİK | - | Kupa galibine kıtasal kontenjan yok |
| 2.6#87 | EKSİK | sim/world/competitions.ts:129 | Katsayı sistemi yok |
| 2.6#91 | EKSİK | sim/game/season.ts:43 | Milli takım kadrosu yok |
| 2.6#92 | EKSİK | sim/game/season.ts:47 | Çağrı puanı gizli |
| 2.6#93 | EKSİK | - | Eleme grupları ve milli fikstür yok |
| 2.6#94 | EKSİK | sim/game/season.ts:63 | Dünya Turnuvası yok; milli maç rastgele "cap" |
| 2.6#102 | KISMİ | sim/world/season.ts:215 | Ödül skoru var; aday listesi ve Ayın Oyuncusu yok |
| 2.6#103 | EKSİK | sim/game/season.ts:245 | Altın Yıldız ilk 30 listesi ve töreni yok |
| 2.6#106 | KISMİ | ui/screens/WorldScreen.tsx:135 | Kupa istatistikleri yok |
| 2.6#107 | EKSİK | - | Kulüp rekorları yok |
| 2.6#116 | KISMİ | sim/world/generate.ts:286 | Kadın dünyası, erkek dünyasının cinsiyet bayraklı kopyası |
| 2.6#119 | KISMİ | data/world/countries.ts:1 | Ayrı veri paketi yok |
| 2.6#120 | EKSİK | - | Veri şeması yok |
| 2.6#121 | EKSİK | - | Veri paketi doğrulayıcı yok |
| 2.6#127 | KISMİ | core/config.ts:4 | dataVersion yok |
| 2.6#128 | EKSİK | - | Kariyere veri güncellemesi yok |

### 2.7 UI/UX ve Görsellik

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.7#1 | TAMAM | ui/styleAudit.node.test.ts | Koyu ve açık temada token çiftleri için WCAG kontrast testi (CI) |
| 2.7#2 | ERTELENDİ | ui/styleAudit.node.test.ts | Sabit hex borcu 138 ile dondurulmuş (artış testle engelli). Temizlik büyük SVG/art refaktörü, v1 sonrası |
| 2.7#7 | ERTELENDİ | - | Boşluk ölçeği için stylelint/test eklenmedi; token ölçeği var. Denetim aracı seçimi bekliyor |
| 2.7#8 | ERTELENDİ | ui/styleAudit.node.test.ts | Ölçek dışı yarıçap sayısı 40 ile dondurulmuş; tek tek temizlik görsel yeniden doğrulama ister |
| 2.7#13 | TAMAM | styles/tokens.css data-theme=light, styles/theme-light.css, SettingsScreen tema anahtarı, e2e/wp27.spec.ts | AA kontrastlı açık tema (axe color-contrast 14 ekranda 0), Sistem seçeneği; maç gecesi ekranları koyu kalır |
| 2.7#14 | TAMAM | styles/fonts.css, e2e/fonts.spec.ts | Fontlar @fontsource ile self-host |
| 2.7#15 | TAMAM | ui/styleAudit.node.test.ts | .num tabular-nums test edilir; piksel görsel regresyon altyapısı ayrı iş (ertelendi) |
| 2.7#16 | ERTELENDİ | styles/tokens.css | Ölçek ~1.125 oranlı; 1.25 oranı her ekranı yeniden akıtır, görsel regresyon altyapısı olmadan riskli |
| 2.7#21 | ERTELENDİ | ui/layout/Shell.tsx | Sekmeler Ana Sayfa/Kariyer/Yaşam/Dünya/Menü: bilinçli IA kararı (Takım içeriği Kariyer ve Dünya altında) |
| 2.7#22 | ERTELENDİ | ui/layout/Shell.tsx | Hub CTA ve ileri butonu aynı döngüyü sürer; tek dolu buton kuralı v1.1 cila listesinde |
| 2.7#23 | TAMAM | e2e/wp27.spec.ts | Hub kutucukları 1 dokunuş, Menü kutucukları 2 dokunuşla açılır; e2e ile sabitlendi |
| 2.7#24 | TAMAM | ui/screens/PlannerScreen.tsx, e2e/wp27.spec.ts | 7 günlük şerit (e2e sayar) |
| 2.7#25 | TAMAM | platform/back.ts:14 | Android geri tuşu doğru |
| 2.7#30 | TAMAM | ui/layout/Shell.tsx:1 | Masaüstünde kenar menü ve bağlam paneli |
| 2.7#31 | TAMAM | ui/App.tsx, ui/layout/ShortcutsModal.tsx, e2e/wp27.spec.ts | Space, 1-5, M, T, I, Esc ve ? ile kısayol listesi |
| 2.7#32 | TAMAM | input/gamepadNav.ts, gamepadNav.test.ts, ui/App.tsx startGamepadNav, tokens.css focus ring | D-pad uzamsal gezinme, A onay, B geri, LB/RB sekme; odak halkası 3 px mavi + 2 px boşluk |
| 2.7#34 | TAMAM | styles/tokens.css --fs-micro 12px, ui/styleAudit.node.test.ts | 12 px altı yazı kalmadı (SVG rulet numarası hariç); test sayar |
| 2.7#38 | ERTELENDİ | styles/components.css | Chunky CTA kuralları kodda; tek-CTA denetimi #22 ile birlikte ertelendi |
| 2.7#39 | ERTELENDİ | ui/components/Button.tsx | Danger varyantı var; emekli ol gibi bazı yıkıcı aksiyonlar ghost, çağrı noktası denetimi ertelendi |
| 2.7#40 | ERTELENDİ | ui/components/PlayerCard.tsx | Kart çalışıyor; 5:7 oran ve çerçeve cilası sanat incelemesine bağlı |
| 2.7#42 | ERTELENDİ | ui/components/Chip.tsx | Chip ikonu zorunlu kılmak ~80 çağrı noktasını etkiler; ertelendi |
| 2.7#43 | TAMAM | ui/components/MeterRing.tsx lowAt, styles/components.css .meter-ring-low | %20 altında uyarı rozeti, nabız (reduced motion saygılı) ve ekran okuyucu metni |
| 2.7#44 | TAMAM | ui/components/StatBar.tsx | Önizleme ve 3 sn'lik değişim "+3 ▲ / −1 ▼" |
| 2.7#48 | ERTELENDİ | ui/components/Toast.tsx toastUndo, PlannerScreen.tsx, e2e/wp27.spec.ts | 6 sn Geri al toast'u var, plan silmede kullanılıyor. Satış/eşya atma geri alma ertelendi: sim tarafında geri alma API'si yok (life/** başka ajanda) |
| 2.7#50 | TAMAM | ui/components/Controls.tsx Slider slider-step | Slider ± adım düğmeleri, 44 px, klavye gerekmez |
| 2.7#55 | ERTELENDİ | ui/screens/career/Radar.tsx | Önceki sezon özellik geçmişi kayıtlı değil (save formatı değişikliği gerekir) |
| 2.7#56 | TAMAM | ui/components/Charts.tsx Sparkline, e2e/wp27.spec.ts | Dokun, sürükle veya ok tuşlarıyla noktanın değerini okur |
| 2.7#59 | TAMAM | ui/components/Donut.tsx, ui/screens/profile/FinanceCharts.tsx, sim/game/financeHistory.ts | Gelir/gider halka grafikleri (dokunulabilir) ve haftalık net çubukları; son 12 hafta. Bank ekranı başka ajanın alanı, Profil kartında |
| 2.7#60 | TAMAM | ui/components/LeagueTable.tsx:14 | Bölge şeritleri ve vurgu var |
| 2.7#63 | TAMAM | ui/components/StatBar.tsx statbar-tier | Renk körü modunda kademe numarası (1-6) |
| 2.7#66 | ERTELENDİ | game/MatchScene.ts | Phaser sahnesi maç ajanının alanı |
| 2.7#67 | ERTELENDİ | game/MatchScene.ts | Phaser sahnesi maç ajanının alanı |
| 2.7#68 | ERTELENDİ | game/MatchScene.ts | Phaser sahnesi maç ajanının alanı |
| 2.7#71 | TAMAM | ui/screens/match/PreMatchScreen.tsx ExpectationCard | Stadyum kapasitesi, rol, beklenen dakika ve ilk 11 şansı |
| 2.7#72 | TAMAM | ui/screens/match/PostMatchScreen.tsx RatingStep | Reyting dökümü adımı mevcut |
| 2.7#73 | TAMAM | sim/career/matchPay.ts, PostMatchScreen (EarningsStep) | WP-16: maaş payı, gol/asist/maça çıkma/kaleci primi, sponsor, imaj hakları, vergi, menajer |
| 2.7#74 | TAMAM | ui/screens/match/LiveMatchScreen.tsx:165 | Radar, anlatım, hız ve atla var |
| 2.7#78 | ERTELENDİ | ui/screens/HomeScreen.tsx | Hub sırası bilinçli farklı; sanat incelemesi 8+ aldı |
| 2.7#79 | ERTELENDİ | ui/screens/NewCareerScreen.tsx | 7 adım (kimlik, ulus, mevki, arketip, geçmiş, görünüm, özet) kasıtlı; her adım e2e ile doğrulanıyor |
| 2.7#80 | TAMAM | ui/screens/TrainingScreen.tsx decay-warning | Hareketsizlik/erime uyarısı antrenman ekranında |
| 2.7#81 | ERTELENDİ | ui/screens/life/Relations.tsx | screens/life ikinci tarama ajanının alanı |
| 2.7#82 | ERTELENDİ | ui/screens/match/PostMatchScreen.tsx RelationsStep | Maç sonunda nedenli ilişki değişimi var; İlişkiler ekranı (screens/life) başka ajanın alanı, ertelendi |
| 2.7#83 | ERTELENDİ | sim/game/whyPlaying.ts, legacy/CareerCards.tsx WhyPlayingCard, whyPlaying.test.ts | Yedek kalma için "Neden?" paneli (en etkili 3 etken, sabit/etkilenebilir). Transfer reddi, sponsor ve ödül kaybı için ertelendi |
| 2.7#84 | ERTELENDİ | ui/screens/life/Assets.tsx | screens/life ikinci tarama ajanının alanı |
| 2.7#85 | TAMAM | ui/screens/store/StoreScreen.tsx | Mağaza/Destek ekranı mevcut |
| 2.7#86 | ERTELENDİ | ui/screens/life/Assets.tsx | screens/life ikinci tarama ajanının alanı |
| 2.7#87 | ERTELENDİ | ui/screens/casino/shared.tsx | Kayıp limiti sim/life/casino tarafında zorlama ister (başka ajan) |
| 2.7#88 | ERTELENDİ | ui/screens/ContractScreen.tsx | Sabır tahmini sim sözleşme modelinde yok |
| 2.7#89 | ERTELENDİ | ui/screens/WorldScreen.tsx | Kulüp ilgi karşılaştırması için transfer ilgi verisi sim tarafında gerekir |
| 2.7#90 | ERTELENDİ | ui/screens/InboxScreen.tsx | Haber-olay bağlantısı için olay kimliği haber öğesinde tutulmuyor |
| 2.7#91 | ERTELENDİ | ui/screens/LifeScreen.tsx | Telefon metaforu tam yeniden tasarım; v1.1 |
| 2.7#93 | TAMAM | ui/screens/EventModal.tsx:69 | Risk rozeti ve etki çipleri var |
| 2.7#94 | ERTELENDİ | ui/screens/WorldScreen.tsx | Kariyer/kulüp kırılımı için kulüp bazlı istatistik kaydı gerekir |
| 2.7#98 | ERTELENDİ | ui/screens/SavesScreen.tsx | Slot ekran görüntüsü: kayıt formatına küçük resim alanı gerekir |
| 2.7#99 | TAMAM | ui/screens/SettingsScreen.tsx | WP-16: Gizlilik ve Bulut ("Yakında", bağlantısız) grupları |
| 2.7#103 | TAMAM | styles/tokens.css:136 | Hareket token'ları var |
| 2.7#105 | TAMAM | ui/hooks/motion.ts:20 | Count-up var |
| 2.7#114 | ERTELENDİ | ui/screens/newcareer/AppearanceEditor.tsx | Özel avatar editörü çalışıyor; facesjs yerine özel sistem kullanılıyor (bilinçli sapma) |
| 2.7#122 | TAMAM | ui/tutorial/CoachTour.tsx, e2e/onboarding.spec.ts | Koç turu: ilk maç anı, antrenman ve olay kartı |
| 2.7#123 | TAMAM | ui/tutorial/unlocks.ts, UnlockGate.tsx, e2e/onboarding.spec.ts | Kumarhane/yatırım/işletme kademeli açılır, tek kartlık tanıtım |
| 2.7#127 | ERTELENDİ | ui/screens/SettingsScreen.tsx | Veri toplayan SDK yok; yerel hata günlüğü ayarlarda eşit vurgulu anahtar. Analitik eklenince onay penceresi |
| 2.7#128 | ERTELENDİ | ui/format.ts formatMoney | Tüm tutarlar formatMoney ile sembollü; TS Price tipi zorlaması ertelendi |
| 2.7#129 | ERTELENDİ | - | Mağaza puanı istemi StoreKit/Play API gerektirir (BLOCKED-EXTERNAL) |
| 2.7#130 | TAMAM | ui/components/Button.tsx IconButton 44px, Toast .toast-close 44px | Kapat düğmeleri 44x44, gecikme yok |
| 2.7#131 | TAMAM | ui/screens/store/PaywallScreen.tsx, e2e/iap.spec.ts | Satın alma ekranı kalıcılık ve kapsamı gösterir, geri yükleme var |

### 2.8 Ses ve Müzik

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.8#1 | EKSİK | ui/screens/SettingsScreen.tsx:70 | 6 kanal yok; Müzik kaydırıcısı hiçbir yere bağlı değil |
| 2.8#2 | EKSİK | - | Müzik ve ambient audio session yok |
| 2.8#3 | EKSİK | - | iOS sessiz anahtarı davranışı yok |
| 2.8#4 | KISMİ | platform/lifecycle.ts:56 | Askıya alma var; fade yok |
| 2.8#5 | KISMİ | game/audio.ts:29 | Menüde "sesi aç" ikonu yok |
| 2.8#12 | KISMİ | game/audio.ts:101 | Sentezlenmiş uğultu var; tezahürat, alkış ve ıslık yok |
| 2.8#13 | EKSİK | - | Kalabalık seyirci sayısıyla ölçeklenmiyor |
| 2.8#14 | EKSİK | game/audio.ts:133 | Skor ve son dakika gerilimi yok |
| 2.8#23 | KISMİ | game/audio.ts:176 | Vuruş türü ayrımı yok |
| 2.8#24 | KISMİ | game/audio.ts:278 | File sesi kaba |
| 2.8#25 | KISMİ | game/MatchScene.ts:965 | Direk sesi tek seviye |
| 2.8#26 | KISMİ | game/audio.ts:244 | Düdük desenleri eksik |
| 2.8#35 | EKSİK | - | Hub müziği yok |
| 2.8#36 | KISMİ | - | Maç müziği ayarı yok |
| 2.8#45 | EKSİK | - | UI sesleri yok |
| 2.8#51 | KISMİ | game/MatchScene.ts:929 | Haptik var; iOS türleri yok |
| 2.8#52 | EKSİK | - | Görsel ses ipuçları yok |
| 2.8#56 | EKSİK | - | Lisans CSV ve CI kontrolü yok |
| 2.8#57 | EKSİK | - | `public/` altında hiç ses dosyası yok; tüm sesler WebAudio sentezi |

### 2.9 Platform ve Teknik (yollar depo köküne göre)

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.9#1 | EKSİK | game/package.json:1 | Monorepo yapısı yok |
| 2.9#2 | KISMİ | game/tsconfig.app.json:23 | noUncheckedIndexedAccess yok |
| 2.9#3 | KISMİ | game/vite.config.ts:7 | Hedef es2022 |
| 2.9#4 | KISMİ | game/package.json:37 | Phaser caret ile, sabitlenmemiş |
| 2.9#5 | KISMİ | game/src/sim | Sim saf ama lint kuralı yok |
| 2.9#6 | KISMİ | game/src/platform/index.ts:38 | IAP, bulut ve paylaşım yok |
| 2.9#12 | KISMİ | game/src/game/MatchScene.ts:1250 | FIT tasarım alanı yok |
| 2.9#13 | KISMİ | game/src/game/MatchScene.ts:1236 | Mobil DPR profili yok |
| 2.9#14 | TAMAM | game/src/game/MatchScene.ts:1290 | Phaser yalnızca maçta yaşıyor |
| 2.9#15 | EKSİK | - | Atlas paketleme yok |
| 2.9#16 | EKSİK | - | Nesne havuzu yok |
| 2.9#17 | EKSİK | - | webglcontextlost dinleyicisi yok |
| 2.9#18 | TAMAM | game/src/game/runtime.ts:425 | Sabit adım ve interpolasyon |
| 2.9#22 | EKSİK | - | Bellek bütçesi yok |
| 2.9#23 | KISMİ | game/e2e/perf.spec.ts | Cihaz bazlı FPS hedefi yok |
| 2.9#26 | KISMİ | game/src/core/rng.ts:32 | fork ebeveyn akışı tüketiyor |
| 2.9#27 | EKSİK | game/src/sim/game/newGame.ts:79 | ESLint yok; sim'de Date.now var |
| 2.9#28 | TAMAM | game/src/core/types.ts:462 | RNG durumu kayıtta |
| 2.9#29 | EKSİK | - | Tarayıcılar arası hash testi yok |
| 2.9#30 | EKSİK | - | Web Worker yok |
| 2.9#31 | EKSİK | game/src/sim/game/game.test.ts:50 | 10 sezonluk hash snapshot yok |
| 2.9#33 | TAMAM | game/src/sim/world/fixtures.ts:66 | Oyun takvimi kullanılıyor |
| 2.9#36 | KISMİ | game/src/data/world/countries.ts:17 | Sürümlü veri paketi yok |
| 2.9#37 | TAMAM | game/src/ui/backend/liveMatch.ts:98 | Kapat-aç sonucu değiştirmiyor |
| 2.9#38 | TAMAM | game/src/state/save.ts:19 | Depolama adaptörleri |
| 2.9#39 | TAMAM | game/src/platform/capacitorStorage.ts:15 | Directory.Data |
| 2.9#40 | KISMİ | game/src/state/save.ts:26 | Zarf alanları eksik; FNV (SHA-256 değil) |
| 2.9#41 | TAMAM | game/electron/main.cjs:48 | Atomik yazma |
| 2.9#42 | KISMİ | game/src/state/save.ts:118 | Kilometre taşı yedekleri yok |
| 2.9#43 | TAMAM | game/src/ui/backend/realActions.ts:343 | Yedeğe düşüş var |
| 2.9#44 | TAMAM | game/src/ui/backend/persistence.ts:105 | Kuyruklu otomatik kayıt |
| 2.9#45 | KISMİ | game/src/ui/backend/index.ts:116 | Electron before-quit yok |
| 2.9#46 | KISMİ | game/src/state/save.ts:224 | Kota dolunca önce yedekler siliniyor (kurala aykırı) |
| 2.9#47 | KISMİ | game/src/state/save.ts:82 | Migrasyon fixture'ları yok |
| 2.9#48 | EKSİK | - | Migrasyon öncesi .bak yok |
| 2.9#49 | KISMİ | game/src/state/save.ts:96 | "Güncelleyin" mesajı yok |
| 2.9#50 | KISMİ | game/src/ui/screens/SavesScreen.tsx:65 | Mobil paylaşım ve dosya diyaloğu yok |
| 2.9#57 | KISMİ | docs/PLATFORM.md:94 | Steam Auto-Cloud yalnızca belgede |
| 2.9#60 | EKSİK | - | Bulut çakışma ekranı yok |
| 2.9#62 | TAMAM | game/android/variables.gradle:2 | SDK sürümleri doğru |
| 2.9#63 | EKSİK | .github/workflows/release.yml | iOS CI yok |
| 2.9#64 | TAMAM | game/android/variables.gradle:4 | targetSdk 36 |
| 2.9#65 | EKSİK | game/package.json:27 | IAP eklentisi yok |
| 2.9#66 | TAMAM | game/src/platform/capacitor.ts:46 | Edge-to-edge |
| 2.9#67 | KISMİ | game/android/app/src/main/AndroidManifest.xml | Yönlendirme doğrulanmadı |
| 2.9#69 | KISMİ | game/src/ui/backend/index.ts:116 | WebContent kurtarma akışı yok |
| 2.9#70 | KISMİ | game/src/platform/lifecycle.ts:48 | iOS audio session yok |
| 2.9#71 | KISMİ | game/index.html:20 | Fontlar CDN'den |
| 2.9#72 | EKSİK | - | Soğuk açılış bütçesi yok |
| 2.9#73 | EKSİK | game/android/app/build.gradle:21 | Boyut bütçesi yok, minify kapalı |
| 2.9#76 | KISMİ | game/src/platform/back.ts:14 | Maçta duraklatma menüsü garanti değil |
| 2.9#77 | KISMİ | game/src/ui/screens/match/LiveMatchScreen.tsx:208 | Arka plana geçince maç otomatik durmuyor |
| 2.9#82 | EKSİK | - | Satın alma geri yükleme yok |
| 2.9#83 | EKSİK | - | Kilit önbelleği yok |
| 2.9#86 | KISMİ | game/electron/main.cjs:150 | Electron Fuses yok |
| 2.9#87 | KISMİ | game/electron/main.cjs:98 | steamworks.js paketi yok |
| 2.9#88 | KISMİ | game/electron/main.cjs:110 | Overlay testi yok |
| 2.9#89 | EKSİK | game/src/platform/index.ts:46 | Başarım seti yok; `unlock` hiç çağrılmıyor |
| 2.9#90 | TAMAM | game/electron/main.cjs:98 | DRM yok |
| 2.9#92 | KISMİ | game/electron/main.cjs:171 | Pencere modları eksik |
| 2.9#93 | EKSİK | - | En-boy oranı testleri yok |
| 2.9#94 | EKSİK | - | Steam Deck desteği yok |
| 2.9#95 | KISMİ | game/src/game/input.ts:409 | Gamepad yalnızca maçta |
| 2.9#97 | KISMİ | game/src/styles/base.css:169 | Odak halkası var |
| 2.9#98 | KISMİ | .github/workflows/release.yml:47 | İmza doğrulaması yok |
| 2.9#99 | KISMİ | game/electron-builder.yml:47 | Notarize yok |
| 2.9#107 | EKSİK | - | Çökme raporlama yok |
| 2.9#111 | EKSİK | - | Gizlilik politikası yok |
| 2.9#112 | KISMİ | .github/workflows/ci.yml:29 | Lint/coverage yok; e2e bloklamıyor |
| 2.9#113 | KISMİ | game/e2e/saves.spec.ts:69 | Çevrimdışı varyant yok |
| 2.9#115 | KISMİ | .github/workflows/ci.yml:62 | Yalnızca debug APK |
| 2.9#116 | EKSİK | - | TestFlight hattı yok |
| 2.9#117 | KISMİ | .github/workflows/release.yml:20 | Steam dizini yok |
| 2.9#118 | EKSİK | - | steamcmd yok |
| 2.9#121 | EKSİK | .github/workflows/release.yml:20 | Ortam koruması yok |
| 2.9#126 | EKSİK | - | Kozmetik izolasyon testi yok |
| 2.9#127 | EKSİK | - | Deneme kilidi yok |
| 2.9#128 | KISMİ | docs/ANALIZ-VE-PLAN.md | ADR yok |
| 2.9#130 | KISMİ | game/src/state/save.test.ts:83 | Fixture politikası yok |

### 2.10 Meta, Online, Canlı Operasyon

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.10#1 | TAMAM | game/src/platform/index.ts:96 | Hesap gerekmiyor |
| 2.10#2 | EKSİK | - | Platform kimliği yok |
| 2.10#3 | EKSİK | game/index.html:20 | Çevrimiçi anahtarı yok; font isteği hep gidiyor |
| 2.10#8 | TAMAM | sim/game/localMeta.ts, ui/screens/board/BoardScreen.tsx | Yerel kariyer sıralaması (5 ölçüt) ve kişisel rekorlar; çevrimiçi tablo BLOCKED-EXTERNAL |
| 2.10#15 | EKSİK | - | Modlu/resmi ayrımı yok |
| 2.10#17 | TAMAM | sim/game/localMeta.ts challengeFor, localMeta.test.ts | Tohumlu haftalık görev rotasyonu, seri; yerel |
| 2.10#18 | TAMAM | ui/screens/board/BoardScreen.tsx | Yerel meydan okuma profili: seri, en iyi seri, geçmiş. Çevrimiçi paylaşım BLOCKED-EXTERNAL |
| 2.10#19 | EKSİK | - | Deneme hakkı tablosu yok |
| 2.10#34 | KISMİ | game/src/game/MatchScene.ts:35 | Tekrar seed+girdi olarak saklanmıyor |
| 2.10#40 | KISMİ | ui/share/cards.ts, ShareButtons.tsx, e2e/board.spec.ts | Maç sonu ve kariyer PNG kartı (paylaşım sayfası/indirme) TAMAM; video klip ve fotoğraf modu ertelendi (maç tekrarı seed+girdi yok) |
| 2.10#60 | EKSİK | - | Mod sistemi yok |
| 2.10#62 | EKSİK | - | Mod imzası yok |
| 2.10#70 | N/A-süreç | - | Yol haritası taahhüdü |
| 2.10#72 | TAMAM | - | Sezon kartı yok (kısıt sağlanıyor) |
| 2.10#76 | EKSİK | - | Uzak içerik paketi yok |
| 2.10#82 | EKSİK | - | Bildirim altyapısı yok |
| 2.10#83 | TAMAM | - | Baskı bildirimi yok (kısıt sağlanıyor) |
| 2.10#86 | TAMAM | game/src/sim/world/fixtures.ts:66 | Gerçek zaman cezası yok |
| 2.10#88 | EKSİK | - | "Hata bildir" formu yok |
| 2.10#93 | TAMAM | ui/screens/board/WhatsNewScreen.tsx | Menüden Yenilikler; görüldü bilgisi meta depoda |
| 2.10#101 | EKSİK | - | Sunucu seed'i yok |
| 2.10#102 | EKSİK | - | Girdi günlüğü gönderimi yok |
| 2.10#103 | EKSİK | - | Sunucuda yeniden oynatma yok |
| 2.10#110 | TAMAM | - | Çevrimdışı kariyer kısıtsız |
| 2.10#111 | EKSİK | game/src/platform/index.ts:46 | **Başarım sistemi yok** |

### 2.11 Erişilebilirlik ve Yerelleştirme

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.11#1 | KISMİ | styles/tokens.css:183 | Tek renk körü modu; 3 palet yok |
| 2.11#2 | KISMİ | ui/components/Charts.tsx:73 | Gri tonlama testi yok |
| 2.11#3 | EKSİK | - | Desen maskesi yok |
| 2.11#5 | KISMİ | ui/screens/SettingsScreen.tsx:108 | Metin boyutu %90–130, px tabanlı |
| 2.11#6 | EKSİK | - | Sistem font ölçeği okunmuyor |
| 2.11#10 | KISMİ | ui/components/Modal.tsx:72 | ARIA kısmen; axe yok |
| 2.11#11 | KISMİ | ui/screens/match/LiveMatchScreen.tsx:187 | Assertive duyuru yok |
| 2.11#12 | KISMİ | ui/components/Modal.tsx:42 | wizard.css:99 odak halkasını kaldırıyor |
| 2.11#13 | EKSİK | - | Ekran okuyucu senaryosu yok |
| 2.11#15 | KISMİ | ui/components/Tabs.tsx:32 | Klavyeyle şut doğrulanmadı |
| 2.11#17 | EKSİK | - | Tuş atama yok |
| 2.11#18 | EKSİK | - | Alternatif kontrol şeması yok |
| 2.11#19 | EKSİK | - | Sol el modu yok |
| 2.11#20 | EKSİK | - | Dokunma alanı ölçeği yok |
| 2.11#21 | EKSİK | - | Tek elle oynanış yok |
| 2.11#22 | KISMİ | ui/screens/SettingsScreen.tsx:89 | Ağır çekim yalnızca aç/kapa |
| 2.11#23 | EKSİK | - | Zamanlama penceresi genişletme yok |
| 2.11#29 | EKSİK | - | Görsel ses ipuçları yok |
| 2.11#31 | KISMİ | ui/hooks/motion.ts:4 | MatchScene sarsıntıyı kapatmıyor |
| 2.11#32 | TAMAM | ui/store.ts reduceFlashes | Ayrı anahtar (WP-16 Grafik grubu) |
| 2.11#38 | EKSİK | - | Erişilebilirlik kontrol listesi yok |
| 2.11#42 | KISMİ | i18n/index.ts:45 | ICU yok; literal-string lint yok |
| 2.11#43 | TAMAM | i18n/i18n.test.ts:27 | TR/EN anahtar eşitliği testli |
| 2.11#45 | EKSİK | - | Pseudo-locale yok |
| 2.11#46 | EKSİK | - | Uzun dil regresyon testi yok |
| 2.11#47 | KISMİ | sim/life/events/engine.ts:182 | Olay metinleri TS içinde |
| 2.11#49 | KISMİ | i18n/index.ts:77 | MatchScene.ts:486 düz `toUpperCase` (İ hatası) |
| 2.11#50 | EKSİK | - | `Intl.Collator('tr')` yok |
| 2.11#51 | KISMİ | sim/match/turkish.ts:12 | Ek üretici yalnızca anlatımda |
| 2.11#52 | EKSİK | - | Eksiz kalıp işareti yok |
| 2.11#53 | KISMİ | sim/life/events/engine.ts:182 | "he" sızıntı testi yok |
| 2.11#54 | KISMİ | ui/format.ts:17 | Para birimi € (plan ₺) |
| 2.11#58 | EKSİK | - | Mağaza metinleri yok |

### 2.12 Riskler, Hukuk, Mağaza, QA, Etik (yollar depo köküne göre)

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.12#1 | EKSİK | game/public/manifest.webmanifest:5 | **"New Star Soccer" manifestte ve title.ts'te geçiyor** |
| 2.12#2 | EKSİK | game/public/manifest.webmanifest:5 | "manevi halefi" yasak ifade |
| 2.12#3 | N/A-süreç | - | Görsel inceleme |
| 2.12#5 | N/A-süreç | - | Marka araştırması |
| 2.12#6 | N/A-süreç | - | Mağaza ad kontrolü |
| 2.12#8 | N/A-süreç | - | Alan adı |
| 2.12#10 | KISMİ | game/src/data/world/countries.ts:21 | Yasak örnek "Anadolu Süper Ligi" kullanılıyor |
| 2.12#11 | KISMİ | game/src/data/world/countries.ts:22 | Ödül ve kıta adları doğrulanmadı |
| 2.12#12 | N/A-süreç | - | İçerik kuralı |
| 2.12#13 | EKSİK | - | Arma kara listesi yok |
| 2.12#15 | TAMAM | game/src/sim/world/generate.ts | İsimler prosedürel |
| 2.12#16 | TAMAM | game/src/ui/screens/newcareer/AppearanceEditor.tsx:12 | Ünlü şablonu yok |
| 2.12#27 | EKSİK | - | LICENSES.csv yok |
| 2.12#28 | EKSİK | - | Lisans CI kontrolü yok |
| 2.12#29 | KISMİ | game/src/ui/screens/CreditsScreen.tsx:15 | Otomatik üretim yok |
| 2.12#30 | N/A-süreç | - | Lisans arşivi |
| 2.12#32 | EKSİK | game/index.html:20 | Fontlar self-host değil |
| 2.12#33 | EKSİK | - | THIRD_PARTY_LICENSES yok |
| 2.12#37 | TAMAM | - | Kumarhane gerçek parayla bağlı değil |
| 2.12#38 | N/A-süreç | - | PEGI |
| 2.12#39 | N/A-süreç | - | ESRB/IARC |
| 2.12#40 | N/A-süreç | - | Apple yaş anketi |
| 2.12#41 | N/A-süreç | - | Play IARC |
| 2.12#42 | EKSİK | - | FEATURE_CASINO bayrağı yok |
| 2.12#43 | EKSİK | game/src/i18n/sections/settings.ts | "Kumarhaneyi gizle" ayarı yok |
| 2.12#45 | EKSİK | game/src/ui/screens/casino/CasinoScreen.tsx | Sorumlu oyun mesajı yok |
| 2.12#46 | TAMAM | game/src/sim/life/casino.test.ts:196 | RTP testli |
| 2.12#48 | TAMAM | - | Ücretli rastgele ödül yok |
| 2.12#52 | KISMİ | game/src/sim/life/events/content/casino.ts:630 | Kendi maçına bahis doğrulanmadı |
| 2.12#53 | N/A-süreç | - | Hedef kitle |
| 2.12#54 | TAMAM | - | Veri toplama yok |
| 2.12#57 | TAMAM | - | Yorum karşılığı ödül yok |
| 2.12#58 | EKSİK | - | Yerel yorum API'si yok |
| 2.12#59 | N/A-süreç | - | Mağaza metni |
| 2.12#60 | N/A-süreç | - | ASO |
| 2.12#61 | N/A-süreç | - | Ekran görüntüleri |
| 2.12#65 | N/A-süreç | - | Mağaza metni |
| 2.12#67 | N/A-süreç | - | Steam kapsülleri |
| 2.12#68 | N/A-süreç | - | Steam etiketleri |
| 2.12#69 | N/A-süreç | - | Wishlist |
| 2.12#70 | EKSİK | - | Demo modu yok |
| 2.12#73 | EKSİK | - | Klip kaydetme yok |
| 2.12#74 | N/A-süreç | - | Pazarlama |
| 2.12#75 | N/A-süreç | - | İletişim |
| 2.12#76 | N/A-süreç | - | Discord |
| 2.12#84 | N/A-süreç | - | Kriz şablonu |
| 2.12#85 | N/A-süreç | - | Cihaz matrisi |
| 2.12#86 | KISMİ | game/src/sim/game/balance.test.ts | Gecelik 10.000 sezon CI işi yok |
| 2.12#87 | KISMİ | game/src/game/humanBot.ts | Kariyer botu yok |
| 2.12#88 | EKSİK | game/src/state/save.test.ts:44 | Kayıt fuzz testi yok |
| 2.12#89 | N/A-süreç | - | Soak testi |
| 2.12#90 | N/A-süreç | - | Kesinti testleri |
| 2.12#91 | KISMİ | game/e2e | ~10 spec (plan 40); bloklamıyor |
| 2.12#93 | N/A-süreç | - | Hata önceliklendirme |
| 2.12#94 | N/A-süreç | - | Beta |
| 2.12#95 | N/A-süreç | - | Sertifikasyon |
| 2.12#99 | N/A-süreç | - | Analitik onayı |
| 2.12#100 | N/A-süreç | - | Onay penceresi |
| 2.12#101 | TAMAM | - | Olay toplanmıyor |
| 2.12#102 | N/A-süreç | - | Analitik kimliği |
| 2.12#103 | N/A-süreç | - | Saklama politikası |
| 2.12#105 | N/A-süreç | - | Sunucu |
| 2.12#106 | N/A-süreç | - | Mağaza beyanı (Google Fonts isteği beyana eklenmeli) |
| 2.12#117 | KISMİ | game/src/i18n/sections/settings.ts | p5 FPS izleme yok |
| 2.12#118 | EKSİK | - | Menüde 30 FPS sınırı yok |
| 2.12#119 | KISMİ | game/src/ui/backend/index.ts:116 | Kurtarma metriği yok |
| 2.12#120 | KISMİ | game/src/state/save.ts:113 | Kayıt izleme yok |
| 2.12#121 | KISMİ | game/src/state/save.test.ts:83 | Migrasyon öncesi kopya yok |
| 2.12#122 | N/A-süreç | - | Aşamalı dağıtım |
| 2.12#125 | KISMİ | game/src/i18n/index.ts:78 | 18 yalın `toUpperCase/toLowerCase` kalmış |
| 2.12#126 | TAMAM | game/src/sim/match/turkish.ts:123 | trSuffix testli |
| 2.12#127 | KISMİ | game/src/core/gender.ts:13 | ICU select yok |
| 2.12#133 | N/A-süreç | - | Kapsam yönetimi |
| 2.12#134 | N/A-süreç | - | ADR süreci |
| 2.12#135 | N/A-süreç | - | Politika taraması |
| 2.12#140 | N/A-süreç | - | Kozmetik IAP yok |

### 2.13 GDD [v1] maddeleri

| GDD maddesi | Durum | Kanıt | Not |
|---|---|---|---|
| 2.1 Ad/forma adı/ülke/yaş/pozisyon/ayak | TAMAM | ui/screens/NewCareerScreen.tsx:186 | Sihirbazda var |
| 2.1 Doğum şehri | EKSİK | - | Alan yok |
| 2.1 Prosedürel avatar | TAMAM | ui/screens/newcareer/AppearanceEditor.tsx:15 | Ten, saç, sakal, göz, yüz, aksesuar |
| 2.1 Başlangıç arketipi | TAMAM | sim/career/createHero.ts:23 | Bonus dağılımı var |
| 2.1 Geçmiş hikâyesi | TAMAM | sim/career/createHero.ts:83 | 4 geçmiş |
| 2.2 Özellik grupları | KISMİ | core/types.ts:26 | Kalecide 2 özellik eksik |
| 2.2 Pozisyon ağırlıklı OVR | TAMAM | sim/career/progression.ts:146 | heroOvr |
| 2.2 Gizli potansiyel + yıldız | KISMİ | sim/career/progression.ts:310 | Yıldız UI'da yok |
| 2.2 Yaş eğrisi | TAMAM | sim/career/progression.ts:100 | Var |
| 2.2 Form/Moral/Kondisyon/Yorgunluk | TAMAM | core/types.ts:289 | Dört değer |
| 2.3 Mini oyunlu antrenman → XP | TAMAM | ui/screens/TrainingScreen.tsx:95 | 5 Phaser drili |
| 2.3 Perk (her 5 OVR) | TAMAM | sim/career/progression.ts:205 | 46 perk (bazıları maçta etkisiz, bkz. 2.3#40) |
| 2.3 Özel antrenör | TAMAM | ui/backend/realActions.ts:397 | Tut/kov |
| 2.3 Tesisler | TAMAM | data/assets.ts:139 | İyileşme çarpanı |
| 2.4 Sözleşme maddeleri | KISMİ | core/types.ts:236 | Sigorta ve süre garantisi yok |
| 2.4 Pazarlık + sabır | TAMAM | sim/career/contract.ts:291 | Var |
| 2.4 Pencere/kiralık/talep/serbest | TAMAM | sim/career/transfers.ts:46 | Var |
| 2.4 Ajan | TAMAM | ui/backend/realActions.ts:546 | Kalite pazarlığı etkiliyor |
| 2.4 Kulüp ilgisi listesi | TAMAM | sim/career/transfers.ts:100 | Var |
| 2.5 Rol merdiveni | TAMAM | sim/career/squadRole.ts:21 | 6 basamak |
| 2.5 TD güven barı | TAMAM | ui/screens/ClubScreen.tsx:94 | StatBar |
| 2.5 Yedekte şikayet kararı | KISMİ | sim/game/actions.ts:449 | Sim'de var, UI'a bağlı değil |
| 2.5 İlişki → pas sıklığı (görünür) | KISMİ | game/ai.ts:348 | Etki var; "pas vermiyor" mesajı yok |
| 2.6 Emeklilik kararı | KISMİ | sim/game/actions.ts:503 | UI'dan çağrılamıyor |
| 2.6 Emeklilik sonrası yollar | EKSİK | - | Yok |
| 2.6 Onur Listesi | EKSİK | - | Yok |
| 3.1 Tam maç simülasyonu | TAMAM | sim/match/engine.ts:593 | Faul, kart, sakatlık, değişiklik |
| 3.1 An üretimi | TAMAM | sim/match/highlightGen.ts:507 | 4–9 an |
| 3.1 Fizik sahnesi + geri yazma | TAMAM | ui/backend/highlightBridge.ts:68 | Var |
| 3.1 Canlı skor/radar/anlatım/hız | TAMAM | ui/screens/match/LiveMatchScreen.tsx:47 | Var |
| 3.2 2.5D top fiziği | TAMAM | game/physics.ts:14 | Var |
| 3.2 Magnus | TAMAM | game/physics.ts:14 | Var |
| 3.2 Direk/file | TAMAM | game/physics.ts:17 | Var |
| 3.2 Oyuncu sprint/stamina | TAMAM | game/model.ts:101 | Var |
| 3.3 Hareket | TAMAM | game/input.ts:158 | Joystick/WASD/analog |
| 3.3 Pas | TAMAM | game/input.ts:309 | Var |
| 3.3 Ara pas | TAMAM | game/input.ts:201 | Var |
| 3.3 Şut | TAMAM | game/input.ts:307 | Var |
| 3.3 Aşırtma | TAMAM | game/input.ts:280 | PC'de Shift yerine Ctrl/E |
| 3.3 Sprint | TAMAM | game/input.ts:158 | Var |
| 3.3 Çalım | TAMAM | game/input.ts:186 | Q-E yok |
| 3.3 Orta | TAMAM | game/input.ts:13 | Var |
| 3.3 Gamepad | TAMAM | game/input.ts:409 | Maç içinde |
| 3.3 Bullet-time | TAMAM | game/runtime.ts:498 | 0,25x, ayarlanabilir |
| 3.3 Yardım seviyeleri | KISMİ | ui/screens/SettingsScreen.tsx:75 | Ödül çarpanı yok |
| 3.4 Takım arkadaşı AI | KISMİ | game/ai.ts:81 | El kaldırma yok |
| 3.4 Rakip AI | TAMAM | game/ai.ts:154 | Pres, top kapma, ofsayt |
| 3.4 Kaleci AI | TAMAM | game/runtime.ts:1602 | Var |
| 3.4 Hakem | KISMİ | game/ai.ts:275 | Avantaj ve sertlik yok |
| 3.5 Penaltı + panik | TAMAM | game/runtime.ts:377 | Var |
| 3.5 Serbest vuruş + baraj | TAMAM | game/setup.ts:188 | Var |
| 3.5 Korner kafa anı | TAMAM | sim/match/types.ts:94 | Var |
| 3.6 0–10 puan | TAMAM | sim/match/rating.ts | Var |
| 3.6 Maçın Oyuncusu | TAMAM | ui/screens/match/PostMatchScreen.tsx:87 | Var |
| 3.6 İstatistik ekranı | TAMAM | ui/screens/match/PostMatchScreen.tsx:44 | Var |
| 3.6 Isı haritası | EKSİK | - | Yok |
| 3.6 Şut haritası | EKSİK | - | Yok |
| 3.6 Röportaj kararı | TAMAM | sim/game/interview.ts:14 | 4 ton |
| 3.7 Kalabalık sesi/gol patlaması | KISMİ | game/audio.ts:101 | Sentez; kapasiteye bağlı değil |
| 3.7 Tezahürat/ıslık/yuhalama | EKSİK | game/audio.ts:156 | Yalnızca inilti |
| 3.7 Hava (yağmur/kar/rüzgâr) | TAMAM | game/physics.ts:100 | Sim, fizik ve görselde |
| 3.7 Kamera sarsıntısı | TAMAM | game/MatchScene.ts:6 | Var |
| 3.7 Gol tekrarı | TAMAM | game/MatchScene.ts:63 | Basit tekrar |
| 4.1 Temel göstergeler | TAMAM | core/types.ts:403 | 8 gösterge |
| 4.2 Kişiler | TAMAM | core/types.ts:311 | Var |
| 4.2 −100..100 + hafıza + sönüm | TAMAM | sim/life/relationships.ts:11 | Var |
| 4.2 Etkileşimler | TAMAM | ui/backend/realActions.ts:244 | Var |
| 4.3 Varlık kategorileri | TAMAM | data/assets.ts:130 | 11 kategori |
| 4.3 Bakım/bonus/özel etki | TAMAM | sim/life/assetEffects.ts:7 | Var |
| 4.3 İkinci el satış | TAMAM | sim/life/economy.ts:158 | Var |
| 4.4 Banka | KISMİ | sim/life/economy.ts:37 | Vadeli mevduat yok |
| 4.4 Yatırımlar | TAMAM | sim/life/economy.ts:57 | Var |
| 4.4 Vergi/komisyon/hayır | TAMAM | sim/life/economy.ts:18 | Var |
| 4.5 Blackjack | TAMAM | ui/screens/casino/BlackjackScreen.tsx | Var |
| 4.5 Rulet | TAMAM | ui/screens/casino/RouletteScreen.tsx | Var |
| 4.5 Slot | TAMAM | ui/screens/casino/SlotsScreen.tsx | Var |
| 4.5 At yarışı | TAMAM | ui/screens/casino/HorsesScreen.tsx | Var |
| 4.5 Bağımlılık göstergesi | TAMAM | sim/life/casino.ts:4 | Var |
| 4.5 Kendi maçına bahis skandalı | TAMAM | sim/life/events/content/casino.ts:17 | Ceza/men |
| 4.6 Sosyal medya | TAMAM | sim/life/social.ts:24 | Viral ve nefret mantığı |
| 4.6 Marka teklifi | TAMAM | sim/life/events/content/social.ts | Var |
| 4.7 Sponsorluk + davranış maddesi | TAMAM | sim/life/sponsors.ts:16 | Var |
| 4.7 Reklam çekimi | TAMAM | data/activities.ts:181 | Var |
| 5.1 Veri odaklı olay motoru | TAMAM | sim/life/events/types.ts:172 | Var |
| 5.1 Gecikmeli olay/bayrak/haber | TAMAM | sim/life/events/engine.ts:146 | Var |
| 5.1 Risk ipucu | TAMAM | ui/screens/EventModal.tsx:78 | Var |
| 5.1 150+ olay | TAMAM | sim/life/events/content/index.ts | ~199 olay |
| 5.2 Kategoriler (15 adet) | TAMAM | sim/life/events/content/*.ts | Hukuk hariç tüm kategoriler var |
| 5.2 Hukuk | KISMİ | sim/life/events/content/press.ts | Ayrı kategori yok |
| 6.1 Ülke/kademe/takım sayıları | TAMAM | sim/world/generate.ts:239 | Var |
| 6.1 Kulüp alanları | TAMAM | sim/world/generate.ts:141 | Var |
| 6.2 Lig (yükselme/düşme) | TAMAM | sim/world/season.ts:492 | Var |
| 6.2 Yerel Kupa | TAMAM | sim/game/internal.ts:157 | Kahraman oynuyor |
| 6.2 Kıtasal Kupa | TAMAM | sim/world/competitions.ts:190 | Kahraman oynuyor |
| 6.2 Milli takım turnuvası | EKSİK | sim/game/season.ts:63 | Yok |
| 6.2 Ayın Oyuncusu | KISMİ | sim/life/events/content/awards.ts:75 | Rastgele olay, hesaplama yok |
| 6.2 Sezonun Oyuncusu | TAMAM | sim/game/season.ts:254 | Var |
| 6.2 Gol Kralı | TAMAM | sim/game/season.ts:259 | Var |
| 6.2 Altın Yıldız | TAMAM | sim/game/season.ts:245 | Var (aday listesi yok, bkz. 2.6#103) |
| 6.2 Genç Oyuncu | TAMAM | sim/game/season.ts:256 | Var |
| 6.2 Yılın Golü (oylama) | KISMİ | sim/life/events/content/awards.ts:132 | Gerçek gol kaydı ve oylama yok |
| 6.3 NPC yaşam döngüsü | TAMAM | sim/world/season.ts:717 | Var |
| 7 Premium para birimi yok | TAMAM | - | Yok |
| 7 Oyun içi gelir kaynakları | TAMAM | sim/life/economy.ts:18 | Var |
| 7 Deneme + Tam Kariyer kilidi | EKSİK | - | Yok |
| 7 Kozmetik paketler | EKSİK | - | Yok |
| 8 Maç sesleri | TAMAM | game/audio.ts:244 | Sentez |
| 8 Menü sesleri | EKSİK | - | Yok |
| 8 Dinamik müzik | EKSİK | ui/screens/SettingsScreen.tsx:71 | Ayar var, müzik yok |
| 8 Metin anlatım TR/EN | TAMAM | sim/match/commentary.ts | Var |
| 8 Haber akışı | TAMAM | ui/screens/InboxScreen.tsx:66 | Manşet kartları |
| 8 Sosyal medya akışı | TAMAM | ui/screens/life/Social.tsx:108 | Var |
| 8 Kupa dolabı | TAMAM | ui/screens/TrophiesScreen.tsx:18 | Var |
| 8 Kariyer zaman çizelgesi | TAMAM | ui/screens/CareerLogScreen.tsx:59 | Var |
| 9 Teknoloji yığını | TAMAM | main.tsx | TS + Vite + Phaser 4 + Preact |
| 9 Saf TS sim + Vitest + seed'li RNG | TAMAM | core/rng.ts:13 | 52 test dosyası |
| 9 IndexedDB kayıt | TAMAM | platform/index.ts:74 | Var |
| 9 Versiyonlu şema + migration | TAMAM | state/save.ts:92 | Var |
| 9 3 slot | TAMAM | state/save.ts:15 | Var |
| 9 Otomatik yedek (son 3) | TAMAM | state/save.ts:122 | Var |
| 9 JSON dışa/içe aktarma | TAMAM | ui/backend/realActions.ts:351 | Var |
| 9 Capacitor | TAMAM | platform/capacitor.ts | Android + iOS |
| 9 Masaüstü | KISMİ | game/electron/ | Electron var; steamworks.js yok |
| 9 i18n TR + EN | TAMAM | i18n/index.ts | Var |
| 9 Renk körü modu | TAMAM | ui/store.ts:745 | Yalnızca UI (maç sahnesi değil) |
| 9 Yazı boyutu | TAMAM | ui/store.ts:749 | Var |
| 9 Titreşim aç/kapa | TAMAM | ui/haptics.ts:33 | Var |
| 9 Yardım seviyeleri | KISMİ | game/runtime.ts:309 | Ödül çarpanı yok |

---

## 3. Güncel Backlog: Kalan Boşluklar (WP-13+)

WP-1..WP-12 teslim edildi (bölüm 0 ve 2.0). Aşağıdaki paketler **yalnızca kalan açıkları** kapsar. Sıralama oyuncu etkisine göredir. Her paket bağımsızdır ve yalnızca kendi dosyalarına yazar. Paylaşılan dosyalarda (`ui/store.ts`, `ui/App.tsx`, `i18n/tr.ts`, `i18n/en.ts`) yalnızca ekleme yapılır, metinler paketin kendi `i18n/sections/<paket>.ts` dosyasına konur. Satır numaraları ilk denetim tablosundaki madde kimlikleridir (bölüm 2 ve 2.0).

### 3.1 Kod ile kapanabilir paketler

### WP-13 · Kontrol Şemaları ve Maç Hissi Derinliği  (en yüksek etki)
Kalan hissiyat boşlukları: sapan şut, salınan güç çubuğu, PC tekerlek falsosu, analog gamepad, ver-kaç, Vizyon vurgusu.
- **Dokunduğu dosyalar:** `game/src/game/kick.ts`, `game/src/game/input.ts`, `game/src/game/runtime.ts` (kontrol okuma noktaları), `game/src/game/MatchScene.ts` (yalnızca pas hedefi vurgusu ve orta kamerası), `game/src/i18n/sections/settings.ts`.
- **Kabul kriterleri:**
  1. Sapan (geri çekme) şut şeması ve dokun + salınan güç çubuğu şeması ayarlardan seçilebiliyor (2.1#18, #22).
  2. PC'de tekerlekle falso; gamepad'de analog güç, sağ analog falso, ölü bölge ayarı (2.1#23, #24).
  3. Ver-kaç: pas sonrası kısa süre içinde geri pas hedefi vurgulanıyor ve oynanıyor (2.1#59).
  4. Vizyon özelliğine göre pas hedefi vurgusu (2.1#60), orta için yan kamera (2.1#62), kafa menzili 18 m sınırı (2.1#71).
  5. Yardım seviyelerinin ödül çarpanı (Tam 0,8x, Yarı 1,0x, Manuel 1,25x gibi) ve ekranda yazılı olması (2.1#28, GDD 3.3).
  6. 80 ms girdi örnekleme ve deterministik girdi kaydı/yeniden oynatma (2.1#18, #34). Birim test: kayıtlı girdi aynı sonucu veriyor.

### WP-14 · Hakem, Faul, Kart ve Kaleci Kuralları
- **Dokunduğu dosyalar:** `game/src/game/ai.ts`, `game/src/game/runtime.ts` (faul ve kaleci blokları), `game/src/sim/match/highlightGen.ts`, `game/src/sim/match/engine.ts` (yalnızca hakem parametresi).
- **Kabul kriterleri:**
  1. Hakem sertliği 1-5, avantaj kuralı, arkadan faul, kırmızı kart cezası 1-3 maç (2.1#73, #104, #105, GDD 3.4).
  2. Kaleci yumruklama, penaltıda yön hafızası, baraj talimatı, korner yüksekliği ve kavis seçimi (2.1#82, #94, #95, #97).
  3. Takım arkadaşı el kaldırma / pas isteme jesti (GDD 3.4, 2.1#112). İlişkisi düşük arkadaş az pas veriyor ve "Pas vermiyor" mesajı çıkıyor (GDD 2.5).
  4. Ayrı an tipleri: top saklama, 1'e 1 savunma, blok (2.1#72, #120, #124).
  5. Her kural için birim test (faul olasılığı, kart cezası, avantaj).

> **Durum (yapıldı):** Hakem kişilikleri (ülke başına sabit havuz, sertlik 1-5, avantaj eğilimi) maç önü kartında; sim ve anlarda faul/kart çarpanı (sertlik 3 = nötr). Avantaj kuralı: "AVANTAJ!" sonra şut/7 m ilerleme yoksa geri çağrılıyor. Kırmızı kart 1-3 maç (kahraman + NPC, kadro seçiminde cezalı oyuncu yok, kayıtta saklanıyor), 5 sarı 1 maç. Kaleci yumruk/tutma kararı, kaleci defteri (penaltı/şut yön hafızası, eğilme + ipucu), pas isteme jesti ("PAS VERMİYOR"), yeni an tipleri hold_up / defend_1v1 / block (üretim, runtime, auto-resolve, TR/EN, demo, his bandı). Testler: `sim/match/referee.test.ts`, `game/referee.test.ts`, `game/keeper.test.ts`, `game/callForBall.test.ts`, `game/moments14.test.ts`, `e2e/wp14.spec.ts`. WP-13 artıkları: 18 m kafa menzili, orta kamerası (çerçeveleme). ~~Ertelendi: 2.1#95 / 2.1#97~~ → yapıldı: `corner_kick` ve `fk_wall` an tipleri (üretim, runtime, seçici, auto-resolve, TR/EN, demo, his bandı, ipuçları; `game/setPieces.test.ts`, `e2e/setpieces.spec.ts`).

### WP-15 · Kariyer, Sözleşme ve Ekonomi Boşlukları
- **Dokunduğu dosyalar:** `game/src/sim/career/contract.ts`, `sim/career/squadRole.ts`, `sim/game/newGame.ts`, `sim/life/economy.ts`, `sim/life/sponsors.ts`, `core/types.ts` (yalnızca alan ekleme), `ui/screens/ContractScreen.tsx`, `ui/screens/wizard/**`, `ui/screens/life/Bank.tsx`, `i18n/sections/career3.ts`.
- **Kabul kriterleri:**
  1. Sözleşme maddeleri: sigorta, süre garantisi, imaj hakkı (2.3#60, GDD 2.4).
  2. Doğum şehri alanı yaratma formunda; kaleci için 2'den fazla özellik grubu (GDD 2.1, 2.2).
  3. Yedekte kalınca "şikayet et" kararı kullanıcı arayüzüne bağlı (GDD 2.5, `complainAboutBench`).
  4. Kaleci primi, sezon sonu takım primi, personel sözleşmesi bitişi (2.5#4, #5, #11) ve vadeli mevduat (GDD 4.4).
  5. Altın Eldiven için kaleci reyting formülü (2.3#2).
  6. Kalan EKSİK satırlar tek tek değerlendirilir: 2.4#7, #37, #47, #79, #85; 2.5#24, #53, #71, #80, #84, #126; 2.3#118. Her biri ya kodlandı ya da gerekçeyle ertelendi.
  7. Emeklilik sonrası yollar: en az antrenörlük ve punditlik seçeneği, yeni kariyer ya da miras akışına bağlanıyor (GDD 2.6).

### WP-16 · Sunum Cilası, Kalite Profilleri ve Ayarlar
- **Dokunduğu dosyalar:** `game/src/game/presentation.ts`, `game/src/game/MatchScene.ts` (kalite profili ve parçacık bütçesi), `game/src/ui/screens/SettingsScreen.tsx`, `game/src/ui/screens/match/PostMatchScreen.tsx` (kazanç dökümü adımı), `game/src/ui/screens/PreMatchScreen` (TD beklentisi), `game/src/i18n/sections/settings.ts`.
- **Kabul kriterleri:**
  1. Kutlama kataloğu 8'den 12'ye çıkıyor (2.2#38).
  2. Düşük/Orta/Yüksek kalite profili ve sabit parçacık bütçesi; düşük profilde 60 fps hedefi ölçülüyor (2.2#63, #118).
  3. Ayrı "Flaşları kapat" seçeneği (2.11#32).
  4. Maç sonu kazanç dökümü adımı (2.7#73). Kadro ekranında kapasite ve TD beklentisi (2.7#71).
  5. Ayarlarda Gizlilik ve Bulut bölümleri (Bulut yalnızca "yakında" olarak, bağlantısız) (2.7#99).
  6. Kalan 2.2 EKSİK satırları: #4, #24, #26, #119 karara bağlanıyor.

> **Durum (WP-16 yapıldı):** #1 12 kutlama (`presentation.ts`, pakette heart_hands/cartwheel, `cosmeticUnlocked` ile). #2 `game/quality.ts`: Düşük/Orta/Yüksek/Otomatik (cihaz testi `runDeviceBenchmark` → `profileFromProbe`), sabit parçacık bütçesi (`ParticleBudget`), seyirci yoğunluğu/tifo/hava/parlama; perf spec Düşük profili de ölçüyor (bu makinede 4x kısmada yüksek 46-47, düşük 48 fps; aynı koşulda eb0bd8a temeli 43-44 fps, yani gerileme yok, 60 fps hedefi tutmuyor). #3 "Flaşları kapat" Grafik grubunda, profilden bağımsız. #4 kazanç dökümü adımı (`sim/career/matchPay.ts`, primler artık tek kaynaktan; golden değişmedi). 2.7#71 TD beklentisi ve kadro kapasitesi bu pakette yapılmadı. #5 Gizlilik + Bulut "Yakında" (devre dışı düğme, ağ isteği yok; e2e doğruluyor). #6 2.2#4/#24/#26 ertelendi (animasyon atlası/kadraj; sanat işi), #119 düşük cihaz kabulü perf spec'teki Düşük profil ölçümüyle kısmen karşılandı. Yan kamera: bkz. 2.1#62.

### WP-17 · Sim Kalibrasyon ve Test Altyapısı
- **Dokunduğu dosyalar:** `game/src/sim/**/*.test.ts`, `game/src/sim/match/engine.ts` (yalnızca `fork('match:id')`), `game/src/sim/game/newGame.ts` (Date.now temizliği), `game/eslint.config.js`, `game/vitest.config.ts`, `.github/workflows/ci.yml`.
- **Kabul kriterleri:**
  1. 1.000 maçlık golden master ve `fork('match:id')` ile maç bağımsızlığı (2.1#1).
  2. %70 an telemetri testi, %18/%6 güç farkı kalibrasyonu, %12 testi, 25-45 sezon gol bandı (2.1#2, #3, #6, #129).
  3. 500 ofsayt, 200 direk, 1.000 şut tutarlılık testleri (2.1#51, #83, #102).
  4. `newGame.ts:128,142` içindeki `Date.now` kaldırılıyor; ESLint kuralı `error` oluyor (2.9#27).
  5. Coverage raporu ve sim için eşik; e2e spec sayısı 19'dan 30'a (2.9#112, 2.12#91).
  6. Önceki birim test kırmızısı (feel, backend) yeşil ve CI'da bloklayan.

### WP-18 · Dünya ve Ses Kalan Maddeleri
> **Durum (yapıldı):** 2.6#34 anahtar oyuncu form/mevki skoruyla (`pickKeyPlayer`), 2.6#33/#71 maç öncesi ceza/sözleşme kartı, 2.8#2/#3/#70 `navigator.audioSession='ambient'` (`applyAudioSession`), 2.8#56/#57 `assets/LICENSES.csv` + `audio/licenses.test.ts`. Zaten vardı: 2.8#35 hub müziği, #45 UI sesleri, #52 altyazı/görsel ipuçları. **Kalan 2.6 EKSİK satırları:** #11 arma çakışma koruması (generate.ts + test), #18 kupa sürpriz oranı testi, #40 TD kovma/atama (`world/managers.ts`), #107 kulüp rekorları (`world.records`), #120/#121 veri şeması ve doğrulayıcı (`data/world/validate.ts`) KAPANDI. #63 play-off, #84 kıtasal kontenjan, #87 katsayı, #91-#94 milli takımlar, #103 Altın Yıldız zaten kodda (satırlar bayat). #128 kariyere veri güncellemesi ertelendi: sürümlü veri paketi ve kayıt migrasyonu (2.6#127, WP-15/save) gerekir. **Ertelendi (gerekçeli):** 2.8#4 askıda fade (context.suspend öncesi gecikme maç döngüsünü bozar), 2.8#13/#14/#23-#26 ses inceltmesi (cila, gerçek örnek gerektirir), 2.8#36 maç müziği ayarı (WP-16 ayarlar ekranı).
- **Dokunduğu dosyalar:** `game/src/sim/world/**`, `game/src/ui/screens/WorldScreen.tsx`, `game/src/ui/screens/match/PreMatchScreen.tsx`, `game/src/audio/**`, `game/src/game/audio.ts`.
- **Kabul kriterleri:**
  1. 2.6 kalan satırlar: rakip kilit oyuncu forma/mevkiye göre seçiliyor (2.6#34), maç öncesi ceza ve sözleşme bilgisi (2.6#71), kalan 6 EKSİK karara bağlanıyor.
  2. 2.8 kalan 5 EKSİK ve 4 KISMİ (ör. 2.8#2-#5, #24, #36, #52, #56, #57) tek tek kapatılıyor ya da gerekçeyle erteleniyor.
  3. Her yeni ses `assets/LICENSES.csv` içinde ve CI lisans kontrolünden geçiyor.

### WP-19 · Erişilebilirlik ve Yerelleştirme Kalanı
- **Dokunduğu dosyalar:** `game/src/ui/components/**` (ARIA), `game/src/i18n/**`, `game/src/styles/**`, `game/e2e/a11y*.spec.ts`.
- **Kabul kriterleri:**
  1. 2.11 kalan 11 EKSİK ve 12 KISMİ satırları (ör. 2.11#2, #3, #5, #6, #10-#13, #15, #18, #23, #29, #38) kapatılıyor. En az: kritik ekranlarda ARIA rolleri, ekran okuyucu duyuruları, pseudo-locale modu, metin ölçeği.
  2. Kontrast için ayrı birim test (2.7#1). axe taraması tüm ana ekranlarda 0 kritik hata.
  3. Sözlük ve rehber metinleri İngilizce karşılıklarıyla tam (anahtar eşitliği testi).

### WP-20 · Mağaza Hazırlığı ve Hukuk Belgeleri (kodla yapılabilen kısım)
- **Dokunduğu dosyalar:** `docs/PLATFORM.md`, `game/src/store-iap/**` (satın alma geçmişi), `game/electron/main.cjs` ve `game/package.json` (`steamworks.js` isteğe bağlı bağımlılık), `docs/PRIVACY.md` (yeni), `THIRD_PARTY_LICENSES.md`.
- **Kabul kriterleri:**
  1. Satın alma geçmişi ve tarihli liste (2.5#119). Ayrı demo modu (2.12#70).
  2. Gizlilik politikası taslağı, veri envanteri, yaş derecelendirme anketi yanıtları belgede hazır (2.9#111, 2.5#105).
  3. `steamworks.js` bağımlılığı eklendi ve app id yokken sessizce atlanıyor.
  4. Lisans dosyası fontlar dışında sesleri ve görselleri de kapsıyor (2.12#33).

---

### 3.2 BLOCKED-EXTERNAL (dış hizmet, hesap ya da gerçek cihaz gerekir)

Bunlar kodla tek başına kapanmaz. Her biri için dışarıdan sağlanması gereken girdi yazıldı.

| Konu | Neden bloklu | Kod tarafı (hazırsa) | İlgili madde |
|---|---|---|---|
| Steam app id ve gerçek Steamworks başarım/bulut doğrulaması | Steam partner hesabı ve app id gerekli | Başarımlar `platform.achievements.unlock`'a bağlı (2.9#89) | 2.9#87, 2.10#111 |
| Apple App Store Connect ve Google Play Console | Geliştirici hesapları, ürün kimlikleri (IAP), imzalama anahtarları, mağaza sayfası, ekran görüntüleri, yaş derecelendirmesi, veri güvenliği formları | `capacitorProvider.ts` hazır, ürün kimlikleri bekliyor | 2.5#105, #120, 2.12 mağaza maddeleri |
| Sunucu tarafı makbuz doğrulama | Backend ve mağaza API anahtarları | `TODO(server)` işareti `capacitorProvider.ts:5` | 2.5#117 |
| Lider tablosu ve çevrimiçi anahtar | Backend (sunucu, veritabanı, kötüye kullanım önlemi) | Yok; sim izolasyonu hazır | 2.10#2-#8 |
| Bulut kayıt | Backend ve hesap sistemi | Ayarlarda yalnızca yer tutucu (WP-16) | 2.7#99 |
| Çökme raporunun gönderilmesi | Toplama uç noktası (Sentry vb.) | Yerel opt-in günlük var (`telemetry/errorLog.ts`) | 2.9#107, 2.10#88 |
| Gerçek telefon testi | Fiziksel iOS ve Android cihazlar | 390 px e2e var; haptics (`platform/capacitor.ts:20`), performans, güvenli alan, dokunma ergonomisi, pil ve ısınma gerçek cihazda doğrulanmadı | 2.8#51, 2.2#63, 2.9 mobil maddeleri |
| Gerçek gamepad ve Steam Deck testi | Donanım | Menü navigasyonu ve eşlemeler kodda | 2.9#95 |
| Hukuk incelemesi (gizlilik politikası, kullanım şartları, marka taraması, yaş sınırı) | Avukat ve resmi başvurular | Taslak WP-20'de | 2.12 N/A-süreç maddeleri (39) |
| Canlı operasyon (sezonluk etkinlik, topluluk, destek, analitik paneli) | Süreç, ekip ve altyapı | Yok | 2.10 EKSİK maddeleri (15) |
| İmzalı masaüstü yayını (Windows sertifikası, macOS notarization) | Sertifikalar ve hesaplar | Electron build ve CI matrisi var | 2.9 platform maddeleri |

---

### 3.3 Önerilen sıra ve paralellik

| Sprint | Mühendis A | Mühendis B | Mühendis C | Mühendis D |
|---|---|---|---|---|
| 1 | WP-13 Kontroller | WP-14 Hakem/Kaleci | WP-15 Kariyer/Ekonomi | WP-17 Test altyapısı |
| 2 | WP-16 Sunum cilası | WP-18 Dünya/Ses | WP-19 Erişilebilirlik | WP-20 Mağaza hazırlığı |

**Çakışma notları:**
- WP-13, WP-14 ve WP-16 `MatchScene.ts` / `runtime.ts` dosyalarına değiyor. Sıra: WP-13 → WP-14 → WP-16. WP-13 yalnızca kontrol okuma noktalarına, WP-14 yalnızca faul ve kaleci bloklarına, WP-16 yalnızca sahne efekt blokuna dokunur.
- WP-17 sim dosyalarında yalnızca test ekler (`newGame.ts` ve `engine.ts` küçük istisnalar). WP-15 `newGame.ts` ile çakışabilir, `Date.now` temizliği WP-15'ten önce yapılmalı.
- WP-16 ve WP-19 ayarlar ekranına dokunur. Ayarlar ekranı WP-16'ya aittir, WP-19 yalnızca ARIA/etiket ekler.
