# 03 — UI ve Asset Araştırması

> Proje: New Star Soccer'ın ruhani devamı olan 2D futbol kariyer/yaşam simülasyonu
> Teknoloji: TypeScript + Vite + Phaser 3. Mobil için Capacitor (Android/iOS), masaüstü için Tauri/Electron
> Tarih: 2026-10-07
> Kapsam: Ücretsiz ve ticari kullanıma uygun UI/sanat/ses/font kaynakları, menü UI mimarisi, görsel kimlik önerisi, prosedürel sanat yaklaşımı ve NSS'ye göre 100+ görsel/UX iyileştirme maddesi.

---

## 0. Yönetici Özeti

1. **Temel asset omurgası Kenney (CC0) olsun.** UI Pack (430 asset), Sports Pack (380 asset, top-down futbol dahil), Game Icons (105), Interface Sounds, Impact Sounds, UI Audio ve Music Jingles paketlerinin tamamı CC0: atıf gerekmiyor, ticari kullanım serbest.
2. **İkon için iki katman kullanalım.** Arayüz ikonlarında **Phosphor (MIT)** ana set olsun, eksikler **Tabler (MIT)** ile tamamlansın. Oyun/RPG tadındaki özel ikonlar (yetenek, ödül, yaşam olayları) için **game-icons.net (CC BY 3.0)** kullanılsın. Bu sette atıf zorunlu, Credits ekranına yazılmalı.
3. **Font:** Başlık ve sayılar için **Barlow Condensed**, gövde ve tablolar için **Inter**, skor tabelası ve büyük rakamlar için isteğe bağlı **Teko**. Üçü de SIL OFL 1.1 lisanslı ve Latin Extended kapsamında Türkçe karakterleri (ğ, ş, ı, İ, ç, ö, ü) destekliyor. Bebas Neue tek ağırlıklı ve yalnızca büyük harf olduğu için ikincil seçenek.
4. **Ses:** Kenney CC0 paketleri, Freesound'da **yalnızca CC0 filtreli** stadyum/düdük kayıtları ve Sonniss GDC bundle (royalty-free, atıfsız; yasak olan tek şey yapay zekâ eğitimi). **Müzik:** Kenney Music Jingles (CC0), OpenGameArt CC0 müzikleri ve Pixabay Music (atıfsız, ticari kullanım serbest). Incompetech (CC BY 4.0) atıf yazılırsa kullanılabilir.
5. **UI mimarisi önerisi: Phaser canvas'ın üzerinde Preact + Signals ile DOM/CSS katmanı.** Kariyer/yaşam simülasyonu ekranlarının büyük çoğunluğu menü, tablo ve form; DOM erişilebilirlik, metin ölçekleme, responsive düzen ve Türkçe büyük/küçük harf dönüşümünde açık ara önde. Maç içi HUD ve saha Phaser'da kalsın. Tam ekran menü açıkken Phaser döngüsü uyutulsun ki düşük seviye Android'de iki katman aynı anda çizilmesin. rexUI yalnızca maç içi küçük diyaloglar gibi niş durumlar için.
6. **Görsel kimlik: "Gece Maçı"** — koyu lacivert zemin, saha yeşili birincil renk, altın vurgu, kalın ve eğik (italik) condensed tipografi, kademeli nadirlik çerçeveli oyuncu kartları, fizik hissi veren yaylı (spring) hareketler.
7. **Prosedürel sanat:** Oyuncu yüzleri **facesjs (Apache-2.0, SVG, forma rengi desteği)** veya DiceBear'ın CC0 stilleriyle üretilsin. Formalar ve armalar seed tabanlı kendi SVG üreticimizle yapılsın. Böylece erken aşamada sanatçıya ihtiyaç kalmıyor.

---

## 1. Lisans Özeti (Hızlı Başvuru)

| Lisans | Ticari kullanım | Atıf | Değiştirme | Not |
|---|---|---|---|---|
| **CC0 1.0** | Evet | Gerekmez | Evet | En güvenlisi. Yine de Credits'te teşekkür iyi bir uygulama. |
| **MIT / ISC** | Evet | Lisans metni dağıtıma eklenmeli | Evet | İkon kütüphaneleri. `THIRD_PARTY_LICENSES.txt` dosyasına girsin. |
| **Apache-2.0** | Evet | LICENSE ve NOTICE dosyası eklenmeli | Evet | facesjs |
| **SIL OFL 1.1** | Evet | Font tek başına satılamaz | Evet (isim değişirse) | Google Fonts fontları. Oyuna gömmek serbest. |
| **CC BY 3.0 / 4.0** | Evet | **Zorunlu** (yazar + kaynak + lisans) | Evet | game-icons.net, Incompetech |
| **CC BY-SA** | Evet | Zorunlu + **aynı lisansla paylaşım** | Evet | Kaçınalım. Türev asset'lerin lisansını "bulaştırır". |
| **CC BY-NC** | **Hayır** | — | — | Ticari oyunda kullanılamaz. Freesound'da sık görülür, dikkat. |
| **Sonniss GDC lisansı** | Evet | Gerekmez | Evet | Yapay zekâ eğitiminde kullanılamaz; ham dosya yeniden dağıtılamaz. |
| **Pixabay Content License** | Evet | Gerekmez | Evet | Ham dosya tek başına satılamaz veya başka stok sitesine konamaz. |
| **itch.io özel lisanslar** | Pakete göre değişir | Pakete göre değişir | Pakete göre değişir | Her paketin sayfası tek tek okunmalı. Lisansı yazmayan paketi kullanmayalım. |

**Süreç kuralı:** Projeye giren her asset `assets/LICENSES.csv` dosyasına bir satır olarak işlenecek: dosya yolu, kaynak URL, yazar, lisans, indirme tarihi ve sayfanın ekran görüntüsü/arşiv linki. Bu kayıt mağaza incelemesinde ve olası bir uyuşmazlıkta işimizi kurtarır.

---

## 2. Kaynak Tablosu

> "Doğrulandı" sütunu bu araştırmada kaynak sayfası okunarak teyit edilen lisansları gösterir. "Kontrol et" yazanların lisansı dosya veya stil bazında değişir; projeye eklemeden önce tek tek bakılmalı.

### 2.1 UI Kitleri ve Genel Oyun Grafikleri

| # | Kaynak | URL | Lisans | Doğrulandı | Ne için kullanırız |
|---|---|---|---|---|---|
| 1 | Kenney – UI Pack | https://kenney.nl/assets/ui-pack | CC0 | Evet (430 asset) | Prototip butonları, paneller, slider, checkbox. Daha sonra kendi CSS bileşenlerimize geçeceğiz ama ilk hafta için ideal. |
| 2 | Kenney – UI Pack: RPG Expansion | https://kenney.nl/assets/ui-pack-rpg-expansion | CC0 | Kenney standardı | Envanter/yaşam simülasyonu panelleri (ev, araba, eşya). |
| 3 | Kenney – Game Icons | https://kenney.nl/assets/game-icons | CC0 | Evet (105 ikon) | Ayarlar, ses, oynat/duraklat, ok, kilit gibi temel sistem ikonları. |
| 4 | Kenney – Input Prompts | https://kenney.nl/assets/input-prompts | CC0 | Kenney standardı | Masaüstü/gamepad tuş ipuçları (Tauri/Steam sürümü). |
| 5 | Kenney – All-in-1 bundle | https://kenney.itch.io/kenney-game-assets | CC0 (bundle ücretli/bağış, içerik CC0) | Kenney standardı | Bütün paketleri tek seferde indirmek için. Tek tek indirmek ücretsiz. |
| 6 | OpenGameArt – CC0 filtresi | https://opengameart.org/art-search-advanced?field_art_licenses_tid[]=4 | Dosyaya göre (CC0 filtresi) | Kontrol et | Ek sprite/arka plan arama. |
| 7 | itch.io – ücretsiz UI asset etiketi | https://itch.io/game-assets/free/tag-gui | Pakete göre | Kontrol et | İlham ve prototip. Lisansı açıkça yazmayan paketi almayalım. |

### 2.2 Futbola Özel Sprite'lar (Oyuncu, Saha, Top, Forma)

| # | Kaynak | URL | Lisans | Doğrulandı | Ne için kullanırız |
|---|---|---|---|---|---|
| 8 | Kenney – Sports Pack | https://kenney.nl/assets/sports-pack | CC0 | Evet (380 asset, top-down) | **Maç motoru prototipinin ana kaynağı.** Top-down oyuncular, saha karoları, top, kale. 10 renk şeması var, tint ile forma rengi verilebilir. |
| 9 | OpenGameArt – Basic Soccer Pack (looneybits) | https://opengameart.org/content/basic-soccer-pack | CC0 | Evet | Kaleci/penaltı mini oyunu için katmanlı SVG ve PNG. Mobil dostu. |
| 10 | OpenGameArt – Football Pack (looneybits) | https://opengameart.org/content/football-pack | CC0 | Evet | Eldiven, top ve çeşitli sprite'lar (SVG + PNG). Antrenman mini oyunları için. |
| 11 | OpenGameArt – Soccer Ball Animation Sprites (Mustitz) | https://opengameart.org/content/soccer-ball-animation-sprites-and-3d-texture | CC0 | Evet | **Gerçekçi dönen top animasyonu.** Farklı kamera açılarında NxN sprite grid. Üretici araç: https://github.com/mustitz/ballgen (renk/boyut/kare sayısı ayarlanabilir). |
| 12 | OpenGameArt – Soccer Ball | https://opengameart.org/content/soccer-ball | CC0 | Arama sonucu | Basit top ikonu (menü, yükleme ekranı). |
| 13 | OpenGameArt – Football Player Overworld Sprite Sheet | https://opengameart.org/content/football-player-overworld-sprite-sheet | CC0 | Arama sonucu | Piksel art oyuncu, 4 yönlü hareket. Retro mod/easter egg için. |
| 14 | OpenGameArt – Football sprite (LPC tabanlı) | https://opengameart.org/content/football-sprite-based-on-lpc-set | **CC-BY-SA 3.0** | Arama sonucu | **Kullanmayalım.** Share-alike türev çalışmalara bulaşır. |
| 15 | itch.io – Football Soccer Game Asset (pablogamedev) | https://pablogamedev.itch.io/football-soccer | Özel: ticari kullanım ve değiştirme serbest, **yeniden dağıtım yasak** | Evet | Yüksek çözünürlüklü saha (4007x2449), kart, skorbord, forma. Prototip için. Paketlenmiş oyun içinde dağıtmak sorun değil, ham dosyayı paylaşmak yasak. |
| 16 | itch.io – 2D Soccer (davidevitali) | https://davidevitali.itch.io/2d-soccer | **Lisans belirtilmemiş** | Evet | **Kullanmayalım.** Lisans yazmıyor, içerik de eksik (tek yönlü oyuncu). |
| 17 | itch.io – FootballGround (platinum-monster) | https://platinum-monster.itch.io/footballground | Sayfada "her proje için kullanılabilir" | Kontrol et | Piksel art top-down saha. Retro mod için. |
| 18 | itch.io – Free Football Argentina Assets (Letta) | https://letta-corporation.itch.io/free-football-argentina-assets | Kontrol et | Kontrol et | Animasyonlu futbolcu, buton, 8-bit müzik. İlham kaynağı. |
| 19 | itch.io – tag-soccer | https://itch.io/game-assets/new-and-popular/tag-soccer | Pakete göre | Kontrol et | Sürekli yenilenen havuz. Üç ayda bir taranmalı. |

> **Sonuç:** Futbol sprite'larında ücretsiz ve kaliteli izometrik bir paket **yok**. Mevcut paketler ya piksel art ya da basit. Bu yüzden saha, oyuncu ve formayı **prosedürel olarak kodla çizmek** (Bölüm 7) hem daha tutarlı hem daha "üst seviye" bir sonuç verir. Kenney Sports Pack ve Mustitz top sprite'ı prototip aşaması için yeterli.

### 2.3 İkon Setleri

| # | Kaynak | URL | Lisans | Doğrulandı | Ne için kullanırız |
|---|---|---|---|---|---|
| 20 | **Phosphor Icons** | https://phosphoricons.com | MIT | Evet | **Ana UI ikon seti.** 6 ağırlık (thin…fill, duotone). Duotone stil oyun hissini güçlendirir. Tree-shake için `@phosphor-icons/core` SVG'leri. |
| 21 | Tabler Icons | https://tabler.io/icons | MIT | Evet | Phosphor'da olmayanlar için yedek (5000+ ikon, futbol/spor ikonları dahil: `ball-football`, `shirt-sport`, `trophy`). |
| 22 | Lucide | https://lucide.dev | ISC (Feather kısmı MIT) | Evet | Alternatif. Tek ağırlık olduğu için oyun UI'ında Phosphor'dan daha "ofis" görünüyor; ikincil seçenek. |
| 23 | **game-icons.net** | https://game-icons.net | **CC BY 3.0** | Evet (Lorc 1429, Delapouite 2022 ikon + 40'tan fazla sanatçı) | Yaşam simülasyonu olayları, yetenek ağacı, rozetler, başarımlar, arma figürleri (aslan, kartal, kule). **Atıf zorunlu:** "Icons made by {yazar}. Available on https://game-icons.net". Credits ekranına ikon başına yazar listesi. |
| 24 | Kenney Game Icons | https://kenney.nl/assets/game-icons | CC0 | Evet | Atıfsız sistem ikonları. |

### 2.4 Fontlar (Google Fonts, SIL OFL 1.1)

| # | Font | URL | Lisans | Türkçe | Kullanım |
|---|---|---|---|---|---|
| 25 | **Barlow Condensed** | https://fonts.google.com/specimen/Barlow+Condensed | OFL 1.1 | Latin Ext ✔ | **Ana display fontu.** 9 ağırlık ve italikleri var. Başlık, kart üstü isim, buton etiketi için 700–900 italik. |
| 26 | **Inter** | https://fonts.google.com/specimen/Inter | OFL 1.1 | Latin Ext ✔ | **Gövde, tablo, istatistik.** `tabular-nums` ile sayılar hizalanır. Değişken (variable) font. |
| 27 | Teko | https://fonts.google.com/specimen/Teko | OFL 1.1 | Latin Ext ✔ | Skor tabelası, dakika sayacı, büyük rating rakamları. |
| 28 | Bebas Neue | https://fonts.google.com/specimen/Bebas+Neue | OFL 1.1 | Latin Ext ✔ | Tek ağırlık ve yalnızca büyük harf. Afiş, gol bildirimi ve "MAÇ SONU" gibi bannerlar için. |
| 29 | Oswald | https://fonts.google.com/specimen/Oswald | OFL 1.1 | Latin Ext ✔ | Barlow Condensed'e alternatif, daha "gazete manşeti" havası var. Haber/medya ekranında kullanılabilir. |
| 30 | Rajdhani | https://fonts.google.com/specimen/Rajdhani | OFL 1.1 | Latin Ext ✔ | Köşeli ve teknik görünüm. Antrenman/veri ekranlarında vurgu için. Gövde metninde okunurluğu zayıf. |
| 31 | Barlow (normal) / Barlow Semi Condensed | https://fonts.google.com/specimen/Barlow | OFL 1.1 | Latin Ext ✔ | Inter yerine aileyi tek tutmak istersek gövde fontu. |

> **Türkçe uyarısı:** CSS'te `text-transform: uppercase` doğru çalışsın diye `<html lang="tr">` ayarlanmalı. Aksi halde "i" harfi "I" olur, "İ" olmaz. Fontlar `fontsource` npm paketleriyle **self-host** edilmeli, Google CDN'den çekilmemeli: offline Capacitor ve Tauri derlemeleri ile GDPR açısından gerekli. Yalnızca `latin` ve `latin-ext` alt kümeleri yüklensin.

### 2.5 Ses Efektleri

| # | Kaynak | URL | Lisans | Doğrulandı | Ne için kullanırız |
|---|---|---|---|---|---|
| 32 | Kenney – Interface Sounds | https://kenney.nl/assets/interface-sounds | CC0 | Kenney standardı | Buton tık, onay, hata, sekme geçişi. |
| 33 | Kenney – UI Audio | https://kenney.nl/assets/ui-audio | CC0 | Kenney standardı | Menü geri bildirimleri. |
| 34 | Kenney – Impact Sounds | https://kenney.nl/assets/impact-sounds | CC0 | Kenney standardı | Topa vuruş, direk, çarpışma (katmanlanıp EQ ile işlenecek). |
| 35 | Kenney – Casino Audio | https://kenney.nl/assets/casino-audio | CC0 | Kenney standardı | Para, kart çevirme ve paket açma (ödül, sözleşme imzası). |
| 36 | Kenney – Voiceover Pack | https://kenney.nl/assets/voiceover-pack | CC0 | Kenney standardı | "Go!", "Ready" gibi kısa anons sesleri (opsiyonel). |
| 37 | **Freesound (CC0 filtreli)** | https://freesound.org/search/?q=stadium+crowd&f=license%3A%22Creative+Commons+0%22 | Ses bazında, **filtre CC0** | Evet (arama sonucu) | Stadyum ambiyansı, tezahürat, gol patlaması, düdük. Örnek adaylar: "Soccer stadium Oehh" (Sandermotions, #494362), "CRWDReac-SOCCER Millerntor" (itmightgetloud, #829456), "stadium crowd sing" (AxelTheCocker02, #733614), "Stadium Crowd" (stomachache, #274516). **Her sesin sayfasında lisansı tekrar kontrol et.** BY-NC olanları alma. |
| 38 | **Sonniss GameAudioGDC Bundle** | https://sonniss.com/gameaudiogdc | Sonniss royalty-free lisansı | Evet | Toplamda 200 GB'ı aşan profesyonel arşiv. Stadyum, kalabalık, rüzgâr, şehir ambiyansı (yaşam simülasyonu sahneleri), araba, kapı, telefon bildirimi. Atıf gerekmiyor. AI eğitimi yasak. |
| 39 | Pixabay Sound Effects | https://pixabay.com/sound-effects/ | Pixabay Content License | Evet | Düdük ve kalabalık için yedek kaynak. Atıf gerekmiyor. Bazı yüklemeler AI üretimi, kalite tek tek dinlenmeli. |
| 40 | ~~ElevenLabs / Artlist / Uppbeat SFX~~ | — | Ücretli veya kısıtlı abonelik | — | **Kullanmayalım.** Lisans abonelik bağımlı. |

### 2.6 Müzik

| # | Kaynak | URL | Lisans | Doğrulandı | Ne için kullanırız |
|---|---|---|---|---|---|
| 41 | Kenney – Music Jingles | https://kenney.nl/assets/music-jingles | CC0 | Kenney standardı | Seviye atlama, ödül, transfer tamamlandı gibi stinger'lar. |
| 42 | OpenGameArt – CC0 Music | https://opengameart.org/art-search-advanced?field_art_type_tid[]=12&field_art_licenses_tid[]=4 | CC0 (filtre) | Kontrol et | Menü müziği, ambient loop'lar. |
| 43 | Pixabay Music | https://pixabay.com/music/ | Pixabay Content License | Evet | Menü/hub müziği. "Sports", "energetic", "lo-fi" etiketleri. Atıfsız. |
| 44 | Incompetech (Kevin MacLeod) | https://incompetech.com/music/royalty-free/ | CC BY 4.0 | Evet | 2000'den fazla parça. Atıf: "Music by Kevin MacLeod (incompetech.com), Licensed under CC BY 4.0". Çok tanındığı için "ucuz oyun" algısı yaratabilir, idareli kullanılmalı. |
| 45 | FreePD | https://freepd.com | CC0 / Public Domain (site beyanı) | Kontrol et | Ek CC0 müzik havuzu. |
| 46 | Uzun vade: özel müzik | — | — | — | Kimlik için 3–5 özgün loop (hub, maç öncesi, sezon sonu). itch.io/Fiverr'da düşük bütçeli besteci. Telif bize devredilmeli. |

### 2.7 Kod Kütüphaneleri (UI ve Prosedürel Sanat)

| # | Kaynak | URL | Lisans | Doğrulandı | Ne için kullanırız |
|---|---|---|---|---|---|
| 47 | **Preact** + **@preact/signals** | https://preactjs.com | MIT | Bilinen | Menü/DOM UI katmanı (~3–4 KB). |
| 48 | phaser3-rex-plugins (rexUI) | https://github.com/rexrainbow/phaser3-rex-plugins | MIT | Evet | Maç içi canvas diyalogları, sanal joystick ve gesture eklentileri. |
| 49 | **facesjs** | https://github.com/zengm-games/facesjs | Apache-2.0 | Evet | **Prosedürel oyuncu yüzleri** (SVG, Mii benzeri). Forma rengi verilebiliyor, akraba yüz üretme özelliği var, web editörü mevcut. Basketball GM'in üretimde kullandığı kütüphane. |
| 50 | DiceBear | https://www.dicebear.com | Kod MIT. **Stiller farklı lisanslarda** (CC0, CC BY 4.0, MIT) | Evet | Alternatif avatar üretici (menajer, ajan, menajerin ailesi, sosyal medya kullanıcıları). Her stilin lisansı tanım dosyasında yazıyor; CC0 olanları tercih edin. |
| 51 | mustitz/ballgen | https://github.com/mustitz/ballgen | Repoda kontrol et (asset'i CC0) | Kısmen | Kendi renklerimizle dönen top sprite sheet üretimi. |
| 52 | Motion One / GSAP | https://motion.dev , https://gsap.com | Motion: MIT. GSAP: 2024'ten beri ücretsiz (Webflow lisansı) | Bilinen | DOM animasyonları. Basit işlerde yalnızca CSS ve Web Animations API yeterli. |
| 53 | culori | https://culorijs.org | MIT | Bilinen | Forma renk çatışması tespiti (OKLCH/ΔE), palet türetme. |
| 54 | Lottie (lottie-web light) | https://github.com/airbnb/lottie-web | MIT | Bilinen | Gol ve kupa kutlama animasyonları (ileride, LottieFiles'ta lisansı ücretsiz olanlar). |

---

## 3. Phaser Üzerinde Menü UI Mimarisi

### 3.1 Seçenekler

| Kriter | **Düz DOM + CSS** | **rexUI (canvas içi)** | **Preact/Svelte overlay** | React overlay |
|---|---|---|---|---|
| Paket boyutu | 0 KB | ~100–300 KB (kullanılan modüllere göre) | Preact ~4 KB, Svelte derleme çıktısı küçük | ~45 KB+ |
| Düşük seviye Android performansı | İyi (doğru kurulursa) | Çok iyi (tek canvas) | İyi | Orta |
| Erişilebilirlik (screen reader, focus, font ölçek) | **Tam** | Neredeyse yok | **Tam** | Tam |
| Metin kalitesi, Türkçe, satır kırma | **Mükemmel** (tarayıcı) | Zayıf (canvas metni, kırma/hyphenation sınırlı) | Mükemmel | Mükemmel |
| Responsive düzen (flex/grid, safe-area) | **Doğal** | Manuel (Sizer sistemi) | Doğal | Doğal |
| Kaydırılabilir uzun listeler (kadro, transfer, haberler) | Doğal (native scroll, momentum) | Elle (GridTable) | Doğal + sanallaştırma | Doğal |
| Form/girdi (isim, sözleşme pazarlığı) | Native klavye | Sorunlu (mobil klavye) | Native | Native |
| Durum yönetimi | Elle | Elle | Signals ile reaktif | Hook/Store |
| Ekip ölçeklenmesi | Zor (spagetti riski) | Orta | **İyi** | İyi |

### 3.2 Öneri: **Preact + Signals ile DOM overlay ve iki modlu render**

**Gerekçe:**
- New Star Soccer tarzı oyunlarda oturum süresinin büyük bölümü **menülerde** geçiyor: haftalık takvim, ilişkiler, satın alma, sözleşme, haber, istatistik. Bu ekranlar tablo, liste, form ve metin ağırlıklı ve DOM'un en güçlü olduğu alan tam olarak bu.
- Erişilebilirlik (TalkBack/VoiceOver, sistem font büyütme, klavye/gamepad focus), mağaza değerlendirmelerinde ve daha geniş kitleye ulaşmada önemli.
- Preact ~4 KB. Signals sayesinde yalnızca değişen düğüm güncelleniyor, sanal DOM diff yükü minimal; düşük seviye cihazda React'tan belirgin şekilde hafif.
- Svelte de uygun bir alternatif. Ancak TS + JSX ekosistemi, test araçları ve işe alım kolaylığı açısından Preact daha güvenli. Svelte'i seçmek de makul; asıl kritik olan mimari kurallar.

**Performans kuralları (düşük seviye Android WebView için zorunlu):**
1. **İki mod:** (a) *Menü modu:* Tam ekran DOM, Phaser `game.loop.sleep()` ile uyutulur veya canvas'a `visibility:hidden` verilir. Arka plan statik bir görsel ya da CSS gradient olur. (b) *Maç modu:* Phaser tam hızda çalışır, DOM'da yalnızca birkaç sabit HUD düğmesi (duraklat) kalır, skor ve dakika Phaser BitmapText ile çizilir.
2. Canvas'ın üstünde, sürekli değişen DOM öğesi bırakmayın (repaint tetikler).
3. Animasyonlarda yalnızca `transform` ve `opacity` kullanın. `box-shadow`, `filter: blur`, `backdrop-filter` animasyonu yapmayın. `backdrop-filter`'ı düşük seviye cihaz profilinde tamamen kapatın (`.lowfx` sınıfı).
4. Uzun listeler sanallaştırılsın (kadro, transfer listesi, lig tablosu 20+ satır).
5. Ekranlar `content-visibility: auto` ve `contain: layout paint` ile izole edilsin.
6. Görseller SVG değil, mümkünse önceden rasterleştirilmiş WebP olsun. Prosedürel SVG'ler bir kez üretilip `OffscreenCanvas` → ImageBitmap → IndexedDB önbelleğine yazılsın.
7. Phaser ile DOM arasındaki iletişim tek bir tipli olay veriyolu (event bus) üzerinden olsun. Oyun durumu tek bir store'da (signals) dursun; Phaser sahneleri bu store'u okusun.

**rexUI nerede?** Maç içinde oyunu durdurmadan çıkan "şut mu pas mı" seçimi, sanal joystick (`rexVirtualJoystick`), pinch/gesture eklentileri. Menü sistemi için değil.

---

## 4. Referans Oyunlar: Ne İyi Yapıyorlar?

| Oyun | İyi yaptığı şey | Bize uyarlaması |
|---|---|---|
| **EA SPORTS FC Mobile** | Nadirlik katmanlı oyuncu kartları (bronz/gümüş/altın/özel), animasyonlu kart arka planları, paket açma gerilimi, kalın condensed tipografi. FC 24'te statlar kartın altında tek yatay satıra taşındı, ulus/lig/kulüp en alta indi. | Kariyer kartı: oyuncumuzun "sezon kartı" her sezon güncellensin, form arttıkça çerçeve yükselsin. Statlar tek satır, Barlow Condensed. |
| **Top Eleven** | Platformlar arası tutarlı UX için sıfırdan yeniden yazıldı. Net hiyerarşi, büyük CTA, maç günü takvimi, 3D stadyum geliştirmeleri. | Hub ekranında "sıradaki maç" kartı her zaman en üstte. Tek bir birincil CTA. |
| **Retro Goal (New Star Games)** | 16-bit nostalji ve modern dokunmatik kontrol. Okunaklı minimal HUD, çok hızlı maçlar. Aynı stüdyonun en güncel dili. | Maç kamerası ve kontrol hissinde örnek alınacak. Görselde ise piksel yerine **vektör ve flat-shaded** çizimle ondan ayrışacağız. |
| **Football Manager Mobile** | Yoğun veriyi okunaklı sunması: renk kodlu atribüt değerleri (1–20), radar/polygon grafikleri, kulüp renklerine bürünen başlık çubuğu. | Atribüt renk skalası, kulüp renkli üst bar, oyuncu radar grafiği. |
| **Score! Match / Score! Hero** | Tek parmakla çizerek pas/şut. Sinematik yavaş çekim anları, kariyer "hikâye seviyeleri". | Kritik anlarda yavaş çekim ve çizgiyle şut yolu, NSS'in "an" (moment) mekaniğine çok uygun. |
| **Golf Clash** | Kalın, "basılabilir" 3D bevel butonlar, net onboarding, hızlı yükleme, anında geri bildirim, sezonluk tur sistemi. Dokunsal tatmin. | CTA butonları alt kenarlı, basılınca 2–4 px aşağı inen "chunky" stil. Ödül ekranında yaylı sayaç. |
| **Soccer Manager 2025** | Gerçekçi kulüp verisi, hızlı menü gezintisi, alt sekme çubuğu, büyük oyuncu fotoğraflı listeler. | Alt navigasyon (5 sekme), listelerde avatar ve sağda rating çipi. |

**Ortak dersler:** (1) Koyu tema + tek parlak vurgu rengi, (2) kalın ve eğik condensed tipografi = "spor yayını" hissi, (3) kart metaforu, (4) her ekranda tek bir birincil aksiyon, (5) sayıların animasyonla artması, (6) kulüp renklerinin UI'a sızması.

---

## 5. Önerilen Görsel Kimlik: "GECE MAÇI"

### 5.1 Konsept
NSS'in düz ve retro görünümünden ayrılıp **TV yayın grafiği + modern mobil spor oyunu** arasında konumlanan bir kimlik: koyu stadyum gecesi, projektör ışığı vurguları, çim yeşili enerji, altın ödül hissi. Hedef "küçük ekip için üretilebilir premium". 3D yok, ağır illüstrasyon yok. **Vektör, flat-shaded, gradient + gölge** dili.

### 5.2 Renk Paleti (Design Token)

**Zemin / Yüzeyler (koyu tema varsayılan)**
| Token | Hex | Kullanım |
|---|---|---|
| `--bg-0` | `#070B14` | En alt zemin (uygulama arka planı) |
| `--bg-1` | `#0B1220` | Sayfa zemini |
| `--surface-1` | `#131C2E` | Kart |
| `--surface-2` | `#1B2740` | Yükseltilmiş kart / modal |
| `--surface-3` | `#24345A` | Hover / seçili satır |
| `--border` | `#2A3A5C` | İnce çerçeve (1px) |
| `--text-hi` | `#F2F5FA` | Ana metin |
| `--text-mid` | `#B4C0D6` | İkincil metin |
| `--text-lo` | `#7A8BAA` | Yardımcı / devre dışı |

**Marka ve Vurgu**
| Token | Hex | Kullanım |
|---|---|---|
| `--brand-pitch` | `#1FD47A` | **Birincil:** CTA, ilerleme, pozitif |
| `--brand-pitch-deep` | `#0E9F57` | Birincilin basılı hâli / alt bevel |
| `--accent-gold` | `#FFC83D` | Ödül, para, yıldız, MVP |
| `--accent-gold-deep` | `#D99A0B` | Altın bevel |
| `--accent-blue` | `#3DA5FF` | Bilgi, link, ikincil aksiyon |
| `--accent-violet` | `#8E5CFF` | Elit/özel nadirlik, sosyal medya/şöhret |

**Durum (futbol semantiği)**
| Token | Hex | Kullanım |
|---|---|---|
| `--state-success` | `#1FD47A` | Gol, kazanç, iyi form |
| `--state-warning` | `#FFD23F` | Sarı kart, yorgunluk uyarısı |
| `--state-danger` | `#FF4D5E` | Kırmızı kart, sakatlık, borç |
| `--state-info` | `#3DA5FF` | Bilgi |

**Atribüt skalası (1–99 veya 1–20)**
| Aralık | Hex |
|---|---|
| Çok zayıf | `#FF4D5E` |
| Zayıf | `#FF8A3D` |
| Orta | `#FFD23F` |
| İyi | `#8BE04E` |
| Çok iyi | `#1FD47A` |
| Elit | `#3DE0E0` |

**Nadirlik / Kart çerçeveleri**
| Kademe | Ana | Gradient |
|---|---|---|
| Bronz | `#C27A3E` | `#8A4B1E → #E0A06A` |
| Gümüş | `#B8C4D6` | `#7D8AA3 → #E6ECF5` |
| Altın | `#F2C14E` | `#B8860B → #FFE38A` |
| Elit | `#8E5CFF` | `#4B1FB8 → #C2A3FF` |
| Efsane | çok renkli | `#FF4D5E → #FFC83D → #1FD47A → #3DA5FF` (conic) |

**Saha**
| Token | Hex |
|---|---|
| `--pitch-a` | `#2F8F45` |
| `--pitch-b` | `#37A050` (biçilmiş çim şeritleri) |
| `--pitch-line` | `#EAF5EA` (opacity 0.85) |
| `--pitch-shadow` | `#0B3D1A` (oyuncu gölgesi, opacity 0.35) |

Açık tema ileride erişilebilirlik seçeneği olarak eklenecek. Tüm metin/zemin çiftleri WCAG AA (4.5:1) ile test edilsin. Örneğin `#F2F5FA` / `#131C2E` ≈ 15:1, `#1FD47A` / `#0B1220` ≈ 9:1.

### 5.3 Tipografi
| Rol | Font | Ağırlık/Stil | Boyut (mobil) | Not |
|---|---|---|---|---|
| Display / Hero | Barlow Condensed | 900 italic, büyük harf | 40–56 px | `letter-spacing: -0.01em`, gol ve maç sonu bannerları |
| H1 | Barlow Condensed | 800 italic | 28–32 px | Ekran başlığı |
| H2 | Barlow Condensed | 700 | 20–22 px | Kart başlığı |
| Etiket / Buton | Barlow Condensed | 700, büyük harf | 16–18 px | `letter-spacing: 0.04em` |
| Gövde | Inter | 400/500 | 15–16 px | `line-height: 1.45` |
| Tablo / istatistik | Inter | 500, `tabular-nums` | 13–14 px | Sayılar sağa hizalı |
| Skor / Rating | Teko | 600 | 32–72 px | Rakam odaklı |
| Mikro | Inter | 600, büyük harf | 11 px | `letter-spacing: 0.08em`, rozet ve çip |

Ölçek: 1.25 (major third), `clamp()` ile akışkan boyut. Kullanıcının sistem font büyütmesi %200'e kadar düzeni bozmamalı.

### 5.4 İkonografi
- **Phosphor**, varsayılan `bold` ağırlık. Seçili sekmede `fill`, ödül ve özel durumlarda `duotone` (ikinci renk `--accent-gold` %40).
- Boyut ızgarası 16 / 20 / 24 / 32. Dokunma hedefi minimum 44×44 px.
- Oyun-özgü ikonlar (yaşam olayları, yetenekler) için **game-icons.net**. Tek renk SVG olarak gelir; bunları yuvarlak köşeli kare "rozet" içine alıp nadirlik rengiyle doldururuz. İki set arasında stil farkı olduğu için game-icons yalnızca rozet içinde kullanılsın, düz arayüzde kullanılmasın.
- Özel futbol ikonları (forma, krampon, düdük, ofsayt bayrağı, VAR) 24 px ızgarada, 2 px stroke, Phosphor uyumlu çizilsin. İlk 20 ikonu bir geliştirici Figma'da yapabilir.

### 5.5 Kart Stilleri
- **Standart kart:** `--surface-1`, 1 px `--border`, `border-radius: 14px`, iç boşluk 16 px. Gölge: `0 8px 24px rgba(0,0,0,.35)`. Üst kenarda 1 px açık highlight (`inset 0 1px 0 rgba(255,255,255,.06)`).
- **Oyuncu kartı (FUT benzeri, dikey 5:7):** nadirlik gradient çerçevesi, sol üstte büyük rating (Teko), mevki, altında facesjs avatarı, en altta tek satır 6 stat ve kulüp armasıyla bayrak. Elit kademede yavaş kayan parlama (shine) animasyonu var, "azaltılmış hareket" ayarında kapanır.
- **Maç kartı:** sol/sağ armalar, ortada saat/skor, alt şeritte lig adı. Kulüp birincil renkleri kartın iki yanından %12 opaklıkla diyagonal gradient olarak sızar.
- **Olay kartı (yaşam sim):** sol tarafta game-icons rozeti, başlık, kısa metin, 2–3 seçenek butonu, her seçeneğin altında etki çipleri (+5 Mutluluk, −₺2.000).
- **Chunky CTA butonu (Golf Clash tarzı):** yükseklik 52 px, gradient `#2BE88A → #1FD47A`, alt bevel `box-shadow: 0 4px 0 #0E9F57`. Basılınca `translateY(3px)` ile bevel 1 px'e iner. 80 ms.
- **Köşe dili:** Hafif paralelkenar (`skewX(-8deg)`) yalnızca başlık şeritlerinde ve skor tabelasında, TV grafiği hissi için. Kartların kendisi düz kalır.

### 5.6 Hareket (Motion) İlkeleri
1. **Hızlı ve fiziksel:** Mikro etkileşim 80–150 ms, ekran geçişi 220–320 ms, kutlama 600–1200 ms.
2. **Eğriler:** Girişte `cubic-bezier(.2,.8,.2,1)` (ease-out-expo benzeri), çıkışta `cubic-bezier(.4,0,1,1)`. Ödül/rozet için spring (stiffness 300, damping 20).
3. **Yön anlamı:** İleri gezinti sağdan kayarak gelir, geri gezinti soldan. Modal alttan çıkar (bottom-sheet).
4. **Sayılar sayar:** Para, rating ve XP değişimleri 400–800 ms'de count-up olur, artışta yeşil, düşüşte kırmızı kısa parlama.
5. **Tek kahraman:** Ekranda aynı anda yalnızca bir şey "kutlanır". Konfeti + shake + ses birlikte sadece büyük anlarda (gol, kupa, transfer).
6. **Stagger:** Liste öğeleri 30 ms arayla, en fazla 8 öğe; sonrası anında gelir.
7. **Azaltılmış hareket:** `prefers-reduced-motion` ve oyun içi ayar. Parallax, shake ve shine kapanır, geçişler crossfade olur.
8. **Performans:** Yalnızca transform ve opacity. 60 fps hedefi, düşük profilde 30 fps ve efektler kapalı.

### 5.7 Saha ve Maç Görselliği
- Top-down ve hafif perspektif (yukarıdan ~70°): Sensible Soccer/Retro Goal okunurluğunu koruyup çim şeritleri, projektör vinyeti ve oyuncu gölgeleriyle derinlik verilir.
- Oyuncular **prosedürel vektör:** gövde (forma rengi, desen maskesi), şort, tozluk, kafa (ten tonu), saç (renk + şekil). Phaser Graphics ile çizilip RenderTexture'a önbelleklenir. 8 yön × 4–6 kare koşu animasyonu, kemik benzeri basit bacak salınımı.
- Oyuncunun kendisi (kahraman) altında **halka** (`--brand-pitch`), topu olan oyuncunun üstünde küçük ok.
- Gece maçlarında 4 köşeden projektör ışık konileri (additive blend) ve hafif vinyet. Yağmurda partikül ve çimde parlama.

---

## 6. NSS'ten Ayrışma: Nerede "Bir Seviye Üst"?

| NSS (klasik) | Bizim yaklaşım |
|---|---|
| Düz renk, çoğunlukla gri/beyaz paneller | Koyu katmanlı yüzeyler, gradient ve bevel, kulüp renk sızması |
| Sistem fontuna yakın tipografi | Condensed italik display + Inter, net hiyerarşi |
| Statik metin listeleri | Kartlar, çipler, ilerleme halkaları, mini grafikler |
| Ani geçişler | Yön anlamı taşıyan kısa animasyonlar, count-up sayaçlar |
| Küçük dokunma hedefleri | En az 44 px, başparmak bölgesinde CTA |
| Basit sprite'lar | Prosedürel vektör oyuncu, yüz avatarı, forma ve arma |
| Erişilebilirlik ayarı neredeyse yok | Font ölçek, renk körlüğü modu, azaltılmış hareket, screen reader |

---

## 7. Prosedürel Sanat Yaklaşımı

### 7.1 Ortak altyapı
- **Seed'li PRNG:** `mulberry32` veya `sfc32`. Kulüp, oyuncu ve kişi id'si seed olarak kullanılır, böylece aynı id her seferinde aynı görseli üretir. Kayıt dosyası yalnızca seed ve birkaç parametre tutar, görselin kendisini değil.
- **Pipeline:** Parametre objesi → SVG string (şablon fonksiyonları) → (a) DOM'da doğrudan `<svg>` veya (b) Phaser için `Image` → `OffscreenCanvas` → `textures.addImage/addCanvas` → IndexedDB'de PNG/WebP önbellek (anahtar: `hash(params)`).
- **Renk motoru (culori):** Kulüp birincil/ikincil rengi OKLCH uzayında seçilir. Okunurluk için forma üstündeki numara rengi kontrasta göre otomatik siyah veya beyaz olur. Deplasman forması, ev sahibine ΔE < 25 ise otomatik devreye girer.
- **Bölge paletleri:** Ülke ve şehir bazında renk eğilimleri tutulur (ör. Türkiye ligi kurgusal kulüpleri için kırmızı-beyaz, sarı-lacivert, bordo-mavi kombinasyonları). Gerçek kulüplerle birebir eşleşme ve tescilli marka benzerliğinden kaçınılır.

### 7.2 Forma üretici (SVG)
- **Gövde şablonları:** 3 kesim (klasik, modern slim, retro yakalı) × ön/arka.
- **Desenler (maske):** düz, dikey çizgi (2–7 adet), yatay bant, yarım-yarım, çapraz kuşak (sash), kareli, chevron, ince pinstripe, gradyan fade, omuz paneli, kol rengi farklı. Toplam 12+.
- **Detaylar:** yaka (V, yuvarlak, polo), kol bandı, manşet, sponsor alanı (kurgusal sponsor logoları da prosedürel), göğüste arma, arkada numara ve isim (Barlow Condensed).
- **Kaleci forması:** saha oyuncularıyla otomatik çatışmayan neon palet.
- **Kullanım alanları:** kadro kartı, maç öncesi dizilişi, mağaza (oyuncunun kendi markası), maç içi sprite (Phaser'da aynı parametrelerle sadeleştirilmiş versiyon).

### 7.3 Arma (crest) üretici
- **Kalkan şekilleri (10+):** klasik heater, yuvarlak, oval, İspanyol, Fransız, sekizgen, rozet/madalyon, modern minimal daire, elmas, çift halka.
- **Bölme (heraldik "partition"):** per pale, per fess, per bend, quarterly, chevron, saltire, çizgili. Bunlar SVG clipPath ile yapılır.
- **Figür (charge):** game-icons.net'ten seçilmiş 40–60 hayvan/nesne ikonu (aslan, kartal, kurt, kule, gemi, yıldız, top). CC BY olduğu için Credits'e yazılır. Alternatif: Kenney/CC0 veya kendi çizimimiz.
- **Metin:** kulüp kısaltması (monogram, 2–4 harf), kuruluş yılı bandı, yıldızlar (şampiyonluk sayısına göre dinamik olarak eklenir).
- **Stil katmanları:** dış kontur kalınlığı, iç çift çizgi, flat gölge (offset 2 px, %25 siyah). Modern "flat" ile klasik "detaylı" arasında bir slider.
- **Kural tabanlı uyum:** Renk sayısı en fazla 3. Figür rengi zemine kontrastla seçilir. Monogram için kulüp adındaki kelimelerin baş harfleri, Türkçe karakterler korunur.

### 7.4 Oyuncu ve karakter avatarları
- **facesjs (Apache-2.0):** Yüz, saç, sakal, göz, kaş, aksesuar ve forma rengi var. `generate()` ile rastgele yüz, `relative` ile akraba (baba-oğul) üretilebiliyor. Yaşlanma için saç rengi ve kırışıklık parametreleri zamanla güncellenir (kariyer boyunca oyuncunun yaşlandığını görmek güçlü bir duygusal unsur).
- **DiceBear (MIT kod, stil lisansı değişken):** Yan karakterler (menajer, ajan, sevgili, gazeteci, taraftar) için farklı ama uyumlu bir stil. CC0 lisanslı stiller tercih edilecek. Sosyal medya feed'inde "kullanıcı avatarları" için ideal.
- **Kendi sadeleştirilmiş vektörümüz (maç için):** Saha üstü minik oyuncuda yalnızca saç rengi, ten tonu ve forma kullanılır, yüz detayı yok.

### 7.5 Diğer prosedürel öğeler
- **Stadyum kartı:** kapasiteye göre tribün katmanı sayısı, çatı tipi, kulüp renkli koltuk deseni (izometrik flat SVG).
- **Kupa/ödül ikonları:** gövde (kase, kupa, plaket) × kulp × kaide × malzeme (altın/gümüş/bronz gradient).
- **Haber "fotoğrafları":** gerçek fotoğraf yerine kulüp renkli duotone illüstrasyon + avatar + başlık. Gazete manşeti stili.
- **Lig logoları ve sponsorlar:** geometrik şekil + font kombinasyonu jeneratörü.
- **Grafikler:** form çizgisi (sparkline), radar (6 atribüt), ısı haritası. Kendi SVG bileşenlerimizle çizilecek, ek kütüphane gerekmiyor.

---

## 8. Uygulama Yol Haritası (UI/Görsel)

| Faz | Süre | Teslim |
|---|---|---|
| F0 – Temel | 1 hafta | Token dosyası (CSS custom properties + TS export), font self-host, Phosphor entegrasyonu, Preact kabuğu, Phaser uyku/uyanma modu |
| F1 – Bileşen kütüphanesi | 2 hafta | Button (primary/secondary/ghost/chunky), Card, Chip, ProgressRing, StatBar, Tabs, BottomNav, BottomSheet, Toast, ListRow, Avatar, Crest, Kit |
| F2 – Prosedürel | 2 hafta | Forma + arma üretici, facesjs entegrasyonu, IndexedDB önbellek, test sayfası (seed galerisi) |
| F3 – Maç görseli | 2–3 hafta | Saha render, prosedürel oyuncu sprite'ları, HUD, kamera, gol kutlama |
| F4 – Cila | sürekli | Ses, haptik, animasyon, erişilebilirlik testi, düşük seviye cihaz profili |

**Test cihazı hedefi:** 2 GB RAM'li, Android 9 ve Mali-G52 sınıfı bir telefon (ör. Redmi 9A). Menü modunda 60 fps, maç modunda en az 30 fps sabit.

---

## 9. 100+ UI/görsellik iyileştirme maddesi

> New Star Soccer'ın klasik arayüzüne göre somut iyileştirmeler. Her madde bir backlog kartına dönüştürülebilir.

### A. Genel Görsel Dil ve Tema
1. Koyu "Gece Maçı" teması varsayılan olsun, açık tema erişilebilirlik seçeneği olarak sunulsun.
2. Tüm renkler, aralıklar ve yarıçaplar design token'larından gelsin; kodda sabit hex kullanılmasın.
3. Kulübümüzün birincil rengi üst bar ve vurgu çizgilerine %12–20 opaklıkla sızsın, transfer olunca UI rengi de değişsin.
4. Kartlarda üst kenar highlight ve yumuşak gölge ile katman derinliği hissi verilsin.
5. Arka planlarda hafif gürültü (noise) dokusu ve radyal projektör ışığı kullanılsın; düz renk zemin olmasın.
6. Başlık şeritlerinde TV yayın grafiği tarzı eğik (skew) paneller kullanılsın.
7. Tüm ekranlarda 8 px'lik aralık ızgarası uygulansın.
8. Köşe yarıçapı sistemi tutarlı olsun: 6 (çip), 10 (buton), 14 (kart), 20 (modal).
9. Gün/gece döngüsü hub arka planına yansısın (sabah açık mavi gradient, gece lacivert).
10. Sezon temaları olsun: kış transfer döneminde soğuk tonlar, sezon finalinde altın detaylar.
11. Renk körlüğü modları (deuteranopi/protanopi/tritanopi) için alternatif durum renkleri ve şekil ipuçları eklensin.
12. Tüm kritik bilgiler yalnızca renkle değil, ikon veya metinle de verilsin (ör. sakatlık: kırmızı + çarpı ikonu).

### B. Tipografi
13. Condensed italik display fontla güçlü başlık hiyerarşisi kurulsun.
14. Sayılar `tabular-nums` ile hizalansın; tablolarda kayma olmasın.
15. Skor ve rating rakamları için özel rakam fontu (Teko) kullanılsın.
16. `lang="tr"` ile doğru Türkçe büyük harf dönüşümü sağlansın (İ/ı).
17. Sistem font ölçeğine uyulsun, %200'e kadar düzen kırılmasın.
18. Uzun oyuncu isimleri için akıllı kısaltma yapılsın (ör. "M. Yılmazoğlu"), kart üstünde otomatik font küçültme olsun.
19. Gövde metni satır uzunluğu 45–75 karakter arasında tutulsun.
20. Haber ve olay metinlerinde önemli kelimeler kalın veya renkli vurgulansın (oyuncu adı, para miktarı).

### C. Navigasyon ve Bilgi Mimarisi
21. Alt navigasyon çubuğu olsun: Ana Sayfa, Kariyer, Yaşam, Takım, Profil (5 sekme, başparmak erişiminde).
22. Hub ekranında "Sıradaki Maç" kartı her zaman en üstte tek birincil CTA olsun.
23. Hafta/takvim şeridi yatay kaydırılabilir olsun; günler ikonlu olsun (maç, antrenman, etkinlik).
24. Her ekranda geri hareketi tutarlı olsun (sistem geri tuşu ve sol üst ok).
25. Breadcrumb yerine bağlamsal başlık ve alt başlık kullanılsın ("Transferler · 3 teklif").
26. Bildirim rozetleri (kırmızı nokta + sayı) sekmelerde gösterilsin.
27. Global arama olsun (oyuncu, kulüp, eşya).
28. Derin ekranlar bottom-sheet ile açılsın, bağlam kaybolmasın.
29. Masaüstünde sol kenar çubuğu navigasyonu ve geniş ekran için çok sütunlu düzen olsun.
30. Klavye kısayolları (masaüstü) ve gamepad focus halkası desteklensin.
31. İlk açılışta 60 saniyelik etkileşimli onboarding olsun; tek seferde bir özellik tanıtılsın.
32. Kilitli özellikler bulanık önizleme ve "X seviyesinde açılır" etiketiyle gösterilsin.

### D. Kartlar ve Bileşenler
33. Oyuncu kartı nadirlik çerçeveli (bronz, gümüş, altın, elit, efsane) olsun.
34. Kartta statlar tek yatay satırda dursun (FC 24 tarzı).
35. Elit kartlarda yavaş kayan shine efekti olsun (azaltılmış harekette kapalı).
36. Chunky, basılabilir CTA butonları alt bevel ile yapılsın.
37. İkincil butonlar outline/ghost olsun; ekranda tek dolu buton kuralı geçerli olsun.
38. Basılı tutma (long-press) ile hızlı önizleme açılsın (oyuncu, eşya).
39. Çipler/etiketler kullanılsın: mevki, form, sakatlık, sözleşme durumu.
40. İlerleme halkaları (ProgressRing) kullanılsın: kondisyon, moral, XP.
41. Stat çubukları renk skalasıyla dolsun ve değişimi delta göstergesiyle (+3 ▲) versin.
42. Skeleton yükleme ekranları olsun, boş beyaz ekran olmasın.
43. Boş durum (empty state) ekranları illüstrasyon ve aksiyon önerisi içersin ("Henüz teklif yok. Formunu yükselt!").
44. Toast bildirimleri sağ üstte (masaüstü) veya üstte (mobil) çıksın, kaydırılarak kapatılabilsin.
45. Onay diyalogları geri alınabilir (undo) aksiyonlarla mümkün olduğunca azaltılsın.
46. Kaydırma listelerinde yapışkan (sticky) başlıklar olsun.
47. Sayısal girdide (bahis, maaş teklifi) slider ve +/- adım butonları olsun, klavye zorunlu olmasın.
48. Karşılaştırma görünümü olsun: iki oyuncu veya iki teklif yan yana, farklar vurgulu.

### E. Veri Görselleştirme
49. Atribütler için 6 eksenli radar grafik olsun.
50. Son 10 maç form çizgisi (sparkline) ve renkli nokta dizisi gösterilsin.
51. Maç notu (rating) zaman içinde çizgi grafikle izlensin.
52. Isı haritası olsun: maçta oyuncunun dokunduğu bölgeler.
53. Şut haritası olsun: gol, isabetli ve isabetsiz şutlar.
54. Finans ekranında gelir/gider halka grafiği ve aylık bakiye çizgisi gösterilsin.
55. Lig tablosunda Avrupa kupası, küme düşme gibi bölgeler renk şeridiyle belirtilsin.
56. Kariyer zaman çizelgesi olsun: kulüpler, kupalar, dönüm noktaları yatay timeline'da.
57. İlişki ağı görseli olsun: menajer, takım arkadaşları, aile; çizgi kalınlığı ilişki gücünü göstersin.
58. Atribüt değerleri renk skalasıyla gösterilsin (FM tarzı 1–20 veya 1–99).
59. Tooltip/dokunma ile detay: grafikteki noktaya dokununca değer balonu açılsın.

### F. Maç İçi Görsellik ve HUD
60. Prosedürel vektör oyuncular kulüp forması desenleriyle çizilsin.
61. Biçilmiş çim şeritleri, saha çizgileri, kale filesi animasyonu olsun.
62. Oyuncu gölgeleri ve topun yüksekliğine göre gölge ölçeklensin (derinlik algısı).
63. Gerçekçi dönen top sprite'ı (Mustitz/ballgen) kullanılsın.
64. Kahraman oyuncunun altında renkli halka, topa sahip olanın üstünde ok olsun.
65. Gece maçlarında projektör ışık konileri ve vinyet olsun.
66. Hava durumu efektleri: yağmur, kar, sis partikülleri.
67. Minimal HUD olsun: skor, dakika, kondisyon çubuğu; gerisi gizli.
68. Kritik anlarda yavaş çekim ve şut yolu çizgisi (Score! tarzı) olsun.
69. Gol sonrası kamera zoom, ekran sarsıntısı ve tribün flaşları olsun.
70. Tekrar (replay) sistemi olsun: son 5 saniye, farklı kamera açısı.
71. Pas/şut hedefleme için yarı saydam yay ve güç göstergesi olsun.
72. Ofsayt çizgisi ve VAR anı için özel görsel efekt (mavi tarama çizgisi).
73. Sarı/kırmızı kart verildiğinde hakem animasyonu ve kart ikonu pop-up'ı.
74. Maç sonu ekranında not, istatistik, "maçın adamı" kartı ve paylaşılabilir görsel.
75. Kenarda tribün kalabalığı paralaks katmanlarıyla verilsin (basit renkli noktalardan oluşan "piksel kalabalık").

### G. Animasyon ve Geri Bildirim
76. Para, XP ve rating değişimleri count-up animasyonuyla gösterilsin.
77. Ekran geçişleri yön anlamı taşısın (ileri sağdan, geri soldan).
78. Butona basınca 80 ms basılma ve bırakınca hafif zıplama efekti olsun.
79. Seviye atlamada konfeti, rozet spring animasyonu ve ses olsun.
80. Transfer imzalandığında forma "giydirilme" animasyonu oynasın (eski forma kayar, yenisi gelir).
81. Paket/ödül açma: kart çevrilme animasyonu ve nadirlik rengine göre ışık patlaması.
82. Haptik geri bildirim (Capacitor Haptics): gol, kart, onay, hata için farklı titreşim kalıpları.
83. Kaydırma sonunda elastik (overscroll) his olsun.
84. Liste öğeleri staggered (kademeli) girişle gelsin.
85. Bildirim zili yeni olayda hafifçe sallansın.
86. Pull-to-refresh yerine "sonraki gün" için kaydırma jesti eklensin.
87. Bekleme anları (sim hesaplama) için tematik loader kullanılsın: dönen top veya dolan stadyum.

### H. Karakter, Avatar ve Kişiselleştirme
88. Oyuncu yüzü facesjs ile oluşturulsun ve yaş ilerledikçe yüzde değişim olsun (saç beyazlaması, sakal).
89. Karakter oluşturucuda yüz, saç, ten ve aksesuar canlı önizlemeyle seçilsin.
90. Krampon, saç stili ve dövme gibi kozmetikler maç sprite'ında da görünsün.
91. Yan karakterler (menajer, ajan, sevgili, gazeteci) tutarlı ama ayırt edilebilir avatar stiliyle çizilsin.
92. Kendi markamız için logo ve renk seçimi yapılsın; mağaza ürünlerinde bu marka görünsün.
93. Ev, araba ve eşyalar izometrik flat ikon setiyle gösterilsin, sahip olunanlar "koleksiyon rafı"nda dursun.
94. Prosedürel arma ve formalarla her kurgusal kulübün benzersiz görsel kimliği olsun.
95. Kulüp formaları her sezon küçük varyasyonla yenilensin ("2027/28 iç saha forması").

### I. Yaşam Simülasyonu ve Anlatı Ekranları
96. Olay kartları seçeneklerin etkisini çiplerle önceden göstersin (+Mutluluk, −Para).
97. Sosyal medya feed'i olsun: taraftar yorumları, beğeni sayacı, trend etiketleri.
98. Haber ekranı gazete manşeti tipografisiyle yapılsın, prosedürel duotone "fotoğraf" kullanılsın.
99. Telefon arayüzü metaforu kullanılsın: mesajlar, ajan aramaları, takvim uygulaması gibi.
100. Ruh hali ve ilişki durumunu yüz ifadeleriyle (facesjs ağız/kaş parametreleri) gösterelim.
101. Sezon sonu "yıl özeti" ekranı olsun: Spotify Wrapped tarzı, paylaşılabilir kartlar.
102. Başarım (achievement) vitrini nadirlik çerçeveli rozetlerle düzenlensin.
103. Kupa dolabı 3D hissi veren raf üzerinde prosedürel kupalarla gösterilsin.

### J. Erişilebilirlik ve Platform
104. Tüm etkileşimli öğelerin dokunma hedefi en az 44×44 px olsun.
105. Screen reader için ARIA etiketleri eklensin; maç olayları canlı bölge (aria-live) ile duyurulsun.
106. Azaltılmış hareket ayarı olsun (sistem ayarı ve oyun içi seçenek).
107. Yüksek kontrast modu olsun.
108. Altyazı/metin hızı ayarı olsun (maç anlatımı, diyaloglar).
109. Safe-area (çentik, gesture bar) desteği olsun: `env(safe-area-inset-*)`.
110. Tablet ve masaüstünde çok sütunlu responsive düzen kullanılsın, telefon arayüzü sadece büyütülmesin.
111. Yatay ve dikey yön desteği olsun: menüler dikeyde, maç yatayda (opsiyonel kilit).
112. Düşük güç / düşük seviye cihaz profili olsun: blur, partikül ve shine kapalı, 30 fps.
113. Tek elle kullanım modu: tüm kritik aksiyonlar ekranın alt %40'ında.
114. Çevrimdışı tam çalışma, fontlar ve asset'ler cihaza gömülü.

### K. Ses ve Atmosfer (Görsel ile bütünleşik)
115. UI sesleri (tık, onay, hata) Kenney CC0 setinden tutarlı bir ton ailesiyle seçilsin.
116. Stadyum ambiyansı skor durumuna göre dinamik olsun (gerideyken gerginlik, golde patlama).
117. Hub müziği gün/gece ve sezon fazına göre değişsin.
118. Ses, müzik, UI ve ambiyans için ayrı ses ayarları olsun.
119. Görsel olaylar (gol bannerı) ile ses stinger'ı aynı karede senkronlansın.
120. Credits ekranı lisans gereklilikleri için eksiksiz olsun (game-icons yazarları, Incompetech, MIT/Apache metinleri) ve kaydırılabilir şık bir sayfa olarak tasarlansın.

---

## 10. Riskler ve Notlar

- **Gerçek kulüp/marka benzerliği:** Prosedürel arma ve forma üreticisi gerçek kulüplere (ör. sarı-lacivert dikey çizgi + kanarya figürü) fazla yaklaşabilir. Figür, renk ve desen kombinasyonu için bir "kara liste" kontrolü yapılmalı.
- **game-icons.net atfı:** Kullanılan her ikonun yazarı derleme sırasında otomatik toplanmalı (ikon dosya adında yazar klasörü var: `lorc/`, `delapouite/` vb.). Credits ekranı otomatik üretilsin.
- **Freesound:** Her sesin lisansı tek tek değişebilir. "CC0" filtresiyle indirilenler bile sayfa linkiyle kayıt altına alınmalı. Attribution veya NC lisanslı sesler projeye girmemeli.
- **DOM + canvas birlikte çizimi:** Düşük seviye Android'de DOM canvas'ın üstündeyken FPS'in ciddi düştüğü raporlanmış. "İki mod" kuralı bu yüzden zorunlu.
- **DiceBear stilleri:** Kod MIT olsa da bazı stiller CC BY 4.0. Stil seçerken lisans dosyası kontrol edilmeli.
- **Sonniss:** Lisans dosyaları yıl bazında güncelleniyor. İndirilen her yılın lisans PDF'i projede arşivlensin.

---

## 11. Kaynaklar (Araştırmada Doğrulanan Sayfalar)

- Kenney UI Pack — https://kenney.nl/assets/ui-pack (CC0, 430 asset)
- Kenney Sports Pack — https://kenney.nl/assets/sports-pack (CC0, 380 asset)
- Kenney Game Icons — https://kenney.nl/assets/game-icons (CC0, 105 asset)
- Kenney Audio kategorisi — https://kenney.nl/assets/category:Audio
- game-icons.net hakkında — https://game-icons.net/about.html (CC BY 3.0)
- OpenGameArt Basic Soccer Pack — https://opengameart.org/content/basic-soccer-pack (CC0)
- OpenGameArt Football Pack — https://opengameart.org/content/football-pack (CC0)
- OpenGameArt Soccer Ball Animation — https://opengameart.org/content/soccer-ball-animation-sprites-and-3d-texture (CC0)
- itch.io Football Soccer Game Asset — https://pablogamedev.itch.io/football-soccer
- itch.io 2D Soccer — https://davidevitali.itch.io/2d-soccer (lisans yok)
- Freesound CC0 stadyum araması — https://freesound.org/search/?q=stadium+crowd&f=license%3A%22Creative+Commons+0%22
- Sonniss GDC lisans özeti — https://gamefromscratch.com/sonniss-27-5gb-sound-effect-giveaway-at-gdc-2024/
- Incompetech ve Pixabay lisans özetleri — https://app.cinevva.com/guides/free-sound-effects-music
- Lucide lisansı — https://lucide.dev/license
- Tabler Icons — https://npmjs.com/package/@tabler/icons
- phaser3-rex-plugins — https://www.jsdelivr.com/package/npm/phaser3-rex-plugins (MIT)
- Phaser DOM/canvas karışımı tartışması — https://phaser.discourse.group/t/is-mixing-dom-render-and-phaser-canvas-render-okay/11384
- facesjs — https://github.com/zengm-games/facesjs (Apache-2.0)
- DiceBear lisans yapısı — https://dicebear.com/why-dicebear , https://npmjs.com/package/@dicebear/lorelei
- Barlow Condensed / Rajdhani OFL — https://www.1001fonts.com/barlow-condensed-font.html , https://www.fontsquirrel.com/fonts/rajdhani
- EA FC 24 kart tasarımı — https://www.ggrecon.com/guides/easfc-24-card-design/
- Top Eleven UX yeniden tasarım (GDC) — https://gdcvault.com/play/1020424/UX-Redesign-Creating-a-Consistent
- Retro Goal — https://www.newstargames.com/retro-goal
- Golf Clash UX analizi — https://gameanalytics.com/?p=8036
