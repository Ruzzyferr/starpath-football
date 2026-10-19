# Monetizasyon Analizi ve Tasarımı (TASLAK)

> Durum: **analiz tamam, uygulama ertelendi** (2026-10-13). Ödeme sistemi, oyunun mevcut hali mükemmelleştirildikten sonra kodlanacak.
> Bu belge kararın gerekçesini, simüle müşteri panelinin tüm turlarını, önerilen ürün kataloğunu, ekonomi ve denge kurallarını, teknik mimariyi, mağaza ve yasal yükümlülükleri ve uygulama yol haritasını içerir.
> Hukuki tavsiye değildir. Fiyatlar ve oranlar, gerçek oyuncu verisiyle doğrulanana kadar tahmindir.

## Uygulanan durum (2026-10-19)

Plana göre gerçekte yapılanlar ve değişenler:

- Elmas paketleri en fazla **1.300** (220 / 600 / 1.300); 2.800 ve 7.500'lük paketler kalktı.
- Ekipman fiyatları **200 / 100 / 80** elmas.
- Ücretsiz elmas: MOTM **8**, hedef **8**, başarım **10**, sezon **100**, ödül **25**; günde en çok **300**.
- Nakit sınırı sezon başına **600k**; nakit paketi tavanları **50k / 150k / 400k**.
- Pro Sözleşme günde **50** elmas (sahip kararı korundu).
- **Efsane Kariyerler henüz yok.**
- Elmaslar sunucuda tutulur: DigitalOcean droplet üzerinde anonim mağaza hesabı.
- Yaş kapısı: kumarhane ve nakit satın alma 18+; reklamlar 18 yaş altı/bilinmeyende kişiselleştirilmemiş.

---

## 0. Tek sayfada karar

| Konu | Karar |
|---|---|
| Model | **Oynaması ücretsiz (F2P), tüm kariyer açık.** "İlk sezon ücretsiz + tek seferlik Tam Kariyer (€7.99)" modeli **kaldırılıyor**. |
| Ana para birimi | **Elmas (💎).** Gerçek parayla paket olarak satılır, oynayarak da kazanılır (az). |
| Giriş ürünü | **Başlangıç Paketi €0.99** (hesap başına bir kez): 300💎 + Altın Krampon. Panelde satın alanların neredeyse tamamı buradan girdi. |
| İkinci ürün | **Efsane Kariyerler €2.99** (tek seferlik): harika çocuk olarak büyük kulüpte başla, emeklilikten sonra teknik direktör olarak devam et. |
| Elmasın kullanımı | Antrenmanı hızlandıran ekipman (krampon vb.), kozmetik (forma, krampon rengi, gol sevinci). |
| Oyun içi para (€) | **Satılır** (nakit paketleri). Kumarhane aynı parayla çalışmaya devam eder (sahip kararı). Yaş derecesi buna göre güncellenmeli. |
| Abonelik | **Pro Sözleşme €4.99/ay:** her gün 20💎 (round-4 incelemesi: 50💎 her elmas paketinden değerliydi). Panelde ilk ayda kimse almadı, gelir ana kalemi değil. |
| Reklam | **Ödüllü reklam var** (isteğe bağlı: "izle, kazan"). **Zorla reklam yok** (geçiş reklamı yok). Banner: yalnızca menülerde, herhangi bir satın alma kaldırır; lansmanda kapalı, test sonrası karar (§6.7). |
| Ücretsiz kalanlar | Zorla reklam yok, ganimet kutusu yok, enerji sınırı yok, çevrimdışı. **Editör** (gerçek isimler) ve **kayıt yedekleme** ücretsiz. |
| Değişmez kural | **Ekipman küçük ve sınırlı stat artışı verir (stat başına en fazla +5) ve oyunda da kazanılır** (kariyer parası, krampon sponsoru, sezon ödülleri, kupalar). Takılıyken maçta geçerlidir, süresi maçla dolar; temel statlar değişmez. Fiyatlar maaşla birlikte asla artmaz. (Sahip kararı 2026-10-19: eski "ekipman yalnızca antrenmanı hızlandırır" kuralının yerine; bkz. §6.2.) |
| En iyi sonuç (simülasyon) | v5 teklifi: aynı 20 alıcıda **9/20 (%45)**, hiç görmediği 20 yeni alıcıda **13/20 (%65)**, 16 satın alma. Gerçek F2P dönüşümü bunun çok altında olur (genelde %2-5). |

---

## 1. Neden model değişiyor?

### 1.1 Sahip görüşü
"Bu uygulamadan böyle para kazanamayız." Tek seferlik kilit, oyunu en çok sevenlerden bile tek bir kez para alır. NSS de bu şekilde para kazanmıyor: oyun içi para, tüketilebilir ürünler ve hızlanma satıyor.

### 1.2 Referans: New Star Soccer nasıl para kazanıyor?
Kaynak: `docs/research/02-store-yorumlari.md`.

- **Gelir karışımı (üçüncü taraf tahmini, AppGoblin):** gelirin ~%77'si reklam, ~%23'ü uygulama içi satın alma (IAP). Aylık ~561 bin aktif kullanıcı.
- **Satılanlar:**
  - **Bux** (oyun içi para): paketler 46,99 $'a kadar çıkıyor.
  - **NRG Bolt** (0,99 $).
  - Pro/Expert ajan, antrenör ve krampon (1,99-3,99 $, **150 maç sonra bitiyor**).
  - Reklam kaldırma.
- **En büyük şikâyetler (yıllardır 1-3★ sebebi):**
  1. **NRG fiyatının maaşla birlikte artması.** "Daha iyi sözleşme" anlamsızlaşıyor.
  2. **Enerjinin zamanla dolmaması**, maç kazancının NRG'yi bile karşılamaması.
  3. **Tüketilebilir ürünlerin süresinin önceden söylenmemesi** ("150 maç" sürpriz).
  4. Önceden oyun içi parayla alınan eşyaların gerçek paraya taşınması.
  5. Atlanamayan reklamlar.

**Ders:** NSS'in para kazandığı yer (oyun içi para, hızlanma, ekipman) ile oyuncuyu kaçırdığı yer (ölçeklenen fiyat, gizli süre, enerji duvarı, reklam) farklı. Biz ilkini alıyoruz, ikincisini almıyoruz.

### 1.3 Diğer karşılaştırmalar

| Oyun | Model | Fiyatlar | Ders |
|---|---|---|---|
| **BitLife** (hayat simülasyonu) | F2P + reklam + tek seferlik paketler + tüketilebilir | Time Machine kullanımı 0,99 $ · Bitizenship 7,99 $ · God Mode 9,99 $ · paket 15,99 $; aralık 0,99-20,99 $ | Hayat simülasyonu oyuncusu **hikâye kontrolü ve güç** için ödüyor. Fiyatlar zamanla yükseltilmiş. |
| **Retro Goal** (New Star) | Kariyer duvarı kaldırıldı, F2P oldu; reklamsız; isteğe bağlı "unlimited mode" + Bux | Unlimited: 500 Bux, turnuva modu, hava durumu, sezon uzunluğu, Hall of Fame | Aynı stüdyo, **kariyer duvarından vazgeçip** F2P'ye geçti. |
| **Retro Bowl** | Reklamsız, tek seferlik "Unlimited" (~1-1,39 $) + koçluk kredisi | Takım adı düzenleme, kadro genişletme | Editör tipi özellikler satılabilir, ama ucuz. |

Kaynaklar: [BitLife App Store](https://apps.apple.com/app/bitlife/id1374403536), [BitLife IAP geçmişi](https://www.apppricinglab.com/app/apple/1374403536), [Retro Goal F2P'ye geçiş (PocketGamer.biz)](https://www.pocketgamer.biz/f2p-scores-a-win-with-retro-goals-monetisation-strategy-changes/), [Retro Bowl (Wikipedia)](https://en.wikipedia.org/wiki/Retro_Bowl).

---

## 2. Yöntem: simüle müşteri paneli

### 2.1 Nasıl çalıştı
- Araç: founder-consumer becerisi (`panel.py`). Her alıcı ayrı bir yapay zekâ alt ajanı. Her biri kendi kimlik kartını (yaş, segment, gelir, satın alma davranışı, alışkanlık, akla ilk gelen itiraz) ve aynı teklif metnini okuyor. Kararını JSON olarak yazıyor:
  - alır mı;
  - ilk ay kaç satın alma;
  - neden kodu ve kendi sözleriyle neden;
  - itirazı ve fikrini neyin değiştireceği;
  - dört fiyat sorusu.
- Her tur 20 alıcı. Turlar arasında **aynı kartlar** (tohum 864410) kullanıldı, yani yalnızca teklif değişti.
- Kazanan teklif, ezber riskine karşı **hiç görmediği 20 yeni alıcıyla** (tohum 20261013) ayrıca test edildi.
- Ham veri: `founder/rounds/v1 … v5-holdout/` (git dışı, `.git/info/exclude`).

### 2.2 Hedef müşteri profili (`founder/customer.json`)

| Segment | Pay | Yıllık gelir (USD) |
|---|---|---|
| Genç futbol fanı (harçlık, satın alma ebeveyn onayıyla) | %30 | 0-3.000 |
| Öğrenci / genç çalışan NSS emektarı (2012-2018) | %35 | 6.000-30.000 |
| Çalışan casual mobil oyuncu | %25 | 25.000-70.000 |
| Hardcore simülasyon oyuncusu (FM, PC kariyer modları) | %10 | 30.000-90.000 |

Satın alma davranışları:

| Davranış | Pay |
|---|---|
| Yalnızca ücretsiz oynar | %25 |
| NSS'ten yanmış emektar | %20 |
| Adil premium'a öder (Retro Bowl alır) | %15 |
| Her yorumu okur | %15 |
| Önce futbol, sonra oyun | %15 |
| Bir haftada sıkılır | %10 |

İtirazlar NSS mağaza yorumlarından alındı:
- "her NSS halefi enerji/reklam cehennemine döner";
- "€7.99 çok";
- "bilinmeyen geliştirici bırakır";
- "kontroller NSS'ten kötü olabilir";
- "gerçek kulüp/oyuncu yok";
- "ücretsiz sezonu oynar bırakırım";
- "kayıt telefon değişince gider mi".

### 2.3 Sınırlar (önemli)
- Bunlar **gerçek müşteri değil.** Dil modelleri olumluya meyillidir; çıkan oranlar **üst sınır**dır.
- Panel, itirazları ve hangi teklifin hangi itirazı çözdüğünü bulmakta iyidir. Gerçek dönüşüm oranını tahmin etmekte kötüdür.
- Panel **oyun içi anı** simüle edemez. Örneğin "kariyeri bitiren sakatlık anında Zaman Makinesi teklifi" gibi tetiklenen satışlar burada ölçülemez. Bunlar gerçek oyuncuyla test edilmeli.
- Bazı kartlarda yaş ile segment uyumsuz (ör. 14 yaşında "NSS emektarı"). Araç yaşı segmentten bağımsız çekiyor.
- Bir F2P oyunda gerçek ödeyen oranı genelde **%2-5**'tir. Panelin %45-65'i bununla karşılaştırılamaz. Yalnızca teklifler arası **göreli** karşılaştırma için anlamlıdır.

---

## 3. Tur tur sonuçlar

### Özet tablo

| Tur | Teklif | Alan | İlk ay satın alma | Kabaca gelir / 100 indirme (üst sınır) |
|---|---|---|---|---|
| v1 | İlk sezon ücretsiz + Tam Kariyer €7.99 | 6/20 (%30) | 6 | ~€240 |
| v2 | Tamamen ücretsiz + Zaman Makinesi / Editör / Hanedan / paketler | 4/20 (%20) | 4 | ~€100 |
| v3 | F2P elmas: ekipman, enerji içeceği, Başlangıç €0.99, Pro Sözleşme, nakit | 8/20 (%40) | 8 | ~€40 |
| v4 | v3 + ücretsiz Editör + "sezonda ~400 ücretsiz elmas" | 3/20 (%15) | 3 | ~€15 |
| **v5** | v3 tabanı, enerji içeceği yok, ücretsiz Editör + yedek, kozmetik, Efsane Kariyerler €2.99 | **9/20 (%45)** | 12 | ~€90 |
| **v5 yeni alıcılar** | aynı v5, 20 yeni kart | **13/20 (%65)** | 16 | ~€120 |

> **Gelir notu:** v1'in "100 indirme başına" geliri yüksek görünür, ama ücretli duvar indirme ve tutundurmayı düşürür. F2P'de indirme tabanı genişler ve satın alma ilk aydan sonra da sürer (elmas paketleri, kozmetik, abonelik). Panel yalnızca ilk ayı ölçer, uzun kuyruğu ölçemez. Gerçek karşılaştırma ancak yumuşak lansman verisiyle yapılabilir (§9).

### v1: İlk sezon ücretsiz + €7.99 Tam Kariyer → %30
- Alanlar: her yorumu okuyanlar (3/3), önce futbol diyenler (2/3), NSS emektarı öğrenciler (%43).
- Almayanlar:
  - **alışkanlık (7):** "ücretsiz sezonu oynar, ödemeden bırakırım";
  - **güven (5):** "her NSS halefi bozulur", "geliştirici bırakır mı";
  - **fiyat (2):** harçlık, ebeveyn onayı.
- Fiyat aralığı (Van Westendorp): €2.00-8.99. Pazarlık noktası ~€4.

### v2: Tamamen ücretsiz + ekstralar → %20 (düştü)
- "Ekstralarda ihtiyacım olan hiçbir şey yok." **Ödeme anı ortadan kalkınca** satın alma düştü.
- En çok istenen ekstra **Editör** (gerçek isimler) oldu. Zaman Makinesi neredeyse hiç anılmadı (anı simüle edilemiyor).

### v3: F2P elmas ekonomisi (sahibin yönü) → %40 (en iyi o ana kadar)
- 8 alıcının **tamamı yalnızca €0.99 Başlangıç Paketi** aldı. Kimse Pro Sözleşme almadı.
- Almayanların itirazları:
  - "elmasla antrenman hızlanıyorsa pay-to-win başlıyor";
  - gerçek isimlerin paralı olması;
  - abonelik;
  - geliştiriciye güven.
- **Enerji içeceği** NSS'in NRG travmasını tetikledi.

### v4: Cömert ücretsiz yol → %15 (en kötü)
- Teklife "ücretsiz oyuncu sezonda ~400 elmas kazanır, her sezon Altın Krampon'a yeter" yazıldı. Sonuç: "**Her şey bedavaysa neden ödeyeyim?**" (ihtiyaç kodu).
- **Ders:** ücretsiz yolun ne kadar cömert olduğunu sayıyla ilan etmek talebi öldürüyor. Ücretsiz yol adil olmalı, ama pazarlama metni "biraz oynayarak kazanılır" demeli, rakam vermemeli.

### v5: Kazanan teklif → %45, yeni alıcılarda %65
v5'in teklif metni:

> StarPath Football: live a footballer's whole life, from the academy to legend. Play the key moments of each match yourself and run your life off the pitch.
> Free to play, the whole career. No ads, no loot boxes, offline. Free Editor for real club and player names. Back up your career to a file for a new phone.
> Starter Pack, once only, EUR 0.99: 300 diamonds + Golden Boots (+15% training XP for 60 matches; your player wears them on the pitch).
> Diamonds (earn some by playing, packs from EUR 1.99) buy boots and gear, exclusive kits, boot colours and goal celebrations everyone sees in your matches. Equipment gives small, capped stat boosts (+5 max per stat) and can be earned in-game with career money or rewards.
> Legend Careers, one-time EUR 2.99: start as a wonderkid at a top club, or carry on as a manager after you retire.
> Optional Pro Contract EUR 4.99 a month: 20 diamonds a day, cancel anytime. Prices never go up as your salary grows.

- Tuned set: 9 alan, **3'ü ikinci ürün olarak Efsane Kariyerler'i** de aldı (12 satın alma).
- Yeni alıcılar: 13 alan, 16 satın alma. Ayrıca 1 kişi **yalnızca** Efsane Kariyerler'i aldı (elmas istemeyen ama tek seferlik kilide ödeyen tip).
- Kalan itirazlar:
  - kontroller ve takım arkadaşı yapay zekâsı NSS'ten kötü olabilir;
  - "elmas = gizli grind";
  - kaydın telefon değişiminde kaybolması (yedek dosyası "elle uğraş" bulundu);
  - hazır gerçek isim dosyası isteği (Editör'e elle yazmak istemiyorlar).

### 3.1 Hiçbir turda kıpırdamayan taban
Her turda aynı grup almadı:
- **hiç mobil oyuna para vermemiş gençler** ("ödeme ekranı görünce silerim");
- **NSS'ten yanmış emektarlar** ("haftalarca oynayıp kanıt görmeden ödemem").

Bunları teklif metni değil, yalnızca **gerçek kanıt** döndürür: mağaza puanı, temiz 1★ yorumlar, düzenli güncelleme geçmişi, oynanış videosu. 20/20 hedefi dürüstçe ulaşılamaz. Metni bu kartlara göre bükmek, gerçek mağazada karşılığı olmayan bir sonuç üretir.

---

## 4. Öğrenilenler (tasarıma girdi)

1. **€0.99 kapı ürünü şart.** İlk satın alma psikolojik eşiği kırıyor. Sonraki satın almalar bundan sonra geliyor.
2. **Tek seferlik "içerik" kilidi ikinci ürün olarak çalışıyor** (Efsane Kariyerler). Elmas istemeyen alıcılar bile alıyor.
3. **Ücretsiz yolun cömertliğini sayıyla ilan etme** (v4 dersi). Adil ol, ama "ihtiyaç" duygusunu koru.
4. **Enerji içeceği satma.** NSS'in NRG'si bu kitlenin en büyük travması.
5. **"Maç sonucunu değiştirmez" ve "fiyat maaşla artmaz" cümleleri** güven için gerekli, ama tek başına yeterli değil.
6. **Gerçek isimler bir dönüşüm sürücüsü.** Editör ücretsiz olmalı (satmak itiraz yaratıyor). Asıl istenen, **hazır isim dosyasını birkaç dokunuşla içe almak.** Bu topluluk dosyasıyla çözülür (§7.5).
7. **Abonelik ilk ayda satmıyor.** Uzun vadeli oyuncuda değer üretebilir, ama ana gelir değil. Metinde "isteğe bağlı" olarak kalmalı.
8. **Kalıcı görünürlük** (krampon sahada görünüyor, forma) "neden ödeyeyim"i biraz azaltıyor.
9. **Güven, pazarlama değil ürün işi:** güncelleme günlüğü, yol haritası, oynanış videosu, kayıt yedeği.

---

## 5. Ürün kataloğu (v5, uygulanacak)

Ürün kimliği = hak (entitlement) kimliği = mağaza SKU'su. Play Console ve App Store Connect'te birebir aynı kimliklerle açılmalı.

| Kimlik | Tür | Fiyat (EUR) | Verdiği | Not |
|---|---|---|---|---|
| `starter_pack` | Tüketilmeyen (bir kez) | 0.99 | 300💎 + Altın Krampon (60 maç) | Hesap başına bir kez. Mağazada "tüketilmeyen", oyunda elmas bir kez verilir. |
| `legend_careers` | Tüketilmeyen | 2.99 | Harika çocuk başlangıcı + emeklilik sonrası teknik direktör kariyeri | Yeni içerik (§7.4). |
| `gems_s` | Tüketilen | 1.99 | 220💎 | En küçük elmas paketi (Başlangıç'tan pahalı birim fiyat). |
| `gems_m` | Tüketilen | 4.99 | 600💎 | "En popüler" etiketi. |
| `gems_l` | Tüketilen | 9.99 | 1.300💎 | |
| `gems_xl` | Tüketilen | 19.99 | 2.800💎 | |
| `gems_xxl` | Tüketilen | 49.99 | 7.500💎 | "En iyi değer". |
| `cash_s` | Tüketilen | 1.99 | 4 haftalık maaş (taban: €5.000) | Aktif kariyere eklenir (§6.4). |
| `cash_m` | Tüketilen | 4.99 | 12 haftalık maaş (taban: €15.000) | |
| `cash_l` | Tüketilen | 9.99 | 30 haftalık maaş (taban: €40.000) | |
| `pro_contract` | Abonelik (aylık) | 4.99 | Her gün 20💎 (talep edilince), Pro rozeti | Android: taban plan `monthly`. İstediğin zaman iptal. |
| `pack_celebrations` | Tüketilmeyen | 1.99 | Mevcut kozmetik paketi | Kalır. Ayrıca elmasla da açılabilir. |
| `pack_avatar` | Tüketilmeyen | 1.99 | Mevcut kozmetik paketi | Kalır. |
| `full_career` | (emekli) | - | - | Satıştan kaldırılır. TestFlight'ta satın alanların kaydı silinmez, kilit zaten kalkıyor. |

Fiyatlandırma notları:
- Elmas paketlerinde birim fiyat büyüdükçe ucuzlar (220/1,99 → 7.500/49,99). Başlangıç Paketi kasıtlı olarak en iyi değerdir (kapı ürünü).
- Türkiye gibi pazarlarda mağazaların bölgesel fiyat şablonları kullanılmalı (₺ fiyatları elle yazılmaz). Oyun, mağazanın `priceString` değerini olduğu gibi gösterir (mevcut davranış).
- "Önce şu fiyattı" gibi sahte çapa yok. Sahte geri sayım veya "son 3 adet" yok.

---

## 6. Ekonomi tasarımı

### 6.1 Elmas kaynakları (ücretsiz)
**İç hedef:** düzenli oynayan ücretsiz oyuncu sezonda ~250-350💎 kazanır. Bu, yaklaşık bir orta ekipman eder. Mağaza metninde **sayı verilmez** (§4.3).

| Kaynak | Miktar | Sezonda tahmini |
|---|---|---|
| Maçın Oyuncusu | 5💎 | 5-15 kez → 25-75 |
| Haftalık hedef tamamlandı (mevcut `objectives` sistemi) | 3💎 | ~30 hafta → ~90 |
| Sezon sonu ödülleri (lig şampiyonluğu, gol krallığı, yılın oyuncusu) | 20-50💎 | 0-150 |
| Başarımlar (ilk gol, ilk milli maç, 100. maç vb.) | 10-25💎 | değişken |

### 6.2 Ekipman ve elmas harcamaları (sahip kararı 2026-10-19: NSS tarzı stat kramponları)

Ekipman artık **stat verir**: her krampon (ve aksesuar) takılıyken bir ya da birkaç belirli stata puan ekler, bu
artış **maçta da geçerlidir**. Süre maçla dolar; süre bitince ya da çıkarınca artış kalkar. Temel statlar hiç
değişmez (antrenman, gerileme ve OVR temel statla çalışır). Tüm ekipmandan bir stata gelen toplam en fazla **+5**.
Ekipman artık antrenman XP'sini hızlandırmaz (ödüllü reklamın antrenman takviyesi aynen kalır).

Üç yoldan alınır: **kariyer parası** (herkes, yaş sınırı yok: gerçek para değil), **elmas** (fiyatı sunucu belirler,
`server/catalog.json` "spend") ve **ödül** (krampon sponsoru, büyük sezon ödülleri, kupalar).

| Kademe | Elmas | Kariyer parası | Süre |
|---|---|---|---|
| Standart | 60💎 | €5.000 | 20 maç |
| Pro | 100💎 | €40.000 | 40 maç |
| Elit | 200💎 | €200.000 | 60 maç |
| Efsane | 300💎 | €750.000 | 80 maç |

Kademe fiyatları maaş eğrisine göre (docs/BALANCE.md, medyan haftalık maaş 17 yaş ~730, 19 yaş ~7K, 21 yaş ~25K,
23 yaş ~62K): Standart ilk sezon alınır, Pro 18-19 yaşında, Elit 20 yaş civarı, Efsane 21+ yaşında gerçek bir hedef.

| Kimlik | Ad (TR / EN) | Kademe | Yuva | Statlar |
|---|---|---|---|---|
| classic_boots | Klasik Krampon / Classic Boots | Standart | krampon | şut, pas, dripling, ilk dokunuş +1 |
| sprint_boots | Koşu Kramponu / Sprint Boots | Standart | krampon | hız +2, ivmelenme +1 |
| grip_boots | Tutunan Krampon / Grip Boots | Standart | krampon | top kapma +2, denge +1 |
| training_gloves | Antrenman Eldiveni / Training Gloves | Standart | aksesuar (kaleci) | refleks, top tutma, uzanma +1 |
| compression | Kompresyon Seti / Compression Set | (80💎, €10.000, 40 maç) | toparlanma | yorgunluk toparlanması +%20 (stat yok) |
| striker_boots | Nişancı Kramponu / Striker Boots | Pro | krampon | şut +3, bitiricilik +2, falso +1 |
| speed_boots | Hız Kramponu / Speed Boots | Pro | krampon | hız +3, ivmelenme +3 |
| playmaker_boots | Oyun Kurucu Kramponu / Playmaker Boots | Pro | krampon | pas +3, vizyon +2, uzun pas +2 |
| aerial_boots | Hava Hakimi Kramponu / Aerial Boots | Pro | krampon | kafa +3, sıçrama +2, güç +1 |
| keeper_gloves | Kaleci Eldiveni Pro / Pro Keeper Gloves | Pro | aksesuar (kaleci) | refleks, top tutma, uzanma +2 |
| mind_band | Zihin Bandı / Mind Band | Pro | aksesuar | soğukkanlılık, sezgi, vizyon +2 |
| gold_boots | Altın Krampon / Golden Boots | Elit | krampon | şut, bitiricilik, pas, dripling, ilk dokunuş, hız +2 |
| dribbler_boots | Dripling Kramponu / Dribbler Boots | Elit | krampon | dripling +4, çeviklik +3, denge +2, ilk dokunuş +2 |
| sweeper_boots | Libero Kramponu / Sweeper Boots | Elit | krampon | top kapma +4, pozisyon +3, sezgi +2, güç +2 |
| freekick_boots | Frikik Kramponu / Free-Kick Boots | Elit | krampon | duran top +4, falso +4, orta +3, uzun pas +2 |
| elite_gloves | Elit Kaleci Eldiveni / Elite Keeper Gloves | Elit | aksesuar (kaleci) | refleks +4, uzanma +3, top tutma +3, kaleci pozisyonu +2 |
| legend_striker | Efsane Golcü Kramponu / Legend Striker Boots | Efsane | krampon | bitiricilik +4, şut +4, soğukkanlılık +3, falso +3, ivmelenme +2 |
| legend_maestro | Efsane Maestro Kramponu / Legend Maestro Boots | Efsane | krampon | pas +4, vizyon +4, uzun pas +3, ilk dokunuş +3, dripling +3 |
| legend_wall | Efsane Duvar Kramponu / Legend Wall Boots | Efsane | krampon | top kapma +4, kafa +4, pozisyon +3, sıçrama +3, güç +3 |
| legend_gloves | Efsane Kaleci Eldiveni / Legend Keeper Gloves | Efsane | aksesuar (kaleci) | refleks, uzanma, top tutma +4, kaleci pozisyonu, oyun kurma +3 |

Diğer elmas harcamaları: Fizyoterapi Seansı 100💎 (reklamla 50💎; kalan sakatlık haftası yarıya iner), kozmetik
paketler 250💎, Elmas → € 100💎 = 2 haftalık maaş (taban €2.500, tavan €25.000).

Kurallar:
- **Ekipman yuvaları:** krampon (1), aksesuar (1), toparlanma (1). Aynı yuvaya yenisi takılınca eskisinin kalan maçı **kaybolmaz**, envanterde bekler.
- **Süre maçla ölçülür ve satın almadan önce gösterilir.** Yalnızca **oynanan** maçlar düşer.
- **Stat tavanı:** tüm takılı ekipmandan bir stata en fazla **+5** (`GEAR_STAT_CAP`). Sonuç 99'u geçmez.
- **Tek maç kapısı:** ekipman yalnızca `effectiveAttrs` (sim/career/gear) üzerinden, maç kurulurken (`sim/game/match.ts buildTeamFrom`) girer; motor, öne çıkan an üretimi ve Phaser mini oyunları bu kopyayı okur. Temel `hero.attrs` hiç yazılmaz.
- **Ödüller:** krampon sponsoru imzası (marka kademesi 1/2/3 → Standart/Pro/Elit), büyük sezon ödülleri (Altın Yıldız → Efsane; podyum, sezonun oyuncusu, gol kralı, Altın Eldiven → Elit; lig gol kralı, genç oyuncu, savunmacı → Pro), kupalar (lig/kupa → Pro, kıta → Elit; milli turnuva → Efsane, genç milli → Pro). Ödül, mevkiye uyan ekipmanı verir.
- **Eski kayıtlar:** eski altı kimlik (gold_boots, speed_boots, striker_boots, mind_band, keeper_gloves, compression) aynı yuvalarla katalogda; kayıttaki kalan maçlar korunur, artık stat verir.

### 6.3 Ödeyen ve ödemeyen arasındaki fark (denge hedefi)
Ekipman artık maçta etkili olduğu için test maç etkisini ölçer (`sim/game/gearBalance.node.test.ts`, eşli tohumlar,
5 sezon, kohort başına 10 kariyer; 2026-10-19 ölçümü):

| Kohort | OVR artışı | Ort. maç puanı | 5 yılda gol | 1. kademe | OVR 80 | Kupa |
|---|---|---|---|---|---|---|
| Hiç ekipman yok (ödüller de alınır) | 31,0 | 6,48 | 42,3 | %70 | %30 | 0,70 |
| Ücretsiz, yalnızca ödül ekipmanı | 31,4 | 6,58 | 45,4 | %80 | %30 | 0,50 |
| Ücretsiz, kariyer parasıyla alır | 31,2 | 6,54 | 38,8 | %80 | %30 | 0,90 |
| Elmasla en iyi ekipman (nakit yok) | 32,9 | 6,71 | 48,7 | %100 | %40 | 0,60 |
| En büyük harcayan (ekipman + sezonda €200K nakit, en iyi kullanım) | 34,4 | 6,81 | 54,9 | %90 | %50 | 1,00 |

- Eşikler: harcayanın OVR artışı ≤ ×1,25 (hiç ekipmansıza göre); maç puanı farkı en iyi ekipmanla ≤ +0,3, tam harcayanla ≤ +0,4 (parayla alana göre) ve ≤ +0,5 (ekipmansıza göre); gol ≤ +%40 / +%50; 1. kademe ve OVR 80 oranı ≤ +30 puan. Kupa ve gol n=10'da gürültülü.
- Ödemeyen oyuncu aynı ekipmana kariyer parası ve ödüllerle ulaşır; elmas yalnızca daha erken ulaştırır. Sahibin "zayıf istatistikle doğru oyun bile ≥3/10 kazanır" ilkesiyle uyumlu.

### 6.4 Nakit (€) paketleri
- **Miktar maaşa bağlı:** `max(taban, hafta × güncel haftalık brüt maaş)`. Sabit miktar ileri sezonlarda değersizleşirdi. Bu, NSS'in "fiyat maaşla artar" hatasının **tersidir**: satın aldığın şey büyür, ödediğin fiyat sabit kalır.
- Bir **kariyere** eklenir. Aktif kariyer yoksa "bekleyen nakit" olarak cüzdanda tutulur ve ilk açılan kariyerde talep edilir.
- **Vergi:** paket "sponsor bonusu" olarak net verilir (vergi hesabına girmez), ama sezon gelir istatistiğinde ayrı satır olarak görünür ("Satın alınan").
- **Kumarhane:** sahip kararıyla aynı para birimi kullanılır. Bunun sonuçları için §8.2'ye bak.

### 6.5 Pro Sözleşme (abonelik)
- Aktifken her **gerçek gün** ilk açılışta 20💎 talep edilir (biriktirmez; kaçırılan gün yanar). Panelde "Pro" rozeti görünür.
- Maç veya XP avantajı **yok** (ilk taslakta +%10 XP vardı, kaldırıldı. Yoksa abonelik "pay-to-win" algısı yaratıyor).
- Durum, açılışta mağazadan doğrulanır (`getPurchases` SUBS). İptal veya süre bitiminde talep durur.

### 6.6 Kazanılmayan, satılmayan şeyler
- Ganimet kutusu ve rastgele ödüllü ücretli ürün **yok**.
- Enerji yenileme satışı **yok**.
- Zorla izletilen reklam (geçiş/interstitial) **yok**; maç ve mini oyun içinde hiçbir reklam **yok**.
- Maç sonucu satışı **yok**. Maçta etkili olan tek satılık şey ekipmandır: küçük, stat başına +5 ile sınırlı, süreli ve aynısı kariyer parasıyla ve ödülle de alınır (§6.2).

### 6.7 Reklam geliri (sahip talebi, 2026-10-13)

Reklam NSS'in gelirinin ~%77'si. Ama aynı zamanda en sık 1-2★ sebebi. Bu yüzden iki reklam türü çok farklı ele alınır.

#### Ödüllü reklam ("izle, kazan"): VAR
Oyuncu kendisi seçer, izler, ödülü alır. F2P'de en az şikâyet edilen ve birim başına en çok kazandıran reklam türüdür.

| Teklif | Ödül | Günlük sınır | Nerede |
|---|---|---|---|
| Elmas | +10💎 | 5 izleme | Mağaza › Elmas sekmesi |
| Maç primi ×2 | O maçın maç primi iki katı | Maç başına 1 | Maç sonu ekranı |
| Antrenman takviyesi | Sonraki antrenman seansı XP +%20 | 3 | Antrenman ekranı |
| Fizyoterapi indirimi | Fizyoterapi seansı 100💎 yerine 50💎 | Sakatlık başına 1 | Sakatlık kartı |
| Sezon sonu ödülü ×2 | Sezon sonu elmas ödülü iki katı | Sezonda 1 | Sezon özeti |

Kurallar (NSS şikâyetlerinden):
- **Ödül garantili.** Reklam yüklenmezse veya yarıda kesilirse oyuncu yine de ödülü alır ya da hakkı yanmaz. NSS'te "izledim, ödül gelmedi" büyük şikâyetti.
- **Satın alanlardan ödüllü reklam kalkmaz.** NSS'te "reklam kaldırmayı aldım, ödüllü seçenek de gitti" şikâyeti vardı. Ödüllü reklam her zaman isteğe bağlı ve her zaman açık.
- **Maç ve mini oyun sırasında asla reklam yok.** Teklif yalnızca maç sonu ve menü anlarında çıkar.
- Pro Sözleşme sahipleri ödülü reklamsız alır (aboneliğe değer katar).
- Enerji ödülü yok (enerji satılmıyor, reklamla da verilmiyor).

#### Banner reklam: lansmanda KAPALI, test sonrası karar
- **Gerekçe:**
  - Panelde satın alanların çoğu "reklam yok" vaadini sebep olarak saydı.
  - Banner kazancı düşük (ödüllü reklamın onda biri ile yirmide biri arası).
  - Küçük telefon ekranında maç dışı UI'yi sıkıştırır (safe-area düzenimiz zaten sıkı).
- **Açılırsa kurallar:**
  - Yalnızca menü ekranlarında (ana sayfa, takvim, hayat).
  - Maç, mini oyun, kumarhane ve mağaza ekranlarında **asla**.
  - **Herhangi bir satın alma** (€0.99 Başlangıç dahil) banner'ı kalıcı kaldırır. Bu, Başlangıç Paketi için ek bir sebep olur.
  - Çapraz tanıtım veya "başka oyun" reklamı yok. NSS'te ücretli no-ads sonrası çıkan FM reklamı şikâyeti vardı.
- Yumuşak lansmanda A/B: banner açık ve kapalı. Ölçüt: D7 tutunma, Başlangıç dönüşümü, 1★ yorum tonu. Banner tutunmayı veya dönüşümü düşürüyorsa kapalı kalır.

#### Geçiş (interstitial) reklam: YOK
Ekran geçişinde zorla izletilen reklam, NSS'in son yıllardaki 1 numaralı 1-2★ sebebi ("Your content will resume in 80 seconds").

#### Teknik ve yasal gereksinimler
- **SDK:** Google AdMob, Capacitor eklentisiyle (ör. `@capacitor-community/admob`). Ödüllü reklam için sunucu tarafı doğrulama (SSV) önerilir.
- **Gizlilik:** bugünkü gizlilik politikası "veri toplama yok" diyor. Reklam SDK'sı reklam kimliği ve cihaz verisi toplar. Değişmesi gerekenler:
  - gizlilik politikası;
  - Google Play "Veri güvenliği" formu;
  - App Store "Privacy Nutrition Label".
- **AB, BK, Türkiye:** reklam öncesi rıza ekranı (Google UMP / IAB TCF). Rıza yoksa kişiselleştirilmemiş reklam gösterilir.
- **iOS:** App Tracking Transparency (ATT) izni. Reddedilirse kişiselleştirilmemiş reklam gösterilir.
- **Yaş:** kitlenin bir kısmı genç. 13 yaş altı kullanıcılar için reklam isteği çocuğa yönelik işaretlenir (COPPA, `tagForChildDirectedTreatment` / `tagForUnderAgeOfConsent`). Oyunda yaş beyanı gerekir.
- **Çevrimdışı:** oyun çevrimdışı çalışır. Ödüllü reklam yalnızca çevrimiçiyken görünür, çevrimdışıyken teklif gizlenir.
- **Kumarhane ekranında reklam yok.** Reklam ağları kumar içerikli sayfalarda ek kısıtlama uygular.

#### Tahmini katkı
Gerçek gelir ülkeye ve ağa göre çok değişir. Rakamlar yumuşak lansmanla ölçülmeli. Kabaca: ödüllü reklam, F2P gelirinin genelde önemli bir parçasıdır ve ödemeyen %95+ oyuncudan gelir alınmasını sağlar. Satın almaların yerini almaz, onlara eklenir.

---

## 7. Teknik mimari

### 7.1 Mevcut durum (kod)
- `game/src/store-iap/`:
  - `catalog.ts`: ürün tanımları (şu an: `full_career`, iki kozmetik paket).
  - `entitlements.ts`: global anahtar `starpath.entitlements.v1`; `isCareerLocked`, `careerLocked`.
  - `service.ts`: sağlayıcı seçimi, `purchase`, `restorePurchases`.
  - `capacitorProvider.ts`: `@capgo/native-purchases` **8.8.2**, şu an yalnızca `PURCHASE_TYPE.INAPP` tüketilmeyen.
  - `provider.ts`: Dev, Unavailable sağlayıcılar.
  - `flavor.ts`: `trial` / `premium` / `demo`.
- Kariyer kilidi: `ui/backend/realActions.ts` → `afterTime()` ve `lockedOut()` yeni sezonda `pendingNav = 'paywall'`.
- Ekranlar: `ui/screens/store/StoreScreen.tsx` (kozmetik), `PaywallScreen.tsx`, `PurchasesPanel.tsx`.
- Antrenman XP: `sim/career/training.ts` → `trainingXp()`. Bonuslar: perk, `assetEffectTotal(life,'xp_bonus')`, `wellbeingXpMultiplier`, `trainerBonus`.
- Maç sonrası: `sim/career/matchOutcome.ts` → `applyMatchToHero()`. `played` dalında ekipman aşınması buraya bağlanır.
- **Zaten var olanlar:**
  - Kayıt dışa ve içe aktarma (`ui/screens/SavesScreen.tsx`, `persistence.exportSlot/importSlot`).
  - Miras ile çocuk kariyeri (`sim/game/legacy.ts`).
  - Kozmetik kapısı (`cosmeticUnlocked`).

### 7.2 Eklenecek modüller
1. **`store-iap/wallet.ts`:** global cüzdan, `starpath.wallet.v1`.
   - `{ v:1, gems, log:[{at,delta,why}] (son 100), pendingCashWeeks, pass:{ activeUntil, lastClaimDay }, starterGranted }`.
   - Elmas **kayıt yuvasından bağımsızdır**: kariyer silinse de kalır, tıpkı entitlements gibi.
   - `addGems`, `spendGems` (yetersizse false), `claimPassDaily(now)`, `takePendingCash()`.
   - Signal ile UI güncellenir. Başlıkta 💎 sayacı.
2. **`catalog.ts` genişlemesi:** `kind: 'unlock' | 'cosmetic' | 'gems' | 'cash' | 'pass' | 'starter'`, `gems?`, `cashWeeks?`, `cashFloor?`, `storeType: 'inapp' | 'subs'`, `consumable: boolean`.
3. **`capacitorProvider.ts`:**
   - Ürünler türe göre iki çağrıda yüklenir (INAPP + SUBS).
   - Tüketilenlerde `purchaseProduct({ isConsumable: true })`.
   - Abonelikte `productType: SUBS, planIdentifier: 'monthly'`.
   - `restore`: tüketilmeyen ve aktif abonelikleri (`isActive` / `subscriptionState`) ayrı döndürür.
4. **`service.ts` → `purchase(id)`:** başarı sonrası türe göre dağıtım:
   - `gems` → `addGems`;
   - `cash` → `pendingCashWeeks += n`;
   - `starter` → `grant` + bir kez `addGems(300)` + Altın Krampon envanterine;
   - `pass` → `activeUntil`.
5. **`sim/career/gear.ts` (saf, sim):**
   - `GEAR` tanımları.
   - `OwnedGear {id, matchesLeft}` → `life.flags['g:gear']` (JSON, `readJson/writeJson` deseni).
   - `gearXpBonus(life, key)` (tavan 0,25), `wearGear(life)`, `equipGear`, `gearRecovery(life)`.
   - `trainingXp()` içine çarpan.
   - `applyMatchToHero` `played` dalında `wearGear`.
   - Determinizm bozulmaz (RNG yok).
   - **Golden testler değişmez,** çünkü ekipman yoksa çarpan 1.
6. **UI backend aksiyonları (`realActions.ts`):**
   - `buyGear(id)`: elmas düş, envantere ekle.
   - `equipGear`, `claimCash()`: bekleyen haftalar × maaş → `life.money`, log satırı.
   - `useFisio()`, `gemsToCash()`.
   - Ücretsiz elmas kaynakları: `afterTime()` içinde MOTM sayısı farkı, hedef tamamlanması, sezon ödülleri. Tekrar ödülü engellemek için son ödüllendirilen sayaçlar bayrakta tutulur.
7. **Ekranlar:**
   - Mağaza 4 sekme: Elmas, Ekipman, Kozmetik, Para.
   - Başlangıç Paketi ve Pro Sözleşme kartları.
   - Antrenman ekranında `GainList`'e "Ekipman +%15" satırı.
   - Sahadaki oyuncu sprite'ında krampon rengi.
   - Satın alma geçmişi (`PurchasesPanel`) elmas logunu da gösterir.
8. **Kaldırılacaklar:**
   - `isCareerLocked` → her zaman false (veya `trial` flavor anlamı "f2p" olur).
   - `PaywallScreen` ve `paywall` rotası.
   - `lockedOut()`.
   - e2e: `e2e/iap.spec.ts`, `e2e/wp20.spec.ts`, `store-iap.test.ts` paywall testleri yeni akışa göre yeniden yazılır.

### 7.3 Güvenlik ve sahtecilik
- Bugünkü güven modeli: yerel, imzasız kayıt. Mağaza gerçek kaynaktır. Tüketilen ürünler (elmas, nakit) bu modelde **geri yüklenemez ve kopyalanabilir.** Tek oyunculu, çevrimdışı bir oyunda kabul edilebilir risk. Kimse başkasına karşı avantaj kazanmıyor.
- **Önerilen (lansmandan önce):** sunucu tarafı makbuz doğrulaması.
  - Google: Play Developer API, `purchaseToken`.
  - Apple: App Store Server API, `transactionId`.
  - Örnek yer: küçük bir edge function (Supabase/Vercel).
  - Doğrulanmadan elmas verilmez. Doğrulanınca tüketim onayı (`acknowledge`, `isConsumable`) yapılır.
  - Bu, iade sonrası elmasın geri alınmasını da sağlar (Google RTDN, Apple Server Notifications).
- Yerel cüzdan kaydı HMAC ile imzalanabilir (cihaz anahtarı). Bu düşük maliyetli bir caydırıcıdır.

### 7.4 Efsane Kariyerler (yeni içerik)
- **Harika çocuk başlangıcı:**
  - Yeni kariyerde başlangıç OVR'si ve potansiyeli üst bantta, ilk kulüp büyük liglerin üst yarısından.
  - Normal yolda bu ~3-5 sezon sürer, burada 0. sezon.
  - Hall of Fame'de "Efsane başlangıç" etiketiyle ayrı listelenir (rekor tablosu adaleti).
- **Teknik direktör kariyeri:**
  - Emeklilik akışından sonra aynı dünyada teknik direktör olarak devam.
  - Kapsam: kadro seçimi, taktik, transfer önerisi. Maçlar simüle edilir, kilit anlar yok.
  - **Büyük iş, en az 1-2 hafta.** Önce harika çocuk ile miras çocuğunu (zaten var) paketleyip v1 olarak çıkarmak, teknik direktörü güncelleme ile eklemek mümkün.

### 7.5 Editör ve gerçek isimler
- Ücretsiz. Kulüp, oyuncu ve lig adları ile renkler düzenlenir. JSON dosyası olarak dışa ve içe aktarılır.
- **Yasal sınır:** oyun **gerçek isimle gelmez.** Kullanıcının kendi dosyası kullanıcı içeriğidir (PES "option file" modeli). Mağaza metninde "gerçek isimlerle gelir" denmez. "Kendi isimlerini koy, arkadaşlarınla paylaş" denir.
- Panelin isteği "birkaç dokunuşla hazır paket" idi. Topluluk dosyalarını içe almak (dosya seç veya panodan yapıştır) yeterli. Oyun içinde dosya dağıtmıyoruz.

---

## 8. Mağaza, yaş derecesi ve yasal yükümlülükler (hukuki tavsiye değildir)

### 8.1 Mağaza kuralları
- **Apple (Guideline 3.1.1):** dijital içerik ve oyun içi para yalnızca uygulama içi satın almayla satılır. Dış ödeme bağlantısı yok.
- **Google Play Ödemeler politikası:** aynı ilke; Play Billing kullanılır.
- **Rastgele ödül yok:** ganimet kutusu olmadığı için oran açıklama yükümlülüğü doğmaz. İleride eklenirse Apple oranları göstermeyi şart koşar.
- Tüketilen ve tüketilmeyen ayrımı mağazalarda doğru ayarlanmalı. "Satın alımları geri yükle" yalnızca tüketilmeyenleri ve aboneliği geri getirir. Bu, mağaza açıklamasında ve oyunda söylenmeli.

### 8.2 Yaş derecesi: kumarhane + satın alınabilir para (sahip kararı)
- Bugünkü `docs/store/AGE-RATING.md` şunu varsayıyor: "Gerçek para ile oyun içi para arasında bağ yoktur." **Bu varsayım nakit paketleriyle bozulur.** Belge güncellenmeli.
- Gerçek parayla alınan oyun içi para kumarhanede kullanılabildiğinde:
  - "simüle kumar" sorusu yine **evet**;
  - bazı mağaza ve bölgelerde **daha yüksek yaş bandı** (Apple 17+/18+, IARC 16+/18+) olası;
  - bazı ülkelerde ek inceleme olası.
- Oyun içi kapı: karakter yaşı `CASINO_MIN_AGE = 21` (oyuncu yaşı değil).
- **Önerilen hafifletmeler** (sahip kararı korunur, risk düşer):
  1. Kumarhaneye günlük kayıp limiti (oyun içi, zaten kısmen var: `casinoCareer` / `casinoRg` testleri).
  2. Satın alma ekranında açık metin: "Oyun içi para gerçek paraya çevrilemez."
  3. Mağaza anketlerini nakit paketi **satışa çıkmadan önce** yeniden doldurmak.
- Alternatif (sahip isterse): kumarhanede satın alınamayan ayrı fiş (önceki soruda ikinci seçenek). Yaş derecesi riskini büyük ölçüde azaltır.

### 8.3 Tüketici koruma (AB ve Türkiye)
- Sanal para fiyatı her zaman gerçek para karşılığıyla gösterilmeli. Örneğin ekipman kartında "300💎 (~€2,50)". AB tüketici koruma ağının sanal para ilkeleri bu yönde.
- Çocuklara doğrudan "hemen al" baskısı yapılmaz. Ebeveyn onayı mağaza mekanizmasındadır.
- Abonelik: fiyat, yenileme sıklığı ve iptal yolu satın almadan önce açıkça yazılır.
- `docs/legal` altındaki gizlilik ve kullanım şartlarına IAP, abonelik ve iade bölümü eklenmeli.

### 8.4 Mağaza metni değişiklikleri (`docs/store/LISTING.md`)
Şu cümleler artık doğru değil ve **değiştirilmeli:**
- "Satın alma modeli: mobilde ilk sezon ücretsiz + tek seferlik 'Tam Kariyer' … reklam, abonelik, enerji yok."
- "Şeffaf adil model: reklam yok, abonelik yok, bekleme sayacı yok. Mobilde ilk tam sezon ücretsiz, sonra tek seferlik Tam Kariyer."
- "Reklamsız, abonelik yok · No ads, no subscription"

Önerilen yeni çekirdek:

> Ücretsiz oyna, tüm kariyer açık. Zorla reklam yok (ödüllü reklam isteğe bağlı), enerji sınırı yok, ganimet kutusu yok, çevrimdışı. Ekipman küçük ve sınırlı stat artışı verir (stat başına en fazla +5); kariyer parasıyla ya da ödüllerle oyunda da kazanılır. Fiyatlar maaşınla artmaz.

---

## 9. Ölçüm ve gerçek test planı

### 9.1 İzlenecek metrikler
Analitik bugün yok (gizlilik politikası "veri toplama yok" diyor). Eklenirse politika ve mağaza veri beyanları güncellenmeli. Alternatif: yalnızca mağaza konsollarının verisi (Play Console, App Store Connect: dönüşüm, gelir, iade, abonelik).

| Metrik | Hedef (ilk tahmin) | Kaynak |
|---|---|---|
| Ödeyen oranı (30 gün) | %2-4 | Mağaza konsolu |
| Başlangıç Paketi dönüşümü (ödeyenler içinde) | >%60 | Mağaza konsolu |
| ARPPU (ödeyen başına gelir, 30 gün) | €3-6 | Mağaza konsolu |
| D1 / D7 / D30 tutunma | %40 / %15 / %6 | Mağaza konsolu |
| İade oranı | <%2 | Mağaza konsolu |
| 1★ yorumlarda "pay-to-win" geçme oranı | ~0 | Yorum taraması |

### 9.2 Yumuşak lansman
1. Tek ülkede (ör. Türkiye veya küçük bir AB pazarı) F2P sürümü.
2. 2-4 hafta veri: Başlangıç Paketi dönüşümü, ikinci ürün oranı, iade, yorum tonu.
3. Fiyat testi: Başlangıç Paketi €0.99 ve €1.99. Efsane Kariyerler €2.99 ve €3.99.
4. Panel sonuçları **gerçek veriye göre** güncellenir. Panelle gerçek arasındaki farka göre bu belge revize edilir.

### 9.3 Panelin önerdiği güven işleri (para sisteminden bağımsız, şimdi yapılabilir)
- Mağaza sayfasına 30 sn oynanış videosu.
- Oyun içinde "Yenilikler" ve güncelleme günlüğü (`WhatsNewScreen` zaten var, görünür kılınmalı).
- Kayıt yedeğini tek dokunuşla buluta veya dosyaya almak (bugün dosya var, "elle uğraş" bulundu).
- Kontrol ve takım arkadaşı yapay zekâsı kalitesi: panelin en sık oynanış itirazı. Bu, **şu anki "mevcut hali mükemmelleştirme"** çalışmasının konusudur.

---

## 10. Yol haritası (ödeme sistemi zamanı geldiğinde)

| Aşama | İş | Süre (tahmin) |
|---|---|---|
| A | Cüzdan + katalog + sağlayıcı (tüketilen, abonelik) + testler | 1 gün |
| B | Ekipman sistemi (sim) + antrenman entegrasyonu + denge simülasyonu (5 sezon, 3 profil) | 1 gün |
| C | Mağaza ekranı (4 sekme), başlık sayacı, ekipman ve sahada krampon görünümü | 1 gün |
| D | Ücretsiz elmas kaynakları + nakit talebi + Pro Sözleşme günlük talep | 0,5 gün |
| E | Kariyer kilidini ve paywall'u kaldırma, e2e güncelleme | 0,5 gün |
| F | Efsane Kariyerler v1 (harika çocuk + miras paketleme) | 1-2 gün |
| G | Teknik direktör kariyeri | 1-2 hafta (ayrı sürüm) |
| H | Sunucu makbuz doğrulama (edge function) | 1 gün |
| J | Ödüllü reklam (AdMob + rıza ekranı + ATT + gizlilik metinleri) | 1-1,5 gün |
| K | Banner (yalnızca A/B kararı "aç" çıkarsa) | 0,5 gün |
| I | Mağaza ürünleri (Play Console, App Store Connect), yaş anketi, mağaza metni, yasal metin güncellemesi | 0,5 gün + sahip onayı |

Toplam: G hariç **~7,5-10 iş günü.**

---

## 11. Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| "NSS gibi oldu" algısı, 1★ dalgası | Orta | Yüksek | Maç sonucu satılmaz, enerji satılmaz, süreler açık, fiyat sabit. Mağaza metninde açıkça söylenir. |
| Yaş derecesi yükselir (kumarhane + satılan para) | Yüksek | Orta | §8.2 hafifletmeleri; gerekirse ayrı fiş. |
| Tüketilenlerde sahtecilik | Orta | Düşük (tek oyunculu) | Sunucu doğrulama (H). |
| Abonelik beklentisi karşılanmaz (değer düşük) | Orta | Düşük | İsteğe bağlı; içerik eklendikçe değer artırılır. |
| Ödemeyen oyuncunun yavaşlığı "grind" gibi hissettirir | Orta | Yüksek | §6.3 denge testi; ücretsiz kaynaklar; ekipman kariyer parasıyla ve ödülle de alınır; stat tavanı +5. |
| Panel gerçekle uyuşmaz | Yüksek | Orta | Yumuşak lansman verisiyle revize (§9.2). |

---

## Ek A: Tur metinleri
- v1-v5 teklif metinleri: `founder/rounds/v*/pitch.md`. Bu belge içindeki v5 metni §3'te.
- Tur sonuç raporları: `founder/rounds/v*/results.md`. Fiyat eğrileri: `founder/pricing-curve.md` (v1), `founder/pricing-curve-v2.md` (v2).

## Ek B: Panel fiyat yanıtları (Van Westendorp, özet)
| Tur | Kabul edilebilir aralık | Pazarlık noktası (IPP) |
|---|---|---|
| v1 (Tam Kariyer) | €2.00-8.99 | €4.02 |
| v2 (ekstralar) | €1.02-6.97 | €2.99 |
| v3-v5 (giriş paketi bağlamı) | yanıtların çoğu €0.30 / €0.99 / €3-5 / €6-10 bandında | ~€0.99 |
