# StarPath Football: Uygulama ve Plan Boşluk Denetimi (GAP-AUDIT)

> Tarih: 2026-10-07 · Hazırlayan: Yapımcı / QA · Kapsam: `docs/GDD.md` içindeki tüm **[v1]** maddeleri ve `docs/ANALIZ-VE-PLAN.md` bölüm 2'deki tüm **[v1][P0]** maddeleri.
> Yöntem: Her madde koda karşı kontrol edildi (graphify, ardından Grep/Read). Uygulama da çalıştırıldı: `vite --port 5301`, headless Chrome ve 390 px iframe ile Ana Sayfa, Canlı Maç, Maç Sonu ve Sezon Sonu ekranlarına bakıldı. `npx vitest run` de koşturuldu.
> Durumlar: **TAMAM** = gerçek oyun akışına bağlı ve çalışıyor. **KISMİ** = bir kısmı var, ya da var ama bağlı değil veya plandaki sayıları tutmuyor. **EKSİK** = anlamlı bir uygulama yok. **N/A-süreç** = kod beklenmeyen iş/süreç maddesi.
> Kanıt yolları `game/src/` köküne görelidir. 2.9, 2.10 ve 2.12 bölümlerinde yollar depo köküne görelidir.
> Not: Denge kodu bu denetim sırasında başka bir ajan tarafından düzenleniyordu. Dengeyle ilgili satır numaraları kayabilir.

---

## 0.00 NİHAİ DURUM (S30 son sayım, 2026-10-08)

> Bu blok aşağıdaki 0.1/0.2 tablolarının ve bölüm 1'in **yerine geçer** (onlar tarihsel kayıttır). Sayım yöntemi: bölüm 2.1-2.12 tablolarındaki ham satır durumları, sonraki süpürmelerin (bölüm 2.0 WP-1..12, 2.0b S29 platform/ses/QA, S21 özeti, 2.6/2.7/2.10/2.11 yerinde güncellemeler) üzerine bindirilerek hesaplandı; en yeni kayıt kazanır. Ham tablolar WP-S ile satır satır güncellendi; sayım artık yalnızca onlardan üretilir.

<!-- counts:start -->
<!-- Otomatik üretilir: `npm run audit:counts` (game/scripts/audit-counts.mjs). Elle düzenlemeyin; ham tablo satırlarını düzeltin. -->

### Analiz-ve-Plan §2 [v1][P0]: 569 madde

| Bölüm | TAMAM | KISMİ | EKSİK | ERTELENDİ (BLOCKED-EXT) | ERTELENDİ (iç) | N/A-süreç | Toplam |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2.1 Maç motoru | 62 | 0 | 0 | 0 | 0 | 0 | 62 |
| 2.2 Animasyon, kamera | 29 | 0 | 0 | 1 | 0 | 0 | 30 |
| 2.3 Kariyer | 40 | 0 | 0 | 0 | 3 | 0 | 43 |
| 2.4 Sosyal, olaylar | 39 | 0 | 0 | 0 | 0 | 0 | 39 |
| 2.5 Ekonomi | 44 | 0 | 0 | 4 | 1 | 0 | 49 |
| 2.6 Dünya | 48 | 0 | 0 | 0 | 1 | 0 | 49 |
| 2.7 UI/UX | 57 | 0 | 0 | 1 | 7 | 0 | 65 |
| 2.8 Ses | 17 | 0 | 0 | 2 | 0 | 0 | 19 |
| 2.9 Platform | 58 | 1 | 0 | 16 | 4 | 0 | 79 |
| 2.10 Meta, online | 19 | 0 | 0 | 5 | 0 | 1 | 25 |
| 2.11 Erişilebilirlik | 29 | 0 | 0 | 3 | 1 | 0 | 33 |
| 2.12 Risk, mağaza, QA | 33 | 0 | 0 | 2 | 2 | 39 | 76 |
| **Toplam** | **475 (%83)** | 1 | 0 | 34 | 19 | 40 | **569** |

### GDD [v1]: 128 madde

| TAMAM | KISMİ | EKSİK | ERTELENDİ (BLOCKED-EXT) | ERTELENDİ (iç) | N/A-süreç | Toplam |
|---:|---:|---:|---:|---:|---:|---:|
| **127** | **0** | **0** | **1** | **0** | **0** | **128** |
<!-- counts:end -->

- Tek doğruluk kaynağı bölüm 2.1-2.13 ham tablolarıdır: her satırda tek güncel durum vardır (TAMAM / KISMİ / EKSİK / ERTELENDİ-EXT / ERTELENDİ-INT / N/A) ve kanıt/not güncel durumu açıklar. Yukarıdaki sayılar `npm run audit:counts` (`game/scripts/audit-counts.mjs`) ile bu tablolardan üretilir; CI (`audit:counts` + `git diff --exit-code`) bayat sayımı reddeder.
- ERTELENDİ-EXT = dış bağımlı (mağaza/Steam/Apple hesabı, backend, gerçek cihaz, hukuk). Satır bazlı karar: 2.5#105, #117, #119, #120 ve 2.10#76 (IAP beyanı, makbuz sunucusu, uzaktan mod anahtarı) ERTELENDİ-EXT; 2.5#112-#114 koduyla TAMAM (store-iap/entitlements.ts, catalog.ts, capacitorProvider.ts), mağaza ürünleriyle sınanması 2.9#127 altında.
- ERTELENDİ-INT = bilinçli iç erteleme (v2, BALANCE/golden çakışması, kayıt migrasyonu, başka paketin dosyası); gerekçe satırın notundadır. 2.4 ve 2.5'te ham tabloda KISMİ/EKSİK yazıp notu "Ertelendi:" ile başlayan satırlar bu nedenle ERTELENDİ-INT oldu.
- Bölüm 2.0 ve 2.0b tabloları değişiklik günlüğüdür (tarihsel; KAPANDI = TAMAM); güncel durum için ham tabloya bakın. 2.6/2.7/2.10/2.11 ham tabloları zaten yerinde güncel olduğundan 2.0 satırları onların üzerine yazılmadı.
- Bu turda yukarı düzeltilenler: 2.1#128 ve 2.3#117 (özel zorluk: `core/customDifficulty.ts`, `NewCareerScreen.tsx`, `liveMatch.ts` bağlı) TAMAM; S21 özetinde sayılmayan 2.3 satırları (#15, #21-#29, #55, #61, #71-#74, #118) kodda doğrulandı (drills/*.ts, s21career.test.ts, goalBand.test.ts) ve TAMAM sayıldı.
- Doğrulama: rastgele 44 TAMAM satırı kodla karşılaştırıldı (kanıt yolu var mı, ilgili sembol grep ile bulunuyor mu). **Düşürülen satır yok**; 0/44 hata.
- GDD KISMİ: kaleci özellik grupları yalnızca 2 (= 2.3#11, iç ertelenmiş; OVR açıklama ekranı ile birlikte). GDD ERTELENDİ-EXT: "Masaüstü/Steam" satırı (`steamworks.js` isteğe bağlı bağımlılık, `game/package.json:76`; gerçek doğrulama Steam app id ister).
- 0.2'deki "10 KISMİ + 2 EKSİK" listesinden sonradan kapananlar kodda doğrulandı: doğum şehri (`NewCareerScreen.tsx:292`), emeklilik sonrası yollar (`sim/game/retirement.ts`), vadeli mevduat (`sim/life/economy.ts:200`), sigorta/garanti maddeleri (`contract.ts:52`), yedekte şikayet UI (`CareerCards.tsx:52`), pas isteme/el kaldırma (`game/callForBall.test.ts`), hakem sertliği/avantaj (`sim/match/referee.ts`), yardım seviyesi ödül çarpanı (`runtime.ts:717` ASSIST_REWARD).

Ayrıntılı iç backlog ve go/no-go: `docs/RELEASE-READINESS.md`.

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
| 2.6 Dünya, kupalar, milli takım | 2 → 48 | 32 → 0 | 15 → 0 |
| 2.7 UI/UX | 7 → 21 | 45 → 39 | 13 → 5 |
| 2.8 Ses ve müzik | 0 → 10 | 9 → 4 | 10 → 5 |
| 2.9 Platform ve teknik | 14 → 25 | 38 → 34 | 27 → 20 |
| 2.10 Meta, online, canlı operasyon | 5 → 18 | 1 → 1 | 18 → 0 |
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
| 2.6 | Dünya, ligler, kupalar, milli takım | 49 | 48 | 0 | 0 | 1 |
| 2.7 | UI/UX ve görsellik | 65 | 7 | 45 | 13 | 0 |
| 2.8 | Ses ve müzik | 19 | 0 | 9 | 10 | 0 |
| 2.9 | Platform ve teknik | 79 | 14 | 38 | 27 | 0 |
| 2.10 | Meta, online, canlı operasyon | 25 | 18 | 1 | 0 | 5 |
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

### 2.0b Platform, ses ve QA süpürmesi (S29): 2.8, 2.9, 2.12 kalan KISMİ/EKSİK satırlar

Durum etiketleri: **KAPANDI** (kod + test), **ERTELENDİ** (gerekçeli; BLOCKED-EXTERNAL = hesap, mağaza, backend, gerçek cihaz, hukuk; v2 = kapsam dışı). Yollar `game/` köküne göre.

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.8#2, #3, #52, #56 | KAPANDI | platform/lifecycle.ts (`applyAudioSession`), assets/LICENSES.csv, audio/licenses.node.test.ts | WP-18'de yapılmıştı; satırlar bayattı |
| 2.8#4 | TAMAM | audio/mixer.ts (`fadeMaster`), platform/lifecycle.ts (`SUSPEND_FADE_MS`), platform/lifecycle.test.ts, audio/mixer.test.ts | Arka plana geçerken ana kazanç 140 ms'de sönüyor, sonra AudioContext askıya alınıyor; hızlı dönüş askıyı iptal ediyor |
| 2.8#5 | TAMAM | audio/ui/QuickMute.tsx, ui/App.tsx | Ses kapalıyken (sessize alınmış ya da ana ses 0) sol altta tek dokunuşla "sesi aç" düğmesi |
| 2.8#24 | TAMAM | game/audio.ts `net()` | Düşük "şişme" gümbürtüsü + iki aşamalı file hışırtısı, şut hızıyla ölçekli |
| 2.8#36 | TAMAM | audio/settings.ts (`matchMusic`), audio/director.ts, audio/ui/AudioMixerPanel.tsx | Ayarlarda "Maç müziği" anahtarı; kapalıyken maçta yalnızca taraftar |
| 2.8#51 | ERTELENDİ | - | BLOCKED-EXTERNAL: gerçek iOS/Android cihaz (haptics eşlemesi kodda) |
| 2.8#57 | ERTELENDİ | - | Kayıtlı ses gerekir; ADR-002: tüm sesler WebAudio sentezi, lisans kapısı (`LICENSES.csv` + test) hazır, `audioFileBytes` bütçesi 2 MB |
| 2.9#1 | ERTELENDİ | - | v2: tek paket yeterli, monorepo faydası yok |
| 2.9#2 | ERTELENDİ | docs/ADR.md ADR-007 | `noUncheckedIndexedAccess` 1.714 hata veriyor (çoğu sim/ui, başka süpürmelerin dosyaları); dizin dizin açılacak |
| 2.9#3 | TAMAM | docs/ADR.md ADR-005 | Hedef kararı yazıldı (es2022 derleme, Electron 44 / güncel WebView) |
| 2.9#4 | TAMAM | package.json, package-lock.json | Phaser `4.2.1` sabitlendi |
| 2.9#6 | ERTELENDİ | - | IAP var (2.9#65), paylaşım kartı var; bulut BLOCKED-EXTERNAL (backend) |
| 2.9#12, #13, #16 | KAPANDI | game/view.ts:fitZoom, game/quality.ts:renderScale, game/pool.ts | WP-P: FIT tasarım alanı (38 m yatay / 21 m dikey, her zaman 24 m ileri; view.test.ts), DPR profili (cihaz oranı ≤2, dokunmatikte 1,9 MP / masaüstünde 5,2 MP piksel bütçesi, Düşük ≤1,25x; quality.test.ts), nesne havuzu (`ObjectPool`; uçan yazılar havuzdan; pool.test.ts). Perf 4x kısma: Düşük/Orta/Yüksek ~146/141/136 fps (eşik 60/55/45), masaüstü p95 4,3 ms |
| 2.9#15 | ERTELENDİ | - | Atlas paketleyecek doku dosyası yok: tüm maç görselleri prosedürel (v2, sanat varlığı gelince) |
| 2.9#17 | TAMAM | platform/glRecovery.ts, platform/glRecovery.test.ts | `webglcontextlost` yakalama aşamasında `preventDefault`, opt-in günlük, `sp:gl-lost/restored` olayları |
| 2.9#22 | TAMAM | e2e/hardening.spec.ts (memory) | 3 ısınma + 10 maç montajı, GC sonrası JS yığını: +1,0 MB (eşik 30 MB), mutlak 400 MB |
| 2.9#23 | ERTELENDİ | e2e/perf.spec.ts | BLOCKED-EXTERNAL: cihaz bazlı FPS hedefi gerçek cihaz ister (CPU 4x kısıtlı mobil profil e2e'de var) |
| 2.9#26 | ERTELENDİ | core/rng.ts | `fork` davranışı değişirse tüm golden çıktıları değişir; sim süpürmesiyle eşgüdümlü golden yenilemesi gerekir |
| 2.9#27 | TAMAM | eslint.config.js (`Date.now`/`Math.random` error), `npm run lint` 0 hata | Kural error, ihlal kalmadı |
| 2.9#29 | TAMAM | e2e/determinism.spec.ts | 120 maç + yeni oyun özeti: Chromium ile Node birebir aynı; Firefox/WebKit projesi eklenince aynı test koşar (tarayıcılar kurulu değil) |
| 2.9#30 | ERTELENDİ | - | v2: sim ana iş parçacığında bütçe içinde; yalnızca doku işçisi var |
| 2.9#31 | TAMAM | sim/game/statsGuard.ts, statsGuard.test.ts, statsBaseline.json, .github/workflows/nightly.yml | Gecelik istatistik koruması: 200 kariyer x 10 sezon, sapma eşiği aşarsa CI kırmızı [WP-V] |
| 2.9#36, #40 | ERTELENDİ | docs/ADR.md ADR-004 | Sürümlü veri paketi sim sahiplerine bağlı; FNV bütünlük içindir, güvenlik sınırı değil; SHA-256 asenkron API ister |
| 2.9#42 | TAMAM | state/save.ts (`recordMilestone`, `restoreMilestone`), state/saveFuzz.test.ts | Sezon başına ilk kayıt, slot başına en çok 3; canlı + yedekler yok olunca en yeni kilometre taşı yükleniyor |
| 2.9#45 | TAMAM | electron/main.cjs (`close` el sıkışması), electron/preload.cjs, platform/index.ts | Pencere kapanmadan renderer otomatik kaydı boşaltıyor (2 sn zaman aşımı) |
| 2.9#47, #130 | KAPANDI | state/fixtures/save-v1.json, state/saveFuzz.test.ts | Her eski sürüm için gerçek zarf zorunlu (politika testte), hepsi güncel şemaya taşınıyor |
| 2.9#50 | ERTELENDİ | - | BLOCKED-EXTERNAL: Capacitor Share/dosya diyaloğu gerçek cihazda doğrulanmalı (web indirme çalışıyor) |
| 2.9#57, #60, #87 (Steam tarafı), #88, #94 | ERTELENDİ | docs/PLATFORM.md | BLOCKED-EXTERNAL: Steam app id, Auto-Cloud, overlay testi, Steam Deck donanımı, bulut çakışma için backend; `steamworks.js` isteğe bağlı bağımlılık olarak paketlendi |
| 2.9#63, #116, #99 | ERTELENDİ | .github/workflows/release.yml | BLOCKED-EXTERNAL: Apple Developer hesabı/provisioning (iOS CI, TestFlight, notarize); mac imza doğrulaması iş akışında hazır |
| 2.9#67 | TAMAM | platform/android.node.test.ts | Manifest: dönüşte activity yeniden yaratılmıyor, iki yön serbest, tek exported activity; iOS yönleri doğrulanıyor (cihaz denemesi hâlâ BLOCKED-EXTERNAL) |
| 2.9#69 | TAMAM | electron/main.cjs (`render-process-gone`), platform/index.ts (`noteRecovery`) | Çöken renderer dakikada en çok 3 kez yeniden yükleniyor, kurtarma opt-in günlüğe yazılıyor; mobil WebView kurtarması BLOCKED-EXTERNAL (cihaz) |
| 2.9#72, #73 | KAPANDI | scripts/check-budgets.mjs, scripts/budgets.json, platform/budgets.node.test.ts, ci.yml | Gzip bütçeleri CI'da bloklayıcı (JS toplam 1260 KB, en büyük parça 600 KB, ilk açılış 790 KB, CSS 55 KB, ses dosyası 2 MB). Android `minifyEnabled` açılışı proguard + cihaz denemesi ister: ERTELENDİ (BLOCKED-EXTERNAL) |
| 2.9#76 | TAMAM | platform/back.ts (`pauseLiveMatchOnBack`), platform/back.test.ts, ui/App.tsx | Geri/Esc canlı maçta maçı duraklatıyor, asla terk ettirmiyor |
| 2.9#86 | TAMAM | electron-builder.yml (`electronFuses`), electron/csp.cjs, electron/main.cjs, platform/electron.node.test.ts | Fuses, CSP, izinlerin reddi, webview yasağı; paketli sürüm bu ortamda çalıştırılmadı |
| 2.9#92 | TAMAM | electron/main.cjs | Konum/boyut/büyütülmüş/tam ekran hatırlanıyor, F11 ve Alt+Enter; ayrı "kenarlıksız" modu v2 |
| 2.9#93 | TAMAM | e2e/viewports.spec.ts | 8 ekran şekli (21:9 … 280 px katlanabilir): yatay taşma yok, canvas kapsayıcıya sığıyor |
| 2.9#98 | TAMAM | .github/workflows/release.yml | İmza sırları varsa Windows Authenticode ve macOS codesign/spctl doğrulaması |
| 2.9#111 | ERTELENDİ | docs/legal/PRIVACY.*.md, public/legal/privacy-*.html | Taslak yayında; BLOCKED-EXTERNAL: hukuk incelemesi |
| 2.9#107 | ERTELENDİ | telemetry/errorLog.ts | BLOCKED-EXTERNAL: toplama uç noktası; yerel opt-in günlük + FPS özeti + kurtarma/kayıt olayları hazır |
| 2.9#112, #113 | KAPANDI | ci.yml (`test:coverage`, `lint`, bloklayan e2e), e2e/hardening.spec.ts | Çevrimdışı: üretim derlemesi SW kurulunca ağ kapalıyken yeniden yükleniyor |
| 2.9#115, #118 | ERTELENDİ | - | BLOCKED-EXTERNAL: imzalı release AAB için keystore, steamcmd yüklemesi için Steam hesabı |
| 2.9#117 | TAMAM | scripts/steam-depot.mjs, platform/steamDepot.node.test.ts, release.yml (`steam-depot`) | `content/<os>`, `app_build.vdf`, `depot_*.vdf` üretimi |
| 2.9#121 | TAMAM | release.yml (`environment: release`) | Depo ayarında zorunlu onaylayıcı tanımlanmalı (Settings > Environments) |
| 2.9#126 | TAMAM | eslint.config.js, store-iap/isolation.node.test.ts | sim/core `store-iap`, `telemetry`, `audio`, `platform`, `ui` içe aktaramaz (lint + bağımsız test); katalog stat artışı satmıyor |
| 2.9#127 | ERTELENDİ | store-iap/flavor.ts | BLOCKED-EXTERNAL: deneme kilidi mağaza ürünleriyle sınanmalı |
| 2.9#128 | TAMAM | docs/ADR.md | 7 karar kaydı |
| 2.12#11, #58 | ERTELENDİ | - | BLOCKED-EXTERNAL: ödül adlarının hukuk doğrulaması; yerel yorum API'si mağaza eklentisi ve cihaz ister |
| 2.12#13, #52 | TAMAM | sim/world/generate.ts, events/content/casinoCareer.ts | Arma kara listesi ve kendi maçına bahis kartı (WP-E) |
| 2.12#27, #28, #29 | KAPANDI | assets/LICENSES.csv, ci.yml (`licenses:check`), `npm run legal` | Kredi/lisans sayfaları üretilen dosyadan; CI eşitliği denetliyor |
| 2.12#42 | TAMAM | core/contentFlags.ts (`CASINO_BUILD`), core/contentFlags.test.ts, ui/store.ts, SettingsScreen.tsx | `VITE_FEATURE_CASINO=0` kumarhaneyi derlemede kalıcı gizler ve ayar anahtarını kaldırır |
| 2.12#70 | TAMAM | store-iap/demo.ts, main.tsx | Kiosk demo flavor mevcut (sabit tohum, boşta sıfırlama) |
| 2.12#73 | TAMAM | game/clipExport.ts, ui/screens/match/ClipButton.tsx, e2e/goalreel.spec.ts | Klip dışa aktarma: canvas.captureStream + MediaRecorder (WebM), 15 sn sınırı, paylaş/indir; destek yoksa düğme gizli; birim (sınır, özellik algılama) + yetenek kapılı e2e [WP-V] |
| 2.12#86 | TAMAM | .github/workflows/nightly.yml | Gece 02:17: 1000 kariyer x 10 sezon = 10.000 sezon, iflas eşiği korumalı, ardından birim testler + bütçe |
| 2.12#87 | TAMAM | sim/game/balanceSim.ts, nightly.yml | Persona'lı otomatik kariyer botu gecelik koşuyor (`humanBot` maç içi botu ayrı) |
| 2.12#88 | TAMAM | state/saveFuzz.test.ts | 2000 rastgele bozma, her karakter değişimi, k. yazımda çökme enjeksiyonu: hep yüklenebilir kayıt |
| 2.12#91 | TAMAM | e2e/ (31+ dosya, 95+ test) | Plan hedefi 40 aşıldı; CI'da bloklayıcı |
| 2.12#117 | TAMAM | telemetry/frameStats.ts, frameStats.test.ts | Opt-in günlükte p5 FPS ve en kötü kare; yalnızca canvas görünürken örnekleniyor |
| 2.12#118 | ERTELENDİ | - | Gereksiz: menüler DOM, render döngüsü yok (tarayıcı kendisi sınırlar) |
| 2.12#119, #120 | KAPANDI | telemetry/errorLog.ts (`recovered`, `webgl-lost`, `save`), ui/backend/persistence.ts | Kurtarma ve kayıt hataları/uyarıları opt-in yerel günlükte |
| 2.12#125 | TAMAM | ui/share/cards.ts (`upper` ile `tr-TR`) | Kullanıcıya görünen büyük harfler yerele duyarlı; kalan çağrılar yalnızca ASCII kimlik/renk |
| 2.12#127 | ERTELENDİ | core/gender.ts | ICU select yaşam/i18n süpürmesine bağlı; mevcut `trSuffix` yaklaşımı testli |
| Veri hakları (2.12 gizlilik) | KAPANDI | state/privacy.ts, privacy.test.ts, SettingsScreen.tsx (`export-all`, sıfırlama) | "Tüm verilerimi indir" (kayıtlar + ayarlar + başarımlar + günlük) ve gerçek "her şeyi sil" (anahtarlar, çevrimdışı önbellek, SW) |
| Yerel rekor koruması | KAPANDI | state/metaStore.ts (`sealOf`, `sanitizeRecords`), metaStore.test.ts | Onur Listesi/kişisel rekorlar mühürlü; elle değiştirilmiş blob karantinaya alınıp rekorlar sıfırlanır, mantıksız değerler atılır (caydırıcı, güvenlik sınırı değil) |
| CSP / çevrimdışı / sızıntı e2e | KAPANDI | e2e/hardening.spec.ts | Electron CSP altında Phaser sıfır ihlalle çalışıyor |

**Sayım (S29):** 2.8: 19 satır, 18 KAPANDI/TAMAM, 1 ERTELENDİ (+ #51 cihaz notu). 2.9: bu süpürmede 34 KAPANDI, 21 ERTELENDİ. 2.12: 16 KAPANDI, 6 ERTELENDİ.

### 2.0b S21 süpürmesi: 2.1-2.3 KISMİ/EKSİK satırları (hepsi [v1][P0])

Bölüm 2.1, 2.2 ve 2.3 tablolarındaki her KISMİ/EKSİK satır koda karşı yeniden denetlendi; satırlar tabloda yerinde güncellendi (not sütunu `S21:` ile başlar, kanıt yolları `game/src/` köküne göre). Bölüm 2.0'da zaten kapanmış 34 satır tabloda da TAMAM'a çekildi.

| Bölüm | Denetlenen | TAMAM | KISMİ | ERTELENDİ |
|---|---|---|---|---|
| 2.1 Maç motoru, his, kontroller | 40 | 37 | 3 (#6, #85, #128) | 0 |
| 2.2 Animasyon, kamera, efekt | 17 | 13 | 3 (#24, #26, #119) | 1 (#48) |
| 2.3 Kariyer ve oyun mantığı | 24 | 14 | 7 (#2, #3, #10, #39, #60, #70, #117) | 3 (#11, #13, #82) |

- **Yeni an tipleri (uçtan uca):** `dribble` (çalım), `header` (açık oyun kafa), `gk_1v1`, `gk_sweep` (kaleci), `back_post` (bek arka direk): yerleştirici, runtime, otomatik çözüm, TR/EN istem, bot, his bandı, demo e2e.
- **Testler:** `game/planRules.test.ts`, `game/runtimeRules.test.ts`, `sim/match/kinds21.test.ts`, `sim/match/injuryRisk.test.ts`, `sim/match/sim21.test.ts`, `sim/career/s21career.test.ts`, `game/camera.test.ts`, `game/aimView.test.ts`, `game/bulletTime.test.ts`, `game/netCloth.test.ts`; golden master bilinçli yenilendi (`UPDATE_GOLDEN=1`).
- **Erteleme gerekçeleri:** kaleci tutma/atma kontrolü ve atış pozu (2.1#85 korner yakalama, oyun kurma), BALANCE hedefleriyle çelişki (2.1#6 şut tepkisi, 2.1#119 %50 şut, 2.3#3 40 puan, 2.3#13 yaş çarpanları, 2.3#39 perk sayısı), kayıt migrasyonu (2.2#48, 2.3#11), gerçek cihaz (2.2#119), takvim yapısı (2.3#70 8 haftalık yaz), tasarım çelişkisi (2.3#82 ↔ 2.4#46), v2 dünya verisi (2.3#10 ayrı kadın ligleri).
- **Perf (4x kısma, mobil):** Düşük ~163 fps, Orta ~136 fps; e2e demo/match/setpieces/controls/training/postmatch/perf yeşil.

Kısmen ilerleyip durumu değişmeyenler: 2.5#117 (makbuz doğrulama `TODO(server)`), 2.6#34 ve #71, 2.7#1, #71, #73, #99, 2.9#111 ve #112 (lint + bloklayan e2e eklendi, coverage yok), 2.11#10 (axe e2e var), 2.12#91 (19 spec, hedef 40).

**GDD (2.13), TAMAM'a dönenler:** gizli potansiyel yıldızı (`legacy/CareerCards.tsx:69`), emeklilik kararı ve Onur Listesi (`ui/backend/meta.ts:205`, `HallOfFameScreen.tsx:28`), ısı ve şut haritası (`PostMatchScreen.tsx:223`), kalabalık/tezahürat/ıslık/yuhalama (`audio/crowd.ts`), hukuk olayları (`events/content/legal.ts`), milli turnuva + Ayın Oyuncusu + Yılın Golü (`sim/game/national.ts`, `awards.ts`), deneme + Tam Kariyer kilidi + kozmetikler (`store-iap/catalog.ts`), menü sesleri ve dinamik müzik (`audio/uiSfx.ts`, `music.ts`).

**GDD hâlâ açık (10 KISMİ + 2 EKSİK):** doğum şehri (EKSİK), emeklilik sonrası yollar (EKSİK), kaleci özellik grupları yalnız 2, sözleşme sigorta/süre garantisi, yedekte şikayet UI çağrısı yok, ilişki → pas sıklığı mesajı yok, yardım seviyesi ödül çarpanı yok (3.3 ve 9), takım arkadaşı el kaldırma/pas isteme yok, hakem avantaj ve sertlik yok, vadeli mevduat yok, `steamworks.js` bağımlılık değil (isteğe bağlı).

---

### 2.1 Maç Motoru, Oyun Hissi ve Kontroller

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.1#1 | TAMAM | sim/game/match.ts:176, sim/match/engine.test.ts:21 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Seed'li ve deterministik; `fork('match:id')` ve 1.000 maçlık golden master yok) |
| 2.1#2 | TAMAM | sim/match/engine.ts:1219 | S21: koda karşı yeniden denetlendi, kapandı. (eski: An sonucu skora yazılıyor; momentum ve kaçan fırsat raporu yok) |
| 2.1#3 | TAMAM | sim/match/engine.ts:590 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Sonuç önceden hesaplanmıyor; %70 telemetri testi yok) |
| 2.1#4 | TAMAM | ui/backend/liveMatch.ts:248, game/runtime.ts:296 | Bekleyen an kayda yazılıyor, an RNG'si seed'li, restore testi var |
| 2.1#6 | TAMAM | sim/match/engine.ts:684, sim/match/sim21.test.ts:95 | WP-B: alt lig takımı (58) üst lig takımını (76) 1000 maçta ≤ %12 yener (testli). +10 OVR tepkisi bilinçli olarak plandan dik (şut +%51–59, isabet +%4; plan %18/%6): calibration.test galibiyet bantları ve BALANCE dünya tabloları buna bağlı; BALANCE.md "WP-B" |
| 2.1#7 | TAMAM | sim/match/fairness.ts:23, engine.ts:1193 | 15 dk erken skor freni, 300 maçlık test |
| 2.1#8 | TAMAM | sim/match/fairness.ts:15, engine.ts:1221 | %8 altı an yeniden üretiliyor |
| 2.1#9 | TAMAM | sim/match/highlightGen.ts:509 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 4–9 an var; odak modu, Pozisyon Alma ve "beklenen an" gösterimi yok) |
| 2.1#12 | TAMAM | sim/match/teamModel.ts:79 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Yorgunluk takım reytingini düşürüyor; 70'/%40 kuralı yok, ana yansımıyor) |
| 2.1#14 | TAMAM | sim/match/rating.ts:134, ui/screens/match/PostMatchScreen.tsx:150 | Kalem kalem döküm, 7,0 tabanı testli |
| 2.1#18 | TAMAM | game/kick.ts:84 | S21: koda karşı yeniden denetlendi, kapandı. (eski: İleri swipe var; sapan (geri çekme) yok, 80 ms örnekleme yok) |
| 2.1#19 | TAMAM | game/MatchScene.ts:830 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Renkli güç halkası var; eşikler farklı, Soğukkanlılık sapması yok) |
| 2.1#20 | TAMAM | game/MatchScene.ts:757 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Noktalı yol var; Vizyon ölçeği yok, Zor/manuel modda kapanmıyor) |
| 2.1#21 | TAMAM | game/kick.ts:117, game/kick.ts:206 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Güç uzunluk ve hız karışımı; sayısal güç ayarı yok) |
| 2.1#22 | TAMAM | (bkz. 2.0b S21 süpürmesi) | S21: koda karşı yeniden denetlendi, kapandı. (eski: Dokun + salınan güç çubuğu şeması yok) |
| 2.1#23 | TAMAM | game/input.ts:8 | S21: koda karşı yeniden denetlendi, kapandı. (eski: PC'de bas-bırak şut var; aşırtma Ctrl/E'de, tekerle falso yok) |
| 2.1#24 | TAMAM | game/input.ts:408 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Gamepad tuşları var; analog güç, sağ analog falso, ölü bölge ayarı yok) |
| 2.1#26 | TAMAM | game/runtime.ts:490 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 0,25x bullet-time var; süre formülü farklı, baskıda yarılanma yok) |
| 2.1#28 | TAMAM | game/kick.ts:44 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Tam/yarı/manuel yardım var; ödül çarpanı yok) |
| 2.1#29 | TAMAM | game/kick.ts:446, game/runtime.ts:1543 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Mıknatıs ve İlk Dokunuş'a bağlı alım var; 1,5 m kuralı yok) |
| 2.1#34 | TAMAM | game/runtime.ts:1896 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Yalnızca görsel kare kaydı var; girdi kaydı yok) |
| 2.1#36 | TAMAM | game/runtime.ts:1339 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Top sürme Dribbling'e bağlı; ayrı an tipi yok) |
| 2.1#37 | TAMAM | game/ai.ts:253 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Top kapma ve top uzaklığı hesaplanıyor; 1,2 m ve %25 kuralı yok) |
| 2.1#44 | TAMAM | game/physics.ts:25 | 2.5D top, yerçekimi, hava direnci; şut hızı Şut özelliğine bağlı |
| 2.1#45 | TAMAM | game/physics.ts:230 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Magnus falso var; 3,5 m sınırı ve Teknik ölçeği yok) |
| 2.1#47 | TAMAM | game/runtime.ts:604 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Plase ve aşırtma var; yüzde kuralları yok) |
| 2.1#51 | TAMAM | game/physics.ts:305 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Direk modeli var; 200 regresyon testi yok) |
| 2.1#57 | TAMAM | game/kick.ts:126 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Pas tipleri var; tip başına hız aralığı yok) |
| 2.1#58 | TAMAM | game/runtime.ts:937 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Başka arkadaşa giden pas başarısız sayılıyor) |
| 2.1#59 | TAMAM | game/runtime.ts:729 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Ver-kaç mekaniği yok) |
| 2.1#60 | TAMAM | game/MatchScene.ts:1651,1748 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Ofsayt çerçevesi var; Vizyon'a göre pas hedefi vurgusu doğrulanamadı) |
| 2.1#62 | TAMAM | game/view.ts (crossCamFit), game/MatchScene.ts | S21: koda karşı yeniden denetlendi, kapandı. (eski: WP-16: gerçek yan açı yapılmadı (saha, tribün, reklam panoları ve kaleler sabit arka-kale projeksiyonunda çiziliyor; dokunmatik nişan `project`in tersini kullanıyor). Yerine orta anında sabit geniş kadraj: orta açan, düşüş noktası ve kale ağzı tek karede (yatayda hepsi, dikeyde düşüş + kale)) |
| 2.1#67 | TAMAM | game/runtime.ts:1890 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Kafa zamanlama halkası var; ayrı kafa an tipi yok) |
| 2.1#68 | TAMAM | game/runtime.ts:759,787 | Kafa yönü kaydırma ile |
| 2.1#71 | TAMAM | game/kick.ts (HEADER_RANGE) | Kafa vuruşu en fazla 18 m taşır; ötesi kısa indirme (kick.test) |
| 2.1#72 | TAMAM | sim/match/highlightGen.ts (placeDefend1v1, placeBlock) | WP-14: defend, interception, defend_1v1, block ayrı an tipleri |
| 2.1#73 | TAMAM | game/ai.ts (tackleOdds, cardForFoul) | Arkadan müdahale faul/kart olasılığını artırıyor; kartlar hakem sertliğiyle ölçekli; avantaj kuralı (runtime.tryAdvantage) |
| 2.1#74 | TAMAM | game/ai.ts:253 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Zamanlamaya bağlı müdahale var; 0,8 m/%70 kuralı yok) |
| 2.1#81 | TAMAM | game/ai.ts:408 | Kaleci 2D hareket ediyor, tepki Refleks'e bağlı |
| 2.1#82 | TAMAM | game/ai.ts (punchChance), game/runtime.ts (punch) | Yüksek topta kalabalık/yükseklik/hız/tutuş: yumruk ya da tutma |
| 2.1#83 | TAMAM | game/ai.ts:478 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Kurtarış fonksiyonu var; 1.000 şut tutarlılık testi yok) |
| 2.1#85 | TAMAM | game/runtime.ts keeperHold/checkKeeperHold, game/keeper.test.ts | WP-C: kaleci kahraman topu eline alınca bırakılmaz (6 sn kuralı), kaydırarak atar ya da vurur; dağıtım takım arkadaşına ulaşırsa pass_complete. Çıkış: gk_sweep. İşaretli sınır: korner yakalama sahnesi yok |
| 2.1#86 | TAMAM | game/runtime.ts:963 | Uzanma penceresi Refleks'e bağlı |
| 2.1#87 | TAMAM | game/runtime.ts:1238 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Vücut açısı ipucu var; erken ipucu ve ceza yok) |
| 2.1#93 | TAMAM | game/runtime.ts:377 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Penaltı panik titremesi var; eşik ve değerler farklı) |
| 2.1#94 | TAMAM | sim/match/referee.ts (ShotBook), game/runtime.ts (keeperRead) | Kaleciler kahramanın penaltı/şut yönlerini maç ve sezon boyunca hatırlıyor; penaltıda eğilme + "KÖŞENİ BİLİYOR" ipucu |
| 2.1#95 | TAMAM | game/setPieceChoice.ts, game/setPiecePicker.ts, sim/match/engine.ts (heroOrganisesWall) | fk_wall anı: kaleci ya da kaptan kahraman barajı kurar (2–5 kişi, ±1,5 m kaydırma, canlı önizleme); serbest vurucu barajı ve kaleciyi okuyup şut seçer (yakın alt, barajın üstü, uzak köşe, ince baraja sert, kalabalık barajda boştaki adama orta); büyük baraj kaleciyi kör eder |
| 2.1#97 | TAMAM | game/setPieceChoice.ts, game/setPiecePicker.ts, sim/match/engine.ts (corner) | corner_kick anı: korner atıcısı kahraman bölge (yakın/arka direk, penaltı noktası, kısa), yükseklik (sert/havalı) ve kavis (içe/dışa) seçer (dokunmatikte radyal seçici, PC tuşları, gamepad); arkadaşlar bölgeye koşar; sonuç asist/gol/uzaklaştırıldı |
| 2.1#98 | TAMAM | game/runtime.ts:889 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Kornerde ofsayt atlanıyor; birim test yok) |
| 2.1#102 | TAMAM | game/offside.ts:1 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Ofsayt var; 500 değil ~11 test) |
| 2.1#103 | TAMAM | game/MatchScene.ts:1546,1557 | Ofsayt çizgisi çiziliyor |
| 2.1#104 | TAMAM | sim/match/referee.ts, sim/world/referees.ts | Hakem sertliği 1-5 + avantaj eğilimi; maç önü kartı; sim ve anlarda faul/kart çarpanı |
| 2.1#105 | TAMAM | sim/match/referee.ts (banMatches) | Kırmızı 1-3 maç (ikinci sarı/son adam 1, sert faul 2, şiddet 3); 5 sarı = 1 maç; kahraman ve NPC'ler |
| 2.1#111 | TAMAM | game/runtime.ts:1108 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Arkadaşlar kesişme noktasına koşuyor; kabul testi yok) |
| 2.1#112 | TAMAM | game/runtime.ts (callForBall), game/input.ts | El kaldırıp pas isteme: uzun bas / G / gamepad Y; ilişki-vizyon-pas yolu; "PAS VERMİYOR" |
| 2.1#119 | TAMAM | sim/match/highlightGen.ts:446 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Mevkiye göre ağırlık var; kafa ve dribbling tipleri yok) |
| 2.1#120 | TAMAM | sim/match/highlightGen.ts (placeHoldUp) | WP-14: hold_up (top saklama) anı |
| 2.1#121 | TAMAM | sim/match/highlightGen.ts:598,603 | Kanatta ≥2 orta, stoperde ≥3 savunma anı, testli |
| 2.1#124 | TAMAM | sim/match/highlightGen.ts (KIND_WEIGHTS) | S21: koda karşı yeniden denetlendi, kapandı. (eski: Beklere defend_1v1 ve block eklendi; plan oranlarıyla tam kalibrasyon yok) |
| 2.1#125 | TAMAM | sim/match/highlightGen.ts:598,603 | Kanatta ≥2 orta, stoperde ≥3 savunma anı, testli |
| 2.1#128 | TAMAM | core/types.ts:437 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 4 zorluk var; "Özel" mod yok) |
| 2.1#129 | TAMAM | sim/game/balance.test.ts:84 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Sezon gol medyanı raporlanıyor; 25–45 bandı kontrolü yok) |

### 2.2 Animasyon, Kamera, Efektler ve Sunum

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.2#1 | TAMAM | game/MatchScene.ts:847 | Tek kamera, tek projeksiyon |
| 2.2#2 | TAMAM | game/MatchScene.ts:862 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Üstel yumuşatma var; sönüm ve hız sınırı yok) |
| 2.2#3 | TAMAM | game/MatchScene.ts:853 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Önden bakış var; %18 kuralı yok) |
| 2.2#4 | TAMAM | game/MatchScene.ts:528 | S21: koda karşı yeniden denetlendi, kapandı. (eski: An başı kadrajı (kahraman + 3 pas seçeneği) yok) |
| 2.2#7 | TAMAM | game/MatchScene.ts:874 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Kamera sınırı 13 m (hedef 6 m)) |
| 2.2#14 | TAMAM | game/runtime.ts:416 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 0,25x ve vinyet var; geçiş eğrisi ve doygunluk yok) |
| 2.2#15 | TAMAM | game/MatchScene.ts:1123 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Süre Soğukkanlılığa bağlı; topta daralan halka yok) |
| 2.2#16 | TAMAM | game/MatchScene.ts:757 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Önizleme var; Teknik/Vizyon'a göre uzunluk yok) |
| 2.2#17 | TAMAM | game/MatchScene.ts:830 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 3 renk; sarı bant ve renk körü deseni yok) |
| 2.2#18 | TAMAM | game/MatchScene.ts:778 | S21: koda karşı yeniden denetlendi, kapandı. (eski: İniş halkası var; X işareti ve elips yok) |
| 2.2#24 | TAMAM | game/figures.ts, game/figureAnim.ts | Prosedürel figür atlası: 8 koşu + 4 yürüme + 3 bekleme karesi forma sayfasına pişirilir (figureAnim.test.ts); sanatçı atlası 2.9#15 ile bekliyor |
| 2.2#25 | TAMAM | game/MatchScene.ts:1582 | Forma numarası ve isim etiketi |
| 2.2#26 | TAMAM | game/figureAnim.ts:kickStyleFor | Vuruş pozu: dört stil için temas + takip karesi, vuruştan seçilir |
| 2.2#37 | TAMAM | game/presentation.ts:98,168 | Kutlama yönü, ilişkiye göre yanına gelenler |
| 2.2#38 | TAMAM | game/presentation.ts (CELEBRATIONS) | WP-16: 12 kutlama (robot, heart_hands, ice_cold, cartwheel eklendi); pakette 5 kozmetik |
| 2.2#47 | TAMAM | ui/screens/match/Moments.tsx:92, game/presentation.ts:222 | Anlar listesi, en iyi 3 an, çok açılı tekrar |
| 2.2#48 | TAMAM | game/src/sim/game/saveHistory.ts, ui/screens/profile/GoalReel.tsx, MatchScene.ts (inputReplay), game/reel.test.ts, e2e/goalreel.spec.ts | Son 12 gol tekrarı kayıtta (seed+girdi + sahne); Profil > Gol kaseti MatchScene'de girdiyi yeniden oynatır, aynı sonuç (birim + e2e kabul ölçütü) [WP-V] |
| 2.2#49 | TAMAM | ui/screens/match/Moments.tsx:92, game/presentation.ts:222 | Anlar listesi, en iyi 3 an, çok açılı tekrar |
| 2.2#63 | TAMAM | game/quality.ts (ParticleBudget), MatchScene.fxN | WP-16: profil başına sabit canlı parçacık bütçesi (120/260/480) |
| 2.2#66 | TAMAM | game/art.ts:430 | S21: koda karşı yeniden denetlendi, kapandı. (eski: File dalgası var; verlet ızgara yok) |
| 2.2#73 | TAMAM | game/MatchScene.ts:489 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Yağmur ve sürtünme var; sıçrama ve HUD ikonu yok) |
| 2.2#74 | TAMAM | game/MatchScene.ts:756 | Rüzgâr km/sa göstergesi |
| 2.2#82 | TAMAM | game/presentation.ts:16 | 4 stadyum kademesi |
| 2.2#92 | TAMAM | game/MatchScene.ts:515 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Skor bandı var; TV grafiği stili yok) |
| 2.2#102 | TAMAM | PostMatchScreen.tsx:370,158, postFlow.ts:7 | Adım adım maç sonu, count-up reyting |
| 2.2#103 | TAMAM | PostMatchScreen.tsx:370,158, postFlow.ts:7 | Adım adım maç sonu, count-up reyting |
| 2.2#106 | TAMAM | ui/screens/match/LiveMatchScreen.tsx:212 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 1/2/4x var; "sonraki anıma geç" yok) |
| 2.2#118 | TAMAM | game/quality.ts, ui/store.ts (quality/qualityAuto) | WP-16: Düşük/Orta/Yüksek/Otomatik (cihaz testi); seyirci yoğunluğu, tifo, hava, parlama |
| 2.2#119 | ERTELENDİ-EXT | e2e/perf.spec.ts | Mali-G52 sınıfı 2 GB cihazda 30 fps/%2 ve 15 dk termal kabul ölçümü gerçek cihaz ister; emülasyonda 4x CPU kısma ile fps yazdırılır (perf.spec.ts), kapı değil |
| 2.2#121 | TAMAM | game/MatchScene.ts:303 | Hareketi azalt sahnede ~26 yerde uygulanıyor |

### 2.3 Kariyer ve Oyun Mantığı

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.3#1 | TAMAM | core/types.ts:18, sim/match/highlightGen.ts:85 | 10 mevki, mevkiye göre an havuzu |
| 2.3#2 | TAMAM | game/training/drills/distribution.ts, sim/career/training.ts (distribution), sim/match/rating.ts keeperSaveScore, sim/world/awards.ts goalkeeperAwardScore | Kaleci reyting terimi ve Altın Eldiven formülü (WP-C) + ikinci kaleci drili "Çıkış & Hâkimiyet": ortayı havada kap (Kaleci/Handling), 6 sn içinde koşan arkadaşa at (≤24 m) ya da vur; puan 0..1, not, bot ve testli, TR/EN, cihaz başına ipucu (`distribute`) |
| 2.3#3 | ERTELENDİ-INT | sim/career/createHero.ts:48 | WP-B: uyumsuzluk kuralı yapıldı (`ARCHETYPE_MISMATCH_SHARE` 0,5). 40 puan bütçesi ertelendi (sapma önerisi): başlangıç OVR 48–54 ve 18/21/25 itibar eğrisi 80–90 puanlık arketiple kalibre; 40 puanda arketip başına özellik farkı ~+5 kalır, kimlik kaybolur ve tüm denge yeniden ayarlanır D29: kod değişikliği küçük ama golden.json + balance.test tüm kariyer eğrilerini kaydırır; eşzamanlı life/ekonomi ajanıyla golden çakışması ve ayrı BALANCE turu gerekir, v1.1. |
| 2.3#7 | TAMAM | sim/game/trials.ts:2 | Seçmeler ve akademi daveti, varsayılan açık |
| 2.3#10 | ERTELENDİ-INT | core/gender.ts, sim/game/gender.test.ts, sim/career/genderText.test.ts | WP-C: kadın dünyası (isimler, yüzler, serbest oyuncular) ve TR/EN cinsiyet metin testi tamam. Ayrı kadın lig piramidi kulüp adı/arma ve hukuk taramasına bağlı; v2 D29: kalan iş kod değil: kadın lig kulüp adı/arma tasarımı ve hukuk taraması insan işi (sanat+hukuk); v2. |
| 2.3#11 | TAMAM | ui/screens/profile/OvrExplainer.tsx, sim/game/ovrBreakdown.ts, ovrBreakdown.test.ts | "OVR nasıl hesaplanır?" ekranı: mevkiye göre ağırlık payı, değer, puan; toplam OVR |
| 2.3#12 | TAMAM | sim/career/scouting.ts:32 | PA yıldızı ve izci bandı |
| 2.3#13 | ERTELENDİ-INT | sim/career/progression.ts:104 | WP-B: ertelendi (sapma önerisi). Plan çarpanları (×1,3/1,0/0,7/0,5) başka bir XP maliyet eğrisi varsayıyor; bizde ≤20 ×1,35, 21–23 ×1,15, 24–26 ×0,8, 27–29 ×0,6, 30–32 ×0,4 + azalan getiri, 17–21 yaş +5–7 OVR/sezon ve 22–24 yaşta 80+ hedefini tutuyor. Fiziksel düşüş 30+ ve zihinsel gelişim 33’e kadar zaten var (`physicalDeclinePerSeason`, mental ×1,6) D29: mevcut eğri hedef OVR bantlarını (balance.test) tutuyor; plan çarpanlarına geçiş golden + denge turu ister, v1.1. |
| 2.3#14 | TAMAM | sim/career/decay.ts:32 | Özellik erimesi + uyarı |
| 2.3#15 | TAMAM | sim/career/matchOutcome.ts:202 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Maç XP'si var; aksiyon başına XP yok) |
| 2.3#21 | TAMAM | sim/career/training.ts:102 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Puanlama ve formül farklı) |
| 2.3#22 | TAMAM | game/training/drills/dribbling.ts:1 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Koni slalomu var; plandaki kurallar yok) |
| 2.3#23 | TAMAM | game/training/drills/finishing.ts:5 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Hedef şut var; 9 bölge ve 10 şut yok) |
| 2.3#24 | TAMAM | game/training/drills/passing.ts:1 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Pas drili var; 4'e 2 rondo yok) |
| 2.3#25 | TAMAM | game/training/scoring.ts:38 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Falso kapısı ve rüzgâr göstergesi yok) |
| 2.3#26 | TAMAM | game/training/drills/{crossing,heading,tackling}.ts | 3 yeni drill |
| 2.3#27 | TAMAM | game/training/drills/{crossing,heading,tackling}.ts | 3 yeni drill |
| 2.3#28 | TAMAM | game/training/drills/{crossing,heading,tackling}.ts | 3 yeni drill |
| 2.3#29 | TAMAM | game/training/drills/goalkeeping.ts:1 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Refleks drili var; formül farklı) |
| 2.3#39 | TAMAM | data/perks.ts PERK_BRANCH/perkTier, sim/career/perks.ts perkBlock (tier), data/perkTree.test.ts | WP-C: 3 dal (Teknik, Fiziksel, Zihinsel) × 3 kademe; kademe 2 için dalda 1, kademe 3 için 2 sahip olunan perk gerekir (neden: `tier`) |
| 2.3#40 | TAMAM | sim/career/matchPerks.ts:15 | Maç perkleri maça etki ediyor |
| 2.3#55 | TAMAM | sim/career/condition.ts:51, sim/match/engine.ts:1374 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Maçta ve antrenmanda sakatlık ve rehab var; süreler ve risk faktörleri farklı) |
| 2.3#60 | TAMAM | sim/career/contract.ts, squadRole.ts, condition.ts, matchPay.ts, wp15.test.ts, s21career.test.ts | WP-C: form ve süre garantisi, sakatlık sigortası, imaj hakkı (sponsor +%15) pazarlıkta ve ContractScreen'de; testli. Performans bonusu şablonu 2.5#55'te |
| 2.3#61 | TAMAM | sim/career/contract.ts:319 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Sabır ve tur var; maddeler arası takas yok) |
| 2.3#62 | TAMAM | sim/career/market.ts:39, contract.ts:474 | Piyasa referansı, son teklif kuralı |
| 2.3#63 | TAMAM | sim/career/market.ts:39, contract.ts:474 | Piyasa referansı, son teklif kuralı |
| 2.3#70 | TAMAM | sim/game/internal.ts transferWindow, s21career.test.ts | WP-C: kış penceresi 4 hafta (22-25), test "winter window is 4 weeks" |
| 2.3#71 | TAMAM | ui/backend/realData.ts:389 | S21: koda karşı yeniden denetlendi, kapandı. (eski: İlgi listesi var; neden ve 1–5 ölçeği yok) |
| 2.3#72 | TAMAM | sim/career/transfers.ts:109 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Yumuşak uyum var; −6 OVR kuralı yok) |
| 2.3#73 | TAMAM | ui/backend/realData.ts:406 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Bonservis var; değer dökümü yok) |
| 2.3#74 | TAMAM | sim/career/transfers.ts:254 | S21: koda karşı yeniden denetlendi, kapandı. (eski: Transfer talebi var; değerler farklı) |
| 2.3#81 | TAMAM | ui/screens/legacy/CareerCards.tsx:14, sim/career/squadRole.ts:200 | Beklenen dakika, form maddesi (≥7,5) |
| 2.3#82 | TAMAM | sim/career/squadRole.ts trustBand/TRUST_BAND_CUTS, squadRole.test.ts | WP-C: bantlar <40 / 40-59 / 60-79 / 80+. 2.4#46 ile çözüm: bant rol merdivenini kapılar (düşük güven rolü rotasyonla sınırlar, 80+ yıldız eşiğini 8→6 indirir); haftalık ilk 11 zarında form+reyting %75, güven en çok %25 kalır |
| 2.3#83 | TAMAM | ui/screens/legacy/CareerCards.tsx:14, sim/career/squadRole.ts:200 | Beklenen dakika, form maddesi (≥7,5) |
| 2.3#84 | TAMAM | PostMatchScreen.tsx:267 | Güven değişim nedenleri |
| 2.3#91 | TAMAM | sim/game/national.ts:33,116 | A/U21/U19, çağrı göstergesi |
| 2.3#92 | TAMAM | sim/game/national.ts:33,116 | A/U21/U19, çağrı göstergesi |
| 2.3#98 | TAMAM | ui/screens/awards/AwardsScreen.tsx:79, sim/world/awards.ts:28 | Aday listesi, 100 gazeteci oylaması |
| 2.3#99 | TAMAM | ui/screens/awards/AwardsScreen.tsx:79, sim/world/awards.ts:28 | Aday listesi, 100 gazeteci oylaması |
| 2.3#106 | TAMAM | ui/screens/legacy/CareerCards.tsx:59 | Emeklilik girişi UI'da |
| 2.3#117 | TAMAM | ui/screens/NewCareerScreen.tsx:364 | S21: koda karşı yeniden denetlendi, kapandı. (eski: 4 zorluk yalnızca an zorluğunu etkiliyor; özel ayar yok) |
| 2.3#118 | TAMAM | (bkz. 2.0b S21 süpürmesi) | S21: koda karşı yeniden denetlendi, kapandı. (eski: Ertelendi: maç sim kalibrasyonu, WP-17 (2.1#129)) |
| 2.3#119 | TAMAM | sim/game/match.ts:176 | Maç seed'i maçtan önce kayda yazılıyor |

### 2.4 Sosyal Hayat, İlişkiler, Kararlar ve Olaylar

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.4#1 | TAMAM | sim/life/relationships.ts:125 | Her takım arkadaşı ayrı −100..100 |
| 2.4#2 | TAMAM | sim/life/relationships.ts:20,47 | İlişki defteri, "neden" paneli |
| 2.4#3 | TAMAM | ui/screens/life/Relations.tsx (rel-band, rel-effect, rel-trend), sim/game/relationView.ts, relationView.test.ts, e2e/wpu.spec.ts | 5 bant x 40 puan, her bantın yazılı oynanış etkisi (takım arkadaşı için pas sıklığı %), 4 haftalık eğilim oku |
| 2.4#4 | TAMAM | sim/life/relationships.ts neglectStep, relationships.test.ts | İhmal sönümü haftada değer yüzde 2 (aile yarısı, ortak ayrık 3 kat), tek tıkta en fazla 3 puan; yakın arkadaş yarısı hızında söner. golden yenilendi. |
| 2.4#5 | TAMAM | sim/life/relationships.ts:20,47 | İlişki defteri, "neden" paneli |
| 2.4#6 | TAMAM | sim/career/matchOutcome.ts:176 | İyi maçta net negatif ilişki yok |
| 2.4#7 | TAMAM | sim/life/events/dilemma.test.ts | Etkiler fonksiyon olduğundan linter her seçeneği örnek durumlarda çalıştırıp ilişki deltalarını ölçer: bir tarafın kaybı toplam kazancın 1,5 katını aşarsa test (CI) kırılır; 17 dengesiz seçenek düzeltildi. DSL yeniden yazımı gerekmedi. |
| 2.4#11 | TAMAM | sim/life/scenes.ts, events/content/scenes.ts, ui/screens/life/Relations.tsx, e2e/lifeplus.spec.ts | Kişi kartında Sohbet et (3 cevap: dinle/espri/tavsiye) ve Birlikte vakit (antrenman/yemek/oyun gecesi) sahneleri; tek dokunuşla biter, sıcaklığa göre sonuç, kişi başı günlük bir kullanım. |
| 2.4#14 | TAMAM | sim/career/createHero.ts rollFamily, sim/career/family.test.ts, ui/screens/life/Relations.tsx | Geçmiş hikâyesine göre prosedürel aile: çift ebeveyn / tek anne / tek baba / koruyucu aile (ebeveynsiz), 0-2 kardeş, çocukluk arkadaşı; akademi ve futbol ailesi çift ebeveyn ve en az 1 kardeş. İlişkiler ekranında hane satırı. golden yenilendi. |
| 2.4#15 | TAMAM | sim/life/relationships.ts:189 | Yakın çevre etkisi tavanlı |
| 2.4#23 | TAMAM | sim/life/wellbeing.ts:67 | Partner yokluğu ceza vermiyor |
| 2.4#24 | TAMAM | ui/screens/SettingsScreen.tsx (partnerPref), sim/game/partnerPref.ts, partnerPref.test.ts, ui/backend/prefsSync.ts | Ayarlarda Fark etmez/Kadınlar/Erkekler; kariyere yansır, flört olayı adı havuzdan seçer. Mevcut partner değişmez; "Fark etmez" eski seçimi byte-aynı korur |
| 2.4#25 | TAMAM | sim/life/events/content/romance.ts:415 | TD etkisi −4 (tavan −5) |
| 2.4#36 | TAMAM | sim/match/passNet.ts, engine.ts (passNet), game/runtime.ts (kickBall), ui/backend/postMatch.ts buildPassNetView, PostMatchScreen PassStep, LiveMatchScreen lm-snub, passNet.test.ts, e2e/postmatch.spec.ts | Çift bazlı pas telemetrisi (sayım only, RNG yok, golden aynı): oynanan anda runtime, arka planda hash tabanlı; maç sonu Pas ağı adımı (sana pas verenler / görmeyenler + ilişki bandı), canlı hub'da X sana pas vermiyor |
| 2.4#37 | TAMAM | sim/life/closeFriends.ts, closeFriends.test.ts, ui/screens/life/Relations.tsx, e2e/lifeplus.spec.ts | En fazla 3 yakın arkadaş: kriz haftasında destek (mutluluk +6, stres -5, 4 haftada bir), transfer söylentisinde içeriden bilgi olayı (rumour.insider_tip), takım arkadaşıysa ~%10 pas bonusu (maç motoru relationToHero), ihmal yarısı hızda söner. |
| 2.4#46 | TAMAM | sim/career/squadRole.ts formTerm/ratingTerm/trustTerm; life/sweep2.test.ts | Form+reyting %75, güven/ilişki en çok %25 |
| 2.4#47 | TAMAM | sim/game/objectives.ts objectivesAfterMatch, PostMatchScreen.tsx, objectives.test.ts | Hoca beklentileri: pres (top kapma) ve takım oyunu (isabetli pas) hedefleri; hedefler maçtan hemen sonra kapanır (+4 güven, ödül anında), maç sonu raporunda Karşılandı işaretli. |
| 2.4#52 | TAMAM | sim/match/decisions.ts | Maç içi karar penceresi: anlar arasında sim duraklar, 2-3 seçenek + 12 sn sayaç (durdurulabilir), penaltı/frikik kullanan, kışkırtma, sevinç, kaptan-hakem, taktik çıkış; en fazla 2 pencere, 20 dk bekleme, ayarlardan kapatılır; sonuçlar maç sonunda ilişki/moral/güven/not (+kart) olarak işlenir. |
| 2.4#53 | TAMAM | sim/life/events/content/teammates.ts, sim/life/relationships.ts, relationships.test.ts | Sezon başı kaptanlık yarışı: kıdemlilerle yemek kampanyası seçeneği (oy + ilişki etkisi), oylamada kaybedince kazanan ile 40 hafta süren rekabet bayrağı (ilişki her 3 haftada -1). |
| 2.4#60 | TAMAM | sim/game/interview.ts:294,254 | 3 soruluk röportaj, etki tavanı, tuzak soru |
| 2.4#61 | TAMAM | sim/game/interview.ts:294,254 | 3 soruluk röportaj, etki tavanı, tuzak soru |
| 2.4#65 | TAMAM | sim/life/casino.ts:916,992 | Tek ziyaret manşet değil, yardım hattı |
| 2.4#69 | TAMAM | sim/life/social.ts:153 SPAM_DECAY (haftalık paylaşım sayacı) | Haftada tekrar eden paylaşımın getirisi üstel düşer |
| 2.4#70 | TAMAM | sim/life/social.ts POST_TYPES.thanks/rival; Social.tsx | Taraftara teşekkür ve rakibe gönderme eklendi |
| 2.4#79 | TAMAM | sim/life/fanGroups.ts, fanGroups.test.ts, events/content/community.ts, Relations.tsx | Üç taraftar grubu (ultralar, aile tribünü, yerel dernek) farklı beklentilerle: maç ve haftalık güncelleme, 2 olay kartı (ultra mektubu, aile tribünü günü), İlişkiler ekranında bölüm. |
| 2.4#84 | TAMAM | sim/life/events/content/casino.ts:51 | Reddetmek yalnız stres; ceza yok |
| 2.4#85 | TAMAM | sim/life/sponsors.ts (ScandalLevel 1-4) | WP-15: seviye 4 tüm sponsorları bitirir |
| 2.4#90 | TAMAM | sim/life/casino.ts:916,992 | Tek ziyaret manşet değil, yardım hattı |
| 2.4#98 | TAMAM | sim/life/events/content/friends.ts debt_trouble>aftermath>debt_press>debt_reunion | 4 adımlı zincir |
| 2.4#99 | TAMAM | sim/match/decisions.ts | Penaltı tartışması 2.4#52 karar penceresine bağlandı (penaltı kullanan seçimi ve kaptan hakem çıkışı); kaptanlık oylaması 2.4#53 hazır. |
| 2.4#100 | TAMAM | sim/life/events/content/nightlife.ts, sim/game/objectives.ts startPresetObjective, events/proveYourself.test.ts | Gece zinciri: parti, fotoğraf, gazete, disiplin görüşmesi (yeni), PR seçimi ve Kendini kanıtla görevi (bir maçta 7,5+ puan, 5 hafta), sonuçta değerlendirme kartı. |
| 2.4#101 | TAMAM | events/content/abroad.ts, events/types.ts:34, events/engine.ts:383 | Zincir, yeni kategoriler (252 olay), kariyer başı sınır |
| 2.4#102 | TAMAM | sim/life/events/content/casino.ts:23 | Bahis çetesi zinciri tam |
| 2.4#110 | TAMAM | sim/life/events/types.ts, content.test.ts, dilemma.test.ts | Zod yerine (yeni bağımlılık yok) TS tipli EventDef şema + content.test.ts (iki dilli metin, 2-4 seçenek, yer tutucu, etkileri çalıştırma, zincir erişilebilirliği) + linter; CI derlemesinde doğrulanır. Bilinçli sapma. |
| 2.4#111 | TAMAM | events/content/abroad.ts, events/types.ts:34, events/engine.ts:383 | Zincir, yeni kategoriler (252 olay), kariyer başı sınır |
| 2.4#112 | TAMAM | events/content/abroad.ts, events/types.ts:34, events/engine.ts:383 | Zincir, yeni kategoriler (252 olay), kariyer başı sınır |
| 2.4#113 | TAMAM | ui/screens/EventModal.tsx, ui/components/Chip.tsx (DeltaChip direction), SettingsScreen eventTransparency | Ayarlarda Tam şeffaflık / Yön çipleri. Varsayılan Tam şeffaflık (mevcut davranış korunur); zorluk ekranına taşıma gerekmedi |
| 2.4#114 | TAMAM | sim/life/events/engine.ts recallLine, events/proveYourself.test.ts, styles/screens/event.css | Gecikmeli (2+ hafta) her olay kartı, tetikleyen eski kararı ve seçimi metnin başında hatırlatır (N hafta önce ... seçtin); yaşam günlüğüne zaten kayıtlı. |
| 2.4#118 | TAMAM | sim/life/events/gender.test.ts, content.test.ts | Tüm olay metinleri {g:he|she} kalıbıyla yazılı; kadın kariyerinde bütün olaylar taranıp yanlış zamir yok testi var. ICU select söz dizimi yerine eşdeğer kalıp kullanılıyor (bilinçli sapma). |

### 2.5 Ekonomi, Lüks, Yatırım, Kumarhane, Monetizasyon

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.5#1 | TAMAM | ui/format.ts (moneyStyle), SettingsScreen, e2e/wpu.spec.ts | Para gösterimi: simge (€), kod (EUR), Yıldız (✦). Yalnızca arayüz tutarları; olay metinleri € kalır (sim metni) |
| 2.5#2 | TAMAM | ui/moneyLint.node.test.ts | Fiyat benzeri değerin ham sayı biçimleyiciyle yazılmasını CI testi engeller |
| 2.5#3 | TAMAM | ui/screens/profile/FinanceCharts.tsx (finance-statement), sim/game/weeklyStatement.ts, weeklyStatement.test.ts; maç sonu: PostMatchScreen EarningsStep | Haftalık kalem kalem kazanç dökümü, bir hafta çubuğuna dokununca o haftanın dökümü |
| 2.5#4 | TAMAM | sim/career/matchPay.ts:matchBonuses cleanSheet | Kaleci temiz kasa primi |
| 2.5#5 | TAMAM | sim/game/season.ts:paySeasonEndBonuses | Kupa başına 4 haftalık takım primi |
| 2.5#8 | TAMAM | sim/life/economy.ts COUNTRY_TAX/incomeTaxRate; sweep2.test.ts | Kulüp ülkesine göre %27–40 vergi |
| 2.5#10 | TAMAM | sim/life/economy.ts agentFee (maaş+sponsor); matchPay.ts | Komisyon sponsor gelirinden de kesilir |
| 2.5#11 | TAMAM | sim/life/economy.ts tickTrainerContract; sweep2.test.ts | Antrenör sözleşmesi 44 hafta, 4 hafta kala uyarı, bitince ayrılır (UI çubuğu: TrainingScreen, UI ajanı) |
| 2.5#15 | TAMAM | sim/life/economy.ts livingCost, economy.test.ts, financeHistory.ts | Temel yaşam gideri (kira/yemek/ulaşım/bakım: maaşın %6'sı, 25-3000/hf) haftalık tabloda ayrı kalem; her sözleşmede vergi+menajer sonrası pozitif kalır (test), BALANCE: 20 kariyer x 10 sezon iflas %0, nakdin eksiye düştüğü hafta 0,1. golden yenilendi. |
| 2.5#16 | TAMAM | data/activities.ts energy_drink; activities.test.ts | Enerji içeceği aktivitesi (hızlı enerji, yorgunluk bedeli) |
| 2.5#17 | TAMAM | data/activities.ts:2 | Günde 3 dilim |
| 2.5#18 | TAMAM | sim/life/activities.ts sleepQuality, activities.test.ts, ui/screens/life/Assets.tsx | Gece uykusu eksik enerjinin %75'ini (düz konak) ile %100'ünü (premium yatak/ev, sleep etkisi) doldurur; Varlıklar ekranında uyku kalitesi satırı; yorgunluk ayrı değer olarak kaldı. |
| 2.5#19 | TAMAM | data/activities.ts, data/assets.ts | Fiyatlar sabit tasarım gereği; enflasyon yok |
| 2.5#22 | TAMAM | data/assets.ts:143 | Para ile hızlandırma satılmıyor |
| 2.5#23 | TAMAM | sim/life/economy.ts:124 | Gider varlık bakımından |
| 2.5#24 | ERTELENDİ-INT | sim/game/balanceSim.ts, sim/game/balance.test.ts | BALANCE telemetrisi harcama/gelir oranını yazar (25/33/46% ilk 3 sezon, zirvede %56-66; hedef %40-60 / %50-70): ilk sezonlar bandın altında. Emeklilik net serveti 18+ sezonluk koşu ister (CI için çok uzun). Erken harcamayı yükseltmek ayrı bir yaşam-tarzı denge turu; v1.1. |
| 2.5#29 | TAMAM | sim/life/projects.ts, events/content/projects.ts, projects.test.ts | Geç oyun para yutucuları: akademi (3 aşama), hayır stadyumu (2 aşama), kulüp hissesi (%25'e kadar, temettü), miras fonu (Legacy çocuğuna, tavanlı); gerçek etki: bakım, mezun, taraftar, itibar, Hall of Fame puanı |
| 2.5#42 | TAMAM | sim/game/internal.ts:93 | Piyasa kayıtlı RNG ile |
| 2.5#53 | TAMAM | sim/life/business.ts (businessRevenueCap) | WP-15: haftalık gelir 3x tavan |
| 2.5#54 | TAMAM | sim/life/sponsors.ts (10 kategori, 6 anlaşma tavanı); sponsors.test.ts | 4 yeni kategori |
| 2.5#55 | TAMAM | core/types.ts SponsorDeal.perfBonus, sim/life/sponsors.ts, ui/screens/life/Sponsors.tsx, e2e/lifeplus.spec.ts | Sponsor teklifi tek tabloda: süre, haftalık ücret, performans primi (gol/asist başına), şöhret eşiği, davranış maddesi, münhasırlık; prim haftalık tickte net ödenir. |
| 2.5#60 | TAMAM | sim/life/sponsors.ts sponsorImage, sponsors.test.ts | Sponsor değeri %70 performans/şöhret + %30 imaj (takipçi %60, davranış %40; lüks en fazla imajın %20'si); lüks eşyasız kahraman da sponsor alır. BALANCE hedefleri tuttu, golden yenilendi. |
| 2.5#62 | TAMAM | sim/life/sponsors.ts:16 | Bahis sponsoru yok |
| 2.5#63 | TAMAM | data/assets.ts (`collector`), sim/life/assetEffects.ts, projects.test.ts | Koleksiyon eşyaları: değer kazanır, Hall of Fame'e `collector` puanı verir (tavan 12) |
| 2.5#64 | TAMAM | data/assets.ts | Sanat kategorisi 7'den 15'e: 8 koleksiyon eşyası (15 bin-15 milyon); en pahalı basamaklar da dolu |
| 2.5#71 | TAMAM | sim/game/assetView.ts WEAR_PER_YEAR, assetWear.test.ts | Yalnız mekanik/kullanılan eşyalar (araç, tekne, jet, teknoloji, giyim, tesis) yıpranır; sanat, saat, ev, ada, evcil hayvan yıpranmaz (test). |
| 2.5#80 | TAMAM | ui/screens/life/Assets.tsx | WP-15: satın alma onayında "net maaşın ~N haftası" |
| 2.5#84 | TAMAM | events/content/casinoCareer.ts (`casino.horse_offer` → `horse_race_day` → `horse_retirement`) | Yarış atı sahipliği: 3 adımlı zincir, ödül havuzu, emeklilik kararı |
| 2.5#89 | TAMAM | - | Fiş/IAP satışı yok |
| 2.5#90 | TAMAM | ui/screens/SettingsScreen.tsx:120 | Kumarhaneyi gizle |
| 2.5#91 | TAMAM | ui/backend/casinoView.ts:47 | 18 yaş kilidi |
| 2.5#92 | TAMAM | sim/life/casino.test.ts (10M spin), slotExactRtp | Slot RTP hem tam sayımla hem 10 milyon spin Monte Carlo ile her CI koşusunda doğrulanır (~1 sn): RTP %92-96 dışında ise build kırılır. |
| 2.5#99 | TAMAM | sim/life/casino.ts weeklyCasinoTick LEAK_CHANCE, casino.test.ts | Bağımlılık 60 ve üzeri iken haftalık %15 basına sızma: basın ilişkisi -4, disiplin -3, haber; test oran ve eşiği doğrular. |
| 2.5#102 | TAMAM | sim/life/events/content/casinoCareer.ts, sim/life/events/engine.ts sponsorLoss, events/ownBet.test.ts | Kendi maçına bahis: kartta Ağır yasal risk etiketi, %35 açığa çıkma: 25 maç men, tüm sponsorlar fesih (davranış maddesi bağlı), disiplin/şöhret/taraftar kaybı. Sapma: şöhret -12 (plan -40; 0-100 ölçekte kariyer bitirirdi), men 6 ay yerine 25 maç. |
| 2.5#103 | TAMAM | sim/life/events/content/casino.ts:51 | Sessiz ret cezasız |
| 2.5#105 | ERTELENDİ-EXT | docs/PLATFORM.md:148 | BLOCKED-EXTERNAL: Mağaza beyanı (veri güvenliği/IAP) mağaza hesabı ister (Ertelendi: monetizasyon: store-iap ajanı) |
| 2.5#109 | TAMAM | sim/life/economy.ts lowCashRisk/lowCashWarning; economy.test.ts | Zorunlu satıştan önce 4 haftada bir uyarı |
| 2.5#112 | TAMAM | store-iap/entitlements.ts:46, catalog.ts:12, capacitorProvider.ts:38 | Deneme kilidi, kozmetikler, satın alma/geri yükleme |
| 2.5#113 | TAMAM | store-iap/entitlements.ts:46, catalog.ts:12, capacitorProvider.ts:38 | Deneme kilidi, kozmetikler, satın alma/geri yükleme |
| 2.5#114 | TAMAM | store-iap/entitlements.ts:46, catalog.ts:12, capacitorProvider.ts:38 | Deneme kilidi, kozmetikler, satın alma/geri yükleme |
| 2.5#115 | TAMAM | - | Kariyer parası satılmıyor |
| 2.5#116 | TAMAM | - | Reklam yok |
| 2.5#117 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: Makbuz doğrulama `TODO(server)`: sunucu/backend ister (Ertelendi: monetizasyon: store-iap ajanı) |
| 2.5#118 | TAMAM | - | Ödüllü yorum istemi yok |
| 2.5#119 | ERTELENDİ-EXT | ui/screens/store/PurchasesPanel.tsx:20, StoreScreen.tsx:8 | BLOCKED-EXTERNAL: Satın alma geçmişi ve mağaza varlıkları mağaza hesabı ister (Satın alma geçmişi ve mağaza varlıkları eksik) |
| 2.5#120 | ERTELENDİ-EXT | ui/screens/store/PurchasesPanel.tsx:20, StoreScreen.tsx:8 | BLOCKED-EXTERNAL: Satın alma geçmişi ve mağaza varlıkları mağaza hesabı ister (Satın alma geçmişi ve mağaza varlıkları eksik) |
| 2.5#122 | TAMAM | - | Karanlık örüntü yok |
| 2.5#125 | TAMAM | .github/workflows/nightly.yml, sim/world/worldReport.test.ts | WP-B: gecelik iş 1000×10 denge tablosu, 2 tohum × 100 sezon dünya yetenek raporu (ort./p95/p99/max) ve drift korumasını artefakt olarak yükler, özeti çalıştırma sayfasına yazar; 100 sezon kararlılık adımı (LONGRUN=1) eklendi |
| 2.5#126 | TAMAM | sim/career/wp15.test.ts | WP-15: 20 tohum x 5 sezon ekonomi değişmezleri |

### 2.6 Dünya, Ligler, Kupalar, NPC'ler, Milli Takımlar, Veri

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.6#1 | TAMAM | sim/world/worldRules.test.ts | Sabitlenmiş dünya karması (aynı seed her cihazda aynı bayt); üretim değişirse test bilerek güncellenir |
| 2.6#2 | TAMAM | sim/world/worldRules.test.ts, data/world/countries.ts | 12 ülke, 450 kulüp (testle sabit); ülke adları gerçek yer adları (marka değil), lig ve kupa adları kurgusal |
| 2.6#5 | TAMAM | sim/world/generate.ts generateSquad, season.ts youthIntake, worldRules.test.ts | Aynı kulüpte aynı ad-soyad üretilmez (yalnızca çakışmada yeniden çekilir) |
| 2.6#7 | TAMAM | data/world/names.ts cityTier, CITY_CAPACITY_CAP, worldRules.test.ts | Köy/kasaba/şehir/metropol kademesi şehir sırasından; stadyum kapasitesi kademeyle sınırlı |
| 2.6#9 | TAMAM | sim/world/generate.ts foundedYear, sim/world/profiles.ts shortClubName, ClubScreen Info | Kuruluş yılı (kimlikten türetilir, RNG yok), tam ad + 3 harfli kod + en çok 12 karakterlik kısa ad |
| 2.6#10 | TAMAM | data/world/names.ts isRealPersonName, sim/world/players.ts randomName, worldRules.test.ts | Kara liste kulüp, lig ve gerçek kişi adlarını kapsar; oyuncu ve TD adları gerçek bir futbolcuyla çakışırsa yeniden çekilir |
| 2.6#11 | TAMAM | sim/world/generate.ts crestFor, worldQuality.test.ts | Aynı ülkede iki kulübün arması (şekil + sembol + ana renk) aynı olamaz |
| 2.6#16 | ERTELENDİ-INT | sim/world/generate.ts:220 | İtibar 1-100 ölçeğinde kaldı; 0-10.000 gösterimi 100+ çağrı noktasını etkiler, oyuncuya fark yaratmaz (görünüm ölçeği v1.1) D29: yalnız görünüm ölçeği: sim 1-100 ile çalışıyor, 0-10.000 gösterimi 100+ çağrı noktası ve golden gerektirir, v1.1. |
| 2.6#17 | TAMAM | sim/world/quickSim.test.ts | 1.000 maçlık eşikli test |
| 2.6#18 | TAMAM | sim/world/worldQuality.test.ts | Kupa sürpriz oranı testi |
| 2.6#19 | TAMAM | sim/world/profiles.ts clubFinanceSheet, ClubScreen FinanceCard | Gelir (bilet, yayın, sponsor, ödül, transfer) ve gider (maaş, tesis, transfer) kalemleri; maaş her kulüpte gelirin %55-70'i (testli) |
| 2.6#32 | TAMAM | ui/screens/ClubScreen.tsx | Forma numarası |
| 2.6#33 | TAMAM | ui/screens/match/PreMatchScreen.tsx | Maç öncesi ceza ve sözleşme kartı |
| 2.6#34 | TAMAM | sim/game (pickKeyPlayer) | Rakip anahtar oyuncu form/mevki skoruyla seçilir |
| 2.6#36 | TAMAM | sim/world/profiles.ts npcTraits, season.ts applyMatchStats, ClubScreen MateSheet, profiles.test.ts | 10 trait, oyuncu başına 2-4 (kimlikten türetilir, saklama yok); kart, sakatlık ve soyunma odası morali etkilenir |
| 2.6#39 | TAMAM | sim/world/profiles.ts managerProfile, sim/career/squadRole.ts, ClubScreen ManagerCard | TD adı, yaşı, formasyon/stil tercihi, gençlere güven (genç oyuncunun rol skoru ±2,5) ve sabır (düşük sabırlı TD bir sıra erken gönderilir) |
| 2.6#40 | TAMAM | sim/world/managers.ts | TD kovma ve atama, efsane oyuncular dugout'a dönebilir |
| 2.6#45 | TAMAM | sim/world/season.ts:539 | NPC gelişimi ve düşüşü var |
| 2.6#46 | TAMAM | sim/world/season.test.ts | Transfer hacmi testi |
| 2.6#47 | TAMAM | sim/world/season.ts addLegend, managers.ts, WorldScreen LegendsCard, longRun.test.ts | Emekli yıldızlar (OVR 74+) world.legends listesine girer, en çok 150; bazıları TD olur |
| 2.6#48 | TAMAM | sim/world/season.ts academyLevel, longRun.test.ts | Akademi seviyesi 1-5 (kulüp itibarından): 4+ seviye ek genç getirir; 50 sezonda nüfus ±%8 bandında |
| 2.6#54 | TAMAM | sim/world/players.ts:81 | Kadın dünyasında sakal yok |
| 2.6#55 | TAMAM | gender.test.ts | Zamir kapsamı testli |
| 2.6#62 | TAMAM | data/world/rules.ts, sim/world/generate.ts, longRun.test.ts | Kademe başına yükselme/düşme sayısı ülkeye göre veri (2/3/4 takım), play-off ile birlikte; her kademenin takım sayısı sezonlar boyunca değişmez (testli) |
| 2.6#63 | TAMAM | sim/world/competitions.ts | Yükselme play-off'u |
| 2.6#65 | TAMAM | sim/world/table.ts tieRuleFor, tieBreakHint, worldRules.test.ts | İki kural seti: averaj önce (varsayılan) veya ikili maç önce (ES, IT, PT, FR); lig tablosu altında ipucu |
| 2.6#68 | TAMAM | ui/screens/national/NationalCard.tsx | Sonraki turnuva bilgisi |
| 2.6#69 | TAMAM | sim/world/fixtures.ts limitVenueStreaks, deferDerbies, worldRules.test.ts | Art arda en çok 2 iç/dış saha, aynı şehir derbileri ilk 3 haftada oynanmaz |
| 2.6#70 | TAMAM | sim/world/fixtures.ts QUALIFYING_DAY, worldRules.test.ts | Hiçbir kulüp 72 saatten kısa aralıkla maç oynamaz (eleme turu Salı'ya alındı) |
| 2.6#71 | TAMAM | sim/world/longRun.test.ts, sim/world/anchor.ts | 50 sezon (LONGRUN=1 ile 100): kademe boyutları, nüfus, kadro sınırları ve ortalama yetenek sabit; dünya enflasyonu giderildi |
| 2.6#72 | TAMAM | ui/tutorial/MatchdayConfirm.tsx | İlerle maç günü onayı |
| 2.6#76 | TAMAM | ui/screens/cup/CupDrawScreen.tsx | Yerel kupa kurası ekranı |
| 2.6#79 | TAMAM | sim/world/competitions.ts | Kıtasal kupa ön eleme ve çift maç |
| 2.6#84 | TAMAM | sim/world/competitions.ts | Kupa galibine kıtasal kontenjan |
| 2.6#87 | TAMAM | sim/world/coefficients.ts | Katsayı sistemi |
| 2.6#91 | TAMAM | sim/world/national.ts | Milli takım kadrosu |
| 2.6#92 | TAMAM | sim/world/national.ts | Çağrı sayacı görünür |
| 2.6#93 | TAMAM | sim/world/national.ts | Eleme grupları ve milli fikstür |
| 2.6#94 | TAMAM | sim/world/national.ts | Dünya Turnuvası |
| 2.6#102 | TAMAM | sim/world/awards.ts | Aday listesi ve Ayın Oyuncusu |
| 2.6#103 | TAMAM | sim/world/awards.ts | Altın Yıldız ilk 30 listesi |
| 2.6#106 | TAMAM | ui/screens/cup/CupsPanel.tsx | Kupa istatistikleri |
| 2.6#107 | TAMAM | sim/world/managers.ts updateClubRecords, sim/game/records.ts | Kulüp rekorları |
| 2.6#116 | TAMAM | sim/world/generate.ts (WOMEN_*), profiles.test.ts | Kadın dünyası ayrı rastgele akış, itibar (×0,88), bütçe (×0,5) ve stadyum (×0,4); erkek dünyasının bayraklı kopyası değil |
| 2.6#119 | TAMAM | data/world/*.ts, data/world/version.ts, sim/game/mods.ts | Statik veri paketi sim kodundan ayrı, şemalı, doğrulayıcılı ve sürümlü (DATA_VERSION); mod paketleri aynı şemayla JSON olarak girer |
| 2.6#120 | TAMAM | data/world/validate.ts WORLD_DATA_SCHEMA | Veri şeması |
| 2.6#121 | TAMAM | data/world/validate.ts | Veri paketi doğrulayıcı (CI testli) |
| 2.6#127 | TAMAM | data/world/version.ts, sim/world/generate.ts | Dünya dataVersion taşır |
| 2.6#128 | TAMAM | sim/world/dataUpdate.ts, sim/game/persist.ts loadGame, profiles.test.ts | Eski kariyerler yüklenirken veri adımları bir kez uygulanır (v2: kuruluş yılları, efsane listesi); adımlar eklemelidir, kariyer sonucunu değiştirmez |

### 2.7 UI/UX ve Görsellik

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.7#1 | TAMAM | ui/styleAudit.node.test.ts | Koyu ve açık temada token çiftleri için WCAG kontrast testi (CI) |
| 2.7#2 | ERTELENDİ-INT | ui/styleAudit.node.test.ts | Sabit hex borcu 138 ile dondurulmuş (artış testle engelli). Kalanlar çizim paletleri (StoryArt, TrophyArt, DrillDiagram, Logo, casino/shared SVG); tema belirteci olamaz, sanatçı paleti ister; v2 sanat geçişi |
| 2.7#7 | TAMAM | ui/styleAudit.node.test.ts | Stylelint yerine bağımlılıksız düğüm denetimi: gap/padding/margin px değerleri 4/8 ızgarası dışında ≤44 (dondurulmuş, yalnız azalır), `--sp-*` belirteçleri 4 katı |
| 2.7#8 | TAMAM | styles/components.css, casino.css, objectives.css, training.css; ui/styleAudit.node.test.ts | Ölçek dışı yarıçap 40 → 0 (11→10, 28/22→20, 99→999); test artık `toBe(0)` |
| 2.7#13 | TAMAM | styles/tokens.css data-theme=light, styles/theme-light.css, SettingsScreen tema anahtarı, e2e/wp27.spec.ts | AA kontrastlı açık tema (axe color-contrast 14 ekranda 0), Sistem seçeneği; maç gecesi ekranları koyu kalır |
| 2.7#14 | TAMAM | styles/fonts.css, e2e/fonts.spec.ts | Fontlar @fontsource ile self-host |
| 2.7#15 | TAMAM | ui/styleAudit.node.test.ts | .num tabular-nums test edilir; piksel görsel regresyon altyapısı ayrı iş (ertelendi) |
| 2.7#16 | TAMAM | styles/tokens.css, e2e/visual.spec.ts | Plan bantları uygulandı: display 40–56, H1 28–32, H2 20–22 px (clamp), gövde 15, mikro 12 (a11y alt sınırı planın 11 px değerinin üstünde tutuldu). Görsel regresyon: e2e/visual.spec.ts 8 ekran × 390/1440 (taşma, kesik başlık, VISUAL_PIXELS=1 ile %4 piksel farkı); önce/sonra 16/16 geçti, ekran görüntüleri incelendi |
| 2.7#21 | ERTELENDİ-INT | ui/layout/Shell.tsx | Sekmeler Ana Sayfa/Kariyer/Yaşam/Dünya/Menü: bilinçli IA kararı. Plan Takım+Profil sekmesi ister; bizde Takım içeriği Kariyer/Dünya altında, Profil Kariyer altında, Menü ayar/kayıt barındırıyor. Değiştirmek rota ağacını ve tüm e2e gezinmeyi yeniden yazar; ürün sahibi kararı |
| 2.7#22 | TAMAM | e2e/wpu.spec.ts (single CTA) | #main içinde en fazla bir dolu buton, 15 ekran + yaşam/dünya sekmeleri taranır; liste içi Buy/Play drill ikincil yapıldı |
| 2.7#23 | TAMAM | e2e/wp27.spec.ts | Hub kutucukları 1 dokunuş, Menü kutucukları 2 dokunuşla açılır; e2e ile sabitlendi |
| 2.7#24 | TAMAM | ui/screens/PlannerScreen.tsx, e2e/wp27.spec.ts | 7 günlük şerit (e2e sayar) |
| 2.7#25 | TAMAM | platform/back.ts:14 | Android geri tuşu doğru |
| 2.7#30 | TAMAM | ui/layout/Shell.tsx:1 | Masaüstünde kenar menü ve bağlam paneli |
| 2.7#31 | TAMAM | ui/App.tsx, ui/layout/ShortcutsModal.tsx, e2e/wp27.spec.ts | Space, 1-5, M, T, I, Esc ve ? ile kısayol listesi |
| 2.7#32 | TAMAM | input/gamepadNav.ts, gamepadNav.test.ts, ui/App.tsx startGamepadNav, tokens.css focus ring | D-pad uzamsal gezinme, A onay, B geri, LB/RB sekme; odak halkası 3 px mavi + 2 px boşluk |
| 2.7#34 | TAMAM | styles/tokens.css --fs-micro 12px, ui/styleAudit.node.test.ts | 12 px altı yazı kalmadı (SVG rulet numarası hariç); test sayar |
| 2.7#38 | TAMAM | e2e/wpu.spec.ts (single CTA) | #22 ile aynı denetim |
| 2.7#39 | TAMAM | e2e/wpu.spec.ts, ui/screens/life/Assets.tsx | Yıkıcı etiketler (sat, emekli ol, sil, ayrıl...) danger varyantı: denetim testi; satış butonu danger |
| 2.7#40 | TAMAM | styles/components.css:760, ui/components/PlayerCard.tsx | 5:7 `aspect-ratio`, bronz/gümüş/altın/elit/efsane çerçeve, tek satır 6 stat, arma. Avatar facesjs değil özel sistem (bkz. 2.7#114) |
| 2.7#42 | TAMAM | ui/components/Chip.tsx (TONE_ICONS) | Anlamlı tonlu çip ikonsuz verilirse varsayılan ikon alır; nötr çip metin-only. 80 çağrı noktası değişmedi |
| 2.7#43 | TAMAM | ui/components/MeterRing.tsx lowAt, styles/components.css .meter-ring-low | %20 altında uyarı rozeti, nabız (reduced motion saygılı) ve ekran okuyucu metni |
| 2.7#44 | TAMAM | ui/components/StatBar.tsx | Önizleme ve 3 sn'lik değişim "+3 ▲ / −1 ▼" |
| 2.7#48 | TAMAM | sim/game/undoSale.ts, assetUndo.test.ts, ui/screens/life/Assets.tsx, e2e/wpu.spec.ts | Satış onaysız, 6 sn Geri al toast; eşya aynı sıraya döner, gelir geri alınır |
| 2.7#50 | TAMAM | ui/components/Controls.tsx Slider slider-step | Slider ± adım düğmeleri, 44 px, klavye gerekmez |
| 2.7#55 | TAMAM | ui/screens/profile/AttrGrowth.tsx, growthCompare.ts, career/Radar.tsx, e2e/goalreel.spec.ts | Profilde özellik gelişimi: `attrSeries` ile şimdi ve bir sezon önce radar bindirmesi (kesikli çizgi), en çok gelişenler ve çizgi grafik; birim + e2e (axe temiz) [WP-V] |
| 2.7#56 | TAMAM | ui/components/Charts.tsx Sparkline, e2e/wp27.spec.ts | Dokun, sürükle veya ok tuşlarıyla noktanın değerini okur |
| 2.7#59 | TAMAM | ui/components/Donut.tsx, ui/screens/profile/FinanceCharts.tsx, sim/game/financeHistory.ts | Gelir/gider halka grafikleri (dokunulabilir) ve haftalık net çubukları; son 12 hafta. Bank ekranı başka ajanın alanı, Profil kartında |
| 2.7#60 | TAMAM | ui/components/LeagueTable.tsx:14 | Bölge şeritleri ve vurgu var |
| 2.7#63 | TAMAM | ui/components/StatBar.tsx statbar-tier | Renk körü modunda kademe numarası (1-6) |
| 2.7#66 | TAMAM | game/MatchScene.ts, game/aimView.ts | WP-P doğruladı: HUD_ROW band 36 px (~4,5 % of 800 px), skor + dakika + kondisyon |
| 2.7#67 | TAMAM | game/MatchScene.ts, game/aimView.ts | WP-P doğruladı: Kahraman halkası + ok (MatchScene.buildPlayers, ring2) |
| 2.7#68 | TAMAM | game/MatchScene.ts, game/aimView.ts | WP-P doğruladı: aimView.ts güç bantları, kırmızı >%85, desenli renk körü modu |
| 2.7#71 | TAMAM | ui/screens/match/PreMatchScreen.tsx ExpectationCard | Stadyum kapasitesi, rol, beklenen dakika ve ilk 11 şansı |
| 2.7#72 | TAMAM | ui/screens/match/PostMatchScreen.tsx RatingStep | Reyting dökümü adımı mevcut |
| 2.7#73 | TAMAM | sim/career/matchPay.ts, PostMatchScreen (EarningsStep) | WP-16: maaş payı, gol/asist/maça çıkma/kaleci primi, sponsor, imaj hakları, vergi, menajer |
| 2.7#74 | TAMAM | ui/screens/match/LiveMatchScreen.tsx:165 | Radar, anlatım, hız ve atla var |
| 2.7#78 | ERTELENDİ-INT | ui/screens/HomeScreen.tsx | Hub masaüstünde iki sütunlu (ana + yan); tek sütun sabit sıra düzeni bozar, mobilde sıra plana yakın. Sanat incelemesi 8+ verdi; ürün sahibi kararı |
| 2.7#79 | ERTELENDİ-INT | ui/screens/NewCareerScreen.tsx | 7 adım kasıtlı (ulus, mevki, arketip ayrı adım; tek adımda 4 kavram mobilde sıkışır); her adım e2e ile doğrulanıyor, "Rastgele" var |
| 2.7#80 | TAMAM | ui/screens/TrainingScreen.tsx decay-warning | Hareketsizlik/erime uyarısı antrenman ekranında |
| 2.7#81 | TAMAM | ui/screens/life/Relations.tsx, sim/game/interactCost.ts | Avatar, değer, eğilim oku, son 5 anı, etkileşim butonlarında enerji ve € maliyeti |
| 2.7#82 | TAMAM | ui/screens/life/Relations.tsx WhyPanel (kaynaklı ledger), PostMatchScreen RelationsStep | Her değişim nedeniyle: son 10 kayıt + neden toplamları |
| 2.7#83 | TAMAM | sim/game/whyMore.ts, whyMore.test.ts, ui/components/WhyList.tsx, whyPlaying.ts | İlk 11 şansı + kulüp ilgisi/transfer (WorldScreen), sponsor (Sponsors), ödül kaybı (AwardsScreen): en etkili 3 etken, yüzde pay |
| 2.7#84 | TAMAM | ui/screens/life/Assets.tsx | Fiyat (€), haftalık bakım, mutluluk ve şöhret çip olarak; kategori sekmeleri |
| 2.7#85 | TAMAM | ui/screens/store/StoreScreen.tsx | Mağaza/Destek ekranı mevcut |
| 2.7#86 | TAMAM | ui/screens/life/Assets.tsx (shelf-stats), sim/game/assetView.ts, assetUndo.test.ts | Raf: kondisyon % ve ikinci el değeri (resaleValue; modal eski resale formülünü kullanıyordu, kalktı) |
| 2.7#87 | TAMAM | ui/screens/casino/shared.tsx (LimitBand, bet slider), sim/game/casinoLimits.ts, casinoLimits.test.ts | Kayıp limiti sim/life/casino canBet ile zaten zorlanıyordu; şimdi her kumarhane ekranında sabit bant (bakiye, kullanılan/limit, oturum süresi) ve sim ile aynı üst sınırlı slider. Kendi maçına bahis arayüzde yok |
| 2.7#88 | TAMAM | sim/game/patienceEstimate.ts, patienceEstimate.test.ts, ContractScreen patience-preview | Teklif göndermeden önce sabır maliyeti (counterOffer ile aynı hesap, 5 puanlık bant, "masadan kalkar" uyarısı) |
| 2.7#89 | TAMAM | ui/screens/WorldScreen.tsx, sim/game/clubPreview.ts, clubPreview.test.ts | Takip / ciddi ilgi / teklif hazır kademeleri (sim eşikleriyle), şehir, beklenen rol, maaş aralığı, tek dokunuşla karşılaştırma tablosu |
| 2.7#90 | TAMAM | ui/screens/InboxScreen.tsx (news-cause), sim/game/newsCause.ts, newsCause.test.ts | Habere dokununca olayı/haftanın kayıtlarını gösterir. Olay haberi n. olay kaydıyla eşlenir; haber öğesine olay kimliği eklenmedi (sim değişmedi) |
| 2.7#91 | ERTELENDİ-INT | ui/screens/LifeScreen.tsx | Telefon metaforu tam yeniden tasarım: çerçeve/ikon varlıkları ve tüm yaşam alt ekranlarının yeniden akıtılması gerekir; `ui/screens/life/**` başka paketin elinde; v1.1 |
| 2.7#93 | TAMAM | ui/screens/EventModal.tsx:69 | Risk rozeti ve etki çipleri var |
| 2.7#94 | TAMAM | ui/screens/ProfileScreen.tsx (club-stats), sim/game/clubStats.ts, clubStats.test.ts | Sezon/Kariyer tablosuna kulüp bazlı kırılım; gol krallığı NPC sıralaması WorldScreen scorers sekmesinde mevcut |
| 2.7#98 | TAMAM | ui/screens/SavesScreen.tsx, ui/backend/persistence.ts, e2e/goalreel.spec.ts | Kayıt yuvası kartında `thumbSvg` portresi (summary.thumb SaveSlotInfo'ya taşındı); e2e [WP-V] |
| 2.7#99 | TAMAM | ui/screens/SettingsScreen.tsx | WP-16: Gizlilik ve Bulut ("Yakında", bağlantısız) grupları |
| 2.7#103 | TAMAM | styles/tokens.css:136 | Hareket token'ları var |
| 2.7#105 | TAMAM | ui/hooks/motion.ts:20 | Count-up var |
| 2.7#114 | ERTELENDİ-INT | ui/screens/newcareer/AppearanceEditor.tsx | Özel avatar editörü çalışıyor; facesjs yerine özel SVG sistemi (bilinçli sapma: bağımlılık, cinsiyet/yaş/forma entegrasyonu). Ten rengi seçimi var |
| 2.7#122 | TAMAM | ui/tutorial/CoachTour.tsx, e2e/onboarding.spec.ts | Koç turu: ilk maç anı, antrenman ve olay kartı |
| 2.7#123 | TAMAM | ui/tutorial/unlocks.ts, UnlockGate.tsx, e2e/onboarding.spec.ts | Kumarhane/yatırım/işletme kademeli açılır, tek kartlık tanıtım |
| 2.7#127 | ERTELENDİ-INT | ui/screens/SettingsScreen.tsx | Onay/gizlilik penceresi yok çünkü veri toplayan SDK yok (testlenecek Kabul/Reddet çifti bulunmuyor). Analitik eklenince pencere ve eş boyutlu buton testi aynı PR'da gelir |
| 2.7#128 | TAMAM | ui/format.ts formatMoney, ui/moneyLint.node.test.ts | Tüm tutarlar formatMoney ile sembollü; ham biçimlendiriciyle fiyat basımı moneyLint testiyle derlemede reddedilir (ayrı Price tipi gerekmiyor) |
| 2.7#129 | ERTELENDİ-EXT | - | Mağaza puanı istemi StoreKit/Play API gerektirir (BLOCKED-EXTERNAL) |
| 2.7#130 | TAMAM | ui/components/Button.tsx IconButton 44px, Toast .toast-close 44px | Kapat düğmeleri 44x44, gecikme yok |
| 2.7#131 | TAMAM | ui/screens/store/PaywallScreen.tsx, e2e/iap.spec.ts | Satın alma ekranı kalıcılık ve kapsamı gösterir, geri yükleme var |

### 2.8 Ses ve Müzik

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.8#1 | TAMAM | audio/mixer.ts:14, crowd.ts:3,32, director.ts:37 | Mikser, kalabalık katmanları, kapasite, gerilim |
| 2.8#2 | TAMAM | platform/lifecycle.ts (`applyAudioSession`), assets/LICENSES.csv, audio/licenses.node.test.ts | WP-18'de yapılmıştı; satırlar bayattı [S29; kanıt yolları game/ köküne göre] |
| 2.8#3 | TAMAM | platform/lifecycle.ts (`applyAudioSession`), assets/LICENSES.csv, audio/licenses.node.test.ts | WP-18'de yapılmıştı; satırlar bayattı [S29; kanıt yolları game/ köküne göre] |
| 2.8#4 | TAMAM | audio/mixer.ts (`fadeMaster`), platform/lifecycle.ts (`SUSPEND_FADE_MS`), platform/lifecycle.test.ts, audio/mixer.test.ts | Arka plana geçerken ana kazanç 140 ms'de sönüyor, sonra AudioContext askıya alınıyor; hızlı dönüş askıyı iptal ediyor [S29; kanıt yolları game/ köküne göre] |
| 2.8#5 | TAMAM | audio/ui/QuickMute.tsx, ui/App.tsx | Ses kapalıyken (sessize alınmış ya da ana ses 0) sol altta tek dokunuşla "sesi aç" düğmesi [S29; kanıt yolları game/ köküne göre] |
| 2.8#12 | TAMAM | audio/mixer.ts:14, crowd.ts:3,32, director.ts:37 | Mikser, kalabalık katmanları, kapasite, gerilim |
| 2.8#13 | TAMAM | audio/mixer.ts:14, crowd.ts:3,32, director.ts:37 | Mikser, kalabalık katmanları, kapasite, gerilim |
| 2.8#14 | TAMAM | audio/mixer.ts:14, crowd.ts:3,32, director.ts:37 | Mikser, kalabalık katmanları, kapasite, gerilim |
| 2.8#23 | TAMAM | game/audio.ts:154,302,240, audio/music.ts:21, audio/uiSfx.ts:13 | Vuruş, direk, düdük, müzik, UI sesleri |
| 2.8#24 | TAMAM | game/audio.ts `net()` | Düşük "şişme" gümbürtüsü + iki aşamalı file hışırtısı, şut hızıyla ölçekli [S29; kanıt yolları game/ köküne göre] |
| 2.8#25 | TAMAM | game/audio.ts:154,302,240, audio/music.ts:21, audio/uiSfx.ts:13 | Vuruş, direk, düdük, müzik, UI sesleri |
| 2.8#26 | TAMAM | game/audio.ts:154,302,240, audio/music.ts:21, audio/uiSfx.ts:13 | Vuruş, direk, düdük, müzik, UI sesleri |
| 2.8#35 | TAMAM | game/audio.ts:154,302,240, audio/music.ts:21, audio/uiSfx.ts:13 | Vuruş, direk, düdük, müzik, UI sesleri |
| 2.8#36 | TAMAM | audio/settings.ts (`matchMusic`), audio/director.ts, audio/ui/AudioMixerPanel.tsx | Ayarlarda "Maç müziği" anahtarı; kapalıyken maçta yalnızca taraftar [S29; kanıt yolları game/ köküne göre] |
| 2.8#45 | TAMAM | game/audio.ts:154,302,240, audio/music.ts:21, audio/uiSfx.ts:13 | Vuruş, direk, düdük, müzik, UI sesleri |
| 2.8#51 | ERTELENDİ-EXT | platform/capacitor.ts:20 | BLOCKED-EXTERNAL: gerçek iOS/Android cihaz (haptics eşlemesi kodda) [S29; kanıt yolları game/ köküne göre] |
| 2.8#52 | TAMAM | platform/lifecycle.ts (`applyAudioSession`), assets/LICENSES.csv, audio/licenses.node.test.ts | WP-18'de yapılmıştı; satırlar bayattı [S29; kanıt yolları game/ köküne göre] |
| 2.8#56 | TAMAM | platform/lifecycle.ts (`applyAudioSession`), assets/LICENSES.csv, audio/licenses.node.test.ts | WP-18'de yapılmıştı; satırlar bayattı [S29; kanıt yolları game/ köküne göre] |
| 2.8#57 | ERTELENDİ-EXT | - | D29: kayıtlı ses insan yapımı ses varlığı ister (ses sanatçısı/lisanslı kütüphane); ADR-002: tüm sesler WebAudio sentezi, lisans kapısı (`LICENSES.csv` + test) ve 2 MB `audioFileBytes` bütçesi hazır, varlık gelince eklenir |

### 2.9 Platform ve Teknik (yollar depo köküne göre)

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.9#1 | ERTELENDİ-INT | game/package.json:1 | v2: tek paket yeterli, monorepo faydası yok [S29; kanıt yolları game/ köküne göre] D29: pnpm monorepo bölmesi tek geliştirici için faydasız ve tüm import yollarını/CI'yi taşır; çalışan sınır `src/{core,sim,platform}` + ESLint sınır kuralları, v2. |
| 2.9#2 | KISMİ | game/tsconfig.strict-index.json, scripts/typecheck-strict-index.mjs, .github/workflows/ci.yml | D29: `noUncheckedIndexedAccess` artık src/core + src/state + src/platform için CI kapısı (`npm run typecheck:strict-index`, 0 hata; colorVision/rng/saveV3.test düzeltildi, rng akışı değişmedi). Kalan: sim/ui dizinlerinde ~600 hata, bu dizinler başka paketlerin elinde; dizin dizin genişletilecek (ADR-007) |
| 2.9#3 | TAMAM | docs/ADR.md ADR-005 | Hedef kararı yazıldı (es2022 derleme, Electron 44 / güncel WebView) [S29; kanıt yolları game/ köküne göre] |
| 2.9#4 | TAMAM | package.json, package-lock.json | Phaser `4.2.1` sabitlendi [S29; kanıt yolları game/ köküne göre] |
| 2.9#5 | TAMAM | game/eslint.config.js:30 | sim/core kısıtları |
| 2.9#6 | ERTELENDİ-EXT | game/src/platform/index.ts:38 | IAP var (2.9#65), paylaşım kartı var; bulut BLOCKED-EXTERNAL (backend) [S29; kanıt yolları game/ köküne göre] |
| 2.9#12 | TAMAM | game/view.ts:fitZoom | FIT tasarım alanı, birim testli |
| 2.9#13 | TAMAM | game/quality.ts:renderScale, profileOfSettings, MatchScene.createMatchGame(parent, profile) | Mobil DPR profili piksel bütçesiyle, birim testli; Düşük profil 1.25x sınırı artık oluşturma anında uygulanıyor (e2e: 2x ekranda canvas oranı) |
| 2.9#14 | TAMAM | game/src/game/MatchScene.ts:1290 | Phaser yalnızca maçta yaşıyor |
| 2.9#15 | ERTELENDİ-INT | - | D29: atlas paketleyicinin girdisi yok: tüm maç görselleri prosedürel (çalışma anında tek RenderTexture); paketlenecek PNG varlığı sanatçıdan gelince script yazılır (v2) |
| 2.9#16 | TAMAM | game/pool.ts | ObjectPool; uçan yazılar geri dönüştürülüyor (parçacıklar Phaser yayıcılarında zaten havuzlu) |
| 2.9#17 | TAMAM | platform/glRecovery.ts, platform/glRecovery.test.ts | `webglcontextlost` yakalama aşamasında `preventDefault`, opt-in günlük, `sp:gl-lost/restored` olayları [S29; kanıt yolları game/ köküne göre] |
| 2.9#18 | TAMAM | game/src/game/runtime.ts:425 | Sabit adım ve interpolasyon |
| 2.9#22 | TAMAM | e2e/hardening.spec.ts (memory) | 3 ısınma + 10 maç montajı, GC sonrası JS yığını: +1,0 MB (eşik 30 MB), mutlak 400 MB [S29; kanıt yolları game/ köküne göre] |
| 2.9#23 | ERTELENDİ-EXT | e2e/perf.spec.ts | BLOCKED-EXTERNAL: cihaz bazlı FPS hedefi gerçek cihaz ister (CPU 4x kısıtlı mobil profil e2e'de var) [S29; kanıt yolları game/ köküne göre] |
| 2.9#26 | ERTELENDİ-INT | core/rng.ts:31 | D29: `fork` üst akıştan 1 değer tüketir (plan: tüketmesin). Tüketmeyen sürüm tüm fork çağıranlarının dizisini ve golden.json'u değiştirir; sim/life ajanıyla eşzamanlı golden yenilemesi gerektiğinden ayrı bir denge/golden turuna bırakıldı |
| 2.9#27 | TAMAM | eslint.config.js (`Date.now`/`Math.random` error), `npm run lint` 0 hata | Kural error, ihlal kalmadı [S29; kanıt yolları game/ köküne göre] |
| 2.9#28 | TAMAM | game/src/core/types.ts:462 | RNG durumu kayıtta |
| 2.9#29 | TAMAM | e2e/determinism.spec.ts | 120 maç + yeni oyun özeti: Chromium ile Node birebir aynı; Firefox/WebKit projesi eklenince aynı test koşar (tarayıcılar kurulu değil) [S29; kanıt yolları game/ köküne göre] |
| 2.9#30 | ERTELENDİ-INT | game/src/sim/game/game.test.ts:144 | D29: ölçüldü: tam sezon (308 gün, kahraman otopilot) masaüstünde 1,3 sn, "sonraki maça" ≤30 gün ≈ 130 ms; hedef <2 sn/sezon tutuyor. Worker yalnızca düşük uçlu Android ölçümü (cihaz) gösterirse gerekir: ui/backend durumu eşzamanlı yerinde değiştiriyor, 1,4 MB durumu worker'a kopyalayıp geri almak ui/store sahipliğini (UI paketi) değiştirir |
| 2.9#31 | TAMAM | sim/game/statsGuard.ts, statsGuard.test.ts, statsBaseline.json, .github/workflows/nightly.yml | Gecelik istatistik koruması: 200 kariyer x 10 sezon, sapma eşiği aşarsa CI kırmızı [WP-V] |
| 2.9#33 | TAMAM | game/src/sim/world/fixtures.ts:66 | Oyun takvimi kullanılıyor |
| 2.9#36 | TAMAM | state/save.ts envelope.dataPack, sim/game/persist.ts dataPackId | Her kayıt veri paketi kimliği (`sp-data-N`) taşır; eski kayıt migrasyonla doldurulur [WP-V] |
| 2.9#37 | TAMAM | game/src/ui/backend/liveMatch.ts:98 | Kapat-aç sonucu değiştirmiyor |
| 2.9#38 | TAMAM | game/src/state/save.ts:19 | Depolama adaptörleri |
| 2.9#39 | TAMAM | game/src/platform/capacitorStorage.ts:15 | Directory.Data |
| 2.9#40 | TAMAM | state/save.ts sealEnvelope/openEnvelopeVerified, state/saveV3.test.ts | SHA-256 (WebCrypto) zarf alanı; crypto.subtle yoksa FNV'ye düşer, eski FNV zarfları yüklenir [WP-V] |
| 2.9#41 | TAMAM | game/electron/main.cjs:48 | Atomik yazma |
| 2.9#42 | TAMAM | state/save.ts (`recordMilestone`, `restoreMilestone`), state/saveFuzz.test.ts | Sezon başına ilk kayıt, slot başına en çok 3; canlı + yedekler yok olunca en yeni kilometre taşı yükleniyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#43 | TAMAM | game/src/ui/backend/realActions.ts:343 | Yedeğe düşüş var |
| 2.9#44 | TAMAM | game/src/ui/backend/persistence.ts:105 | Kuyruklu otomatik kayıt |
| 2.9#45 | TAMAM | electron/main.cjs (`close` el sıkışması), electron/preload.cjs, platform/index.ts | Pencere kapanmadan renderer otomatik kaydı boşaltıyor (2 sn zaman aşımı) [S29; kanıt yolları game/ köküne göre] |
| 2.9#46 | TAMAM | game/src/state/save.ts:147,193, ui/backend/persistence.ts:35 | Kota koruması, `.premigrate`, "oyunu güncelleyin" |
| 2.9#47 | TAMAM | state/fixtures/save-v1.json, state/saveFuzz.test.ts | Her eski sürüm için gerçek zarf zorunlu (politika testte), hepsi güncel şemaya taşınıyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#48 | TAMAM | game/src/state/save.ts:147,193, ui/backend/persistence.ts:35 | Kota koruması, `.premigrate`, "oyunu güncelleyin" |
| 2.9#49 | TAMAM | game/src/state/save.ts:147,193, ui/backend/persistence.ts:35 | Kota koruması, `.premigrate`, "oyunu güncelleyin" |
| 2.9#50 | ERTELENDİ-EXT | game/src/ui/screens/SavesScreen.tsx:65 | BLOCKED-EXTERNAL: Capacitor Share/dosya diyaloğu gerçek cihazda doğrulanmalı (web indirme çalışıyor) [S29; kanıt yolları game/ köküne göre] |
| 2.9#57 | ERTELENDİ-EXT | docs/PLATFORM.md | BLOCKED-EXTERNAL: Steam app id, Auto-Cloud, overlay testi, Steam Deck donanımı, bulut çakışma için backend; `steamworks.js` isteğe bağlı bağımlılık olarak paketlendi [S29; kanıt yolları game/ köküne göre] |
| 2.9#60 | ERTELENDİ-EXT | docs/PLATFORM.md | BLOCKED-EXTERNAL: Steam app id, Auto-Cloud, overlay testi, Steam Deck donanımı, bulut çakışma için backend; `steamworks.js` isteğe bağlı bağımlılık olarak paketlendi [S29; kanıt yolları game/ köküne göre] |
| 2.9#62 | TAMAM | game/android/variables.gradle:2 | SDK sürümleri doğru |
| 2.9#63 | ERTELENDİ-EXT | .github/workflows/release.yml | BLOCKED-EXTERNAL: Apple Developer hesabı/provisioning (iOS CI, TestFlight, notarize); mac imza doğrulaması iş akışında hazır [S29; kanıt yolları game/ köküne göre] |
| 2.9#64 | TAMAM | game/android/variables.gradle:4 | targetSdk 36 |
| 2.9#65 | TAMAM | game/package.json:27 | @capgo/native-purchases |
| 2.9#66 | TAMAM | game/src/platform/capacitor.ts:46 | Edge-to-edge |
| 2.9#67 | TAMAM | platform/android.node.test.ts | Manifest: dönüşte activity yeniden yaratılmıyor, iki yön serbest, tek exported activity; iOS yönleri doğrulanıyor (cihaz denemesi hâlâ BLOCKED-EXTERNAL) [S29; kanıt yolları game/ köküne göre] |
| 2.9#69 | TAMAM | electron/main.cjs (`render-process-gone`), platform/index.ts (`noteRecovery`) | Çöken renderer dakikada en çok 3 kez yeniden yükleniyor, kurtarma opt-in günlüğe yazılıyor; mobil WebView kurtarması BLOCKED-EXTERNAL (cihaz) [S29; kanıt yolları game/ köküne göre] |
| 2.9#70 | TAMAM | game/src/platform/lifecycle.ts:20, audio/audio.test.ts:286 | D29: iOS `navigator.audioSession.type = 'ambient'` her AudioContext oluşturulunca uygulanıyor (sessiz anahtara saygılı, başka uygulamanın müziğini kesmez); API yoksa no-op, testli |
| 2.9#71 | TAMAM | game/src/styles/fonts.css:1 | Font self-host |
| 2.9#72 | TAMAM | scripts/check-budgets.mjs, scripts/budgets.json, platform/budgets.node.test.ts, ci.yml | Gzip bütçeleri CI'da bloklayıcı (JS toplam 1260 KB, en büyük parça 600 KB, ilk açılış 790 KB, CSS 55 KB, ses dosyası 2 MB). Android `minifyEnabled` açılışı proguard + cihaz denemesi ister: ERTELENDİ (BLOCKED-EXTERNAL) [S29; kanıt yolları game/ köküne göre] |
| 2.9#73 | TAMAM | scripts/check-budgets.mjs, scripts/budgets.json, platform/budgets.node.test.ts, ci.yml | Gzip bütçeleri CI'da bloklayıcı (JS toplam 1260 KB, en büyük parça 600 KB, ilk açılış 790 KB, CSS 55 KB, ses dosyası 2 MB). Android `minifyEnabled` açılışı proguard + cihaz denemesi ister: ERTELENDİ (BLOCKED-EXTERNAL) [S29; kanıt yolları game/ köküne göre] |
| 2.9#76 | TAMAM | platform/back.ts (`pauseLiveMatchOnBack`), platform/back.test.ts, ui/App.tsx | Geri/Esc canlı maçta maçı duraklatıyor, asla terk ettirmiyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#77 | TAMAM | ui/backend/liveMatch.ts:335 | Arka planda otomatik duraklat |
| 2.9#82 | TAMAM | store-iap/service.ts:43, entitlements.ts:53 | Geri yükleme, yetki önbelleği |
| 2.9#83 | TAMAM | store-iap/service.ts:43, entitlements.ts:53 | Geri yükleme, yetki önbelleği |
| 2.9#86 | TAMAM | electron-builder.yml (`electronFuses`), electron/csp.cjs, electron/main.cjs, platform/electron.node.test.ts | Fuses, CSP, izinlerin reddi, webview yasağı; paketli sürüm bu ortamda çalıştırılmadı [S29; kanıt yolları game/ köküne göre] |
| 2.9#87 | ERTELENDİ-EXT | docs/PLATFORM.md | BLOCKED-EXTERNAL: Steam app id, Auto-Cloud, overlay testi, Steam Deck donanımı, bulut çakışma için backend; `steamworks.js` isteğe bağlı bağımlılık olarak paketlendi [S29; kanıt yolları game/ köküne göre] |
| 2.9#88 | ERTELENDİ-EXT | docs/PLATFORM.md | BLOCKED-EXTERNAL: Steam app id, Auto-Cloud, overlay testi, Steam Deck donanımı, bulut çakışma için backend; `steamworks.js` isteğe bağlı bağımlılık olarak paketlendi [S29; kanıt yolları game/ köküne göre] |
| 2.9#89 | TAMAM | ui/backend/meta.ts:62, ui/App.tsx:176 | 79 başarım → platform sink, gamepad menü |
| 2.9#90 | TAMAM | game/electron/main.cjs:98 | DRM yok |
| 2.9#92 | TAMAM | electron/main.cjs | Konum/boyut/büyütülmüş/tam ekran hatırlanıyor, F11 ve Alt+Enter; ayrı "kenarlıksız" modu v2 [S29; kanıt yolları game/ köküne göre] |
| 2.9#93 | TAMAM | e2e/viewports.spec.ts | 8 ekran şekli (21:9 … 280 px katlanabilir): yatay taşma yok, canvas kapsayıcıya sığıyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#94 | ERTELENDİ-EXT | docs/PLATFORM.md | BLOCKED-EXTERNAL: Steam app id, Auto-Cloud, overlay testi, Steam Deck donanımı, bulut çakışma için backend; `steamworks.js` isteğe bağlı bağımlılık olarak paketlendi [S29; kanıt yolları game/ köküne göre] |
| 2.9#95 | TAMAM | ui/backend/meta.ts:62, ui/App.tsx:176 | 79 başarım → platform sink, gamepad menü |
| 2.9#97 | TAMAM | game/src/styles/base.css:169-195, core/focusRing.test.ts | D29: `:focus-visible` halkası (--focus-ring) + Windows Yüksek Karşıtlık (`forced-colors`) için gerçek `outline` yedeği; testli |
| 2.9#98 | TAMAM | .github/workflows/release.yml | İmza sırları varsa Windows Authenticode ve macOS codesign/spctl doğrulaması [S29; kanıt yolları game/ köküne göre] |
| 2.9#99 | ERTELENDİ-EXT | .github/workflows/release.yml | BLOCKED-EXTERNAL: Apple Developer hesabı/provisioning (iOS CI, TestFlight, notarize); mac imza doğrulaması iş akışında hazır [S29; kanıt yolları game/ köküne göre] |
| 2.9#107 | ERTELENDİ-EXT | telemetry/errorLog.ts | BLOCKED-EXTERNAL: toplama uç noktası; yerel opt-in günlük + FPS özeti + kurtarma/kayıt olayları hazır [S29; kanıt yolları game/ köküne göre] |
| 2.9#111 | ERTELENDİ-EXT | docs/legal/PRIVACY.*.md, public/legal/privacy-*.html | Taslak yayında; BLOCKED-EXTERNAL: hukuk incelemesi [S29; kanıt yolları game/ köküne göre] |
| 2.9#112 | TAMAM | ci.yml (`test:coverage`, `lint`, bloklayan e2e), e2e/hardening.spec.ts | Çevrimdışı: üretim derlemesi SW kurulunca ağ kapalıyken yeniden yükleniyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#113 | TAMAM | ci.yml (`test:coverage`, `lint`, bloklayan e2e), e2e/hardening.spec.ts | Çevrimdışı: üretim derlemesi SW kurulunca ağ kapalıyken yeniden yükleniyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#115 | ERTELENDİ-EXT | .github/workflows/ci.yml:62 | BLOCKED-EXTERNAL: imzalı release AAB için keystore, steamcmd yüklemesi için Steam hesabı [S29; kanıt yolları game/ köküne göre] |
| 2.9#116 | ERTELENDİ-EXT | .github/workflows/release.yml | BLOCKED-EXTERNAL: Apple Developer hesabı/provisioning (iOS CI, TestFlight, notarize); mac imza doğrulaması iş akışında hazır [S29; kanıt yolları game/ köküne göre] |
| 2.9#117 | TAMAM | scripts/steam-depot.mjs, platform/steamDepot.node.test.ts, release.yml (`steam-depot`) | `content/<os>`, `app_build.vdf`, `depot_*.vdf` üretimi [S29; kanıt yolları game/ köküne göre] |
| 2.9#118 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: imzalı release AAB için keystore, steamcmd yüklemesi için Steam hesabı [S29; kanıt yolları game/ köküne göre] |
| 2.9#121 | TAMAM | release.yml (`environment: release`) | Depo ayarında zorunlu onaylayıcı tanımlanmalı (Settings > Environments) [S29; kanıt yolları game/ köküne göre] |
| 2.9#126 | TAMAM | eslint.config.js, store-iap/isolation.node.test.ts | sim/core `store-iap`, `telemetry`, `audio`, `platform`, `ui` içe aktaramaz (lint + bağımsız test); katalog stat artışı satmıyor [S29; kanıt yolları game/ köküne göre] |
| 2.9#127 | ERTELENDİ-EXT | store-iap/flavor.ts | BLOCKED-EXTERNAL: deneme kilidi mağaza ürünleriyle sınanmalı [S29; kanıt yolları game/ köküne göre] |
| 2.9#128 | TAMAM | docs/ADR.md | 7 karar kaydı [S29; kanıt yolları game/ köküne göre] |
| 2.9#130 | TAMAM | state/fixtures/save-v1.json, state/saveFuzz.test.ts | Her eski sürüm için gerçek zarf zorunlu (politika testte), hepsi güncel şemaya taşınıyor [S29; kanıt yolları game/ köküne göre] |

### 2.10 Meta, Online, Canlı Operasyon

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.10#1 | TAMAM | game/src/platform/index.ts:96 | Hesap gerekmiyor |
| 2.10#2 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: Steam/Game Center/Play Games kimliği mağaza hesabı ve SDK ister; yerelde hesapsız tablo var (ui/screens/board) |
| 2.10#3 | TAMAM | sim/game/feedback.ts onlineAllowed, CommunityScreen, feedback.test.ts | Çevrimiçi anahtarı (varsayılan kapalı); fontlar self-host, kaynakta ağ ilkeli yok ve testle sabitlendi |
| 2.10#8 | TAMAM | sim/game/localMeta.ts, ui/screens/board/BoardScreen.tsx | Yerel kariyer sıralaması (5 ölçüt) ve kişisel rekorlar; çevrimiçi tablo BLOCKED-EXTERNAL |
| 2.10#15 | TAMAM | sim/game/localMeta.ts localBoard tier, sim/game/mods.ts isModded | Resmî / Modlu tablo ayrımı; imzasız etkin mod ile biten kariyer Modlu tabloya gider |
| 2.10#17 | TAMAM | sim/game/localMeta.ts challengeFor, localMeta.test.ts | Tohumlu haftalık görev rotasyonu, seri; yerel |
| 2.10#18 | TAMAM | ui/screens/board/BoardScreen.tsx | Yerel meydan okuma profili: seri, en iyi seri, geçmiş. Çevrimiçi paylaşım BLOCKED-EXTERNAL |
| 2.10#19 | TAMAM | sim/game/localMeta.ts AttemptRecord, liveOps.test.ts | Sınırsız deneme; ilk ve en iyi deneme ayrı tutulur (yerel tablo) |
| 2.10#34 | TAMAM | game/src/sim/game/saveHistory.ts packRecording, MatchScene.ts afterPlay | Seed+girdi kaydı kayıpsız paketlenir ve kayıtla taşınır (v3); video klip WP-V kalanı [WP-V] |
| 2.10#40 | TAMAM | ui/share/cards.ts, ui/share/clips.ts, game/clipExport.ts, e2e/goalreel.spec.ts | Maç sonu ve kariyer PNG kartı + video klip (tekrar oynatıcıda kaydet, 15 sn); fotoğraf modu ertelendi [WP-V] |
| 2.10#60 | TAMAM | sim/game/mods.ts, sim/game/modWorld.ts, newGame.ts, modWorld.test.ts | Yalnızca veri JSON modları: şema, boyut sınırı, bilinmeyen alan reddi. `world` bölümü (lig/kulüp adı, kısa kod, şehir, stadyum adı, forma renkleri) ve isim listeleri YENİ kariyerin dünyasına deterministik yeniden adlandırma geçişiyle uygulanır; moddan bağımsız dünya bayt bayt aynı. Yeni ülke eklemek (statik kayıt defteri) ve sezon içi doğan gençlerin mod isimleri ertelendi |
| 2.10#62 | TAMAM | ui/backend/meta.ts c:mods, mods.ts checkModSignature | Kariyer kaydı mod kimlik@sürüm imzasını saklar; eksik veya farklı modda yüklemede uyarı |
| 2.10#70 | N/A | - | Yol haritası taahhüdü |
| 2.10#72 | TAMAM | - | Sezon kartı yok (kısıt sağlanıyor) |
| 2.10#76 | ERTELENDİ-EXT | sim/game/mods.ts verifySignature, isOfficialSigned | BLOCKED-EXTERNAL: Uzaktan indirme ve resmî anahtar sunucu ister (Ed25519 doğrulama kodda var) |
| 2.10#82 | TAMAM | sim/game/feedback.ts shouldAskNotifications, NotifyPrompt | İzin ilk haftalık görev bittikten sonra, bir kez, gerekçeyle istenir; yerel hatırlatma |
| 2.10#83 | TAMAM | - | Baskı bildirimi yok (kısıt sağlanıyor) |
| 2.10#86 | TAMAM | game/src/sim/world/fixtures.ts:66 | Gerçek zaman cezası yok |
| 2.10#88 | TAMAM | sim/game/feedback.ts, CommunityScreen, feedback.test.ts | Yerel geri bildirim formu; cihaz bilgisi ve son 3 maç kimliği isteğe bağlı; dosya olarak dışa aktarılır |
| 2.10#93 | TAMAM | ui/screens/board/WhatsNewScreen.tsx | Menüden Yenilikler; görüldü bilgisi meta depoda |
| 2.10#101 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: sunucu seed ve jeton için backend gerekir; yerelde seed haftadan türetilir (liveOps.ts) |
| 2.10#102 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: girdi günlüğü gönderimi backend ve 2.10#34 ister |
| 2.10#103 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: sunucuda yeniden oynatma backend ve 2.10#34 ister |
| 2.10#110 | TAMAM | - | Çevrimdışı kariyer kısıtsız |
| 2.10#111 | TAMAM | sim/game/achievements.ts:140 | Başarım sistemi var; Steam, Game Center, Play eşitlemesi BLOCKED-EXTERNAL (mağaza hesabı) |

### 2.11 Erişilebilirlik ve Yerelleştirme

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.11#1 | TAMAM | (WP-19 doğrulandı) | 3 palet + desen maskesi (components.css:882) |
| 2.11#2 | TAMAM | (WP-19 doğrulandı) | contrast.test.ts gri tonlama testi |
| 2.11#3 | TAMAM | (WP-19 doğrulandı) | components.css:882 şerit/nokta maskesi |
| 2.11#5 | TAMAM | (WP-19 doğrulandı) | rem tabanlı %90-200 (a11y-wp19 e2e) |
| 2.11#6 | ERTELENDİ-EXT | - | Metin rem tabanlı, tarayıcı/WebView yazı boyutunu izler (e2e: 200% ölçek). Android/iOS sistem font ölçeği gerçek cihazda doğrulanmalı |
| 2.11#10 | TAMAM | (WP-19 doğrulandı) | e2e/a11y*.spec.ts axe 0 serious/critical |
| 2.11#11 | TAMAM | (WP-19 doğrulandı) | lm-announce assertive duyuru |
| 2.11#12 | TAMAM | (WP-19 doğrulandı) | wizard.css .wiz-search:focus-within halkası |
| 2.11#13 | ERTELENDİ-EXT | - | Senaryo docs/ACCESSIBILITY.md içinde yazılı; NVDA/VoiceOver/TalkBack ile gerçek cihaz oturumu gerekir (otomatik test yerine geçmez) |
| 2.11#15 | TAMAM | (WP-19 doğrulandı) | Tabs ok tuşları + roving tabindex e2e |
| 2.11#17 | TAMAM | (WP-19 doğrulandı) | src/input/bindings.ts tuş atama |
| 2.11#18 | TAMAM | (WP-19 doğrulandı) | Dokunmatik 3 atış şeması + gamepad + tuş atama (controls.test.ts) |
| 2.11#19 | TAMAM | (WP-19 doğrulandı) | Sol el modu |
| 2.11#20 | TAMAM | (WP-19 doğrulandı) | Dokunma ölçeği |
| 2.11#21 | TAMAM | (WP-19 doğrulandı) | Tek el modu |
| 2.11#22 | TAMAM | (WP-19 doğrulandı) | Ağır çekim hızı ayarı |
| 2.11#23 | TAMAM | (WP-19 doğrulandı) | timingAssist: ver-kaç/ağır çekim penceresi ve güç çubuğu (controls.test.ts) |
| 2.11#29 | TAMAM | (WP-19 doğrulandı) | ui/a11y/Captions.tsx |
| 2.11#31 | TAMAM | (WP-19 doğrulandı) | MatchScene noShake/noFlash (rm + reduceFlashes) |
| 2.11#32 | TAMAM | ui/store.ts reduceFlashes | Ayrı anahtar (WP-16 Grafik grubu) |
| 2.11#38 | TAMAM | (WP-19 doğrulandı) | docs/ACCESSIBILITY.md kontrol listesi |
| 2.11#42 | TAMAM | (WP-19 doğrulandı) | ICU plural alt kümesi (i18n/index.ts:61) + lint:i18n 0 literal |
| 2.11#43 | TAMAM | i18n/i18n.test.ts:27 | TR/EN anahtar eşitliği testli |
| 2.11#45 | TAMAM | (WP-19 doğrulandı) | ?pseudo=1 (i18n/pseudo.ts) |
| 2.11#46 | TAMAM | (WP-19 doğrulandı) | a11y-wp19 e2e: 390px + %35 uzun metin + %200 ölçek |
| 2.11#47 | ERTELENDİ-INT | - | Olay metinleri TS içinde kalıyor (LText tr/en, {g:} ve ek kalıbı testli). Veri dosyalarına taşıma sim/life alanında ve profesyonel çevirmen geçişiyle birlikte yapılmalı |
| 2.11#49 | TAMAM | (WP-19 doğrulandı) | tr-TR büyük harf |
| 2.11#50 | TAMAM | (WP-19 doğrulandı) | Collator(tr) |
| 2.11#51 | TAMAM | (WP-19 doğrulandı) | sim/career/trSuffix.ts ek üretici (olay metinleri) |
| 2.11#52 | TAMAM | (WP-19 doğrulandı) | {key}'ek kalıbı yeniden çekimlenir, ekli/eksiz yazım desteklenir |
| 2.11#53 | TAMAM | (WP-19 doğrulandı) | content.test.ts + gender.test.ts cinsiyet/sızıntı testleri |
| 2.11#54 | TAMAM | - | Karar: para birimi EUR (ui/format.ts, tr "12.500 €"); kurgusal/gerçek TL kuru karışıklığı önlenir |
| 2.11#58 | ERTELENDİ-EXT | - | Taslak docs/store/LISTING.md var; yayın öncesi profesyonel TR/EN pazarlama çevirisi ve marka taraması gerekir |

### 2.12 Riskler, Hukuk, Mağaza, QA, Etik (yollar depo köküne göre)

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.12#1 | TAMAM | game/public/manifest.webmanifest, game/src/data/world/countries.ts:21 | Marka ifadeleri temiz, "Anadolu Ligi" |
| 2.12#2 | TAMAM | game/public/manifest.webmanifest, game/src/data/world/countries.ts:21 | Marka ifadeleri temiz, "Anadolu Ligi" |
| 2.12#3 | N/A | - | Görsel inceleme |
| 2.12#5 | N/A | - | Marka araştırması |
| 2.12#6 | N/A | - | Mağaza ad kontrolü |
| 2.12#8 | N/A | - | Alan adı |
| 2.12#10 | TAMAM | game/public/manifest.webmanifest, game/src/data/world/countries.ts:21 | Marka ifadeleri temiz, "Anadolu Ligi" |
| 2.12#11 | ERTELENDİ-EXT | game/src/data/world/countries.ts:22 | BLOCKED-EXTERNAL: ödül adlarının hukuk doğrulaması; yerel yorum API'si mağaza eklentisi ve cihaz ister [S29; kanıt yolları game/ köküne göre] |
| 2.12#12 | N/A | - | İçerik kuralı |
| 2.12#13 | TAMAM | sim/world/generate.ts (`CREST_BLACKLIST`, `crestBlacklisted`), worldQuality.test.ts | Gerçek kulüp armasına benzeyen şekil+sembol+renk ailesi üretilen kulüplere verilmez |
| 2.12#15 | TAMAM | game/src/sim/world/generate.ts | İsimler prosedürel |
| 2.12#16 | TAMAM | game/src/ui/screens/newcareer/AppearanceEditor.tsx:12 | Ünlü şablonu yok |
| 2.12#27 | TAMAM | assets/LICENSES.csv, ci.yml (`licenses:check`), `npm run legal` | Kredi/lisans sayfaları üretilen dosyadan; CI eşitliği denetliyor [S29; kanıt yolları game/ köküne göre] |
| 2.12#28 | TAMAM | assets/LICENSES.csv, ci.yml (`licenses:check`), `npm run legal` | Kredi/lisans sayfaları üretilen dosyadan; CI eşitliği denetliyor [S29; kanıt yolları game/ köküne göre] |
| 2.12#29 | TAMAM | assets/LICENSES.csv, ci.yml (`licenses:check`), `npm run legal` | Kredi/lisans sayfaları üretilen dosyadan; CI eşitliği denetliyor [S29; kanıt yolları game/ köküne göre] |
| 2.12#30 | N/A | - | Lisans arşivi |
| 2.12#32 | TAMAM | styles/fonts.css, THIRD_PARTY_LICENSES.md | Self-host, lisans dosyası (yalnızca fontlar) |
| 2.12#33 | TAMAM | styles/fonts.css, THIRD_PARTY_LICENSES.md | Self-host, lisans dosyası (yalnızca fontlar) |
| 2.12#37 | TAMAM | - | Kumarhane gerçek parayla bağlı değil |
| 2.12#38 | N/A | - | PEGI |
| 2.12#39 | N/A | - | ESRB/IARC |
| 2.12#40 | N/A | - | Apple yaş anketi |
| 2.12#41 | N/A | - | Play IARC |
| 2.12#42 | TAMAM | core/contentFlags.ts (`CASINO_BUILD`), core/contentFlags.test.ts, ui/store.ts, SettingsScreen.tsx | `VITE_FEATURE_CASINO=0` kumarhaneyi derlemede kalıcı gizler ve ayar anahtarını kaldırır [S29; kanıt yolları game/ köküne göre] |
| 2.12#43 | TAMAM | SettingsScreen.tsx:120, casino/CasinoScreen.tsx:104, state/save.ts:193 | Kumarhane gizle, sorumlu oyun paneli, migrasyon öncesi kopya |
| 2.12#45 | TAMAM | SettingsScreen.tsx:120, casino/CasinoScreen.tsx:104, state/save.ts:193 | Kumarhane gizle, sorumlu oyun paneli, migrasyon öncesi kopya |
| 2.12#46 | TAMAM | game/src/sim/life/casino.test.ts:196 | RTP testli |
| 2.12#48 | TAMAM | - | Ücretli rastgele ödül yok |
| 2.12#52 | TAMAM | game/src/sim/life/events/content/casinoCareer.ts (`casino.own_match_bet`), veteranContent.test.ts | Kendi maçına bahis: reddet / bildir / küçük kupon (yakalanma riski, ceza ve manşet) |
| 2.12#53 | N/A | - | Hedef kitle |
| 2.12#54 | TAMAM | - | Veri toplama yok |
| 2.12#57 | TAMAM | - | Yorum karşılığı ödül yok |
| 2.12#58 | ERTELENDİ-EXT | - | BLOCKED-EXTERNAL: ödül adlarının hukuk doğrulaması; yerel yorum API'si mağaza eklentisi ve cihaz ister [S29; kanıt yolları game/ köküne göre] |
| 2.12#59 | N/A | - | Mağaza metni |
| 2.12#60 | N/A | - | ASO |
| 2.12#61 | N/A | - | Ekran görüntüleri |
| 2.12#65 | N/A | - | Mağaza metni |
| 2.12#67 | N/A | - | Steam kapsülleri |
| 2.12#68 | N/A | - | Steam etiketleri |
| 2.12#69 | N/A | - | Wishlist |
| 2.12#70 | TAMAM | store-iap/demo.ts, main.tsx | Kiosk demo flavor mevcut (sabit tohum, boşta sıfırlama) [S29; kanıt yolları game/ köküne göre] |
| 2.12#73 | TAMAM | game/clipExport.ts, ui/screens/match/ClipButton.tsx, ui/share/clips.ts, e2e/goalreel.spec.ts | Klip dışa aktarma (commit 5faa0dd): canvas.captureStream + MediaRecorder ile WebM, 15 sn sınırı, paylaş/indir; 2.10#40 ile aynı iş. [S29; kanıt yolları game/ köküne göre] |
| 2.12#74 | N/A | - | Pazarlama |
| 2.12#75 | N/A | - | İletişim |
| 2.12#76 | N/A | - | Discord |
| 2.12#84 | N/A | - | Kriz şablonu |
| 2.12#85 | N/A | - | Cihaz matrisi |
| 2.12#86 | TAMAM | .github/workflows/nightly.yml | Gece 02:17: 1000 kariyer x 10 sezon = 10.000 sezon, iflas eşiği korumalı, ardından birim testler + bütçe [S29; kanıt yolları game/ köküne göre] |
| 2.12#87 | TAMAM | sim/game/balanceSim.ts, nightly.yml | Persona'lı otomatik kariyer botu gecelik koşuyor (`humanBot` maç içi botu ayrı) [S29; kanıt yolları game/ köküne göre] |
| 2.12#88 | TAMAM | state/saveFuzz.test.ts | 2000 rastgele bozma, her karakter değişimi, k. yazımda çökme enjeksiyonu: hep yüklenebilir kayıt [S29; kanıt yolları game/ köküne göre] |
| 2.12#89 | N/A | - | Soak testi |
| 2.12#90 | N/A | - | Kesinti testleri |
| 2.12#91 | TAMAM | e2e/ (31+ dosya, 95+ test) | Plan hedefi 40 aşıldı; CI'da bloklayıcı [S29; kanıt yolları game/ köküne göre] |
| 2.12#93 | N/A | - | Hata önceliklendirme |
| 2.12#94 | N/A | - | Beta |
| 2.12#95 | N/A | - | Sertifikasyon |
| 2.12#99 | N/A | - | Analitik onayı |
| 2.12#100 | N/A | - | Onay penceresi |
| 2.12#101 | TAMAM | - | Olay toplanmıyor |
| 2.12#102 | N/A | - | Analitik kimliği |
| 2.12#103 | N/A | - | Saklama politikası |
| 2.12#105 | N/A | - | Sunucu |
| 2.12#106 | N/A | - | Mağaza beyanı (Google Fonts isteği beyana eklenmeli) |
| 2.12#117 | TAMAM | telemetry/frameStats.ts, frameStats.test.ts | Opt-in günlükte p5 FPS ve en kötü kare; yalnızca canvas görünürken örnekleniyor [S29; kanıt yolları game/ köküne göre] |
| 2.12#118 | ERTELENDİ-INT | - | Gereksiz: menüler DOM, render döngüsü yok (tarayıcı kendisi sınırlar) [S29; kanıt yolları game/ köküne göre] |
| 2.12#119 | TAMAM | telemetry/errorLog.ts (`recovered`, `webgl-lost`, `save`), ui/backend/persistence.ts | Kurtarma ve kayıt hataları/uyarıları opt-in yerel günlükte [S29; kanıt yolları game/ köküne göre] |
| 2.12#120 | TAMAM | telemetry/errorLog.ts (`recovered`, `webgl-lost`, `save`), ui/backend/persistence.ts | Kurtarma ve kayıt hataları/uyarıları opt-in yerel günlükte [S29; kanıt yolları game/ köküne göre] |
| 2.12#121 | TAMAM | SettingsScreen.tsx:120, casino/CasinoScreen.tsx:104, state/save.ts:193 | Kumarhane gizle, sorumlu oyun paneli, migrasyon öncesi kopya |
| 2.12#122 | N/A | - | Aşamalı dağıtım |
| 2.12#125 | TAMAM | ui/share/cards.ts (`upper` ile `tr-TR`) | Kullanıcıya görünen büyük harfler yerele duyarlı; kalan çağrılar yalnızca ASCII kimlik/renk [S29; kanıt yolları game/ köküne göre] |
| 2.12#126 | TAMAM | game/src/sim/match/turkish.ts:123 | trSuffix testli |
| 2.12#127 | ERTELENDİ-INT | core/gender.ts | ICU select yaşam/i18n süpürmesine bağlı; mevcut `trSuffix` yaklaşımı testli [S29; kanıt yolları game/ köküne göre] |
| 2.12#133 | N/A | - | Kapsam yönetimi |
| 2.12#134 | N/A | - | ADR süreci |
| 2.12#135 | N/A | - | Politika taraması |
| 2.12#140 | N/A | - | Kozmetik IAP yok |

### 2.13 GDD [v1] maddeleri

| GDD maddesi | Durum | Kanıt | Not |
|---|---|---|---|
| 2.1 Ad/forma adı/ülke/yaş/pozisyon/ayak | TAMAM | ui/screens/NewCareerScreen.tsx:186 | Sihirbazda var |
| 2.1 Doğum şehri | TAMAM | ui/screens/NewCareerScreen.tsx:292 | Doğum şehri alanı sihirbazda |
| 2.1 Prosedürel avatar | TAMAM | ui/screens/newcareer/AppearanceEditor.tsx:15 | Ten, saç, sakal, göz, yüz, aksesuar |
| 2.1 Başlangıç arketipi | TAMAM | sim/career/createHero.ts:23 | Bonus dağılımı var |
| 2.1 Geçmiş hikâyesi | TAMAM | sim/career/createHero.ts:83 | 4 geçmiş |
| 2.2 Özellik grupları | TAMAM | core/types.ts ATTRIBUTE_KEYS, state/save.ts MIGRATIONS[3], sim/world/attributes.ts, game/ai.ts keeperTarget, game/kick.ts handsSkill | Kalecide 4 özellik: Refleks, Top Tutma, Pozisyon (Kaleci) `gkPositioning`, Oyun Kurma (Kaleci) `gkDistribution`. Kayıt v4 (eski kayıtlar eski sayfadan türetir, attrHistory sütunları eklenir), NPC türetme, kahraman yaratma, kaleci OVR ağırlıkları, takım modeli ve otomatik çözüm, kaleci AI (açı/derinlik/çıkış/orta alma/penaltı okuma), elden çıkış isabeti (GK tutma-atma, AI kaleciler, Distribution drili), antrenman, profil kaleci grupları, TR/EN |
| 2.2 Pozisyon ağırlıklı OVR | TAMAM | sim/career/progression.ts:146 | heroOvr |
| 2.2 Gizli potansiyel + yıldız | TAMAM | ui/screens/legacy/CareerCards.tsx:69 | Gizli potansiyel yıldızı UI'da |
| 2.2 Yaş eğrisi | TAMAM | sim/career/progression.ts:100 | Var |
| 2.2 Form/Moral/Kondisyon/Yorgunluk | TAMAM | core/types.ts:289 | Dört değer |
| 2.3 Mini oyunlu antrenman → XP | TAMAM | ui/screens/TrainingScreen.tsx:95 | 5 Phaser drili |
| 2.3 Perk (her 5 OVR) | TAMAM | sim/career/progression.ts:205 | 46 perk (bazıları maçta etkisiz, bkz. 2.3#40) |
| 2.3 Özel antrenör | TAMAM | ui/backend/realActions.ts:397 | Tut/kov |
| 2.3 Tesisler | TAMAM | data/assets.ts:139 | İyileşme çarpanı |
| 2.4 Sözleşme maddeleri | TAMAM | sim/career/contract.ts:52 | Sigorta ve süre garantisi maddeleri |
| 2.4 Pazarlık + sabır | TAMAM | sim/career/contract.ts:291 | Var |
| 2.4 Pencere/kiralık/talep/serbest | TAMAM | sim/career/transfers.ts:46 | Var |
| 2.4 Ajan | TAMAM | ui/backend/realActions.ts:546 | Kalite pazarlığı etkiliyor |
| 2.4 Kulüp ilgisi listesi | TAMAM | sim/career/transfers.ts:100 | Var |
| 2.5 Rol merdiveni | TAMAM | sim/career/squadRole.ts:21 | 6 basamak |
| 2.5 TD güven barı | TAMAM | ui/screens/ClubScreen.tsx:94 | StatBar |
| 2.5 Yedekte şikayet kararı | TAMAM | ui/screens/legacy/CareerCards.tsx:52 | Yedekte şikayet UI'ya bağlı |
| 2.5 İlişki → pas sıklığı (görünür) | TAMAM | game/MatchScene.ts:2493, game/ai.ts:389, game/callForBall.test.ts | "PAS VERMİYOR" mesajı (callRefused), testli |
| 2.6 Emeklilik kararı | TAMAM | ui/screens/legacy/RetireScreen.tsx, ui/backend/meta.ts:205 | Emeklilik kararı UI'dan çağrılıyor |
| 2.6 Emeklilik sonrası yollar | TAMAM | sim/game/retirement.ts | Emeklilik sonrası yollar |
| 2.6 Onur Listesi | TAMAM | ui/screens/legacy/HallOfFameScreen.tsx:28, ui/backend/meta.ts:205 | Onur Listesi |
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
| 3.3 Yardım seviyeleri | TAMAM | game/runtime.ts:717 (ASSIST_REWARD), sim/match/rating.ts | Yardım seviyesi ödül çarpanı |
| 3.4 Takım arkadaşı AI | TAMAM | game/callForBall.test.ts, game/MatchScene.ts:2493 | Pas isteme / el kaldırma |
| 3.4 Rakip AI | TAMAM | game/ai.ts:154 | Pres, top kapma, ofsayt |
| 3.4 Kaleci AI | TAMAM | game/runtime.ts:1602 | Var |
| 3.4 Hakem | TAMAM | sim/match/referee.ts | Hakem sertliği ve avantaj |
| 3.5 Penaltı + panik | TAMAM | game/runtime.ts:377 | Var |
| 3.5 Serbest vuruş + baraj | TAMAM | game/setup.ts:188 | Var |
| 3.5 Korner kafa anı | TAMAM | sim/match/types.ts:94 | Var |
| 3.6 0–10 puan | TAMAM | sim/match/rating.ts | Var |
| 3.6 Maçın Oyuncusu | TAMAM | ui/screens/match/PostMatchScreen.tsx:87 | Var |
| 3.6 İstatistik ekranı | TAMAM | ui/screens/match/PostMatchScreen.tsx:44 | Var |
| 3.6 Isı haritası | TAMAM | ui/screens/match/PostMatchScreen.tsx:223 | Isı haritası |
| 3.6 Şut haritası | TAMAM | ui/screens/match/PostMatchScreen.tsx:223 | Şut haritası |
| 3.6 Röportaj kararı | TAMAM | sim/game/interview.ts:14 | 4 ton |
| 3.7 Kalabalık sesi/gol patlaması | TAMAM | audio/crowd.ts:3,32 | Kapasiteye bağlı kalabalık katmanları |
| 3.7 Tezahürat/ıslık/yuhalama | TAMAM | audio/crowd.ts | Tezahürat, ıslık, yuhalama |
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
| 4.4 Banka | TAMAM | sim/life/economy.ts:200 | Vadeli mevduat |
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
| 5.2 Hukuk | TAMAM | sim/life/events/content/legal.ts | Ayrı hukuk olay kategorisi |
| 6.1 Ülke/kademe/takım sayıları | TAMAM | sim/world/generate.ts:239 | Var |
| 6.1 Kulüp alanları | TAMAM | sim/world/generate.ts:141 | Var |
| 6.2 Lig (yükselme/düşme) | TAMAM | sim/world/season.ts:492 | Var |
| 6.2 Yerel Kupa | TAMAM | sim/game/internal.ts:157 | Kahraman oynuyor |
| 6.2 Kıtasal Kupa | TAMAM | sim/world/competitions.ts:190 | Kahraman oynuyor |
| 6.2 Milli takım turnuvası | TAMAM | sim/game/national.ts | Milli turnuva |
| 6.2 Ayın Oyuncusu | TAMAM | sim/world/awards.ts:156 | Hesaplanan Ayın Oyuncusu |
| 6.2 Sezonun Oyuncusu | TAMAM | sim/game/season.ts:254 | Var |
| 6.2 Gol Kralı | TAMAM | sim/game/season.ts:259 | Var |
| 6.2 Altın Yıldız | TAMAM | sim/game/season.ts:245 | Var (aday listesi yok, bkz. 2.6#103) |
| 6.2 Genç Oyuncu | TAMAM | sim/game/season.ts:256 | Var |
| 6.2 Yılın Golü (oylama) | TAMAM | sim/world/awards.ts | Gol kaydı ve oylama |
| 6.3 NPC yaşam döngüsü | TAMAM | sim/world/season.ts:717 | Var |
| 7 Premium para birimi yok | TAMAM | - | Yok |
| 7 Oyun içi gelir kaynakları | TAMAM | sim/life/economy.ts:18 | Var |
| 7 Deneme + Tam Kariyer kilidi | TAMAM | store-iap/entitlements.ts:46, store-iap/catalog.ts | Deneme + Tam Kariyer kilidi |
| 7 Kozmetik paketler | TAMAM | store-iap/catalog.ts:12 | Kozmetik paketler |
| 8 Maç sesleri | TAMAM | game/audio.ts:244 | Sentez |
| 8 Menü sesleri | TAMAM | audio/uiSfx.ts:13 | Menü sesleri |
| 8 Dinamik müzik | TAMAM | audio/music.ts:21, audio/director.ts | Dinamik müzik |
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
| 9 Masaüstü | ERTELENDİ-EXT | game/electron/, game/package.json:76 | BLOCKED-EXTERNAL: `steamworks.js` isteğe bağlı bağımlılık olarak paketli; gerçek doğrulama Steam app id ister |
| 9 i18n TR + EN | TAMAM | i18n/index.ts | Var |
| 9 Renk körü modu | TAMAM | ui/store.ts:745 | Yalnızca UI (maç sahnesi değil) |
| 9 Yazı boyutu | TAMAM | ui/store.ts:749 | Var |
| 9 Titreşim aç/kapa | TAMAM | ui/haptics.ts:33 | Var |
| 9 Yardım seviyeleri | TAMAM | game/runtime.ts:717 (ASSIST_REWARD) | Ödül çarpanı bağlı |

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
