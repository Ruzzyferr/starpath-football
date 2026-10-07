# Denge (Balance) Raporu

Bu belge StarPath Football'un kariyer ve maç dengesi için **hedefleri**, bunları
ölçen **simülasyonu** ve yapılan **ayarları** (önce/sonra) kayıt altına alır.
Sayılar tahmin değil; gerçek oyun kodu üzerinden otomatik kariyerler oynatılarak
ölçüldü.

## Nasıl ölçülüyor?

`game/src/sim/game/balanceSim.ts` gerçek oyun cephesini (`sim/game`) kullanarak
kariyerleri baştan sona oynar:

- **Planlama:** otopilot (`autoPlanDay`): günde iki antrenman, maç günü video +
  dinlenme, yorgunken toparlanma. Akşamları persona'ya göre gece kulübü veya
  kumarhane.
- **Maçlar:** her maç motor tarafından otomatik simüle edilir (oyuncu oynamaz).
- **Olay kartları:** her kartta açık seçeneklerden rastgele biri (tohumlu), böylece
  bütün dallar denenir.
- **Teklifler:** serbest oyuncuyken en iyi kulüp; yenileme maaş düşmüyorsa; transfer
  kulüp itibarı +6 ise ya da benzer kulüpte 1,5× maaş varsa. Kiralık yalnızca
  yedek kalan ≤ 21 yaş oyuncu için.
- **Para:** sponsorların hepsi kabul, ajan ve antrenör tutulur, aylık alışveriş.
  Bütçe nakitten 20 haftalık maaş rezervi düşüldükten sonra hesaplanır: `pro` %12,
  `party` %25, `spender` %45. Bakım masrafı maaşın %25'ini (spender'da %60) geçmez.
- **Kumar (`gambler`):** akşamların %30'unda kumarhane, kasanın %1–5'i kadar
  bahis (en fazla 250K, arayüzdeki masa limiti), 2–6 el.
- **Karışım:** 30 kariyer = 6 arketip × 4 köken × 10 ülke. 1/4'ü kadın. Persona
  dağılımı: %50 pro, %20 spender, %20 gambler, %10 party. Her kariyer 17 yaşında
  başlar ve 10 sezon sürer.

Çalıştırmak için:

```
cd game
BALANCE=1 npx vitest run src/sim/game/balance.test.ts --reporter=verbose
# BALANCE_N=12 BALANCE_SEASONS=8 ile hızlı tur (~70 sn); 30×10 ≈ 4,5 dk
```

Ortam değişkeni verilmezse yalnızca 1 sezonluk bir duman testi koşar (~1 sn).

## Hedefler

Mağaza yorumlarından (docs/research/02) öne çıkan şikâyetler: transferler
gerçek dışı kolay ("1. sezondan sonra amatör ligden PSG'ye"), birkaç sezon sonra
"her şeyi aldım, şimdi ne?" sıkıntısı, NRG ödeme duvarı, at yarışının futboldan
çok kazandırması ve ilerlemeyi geri alan ceza olayları.

| Alan | Hedef |
|---|---|
| OVR gelişimi | 17–21 yaş arası sezonda +5–7. Potansiyeli yüksek (≥ 85) oyuncu 80+ OVR'ye 25 yaşına kadar (tercihen 22–24) ulaşır. Potansiyel yumuşak tavandır (aşım ≤ +3). |
| Kulüp/kademe | İyi bir oyuncu 1. kademe lige 21–23 yaşında çıkar, elit kulübe (itibar ≥ 80) 22–24 yaşında. Sezonda en fazla ~1 kulüp değişikliği. |
| İtibar | 18 yaşında ~15, 21'de ~50, 25'te 75–85. 100 neredeyse ulaşılmaz. |
| Para | 3. sezon sonunda medyan net servet ≤ 300K, en zengin ≤ 2M (erken patlama yok). 26 yaşında medyan 5–20M, yıldızlar 30–60M. |
| Lüks | Ada yalnızca süperstarlara (itibar 85+, ~25 yaş üstü). Harcama, gelirin anlamlı bir kısmını (%40–70) yutar. |
| İflas | Normal oyuncu iflas etmez. Kumarbaz/savurgan personada az sayıda (≤ %10). |
| Kumarhane | Kumarbaz personada harcamanın %15–35'i. Bütün oyuncularda ≤ %5. Futboldan fazla kazandırmaz. |
| Enerji | Enerji normal antrenmanı hiçbir zaman engellemez (NSS NRG duvarının tersi). |
| Olaylar | Haftada ~1,5–2,5 kart, aynı kart sezonda ≤ ~3 kez. |
| Sakatlık | Sezonda 1–2 sakatlık, toplam 3–6 hafta. |

## Önce / sonra (30 kariyer × 10 sezon)

"Önce" sütunu ayar öncesi kodla alındı. O turda iflas "nakit < 0" demekti ve
kumar bahsi sınırsızdı. Sonraki turlarda resmi iflas bayrağı ve 250K masa limiti
kullanıldı.

| Metrik | Önce | Sonra | Hedef |
|---|---|---|---|
| OVR medyanı 17 → 18 → 19 → 21 yaş | 62 → 73 → 79 → 84 | 54 → 62 → 68 → 76 | +5–7/sezon |
| OVR (pot ≥ 85), 20 / 24 yaş | 85 / 90 | 76 / 85 | 80+ ≤ 25 yaş |
| Yüksek potansiyelde 25 yaşına kadar 80+ | 9/9 | 9/9 | hepsi |
| Potansiyeli en çok aşan (son OVR − pot) | +8 | +6 | ≤ +3 |
| İtibar medyanı 18 / 21 / 25 yaş | 49 / 100 / 100 | 16 / 58 / 86 | 15 / 50 / 75–85 |
| İlk 1. kademe lig yaşı (medyan) | 19 | 21 | 21–23 |
| İlk elit kulüp yaşı (medyan, ulaşan) | 20 (%93) | 23 (%57) | 22–24 |
| Haftalık maaş medyanı 26 yaş (p90) | 265K (376K) | 85K (257K) | 60–120K (≤ 300K) |
| 3. sezon net servet medyanı / en yüksek | 1,6M / 13,9M | 137K / 1,9M | ≤ 300K / ≤ 2M |
| 26 yaş net servet medyanı / p90 / en yüksek | 340M / 423M / 564M | 16,6M / 34,7M / 53,1M | 5–20M / 30–60M |
| Ada alan kariyer | 12 kariyer, 20–26 yaş, itibar 97–100 | 3 kariyer, 25–27 yaş, itibar 88–94 | yalnızca süperstar |
| İflas eden kariyer | %0 | %3 (1 kumarbaz) | ≤ %10, yalnızca riskli persona |
| Kumarhane payı (kumarbaz / herkes) | %48 / %27 | %17 / %4 | %15–35 / ≤ %5 |
| Haftada olay kartı | 1,2 | 1,7 | 1,5–2,5 |
| Enerji yüzünden yapılamayan antrenman sabahı | %0 | %0 | %0 |
| Sezonda sakatlık / sakat hafta | 1,8 / 3,4 | 1,8 / 3,6 | 1–2 / 3–6 |
| Sezonda kulüp değişikliği | ~1,1 | 0,7 | ≤ 1 |

### Bulunan sorunlar ve kök nedenleri

1. **Antrenman XP'si iki katıydı.** Gelişim eğrisi haftada 5 seansa göre
   ayarlanmıştı (`progression.test.ts`). Otopilot ve gerçek oyuncu ise günde 2
   seans, yani haftada ~10 seans yapıyor. Sonuç: sezonda +11 OVR ve
   potansiyelin 5–8 puan üstüne çıkmak.
2. **İtibarın asıl kaynağı olay kartlarıydı, maçlar değil.** Kartlar sezonda
   +13–20 itibar veriyordu ve azalan getiri yoktu. Buna milli takım, ödül, kupa
   ve transfer bonusları da eklenince 30 kariyerin hepsi 20 yaşında 100'e
   dayandı.
3. **Sponsorlar futboldan 10 kat fazla kazandırıyordu.** `200·e^(0,065·itibar)`
   itibar 100'de kategori başına ~350K/hafta ediyor, 6 kategoride 2M+/hafta.
   Hızlanan itibarla birleşince 3. sezonda 13,9M, 10. sezonda 560M servet çıktı.
4. **Transferler çok kolaydı.** Kulüpler, kadrolarının ortalamasından 3 puan
   düşük oyuncuya tam ilgi gösteriyordu. 17–19 yaşındaki oyuncu her pencerede bir
   kademe atlıyordu (yorumlardaki "1 sezonda PSG" şikâyeti).
5. **Ada çok erken açılıyordu.** Göl adacığı itibar 55'te, Ege adası 70'te
   alınabiliyordu.
6. **Olay sayısı hedefin altındaydı** (haftada 1,2). Sıklık artınca
   `health.minor_knock` kartı tekrar etmeye başladı.

### Yapılan değişiklikler (küçük, belgelenmiş)

| Dosya | Değişiklik |
|---|---|
| `sim/career/training.ts` | `SESSION_XP_SCALE = 0.45`: seans XP'si, haftada ~10 seansa göre ölçeklendi. |
| `sim/career/common.ts` | `fameGain(rep, x)`: pozitif itibar kazancı `× (1 − rep/100)` ile çarpılır (şöhret doyar). Milli takım, ödül, kupa ve transfer bonusunda kullanılıyor. |
| `sim/life/events/engine.ts` | `eventRepGain`: kart itibarı `× 0.45 × (1 − rep/100)^1.3` (kayıplar tam). Ondalıklı uygulanıyor. |
| `sim/career/matchOutcome.ts` | Maç itibarı azalan getirisi `(1 − rep/120)` yerine `(1 − rep/100)^1.3`. `MATCH_REP_SCALE = 1.0`. |
| `sim/life/sponsors.ts` | Sponsor değeri `150·e^(0,055·itibar)`: itibar 100'de en iyi portföy ~0,4–0,6M/hafta. |
| `sim/career/transfers.ts` | `SCOUT_FIT_MARGIN = 1`: kulüpler kadro ortalamasına yakın oyuncu istiyor (eskiden −3). Bonservis itibarı `fameGain` ile. |
| `data/assets.ts` | Göl adacığı itibar 55 → 75, Ege adası 70 → 82. |
| `sim/life/events/engine.ts` | Olay sıklığı: `weekly` 0,55 → 0,9, `post_match` 0,3 → 0,4, galibiyet/mağlubiyet 0,35 → 0,45, `EXTRA_CARD_FACTOR` 0,3 → 0,5. Üst sınırlar (haftada 3, 2'si kendiliğinden) değişmedi. |
| `sim/life/events/content/health.ts` | `minor_knock` bekleme süresi 10 → 16 hafta. |

### İtibar eğrisi ayarı (fame pass)

Ölçüm: 30 kariyer × 10 sezon, medyan itibar. Değişiklik: `MATCH_REP_SCALE` 1.0 → 0.62 (`sim/career/matchOutcome.ts`), `EVENT_REP_SCALE` 0.45 → 0.33 (`sim/life/events/engine.ts`).

| Yaş | Önce | Sonra | Hedef |
|---|---|---|---|
| 18 | 16 | 14 | ~15 |
| 21 | 59 | 50 | ~50 |
| 25 | 85 | 80 | 75–85 |
| İlk elit kulüp (itibar ≥ 80) yaşı | 23.5 | 24.0 | - |
| İlk 1. kademe lig yaşı | 20.5 | 20.0 | 21–23 |
| İflas eden kariyer | 20% | 17% | - |


### Kalan notlar

- Potansiyeli yüksek gençler (pot ≥ 85) 80 OVR'ye ortalama 22 yaşında ulaşıyor.
  Hedefin içinde ama alt ucunda. Mini oyunlarda iyi oynayan bir oyuncu
  (performans > 0,6) biraz daha hızlı gelişir.
- Bazı arketipler (kaleci, düşük potansiyelli forvet) potansiyelini 3–6 puan
  aşabiliyor. Bunun kaynağı maç XP'si ve doğal gelişim. İleride
  `xpCostForNextPoint` içindeki tavan çarpanı sertleştirilebilir.
- Oyunun ikinci yarısında servet, harcamalara rağmen birikmeye devam ediyor
  (26 yaş medyanı 16,6M). Hedef aralığın üst sınırında. Maaşla ölçeklenen bir
  haftalık yaşam masrafı ileride değerlendirilebilir.
- Simülasyon maçları otomatik oynatıyor. Gerçek bir oyuncunun highlight
  performansı puan ve gol sayısını değiştirir (bkz. maç hissi bölümü).

## Ayrıntılı sonuçlar (sonra)

#### Sezon sonu dağılımı (medyan [p25–p75])

| Sezon | Yaş | OVR | OVR (pot≥85) | İtibar | Lig 1. kademe | Haftalık maaş (medyan / p90) | Net servet (medyan / p90 / max) | Kupa (ort.) |
|---|---|---|---|---|---|---|---|---|
| 1 | 17 | 54 [53–57] | 54 | 7 | 0% | 730 / 2K | 15K / 38K / 67K | 0.0 |
| 2 | 18 | 62 [60–65] | 62 | 16 | 13% | 2K / 12K | 59K / 239K / 480K | 0.0 |
| 3 | 19 | 68 [66–73] | 70 | 30 | 20% | 7K / 29K | 137K / 949K / 1.9M | 0.0 |
| 4 | 20 | 73 [71–78] | 76 | 44 | 43% | 14K / 54K | 386K / 1.6M / 3.0M | 0.1 |
| 5 | 21 | 76 [74–78] | 78 | 58 | 53% | 25K / 67K | 1.0M / 3.1M / 7.2M | 0.1 |
| 6 | 22 | 79 [76–81] | 81 | 68 | 73% | 35K / 145K | 1.5M / 8.5M / 11.2M | 0.2 |
| 7 | 23 | 80 [78–83] | 83 | 75 | 80% | 62K / 189K | 4.8M / 12.9M / 18.8M | 0.3 |
| 8 | 24 | 82 [79–84] | 85 | 80 | 90% | 63K / 224K | 6.8M / 18.1M / 27.8M | 0.6 |
| 9 | 25 | 82 [80–85] | 86 | 86 | 93% | 80K / 237K | 12.3M / 24.9M / 30.5M | 1.0 |
| 10 | 26 | 83 [80–85] | 86 | 86 | 93% | 85K / 257K | 16.6M / 34.7M / 53.1M | 1.4 |

#### İtibar kaynakları (sezon başına ortalama)

| Sezon | Maç | Haftalık (milli takım, ödül, kupa) | Olay kartları | Transfer | Diğer (aktivite) | Alışveriş |
|---|---|---|---|---|---|---|
| 1 | 0.5 | -0.0 | 4.0 | 0.1 | -0.0 | 0.0 |
| 2 | 4.0 | -0.0 | 4.7 | 0.9 | -0.0 | 0.2 |
| 3 | 6.3 | 0.7 | 2.6 | 2.4 | -0.0 | 0.5 |
| 4 | 6.9 | 1.1 | 2.5 | 2.3 | -0.0 | 0.9 |
| 5 | 5.8 | 1.8 | 0.4 | 1.3 | 0.0 | 1.5 |
| 6 | 6.1 | 1.8 | -0.1 | 1.0 | 0.0 | 1.9 |
| 7 | 4.3 | 1.4 | -1.7 | 0.6 | -0.0 | 2.0 |
| 8 | 3.8 | 1.5 | -2.5 | 0.2 | -0.0 | 1.6 |
| 9 | 3.0 | 1.2 | -1.8 | 0.2 | 0.0 | 1.5 |
| 10 | 2.3 | 1.1 | -2.4 | 0.2 | 0.0 | 1.3 |

#### Para: gelir ve harcama kalemleri (tüm kariyerlerin toplamı, sezon başına)

| Sezon | Gelir (vergi sonrası) | Varlık alımı | Bakım | Antrenör | Kumarhane (net kayıp) | Diğer (aktivite/olay/bonus, net) | Harcama / gelir |
|---|---|---|---|---|---|---|---|
| 1 | 607K | 22K | 4K | 3K | 0 | 156K | 31% |
| 2 | 2.0M | 449K | 25K | 193K | 94K | -853K | 39% |
| 3 | 5.6M | 1.6M | 135K | 667K | 220K | -2.7M | 48% |
| 4 | 15.9M | 3.4M | 357K | 950K | 515K | 3.0M | 52% |
| 5 | 34.1M | 12.9M | 983K | 950K | 680K | 1.9M | 51% |
| 6 | 64.2M | 31.4M | 2.8M | 950K | -6.4M | 60K | 55% |
| 7 | 105.6M | 58.3M | 6.4M | 950K | -4.1M | 3.2M | 65% |
| 8 | 163.7M | 63.4M | 11.8M | 950K | 9.0M | 44.1M | 79% |
| 9 | 209.8M | 78.5M | 17.7M | 950K | 8.4M | 40.6M | 70% |
| 10 | 253.0M | 101.1M | 24.7M | 950K | 4.8M | 19.9M | 60% |

#### Özet metrikler

| Metrik | Değer |
|---|---|
| Kariyer sayısı × sezon | 30 × 10 |
| İlk 1. kademe lig yaşı (medyan, ulaşan %) | 21.0 (93%) |
| İlk elit kulüp (itibar ≥ 80) yaşı (medyan, ulaşan %) | 23.0 (57%) |
| Yüksek potansiyel (≥85): 25 yaşına kadar OVR 80+ | 9/9 |
| 3. sezon sonu net servet (medyan / max) | 137K / 1.9M |
| İflas eden kariyer | 3% (gambler) |
| Sezon başına kulüp değişikliği (ort.) | 0.7 |
| Nakdin eksiye düştüğü hafta (kariyer başına) | 0.1 |
| Haftalık olay kartı (ort.) | 1.7 |
| Sezon başına sakatlık (ort.) / sakat hafta | 1.8 / 3.6 |
| Enerji yetmediği için normal antrenman yapılamayan sabahlar | 0% |
| Sezon başına maç (medyan) / gol (medyan) | 28 / 8 |
| Kumarhane payı: kumarbaz personada harcamanın % kaçı | 17% |
| Kumarhane payı: tüm kariyerlerde | 4% |
| Ada alan kariyer (yaş / itibar) | 27 / 92, 25 / 88, 25 / 94 |

## Maç hissi (highlight) ayarı

### Yöntem

`src/game/humanBot.ts`, gerçek bir dokunmatik oyuncuyu taklit eden gürültülü bir
bottur. Kale çizgisinde nişan sapması, düzensiz vuruş gücü, gecikmeli reaksiyon,
ara sıra ters tarafa plonjon, zamanlaması kaçan müdahale ve kafa vuruşları
yapar. Dört seviyesi var: novice / average / good / expert.

Bot, oyunun gerçek senaryo üreticisiyle (`buildScenario`, 65 OVR takımlar)
kurulan highlight'ları başsız runtime'da oynar (tam nişan yardımı, ağır çekim
açık). Ölçüm `src/game/feelHarness.ts` içinde, bantlar `src/game/feel.test.ts`
içinde (average/normal). Tam tablo için:

```
FEEL_REPORT=1 FEEL_N=120 npx vitest run src/game/feel.test.ts -t report
```

Başarı tanımı:

- 1v1, penaltı, serbest vuruş, ceza sahası önü: gol.
- Orta, korner: gol ya da asist.
- Savunma: `defended` / `foul_won`.
- Kaleci: gol yememek.

### Hedefler (ortalama oyuncu, normal zorluk)

| Tür | Hedef | Önce | Sonra |
|---|---|---|---|
| one_on_one | ~%40 | %57 | %45 |
| penalty | ~%75 | %84 | %73–75 |
| freekick | %15–20 | %34 | %14–15 |
| edge_of_box | ~%12 | %32 | %13 |
| cross | %15–25 | %3* | %8 |
| corner | %20–30 | %48 | %32 |
| defend | ~%65 | %90 | %93 |
| gk_save | %60–70 | %62 | %68 |

\* Önceki ölçümde bot her zaman orta açıyordu. Sonraki ölçümde %60 orta, %40
içeri kat edip şut olarak karıştırıldı.

### Önce (N=120; novice / average / good / expert)

| Tür | Zorluk | novice | average | good | expert |
|---|---|---|---|---|---|
| one_on_one | easy | 71% | 73% | 73% | 78% |
| one_on_one | normal | 65% | 57% | 68% | 62% |
| one_on_one | hard | 55% | 50% | 60% | 53% |
| one_on_one | legend | 44% | 38% | 50% | 44% |
| penalty | easy | 87% | 88% | 90% | 91% |
| penalty | normal | 79% | 84% | 86% | 81% |
| penalty | hard | 78% | 78% | 78% | 79% |
| penalty | legend | 73% | 69% | 75% | 78% |
| freekick | easy | 33% | 34% | 34% | 43% |
| freekick | normal | 34% | 34% | 30% | 32% |
| freekick | hard | 24% | 25% | 23% | 29% |
| freekick | legend | 25% | 21% | 30% | 30% |
| edge_of_box | easy | 33% | 46% | 40% | 36% |
| edge_of_box | normal | 31% | 32% | 28% | 28% |
| edge_of_box | hard | 28% | 26% | 18% | 15% |
| edge_of_box | legend | 18% | 17% | 13% | 11% |
| cross | easy | 3% | 2% | 2% | 2% |
| cross | normal | 3% | 3% | 3% | 3% |
| cross | hard | 3% | 3% | 3% | 3% |
| cross | legend | 4% | 3% | 3% | 3% |
| corner | easy | 40% | 53% | 57% | 58% |
| corner | normal | 43% | 48% | 50% | 57% |
| corner | hard | 30% | 35% | 40% | 44% |
| corner | legend | 33% | 35% | 40% | 45% |
| defend | easy | 91% | 90% | 92% | 94% |
| defend | normal | 88% | 90% | 90% | 85% |
| defend | hard | 91% | 90% | 92% | 93% |
| defend | legend | 89% | 92% | 90% | 89% |
| gk_save | easy | 63% | 69% | 68% | 78% |
| gk_save | normal | 62% | 62% | 68% | 73% |
| gk_save | hard | 54% | 56% | 61% | 66% |
| gk_save | legend | 54% | 56% | 64% | 69% |

### Sonra (N=120)

| Tür | Zorluk | novice | average | good | expert |
|---|---|---|---|---|---|
| one_on_one | easy | 43% | 54% | 53% | 69% |
| one_on_one | normal | 37% | 45% | 44% | 53% |
| one_on_one | hard | 31% | 33% | 40% | 38% |
| one_on_one | legend | 26% | 22% | 28% | 24% |
| penalty | easy | 78% | 81% | 84% | 89% |
| penalty | normal | 72% | 73% | 81% | 78% |
| penalty | hard | 68% | 69% | 75% | 75% |
| penalty | legend | 62% | 64% | 72% | 70% |
| freekick | easy | 15% | 18% | 13% | 14% |
| freekick | normal | 13% | 14% | 14% | 10% |
| freekick | hard | 11% | 11% | 12% | 7% |
| freekick | legend | 12% | 11% | 13% | 7% |
| edge_of_box | easy | 21% | 23% | 30% | 27% |
| edge_of_box | normal | 21% | 13% | 12% | 15% |
| edge_of_box | hard | 8% | 8% | 8% | 10% |
| edge_of_box | legend | 9% | 10% | 4% | 6% |
| cross | easy | 5% | 7% | 8% | 12% |
| cross | normal | 8% | 8% | 9% | 13% |
| cross | hard | 6% | 5% | 9% | 10% |
| cross | legend | 6% | 6% | 9% | 7% |
| corner | easy | 31% | 38% | 38% | 41% |
| corner | normal | 27% | 32% | 37% | 40% |
| corner | hard | 21% | 28% | 30% | 32% |
| corner | legend | 18% | 24% | 24% | 27% |
| defend | easy | 96% | 97% | 96% | 97% |
| defend | normal | 90% | 93% | 90% | 89% |
| defend | hard | 94% | 93% | 92% | 94% |
| defend | legend | 93% | 93% | 93% | 93% |
| gk_save | easy | 73% | 73% | 85% | 83% |
| gk_save | normal | 67% | 68% | 82% | 79% |
| gk_save | hard | 65% | 68% | 79% | 78% |
| gk_save | legend | 63% | 66% | 78% | 79% |

Zorluk yayılımı (average): 1v1 easy %54 → legend %22, penaltı %81 → %64, ceza
sahası önü %23 → %10, korner %38 → %24. `DIFFICULTY_SCALE` (easy 0.85 /
normal 1 / hard 1.15 / legend 1.3) değişmedi.

### Değişen sabitler (`src/game/runtime.ts`)

| Sabit | Eski | Yeni | Neden |
|---|---|---|---|
| `DIVE_BODY_BACK` | yok (0) | 0.7 m | **Hata düzeltmesi:** plonjondaki kalecinin temas çizgisi yalnızca gövde merkezinden ele doğru uzanıyordu. Fazla uzanan kalecinin gövdesinin içinden geçen top gol sayılıyordu. Artık bacak ve gövde de sayılıyor. |
| `KEEPER_STAND_MAX_Z` | 1.7 m | 2.2 m | Kalecinin 0.55 m yakınından gelen baş hizasındaki toplarda yana uçmak yerine ayakta müdahale. |
| `HERO_SHOT_NOISE` | 1 | 1.5 | Kaydırma isabetsizliği. Önceden şutların neredeyse hiçbiri çerçeve dışına çıkmıyordu (gerçekte ~1/3). Şut, vole ve kafaya uygulanır, paslara uygulanmaz. |
| `HERO_HEADER_NOISE` | 1 | 1.3 | Korner kafaları ~%45 golle bitiyordu. |
| `KEEPER_SAVE_BONUS` | 0 | +0.08 | Her şut temasında küçük bir kurtarış katkısı. |
| `PENALTY_READ_BASE` | 0.20 | 0.22 | Kalecinin penaltıda tarafı okuma olasılığı; penaltıyı ~%75'e çeker. |

### Güncel ölçüm (Ekim 2026; normal zorluk, N=120; novice / average / good / expert)

Taktik hücumcular, insan hızında savunmacılar, orta bölgeleri ve hava
mücadeleleri eklendikten sonra yeniden ölçüldü. Yeni türler: counter_2v1,
long_ball_control, rebound, interception.

| Tür | novice | average | good | expert | Bant (average) |
|---|---|---|---|---|---|
| one_on_one | 35% | 34% | 41% | 56% | %25–55 (N=200: 35 / **39** / 44 / 51) |
| penalty | 57% | 73% | 82% | 83% | %62–88 |
| freekick | 17% | 18% | 13% | 12% | %6–28 |
| edge_of_box | 17% | 15% | 19% | 18% | %5–25 |
| cross | 19% | 12% | 18% | 23% | %10–30 (N=200 testte ~%16) |
| corner | 18% | 28% | 27% | 28% | %15–38 |
| defend | 53% | 64% | 75% | 73% | %48–75 |
| gk_save | 50% | 63% | 65% | 68% | %50–85 |
| counter_2v1 | 31% | 25% | 28% | 31% | %12–45 |
| long_ball_control | 37% | 38% | 46% | 48% | %15–60 |
| rebound | 19% | 15% | 21% | 23% | %6–40 |
| interception | 63% | 76% | 77% | 75% | %42–80 |

Ayar öncesi bu ölçümde 1v1 average %31 (N=120) / %35 (N=200) idi. Hedef ~%40.

| Sabit | Eski | Yeni | Neden |
|---|---|---|---|
| `OPP_KEEPER_REACH` (`src/game/runtime.ts`) | `KEEPER_REACH` (0.9 m) | 0.75 m | Yalnızca kahramana karşı oynayan rakip kalecinin plonjon temas uzunluğu. 1v1 average %35 → %39 (N=200). Kahraman kaleci (gk_save) ve antrenman kaleci drilleri `KEEPER_REACH`'i kullanmaya devam ediyor. Penaltı, serbest vuruş, ceza sahası önü ve korner bantları içinde kaldı. |

Denenip bırakılanlar: `ASSIST_PULL.full` 0.6 → 0.72 (1v1'de etkisiz, %31 → %31);
global `KEEPER_REACH` 0.8/0.75 (kaleci drillerinin "beceri > özensiz oyun"
testini bozuyor).

### WP-13 kontrol şemaları sonrası (Ekim 2026)

Varsayılan şemalarla (kaydır / basılı tut / Yarı nişan) N=120 normal tablo
yukarıdaki güncel ölçümle **birebir aynı** çıktı (bot girdisi değişmedi; ver-kaç
yalnızca pastan sonra ikinci dokunuşla devreye giriyor). Yeni şemalar
(sapan, salınan güç çubuğu, analog gamepad) aynı `planKick` yolunu kullanır;
güç aralığı 0–1.15 aynı kaldığı için bantlar etkilenmez.

| Ayar | Değer | Not |
|---|---|---|
| `ASSIST_REWARD` (`src/sim/match/rating.ts`) | Tam 0.8× / Yarı 1.0× / Manuel 1.25× | Etkileşimli anın **pozitif** reyting payını (ve maç XP'sini) çarpar; hatalar büyütülmez. Ayarlarda ve maç HUD'unda yazılı. |
| `ONE_TWO_WINDOW` (`src/game/runtime.ts`) | 2.2 s | Pastan sonra ikinci dokunuş penceresi; alıcı topu ilk dokunuşta koşuya geri verir (Vizyon'a göre isabet). |
| `OSC_PERIOD` (`src/game/kick.ts`) | 1.1 s | Salınan güç çubuğu (min 0.15 → max 1.15); tatlı bölge %85–100 halkada işaretli. |
| `SLING_FULL` | ekranın kısa kenarının 0.40'ı | Sapanda %100 güç için çekme uzunluğu (hızdan bağımsız). |
| Zamanlama yardımı | 1.5× | Ağır çekim ve ver-kaç pencereleri, salınan çubuk periyodu (erişilebilirlik). |

Mobil performans (4x CPU kısıtlama, 390x844 dpr3): counter ~52 fps, corner ~51 fps
(WP-13 öncesi 52 / 50).

### Bilinen açıklar

- **Savunma artık beceriye bağlı** (53 / 64 / 75 / 73). Eski ~%93 sorunu çözüldü;
  expert'in good'un biraz altında kalması örneklem gürültüsü sınırında.
- **Orta ~%12–19.** Hedef bandın (%15–25) alt ucunda; average bot ortaları
  yine çoğunlukla ilk markajcıya çarpıyor.
- **Korner ~%28.** Hedef (%20–30) içinde.
- **1v1 ~%39 (N=200).** N=120'de örneklem gürültüsü ±5 puan.
- **Tam nişan yardımı beceri farkını eziyor.** Direk dışına kaçan şutlar
  çerçeveye geri çekildiği için bot seviyeleri arasındaki fark küçük. Serbest
  vuruşta zorluk etkisi zayıf; expert seviye biraz daha az gol buluyor.

## İflas düzeltmesi (olay zincirleri ve bayrak)

Denge turundan sonra gelen özellikler (işletme, ilişki defteri, dolandırıcılık/hukuk
olayları, şöhret ölçekleri) sonrası simülasyon 30 kariyerin %17'sini (5) iflas
görüyordu: 1 savurgan, 4 "pro". `balanceSim` artık ilk iflasın ayrıntısını yazıyor
(`bankruptAt`, rapordaki `<!-- iflas: ... -->` satırları).

**Neden:**
1. Pro kariyerlerin dördü 17–18 yaşında, haftalık maaş 300–860 iken nakdi −105…−6.8K'ya
   düşürdü (bir olay/ceza/dolandırıcılık kartı mevcut nakdi aşıyordu); satacak varlık
   olmadığı için `bankruptcyGuard` bayrağı koydu. Hepsi sonra toparlandı (net servet 2–5M).
2. Bayrak yalnızca nakit hâlâ negatifken çalışan guard içinde temizleniyordu; nakit
   pozitife dönse de `bankrupt` bayrağı kalıyordu (28K nakitli "iflas etmiş" savurgan).
3. Olay etkileri (`money(-x)`) 148 kartta nakitle sınırlı değildi.

**Düzeltme (küçük, belgelenmiş):**
- `events/engine.ts` `applyDelta`: olay kaynaklı kayıp en fazla nakit + mevduat kadar
  olabilir (kart zinciri tek başına borç yaratamaz; kumarhane/alışveriş serbest kalır).
- `economy.ts`: `overdraftGrace(maaş) = max(1.5K, 3 × maaş)`; bu kadar küçük eksi bakiye
  iflas sayılmaz. Nakit ≥ 0 olunca bayrak haftalık tikte temizlenir.
- Guard zaten mevduat → yatırım → işletme → varlık sırasıyla satıyor (değişmedi).

| Metrik (30 × 10, seed 1000) | Önce | Sonra | Hedef |
|---|---|---|---|
| İflas eden kariyer | %17 (savurgan, 4 pro) | %0 | ≤ %5, yalnızca riskli persona |
| Nakdin eksiye düştüğü hafta / kariyer | 0,6 | 0,1 | - |
| OVR medyanı 21 / 26 yaş | 76 / 83 | 76 / 83 | +5–7/sezon |
| İtibar 21 / 25 / 26 yaş | 50 / 80 / 82 | 50 / 78 / 80 | 50 / 75–85 |
| 3. sezon net servet (medyan / max) | 139K / 2.5M | 139K / 2.5M | ≤ 300K / ≤ 2M* |
| 26 yaş net servet (medyan) | 12.9M | 11.1M | 5–20M |
| Haftalık olay kartı | 1,7 | 1,7 | 1,5–2,5 |

\* max değeri bu simülasyonda zaten önceki turdan beri 2.5M; bu düzeltmeyle değişmedi.

Regresyon: `balance.test.ts` (`BALANCE=1`) iflas oranı ≤ %5 ve yalnızca
kumarbaz/savurgan/parti personası; hızlı birim testler `economy.test.ts`
("bankruptcy flag hygiene") ve `events/engine.test.ts` ("event money safety net").
