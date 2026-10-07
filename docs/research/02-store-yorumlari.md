# New Star Soccer: Mağaza Yorumları ve Topluluk Geri Bildirimi Araştırması

> Hazırlanma tarihi: 7 Ekim 2026
> Kapsam: New Star Soccer (NSS) mobil, NSS 5 (PC/Steam) ve kardeş oyunlar (New Star Manager, Retro Goal, Retro Bowl, New Star Cricket, New Star Baseball, New Star GP, Retro Slam Tennis, NSS G-Story)
> Amaç: Ruhani bir devam oyunu (spiritual successor) yapacak ekip için "oyuncular neyi sevdi, neyden nefret etti, ne istedi" sorularına somut, alıntılı yanıt vermek.

## Yöntem ve veri seti

| Kaynak | Ne toplandı | Hacim |
|---|---|---|
| Google Play (NSS, `com.newstargames.newstarsoccer`) | 1-5 yıldız filtreli, "en alakalı" ve "en yeni" sıralı yorumlar (2018-2026), beğeni (thumbs-up) sayılarıyla | ~565 benzersiz yorum, 440'ı 70 karakterden uzun |
| Google Play (kardeş oyunlar) | New Star Manager, Retro Goal, Retro Bowl, Cricket, Baseball, GP, Tennis, G-Story | Oyun başına 85-195 yorum |
| Google Play meta verisi | Puan, oy sayısı, kurulum, çıkış tarihi, IAP fiyat aralığı, reklam | 11 uygulama |
| App Store (iOS) RSS | AU, CA, IE, IN, ZA mağazaları | ~224 benzersiz yorum (v1.61-v2.32) |
| Steam (NSS 5, app 212780) | En faydalı olumlu ve olumsuz İngilizce yorumlar | 200 yorum, en çok oylananlar okundu |
| Basın ve wiki | Pocket Gamer, PocketGamer.biz, TouchArcade, Wikipedia, New Star Games blog, AppGoblin | Kaynak listesinde |

Notlar:
- Reddit (r/NewStarSoccer) bu ortamdan erişilemedi (reddit JSON sayfası engellendi, arama motoru da Reddit sonucu döndürmedi). Topluluk sesi ağırlıklı olarak mağaza ve Steam yorumlarından geliyor. Reddit taraması bir sonraki adımda tarayıcıyla yapılmalı.
- Alıntılar orijinal dilde (çoğunlukla İngilizce), kısaltılarak verildi. Parantez içindeki sayı Google Play'deki "faydalı" oyu, yanındaki tarih yorum tarihi.
- Kaynak türü kısaltmaları: **[GP]** Google Play, **[AS]** App Store, **[Steam]** Steam, **[Basın]** inceleme veya haber, **[Geliştirici]** New Star Games açıklaması.

---

## 1. Oyunun genel bilgisi

### 1.1 Sürüm geçmişi

| Sürüm | Yıl | Platform | Özellik |
|---|---|---|---|
| NSS 1 | 2003 | PC (Windows) | Metin anlatımlı maç (text commentary), freeware |
| NSS 2 | 2004 | PC | Metin anlatımlı maç |
| NSS 3 | 2005 | PC | 2D grafik, klavye/joystick kontrolü. GameTunnel "Yılın Spor Oyunu", PC Zone "Ayın Indie Oyunu" |
| NSS 4 | 7 Kasım 2008 | PC, Mac | 3D grafik, 360° kontrol. GameTunnel "Yılın Spor Oyunu" |
| NSS 5 | Ağustos 2011 (Steam: 27 Eylül 2012) | PC, Mac | F2P + çevrimiçi hesap sistemiyle çıktı, sonra Steam'de ücretli. Mobilden PC'ye "port" gibi algılandı |
| **NSS (mobil)** | 6 Mart 2012 (Android), Mart 2012 (iOS) | iOS, Android, Windows Phone | Maçın yalnızca kilit anlarını oynatan sistem + kariyer. **2013 BAFTA En İyi Spor/Fitness Oyunu**. App Store'da 1 numara oldu |
| NSS G-Story | 26 Mayıs 2016 | iOS, Android | Hachette ile, "kendi maceranı seç" tarzı hikâye. 0,99 $, 18 bölüm. Ticari olarak zayıf kaldı (GP 2,67★) |
| NSS mobil "modern" güncellemesi | ~2018-2019 | Mobil | "Modern" ve "Classic" görsel seçenekleri. Classic'i tercih eden çok oyuncu var |
| 2024 büyük güncelleme | Ocak 2024 | Mobil | Yeni grafik/arayüz, kadın futbolu, ek yaşam tarzı eşyaları, ön maç istatistikleri, sonradan "Hard mode". Bazı eski oyuncular sadeliğin kaybolduğunu söyledi |
| v2.32 (son sürüm) | 5 Aralık 2025 | Mobil | 2025/26 lig verisi düzeltmeleri, Avrupa kupası fikstür hataları düzeltmesi |

**Kardeş oyunlar (New Star Games / New Star Publishing / Five Aces):**

| Oyun | Çıkış (Android) | GP Puanı | GP oy sayısı | Tahmini kurulum* | Model |
|---|---|---|---|---|---|
| **New Star Soccer** | 6 Mart 2012 | **4,43** | **~2,33 milyon** | "10M+" etiketi, tahmini ~33M | F2P + IAP (0,99-46,99 $) + reklam |
| New Star Manager | 30 Ağu 2018 | 4,48 | - | ~7,4M | F2P + IAP (1,49-64,99 $) + reklam. Pocket Gamer 10/10 |
| Retro Bowl | 17 Oca 2020 | 4,59 | ~512 bin | ~10M | 1 kerelik "Unlimited" + coin, **reklamsız** |
| Retro Bowl College | 18 Eyl 2023 | 4,85 | ~9,9 bin | ~2,1M | Reklamsız, IAP |
| Retro Goal | 9 Tem 2021 | 4,00 | ~36,7 bin | ~4,5M | Önce "10 maç ücretsiz, sonra ~1-2 $", Şubat 2023'te F2P + reklamsız + opsiyonel Unlimited |
| New Star Cricket | 23 Kas 2016 | 3,69 | - | ~670 bin | F2P + IAP + reklam |
| New Star Baseball | 11 Ara 2020 | 3,86 | ~5,5 bin | ~590 bin | F2P + IAP (0,99-42,99 $) + reklam |
| New Star GP | 12 Mar 2025 | 3,79 | ~2 bin | ~377 bin | F2P + IAP + reklam (PC'de ücretli) |
| Retro Slam Tennis | 24 Şub 2025 | 2,91 | ~1,2 bin | ~200 bin | IAP yok, reklam yok |
| NSS G-Story | 27 May 2016 | 2,67 | - | ~17 bin | Ücretli/bölüm |

\* "Tahmini kurulum" google-play-scraper'ın döndürdüğü `realInstalls` değeri. Google'ın resmi etiketi alt sınır gösterir (ör. "10.000.000+").

Wikipedia'ya göre NSS serisi 10 milyon, diğer New Star spin-off'ları toplam 3 milyon indirmeye ulaşmıştı (eski veri; güncel tahminler bunun çok üstünde).

### 1.2 Puanlar ve yoğunluk

- **Google Play (NSS):** 4,43★, 2.328.772 oy, 40.812 yazılı yorum. Dağılım: 5★ %69,7 · 4★ %16,2 · 3★ %6,3 · 2★ %2,9 · 1★ %5,0. Puan yüksek ama yazılı yorumlarda (özellikle uzun ve çok beğeni alanlarda) ton çok daha olumsuz.
- **App Store (NSS, ABD):** 4,8★ (~23 bin oy). AppGoblin'e göre tüm mağazalarda ~338 bin oy, ortalama 4,75★, aylık ~561 bin aktif kullanıcı, gelirin ~%77'si reklam, ~%23'ü IAP (üçüncü taraf tahmini).
- **Steam (NSS 5):** "Mostly Positive", 884 yorumun %70'i olumlu (622 olumlu / 262 olumsuz). Fiyat ~5,79 $ (bölgeye göre değişir; eski yorumlarda 9,99 £ / 11,99 €). Olumsuz yorumların ana teması: DRM, kapanan sunucular, çökmeler ("exception access violation"), kötü kontrol ve AI.
- **Basın:** Pocket Gamer 4,5/5 ("Few games are able to worm their way into your imagination and subconscious as well as New Star Soccer"). The Sun 5/5 ("A pristine game"). Kotaku: "The perfect marriage of quick play phone game, football management, sim and RPG". Operation Sports (NSS5) 8,5/10: "just one more turn".

> **Önemli bulgu (puan şişmesi):** App Store'daki 5 yıldızlı kısa yorumların büyük kısmı açıkça oyun içi ödül için yazılmış: "I just want my 10 stars", "Give me my 10 star bucks", "If I write this I get 10 coins", "Just doing it for cash". Oyun yorum karşılığında 10 Bux veriyor gibi görünüyor. Bu, 4,8★'lık iOS puanının gerçek memnuniyeti olduğundan yüksek gösterdiğini düşündürüyor. Ayrıca Apple ve Google'ın teşvikli yorum kurallarıyla da çelişebilir. **Bizim oyunumuzda yapılmamalı.**

### 1.3 Fiyatlandırma ve IAP modeli (zaman çizelgesi)

1. **2012:** Mobilde ücretsiz sürüm + ücretli "Pro License" (reklam kaldırma ve tam özellikler). Android'de bir dönem tamamen ücretli.
2. **Kasım 2013:** Android sürümü F2P'ye çevrildi. Daha önce ödeyenlere Pro License + hava/saha paketi verildi. Ancak eski sürümü silenlerin satın alımı tanınmadı. Yorumlar: *"I already paid for this thing, so why on earth is it now following a freemium strategy..."* [Basın: PocketGamer.biz]
3. **2018-2019:** Ogury reklam SDK'sı ve "kişiselleştirilmiş reklam" onay penceresi. "Reddet" denince pencere butonları yer değiştirmiş olarak yeniden çıktı (dark pattern). Bu dönemde çok sayıda 1★ yorum geldi.
4. **2019-2026:** Her maçtan sonra (ve çoğu zaman antrenmandan sonra) atlanamayan 15-80 saniyelik zorunlu reklamlar. Ödüllü reklamlar enerji ve coin veriyor. Reklam kaldırma ~3 £ / 3,99 $.

**Para birimi ve tüketim döngüsü (oyuncu gözünden):**

- **Bux / Star Bux (oyun içi para, "coins")**: Maç ücreti, sponsor, kumarhane ve at yarışıyla kazanılıyor. Gerçek parayla da satılıyor (paketler 46,99 $'a kadar).
- **NRG (enerji içeceği)**: Her maç, antrenman ve ilişki mini oyunu enerji harcıyor. Enerji zamanla dolmuyor. Maç oynamak, ev sahibi olmak veya NRG içmek gerekiyor. **NRG fiyatı yıldız seviyesi veya maaşla birlikte artıyor** (2 → 4 → 5 → 8 → 11 coin...). Bu, en çok şikâyet edilen tasarım kararı.
- **Ajan / Antrenör / Krampon**: Ücretsiz sürümde yalnızca "amatör" seviye. Pro ve Expert seviyeleri gerçek parayla (1,99-3,99 $) satılıyor ve **150 maç sonra bitiyor** (tüketilebilir). Bu süre satın alırken belirtilmiyor (oyuncu şikâyeti).
- **NRG Bolt** (0,99 $), **NS SWRV v2** krampon (2,99 $) gibi ürünler var.
- **Yaşam tarzı eşyaları** (ev, araba, heykel, at ahırı...) zamanla eskiyor ve bakım istiyor.
- Ödüllü reklam günde sınırlı ve bazen ödül vermiyor ("only give rewards about 30% of the time").

---

## 2. Kullanıcıların sevdiği şeyler (48 madde)

### Çekirdek döngü ve his
1. **"Bir maç daha" bağımlılığı.** En sık geçen kelime "addictive". *"I blew up my midterms by playing this game"* [AS], *"Kept me playing for hours!"* [AS], *"just one more turn"* [Basın: Operation Sports].
2. **Kısa ve parçalı oturumlar.** Maç 30-60 saniyede bitiyor. *"Great game to play for a minute or an hour. I love that I don't have to keep up with a whole game and team, just drops you in the moment to make a play."* [GP]
3. **Yalnızca kilit anları oynatmak (highlight sistemi).** Gerilimi yoğunlaştırıyor. *"I loved the matches where you only had a few chances and the feeling of responsibility this situations came with."* [GP]
4. **Sonlara doğru gerilim.** *"The tension is savage near the end of the game."* [AS]
5. **Tek oyuncunun kariyerine odaklanmak** (takım değil, "ben"). *"lack of players name make your character be the focus point."* [GP]
6. **16 yaşındaki zayıf bir gençten dünya yıldızına yükselme fantezisi.** *"feels like you are starting at the bottom, and improving with every game & practise session."* [GP]
7. **Saha dışı yaşamın da oyunun parçası olması.** *"I like how you have a life outside of just playing soccer."* [GP], *"It shows the life of a true soccer player."* [AS]
8. **İlişki dengesi mekaniği** (patron, takım, taraftar, sponsor, kız arkadaş). *"The whole sponsers and team relationship balance is a great mechanic."* [AS]
9. **Seçimlerin sonuçları olması.** *"not perform you get benched or reserved every choice on and off the pitch has concequences."* [GP]
10. **Mizahi tabloid gazete manşetleri** (kötü giyim, kumar skandalları). *"Went to the casino once, and the tabloids kept calling me a gambling addict... 10/10 realism"* [Steam]; Pocket Gamer da tabloid mizahını övdü [Basın].
11. **Biraz "hayat dersi" veren ton.** *"It actually teaches you to not gamble away your money and how to handle yourself in front of the press."* [GP]

### Kontrol ve oynanış
12. **Basit, öğrenmesi kolay dokunmatik kontroller.** Sürükle ve vur ile falso ve güç veriliyor. *"Aiming mechanics are easy to pick up and make sense."* [GP]
13. **Ustalaşma derinliği.** *"easy to jump right on and play, yet takes awhile to truly 'master' the game."* [GP]
14. **Topa falso ve yükseklik vermek.** *"adding spin or lift to the ball is an excellent touch and keeps the game fresh."* [GP]
15. **Çalım (dribbling) anları.** *"I love dribbling in this game."* [GP]
16. **Kafa vuruşları ve ortalar** (2012 güncellemesiyle eklendi, çoğu oyuncu sevdi). *"I also enjoy the addition of the headers."* [GP]
17. **Kaptanlık sistemi.** Kaptan olunca daha fazla fırsat geliyor ve dönen toplar takip ediliyor. *"Becoming captain is a great feature."* [GP]
18. **"Zor ama adil" ilk sezonlar.** *"It's nice because it's not so easy."* [AS]
19. **Hard mode** (2024+) gerçek bir meydan okuma. *"the hard mode is an actual challenge in comparison to the normal mode."* [GP]
20. **Mini oyunlar** (röportaj, sözleşme pazarlığı, ilişki eşleştirme). *"the mini games are great."* [GP]

### İçerik ve kapsam
21. **Dünyanın neredeyse her ligi ve alt ligi.** *"Almost every league from all over the globe with their respective divisions."* [GP]
22. **Herhangi bir milletten oyuncu ve milli takım kariyeri.** *"a lot of options to choose for the country."* [GP]
23. **Kadın futbolu seçeneği** (2024). *"I appreciate that the developers have added women's football."* [GP]
24. **Dünya çapında lig ve liderlik tablosu** [GP, Steam].
25. **Yerel küçük kulüplerle başlayabilmek.** *"It has all the teams, fun to play for local uk clubs."* [GP]
26. **Uzun vadeli hedefler.** Başarımların hepsini almak için 20 yıllık kariyer gerekiyor. *"to max out the game with achievements you have to play at least for 20 years... makes it even more addictive."* [GP]
27. **Kumarhane ve at yarışı gibi yan aktiviteler** çeşitlilik katıyor. *"the casino part just makes it unique."* [AS]. At ahırı stratejisi topluluk "pro-tip"i hâline geldi.
28. **Lüks eşya ve mülk satın alma** (ev, araba, ahır). *"I can build and grow my dude (like buying property and race horses and his skills)."* [GP]

### Teknik ve iş modeli artıları
29. **Tamamen çevrimdışı oynanabilmesi.** En çok övülen artılardan biri. *"Great OFFLINE game... You can play it without an Internet connection so you're not bombarded with adverts."* [GP]
30. **Düşük donanım ve az veri isteği** (internetin kısıtlı olduğu bölgelerde de oynanması). *"I was born in Africa and internet was limited so this offline game brings back some nostalgia."* [AS]
31. **Sık otomatik kayıt** (PC). *"the game saves often enough that you rarely lose significant progress."* [Steam]
32. **Ödeme yapmadan da ilerlenebildiğini savunanlar var.** *"I haven't [paid] and have won 3 World Player of the Year awards at 23 years old."* [GP]
33. **Reklam kaldırma fiyatı adil bulunuyor** (yaklaşık 3 £). *"£3 to stop interstitial ads which I think is very fair."* [GP]
34. **Classic görünüm seçeneğinin korunması.** *"Glad they give the option of new and old."* [GP]
35. **Retro ve sade görsel stil** (Sensible Soccer ve SNES nostaljisi). *"the controls feel like those old SNES soccer games that we loved."* [Steam]

### Nostalji ve sadakat
36. **10-14 yıl sonra bile geri dönülen oyun.** *"been playing since 2013 when i was 11 years old and now i'm 24."* [GP]
37. **Her yeni telefona yüklenmesi.** *"Downloaded it to every phone I've had."* [GP]
38. **PC, flash ve mobil serisinin kuşaklar boyu bilinmesi** (Miniclip ve Mousebreaker flash dönemi). *"I used to play this game on the various flash game websites, and loved it."* [GP]
39. **"Sevgiyle yapılmış" hissi** (tek geliştirici imzası). *"This is a labour of love, and it shows!"* [GP]
40. **Geliştiricinin bireysel destek vermesi.** *"When it broke on me for a few months I reached out to the developers on a whim and they fixed it within days."* [GP]
41. **Rakiplerden üstün bulunması** (Score! Hero ve FIFA ile kıyas). *"Better than Score hero"* [AS], *"probably better than score hero by a mile"* [GP], *"like I'm playing FIFA career on my phone."* [GP]
42. **Futbolla ilgilenmeyenlerin de sevmesi.** *"This game is great even if ur not fond of soccer."* [AS], *"I'm not even a soccer/football fan."* [GP]
43. **Rakipsiz niş.** *"One of a kind soccer game with no real competitor in this field. FIFA and PES... are lacking when it comes to a career mode like in NSS."* [Steam]
44. **Ruh sağlığı ve kaçış.** *"this game helps me lock out of the world whilst im struggling with things."* [GP]
45. **Sesler ve geliştirme sistemi** (eski sürümler). *"The upgrading system and sound were great too."* [GP]

### Kardeş oyunlarda övülenler (bizim için ders)
46. **New Star Manager: NSS mekaniğini takım yönetimine taşıması.** *"New Star Manager takes the frame of the original game, and builds something utterly wonderful on top of it"* [Basın: Pocket Gamer 10/10]. Kart sistemi (enerji, gelişim, sözleşme kartları) sevildi.
47. **Retro Bowl: reklamsız, tek seferlik satın alma.** *"No ads, and nags to pay money are minimal... No countdown/reward timers requiring constant life interruptions."* [GP] Oyuncular NSS'yi bununla kıyaslıyor: *"RETRO BOWL should be the standard for sports apps."* [GP, NSS yorumu]
48. **Retro Goal: Commodore 64 / 16-bit estetiği ve basit transfer pazarı.** *"Love the tactics and transfer market."* [GP]

---

## 3. Şikayetler ve kötü bulunan şeyler (52 madde)

### A. Ekonomi, enerji ve IAP (en büyük şikâyet kümesi)
1. **NRG fiyatının maaş veya yıldız seviyesiyle birlikte artması.** Açık ara 1 numaralı şikâyet. *"Boss raised my wage from 1 to 2 per match and immediately the energy drink's price went up from 4 to 8."* [GP 2026], *"nine or ten seasons in, NRG costs more than a house."* [GP], *"Halfway through the first season, a can of NRG cost more than your house."* (186 oy) [GP]
2. **Enerjinin zamanla dolmaması.** *"energy doesn't build up if you allow the game to 'rest' even over a 2 day period."* [GP], *"There should be a way of recharging energy over time, or have a sleep option."* [GP]
3. **Maç kazancının NRG'yi bile karşılamaması.** *"You get 1 coin per match and it takes 8 coins to 'buy' energy."* (112 oy) [GP], *"what player scores 40 goals in a season and gets paid 3 coins..."* [GP]
4. **"Daha iyi sözleşme" anlamsızlaşıyor**, çünkü her şey ona göre pahalanıyor. *"what's the point of getting better contracts when nrg costs more than you get from contracts."* [GP]
5. **Antrenman, ilişki ve maç aynı enerji havuzunu paylaşıyor.** *"you do not have enough energy to keep skills, training and relationships satisfied."* [GP]
6. **Pay-to-win / pay-to-play algısı.** *"Pay to play game, not to win just to play."* [GP], *"The game set you up to fail and pay to win!"* (95 oy) [GP]
7. **Ajan, antrenör ve kramponların 150 maç sonra bitmesi ve bunun önceden belirtilmemesi.** *"At no point does it say the trainer will only last 150 games."* [GP], *"purchased the 3 star agent for 2.99 which apparently only lasts for 150 games! Absolute rip off!"* [GP]
8. **En iyi ekipmanın sadece gerçek parayla alınabilmesi.** *"you only have access to amateur trainer or agent. You have to spend money on the game to stop that!"* [GP]
9. **Önceden oyun içi parayla alınan eşyaların gerçek paraya taşınması.** *"The fact that you moved items that were available with in-game currency to real money is bad."* [GP 2026]
10. **Ücretli oyunun F2P'ye çevrilmesi ve eski alımların tanınmaması.** *"I paid for this game and then it was changed into a freeium game."* [AS], *"no chance to restore my previous purchases."* [GP], *"Why does my original purchase mean nothing?"* [GP]
11. **Reklamı kaldırmak için ödeyince ödüllü reklam seçeneğinin de gitmesi.** *"since I bought the no-ads pack, I don't have the option anymore to gladly watch special ads in order to gain some more coins."* [GP]
12. **Para birimi simgelerinin kaldırılması ve yanıltıcı ödeme ekranları** (iddia). *"sneaky pay walls... (all currency symbols are removed to purposefully mislead users into paying money)."* [GP]
13. **Yaşam tarzı eşyalarının bozulması ve bakım istemesi.** *"why the heck would an 'art sculpture' degrade and cost money to keep up??"* [GP]
14. **Satın alınan Bux'ın hesaba geçmemesi.** *"I bought the 80 dollar for the star bucks took the money off my card and now it didn't load in."* [AS]

### B. Reklamlar ve gizlilik
15. **Her maçtan, antrenmandan ve menüden sonra atlanamayan reklam.** Son yıllarda en sık 1-2★ sebebi. *"'Your content will resume in 80 seconds...'... one spends more time looking at ads than actually playing."* (63 oy) [GP], *"Ads or Microtransactions, not both."* [GP 2026]
16. **Reklamın maç ortasında çıkıp oyunu duraklatmaması.** *"ads popup while you're playing and when they do it doesn't pause the game. So you finish the advert and then find out you failed your skill challenge."* [GP]
17. **Reklam kaldırma satın alındıktan sonra bile reklam çıkması** (çapraz tanıtım ve Football Manager reklamı). *"Why have I paid for no ads for it to now start spamming me everytime I touch the screen with a football manager ad?"* [GP 2026]
18. **Ödüllü reklamın ödül vermemesi veya çökmesi.** *"After choosing to see an ad to have energy drink, i end up wasting 30 seconds of watching without getting the drink."* [GP], *"it crashes on me constantly before, during and after ads."* (186 oy) [GP]
19. **Ogury onay penceresindeki dark pattern (2019).** *"saying refuse... brings up another message with the refuse button swapped with the agree. Not only is this immoral, it is illegal in the eu."* [GP]
20. **İzinsiz uygulama yükleyen reklam ve kaybolan kayıt.** *"one ad force downloaded an app 'xperia home screen'... In doing so it also lost the save file."* (233 oy) [GP]
21. **İzin vermediği hâlde veri paylaşımı e-postası alma** [GP].

### C. Maç içi oynanış ve AI
22. **Takım arkadaşı AI'sının yavaşlığı ve topa gitmemesi.** En sık geçen oynanış şikâyeti. *"They move at 1mph and can't receive any of my passes."* [GP], *"It's like they have steel balls around their ankles."* [GP], *"players that have as much vision as a 15 year old labrador with cataracts."* [Steam]
23. **Paslarda milimetrik hassasiyet zorunluluğu.** *"you have to pass the ball EXACTLY to their feet, otherwise they cannot take a touch."* [GP]
24. **Pas başarılı olduğu hâlde "başarısız" sayılması.** *"Just had a pass dropped by my teammate fall to another teammate who collected it and it still said it was a failed pass."* [GP]
25. **Ortalarda yan kamera ile ana kamera görüntüsünün uyuşmaması.** *"when it switches to the main view, it's not a few steps behind him and he misses it. Impossible to be precise when the views don't match."* (174 oy) [GP]
26. **İmkânsız fırsatların verilmesi** (23 metreden kafa, 7 savunmacının arasına orta). *"they give me heading opportunities when I can't pass to anyone and I'm like 23 metres away."* [AS], *"all the plays you get are either impossible crosses or Headers."* [GP]
27. **Rüzgârın tutarsız ve aşırı etkili olması.** *"please, get rid of the damn wind!"* [GP], *"sometimes 1 wind is stronger than 4."* [GP]
28. **Topa vuruşta tutarsız fizik ve gücün göreceli olması.** *"The force arrow when kicking isn't the actual force but the force relative to what the program thinks you are aiming at."* [GP], *"How can a header bend more than a kick?"* [GP]
29. **Kalecilerin tutarsızlığı.** *"They either stop impossible shots, or the ball virtually goes through them."* [GP]
30. **Ofsayt hataları.** *"There is a BUG when checking if a teammate is in offside."* [GP 2026], ofsayt çizgisinin bazen görünüp bazen görünmemesi [GP].
31. **Direkten içeri giren golün sayılmaması.** *"it hit the post and the back of the net but still said I missed??"* [GP]
32. **Rakiplerin top size gelmeden 3-0, 4-0 öne geçmesi.** *"the bottom teams will go 4-0 up before you can even touch the ball."* [GP]
33. **Lig ve takım gücü farkının olmaması.** *"Norwich will play as well as Man U if they are both in the Premiership."* (269 oy) [GP], *"you can easily beat a premier League team with a bottom league team."* (295 oy) [GP]
34. **Savunma rolünün olmaması** ("intercept the pass" mini oyunu kaldırıldı). *"I also miss the 'intercept the pass' minigame, which was the only defensive action available."* [GP]
35. **Oyun hızının artırılması ve top hızı** (2026 güncellemesi). *"the game is overly sped up now and trying to click on the ball fast enough is stressing me out."* [GP]

### D. Puanlama, ilişkiler ve "her şeyin suçlusu sensin" hissi
36. **Maç reytinginin anlamsız olması.** *"a goal and 2 assists on 5 chances is a 5.6 rating."* [GP], *"score a winning goal... get a 5.8 rating for missing one pass."* [GP], *"completely broken match rating system."* [Steam]
37. **İyi oynasan da takım ve patron ilişkisinin düşmesi.** *"you can get 3 goals and 2 assists and your teammates relationship will go down."* [GP], *"they blame everything on you even if you had a hat trick but your team lost 5-3."* [GP]
38. **İlişkiler arasında sıfır toplamlı ikilemler** (birini seçince öbürü çok düşüyor). *"The fan bar goes up a bit, the coach relationship goes down way more. That then costs you in game money to repair."* [GP]
39. **Kötü bir röportajın mükemmel bir maçı silmesi.** *"A bad interview can almost completely wipe out a perfect game."* [GP]
40. **Patron ilişkisinin performanstan bağımsız kadro kararı vermesi.** *"if I'm playing well there's no reason I should be a sub because I upset him."* [GP]
41. **Sözleşme pazarlığının şansa dayalı "yüksek/alçak" kart oyunu olması.** *"negotiating a contract with a 'high-low' card game?!"* [GP], *"If you lose, relationship with boss goes down a lot."* [GP]
42. **Kız arkadaş ve mutluluk sisteminin zorunlu ama anlamsız olması.** *"It's ridiculous that I need to have a gf to be happy."* [GP], *"Girlfriend is for happiness, but happiness is for what?"* [GP], *"please make girlfriend not mandatory."* [GP]
43. **Rastgele olumsuz olayların (beceri kaybı, rüşvet, kumar skandalı) ilerlemeyi geri alması.** *"Feels like things happen solely to slow down your progress."* [GP], rüşvet olayı bir Dünya Kupası kariyerini mahvetti: *"Bribe is the worst feature in this game."* [GP 2026]
44. **Becerilerin hızlı ve rastgele düşmesi** (antrenmandan hemen sonra bile). *"i trained vision and before the next game it declines."* [GP]
45. **Milli takıma çağrılmanın ve kaptanlığın aşırı zor olması.** *"after 50 straight MOTM i still havent impressed my international coach?"* [GP]
46. **Bireysel ödüllerin mantıksız olması.** *"I scored 65 goals in 65 games... still didn't end up winning player of the season."* [GP], *"if I score 70 goals and 100 assists, and win the quadruple, why am I not getting a Ballon D'or?"* [GP]

### E. Zorluk, tekrar ve ilerleme dengesi
47. **Normal mod aşırı kolay, istatistikler gerçek dışı.** *"I scored 500+ goals in one season."* [GP], *"Normal mode is comically easy, hard mode is a recipe for infernal rage."* [GP]
48. **Birkaç sezon sonra tekrara düşmesi ve "her şeyi aldım, şimdi ne?" hissi.** *"Eventually it's a boring routine: Play the match, buy energy, train, & repeat."* (98 oy) [GP], *"it gets boring once you've bought everything. End up with 40 horses which take ages to race."* [GP]
49. **Transferlerin gerçek dışı derecede kolay ve sınırsız olması.** *"I went from non-league in England to PSG after season 1."* [GP], *"Should be more than one team impressed with your trial."* (30-40 kez deneme yapmak gerekiyor) [GP]
50. **Sezon ortası transferlerin yalnızca aynı ligle sınırlı olması** ve teklif gelmemesi [GP].
51. **At yarışı ekonomisinin futbolu gölgede bırakması.** *"I make 10x as much money every other game from racing my 15 horses as I do from soccer games."* [GP]

### F. Teknik hatalar, kayıt ve destek
52. **Bulut kaydının olmaması ve telefon değişince kariyerin kaybolması.** *"you cant connect any kind of account to save your progress."* [GP], *"can't restore my career even though I signed in with google + ! On year 14."* [GP]
53. **Avrupa Şampiyonası çeyrek finali ve Avrupa kupası fikstür hataları** (sezonun erken bitmesi, maçın oyuncu olmadan oynanması). *"spent 2 seasons to qualify for the euros with Faroe islands... then the season ends and it plays the game without me."* [GP]
54. **Çökme ve donma** (maç sonu, reklam sonrası, kulüp değiştirirken). *"it freezes just after a match so I have to restart."* [AS], *"any time it try to change clubs at the end of the season the game automatically shuts down."* [GP]
55. **NSS5 (PC) için özel sorunlar:** DRM (çevrimdışı oynanamıyor), kapatılan sunucular, "exception access violation" çökmesi ve kayıt bozulması, terk edilmiş olması. *"THIS GAME USES DRM OF THE WORST KIND."* (89 oy) [Steam], *"This is now a dead game - their server is turned off."* [Steam], *"it's 2024 and still 'exception access violation' error is crashing game in every 3 games."* [Steam]
56. **Güncel olmayan kadrolar, terfi ve küme düşmeler.** *"wolves and Aston villa are still in the championship."* [GP], *"there are only 22 teams in the mls."* [GP]
57. **Kadın liglerinde yanlış zamir ve sakallı sprite'lar.** *"the commentary kept referring to the players as 'he' instead of 'she'."* [GP], *"Quite a few players in the women's leagues have beards."* [GP]
58. **Okunması zor font, eski ve çirkin bulunan arayüz** (hem classic hem modern). *"The UI (both classic and modern) is also ugly, outdated and uninterested in conveying useful information easily."* [GP]
59. **2024 grafik güncellemesinin sadeliği bozması.** *"The game looks way worse. The simplicity is gone."* (142 oy, 1★) [GP]
60. **Yıllarca anlamlı güncelleme gelmemesi.** *"Literally no improvement whatsoever has been made in like the past 3 years."* [GP], *"Is this game going to be like this forever no concrete update?"* [GP 2026]
61. **Yeni başlayanlar için karmaşık ve yetersiz tutorial.** *"A bit too many features for a beginner."* [AS], *"the intro was very vague."* [GP]

---

## 4. İstenen / eklenmesi talep edilen özellikler (50 madde)

### Pozisyon, karakter ve kimlik
1. **Pozisyon seçimi** (ST, RW, CMF, CB, LB...). En çok istenen özellik. *"PLEASE add player positions when starting a career like left back, right midfielder, goalkeeper etc."* (222 oy) [GP], (344 oy) [GP]
2. **Kaleci kariyeri.** *"adding a Goalkeeper career would be great... swipe left to dive right... easy medium hard mode."* (**516 oy**, en çok beğenilen yorum) [GP]
3. **Savunma rolü ve top kapma mekaniği** (New Star Manager ve Retro Goal'daki tackle). *"I think you should add the tackling mechanism from new star manager."* (297 oy) [GP]
4. **Pozisyona özel fırsat türleri.** *"strikers get more forward chances... wide player gets more crossing chances, midfielders get deeper chances..."* [GP]
5. **Oyuncunun sahada görünmesi** (görünmez "parmak" değil). *"we need to customize our own character and see the player, not the finger do all the work."* [GP 2026]
6. **Karakter özelleştirme** (görünüm, forma numarası, isim uzunluğu). *"create our own pixel characters with a shirt number we could pick."* [GP]
7. **Oyuncunun kendisini kontrol edebilmesi** (koşu, dönen topa gitme, NSM'deki gibi topla koşma). *"enable the created player to run with the ball just as new star manager."* [GP]

### Zorluk ve denge
8. **Zorluk seviyesi seçimi** (kolay, normal, zor; iOS'ta da). *"please add a difficulty setting on IOS!!"* [AS], *"you can create an option where we choose the level we want."* [GP]
9. **Enerjinin zamanla dolması, uyku veya dinlenme.** *"I would like to see implemented is a way for the energy to slowly get back up to 100% while we are not playing."* [GP]
10. **Sabit NRG fiyatı veya fiyat tavanı.** *"maybe an upper limit on price?"* [GP], *"Should stay at 2 coins."* [GP]
11. **Antrenmanın daha az enerji harcaması.** *"Maybe like one quarter of the bar."* [GP]
12. **Yaşa göre enerji ve gelişim eğrisi.** *"the older one gets, the lesser they lose the energy."* [GP]
13. **Performansa bağlı maaş ve prim** (gol ve asist bonusu). *"increase the amount you get paid judging by how good you've been for your team."* [GP]
14. **Günlük ödül ve başarım ödülleri.** *"if there was a daily reward."* [GP], *"add rewards for some difficult achievement, i.e: historical castle, vintage vehicles."* [GP]
15. **Daha zorlu kaleciler ve lig gücüne göre rakip kalitesi.** *"teams should be ranked based on size, money, reputation so that league tables and game results are more realistic."* [GP]
16. **İlişki ve beceri kayıplarının daha yumuşak olması**, özellikle kariyerin başında [GP].
17. **Bir kerelik "premium" satın alma** (reklamsız, enerji ve fiyat baskısı olmadan). *"Honestly this is a game I'd pay $10 for."* [GP], *"Either make it a paid game or remove the pay to play aspect."* [GP], *"Should have a paid version."* [GP 2026]
18. **Reklam sıklığının azaltılması** (örneğin 3 maçta bir), atlanabilir reklam. *"At least make the ads pop up after every third match."* [GP]
19. **Maçı simüle etme veya hızlı geçme seçeneği.** *"The simple ability to sim a game rather than play."* [GP]
20. **Maç hızı ve süre ayarı.** *"No option to make a match longer."* [Steam], *"don't mind an option to speed it up but... prefer normal pace."* [GP]

### Transfer, kulüp ve kariyer gerçekçiliği
21. **Gerçekçi transfer: sadece ilgilenen kulüplerden teklif.** *"there should be transfer offers from other clubs with an option to only transfer to a club that's interested rather than every club."* (177 oy) [GP]
22. **Transfer talebi ve listeye konma.** *"include transfer requests... it could upset the boss, team and fans but increase the chances of moving to a bigger club."* [GP]
23. **Kiralık (loan) sistemi.** *"Be able to go out on loan."* [GP]
24. **Ligler arası sezon ortası transfer.** *"Foreign teams could buy you in the winter."* [GP]
25. **Ülkeye ve lige göre farklı transfer mantığı ve maaş seviyeleri.** *"English teams [look at] your last season, Chinese pays attention for goals... The richest teams give you higher wage."* [GP]
26. **Bonservis bedelini ve imza parasını görmek.** *"knowing what your transfer fee paid was would be great."* [GP], *"Signing on fees to earn money."* [GP]
27. **Kadro rolü** (as, yedek, gençler). *"there should be different club roles such as first team, bench, youth team."* [GP]
28. **Altyaş milli takımlar** (U17, U21). *"Go up the International ladder U17 U21."* [GP]
29. **Takımın kaldığın yerden devam etmesi** (kulüp değiştirip dönünce sıfırlanmaması). *"the game should allow a team to grow where you left them."* [GP]
30. **Emeklilik sonrası teknik direktörlük ve NSM bağlantısı** (bazıları karşı çıkıyor). *"people saying you should be able to manage a team when you retire."* [GP]

### Maç içeriği ve futbol kuralları
31. **Sakatlıklar.** *"the player should have the risk to getting injured or commiting fouls."* [GP]
32. **Sarı ve kırmızı kart, faul, hakem etkileşimi.** *"it would be 5 star if there was defending and referees and you could argue."* [GP]
33. **Yeni beceriler** (dayanıklılık, oyun zekâsı). *"could have more skills, like intelligence... and endurance."* [GP]
34. **Kaçırılan hareketlerin beceri puanını düşürmesi** (daha dinamik antrenman). *"When you misplace a pass, miss-hit a shot... it should deduct a point from the training skills."* [GP]
35. **Şut yörüngesi önizlemesi veya nişan yardımı** (Retro Goal tarzı ark). *"a shown arch (like in retro goal) that increases in how far it shows when accuracy is upgraded."* [GP]
36. **Topun düşeceği yeri gösteren işaret ve koşu çizme.** *"I wish there could be an X that you can show where the ball will land."* [GP]
37. **Tekrarda (replay) kendi oyuncunu görmek.** *"during replay it should show us kicking the ball."* [GP]
38. **Maçın tamamını izleyebilme veya daha fazla maç görüntüsü.** *"gameplay where it shows the whole game instead of small parts."* [GP]
39. **Oyuncu içinde oyuncu değişikliği talebi.** *"Ask to be substituted during the match."* [GP]
40. **Kaptan olarak diziliş önermek.** *"suggest formations as captain."* [GP]

### Bilgi, istatistik ve dünya
41. **Takım arkadaşlarının isimleri, numaraları, kadro ekranı.** *"it would be better if your team mates had names."* [GP], *"I can't see my teammates on any screen, we need a team sheet."* [GP]
42. **Gol ve asist krallığı, sezon istatistikleri, kulüp rekorları.** *"Add season highest goal scorers, Highest assist, club highest goal scorer."* [GP]
43. **Takvim ve yıl bilgisi** (hangi yıl, Dünya Kupası nerede). *"Add which year I'm playing in, and which year the world cup is holding."* [GP]
44. **Eksik turnuvalar:** UEFA Süper Kupa, Konferans Ligi, Kulüpler Dünya Kupası, ulusal süper kupalar, Asya Kupası, AFF Kupası. *"WE NEED MORE COMPETITIONS."* [GP]
45. **Yıllık güncel kadro ve lig verisi.** *"updated every year according to the current teams and leagues."* [GP]
46. **Gerçek para birimiyle değer gösterimi** (Bux yerine £/$). *"it would be more fun to use real world currencies so we can judge more accurately how much we are worth."* [GP]
47. **Transfer söylentileri ve sosyal medya akışı.** *"Having transfer rumors of my player."* [GP], *"We need a social media thing where you can post status."* [GP]

### Yaşam tarzı ve hikâye
48. **Daha derin hikâye, paparazzi ve diyalog seçimleri.** *"add troublesome issues from the papparazis or dialogue choice."* [GP]. Simon Read de devam oyunu için ilişki çubuklarını "daha derin, oyuncunun hayatına dair daha karmaşık kararlarla" değiştirmek istediğini söylemişti [Geliştirici].
49. **Evlilik, çocuk, aile.** *"The girlfriend in that game should be married and have kids with the player."* [GP]
50. **Takım arkadaşlarıyla arkadaşlık kurma.** *"make friends with players in your club."* [GP]
51. **Toplu eylem kısayolları** ("Tüm atları yarıştır" gibi). *"I would like to request a 'Race all Horses' function."* [GP]
52. **Bulut kaydı ve cihazlar arası aktarım.** *"Also be able to save data by signing in so i can transfer to other devices."* [GP]
53. **PC ve konsol sürümü (NSS6).** *"Please bring back NSS for PC!"* [GP 2026], *"hopefully we get a nss6 10 years on."* [Steam]
54. **Serbest antrenman alanı** (uzaktan şut ve falso çalışmak için). *"in free mode practice, please let us kick from distance too."* [GP]

---

## 5. Rakip ve benzer oyunlar, çıkarılacak dersler

| Oyun | Tür ve model | Oyuncuların sevdiği | Oyuncuların şikâyet ettiği | Bizim için ders |
|---|---|---|---|---|
| **Football Manager (PC / Mobile / Touch / Netflix)** | Derin menajerlik. Premium (Mobile ~9 $). Netflix sürümünde reklam ve IAP yok | Gerçek veri, derinlik, transfer gerçekçiliği, "oyun dünyası yaşıyor" hissi | Öğrenme eğrisi, uzun maç süresi | NSS oyuncularının istediği transfer, kadro ve istatistik derinliği FM'de var. **Tek oyuncu odaklı bir "FM-lite" katmanı** (ilgilenen kulüpler, bonservis, kadro rolü, söylentiler) büyük fark yaratır. Premium model sporda kabul görüyor |
| **Score! Hero 1-2 (First Touch)** | Seviye bazlı "bulmaca" şut ve pas çizme. F2P + enerji + reklam | Çizerek pas ve şut, görsel kalite, hikâye bölümleri | Enerji duvarı, zorluk sıçramaları, tekrar | NSS oyuncuları NSS'yi Score! Hero'dan daha "kariyer" hissi verdiği için üstün buluyor. **Çizgi ile pas ve koşu çizme** (oyuncuların istediği "X" işareti) Score! Hero'dan alınabilir. Enerji duvarı burada da nefret ediliyor |
| **Dream League Soccer (First Touch)** | Takım kurma + tam maç kontrolü. F2P + coin + reklam | Tam maç kontrolü, lisanslı oyuncular, çevrimdışı | Reklam, coin grind'i, tekrar | Tam maç kontrolü güzel ama NSS'nin "yalnızca kilit anlar" formülü mobilde daha iyi çalışıyor. **Kilit an formülü korunmalı, ama sahada görünen bir avatar eklenmeli** |
| **Soccer Manager (2023-26) / Top Eleven (Nordeus)** | Çevrimiçi menajerlik. F2P + token + reklam + PvP | Çok oyunculu ligler, sosyal rekabet, günlük döngü | Agresif token ekonomisi, pay-to-win, sürekli bildirim | Çevrimiçi PvP ekonomisi NSS hayranlarının istediği şey değil. Onlar **çevrimdışı, tek oyunculu, adil** bir deneyim istiyor. Sosyal katman ancak opsiyonel liderlik tablosu veya asenkron meydan okuma olarak eklenmeli |
| **PES/eFootball "Become a Legend" (BAL)** | Konsolda tek oyuncu kariyeri, oyuncuyu sahada kontrol | Pozisyon seçimi, kendi oyuncunu kontrol etme, sahada görünme | Uzun maçlar, saha dışı hayatın sığlığı | NSS oyuncularının istediği **pozisyon + görünür avatar + saha konumlanması** BAL'ın çekirdeği. BAL'ın eksik olduğu saha dışı yaşam NSS'nin güçlü yanı. **İkisinin birleşimi** boşluğu dolduruyor |
| **FIFA / EA FC Player Career** | Konsolda oyuncu kariyeri (EA FC 24+ Player Career, Clubs) | Lisans, sunum, gerçek kulüpler | Kariyer modunun yıllardır ihmal edilmesi, saha dışının yüzeysel olması | EA'nın ihmal ettiği "oyuncu hikâyesi" bir pazar boşluğu. Kişilik, medya ve ilişki katmanı ayırt edici olabilir |
| **EA FC Mobile** | Ultimate Team, F2P, enerji, olay pasları | Lisans, kart toplama | Agresif monetizasyon, çevrimiçi zorunluluk | Kart toplama ve gacha, NSS kitlesinin istediğinin tam tersi. Kaçınılmalı |
| **Retro Goal / Retro Bowl (New Star)** | Retro estetik + basit menajerlik + arcade maç. Reklamsız, tek seferlik Unlimited | Reklamsızlık, adil fiyat, şut arkı, transfer pazarı | Retro Goal: bux ekonomisi yetersiz, sözleşmeler çok kısa, AI tutarsız, savunma yok | **Retro Bowl modeli, NSS mağaza yorumlarında defalarca "olması gereken" diye anılıyor.** Reklamsız + bir kerelik "full game" satın alma, ileride kozmetik veya genişleme paketi. Retro Goal'ın para kıtlığı ise NSS'deki hatanın tekrarı |
| **New Star Manager** | NSS maç mekaniği + takım yönetimi + kart sistemi. F2P + reklam | Kilit an maç mekaniği, tackle, menajerlik derinliği | Oyuncuların "gelişim" talebini kart kıtlığıyla karşılayamamak, maç sayısına bağlı sözleşmeler, kulüp değiştirince her şeyi kaybetmek, siyah personel kartlarının paralı olması | Başarı kanıtı: NSS formülü genişletilebilir. **Tackle mekaniği NSS oyuncularının birebir istediği şey.** Kıtlık temelli "memnuniyet" sistemleri ise burada da en büyük şikâyet |
| **Soccer Hero / Football Superstar (2008 Roblox benzeri çevrimiçi) / Ultimate Football Player (Big Fat Simulations)** | Oyuncu kariyer simülasyonları | Oyuncu odaklı fantezi | Sığlık, enerji, reklam | Nişte rakip az. Kalite eşiği düşük; iyi yapılmış bir ürün kolayca öne çıkar |
| **Football Manager / Championship Manager'ın oyuncu modu ve "Dino Dini's Player Manager"** | Klasik oyuncu-menajer | Oynayan teknik direktör fantezisi | - | Bir NSS yorumu: *"better if it was more like Dino dini's player manager."* Emeklilik sonrası **oynayan teknik direktörlük ve menajerlik** geçişi potansiyel bir "late-game" çözümü |

### Genel dersler (önceliklendirilmiş)

1. **Kendi kazancını yiyen ekonomi kurma.** Fiyatların maaşla birlikte ölçeklenmesi (NRG, ajan, antrenör), on yıllık yorumlarda tek başına en çok 1-3★ sebebi. Oyuncu "daha iyi sözleşme" aldığında **gerçekten zenginleştiğini hissetmeli.** Masraflar lüks ve statüye göre artabilir; temel ihtiyaçlar (enerji) sabit kalmalı.
2. **Enerji = gerçekçi yorgunluk, ödeme duvarı değil.** Enerji takvime göre (dinlenme günü, uyku, yaş, ev kalitesi) yenilenmeli. Antrenman, ilişki ve maç arasında anlamlı bir zaman yönetimi tercihi olmalı; para cezası olmamalı.
3. **İş modeli: Retro Bowl yolu.** Ücretsiz deneme (ör. ilk sezon) + tek seferlik "tam oyun" + istenirse kozmetik veya genişleme. Hem reklam hem tüketilebilir IAP birlikte olmamalı ("Ads or Microtransactions, not both"). Ödüllü reklam varsa reklamsız paket alanlar da ödülü almalı.
4. **Asla dark pattern kullanma.** Gizlilik onayında buton değiştirme, yoruma ödül verme, süreyi gizleyen tüketilebilir ürünler gibi uygulamalar uzun vadede marka güvenini yok ediyor.
5. **Adil algılanan maç motoru.** Takım arkadaşları topa gitmeli. Kamera açısı değişse de top fiziği tutarlı olmalı. İmkânsız fırsat verilmemeli. Lig ve takım gücü maça yansımalı. Rüzgâr ya kaldırılmalı ya da öngörülebilir olmalı.
6. **Şeffaf ve tutarlı puanlama.** Maç reytingi formülü maç sonunda açıklanmalı (ör. "+1,5 gol, +0,8 asist, -0,4 kaçan pas"). İlişki değişimlerinin nedeni gösterilmeli. "Hat-trick yaptım, takım beni suçladı" durumu olmamalı.
7. **Kimlik: pozisyon ve görünür avatar.** Kaleci ve savunma kariyeri büyük, ölçülmüş bir talep (516 ve 297 oy). Pozisyona göre farklı kilit an türleri tasarlanmalı.
8. **Late-game içeriği.** 3-5 sezon sonra tekrar ve "her şeyi aldım" sorunu var. Bunun için şunlar düşünülmeli: rekabetçi transfer piyasası, rakip yıldızlar, efsane hedefleri, Ballon d'Or yarışı, rekorlar, emeklilik, menajerlik veya teknik direktörlüğe geçiş, aile ve miras.
9. **Zorluk seçenekleri baştan olmalı** (kolay, normal, zor + özel ayar). Normal ile zor arasındaki uçurum (Retro Goal ve NSS Hard) yumuşatılmalı.
10. **Çevrimdışı öncelik + bulut kaydı.** Çevrimdışı çalışma en sevilen özelliklerden biri. Kayıp kariyer ise en acı şikâyetlerden. İkisi birlikte sunulmalı. PC sürümünde DRM olmamalı.
11. **Yan sistemler ana döngüyü ezmemeli.** At yarışı NSS'de futboldan 10 kat fazla para kazandırıyor. Yan aktiviteler eğlenceli ama sınırlı olmalı. "Tümünü yap" kısayolları eklenmeli.
12. **Veri güncelliği ve turnuva bütünlüğü.** Kadrolar, terfi ve küme düşmeler, eksik kupalar ve Euro çeyrek final hatası gibi "dünya kırık" hissi veren sorunlar, sadık kitleyi yoruma döktürüyor. Kullanıcı tarafından düzenlenebilir veri (Retro Goal'ın planlanan editörü) bunun ucuz çözümü olabilir.
13. **Kapsayıcılık detayları.** Kadın kariyerinde doğru zamirler ve sprite'lar. Kız arkadaş / ilişki sistemi opsiyonel ve cinsiyet nötr olmalı.
14. **Sadelik bir özelliktir.** 2024 grafik güncellemesi ve "modern" skin bazı sadık oyuncuları kaçırdı. Yeni görsel stil okunaklı olmalı, "classic" bir mod düşünülebilir.

---

## 6. Kaynak listesi

### Mağazalar ve veri
- Google Play, New Star Soccer: https://play.google.com/store/apps/details?id=com.newstargames.newstarsoccer
- Google Play, New Star Manager: https://play.google.com/store/apps/details?id=uk.fiveaces.nsfc
- Google Play, Retro Goal: https://play.google.com/store/apps/details?id=com.newstargames.retrogoal
- Google Play, Retro Bowl: https://play.google.com/store/apps/details?id=com.newstargames.retrobowl
- Google Play, Retro Bowl College: https://play.google.com/store/apps/details?id=com.newstargames.retrobowlcollege
- Google Play, New Star Cricket: https://play.google.com/store/apps/details?id=uk.fiveaces.newstarcricket
- Google Play, New Star Baseball: https://play.google.com/store/apps/details?id=uk.fiveaces.baseball
- Google Play, New Star GP: https://play.google.com/store/apps/details?id=com.newstargames.newstargp
- Google Play, Retro Slam Tennis: https://play.google.com/store/apps/details?id=com.newstargames.retroslamtennis
- Google Play, NSS G-Story: https://play.google.com/store/apps/details?id=uk.fiveaces.newstarsoccergstory
- App Store, New Star Soccer: https://apps.apple.com/us/app/new-star-soccer/id498973162
- App Store yorum RSS (AU/CA/IE/IN/ZA): https://itunes.apple.com/au/rss/customerreviews/id=498973162/sortby=mostrecent/json
- App Store, New Star Manager: https://apps.apple.com/app/id1360417684
- App Store, Retro Goal: https://apps.apple.com/app/id1535765855
- Steam, New Star Soccer 5: https://store.steampowered.com/app/212780
- Steam yorum API'si (NSS5): https://store.steampowered.com/appreviews/212780?json=1
- Steam, New Star Manager tartışma: https://steamcommunity.com/app/883130/discussions/0/1735506744733836319
- AppGoblin (iOS metrikleri ve gelir tahmini): https://appgoblin.info/apps/498973162
- AppBrain geliştirici sayfası: https://www.appbrain.com/dev/New+Star+Games+Ltd/
- Retro Goal IAP fiyatları: https://apppricinglab.com/iap/apple/1535765855

### Basın, wiki, geliştirici
- Wikipedia, New Star Soccer: https://en.wikipedia.org/wiki/New_Star_Soccer
- Pocket Gamer, NSS incelemesi: https://www.pocketgamer.com/new-star-soccer/review/
- PocketGamer.biz, "Own goal: New Star Soccer's free-to-play update angers Android gamers" (12 Kasım 2013): https://www.pocketgamer.biz/own-goal-new-star-soccers-free-to-play-update-angers-android-gamers/
- Pocket Gamer, "Why was New Star Soccer pulled from the App Store?" (31 Temmuz 2012): https://www.pocketgamer.com/articles/043605/r/
- Pocket Gamer, NSS 1.5 güncellemesi ekran görüntüleri: https://www.pocketgamer.co.uk/new-star-soccer/new-star-soccer-dev-posts-fresh-screenshots-of-the-games-next-major-update/
- Pocket Gamer, NSS devam oyunu planı: https://www.pocketgamer.co.uk/new-star-soccer/new-star-soccer-sequel-planned-for-mobile-handheld-and-consoles/
- Pocket Gamer, New Star Manager ön inceleme: https://www.pocketgamer.com/new-star-manager/new-star-soccer-manager-preview-hands-on-with-an-exciting-new-football-contender/
- God is a Geek, "New Star Soccer Dev Discusses Sequel Ideas" (Ağustos 2013): https://godisageek.com/2013/08/star-soccer-dev-discusses-sequel-ideas/
- TouchArcade, NSS G-Story (26 Mayıs 2016): https://toucharcade.com/?p=196071
- TouchArcade, NSS güncellemesi (2016): https://toucharcade.com/2016/09/27/new-star-soccer-update/
- Trusted Reviews, NSS mobil: https://www.trustedreviews.com/reviews/new-star-soccer-mobile-game
- Macworld, NSS iOS incelemesi: https://www.macworld.com/article/666864/new-star-soccer-for-ios-review.html
- OSFTW, NSS Android incelemesi: https://www.osftw.com/reviews/711/new-star-soccer
- Pocket-lint, NSS 2 geliştirmede: https://www.pocket-lint.com/games/news/120118-new-star-soccer-2-in-development
- New Star Games, "Retro Goal goes free to play" (8 Şubat 2023): https://www.newstargames.com/post/08-feb-2023-retro-goal-goes-free-to-play
- New Star Games, NSS güncelleme haberi: https://www.newstargames.com/servlet/Content/en/news/370/News-New-Star-Soccer-Update
- Defector, Retro Goal yazısı: https://defector.com/this-little-soccer-game-on-my-phone-is-fun-as-hell
- Bonus Stage, New Star Manager incelemesi: https://www.bonusstage.co.uk/archives/138221
- Miketendo64, New Star Manager Switch incelemesi: https://miketendo64.com/2019/04/11/switch-review-new-star-manager/
- TapTap, Score! Hero değerlendirmesi: https://www.taptap.io/post/8045489
- WASDland, NSS5 Steam özet: https://www.wasdland.com/game/new-startm-soccer-5-212780/

### Erişilemeyen veya eksik kalanlar
- Reddit r/NewStarSoccer: bu ortamdan erişim engellendi. Takip için önerilen aramalar: "NSS sequel wishlist", "NRG price", "hard mode", "goalkeeper career", "horse racing exploit".
- God is a Geek makalesi 403 döndürdü. İçerik arama özetinden alındı (Simon Read: pinch ile tüm sahayı görme, uzun paslar, verkaç; ilişki çubuklarını daha derin kararlarla değiştirme; "çok karmaşık olursa NSS'yi iyi yapan seri hissi kaybolur" uyarısı).
