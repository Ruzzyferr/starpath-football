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

<!-- MATCH-FEEL -->
