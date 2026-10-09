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
özellik anları turundan kalma) ve ayrı bir ayar turu gerektiriyor. `roleBalance.test` korunağı (40 maç, ±%8)
ve `roles.test` yeşil. `STATS_GUARD=1` (40 × 10) tolerans içinde; `statsBaseline.json` yeniden merkezlenmedi.

**Golden master bilinçli olarak `UPDATE_GOLDEN=1` ile yenilendi** (aynı commit): kariyer sezonu özeti değişti
(an sayısı, şut ağırlıkları, maç ünü); 1000 AI maçının özeti değişmedi.
