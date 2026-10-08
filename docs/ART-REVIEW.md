# Sanat Yönetmeni İncelemesi: UI görsel kalite turu

**Tarih:** 2026-10-08 · **Kapsam:** tüm Preact ekranları (390×844 mobil ve 1440×900 masaüstü), prosedürel SVG sanatı (`src/ui/art/**`), maç hub'ı. Phaser maç sahnesi (`src/game/**`) bu turda düzenlenmedi; o sırada başka bir ajan orada çalışıyordu. Sahnede gördüğüm sorunlar en altta listeli.

**Ölçüt:** Her ekranı 1–10 arası puanladım. Puana giren başlıklar: hiyerarşi, tipografi, boşluk ritmi, renk, derinlik, ikonografi, veri görselleştirme netliği, boş durumlar, duygusal etki. Hedef: her ekran ≥ 8. Ölçüt "NSS'ten açıkça bir kuşak ileride, EA FC Mobile / FM26 menüleri / Retro Bowl cilası" düzeyi.

**Yöntem:** Playwright (kurulu Chrome), `?autostart=1&dev=<ekran>` ve `window.__sp`. Her ekran iki boyutta çekildi, PNG'ler tek tek incelendi. Düzeltmelerden sonra her şey yeniden çekilip yeniden puanlandı.

## Genel bulgular (düzeltme öncesi)

1. **Avatar yüzleri mobilde kararıyordu (kritik).** Prosedürel SVG'ler deterministik `<defs>` id'leri üretiyor. Mobilde gizli kenar çubuğundaki (display:none) avatar ile Menü ve Sosyal'deki avatar aynı id'leri paylaşınca gradyanlar boyanmıyor, yüz siyah/mavi çıkıyordu. **Düzeltme:** `SvgBox` her örnekte id'leri son ekle benzersizleştiriyor (`scopeSvgIds`, birim testli). Bu kapı tüm avatar, arma, forma ve bayrakları kapsıyor.
2. **Devre dışı ana butonlar soluk marka rengindeydi.** "Devam et", "Yeni sezona geç" ve "Tam Kariyer'i aç" butonları bozuk gibi görünüyordu. **Düzeltme:** Artık nötr, çerçeveli bir "henüz değil" plakası olarak görünüyorlar.
3. **Toast duvarı.** Hızlı ilerletmede 4 "Maç simüle edildi" toast'u sezon törenini örtüyordu. **Düzeltme:** Aynı aileden toast'lar birleşiyor, en fazla 3 toast görünüyor. Maç ve tören ekranlarında tek toast gösteriliyor, sezon incelemesine girerken bayat toast'lar temizleniyor.
4. **Kaydırmalı sekmelerde aktif sekme ekran dışında kalıyordu.** Yaşam → Sponsorlar gibi derin linklerde aktif sekme görünmüyordu. **Düzeltme:** Aktif sekme şeridin ortasına kayıyor.
5. **Emoji ikonlar** (başarımlar, mağaza) gri tonlu ve tutarsız ağırlıktaydı. **Düzeltme:** Tutarlı stroke ikonlar ve prosedürel madalya / ürün sanatı kullanılıyor.
6. **Programatik odakta görünür halka.** Sihirbaz başlığı fare kullanıcısında mavi çerçeveyle çıkıyordu. **Düzeltme:** `tabindex=-1` odakları halkasız. Klavye ve gamepad kullanıcıları halkayı görmeye devam ediyor.
7. **Boş durumlar** tek tip ve metin ağırlıklıydı. **Düzeltme:** "Gece Maçı" vinyeti (projektör huzmesi + eğik saha + yüzen ikon, azaltılmış harekette durur) ve satır içi kompakt boş durum varyantı eklendi.

## Ekran puanları

| Ekran | Önce | Sonra | Bulgu → Yapılan |
|---|---|---|---|
| Başlık | 7 | 8 | Soluk devre dışı "Devam et" → nötr plaka |
| Sihirbaz 1–4, 6, 7 | 7.5 | 8 | Başlıkta odak halkası → kaldırıldı. Oyuncu kartı ve saha seçici zaten güçlüydü |
| Sihirbaz 5 (Hikâye) | 6.5 | 8.5 | Çizgili zemin + ikon → 4 prosedürel sahne (duvar kalesi, akademi sahası, aile tribünü, yıldızlı gece) |
| Ana sayfa | 8 | 8 | Kahraman kartı, armalar ve hızlı erişim iyi. Değişiklik yok |
| Günlük plan | 7 | 8 | "Enerji bütçesi" etiketi iki kez yazıyordu → tekrar kaldırıldı |
| Karar modalı | 8 | 8 | Risk çipleri ve etki çipleri net |
| Antrenman | 8 | 8 | — |
| Drill brifingi | 6 | 8.5 | Düz kart → hoca tahtası SVG diyagramı (8 drill türü + serbest vuruş) |
| Profil | 8 | 8.5 | Avatar id düzeltmesiyle kenar çubuğu tutarlı |
| Kulüp | 8 | 8 | — |
| Dünya / ligler | 7.5 | 8 | Sekme şeridi aktif sekmeyi gösteriyor |
| Kupalar | 5.5 | 8 | Takım adları "Gaziantep…" diye kesiliyordu, başlık butonu kırpılıyordu → iki satırlı adlar, buton tam etiketli |
| Milli takım | 7 | 8 | Beş tekdüze mavi çubuk → atribüt renk skalası |
| Sözleşme | 6 | 8 | Düz anahtar-değer listesi → büyük haftalık maaş, kalan sezon şeridi |
| Yaşam: İlişkiler | 7.5 | 8 | — |
| Yaşam: Varlıklar | 6 | 8 | Metin-only boş koleksiyon → kompakt boş durum |
| Yaşam: Banka | 7.5 | 8 | — |
| Yaşam: İşletme | 7 | 8 | Yeni boş durum vinyeti |
| Yaşam: Sosyal | 5 | 8 | Kararmış avatar → düzeltildi, aktif sekme görünür |
| Yaşam: Sponsorlar | 5.5 | 8 | Aktif sekme ekran dışındaydı, metin-only boş durum → düzeltildi |
| Kumarhane lobisi | 7 | 8.5 | At yarışı kutusu 3 ikon + çizgiydi → jokeyli at sprite'ları + bitiş çizgisi |
| Blackjack | 6 | 8 | Boş yeşil masa → kart yuvaları, bahis halkası, ayakkabıda kart sırtları |
| Rulet / Slot / At yarışı | 8 | 8 | — |
| Maç öncesi | 6 | 8 | İki takımın forvetleri orta çizgide üst üste biniyordu → her takım kendi yarısına ölçeklendi |
| Canlı maç hub'ı | 6.5 | 8 | Yedekteyken kırmızı "0,0" not → sakin "–". Karşılaştırma çubukları iki ayrı yarım → TV tarzı tek bölünmüş çubuk, forma renkleriyle |
| Maç sonu adımları | 7.5 | 8 | Hoca güveni "50 → 50, −0.4" → yuvarlama değişimi gizlediğinde ondalık gösteriliyor |
| Sezon sonu | 6 | 8 | Toast duvarı ve çamurlu altın CTA → tek toast, nötr bekleme butonu, kupa yoksa kompakt boş durum |
| Ödül töreni | 7.5 | 8 | — |
| Kupa dolabı | 7 | 8 | Milli kariyer ve ödüller düz metindi → kutucuk ve kompakt boş durum |
| Başarımlar | 5 | 8.5 | Gri emoji + çıplak "0" → altın ilerleme halkası, "0 / 79", prosedürel altıgen madalyalar (kilitli: çelik + kilit, açık: altın) |
| Onur listesi | 5 | 8.5 | Koca siyah boşluk → projektör altında hayalet 1-2-3 kürsüsü |
| Ayarlar / Kayıtlar | 8 | 8 | — |
| Mağaza | 4.5 | 8.5 | Emoji ikonlar → konfeti rozeti ve oyuncunun kendi yüzüyle aksesuar önizlemesi |
| Paywall | 4.5 | 8 | Madde işaretli düz liste → parlayan altın kupa, yeşil onay ikonları |
| Menü | 6 | 8.5 | Kararmış avatar → düzeltildi |
| Haberler / Kariyer günlüğü | 8 | 8 | — |

**Ortalama:** önce ≈ 6.6, sonra ≈ 8.1. **8'in altında ekran kalmadı.**

## Prosedürel sanat (`src/ui/art/**`)

- **Forma numarası:** Çizgili ve çemberli formalarda numara bir şeritte kayboluyordu. Artık iki renge karşı da en iyi okunan mürekkep seçiliyor ve ters renkte dolu bir kontur ekleniyor.
- **Avatar:** Ten, saç ve aksesuar çeşitliliği iyi. Uzun saç stilleri erkek modelde "kask" gibi duruyor. Kadın saçlarında da hacim tekdüze. Bir sonraki turda saç katmanlarına iç gölge ve tutam çizgileri eklenebilir.
- **Arma ve bayrak:** Kalite iyi, değişiklik yok.

## Erişilebilirlik ve performans notları

- Yeni sanatın tamamı `aria-hidden`. Metin içerikleri ve `role="meter"` değerleri korundu. Ondan fazla boş durum ve madalya CSS ile çiziliyor (id yok, filtre yok).
- Yüzen boş durum ikonu ve bölünmüş çubuk geçişi `prefers-reduced-motion` ve oyun içi "azaltılmış hareket" ayarında kapanıyor.
- `box-shadow` animasyonu eklenmedi. Yalnızca `transform`, `opacity` ve `grid-template-columns` geçişleri var.

## Maç sahnesi (Phaser, `src/game/**`): sonraki tur için

`/match-demo.html` ile çekilen sahnelerde gördüklerim:

1. **Saha düz ve tek tonlu.** Biçilmiş çim şeritleri çok zayıf. §5.7'deki projektör konileri ve vinyet yok. Gece maçı hissi oluşmuyor.
2. **Tribün piksel gürültüsü gibi okunuyor.** Kat ve tribün yapısı, ön korkuluk ya da ışık degradesi yok.
3. **Reklam panoları:** Yazılar kırpılıyor ("GOA", "GOAL+" kesik). "GOAL!" kutlama yazısı panoyla çakışıyor; arka plaka ya da kontur yok.
4. **Kale ağı** üstte ayrı bir ızgara gibi duruyor, kale direğiyle perspektif uyumsuz.
5. **Oyuncular mobilde (390 px) yaklaşık 12 px.** Numaralar okunmuyor, isim etiketi oyuncunun üstüne biniyor. Yön üçgenleri saha üstünde kırıntı gibi görünüyor. Top gölgesi çok küçük.
6. **Çizgiler:** Ceza sahası çizgisi ekran kenarından taşıyor, kalınlıklar tutarsız.
7. **Konfeti** HUD ve skor tabelasının üstünde çiziliyor. Penaltı kadrajında kahraman toptan uzak kalıyor.
8. **Canlı hub'daki mini radar** (UI) iyi, ama Phaser anına geçişte renk dili değişiyor: hub'daki saha koyu yeşil, sahne açık yeşil. Ortak bir saha paleti token'ı önerilir (`--pitch-a/b`).

## Tur 2

**Tarih:** 2026-10-08 · **Kapsam:** Tur 1'den sonra eklenen veya yenilenen her ekran: hedefler, topluluk ve rekorlar, projeler, telefon tarzı Yaşam hub'ı, kumarhane VIP paneli, milli takım, kupalar ve ödüller, maç sonu pas ve kazanç adımları, canlı maçta karar kartı, gol klibi, gelişim radarı, kayıt küçük resimleri, açık tema, ayar grupları, paywall ve mağaza, onur listesi ve belgesel, kaleci dağıtımı dahil drill'ler. Ayrıca bu ekranların eski ekranlarla tutarlılığı.

**Çıta:** Her ekran ≥ 8.5.

**Yöntem:** Playwright betiğiyle 390×844 (mobil, dokunmatik) ve 1440×900 boyutlarında, koyu ve açık temada çekim yaptım. Her geçişten sonra en az 5 sn bekledim. Boş durumlar yanıltmasın diye durumları doldurdum: €4,5 milyon nakit, sezon sonuna sarılmış kariyer, oynanmış maç, açık karar penceresi. Toplam 83 sahne × 4 kombinasyon = 332 kare. Maç sahnesini `/match-demo.html` ile ayrıca çektim. Kareleri dört kombinasyonu yan yana gösteren sayfalarda inceledim.

### Genel bulgular

1. **Açık temada lacivert lekeler.** Satır içi boş durumlar, sözleşme kahraman kutusu, cam kartlar ve devre dışı butonlar koyu temaya göre yazılmış `rgba(19,28,46)` ve `#223152` dolgularını kullanıyordu. Beyaz zeminde gri-mavi tuğla gibi duruyorlardı. Kilitli başarım madalyaları da lacivert altıgen kalıyordu. **Düzeltme:** `theme-light.css` içinde token tabanlı yüzeyler, soluk ve gömülü bir "henüz değil" plakası, çelik madalyalar. Devre dışı hayalet buton artık plakaya dönmüyor, hayalet kalıyor.
2. **Açık temada altın sanat çamurlaşıyordu.** Mağaza rozeti ve açılmış madalyalar `--accent-gold` kullanıyordu. Bu token açık temada kontrast için koyu bronza (#8f5c00) dönüyor. **Düzeltme:** Metal sanat iki temada da sabit bir metal paletle çiziliyor (#ffe9a8 → #ffc83d → #b8860b). Metindeki altın token'da kalıyor.
3. **Canlı maç kontrolleri mobilde kırılıyordu.** "Sonraki ana atla" ve "Sona kadar simüle et" etiketleri buton içinde kelime ortasından bölünüyordu. Masaüstünde kontrol şeridi, sayfa kaydırıldıkça not kartının üstüne biniyordu. **Düzeltme:** Telefonda kontroller iki satırda: duraklat ve hız ilk satırda, iki atlama butonu ikinci satırda eşit yarılar halinde. Masaüstünde yüzen bir dok kullanılıyor (yüzey, gölge, bulanıklık). Maç sonu "Devam" bloğu ve maç sonu adım navigasyonu da aynı doku kullanıyor.
4. **Karar kartında seçenek ipuçları** buton tipografisini miras alıyordu: büyük harf ve yoğun. **Düzeltme:** Seçenek numarası tuş rozetine dönüştü. İpucu gövde yazı tipinde, normal boyutta ve girintili.
5. **Emoji ikonlar geri dönmüştü.** Projeler (🏗️🏟️📈🏛️🏺), vakıf (🤝), ödüller (🧤🌱🎯), belgesel ve onur listesi (🏆🏅🎉) emoji kullanıyordu. **Düzeltme:** Stroke ikon setinden altın ikonlar ve 44 px'lik ikon karosu (`biz-icon`).
6. **Mobilde ezilen sayfa başlığı.** Onur Listesi'nde "Rekorlar ve meydan okuma" butonu başlığı satır başına iki kelimeye sıkıştırıyordu. **Düzeltme:** 600 px altında başlıktaki eylem butonu alt satıra iniyor.
7. **Maç sahnesiyle hub arasında renk dili farkı.** Phaser skor tabelasında dakika bloğu altın, hub skor tabelasında yeşildi. **Düzeltme:** Sahnede de saha yeşili kullanılıyor. Bu yalnızca bir çizim rengi; oynanış, golden ve replay testleri değişmedi. HUD yazı tipleri zaten UI token'larıyla aynıydı (Teko, Barlow Condensed).

### Ekran puanları (önce → sonra)

K = koyu tema, A = açık tema. Maç akışı, kumarhane, tören ve sihirbaz ekranları tasarım gereği her iki ayarda da koyu çiziliyor, bu yüzden tek puan aldılar ("—").

| Ekran | K önce | K sonra | A önce | A sonra | Bulgu → Yapılan |
|---|---|---|---|---|---|
| Başlık | 8.5 | 8.5 | — | — | Değişiklik yok |
| Sihirbaz | 8 | 8.5 | — | — | Programatik odakta başlık mavi kutu içine giriyordu → klavye için alt çizgi ipucu |
| Ana sayfa (hedefler kartı dahil) | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Günlük plan | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Antrenman / drill'ler | 8 | 8.5 | 7 | 8.5 | Açık temada devre dışı "Otomatik" ve "Oyna" lacivert tuğlaydı → gömülü plaka |
| Profil / gelişim radarı | 8 | 8.5 | 8 | 8.5 | Kart mobilde ilk ekranı dolduruyordu → kart küçüldü, isim ve kulüp ilk ekranda |
| Kulüp / tablo | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Dünya / kupalar | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Sözleşme | 8.5 | 8.5 | 7 | 8.5 | Açık temada lacivert maaş kutusu → açık yüzey degradesi |
| Milli takım | 8 | 8.5 | 8 | 8.5 | Milli takım ekranında yine milli takım ekranını açan bir buton vardı → kaldırıldı |
| Hedefler | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Rekorlar (haftalık meydan okuma) | 7 | 8.5 | 7 | 8.5 | Mobilde rozet ayrı bir satır kaplıyordu, KPI kutularında etiket sayıdan baskındı → rozet ve metin yan yana ızgarada, sayı önde ve 40 px |
| Topluluk | 7.5 | 8.5 | 7.5 | 8.5 | Aynı kahraman ızgarası, haber başlıkları dengelendi |
| Yaşam: telefon ana ekranı | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Yaşam: Banka | 7.5 | 8.5 | 7.5 | 8.5 | Kredi puanı halkası tek başına bir satıra düşüyordu → nakit ve birikim solda, halka sağda sabit |
| Yaşam: Projeler | 6.5 | 8.5 | 6 | 8.5 | Emoji ikonlar, sıfır değerlerin kırmızı/yeşil renkte göze batması, düz özet → altın ikon karoları, sönük sıfırlar, sayı karoları |
| Yaşam: İşletme / vakıf | 7.5 | 8.5 | 7.5 | 8.5 | 🤝 → ikon karosu |
| Yaşam: Sponsorlar / Varlıklar | 8 | 8.5 | 6.5 | 8.5 | Açık temada gri satır içi boş durum → token yüzeyi |
| Kumarhane lobisi ve VIP | 8.5 | 8.5 | — | — | — |
| Maç öncesi | 8.5 | 8.5 | — | — | Masaüstündeki alt çubuk da yüzen dok oldu |
| Canlı maç hub'ı | 6.5 | 8.5 | — | — | Mobilde bölünen etiketler, masaüstünde not kartına binen şerit → iki satır ve yüzen dok |
| Canlı maç: karar kartı | 7.5 | 8.5 | — | — | Büyük harfli ipuçları → tuş rozeti ve gövde metni |
| Canlı maç: tam süre | 7.5 | 8.5 | — | — | Masaüstünde "Tam süre" ve "Devam" maç akışının üstüne biniyordu → yüzey kartı |
| Maç sonu: sonuç / not / harita / güven | 8 | 8.5 | — | — | Masaüstünde "Geri" etiketi "B…" diye kesiliyordu → buton kendi genişliğinde |
| Maç sonu: pas ağı | 7.5 | 8.5 | — | — | Düz liste → pas payını gösteren satır dolgusu (en çok kimin beslediği ilk bakışta okunuyor) |
| Maç sonu: kazanç | 8.5 | 8.5 | — | — | — |
| Sezon sonu / ödüller | 8 | 8.5 | — | — | Kürsüdeki gizli adlar bulanık lekeydi → okunur "???". Diğer ödüllerde emoji → ikon |
| Kura | 8.5 | 8.5 | — | — | — |
| Başarımlar | 8.5 | 8.5 | 7 | 8.5 | Açık temada kilitli madalyalar lacivert, açılmışlar çamur bronzdu → çelik ve metal altın |
| Onur listesi | 7 | 8.5 | 6 | 8.5 | Mobilde ezilen başlık, açık temada gri boş durum, 🏆 → düzeltildi |
| Belgesel | 8 | 8.5 | 8 | 8.5 | Emoji → ikon |
| Mağaza | 8 | 8.5 | 7.5 | 8.5 | Açık temada rozet bronza dönüyordu, masaüstünde "Satın al" butonları farklı hizadaydı → metal altın, hizalı butonlar |
| Paywall | 7.5 | 8.5 | — | — | Masaüstünde başlık sola yaslı, butonlar dardı → ortalanmış sütun, tam genişlikte eylem butonları |
| Ayarlar (gruplar) | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Kayıtlar (küçük resimler) | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Menü | 8.5 | 8.5 | 8.5 | 8.5 | — |
| Maç sahnesi HUD'u (Phaser) | 8 | 8.5 | — | — | Altın dakika bloğu hub'daki yeşille çelişiyordu → saha yeşili |

**En düşükler:** Önce Yaşam: Projeler (A 6, K 6.5), Onur listesi (A 6) ve Canlı maç hub'ı (6.5). Sonra **8.5'in altında ekran kalmadı.** Ortalama önce ≈ 7.8, sonra 8.5.

### Doğrulama

- `npx vitest run`: 1522 test geçti, 1 test başarısız (`golden.test.ts`). Bu başarısızlık, aynı anda çalışan playtest ajanının commit'lenmemiş `src/sim/**` değişikliklerinden geliyor (`engine.ts`, `match.ts`, `decisions.ts`). Bu turdaki değişiklikler sim'e dokunmuyor.
- `npm run lint` 0 hata verdi, `npm run lint:i18n` temiz, `npm run build` geçti.
- e2e: a11y, a11y-wp19, visual, phone, onboarding ve postmatch 106/106 geçti. Ek olarak decision, national, projects ve board 24/24 geçti.

### Sonraki tur için

- Phaser sahnesinde oyuncular mobilde hâlâ küçük (yaklaşık 14 px), forma numaraları okunmuyor. Bu bir kamera ve zoom kararı. Oynanış hissini etkilediği için bu turda dokunmadım.
- Topluluk sekme şeridi mobilde "Geri bildirim" sekmesini kesiyor. Şerit kaydırılabiliyor, ama sağ kenara bir solma (fade) ipucu eklenebilir.

## Tur: maç öncesi saha etiketleri ve İlişkiler eylem satırı

| Ekran | Önce | Sonra | Not |
|---|---|---|---|
| Maç öncesi kadro sahası | 7 | 8.5 | Etiketler üst üste biniyordu ("Seyim" / "Ünal") → çarpışma duyarlı yerleşim (`pitchLayout.ts`): satırlar eşit aralıklı, etiketler komşuya göre kısalıp üç nokta alıyor, tam ad title/aria'da |
| Yaşam: İlişkiler eylem satırı | 7 | 8.5 | Butonlar kötü sarıyordu → 2 sütunlu ızgara, etiket üstte maliyet altta |

Her 7x7 formasyon çifti için etiket kutularının çakışmadığı birim testle doğrulandı (`pitchLayout.test.ts`). 390 ve 1440 genişlikte, koyu ve açık temada ekran görüntüleri incelendi.
