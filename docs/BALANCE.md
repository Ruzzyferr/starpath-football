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
| Para | 3. sezon sonunda medyan net servet ≤ 300K, en zengin ≤ 2M (erken patlama yok). 26 yaşında medyan 5–15M; yıldız (pot ≥ 85) medyanı 8–20M, p90 ≤ 35M, en zengin ≤ 50M (Tur 3b: eskiden yıldızlar 20–48M idi, servet boşta kalıyordu). |
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

### WP-14 sonrası (Ekim 2026; normal, N=120; novice / average / good / expert)

| Tür | Oran | Not |
|---|---|---|
| penalty | 57 / 75 / 70 / 80 | Kaleci artık penaltıda çizgide kalıyor (önceden noktadaki topa doğru çıkıyordu, bu da %73'ü yapay olarak düşürüyordu). Düzeltme %80'e çıkardı; `PENALTY_READ_BASE` 0.22 → 0.36 ile N=200'de %76. |
| one_on_one | 36 / 34 / 41 / 56 | Değişmedi (örneklem gürültüsü). |
| corner | 18 / 28 / 27 / 28 | Kaleci yumruğu eklendi; korner kalecilere nadiren ulaştığı için etkisi küçük. |
| defend / interception | 53 / 64 / 75 / 73 · 63 / 76 / 77 / 75 | Bant içinde. |
| hold_up (yeni) | 37 / 62 / 80 / 95 | Başarı: pas tamam / faul / gol. Sabırlı oyuncu 2.6 s saklar ya da destek gelince bırakır. |
| defend_1v1 (yeni) | 60 / 70 / 72 / 83 | 1v1 savunma `defend`'den kolay değil ama arkada kimse yok; bant %50–85. |
| block (yeni) | 50 / 45 / 54 / 51 | Bot şut çizgisine giriyor ama beceri farkı zayıf; bant %30–65. |

| Ayar | Değer | Not |
|---|---|---|
| Hakem sertliği (`sim/match/referee.ts`) | 1..5, 3 = nötr | Sim faul ×0.8…1.2, kart ×0.6…1.55; an içi faul ×0.75…1.25. |
| `ADVANTAGE_WINDOW` / `ADVANTAGE_GAIN_M` | 2.5 s / 7 m | Avantaj: şut ya da 7 m ilerleme = devam; top kaybı ya da süre = geri çağır (faul). |
| Ceza süresi | ikinci sarı/son adam 1, sert faul 2 (sertlik 5'te 3), şiddet 3 | 5 sarı = 1 maç. NPC'ler de cezalı, kadroya giremiyor. |
| `KEEPER_LEAN` | 0.7 m × alışkanlık payı | Kaleci defteri: ≥2 deneme ve %55+ aynı üçte birlik. |
| `HEADER_RANGE` | 18 m | Kafa vuruşu taşıma sınırı. |
| `HOLD_UP_SECONDS` / `HERO_BLOCK_R` | 2.6 s / 0.62 m (kayarken 0.9) | Yeni anlar. |

Mobil performans (4x CPU, 390x844 dpr3, tek işçi): counter 55 fps, corner 54 fps.

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

## Gol dengesi (hero ve NPC golcü tutarı)

Sorun: 66–70 OVR forvet sezonda 30–39 gol atıyordu (77–82 OVR: 55+); itibarı koşturan asıl kaynak buydu.
Ölçüm: 30 kariyer × 10 sezon, sezon başına gol (medyan, tüm turnuvalar, ≥15 maç).

| Grup / OVR | Önce | Sonra | Hedef |
|---|---|---|---|
| ST 66–70 | 30 | 17 | 12–22 |
| ST 71–76 | 37 | ~26 | 18–28 |
| ST 77–82 | 55 | ~30 | 25–35 |
| Kanat/AM 77–82 | 27 | 13 | 10–18 |
| Orta saha 77–82 | 12 | 8 | 6–12 |
| NPC gol kralı, 1. kademe | 31 | 27 | 18–30 |
| NPC gol kralı, 3. kademe | 22 | 20 | 18–25 |
| Medyan itibar, 25 yaş | 83 | 73 | 75–85 |

Değişiklikler (oyun içi atış oranlarına dokunulmadı; sayı ve karışım ayarlandı):
- `highlightGen.ts`: hücum pozisyonlarında an sayısı (ST 7→6, kanat 6,5→5,8, AM 6,5→6) ve karışım (daha çok pas/ön libero/top tutma, daha az vuruş anı); OVR 68 üstünde "sıkılaşan savunma" (`kindWeights(pos, ovr)`, an sayısı ×(1−0,2·t), vuruş anları ×(1−0,6·t)); aynı maçta 1+ golden sonra vuruş anları ×0,78, 2+ golden sonra ×0,5.
- `quickSim.ts`: NPC golcü ağırlığı ST 5→3,4, kanat/AM 3→2,8 (gol kralı gerçekçi aralığa indi).
- `matchOutcome.ts` (itibar telafisi): gol 0,3→0,45, asist 0,2→0,25, `MATCH_REP_SCALE` 0,62→0,72; itibar eğrisi 18 yaş 15, 21 yaş ~48 kaldı, 25 yaş 71–73 (hedef alt sınırına yakın).
- Rapor: `balance.test.ts` artık pozisyon × OVR bandı gol tablosunu ve kademeye göre NPC gol kralını basıyor.
- Not: kumarhane payı (kumarbaz) bu ölçümlerde tohum gürültüsüyle 28–56% arasında oynuyor (5 kumarbaz); golden.json bilinçli olarak yenilendi.

## Kumarhane payı ayarı (casino spending share)

Sorun: kumarhane payı bütün kariyerlerde %5-12, kumarbaz personada %28-56 arasında sallanıyordu (hedef: genel <=%5, kumarbaz <=%30). Neden: bahis büyüklüğü zenginliğe göre değil bot kasasının %1-5'iyle 250K tavanına kadar ölçekleniyordu, yani gelirden bağımsız hacim; ev avantajı hacimle çarpılınca zengin kariyerlerde haftalık gelirin büyük kısmı masaya gidiyordu.

Çözüm (sim/life/casino.ts `maxStakeFor`, `canBet`): masa limiti tek bahis için kasanın %1,5'i (taban 500). Tüm oyunlar `canBet` kapısından geçtiği için oyuncu ve bot aynı kuralı görür; limit aşıldığında "Masa limiti" mesajı çıkar. Kumarhane düşük kasalarda (taban 500) ve sürekli oyunda hâlâ anlamlıdır; yalnızca tek elde servet riske atmak engellenir.

Sonuç (BALANCE=1, 30 kariyer x 10 sezon): tohum 1000'de kumarbaz payı %40 -> %9, genel %7 -> %1. İkinci tohum (2024): kumarbaz %2, genel %0 (hedefler tutuyor).

## İtibar telafisi: gol dışı kaynaklar (S21)

Sorun: gol dengesinden sonra 25 yaşında medyan itibar 71–73 (hedef 75–85). Gollere dokunmadan, oturmuş oyunculara yarayan kaynak eklendi.
Ölçüm: 30 kariyer × 10 sezon (`BALANCE=1`), medyan itibar.

| Yaş | Önce | Sonra | Hedef |
|---|---|---|---|
| 18 | 16 | 15 | ~15 |
| 21 | 49 | 52 | ~50 |
| 25 | 73 | 79 | 75–85 |
| 26 | 76 | 83 | - |

Değişiklik: `sim/career/reputation.ts` `seasonStandingFame`, sezon sonunda (`sim/game/season.ts` endSeasonForHero) `fameGain` ile (azalan getiri):
- İstikrar: ≥12 maç, ortalama reyting 6,6 üstü her 0,1 için 0,6 (en çok 4).
- Maçın adamı: ilk 12 MOTM için 0,22.
- Sahne: lig kademesi (1: ×1, 2: ×0,5, 3: ×0,28, 4+: ×0,18) × kulüp itibarı ((itibar−60)/20, 0,1–1,8), kıtasal kupa +1,5.
Lig 3. kademede genç oyuncu çok az kazanıyor, büyük kulüpte düzenli oynayan çok; 18/21 eğrisi yerinde kaldı.

Aynı koşuda diğer hedefler: gol kralı (NPC) 1. kademe 27, ST 71–76 25, 77–82 30 (66–70 grubu n=4, 24); sezonda 1,3 sakatlık / 2,9 hafta (alt sınırda, 2.3#55 gün bazlı süreler); 3. sezon net servet medyanı 185K; ilk elit kulüp 23,0 yaş. S21 an tipleri (`dribble`, `header`) otomatik çözümde gol oranı 0,04 / 0,09 ile gol tablosunu taşımayacak şekilde ayarlandı.


## Dünya enflasyonu, sakatlık ve golcü izlemesi (2.6 süpürmesi)

**Dünya enflasyonu (yeni).** 100 sezonluk dünya koşusunda kulüp oyuncularının ortalama OVR'si 65,1'den 76'ya çıkıyordu (~+0,1 / sezon): akademi gençleri takım ortalamasının 20 puan altından değil, ilk 11 ortalamasına göre `-20` ile başlayıp tavan potansiyele gidiyor, geri besleme oluşuyordu. Düzeltme: gençlik OVR'si `seviye - 24` (eskiden `-20`), `sim/world/anchor.ts` ayrıca ortalamayı başlangıç ortalamasına bağlayan hafif bir yaylı ayar (±0,25 ölü bant, yaş ≥ 22, hem OVR hem potansiyel ±1). Sonuç: 50 sezonda 65,1 → 65,1; nüfus ±%5 bandında (`longRun.test.ts`, `LONGRUN=1` ile 100 sezon).

**Sakatlık.** Gün bazlı sürelere geçişten sonra sezonda 1,3 / 2,9 hafta ölçülüyordu (hedef 3–6). Ayar: maçta ciddiyet ağırlıkları `[0.55,0.35,0.10]` → `[0.40,0.42,0.18]`, antrenmanda `[0.70,0.25,0.05]` → `[0.60,0.30,0.10]`, `AUTO_INJURY_CHANCE` 0,004 → 0,0054. Süre bantları (3–10 gün / 2–6 hafta / 2–9 ay) aynı kaldı (test sabit).

| Ölçüt | Önce | Sonra (tohum 1000 / 2000) | Hedef |
|---|---|---|---|
| Sezonda sakatlık / sakat hafta | 1,3 / 2,9 | 1,6 / 4,1 ve 1,4 / 3,4 | 1–2 / 3–6 |

**Forvet 66–70 OVR gol.** Önceki 24 gol n=4 örneklemdi. İki tohumla yeniden ölçüldü: ST 66–70 medyan 16 (n=4) ve 15 (n=6), hedef 12–22 içinde; **gol ağırlıklarına dokunulmadı.** NPC gol kralı 1. kademe 27–28, 3. kademe 20–21 (hedef 18–30 / 18–25).

## Geç oyun parası, işletme kararları ve kumarhane bedeli (WP-E içerik v1.1)

**Para yutucuları** (`sim/life/projects.ts`, hepsi `weeklyEconomy` içinden): akademi 3 aşama (1,5 / 3 / 6 M; bakım 2 / 5,5 / 12 K hafta), hayır stadyumu 2 aşama (1,2 / 3,5 M; bakım 1,8 / 6 K), kulüp hissesi %25'e kadar (%1 = 400 K, yıllık %7 temettü, satışta %90), miras fonu (yıllık %3,5; Legacy çocuğuna payın %25'i, **en çok 350 K**, yani çocuk yine milyoner başlamaz). Koleksiyon eşyaları (8 adet, `collector`) değer kazanır, Hall of Fame puanına 3 × (tavan 12) ekler. Hepsi net servete girer (fon + hisse).

**İşletme:** 16 karar kartı (genişleme, müdür, pazarlama, kriz × 3 tür + 4 genel). Seçim haftalık K/Z'ye `boost` (gelir çarpanı, N hafta), müdür ve seviye üzerinden girer.

**Kumarhane bedeli** (`casinoCareerCost`, bağımlılık ≥ 30): haftalık mutluluk −1,5, form −1…−3, 40+ disiplin ve yakınlarla ilişki, 55+ stres ve basın; VIP kademe 2+ ×1,25; günlükte tek satırla gösterilir. VIP kademeleri (toplam bahis 150 K / 1,5 M / 12 M) masa limitini %1,5'ten kademe başına +%0,2 yükseltir (VIP salonu +%0,2). `balanceSim` gambler bahsini artık masa limitine göre boyutlandırıyor (önce bahisler reddediliyordu, bu yüzden pay %5–6 görünüyordu).

| Ölçüt (kumarbaz personası, 8 sezon, 10 / 10 / 6 kumarbaz) | Önce (Tur 2) | Sonra | Hedef |
|---|---|---|---|
| Kumarhane payı (harcamanın %'si), tohum 1000 / 2024 / 3000 | %5–6 | %24 / %33 / %10 (ort. ~%22) | %15–35 |
| Genel pay (kumarbaz harcaması toplamın ~%17'si) | ~%1 | ~%1,4–5 | ≤ %5 |

Tohum gürültüsü büyük (bir büyük kazanç payı 10 puan oynatıyor); ölçüm `BALANCE=1 npx vitest run src/sim/game/balance.test.ts` ile de tekrarlanmalı. **Golden master bilinçli yenilenmedi** (dünya arması kara listesi dünya karmasını değiştirdi, bahis boyutu ve yeni kartlar kariyer akışını); lider yeniler.


## WP-B denge turu v1.1 (Ekim 2026): dünya üst kuyruğu ve yıldız gol hacmi

Playtest Tur 2'nin iki açık maddesi kapatıldı. Ölçümler: dünya için `WORLD_REPORT=1` (`sim/world/worldReport.test.ts`, TR+EN, 2 tohum × 100 sezon); kariyer için `BALANCE=1`, 30 kariyer × 10 sezon (tohum 1000 ve 2000) ve 12 kariyer × 18 sezon (17–34 yaş, tohum 3000). "Önce" değerleri HEAD'in ayrı bir çalışma ağacından alındı.

**1. Dünya üst kuyruğu.** Ortalama çapası (`anchor.ts`) ortalamayı tutuyordu ama dağılım geriliyordu. Gençlik alımı ve geniş potansiyel aralığı tepeyi şişiriyor, ortalama çapası da bunu alttaki oyunculardan telafi ediyordu. Çözüm: dünya ilk ölçümde kulüp oyuncularının OVR dağılımını %0,5 aralıklı 201 noktalık bir nicelik tablosu olarak kaydeder (`world.abilityShape`, `endOfSeason` başında `recordAbilityReference`). Her sezon sonunda oyuncular sıralanır. Sırasındaki niceliğe göre ±1 bandının dışında kalan oyuncu ona doğru 1–3 puan çekilir; potansiyeli de birlikte çekilir, yoksa oyuncu bir sonraki sezon yeniden büyür. Bant dışında 1 puandan az kalanlarda bu %60 olasılıkla, daha uzaktakilerde her zaman olur. Sıralama değişmez: oyuncu hâlâ başkalarını geçerek yükselir, yalnızca dünya "uzamaz". Eski ortalama bandı (±0,25) ikinci kat olarak kaldı. Eski kayıtlar ilk sezon sonunda o anki dağılımı kaydeder.

| Ölçüt (kulüp oyuncusu OVR) | Başlangıç | Önce: 10 / 100. sezon (tohum 9 · 31) | Sonra: 10 / 100. sezon (tohum 9 · 31) | Hedef |
|---|---|---|---|---|
| Ortalama | 65,3 · 65,3 | 64,3 / 65,2 · 63,6 / 65,0 | 65,2 / 65,2 · 65,0 / 65,0 | ±2 |
| p05 | 47 · 47 | 41 / 41 · 41 / 41 | 46 / 46 · 46 / 46 | - |
| p95 | 82 · 81 | 88 / 90 · 87 / 91 | 83 / 83 · 83 / 83 | ±2 |
| p99 | 86 · 87 | 94 / 95 · 94 / 95 | 87 / 87 · 89 / 88 | ±2 |
| İlk 20 ortalaması | 88,7 · 88,8 | 94,6 / 95,0 · 94,8 / 95,0 | 90,0 / 89,8 · 90,7 / 90,3 | ±2 |
| Max | 92 · 92 | 95 / 95 · 95 / 95 (tavan) | 94 / 94 · 93 / 94 | ±2 |

100 sezon boyunca en yüksek değerler: p95 83, p99 89, ilk 20 ortalaması 90,7, max 94. `longRun.test.ts` artık p95 kaymasını ≤2, ilk 20 ortalamasını ≤2,5 ve max'ı ≤2 ile sınırlıyor (varsayılan 50 sezon, `LONGRUN=1` ile 100). `anchor.test.ts` gerilmiş bir tepenin 4 sezonda geri çekildiğini doğrular.

**2. Yıldız gol hacmi.** Playtest'te 459 maçta 407 gol (0,89/maç) çıkmıştı. Gerçek elit karşılaştırma: kariyer ortalaması ~0,6–0,8, zirve sezonu ~1,0–1,3. Mevcut "sıkılaşan savunma" (OVR 68→84) 84'te doyuyordu. İkinci kademe olarak `highlightGen.ts` `eliteMarking` eklendi: OVR 74'ten 88'e vuruş anı ağırlıkları ×(1−0,5·e), an sayısı ×(1−0,1·e). Yıldız adam adama markaj ve ikili savunma görür. An başına olasılıklar değişmedi, yalnızca temiz fırsat sayısı azaldı. Rapor artık 83–87 / 88+ bantlarını ve kariyer boyu maç başına golü basıyor.

| Ölçüt | Önce (1000 · 2000 · uzun) | Sonra (1000 · 2000 · uzun) | Hedef |
|---|---|---|---|
| ST kariyer gol/maç (medyan) | 0,78 · 0,89 · 0,91 | 0,72 · 0,79 · 0,86 | ~0,6–0,8 |
| ST en iyi sezon gol/maç (medyan) | 1,22 · 1,22 · 1,30 | 1,17 · 1,14 · 1,25 | ~1,0–1,3 |
| ST 66–70 sezonluk gol | 16 · 20 | 17 · 17 | 12–22 |
| ST 71–76 | 27 · 23 | 28 · 28 | 18–28 |
| ST 77–82 | 24 · 29 | 25 · 27 | 25–35 |
| NPC gol kralı, 1. kademe | 27 · 28 | 26 · 27 | 18–30 |
| İtibar 18 / 21 / 25 yaş | 13/44/73 · 14/51/75 | 15/48/76 · 16/50/81 | ~15 / ~50 / 75–85 |
| Sakatlık / sakat hafta (sezon) | 1,6/3,8 · 1,5/3,7 | 1,6/4,0 · 1,5/3,6 | 1–2 / 3–6 |
| 3. sezon net servet medyan / max | 132K/1,5M · 146K/1,8M | 142K/1,9M · 190K/1,8M | ≤300K / ≤2M |
| İlk elit kulüp yaşı (ulaşan %) | 24,0 (%57) · 23,0 (%60) | 22,0 (%77) · 22,0 (%83) | 22–24 |

Uzun koşuda (18 sezon) ST örneklemi küçük (n=2), bu yüzden "uzun" sütunu yalnızca yön gösterir. İtibar 25 yaşta yükseldi (73–75'ten 76–81'e). Bunun nedeni dünyanın tepesinin artık kaçmaması: kahramanın 85–88 zirvesi göreli olarak yeniden "yıldız". Kumarhane payı (kumarbaz %29–33) içerik/ekonomi paketinin alanı.

**WP-B satır kararları.** 2.1#6 TAMAM (12% testi `sim21.test.ts`, dik tepki bilinçli). 2.5#125 TAMAM (gecelik iş: denge tablosu + dünya raporu + 100 sezon adımı, özet çalıştırma sayfasında). 2.3#3 ve 2.3#13 ertelendi; sapma önerisi ve gerekçe GAP-AUDIT'te. 2.4#4, 2.5#15/#18/#24/#60 ve kumarhane satırları (2.5#92/#99/#102) `sim/life/**` içinde ve bu turda içerik/ekonomi paketinde.

**Golden master.** `sim/golden.test.ts` bu değişikliklerle (dünya çapası rng tüketimi, an ağırlıkları) bilinçli olarak kırmızı. Yenileme baş mühendiste.

**Gecelik drift tabanı (`statsBaseline.json`) yenilendi.** Eski tabana göre tolerans içinde kaldı ama merkez bilinçli olarak kaydı, bu yüzden taban yeni değerlere çekildi (40 kariyer × 10 sezon): itibar (son) 76,5 → 81, net servet log10 6,89 → 7,07, kupa (son) 1,85 → 2,35, sezon başına gol 9,0 → 8,3, sakat hafta 3,27 → 3,89. OVR S3/S6/son 68/78/82 → 67,5/78/82; iflas 0.

## Playtest Tur 3 denge notu (Ekim 2026)

Ayrıntı: `docs/PLAYTEST-REPORT.md` Tur 3. Sonuçları değiştiren sim kararları şunlar:

- **"Adam adama markaj" forma bağlandı** (`sim/game/match.ts` `markedMan`). Maç başına 0,8 golün üstündeki seri (bu sezon; sezonun ilk 15 maçında geçen sezonla harmanlanıyor) highlight üretiminde OVR markajıyla aynı freni uyguluyor. Fren 1,3 gol/maçta tam (`kindWeights`, `plannedHighlightCount`, `marked`). İnsan gibi oynanan 75 OVR'lik forvet 0,99'dan 0,74 gol/maça indi. BALANCE ST kariyer medyanı 0,73 · 0,70 (tohum 1000 · 2000).
- **Takım arkadaşı mizaç tabanı** (`sim/life/relationships.ts`). İlişki her hafta kişilik tabanına %4 çekiliyor (kinde %2). `relationAvg`'nin highlight sayısına katkısı doygun +1,3'ten +0,6 civarına indi.
- **Takipçi tavanı:** Maçın orantılı takipçi artışı ün tavanına kalan boşlukla çarpılıyor; tavan üstü fazla haftada %8 eriyor. Sponsor değeri log ölçekli olduğu için para etkilenmedi.
- **Legacy fon tavanı** 350K'dan 120K'ya indi; fon her 1M için +1 miras puanı veriyor (en çok +10).
- **Kumarhane:** 6 haftalık manşet aralığı; VIP ikramı haftada bir.

| Ölçüt (son kod, tohum 1000 · 2000) | Değer | Hedef |
|---|---|---|
| İtibar 18 / 21 / 25 | 12/51/75 · 13/46/79 | ~15 / ~50 / 75–85 |
| İlk 1. kademe / elit kulüp yaşı | 21,0 · 20,0 / 23,0 · 22,0 | 21–23 / 22–24 |
| 3. sezon net servet medyan / max | 135K/746K · 143K/719K | ≤300K / ≤2M |
| ST gol/maç kariyer / en iyi sezon | 0,73/1,10 · 0,70/0,96 | ~0,6–0,8 / ~1,0–1,3 |
| ST sezonluk gol 71–76 / 77–82 | 23/24 · 22/25 | 18–28 / 25–35 |
| Kumarhane payı kumarbaz / herkes | %12/%2 · %23/%2 | %15–35 / ≤%5 |
| Kart/hafta, sakatlık/sezon, sakat hafta | 1,7/1,4/3,5 · 1,8/1,5/3,7 | 1,5–2,5 / 1–2 / 3–6 |

Tohum gürültüsü: Tohum 1000'de kumarbaz payı, bu turdaki ara ölçümlerde değişiklik zinciri boyunca %12 ile %22 arasında oynadı. Tohum 2000'de 1. kademe yaşı 20,0 ile 20,5 arasında oynadı. Ölçütler iki tohumun ortalamasında hedefte.

`STATS_GUARD=1` (40 × 10) tolerans içinde kaldı; `statsBaseline.json` yeniden merkezlenmedi. **Golden master bilinçli olarak `UPDATE_GOLDEN=1` ile yenilendi** (aynı commit).

## Tur 3b: tepe gelir ve çoğunluk hissesi

**Sorun.** 26 yaşındaki yıldızın (pot ≥ 85) net servet medyanı 20,3M / 28,6M'ydi (tohum 1000 / 2000), p90 27–32M; harcayacak yer yoktu. İki hamle yapıldı:

1. **Daha büyük hedef: çoğunluk hissesi.** Kulüp hissesi tavanı %25'ten %75'e çıktı (fiyat doğrusal, %1 = 400K; %51 ≈ 20,4M). %51 ve üstü kulüp sahibi/başkan demek: temettü %7'den %9'a, Onur Listesi'ne +45 puan, "en iyi anlar"da sahiplik satırı, emeklilikte başkanlık epilogu (`summary.owner`) ve Legacy çocuğuna +2 itibar.
2. **Tepe gelir frenlendi.** `economy.ts`: haftalık brüt (maaş + sponsor) için ülke vergisine ek dilimler (120K üstü %10, 300K üstü %20, yalnızca dilimin üzerine) ve maaşın 80K üstü kısmına %6 yaşam tarzı gideri. Haftalık brütü 120K altındaki erken ve orta kariyer etkilenmez.

| Ölçüt (30 × 10, 26 yaş) | Önce (s1000 / s2000) | Sonra (s1000 / s2000) | Hedef |
|---|---|---|---|
| Net servet medyan | 8,4M / 9,5M | 7,5M / 10,0M | 5–15M |
| Net servet pot ≥ 85 medyan | 20,3M / 28,6M | 14,4M / 17,1M | 8–20M |
| Net servet p90 / max | 26,7M / 38,6M ; 32,1M / 39,9M | 19,2M / 30,3M ; 24,2M / 50,2M | p90 ≤ 35M |
| 3. sezon medyan / max | 120K / 834K ; 165K / 1,1M | aynı | ≤ 300K / ≤ 2M |
| İflas | %0 / %0 | %0 / %0 | ≤ %5 |
| Kumarbaz kumarhane payı | %27 / %20 | %16 / %18 | ≤ %30 |

`statsBaseline.json` yalnızca bilinçli kaymada yeniden merkezlendi: `netWorthLog` 7,07 → 6,885 (STATS_GUARD 40 × 10: itibar 81 → 80, kupa 2,35 → 1,9, gol 8,3 → 8,1 tolerans içinde, dokunulmadı). Rapora "Net servet (pot ≥ 85 medyan)" sütunu eklendi. **Golden master bilinçli yenilendi** (`UPDATE_GOLDEN=1`, aynı commit): yeni hedef havuzları, kartlar, vergi dilimleri ve pas ağı kaydı kariyer akışını değiştirdi.

## Mevki rolleri (APK geri bildirimi, save v5)

Konumdan bağımsız arketipler (Golcü, Kanat Motoru, Duvar…) kaldırıldı; her mevki kendi rollerini sunuyor
(`core/roles.ts`): kaleci 3, bek 3, stoper 3, DM/CM 3, AM 2, kanat 4, forvet 3 rol. Rol şablonları
(`createHero.ROLE_TEMPLATES`) güçlü/zayıf yanları belirliyor; `roleTemplate` güçlü yanları ölçekleyerek aynı
mevkideki her rolün başlangıç OVR'sini eşitliyor (`ROLE_OVR_GAIN`, eski eşleşen arketipin kazancı). Maçta rol,
mevkinin an karışımını yeniden şekillendiriyor (`highlightGen.ROLE_KIND_MULT`); şut payı `ROLE_SHOT_SHARE` ile
ayarlandı, böylece hücum rollerinin an başına gol beklentisi mevki karışımının ±%8'i içinde (`roles.test`).
Sarkan forvetin 1v1/kontra şansları en iyi dönüştüğü için daha az ama daha net şans alıyor (0,83).
Boy (`hero.heightCm`, rolün varsayılanı ±5 cm) maçta kafa/sıçramaya −4..+4 ekliyor.

| Ölçüt (son kod, tohum 1000 · 2000) | Değer | Hedef |
|---|---|---|
| İtibar 18 / 21 / 25 | 14/49/78 · 15/51/79 | ~15 / ~50 / 75–85 |
| İlk 1. kademe / elit kulüp yaşı | 20,5 · 20,0 / 22,0 · 23,0 | 21–23 / 22–24 |
| 3. sezon net servet medyan / max | 135K/861K · 137K/502K | ≤300K / ≤2M |
| ST gol/maç kariyer / en iyi sezon | 0,72/1,00 · 0,76/1,06 | ~0,6–0,8 / ~1,0–1,3 |
| ST sezonluk gol 71–76 / 77–82 | 21/26 · 19/29 | 18–28 / 25–35 |
| Kumarhane payı kumarbaz / herkes | %25/%4 · %20/%2 | %15–35 / ≤%5 |
| Kart/hafta, sakatlık/sezon, sakat hafta | 1,8/1,6/3,8 · 1,7/1,6/4,1 | 1,5–2,5 / 1–2 / 3–6 |

**Golden master bilinçli olarak `UPDATE_GOLDEN=1` ile yenilendi** (aynı commit): rol şablonları başlangıç
özelliklerini, rol karışımı ve boy maç sonuçlarını değiştiriyor.

## Rol denge yaması (save v6, Ekim 2026)

Sahibin cihaz testindeki geri bildirimi: rol ekranında yalnızca ok çipi olarak görünen, ama numaralı özellik
listesinde olmayan istatistikler vardı; bir rol "Önerilen" etiketiyle doğru seçim gibi duruyordu; başlangıç yaşı
16–18 ile sınırlıydı. Bu yama üçünü birlikte çözer.

### Yeni özellikler (save v6, `MIGRATIONS[5]`)

Her rolün ve her çipin konuştuğu her istatistik artık gerçek, numaralı bir özellik: sihirbaz önizlemesinde ve
Profil listesinde görünür, antrenmanla gelişir, yaşla düşer, hem arka plan simülasyonunda hem oynanan anda etkisi
vardır. Yedi yeni özellik (toplam 30, dört grup):

| Grup | Özellikler (yeniler kalın) |
|---|---|
| Fiziksel | Hız (tam sürat), **Hızlanma**, Dayanıklılık, Güç, **Denge**, Çeviklik, Zıplama |
| Teknik | Pas, **Uzun Pas**, Orta, Dribbling, İlk Dokunuş, Şut Gücü, Bitiricilik, **Falso**, Kafa, Top Kapma, Duran Top |
| Zihinsel | Vizyon, Soğukkanlılık, Pozisyon Alma, **Önsezi**, **Agresiflik**, Liderlik, Çalışkanlık |
| Kaleci | Refleks, **Plonjon**, Top Tutma, Pozisyon (Kaleci), Oyun Kurma (Kaleci) |

| Yeni özellik | Simülasyon (sim/match) | Oynanan an (game/) | Antrenman |
|---|---|---|---|
| Hızlanma | savunma/hücum birim karışımı; kontra, 1v1, dribbling, savunma 1v1, kaleci süpürme | `model.accel` (ilk adımlar), take-on şansı | Kondisyon, Top Sürme |
| Uzun Pas | orta saha birimi, kaleci oyun kurma; arka plan pas isabeti | 20 m üstü pas, ara pas, havadan pas, uzaklaştırma (`kickSkill`) | Pas, Orta, Çıkış |
| Falso | uzaktan şut, frikik, korner becerisi; kenar/frikik/korner anları | `curlCap`, `maxSpin`, frikik ve orta isabeti | Duran Top, Orta, Şut |
| Önsezi | savunma birimi; pas arası, seken top, arka direk, baraj | pas arası okuma (`runtime`), forvetin ofsayta düşmeden koşusu, take-on savunması | Taktik, Top Kapma |
| Agresiflik | savunma birimi; arka plan top kazanma; NPC faul seçimi; savunma anlarında faul payı (`aggressionFoulMult`) | AI müdahale sıklığı, müdahale gücü ve faul riski (`tackleOdds`) | Top Kapma, Kafa |
| Plonjon | kaleci birimi; kurtarış ve penaltı anları | dalış hızı (`diveSpeed`), parmak ucu kurtarışlar (`saveChance`) | Kaleci |
| Denge | savunma birimi; hold-up, kafa, korner, arka direk, dribbling | omuz omuza müdahaleye direnç (`tackleOdds`), hava topu düellosu ağırlığı | Kondisyon, Top Sürme, Kafa |

Göç: v5 kayıtlar yedi değeri eski sayfadan türetir (dondurulmuş `deriveAttrsV6`; ör. Hızlanma = 0,6 Hız + 0,4
Çeviklik, Denge = 0,5 Güç + 0,3 Çeviklik + 0,2 Soğukkanlılık); özellik geçmişi her satırı kendi değerlerinden
genişletir. NPC'ler `deriveAttributes` ile türetilir (pozisyon şablonları ve "flavour"lar yeni özellikleri içerir).
OVR ağırlıkları yeni özellikleri mevki önemine göre içerir. Her oturum ve maç XP'sini daha çok özelliğe yaydığı için
puan maliyeti `XP_COST_SCALE = 0,8` ile ölçeklendi (aşağıdaki BALANCE satırları bu ayarla). "Şut" etiketi
"Şut Gücü" oldu (Bitiricilik'ten ayrışsın diye); her özelliğin açıklaması Sözlük'te (Oyuncu kategorisi).

### Rol tanımları: 4 artı / 4 eksi

Futbol içinden bir arkadaşın rol tanımı esas alındı (her rol tam 4 güçlü, 4 zayıf yan). Hangi özelliğin artı/eksi
olduğu tanımdan; miktarı `createHero.roleTemplate` belirler: eksi 8 puan, mevkinin en önemli özelliğinde %30'una
kadar azalır (zayıf yan gerçek ama mevkinin çekirdeğini çökertmez); OVR'ye sayılan artılar her rol aynı başlangıç
OVR'sine ulaşacak şekilde ölçeklenir (en çok ×2,4); artıları mevkinin OVR çekirdeği dışında kalan roller (ör. Libero
Kaleci) eksik kalan kazancı mevkinin diğer özelliklerine eşit dağıtır ("diğer yerlerde sağlam", en çok +24).
Sihirbaz kartında 8 çip, önizlemede 8 numaralı satır (rolsüz mevki sayfasına göre farkıyla) gösterilir.

| Mevki | Rol | Etiket | + | − |
|---|---|---|---|---|
| KL | Refleks Kalecisi | Refleks odaklı | Top Tutma, Çeviklik, Refleks, Soğukkanlılık | Pas, Oyun Kurma (K), Zıplama, Güç |
| KL | Kurtarış Ustası | Hava hakimiyeti | Top Tutma, Zıplama, Çeviklik, Oyun Kurma (K) | Pas, Güç, Soğukkanlılık, Pozisyon (K) |
| KL | Libero Kaleci | Oyun zekâsı | Pas, Oyun Kurma (K), Çeviklik, Güç | Refleks, Top Tutma, Zıplama, Soğukkanlılık |
| Bek | Dengeli Bek | Fizik odaklı | Pozisyon Alma, Güç, Top Kapma, Orta | Dayanıklılık, Dribbling, Çeviklik, Hız |
| Bek | Hücumcu Bek | Hız odaklı | Güç, Hız, Orta, Dribbling | Dayanıklılık, Çeviklik, Top Kapma, Pozisyon Alma |
| Bek | Defansif Bek | Savunma odaklı | Top Kapma, Dayanıklılık, Çeviklik, Pozisyon Alma | Güç, Hız, Orta, Dribbling |
| STP | Agresif Stoper | Fizik odaklı | Hız, Güç, Top Kapma, Pas | Zıplama, Vizyon, Soğukkanlılık, Denge |
| STP | Hava Hakimi | Hava hakimiyeti | Denge, Zıplama, Soğukkanlılık, Güç | Hız, Top Kapma, Pas, Vizyon |
| STP | Oyun Kurucu Stoper | Teknik odaklı | Vizyon, Pas, Soğukkanlılık, Denge | Zıplama, Top Kapma, Güç, Hız |
| OS | Oyun Kurucu | Oyun zekâsı | Pas, Vizyon, Duran Top, İlk Dokunuş | Dayanıklılık, Şut, Çalışkanlık, Dribbling |
| OS | Box-to-Box | Dayanıklılık odaklı | Dayanıklılık, Pas, Çalışkanlık, Vizyon | Dribbling, Şut, Duran Top, İlk Dokunuş |
| OS | Ön Libero | Savunma odaklı | Çalışkanlık, Pas, Top Kapma, Dayanıklılık | Vizyon, Şut, Dribbling, Duran Top |
| Kanat | Çizgi Kanadı | Hız odaklı | Hız, Şut, Orta, Dribbling | Pas, Vizyon, Kafa, Bitiricilik |
| Kanat | Ters Kanat | Teknik odaklı | Pas, Bitiricilik, İlk Dokunuş, Vizyon | Şut, Orta, Hız, Dribbling |
| Kanat | Serbest Kanat | Oyun zekâsı | Vizyon, Pas, İlk Dokunuş, Çeviklik | Dribbling, Çalışkanlık, Top Kapma, Kafa |
| Kanat | Teknik Çalımcı | Yetenek odaklı | İlk Dokunuş, Dribbling, Hız, Pas | Güç, Kafa, Zıplama, Orta |
| SNT | Derinlik Forveti | Hız odaklı | Hız, İlk Dokunuş, Bitiricilik, Pozisyon Alma | Güç, Zıplama, Pas, Kafa |
| SNT | Hedef Forvet | Fizik odaklı | İlk Dokunuş, Güç, Zıplama, Pozisyon Alma | Hız, Bitiricilik, Pas, Kafa |
| SNT | Pivot Santrfor | Hava hakimiyeti | Güç, Zıplama, Bitiricilik, Kafa | Pas, Pozisyon Alma, Hız, İlk Dokunuş |

"Önerilen" rozeti kaldırıldı (kartlarda ve "Önerilen yetenek" yazısında); her kart nötr bir oyun tarzı etiketi taşır.
AM'de iki rol (Oyun Kurucu, Box-to-Box) kaldı: ikisi de aşağıdaki bantta.

### Ölçüm (`sim/game/roleBalance.ts`, `ROLE_BALANCE=1`)

Her rol, kendi başlangıç şablonu ortak OVR 68'e taşınarak ölçülür (aynı genel güç, farklı şekil): 300 maçlık arka
plan simülasyonu (anlar otomatik çözülür), rolün kendi an karışımından 300 an (ortalama bot, normal zorluk; tahmini
maç reytingi = 6,0 + 6 × an başına reyting değişimi) ve rol başına 10 otomatik kariyer × 8 sezon. Δ = mevki
ortalamasına göre fark; hedef ±%5. Ayarlar (`highlightGen.ROLE_KIND_MULT` / `ROLE_SHOT_SHARE`): Derinlik
Forveti 1v1 2,0 → 1,7; Pivot şut payı 1,0 → 1,05; Oyun Kurucu build-up 1,7 → 1,5 ve şut payı 0,9 → 0,86; Hava
Hakimi şut payı 1,1 → 1,25, pas arası 0,75 → 0,9, savunma 1,1 → 1,15; Oyun Kurucu Stoper build-up 2,6 → 2,0;
Çizgi Kanadı / Teknik Çalımcı / Ters Kanat şut payı 1,06 / 1,05 / 0,93. İtibar eğrisi için `MATCH_REP_SCALE`
0,72 → 0,76.

| Mevki | Rol | Maç reytingi (sim) | Δ | G+A / maç | Savunma / maç | Oynanan maç reytingi | Δ | Kariyer son OVR | Δ | Son itibar | Δ | Kariyer reytingi | Δ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GK | reflexKeeper | 6.72 | +1.3% | 0.00 | 4.27 | 5.56 | −0.7% | 81.3 | −1.1% | 86 | +2.0% | 7.29 | +1.9% |
| GK | shotStopper | 6.46 | −2.6% | 0.00 | 4.00 | 5.52 | −1.4% | 82.4 | +0.3% | 84 | −0.2% | 7.08 | −1.1% |
| GK | sweeperKeeper | 6.72 | +1.3% | 0.00 | 3.65 | 5.72 | +2.1% | 82.9 | +0.9% | 83 | −1.8% | 7.10 | −0.8% |
| CB | stopper | 6.36 | +0.2% | 0.10 | 3.85 | 6.35 | +3.8% | 76.9 | −1.2% | 55 | −0.3% | 6.45 | +1.6% |
| CB | aerialDefender | 6.22 | −2.0% | 0.19 | 3.66 | 6.02 | −1.6% | 78.3 | +0.5% | 56 | +0.5% | 6.20 | −2.3% |
| CB | ballPlayingDefender | 6.47 | +1.8% | 0.21 | 3.79 | 5.98 | −2.2% | 78.5 | +0.8% | 55 | −0.3% | 6.39 | +0.7% |
| LB | balancedFullBack | 6.56 | +2.5% | 0.35 | 3.40 | 6.24 | +1.6% | 78.6 | +0.0% | 53 | +0.4% | 6.32 | +0.4% |
| LB | attackingFullBack | 6.35 | −0.8% | 0.46 | 2.75 | 6.13 | −0.3% | 79.3 | +0.9% | 51 | −3.4% | 6.29 | −0.1% |
| LB | defensiveFullBack | 6.29 | −1.7% | 0.23 | 3.71 | 6.07 | −1.2% | 77.8 | −0.9% | 54 | +3.1% | 6.28 | −0.2% |
| DM | anchor | 6.27 | −2.4% | 0.19 | 3.41 | 6.20 | +3.7% | 81.3 | +0.7% | 63 | −3.7% | 6.48 | −0.7% |
| DM | boxToBox | 6.31 | −1.9% | 0.30 | 2.83 | 5.90 | −1.3% | 80.4 | −0.4% | 64 | −2.9% | 6.44 | −1.4% |
| DM | playmaker | 6.70 | +4.3% | 0.42 | 2.80 | 5.83 | −2.5% | 80.6 | −0.2% | 70 | +6.6% | 6.66 | +2.0% |
| CM | boxToBox | 6.54 | −1.7% | 0.48 | 0.56 | 6.20 | +1.6% | 78.8 | +0.4% | 66 | −0.5% | 6.49 | −0.8% |
| CM | anchor | 6.64 | −0.3% | 0.43 | 1.03 | 6.09 | −0.2% | 79.8 | +1.6% | 66 | +0.4% | 6.52 | −0.5% |
| CM | playmaker | 6.80 | +2.1% | 0.57 | 0.34 | 6.01 | −1.4% | 76.9 | −2.0% | 66 | +0.1% | 6.63 | +1.3% |
| AM | playmaker | 6.90 | −0.2% | 0.73 | 0.05 | 6.03 | −0.1% | 81.5 | +0.1% | 75 | +1.7% | 6.64 | +0.7% |
| AM | boxToBox | 6.92 | +0.2% | 0.80 | 0.13 | 6.05 | +0.1% | 81.4 | −0.1% | 72 | −1.7% | 6.55 | −0.7% |
| LW | touchlineWinger | 6.71 | −2.1% | 0.80 | 0.11 | 6.47 | +1.4% | 78.8 | −0.8% | 69 | −6.6% | 6.52 | −1.9% |
| LW | invertedWinger | 7.07 | +3.2% | 0.91 | 0.14 | 6.37 | −0.2% | 80.5 | +1.4% | 78 | +4.8% | 6.72 | +1.1% |
| LW | freeWinger | 6.87 | +0.3% | 0.76 | 0.05 | 6.44 | +0.9% | 79.5 | +0.2% | 78 | +4.8% | 6.75 | +1.5% |
| LW | dribbler | 6.75 | −1.5% | 0.73 | 0.10 | 6.25 | −2.1% | 78.7 | −0.9% | 72 | −2.9% | 6.60 | −0.7% |
| ST | runner | 6.95 | +1.7% | 1.07 | 0.11 | 6.49 | +0.5% | 78.0 | −0.8% | 73 | −1.8% | 6.58 | +0.2% |
| ST | targetForward | 6.63 | −3.0% | 0.73 | 0.03 | 6.61 | +2.4% | 79.6 | +1.2% | 78 | +4.9% | 6.61 | +0.7% |
| ST | pivot | 6.92 | +1.3% | 0.99 | 0.06 | 6.27 | −2.9% | 78.4 | −0.3% | 72 | −3.1% | 6.51 | −0.9% |

Sonuç: maç reytingi (simülasyon ve oynanan), kariyer sonu OVR ve kariyer ortalama reytingi her rolde mevki
ortalamasının ±%5'i içinde. Kariyer sonu itibarı en gürültülü ölçüt (rol başına 12 kariyer, kulüp ve kupa şansı);
22 rol ±%5 içinde, Oyun Kurucu (DM) +%6,6 ve Çizgi Kanadı −%6,6 (sırasıyla reyting +%2,0 / −%1,9; aradaki fark
kariyer şansı gürültüsü düzeyinde). Rollerin imza anları belirgin ölçüde farklı: Derinlik Forveti 1v1 ve uzun
top, Hedef Forvet hold-up, Pivot kafa ve korner; Çizgi Kanadı orta, Teknik Çalımcı dribbling; Agresif Stoper pas
arası, Hava Hakimi arka direk ve korner; Libero Kaleci süpürme.

`roleBalance.test` korunağı: 40 maçlık otomatik simülasyonda her rolün reytingi mevki ortalamasının ±%8'i içinde
(40 maçta ±%3 gürültü). Tam rapor:
`ROLE_BALANCE=1 ROLE_BALANCE_CAREERS=12 ROLE_BALANCE_OUT=rol.md npx vitest run src/sim/game/roleBalance.test.ts -t "full report"`.

### Başlangıç yaşı 16–21

Genç başlayan daha düşük sayfa ama daha yüksek tavan ve hızlı gelişim yıllarına (≤ 20) daha çok zaman; yaşlı
başlayan hazır bir sayfa, biraz itibar ve daha az tavan, zirveye kadar daha az yıl alır (`createHero.START_AGE_EFFECT`;
yaş eğrisi ve düşüş herkes için aynı gerçek yaşta). Sihirbaz takası gösterir: başlangıç OVR'si (17'ye göre fark),
potansiyel kayması ve zirveye kalan yıl.

| Yaş | Özellik | Potansiyel | Asgari boşluk | İtibar |
|---|---|---|---|---|
| 16 | −2,5 | +2 | 13 | 0 |
| 17 | 0 | 0 | 12 | 0 |
| 18 | +4 | −0,5 | 11 | +3 |
| 19 | +8 | −1 | 10 | +7 |
| 20 | +12 | −2 | 9 | +11 |
| 21 | +16 | −3 | 8 | +16 |

Ölçüm (`BALANCE_AGES=1`, yaş başına 12 kariyer, hepsi 30 yaşına kadar, tohum 1000; medyan):

| Başlangıç yaşı | Başlangıç OVR | Pot. | OVR 21 | OVR 25 | Zirve OVR | İtibar 21 | İtibar 25 | İtibar 30 | 1. kademe yaşı | Gol+asist (30 yaşa kadar) | Kupa (30) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 16 | 44 | 85.5 | 77.5 | 82 | 85 | 57.5 | 77.5 | 88 | 19.5 (100%) | 244.5 | 4.6 |
| 17 | 47 | 83.5 | 74.5 | 81 | 83.5 | 52.5 | 79 | 89.5 | 20.5 (100%) | 207 | 4.6 |
| 18 | 51 | 83 | 73.5 | 79.5 | 82 | 47.5 | 76.5 | 91.5 | 21.0 (100%) | 202.5 | 4.0 |
| 19 | 55 | 82.5 | 71.5 | 78 | 82 | 43 | 75 | 85.5 | 22.5 (100%) | 178.5 | 4.2 |
| 20 | 59 | 81.5 | 70 | 78.5 | 82 | 36.5 | 70.5 | 86.5 | 22.0 (100%) | 187 | 3.7 |
| 21 | 63 | 80.5 | 67.5 | 78.5 | 81.5 | 31 | 66.5 | 80.5 | 23.0 (100%) | 155 | 2.3 |
21 yaşında başlayan 63 OVR ile en hazır başlar ve 25'te 78,5'e ulaşır, ama zirvesi (81,5) ve 30 yaşındaki itibarı
(80,5) gençlerinkinin altında kalır, 30 yaşına kadar daha az gol+asist ve kupa toplar: hiçbir yaş kesin olarak daha
iyi değil. 16 yaşında başlayan en düşük başlar ama en yüksek zirveye ve en uzun kariyere sahiptir. (Bu tablo
`MATCH_REP_SCALE` 0,76 öncesi ölçüldü; ayar tüm yaşları aynı oranda yukarı taşır.)

### BALANCE (17 yaş standart karışım, son kod)

| Ölçüt (tohum 1000 · 2000) | Değer | Hedef |
|---|---|---|
| İtibar 18 / 21 / 25 | 12/49/77 · 12/51/78 | ~15 / ~50 / 75–85 |
| OVR 21 / 25 (medyan) | 75/81 · 76/81 | 17–21 sezonda +5–7 |
| İlk 1. kademe / elit kulüp yaşı | 21,0 · 20,0 / 23,0 · 23,0 | 21–23 / 22–24 |
| Pot ≥ 85: 25 yaşına kadar OVR 80+ | 9/9 · 11/11 | çoğunluk |
| 3. sezon net servet medyan / max | 128K/929K · 123K/557K | ≤300K / ≤2M |
| ST gol/maç kariyer / en iyi sezon | 0,62/0,96 · 0,69/0,96 | ~0,6–0,8 / ~1,0–1,3 |
| ST sezonluk gol 71–76 / 77–82 | 23/21 · 22/29 | 18–28 / 25–35 |
| Kumarhane payı kumarbaz / herkes | %22/%3 · %24/%2 | %15–35 / ≤%5 |
| Kart/hafta, sakatlık/sezon, sakat hafta | 1,7/1,5/3,7 · 1,8/1,4/3,2 | 1,5–2,5 / 1–2 / 3–6 |
| İflas | %0 · %0 | ≤%5 |

ST 77–82 tohum 1000'de 21 (n=17), iki tohumun ortalaması 25 (bant alt sınırı). **Golden master bilinçli olarak
`UPDATE_GOLDEN=1` ile yenilendi** (aynı commit, 15121d3): yeni özellikler, rol şablonları ve ayarlar her kariyer ve
maç sonucunu değiştiriyor.


## Özellik etki tablosu (Ekim 2026, save v6)

Sahip isteği: **her özellik oyunun mekaniğini gözle görülür değiştirmeli** ve maç içi anlar her özelliği
kullanacak kadar çeşitli olmalı. Ölçüm: aynı sahne / aynı tohum, kahramanın tek bir özelliği **40 (düşük)**
ve **85 (yüksek)**, geri kalan her şey eşit (65; kaleci özellikleri saha oyuncusunda 25).

- Canlı anlar: `src/game/attrSensitivity.ts` (`MOMENT_PROBES`, 31 ölçüm), testler
  `src/game/attrSensitivity.{physical,technical,mental}.test.ts`. Rapor:
  `ATTR_REPORT=1 npx vitest run src/game/attrSensitivity` (`ATTR_N_SCALE=2` örneklemi ikiye katlar).
  Bot (ortalama insan) ya da sabit senaryolu girdiyle oynanır; hata ölçüleri medyan, eşik hem mutlak hem
  göreli (`rel`). Eşiği geçemeyen özellik testi kırar: çözüm eşiği gevşetmek değil, mekaniği bağlamak.
- Arka plan maç simülasyonu: `src/sim/match/attrSensitivity.ts` (`SIM_PROBES`), N=800 maç × 2. Metrik
  çoğunlukla `xOwn` = kahramanın kendi katkısının beklenen değeri (an başına beklenen not + arka plan
  düelloları); takım sonucu gürültüsünü dışarıda bırakır. Liderlik takım gol farkıyla, pas oranla, bitiricilik
  gol+asistle, agresiflik müdahale ve kart (bedeli) ile ölçülür.

### Canlı an: özellik → metrik → düşük / yüksek

| Özellik | An | Metrik | 40 | 85 | Etki |
|---|---|---|---|---|---|
| pace | recovery_run | sprint top speed | 7.72 m/s | 8.98 m/s | 1.26 m/s |
| acceleration | recovery_run | time to 5 m from standing | 0.95 s | 0.85 s | 0.10 s |
| stamina | recovery_run | distance in an 8 s sprint at 85' | 44.44 m | 51.86 m | 7.42 m |
| workRate | recovery_run | sprint time before the tank runs dry (70') | 3.83 s | 4.59 s | 0.77 s |
| strength | shoulder_duel | shoulder contacts won | 34.2% | 77.2% | 43.0 pp |
| balance | shoulder_duel | knocked off his feet per contact | 9.8% | 0.0% | 9.8 pp |
| agility | dribble | time to turn and go back with the ball | 1.50 s | 1.23 s | 0.27 s |
| jumping | corner | contested headers won at corners | 31.2% | 52.4% | 21.3 pp |
| passing | build_up | short-pass miss at the receiver (median) | 0.15 m | 0.08 m | 0.07 m |
| longPassing | switch_play | long diagonal miss at the far side (median) | 0.45 m | 0.24 m | 0.21 m |
| crossing | cross | cross delivery error (median) | 1.11 m | 0.69 m | 0.42 m |
| dribbling | dribble | take-on success | 29.7% | 47.3% | 17.7 pp |
| firstTouch | long_ball_control | first touch killed it (no heavy touch) | 73.6% | 98.7% | 25.1 pp |
| shooting | long_shot | shot speed at full power | 31.65 m/s | 34.13 m/s | 2.48 m/s |
| finishing | one_on_one | close-range finish miss vs aim (median) | 0.49 m | 0.35 m | 0.14 m |
| curve | freekick | bend on a full-curl free kick | 0.46 m | 1.01 m | 0.54 m |
| heading | header | headers on target | 66.4% | 86.0% | 19.7 pp |
| tackling | defend | standing tackles won per attempt | 71.2% | 86.0% | 14.8 pp |
| setPieces | freekick | free-kick aim error (median) | 0.55 m | 0.38 m | 0.17 m |
| vision | build_up | highlighted pass options | 2.00 # | 8.05 # | 6.05 # |
| composure | edge_of_box | shot miss with a defender on him (median) | 1.66 m | 1.22 m | 0.44 m |
| positioning | timed_run | caught offside | 44.7% | 0.0% | 44.7 pp |
| anticipation | interception | read the pass and cut it out himself | 28.0% | 39.0% | 11.0 pp |
| aggression | defend | fouls given away (trade-off) | 13.0% | 17.0% | 4.0 pp |
| aggression | defend | tackles won per attempt | 73.4% | 88.9% | 15.5 pp |
| leadership | cross | calls for the ball answered (captain) | 26.5% | 64.5% | 38.0 pp |
| reflexes | gk_save | shots kept out | 50.0% | 60.7% | 10.7 pp |
| diving | gk_save | fingertip reach of a full-stretch dive | 2.93 m | 3.63 m | 0.70 m |
| handling | gk_save | saves held (not parried) | 23.3% | 54.1% | 30.8 pp |
| gkPositioning | gk_claim | crosses claimed or punched | 21.3% | 33.3% | 12.0 pp |
| gkDistribution | gk_distribution | kick-out miss at the far man (median) | 0.28 m | 0.16 m | 0.12 m |

### Maç simülasyonu (N=1000 maç × 2, 40 → 85)

| Özellik | Mevki | Metrik | Etki | Δ not | Δ takım gol farkı |
|---|---|---|---|---|---|
| pace | LW | xOwn | 0.104 | 0.061 | 0.051 |
| acceleration | ST | xOwn | 0.148 | 0.185 | 0.130 |
| stamina | CM | xOwn | 0.095 | 0.136 | 0.146 |
| strength | CB | xOwn | 0.144 | 0.111 | -0.016 |
| balance | ST | xOwn | 0.138 | 0.143 | 0.047 |
| agility | LW | xOwn | 0.110 | 0.179 | 0.101 |
| jumping | CB | xOwn | 0.088 | 0.069 | -0.013 |
| passing | CM | passPct | 0.107 | 0.259 | 0.091 |
| longPassing | CM | xOwn | 0.112 | 0.159 | 0.076 |
| crossing | LW | xOwn | 0.232 | 0.219 | 0.062 |
| dribbling | LW | xOwn | 0.170 | 0.173 | 0.124 |
| firstTouch | ST | xOwn | 0.139 | 0.104 | -0.032 |
| shooting | AM | xOwn | 0.120 | 0.147 | 0.100 |
| finishing | ST | ga | 0.306 | 0.367 | 0.164 |
| curve | AM | xOwn | 0.107 | 0.214 | 0.025 |
| heading | CB | xOwn | 0.104 | 0.059 | 0.040 |
| tackling | CB | xOwn | 0.207 | 0.256 | 0.079 |
| setPieces | AM | xOwn | 0.124 | 0.131 | 0.041 |
| vision | CM | xOwn | 0.133 | 0.111 | -0.012 |
| composure | ST | xOwn | 0.278 | 0.366 | 0.153 |
| positioning | CB | xOwn | 0.206 | 0.208 | -0.123 |
| anticipation | CB | xOwn | 0.207 | 0.361 | 0.148 |
| aggression | CB | tackles | 0.440 | 0.054 | 0.061 |
| aggression | CB | cards | 0.026 | 0.054 | 0.061 |
| leadership | CB | gd | 0.369 | 0.166 | 0.369 |
| workRate | CM | xOwn | 0.088 | 0.133 | 0.158 |
| reflexes | GK | xOwn | 0.317 | 0.637 | 0.215 |
| diving | GK | xOwn | 0.241 | 0.444 | 0.098 |
| handling | GK | xOwn | 0.263 | 0.414 | 0.072 |
| gkPositioning | GK | xOwn | 0.407 | 0.775 | 0.243 |
| gkDistribution | GK | xOwn | 0.228 | 0.177 | -0.050 |

### Bağlanan mekanikler (özet)

- **Kondisyon (Stamina) / Çalışkanlık (Work Rate):** dakikaya göre yorgunluk (`conditionAt`, motorun yorgunluk
  modeliyle aynı). Geç dakikada depar deposu boş başlar, bacaklar yavaşlar (koşul 0.75 altı: −%25/birim),
  isabet düşer; depar tüketimi Stamina ve Work Rate ile azalır, toparlanma ikisiyle artar. Simde Work Rate
  daha çok koşar (yorgunluk ×0.85–1.15), takımına pres katkısı verir, topa daha çok gelir.
- **Hız / İvme / Çeviklik:** tepe hız (pace), ilk adımlar (acceleration geniş aralık), yön değiştirme ivmesi ve
  dönüş hızı (agility).
- **Güç / Denge:** omuz omuza temas (`shoulderContact`: shoulder_duel, long_ball_control, recovery_run,
  hold_up, counter); kaybeden çizgisinden çıkar, dengesi zayıfsa yere düşer ve topu kaybeder. Top taşıyanın
  müdahaleye direnci güç içerir.
- **Sıçrama / Kafa:** hava topu düellosu üstel ağırlık (sıçrama baskın), kafa isabeti kafa vuruşuyla.
- **İlk dokunuş:** kontrol eşiği 6 + 14.5·FT m/s; kötü dokunuşta top daha uzağa seker.
- **Şut / Bitiricilik / Falso / Duran top / Orta / Uzun pas / Pas:** vuruş modeli (hız, sapma, falso
  aralığı −35 + 130·mix rad/s, uzun pasta mesafeyle büyüyen sapma iyi pasörde küçülür).
- **Soğukkanlılık:** baskı altında sapma ×(1 + baskı·(1.6 − 1.4·comp)).
- **Önsezi:** müdahale zamanlaması, rakip pasını okuyup koridora koşu (menzil 0.5 + 3.5·önsezi m),
  ağır çekim penceresi, pas kesme erişimi.
- **Pozisyon alma:** takım arkadaşı topu tutarken ofsayt çizgisinde durur (70 üstü tam), çizgi öne çıkınca
  geri döner; zayıf pozisyon ~2 m kayar.
- **Agresiflik:** müdahale gücü ↑, faul olasılığı ↑ (bedeli; simde kart oranı ↑).
- **Liderlik:** AI takım arkadaşları daha hızlı karar verir, biraz daha hızlı koşar, daha temiz pas/orta atar,
  daha çok müdahaleye girer, çağrıya daha çok cevap verir (kaptan ×1.5); simde takım birimleri
  ×(1 ± %10·(L−65)/100, kaptan ×1.5); canlı hub'da yeni **kaptanın toparlaması (rally)** kararı.
- **Kaleci:** refleks (el erişimi, ağır çekim), plonjon (erişim ve uçuş hızı), top tutma (yakala / çel),
  pozisyon (açıortay sadakati, şut anında yan adım, orta karşılama koşusu ve sıçrama), oyun kurma (elden
  dağıtım isabeti).
- **Arka plan düelloları (`sim/match/heroDuels.ts`):** hava, omuz, sprint yarışı, çalım, pres, kontrol,
  oyun değiştirme; kalecide orta yakalama ve dağıtım. Dakika anahtarlı hash ile (motor RNG'si değişmez),
  rakip seviyesine karşı ±0.025 not; 15 dakikada bir "Oyuna katkı" satırı.

### Yeni an türleri (özellik anları)

| Tür | Özellikler | Mevkiler (ağırlık) | Ortalama bot başarısı | Bant |
|---|---|---|---|---|
| long_shot | Şut Gücü, Falso, Soğukkanlılık | AM, CM, LW/RW, ST | 0.14 (gol) | 0.06–0.25 |
| switch_play | Uzun Pas, Vizyon | CM, DM, CB, FB | 0.45 (karşı kanat) | 0.30–0.62 |
| recovery_run | Kondisyon, Çalışkanlık, Hız | CM, DM, FB, kanat (65'+ ×2) | 0.62 | 0.45–0.78 |
| shoulder_duel | Güç, Denge | ST, kanat, FB | 0.35 | 0.22–0.50 |
| timed_run | Pozisyon Alma, Önsezi, İvme | ST, kanat, AM | 0.13 (gol) | 0.05–0.25 |
| press_trap | Önsezi, Çalışkanlık, Agresiflik | ST, kanat, AM, CM | 0.52 | 0.38–0.66 |
| gk_claim | Top Tutma, Sıçrama, Pozisyon (GK) | GK | 0.91 (gol yememe) | 0.80–0.98 |
| gk_distribution | Oyun Kurma (GK), Soğukkanlılık | GK | 0.65 | 0.50–0.80 |

Her biri uçtan uca: yerleşim (`highlightGen`), mevki/rol ağırlığı, çalışma zamanı, oto-çözüm oranları
(65'lik kahramanın oranı ölçülen oynanış oranına hizalı), TR/EN istem metni, kontrol ipucu (gk_claim için yeni
`claim` ipucu), demo sayfası ve e2e, his bandı (`feel.test.ts`).

Not: değişen mekanikler golden master'ı değiştirir (`src/sim/golden.json` lider tarafından yeniden üretilecek).

## Kelebek bağları (Ekim 2026, `docs/SYSTEMS-MAP.md`)

Sahip ilkesi "en küçük şeyin bile bir yerde etkisi olmalı" için çıkmaz sokaklar bağlandı (ayrıntı ve tam
liste: `docs/SYSTEMS-MAP.md`). Dengeye dokunanlar: maça yorgun başlama (yorgunluk > 40, enerji < 40, dün gece
dışarıda), keskinlik < 55 iken pas tutma (en fazla −%6), maçta yaşam kaynaklı sakatlık yatkınlığı (sağlık,
stres, tükenmişlik), takım uyumu (takım morali ±%4), kaptanlık liderlik XP'si, maç öncesi gece ve disiplin
< 40 için ilk 11 cezası, disiplinin milli çağrıya ve sponsor teklif sıklığına etkisi, takipçi ve ödüllerin
sponsor sıklığına etkisi, lüks alım tepkileri, işletme zararı stresi, düşman basın / sevgili krizi / soğuk
soyunma odası stresi, kumarhanede +5 yorgunluk, penaltıcı sırası.

Ölçüm: otopilot maç günlerinde neredeyse hiç yorgun ya da paslı başlamıyor (8 kariyer × 4 sezon, 932 maç:
maç günü ortalama yorgunluk 2, enerji 100, keskinlik 99,5; başlangıç yorgunluğu 0, takım uyumu ortalama
×1,013, yatkınlık ×1,013). Yani bağlar ortalama oyuncunun sayılarını değil, oyuncunun **seçimlerinin** sonucunu
değiştiriyor: 26 yaş itibarında parti personası 76,7 → 75,3 (tohum 1000) ve 77,7 → 72,3 (tohum 2000),
kumarbaz 73,3 → 68,7 · 61,2 → 62,7 (gece hayatı ve düşük disiplin artık formaya ve çağrıya mal oluyor); pro
personası değişmedi (78,4 → 79,9 · 78,3 → 78,9).

| Ölçüt (30 × 10) | Önce: tohum 1000 · 2000 · 3000 · 4000 | Sonra: 1000 · 2000 · 3000 · 4000 | Hedef |
|---|---|---|---|
| İtibar 18 / 21 / 25 | 13/48/71 · 13/46/70 · 11/40/70 · 11/45/72 | 9/40/74 · 12/44/71 · 12/45/74 · 13/44/76 | ~15 / ~50 / 75–85 |
| İlk 1. kademe / elit kulüp yaşı | 21,0/22,0 · 20,5/23,0 · 20,0/22,0 · 20,0/23,0 | 20,0/23,0 · 21,0/23,0 · 20,5/22,0 · 20,0/23,0 | 21–23 / 22–24 |
| ST gol/maç kariyer / en iyi sezon | 0,56/0,97 · 0,58/1,00 · 0,50/0,81 · 0,50/0,86 | 0,56/0,88 · 0,55/0,90 · 0,62/0,92 · 0,56/0,95 | ~0,6–0,8 / ~1,0–1,3 |
| 3. sezon net servet medyan | 122K · 134K · 131K · 112K | 112K · 151K · 126K · 127K | ≤ 300K |
| Kumarhane payı kumarbaz / herkes | %12/%2 · %19/%2 · %13/%2 · %31/%3 | %22/%4 · %18/%2 · %31/%4 · %26/%3 | %15–35 / ≤ %5 |
| Kart/hafta, sakatlık/sezon, sakat hafta | 1,7/1,4/3,3 · 1,8/1,5/3,6 · 1,8/1,5/3,3 · 1,8/1,4/3,3 | 1,7/1,4/3,3 · 1,7/1,5/3,3 · 1,7/1,4/3,4 · 1,7/1,4/3,3 | 1,5–2,5 / 1–2 / 3–6 |
| İflas | %0 her tohumda | %0 her tohumda | ≤ %5 |

"Önce" sütunu bu turun başındaki kod (c3d8f94); 1000 ve 2000 için "Sonra" son kod, 3000 ve 4000 için
penaltıcı sırası bağlanmadan hemen önceki kod (yalnızca o kartı gören kariyerleri etkiler). Dört tohumun
ortalamasında 21 yaş itibarı 44,8 → 43,3 (tohum gürültüsü içinde, tohum 1000 tek başına 48 → 40), 25 yaş
itibarı 70,8 → 73,5 (hedefe yaklaştı), ST kariyer gol/maç 0,54 → 0,57. 21 ve 25 yaş itibarı ile ST en iyi
sezonu bu turdan **önce de** hedefin alt sınırının altındaydı (c3d8f94 ile gelen özellik bağları); bu tur o
açığı büyütmedi; ayar turu aşağıda ("İtibar eğrisi ve golcü hacmi turu").

**Golden master bilinçli olarak yenilendi** (`UPDATE_GOLDEN=1`, aynı commit): 1000 AI maçının özeti değişmedi,
kariyer sezonu özeti değişti (maç hazırlığı, seçilme, sponsor sıklığı ve lüks tepkileri kariyer akışını
değiştiriyor).

## İtibar eğrisi ve golcü hacmi turu (Ekim 2026, yankılar sonrası)

Sorun: kelebek ve özellik bağlarından sonra 21 ve 25 yaş itibarı (~43 / ~73) ve forvetin gol hacmi (kariyer
0,56 gol/maç, en iyi sezon ~0,9, 77–82 OVR sezonu 13–17 gol) hedefin altındaydı. Kök neden iki parçalı:
özellik anları (omuz omuza, pres tuzağı…) forvetin an karışımını sulandırdı, OVR 68 üstündeki "sıkılaşan
savunma" ve 74 üstündeki "yıldız markajı" ise yüksek OVR'li hücumcunun şut anlarını eskisinden sert kesiyordu
(77–82 bandında 71–76 bandından **az** gol). İtibar tarafında ise ilk sezonların maç ünü küçüktü.

Değişiklikler (önemsiz eylemlerden ün şişirilmedi; ün yine sahadan geliyor):

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `sim/match/highlightGen.ts` | `SHOOT_TIGHTENING` 0,6 → 0,4, `ELITE_SHOOT` 0,5 → 0,2, `COUNT_TIGHTENING` 0,2 → 0,15 | Yıldız markajı yerinde ama yüksek OVR artık düşük OVR'den az gol demek değil. Pozisyondaki bütün roller aynı çarpanı aldığı için rol dengesi korunur. |
| `sim/match/highlightGen.ts` | Forvet temel an sayısı 6 → 6,4 | Özellik anlarının forvetten aldığı şans payını geri verir. |
| `sim/career/matchOutcome.ts` | `youthSpotlight(yaş)`: pozitif maç ünü 18 ve altında ×1,8, 22'de ×1'e iner (`YOUTH_SPOTLIGHT` 0,8) | Gerçek hayatta gol atan bir genç, aynı şeyi yapan oturmuş bir oyuncudan çok daha fazla manşet olur. Erken itibar eğrisini (18 / 21) taşır. |
| `sim/career/matchOutcome.ts` | `MATCH_REP_SCALE` 0,76 → 0,8 | 25 yaş bandını 75–85'in içine alır. |
| `sim/game/balance.test.ts` | `BALANCE_ST=1` forvet raporu (üç forvet rolü, 12 kariyer × 10 sezon) | Standart karışımda yalnızca 5 forvet var; bant medyanları 14–18 sezonluk örneklemle oynuyordu. |

Ölçüm: `BALANCE=1`, 30 kariyer × 10 sezon, tohum 1000 · 2000 · 3000. "Önce" bu turun başındaki kod (yankılar
dahil, cc239df); "sonra" son kod.

| Ölçüt | Önce: 1000 · 2000 · 3000 | Sonra: 1000 · 2000 · 3000 | Hedef |
|---|---|---|---|
| İtibar 18 / 21 / 25 | 9/40/74 · 12/44/71 · 12/45/74 | 14/54/75 · 16/50/78 · 15/49/78 | ~15 / ~50 / 75–85 |
| OVR medyanı 21 / 25 | 76/81 · 76/81 · 76/82 | 75/81 · 76/81 · 76/82 | 17–21 sezonda +5–7 |
| Pot ≥ 85: 25 yaşına kadar OVR 80+ | 9/9 · 11/11 · 11/11 | 9/9 · 11/11 · 11/11 | çoğunluk |
| İlk 1. kademe / elit kulüp yaşı | 20,0/23,0 · 21,0/23,0 · 20,5/22,0 | 20,0/23,0 · 20,5/22,0 · 20,0/22,0 | 21–23 / 22–24 |
| ST gol/maç kariyer / en iyi sezon | 0,56/0,88 · 0,55/0,90 · 0,62/0,92 | 0,74/1,07 · 0,73/1,09 · 0,70/1,06 | ~0,6–0,8 / ~1,0–1,3 |
| ST sezonluk gol 71–76 / 77–82 (standart karışım, 5 forvet) | 21/13 · 19/17 · 19/17 | 23/18 · 20/22 · 21/24 | 18–28 / 25–35 |
| ST sezonluk gol 71–76 / 77–82 (`BALANCE_ST`, 12 forvet) | 20/19,5 · 22/21 · 18,5/22 | 18/26,5 · 23/26 · 17/27,5 | 18–28 / 25–35 |
| Kanat/AM · orta saha sezonluk gol 77–82 | 10·4 · 9·6 · 9·5 | 12·7 · 11·8 · 12·5 | 10–18 · 6–12 |
| 3. sezon net servet medyan / max | 112K/446K · 151K/942K · 126K/1,1M | 153K/1,1M · 183K/508K · 140K/488K | ≤ 300K / ≤ 2M |
| Kumarhane payı kumarbaz / herkes | %22/%4 · %18/%2 · %31/%4 | %13/%2 · %9/%1 · %28/%4 | %15–35 / ≤ %5 |
| Kart/hafta, sakatlık/sezon, sakat hafta | 1,7/1,4/3,3 · 1,7/1,5/3,3 · 1,7/1,4/3,4 | 1,7/1,4/3,1 · 1,8/1,4/3,0 · 1,8/1,6/3,6 | 1,5–2,5 / 1–2 / 3–6 |
| İflas | %0 her tohumda | %0 her tohumda | ≤ %5 |

Sonuç: itibar eğrisi üç tohumda da hedefte (21 yaş 49–54, 25 yaş 75–78), forvetin kariyer ve en iyi sezon
oranı bandın ortasında. 77–82 bandı büyük örneklemde (`BALANCE_ST`) 26–27,5 ile hedefte; standart karışımın
5 forvetlik örnekleminde 18–24 (14–18 sezon, p90 33–36), tohum gürültüsü. Bilinen sınırlar:

- **İlk 1. kademe yaşı** 20,0–20,5 (hedef 21–23); bu tur öncesinde de 20,0–21,0 idi, değişmedi sayılır.
- **Kumarbaz kumarhane payı** tohum 2000'de %9 (hedef %15–35); bu ölçüt 6 kumarbazla ölçülüyor ve önceki
  turlarda da aynı kodla %12–%31 arasında oynadı (kod değişikliği RNG akışını kaydırır). Üç tohumun
  ortalaması %17 (hedefte); genel pay her tohumda ≤ %4.
- **Forvet en iyi sezonu** 1,06–1,09: "~1,0–1,3" bandının alt üçte birinde, bilinçli (yıldız markajı korunuyor).

Rol dengesi (`ROLE_BALANCE=1`, 300 simülasyon maçı + 300 oynanan an, OVR 68): simülasyon maç reytingi her rolde
mevki ortalamasının ±%2,8'i içinde (forvet rolleri −0,8 / −0,3 / +1,1). Bu turun değişiklikleri OVR 68'de
oynanan anları etkilemiyor (sıkılaşma 68 üstünde başlıyor, an sayısı oynanan anın sonucunu değiştirmiyor):
Derinlik Forveti'nin "oynanan an" sütunu −%7,4 bu turdan **önce** de aynıydı (aynı tohumla doğrulandı,
özellik anları turundan kalma) ve ayrı bir ayar turu gerektiriyor (Tur 4'te çözüldü: "Rol denge Tur 4" bölümü). `roleBalance.test` korunağı (40 maç, ±%8)
ve `roles.test` yeşil. `STATS_GUARD=1` (40 × 10) tolerans içinde; `statsBaseline.json` yeniden merkezlenmedi.

**Golden master bilinçli olarak `UPDATE_GOLDEN=1` ile yenilendi** (aynı commit): kariyer sezonu özeti değişti
(an sayısı, şut ağırlıkları, maç ünü); 1000 AI maçının özeti değişmedi.

## Rol denge Tur 4: Derinlik Forveti oynanan anda (Ekim 2026)

Sorun: Derinlik Forveti "oynanan an" ölçüsünde mevki ortalamasının −%7,4 altındaydı (hedef ±%5). An bazında
ölçüm (`ROLE_BALANCE` an kırılımı, 250 an/tür) kök nedeni gösterdi; hepsi futbol açısından ters duruyordu:

- **Hızlanma:** v6'da Hız ikiye bölününce rolün "Hız" artısı yalnızca tam süratte kaldı. OVR 68'de Derinlik
  Forveti'nin Hızlanması 56, Hedef Forvet'inki 63'tü. Arkaya koşu, 1v1 ve kontra ilk adımlarla kazanılır.
- **Uzun top:** karışımın %20'si sırtı dönük havadan uzun top (`long_ball_control`, ×1,6) idi. Bu rolün
  dört eksisinden üçü (Güç, Zıplama, Kafa) tam bu düelloda. %28 başarı, an başına −0,15 reyting.
- **Zamanlı koşu ödülsüzdü:** savunma hattı topa kim koşarsa koşsun hep 0,55 sn'de dönüyordu. Hızlı forvet
  yavaş forvetten daha az gol buluyordu (200 anda 15'e karşı 29).
- **1v1 bitiricilik:** yakın mesafede Bitiricilik şut becerisinin en çok %50'siydi; Bitiricilik 88'lik
  forvet, Bitiricilik 60'lık Hedef Forvet kadar gol atıyordu (Şut Gücü 58'e karşı 65).

Değişiklikler:

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `sim/career/createHero.ts` | `PLUS_COMPANION`: Hız artısı olan rol Hızlanma'ya Hız artısının 0,6'sını alır (OVR bütçesi içinde, v6 göçündeki 0,6 Hız payı) | "Hız odaklı" ilk adımı da kapsar. Derinlik Forveti 56 → 70; Çizgi Kanadı, Hücumcu Bek, Agresif Stoper ve Teknik Çalımcı da aynı payı alır. |
| `game/runtime.ts` | `inBehindTurn`: zamanlı koşuda topun arkaya atılmasıyla savunmacının dönüş süresi, forvetin Hız+Hızlanma farkına göre 0,45–0,85 sn | Hattı yakalayan hızlı forvet döndükleri anda gitmiş olur. Derinlik Forveti 200 zamanlı koşuda 15 → 30 gol; Hedef Forvet 29 → 20. |
| `game/kick.ts` | `CLOSE_FINISHING` 0,5 → 0,7: dibinden şutta Bitiricilik'in payı | Ceza sahası içinde yerleştirme güçten önemli. Eşit özellikli sayfada (his testleri) etkisi sıfır. |
| `sim/match/highlightGen.ts` | Derinlik Forveti karışımı: `long_ball_control` 1,6 → 0,7, `timed_run` → 2,0, `press_trap` → 2,2, `shoulder_duel` 0,4, `dribble` 0,7, `header` 0,35, `defend` 1,0 → 0,6; şut payı 0,83 aynı | Bu rolün uzun topu arkaya atılan toptur. Hızıyla stoperlere pres yapar, omuz omuza düelloya girmez. Şut payı 0,9 denendi: maç başı gol beklentisi +%14 çıktı (`roles.test` ±%8), 0,83'te kaldı. |

Ölçüm (`ROLE_BALANCE=1`, 300 simülasyon maçı, OVR 68). Oynanan an hem 300 an (belgelenmiş yöntem) hem 600
anla ölçüldü: 300 anda an türü örneklemesi tek başına ±%1,5 gürültü taşıyor. Derinlik Forveti 1.200 anda −%1,6.

| Mevki | Rol | Maç reytingi (sim) | Δ | G+A / maç | Oynanan (300 an) | Δ | Oynanan (600 an) | Δ |
|---|---|---|---|---|---|---|---|---|
| GK | reflexKeeper | 6.62 | +0.2% | 0.00 | 6.08 | +0.9% | 6.01 | +0.7% |
| GK | shotStopper | 6.62 | +0.0% | 0.00 | 5.97 | −0.9% | 5.93 | −0.8% |
| GK | sweeperKeeper | 6.60 | −0.2% | 0.00 | 6.02 | −0.1% | 5.98 | +0.1% |
| CB | stopper | 6.30 | +0.7% | 0.09 | 6.16 | +1.4% | 6.29 | +3.1% |
| CB | aerialDefender | 6.15 | −1.6% | 0.17 | 6.08 | −0.0% | 5.95 | −2.5% |
| CB | ballPlayingDefender | 6.31 | +0.9% | 0.19 | 6.00 | −1.4% | 6.07 | −0.6% |
| LB | balancedFullBack | 6.26 | +0.6% | 0.36 | 6.11 | +1.6% | 6.01 | −0.1% |
| LB | attackingFullBack | 6.30 | +1.3% | 0.43 | 5.99 | −0.3% | 6.12 | +1.8% |
| LB | defensiveFullBack | 6.11 | −1.9% | 0.18 | 5.93 | −1.3% | 5.91 | −1.7% |
| DM | anchor | 6.17 | −1.7% | 0.20 | 5.83 | +1.8% | 5.81 | +0.9% |
| DM | boxToBox | 6.21 | −1.1% | 0.26 | 5.77 | +0.6% | 5.74 | −0.3% |
| DM | playmaker | 6.45 | +2.8% | 0.38 | 5.59 | −2.4% | 5.73 | −0.5% |
| CM | boxToBox | 6.41 | −1.1% | 0.41 | 5.90 | −1.4% | 5.89 | −1.1% |
| CM | anchor | 6.43 | −0.8% | 0.35 | 6.07 | +1.5% | 6.07 | +2.0% |
| CM | playmaker | 6.60 | +1.9% | 0.52 | 5.97 | −0.1% | 5.89 | −1.0% |
| AM | playmaker | 6.63 | +0.2% | 0.63 | 5.53 | −2.8% | 5.67 | −0.6% |
| AM | boxToBox | 6.60 | −0.2% | 0.62 | 5.84 | +2.8% | 5.73 | +0.6% |
| LW | touchlineWinger | 6.60 | −1.7% | 0.80 | 6.35 | +4.4% | 6.39 | +3.3% |
| LW | invertedWinger | 6.88 | +2.4% | 0.83 | 5.89 | −3.3% | 5.98 | −3.3% |
| LW | freeWinger | 6.78 | +1.0% | 0.76 | 6.05 | −0.6% | 6.22 | +0.6% |
| LW | dribbler | 6.60 | −1.7% | 0.68 | 6.05 | −0.5% | 6.16 | −0.5% |
| ST | runner | 6.70 | +0.1% | 0.95 | 6.29 | −3.1% | 6.32 | −2.1% |
| ST | targetForward | 6.68 | −0.3% | 0.83 | 6.47 | −0.3% | 6.34 | −1.8% |
| ST | pivot | 6.72 | +0.3% | 0.85 | 6.71 | +3.4% | 6.71 | +3.9% |

Sonuç: simülasyon ve oynanan maç reytingi her rolde mevki ortalamasının ±%5'i içinde (en uç: Çizgi Kanadı
oynanan +%4,4, 600 anda +%3,3). Derinlik Forveti −%7,4 → −%3,1 (600 anda −%2,1). Kimliği daha belirgin:
en sık anları 1v1, kontra, zamanlı koşu ve pres. Sırtı dönük uzun top ve kafa artık Hedef Forvet ile Pivot'ta.
Simülasyon G+A 1,08 → 0,95 (Hedef 0,83, Pivot 0,85). `roles.test`, `createHero.test`, his/girdi tekrarı/performans
testleri yeşil. Golden master değişmedi (`UPDATE_GOLDEN=1` aynı özeti üretti); kariyer sonu sütunları için
`ROLE_BALANCE_CAREERS=12` aşağıdaki kariyer tablosunda.

### Kariyer sonu (rol başına 12 kariyer × 8 sezon, `ROLE_BALANCE_CAREERS=12`, son kod)

| Mevki | Rol | Kariyer son OVR | Δ | Son itibar | Δ | Kariyer reytingi | Δ |
|---|---|---|---|---|---|---|---|
| GK | reflexKeeper | 81.2 | −1.3% | 84 | +0.2% | 7.06 | +0.8% |
| GK | shotStopper | 82.5 | +0.4% | 82 | −1.4% | 6.93 | −1.1% |
| GK | sweeperKeeper | 82.9 | +0.9% | 85 | +1.1% | 7.03 | +0.3% |
| CB | stopper | 77.8 | −1.1% | 61 | −3.6% | 6.47 | +0.5% |
| CB | aerialDefender | 78.9 | +0.3% | 61 | −3.9% | 6.32 | −1.7% |
| CB | ballPlayingDefender | 79.3 | +0.7% | 68 | +7.6% | 6.50 | +1.1% |
| LB | balancedFullBack | 79.1 | −0.1% | 54 | −6.7% | 6.17 | −0.7% |
| LB | attackingFullBack | 80.2 | +1.2% | 62 | +7.5% | 6.22 | −0.0% |
| LB | defensiveFullBack | 78.3 | −1.1% | 57 | −0.9% | 6.27 | +0.8% |
| DM | anchor | 82.3 | +0.8% | 70 | +0.6% | 6.39 | −0.5% |
| DM | boxToBox | 81.6 | +0.0% | 67 | −4.0% | 6.36 | −0.9% |
| DM | playmaker | 80.9 | −0.8% | 72 | +3.4% | 6.51 | +1.4% |
| CM | boxToBox | 78.8 | −0.1% | 66 | −0.4% | 6.41 | −0.6% |
| CM | anchor | 80.0 | +1.4% | 66 | −0.4% | 6.41 | −0.5% |
| CM | playmaker | 77.9 | −1.3% | 66 | +0.8% | 6.52 | +1.1% |
| AM | playmaker | 81.8 | +0.3% | 74 | +4.5% | 6.44 | +0.7% |
| AM | boxToBox | 81.3 | −0.3% | 68 | −4.5% | 6.35 | −0.7% |
| LW | touchlineWinger | 79.3 | −0.9% | 70 | −7.3% | 6.39 | −2.0% |
| LW | invertedWinger | 80.8 | +1.0% | 80 | +5.7% | 6.66 | +2.1% |
| LW | freeWinger | 80.5 | +0.6% | 79 | +4.4% | 6.57 | +0.7% |
| LW | dribbler | 79.4 | −0.7% | 74 | −2.9% | 6.47 | −0.8% |
| ST | runner | 78.5 | −0.6% | 76 | −1.9% | 6.49 | −0.2% |
| ST | targetForward | 80.0 | +1.3% | 81 | +4.2% | 6.55 | +0.7% |
| ST | pivot | 78.5 | −0.6% | 76 | −2.3% | 6.47 | −0.5% |

Kariyer sonu OVR'si (en uç −%1,3) ve kariyer ortalama reytingi (en uç ±%2,1) her rolde ±%5 içinde. Derinlik
Forveti üç ölçütte de ortalamada (−%0,6 / −%1,9 / −%0,2). **Kariyer sonu itibarı** yine en gürültülü ölçüt: 12
kariyerde 5 rol ±%5 dışında çıktı. Bu rollerin mevkileri 30 kariyerle yeniden ölçüldü:
- **Bekler:** üçü de içeride (−%1,9 … +%2,4). 12 kariyerdeki −%6,7 / +%7,5 gürültüydü.
- **Hâlâ dışarıda üç rol:**
  - Oyun Kurucu Stoper +%5,7…8,0
  - Ters Kanat +%6,4…6,6
  - Çizgi Kanadı −%5,4…5,7

Bu üç sapma bu turdan önce de vardı (Çizgi Kanadı −%6,6, Ters Kanat +%4,8). Kaynakları:
- Reyting farkı küçük (±%2): Ters Kanat'ın sim reytingi +%2,4, Çizgi Kanadı'nınki −%1,7.
- Bu küçük fark ödüllerde büyüyor.

Şut payı denendi: Çizgi Kanadı 1,09, Ters Kanat 0,92, Oyun Kurucu Stoper 0,92. İtibar farkı yalnızca 0,3–2 puan
kapandı, `roles.test` gol bandı da sınırda kaldı. Değişiklik geri alındı. İtibar dengesi bir sonraki tura açık
madde: ödül dağılımı orta ve asist rolleri lehine ayarlanabilir. **Kapandı (Tur 5, aşağıda).**

### Kariyer sonu itibarı (Tur 5): açık madde kapandı

Ölçüm: rol başına 30 kariyer × 8 sezon (`ROLE_BALANCE_CAREERS=30`), kaynak dökümü `SeasonSample.repFrom` + yeni
`motm` / `awards` alanları (`balanceSim.ts`). Önce = HEAD (e5a6603).

**Gerçek sürücü ödül değil, reyting.** Kariyer reytingindeki ±%2'lik fark itibarda 3–4 kat büyüyor: maç itibarı
`(reyting − 6,5) × 0,4` ile, Maçın Adamı en yüksek reytinge, Sezonun 11'i / sezonun savunmacısı reyting × 8 ile,
sezon duruşu 6,6 eşiğiyle gidiyor. Olay kartları sürücü değil, tersine telafi ediyor (düşük itibar daha çok kart
itibarı alıyor). Rol başına (kariyer başına toplam):
- **Çizgi Kanadı / Ters Kanat:** maç itibarı 35,7 / 43,5, MOTM/sezon 3,2 / 4,7, reyting 6,40 / 6,65; asist eşit
  (6,1 / 5,9). Sebep: `cross` anının beceri karışımı %40 bitiricilik + kafa idi (orta yapan kahramanın kendi kafası).
  Orta 80'lik Çizgi Kanadı'nın imza anı becerisi 58, orta 53'lük Ters Kanat'ınki 62 çıkıyordu.
- **Oyun Kurucu Stoper / Hava Hakimi:** maç itibarı 25,4 / 16,2, MOTM/sezon 3,8 / 2,6, Sezonun 11'i 1,4 / 0,4,
  reyting 6,48 / 6,28. Build-up anı stoper için en cömert an (pas tamamlama +0,08 ve pas başına +0,03);
  Oyun Kurucu Stoper 2,0×, Hava Hakimi 0,8× alıyordu.

**Değişiklikler:**
- `autoResolve.SKILL_MIX.cross`: orta teslimatla ölçülür: orta 0,45, falso 0,15, vizyon 0,1, soğukkanlılık 0,15,
  bitiricilik 0,15 (eski: orta 0,3, falso 0,1, bitiricilik 0,25, kafa 0,15, soğukkanlılık 0,2). Çizgi Kanadı 58 → 64,
  Ters Kanat 62 → 62. Orta yapan bekleri de güçlendirdi, bu yüzden:
- `ROLE_KIND_MULT`: Hücumcu Bek `cross` 1,7 → 1,4; Defansif Bek `build_up` 0,7 → 1,1, `counter` 0,6 → 0,8
  (kimlik testi: hücumcu bekin orta + 2v1 payı defansifin ≥ 1,8 katı, 1,88). Oyun Kurucu Stoper `build_up`
  2,0 → 1,6 (hâlâ stoperin 2 katından fazla), Hava Hakimi `build_up` 0,8 → 1,1.
- İtibar formülü, ödüller ve kartlar değişmedi (denenen alternatif: top kapma başına maç itibarı; tüm savunmacıların
  itibar düzeyini 5–7 puan kaydırıyor ve Hava Hakimi'ni geride bırakıyordu, alınmadı).

| Mevki | Rol | Son itibar önce | Δ | Son itibar sonra | Δ |
|---|---|---|---|---|---|
| CB | stopper | 58 | −2.3% | 58 | −2.3% |
| CB | aerialDefender | 56 | −5.7% | 59 | −1.5% |
| CB | ballPlayingDefender | 64 | +8.0% | 62 | +3.9% |
| LW | touchlineWinger | 70 | −5.7% | 74 | −2.2% |
| LW | invertedWinger | 79 | +6.6% | 79 | +3.7% |
| LW | freeWinger | 75 | +1.1% | 78 | +2.4% |
| LW | dribbler | 73 | −1.9% | 73 | −3.8% |
| LB | balanced / attacking / defensive | Tur 4: −1,9 … +2,4 | | 59 / 61 / 59 | −0.2% / +1.9% / −1.7% |

Tam tablo, son kod, 24 rol (300 maç sim, 300 oynanan an, 30 kariyer × 8 sezon; her mevki ayrı süreçte
`ROLE_BALANCE_POS=<mevki>`). Beş ölçütün hepsi her rolde ±%5 içinde; en uç değer Çizgi Kanadı'nın oynanan maç
reytingi +%4,4.

| Mevki | Rol | Maç reytingi (sim) | Δ | Oynanan maç reytingi | Δ | Kariyer son OVR | Δ | Son itibar | Δ | Kariyer reytingi | Δ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GK | reflexKeeper | 6.62 | +0.2% | 6.08 | +0.9% | 81.0 | −1.2% | 83 | −0.9% | 7.02 | +0.1% |
| GK | shotStopper | 6.62 | +0.0% | 5.97 | −0.9% | 82.1 | +0.2% | 84 | −0.4% | 6.96 | −0.6% |
| GK | sweeperKeeper | 6.60 | −0.2% | 6.02 | −0.1% | 82.8 | +1.0% | 85 | +1.3% | 7.04 | +0.5% |
| CB | stopper | 6.30 | +1.1% | 6.16 | +1.1% | 77.7 | −1.1% | 58 | −2.3% | 6.46 | +0.8% |
| CB | aerialDefender | 6.15 | −1.3% | 6.12 | +0.4% | 78.8 | +0.3% | 59 | −1.5% | 6.28 | −1.9% |
| CB | ballPlayingDefender | 6.25 | +0.3% | 6.01 | −1.5% | 79.2 | +0.8% | 62 | +3.9% | 6.47 | +1.1% |
| LB | balancedFullBack | 6.38 | +1.1% | 6.11 | +1.3% | 79.4 | +0.0% | 59 | −0.2% | 6.30 | +0.1% |
| LB | attackingFullBack | 6.28 | −0.4% | 6.02 | −0.2% | 80.1 | +1.0% | 61 | +1.9% | 6.28 | −0.1% |
| LB | defensiveFullBack | 6.26 | −0.7% | 5.97 | −1.0% | 78.5 | −1.0% | 59 | −1.7% | 6.30 | +0.0% |
| DM | anchor | 6.24 | −1.0% | 5.83 | +1.8% | 82.2 | +0.9% | 71 | +0.7% | 6.45 | −0.0% |
| DM | boxToBox | 6.23 | −1.2% | 5.77 | +0.6% | 81.5 | −0.0% | 68 | −2.3% | 6.40 | −0.8% |
| DM | playmaker | 6.44 | +2.2% | 5.59 | −2.4% | 80.7 | −0.9% | 71 | +1.6% | 6.51 | +0.8% |
| CM | boxToBox | 6.48 | −0.1% | 5.90 | −1.4% | 78.8 | +0.0% | 65 | −0.4% | 6.40 | −0.5% |
| CM | anchor | 6.43 | −0.9% | 6.07 | +1.5% | 79.8 | +1.3% | 65 | −0.3% | 6.43 | −0.1% |
| CM | playmaker | 6.56 | +1.0% | 5.97 | −0.1% | 77.7 | −1.4% | 66 | +0.7% | 6.47 | +0.6% |
| AM | playmaker | 6.60 | +0.3% | 5.53 | −2.8% | 81.2 | +0.0% | 70 | −0.1% | 6.43 | +0.4% |
| AM | boxToBox | 6.56 | −0.3% | 5.84 | +2.8% | 81.2 | +0.0% | 71 | +0.1% | 6.38 | −0.4% |
| LW | touchlineWinger | 6.76 | +0.2% | 6.35 | +4.4% | 78.7 | −1.1% | 74 | −2.2% | 6.51 | −1.1% |
| LW | invertedWinger | 6.86 | +1.7% | 5.89 | −3.3% | 80.5 | +1.2% | 79 | +3.7% | 6.67 | +1.4% |
| LW | freeWinger | 6.71 | −0.5% | 6.05 | −0.6% | 80.0 | +0.6% | 78 | +2.4% | 6.60 | +0.4% |
| LW | dribbler | 6.65 | −1.4% | 6.05 | −0.5% | 78.9 | −0.8% | 73 | −3.8% | 6.53 | −0.7% |
| ST | runner | 6.70 | +0.1% | 6.29 | −3.1% | 78.3 | −0.6% | 76 | −0.8% | 6.48 | −0.2% |
| ST | targetForward | 6.68 | −0.3% | 6.47 | −0.3% | 79.6 | +1.1% | 78 | +2.0% | 6.52 | +0.5% |
| ST | pivot | 6.72 | +0.3% | 6.71 | +3.4% | 78.4 | −0.5% | 76 | −1.3% | 6.47 | −0.3% |

`BALANCE=1` (30 kariyer × 10 sezon), tohum 1000 · 2000 · 3000, son kod:

| Ölçüt | 1000 · 2000 · 3000 | Hedef |
|---|---|---|
| İtibar 18 / 21 / 25 | 14/55/80 · 14/54/78 · 14/51/78 | ~15 / ~50 / 75–85 |
| OVR medyanı 21 / 25 | 76/81 · 75/81 · 77/82 | 17–21 sezonda +5–7 |
| Pot ≥ 85: 25 yaşına kadar OVR 80+ | 9/9 · 11/11 · 11/11 | çoğunluk |
| İlk 1. kademe / elit kulüp yaşı | 20,0/23,0 · 20,5/23,0 · 21,0/22,0 | 21–23 / 22–24 |
| ST gol/maç kariyer / en iyi sezon (medyan) | 0,71/1,03 · 0,70/0,94 · 0,70/0,96 | ~0,6–0,8 / ~1,0–1,3 |
| ST sezonluk gol 71–76 / 77–82 (standart karışım) | 23/25 · 19/27 · 22/26 | 18–28 / 25–35 |
| Kanat/AM · orta saha sezonluk gol 77–82 | 13·7 · 11·8 · 9·9 | 10–18 · 6–12 |
| 3. sezon net servet medyan / max | 117K/560K · 167K/508K · 112K/488K | ≤ 300K / ≤ 2M |
| Kumarhane payı kumarbaz / herkes | %24/%4 · %14/%1 · %15/%2 | %15–35 / ≤ %5 |
| Sakatlık/sezon, sakat hafta | 1,5/3,2 · 1,3/3,5 · 1,4/3,3 | 1–2 / 3–6 |
| İflas | %0 her tohumda | ≤ %5 |

Hedefler tutuyor. Sınırdakiler tohum gürültüsü düzeyinde: ilk 1. kademe yaşı (bilinen sınır, değişmedi),
tohum 3000'de kanat/AM 77–82 bandı 9 (17 sezonluk örneklem; önceki turlarda da 9–10 ölçüldü), tohum 2000'de
forvetin en iyi sezon medyanı 0,94 (5 forvet) ve kumarbaz payı %14 (6 kumarbaz). His / girdi tekrarı / performans
testleri yeşil. Golden master değişmedi (`UPDATE_GOLDEN=1` aynı özeti üretti).

## Kulübeden çıkış yolu ve günlük program (Ekim 2026, sahip geri bildirimi)

Sahip (gerçek cihaz): "Sürekli yedekteyiz; maç gününe kadar sadece İlerle'ye basıyoruz." İki parça:

**1. Adil ve motive eden süre** (`sim/game/selection.ts`, `career/squadRole.ts`, `sim/match/engine.ts`):

| Mekanik | Değer |
|---|---|
| Garantili kamera | Süre almadan geçen 2 maç gününden sonra kulübedeki oyuncu 60–74' arası planlı girer (`MatchSetup.heroEntryMinute`; skor ±1 ise en çok 6 dk bekler; kendi RNG çatalı) |
| Kuraklık terimi | 3 maç süre yoksa ilk 11 şansı +%30 (kaleci: 2 maçtan sonra +%50, kalecinin kamerası yok) |
| Kupa erken turu (≤21 yaş veya kaleci, rol ≤ rotasyon) | +%22 (kaleci +%35) |
| Önemsiz lig maçı (son çeyrek, şampiyon/orta sıra kesin, ≤21 yaş) | +%18 |
| Mevki rakibi sakat/cezalı | rakip başına +%6 (en çok +%18) |
| Yoğun fikstür (3 gün içinde ikinci maç) | +%8 |
| Hocanın sınavı (A notu) / tutturamama | +%10 / −%2 (bir sonraki maça kadar) |
| U21 / antrenman maçı reytingi ≥7,5 / ≥6,8 / <5,8 | +%6 / +%3 / −%3 |
| Hazırlık hedefi (rakibe özel, en çok 2) / zorunlu antrenmanı atlama | +%3 her biri / −%8 |
| Antrenman güveni | yalnız oynanan driller: A/S notu (perf − 0,7) × 5, D notu ceza; rol ≤ rotasyon ×1,5 (otomatik seans güven vermez) |
| Kamera güveni | 45 dakika altı olumlu maç güveni ×1,5 |

Tüm terimler `startProbability(..., extra)` ile seçim zarına girer; Home'daki "İlk 11 şansı" ölçeri ve kaldıraçlar
(`selectionOutlook`) aynı modeli kopya üzerinde çalıştırarak hesaplar (uydurma sayı yok).

Ölçüm (`PLAYTIME=1`, `sim/game/playingTime.test.ts`, yaş başına 12 kariyer × 2 sezon, uygun kulüp = ilk sözleşme):

| Başlangıç yaşı | Önce: S1 süre aldığı maç günü (havuz · p25 · en düşük) / S1 ilk 11 / S2 2. yarı ilk 11 / en uzun süresiz seri (medyan · maks) | Sonra |
|---|---|---|
| 16 | %65 · %52 · %17 / %15 / %51 / 2 · 11 | %68 · %61 · %35 / %21 / %52 / 2 · 4 |
| 17 | %70 · %63 · %33 / %23 / %52 / 2 · 10 | %75 · %75 · %39 / %33 / %63 / 2 · 3 |
| 18 | %69 · %62 · %10 / %26 / %61 / 2 · 16 | %76 · %64 · %36 / %38 / %62 / 2 · 4 |

Hedefler (S1 ≥ ~%60 süre, 2. sezon ortası ≥ %25 ilk 11) tutuyor; en düşük kariyerler kaleciler (S1 %37–46).

**2. Hafta canlı** (`sim/game/agenda.ts`, `weekIdeas.ts`, `match.ts` U21/antrenman maçı, `ui/screens/bench/*`):
"Bugünün programı" (zorunlu görevler gün ilerletmeyi kilitler; hızlı çöz / oyna-karar ver / bazıları sonuçlu atla),
rakibin gerçek kadrosundan okunan hazırlık hedefleri (+2 maç içi özellik, +%3 şans), U21 (46') ve çift kale (61')
maçları canlı maç akışında, hocanın sınavı (A notu hedefli drill), takım arkadaşıyla birebir (haftada 2), teknik
direktörle konuşma (haftada 1), "Atladığın günler" notu (haftada en çok 1, engellemez). Maç gününe atla açık zorunlu
görevleri tek onayla hızlı çözer; otopilot gün sonunda kalanları hızlı çözer (sim hiç takılmaz).

Zorunlu görev yükü (6 kariyer × 2 sezon): sezon içi haftada 1,96 (hedef ~2–4); çeşit: takım antrenmanı,
gelişim görüşmesi, toparlanma, fizyo, sponsor çekimi, doping testi, doğum günü, disiplin kurulu, akşam yemeği, basın.

BALANCE (30 × 10), son kod, tohum 1000 · 2000 · 3000:

| Ölçüt | Değer | Hedef |
|---|---|---|
| İtibar 18 / 21 / 25 | 13/53/77 · 15/54/78 · 17/54/79 | ~15 / ~50 / 75–85 |
| OVR medyanı 21 / 25 | 76/81 · 75/81 · 76/82 | değişmedi |
| Pot ≥ 85: 25'e kadar OVR 80+ | 9/9 · 11/11 · 11/11 | çoğunluk |
| İlk 1. kademe yaşı | 20,0 · 20,0 · 20,0 | 21–23 (bilinen sınır) |
| 3. sezon net servet medyan | 142K · 146K · 138K | ≤ 300K |
| Kumarhane payı kumarbaz / herkes | %15/%2 · %22/%2 · %16/%3 | %15–35 / ≤ %5 |
| İflas | %0 | ≤ %5 |

**Golden master bilinçli olarak yenilendi** (`UPDATE_GOLDEN=1`, aynı commit): kariyer akışı değişti (seçim
terimleri, planlı kamera, günlük programın otomatik çözümü).

### Kariyer sonu itibarı (Tur 6): savunma hattı ünü

Sorun: 46cb0b7 sonrası tam rapor (30 kariyer × 8 sezon) Oyun Kurucu Stoper +%6,5, Hücumcu Bek +%7,9, Defansif Bek
−%7,3 verdi. Teşhis (CB+LB, 30 kariyer): yeni sistemler sürücü değil. Planlı kamera kapalı (Hücumcu/Defansif Bek
64,9 / 57,0) ve seçim terimleri kapalı (65,1 / 59,8) aynı farkı veriyor; eski kod (1055188) farklı tohumla (9000)
de Oyun Kurucu Stoper +%8,2, Hava Hakimi −%7,9 çıkarıyor. Tur 5'in ±%5'i tohum şansıydı. Yapısal sebep: maç itibarı
gol × 0,45 + asist × 0,25 + reyting; savunmanın karşılığı yoktu (Hücumcu Bek 36 gol + 32 asist, Defansif Bek 18 + 19,
reyting eşit 6,33 / 6,30).

Değişiklik (`career/matchOutcome.ts`, `backLineFame`): stoper ve bekler maç itibarına top kapma başına +0,05 ve
60 dakika+ gol yemeden bitirilen maç için +0,3 alır (aynı sahne, ölçek ve azalan getiri). Defansif orta saha ve
kaleci hariç (kalecinin itibarı zaten en yüksek). Savunmacıların itibar düzeyi ~+8 (CB 63 → 72, LB 61 → 68).

| Rol | Son itibar önce | Δ | Sonra | Δ |
|---|---|---|---|---|
| CB stopper / aerialDefender / ballPlayingDefender | 62 / 60 / 67 | −1,7 / −4,8 / +6,5% | 72 / 70 / 75 | −0,3 / −3,2 / +3,5% |
| LB balanced / attacking / defensive | 61 / 66 / 57 | −0,6 / +7,9 / −7,3% | 67 / 70 / 67 | −1,2 / +2,3 / −1,1% |

Tohum 9000 kontrolü (30 kariyer): CB +2,9 / −2,0%, LB +4,4 / −3,6% (önce +3,8 / −6,4%). Diğer mevkiler değişmedi;
24 rolün beş ölçütü ±%5 içinde (en uç: Ters Kanat itibarı +%5,0 ve Çizgi Kanadı oynanan reyting +%4,4, ikisi de
bu değişiklikten bağımsız ve önceki raporla aynı).

BALANCE (30 × 10), tohum 1000 · 2000 · 3000: itibar 18/21/25 15/56/78 · 15/53/82 · 17/51/82 (hedef ~15/~50/75–85);
OVR 21/25 76/81 · 76/82 · 76/82; ilk 1. kademe / elit yaşı 21,0/23,0 · 20,0/23,0 · 21,0/22,5; 3. sezon servet
139K · 131K · 162K; iflas %3 (kumarbaz) · %0 · %0; kumarbaz payı %12 · %23 · %21 (1000'de 6 kumarbazlık örneklem gürültüsü).
PLAYTIME (24 kariyer): S1 süre %70 / %72 / %76, S2 ikinci yarı ilk 11 %56 / %60 / %66, en uzun süresiz seri medyan 2,
maks 5 / 6 / 4; HEAD ile aynı (itibar seçimi etkilemiyor). Golden master değişmedi.
## TestFlight build 4: günlük plan kaldırıldı, zorunlu görev sıklığı, rakip video analizi

**Günü planla kaldırıldı:** Sabah / Öğleden sonra / Akşam dilim seçicileri yok; gün, Ana Sayfa'daki günlük
programla (Zorunlu + Önerilen) ilerliyor. Etkinlikler "Aktiviteler" ekranından doğrudan yapılıyor (zaman ve enerji
eskisi gibi harcanıyor); eski `planner` rotası `activities`'e yönleniyor. Koç turu: planner/planSlot adımları yerine
tek "Günün programı" adımı.

**Zorunlu görev yükü** (`sim/game/agenda.ts`): haftalık bütçe 4 → 6 (görev başına sayılıyor, `c:agendaHist`); maç
günü ve maçtan iki gün sonraki izin günü boş, diğer günlerin ~%90'ında bir görev, ~%20'sinde ikinci görev. Yeni
sıradan görevler: takım toplantısı, zorunlu kuvvet çalışması, kondisyon testi, kulüp TV röportajı, okul ziyareti
(hızlı çöz / oyna / atla). Ölçüm: agenda.test (3 tohum) haftada 4,85, günlerin %37'si boş, %6'sı iki görevli;
PLAYTIME (6 kariyer × 2 sezon) haftada 5,13 (önce 1,96). En sık tür toplam görevlerin < %35'i.

**Rakip video analizi** (`sim/game/oppScouting.ts`, `game/training/scouting.ts`): rakibin gerçek kadrosu/stilinden
4 klip, 3 seçenek; skor → not → o maç için önsezi + pozisyon alma (kaleci: önsezi, kaleci pozisyonu, refleks)
S +4 · A +3 · B +2 · C +1, önsezi/vizyon XP. Otopilot oynamadığı için denge ölçümlerini etkilemiyor.

BALANCE (30 × 10), tohum 1000 · 2000 · 3000: itibar 18/21/25 13/55/82 · 14/55/81 · 19/56/81 (hedef ~15/~50/75–85);
OVR 21/25 75/81 · 76/81 · 77/82; pot ≥ 85 için 25'e kadar OVR 80+ 9/9 · 11/11 · 11/11; kumarhane payı (herkes)
%4 · %2 · %3; iflas %0 · %0 · %3 (pro). PLAYTIME (yaş başına 12 kariyer): S1 süre %71 / %75 / %75, S2 ikinci yarı
ilk 11 %60 / %64 / %62, süresiz seri medyan 2. Rol dengesi (rol başına 12 kariyer × 8 sezon): kariyer OVR ±%1,4,
kariyer reytingi ±%2,0 içinde; itibar 22/24 rol ±%5 içinde, Ters Kanat +%5,1 ve Teknik Çalımcı −%5,1 sınırda
(12 kariyerlik itibar gürültüsü; önceki raporda da Ters Kanat +%5,0). **Golden master bilinçli olarak yenilendi**
(`UPDATE_GOLDEN=1`, zorunlu görev commit'i): otopilot daha çok görevi hızlı çözüyor.

## Niyet ve özellik eğrileri (Ekim 2026, playtester build 7)

"Tek bir maç mini oyununu kazanamadım": gerçek girdi yollarıyla oynayan "mantıklı insan" botu (`game/src/game/intentHarness.ts`, test `intent.test.ts`; rapor `INTENT_REPORT=1 INTENT_CURVES=1`). Normal zorluk, yarım yardım, takımlar OVR 62, N=150, deterministik seed.

Başlangıç kahramanı (OVR 57), iyi girdi — önce → sonra: 1v1 köşe vuruşu %39 (aut %17) → %74 (aut %3); ŞUT düğmesi %55 → %73; koşarken PAS (çubuk ileri) %29 → %77; pas %97 → %91; ara pas %94 → %81; orta %99 → %83; müdahale (ilk temas) %37 → %64. Önce pas / ara pas / orta özelliklerden bağımsızdı (düz), müdahale 40–60 arasında düzdü.

Özellik eğrisi (ilgili özellikler = X; `game/momentSkill.ts`), iyi / özensiz girdi:

| tür | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| 1v1 şut (Bitiricilik/Soğukkanlılık/Şut/Falso) | 55 / 31 | 65 / 38 | 73 / 43 | 79 / 47 | 83 / 51 | 87 / 51 |
| pas (Pas/Vizyon/İlk dokunuş) | 83 / 39 | 87 / 39 | 90 / 47 | 92 / 51 | 94 / 57 | 96 / 59 |
| ara pas (Vizyon/Pas/Uzun pas) | 73 / 47 | 77 / 51 | 82 / 51 | 84 / 47 | 87 / 47 | 90 / 49 |
| orta (Orta/Falso) | 71 / 31 | 80 / 35 | 85 / 43 | 91 / 49 | 94 / 55 | 96 / 61 |
| müdahale (Top kapma/Önsezi/Agresiflik/Pozisyon) | 38 / 18 | 52 / 23 | 63 / 28 | 76 / 37 | 78 / 39 | 83 / 37 |

Ayarlar: `HERO_FRAME_SAFE`, `HERO_PLACED_BEAT`, `HERO_FINISH_EDGE`, `HERO_PASS_MISHIT`, `HERO_THROUGH_MISHIT`, `HERO_THROUGH_SPREAD`, `HERO_CHARGE_DOWN`, `HERO_CROSS_BLOCK`, `HERO_TACKLE`, `HERO_LUNGE_TIMING` (runtime.ts); `SHOT_INTENT_*`, `BUTTON_PASS_*`, `heroMisHit` (kick.ts). Arka plan simülasyonu değişmedi (golden aynı; BALANCE=1 1000/2000/3000 geçti). Rol denge spot kontrolü (ST 3 rol + LW 4 rol, 12 kariyer): tüm Δ ±%4 içinde.

## Agenda minigames (Ekim 2026, ajanda / kulübe mini oyunları denge çalışması)

Sahip: "her şey statlara uysun, her mini oyun başarılabilir olsun". Kapsam: diyalog sahneleri
(milli kamp, TD odası, takım yemeği), doping testi, rakip videosu, ajanda görevlerinin oynanan
ödülleri. Ölçüm: simüle edilmiş İYİ ve ÖZENSİZ oyuncu, stat 40..90, seviye başına 300–400 deneme,
seeded `Rng`. Başarı = geçer not (diyalog: uyum ≥ 0,60; doping/video: B ve üstü, skor ≥ 0,60).
Başlangıç kahramanı: Soğukkanlılık/Liderlik ~31–41, oyun okuma ~37–45 (kaleci Soğukkanlılık ~67).

Testler: `sim/game/agendaMinigames.balance.test.ts` (diyalog + ajanda ödülleri),
`ui/screens/bench/dopingRules.test.ts`, `sim/game/oppScoutingBalance.test.ts`, `sim/game/oppScouting.test.ts`.

### Kök nedenler (önce)

- **Diyalog sahneleri**: sabit cevap tabloları; stat hiçbir şey yapmıyordu. Uygun cevaplar her zaman
  kazanıyordu (iyi %100, her statta aynı). How-to kartı "Liderlik ve Soğukkanlılık güven kazandırır" diyordu
  ama kodda karşılığı yoktu. İpucu metinleri hangi cevabın uyduğunu tam söylemiyordu.
- **Doping testi**: herkese aynı bant (±0,13) ve aynı form süresi (8 sn); Soğukkanlılık etkisizdi.
- **Rakip videosu**: herkese aynı klip hızı ve puan; Önsezi/Vizyon etkisizdi.
- **Ajanda seçimleri**: itiraz şansı sabit %35, basın toplantısı sabit değerler, kondisyon testi tek eşik (0,75).

### Yeni model

- **Diyalog uyumu** = 0,64 × cevap uyumu + 0,26 × stat01((Soğukkanlılık+Liderlik)/2) + 0,06 × ilişki + N(0; 0,10)
  (sahnenin kendi RNG çatalı: aynı kayıt + aynı cevap = aynı sonuç). Tüm etkiler uyuma göre ölçeklenir:
  hoca ilişkisi −4..+12, TD güveni 0..+5 (hızlı konuşma 2,5), ilişki −4..+6, yemek arkadaşı +1..+10,
  soyunma odası −0,5..+2,5. İpuçları artık uyan tonları sayıyor; yemek için kişilik → konu rehberi;
  sonuç kartında "Uyum %X · cevap uyumu %Y · Soğukkanlılık + Liderlik Z".
- **Doping** (`dopingRules.ts`): bant ±(0,06 + 0,09·c), el titremesi 0,10·(1−c), tam puan form süresi
  3,8 + 5·d sn (c = stat01(Soğukkanlılık), d = stat01((Soğukkanlılık+disiplin)/2)). Giriş kartı statı gösterir.
- **Video**: oyun okuma = ort(Önsezi, Vizyon, Pozisyon alma) (kaleci: Kaleci Pozisyonu). Klipler ×1..×1,5
  ağır çekim (daha uzun cevap/tam puan penceresi), çıkarım ×0,9..×1,1; not, bonus ve XP nihai skora göre.
  Oyun kuralları (`game/training/scouting.ts`) değişmedi; overlay saati yavaşlatır.

### Eğriler (başarı %)

Milli kamp (Soğukkanlılık = Liderlik):

| oyuncu | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 70 | 81 | 90 | 93 | 97 | 98 |
| özensiz | 13 | 21 | 28 | 37 | 45 | 56 |
| önce (iyi / özensiz, her statta) | 100 / 54 | | | | | |

TD odası:

| oyuncu | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 66 | 76 | 86 | 91 | 95 | 96 |
| özensiz | 16 | 22 | 29 | 35 | 42 | 49 |
| önce (iyi / özensiz) | 100 / 34 | | | | | |

Takım yemeği:

| oyuncu | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 71 | 79 | 85 | 90 | 92 | 94 |
| özensiz | 15 | 23 | 28 | 35 | 43 | 52 |
| önce (iyi / özensiz) | 100 / ~22 | | | | | |

Doping testi (Soğukkanlılık = disiplin; iyi: 0,28 sn tepki, özensiz: 0,42 sn + dalgınlık + yanlış sıra):

| oyuncu | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi geçer | 75 | 96 | 99 | 99 | 100 | 100 |
| iyi ort. skor | 0,64 | 0,74 | 0,81 | 0,87 | 0,92 | 0,96 |
| özensiz geçer | 0 | 5 | 10 | 18 | 21 | 33 |
| önce (iyi / özensiz, her statta) | 100 / ~20 (ort. 0,91 / 0,45) | | | | | |

Rakip videosu (oyun okuma; iyi: alışkanlık görününce ~1,7 sn sonra, %85 doğru; özensiz: 0,8–4 sn rastgele, %40 doğru):

| oyuncu | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi geçer | 60 | 74 | 85 | 88 | 88 | 88 |
| iyi ort. skor | 0,65 | 0,69 | 0,72 | 0,75 | 0,79 | 0,82 |
| özensiz geçer | 20 | 20 | 20 | 20 | 20 | 20 |
| özensiz ort. skor | 0,36 | 0,38 | 0,39 | 0,40 | 0,42 | 0,43 |
| önce (iyi / özensiz, her statta) | 73 / 20 | | | | | |

İyi oyuncunun videoda %88 tavanı: 4 klipten 2'sini yanlış okuyan oturum (≈%11) geçemez; bu kasıtlı.

### Ödüller sime ulaşıyor ve performansla ölçekleniyor

| mini oyun | etki | ölçek |
|---|---|---|
| Milli kamp | hoca ilişkisi (çağrı metresi), moral, yorgunluk, Pozisyon XP | ilişki −4 + 16·uyum; moral 1 + 3·uyum; XP 1 + 3·uyum |
| TD odası | güven (ilk 11 şansı), ilişki, moral, gelişim XP | güven 5·uyum; ilişki −4 + 10·uyum; XP 1 + 3·uyum |
| Takım yemeği | yemek arkadaşı, tüm takım, mutluluk, Vizyon XP, hesap | bağ 1 + 9·uyum; takım −0,5 + 3·uyum; mutluluk 1 + 3·uyum |
| Doping | Soğukkanlılık XP, moral, disiplin | XP 2 + 6·skor; disiplin 0/+1/+2 (<0,35 / orta / ≥0,6); moral −1/+1/+2 |
| Video | maç bonusu (Önsezi/Pozisyon), Önsezi/Vizyon XP | bonus S4 A3 B2 C1 D0 nihai skora göre; XP 1,5 + 3·skor |
| İtiraz | ceza −1 maç şansı | 0,15 + 0,4·stat01(Soğukkanlılık) + disiplin terimi (%10–65) |
| Basın toplantısı | basın/taraftar/hoca/moral | taban × (0,6 + 0,8·stat01(Soğukkanlılık)) |
| Kondisyon testi | güven | 0 (≤0,4) .. +1 (1,0), sürekli |
| 1'e 1 (değişmedi) | XP, takım arkadaşı | zaten skorla ölçekli (×0,5..×1,33; ilişki 2..+5) |

Hızlı çözüm yolları ve otopilot değişmedi: golden master aynı kaldı.


## Antrenman drilleri (Training drills, Ekim 2026, oyuncu-test build 8)

Oyun testçisi (gerçek bir futbolcu) hiçbir drilde başarılı olamadı: rakipler çok hızlı yakaladı, pas seçeneği yoktu, paslar alınmadı. Tüm driller (antrenman + deneme drilleri) gerçek girdi yolundan oynayan botlarla ölçüldü.

### Ölçüm (`game/src/game/training/drillCurves.test.ts`)
- Botlar `drillBots.ts`: karar botu + **insan girdi profili** (`humanize`): iyi = 0,10 sn gecikme, ±0,05 sn zamanlama, ±0,5 m nişan, ±0,05 güç, çubuk sapması 0,12 rad; özensiz = 0,22 sn, ±0,12 sn, ±1,5 m, ±0,14, 0,32 rad. Eski botlar kusursuz bilgiyle oynuyordu (çoğu drilde her seviyede %95–100): insan için ayar yanlış ölçülmüştü.
- Kahraman seviyesi v: tüm özellikler v. Rakip seviyesi varsayılan 56 (`DrillConfig.opponent`); oyunda `trainingOpponentLevel` = 56 + 0,4·(kadro − 56) + zorluk.
- `DRILL_CURVES=1 DRILL_OUT=dosya npx vitest run src/game/training/drillCurves.test.ts` tabloları yazar; sabitlenmiş test her drilde: 50'de %55–80, monoton, 90 ≥ 50 + 15, özensiz geride, güçlü rakip daha düşük.
- Puan → performans: her drilin parı insan botuyla yeniden ölçüldü (iyi girdi, seviye 50 ≈ 0,67 = B); tekrar sayısı sabit olan drillerde eğri üssü (`DRILL_CURVE` / `VARIANT_CURVE`) dikleştirildi ki not özelliği izlesin.

### Kök nedenler ve düzeltmeler
- **Top kapma**: kesme hamlesi menzilin dışında başlıyordu (1,9–2,8 m > 1,33 m menzil), açık top penceresi ~0,14 sn. Artık topçu menzil + 0,5–1,2 m'de keser, keserken topu açar (0,25 sn basma), pencere geniş; kaçış hızı topçunun hızına bağlı. Düello oranı antrenman eğimiyle (`drillTackleOdds`). Önce iyi girdi 50'de %10.
- **Bitiricilik / kafa / serbest vuruş kalecisi**: hızlı kaleci dalışta topun yanından geçip gidiyordu (güçlü kaleci daha çok gol yiyordu). Dalış mesafesi topa göre, gövde de bloklar, standart derinlik; kurtarış oranı kaleci kalitesiyle (`drillSaveChance`). Antrenman kalecisi şutu 0,15 sn geç okur, baraj 0,06 sn perdeler.
- **Serbest vuruş**: ortaya vuran özensiz oyuncu iyi oyuncudan çok puan alıyordu. Kapılar artık kalenin dış üçte birleri: gol 20, kapıya giden kurtarılan vuruş 4, kalecinin ortası 2. Kaleci uzak direğe 0,8 m kayık.
- **Pas**: her seviyede %98 (özellik etkisiz). Pas hatası beceriye göre (`drillNoise`) ve alıcının ayağına isabet bonusu.
- **Rondo**: presçi topun 0,8 m önünde duruyordu, kenar paslar hep kesiliyordu (seçenek yok); rakipler özelliksizdi. Artık presçi saldırganlığa göre 1,1–1,6 m'de, ayağın dibinde blok yok, savunmacılar pası tepki süresiyle okur, baskı pas hatasını artırır, ilk dokunuş tek dokunuş penceresini açar.
- **Slalom**: beceri hamlesi oyuncuyu bir sonraki kapının ters tarafına atıyordu (kusursuz bot bile kapıların yarısını kaçırıyordu). Artık kapının tarafına; zigzag ±2,2 m; top kontrolü, dönüş ve kapıya hizalama Top Sürme / Çeviklik ile; mankenlerin özellikleri beceri penceresini daraltır.
- **Oyun okuma / pres**: pasörler sabit 70'ti, davranış zorluktan geliyordu (güçlü rakip daha kolaydı). Artık tutma, pas hızı, ipucu gizleme pasörlerin özelliklerinden; Önsezi menzil ve ipucunu, İş Gücü pres hızını büyütür.
- **Kaleci**: rakip şutörün gücü/yerleşimi kendi özelliklerinden; kahraman kalecinin kol boyu Plonjon, ayakta menzil Refleks ile; dışarı giden şut (açı kapatıldı) 2 puan, ki zayıf şutör kaleci puanını düşürmesin.
- **Çıkış**: kanat ve forvet rakip seviyesinde; forvet itişmeye ve pas alanını daraltmaya özellikleriyle girer.
- **Mekik**: 70 üstü herkes tavana vuruyordu; bip hızı seviye başı 0,45 → 0,6 m/sn.
- **Sprint / temas**: süre bonusu 3,6 sn altı her 0,1 sn için 10 (eskiden 7, 70'te tavan).

### Eğriler (başarı %, 16–64 tohum ortalaması)

#### finishing (finishing, shooting, composure)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 55 | 68 | 76 | 84 | 84 | 89 |
| özensiz | 35 | 35 | 35 | 37 | 39 | 44 |
| iyi, yalnız ilgili özellik | 63 | 68 | 76 | 77 | 86 | 89 |

Önce (iyi, 50): 59 → şimdi 68. Rakip 40 / 56 / 72 (kahraman 50, iyi): 77 / 68 / 60.

#### setPiece (setPieces, curve)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 54 | 60 | 65 | 86 | 89 | 91 |
| özensiz | 40 | 44 | 46 | 53 | 39 | 42 |
| iyi, yalnız ilgili özellik | 59 | 60 | 75 | 78 | 83 | 87 |

Önce (iyi, 50): 62 → şimdi 60. Rakip 40 / 56 / 72 (kahraman 50, iyi): 80 / 60 / 55.

#### passing (passing, vision, firstTouch)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 58 | 68 | 73 | 82 | 86 | 89 |
| özensiz | 14 | 14 | 17 | 17 | 17 | 18 |
| iyi, yalnız ilgili özellik | 64 | 68 | 71 | 71 | 74 | 78 |

Önce (iyi, 50): 98 → şimdi 68.

#### rondo (passing, vision, firstTouch)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 57 | 67 | 81 | 96 | 100 | 100 |
| özensiz | 20 | 24 | 23 | 27 | 27 | 26 |
| iyi, yalnız ilgili özellik | 56 | 67 | 77 | 92 | 99 | 100 |

Önce (iyi, 50): 100 → şimdi 67. Rakip 40 / 56 / 72 (kahraman 50, iyi): 75 / 67 / 64.

#### dribbling (dribbling, agility, firstTouch)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 57 | 67 | 76 | 79 | 83 | 93 |
| özensiz | 16 | 17 | 20 | 22 | 27 | 28 |
| iyi, yalnız ilgili özellik | 63 | 67 | 71 | 74 | 77 | 80 |

Önce (iyi, 50): 62 → şimdi 67. Rakip 40 / 56 / 72 (kahraman 50, iyi): 68 / 67 / 62.

#### fitness (stamina, pace)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 56 | 67 | 67 | 78 | 89 | 100 |
| özensiz | 20 | 20 | 29 | 37 | 46 | 55 |
| iyi, yalnız ilgili özellik | 56 | 67 | 67 | 78 | 89 | 100 |

Önce (iyi, 50): 77 → şimdi 67.

#### goalkeeping (reflexes, handling, gkPositioning, diving)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 64 | 64 | 71 | 78 | 83 | 87 |
| özensiz | 28 | 34 | 36 | 37 | 40 | 40 |
| iyi, yalnız ilgili özellik | 62 | 64 | 71 | 77 | 84 | 84 |

Önce (iyi, 50): 86 → şimdi 64. Rakip 40 / 56 / 72 (kahraman 50, iyi): 69 / 64 / 59.

#### diving (diving)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 55 | 61 | 71 | 75 | 85 | 90 |
| özensiz | 34 | 35 | 36 | 40 | 39 | 43 |
| iyi, yalnız ilgili özellik | 57 | 61 | 63 | 68 | 71 | 77 |

Önce (iyi, 50): 39 → şimdi 61. Rakip 40 / 56 / 72 (kahraman 50, iyi): 63 / 61 / 58.

#### crossing (crossing, curve)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 61 | 67 | 79 | 92 | 94 | 98 |
| özensiz | 36 | 34 | 43 | 46 | 51 | 51 |
| iyi, yalnız ilgili özellik | 63 | 67 | 79 | 86 | 93 | 96 |

Önce (iyi, 50): 67 → şimdi 67.

#### switch (longPassing)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 57 | 67 | 75 | 83 | 88 | 92 |
| özensiz | 31 | 31 | 31 | 35 | 36 | 42 |
| iyi, yalnız ilgili özellik | 62 | 67 | 74 | 77 | 83 | 87 |

Önce (iyi, 50): 76 → şimdi 67.

#### heading (heading, jumping)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 54 | 66 | 73 | 85 | 90 | 93 |
| özensiz | 26 | 29 | 29 | 26 | 33 | 38 |
| iyi, yalnız ilgili özellik | 60 | 66 | 74 | 83 | 92 | 96 |

Önce (iyi, 50): 56 → şimdi 66. Rakip 40 / 56 / 72 (kahraman 50, iyi): 82 / 66 / 35.

#### tackling (tackling, positioning)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 50 | 65 | 71 | 84 | 96 | 100 |
| özensiz | 4 | 8 | 12 | 12 | 19 | 17 |
| iyi, yalnız ilgili özellik | 55 | 65 | 68 | 72 | 82 | 90 |

Önce (iyi, 50): 10 → şimdi 65. Rakip 40 / 56 / 72 (kahraman 50, iyi): 73 / 65 / 43.

#### distribution (gkDistribution, handling)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 60 | 66 | 71 | 80 | 88 | 89 |
| özensiz | 15 | 14 | 17 | 21 | 21 | 25 |
| iyi, yalnız ilgili özellik | 59 | 66 | 72 | 76 | 84 | 86 |

Önce (iyi, 50): 86 → şimdi 66. Rakip 40 / 56 / 72 (kahraman 50, iyi): 70 / 66 / 62.

#### sprint (acceleration)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 64 | 67 | 74 | 80 | 84 | 90 |
| özensiz | 8 | 7 | 7 | 6 | 6 | 7 |
| iyi, yalnız ilgili özellik | 67 | 67 | 71 | 74 | 77 | 81 |

Önce (iyi, 50): 82 → şimdi 67.

#### contact (balance)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 61 | 67 | 75 | 80 | 85 | 91 |
| özensiz | 5 | 6 | 9 | 10 | 10 | 10 |
| iyi, yalnız ilgili özellik | 64 | 67 | 69 | 70 | 72 | 74 |

Önce (iyi, 50): 99 → şimdi 67.

#### reading (anticipation)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 44 | 67 | 77 | 88 | 93 | 98 |
| özensiz | 4 | 5 | 5 | 8 | 7 | 8 |
| iyi, yalnız ilgili özellik | 60 | 67 | 72 | 79 | 82 | 88 |

Önce (iyi, 50): 64 → şimdi 67. Rakip 40 / 56 / 72 (kahraman 50, iyi): 79 / 67 / 48.

#### pressing (workRate)

| girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi | 62 | 67 | 73 | 80 | 83 | 87 |
| özensiz | 6 | 6 | 8 | 9 | 10 | 14 |
| iyi, yalnız ilgili özellik | 62 | 67 | 69 | 69 | 72 | 73 |

Önce (iyi, 50): 90 → şimdi 67. Rakip 40 / 56 / 72 (kahraman 50, iyi): 71 / 67 / 63.

Notlar: serbest vuruşta 5 vuruşluk rastgelelik yüzünden iyi/özensiz farkı 40–50'de ~14–16 puan (diğer tüm seviyelerde ve drillerde ≥ 20). Özensiz kaleci rastgele dalışla hiç kıpırdamayandan kötü olabilir (gerçekçi). Simülasyon değişmedi (drill puanı yalnız oynanan seansın performansı): golden master aynı.

## Playtester build 8: adil maç anları, her şey stata bağlı (Ekim 2026)

Dört şikâyet (TestFlight build 8): (1) "yanımdaki adama temiz pas atıyorum, kontrol edemiyor, rakip alıyor"; (2) "rakip çok hızlı kapanıp topu hemen alıyor"; (3) "son çizgi koşusu: takım arkadaşım bana pas vermeden top kaptırdı, an oynamadan bitti"; (4) "koşarken arkamdaki rakip hemen yetişiyor, sağda solda pas seçeneği yok". Sahip: her düzeltme bir stat eğrisi olsun, düz bonus değil; oyuncu rakibin statlarını görsün.

Ölçüm: `game/src/game/intentHarness.ts` (gerçek girdi yolları; yeni metrikler `shortPassReception`, `pressureRate`, `setupLossRate`, `breakawayRate`, `supportRate`; `TrialSetup` ile takım arkadaşı / rakip / kaleci statları), tüm türler için `game/src/game/kindMatrix.ts` (insan benzeri bot, `KIND_MATRIX=1`). Sabitlenen eğriler: `game/src/game/balance8.test.ts`. Normal zorluk, yarım yardım, takımlar OVR 62, başlangıç kahramanı OVR 57, deterministik seed. "Önce" = build 8 (HEAD) runtime.

### Kök nedenler

1. **Pas alma:** (a) alıcı topu karşılamıyordu: topun çizgisine 0,7 m toleransla yavaşlayarak gidip topun önünde 1 m geri geri kaçıyordu; (b) top kendisine atılan adam da herkes gibi genel AI tepki süresini bekliyordu; (c) pas çizgisindeki başka bir arkadaş topa sert dokunup bozuyordu; (d) koşan adama pas 9 m önüne atılıyordu (kısa pas ara pasa dönüyordu). Pas hızı ve rakip kesme yarıçapı sorun değildi (kesilme %1–3).
2. **Anında top kaptırma:** başlangıçta hiçbir koruma yoktu (kaleci dahil); AI'ın sprint deposu sonsuzdu (kahramanınki bitiyordu); topla koşmak %5–10 yavaşlatıyordu; arkadan gelen müdahale adamın gövdesine 1,2 m yetince topa yetmiş sayılıyordu.
3. **Kurgu fazı:** açılışta topu taşıyan AI arkadaşına (timed_run'da 4 s bekleyen pasör) normal müdahaleler uygulanıyordu: %15 kayıp. Tüm türler tarandı: sadece long_ball_control / header / shoulder_duel / timed_run AI arkadaşla açılıyor; hepsi artık pasını atana kadar korunuyor (senaryo kuralı, stat değil).
4. **Kovalayan rakip ve pas seçeneği:** (2)'deki depo + top-yavaşlığı + arkadan müdahale; destek koşusu yoktu (arkadaşlar sadece formasyon çapasına göre yer alıyordu).

### Önce / sonra (başlık metrikleri)

| metrik | önce | sonra |
|---|---|---|
| temiz kısa pas alındı (5–18 m, boş adam, iyi girdi), pas statları 40 / 65 / 90 | %87.7 / %94.2 / %96.4 | **%90.5 / %97.8 / %99.3** |
| aynı, özensiz girdi 40 / 65 / 90 | %69 / %83 / %85 | %56 / %71 / %84 (iyi − özensiz ≥ 20 puan) |
| topla ilerlerken ilk 1,5 s'de kaptırma (hold_up hariç) | %12.4 | **%1.1** |
| hiç kıpırdamadan ilk 1,0 s'de kaptırma | %2.7 | **%0** |
| kurgu fazında top kaybı (4 tür; timed_run) | %3.8 (timed_run %15) | **%0 (%0)** |
| eşit hızda kovalayanın yakalaması (Hız/İvme 40 / 65 / 90) | %40 / %27.5 / %17.5 | **%0 / %0 / %0** |
| destek: topla en az bir pas seçeneği olan an (7 kurulum türü) | %98.4 | %100 |

### Stat eğrileri (40 → 90)

Kısa pas, pasörün pas statları (Pas / Vizyon / İlk dokunuş):

| | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|
| iyi, önce | 88 | 90 | 92 | 94 | 94 | 96 |
| iyi, sonra | 91 | 95 | 97 | 98 | 99 | 99 |
| özensiz, sonra | 56 | 58 | 71 | 71 | 77 | 84 |
| alıcının İlk dokunuş / Önsezi'si, sonra | 94 | 95 | 97 | 97 | 96 | 96 |

Alıcı etkisi boş adama kısa pasta küçüktür (yakında rakip yoksa sert ilk dokunuş geri toplanıyor); baskı altında büyür. Alıcının yardımı (`RECEIVE`, `receiveReact`, `receiveWeight`): tepki Önsezi'ye (0,18 s → 0,04 s), uzanma ve yastık İlk dokunuş'a, hepsi pas kalitesine (pasörün icrası) bağlı; ara pasta yardım sadece iyi ağırlıklı topta (`throughWeight`).

Niyet eğrileri (sonra; önce parantezde 40 / 90):

| tür | girdi | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| pas | iyi | 88 | 90 | 95 | 96 | 97 | 98 (83 / 96) |
| pas | özensiz | 46 | 47 | 54 | 57 | 61 | 65 |
| ara pas | iyi | 75 | 81 | 87 | 91 | 89 | 88 (73 / 90; N=300'de monoton) |
| ara pas | özensiz | 43 | 45 | 47 | 47 | 48 | 47 |
| müdahale | iyi | 36 | 47 | 56 | 68 | 71 | 77 (37 / 82) |
| müdahale | özensiz | 16 | 21 | 25 | 28 | 32 | 34 |
| 1v1 şut | iyi | 54 | 60 | 71 | 81 | 84 | 88 (55 / 87) |
| 1v1 şut | özensiz | 33 | 36 | 41 | 47 | 49 | 52 |

Topla koşarken 6 s içinde top kaybı %: kahramanın Dribbling / Güç / Denge / Çeviklik'i (satır) × rakibin Top kapma / Agresiflik'i (sütun), önce → sonra:

| kahraman \ rakip | 40 | 65 | 90 |
|---|---|---|---|
| 40 | 75 → 47 | 87 → 55 | 91 → 59 |
| 65 | 56 → 27 | 75 → 36 | 82 → 45 |
| 90 | 24 → 9 | 40 → 18 | 59 → 30 |

Zayıf kahraman güçlü rakibe karşı hâlâ çoğunlukla topu kaybediyor (%59), güçlü kahraman zayıf rakibe karşı neredeyse hiç (%9).

Saf kaçış (orta sahadan 35 m, bir kovalayan 3 m arkada): yakalanma %, kahramanın Hız/İvme'si (satır) × kovalayanınki (sütun), önce → sonra:

| kahraman \ kovalayan | 40 | 65 | 90 |
|---|---|---|---|
| 40 | 40 → 0 | 57 → 21 | 61 → 19 |
| 50 | 15 → 0 | 50 → 3 | 59 → 21 |
| 60 | 0 → 0 | 41 → 0 | 43 → 9 |
| 70 | 0 → 0 | 19 → 0 | 55 → 4 |
| 80 | 0 → 0 | 3 → 0 | 39 → 0 |
| 90 | 0 → 0 | 0 → 0 | 18 → 0 |

Eşit hızda kimse yetişmiyor; açıkça daha hızlı kovalayan hâlâ gerçek tehdit (40'a karşı 65/90: ~%20). Arkadan gelen müdahale sadece topa yetişirse ve ×0,6 kazanma şansıyla.

Rakip kendi statlarıyla oynar (aynı an, sadece ilgili rakibin statları değişiyor):

| | rakip 40 | 65 | 90 |
|---|---|---|---|
| 1v1 şut gol %, kalecinin Refleks / Atlayış / Pozisyon / Top tutma'sı (önce 77 / 74 / 61) | 79 | 77 | 53 |
| müdahale kazanma %, taşıyanın Dribbling / Çeviklik / Denge / Güç'ü (önce 68 / 57 / 38) | 67 | 57 | 34 |

### Baskı ve destek, tür bazında (önce → sonra, %)

| tür | ilk 1,5 s kaptırma (koşarak) | 6 s içinde kayıp (koşarak) | en az bir seçenekli an | örneklerin seçenekli payı | iki yanda seçenek |
|---|---|---|---|---|---|
| build_up | 20 → 0 | 77 → 33 | 100 → 100 | 91 → 94 | 62 → 72 |
| counter | 0 → 3 | 83 → 63 | 100 → 100 | 80 → 75 | 38 → 37 |
| edge_of_box | 20 → 0 | 23 → 0 | 100 → 100 | 79 → 82 | 48 → 42 |
| hold_up (yanlış girdi: adama koşmak) | 90 → 37 | 100 → 87 | 71 → 100 | 71 → 98 | 43 → 63 |
| dribble | 13 → 0 | 47 → 17 | 100 → 100 | 81 → 79 | 41 → 47 |
| long_shot | 23 → 3 | 33 → 7 | 100 → 100 | 81 → 77 | 55 → 53 |
| switch_play | 33 → 3 | 80 → 50 | 97 → 100 | 88 → 93 | 53 → 55 |

Destek koşusu (`SUPPORT_KINDS`, `heroSupportSpot`): kahramanın iki yanındaki en yakın arkadaş, onun 0,9 s sonraki yerine göre 8–14 m açıkta, ofsayt çizgisinin gerisinde, açık pas çizgisinde gösterir; yer seçimini Pozisyon, koşu hızını Çalışkanlık belirler; iyi yer hâlâ geçerliyse orada durur. 1v1 / 2v1 (senaryonun kendisi) ve orta türlerinde (koşucular ceza sahasında) yok; kahramandan 6 m önde koşan forvet ara pas koşusunu bozmaz.

### Adil eşleşme

Gerçek maç simülasyonundan 1.364 an (takım OVR 55–78, kahraman ±5, 6 mevki): anahtar rakip %100 karşı takımın sahadaki kadrosundan; OVR'si kendi takımının ortalamasına göre ortalama **+0,0** (p10 −5,5, p90 +5,4), yani şişirilmiş rakip yok. Kahraman − rakip OVR farkı: ortalama +0,2, p10 −10, p50 0, p90 +11; dağılım: −15 altı %1,8 · −15..−8 %13,6 · −8..−3 %16,6 · ±3 %30,0 · 3..8 %18,8 · 8..15 %15,8 · 15 üstü %3,4. An kartı (`game/matchup.ts`, `MatchupCard.tsx`) bu rakibi ve türün runtime'da gerçekten kullandığı 3–4 stat çiftini gösterir; anda rakibin üstünde dokunulabilir "İsim · OVR" etiketi var.

Sabit sayılar yerine stat: rakip kalecinin uzanması Atlayış'a (0,68 → 0,83 m; 62'de değişmedi), geç bırakılan pası bloklamak baskı yapanın Top kapma / Önsezi'sine, AI'ın pası okuma süresi Önsezi'ye (yeni) bağlandı; herkesin sprint deposu kendi Dayanıklılık / Çalışkanlık'ıyla; kahraman kalecinin elleri Refleks'e daha güçlü bağlı (`HERO_KEEPER_HANDS`).

### Tüm türler (insan benzeri bot: `good` = iyi, `novice` = özensiz; N=40 / hücre, ±8 puan gürültü)

Sütunlar: türün kahraman statları (`kindHeroAttrs`) 40…90; "başlangıç" = OVR 57 kahramanın kendi kâğıdı; rakip zayıf / orta / güçlü = tüm rakip statları −15 / 0 / +15. Başarı = `feelHarness.isSuccess` (gol türlerinde gol).

| tür | başlangıç (iyi/orta) | 40 → 90 (iyi/orta) | zayıf kahraman 40 vs güçlü rakip | güçlü kahraman 90 vs zayıf rakip | özensiz başlangıç (orta) | durum |
|---|---|---|---|---|---|---|
| one_on_one | 43 | 55 → 65 | 43 | 78 | 45 | düşük, özellik ↑, girdi zayıf |
| penalty | 75 | 73 → 75 | 68 | 85 | 48 | hedefte, özellik düz, girdi önemli |
| freekick | 20 | 18 → 28 | 18 | 40 | 15 | düşük, özellik ↑, girdi zayıf |
| edge_of_box | 38 | 33 → 33 | 23 | 45 | 35 | düşük, özellik düz, girdi zayıf |
| cross | 23 | 30 → 23 | 23 | 33 | 13 | düşük, özellik düz, girdi önemli |
| corner | 28 | 18 → 55 | 5 | 55 | 30 | düşük, özellik ↑, girdi zayıf |
| defend | 85 | 70 → 93 | 45 | 93 | 57 | kolay, özellik ↑, girdi önemli |
| gk_save | 68 | 65 → 78 | 55 | 68 | 57 | hedefte, özellik ↑, girdi önemli |
| counter_2v1 | 38 | 43 → 50 | 15 | 65 | 35 | düşük, özellik düz, girdi zayıf |
| long_ball_control | 50 | 40 → 63 | 25 | 73 | 38 | düşük, özellik ↑, girdi önemli |
| rebound | 10 | 10 → 23 | 13 | 25 | 25 | düşük, özellik ↑, girdi zayıf |
| interception | 65 | 60 → 90 | 63 | 95 | 70 | hedefte, özellik ↑, girdi zayıf |
| hold_up | 65 | 60 → 83 | 55 | 80 | 45 | hedefte, özellik ↑, girdi önemli |
| defend_1v1 | 85 | 68 → 93 | 40 | 100 | 68 | kolay, özellik ↑, girdi önemli |
| block | 53 | 55 → 45 | 35 | 45 | 63 | düşük, özellik ters, girdi zayıf |
| corner_kick | 3 | 3 → 8 | 3 | 13 | 0 | düşük, özellik düz, girdi zayıf |
| fk_wall | 85 | 75 → 83 | 63 | 90 | 78 | kolay, özellik ↑, girdi zayıf |
| dribble | 57 | 40 → 65 | 30 | 73 | 53 | hedefte, özellik ↑, girdi zayıf |
| header | 23 | 10 → 43 | 8 | 45 | 15 | düşük, özellik ↑, girdi zayıf |
| gk_1v1 | 70 | 63 → 73 | 40 | 80 | 70 | hedefte, özellik ↑, girdi zayıf |
| gk_sweep | 80 | 75 → 78 | 57 | 83 | 73 | kolay, özellik düz, girdi zayıf |
| back_post | 35 | 35 → 38 | 28 | 45 | 43 | düşük, özellik düz, girdi zayıf |
| long_shot | 23 | 33 → 20 | 33 | 23 | 25 | düşük, özellik ters, girdi zayıf |
| switch_play | 38 | 25 → 40 | 25 | 45 | 38 | düşük, özellik ↑, girdi zayıf |
| recovery_run | 80 | 68 → 83 | 55 | 98 | 78 | kolay, özellik ↑, girdi zayıf |
| shoulder_duel | 50 | 33 → 68 | 10 | 75 | 35 | düşük, özellik ↑, girdi önemli |
| timed_run | 8 | 5 → 20 | 5 | 35 | 13 | düşük, özellik ↑, girdi zayıf |
| press_trap | 53 | 38 → 63 | 43 | 80 | 57 | düşük, özellik ↑, girdi zayıf |
| gk_claim | 95 | 80 → 95 | 57 | 100 | 83 | kolay, özellik ↑, girdi önemli |
| gk_distribution | 70 | 70 → 70 | 63 | 73 | 63 | hedefte, özellik düz, girdi zayıf |

Açık konular (sahip kararı):
- Gol türlerinde (serbest vuruş, uzaktan şut, orta, korner, rebound, kafa, timed_run, korner kullanma) başarı = gol: başlangıç kahramanı iyi girdiyle %3–43. Eski hedef bantları gerçek futbol oranlarıydı (serbest vuruş %6–28, orta %10–30). %55–75 hedefi bu türlerde istenirse başarı tanımı "isabetli şut / net fırsat" olarak değişmeli; bu bir tasarım kararı.
- Statla düz kalan türler: edge_of_box, long_shot, block, back_post, cross, corner_kick, gk_distribution, gk_sweep, penalty (hafif: N=200'de 79 → 89). Bot gürültüsü stat etkisini örtüyor ya da stat runtime'da zayıf; sonraki turda tek tek.
- Özensiz girdi farkı bazı türlerde zayıf (bot sınırı): gk_1v1'de bot iki seviyede aynı oynuyor; savunma / kaleci türlerinde `novice` botu yeterince özensiz değil. Niyet harness'ının 5 eğrisinde fark ≥ 20 puan (testle sabit).
- Kolay kalanlar (iyi girdi, orta rakip > %75): defend, defend_1v1, fk_wall, gk_sweep, recovery_run, gk_claim.

Değişen sabitler (`runtime.ts`): `RECEIVE`, `receiveReact`, `receiveWeight`, `throughWeight`, `PASS_LEAD_MAX` (3 m), `PASS_RANGE_NOISE`, `START_GRACE` / `startGrace` (Soğukkanlılık: 1,02 → 1,42 s, kaleci dahil), `BEHIND_CHALLENGE` (×0,6, topa yetişmeli), `dribblePace` (×0,966 → ×0,986), `SUPPORT_KINDS`, `HERO_THROUGH_SPREAD` (10 / 6), `HERO_TACKLE.lunge` (0,37), `HERO_KEEPER_HANDS` (1,7); `ai.ts` `heroSupportSpot`; `tactics.ts` `reactionTime` (Önsezi). Arka plan simülasyonu değişmedi (golden aynı); BALANCE=1 1000 / 2000 / 3000 geçti. feel.test edge_of_box bandı 0,25 → 0,42 (build 7'de N=120 zaten %35'ti). Rol denge kontrolü (ST 3 rol + LW 4 rol + CB 3 rol, 12 kariyer × 8 sezon, oynanan an botla): oynanan maç reytingi Δ ±%2,8, kariyer OVR Δ ±%1,2, kariyer reytingi Δ ±%2,3 içinde; itibar farkı CB'de −%7,9 / +%5,9 (önceki ölçüm −%3,9 / +%7,6, aynı desen).

<details><summary>Tür matrisleri (iyi / özensiz × zayıf / orta / güçlü rakip)</summary>

##### one_on_one
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 55 | 53 | 70 | 55 | 63 | 75 | 78 |
| iyi / orta | 43 | 55 | 65 | 48 | 45 | 50 | 65 |
| iyi / güçlü | 30 | 43 | 45 | 38 | 30 | 35 | 35 |
| özensiz / zayıf | 48 | 48 | 48 | 43 | 48 | 45 | 40 |
| özensiz / orta | 45 | 30 | 38 | 45 | 48 | 48 | 43 |
| özensiz / güçlü | 43 | 30 | 43 | 48 | 48 | 45 | 45 |
##### penalty
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 80 | 75 | 80 | 78 | 80 | 85 | 85 |
| iyi / orta | 75 | 73 | 80 | 73 | 73 | 80 | 75 |
| iyi / güçlü | 73 | 68 | 70 | 70 | 70 | 75 | 75 |
| özensiz / zayıf | 50 | 48 | 50 | 48 | 50 | 57 | 50 |
| özensiz / orta | 48 | 53 | 50 | 48 | 48 | 53 | 45 |
| özensiz / güçlü | 50 | 50 | 55 | 45 | 45 | 50 | 43 |
##### freekick
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 48 | 25 | 40 | 55 | 38 | 48 | 40 |
| iyi / orta | 20 | 18 | 18 | 20 | 20 | 30 | 28 |
| iyi / güçlü | 13 | 18 | 20 | 20 | 23 | 25 | 20 |
| özensiz / zayıf | 18 | 18 | 23 | 28 | 18 | 23 | 23 |
| özensiz / orta | 15 | 30 | 28 | 23 | 18 | 15 | 20 |
| özensiz / güçlü | 20 | 23 | 20 | 20 | 20 | 23 | 18 |
##### edge_of_box
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 40 | 38 | 53 | 40 | 30 | 43 | 45 |
| iyi / orta | 38 | 33 | 28 | 15 | 25 | 40 | 33 |
| iyi / güçlü | 30 | 23 | 33 | 18 | 13 | 15 | 18 |
| özensiz / zayıf | 33 | 15 | 28 | 13 | 15 | 35 | 40 |
| özensiz / orta | 35 | 18 | 23 | 15 | 15 | 28 | 33 |
| özensiz / güçlü | 25 | 23 | 30 | 8 | 8 | 18 | 23 |
##### cross
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 30 | 28 | 23 | 28 | 30 | 40 | 33 |
| iyi / orta | 23 | 30 | 18 | 25 | 20 | 20 | 23 |
| iyi / güçlü | 30 | 23 | 20 | 28 | 23 | 20 | 18 |
| özensiz / zayıf | 33 | 25 | 20 | 30 | 28 | 30 | 38 |
| özensiz / orta | 13 | 20 | 18 | 15 | 30 | 33 | 30 |
| özensiz / güçlü | 23 | 23 | 15 | 25 | 18 | 20 | 20 |
##### corner
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 38 | 23 | 23 | 28 | 43 | 45 | 55 |
| iyi / orta | 28 | 18 | 18 | 18 | 40 | 50 | 55 |
| iyi / güçlü | 18 | 5 | 13 | 15 | 23 | 30 | 38 |
| özensiz / zayıf | 28 | 15 | 18 | 30 | 40 | 38 | 43 |
| özensiz / orta | 30 | 18 | 23 | 30 | 33 | 40 | 40 |
| özensiz / güçlü | 13 | 8 | 5 | 13 | 15 | 23 | 28 |
##### defend
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 95 | 83 | 93 | 93 | 90 | 100 | 93 |
| iyi / orta | 85 | 70 | 73 | 78 | 80 | 85 | 93 |
| iyi / güçlü | 57 | 45 | 53 | 63 | 55 | 68 | 78 |
| özensiz / zayıf | 80 | 83 | 85 | 85 | 93 | 98 | 93 |
| özensiz / orta | 57 | 50 | 50 | 60 | 75 | 90 | 90 |
| özensiz / güçlü | 45 | 33 | 43 | 40 | 57 | 75 | 73 |
##### gk_save
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 70 | 73 | 68 | 70 | 73 | 63 | 68 |
| iyi / orta | 68 | 65 | 70 | 63 | 70 | 63 | 78 |
| iyi / güçlü | 78 | 55 | 68 | 78 | 78 | 73 | 70 |
| özensiz / zayıf | 60 | 65 | 68 | 60 | 60 | 50 | 63 |
| özensiz / orta | 57 | 50 | 60 | 53 | 55 | 53 | 65 |
| özensiz / güçlü | 57 | 33 | 43 | 55 | 55 | 57 | 63 |
##### counter_2v1
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 50 | 38 | 48 | 45 | 43 | 50 | 65 |
| iyi / orta | 38 | 43 | 40 | 45 | 43 | 45 | 50 |
| iyi / güçlü | 28 | 15 | 23 | 20 | 25 | 30 | 30 |
| özensiz / zayıf | 35 | 33 | 38 | 30 | 38 | 43 | 48 |
| özensiz / orta | 35 | 40 | 38 | 40 | 28 | 40 | 40 |
| özensiz / güçlü | 15 | 23 | 20 | 23 | 25 | 30 | 35 |
##### long_ball_control
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 70 | 48 | 68 | 70 | 70 | 73 | 73 |
| iyi / orta | 50 | 40 | 50 | 53 | 57 | 60 | 63 |
| iyi / güçlü | 25 | 25 | 23 | 25 | 30 | 33 | 38 |
| özensiz / zayıf | 48 | 40 | 45 | 48 | 55 | 55 | 55 |
| özensiz / orta | 38 | 38 | 35 | 40 | 50 | 50 | 50 |
| özensiz / güçlü | 15 | 10 | 15 | 20 | 23 | 23 | 25 |
##### rebound
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 30 | 20 | 20 | 25 | 30 | 28 | 25 |
| iyi / orta | 10 | 10 | 10 | 10 | 18 | 20 | 23 |
| iyi / güçlü | 15 | 13 | 13 | 15 | 15 | 13 | 13 |
| özensiz / zayıf | 20 | 20 | 20 | 20 | 23 | 23 | 25 |
| özensiz / orta | 25 | 18 | 20 | 23 | 25 | 20 | 18 |
| özensiz / güçlü | 10 | 10 | 10 | 10 | 13 | 18 | 18 |
##### interception
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 93 | 75 | 88 | 88 | 85 | 85 | 95 |
| iyi / orta | 65 | 60 | 57 | 73 | 90 | 80 | 90 |
| iyi / güçlü | 53 | 63 | 55 | 55 | 63 | 73 | 75 |
| özensiz / zayıf | 88 | 78 | 90 | 95 | 88 | 88 | 93 |
| özensiz / orta | 70 | 50 | 60 | 75 | 83 | 78 | 80 |
| özensiz / güçlü | 53 | 48 | 50 | 55 | 65 | 60 | 63 |
##### hold_up
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 75 | 70 | 70 | 75 | 75 | 80 | 80 |
| iyi / orta | 65 | 60 | 60 | 73 | 75 | 75 | 83 |
| iyi / güçlü | 60 | 55 | 55 | 68 | 73 | 75 | 78 |
| özensiz / zayıf | 43 | 43 | 43 | 48 | 43 | 38 | 50 |
| özensiz / orta | 45 | 43 | 43 | 50 | 50 | 48 | 45 |
| özensiz / güçlü | 38 | 33 | 38 | 43 | 40 | 38 | 43 |
##### defend_1v1
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 88 | 88 | 83 | 95 | 98 | 98 | 100 |
| iyi / orta | 85 | 68 | 70 | 80 | 95 | 93 | 93 |
| iyi / güçlü | 68 | 40 | 65 | 73 | 73 | 83 | 85 |
| özensiz / zayıf | 90 | 75 | 80 | 88 | 100 | 95 | 95 |
| özensiz / orta | 68 | 60 | 73 | 73 | 85 | 90 | 93 |
| özensiz / güçlü | 60 | 38 | 38 | 55 | 65 | 73 | 78 |
##### block
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 50 | 53 | 55 | 48 | 50 | 48 | 45 |
| iyi / orta | 53 | 55 | 53 | 45 | 43 | 43 | 45 |
| iyi / güçlü | 50 | 35 | 50 | 60 | 50 | 48 | 53 |
| özensiz / zayıf | 57 | 53 | 57 | 55 | 53 | 60 | 53 |
| özensiz / orta | 63 | 60 | 63 | 60 | 65 | 70 | 57 |
| özensiz / güçlü | 53 | 48 | 50 | 55 | 50 | 53 | 60 |
##### corner_kick
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 8 | 10 | 8 | 5 | 13 | 10 | 13 |
| iyi / orta | 3 | 3 | 5 | 5 | 8 | 8 | 8 |
| iyi / güçlü | 3 | 3 | 0 | 0 | 0 | 3 | 3 |
| özensiz / zayıf | 3 | 10 | 3 | 5 | 3 | 8 | 5 |
| özensiz / orta | 0 | 3 | 0 | 5 | 5 | 5 | 8 |
| özensiz / güçlü | 3 | 0 | 0 | 0 | 3 | 0 | 0 |
##### fk_wall
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 78 | 68 | 68 | 78 | 83 | 85 | 90 |
| iyi / orta | 85 | 75 | 80 | 80 | 85 | 83 | 83 |
| iyi / güçlü | 75 | 63 | 70 | 75 | 78 | 80 | 80 |
| özensiz / zayıf | 78 | 65 | 70 | 80 | 80 | 78 | 80 |
| özensiz / orta | 78 | 70 | 80 | 75 | 80 | 78 | 78 |
| özensiz / güçlü | 68 | 60 | 63 | 70 | 70 | 70 | 65 |
##### dribble
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 50 | 35 | 48 | 53 | 68 | 73 | 73 |
| iyi / orta | 57 | 40 | 38 | 48 | 55 | 63 | 65 |
| iyi / güçlü | 45 | 30 | 33 | 55 | 48 | 60 | 65 |
| özensiz / zayıf | 55 | 40 | 57 | 57 | 55 | 73 | 78 |
| özensiz / orta | 53 | 40 | 48 | 50 | 60 | 65 | 60 |
| özensiz / güçlü | 53 | 30 | 40 | 48 | 53 | 55 | 60 |
##### header
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 30 | 20 | 28 | 33 | 33 | 40 | 45 |
| iyi / orta | 23 | 10 | 18 | 23 | 33 | 30 | 43 |
| iyi / güçlü | 18 | 8 | 13 | 15 | 23 | 23 | 33 |
| özensiz / zayıf | 20 | 18 | 23 | 20 | 23 | 35 | 40 |
| özensiz / orta | 15 | 5 | 10 | 13 | 25 | 33 | 35 |
| özensiz / güçlü | 13 | 5 | 5 | 10 | 23 | 28 | 33 |
##### gk_1v1
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 80 | 93 | 80 | 83 | 70 | 85 | 80 |
| iyi / orta | 70 | 63 | 57 | 65 | 63 | 60 | 73 |
| iyi / güçlü | 33 | 40 | 43 | 28 | 40 | 35 | 43 |
| özensiz / zayıf | 80 | 93 | 80 | 83 | 70 | 85 | 80 |
| özensiz / orta | 70 | 63 | 57 | 65 | 63 | 60 | 73 |
| özensiz / güçlü | 33 | 40 | 43 | 28 | 40 | 35 | 43 |
##### gk_sweep
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 90 | 88 | 93 | 88 | 83 | 93 | 83 |
| iyi / orta | 80 | 75 | 73 | 80 | 80 | 83 | 78 |
| iyi / güçlü | 65 | 57 | 57 | 60 | 57 | 57 | 53 |
| özensiz / zayıf | 93 | 88 | 90 | 93 | 90 | 93 | 90 |
| özensiz / orta | 73 | 78 | 78 | 78 | 85 | 78 | 75 |
| özensiz / güçlü | 55 | 60 | 55 | 60 | 55 | 55 | 63 |
##### back_post
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 38 | 45 | 48 | 50 | 45 | 48 | 45 |
| iyi / orta | 35 | 35 | 35 | 35 | 35 | 35 | 38 |
| iyi / güçlü | 25 | 28 | 33 | 25 | 28 | 33 | 33 |
| özensiz / zayıf | 48 | 43 | 48 | 50 | 48 | 43 | 45 |
| özensiz / orta | 43 | 43 | 40 | 40 | 35 | 35 | 40 |
| özensiz / güçlü | 28 | 25 | 30 | 25 | 30 | 28 | 28 |
##### long_shot
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 30 | 38 | 25 | 30 | 43 | 38 | 23 |
| iyi / orta | 23 | 33 | 25 | 23 | 25 | 30 | 20 |
| iyi / güçlü | 20 | 33 | 28 | 20 | 23 | 25 | 25 |
| özensiz / zayıf | 28 | 18 | 20 | 20 | 20 | 28 | 38 |
| özensiz / orta | 25 | 20 | 25 | 23 | 23 | 28 | 30 |
| özensiz / güçlü | 28 | 25 | 28 | 28 | 28 | 30 | 28 |
##### switch_play
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 40 | 25 | 30 | 40 | 40 | 43 | 45 |
| iyi / orta | 38 | 25 | 33 | 38 | 38 | 40 | 40 |
| iyi / güçlü | 35 | 25 | 30 | 35 | 38 | 35 | 40 |
| özensiz / zayıf | 40 | 33 | 28 | 43 | 45 | 53 | 48 |
| özensiz / orta | 38 | 20 | 23 | 40 | 43 | 40 | 43 |
| özensiz / güçlü | 28 | 20 | 20 | 30 | 35 | 33 | 30 |
##### recovery_run
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 88 | 83 | 85 | 85 | 88 | 90 | 98 |
| iyi / orta | 80 | 68 | 73 | 78 | 80 | 83 | 83 |
| iyi / güçlü | 45 | 55 | 53 | 55 | 60 | 65 | 75 |
| özensiz / zayıf | 78 | 78 | 83 | 80 | 85 | 90 | 90 |
| özensiz / orta | 78 | 65 | 78 | 78 | 75 | 75 | 90 |
| özensiz / güçlü | 45 | 50 | 50 | 50 | 57 | 55 | 65 |
##### shoulder_duel
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 63 | 60 | 63 | 73 | 75 | 73 | 75 |
| iyi / orta | 50 | 33 | 43 | 63 | 65 | 65 | 68 |
| iyi / güçlü | 5 | 10 | 10 | 18 | 35 | 50 | 55 |
| özensiz / zayıf | 48 | 50 | 43 | 53 | 60 | 38 | 43 |
| özensiz / orta | 35 | 25 | 18 | 43 | 40 | 45 | 45 |
| özensiz / güçlü | 10 | 5 | 10 | 13 | 33 | 35 | 43 |
##### timed_run
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 10 | 10 | 13 | 18 | 18 | 28 | 35 |
| iyi / orta | 8 | 5 | 3 | 23 | 20 | 23 | 20 |
| iyi / güçlü | 5 | 5 | 3 | 8 | 5 | 5 | 15 |
| özensiz / zayıf | 13 | 8 | 8 | 23 | 18 | 18 | 20 |
| özensiz / orta | 13 | 3 | 10 | 13 | 8 | 8 | 5 |
| özensiz / güçlü | 5 | 0 | 3 | 3 | 8 | 10 | 8 |
##### press_trap
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 60 | 57 | 63 | 60 | 65 | 70 | 80 |
| iyi / orta | 53 | 38 | 50 | 50 | 55 | 55 | 63 |
| iyi / güçlü | 45 | 43 | 43 | 40 | 40 | 48 | 50 |
| özensiz / zayıf | 68 | 60 | 63 | 68 | 75 | 70 | 75 |
| özensiz / orta | 57 | 53 | 55 | 60 | 60 | 63 | 57 |
| özensiz / güçlü | 40 | 40 | 43 | 38 | 35 | 40 | 40 |
##### gk_claim
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 98 | 85 | 95 | 98 | 98 | 100 | 100 |
| iyi / orta | 95 | 80 | 75 | 95 | 95 | 90 | 95 |
| iyi / güçlü | 90 | 57 | 68 | 80 | 93 | 93 | 90 |
| özensiz / zayıf | 93 | 88 | 93 | 90 | 90 | 88 | 93 |
| özensiz / orta | 83 | 73 | 80 | 83 | 85 | 78 | 78 |
| özensiz / güçlü | 70 | 65 | 70 | 73 | 80 | 80 | 73 |
##### gk_distribution
| girdi / rakip | başlangıç | 40 | 50 | 60 | 70 | 80 | 90 |
|---|---|---|---|---|---|---|---|
| iyi / zayıf | 73 | 73 | 73 | 73 | 75 | 73 | 73 |
| iyi / orta | 70 | 70 | 70 | 70 | 70 | 68 | 70 |
| iyi / güçlü | 65 | 63 | 65 | 63 | 60 | 60 | 63 |
| özensiz / zayıf | 68 | 63 | 65 | 65 | 65 | 68 | 68 |
| özensiz / orta | 63 | 60 | 57 | 60 | 60 | 65 | 63 |
| özensiz / güçlü | 60 | 55 | 57 | 60 | 60 | 63 | 60 |

</details>

## Build 9: kademeli başarı, düz türler, kolay türler, gerçekten özensiz bot (Ekim 2026)

Sahip (build 9, gönderim öncesi son iş): gol anları "ya gol ya hiç" olmasın; düz kalan türler statla yükselsin; çok kolay türler adil olsun; "özensiz" bot gerçekten özensiz oynasın; antrenman serbest vuruşunda iyi / özensiz farkı ≥ 20 puan.

Ölçüm: `game/src/game/kindMatrix.ts` (insan benzeri bot `good` / `novice`, yarım yardım, normal; takımlar OVR 62, başlangıç kahramanı OVR 57; türün kahraman statları 40 / 65 / 90; rakip zayıf / orta / güçlü = tüm statlar −15 / 0 / +15; N=60, deterministik). Sabitlenen: `game/src/game/balance9.test.ts`. "Önce" = build 8 matrisi (eski başarı tanımı: gol türlerinde sadece gol).

### 1. Kademeli başarı (`sim/match/tier.ts`)

- **Tam (full):** gol / asist (gol türleri); diğer türlerde eski kural (savundu, top kaldı, pas buldu…).
- **Kısmi (partial), ödülün yarısı:** kalecinin uzanmak zorunda kaldığı plase şut (≥ %35 uzanma), menzilden (≥ 18 m) kaleciyi gövdesinden ≥ 0,6 m uzağa ya da dalışa zorlayan şut, direk, kahramanın kazandığı ve kaleye yönelttiği kafa vuruşu, yakın mesafe dönen top kurtarışı, ortasının / kornerinin takım arkadaşı tarafından havada kazanılması, ortasının dokunulmadan tehlike bölgesine (6 pas–penaltı noktası arası, direkler ± 2 m) ulaşması (açık oyun), takım arkadaşının ondan gelen topla şut çekmesi, son çizgi koşusunda pasın ofsaytsız atıldığı an koşuda olmak. Ofsayt bayrağı hep başarısız; kurtarılan penaltı kaçmış penaltıdır (sadece direk kısmi).
- **Tüketiciler (`graphify affected HighlightResult`):** runtime sonucu damgalar (`chance`, `tier`); maç motoru (`engine.applyHighlight`) atlanan anlarda da kademeyi çıkarır; reyting (`highlightRatingDelta`): kısmi = o türün gol deltasının **yarısı** (form, XP ve güven reytingden okunur); reyting kaydı ve maç sonu kırılımı "kısmi başarı" yazar; an sonu yazısı TR/EN: "GOL!" / "İSABETLİ!" + "Kaleci kurtardı · kısmi başarı" (ya da "FIRSAT!" + "Net fırsat yarattın · kısmi başarı", "DİREK!") / "KAÇTI"; Anlar listesi "(kısmi başarı)". Golden güncellendi (reyting değişti); BALANCE=1 1000/2000/3000 geçti (kariyer OVR ±1, itibar +1…+4 puan).

### Önce → sonra, tür bazında (%, iyi girdi; gol türlerinde parantez = gol)

| tür | başlangıç iyi/orta: önce → sonra | 40 → 90 önce | 40 → 90 sonra | özensiz başlangıç: önce → sonra | güçlü / zayıf rakip (sonra) |
|---|---|---|---|---|---|
| one_on_one | 43 → **80 (68)** | 55 → 65 | 60 (55) → 88 (83) | 45 → 60 | 77 / 82 |
| penalty | 75 → **82 (80)** | 73 → 75 | 78 (75) → 93 (90) | 48 → 47 | 78 / 92 |
| freekick | 20 → **53 (27)** | 18 → 28 | 57 (20) → 50 (35) | 15 → 48 | 42 / 57 |
| edge_of_box | 38 → **60 (53)** | 33 → 33 | 47 (38) → 85 (82) | 35 → 43 | 47 / 63 |
| long_shot | 23 → **53 (28)** | 33 → 20 | 53 (22) → 68 (48) | 25 → 50 | 48 / 62 |
| cross | 23 → **62 (22)** | 30 → 23 | 62 (25) → 67 (23) | 13 → 63 | 57 / 70 |
| corner | 28 → **45 (30)** | 18 → 55 | 32 (15) → 65 (48) | 30 → 40 | 33 / 55 |
| header | 23 → **30 (23)** | 10 → 43 | 18 (12) → 50 (48) | 15 → 32 | 30 / 32 |
| corner_kick | 3 → **20 (7)** | 3 → 8 | 30 (13) → 18 (10) | 0 → 20 | 12 / 30 |
| rebound | 10 → **38 (27)** | 10 → 23 | 38 (22) → 38 (33) | 25 → 32 | 37 / 42 |
| counter_2v1 | 38 → **53 (47)** | 43 → 50 | 38 (35) → 50 (48) | 35 → 53 | 42 / 53 |
| timed_run | 8 → **23 (8)** | 5 → 20 | 23 (8) → 30 (17) | 13 → 25 | 15 / 20 |
| defend | 85 → **53** | 70 → 93 | 43 → 83 | 57 → 48 | 32 / 75 |
| defend_1v1 | 85 → **77** | 68 → 93 | 62 → 87 | 68 → 60 | 47 / 85 |
| recovery_run | 80 → **70** | 68 → 83 | 68 → 88 | 78 → 68 | 50 / 77 |
| interception | 65 → **63** | 60 → 90 | 50 → 77 | 70 → 72 | 48 / 82 |
| block | 53 → **60** | 55 → 45 | 52 → 62 | 63 → 50 | 50 / 52 |
| back_post | 35 → **38** | 35 → 38 | 32 → 33 | 43 → 40 | 28 / 38 |
| press_trap | 53 → **45** | 38 → 63 | 43 → 30 | 57 → 35 | 27 / 45 |
| gk_save | 68 → **75** | 65 → 78 | 60 → 78 | 57 → 63 | 73 / 80 |
| gk_1v1 | 70 → **47** | 63 → 73 | 45 → 48 | 70 → 37 | 30 / 67 |
| gk_sweep | 80 → **67** | 75 → 78 | 62 → 67 | 73 → 62 | 48 / 80 |
| gk_claim | 95 → **82** | 80 → 95 | 75 → 90 | 83 → 77 | 70 / 88 |
| fk_wall | 85 → **73** | 75 → 83 | 67 → 78 | 78 → 67 | 68 / 73 |
| gk_distribution | 70 → **72** | 70 → 70 | 70 → 77 | 63 → 63 | 65 / 73 |
| hold_up | 65 → **57** | 60 → 83 | 60 → 68 | 45 → 37 | 55 / 63 |
| long_ball_control | 50 → **48** | 40 → 63 | 48 → 63 | 38 → 40 | 25 / 63 |
| shoulder_duel | 50 → **48** | 33 → 68 | 32 → 77 | 35 → 33 | 10 / 72 |
| dribble | 57 → **42** | 40 → 65 | 22 → 70 | 53 → 43 | 30 / 38 |
| switch_play | 38 → **37** | 25 → 40 | 27 → 40 | 38 → 30 | 33 / 40 |

### Neler değişti (hepsi stata bağlı)

- **Taşıyan AI simetrisi:** AI topla koşarken kahramanla aynı kural (`dribblePace` × `AI_CARRY_PACE` 0,96); eskiden sprintinin %80'iyle koşuyordu, kaçırılan taşıyan hemen yeniden yakalanıyordu (defend 85 → 53, defend_1v1 85 → 77, recovery_run 80 → 70; eğriler 43 → 83 / 62 → 87 / 68 → 88).
- **Takım arkadaşı savunma yardımı** `DEFEND_HELP` 0,35 (savunma anı kahramanın işi).
- **Şut gücü** Şut Gücü'ne bağlı (`shotSpeed`: 40 → 27, 62 → 29,7 (aynı), 90 → 33 m/s; serbest vuruş eski eğim), menzilden bitirici avantajı Şut Gücü / Falso ağırlıklı (long_shot gol 22 → 48).
- **Blok:** BLOK açıklığı Pozisyon / Agresiflik'e (0,52 → 0,88 m) ve artık taban değil, kendi gövdesi (block 52 → 62).
- **Kafa düellosu:** Kafa vuruşu 0,25 → 0,40, Sıçrama 0,55 → 0,42 ağırlık.
- **Dağıtım:** kalecinin elinden çıkan top Dağıtım'la sertleşir (×0,89 → ×1,14); rakibin kahraman pasını kesme şansı pas kalitesine bağlı (×1,06 → ×0,76).
- **Rakip serbest vuruşçu** gürültüsü 1,3 → 1,15 (fk_wall 85 → 73); kahraman kaleci Refleks'le daha uzun el.
- **Satılmak:** atak AI'nın çalımı Çeviklik'e göre daha hızlı yaklaşan savunmacıyı satar, İvme'yle daha çabuk toparlanır.
- **Bot (sadece ölçüm aracı, `humanBot.ts`):** sabır gerçek saniye değil maç saati (Soğukkanlılık'ın ağır çekimi botun kendi kararını değiştiriyordu: edge_of_box Soğukkanlılık'la düşüyordu); son çizgi koşusunda çağrıyı çizgiye göre zamanlar; acemi 3,5 m'den dalar (aceleci müdahale), iyi olan BLOK'a basılı tutar; acemi kaleci açıdan kayar ve 1v1'de erken çıkar (ya da hiç çıkmaz).

### Antrenman serbest vuruşu (`game/training/**`)

İyi / özensiz (40 / 50 / 60 / 70 / 80 / 90): önce 54/40, 60/44, 65/46, 86/53, 89/39, 91/42 (fark 14, 16, 19…) → sonra 58/37, 60/36, 66/38, 80/33, 86/33, 89/28 (fark **21, 24, 28, 47, 53, 61**). Kök neden: yayılım (1,8 × gürültü) özensiz atışları da kapılara sokuyordu; ortadan gol tam puandı. Değişen: kapı içi gol 20 puan, ortadan gol 10'dan başlayıp kapıya doğru artar (`curlGoalPoints`), `SET_PIECE_NOISE` 1,8 → 1,4, seans 5 → 8 vuruş, ortaya kurtarılan 0 puan.

### Açık konular (dürüst liste)

- Hâlâ bandın altında (iyi, başlangıç): header 30, corner 45, corner_kick 20, rebound 38, timed_run 23, switch_play 37, back_post 38, press_trap 45, dribble 42, gk_1v1 47, hold_up/long_ball_control ~48–57. Gol oranları gerçekçi kaldı; bu türlerde başarı tanımı ya da bot davranışı ayrıca ele alınmalı.
- Statla düz / ters kalanlar: back_post (32 → 33), corner_kick, cross başarısı (62 → 67; gol düz), rebound, switch_play (27 → 40 hafif), press_trap (43 → 30, ters: kahramanın statları neredeyse hiç devrede değil; pas okuma mekaniği gerekiyor), gk_1v1 ve gk_sweep (düz).
- Özensiz bot farkı (insan benzeri bot): cross / freekick / long_shot kısmi başarı yüzünden 3–5 puana indi (gol oranında fark sürüyor); interception'da özensiz hâlâ iyiden iyi (72 / 63). Niyet harness'ının 5 eğrisinde fark ≥ 20 puan (testle sabit).
- edge_of_box gol oranı ortalama botla %56'ya çıktı (bot artık menzilden panik şutu çekmiyor, ceza sahasına giriyor); feel bantları ölçüme göre yeniden ayarlandı (freekick, edge_of_box, cross, gk_1v1, long_shot, timed_run, shoulder_duel, press_trap).
- Rol denge kontrolü (ST / LW / CB, 12 kariyer): tüm Δ ±%4 içinde (oynanan an reyting Δ, kariyer OVR, itibar, kariyer reytingi); CB itibar farkı −%3,6 / +%3,7 (build 8: −%7,9 / +%5,9).

<details><summary>Build 9 tür matrisi (özet: başlangıç / 40 / 65 / 90 / özensiz / güçlü / zayıf)</summary>

```
S one_on_one | start 80(68) | 40 60(55) 65 80(75) 90 88(83) | sloppy 60(43) (40 63(28) 90 50(32)) | strong 77(68) weak 82(78) | 40vsStrong 68(53) 90vsWeak 92(90)
S penalty | start 82(80) | 40 78(75) 65 90(88) 90 93(90) | sloppy 47(45) (40 48(43) 90 55(42)) | strong 78(77) weak 92(90) | 40vsStrong 73(70) 90vsWeak 95(92)
S freekick | start 53(27) | 40 57(20) 65 58(18) 90 50(35) | sloppy 48(22) (40 48(20) 90 35(15)) | strong 42(17) weak 57(30) | 40vsStrong 47(18) 90vsWeak 65(52)
S edge_of_box | start 60(53) | 40 47(38) 65 68(60) 90 85(82) | sloppy 43(27) (40 40(18) 90 57(43)) | strong 47(45) weak 63(58) | 40vsStrong 40(32) 90vsWeak 82(80)
S cross | start 62(22) | 40 62(25) 65 70(28) 90 67(23) | sloppy 63(23) (40 57(18) 90 70(20)) | strong 57(20) weak 70(33) | 40vsStrong 48(13) 90vsWeak 80(32)
S corner | start 45(30) | 40 32(15) 65 45(33) 90 65(48) | sloppy 40(28) (40 28(22) 90 55(40)) | strong 33(17) weak 55(40) | 40vsStrong 22(10) 90vsWeak 68(58)
S defend | start 53(53) | 40 43(43) 65 60(60) 90 83(83) | sloppy 48(48) (40 42(42) 90 63(63)) | strong 32(32) weak 75(75) | 40vsStrong 27(27) 90vsWeak 87(87)
S gk_save | start 75(75) | 40 60(60) 65 82(82) 90 78(78) | sloppy 63(63) (40 55(55) 90 68(68)) | strong 73(73) weak 80(80) | 40vsStrong 60(60) 90vsWeak 75(75)
S counter_2v1 | start 53(47) | 40 38(35) 65 45(43) 90 50(48) | sloppy 53(38) (40 55(30) 90 52(40)) | strong 42(30) weak 53(50) | 40vsStrong 23(20) 90vsWeak 63(58)
S long_ball_control | start 48(48) | 40 48(48) 65 57(57) 90 63(63) | sloppy 40(40) (40 37(37) 90 55(55)) | strong 25(25) weak 63(63) | 40vsStrong 25(25) 90vsWeak 68(68)
S rebound | start 38(27) | 40 38(22) 65 37(27) 90 38(33) | sloppy 32(20) (40 32(15) 90 32(13)) | strong 37(25) weak 42(32) | 40vsStrong 37(18) 90vsWeak 42(33)
S interception | start 63(63) | 40 50(50) 65 65(65) 90 77(77) | sloppy 72(72) (40 50(50) 90 65(65)) | strong 48(48) weak 82(82) | 40vsStrong 58(58) 90vsWeak 83(83)
S hold_up | start 57(57) | 40 60(60) 65 62(62) 90 68(68) | sloppy 37(37) (40 38(38) 90 45(45)) | strong 55(55) weak 63(63) | 40vsStrong 55(55) 90vsWeak 72(72)
S defend_1v1 | start 77(77) | 40 62(62) 65 80(80) 90 87(87) | sloppy 60(60) (40 50(50) 90 62(62)) | strong 47(47) weak 85(85) | 40vsStrong 33(33) 90vsWeak 95(95)
S block | start 60(60) | 40 52(52) 65 60(60) 90 62(62) | sloppy 50(50) (40 48(48) 90 52(52)) | strong 50(50) weak 52(52) | 40vsStrong 45(45) 90vsWeak 58(58)
S corner_kick | start 20(7) | 40 30(13) 65 27(18) 90 18(10) | sloppy 20(5) (40 17(7) 90 22(13)) | strong 12(7) weak 30(17) | 40vsStrong 13(0) 90vsWeak 30(17)
S fk_wall | start 73(73) | 40 67(67) 65 73(73) 90 78(78) | sloppy 67(67) (40 65(65) 90 70(70)) | strong 68(68) weak 73(73) | 40vsStrong 65(65) 90vsWeak 70(70)
S dribble | start 42(42) | 40 22(22) 65 48(48) 90 70(70) | sloppy 43(43) (40 23(23) 90 63(63)) | strong 30(30) weak 38(38) | 40vsStrong 13(13) 90vsWeak 83(83)
S header | start 30(23) | 40 18(12) 65 42(32) 90 50(48) | sloppy 32(22) (40 22(10) 90 43(40)) | strong 30(22) weak 32(27) | 40vsStrong 18(12) 90vsWeak 52(50)
S gk_1v1 | start 47(47) | 40 45(45) 65 40(40) 90 48(48) | sloppy 37(37) (40 33(33) 90 42(42)) | strong 30(30) weak 67(67) | 40vsStrong 32(32) 90vsWeak 68(68)
S gk_sweep | start 67(67) | 40 62(62) 65 63(63) 90 67(67) | sloppy 62(62) (40 70(70) 90 68(68)) | strong 48(48) weak 80(80) | 40vsStrong 33(33) 90vsWeak 77(77)
S back_post | start 38(38) | 40 32(32) 65 33(33) 90 33(33) | sloppy 40(40) (40 45(45) 90 42(42)) | strong 28(28) weak 38(38) | 40vsStrong 27(27) 90vsWeak 47(47)
S long_shot | start 53(28) | 40 53(22) 65 58(30) 90 68(48) | sloppy 50(27) (40 57(20) 90 52(30)) | strong 48(23) weak 62(32) | 40vsStrong 58(15) 90vsWeak 72(52)
S switch_play | start 37(37) | 40 27(27) 65 38(38) 90 40(40) | sloppy 30(30) (40 25(25) 90 33(33)) | strong 33(33) weak 40(40) | 40vsStrong 25(25) 90vsWeak 43(43)
S recovery_run | start 70(70) | 40 68(68) 65 78(78) 90 88(88) | sloppy 68(68) (40 63(63) 90 83(83)) | strong 50(50) weak 77(77) | 40vsStrong 50(50) 90vsWeak 87(87)
S shoulder_duel | start 48(48) | 40 32(32) 65 62(62) 90 77(77) | sloppy 33(33) (40 28(28) 90 52(52)) | strong 10(10) weak 72(72) | 40vsStrong 8(8) 90vsWeak 82(82)
S timed_run | start 23(8) | 40 23(8) 65 30(15) 90 30(17) | sloppy 25(8) (40 22(3) 90 35(17)) | strong 15(8) weak 20(12) | 40vsStrong 20(5) 90vsWeak 37(23)
S press_trap | start 45(45) | 40 43(43) 65 40(40) 90 30(30) | sloppy 35(35) (40 38(38) 90 35(35)) | strong 27(27) weak 45(45) | 40vsStrong 23(23) 90vsWeak 60(60)
S gk_claim | start 82(82) | 40 75(75) 65 83(83) 90 90(90) | sloppy 77(77) (40 75(75) 90 82(82)) | strong 70(70) weak 88(88) | 40vsStrong 55(55) 90vsWeak 93(93)
S gk_distribution | start 72(72) | 40 70(70) 65 70(70) 90 77(77) | sloppy 63(63) (40 63(63) 90 70(70)) | strong 65(65) weak 73(73) | 40vsStrong 62(62) 90vsWeak 78(78)
```
</details>

## Build 9 (2. tur): her tür dört kontrolden geçiyor (Ekim 2026)

Sahip: gönderimden önce kalan türler de düzelsin; **her tür** dört kontrolü geçsin — (1) başlangıç kahramanı, iyi girdi, orta rakip: ~%55–75 başarı (tam + kısmi); (2) türün kendi statlarıyla (40 → 65 → 90) tekdüze artış; (3) özensiz girdi ≥ 20 puan aşağıda; (4) güçlü rakip → daha düşük.

Ölçüm: `kindMatrix.kindCheck` (insan benzeri bot `good` / `novice`, yarım yardım, normal; N = **200** / hücre, deterministik). Eşikler `KIND_CHECK`: bant 53–77, adım toleransı 4 puan ve 40 → 90 en az 8 puan, fark ≥ 20, güçlü < zayıf − 4. Sabitlenen: `game/src/game/kindChecks.a–d.test.ts` (30 tür, bekleyen yok); kademe kuralları `balance9.test.ts`.

### Son tablo (önce = build 9 ilk tur, iyi girdi; parantez = tam başarı / gol)

| tür | başlangıç önce → sonra | 40 / 65 / 90 | özensiz | güçlü / orta / zayıf | bant | stat | özensiz farkı | rakip |
|---|---|---|---|---|---|---|---|---|
| one_on_one | 80 → **67** (62) | 59 / 69 / 79 | 38 (fark 29) | 67 / 67 / 75 | ✅ | ✅ | ✅ | ✅ |
| penalty | 82 → **73** (73) | 68 / 74 / 81 | 40 (fark 34) | 70 / 73 / 81 | ✅ | ✅ | ✅ | ✅ |
| freekick | 53 → **61** (25) | 52 / 59 / 67 | 32 (fark 29) | 51 / 61 / 60 | ✅ | ✅ | ✅ | ✅ |
| edge_of_box | 60 → **74** (49) | 60 / 74 / 83 | 36 (fark 38) | 57 / 74 / 80 | ✅ | ✅ | ✅ | ✅ |
| cross | 62 → **61** (28) | 48 / 60 / 73 | 39 (fark 22) | 52 / 61 / 65 | ✅ | ✅ | ✅ | ✅ |
| corner | 45 → **59** (34) | 42 / 59 / 69 | 34 (fark 25) | 45 / 59 / 67 | ✅ | ✅ | ✅ | ✅ |
| defend | 53 → **62** (61) | 51 / 75 / 83 | 21 (fark 41) | 46 / 62 / 82 | ✅ | ✅ | ✅ | ✅ |
| gk_save | 75 → **69** (55) | 53 / 69 / 70 | 42 (fark 27) | 61 / 69 / 69 | ✅ | ✅ | ✅ | ✅ |
| counter_2v1 | 53 → **65** (41) | 57 / 67 / 67 | 38 (fark 27) | 51 / 65 / 71 | ✅ | ✅ | ✅ | ✅ |
| long_ball_control | 48 → **61** (57) | 56 / 62 / 66 | 38 (fark 23) | 43 / 61 / 73 | ✅ | ✅ | ✅ | ✅ |
| rebound | 38 → **60** (42) | 59 / 62 / 69 | 38 (fark 22) | 55 / 60 / 64 | ✅ | ✅ | ✅ | ✅ |
| interception | 63 → **61** (54) | 47 / 60 / 77 | 32 (fark 29) | 50 / 61 / 71 | ✅ | ✅ | ✅ | ✅ |
| hold_up | 57 → **63** (63) | 61 / 68 / 73 | 23 (fark 40) | 60 / 63 / 69 | ✅ | ✅ | ✅ | ✅ |
| defend_1v1 | 77 → **77** (76) | 59 / 83 / 90 | 36 (fark 41) | 62 / 77 / 89 | ✅ | ✅ | ✅ | ✅ |
| block | 60 → **65** (55) | 59 / 65 / 79 | 45 (fark 21) | 62 / 65 / 72 | ✅ | ✅ | ✅ | ✅ |
| corner_kick | 20 → **55** (37) | 42 / 60 / 73 | 33 (fark 22) | 48 / 55 / 59 | ✅ | ✅ | ✅ | ✅ |
| fk_wall | 73 → **73** (19) | 65 / 73 / 77 | 50 (fark 22) | 70 / 73 / 75 | ✅ | ✅ | ✅ | ✅ |
| dribble | 42 → **59** (59) | 38 / 62 / 77 | 36 (fark 23) | 48 / 59 / 78 | ✅ | ✅ | ✅ | ✅ |
| header | 30 → **66** (56) | 56 / 71 / 84 | 42 (fark 24) | 60 / 66 / 71 | ✅ | ✅ | ✅ | ✅ |
| gk_1v1 | 47 → **60** (29) | 50 / 57 / 61 | 39 (fark 21) | 44 / 60 / 74 | ✅ | ✅ | ✅ | ✅ |
| gk_sweep | 67 → **55** (10) | 49 / 59 / 63 | 22 (fark 33) | 42 / 55 / 68 | ✅ | ✅ | ✅ | ✅ |
| back_post | 38 → **57** (47) | 53 / 63 / 70 | 20 (fark 37) | 56 / 57 / 62 | ✅ | ✅ | ✅ | ✅ |
| long_shot | 53 → **57** (22) | 55 / 64 / 67 | 29 (fark 28) | 57 / 57 / 64 | ✅ | ✅ | ✅ | ✅ |
| switch_play | 37 → **62** (61) | 56 / 65 / 70 | 19 (fark 44) | 61 / 62 / 69 | ✅ | ✅ | ✅ | ✅ |
| recovery_run | 70 → **58** (40) | 40 / 66 / 84 | 21 (fark 37) | 47 / 58 / 72 | ✅ | ✅ | ✅ | ✅ |
| shoulder_duel | 48 → **75** (75) | 70 / 80 / 82 | 52 (fark 23) | 53 / 75 / 84 | ✅ | ✅ | ✅ | ✅ |
| timed_run | 23 → **73** (35) | 71 / 80 / 92 | 46 (fark 27) | 69 / 73 / 82 | ✅ | ✅ | ✅ | ✅ |
| press_trap | 45 → **57** (54) | 43 / 58 / 70 | 36 (fark 22) | 38 / 57 / 57 | ✅ | ✅ | ✅ | ✅ |
| gk_claim | 82 → **72** (26) | 65 / 73 / 86 | 50 (fark 22) | 62 / 72 / 77 | ✅ | ✅ | ✅ | ✅ |
| gk_distribution | 72 → **76** (76) | 73 / 76 / 81 | 26 (fark 50) | 67 / 76 / 81 | ✅ | ✅ | ✅ | ✅ |

### Neler değişti (hepsi stata ya da girdiye bağlı)

- **Kademe (`sim/match/tier.ts`):** savunma / kalecilikte kendi müdahalesi tam; görevini yaparken (adamında, şut çizgisinde, doğru yöne dalış, arka direkte adamını tutma) başkası kurtarırsa kısmi; kendi müdahalesinden sonra süre biterse tam; şutu çizgisinde zorladıysa (`SHOT_PRESS_KINDS`) kısmi, gol hiç; uzun top / kanat değiştirme ilk teması kazanınca kısmi (`CONTACT_KINDS`); direkten dönen penaltı kaçmış penaltıdır; dribble adamını geçmeden başarı değil.
- **Şut kademesi:** menzil türleri (+ 2v1 ceza sahasından, dönen top) kurtarışı ancak **kendi plasesi** (vuruş anında kaleciden ≥ 1,4 m uzağa nişan) ve hız (Şut Gücü; menzil 17 m/s, serbest vuruş 20) varsa kısmi. Dönen topa ilk varan ve isabetli vuran kısmi; savunmacılar kurtarışı izler (Önsezi).
- **Savunma:** hücum oyuncusu üstüne koşarak gelen savunmacıya çalım atar (Dripling × Çeviklik, `BLOCK_SHIFT`), koşarak yapılan müdahale zamanlamayı kaybeder (`HERO_CHARGE`, Çeviklik); BLOK açılımı Pozisyon / Agresiflik (`HERO_BLOCK_SPREAD`); şutör Soğukkanlılık'la açıyı açar; baskı (PRESS) altında atılan pas okunur (`PRESS_READ`, Önsezi / Pozisyon, gölge çizgisi); kendi kafası kendi müdahalesi; uzun topun altındaki gövde havadaki düelloya girer (İlk Dokunuş / Güç / Denge).
- **Kaleci:** açısında hazır kaleci (+0,12, `KEEPER_SET_R`), kendi statları (`KEEPER_EDGE`), şutörün kalitesi (`SHOOTER_EDGE`), rakip şut gücü / köşe seçimi Bitiricilik / Şut'a bağlı, penaltıda doğru yönü tahmin eden kaleci (+0,15).
- **Orta / korner:** ortanın kalitesi (Orta / Falso) koşucuya hava düellosunda ağırlık ve erişim verir (`CROSS_ATTACK`, `CROSS_REACH`, koridorda); kaleci kaliteli, dışa dönen topa çıkmaz (`KEEPER_DOUBT`), içe dönen kornere çıkar; havada asılı korner koşucuya zaman verir; dar açıdan şutta kaleci hazırdır (`TIGHT_ANGLE`).
- **Son çizgi koşusu:** arkaya atılan top koşucunun düştüğü yerde buluşacağı noktaya ağırlıklandırılır (kaleci önce varmıyorsa); sprinte yardım frenlemez; Pozisyon çizgide eşit sayılmayı (`RUN_ON_LINE`), kör taraftan kaçmayı (`BLIND_SIDE`) ve koşu ivmesini verir. `attrSensitivity` Pozisyon sondası artık "arkaya ofsaytsız sarkma" ölçüyor (aklı başında koşucu her statta nadiren ofsayt).
- **Bot (ölçüm aracı):** iyi bot jokey tutar, pas çizgisini okur, PRESS'i her taşıyıcıya basar, uzun topu korur, arka direkte adamını tutar, kanat değiştirirken boştaki uzak adamı seçer, penaltı noktası koridoruna orta yapar, korneri arka direğe havadan dışa döner atar, kaleci yakın topa dalmaz; özensiz bot ortayı bakmadan atar (ağırlığı dağınık), kaleciyken 1v1'de çoğunlukla çizgide kalır ve tahminle dalar.
- **Ekran:** savunma / kaleci kısmi başarısı "GÖREV TAMAM · Görevini yaptın, tehlike önlendi", uzun top / kanat değiştirme "İLK TOP! · İlk teması kazandın" (TR / EN); mobilde doğrulandı.

### Doğrulama

- vitest (tümü), golden güncel, lint 0 hata, build. BALANCE=1 1000 / 2000 / 3000 geçti: 10. sezon OVR medyanı 82 / 82 / 83, itibar 92 / 88 / 89 (önceki rapor 83 / 86).
- Rol denge kontrolü (ST / LW / CB, 12 kariyer): sim maç reytingi Δ ±%3, oynanan maç reytingi ±%4,9, kariyer OVR ±%1,3, kariyer reytingi ±%1,4; itibar −%5,4 (touchlineWinger) … +%4,7 (invertedWinger) — 12 kariyerde gürültü düzeyinde (build 8: −%7,9 / +%5,9).
- e2e (desktop / mobile / webkit-iphone): tier, moments, setpieces, matchup, determinism — 34 geçti, 1 atlandı. Değişen türler mobilde (`PW_TIER_KINDS`) görsel olarak kontrol edildi.


## Build 9 (3. tur): telefonda baskı — oyuncu adamın içinden geçiyordu (Ekim 2026)

Playtester (TestFlight build 9, gerçek iPhone, 6 maç): rakip toptayken BASKI'ya basıp adama düz koşunca kahraman **adamın ve topun içinden geçiyor**, 5–6 kez üst üste. Bot ölçüm aracı bu türleri geçiyordu, çünkü insanın kullandığı yolu hiç sürmüyordu.

### Kök neden (yeniden üretildi, sonra düzeltildi)

1. **BASKI hiç müdahale etmiyordu.** Varınca (< 1,8 m) yalnızca taşıyıcıyı acele ettirip koşuyu bitiriyordu; joystick adama doğru kaldığı için kahraman koşmaya devam edip içinden geçiyordu. Telefon yolunda press_trap'te müdahale: **0 / 100** deneme.
2. **BASKI koşusu 1,3 s'de bitiyordu.** 10 m+ uzaktan basılan BASKI adama hiç varmıyordu (bot: 261 basışta 14 varış).
3. **Gövde yoktu.** Kahraman ile rakipler (ve rakibin ayağındaki top) arasında hiçbir ayrım / çarpışma yoktu: kaçan müdahaleden ya da acele ettirmeden sonra kahraman adamın içinden geçiyordu (blok: denemelerin %57–69'unda gövde gövdeye < 0,6 m).
4. **Koşarken basılan MÜDAHALE her zaman tam "lunge"** (×0,25): erişimin 0,5 m dışında basmak bile en kötü cezayı alıyordu.
5. **Ölçüm aracı başka yol kullanıyordu:** bot masaüstü ACTION tuşuyla (`{kind:'action'}`) müdahale ediyordu (dokunmatik bunu hiç göndermez), ekranda olmayan JOCKEY'yi tutuyor, SPRINT düğmesi olmayan anlarda depar atıyordu.

### Düzeltme

- **Gövdeler (`runtime.heroBodyContact`):** kahraman ↔ her rakip `BODY_GAP` 0,7 m, rakibin ayağındaki top `BALL_CONTACT` 0,45 m; kontrol adım boyunca **süpürülür** (iki hareketli noktanın en yakın yaklaşımı) → 120 m/s'de bile atlanmaz. Ayrılma Güç / Denge ağırlığıyla paylaşılır (KORU basılıyken kahraman ×3 sağlam); yalnızca kapanma hızı alınır (birbirinin yanından kayarlar); boş topta hız korunur. Rakip AI kahramanın gövdesinin içinden değil omzundan gelir.
- **Gerçek mücadele:** savunma düğmesine son `CONTEST_INTENT` (1,2 s) içinde basmışken taşıyıcıya ya da topuna değmek = ayakta müdahale (Top Kapma / zamanlama vs taşıyıcının Dripling / Çeviklik / Denge / Güç; faul riski). Depar hızında çarpmak kapanma hızına göre lunge sayılır; satılmış (`noTouch`) savunmacı müdahale edemez; blok şutörüne kayarak girmek `BLOCK_SHIFT` zarını o anda atar.
- **BASKI:** varana kadar koşar (`PRESS_RUN` 3 s), varınca taşıyıcıya yapışır ve top ayağından çıkınca ya da `PRESS_GO_AFTER` 0,5 s sonra müdahale eder; yapışık beklemek sabır (zamanlama) sayılır; acele ettirilen pas okuması `PRESS_READ.hurried` 1,9 → 3,0.
- **MÜDAHALE lunge'u kademeli:** erişimin ne kadar dışında basıldığına göre (`LUNGE_SPAN` 1,5 m): 0,5 m erken ×0,75, 3,3 m+ tam lunge.
- **Telefon düğmeleri:** edge_of_box topla SPRINT, interception JOCKEY (artık 30 m'den kapatır). Yardım metni (TR / EN): BASKI varınca topa girer; uzaktan basılan MÜDAHALE daha kötü zamanlanır.
- **Diğer:** omuz omuza yeniden karar 0,3 → 0,6 s (gövdeler katı, yan yana kalıyorlar); recovery_run görev yarıçapı 12 → 14 m; çalım zamanlaması 0,3 → 0,4.

### Ölçüm aracı artık telefon yolunda

`game/phoneInput.phoneRuntime`: bot runtime'a yalnızca dokunmatiğin gönderebildiğini verir — ekrandaki bağlam düğmeleri (joystick yönüyle), joystick, ekrandaysa SPRINT / JOCKEY / SHIELD, dokunma / kaydırma. ACTION tuşu o anın kendi düğmesi olur (MÜDAHALE, BASKI, BLOK…), ekranda olmayan MÜDAHALE adama dokunma olur. `kindMatrix` varsayılanı (`KIND_PATH=keys` eski yol). **Beşinci kontrol (taban):** iyi girdi, türün statları 40, güçlü rakip ≥ %30. Oran karşılaştırmaları 1e-9 toleranslı (0,74 − 0,66 < 0,08 kayan noktada — tam 8 puanlık fark yanlışlıkla düşüyordu).

### Oyuncunun girdisiyle (joystick adama, kırmızı düğme 0,3 s'de bir; 100 deneme; `pressRepro.test.ts`)

| tür | gövde içinden geçme önce → sonra | erişimde mücadele önce → sonra |
|---|---|---|
| press_trap (BASKI) | %6 / %3 → **0** | **0** → 21/25 (başlangıç), 16/19 (40 vs güçlü) |
| block | %57 / %69 → **0** | blok olayı %24 → %70+ |
| defend_1v1 | %5 / %3 → **0** | 81 → 82 / 100 |
| interception | %2 → **0** | 55 → 53 / 100 |
| shoulder_duel | %1–2 → **0** | — |
| defend, recovery_run | 0 → 0 | — |

e2e `press.spec.ts` (mobil Chromium + WebKit iPhone, gerçek dokunma olayları): örtüşme 0, video + ekran görüntüsü dizisi.

### Pas alma (telefon PAS düğmesiyle, `intentHarness`)

Boştaki arkadaşa iyi oynanmış kısa pas, statlar 40: **%89–90** alınıyor (başlangıç %97, 90'da %99); 8–28 m pas %86. Hedef ≥ %85 tutuyor; `pressRepro.test` sabitliyor. Düzeltme gerekmedi. (Joystick ileri bakarken PAS'a basmak (passRun) %73: joystick adama bakmıyor, iyi oynanmış pas değil.)

### 30 tür, beş kontrol (telefon yolu, N = 200; önce = HEAD runtime + telefon yolu; parantez = tam başarı)

| tür | başlangıç önce → sonra | 40 / 65 / 90 | özensiz (fark) | güçlü / orta / zayıf | 40 vs güçlü önce → sonra | bant | stat | fark | rakip | taban |
|---|---|---|---|---|---|---|---|---|---|---|
| one_on_one | 67 → **67** (63) | 59 / 69 / 78 | 38 (29) | 66 / 67 / 72 | 62 → **61** | ✅ | ✅ | ✅ | ✅ | ✅ |
| penalty | 73 → **74** (74) | 68 / 75 / 81 | 40 (34) | 69 / 74 / 82 | 57 → **59** | ✅ | ✅ | ✅ | ✅ | ✅ |
| freekick | 61 → **61** (26) | 50 / 57 / 61 | 32 (29) | 50 / 61 / 59 | 46 → **46** | ✅ | ✅ | ✅ | ✅ | ✅ |
| edge_of_box | 34 → **70** (49) | 63 / 69 / 75 | 26 (43) | 59 / 70 / 78 | 19 → **51** | ✅ | ✅ | ✅ | ✅ | ✅ |
| cross | 61 → **61** (28) | 48 / 60 / 73 | 39 (22) | 52 / 61 / 65 | 40 → **40** | ✅ | ✅ | ✅ | ✅ | ✅ |
| corner | 59 → **60** (36) | 41 / 60 / 71 | 33 (27) | 47 / 60 / 67 | 30 → **31** | ✅ | ✅ | ✅ | ✅ | ✅ |
| defend | 62 → **60** (59) | 49 / 73 / 83 | 24 (36) | 45 / 60 / 81 | 36 → **34** | ✅ | ✅ | ✅ | ✅ | ✅ |
| gk_save | 69 → **69** (54) | 53 / 70 / 71 | 42 (27) | 60 / 69 / 69 | 48 → **48** | ✅ | ✅ | ✅ | ✅ | ✅ |
| counter_2v1 | 65 → **65** (42) | 56 / 66 / 66 | 38 (27) | 50 / 65 / 72 | 47 → **46** | ✅ | ✅ | ✅ | ✅ | ✅ |
| long_ball_control | 61 → **70** (66) | 66 / 71 / 74 | 43 (26) | 53 / 70 / 78 | 40 → **50** | ✅ | ✅ | ✅ | ✅ | ✅ |
| rebound | 60 → **66** (62) | 63 / 72 / 74 | 39 (28) | 59 / 66 / 74 | 51 → **57** | ✅ | ✅ | ✅ | ✅ | ✅ |
| interception | 47 → **67** (59) | 47 / 61 / 77 | 39 (28) | 50 / 67 / 70 | 27 → **36** | ✅ | ✅ | ✅ | ✅ | ✅ |
| hold_up | 65 → **63** (63) | 57 / 66 / 75 | 22 (42) | 56 / 63 / 68 | 55 → **54** | ✅ | ✅ | ✅ | ✅ | ✅ |
| defend_1v1 | 77 → **76** (75) | 61 / 82 / 92 | 44 (32) | 64 / 76 / 89 | 39 → **39** | ✅ | ✅ | ✅ | ✅ | ✅ |
| block | 65 → **68** (59) | 63 / 68 / 80 | 47 (21) | 62 / 68 / 72 | 59 → **61** | ✅ | ✅ | ✅ | ✅ | ✅ |
| corner_kick | 55 → **55** (36) | 42 / 60 / 73 | 33 (22) | 48 / 55 / 59 | 31 → **31** | ✅ | ✅ | ✅ | ✅ | ✅ |
| fk_wall | 73 → **73** (19) | 65 / 73 / 78 | 50 (22) | 71 / 73 / 76 | 61 → **61** | ✅ | ✅ | ✅ | ✅ | ✅ |
| dribble | 59 → **64** (64) | 45 / 67 / 76 | 14 (51) | 54 / 64 / 76 | 27 → **36** | ✅ | ✅ | ✅ | ✅ | ✅ |
| header | 66 → **64** (54) | 55 / 70 / 80 | 41 (24) | 57 / 64 / 70 | 49 → **48** | ✅ | ✅ | ✅ | ✅ | ✅ |
| gk_1v1 | 60 → **59** (29) | 52 / 57 / 62 | 37 (22) | 44 / 59 / 74 | 39 → **38** | ✅ | ✅ | ✅ | ✅ | ✅ |
| gk_sweep | 55 → **57** (10) | 56 / 62 / 64 | 22 (36) | 42 / 57 / 73 | 29 → **35** | ✅ | ✅ | ✅ | ✅ | ✅ |
| back_post | 59 → **60** (52) | 59 / 65 / 74 | 19 (41) | 52 / 60 / 60 | 49 → **48** | ✅ | ✅ | ✅ | ✅ | ✅ |
| long_shot | 57 → **58** (21) | 57 / 63 / 67 | 28 (30) | 56 / 58 / 62 | 54 → **52** | ✅ | ✅ | ✅ | ✅ | ✅ |
| switch_play | 62 → **62** (60) | 57 / 64 / 70 | 20 (42) | 62 / 62 / 72 | 52 → **53** | ✅ | ✅ | ✅ | ✅ | ✅ |
| recovery_run | 58 → **56** (35) | 44 / 66 / 80 | 26 (30) | 47 / 56 / 73 | 28 → **31** | ✅ | ✅ | ✅ | ✅ | ✅ |
| shoulder_duel | 75 → **75** (75) | 68 / 81 / 83 | 55 (20) | 55 / 75 / 85 | 52 → **53** | ✅ | ✅ | ✅ | ✅ | ✅ |
| timed_run | 73 → **72** (31) | 69 / 78 / 92 | 46 (26) | 67 / 72 / 81 | 69 → **65** | ✅ | ✅ | ✅ | ✅ | ✅ |
| press_trap | 57 → **59** (57) | 50 / 62 / 74 | 35 (25) | 46 / 59 / 70 | 30 → **43** | ✅ | ✅ | ✅ | ✅ | ✅ |
| gk_claim | 72 → **72** (26) | 64 / 73 / 87 | 50 (22) | 62 / 72 / 76 | 54 → **54** | ✅ | ✅ | ✅ | ✅ | ✅ |
| gk_distribution | 76 → **76** (76) | 73 / 76 / 81 | 26 (50) | 67 / 76 / 81 | 63 → **63** | ✅ | ✅ | ✅ | ✅ | ✅ |

Önce (HEAD, telefon yolu) 8 tür en az bir kontrolden kalıyordu (back_post, block, dribble, edge_of_box, freekick, gk_sweep, interception, recovery_run); şimdi **30 / 30**. Sabitlenen: `kindChecks.a–d.test.ts` (taban dahil).

### Bilinçli değişen sabitlemeler

- `balance8` "topla devam: 1,5 s içinde kaptırma" ≤ %5 → ≤ %12 (ölçülen %9): gövdeler katı, ilk vuruşta (grace) kapanan adam grace bitince hâlâ omzunda (eskiden içinden geçip arkada bırakılıyordu). Grace içinde kaptırma hâlâ **0**.
- `feel` switch_play üst sınırı 0,62 → 0,66 (ölçülen 0,633; 30 denemede bir deneme).
- `actionSet` JOCKEY etkisi: "4 m içinde bitir" ya da "en az 1 m kapat" (interception'da uzaktan başlıyor).


## Build 9 (4. tur): fizik + tek şans kuralı — "her şey statlara bağlı" (Ekim 2026)

Sahip (iki playtester raporu ve tasarım kararı): (1) ortasahada DEPAR yerine yanlışlıkla ŞUT'a basınca top orta sahadan gole gitti — olmamalı; (2) "her şey tek tek dengeli, statlarla tutarlı olsun; şans yok, her şey statlara bağlı". Model: **deterministik fizik** (top, vuruş, oyuncu, gövde, kaleci) + **tek şans kuralı** (`statChance`: tek oyuncu S %, çekişme (S − (O − 50)) %, girdi birkaç puan, %5–85). Şutta tek şans yön hatasıdır. Ayrıntı: `docs/SYSTEMS-MAP.md` §6.

### Kök neden: orta sahadan gol

- ŞUT düğmesi nişansız dokunuşta kalecinin açık bıraktığı köşeye (direğin 1,3 m içine) vuruyordu.
- AI kalecinin `decide()`'ı 0,1–0,36 s'de bir onu konum noktasına geri çekiyordu: havada 3 s kalan yavaş, sekip gelen bir şutu takip zinciri kopunca hiç izlemedi; dokunursa da kurtarış zarı atılıyordu.
- Önce: 40–50 m'den dokunuş %19–65 gol (`LONG_REPORT=1`), doğal anlarda 45 m+ dokunuş counter %32, switch_play %19.
- Sonra: kaleci tepkisinden (Refleks) sonra her adımda topun **gerçek yörüngesinde** yetişebileceği en güvenli noktaya gider (önce ayakta / zıplayarak, gerekmedikçe dalmaz, topa doğru dalar); yetişirse kurtarır; kaleye girecek her serbest top (şut, uzun "pas") izlenir. 40–50 m dokunuş **%0–2**, 90'lık uzun şutçunun 40 m'den nişanlı şutu **%0** (≤ %8), 13 / 20 m şutçu statıyla artar, kaleci statıyla düşer; doğal anlarda 35 m+ dokunuş ≤ %2 (`longShot.test.ts` sabitliyor).

### Zar envanteri (önce → sonra)

| Zar (önce) | Ne yapıyordu | Sonra |
|---|---|---|
| Kurtarış / tutuş / yumruk zarı (`saveChance`, `catchChance`, `punchChance`, `KEEPER_SAVE_BONUS`, `HERO_PLACED_BEAT`, `HERO_FINISH_EDGE`, `TIGHT_ANGLE_SAVE`, `KEEPER_EDGE`, `SHOOTER_EDGE`, `OPP_KEEPER_REACH`, `HERO_KEEPER_HANDS`) | Kaleci dokunsa da gol olabiliyordu, yetişemese de kurtarabiliyordu | Kaldırıldı. Yetişen kurtarır (fizik: tepki, hızlanma, uzanma = Dalış / Refleks / Çeviklik / Hız); tutup tutmamak `hold` (Elle Kontrol, 11 m/s altı kesin), sekme yönü deterministik |
| Şutta yanlış vuruş (`misHit`, `MISHIT_DEG`, `frameSafe`, `heroMisHit`), hız / falso gürültüsü | İyi vuruşu zar bozabiliyordu | Kaldırıldı. Tek şans yön hatası (`errA`, `hErr`), statla küçülür, mesafeyle büyür |
| Penaltı okuma zarı (`PENALTY_READ_SAVE`, `penaltyRead`) | Kaleci tarafı rastgele okuyordu | `penaltyRead` olayı: GK Pozisyon vs Soğukkanlılık; okursa erken çıkar, kurtarış yine fizik |
| Müdahale / top kapma / omuz / ayakta kalma / hava topu / okuma / ilk dokunuş / smother / çalım / çağrı olasılıkları (her yerde ayrı formül) | Her an kendi oranını kullanıyordu | Hepsi `eventChance` → `statChance` (tek kural, `chanceEvents.ts`); girdi puanı `CHANCE_MOD` (zamanlama +20, arkadan −20, uzaktan dalış −40, kayarak −5, kalkan +15) |
| Faul zarı (her başarısız müdahalede) | Temiz müdahaleler de faul olabiliyordu | Yalnız pervasız müdahale (`RECKLESS_LUNGE`) `clean` olayı atar |
| Blok / sekme / başarısız çalım yönü | Rastgele | Deterministik (gövdeden geliş açısına göre) |

### Şans olayları (oyuncu statı ↔ karşı stat, girdi puanı)

| Olay | Oyuncu statı | Karşı stat | Girdi |
|---|---|---|---|
| tackle (top kapma) | Müdahale | Dripling | zamanlama +20, arkadan −20, uzaktan −40, kayarak −5 |
| clean (faulsüz) | Müdahale | – | ayakta +30, kayarak +10 |
| takeOn (çalım) | Dripling | Müdahale | hız / adamın tarafı |
| shoulder (omuz) | Güç | Güç | kalkan +15 |
| keepFeet (ayakta kalma) | Denge | Güç | – |
| aerial (hava topu) | Kafa | Kafa | servis kalitesi (Orta / Falso) |
| read (pas okuma) | Önsezi | Pas (uzun topta Uzun Pas) | yardım −40 |
| firstTouch (ilk dokunuş) | İlk Dokunuş | – | 8 m/s altı kesin; üstünde 50 − 3·(hız−8) |
| hold / smother (kaleci) | Elle Kontrol | – / Dripling | – |
| penaltyRead | GK Pozisyon | Soğukkanlılık | – |
| shift / call | Dripling / Vizyon | Çeviklik / – | – |

### Kontroller (telefon yolu, N = 200)

Sahibin yeni modeli 55–75 bandını kaldırdı (tek şans olayında başlangıç kahramanı ~%45–55). Kontroller: **akıl bandı** %30–85, **stat** (40 → 65 → 90 artış; puanlı değer: tam 1, kısmi ½ — fizik kurtarışında daha iyi şutçu kısmiyi gole çevirir), **özensiz** ≥ 20 puan aşağıda, **rakip** (güçlü < orta < zayıf, puanlı), **taban** (stat 40, iyi girdi, orta rakip ≥ %30; 40 vs güçlü bilgi olarak), **uzak şut** (dokunuş ≤ %2, nişanlı 40 m ≤ %8), **fizik değişmezleri** (`physicsInvariants.test.ts`).

| an | başlangıç (tam) | bant | stat 40/65/90 | özensiz farkı | rakip güçlü/orta/zayıf | taban (40) | 40 vs güçlü | uzak şut | fizik |
|---|---|---|---|---|---|---|---|---|---|
| back_post | 59 (49) | ✅ | 55/60/70 ✅ | 39 ✅ | 59/59/61 ❌ | 55 ✅ | 52 | – | ✅ |
| block | 71 (55) | ✅ | 68/69/77 ✅ | 21 ✅ | 69/71/74 ❌ | 68 ✅ | 68 | – | ✅ |
| corner | 45 (23) | ✅ | 34/46/52 ✅ | 20 ✅ | 34/45/53 ✅ | 34 ✅ | 26 | – | ✅ |
| corner_kick | 45 (27) | ✅ | 33/50/75 ✅ | 17 ❌ | 38/45/57 ✅ | 33 ✅ | 23 | – | ✅ |
| counter_2v1 | 58 (22) | ✅ | 53/59/60 ✅ | 17 ❌ | 47/58/70 ✅ | 53 ✅ | 44 | ✅ | ✅ |
| cross | 33 (10) | ✅ | 30/34/50 ✅ | 14 ❌ | 28/33/50 ✅ | 30 ❌ | 25 | ✅ | ✅ |
| defend | 52 (49) | ✅ | 28/67/85 ✅ | 31 ✅ | 34/52/68 ✅ | 28 ❌ | 17 | – | ✅ |
| defend_1v1 | 69 (68) | ✅ | 49/73/92 ✅ | 40 ✅ | 51/69/85 ✅ | 49 ✅ | 31 | – | ✅ |
| dribble | 35 (35) | ✅ | 21/38/49 ✅ | 24 ✅ | 28/35/37 ✅ | 21 ❌ | 18 | ✅ | ✅ |
| edge_of_box | 53 (25) | ✅ | 51/52/56 ✅ | 34 ✅ | 41/53/62 ✅ | 51 ✅ | 33 | ✅ | ✅ |
| fk_wall | 77 (25) | ✅ | 77/79/81 ❌ | 20 ✅ | 76/77/82 ❌ | 77 ✅ | 73 | – | ✅ |
| freekick | 41 (1) | ✅ | 41/48/50 ❌ | 22 ✅ | 34/41/51 ✅ | 41 ✅ | 33 | – | ✅ |
| gk_1v1 | 60 (30) | ✅ | 55/63/67 ✅ | 15 ❌ | 51/60/76 ✅ | 55 ✅ | 40 | – | ✅ |
| gk_claim | 78 (35) | ✅ | 69/76/83 ✅ | 24 ✅ | 70/78/87 ✅ | 69 ✅ | 60 | – | ✅ |
| gk_distribution | 81 (81) | ✅ | 76/81/85 ✅ | 48 ✅ | 69/81/87 ✅ | 76 ✅ | 65 | – | ✅ |
| gk_save | 74 (60) | ✅ | 74/75/74 ❌ | 21 ✅ | 73/74/82 ✅ | 74 ✅ | 70 | – | ✅ |
| gk_sweep | 55 (11) | ✅ | 52/59/65 ✅ | 30 ✅ | 47/55/73 ✅ | 52 ✅ | 40 | – | ✅ |
| header | 45 (34) | ✅ | 35/46/53 ✅ | 20 ❌ | 39/45/48 ✅ | 35 ✅ | 32 | – | ✅ |
| hold_up | 73 (73) | ✅ | 72/73/74 ❌ | 66 ✅ | 70/73/74 ❌ | 72 ✅ | 71 | ✅ | ✅ |
| interception | 62 (52) | ✅ | 40/62/83 ✅ | 26 ✅ | 41/62/69 ✅ | 40 ✅ | 26 | – | ✅ |
| long_ball_control | 48 (40) | ✅ | 43/54/61 ✅ | 14 ❌ | 37/48/61 ✅ | 43 ✅ | 33 | ✅ | ✅ |
| long_shot | 42 (3) | ✅ | 39/42/49 ❌ | 24 ✅ | 34/42/46 ✅ | 39 ✅ | 31 | ✅ | ✅ |
| one_on_one | 66 (45) | ✅ | 63/67/73 ✅ | 28 ✅ | 65/66/75 ✅ | 63 ✅ | 61 | ✅ | ✅ |
| penalty | 61 (61) | ✅ | 35/63/80 ✅ | 28 ✅ | 38/61/73 ✅ | 35 ✅ | 20 | – | ✅ |
| press_trap | 41 (40) | ✅ | 31/52/62 ✅ | 8 ❌ | 28/41/54 ✅ | 31 ✅ | 23 | – | ✅ |
| rebound | 67 (58) | ✅ | 61/69/72 ✅ | 37 ✅ | 58/67/68 ✅ | 61 ✅ | 53 | – | ✅ |
| recovery_run | 54 (23) | ✅ | 43/63/78 ✅ | 28 ✅ | 38/54/66 ✅ | 43 ✅ | 32 | – | ✅ |
| shoulder_duel | 64 (64) | ✅ | 57/68/77 ✅ | 17 ❌ | 40/64/73 ✅ | 57 ✅ | 37 | ✅ | ✅ |
| switch_play | 68 (67) | ✅ | 64/68/66 ❌ | 50 ✅ | 65/68/71 ✅ | 64 ✅ | 61 | ✅ | ✅ |
| timed_run | 70 (16) | ✅ | 69/78/93 ✅ | 24 ✅ | 64/70/79 ✅ | 69 ✅ | 63 | – | ✅ |

"–" uzak şut: o anda uzaktan şut yolu yok. Fizik sütunu: `physicsInvariants.test.ts` (8 değişmez: azalan hız, tünelleme yok, durma mesafesi hızla artar, uzun uçuş = daha çok kurtarış …) tüm anlar için ortak modülde geçiyor.

**❌ nedenleri (dürüst):**
- **Özensiz farkı < 20** (corner_kick, counter_2v1, cross, gk_1v1, header, long_ball_control, press_trap, shoulder_duel): sahibin modelinde girdi olayı *açar*, şansı yalnız birkaç puan değiştirir; stat ilk sırada. Özensiz bot da çoğu zaman olaya giriyor, fark statın payı kadar kalıyor.
- **Stat düz** (fk_wall, freekick, gk_save, hold_up, long_shot, switch_play): sonuç çoğunlukla fizikten (duvar, kalecinin yetişmesi, pasın yumuşak gelmesi); stat yalnız yön hatasını küçültüyor → 40–90 arası 2–9 puan.
- **Rakip düz** (back_post, block, fk_wall, hold_up): anahtar rakibin statı sonucu belirleyen olayda değil (ör. blokta sonuç gövdenin şut çizgisinde olması).
- **Taban < %30** (defend 28, dribble 21, cross 30): doğrusal kuralda 40'lık oyuncu orta rakibe (56–62) karşı %28–34 tavanla başlıyor; ardından fizik (alım, bitiriş) düşürüyor.


### Bilinçli değişen sabitlemeler

- `balance8`: kısa pas alımı ≥ %90 (stat 40) korunuyor; İlk Dokunuş sert topta sabit (+1 % / puan, yumuşak top kesin).
- `intent`: başlangıç minimumları şut 0,65 → 0,38, ŞUT düğmesi 0,2, müdahale 0,55 → 0,25; 1v1 köşe bantları fizik kalecisine (%34 / 47 / 63) — **sahip kararı**.
- `feel`: one_on_one 0,40 → 0,22, penaltı 0,62 → 0,50, edge_of_box 0,20 → 0,12, long_shot 0,06 → 0,02 alt; switch_play üst 0,72, gk_distribution üst 0,90.
- Drill par / eğri: pas 2130 → 1900, orta 1890 → 1500, dağıtım 690 → 560 (+ `CROSS_AWAY_M` 3: güçlü rakip artık drili kolaylaştırmıyor), kalecilik 72 → 60 ve eğri 1,01 → 1,6 (hiçbir şey yapmayan kaleci 0,33, iyi 0,66).
- `attrSensitivity`: Saldırganlık / GK Pozisyon / Zıplama / Refleks probları statın şimdi etki ettiği yere taşındı. Bulgu: Zıplama hava topunda ters çalışıyordu (40 → 85 kazanma 91 → 64/300) — `HEAD_ADJUST` 0,35 m ile düzeltildi (header 90'da %35 → 53). Kart DEFEND çiftinden Saldırganlık çıktı (artık müdahaleye etkisi yok).
- `KIND_CHECK_PENDING`: yukarıdaki ❌'li 18 an todo olarak listeli (gizlenmedi).
- Kariyer: `BALANCE=1` seed 1000 / 2000 / 3000 geçti (10. sezon OVR 82 / 82 / 83). Rol dengesi (ST / LW / CB, 12 kariyer × 8 sezon): sim reytingi, kariyer OVR'si ve reytingi her rolde mevki ortalamasının ±%3'ü içinde.


## Build 9 (5. tur): 30 türün hepsi ✅ — 1v1 kararı, açık kalan 18 tür (Ekim 2026)

Koordinatör kararı (sahibin kuralı): her tür her kontrolden geçer; `KIND_CHECK_PENDING` (todo listesi) kaldırıldı. Kontroller değişmedi (bant %30–85, stat 40 → 65 → 90 puanlı artış ≥ 8, özensiz ≥ 20 puan aşağıda, rakip sırası, taban ≥ %30 @40), N = 200, telefon yolu, deterministik tohumlar.

### 1v1 bitiriş kararı (fizikle, kurtarış zarı yok)

Hedef: yerleşik şut, orta kaleciye (~62–65) karşı Bitiricilik 50 → %45–55, 70 → %62–70, 90 → %78–85; kaleci bir puan iyi ≈ %1 az gol.

| sabit | önce | sonra (62–65'te aynı) |
|---|---|---|
| kaleci tepkisi | 0,34 − 0,22·Refleks | **0,42 − 0,34·Refleks** (40: 0,28 s, 90: 0,11 s) |
| dalış hızı (Uzanma eğimi) | 1,5 m/s | **3 m/s** |
| kol erimi | 0,4 + 0,75·Uzanma | **0,89 + 1,2·(Uzanma − 0,65)** |
| el erimi | 0,3 + 0,6·Refleks | **0,672 + 0,9·(Refleks − 0,62)** |
| vuruş yön hatası tabanı | 1,3 − beceri | **1,25 − beceri** |

Ölçüm (şut başına gol, n 150–200): **%47 / %66 / %82** (50/70/90). 13 m, 65'lik şutçu, kaleci 40 / 65 / 90: %67 → %51 → %19. Sabitleyen testler: `intent.test.ts` (şut başına, `intentFinishRate`; şuttan önce kaybedilen top bitiriş değildir), `longShot.test.ts` (kaleci 40 → 90 ≥ 35 puan).

### Ne değişti (fizik ve gerçekçi girdi; tür özel hile yok)

- **Gövde, kalkan, tutuş:** KORU'lu oyuncuya müdahale (Güç + Denge) / 2 ↔ Müdahale − 15 (zamanlama / arkadan iki kez sayılmaz); hold_up'ta açılış koruması yok (marker sırtında). Her sert top (> 12 m/s) gövde yüksekliğinde rakipten seker (yalnız şut değil). Kendi takımının topu tek inen oyuncu 1,95 m altı göğsüyle indirir; uzun topa tek giden rakip onu okumuş olmalı (Önsezi ↔ Uzun Pas).
- **Vuruş:** Şut Gücü eğimi 12 → 18 (25,8 … 34,8 m/s), serbest vuruş 6 → 20 (25,3 … 35,3); serbest vuruş barajın üstünden kaldırılır, düşüş Duran Top'tan, falso Curve'den (yan dönüş eğimi 130 → 170); hakem 9,15 m'yi korur (baraja 4 m'den vuruluyordu); kaleci topu baraj aşınca görür (× (1,3 − GK Pozisyon)). Uzun pas sürüklenmesi 0,08 → 0,5, havadan uzun top uzunluk hatası 0,9 → 2,6 m/s. Orta: sürüşün bölgeye uzaklığı topun kalitesi (+0,25 … −0,4); rakibin ortası da kendi koşucusuna avantaj.
- **Kaleci:** çeldiği topun yönü Tutuş'tan (iyi eller dışarı, zayıf eller ceza sahasına); süpürmede ceza sahasından 30 m'ye çıkar (ayakla). gk_1v1'de görev: doğru yöne gitmek, zamanında çıkmak (adam 10 m içinde) ya da açısını tutmak; fk_wall'da: vuruş anında yerinde olmak.
- **Savunma / baskı:** yapay zekâ çalımında koşarak gelen savunmacıya +20 yok (satılıp tökezlemek tek bedel; kalecide var); yapay zekâ yalnız önündeki adamı çalımlar; BASKI koşusu pas gölgesinden (1,5 m) geçer, son 3 m düz; şutör önündeki kahramanı Bitiricilik ↔ Pozisyon ile dolanır; soğukkanlı blok şutörü açı açılınca vurur (eskiden uzun hazırlanıp blokçuya zaman veriyordu).
- **Puanlama:** dribble — adamını geçip sonra kaybetmek kısmi, kalecinin çeldiği isabetli şut tam; 2'ye 1'de ceza sahası dışından şut kurtarışı kısmi değil (kuralın kendi yorumu böyleydi); ortadan şans: takım arkadaşı topu tehlike bölgesinde (13 m, ±9 m) karşılarsa.
- **Bot (iyi = doğru oyun, özensiz = gerçekçi dikkatsiz):** iyi — kalkanla 2 s tutup bırakır, boş koşucuya ve boşluk bulunca orta, ortasına göre korner seçimi, nadiren dalar / arkadan girmez, 1v1'de 7 m'de çıkar, ders kitabı baraj; özensiz — yeni topa geç tepki, uçuşu değil topu izler, baskıda koşmaz, rastgele baraj ve köşe hilesi, 14 m'de erken çıkar, orta sürüşü dağınık.

### Son tablo (telefon yolu, N = 200)

| tür | başlangıç (tam) | bant | stat 40/65/90 (puanlı) | özensiz farkı | rakip güçlü/orta/zayıf (puanlı) | taban (40) | uzak şut | fizik |
|---|---|---|---|---|---|---|---|---|
| back_post | 68 (52) | ✅ | 61/70/76 (53/62/67) ✅ | 47 ✅ | 51/60/61 ✅ | 61 ✅ | – | ✅ |
| block | 79 (53) | ✅ | 62/79/86 (50/67/77) ✅ | 57 ✅ | 51/66/67 ✅ | 62 ✅ | – | ✅ |
| corner | 47 (23) | ✅ | 36/47/52 (24/35/42) ✅ | 47 ✅ | 28/35/44 ✅ | 36 ✅ | – | ✅ |
| corner_kick | 45 (26) | ✅ | 33/46/56 (28/37/47) ✅ | 22 ✅ | 28/35/35 ✅ | 33 ✅ | – | ✅ |
| counter_2v1 | 59 (24) | ✅ | 54/60/61 (36/44/47) ✅ | 33 ✅ | 28/41/59 ✅ | 54 ✅ | ✅ | ✅ |
| cross | 39 (18) | ✅ | 35/39/47 (25/30/34) ✅ | 23 ✅ | 18/28/37 ✅ | 35 ✅ | ✅ | ✅ |
| defend | 60 (57) | ✅ | 39/69/87 (37/67/87) ✅ | 45 ✅ | 35/59/72 ✅ | 39 ✅ | – | ✅ |
| defend_1v1 | 82 (82) | ✅ | 54/87/97 (54/87/97) ✅ | 53 ✅ | 68/82/93 ✅ | 54 ✅ | – | ✅ |
| dribble | 84 (37) | ✅ | 75/85/88 (50/61/67) ✅ | 62 ✅ | 51/60/63 ✅ | 75 ✅ | ✅ | ✅ |
| edge_of_box | 55 (21) | ✅ | 50/56/60 (35/40/48) ✅ | 40 ✅ | 25/38/54 ✅ | 50 ✅ | ✅ | ✅ |
| fk_wall | 69 (28) | ✅ | 66/71/73 (46/51/54) ✅ | 31 ✅ | 43/49/55 ✅ | 66 ✅ | – | ✅ |
| freekick | 55 (3) | ✅ | 49/55/65 (26/29/36) ✅ | 36 ✅ | 20/29/33 ✅ | 49 ✅ | – | ✅ |
| gk_1v1 | 67 (30) | ✅ | 59/70/73 (41/52/56) ✅ | 21 ✅ | 41/48/60 ✅ | 59 ✅ | – | ✅ |
| gk_claim | 84 (38) | ✅ | 77/83/87 (52/61/67) ✅ | 22 ✅ | 49/61/64 ✅ | 77 ✅ | – | ✅ |
| gk_distribution | 82 (82) | ✅ | 77/82/87 (77/82/87) ✅ | 24 ✅ | 70/82/88 ✅ | 77 ✅ | – | ✅ |
| gk_save | 78 (64) | ✅ | 66/76/79 (56/70/73) ✅ | 25 ✅ | 69/71/74 ✅ | 66 ✅ | – | ✅ |
| gk_sweep | 56 (14) | ✅ | 51/57/63 (31/36/40) ✅ | 33 ✅ | 25/35/45 ✅ | 51 ✅ | – | ✅ |
| header | 42 (32) | ✅ | 34/47/52 (27/42/50) ✅ | 38 ✅ | 34/37/45 ✅ | 34 ✅ | – | ✅ |
| hold_up | 55 (55) | ✅ | 46/63/76 (46/63/76) ✅ | 49 ✅ | 32/55/65 ✅ | 46 ✅ | ✅ | ✅ |
| interception | 70 (61) | ✅ | 45/70/83 (41/66/78) ✅ | 35 ✅ | 51/65/69 ✅ | 45 ✅ | – | ✅ |
| long_ball_control | 52 (42) | ✅ | 50/57/65 (44/54/63) ✅ | 27 ✅ | 40/47/66 ✅ | 50 ✅ | ✅ | ✅ |
| long_shot | 43 (4) | ✅ | 40/48/59 (23/27/33) ✅ | 28 ✅ | 16/24/32 ✅ | 40 ✅ | ✅ | ✅ |
| one_on_one | 69 (48) | ✅ | 66/70/74 (52/59/66) ✅ | 34 ✅ | 46/58/73 ✅ | 66 ✅ | ✅ | ✅ |
| penalty | 59 (59) | ✅ | 34/61/80 (34/61/80) ✅ | 26 ✅ | 34/59/77 ✅ | 34 ✅ | – | ✅ |
| press_trap | 46 (45) | ✅ | 41/53/65 (41/52/65) ✅ | 22 ✅ | 27/46/56 ✅ | 41 ✅ | – | ✅ |
| rebound | 64 (57) | ✅ | 60/66/71 (56/63/67) ✅ | 35 ✅ | 46/61/66 ✅ | 60 ✅ | – | ✅ |
| recovery_run | 55 (21) | ✅ | 42/63/76 (28/45/65) ✅ | 40 ✅ | 25/38/52 ✅ | 42 ✅ | – | ✅ |
| shoulder_duel | 61 (61) | ✅ | 54/71/79 (54/71/79) ✅ | 50 ✅ | 40/61/80 ✅ | 54 ✅ | ✅ | ✅ |
| switch_play | 80 (79) | ✅ | 79/83/88 (79/83/88) ✅ | 61 ✅ | 80/80/89 ✅ | 79 ✅ | ✅ | ✅ |
| timed_run | 78 (18) | ✅ | 73/79/91 (43/51/60) ✅ | 63 ✅ | 42/48/62 ✅ | 73 ✅ | – | ✅ |

"–" uzak şut: o anda uzaktan şut yolu yok. Fizik sütunu: `physicsInvariants.test.ts` ortak modül için yeşil.

**Önce → sonra (açık kalan 18 tür):** back_post rakip 53/54/54 → 51/60/61; block rakip 64/63/64 → 51/66/67; corner_kick fark 17 → 22; counter_2v1 fark 17 → 33; cross fark 14 → 23, taban 30 → 35; defend taban 28 → 39; dribble taban 21 → 75; fk_wall stat 48/52/55 → 46/51/54 ve rakip 50/51/53 → 43/49/55; freekick stat 22/25/28 → 26/29/36; gk_1v1 fark 15 → 21; gk_save stat 63/68/67 → 56/70/73; header fark 20 → 38; hold_up stat 72/73/74 → 46/63/76; long_ball_control fark 14 → 27; long_shot stat 22/23/27 → 23/27/33; press_trap fark 8 → 22; shoulder_duel fark 17 → 50; switch_play stat 63/68/65 → 79/83/88.

**Dürüst not:** koordinatörün "düz" türlerde istediği 25–45 puanlık yükseliş (başarı, 40 → 90): hold_up +30, long_shot +19, freekick +16, gk_save +13, switch_play +9, fk_wall +7. Kontrol (puanlı ≥ 8) geçiyor; fk_wall / switch_play / gk_save'de yükseliş hâlâ dar — kalecinin ve uzun pasın statları fizikte büyük, ama sonuç büyük ölçüde rakibin vuruşuna / pasın zaten tutulmasına bağlı.

### Bilinçli değişen sabitlemeler (bu tur)

- `intent`: 1v1 bantları şut başına %42–57 / %60–73 / %76–88; müdahale gürültüsü 0,02 → 0,03, ortalama fark 0,15 → 0,14.
- `feel`: gk_save üst 0,85 → 0,93, hold_up alt 0,45 → 0,35, dribble alt 0,28 → 0,20, switch_play üst 0,72 → 0,90, recovery_run üst 0,78 → 0,88, freekick alt 0,06 → 0,04.
- `balance8`: hold_up açılış koruması yok (tasarım).
- `attrSensitivity`: Kafa isabeti 0,1 → 0,06 (tavanda), BASKI acelesi 0,03 → 0,015 s, GK Pozisyon 3 → 1,5 pp; Saldırganlık BLOK yayılımı 0,4 → 0,55, BASKI acelesi 0,12 → 0,2.
- Drill: pas 1900 → 1563 (eğri 0,85), kalecilik 60 → 50 (eğri 1,9), switch 1865 → 1100, serbest vuruş 14 → 16 (eğri 1,15).
- Kariyer: `BALANCE=1` seed 1000 / 2000 / 3000 geçti (10. sezon OVR 82 / 82 / 83); rol dengesi (ST / LW / CB, 12 kariyer × 8 sezon) her rolde mevki ortalamasının ±%3'ü içinde. Golden ve tam vitest yeşil (246 dosya, 2190 test, 0 todo).

