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
