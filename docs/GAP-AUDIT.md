# StarPath Football: Uygulama ve Plan Boşluk Denetimi (GAP-AUDIT)

> Tarih: 2026-10-07 · Hazırlayan: Yapımcı / QA · Kapsam: `docs/GDD.md` içindeki tüm **[v1]** maddeleri ve `docs/ANALIZ-VE-PLAN.md` bölüm 2'deki tüm **[v1][P0]** maddeleri.
> Yöntem: Her madde koda karşı kontrol edildi (graphify, ardından Grep/Read). Uygulama da çalıştırıldı: `vite --port 5301`, headless Chrome ve 390 px iframe ile Ana Sayfa, Canlı Maç, Maç Sonu ve Sezon Sonu ekranlarına bakıldı. `npx vitest run` de koşturuldu.
> Durumlar: **TAMAM** = gerçek oyun akışına bağlı ve çalışıyor. **KISMİ** = bir kısmı var, ya da var ama bağlı değil veya plandaki sayıları tutmuyor. **EKSİK** = anlamlı bir uygulama yok. **N/A-süreç** = kod beklenmeyen iş/süreç maddesi.
> Kanıt yolları `game/src/` köküne görelidir. 2.9, 2.10 ve 2.12 bölümlerinde yollar depo köküne görelidir.
> Not: Denge kodu bu denetim sırasında başka bir ajan tarafından düzenleniyordu. Dengeyle ilgili satır numaraları kayabilir.

---

## 1. Özet Sayılar

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
| 2.1#62 | EKSİK | - | Orta için ayrı yan kamera yok |
| 2.1#67 | KISMİ | game/runtime.ts:1890 | Kafa zamanlama halkası var; ayrı kafa an tipi yok |
| 2.1#68 | EKSİK | - | Kafa yönü kontrolü yok |
| 2.1#71 | EKSİK | - | 18 m kafa menzil sınırı yok |
| 2.1#72 | KISMİ | sim/match/highlightGen.ts:63 | Tek 'defend' tipi var; pas arası, 1'e 1 ve blok ayrı değil |
| 2.1#73 | KISMİ | game/runtime.ts:812 | Kayarak müdahale var; arkadan faul ve kart kuralları eksik |
| 2.1#74 | KISMİ | game/ai.ts:253 | Zamanlamaya bağlı müdahale var; 0,8 m/%70 kuralı yok |
| 2.1#81 | TAMAM | game/ai.ts:408 | Kaleci 2D hareket ediyor, tepki Refleks'e bağlı |
| 2.1#82 | KISMİ | game/ai.ts:471 | Tutma/sektirme var; yumruklama yok |
| 2.1#83 | KISMİ | game/ai.ts:478 | Kurtarış fonksiyonu var; 1.000 şut tutarlılık testi yok |
| 2.1#85 | KISMİ | sim/match/highlightGen.ts:456 | Kaleci kariyerinde yalnızca kurtarış ve penaltı anı var |
| 2.1#86 | KISMİ | game/input.ts:426 | Uzanma var; Refleks'e bağlı pencere yok |
| 2.1#87 | KISMİ | game/runtime.ts:1238 | Vücut açısı ipucu var; erken ipucu ve ceza yok |
| 2.1#93 | KISMİ | game/runtime.ts:377 | Penaltı panik titremesi var; eşik ve değerler farklı |
| 2.1#94 | KISMİ | game/runtime.ts:908 | Kaleci %10 ortada kalıyor; yön hafızası yok |
| 2.1#95 | KISMİ | sim/match/highlightGen.ts:295 | Baraj sabit 4 kişi; kaleci talimatı yok |
| 2.1#97 | KISMİ | sim/match/highlightGen.ts:60 | Korner anı var; yükseklik ve kavis seçimi yok |
| 2.1#98 | KISMİ | game/runtime.ts:889 | Kornerde ofsayt atlanıyor; birim test yok |
| 2.1#102 | KISMİ | game/offside.ts:1 | Ofsayt var; 500 değil ~11 test |
| 2.1#103 | EKSİK | - | Ofsayt çizgisi çizilmiyor |
| 2.1#104 | KISMİ | game/ai.ts:260 | Faul olasılığı var; hakem sertliği 1–5 yok |
| 2.1#105 | KISMİ | game/ai.ts:276 | Kırmızı kart olasılıksal; ceza 1 maç (plan 1–3) |
| 2.1#111 | KISMİ | game/runtime.ts:1108 | Arkadaşlar kesişme noktasına koşuyor; kabul testi yok |
| 2.1#112 | KISMİ | game/ai.ts:96 | Derinlik koşusu var; el kaldırma yok |
| 2.1#119 | KISMİ | sim/match/highlightGen.ts:446 | Mevkiye göre ağırlık var; kafa ve dribbling tipleri yok |
| 2.1#120 | KISMİ | sim/match/highlightGen.ts:447 | Forvet anları var; top saklama yok |
| 2.1#121 | KISMİ | sim/match/highlightGen.ts:448 | Kanat ortası ağırlıklı; 2 orta garantisi yok |
| 2.1#124 | KISMİ | sim/match/highlightGen.ts:453 | Bek dengesi plandan farklı |
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
| 2.2#38 | EKSİK | - | 12 kutlamalık kütüphane yok |
| 2.2#47 | EKSİK | game/MatchScene.ts:596 | Yalnızca gol sonrası tekrar var; "Anlar" listesi ve en iyi 3 an yok |
| 2.2#48 | KISMİ | game/runtime.ts:368 | Tekrar kare kaydından; kalıcı değil |
| 2.2#49 | KISMİ | game/MatchScene.ts:852 | Tekrar kamerası topu izliyor |
| 2.2#63 | EKSİK | game/MatchScene.ts:417 | Parçacık bütçesi yok |
| 2.2#66 | KISMİ | game/art.ts:430 | File dalgası var; verlet ızgara yok |
| 2.2#73 | KISMİ | game/MatchScene.ts:489 | Yağmur ve sürtünme var; sıçrama ve HUD ikonu yok |
| 2.2#74 | EKSİK | game/physics.ts:116 | Rüzgâr fiziği var; ok/km-sa göstergesi ve bayrak yok |
| 2.2#82 | EKSİK | game/MatchScene.ts:318 | Tek stadyum; kapasiteye göre 4 kademe yok |
| 2.2#92 | KISMİ | game/MatchScene.ts:515 | Skor bandı var; TV grafiği stili yok |
| 2.2#102 | EKSİK | ui/screens/match/PostMatchScreen.tsx:80 | Tek ekran; adım adım maç sonu akışı yok |
| 2.2#103 | EKSİK | ui/screens/match/PostMatchScreen.tsx:81 | Reyting count-up katkı dökümü yok |
| 2.2#106 | KISMİ | ui/screens/match/LiveMatchScreen.tsx:212 | 1/2/4x var; "sonraki anıma geç" yok |
| 2.2#118 | EKSİK | - | Kalite profilleri yok |
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
| 2.3#118 | EKSİK | - | Sezon gol bandı ve çift markaj adaptasyonu yok |
| 2.3#119 | TAMAM | sim/game/match.ts:176 | Maç seed'i maçtan önce kayda yazılıyor |

### 2.4 Sosyal Hayat, İlişkiler, Kararlar ve Olaylar

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.4#1 | TAMAM | sim/life/relationships.ts:125 | Her takım arkadaşı ayrı −100..100 |
| 2.4#2 | KISMİ | sim/life/relationships.ts:12 | 5 anı tutuluyor; UI yalnızca sonuncuyu gösteriyor |
| 2.4#3 | KISMİ | sim/life/relationships.ts:176 | Bantlar farklı; bant etkisi yazılmıyor |
| 2.4#4 | KISMİ | sim/life/relationships.ts:77 | Sönüm sabit; %2 ve tavan kuralı yok |
| 2.4#5 | EKSİK | - | İlişki değişim defteri yok |
| 2.4#6 | TAMAM | sim/career/matchOutcome.ts:176 | İyi maçta net negatif ilişki yok |
| 2.4#7 | EKSİK | sim/life/events/content.test.ts:100 | Kayıp/kazanç oran linter'ı yok |
| 2.4#11 | KISMİ | ui/screens/life/Relations.tsx:24 | Hızlı aksiyon var; 3 seçenekli sahne yok |
| 2.4#14 | KISMİ | sim/career/createHero.ts:208 | Aile yapısı sabit |
| 2.4#15 | TAMAM | sim/life/relationships.ts:189 | Yakın çevre etkisi tavanlı |
| 2.4#23 | TAMAM | sim/life/wellbeing.ts:67 | Partner yokluğu ceza vermiyor |
| 2.4#24 | KISMİ | sim/life/events/dsl.ts:142 | Partner tercih ayarı yok |
| 2.4#25 | KISMİ | sim/life/events/content/romance.ts:409 | TD −6, −5 tavanını aşıyor |
| 2.4#36 | KISMİ | game/ai.ts:338 | İlişki pası etkiliyor; ikon ve rapor yok |
| 2.4#37 | EKSİK | - | Yakın arkadaş listesi yok |
| 2.4#46 | KISMİ | sim/career/squadRole.ts:109 | Kadro kararında form etkisi zayıf |
| 2.4#47 | EKSİK | - | TD haftalık beklenti sistemi yok |
| 2.4#52 | KISMİ | sim/life/events/content/teammates.ts:92 | Penaltıcı olay kartı var; maç içi seçim yok |
| 2.4#53 | KISMİ | sim/life/events/content/teammates.ts:128 | Kaptanlık zinciri var; sezon başı oylama yok |
| 2.4#60 | EKSİK | sim/game/interview.ts:106 | Röportaj etkisinde tavan yok |
| 2.4#61 | KISMİ | sim/game/interview.ts:14 | Tek soru ve 4 ton; 3 soru ve tuzak yok |
| 2.4#65 | EKSİK | sim/life/casino.ts:874 | Tek ziyaret bile manşet olabiliyor |
| 2.4#69 | KISMİ | sim/life/social.ts:112 | Paylaşım limiti yok |
| 2.4#70 | KISMİ | sim/life/social.ts:24 | 2 paylaşım tipi eksik |
| 2.4#79 | EKSİK | sim/life/events/content/fans.ts:51 | Taraftar grupları yok |
| 2.4#84 | KISMİ | sim/life/events/content/casino.ts:23 | Şike teklifinde reddetmek cezalandırılıyor |
| 2.4#85 | EKSİK | sim/life/sponsors.ts:139 | 4 seviyeli skandal ölçeği yok |
| 2.4#90 | KISMİ | sim/life/events/content/health.ts:146 | Yardım hattı bilgisi yok |
| 2.4#98 | KISMİ | sim/life/events/content/friends.ts:10 | Zincir 2 adım (plan 4) |
| 2.4#99 | KISMİ | sim/life/events/content/teammates.ts:92 | Bağlı 4 adımlı zincir yok |
| 2.4#100 | KISMİ | sim/life/events/content/nightlife.ts:47 | Paparazzi var; görev yok |
| 2.4#101 | EKSİK | - | "Yurt dışında yalnız" zinciri yok |
| 2.4#102 | TAMAM | sim/life/events/content/casino.ts:23 | Bahis çetesi zinciri tam |
| 2.4#110 | KISMİ | sim/life/events/types.ts:150 | TS şeması var; Zod yok |
| 2.4#111 | KISMİ | sim/life/events/types.ts:13 | ~199 olay; hukuk, dolandırıcılık ve iş kategorileri eksik |
| 2.4#112 | KISMİ | sim/life/events/engine.ts:360 | "Kariyerde en fazla 2" kuralı yok |
| 2.4#113 | KISMİ | ui/screens/EventModal.tsx:78 | Risk rozeti var; tam şeffaflık ayarı yok |
| 2.4#114 | KISMİ | sim/life/events/types.ts:118 | Sistematik geçmiş hatırlatma yok |
| 2.4#118 | KISMİ | sim/life/events/engine.ts:180 | `{g:}` var; ICU select yok |

### 2.5 Ekonomi, Lüks, Yatırım, Kumarhane, Monetizasyon

| Madde | Durum | Kanıt | Not |
|---|---|---|---|
| 2.5#1 | KISMİ | sim/career/contract.ts:5 | Haftalık ölçek var; para birimi € |
| 2.5#2 | KISMİ | sim/life/events/engine.ts:83 | Simgesiz fiyat lint kuralı yok |
| 2.5#3 | KISMİ | sim/career/matchOutcome.ts:196 | Kazanç dökümü ekranı yok |
| 2.5#4 | EKSİK | sim/career/contract.ts:149 | Kalecinin primi 0 |
| 2.5#5 | EKSİK | - | Sezon sonu takım primi yok |
| 2.5#8 | KISMİ | sim/life/economy.ts:22 | Sabit %35 vergi; ülkeye göre değil |
| 2.5#10 | KISMİ | sim/life/economy.ts:362 | Komisyon yalnızca maaştan |
| 2.5#11 | EKSİK | core/types.ts:416 | Personel sözleşmesinde bitiş tarihi yok |
| 2.5#15 | KISMİ | sim/game/balanceSim.ts:76 | Temel yaşam gideri yok |
| 2.5#16 | KISMİ | data/activities.ts:210 | Enerji içeceği yok |
| 2.5#17 | TAMAM | data/activities.ts:2 | Günde 3 dilim |
| 2.5#18 | KISMİ | sim/life/activities.ts:337 | Ev kalitesine bağlı enerji yok |
| 2.5#19 | KISMİ | data/activities.ts | Enflasyon ayarı yok |
| 2.5#22 | TAMAM | data/assets.ts:143 | Para ile hızlandırma satılmıyor |
| 2.5#23 | TAMAM | sim/life/economy.ts:124 | Gider varlık bakımından |
| 2.5#24 | EKSİK | sim/game/balanceSim.ts | Harcama eğrisi doğrulanmıyor |
| 2.5#29 | KISMİ | data/assets.ts | Late-game para yutucuları eksik |
| 2.5#42 | TAMAM | sim/game/internal.ts:93 | Piyasa kayıtlı RNG ile |
| 2.5#53 | EKSİK | sim/life/economy.ts:365 | İşletme gelir tavanı yok |
| 2.5#54 | KISMİ | sim/life/sponsors.ts:16 | 4 sponsor kategorisi eksik |
| 2.5#55 | KISMİ | core/types.ts:365 | Performans bonusu yok |
| 2.5#60 | KISMİ | sim/life/sponsors.ts:68 | Formül farklı |
| 2.5#62 | TAMAM | sim/life/sponsors.ts:16 | Bahis sponsoru yok |
| 2.5#63 | KISMİ | data/assets.ts:30 | 85 eşyanın 57'sinde özel etki |
| 2.5#64 | KISMİ | data/assets.ts | Kategori dağılımı farklı |
| 2.5#71 | EKSİK | data/assets.ts:62 | Yıpranma modeli yok |
| 2.5#80 | EKSİK | - | "Y haftalık maaşın" gösterimi yok |
| 2.5#84 | EKSİK | sim/life/casino.ts:541 | At sahipliği yok |
| 2.5#89 | TAMAM | - | Fiş/IAP satışı yok |
| 2.5#90 | EKSİK | ui/screens/SettingsScreen.tsx | Kumarhaneyi kapatma ayarı yok |
| 2.5#91 | TAMAM | ui/backend/casinoView.ts:47 | 18 yaş kilidi |
| 2.5#92 | KISMİ | sim/life/casino.ts:513 | RTP testi var; 10M spin yok |
| 2.5#99 | KISMİ | sim/life/casino.ts:772 | Bağımlılık göstergesi var; sızıntı kuralı yok |
| 2.5#102 | KISMİ | sim/life/events/content/casino.ts:301 | Men süreleri plandan farklı |
| 2.5#103 | KISMİ | sim/life/events/content/casino.ts:36 | Sessiz ret cezalandırılıyor |
| 2.5#105 | EKSİK | - | Mağaza beyanı yok |
| 2.5#109 | KISMİ | sim/life/economy.ts:432 | Zorunlu satış var; uyarı yok |
| 2.5#112 | EKSİK | - | Deneme / tam sürüm kilidi yok |
| 2.5#113 | EKSİK | - | Kozmetik IAP yok |
| 2.5#114 | EKSİK | - | Satın alma ve geri yükleme yok |
| 2.5#115 | TAMAM | - | Kariyer parası satılmıyor |
| 2.5#116 | TAMAM | - | Reklam yok |
| 2.5#117 | EKSİK | - | Makbuz doğrulama yok |
| 2.5#118 | TAMAM | - | Ödüllü yorum istemi yok |
| 2.5#119 | EKSİK | - | Satın alma geçmişi yok |
| 2.5#120 | EKSİK | - | Mağaza sayfası yok |
| 2.5#122 | TAMAM | - | Karanlık örüntü yok |
| 2.5#125 | KISMİ | sim/game/balanceSim.ts:29 | Bot harness var; CI raporu yok |
| 2.5#126 | EKSİK | sim/game/balance.test.ts:102 | Ekonomi değişmez testleri yok |

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
| 2.7#1 | KISMİ | styles/tokens.css:9 | Kontrast CI testi yok |
| 2.7#2 | KISMİ | styles/tokens.css:1 | tsx içinde ~35 sabit hex; lint yok |
| 2.7#7 | KISMİ | styles/tokens.css:97 | Boşluk ölçeği denetlenmiyor |
| 2.7#8 | KISMİ | styles/tokens.css:110 | Ek köşe yarıçapları kullanılıyor |
| 2.7#13 | EKSİK | styles/tokens.css:166 | Açık tema yok |
| 2.7#14 | KISMİ | ../index.html:20 | Fontlar CDN'den; self-host değil |
| 2.7#15 | KISMİ | styles/base.css:126 | tabular-nums var; görsel regresyon yok |
| 2.7#16 | KISMİ | styles/tokens.css:85 | Tip ölçeği farklı |
| 2.7#21 | KISMİ | ui/layout/Shell.tsx:18 | 5 sekme var; düzen plandan farklı |
| 2.7#22 | KISMİ | ui/layout/Shell.tsx:105 | İkinci birincil buton var |
| 2.7#23 | KISMİ | ui/layout/Shell.tsx:38 | Navigasyon testi yok |
| 2.7#24 | KISMİ | ui/screens/PlannerScreen.tsx:56 | 7 günlük şerit doğrulanmadı |
| 2.7#25 | TAMAM | platform/back.ts:14 | Android geri tuşu doğru |
| 2.7#30 | TAMAM | ui/layout/Shell.tsx:1 | Masaüstünde kenar menü ve bağlam paneli |
| 2.7#31 | KISMİ | ui/App.tsx:86 | Kısayollar kısmen var |
| 2.7#32 | EKSİK | - | Menüde gamepad ve spatial navigation yok |
| 2.7#34 | KISMİ | styles/tokens.css:85 | Mikro metin 11 px |
| 2.7#38 | KISMİ | styles/components.css:42 | Buton kuralları kısmen var |
| 2.7#39 | KISMİ | ui/components/Button.tsx:25 | Danger varyantı var |
| 2.7#40 | KISMİ | ui/components/PlayerCard.tsx:31 | Oyuncu kartı var |
| 2.7#42 | KISMİ | ui/components/Chip.tsx:10 | İkon zorunlu değil |
| 2.7#43 | KISMİ | ui/components/MeterRing.tsx:19 | Düşük değer uyarısı yok |
| 2.7#44 | KISMİ | ui/components/StatBar.tsx:34 | ▲▼ gösterimi yok |
| 2.7#48 | EKSİK | - | "Geri al" toast'u yok |
| 2.7#50 | KISMİ | ui/components/Controls.tsx:7 | ± butonları yok |
| 2.7#55 | KISMİ | ui/screens/career/Radar.tsx:2 | Önceki sezon çizgisi yok |
| 2.7#56 | KISMİ | ui/components/Charts.tsx:68 | Sparkline dokunulamıyor |
| 2.7#59 | KISMİ | ui/screens/life/Bank.tsx:86 | Gelir/gider halka grafiği yok |
| 2.7#60 | TAMAM | ui/components/LeagueTable.tsx:14 | Bölge şeritleri ve vurgu var |
| 2.7#63 | KISMİ | ui/format.ts:119 | Renk körü modunda kademe numarası yok |
| 2.7#66 | KISMİ | game/MatchScene.ts:486 | HUD alanı ölçülmemiş |
| 2.7#67 | KISMİ | game/MatchScene.ts:394 | Renk körü çift çizgisi yok |
| 2.7#68 | KISMİ | game/MatchScene.ts:819 | Güç eşiği farklı |
| 2.7#71 | KISMİ | ui/screens/match/PreMatchScreen.tsx:69 | Kapasite, rol ve TD beklentisi yok |
| 2.7#72 | EKSİK | ui/screens/match/PostMatchScreen.tsx:45 | Reyting dökümü yok |
| 2.7#73 | KISMİ | ui/screens/match/PostMatchScreen.tsx:87 | Kazanç dökümü ve adım akışı yok |
| 2.7#74 | TAMAM | ui/screens/match/LiveMatchScreen.tsx:165 | Radar, anlatım, hız ve atla var |
| 2.7#78 | KISMİ | ui/screens/HomeScreen.tsx:120 | Ana sayfa sırası plandan farklı |
| 2.7#79 | KISMİ | ui/screens/NewCareerScreen.tsx:14 | 7 adım (plan 4) |
| 2.7#80 | KISMİ | ui/screens/TrainingScreen.tsx:54 | Erime uyarısı yok |
| 2.7#81 | KISMİ | ui/screens/life/Relations.tsx:45 | Eğilim oku yok |
| 2.7#82 | EKSİK | - | İlişki değişim nedeni yok |
| 2.7#83 | EKSİK | - | "Neden oldu?" paneli yok |
| 2.7#84 | KISMİ | ui/screens/life/Assets.tsx:49 | Filtre var |
| 2.7#85 | EKSİK | - | Mağaza ekranı yok |
| 2.7#86 | KISMİ | ui/screens/life/Assets.tsx:25 | Raf görünümü yok |
| 2.7#87 | KISMİ | ui/screens/casino/shared.tsx:47 | Kayıp limiti UI'da yok |
| 2.7#88 | KISMİ | ui/screens/ContractScreen.tsx:111 | Sabır tahmini yok |
| 2.7#89 | KISMİ | ui/screens/WorldScreen.tsx:92 | İlgi karşılaştırması yok |
| 2.7#90 | KISMİ | ui/screens/InboxScreen.tsx:63 | Olay bağlantısı yok |
| 2.7#91 | EKSİK | ui/screens/LifeScreen.tsx:14 | Telefon metaforu yok |
| 2.7#93 | TAMAM | ui/screens/EventModal.tsx:69 | Risk rozeti ve etki çipleri var |
| 2.7#94 | KISMİ | ui/screens/WorldScreen.tsx:135 | Kariyer/kulüp kırılımı yok |
| 2.7#98 | KISMİ | ui/screens/SavesScreen.tsx:65 | Slot ekran görüntüsü yok |
| 2.7#99 | KISMİ | ui/screens/SettingsScreen.tsx:55 | Kontroller, Bulut ve Gizlilik grupları yok |
| 2.7#103 | TAMAM | styles/tokens.css:136 | Hareket token'ları var |
| 2.7#105 | TAMAM | ui/hooks/motion.ts:20 | Count-up var |
| 2.7#114 | KISMİ | ui/screens/newcareer/AppearanceEditor.tsx:49 | Özel avatar editörü var |
| 2.7#122 | EKSİK | - | **Tutorial/onboarding hiç yok** |
| 2.7#123 | EKSİK | - | Kademeli açılış yok |
| 2.7#127 | EKSİK | - | Onay/gizlilik penceresi yok |
| 2.7#128 | KISMİ | ui/format.ts:15 | `Price` tipi yok |
| 2.7#129 | EKSİK | - | Puan istemi yok |
| 2.7#130 | KISMİ | ui/components/Modal.tsx:21 | Kapat butonu gizlenebiliyor |
| 2.7#131 | EKSİK | - | Satın alma ekranı yok |

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
| 2.10#8 | EKSİK | - | Kariyer skoru tablosu yok |
| 2.10#15 | EKSİK | - | Modlu/resmi ayrımı yok |
| 2.10#17 | EKSİK | - | Haftalık senaryo yok |
| 2.10#18 | EKSİK | - | Meydan okuma profili yok |
| 2.10#19 | EKSİK | - | Deneme hakkı tablosu yok |
| 2.10#34 | KISMİ | game/src/game/MatchScene.ts:35 | Tekrar seed+girdi olarak saklanmıyor |
| 2.10#40 | EKSİK | game/package.json:27 | Klip paylaşımı yok |
| 2.10#60 | EKSİK | - | Mod sistemi yok |
| 2.10#62 | EKSİK | - | Mod imzası yok |
| 2.10#70 | N/A-süreç | - | Yol haritası taahhüdü |
| 2.10#72 | TAMAM | - | Sezon kartı yok (kısıt sağlanıyor) |
| 2.10#76 | EKSİK | - | Uzak içerik paketi yok |
| 2.10#82 | EKSİK | - | Bildirim altyapısı yok |
| 2.10#83 | TAMAM | - | Baskı bildirimi yok (kısıt sağlanıyor) |
| 2.10#86 | TAMAM | game/src/sim/world/fixtures.ts:66 | Gerçek zaman cezası yok |
| 2.10#88 | EKSİK | - | "Hata bildir" formu yok |
| 2.10#93 | EKSİK | - | "Yenilikler" ekranı yok |
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
| 2.11#32 | EKSİK | game/MatchScene.ts:605 | "Flaşları kapat" yok |
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

## 3. Önceliklendirilmiş Backlog: Paralel İş Paketleri

**Sıralama ölçütü:** Bir NSS hayranının ilk saatlerde fark edeceği eksik önce gelir.

**Dosya sahipliği kuralı:** Her paket yalnızca kendi listelediği dosyalara yazar. Paylaşılan dosyalar şunlar: `ui/store.ts` (yalnızca `ScreenId` birleşimine ekleme), `ui/App.tsx` (yalnızca ekran kaydı ve overlay montajı) ve `i18n/tr.ts` / `i18n/en.ts` (yalnızca yeni bölüm import'u). Bu dosyalarda **yalnızca ekleme** yapılır ve merge sırasında birleştirilir. Her paket metinlerini kendi yeni `i18n/sections/<paket>.ts` dosyasına koyar.

**Ön koşul (P-0, tek kişi, ~0,5 gün):** Denge ajanının işi bitince `vitest` yeniden yeşile çekilmeli. Şu an kırmızı olanlar: `feel.test.ts` (3 test) ve `backend.test.ts:169`. Paketler kırmızı taban üzerinde başlamamalı.

---

### WP-1 · Oynanabilir Milli Takım ve Dünya Turnuvası  ⭐ en yüksek etki
NSS'nin en akılda kalan anı milli takımdır. Şu an çağrı geldiğinde maçlar zarla simüle ediliyor (`sim/game/season.ts:63`).
- **Dokunduğu dosyalar:** `sim/world/national.ts` (yeni: milli kadrolar, eleme grupları, 2 yılda bir turnuva), `sim/game/season.ts` (yalnızca *National team* bloğu, satır ~35–80), `sim/game/internal.ts` (`heroFixtureOn` milli fikstürü de taramalı), `sim/world/fixtures.ts` (milli ara haftaları), `ui/screens/national/NationalScreen.tsx` (yeni), `ui/screens/HomeScreen.tsx` (milli takım ilgi kartı), `i18n/sections/national.ts`.
- **Kabul kriterleri:**
  1. U19, U21 ve A Milli kademeleri var. Her ülkenin NPC'lerden kurulmuş 23 kişilik kadrosu var. Çağrı ölçütü ekranda açıkça yazılı (2.3#91, 2.6#91).
  2. Ana sayfada 0–100 milli ilgi göstergesi var. Kadro açıklanmadan 2 hafta önce "kesin / olası / sınırda / dışarıda" etiketi çıkıyor (2.3#92, 2.6#92).
  3. Milli maçlar normal maç akışından geçiyor: PreMatch, canlı anlar, PostMatch. Cap ve gol, oynanan maçtan yazılıyor (2.6#93).
  4. 2 yılda bir eleme grubu ve ardından "Dünya Turnuvası" ya da "Kıta Şampiyonası" oynanıyor: grup + eleme, ev sahibi ülke, kupa dolabına giriş (2.6#94, GDD 6.2).
  5. Testler: 10 sezonluk deterministik simülasyonda en az 1 turnuva tamamlanıyor. Çağrılan kahraman en az 1 milli maçı highlight ile oynuyor.

### WP-2 · Maç Adaleti ve Şeffaf Maç Sonu  ⭐
"Topa dokunmadan 4-0 gerideyim" ve "hat-trick yaptım, 6.5 aldım" NSS'nin en büyük şikâyetleri.
- **Dokunduğu dosyalar:** `sim/match/engine.ts`, `sim/match/highlightGen.ts`, `sim/match/rating.ts`, `sim/match/teamModel.ts`, `ui/screens/match/PostMatchScreen.tsx`, `ui/screens/match/PreMatchScreen.tsx`, `ui/components/Charts.tsx` (ısı haritası ve şut haritası), `sim/career/matchOutcome.ts` (güven nedenleri), `i18n/sections/match.ts`.
- **Kabul kriterleri:**
  1. Erken skor freni: ilk 15 dk içinde ve kahramanın ilk anından önce fark en fazla 1 (2.1#7).
  2. Başarı olasılığı %8'in altındaki an üretilmiyor; yerine geri pas veya top saklama anı geliyor (2.1#8).
  3. Maç öncesi ekranda "beklenen an: X–Y" gösteriliyor (2.1#9).
  4. 70. dakikadan sonra kondisyonu %40'ın altındaki oyuncularda Hız ve İlk Dokunuş −%10 (2.1#12).
  5. Maç sonu adım akışı: skor → reyting count-up ile kalem kalem döküm → kazanç dökümü → TD güven nedenleri → röportaj. "Hepsini atla" düğmesi var. 1 gol + 2 asistle reyting asla 7,0'ın altına düşmüyor; birim testi var (2.1#14, 2.2#102–103, 2.7#72–73, 2.3#84, 2.5#3).
  6. Kahraman için ısı haritası ve şut haritası (GDD 3.6).
  7. Ayrı an tipleri: kafa, top sürme, pas arası/blok, kaleci çıkışı. Mevki garantileri var: stoper ≥3 savunma anı, kanat ≥2 orta (2.1#72, #85, #119–125).
  8. Maç günü "İlerle" tuşu onay penceresi açıyor ("Maçı simüle et?"). Dosya: `ui/backend/realActions.ts` yalnızca `advance()` fonksiyonu.

### WP-3 · Ses ve Müzik  ⭐
Oyunda hiç ses dosyası yok, müzik yok, menü sesleri yok. Müzik kaydırıcısı hiçbir şeye bağlı değil.
- **Dokunduğu dosyalar:** `game/audio.ts`, `audio/` (yeni: `music.ts`, `uiSfx.ts`, `mixer.ts`), `public/audio/**` (yeni varlıklar), `platform/lifecycle.ts` (ses bölümü), `assets/LICENSES.csv` (yeni), `.github/workflows/ci.yml` (yalnızca lisans adımı).
- **Kabul kriterleri:**
  1. Lisanslı (CC0/satın alınmış) kalabalık katmanları var: uğultu, tezahürat, alkış, ıslık, yuhalama, gol patlaması. `setCrowdSize(capacity)` API'si ile seyirci sayısına göre ölçekleniyor. Skor ve son dakika gerilimine duyarlı (2.8#12–14, GDD 3.7).
  2. Hub/menü müziği var: en az 3 parça, döngülü, sahneler arası crossfade. Ayarlardaki Müzik kaydırıcısı gerçekten etkili (2.8#1–2, #35).
  3. UI sesleri: tık, onay, para, bildirim ve level-up (2.8#45, GDD 8).
  4. Vuruş türüne göre şut sesi, 3 düdük deseni, 2 seviyeli direk sesi (2.8#23–26).
  5. Mikser: Ana, Müzik, Efekt, Kalabalık, UI ve Anlatım kanalları (store'da). UI kısmını WP-9 yapar.
  6. Her ses dosyası LICENSES.csv içinde; CI, NC ve SA lisanslarını reddediyor (2.8#56).
- **Arayüz sözleşmesi:** WP-4 MatchScene içinden yalnızca `audio.*` API'sini çağırır. WP-3 MatchScene'e yazmaz.

### WP-4 · Maç Sunumu: Kutlama, Tekrar, Stadyum, Görsel Geri Bildirim
- **Dokunduğu dosyalar:** `game/MatchScene.ts`, `game/runtime.ts`, `game/art.ts`, `game/view.ts`, `ui/screens/match/LiveMatchScreen.tsx`.
- **Kabul kriterleri:**
  1. Gol kutlaması: yön seçimi (taraftara, takım arkadaşına, kameraya) ve ilişki etkisi. Şöhretle açılan en az 6 kutlama; plan hedefi 12 (2.2#37–38).
  2. Kapasiteye göre 4 stadyum kademesi (2.2#82). `audio.setCrowdSize` çağrılıyor.
  3. Maç içinde "Anlar" listesi ve maç sonu en iyi 3 an tekrarı (2.2#47).
  4. Rüzgâr oku ve km/sa HUD'u; yağmur ikonu (2.2#73–74).
  5. Ofsayt çizgisi ve Vizyon'a göre pas hedefi vurgusu (2.1#60, #103).
  6. Hareketi azalt ayarı maç sahnesinde sarsıntı, vinyet ve flaşı kapatıyor. Renk körü modunda kahraman halkası çift çizgi oluyor. "Flaşları kapat" seçeneği var (2.2#121, 2.11#31–32, 2.7#67).
  7. `MatchScene.ts:486` içinde `upper()` (tr-TR) kullanılıyor; İ/ı testi var (2.11#49).
  8. 390 px'te hız düğmeleri ve "Sona kadar sim" kırpılmıyor.
  9. Kahramanın başının üstünde forma numarası (2.2#25).

### WP-5 · Ödüller, Tören ve Kupa Derinliği
- **Dokunduğu dosyalar:** `sim/world/awards.ts` (yeni; ödül hesabı `sim/world/season.ts:215` bölgesinden buraya taşınır), `sim/game/awards.ts` (yeni; `sim/game/season.ts` içindeki ödül bloğu, satır ~236–260, ilk commit'te buraya taşınır, böylece WP-1 ile çakışma olmaz), `sim/world/competitions.ts`, `sim/world/coefficients.ts` (yeni), `ui/screens/SeasonEndScreen.tsx`, `ui/screens/awards/AwardsScreen.tsx` (yeni), `ui/screens/cup/CupDrawScreen.tsx` (yeni), `ui/screens/WorldScreen.tsx` (kupa sekmesi), `i18n/sections/awards.ts`.
- **Kabul kriterleri:**
  1. Ayın Oyuncusu, gerçek maç verisinden aylık hesaplanıyor; Inbox'a bildirim düşüyor (GDD 6.2, 2.6#102).
  2. Altın Yıldız: şeffaf puan formülü, ilk 30 aday listesi, 100 gazeteci oylama simülasyonu, tören ekranı (sahne + sıralama açılışı) ve NPC kazanan tarihi (2.3#98–99, 2.6#103).
  3. Yılın Golü, kahramanın gerçek gollerinden aday gösteriliyor (GDD 6.2).
  4. Kaleciler için Altın Eldiven ödülü (2.3#2).
  5. Kupalar: kura ekranı, çift maçlı tur, kıtasal ön eleme, yerel kupa galibine kıtasal kontenjan, katsayı tablosu, lig play-off'u (2.6#63, #76, #79, #84, #87).
  6. Kupa ve kıtasal gol/asist krallıkları World ekranında (2.6#106).

### WP-6 · Onboarding, Tutorial ve "Neden?" Katmanı
NSS'yi bilmeyenler ilk 10 dakikada kayboluyor. Ortada hiç tutorial yok; `Tooltip` bileşeni var ama hiçbir yerde kullanılmıyor.
- **Dokunduğu dosyalar:** `ui/tutorial/**` (yeni: koç adımları, ilk maç rehberi, ipucu sistemi), `ui/components/Feedback.tsx` (Tooltip), `ui/screens/help/GlossaryScreen.tsx` (yeni), `sim/game/unlocks.ts` (yeni; kademeli açılış bayrakları), `ui/layout/Shell.tsx` (kilitli menülerin gösterimi), `i18n/sections/tutorial.ts`.
- **Kabul kriterleri:**
  1. İlk kariyerde atlanabilir rehber: gün planlama → antrenman drili → ilk maçta kontroller (sürükle, şut, pas, bullet-time) → maç sonu → yaşam (2.7#122).
  2. İlk maçta bağlamsal kontrol ipuçları; kontrol şeması mobil ve PC'ye göre farklı.
  3. Kademeli açılış: kumarhane, yatırım ve işletme belirli hafta veya şöhret eşiğinde açılıyor. Kilitli öğe nedenini gösteriyor (2.7#123).
  4. En az 25 terimlik sözlük (OVR, PA, form, TD güveni…). Kritik sayıların yanında ⓘ tooltip.
  5. Ayarlarda "Tutorial'ı yeniden göster" seçeneği. e2e testi: yeni kariyerde rehber baştan sona tamamlanıyor.

### WP-7 · Kariyer Sonu: Emeklilik, Onur Listesi, Başarımlar
- **Dokunduğu dosyalar:** `sim/meta/achievements.ts` (yeni; en az 40 başarım ve tetikleyicileri), `sim/meta/hallOfFame.ts` (yeni; kayıt slotlarından bağımsız kalıcı depolama), `sim/game/actions.ts` (yalnızca `retire()`), `ui/screens/AchievementsScreen.tsx` (yeni), `ui/screens/HallOfFameScreen.tsx` (yeni), `ui/screens/retire/RetireFlow.tsx` (yeni), `ui/screens/MenuScreen.tsx`, `platform/index.ts` (çağrı tarafı), `i18n/sections/meta.ts`.
- **Kabul kriterleri:**
  1. 33 yaşından sonra her sezon sonunda "devam / bırak" kartı çıkıyor. Kariyer skoru dökümü ve emeklilik ekranı var; sonrasında Onur Listesi'ne yazılıyor (2.3#106, GDD 2.6).
  2. Onur Listesi tüm kariyerleri kupalar ve rekorlarla gösteriyor. Kayıt silinse bile kalıyor.
  3. Başarım seti oyunda görülebiliyor ve açılınca toast çıkıyor. Steam build'de `platform.achievements.unlock` çağrılıyor (2.9#89, 2.10#111).
  4. Kulüp rekorları ve rekor kırma haberi (2.6#107).
  5. Yedek kalınca "şikayet et" kararı UI'a bağlı (GDD 2.5).

### WP-8 · Kariyer Derinliği: Antrenman, Perk Etkileri, Sözleşme, Kadro
- **Dokunduğu dosyalar:** `game/training/**` (yeni driller: Orta, Kafa, Top Kapma, Falso Kapısı), `game/kick.ts` (yalnızca perk okuma noktaları), `sim/career/progression.ts`, `sim/career/contract.ts`, `sim/career/squadRole.ts`, `sim/career/transfers.ts`, `sim/game/newGame.ts`, `ui/screens/ContractScreen.tsx`, `ui/screens/ProfileScreen.tsx`, `ui/screens/TrainingScreen.tsx`, `i18n/sections/career2.ts`.
- **Kabul kriterleri:**
  1. Eksik 3 mini oyun var (2.3#26–28). Var olan 5 drill planın 0–100 puanlamasına çekiliyor (2.3#21–25).
  2. Maç perkleri maçta gerçekten etki ediyor; Plase Uzmanı vb. birim testli (2.3#40).
  3. Özellik erimesi ve 7 gün önceden uyarı (2.3#14).
  4. Profilde potansiyel yıldızı ve scout belirsizlik bandı (2.3#12).
  5. Sözleşmede piyasa referansı (5 NPC maaş aralığı, "piyasanın %X'i") ve son teklif kuralı (2.3#62–63).
  6. Son 3 maç reyting ≥7,5 ise rotasyon garantisi. Rollerin beklenen dakikası yazılı (2.3#81–83).
  7. Başlangıç kulübü: 3 deneme daveti, akademi ya da seçme. Deneme maçı tek "an paketi" (2.3#7).

### WP-9 · Erişilebilirlik ve Ayarlar
- **Dokunduğu dosyalar:** `ui/screens/SettingsScreen.tsx` (tamamı bu pakette), `styles/tokens.css`, `styles/screens/wizard.css`, `game/input.ts` (tuş atama, sol el ve dokunma alanı ölçeği), `ui/components/Modal.tsx`, `i18n/index.ts`, `ui/format.ts`, `i18n/sections/settings.ts`.
- **Kabul kriterleri:**
  1. 6 kanallı ses mikseri UI'ı (WP-3'ün store alanlarına bağlı) ve Kontroller grubu (2.7#99, 2.8#1).
  2. Tuş yeniden atama, sol el modu, dokunma alanı ölçeği ve zamanlama penceresi genişletme (2.11#17–23).
  3. 3 ayrı renk körü paleti, desen maskesi, rem tabanlı metin ölçeği ve sistem font ölçeği (2.11#1–6).
  4. "Kumarhaneyi gizle" ayarı ve FEATURE_CASINO bayrağı (2.5#90, 2.12#42–43).
  5. `wizard.css:99` odak halkası geri geliyor. axe-core e2e taraması 0 kritik hata veriyor (2.11#10–12).
  6. `Intl.Collator('tr')` sıralamada kullanılıyor; pseudo-locale modu var (2.11#45, #50).
  7. Menü gamepad navigasyonu (2.7#32, 2.9#95).

### WP-10 · Yaşam ve Olay Derinliği
- **Dokunduğu dosyalar:** `sim/life/relationships.ts`, `sim/life/events/content/**`, `sim/life/events/engine.ts`, `sim/game/interview.ts`, `sim/life/casino.ts` (manşet kuralı), `sim/life/economy.ts`, `sim/life/sponsors.ts`, `ui/screens/life/**`, `ui/screens/casino/CasinoScreen.tsx`, `ui/screens/EventModal.tsx`, `i18n/sections/life.ts`.
- **Not:** Bu paket denge ajanının işi bittikten sonra başlamalı. Ekonomi ve kumarhane dosyaları şu an onun elinde.
- **Kabul kriterleri:**
  1. İlişki değişim defteri ve "Neden değişti?" paneli: son 10 değişim, tarih, olay ve miktar (2.4#5, 2.7#82–83).
  2. Röportaj 3 soruluk; reytinge bağlı etki tavanı var (2.4#60–61). UI kısmı WP-2'nin PostMatch akışına bir bileşen olarak verilir.
  3. Yeni olay kategorileri: hukuk, dolandırıcılık, transfer söylentisi ve iş. 4 adımlı zincirler. "Yabancı Ülkede Yalnız" zinciri. Toplam olay ≥230. "Kariyerde en fazla 2" kuralı (2.4#98–101, #111–112).
  4. Tek kumarhane ziyareti manşet üretmiyor. Kumarhanede sorumlu oyun ve yardım hattı mesajı (2.4#65, 2.12#45).
  5. Kaleci primi, sezon sonu takım primi ve personel sözleşmelerinde bitiş tarihi (2.5#4–5, #11).

### WP-11 · Hukuk, Lisans ve Teknik Sağlamlık  (küçük ama **acil**: hukuki kısım ilk sprintte)
- **Dokunduğu dosyalar:** `public/manifest.webmanifest`, `i18n/sections/title.ts`, `data/world/countries.ts` (yalnızca adlar), `index.html` ve `public/fonts/**` (font self-host), `state/save.ts`, `ui/screens/SavesScreen.tsx`, `game/MatchScene.ts` (yalnızca `webglcontextlost` dinleyicisi; WP-4 ile koordine edilir ya da WP-4 bitince yapılır), `electron/main.cjs`, `.github/workflows/*`, `eslint.config.js` (yeni).
- **Kabul kriterleri:**
  1. Repoda "New Star Soccer" ve "manevi halefi" ifadeleri yok; CI grep kontrolü var. "Anadolu Süper Ligi" yerine kurgusal bir ad (2.12#1–2, #10).
  2. Fontlar self-host ediliyor, çevrimdışı açılış ağ isteği yapmıyor. OFL metni ve THIRD_PARTY_LICENSES dosyası var (2.12#32–33, 2.10#3).
  3. Kayıt: migrasyon öncesi `.bak`, "Oyunu güncelleyin" mesajı, kota dolduğunda yedekler silinmiyor ve kullanıcı uyarılıyor, mobilde paylaşım sayfasıyla dışa aktarma (2.9#46–50).
  4. ESLint (sim'de DOM, Phaser ve Date.now yasak), CI'da bloklayan e2e, çökme raporlama (opt-in) (2.9#27, #107, #112).
  5. Electron `before-quit` anında kayıt alıyor; steamworks.js bağımlılığı ekleniyor (2.9#45, #87).
  6. Uygulama arka plana geçince canlı maç otomatik duraklıyor (2.9#77).

### WP-12 · Monetizasyon ve Online (son sırada)
- **Dokunduğu dosyalar:** `platform/purchases.ts` (yeni), `sim/meta/entitlement.ts` (yeni), `ui/screens/store/**` (yeni), `game/package.json` (IAP eklentisi), `ui/screens/LeaderboardScreen.tsx` (yeni).
- **Kabul kriterleri:**
  1. 1 sezonluk deneme ve tek seferlik "Tam Kariyer" kilidi; satın almayı geri yükleme butonu; sim izolasyon testi: kilit, simülasyon sonucunu etkilemiyor (2.5#112–120, 2.9#82–83, #126–127).
  2. Fiyatlar yerel para birimiyle şeffaf; karanlık örüntü yok (2.7#85, #131).
  3. Çevrimiçi anahtar ve kariyer skoru lider tablosu (opsiyonel, opt-in) (2.10#2–8).

---

### Önerilen sprint dağılımı (4 paralel mühendis)

| Sprint | Mühendis A | Mühendis B | Mühendis C | Mühendis D |
|---|---|---|---|---|
| 1 | WP-1 Milli Takım | WP-2 Adalet + Maç Sonu | WP-3 Ses/Müzik | WP-11 Hukuk/Teknik (ilk gün hukuki temizlik) |
| 2 | WP-5 Ödüller/Kupalar | WP-4 Maç Sunumu | WP-6 Onboarding | WP-7 Emeklilik/Başarımlar |
| 3 | WP-8 Kariyer Derinliği | WP-10 Yaşam/Olaylar | WP-9 Erişilebilirlik | WP-12 Monetizasyon |

**Çakışma notları:**
- WP-1 ve WP-5, `sim/game/season.ts` dosyasının farklı bloklarına dokunuyor. WP-5'in ilk commit'i ödül bloğunu yeni dosyaya taşır.
- WP-2 ve WP-10'un PostMatch röportaj UI'ı WP-2'ye aittir; WP-10 yalnızca sim tarafını yapar.
- WP-4 ve WP-11'in `MatchScene.ts` değişikliği sıralı yapılır: önce WP-4.
- WP-3 ve WP-9'un ayarlar ekranı WP-9'a aittir; WP-3 yalnızca store alanlarını açar.
