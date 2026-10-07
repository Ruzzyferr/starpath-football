# StarPath Football: Analiz ve Plan

> **Belge türü:** Proje sahibi için ana teslimat (master deliverable)
> **Soru:** "Mevcut oyunda (görsel ve oyun içi) neler var, hepsini çıkar; her konu için en az 100 madde ne ekleyeceğiz?"
> **Tarih:** 7 Ekim 2026
> **Kaynaklar:** `docs/GDD.md`, `docs/research/01-mevcut-oyun-analizi.md`, `02-store-yorumlari.md`, `03-ui-ve-asset-arastirmasi.md`, `04-platform-ve-teknik.md`. Bu belge bir sentezdir; yazımı sırasında web taraması yapılmamıştır. Mağaza politikası, yaş derecelendirme ve fiyat gibi zamanla değişen konular, gönderimden önce resmi kaynaklardan yeniden doğrulanmalıdır.

**Etiketler**

| Etiket | Anlamı |
|---|---|
| **[v1]** | 1.0 sürümünde yer alır |
| **[v2]** | 1.0 sonrası ilk büyük güncelleme (lansman sonrası sezonlar) |
| **[v3]** | Uzun vade, talep ve gelire bağlı |
| **P0** | Olmazsa olmaz; eksikse o sürüm çıkmaz |
| **P1** | Önemli; kapasite el verdiği ölçüde o sürüme girer |
| **P2** | Güzel olur; kaydırılabilir |

**İçindekiler**

0. Yönetici Özeti
1. Mevcut Oyunda Neler Var (envanter tabloları)
2. Ekleyeceklerimiz ve Geliştireceklerimiz
   - 2.1 Maç motoru, oyun hissi ve kontroller
   - 2.2 Animasyon, kamera, efektler ve sunum
   - 2.3 Kariyer ve oyun mantığı
   - 2.4 Sosyal hayat, ilişkiler, kararlar ve olaylar
   - 2.5 Ekonomi, lüks yaşam, yatırım, işletme ve kumarhane
   - 2.6 Dünya, ligler, kupalar, NPC'ler, veri ve mod
   - 2.7 UI/UX ve görsellik
   - 2.8 Ses ve müzik
   - 2.9 Platform ve teknik
   - 2.10 Meta, sosyal/online, canlı operasyon ve topluluk
   - 2.11 Erişilebilirlik ve yerelleştirme
   - 2.12 "Aklına gelmeyenler": riskler, hukuk, mağaza, pazarlama, QA, etik
3. Yol Haritası (kilometre taşları, ekip ve maliyet, risk kaydı)
4. Başarı Metrikleri

---

## 0. Yönetici Özeti

### NSS nedir?
New Star Soccer (NSS), Simon Read'in 2003'te metin tabanlı bir PC oyunu olarak başlattığı, 2012'de mobilde patlayan bir **futbolcu kariyeri + yaşam simülasyonu** serisidir. 16 yaşında, en alt ligde başlayan tek bir oyuncuyu yönetirsiniz. Maçın tamamını değil, yalnızca topun size geldiği **kritik anları** sapan gibi sürükle-bırak vuruşla oynarsınız. Maç dışında enerji (NRG) harcayarak antrenman yapar, patron, takım, taraftar, sponsor ve partner ilişkilerini dengeler, ev, araba ve at alır, kumarhanede şansınızı dener, tabloid manşetlerine çıkarsınız. Seri ~10 milyon indirmeye (bugün tahminen çok daha fazlası), 2013 BAFTA ödülüne ve Google Play'de 2,3 milyon oya ulaştı. Oyun hâlâ güncelleniyor (v2.32, Aralık 2025), ancak çekirdeği 2012'deki hâliyle duruyor.

### Neden bu kadar seviliyor?
1. **"Bir maç daha" döngüsü:** 30–60 saniyelik maçlar ve kısa oturumlar. Yorumlarda en sık geçen kelime "addictive".
2. **Kritik an formülü:** Az fırsat, büyük sorumluluk. Sonlara doğru "vahşi" gerilim.
3. **Saha dışı hayatın da oyunun parçası olması:** Futbolun "pembe dizi" yanı, mizahi gazete manşetleri, gülünç lüks eşyalar (tank, savaş uçağı, gökdelen).
4. **Basit ama derin kontrol:** Sürükle, falso ver, aşırt. Öğrenmesi kolay, ustalaşması zor.
5. **Çevrimdışı ve hafif:** Metroda, uçakta, internetin kısıtlı olduğu ülkelerde oynanıyor.
6. **Sıfırdan yıldızlığa fantezisi:** "16 yaşında zayıf bir çocuktan Dünyanın En İyisi'ne."

### En büyük başarısızlıkları
1. **Kendi kazancını yiyen ekonomi:** NRG fiyatı yıldız seviyesiyle katlanıyor ("NRG evden pahalı"). Daha iyi sözleşme anlamsızlaşıyor.
2. **Agresif ve dürüst olmayan monetizasyon:** 15–80 saniyelik atlanamayan reklamlar, 150 maç sonra sessizce biten ücretli ajan/antrenör, F2P'ye geçişte tanınmayan eski satın alımlar, onay penceresinde yer değiştiren butonlar, yorum karşılığı 10 Bux.
3. **Adaletsiz hissettiren maç:** Topa gitmeyen takım arkadaşları, raydaki kaleciler, tutarsız rüzgâr, ortalarda uyuşmayan kamera, imkânsız fırsatlar, "sonuç önceden belirli" hissi ve uygulamayı kapatarak save-scum.
4. **Kimlik eksikliği:** Pozisyon seçimi yok, kaleci veya defans kariyeri yok (en çok beğenilen istek 516 oy), sahada görünür bir avatar yok.
5. **Sığ ilişki ve olay sistemi:** %55 ile %100 arasında fark olmayan barlar, hat-trick yapınca "takımın suçlaması", tek kötü röportajın mükemmel maçı silmesi, tekrar eden ikilemler, zorunlu ve anlamsız kız arkadaş.
6. **Kırık dünya hissi:** Takım gücü farkı yok, eksik turnuvalar, fikstür hataları, güncel olmayan kadrolar.
7. **Kayıp kariyerler:** Bulut kayıt yok, telefon değişince 14 yıllık kariyer gidiyor. PC'de DRM ve kapanan sunucular.
8. **Geç oyun boşluğu:** 3–5 sezondan sonra "her şeyi aldım, şimdi ne?" ve 40 atlık at yarışı ekonomisinin futbolu ezmesi.

### Konumlandırma: "NSS → StarPath = Max Payne 2 → Max Payne 3"
Max Payne 3, serinin kimliğini (bullet-time, kara anlatı, tek kahraman) koruyup her sistemi bir nesil ileri taşıdı. StarPath Football da aynısını yapacak: **NSS'nin ruhu (kısa kritik anlar, sapan vuruş, saha dışı hayat, tabloid mizahı, "bir gün daha") korunur; her sistem modern, adil, derin ve şeffaf hâle getirilir.** StarPath bir klon değil: kendi adı, kendi kurgusal dünyası ve kendi görsel kimliği ("Gece Maçı") olan bir halef. "New Star" adı ve gerçek kulüp/oyuncu adları hiçbir yerde kullanılmaz.

Pazar boşluğu net: EA FC ve eFootball'un oyuncu kariyerleri saha dışını ihmal ediyor, Football Manager tek oyuncu fantezisi sunmuyor, Score! Hero ve Dream League enerji duvarına ve reklama dayanıyor. Mağaza yorumları "Retro Bowl gibi tek seferlik ödeme" modelini defalarca talep ediyor. StarPath, **"premium kalite + adil fiyat + çevrimdışı + kayıp yok"** vaadiyle bu boşluğa oturuyor.

### Öne çıkan 10 farklılaştırıcı
1. **Pozisyon seçimi ve kaleci kariyeri:** Golcüden kaleciye 6 arketip. Her pozisyonun kendine özgü kritik anları var (stoperin top kapma, bekin bindirme ve orta, kalecinin penaltı okuma ve çıkışı).
2. **Gerçek beceri, görünür avatar:** Sahada kendi prosedürel oyuncunuz; bullet-time nişan, Magnus etkili falso, ver-kaç, kayarak müdahale. Paranız maçı kazandırmaz.
3. **Adil ve şeffaf maç motoru:** Deterministik, seed'li simülasyon. Takım gücü, lig ve taktik maça yansır. İmkânsız fırsat üretilmez. Maç sonu reytingi kalem kalem açıklanır ("+1,5 gol, −0,4 kaçan pas").
4. **Enerji duvarı yok:** Enerji bir takvim ve yorgunluk kaynağıdır (günde 3 zaman dilimi, uyku, yaş, ev kalitesi), satın alınan bir para birimi değil. Fiyatlar maaşla birlikte şişmez.
5. **Derin ve kapsayıcı yaşam:** Aile, cinsiyet nötr ve isteğe bağlı romantizm, evlilik, çocuklar, en yakın arkadaş, her takım arkadaşıyla ayrı ilişki. Hafızası olan ilişkiler ve "neden oldu" kayıt defteri.
6. **Zincirleme olay motoru:** v1'de 150+, v2'de 400+ veri odaklı olay. Gecikmeli sonuçlar, skandal zincirleri, sosyal medya, basın toplantısı, transfer söylentileri.
7. **Yaşayan kurgusal dünya:** 8+ ülke, kademeli lig piramitleri, gerçekçi transfer piyasası (ilgilenen kulüpler, kiralık, transfer talebi, bonservis), rakip yıldızlar (nemesis), altyaş milli takımlar, düzenlenebilir veritabanı ve mod desteği.
8. **Kariyerin sonrası:** Jübile, teknik direktörlük, yorumculuk, kulüp başkanlığı ve **miras modu** (çocuğunuzla yeni kariyer). Onur Listesi müzesi.
9. **Adil para modeli:** Ücretsiz deneme (ilk sezon) + tek seferlik tam sürüm kilidi, Steam'de premium; yalnızca kozmetik ek içerik. Zorunlu reklam, lootbox, premium para birimi, süreli ürün yok.
10. **Kayıp yok, her yerde oyna:** Atomik kayıt, 3 nesil yedek, checksum ile otomatik kurtarma, bulut senkronu (Steam Cloud, iCloud, Play Games), elle dışa aktarma. PC, Steam Deck, Android, iOS ve PWA'da tek kod tabanı; tamamen çevrimdışı.



---

## 1. Mevcut Oyunda Neler Var

Aşağıdaki tablolar NSS Mobil (2012–2025, v2.32'ye kadar) ve NSS5'in (PC/Steam) envanteridir. Kaynak, araştırma raporlarındaki güven etiketleriyle birlikte okunmalıdır: wiki ve forum kaynaklı bilgiler [T], doğrulanmış bilgiler [D], çıkarımlar [Ç] olarak 01 numaralı raporda işaretlidir. Burada sadelik için etiketler tekrarlanmamış, belirsiz satırlarda "(doğrulanmadı)" notu düşülmüştür. Son sütun, StarPath'te ne yaptığımızı özetler; ayrıntılı ve numaralı karşılıkları bölüm 2'dedir.

### 1.1 Kariyer

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 1 | Başlangıç yaşı | Her zaman 16 | Seçenek yok | 16–18 arası seçim; geçmiş hikâyesine göre başlangıç |
| 2 | Ülke seçimi | Seçilen ülkenin en alt oynanabilir liginde başlar | Kulüp seçimi yok, başlangıç rastgele hissettirir | Ülke + şehir; yerel kulüplerden deneme maçı daveti, 2–3 seçenek |
| 3 | Cinsiyet | Erkek/kadın (1.5+), ana ekrandan istenildiği an değiştirilebilir | Partnerin cinsiyeti de değişir; eşcinsel ilişki imkânsız; yorumcu "he" der | Kariyer başında seçim; zamirler ICU ile doğru; partner tercihi bağımsız |
| 4 | Görünüm | Ten rengi seçimi bir güncellemeyle kaldırıldı; yüz/saç özelleştirmesi belirsiz | Oyuncu sahada ayırt edilemiyor | facesjs tabanlı prosedürel avatar, yaşla değişen yüz, sahada halkalı kahraman |
| 5 | Pozisyon | Mobilde fiilen tek hücum rolü; NSS5'te mevki seçimi var | En çok istenen özellik (222 ve 344 oy), kaleci kariyeri 516 oy | 6 arketip (Golcü, Oyun Kurucu, Kanat, Duvar, Box-to-Box, Kaleci), pozisyon değiştirme |
| 6 | Zorluk | Normal ve Hard (Hard önce kilitli) | Normal "gülünç kolay", Hard "öfke reçetesi"; arada basamak yok | Kolay/Normal/Zor/Efsane + özel ayar; yardım seviyesine göre ödül çarpanı |
| 7 | Kayıt slotu | 3 slot | Bulut yok, cihaz değişince kariyer kaybı | 3+ slot, otomatik yedek, bulut senkronu, dışa aktarma |
| 8 | Practice modu | Kramponları deneme, küçük ödül ve ilişki takviyesi | Uzaktan şut çalışılamıyor | Serbest antrenman sahası: her mesafeden şut, duran top laboratuvarı, ödülsüz |
| 9 | Yetenekler (mobil) | 5 yetenek: Pace, Power, Technique, Vision, Free Kicks | Defans, kafa, fizik yok; "yetenek = antrenman" basitliği | 4 grupta 23 özellik (Fiziksel, Teknik, Zihinsel, Kaleci), pozisyona göre ağırlıklı OVR |
| 10 | Yetenekler (NSS5) | 7 yetenek: Pace, Flair, Dribbling, Passing, Shooting, Heading, Tackling | Zihinsel boyut yok | Vizyon, Soğukkanlılık, Pozisyon Alma, Liderlik, Çalışkanlık |
| 11 | Antrenman mini oyunları | Her yetenek için bir mini oyun (koniler, kaleci, iki direk, manken, baraj) | Rüzgâr "çok büyük rol" oynar, üst ligde Pace olmadan geçilemez | Her özellik grubu için ayrı, ölçeklenen, rüzgârı öngörülebilir mini oyunlar |
| 12 | Yıldız puanlama | Antrenman 1–3 yıldız; 3 başarısızlıkta artış yok | Cezalandırıcı, tek denemeye bağlı | Performansa orantılı XP; başarısız deneme de küçük XP verir |
| 13 | Yetenek erimesi | 1.5'ten beri yetenekler zamanla düşer; NRG zamanlayıcıyı sıfırlar | Antrenmandan hemen sonra bile düşüş, rastgele ve sinir bozucu | Yaşa bağlı, öngörülebilir eğri; 30+ fiziksel düşüş; uyarı ve "bakım antrenmanı" |
| 14 | Star Rating (SR) | Genel seviye (SR1–SR15); ücret yaklaşık SR'ye eşit | NRG, ajan ve antrenör fiyatları SR ile katlanır | OVR + Şöhret ayrı; fiyatlar seviyeye endekslenmez |
| 15 | Form ve oyun stili | 2014'ten beri form etiketi ("klasik 10 numara", "ölümcül bitirici") | Etkisi belirsiz | Son 5 maç formu + görünür oyun stili rozeti; perk ve teklif kararlarına etkisi açık |
| 16 | İlk sözleşme | Ücret 1, gol bonusu 1, asist 0 | Gerçek dışı para birimi | Kurgusal ama okunur para (yerel biçimli), gerçekçi alt lig maaşı |
| 17 | Sözleşme pazarlığı | Hi-Lo kart oyunu (1–11, 4 tahmin); başarısızlıkta Boss −%20 | Şansa dayalı, en çok alay edilen sistemlerden | Beceri tabanlı teklif–karşı teklif mini oyunu, kulüp sabrı göstergesi, ajan ipuçları |
| 18 | Sözleşme maddeleri | Ücret, gol bonusu, asist bonusu | İmza parası, süre, serbest kalma bedeli yok | Maaş, süre, imza parası, gol/asist primi, serbest kalma, oynama garantisi, sakatlık sigortası |
| 19 | Yeniden pazarlık | Hoca ile ilişki iyi + SR artmış olmalı | Koşullar gizli | Koşullar ve bekleme süresi ekranda görünür |
| 20 | Transfer | Ocak'ta teklifler; sezon sonunda performansa göre kulüp seçimi | Gerçek dışı kolay (1 sezonda alt ligden dev kulübe), sezon ortası yalnız aynı lig | İlgilenen kulüpler listesi, scout göstergesi, yaz/kış penceresi, ligler arası transfer |
| 21 | Transfer değeri | Performansla iner/çıkar, sözleşme ekranında gösterilir | Bonservis bedeli ve imza parası görünmez | Bonservis, imza parası, ajan komisyonu ayrı satırlarda |
| 22 | Transfer talebi | Yok | Açık kullanıcı isteği | Transfer talebi, listeye konma, ilişki bedeli |
| 23 | Kiralık | Yok | İstek var | Kiralık transfer, opsiyonlu kiralık, geri çağırma |
| 24 | Kadro rolü | Yalnız "Substitute" barı (enerji/ilişki kaynaklı) | As, yedek, genç takım rolü yok | Yedek → Rotasyon → İlk 11 → Yıldız → Kaptan; TD güveni barı |
| 25 | Kaptanlık | Daha çok röportaj, sözleşme bonusu, takım arkadaşlarına koşu yönü verme | Başarısız pazarlık kaptanlığı kaybettirebilir | Kaptanlık oylaması, maç içi komutlar, soyunma odası olayları |
| 26 | Milli takım | Milli hoca ilgisi ayrı ölçü; çağrılmak çok zor ("50 MOTM'ye rağmen") | Şeffaf değil, altyaş yok | U17/U19/U21/A milli takım; açık ilgi göstergesi ve kadro duyurusu |
| 27 | Ödüller | Yılın Genç Oyuncusu, Lig/Bölüm Oyuncusu, Dünyanın En İyisi | "65 maçta 65 gol, ödül yok" | Şeffaf oylama formülü; aday listesi ve oy dağılımı gösterilir |
| 28 | Sadakat unvanları | 100/250/500 maç: taraftar favorisi, kulüp kahramanı, efsane | Sadece başarım | Kulüp efsanesi statüsü: forma emekliye ayrılır, heykel, jübile |
| 29 | Emeklilik | İsteğe bağlı (1.5+); kariyer skoru lider tablosuna gider; zorunlu emeklilik yok (100 yaş) | Emeklilik sonrası hiçbir şey yok | Jübile maçı, TD/yorumcu/başkan yolları, miras modu, Onur Listesi |
| 30 | Menajerlik | NSS'de yok; ayrı oyun olarak taşındı | Kullanıcılar emeklilik sonrası TD olmak istiyor | Teknik Direktör modu [v2], oyuncu-menajer geçişi |
| 31 | Sakatlık | NSS5'te var (ağrı kesici); mobilde belirsiz | Sakatlık riski isteği | Sakatlık türleri, süre, rehabilitasyon mini oyunu, kriyoterapi ve fizyoterapist |
| 32 | Personel | Ajan ve Antrenör (Amatör/Pro/Expert), 50–150 maç süreli | Pro/Expert gerçek parayla, süre gizli | Oyun içi parayla tutulan ajan, özel antrenör, fizyoterapist, beslenme uzmanı; süreler görünür |
| 33 | Rüşvet | Maç satma teklifi; nadiren gazete tuzağı, kariyer fiilen biter | Tek olay bir Dünya Kupası kariyerini mahvediyor | Zincirleme şike olayı; uyarı işaretleri, kurtuluş yolları, ağır ama oynanabilir sonuçlar |

### 1.2 Maç

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 34 | Maç yapısı | Metin akışı (ticker) + topun size geldiği kritik anlar | Maçın geri kalanı görünmez, "4-0 gerideyken top gelmiyor" | Tam deterministik simülasyon + kritik anlar + mini radar; isteğe bağlı uzun mod |
| 35 | Fırsat sayısı | Maç başına "birkaç" an; Team ilişkisi yüksekse daha fazla | Formül gizli; imkânsız fırsatlar | Pozisyona, rolde kalma süresine ve takım oyununa bağlı an üretimi; imkânsız an filtresi |
| 36 | Vuruş kontrolü | Topun üzerinden geriye sürükle (sapan); açı + güç | Güç oku "göreceli", gerçek güç değil | Mutlak güç ölçeği, şut yayı önizlemesi, bullet-time nişan |
| 37 | Falso / Swerve | Eskiden topun neresine dokunulduğu; SWERVE krampon ile havada bükme | Falsoyu bir krampon satın alarak açmak | Herkes için Magnus etkili falso; beceri ve Teknik özelliği ile ölçeklenir |
| 38 | Aşırtma (chip) | Topa aşağıdan ve az güçle vurmak | Belirsiz girdi | Ayrı jest/tuş ve görsel ipucu |
| 39 | Pas | Takım arkadaşına sürükleme | "Topu tam ayağına atmazsan alamıyor"; başarılı pas başarısız sayılıyor | Toleranslı alma yarıçapı, koşu yoluna ara pas, ver-kaç |
| 40 | Dribbling | Sonradan "intercept" yerine eklendi; koniler gibi anlar | Kısa, bağlamsız | Rakibe karşı 1v1 an, çalım hareketleri, Çeviklik ve Dribbling etkili |
| 41 | Pas kesme (intercept) | Eskiden tek savunma anı; kaldırıldı | Savunma rolü tamamen yok | Top kapma, kayarak müdahale, pas arası, pozisyon alma anları |
| 42 | Orta ve korner | 1.4'ten beri; doğrudan korner golü mümkün | Yan kamera ile ana kamera uyuşmuyor (174 oy) | Tek tutarlı kamera, top düşme noktası "X" işareti |
| 43 | Kafa vuruşu | 1.5'ten beri | "Kafa şuttan çok falso alıyor", 23 metreden kafa fırsatı | Kafa fiziği ayrı; Zıplama + Kafa özelliği; mesafe sınırı |
| 44 | Sekme / rebound | 1.4'ten beri | Kontrol sınırlı | Kaptan veya Pozisyon Alma yüksekse rebound anı |
| 45 | Serbest vuruş | Baraj + kaleci; rüzgâr etkili | Rüzgâr tutarsız | Baraj ayarı, kaleci pozisyonu, öngörülebilir rüzgâr göstergesi |
| 46 | Penaltı | Kaleci her zaman bir tarafa atlar; ortaya yerden vuruş güvenli; geriye pas istismarı | Çözülmüş, gerilimsiz | Kaleci okuma + nişan + güç + panik (Soğukkanlılık), kaleci kariyerinde karşı taraf |
| 47 | Kaleci YZ | Tek eksende "ray üzerinde"; yan pasla dışarı çekilebilir | "Ya imkânsızı kurtarır ya top içinden geçer" | Açı kapatma, çıkış, uzanma, yumruklama, sekme bırakma; Refleks gecikmesi |
| 48 | Takım arkadaşı YZ | Yavaş, topa gitmiyor ("ayak bileklerinde çelik top") | En sık oynanış şikâyeti | Formasyon şablonu, koşu yapma, el kaldırma, ilişkiye göre pas tercihi (görünür) |
| 49 | Savunmacılar | Nişan alırken üzerine gelir (1.5+) | Tek davranış | Pres, alan kapatma, ofsayt çizgisi, Top Kapma'ya bağlı müdahale |
| 50 | Ofsayt | Pas hedefi ofsaytta olabilir; NSS5'te bayrak; kornerde hata (2.14.3'te düzeltildi) | 2026'da hâlâ hata raporu; çizgi bazen görünmüyor | Kural motoru birim testli; ofsayt çizgisi her an görünür seçeneği |
| 51 | Gol algılama | — | "Direğe çarpıp ağlara gitti, kaçtı dedi" | Fizik tabanlı çizgi geçişi testi; gol çizgisi teknolojisi efekti |
| 52 | Hakem ve kart | Mobilde net değil; NSS5'te tackle ile muhtemel | Faul, kart, itiraz istekleri | Faul eşiği, avantaj, kart, hakem sertliği, VAR [v2] |
| 53 | Oyun odağı | Hücum / dengeli / savunma | Etkisi belirsiz | Maç öncesi talimat + maç içi rol değişikliği, etkisi istatistikte görünür |
| 54 | Rüzgâr | Antrenman ve maçta; "1 rüzgâr bazen 4'ten güçlü" | Tutarsız ve aşırı | Fiziksel, sabit vektörlü, göstergeli; ayarlardan kapatılabilir |
| 55 | Hava ve zemin | Yağmur, gece maçı, stadyum boyutu; "Pitch & Weather Pack" IAP | Görsel paket parayla | Hava fiziğe yansır (yağmur sürtünme, kar, rüzgâr); tüm hava ücretsiz |
| 56 | Tekrar (replay) | 2.0+; sayaç bitmeden butona basmak gerekir | Tekrarda kendi oyuncunu göremiyorsun | Deterministik replay, çoklu açı, kaydet ve paylaş |
| 57 | Maç sonuç hissi | Topluluk sonuçların önceden belirli olduğuna inanıyor; kapat-aç istismarı | Güven kaybı, save-scum | Seed ve girdi kaydı; sonuç maç başlarken kilitlenir; şeffaf "maç hikâyesi" |
| 58 | Maç reytingi | Boss/Team/Fans için −5..+5; 4 faktör (fırsat, gol, asist, pas) | "1 gol 2 asist = 5,6" | 0–10 reyting, kalem kalem döküm ekranı |
| 59 | Star Man | Maçın oyuncusu ödülü; başarımlar | — | Korunur; maç kartı + paylaşılabilir görsel |
| 60 | Takım gücü | "Norwich = Man U", alt lig takımı Premier Lig takımını yener | Dünya inandırıcı değil | Takım gücü, taktik, moral, ev sahibi avantajı simülasyona girer |
| 61 | Erken gerileme | Top gelmeden 3-0, 4-0 geride | Oyuncunun etkisi yok hissi | An üretimi skor bağlamına duyarlı; takım oyunu simülasyonu dengeli |
| 62 | Maç hızı | 2026 güncellemesi oyunu hızlandırdı | "Topa yetişemiyorum, stres" | Hız ayarı, bullet-time süresi ayarı |
| 63 | Maç içi değişiklik | Yok | "Oyundan çıkmak isteyebilmeliyim" | Değişiklik isteme, sakatlıkta çıkma |
| 64 | NSS5 tam maç | 2D üstten 90 dk gerçek zamanlı, tek tuş veya Shoot/Pass/Lob; kayarak müdahale; devre süresi ayarı | Mobilde yok | Uzun maç modu [v2]: tüm maç boyunca kendi oyuncunu kontrol |
| 65 | Hoca geri bildirimi | NSS5'te çizgi roman balonları | Mobilde yok | Maç içi TD talimat balonları, devre arası konuşması |
| 66 | Gol sevinci | NSS5: taraftara, kameraya, hocaya koşma; ilişki etkisi | Mobilde yok | Kutlama seçimi + kişisel kutlama kütüphanesi + ilişki etkisi |
| 67 | Kaptanın koşu komutu | Kaptanken takım arkadaşını koşturma | Sadece kaptana | Kaptan komutları + Liderlik özelliğine bağlı etki |
| 68 | Maç sonu ekranları | Final skoru, Star Man, röportaj, sözleşme, PAY, istatistik, puan durumu, fikstür | Bilgiler dağınık, reyting açıklamasız | Tek akışlı maç sonu: skor → reyting dökümü → ödeme → olaylar |

### 1.3 Yaşam ve Lüks

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 69 | Enerji (NRG) | Her şey enerji harcar; zamanla dolmaz | Ödeme duvarı gibi | Gün = 3 zaman dilimi; enerji uyku, dinlenme ve yaşla doğal dolar |
| 70 | NRG içecekleri | Classic, Skills, Charm, Gold, Bolt (IAP); fiyat 3×SR−1 vb. | "NRG evden pahalı" | İçecekler yok; dinlenme, beslenme ve tesislerle toparlanma, sabit fiyatlı takviyeler |
| 71 | Ödüllü videoyla enerji | Var; "zamanın %30'unda ödül veriyor" | Rahatsız edici ve güvenilmez | Reklam yok |
| 72 | Lifestyle eşyaları | 20 eşya (dövme, telefon, konsol, bilardo, tablo...) | Etkisi tek bir "lifestyle" puanı | Her eşyanın somut etkisi (mutluluk, şöhret, toparlanma, ilişki) |
| 73 | Araçlar | 20 araç (bisikletten savaş uçağına) | Etkisi soyut | Araç = ulaşım süresi, şöhret, kaza riski; jet deplasman yorgunluğunu azaltır |
| 74 | Mülkler | 20 mülk (daireden gökdelene); toparlanmayı artırır | Kira geliri yok | Ev (toparlanma), yatırım mülkü (kira), işletme (gelir/gider) |
| 75 | Yıpranma ve onarım | Eşyalar yıpranır (dövme hariç); "Repair All" | "Sanat heykeli neden bozulur?" | Bakım gerçekçi: araç ve tekne bakımı ister, sanat değer kazanabilir |
| 76 | Lüks eşya fiyatı | Sabit; "erken harcama" tavsiyesi | Fiyatlar anlamsız (tank 250) | Gerçekçi oranlı kurgusal fiyatlar, ikinci el piyasası |
| 77 | Stil manşeti | Kötü giyim "style moron" manşetleri | Mizahi ama tek yönlü | Moda seçimi + sosyal medya tepkisi + sponsor uyumu |
| 78 | Dövme | Tek kalıcı eşya | Görsel değil | Avatar üzerinde görünür dövme [v2] |
| 79 | Evcil hayvan | Yok (at hariç) | — | Köpek, kedi vb.: mutluluk ve stres etkisi, bakım zamanı |
| 80 | Seyahat ve tatil | Yok | — | Sezon arası tatil, aile ziyareti, kamp |
| 81 | Gece hayatı | Pub (NSS5), casino daveti | — | Gece hayatı olayları, disiplin ve kondisyon riski |
| 82 | Hayır işleri | Yok | — | Bağış, vakıf kurma, köy okulu; şöhret ve mutluluk |
| 83 | Yaş kapısı | 18 yaş altı casinoda yakalanır, ceza çok ağır | Orantısız ceza | Karakter 18 yaş altıyken kumarhane kapalı |
| 84 | Deplasman eğlencesi | NSS5'te yolculukta oyun, film, müzik | Mobilde yok | Deplasman zaman dilimi: kitap, oyun, uyku seçimi |

### 1.4 İlişkiler

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 85 | Boss (TD) | %50 altı yedek, %10 altı kadro dışı; %55–100 fark yok | Kadro kararı performanstan bağımsız | TD güveni + performans birlikte; kademeli eşikler; neden göstergesi |
| 86 | Team | Pas, asist, alışveriş davetleri; yüksekse daha çok fırsat | "Hat-trick yaptım, takım suçladı" | Her takım arkadaşıyla ayrı ilişki; pas sıklığına görünür etkisi |
| 87 | Fans | Fırsat değerlendirme, galibiyet | Taraftar tek kitle | Taraftar grupları (ultras, aileler, sosyal medya) ayrı tepkiler |
| 88 | Sponsors | 1/3 altında sözleşmeyi iptal | Bar olarak soyut | Sponsor sözleşmesi maddeleri: davranış maddesi, şöhret eşiği |
| 89 | Partner | Memory mini oyunu; lüks çeker; düşerse öfke krizi Boss'u çökertir | Zorunlu, anlamsız ("mutluluk ne işe yarar?") | İsteğe bağlı, cinsiyet nötr romantizm; evlilik, ayrılık, çocuk |
| 90 | Mutluluk | İlişkiler + lifestyle; düşükse olumsuz haber | Etkisi belirsiz | Mutluluk moral ve forma etki eder; etkisi sayısal olarak gösterilir |
| 91 | İlişki mini oyunu | Memory eşleştirme; ekran görüntüsüyle hile | Bağlamsız ve tekrarlı | Etkileşim seçenekleri: yemek, hediye, birlikte antrenman, tatil; kısa diyalog |
| 92 | NSS5 ilişkileri | 8 ilişki (Friends, Fame, Lifestyle dahil) | Liste belirsiz | Anne, baba, kardeş, en yakın arkadaş, ajan, TD, takım arkadaşları, basın |
| 93 | Milli hoca | Ayrı ilgi ölçüsü | Gizli | Görünür ilgi göstergesi, scout ziyareti olayı |
| 94 | Aile | Bulunamadı | İstek var | Aile ilişkileri ve aile olayları (hastalık, düğün, destek) |
| 95 | Arkadaşlık | Yok (NSS5'te arkadaşlarla vakit) | "Takım arkadaşlarıyla arkadaş olmak istiyorum" | Takım arkadaşlarıyla dostluk, rekabet, mentorluk |
| 96 | İkilemler | Çoktan seçmeli kartlar; seçim ilişkileri değiştirir | Sıfır toplamlı, sığ ve tekrarlı | Veri odaklı olay motoru, zincir olaylar, gecikmeli sonuçlar |
| 97 | Röportaj | Maç sonu mini oyunu; kaptanlar daha sık | "Kötü röportaj mükemmel maçı siliyor" | Ton seçimi (mütevazı/iddialı/eleştirel), etki üst sınırlı |
| 98 | Gazete | Mizahi manşetler, 2.0'dan beri dergi markalı | Bilgi değil süs | Haber akışı + sosyal medya + söylenti; etkisi görünür |
| 99 | Haftalık özet | Weekly review ekranı | Sade | Haftalık özet + "bu hafta neler değişti" kayıt defteri |



### 1.5 Ekonomi ve IAP

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 100 | Oyun içi para | "bucks/bux/coins"; gerçekçi olmayan değerler (maç başı 1–14) | "40 gol atan oyuncu 3 coin alıyor"; değer hissi yok | Kurgusal para birimi, gerçekçi büyüklükler, yerel biçimli gösterim |
| 101 | Premium para | Star Bux; IAP, video ve "teklifler" ile | Para birimi simgeleri kaldırılmış, yanıltıcı ödeme ekranları | Premium para birimi yok |
| 102 | Gelir kaynakları | Ücret, gol/asist bonusu, sponsor, kaptanlık, at yarışı, kumar, milli maç ücreti | At yarışı futbolun 10 katı kazandırıyor | Futbol geliri baskın; yan gelirler tavanlı ve dengelenmiş |
| 103 | Banka | "10.000 bux", NSS5'te "$25M bankada" başarımları | Faiz ve yatırım yok | Vadesiz/vadeli, kredi, kredi notu, yatırım fonu |
| 104 | Yatırım ve işletme | Mülkler (kafe, otel, AVM) yalnız eşya | Gelir getirmiyor | Kira geliri, işletme kârı/zararı, risk |
| 105 | Vergi ve komisyon | Yok | Gerçeklik yok | Vergi dilimi (basit), ajan komisyonu, bonservis payı |
| 106 | Kramponlar | 10 model, maç süreli stat bonusu (+5..+40); en iyileri IAP | Ödemeli güç (pay-to-win) | Kramponlar yalnız kozmetik ya da çok küçük, oyun içi parayla; süre yok |
| 107 | NRG Bolt | £0,99 / 4'lü £2,99 | Doğrudan güç ve ilişki satın alma | Yok |
| 108 | Ajan / Antrenör IAP | Pro £1,99, Expert £3,99; 150 maç sonra biter | "Hiçbir yerde 150 maç yazmıyor" | Oyun içi parayla, süresi ve etkisi açıkça yazılı |
| 109 | Pitch & Weather Pack | £0,99 | Hava efektini paraya bağlamak | Tüm hava ve sahalar ücretsiz |
| 110 | Reklam kaldırma | "Remove Ads Pro License" £3,99 | Alındıktan sonra bile çapraz tanıtım; ödüllü reklam seçeneği gidiyor | Reklam yok |
| 111 | Zorunlu reklam | Maç ve antrenman sonrası 15–80 sn | Son yılların 1 numaralı 1★ sebebi | Yok |
| 112 | Ödüllü reklam | Enerji ve coin; çökme ve ödülsüz kalma | Güvenilmez | Yok (en fazla deneme sürümünde kozmetik, varsayılan kapalı) |
| 113 | Reklam onayı | Ogury penceresinde "Reddet" sonrası butonlar yer değiştiriyor | Dark pattern, AB'de yasal risk | Takip yok; ATT istemi yok; dark pattern yasağı belgeli |
| 114 | Yorum ödülü | Yorum karşılığı 10 Star Bux (kullanıcı beyanı) | Teşvikli yorum, mağaza kurallarına aykırı | Kesinlikle yok; sistem yorum API'si sınırlı ve ödülsüz |
| 115 | İş modeli geçişleri | Ücretli → F2P; eski alımlar tanınmadı | Güven kaybı | Tek seferlik kilit kalıcıdır; satın alımlar geri yüklenebilir, model değişse bile korunur |
| 116 | NSS5 modeli | Ücretsiz hesapta günde 3 maç, her maçta online; Premium $20 | DRM, kapanan sunucu | DRM yok, tamamen çevrimdışı |
| 117 | Ekonomi ölçeği | Fiyatlar SR'ye endeksli, eşyalar sabit | Enflasyon ilerlemeyi yiyor | Temel ihtiyaçlar sabit; masraf yalnız seçilen yaşam tarzıyla artar |

### 1.6 Kumarhane

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 118 | Erişim | Tek başına ya da takım arkadaşı davetiyle | Hocanın öğrenmesi ilişkiyi düşürür | Korunur; olay zinciri ve gizlilik riski |
| 119 | Bahis tutarları | 1, 2, 5, 7, 10, 15, 25, 50 | Ölçek sabit | Masa limitleri, VIP salon; servete göre ama tavanlı |
| 120 | Blackjack | Soft 17'de durur; BJ 1:1; 5-kart Charlie; double/split yok; EV ≈ 0,9986 | Yardım metni yanlış ("16"); eksik kurallar | Standart kurallar (double, split), doğru yardım metni, EV < 1 |
| 121 | Rulet | Amerikan (0 ve 00); basit bahis tipleri | Bahis çeşidi az | Avrupa ve Amerikan masası, temel bahis tipleri |
| 122 | Slot | 3 makara, 8 simge; topluluğa göre pozitif beklenen değer | Para basma makinesi | EV < 1, sim testli, oranlar görünür |
| 123 | At yarışı | 6 at; oranlar atın gücüne göre; yalnızca birinci kazandırır | — | Birinci, ilk üç ve ikili bahis; oranlar tutarlı |
| 124 | At sahipliği | Ahır (700) + at (~100); sınırsız at; kendi atınla birinci 100 | 40 at ile futboldan 10 kat gelir; "Race all horses" isteği | At sayısı ahır kapasitesiyle sınırlı, bakım masrafı, toplu yarıştırma kısayolu |
| 125 | Sorumlu oyun | "Kumar bağımlısı" manşeti; Boss, Fans, Partner düşer | Tek manşet | Bağımlılık göstergesi, stres, disiplin, sızan haber; oyuncu ayarıyla kumarhaneyi kapatma |
| 126 | Rüşvet / kendi maçına bahis | Şüpheli karakter teklifi; gazete tuzağı | Tek seferlik felaket | Kendi maçına bahis = ağır skandal zinciri (ceza, men), net uyarılar |
| 127 | Diğer oyunlar | Poker yok, zar yok | — | Zar (basit) [v2]; poker yalnızca turnuva hikâyesi olarak değerlendirilir [v3] |

### 1.7 Ligler ve Kupalar

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 128 | Lig sayısı | 80+ lig, 100+ ülke; İngiltere 6 kademe | Lisanssız kısaltılmış gerçek adlar ("MAN C") | Kurgusal dünya: v1'de 8+ ülke, ülke başına 2–4 kademe, 16–20 takım |
| 129 | Kulüp adları | 6 karakterlik kısaltmalar | Okunaksız, lisans gri bölgesi | Prosedürel kurgusal adlar, arma ve formalar; düzenlenebilir DB |
| 130 | Lig formatı | Çift devre; Avrupa kotası; doğrudan + play-off yükselme | Güncel olmayan veri, yanlış ligdeki takımlar | Kural motoru: yükselme/düşme, play-off, eşitlik kuralları; veri sürümlü |
| 131 | Özel formatlar | Bazı ülkelerde şampiyonluk/küme grupları | — | Kural şablonları (split lig, play-off) veri ile tanımlanır |
| 132 | Ülke kupaları | Kupa turları; üst ligler 2. turdan başlar | — | Yerel kupa + lig kupası + süper kupa |
| 133 | Kıtasal kupalar | 3 kademe Avrupa kupası + diğer kıtalar; katsayı sistemi | Fikstür hataları (gruplar, erken biten sezon) | Kıtasal 3 kademe; 100 sezonluk otomatik fikstür testleri |
| 134 | Eksik turnuvalar | Süper Kupa, Kulüpler Dünya Kupası, ulusal süper kupalar yok | "WE NEED MORE COMPETITIONS" | Süper kupalar [v1], Kulüpler Dünya Turnuvası [v2] |
| 135 | Milli turnuvalar | Dünya Kupası (4 yılda bir, 32 takım), kıta şampiyonaları; Uluslar Ligi yok | Euro çeyrek finali hatası, maçın oyuncusuz oynanması | Elemeler + kıta şampiyonası + Dünya Turnuvası + uluslar ligi [v2]; altyaş turnuvaları |
| 136 | Veri güncelliği | Yıllık veri; yalnız yeni kariyerlere uygulanır | "Kadrolar güncel değil" | Kurgusal dünya kendi içinde yaşar; veri paketleri sürümlü ve güvenle uygulanır |
| 137 | Kadın ligleri | 2024'te eklendi | Sakallı sprite'lar, yanlış zamir | Kadın futbol dünyası tutarlı avatar ve dil kurallarıyla |
| 138 | Takvim | Yıl ve turnuva yeri belirsiz | "Hangi yıldayım?" | Takvim ekranı: yıl, hafta, pencereler, turnuva ev sahibi |
| 139 | Kadro ve takım arkadaşları | İsimsiz takım arkadaşları; kadro ekranı yok | "Takım arkadaşlarımın adı olsun" | Tam kadro, numaralar, profiller, ilişkiler |
| 140 | İstatistik ve rekorlar | Sezon/kariyer istatistikleri, kulüp geçmişi | Gol/asist krallığı, kulüp rekorları yok | Krallık tabloları, kulüp ve lig rekorları, rekor kırma bildirimi |
| 141 | Kulüp sürekliliği | Kulüp değiştirip dönünce takım sıfırlanıyor | Dünya kalıcı değil | Kalıcı dünya: kulüpler gelişir, düşer, hoca değişir |

### 1.8 Başarımlar

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 142 | Başarım sayısı | Mobilde 107; NSS5'te Steam başarımları | Çoğu sayma odaklı (gol, maç) | ~80 Steam/mobil başarım + oyun içi "kariyer hedefleri" |
| 143 | Gol ve maç başarımları | İlk gol, hat-trick, 50/100 gol, 100/250/500/1000 maç | Grind'e yönlendiriyor | Beceri ve hikâye başarımları ağırlıklı (ör. "rabona ile gol") |
| 144 | Yaşam başarımları | Tüm eşya/araç/mülk, %100 lifestyle | Her şeyi almaya iter | Koleksiyon hedefleri isteğe bağlı, gizli başarımlar |
| 145 | Kumar başarımları | Rulet, slot, blackjack, at yarışı kazancı | Kumarı teşvik eder | Kumar başarımları yok (yaş derecelendirme ve etik) |
| 146 | IAP başarımları | NRG ve krampon alma | Satın almayı ödüllendirir | Satın alma ile bağlantılı başarım yok |
| 147 | Lider tablosu | Game Center / Google Play; kariyer skoru | Hile korumasız | Opsiyonel tablolar, sunucu tarafı doğrulama |

### 1.9 Görsel ve UI Ekranları

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 148 | Ana menü | New Career / Continue (3 slot), Practice, Options, About | Sade, "About" hatalı | Kayıt kartları (avatar, kulüp, sezon), Devam büyük CTA |
| 149 | Oyuncu yaratma | İsim, ülke, cinsiyet, zorluk | Görünüm ve pozisyon yok | Canlı önizlemeli yaratıcı: yüz, saç, pozisyon, arketip, geçmiş |
| 150 | Ana ekran (hub) | İsim, cinsiyet simgesi, enerji barı, Substitute barı, sonraki maç, kısayollar | Bilgi yoğun ve dağınık | "Sıradaki Maç" kartı + 3 zaman dilimi + bildirimler; alt navigasyon |
| 151 | Antrenman ekranı | 5 mini oyun seçimi | Ne kazandıracağı belirsiz | Kart başına beklenen XP ve süre |
| 152 | İlişkiler ekranı | 5 bar + memory mini oyunu | Barlar bağlamsız | İlişki ağı görseli, kişi kartları, son 5 olay |
| 153 | Mağaza | NRG, Boots, Lifestyle (Items/Vehicles/Property, Repair All), Staff, Star Bux | Gerçek para ile oyun parası iç içe | Oyun içi mağaza ile kozmetik mağaza tamamen ayrı |
| 154 | Kumarhane ekranı | 4 oyun + ahır; 12'den fazla atta kaydırma hatası | Liste hatası | Sanallaştırılmış listeler, toplu işlem |
| 155 | Sözleşme ekranı | Ücret, bonuslar, transfer değeri, Renew, Hi-Lo | Madde azlığı | Karşılaştırmalı teklif görünümü |
| 156 | Fikstür, puan durumu, istatistik, kulüp geçmişi, form | Ayrı ekranlar | Görsel olarak zayıf | Bölgeli puan durumu, sparkline, ısı ve şut haritaları |
| 157 | Gazete ve Weekly Review | Dergi markalı manşetler | Sadece metin | Manşet tipografisi, prosedürel duotone görseller, sosyal medya akışı |
| 158 | Maç öncesi | Pre-match stats ve yardım (1.5+) | — | Rakip analizi, form, hava, TD talimatı |
| 159 | Maç HUD | Üstten saha, sürükleme oku | "Parmak her işi yapıyor", oyuncu görünmüyor | Minimal HUD, kahraman halkası, şut yayı |
| 160 | Görsel stil (Classic) | 2000'lerin Flash oyunu hissi, sprite oyuncular | Retro sevenler var, yeni oyuncuya eski | "Gece Maçı" kimliği + isteğe bağlı Retro görünüm modu |
| 161 | Görsel stil (2.0 / 2024) | 3D modeller, skeuomorphic menüler; 2024 yenilemesi | "Sadelik gitti" (142 oy, 1★) | Sade, okunaklı, vektör/flat; ağır 3D yok |
| 162 | Tipografi | Okunması zor font | "UI çirkin ve bilgi vermiyor" | Barlow Condensed + Inter + Teko, tabular rakamlar |
| 163 | Emeklilik ekranı | Kariyer skoru | Duygusal zirve yok | Kariyer belgeseli tarzı özet, Onur Listesi |
| 164 | Paylaşım | Facebook paylaşımı | Platform bağımlı | Sistem paylaşım sayfası: highlight klip, sezon özeti kartı |

### 1.10 Ses

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 165 | Maç sesleri | Güçlü "whack" vuruş sesi (2.0), yağmur sesi, az tezahürat | Minimal | Katmanlı kalabalık, skora duyarlı ambiyans, direk/file sesleri |
| 166 | Müzik | Maç içinde müzik yok; menüde minimal | Kimlik yok | Hub müziği (gün/gece), stinger'lar, dinamik maç öncesi müzik |
| 167 | Kullanıcı müziği | 2.0'da geri geldi | — | Sistem müziğiyle karışma (ducking) seçeneği |
| 168 | Ses ayarı | Ana menüde Mute | Ayrı kanal yok | Müzik, efekt, UI, ambiyans için ayrı ayar |
| 169 | Anlatım | Metin akışı | Sesli anlatım yok | Metin anlatım TR/EN [v1], sesli anlatım [v3] |

### 1.11 Platform

| # | Özellik | NSS'de nasıl | Sorun / Eksik | StarPath'te ne yapıyoruz |
|---|---|---|---|---|
| 170 | Mobil | iOS, Android (eskiden Windows Phone); Monkey X motoru | Çökme ve donma (maç sonu, reklam sonrası, kulüp değişimi) | Capacitor 8; crash-free oturum ≥ %99,8 hedefi |
| 171 | PC | NSS5 (2011/2012), terk edilmiş; DRM, "exception access violation" | "Ölü oyun", "PC'ye geri getirin" | Steam (Electron + steamworks.js), Steam Deck Verified hedefi |
| 172 | Web | Flash dönemi (Miniclip vb.) | Flash öldü | PWA/demo |
| 173 | Çevrimdışı | Mobil tamamen çevrimdışı | En sevilen özelliklerden | Korunur; tüm çekirdek oyun çevrimdışı |
| 174 | Bulut kayıt | Yok; Google+ ile girişe rağmen geri yükleme yok | 14 yıllık kariyer kaybı | Steam Cloud, iCloud, Play Games Saved Games, elle dışa aktarma |
| 175 | Kayıt güvenliği | Reklamın zorla yüklediği uygulama kaydı sildi | Kayıt kaybı | Atomik yazma, checksum, 3 yedek, otomatik kurtarma |
| 176 | Gamepad | NSS5'te Xbox 360 gamepad önerilir | Mobilde yok | Tam gamepad desteği, dinamik tuş ikonları |
| 177 | Erişilebilirlik | Neredeyse yok | — | Renk körlüğü, font ölçek, ekran okuyucu, azaltılmış hareket, yardımlı nişan |
| 178 | Dil | İngilizce ağırlıklı | Kadın kariyerinde zamir hatası | TR + EN [v1], 6 dil daha [v2], ICU cinsiyet kuralları |
| 179 | Güncelleme sıklığı | Yıllarca anlamlı güncelleme yok | "3 yıldır hiçbir şey değişmedi" | Lansman sonrası sezonluk içerik güncellemeleri ve açık yol haritası |
| 180 | Destek | Geliştirici bireysel destek veriyor (olumlu) | Ölçeklenmiyor | Oyun içi hata bildirimi (kayıt hash'i ekli), Discord, SSS |

**Envanter toplamı:** 180 satır (Kariyer 33, Maç 35, Yaşam/Lüks 16, İlişkiler 15, Ekonomi/IAP 18, Kumarhane 10, Ligler/Kupalar 14, Başarımlar 6, Görsel/UI 17, Ses 5, Platform 11).

---

## 2. Ekleyeceklerimiz ve Geliştireceklerimiz

Her alt bölümdeki maddeler kendi içinde sürekli numaralandırılmıştır. Her madde bir backlog kartına dönüştürülebilecek kadar somuttur ve sürüm ([v1]/[v2]/[v3]) ile öncelik (P0/P1/P2) etiketi taşır.

> **Kapsam uyarısı:** Maddelerin büyük çoğunluğu [v1] etiketlidir, çünkü hedeflenen 1.0 deneyimini tarif ederler. Küçük bir ekip için 1.0'ın asıl kapsamını **[v1][P0]** maddeleri belirler. [v1][P1] maddeleri kapasite el verdiği ölçüde girer, [v1][P2] maddeleri ise Beta'da kesin olarak değerlendirilir ve gerekirse ilk lansman sonrası sezona kaydırılır. Bu ayıklama, bölüm 3'teki Dikey Kesit ve Alfa kapılarında yapılır.



### 2.1 Maç Motoru, Oyun Hissi ve Kontroller

NSS'nin "kritik an" formülünü koruyoruz, ama raydaki kaleciler, tutarsız rüzgâr, yavaş takım arkadaşları ve "sonuç önceden belli" hissi gibi kronik sorunları kökten çözüyoruz. Bu bölümdeki her madde, sahadaki performansın oyuncunun becerisine ve özelliklerine şeffaf biçimde bağlanmasını hedefliyor.

#### A. Simülasyon Çekirdeği, Adalet ve Determinizm

1. **[v1][P0]** Seed'li deterministik maç simülasyonu: Her maçın `rng.fork('match:<id>')` alt akışı vardır. Aynı seed ve aynı girdi dizisi, Windows, Android ve iOS'ta bit düzeyinde aynı skoru üretir. CI'da 1.000 maçlık golden master testiyle doğrulanır.
2. **[v1][P0]** Kullanıcı anının sonucu simülasyona gerçekten yazılır: Highlight'ta atılan gol, skoru ve sonraki dakikaların momentumunu değiştirir. "3–4 fırsatım vardı ama kaybettim" hissine karşı, oyuncunun kaçırdığı fırsat sayısı ile maç sonucu arasındaki ilişki maç sonu raporunda gösterilir.
3. **[v1][P0]** "Önceden belirlenmiş sonuç" yok: Maç sonucu, anlar oynanmadan hesaplanmaz. Simülasyon her an sonrası kalan dakikaları yeniden örnekler. Telemetri testinde, kullanıcının 2+ gol attığı maçlarda galibiyet oranı en az %70 olmalıdır.
4. **[v1][P0]** Save-scum politikası: Maç başladığında RNG durumu ve maç seed'i kayda yazılır. Uygulamayı kapatıp açmak aynı anları aynı başlangıç koşullarıyla yeniden üretir. Böylece "kapat-aç ile yeniden dene" istismarı anlamsızlaşır.
5. **[v1][P1]** Maç başına 1 "Tekrar Dene" hakkı (NSM'den): Kullanıcı tek bir anı bir kez tekrar oynayabilir. Hard modda kapalıdır, Kolay modda 2 haktır. Kullanılan hak maç raporunda görünür.
6. **[v1][P0]** Lig ve takım gücü maça yansır: Takım gücü farkı her 10 OVR puanı için şut üretimini yaklaşık %18 ve isabetli şut oranını yaklaşık %6 değiştirir. Test: Alt lig takımı üst lig takımını 1.000 simülasyonda en fazla %12 yener (NSS'de "Norwich = Man U" şikâyetine karşı).
7. **[v1][P0]** Erken skor patlamasına fren: Kullanıcı ilk anına ulaşmadan rakip en fazla 1 gol farkla öne geçebilir. Bu kural yalnızca ilk 15 dakika için geçerlidir. Amaç, "topa dokunmadan 4-0 gerideyim" şikâyetini önlemek.
8. **[v1][P0]** İmkânsız fırsat filtresi: An üretici, başarı olasılığı %8'in altındaki fırsatları (ör. 23 metreden kafa, 7 savunmacı arasına orta) üretmez. Bunun yerine geri pas veya top saklama anı sunar.
9. **[v1][P0]** Fırsat bütçesi formülü: Maç başına 4–9 an. Formül, mevki, oyun süresi, takım arkadaşı ilişki ortalaması, odak modu (hücum/denge/savunma) ve Pozisyon Alma özelliğine dayanır. Formül, maç öncesi ekranda "beklenen an: 5–7" olarak gösterilir.
10. **[v1][P1]** Momentum modeli: Son 10 simüle dakikadaki şut ve korner üstünlüğü momentum barını belirler. Gol yiyen takım 5 dakika boyunca %10 daha fazla pres yapar. Momentum, radar ekranında ok olarak gösterilir.
11. **[v1][P1]** Ev sahibi avantajı: Gol beklentisine +%8 eklenir. Kalabalık kapasitesi 30.000'i aşıyorsa, deplasman takımının kart eşiği %5 düşer.
12. **[v1][P0]** Yorgunluk simülasyona girer: 70. dakikadan sonra kondisyonu %40'ın altındaki oyuncuların Hız ve İlk Dokunuş değerleri %10 düşer. Kullanıcının anlarında da bu etki hissedilir.
13. **[v1][P1]** Anlar arası canlı simülasyon hızı: 1x, 2x, 4x ve "bir sonraki anıma atla" seçenekleri vardır. Atlama, simülasyon sonucunu değiştirmez (deterministik test).
14. **[v1][P0]** Maç sonu reyting formülü şeffaf: Döküm şu biçimde gösterilir: "+1,5 gol, +0,8 asist, −0,4 kaçan pas, +0,3 kazanılan ikili mücadele". Bir gol ve 2 asistle 5 fırsatta reyting asla 7,0'ın altına düşmez.
15. **[v1][P1]** Takım sonucu ile bireysel puanın ayrılması: Hat-trick yapılan 5-3'lük yenilgide kullanıcının reytingi en az 7,5 olur. Takım arkadaşı ilişkisi düşmez.
16. **[v2][P2]** Tam maç modu: İsteyen oyuncu 90 dakikayı (devre başına 3–15 dk ayarlı) tek oyuncuyu kontrol ederek oynar (NSS5 benzeri). Highlight modu varsayılan kalır.
17. **[v1][P1]** Maç simülasyonu performans bütçesi: 90 dakikalık arka plan simülasyonu, düşük uçlu Android'de 15 ms'nin altında tamamlanır. Lig turu toplu simülasyonu Web Worker'da çalışır.

#### B. Kontroller ve Giriş

18. **[v1][P0]** Sapan (geri sürükle) şut ve pas: NSS'nin imza kontrolü korunur. Sürükleme yönü açıyı, uzunluk gücü belirler. Hız vektörü son 80 ms'lik zaman damgalı örneklerden hesaplanır ve kare hızından bağımsızdır.
19. **[v1][P0]** Ok rengiyle güç göstergesi: Yeşil (0–60), sarı (60–85), kırmızı (85–100). Kırmızı bölgede Şut isabeti Soğukkanlılık'a bağlı olarak %15'e kadar sapar. Maksimum güçte 0,3 sn beklenirse sürüklemeye geçilir (NSM'den).
20. **[v1][P0]** Şut ve pas yörünge önizlemesi (ark): Yerde kesikli çizgi ve topun düşeceği noktada "X" işareti gösterilir. Önizleme uzunluğu Vizyon ile ölçeklenir: Vizyon 40'ta yolun %35'i, 80'de %70'i görünür. Hard modda kapalıdır.
21. **[v1][P0]** Kuvvet oku mutlak güçtür: NSS'deki "hedefe göre göreceli güç" sorunu kaldırılır. Okun aynı uzunluğu her zaman aynı top hızını (m/s) verir. Güç değeri ok ucunda sayıyla yazılabilir (ayar).
22. **[v1][P0]** Alternatif kontrol şeması "Dokun + güç çubuğu": Hedefe dokun, salınan çubuğu durdur. Motor becerisi farklı oyuncular için tüm anlar bu şemayla oynanabilir.
23. **[v1][P0]** PC fare kontrolü: Sol tuşla topun üzerinden geriye sürükle-bırak. Sağ tık ara pas, Shift + şut aşırtma. Fare tekerleği falso miktarını ±%100 aralığında ayarlar.
24. **[v1][P0]** Gamepad şeması: Sol analog nişan, sağ tetik basıncı güç (analog), sağ analog falso, A pas, B şut, Y ara pas, LB aşırtma. Ölü bölge ayarı %5–25 arasındadır.
25. **[v1][P1]** Tüm tuşlar yeniden atanabilir: Klavye, fare ve gamepad için profil kaydedilir. Çakışan atamada uyarı verilir.
26. **[v1][P0]** Bullet-time nişan penceresi: Top oyuncuya ulaştığında oyun 0,25x hıza iner. Süre 1,2 sn + Soğukkanlılık×0,02 sn olur (Soğukkanlılık 80'de 2,8 sn). Bu süre baskı altındaki savunmacı mesafesi 2 m'nin altına inince yarıya düşer.
27. **[v1][P1]** Bullet-time ayarı: Kapalı, Kısa, Normal ve Uzun seçenekleri vardır. Ödül çarpanı uzun modda ×0,9, kapalı modda ×1,15 olur.
28. **[v1][P0]** Yardım seviyeleri: Tam (ark + otomatik hedef mıknatısı 1,5 m), Yarı (ark, mıknatıs yok) ve Manuel (ark yok). Ödül çarpanları ×0,85, ×1,0 ve ×1,2'dir. Seviye maç öncesi değiştirilebilir.
29. **[v1][P0]** Pas mıknatısı: Hedef oyuncuya 1,5 m içinde atılan pas, alıcının İlk Dokunuş değerine göre kontrol edilir. Bu, NSS'deki "topu tam ayağına atmalısın" milimetrik zorunluluğunu kaldırır.
30. **[v1][P1]** İptal hareketi: Sürükleme başlangıç noktasına geri götürülürse vuruş iptal olur (NSM'deki CANCEL). Mobilde ayrıca köşede iptal butonu bulunur.
31. **[v1][P1]** Sol el modu ve dokunma alanı ölçeği: Sanal joystick ve sprint butonu yer değiştirir. Dokunma hedefleri %80–150 arasında ölçeklenir.
32. **[v1][P1]** Pinch ile saha görünümü (Read'in NSS2 fikri): An sırasında iki parmakla uzaklaştırınca sahanın %80'i görünür. Bu sayede 40 m'yi aşan uzun paslar seçilebilir. Bullet-time süresi bu sırada donar.
33. **[v1][P1]** Topsuz koşu yönlendirme: Kaptan olmasa da oyuncu, anın ilk 0,5 sn'sinde kendi koşu yolunu sürükleyerek çizebilir (Retro Goal/NSM'deki koşu çizme).
34. **[v1][P0]** Girdi olayı formatı: Her vuruş `{t, dx, dy, curve, lift}` olarak kaydedilir. Replay ve hata raporu bu kayıtla birebir yeniden üretilir.
35. **[v2][P2]** Gelişmiş PC şeması: Klavyeyle tam oyuncu kontrolü (WASD hareket, Space çalım, Q/E skill move). Tam maç modu ile birlikte gelir.

#### C. Top Sürme ve Çalım

36. **[v1][P0]** Dribbling anı: Joystick ya da sürükleme ile topla 3–8 sn koşulur. Top ayaktan uzaklaşma mesafesi Dribbling özelliğine bağlıdır: 40'ta 1,6 m, 80'de 0,9 m. Sprintte bu mesafe %40 artar.
37. **[v1][P0]** Savunmacı top kapma denemesi: Rakip 1,2 m içine girdiğinde Top Kapma ile Dribbling arasında olasılık hesaplanır. Olasılık, top ayaktan uzaksa %25 artar. Sonuç görsel olarak okunur.
38. **[v1][P1]** Çalım hareketleri: Topu çekme (çift dokunma), makas (dairesel swipe), elastico ve rabona perkle açılır. Her hareketin başarı penceresi 0,2–0,4 sn'dir ve Çeviklik ile genişler.
39. **[v1][P1]** İlk dokunuş yönlendirmesi: Top gelirken swipe yapılırsa ilk dokunuş o yöne gider. İlk Dokunuş 70'in üstündeyse dokunuşla birlikte rakipten 1 adım kazanılır.
40. **[v1][P1]** Vücut kalkanı: Topla sırtı dönük beklerken savunmacı arkadan gelirse Güç karşılaştırması yapılır. Güç farkı 15'i aşarsa top saklanır ve faul kazanma şansı doğar.
41. **[v1][P1]** Sprint ve dayanıklılık: Sprint, maç içi kondisyonu 1 puan/sn tüketir. Dayanıklılık 80'de tüketim %30 azalır. Kondisyon %20'nin altına inerse sprint kapanır.
42. **[v1][P2]** Dribbling sonrası karar: Çalım başarılı olursa anı uzatan "şut / pas / devam" seçimi açılır. Bu, NSS'de yalnızca tek eylemle biten dribbling anını derinleştirir.
43. **[v2][P2]** Skill move kombinasyonları: 2 hareket 1 sn içinde art arda yapılırsa başarı +%10 olur. Perk "Sokak Futbolcusu" ile açılır.

#### D. Şut, Falso ve Bitiricilik

44. **[v1][P0]** 2.5D şut fiziği: Top x, y ve z (yükseklik) eksenlerinde hareket eder. Yerçekimi 9,81 m/s², çim sürtünmesi 0,35, hava direnci katsayısı ise top hızının karesiyle orantılıdır. Şut hızı 18–34 m/s aralığındadır ve Şut özelliğiyle ölçeklenir.
45. **[v1][P0]** Magnus falso: Sürükleme yolunun eğriliği spin verir. Kavis maksimum 3,5 m sapma yapar ve Teknik/Şut ortalamasıyla ölçeklenir. Kafa vuruşu asla ayak vuruşundan fazla kavis yapamaz (NSS'deki "kafa ayaktan fazla falso alıyor" hatasının çözümü).
46. **[v1][P1]** Aftertouch (havada falso): Şut sonrası 0,35 sn içinde parmak kaydırılarak ek kavis verilir. Maksimum 1,2 m'dir. NSS'de bu özellik paralı SWERVE kramponuna bağlıydı; bizde "Kavis Ustası" perkiyle oynanarak açılır.
47. **[v1][P0]** Plase, düz ve aşırtma şut tipleri: Plase vuruşta isabet +%15, hız −%25. Aşırtma vuruşta yükseklik 2,5–4 m olur ve başarısı kalecinin çizgiden uzaklığına bağlıdır.
48. **[v1][P1]** Vole ve yarım vole: Top 0,4–1,2 m yükseklikteyken vuruş zamanlama penceresi 0,15 sn'dir. Pencere Çeviklik 80'de 0,22 sn'ye çıkar. Mükemmel zamanlama +%20 hız verir.
49. **[v1][P1]** Zayıf ayak cezası: Topun zayıf ayak tarafında olduğu açılarda isabet −%20 uygulanır. "İki ayaklı" perki bu cezayı %5'e düşürür.
50. **[v1][P1]** Baskı altında şut: En yakın savunmacı 1,5 m'den yakınsa nişan konisi %30 genişler. Soğukkanlılık 80'in üstündeyse bu etki yarıya iner.
51. **[v1][P0]** Direk ve üst direk sekmesi: Direk silindir çarpışma modelidir ve restitüsyonu 0,6'dır. Top direkten çizgiyi tam geçerse gol sayılır. Gol tespiti topun tamamının çizgiyi geçmesiyle yapılır. Bu durum için 200 regresyon testi yazılır (NSS'de "direkten girdi, kaçtı dedi" hatasına karşı).
52. **[v1][P1]** File fiziği: Top fileye çarptığında hız sönümlenir ve top ağda kalır. Ağ deformasyonu görseldir ancak gol kararını etkilemez.
53. **[v1][P1]** Uzaktan şut (25 m+): İsabet Şut×0,7 + Güç×0,3 ile hesaplanır. 30 m'yi aşan golde "Süper Vuruş" etiketi verilir.
54. **[v1][P1]** Bitiricilik ile Şut ayrımı: Ceza sahası içinde Bitiricilik, dışında Şut özelliği isabet konisini belirler. Koni 40 puanda ±6°, 80 puanda ±2,5° olur.
55. **[v1][P2]** Kaleci-kullanıcı göz teması ipucu: Kaleci yanlış ağırlık aktarırsa (bir ayağına yüklenirse) 0,2 sn boyunca hafif bir parlama görünür. Bu ipucu Vizyon 70 ve üzerinde gösterilir.
56. **[v2][P2]** Rabona ve topuk vuruşları: Perkle açılır, risklidir (isabet −%25) ve gol olursa taraftar ilişkisine +3 bonus verir.

#### E. Pas, Orta ve Kombinasyon

57. **[v1][P0]** Pas tipleri: Yerden kısa, ara pas (koşu yoluna), havadan uzun ve çipli pas. Her tipin hız aralığı ayrı tanımlanır (kısa pas 8–16 m/s). Alıcının kontrol olasılığı alıcının İlk Dokunuş değerine ve topun hızına bağlıdır.
58. **[v1][P0]** Başarılı pas tanımı: Top takım arkadaşına ulaşırsa (sekme dahil) pas başarılı sayılır. NSS'deki "takım arkadaşına sekip başka arkadaşa geçti ama başarısız dendi" hatası test senaryosuyla engellenir.
59. **[v1][P0]** Ver-kaç (Read'in NSS2 fikri): Pas sonrası 1,5 sn içinde boş alana swipe yapılırsa oyuncu koşar ve topu geri ister. Takım arkadaşı Pas ≥55 ise topu tek dokunuşla geri verir.
60. **[v1][P0]** Vizyon ile görünen pas seçenekleri: Vizyon 30'da 2, 60'ta 4, 85'te tüm takım arkadaşları pas hedefi olarak vurgulanır. Ofsayttaki hedef kırmızı çerçeveyle gösterilir.
61. **[v1][P1]** Orta anı: Kanatta orta açma yeri ve yüksekliği seçilir. Ceza sahasındaki takım arkadaşlarının koşuları 0,5 sn önceden ok olarak görünür. Ortanın isabet konisi Orta özelliğine bağlıdır.
62. **[v1][P0]** Orta kamera tutarlılığı (motor tarafı): Orta anında yan görünüm ile ana görünüm aynı fizik durumunu paylaşır ve top, oyuncu konumları birebir aynıdır. Test: Geçişte konum farkı 0 cm olmalıdır (174 oylu NSS şikâyetine karşı).
63. **[v1][P1]** Takım arkadaşı ilişkisinin pasa etkisi görünür: İlişkisi −30'un altındaki arkadaş, kullanıcıya pas verme olasılığını %40 düşürür. Bu durum maç içinde balonla duyurulur: "Arda sana pas vermiyor (ilişki: kötü)".
64. **[v1][P1]** Pas isteme: Topsuz anda butona basınca takım arkadaşı Vizyon değerine göre topu verir. Hücum odaklı modda bu istek 2 kez kullanılabilir.
65. **[v1][P2]** Kör pas (no-look): Vizyon 85+ perki ile açılır. Savunmacının pas arası olasılığını %15 düşürür.
66. **[v2][P2]** Üçlü kombinasyon anı: 3 ardışık tek dokunuş pas, takım arkadaşlarının hareketiyle birlikte zincir an olarak oynanır.

#### F. Kafa Vuruşu ve Hava Topları

67. **[v1][P0]** Kafa vuruşu anı: Topun iniş noktasına zamanlamayla dokunulur. Zıplama yüksekliği Zıplama özelliğine bağlıdır (40'ta 0,45 m, 85'te 0,8 m). İsabet ise Kafa özelliğine bağlıdır.
68. **[v1][P0]** Kafa yön kontrolü: Topun üstüne vurmak aşağı, altına vurmak yukarı kafa sağlar (NSM'den). Aşağı kafa, kaleci için zor seken top üretir ve sektirme olasılığı %30'dur.
69. **[v1][P1]** Hava topu ikili mücadelesi: Savunmacıyla Zıplama + Güç + zamanlama karşılaştırılır. Zamanlama penceresi ±0,12 sn'dir. Kazanan topa dokunur.
70. **[v1][P1]** Kafa ile pas indirme: Golcü, kafayla topu 5 m içindeki bir takım arkadaşına indirebilir. Bu bir asist zinciri başlatır.
71. **[v1][P0]** Kafa vuruşu menzil sınırı: 18 m'nin ötesinde kafa vuruşu anı üretilmez (imkânsız fırsat filtresiyle birlikte).

#### G. Savunma, Top Kapma ve Kayarak Müdahale

72. **[v1][P0]** Savunma anları: Stoper ve bek için "pas arası", "1'e 1 karşılama", "kayarak müdahale" ve "blok" anları vardır. NSS'nin kaldırdığı tek savunma eylemi (intercept) geri gelir ve genişler.
73. **[v1][P0]** Kayarak müdahale (297 oylu istek): Mesafe oku kırmızıya döndüğünde (≤2,2 m) kaydırılır. Başarı Top Kapma×0,6 + zamanlama×0,4 ile hesaplanır. Arkadan girmek her zaman faul sayılır, 35 km/s üstü temasta sarı kart olasılığı %40'tır.
74. **[v1][P0]** Ayakta müdahale: Rakip topu ayağından 0,8 m'den fazla uzaklaştırdığında dokunulursa başarı oranı %70'tir. Erken dokunuş çalımla geçilme riski taşır.
75. **[v1][P1]** Jockey (geri geri savunma): Basılı tutunca savunmacı rakibi karşılar. Pozisyon Alma özelliği rakibin çalım başarısını %15'e kadar düşürür.
76. **[v1][P1]** Şut bloğu: Rakip şut çekerken şut çizgisine 0,3 sn içinde girilirse blok olasılığı %55 olur. Kasıtsız el pozisyonu VAR kontrolüne gider.
77. **[v1][P1]** Pas arası okuması: Rakip pas çizgisi Vizyon ≥60'ta 0,2 sn önce kesikli çizgi olarak görünür. Çizgiye girilirse top kesilir.
78. **[v1][P1]** Ofsayt tuzağı (kaptan stoper): Savunma hattını tek dokunuşla 3 m yukarı çeker. Liderlik 70'in üzerindeyse hat senkronu %90 tutar, altındaysa bir oyuncunun geride kalma riski vardır.
79. **[v1][P1]** Savunma reyting katkıları: Top kapma +0,3, blok +0,4, kritik kurtarış niteliğindeki müdahale +0,8 ve çizgiden çıkarma +1,0 puan verir. Savunmacılar gol atmadan da 8+ reyting alabilir.
80. **[v1][P2]** Taktik faul: Kontra atağı orta sahada faulle kesmek kullanıcıya bırakılan bir seçimdir. Sarı kart olasılığı %80'dir. Takım ilişkisine +1, taraftara −1 etki eder.

#### H. Kaleci (YZ ve Kaleci Kariyeri)

81. **[v1][P0]** Raydan çıkan YZ kaleci: Kaleci 2D'de serbest hareket eder (açı kapatma, çıkış, geri çekilme). Tepki gecikmesi Refleks'e bağlıdır: 40'ta 0,32 sn, 85'te 0,16 sn. NSS'deki tek eksenli tahmin edilebilir kaleci sorunu giderilir.
82. **[v1][P0]** Kaleci karar modeli: Uzanma, tutma, yumruklama ve sektirme kararları topun hızı ve yüksekliği ile Top Tutma özelliğine göre verilir. 25 m/s'yi aşan şutlarda tutma olasılığı Top Tutma 80'de %45'tir.
83. **[v1][P0]** Kaleci tutarlılığı: Kurtarış olasılığı, şutun xG değeri ile kaleci özelliklerinden türetilen sürekli bir fonksiyondur. Test: Aynı şut 1.000 kez simüle edildiğinde sonuçların standart sapması beklenen dağılımın dışına çıkmaz (NSS'de "ya imkânsızı kurtarıyor ya top içinden geçiyor" şikâyetine karşı).
84. **[v1][P1]** Yan pas istismarının kapatılması: YZ kaleci, yavaş yan pası 0,3 sn gecikmeyle takip eder ve yeniden konumlanır. Boş kale golü, olasılığı yalnızca %35'te kalan bir ödül olur.
85. **[v1][P0]** Kaleci kariyeri (516 oylu istek): Karakter yaratmada Kaleci mevkisi seçilebilir. Maç başına 4–8 kaleci anı bulunur: kurtarış, çıkış, 1'e 1, korner yakalama, penaltı ve oyun kurma.
86. **[v1][P0]** Kaleci kurtarış kontrolü: Mobilde kaydırma yönüne uzanılır (sola kaydırınca sola). Kaydırma uzunluğu atlayış mesafesini belirler. Zamanlama penceresi, Refleks 50'de 0,25 sn ve Refleks 85'te 0,4 sn'dir.
87. **[v1][P0]** Kaleci penaltı okuması: Rakip koşu yaparken vücut açısı ve destek ayağının yönü ipucu olarak gösterilir. İpucu, Refleks ≥70 olduğunda 0,15 sn daha erken belirir. Erken atlamak ise rakibe ortaya vurma şansı tanır.
88. **[v1][P1]** Kaleci çıkış anı: Ara pasa çıkış kararı tek dokunuşla verilir. Topa önce ulaşma olasılığı Hız ve kaleci Pozisyon özelliğinden hesaplanır. Geç kalınırsa penaltı riski %30'dur.
89. **[v1][P1]** Kaleci oyun kurma: Kurtarıştan sonra el ile atış veya uzun vuruş anı gelir. Kaleci Oyun Kurma 70'in üstündeyse kontra atak asisti mümkün olur.
90. **[v1][P1]** Kaleci korner hâkimiyeti: Ortaya çıkıp yakalama veya yumruklama kararı verilir. Kalabalık ceza sahasında başarısız çıkış gol riskini %40 artırır.
91. **[v1][P1]** Kaleci reytingi: Kurtarış başına xG değeri kadar puan kazanılır. Gol yeme cezası şutun xG değeriyle ters orantılıdır: 0,8 xG'lik golde ceza yalnızca −0,1'dir. Kaleci gol yemeden de düşük reyting almaz.
92. **[v2][P1]** Kaleci yönetimi: Savunma hattına yüksek, alçak veya baraj sayısı talimatı verilir. Liderlik özelliği uygulanma oranını belirler.

#### I. Duran Toplar

93. **[v1][P0]** Penaltı (atıcı): Nişan, güç ve falso ayarlanır. Panik sistemi şöyle işler: Soğukkanlılık 50'nin altında ve maç kritikse (90+ dakika, eşitlik) nişan noktası 0,5 Hz'de ±0,4 m titrer.
94. **[v1][P0]** Penaltıda YZ kaleci: NSS'deki gibi "her zaman bir tarafa atlar" kuralı yoktur. Kaleci %15 olasılıkla ortada kalır ve atıcının son 5 penaltı yön geçmişini hatırlar. Bu, ortaya yerden vuruş istismarını kapatır.
95. **[v1][P0]** Serbest vuruş: Baraj 3–6 kişidir, mesafe 9,15 m'dir. Baraj zıplaması rastgele değil, kaleci talimatına bağlıdır. Kavis, Duran Top özelliğiyle 4 m'ye kadar çıkar. Kalecinin yan görüş açısı simüle edilir.
96. **[v1][P1]** Serbest vuruşta pas seçeneği: Kısa pas ile organize varyasyon (2 adımlık setup) yapılabilir. Kaptan iseniz 3 varyasyondan biri seçilir.
97. **[v1][P0]** Korner: Kullanıcı kornerciyse yükseklik ve kavis seçilir. Kullanıcı ceza sahasındaysa kafa anı gelir. Doğrudan korner golü mümkündür ve kaleci yakın direği kapatma davranışı gösterir.
98. **[v1][P0]** Kornerde ofsayt yok kuralı: Korner vuruşunda ofsayt kontrolü yapılmaz. Bu kural birim testle sabitlenir (NSS'deki hata 2.14.3'te geç düzeltilmişti).
99. **[v1][P1]** Taç atışı: Kısa taç anı gelir. "Uzun Taç" perki ile ceza sahasına 25 m'lik atış mümkün olur ve kafa anı başlatır.
100. **[v1][P1]** Penaltı atışları (eleme maçı): 5'er atış, sonra tek tek devam edilir. Kullanıcı kaçıncı sırada atacağını seçer. Takım arkadaşı ilişkisi kimin gönüllü olduğunu etkiler.
101. **[v1][P1]** Penaltıyı kim atacak kararı: Sabit penaltıcı değilseniz topu almak bir seçenektir. Kaçırırsanız TD ilişkisine −5 ve takım ilişkisine −3 etki olur, atarsanız +2 ve +1 olur.

#### J. Hakem, Kartlar, Ofsayt ve VAR

102. **[v1][P0]** Ofsayt motoru: Ofsayt pas anındaki konuma göre kontrol edilir. Vücudun en ileri gol atabilen noktası esas alınır. Ofsayt kararları 500 senaryoluk birim test setiyle doğrulanır (NSS 2026 yorumlarındaki ofsayt hatasına karşı).
103. **[v1][P0]** Ofsayt görünürlüğü: An başında ofsayt çizgisi her zaman görünür (Hard modda yarı saydam). NSS'deki "bazen görünüyor, bazen görünmüyor" tutarsızlığı kaldırılır.
104. **[v1][P0]** Faul ve kart eşikleri: Temas hızı, açı (arkadan veya yandan) ve top oynanıp oynanmadığı faul olasılığını belirler. Hakemin sertlik değeri 1–5 arasındadır. Sarı kart olasılığı sertlik 3'te taktik faul için %80, geç müdahale için %55'tir.
105. **[v1][P0]** Kırmızı kart ve son adam kuralı: Son adam konumunda faul yapan savunmacı direkt kırmızı görür. Kullanıcı kırmızı görürse maçın kalanı simüle edilir ve 1–3 maç ceza uygulanır.
106. **[v1][P1]** Avantaj kuralı: Faul sonrası takım topu 2 sn içinde koruyorsa oyun devam eder. Avantaj başarısız olursa hakem faulü geri çalar. Kart sonradan gösterilir.
107. **[v1][P1]** Sakatlık riski: Sert temaslarda risk %0,5–3 arasındadır ve yorgunluk %30'un altına inince iki katına çıkar. Sakatlığın türü ve süresi (1–60 gün) maç sonu raporunda belirtilir.
108. **[v2][P1]** VAR: Gol, penaltı, kırmızı kart ve kimlik hatası olmak üzere 4 olay türü incelenir. İnceleme 3–6 sn sürer. Kararlar deterministiktir ve VAR maç sonu raporunda gerekçesiyle listelenir.
109. **[v2][P2]** Hakeme itiraz etme: Karar sonrası "itiraz et" seçeneği sunulur. %10 olasılıkla sarı karta dönüşmez ama TD ve taraftar ilişkisi değişir. Disiplin özelliği düşükse kart riski %35'tir.
110. **[v1][P2]** Simülasyon (yere yatma) eylemi: Ceza sahasında riskli seçimdir. Kazanırsa penaltı, yakalanırsa sarı kart olur. Olasılık hakem sertliğine bağlıdır. Sık kullanılırsa basında "Dalgıç" manşeti çıkar.

#### K. Takım Arkadaşı ve Rakip Yapay Zekâsı

111. **[v1][P0]** Takım arkadaşları topa gider: Pas sonrası alıcı, topun düşeceği noktaya kendi Hız değeriyle koşar ve topun gelişine 0,2 sn önceden döner. NSS'deki "1 mph'le koşan, ayağında demir top" şikâyeti kabul testi olarak tutulur: 20 m'lik ara pasta alıcının topa ulaşma oranı en az %85 olmalıdır.
112. **[v1][P0]** Pozisyonel YZ: Formasyon şablonu ve topun bulunduğu bölgeye göre kayma uygulanır. Takım arkadaşları derinlik koşusu (Pozisyon Alma ≥60) ve boşa çıkma hareketi yapar, pas için el kaldırır.
113. **[v1][P1]** Rakip pres davranışı: Rakip, takımın taktik kimliğine göre yüksek, orta veya düşük pres yapar. Pres yoğunluğu maç öncesi raporda yazılır ve kullanıcının bullet-time süresini etkiler.
114. **[v1][P1]** Rakip savunma hattı: Kademeli savunma ve alan kapatma uygulanır. Savunmacılar nişan alma sırasında 2,5 m/s ile üzerine gelir (NSS 1.5'teki mekanik korunur), beklemek ise aşırtma fırsatı yaratır.
115. **[v1][P1]** Lig seviyesine göre YZ kalitesi: Alt ligde savunmacı tepki gecikmesi 0,35 sn, üst ligde 0,18 sn'dir. Kaleci Refleks ortalaması lig kademesiyle ölçeklenir.
116. **[v1][P1]** Takım arkadaşı ribaund takibi: Şut sonrası en yakın 2 hücumcu ceza sahasına koşar. Kaptan ise bu koşuyu manuel yönlendirebilir (NSS kaptanlık özelliği genişletilir).
117. **[v2][P1]** Rakip yıldız YZ profili: "Nemesis" oyuncunun özel hareketleri (ör. iç tarafa kat edip şut) vardır. Kullanıcı savunmadaysa bu hareketler 3. karşılaşmada ipucu olarak gösterilir.
118. **[v1][P2]** YZ hata payı: Üst ligde bile takım arkadaşlarının %4–8 olasılıkla kontrol hatası yapması, kusursuz robot hissini engeller. Bu oran İlk Dokunuş'a bağlıdır.

#### L. Pozisyona Özel An Tasarımı

119. **[v1][P0]** Mevki seçimi ve an havuzu: Karakter yaratmada mevki seçilir: Golcü, Kanat, 10 Numara, Merkez Orta Saha, Bek, Stoper, Kaleci. Her mevkinin an dağılımı farklıdır. Örneğin Golcü için %50 şut, %20 kafa, %20 pas ve %10 dribbling.
120. **[v1][P0]** Golcü anları: Bire bir, ilk dokunuşta bitiricilik, sırtı dönük top saklama ve kafa. Golcünün an başına beklenen gol olasılığı ortalama 0,25–0,35'tir.
121. **[v1][P0]** Kanat anları: Çizgiye inip orta, iç tarafa kat edip şut ve bire bir dribbling. Kanatçıya maç başına en az 2 orta anı garanti edilir.
122. **[v1][P1]** 10 Numara anları: Ara pas, uzaktan şut, ver-kaç ve serbest vuruş. Vizyon 70'in üstündeyse "anahtar pas" anı ek olarak gelir.
123. **[v1][P1]** Merkez Orta Saha anları: Top kapma sonrası hızlı kontra pası, uzun top değiştirme ve ceza sahası dışından şut. Çalışkanlık, maç başına 1 ek savunma anı açar.
124. **[v1][P0]** Bek anları: Kanat oyuncusunu karşılama, bindirme koşusu ve orta, ayrıca arka direği kapatma. Hücum ve savunma anları %50/%50 dağılır.
125. **[v1][P0]** Stoper anları: Hava topu, kayarak müdahale, çizgiden çıkarma, uzun oyun kurma pası ve korner kafası. Maç başına en az 3 savunma anı garanti edilir.
126. **[v1][P1]** Mevki değişikliği: TD önerisiyle veya kullanıcı talebiyle sezon içinde mevki değiştirilebilir. Yeni mevkide ilk 10 maç boyunca −%10 performans uyum cezası uygulanır.
127. **[v2][P2]** Libero ve Box-to-Box hibrit rolleri: v2'de rol perkleriyle an dağılımı ±%15 kaydırılabilir.

#### M. Zorluk ve Dengeleme

128. **[v1][P0]** Baştan zorluk seçimi: Kolay, Normal, Zor ve Özel. Özel modda bullet-time, ark, mıknatıs, YZ tepkisi ve rüzgâr gücü ayrı ayrı ayarlanır. Bu, NSS'deki "Normal çok kolay, Hard çileden çıkarıcı" uçurumunu kapatır.
129. **[v1][P0]** Gerçekçi gol dengesi: Normal zorlukta en iyi oyuncunun sezonluk lig golü ortalaması 25–45 bandında kalmalıdır. 500 gollük sezon gibi uç sonuçlar 10.000 sezonluk simülasyonda %0,1'i geçmemelidir.
130. **[v1][P1]** Dinamik zorluk yok: Zorluk gizlice ayarlanmaz. Sonucu etkileyen tüm faktörler (rakip gücü, yorgunluk, hava etkisi) maç öncesi ekranda listelenir.
131. **[v1][P1]** Rüzgârın fizik etkisi öngörülebilir: Rüzgâr 0–4 kademelidir ve ok gösterilir. Her kademe, 30 m'lik bir uzun topu 0,6 m saptırır. Aynı kademe her zaman aynı kuvveti uygular (NSS'deki "1 rüzgâr 4'ten güçlü" tutarsızlığına karşı). Ayarlardan kapatılabilir.
132. **[v1][P1]** Zemin fizik etkisi: Islak zeminde top sürtünmesi %25 düşer ve sekme +%15 artar. Karlı zeminde yuvarlanma %30 yavaşlar. Etkiler maç öncesi bilgi kartında sayıyla gösterilir.
133. **[v1][P2]** Antrenman modu (serbest saha): Her mesafeden, her açıdan şut, falso ve duran top serbestçe çalışılır. Kayıt tutulmaz, enerji harcanmaz (NSS'deki "free mode'da uzaktan vurmama izin verin" isteği).
134. **[v1][P1]** Zorluk ödül çarpanı şeffaf: Ödül çarpanı ×0,8–×1,3 arasındadır, ayar ekranında anlık hesaplanıp gösterilir ve sezon içinde en fazla 1 kez değiştirilebilir.
135. **[v2][P2]** Haftalık "an meydan okuması" senaryoları (ör. 88. dakika, 1-1, serbest vuruş): Aynı seed herkese verilir, sonuç yerel tabloya yazılır. Online tarafı 2.10'da ele alınır.


### 2.2 Animasyon, Kamera, Efektler ve Sunum

NSS'nin sahadaki sunumu işlevseldi ama duygusuz kaldı. Oyuncu tekrarda kendini göremiyordu, ortalarda kamera geçişi pozisyonu bozuyordu ve 2024 güncellemesi sadeliği kaybettirdi. StarPath'te hedef, "Gece Maçı" kimliğiyle TV yayını hissi veren, okunaklılığı bozmayan ve düşük donanımlı cihazda 30 fps'i koruyan bir sunum katmanı kurmak.

#### A. Kamera Sistemi
1. **[v1][P0]** Tek kamera modeli, tüm anlar: Pas, şut, orta ve kafa anlarında aynı kamera ve aynı dünya koordinatları kullanılır. NSS'deki "orta yan kameradan ana kameraya geçince oyuncu birkaç adım geride" hatası yapısal olarak imkânsız olur. Kabul kriteri: kamera geçişinde topun ve oyuncuların dünya konumu 0 px sapar.
2. **[v1][P0]** Yumuşak takip kamerası: Kamera topu kritik sönümlü yay (damping 0.12, 60 Hz) ile izler. Ani sıçrama olmaz, hız 1.200 px/sn'yi aşmaz.
3. **[v1][P0]** Öngörülü kadraj (look-ahead): Kamera, top taşıyıcının hareket yönüne doğru ekranın %18'i kadar önden bakar. Böylece pas seçenekleri görünür kalır.
4. **[v1][P0]** An başlangıcında otomatik çerçeveleme: Her "an" başladığında kamera 350 ms içinde top, kahraman oyuncu ve en yakın 3 pas seçeneğini kadraja sığdıracak zoom'a geçer.
5. **[v1][P1]** Pinch ile tüm sahayı görme: Mobilde iki parmak hareketiyle 0.55x ile 1.4x arasında zoom yapılır. Simon Read'in NSS2 için düşündüğü "uzun pas için tüm saha" fikri bu. Masaüstünde fare tekerleği aynı işi görür.
6. **[v1][P1]** Kamera ön ayarları: "Yayın" (yandan ~70° üstten), "Taktik" (tam üstten, uzak) ve "Yakın" (oyuncu odaklı). Ayarlardan seçilir, maç içinde tek tuşla değişir.
7. **[v1][P0]** Kamera sınırları: Kamera saha dışına en fazla 6 metre taşar. Ultrawide ekranda ekstra alan tribün gösterir, HUD kaymaz.
8. **[v1][P1]** Şut anında kamera kilidi: Şut tuşu bırakıldıktan sonra kamera 200 ms boyunca topu kaleye doğru izler, sonra kaleyi sabit kadrajda tutar. Gol/ıska sonucu her zaman ekranda görünür.
9. **[v1][P1]** Orta/korner için genişleyen kadraj: Orta anında kamera ceza sahasındaki tüm hücum oyuncularını gösterecek kadar 300 ms'de uzaklaşır, kafa anı için yeniden yaklaşır. Aynı sahnede olur, kesme yok.
10. **[v2][P1]** Kaleci kariyeri kamerası: Kaleci anlarında kamera kale arkasından alçak açıyla bakar, şutun geliş yönü net okunur. Penaltıda kaleci gözü perspektifi seçeneği vardır.
11. **[v2][P2]** Defans anı kamerası: Top kapma anında kamera rakip top taşıyıcıyı merkeze alır, oyuncunun koşu çizgisi ve müdahale mesafesi halka ile gösterilir.
12. **[v1][P1]** Kamera sarsıntısı sınırları: Direk ve gol sarsıntısı en fazla 6 px genlikte ve 180 ms sürer. "Azaltılmış hareket" açıkken tamamen kapanır.
13. **[v1][P2]** Ekran yönüne uyum: Dikeyde (tablet ≥600dp, Android 16 yönlendirme kilidi yok) kamera saha uzunluğunu dikey eksene çevirir, yatayda klasik yayın görünümü kullanılır.

#### B. Bullet-Time ve Nişan Sunumu
14. **[v1][P0]** Bullet-time geçişi: Top kahramana geldiğinde zaman 150 ms içinde 1.0x'ten 0.25x'e iner (ease-out). Ekran kenarlarında %15 opaklıkta vinyet ve hafif doygunluk düşüşü olur.
15. **[v1][P0]** Soğukkanlılık göstergesi: Bullet-time süresi topun etrafında daralan bir halka ile gösterilir. Soğukkanlılık yüksekse halka daha yavaş kapanır. Halka 0'a inince zaman 120 ms'de normale döner.
16. **[v1][P0]** Şut yörünge önizlemesi: Sürükleme sırasında yarı saydam bir yay çizilir. Teknik ve Vizyon arttıkça yayın görünen uzunluğu %30'dan %70'e çıkar (Retro Goal'daki ark talebi). Yay gerçek fizik simülasyonundan üretilir, "göreceli güç" yanılgısı olmaz.
17. **[v1][P0]** Güç rengi: Güç oku yeşil, sarı, turuncu ve kırmızı olarak 4 bantta renklenir. Kırmızı bant isabet kaybını gösterir, renk körü modunda bantlara çizgi deseni eklenir.
18. **[v1][P0]** Topun düşeceği nokta (X işareti): Uzun pas ve ortalarda topun ilk temas noktası zeminde X ile gösterilir (oyuncu talebi). Hata payı Teknik özelliğine göre büyüyen bir elips ile verilir.
19. **[v1][P1]** Pas seçeneği vurgusu: Pas alabilecek takım arkadaşlarının altında halka yanar. Ofsayttakiler kırmızı bayrak ikonu taşır. Vizyon düşükse uzak seçenekler görünmez, sadece "?" silueti çıkar.
20. **[v1][P1]** "Pas vermiyor" balonu: İlişkisi kötü takım arkadaşı, top ondayken başının üstünde 1.2 sn kısa bir ifade gösterir ("Arda sana bakmadı"). Bu, GDD'deki görünür ilişki mekaniğinin sahadaki karşılığı.
21. **[v1][P1]** Falso (aftertouch) izi: Şut sonrası parmak kaydırıldığında topun arkasında kavisi gösteren ince bir iz (trail) 400 ms boyunca kalır. Böylece oyuncu falsonun etkisini görür.
22. **[v1][P2]** Panik titreşimi: Penaltıda soğukkanlılık düşükse nişan imleci 2–5 px genlikte titrer. Titreşim deseni görsel olarak tutarlıdır ve "erişilebilirlik: titreme yok" seçeneğinde imleç yerine hedef alanın büyüklüğü değişir.
23. **[v1][P1]** Savunmacı yaklaşma göstergesi: Nişan alırken üstüne gelen savunmacının altında, temas süresini gösteren daralan turuncu bir yay olur. NSS 1.5'teki "savunmacı üstüne gelir" mekaniği okunur hâle gelir.

#### C. Oyuncu ve Avatar Animasyonları
24. **[v1][P0]** Prosedürel vektör oyuncu: Gövde, şort, tozluk, ten, saç rengi ve şekli seed'den üretilir. 8 yön × 6 kare koşu, 4 kare yürüme, 3 kare duruş. Tek RenderTexture atlasına önbelleklenir ve maç başına 22 oyuncu için atlas üretimi 120 ms'yi geçmez (orta segment cihaz).
25. **[v1][P0]** Kahraman görünürlüğü: Bizim oyuncumuzun altında `--brand-pitch` halka ve başının üstünde forma numarası vardır. NSS'nin "görünmez parmak" şikâyetine cevaptır: oyuncu her karede ayırt edilebilir.
26. **[v1][P0]** Vuruş animasyonları: İç, dış, plase, sert şut, aşırtma ve rabona [v2] için ayrı 4–6 karelik vuruş pozları. Top teması, animasyonun "temas karesi" ile aynı fizik tikinde olur.
27. **[v1][P1]** Kafa vuruşu animasyonu: Zıplama yüksekliği Zıplama özelliğine bağlıdır. Gölge yerde kalır, oyuncu sprite'ı yükselir. Böylece 2.5D derinlik okunur.
28. **[v1][P1]** Kaleci animasyon seti: Hazır duruş, yana adım, alçak/yüksek uzanma, yumruklama, tutma, çıkış ve ayakla kurtarma olmak üzere en az 9 poz. NSS'nin "raydaki kaleci" hissini kırmak için uzanma yönü ve yüksekliği topun gerçek yörüngesine göre interpolasyonla seçilir.
29. **[v1][P1]** Kayarak müdahale animasyonu: 5 karelik kayma, çim üzerinde 600 ms kalan kayma izi ve kaptırılan oyuncunun düşme animasyonu.
30. **[v1][P2]** Yorgunluk duruşu: Kondisyon %30'un altına inince oyuncu duraklarda ellerini dizine koyar. Koşu animasyonu %10 yavaşlar.
31. **[v1][P1]** Yüz ifadesi (menü avatarı): facesjs ağız ve kaş parametreleri ruh hâline göre değişir: mutlu, gergin, öfkeli, yorgun. Maç sonu kartında ifade sonuca göre seçilir.
32. **[v1][P1]** Yaşlanan yüz: Her sezon başında avatar yaşa göre güncellenir. 30 yaştan sonra saçta beyazlama, 34'ten sonra çizgiler belirir ve kullanıcı saç ekimi/boya ile müdahale edebilir [v2].
33. **[v1][P2]** Kozmetiklerin sahaya yansıması: Krampon rengi, saç modeli, bant ve kol bandı (kaptan) maç sprite'ında görünür. Krampon rengi en az 4 px'lik leke olarak okunur.
34. **[v2][P2]** Kadın oyuncu sprite seti: Kadın liglerinde sakal parametresi kapalıdır ve vücut oranı ayrı şablondan gelir. NSS'deki "kadın liginde sakallı oyuncular" hatası test ile engellenir.
35. **[v2][P2]** Ter ve çamur: Yağmurlu maçta 60. dakikadan sonra formalarda çamur maskesi belirir, kayarak müdahale yapan oyuncuda leke kalıcıdır.
36. **[v2][P2]** Saç fiziği: Uzun saçta koşuda 2 kemikli basit sallanma. Düşük profilde kapalıdır.

#### D. Gol Kutlamaları
37. **[v1][P0]** Kutlama yönü seçimi (NSS5 mirası): Gol sonrası 2 sn içinde oyuncu taraftara, kameraya, teknik direktöre ya da takım arkadaşlarına (orta yuvarlak) koşmayı seçer. Her yön ilgili ilişkiye +1..+3 etki verir ve etki maç sonu dökümünde gösterilir.
38. **[v1][P0]** Kişisel kutlama kütüphanesi: v1'de 12 kutlama (diz kayması, uçak, susturma işareti, kalp, selam, takla, kucaklama, yumruk, sakin yürüyüş, forma öpme, köşe bayrağı, "telefon"). Kutlamalar Şöhret kilometre taşlarıyla açılır, para ile satılmaz (kozmetik paketler hariç).
39. **[v1][P1]** İmza kutlaması: Oyuncu bir kutlamayı "imza" olarak işaretler. 10 golden sonra yorumcu ve sosyal medya bu kutlamayı adıyla anar ("klasik X kutlaması").
40. **[v1][P1]** Bağlamsal kutlama: Eski kulübüne gol attığında "saygı" (kutlamama) seçeneği çıkar ve eski taraftar ilişkisine etkisi gösterilir. Derbi golünde rakip tribüne gitme seçeneği provokasyon riski taşır (kart ihtimali gösterilir).
41. **[v1][P1]** Kutlama süresi sınırı: Kutlama 3.5 sn'yi geçmez. "Atla" dokunuşu her zaman çalışır ve 2. maçtan sonra varsayılan olarak "kısa kutlama" ayarı önerilir.
42. **[v1][P2]** Takım arkadaşı katılımı: İlişkisi ≥40 olan takım arkadaşları kutlamaya koşar. İlişkisi kötü olanlar uzak durur. İlişki durumu kutlamada görsel olarak okunur.
43. **[v1][P1]** Gol anı kompozisyonu: Top fileyi geçtiği an 80 ms donma karesi (hit-stop), ardından file dalgalanması, kamera 1.15x zoom ve tribün flaşları. Toplam süre 900 ms ile sınırlı.
44. **[v2][P2]** Dramatik gol varyasyonu: 85. dakikadan sonraki eşitlik veya galibiyet golünde ek yavaş çekim (0.5x, 600 ms) ve kalabalık dalgası (wave) efekti oynar.
45. **[v2][P2]** Kutlama editörü: 3 hareketi zincirleyerek kendi kutlamasını yapma (koşu + poz + bitiş). En fazla 5 kayıtlı özel kutlama.
46. **[v1][P2]** Kaçan fırsat tepkisi: Iska sonrası oyuncu 1 sn elleriyle başını tutar. Arka arkaya 3 iskada animasyon "öfke" varyantına geçer.

#### E. Tekrar (Replay) Sistemi
47. **[v1][P0]** Tekrar her zaman mümkün: NSS'de tekrar için "sayaç bitmeden butona basmak" gerekiyordu. StarPath'te her anın tekrarı maç sonuna kadar "Anlar" listesinden açılabilir. Maç sonunda en iyi 3 an otomatik listelenir.
48. **[v1][P0]** Deterministik tekrar: Tekrar video değil, seed + girdi olayı kaydından yeniden oynatılır. Bir an için kayıt boyutu 4 KB'ı geçmez ve tekrar orijinalle kare kare aynı sonucu verir (CI testi).
49. **[v1][P0]** Kendi oyuncunu görmek: Tekrar kamerası topa vuran kahramanı her zaman kadrajda tutar. NSS'deki "tekrarda topa vuranı göremiyoruz" şikâyetinin doğrudan karşılığı.
50. **[v1][P1]** Zaman çizelgesi kontrolü: Sürüklenebilir zaman çubuğu, 0.25x/0.5x/1x hız, kare kare ileri/geri ve duraklat.
51. **[v1][P1]** Çoklu tekrar açısı: Yayın, kale arkası, kahraman takip ve tam üstten olmak üzere 4 açı. Açı değişimi tekrar sürerken 250 ms crossfade ile yapılır.
52. **[v2][P1]** Otomatik yönetmen modu: Gol tekrarında sistem 3 açıyı sırayla (yayın → kale arkası → yavaş çekim yakın) toplam 8 sn'de oynatır.
53. **[v1][P2]** Top izi tekrarda: Tekrarda topun yörüngesi renkli iz olarak çizilir. Falso kavisi ve hız (km/sa) etiketi gösterilir.
54. **[v2][P2]** Rakip kalecinin bakış çizgisi: Tekrarda kalecinin topu ne zaman gördüğü yarı saydam bir koni ile gösterilir. Kaleci kariyerinde bu bir öğrenme aracıdır.
55. **[v1][P1]** Tartışmalı pozisyon tekrarı: Ofsayt veya faul kararında otomatik tekrar oynar, ofsayt çizgisi tekrarda çizilir. Ofsayt hatası şüphesini ortadan kaldırmak için çizgi oyuncunun en ileri vücut noktasından geçer.
56. **[v2][P2]** Anlar galerisi: Kariyer boyunca kaydedilen en fazla 200 tekrar "Kariyerim" altında saklanır. Tekrar başına ortalama 4 KB, yaklaşık 800 KB'lık toplam bütçe.

#### F. Paylaşılabilir Klipler (Görsel Taraf)
57. **[v2][P1]** Highlight klip dışa aktarma: Bir anı 9:16 (dikey) veya 16:9 formatında, en fazla 15 sn, 720p, 30 fps video olarak dışa aktarma. Orta segment Android'de kodlama süresi klibin 2 katını geçmez.
58. **[v2][P1]** Klip üstü grafikler: Klipte dakika, skor, oyuncu adı, gol mesafesi ve şut hızı TV grafiği tarzında yer alır. StarPath logosu köşede küçük filigrandır, kapatılamaz ama %40 opaklıktadır.
59. **[v2][P2]** Klip şablonları: "Yayın", "Minimal" ve "Retro" olmak üzere 3 görsel şablon. Retro, piksel filtresiyle Classic görünümü yansıtır.
60. **[v1][P1]** Statik paylaşım kartı: Maç sonu kartı (skor, puan, gol/asist, avatar) 1080×1350 PNG olarak üretilir. Sosyal medya hesabı bağlamadan sistem paylaşım menüsüyle paylaşılır.
61. **[v2][P2]** Sezon özeti kartları: Sezon sonunda 5–7 kartlık, kaydırılabilir "yıl özeti" dizisi (gol, en iyi an, ödüller, kazanç, en yakın takım arkadaşı). Her kart ayrı ayrı paylaşılabilir.
62. **[v3][P2]** GIF dışa aktarma: 4 sn, 480 px genişlik, 15 fps GIF. Mesajlaşma uygulamaları için.

#### G. Parçacıklar ve Efektler
63. **[v1][P0]** Parçacık bütçesi: Ekranda aynı anda en fazla 300 parçacık (yüksek), 120 (orta), 40 (düşük profil). Bütçe aşılınca en eski efektler önce düşer, kare süresi 33 ms'yi aşmaz.
64. **[v1][P1]** Çim parçaları: Sert şutta ve kayarak müdahalede 8–14 çim parçacığı, 400 ms ömür.
65. **[v1][P1]** Top izi (trail): Top hızı 70 km/sa'yi aştığında 6 segmentlik solan iz. Falso varsa iz kavislidir. Düşük profilde 3 segmente iner.
66. **[v1][P0]** File fiziği (görsel): File 12×8 düğümlü verlet ızgarasıyla dalgalanır. Topun girdiği noktada en büyük deformasyon olur, 700 ms'de söner. NSS 2.11'deki gol ağı fiziğinin bir üst seviyesi.
67. **[v1][P1]** Direk efekti: Topun direğe çarptığı noktada beyaz kısa parlama ve direkte 120 ms titreşim olur. Haptik "Heavy" ile aynı karede tetiklenir.
68. **[v1][P2]** Tribün flaşları: Gol ve büyük kurtarışlarda tribünde 20–40 rastgele beyaz nokta 1 sn boyunca yanıp söner. Işığa duyarlılık modunda kapalıdır.
69. **[v1][P1]** Fotosensitivite koruması: Saniyede 3'ten fazla parlama yapan hiçbir efekt yoktur. Tüm flaş efektleri tek bir "flaş" ayarına bağlıdır ve otomatik test bu kuralı denetler.
70. **[v2][P2]** Konfeti ve şampiyonluk yağmuru: Kupa kaldırma sahnesinde kulüp renklerinde konfeti (en fazla 200 parçacık), 4 sn.
71. **[v2][P2]** Meşale ve sis görseli: Meşale/renkli duman yalnızca "koreografi" seviyesinde ve kurgusal bağlamda gösterilir. Yaş derecelendirmesi riski nedeniyle varsayılan olarak hafif duman ile sınırlıdır, yanan meşale gösterilmez. Karar, mağaza derecelendirme incelemesinden sonra kesinleşir.
72. **[v1][P2]** Nefes buharı: 5 °C altındaki maçlarda oyuncuların ağzından 2 sn arayla küçük buhar parçacığı çıkar.

#### H. Hava Durumu ve Işık
73. **[v1][P0]** Yağmur: İki katmanlı yağmur (ön plan eğik çizgiler, arka plan ince doku), çimde parlaklık artışı ve top teması sonrası küçük su sıçraması. Görsel, fiziğe bağlıdır: yağmur seviyesi top sürtünmesini değiştirir ve bu HUD'da ikonla belirtilir.
74. **[v1][P0]** Rüzgâr görselleştirmesi: Rüzgâr, köşe bayraklarının sallanması ve ekran köşesinde ok + sayısal değer (km/sa) ile gösterilir. NSS'nin "1 rüzgâr bazen 4'ten güçlü" tutarsızlığını önlemek için ok uzunluğu fiziğe uygulanan kuvvetle doğrusal orantılıdır.
75. **[v1][P1]** Kar: Kar yağışı parçacıkları, çim üzerinde beyaz örtü maskesi ve turuncu top. Saha çizgileri karda %60 opaklıkla görünür kalır.
76. **[v2][P1]** Sis: Uzak sahada %0–35 yoğunlukta sis katmanı. Vizyon ipuçlarının menzili sisle %20 kısalır ve bu oyuncuya bildirilir.
77. **[v1][P1]** Gece maçı aydınlatması: 4 köşeden additive blend projektör konileri, oyuncularda 4 yönlü hafif gölge ve vinyet. "Gece Maçı" kimliğinin sahadaki karşılığı. Düşük profilde tek bir statik ışık dokusuna iner.
78. **[v2][P1]** Gün ışığı geçişi: Saat 16:00 başlayan maçta ikinci yarıda gün batımı tonu gelir, 75. dakikada projektörler yanar. Renk geçişi 60 sn'ye yayılır.
79. **[v2][P2]** Gölge yönü: Gündüz maçlarında oyuncu gölgeleri güneşin konumuna göre tek yönde uzar, gece maçlarında projektör sayısı kadar soluk gölge olur (en fazla 4).
80. **[v2][P2]** Saha durumu: Sezon sonunda çimde aşınmış kale önleri ve orta saha. Kulüp bütçesine göre saha kalitesi görsel olarak farklılaşır (alt lig: çamurlu yamalar).
81. **[v1][P1]** Hava tahmini sunumu: Maç öncesi ekranda hava ikonu, sıcaklık ve rüzgâr değeri gösterilir. Hava durumunun oyuna etkisi bir satırla açıklanır.

#### I. Stadyum ve Kalabalık
82. **[v1][P0]** Stadyum kademeleri: Alt lig (tek tribün, 2.000 kişi), orta (iki katlı, 15.000), üst (dört tribün çatılı, 40.000), elit (kapalı kase, 70.000+) olmak üzere 4 prosedürel şablon. Lig yükseldikçe oyuncu farkı görsel olarak hisseder.
83. **[v1][P1]** Doluluk oranı: Tribünde dolu koltuk yoğunluğu gerçek seyirci sayısından hesaplanır. Boş koltuklar kulüp renginde görünür. Kötü giden takımda doluluk düşer.
84. **[v1][P1]** Piksel kalabalık: Tribün kalabalığı renkli noktalardan oluşan 3 paralaks katmanıdır. Gol anında noktaların %40'ı 300 ms zıplar. Düşük profilde tek statik katman ve gol anında toplu parlama kullanılır.
85. **[v1][P2]** Deplasman tribünü: Rakip taraftarlar köşe tribünde kendi kulüp renkleriyle ayrışır. Deplasman golünde sadece o blok hareketlenir.
86. **[v2][P1]** Koreografi: Derbi ve final maçlarında maç başında tribünde kulüp renklerinden oluşan prosedürel desen (şerit, arma silüeti, yıldız) 6 sn görünür. Desen 12 şablondan seçilir.
87. **[v2][P2]** Pankartlar: Şöhret 60'ı geçince tribünde oyuncunun adını veya forma numarasını taşıyan 1–3 pankart çıkar. Sosyal medyadaki takma ad pankarta yansıyabilir.
88. **[v2][P2]** Stadyum adı ve kimliği: Her stadyumun adı, kapasitesi, çatı tipi ve koltuk desenleri seed'den üretilir. Maç öncesi ekranında stadyum kartı gösterilir.
89. **[v2][P2]** Tarafsız saha ve final stadyumu: Kupa finalleri için ayrı, büyük ve özel ışıklandırmalı "final stadyumu" şablonu kullanılır.
90. **[v3][P2]** Kendi stadyumun: Kulüp başkanlığı modunda stadyum genişletme tribün tribün görsel olarak inşa edilir.
91. **[v1][P2]** Kenar tabelaları: Saha kenarındaki LED panolarda kurgusal sponsorlar döner. Oyuncunun kendi sponsorları bu panolarda görünür.

#### J. Skor Tabelası ve TV Grafikleri
92. **[v1][P0]** Minimal HUD: Maçta yalnızca skor, dakika ve kondisyon çubuğu görünür. Teko font, eğik TV şeridi. HUD 1280×800 çözünürlükte ekranın en fazla %6'sını kaplar.
93. **[v1][P1]** Olay şeritleri: Gol, kart ve oyuncu değişikliği için alt üçte birde 2.5 sn kalan TV tarzı şerit. Şerit kulüp rengiyle kenarlanır.
94. **[v1][P1]** Gol banner'ı: Gol sonrası "GOL" yazısı (Barlow Condensed 900 italik) ve altında gol atanın adı ile dakika. 1.2 sn giriş-çıkış, ses stinger'ıyla aynı karede.
95. **[v1][P2]** Maç istatistik araları: Devre arasında topla oynama, şut ve isabetli şut sayısını içeren 3 satırlık yayın grafiği, 4 sn.
96. **[v2][P2]** Uzatma dakikası panosu: 4. hakemin elektronik tabelası animasyonla kalkar ve "+3" gösterir.
97. **[v2][P2]** VAR ekranı: VAR incelemesinde mavi tarama çizgisi, kalibre ofsayt çizgileri ve "İNCELEME" banner'ı. İnceleme görsel olarak 4 sn'yi geçmez.
98. **[v1][P1]** Kart animasyonu: Sarı/kırmızı kartta hakem kolunu kaldırır ve kart ikonu oyuncunun üstünde 1 sn pop-up yapar.

#### K. Maç Öncesi ve Maç Sonu Sunumu
99. **[v1][P1]** Maç öncesi kartı: İki arma, form noktaları (son 5), hava, stadyum ve beklenen rol. 2.5 sn'lik giriş, tek dokunuşla atlanır.
100. **[v2][P2]** Tünel sahnesi: Önemli maçlarda (derbi, final, milli maç) 4 sn'lik stilize tünel çıkışı. Oyuncu kaptansa en önde yürür. Ayarlardan kapatılabilir.
101. **[v1][P1]** Diziliş grafiği: İlk 11 saha üzerinde formasyonla gösterilir, bizim oyuncumuz vurgulanır, takım arkadaşı adları ve numaraları görünür (NSS'de olmayan "takım kağıdı").
102. **[v1][P0]** Maç sonu sırası: Final skoru → puan dökümü → Maçın Oyuncusu → kazanç dökümü → ilişki değişimleri. Her adım tek dokunuşla geçilir. Toplam varsayılan süre 8 sn'yi geçmez ve "hepsini atla" vardır.
103. **[v1][P0]** Şeffaf puan dökümü animasyonu: Puan 6.0 tabanından başlar. Her katkı (+1.5 gol, +0.8 asist, −0.4 kaçan pas) sırayla count-up ile eklenir. NSS'deki "gol + 2 asist = 5.6" anlamsızlığına cevap.
104. **[v1][P1]** Maçın Oyuncusu kartı: Avatar, puan (Teko 72 px), ana istatistikler ve nadirlik çerçevesi. Kart 600 ms spring ile döner.
105. **[v1][P2]** Isı haritası ve şut haritası animasyonu: Maç sonunda ısı haritası 800 ms'de "dolar", şutlar sırayla belirir.

#### L. Anlatım Akışı (Ticker) Sunumu
106. **[v1][P0]** Canlı metin akışı: Anlar arasında dakika etiketli metin satırları akar. Önemli olaylar (gol, kart, büyük fırsat) kalın ve renklidir. Hız ayarlanabilir (0.5x–4x) ve bekletilmeden "sonraki ana geç" butonu vardır.
107. **[v1][P1]** Mini radar: Ticker yanında 2D nokta radarında top ve 22 oyuncu gerçek simülasyon konumlarıyla hareket eder. Bizim oyuncumuz farklı şekilde (üçgen) gösterilir.
108. **[v1][P1]** Momentum çubuğu: Son 10 dakikanın baskı dengesi ince bir çubukla gösterilir. Böylece "top bana gelmeden 4-0 olduk" hissi en azından görünür ve açıklanır.
109. **[v1][P2]** Anlatımda cinsiyete doğru dil: Kadın kariyerinde tüm anlatım satırları doğru zamir/çekimle gelir. Testte her şablon iki cinsiyetle render edilir.
110. **[v2][P2]** Takım arkadaşı olayları ticker'da: "Kerem sana pas vermek yerine şut çekti (ilişki: soğuk)" gibi ilişki kaynaklı satırlar, mekanikleri anlatıya dönüştürür.

#### M. Kesme Sahneleri ve Sinematikler
111. **[v1][P1]** Transfer imzası sahnesi: Eski forma kayarak çıkar, yeni forma giydirilir, imza masası illüstrasyonu ve bonservis bedeli count-up olur. 4 sn, atlanabilir.
112. **[v2][P1]** Ödül töreni: "Altın Yıldız" töreninde 3 aday kartı, zarf açılma animasyonu ve kazananın kartı ışık patlamasıyla öne çıkar. Kaybedince kibar bir "ikinci" kartı gösterilir.
113. **[v2][P2]** Kupa kaldırma: Takım yarım daire şeklinde dizilir, kaptan kupayı kaldırır, konfeti yağar. Kupa modeli prosedürel üreticiden gelir.
114. **[v2][P2]** İlk profesyonel sözleşme sahnesi: Aile avatarlarının da bulunduğu 5 sn'lik duygusal sahne. Kariyerde yalnızca bir kez oynar.
115. **[v2][P2]** Emeklilik veda sahnesi: Son maçtan sonra stadyum turu, taraftar pankartları ve kariyer istatistiklerinin üst üste binen grafikleri. Toplam 12 sn.
116. **[v3][P2]** Miras devri sahnesi: Emekli oyuncunun avatarı çocuğun yanında belirir, soyadı formada el değiştirir. facesjs akraba yüz üretimiyle görsel benzerlik sağlanır.
117. **[v1][P2]** Milli takım çağrısı: Telefon arayüzünde arama animasyonu ve milli forma kartı. 2 sn.

#### N. Görsel Mod, Kalite Profilleri ve Performans
118. **[v1][P0]** Kalite profilleri: Düşük (30 fps, parçacık 40, ışık konisi yok, kalabalık statik), Orta (60 fps hedef), Yüksek (tüm efektler). İlk açılışta cihaz testine göre otomatik seçilir.
119. **[v1][P0]** Düşük profil kabul kriteri: 2 GB RAM / Mali-G52 sınıfı cihazda maç anı sırasında 30 fps altına düşen kare oranı %2'yi geçmez, 15 dakikalık oturumda termal kısma olmaz.
120. **[v2][P1]** Classic görsel mod: NSS oyuncularının sevdiği sadeliğe saygı olarak düz renk saha, sade sprite, efektsiz "Klasik" mod. Pil tasarrufu sağlar, oyun mekaniklerini değiştirmez. 2024 güncellemesindeki "sadelik kayboldu" tepkisinden çıkan ders.
121. **[v1][P0]** Azaltılmış hareket: Sarsıntı, zoom darbesi, parlama ve paralaks kapanır, geçişler crossfade olur. Bullet-time vinyeti yerine sabit çerçeve kullanılır. Sistem `prefers-reduced-motion` ayarı otomatik okunur.
122. **[v1][P1]** Efekt bağımsızlığı: Her efekt kategorisi (sarsıntı, flaş, parçacık, ışık, hava) ayrı ayrı açılıp kapatılabilir. Kapatmak oyun sonucunu değiştirmez (hava fiziği hariç; o, görsel değil, kural).
123. **[v1][P1]** Sabit adım + interpolasyon: Fizik 60 Hz sabit adımda çalışır, render ara değerlemesi kullanılır. 120/144 Hz ekranlarda animasyonlar takılmadan akar.
124. **[v1][P2]** Atlas boyut bütçesi: Maç sahnesinin tüm doku atlası 2 sayfa × 2048² sınırını aşmaz. Prosedürel oyuncu atlasları maç arasında bellekten boşaltılır.


### 2.3 Kariyer ve Oyun Mantığı

Bu bölüm, 16 yaşındaki bir gencin efsaneye dönüşmesini sağlayan ilerleme sistemlerini kapsar. NSS'de ilerleme çoğunlukla "enerji al, antrenman yap, tekrar et" döngüsüne sıkışmıştı; StarPath'te her sistemin görünür bir nedeni, ölçülebilir bir eşiği ve beceriye bağlı bir sonucu olacak.

#### A. Karakter Yaratma, Arketip ve Kimlik

1. **[v1][P0]** Pozisyon seçimi kariyer başında zorunlu: KL, STP, SĞB/SLB, DOS, MO, OOS, SĞK/SLK, SF olmak üzere 10 mevki seçilebilir. Her mevki maçta farklı "an" havuzu açar (bkz. 2.1). NSS'nin en çok istenen özelliği (222 ve 344 oy) budur.
2. **[v1][P0]** Kaleci kariyeri tam bir mevki olarak sunulur, "mod" olarak değil. Kendi antrenman mini oyunları (Refleks, Top Tutma, Pozisyon, Oyun Kurma), kendi ödülleri (Altın Eldiven) ve kendi reyting formülü (kurtarış yüzdesi, xG engelleme) vardır. Google Play'deki en beğenilen istek (516 oy) budur.
3. **[v1][P0]** Arketip seçimi (Golcü, Oyun Kurucu, Kanat Motoru, Duvar, Box-to-Box, Kaleci) başlangıçta toplam 40 bonus puanı dağıtır. Mevkiyle uyumsuz arketipte bonusun en fazla %50'si ilgili gruba gider.
4. **[v1][P1]** Geçmiş hikâyesi 4 seçenekten biridir ve her biri ölçülebilir bir farkla başlar. Sokak Futbolu: Dribbling +6, disiplin −5, başlangıç parası düşük. Akademi Çocuğu: Pozisyon Alma +5, ilk sözleşme garantili. Futbolcu Ailesi: ajan bağlantısı ve +10 şöhret. Geç Keşfedilen: 18 yaşında başlangıç ve +3 gizli potansiyel.
5. **[v1][P1]** Tercih edilen ayak seçimi (sol, sağ veya iki ayaklı) gerçek bir etki yaratır. Zayıf ayakla şutta isabet sapması %35 artar. İki ayaklı seçmek bir perk puanına mal olur.
6. **[v1][P1]** Başlangıç yaşı 16–18 arasında seçilir. 16'da başlayan oyuncu U17'ye uygun olur ve potansiyel gelişiminden tam yararlanır. 18'de başlayan oyuncu +4 OVR ile başlar ama 2 yıllık gelişim penceresini kaybeder.
7. **[v1][P0]** Başlangıç kulübü üç yoldan biriyle belirlenir: seçilen ülkenin alt liginde 3 kulüpten gelen deneme daveti, akademi sözleşmesi ya da açık seçmeler. Deneme maçı tek seferlik bir "an paketi" (5 an) olarak oynanır ve en az 2 kulüp gerçek bir teklif yapar. NSS'deki "30–40 kez deneme" şikâyeti böylece biter.
8. **[v1][P1]** Forma numarası ve forma adı seçilir. Numara takımda doluysa en yakın boş numara önerilir. Kıdem arttıkça (Yıldız rolü) istenen numara talep edilebilir.
9. **[v2][P2]** Kariyer ortasında mevki değiştirme mümkündür: 10 maçlık "adaptasyon" dönemi boyunca yeni mevkideki OVR %8 eksik hesaplanır, uyum çubuğu %100'e ulaşınca ceza kalkar. Bir oyuncu en fazla 3 mevkide "doğal" olabilir.
10. **[v1][P0]** Cinsiyet seçimi ve tüm metinlerde doğru zamir/çekim kullanılır. Kadın kariyeri kendi lig yapısında ilerler. Yorumcunun "he" demesi gibi NSS hataları otomatik testle engellenir: her maç metni iki cinsiyetle render edilip karşılaştırılır.

#### B. Özellikler, OVR, Potansiyel ve Yaş Eğrisi

11. **[v1][P0]** GDD'deki 23 özellik (Fiziksel 5, Teknik 9, Zihinsel 5, Kaleci 4) 0–100 ölçeğinde tutulur. OVR mevkiye göre ağırlıklandırılır. Örneğin SF için Bitiricilik ×0,18, Hız ×0,12, Kafa ×0,08. Ağırlık tablosu veri dosyasında durur ve oyuncu "OVR nasıl hesaplandı?" ekranında görebilir.
12. **[v1][P0]** Gizli potansiyel (PA) 60–99 arasında olur ve oyuncuya 1–5 yıldız aralığında gösterilir. Scout raporu her sezon aralığı ±10'dan ±3'e daraltır, belirsizlik bandı grafikte görünür.
13. **[v1][P0]** Yaş eğrisi 17–23 arasında XP çarpanı ×1,3, 24–29 arasında ×1,0, 30–33 arasında ×0,7 ve 34+ için ×0,5'tir. Fiziksel özellikler 30'dan sonra sezonda 1–3 puan düşer. Zihinsel özellikler (Vizyon, Soğukkanlılık, Liderlik) 33 yaşına kadar artmaya devam eder.
14. **[v1][P0]** Yetenek erimesi NSS'deki gibi rastgele değil, deterministik ve önceden bildirilir. Bir özellik 21 oyun günü boyunca kullanılmaz ya da antrenmanı yapılmazsa 1 puan düşer. Düşüşten 7 gün önce hub'da "Hız 3 gün içinde düşecek" uyarısı çıkar. Antrenmandan sonraki 14 gün içinde düşüş asla olmaz.
15. **[v1][P0]** Maç içi kullanım da antrenman sayılır: maçta başarılı her aksiyon ilgili özelliğe küçük XP (0,2–1,0) verir. Örneğin 3 isabetli ara pas Vizyon'a +1,5 XP getirir. Böylece "maçta parlıyorum ama gelişmiyorum" hissi ortadan kalkar.
16. **[v1][P1]** Form (son 5 maç ortalaması), Moral (−100..100), Kondisyon (0–100) ve Yorgunluk (birikimli) dört ayrı değerdir. Form ±5 OVR etkisi yapar, Moral ise maç içi bullet-time süresini ±%20 değiştirir.
17. **[v1][P1]** Özellik tavanı potansiyele bağlıdır ama yumuşak tavandır: PA'ya ulaşan oyuncu her özellikte sezonda en fazla +1 kazanabilir. Böylece "maks oldum, şimdi ne?" duvarı yumuşar.
18. **[v1][P1]** Oyun stili etiketi (NSS 2014 form sistemi mirası) son 20 maçın istatistiklerinden otomatik çıkarılır. Örnekler: "Ölümcül Bitirici" (20 maçta 15+ gol ve şut dönüşümü ≥%25), "Orta Saha Maestrosu" (pas isabeti ≥%88 ve maç başına 3+ kilit pas). Etiket, scout'ların ilgisini ve sponsor tekliflerini etkiler.
19. **[v2][P2]** Gizli özellikler (Sakatlık Yatkınlığı, Büyük Maç, Tutarlılık) 1–20 ölçeğinde tutulur ve Tıp Ofisi seviye 2'de görünür olur (NSM tesis mekaniğinden alındı).
20. **[v1][P1]** Özellik değişim geçmişi her özellik için sezonluk çizgi grafikle gösterilir. Her değişimin kaynağı (antrenman, maç, yaş, sakatlık, erime) renk koduyla ayrılır.

#### C. Antrenman Mini Oyunları

21. **[v1][P0]** Antrenman puanlaması 1–3 yıldız yerine 0–100 puan verir. XP formülü: `XP = taban(10) × (puan/100)^1.2 × yaş çarpanı × antrenör çarpanı`. Başarısız deneme de en az 2 XP kazandırır. NSS'deki "3 başarısızlıkta hiç artış yok" kuralı kaldırılır.
22. **[v1][P0]** Koni Slalomu (Dribbling, Çeviklik): 8 koni, 20 saniye süre. Koniye her temas −8 puan, her 0,1 saniyelik erken bitiriş +1 puan. Konilerin dizilimi zorluk seviyesine göre değişir: düz, zikzak, rastgele.
23. **[v1][P0]** Hedef Şut (Şut, Bitiricilik): kalenin 9 bölgesinde sırayla yanan hedeflere 10 şut atılır. Merkez isabet 10 puan, kenar 6 puan, kale içi 2 puan. Seviye 3'ten itibaren hareketli kaleci devreye girer.
24. **[v1][P0]** Rondo (Pas, Vizyon, İlk Dokunuş): 4'e 2 rondoda 60 saniye boyunca pas sayısı toplanır. Tek dokunuşlu pas 1,5 puan sayılır, top kaybı serinin sıfırlanması demektir. Vizyon ≥60 olan oyuncu 3. pas seçeneğini görür.
25. **[v1][P0]** Falso Kapısı (Duran Top, Teknik): baraj üzerinden iki direk arasındaki "kapıdan" topu geçirme. Rüzgâr şiddeti ekranda sayıyla (km/s) ve okla gösterilir, NSS'deki gibi gizli değildir. 5 denemede kapıyı geçiren her vuruş 20 puan getirir.
26. **[v1][P0]** Orta İstasyonu (Orta): kanattan ceza sahasındaki 3 hareketli mankene orta açılır. Hedef bölgeye düşen top 15 puan, kafaya denk gelen top 25 puan.
27. **[v1][P0]** Kafa Topu Makinesi (Kafa, Zıplama): 10 top atılır. Zamanlama penceresi Zıplama özelliğine bağlıdır: 50'de 180 ms, 80'de 260 ms. Kaleye isabet eden kafa 10 puan değerindedir.
28. **[v1][P0]** Top Kapma Düellosu (Top Kapma, Güç): YZ forvet topu sürerken doğru anda kayarak ya da ayakta müdahale edilir. Arkadan giriş faul sayılır ve −15 puan getirir (NSM mekaniğinden alındı). Savunmacı kariyerlerinin ana mini oyunu budur.
29. **[v1][P0]** Kaleci Refleks Duvarı (Refleks, Top Tutma): makineden gelen 12 şutta doğru yöne kaydırma yapılır. Tepki penceresi şu formülle hesaplanır: `220 ms + Refleks × 2 ms`. Tutulan top 10, çelinen top 6 puan değerindedir.
30. **[v1][P1]** Penaltı Psikolojisi (Soğukkanlılık): 5 penaltılık seride nişan titremesi stres göstergesine bağlıdır. Nefes ritmi (basılı tut ve bırak) ile titreme %40'a kadar azaltılabilir.
31. **[v1][P1]** Sprint ve Dayanıklılık Turu (Hız, Dayanıklılık): mekik koşusu ritim oyunu olarak oynanır. Doğru zamanlanan her adım +3 puan getirir, stamina çubuğu biterse seri durur.
32. **[v1][P1]** Pozisyon Alma Tahtası (Pozisyon Alma): taktik tahtada 6 durum sorulur ("top sol kanatta, nereye koşmalısın?"). Doğru bölge seçimi 15 puan, yakın bölge 8 puan değerindedir. Zihinsel özelliklerin tek antrenman yolu budur.
33. **[v1][P1]** Antrenman süresi bir zaman dilimi (GDD §1) ve 15–25 enerji tutar. Enerji maliyeti asla şöhrete ya da maaşa endekslenmez. NSS'deki SR'ye endeksli maliyet kaldırılır.
34. **[v1][P1]** Haftalık antrenman planı (otopilot) seçilir: oyuncu 3 odak belirler, oynamadığı antrenmanlar "ortalama puan × 0,7" üzerinden simüle edilir. Böylece istemeyen oyuncu mini oyun grind'ine mecbur kalmaz.
35. **[v1][P1]** Serbest Antrenman alanı her mesafeden şut, falso ve duran top denemesine izin verir. XP vermez, ama yeni krampon ve kutlamalar burada denenebilir. Oyuncuların "uzaktan da vurmak istiyoruz" isteği karşılanır.
36. **[v2][P1]** Takım antrenmanı olayı haftada bir gelir: takım arkadaşıyla ikili mini oyun oynanır (ver-kaç). Başarı o oyuncuyla ilişkiye +3 ve maçta aranızdaki pas sıklığına +%5 ekler.
37. **[v1][P1]** Zorluk otomatik ölçeklenir: antrenman seviyesi lig kademesine değil, ilgili özelliğin değerine bağlıdır. Özellik 70'i geçince 4. seviye açılır. Üst ligde imkânsız hale gelen dribbling sorunu (NSS) böylece çözülür.
38. **[v1][P2]** Kişisel rekor tablosu her mini oyunun en iyi puanını ve tarihini saklar. Rekor kırılınca +5 bonus XP ve küçük bir kutlama verilir.

#### D. Perk, Yetenek Ağacı ve Özellikler (Traits)

39. **[v1][P0]** Perk puanı her 5 OVR artışında 1 adet verilir. Bir kariyerde toplam ~14 perk açılabilir. Ağaç 3 dallıdır (Teknik, Fiziksel, Zihinsel) ve her dalda 3 kademe bulunur.
40. **[v1][P0]** "Plase Uzmanı" perki: plase (iç ayak) şutlarda kavis %15 artar, isabet sapması %10 azalır. Önkoşul Bitiricilik ≥65.
41. **[v1][P1]** "Maraton" perki: maç içinde dayanıklılık kaybı %15 azalır. Önkoşul Dayanıklılık ≥70.
42. **[v1][P1]** "Büyük Maç Oyuncusu" perki: derbi, kupa finali ve milli maçlarda bullet-time süresi +%25. Önkoşul Soğukkanlılık ≥70.
43. **[v1][P1]** "Penaltı Buz Adam" perki: penaltıda panik titremesi %50 azalır. Önkoşul Soğukkanlılık ≥75.
44. **[v1][P1]** "Kaptan Ruhu" perki: kaptanken takım arkadaşlarına koşu yönü verme hakkı maç başına 2'den 4'e çıkar. Önkoşul Liderlik ≥70.
45. **[v1][P2]** "Rabona" ve "Elastico" perkleri yeni çalım ve şut animasyonlarını açar. Rabona zayıf ayak yerine kullanılabilir ve isabet cezası %35'ten %15'e iner.
46. **[v2][P2]** "Uzun Taç" perki: taç atışı ceza sahasına ulaşır ve kafa anı tetikler. Önkoşul Güç ≥70.
47. **[v1][P1]** Kaleci perkleri: "Penaltı Okuyucu" (rakibin vücut açısı ipucu, Refleks ≥70'te 0,15 sn daha erken görünür), "Süpürücü" (çıkış mesafesi +3 m), "Yumruk Ustası" (yumruklamada top 8 m daha uzağa gider).
48. **[v1][P1]** Perk sıfırlama sezonda 1 kez ücretsizdir, sonrakiler kulüp tesisinde "spor psikoloğu" seansı gerektirir. Deneme yapmak cezalandırılmaz.
49. **[v2][P1]** Traits (NSM ve Retro Goal'dan alındı) 2 olumlu ve 1 olumsuz olarak başlangıçta rastgele atanır, olaylarla kazanılır ya da kaybedilir. Olumlu: Sadık, Yorulmaz, Hızlı İyileşen, Duran Top Ustası. Olumsuz: Kırmızı Sis (sarı kart eşiği −%20), Kırılgan, Tembel.
50. **[v2][P2]** Trait kaybetme görevi tanımlıdır: örneğin "Kırmızı Sis" 15 maç kartsız oynanınca silinir. Görev ilerlemesi profil ekranında görünür.

#### E. Antrenör, Tesisler, Sakatlık ve Rehabilitasyon

51. **[v1][P1]** Özel antrenör 4 uzmanlıktan biriyle (Teknik, Fizik, Zihinsel, Kaleci) tutulur ve kendi grubuna +%10/%20/%30 XP verir. Haftalık maaşı sabittir, oyuncunun maaşına endekslenmez. Sözleşme süresi oyun içi takvimle (ör. 1 sezon) gösterilir, gizli "150 maç" süresi yoktur.
52. **[v1][P1]** Antrenör uyarıları: erime uyarısı, aşırı yüklenme uyarısı (yorgunluk >70 iken antrenman) ve haftalık ilerleme özeti.
53. **[v1][P1]** Ev spor salonu (Fizik XP +%10), havuz (toparlanma +%15) ve kriyoterapi odası (sakatlık süresi −%20) kişisel tesisler olarak satın alınır. Her biri 3 seviyelidir ve etkileri hub'da sayısal gösterilir.
54. **[v2][P2]** Kulüp tesis seviyesi (Antrenman Sahası 1–5, Tıp Merkezi 1–5) transfer kararında kulüp kartında görünür. Seviye 5 tesisli kulüpte XP +%15 artar. Bu bilgi kulüp seçiminde gerçek bir kriter olur.
55. **[v1][P0]** Sakatlık tipleri ve süreleri veriye dayalıdır: hafif (3–10 gün), orta (2–6 hafta), ağır (2–9 ay). Risk şu faktörlerden hesaplanır: yorgunluk >80 (×2), Sakatlık Yatkınlığı, saha zemini ve rakibin Top Kapma agresifliği.
56. **[v1][P1]** Rehabilitasyon mini oyunu haftada 2 kez yapılabilir. Başarılı seans süreyi %5 kısaltır, haftada en fazla %10. Erken dönüş seçeneği %25 tekrar sakatlanma riski getirir ve risk açıkça gösterilir.
57. **[v1][P1]** Ağrı kesiciyle oynama kararı: maça çıkılabilir ama sakatlığın kötüleşme ihtimali %30 olur. Doktorun uyarısı ve TD'nin baskısı karar kartında birlikte sunulur.
58. **[v2][P2]** Kalıcı etkiler: ağır diz sakatlığı sonrası Hız ve Çeviklik −3 olabilir. Kriyoterapi ve iyi bir fizyoterapist bu riski %50 azaltır.
59. **[v1][P2]** Sakatlık geçmişi kariyer kartında saklanır ve transfer görüşmesinde sağlık muayenesi sonucunu etkiler. 2 yılda 3'ten fazla ağır sakatlık bonservisi %15 düşürür.

#### F. Sözleşme, Pazarlık ve Ajan

60. **[v1][P0]** Sözleşme maddeleri: haftalık maaş, süre (1–5 yıl), imza parası, gol, asist ve kurtarış bonusu, serbest kalma bedeli, oynama süresi garantisi (% maç), sakatlık sigortası, imaj hakkı payı ve yükselme/düşme maddesi.
61. **[v1][P0]** Hi-Lo kart oyununun yerine beceri tabanlı pazarlık gelir. Kulübün bir "esneklik bandı" ve bir "sabır göstergesi" (3–5 tur) vardır. Her turda maddeler arasında takas yapılır (ör. maaş −%5 karşılığında oynama garantisi +%15). Sonucu şans değil, piyasa bilgisi ve sabır yönetimi belirler.
62. **[v1][P0]** Pazarlıkta piyasa referansı gösterilir: aynı ligde benzer OVR ve yaştaki 5 NPC oyuncunun maaş aralığı. Oyuncu teklifinin "piyasanın %112'si" gibi konumunu görür.
63. **[v1][P0]** Başarısız pazarlığın cezası orantılıdır. Sabır sıfıra düşerse kulüp son teklifini sunar ve TD güveni yalnızca −3 düşer. NSS'deki sabit Boss −%20 cezası kaldırılır, kaptanlık asla pazarlık yüzünden kaybedilmez.
64. **[v1][P1]** Ajanın 3 kalite seviyesi vardır: Yerel, Ulusal, Süperajan. Komisyon %5/%8/%12'dir. Ajan esneklik bandını %10/%20/%30 genişletir ve "gizli ilgi" bilgisini açar. Ajan oyun parasıyla tutulur, gerçek parayla satılmaz.
65. **[v1][P1]** "Ajana bırak" seçeneğiyle pazarlık otomatik yapılır: sonuç ajan seviyesine göre bandın %40–70'i arasında olur. Mini oyunu sevmeyen oyuncu cezalandırılmaz.
66. **[v1][P1]** Yeniden pazarlık koşulları şeffaftır: son pazarlıktan 10 maç geçmiş olmalı, OVR +3 artmış olmalı veya bir ödül kazanılmış olmalı. Koşul sağlanmadıysa buton pasif görünür ve eksik koşul yazılır.
67. **[v1][P1]** Teklifler oyuncunun piyasa değerine, kulüp bütçesine, lig maaş seviyesine ve mevcut sözleşmeye bağlıdır. NSS'deki "yalnızca SR'ye bağlı" teklif mantığı kaldırılır.
68. **[v2][P2]** Performans maddeleri: "sezonda 15 gol = +%10 maaş artışı", "Avrupa'ya katılım = 250.000 bonus". Tetiklenince haber kartı ve bildirim gelir.
69. **[v2][P2]** Sözleşmenin son yılında Bosman serbestliği devreye girer: son 6 ayda yabancı kulüplerle ön anlaşma yapılabilir. Kulüp ise uzatma için baskı kartları gönderir.

#### G. Transfer, Kiralık ve İlgi

70. **[v1][P0]** Transfer pencereleri yaz (8 hafta) ve kış (4 hafta) olarak açılır. Sezon ortası transfer tüm liglerden mümkündür. NSS'deki "kışın yalnızca aynı lig" kısıtı kaldırılır.
71. **[v1][P0]** İlgi göstergesi: "Scout'lar seni izliyor" listesi kulüp adı, ilgi seviyesi (1–5) ve ilginin nedenini ("son 5 maçta 4 gol") gösterir. Teklif yalnızca ilgi ≥3 olan kulüplerden gelir.
72. **[v1][P0]** Gerçekçi kademe atlama: bir kulübün teklif yapabilmesi için oyuncunun OVR'si o kulübün kadro ortalamasının en fazla 6 altında olmalıdır. Alt ligden 1 sezonda dev kulübe çıkmak (NSS'deki "1. sezon sonunda PSG") ancak olağanüstü bir sezonla (40+ gol ve OVR ≥ kulüp ortalaması −3) mümkün olur.
73. **[v1][P0]** Bonservis bedeli ve imza parası transfer ekranında açıkça yazılır. Piyasa değeri yaş, OVR, potansiyel, sözleşme süresi ve formdan hesaplanır ve formülün dökümü görülebilir.
74. **[v1][P0]** Transfer talebi: karar kartıyla kulübe resmî talep iletilir. Etkileri: TD güveni −10, taraftar −15, kulübün satış istekliliği +%40. Talep 1 pencere boyunca geçerli kalır.
75. **[v1][P1]** Kiralık transfer: 17–23 yaş arası ve "Yedek" rolündeki oyuncuya kiralama teklifi gelebilir. Oyuncu da kiralanmayı talep edebilir. Kiralık kulüpte oynama garantisi (%60+) seçilebilir.
76. **[v2][P2]** Satın alma opsiyonlu kiralık: ana kulüp ile kiralayan kulüp arasında opsiyon bedeli bulunur. Oyuncu kalıcı olmayı kabul ya da reddedebilir.
77. **[v1][P1]** Transfer söylentileri, kulüp ilgisi 4'e çıktığında haber akışına düşer. Söylentiyi yalanlamak, onaylamak ya da yorum yapmamak taraftar ve TD ilişkisini etkiler (medya detayı için bkz. 2.4).
78. **[v1][P1]** Ülke ve lig bazında farklı transfer mantığı uygulanır. Zengin kurgusal liglerde (örneğin "Körfez Ligi") maaşlar 2 kat yüksektir ama şöhret artışı −%30 azdır. Teklif kartında "kariyer etkisi" uyarısı çıkar.
79. **[v1][P1]** Kulübe dönüş: eski kulübe yeniden transfer olunduğunda kulübün durumu korunur, sıfırlanmaz. Kadro, TD ve ilişkiler kaldığı yerden devam eder.
80. **[v2][P2]** Sağlık muayenesi ve kişisel şartlar 2 adımlı transfer akışıyla yürür. Muayeneden %2–8 olasılıkla (sakatlık geçmişine bağlı) kalınabilir.

#### H. Takım İçi Rol, TD Güveni ve Kaptanlık

81. **[v1][P0]** Kadro rolü 5 kademedir: Gençler, Yedek, Rotasyon, İlk 11, Yıldız (+ Kaptan). Her rolün maç başına beklenen süresi (0/20/50/85/90 dk) ve haftalık maaş etkisi yazılıdır.
82. **[v1][P0]** TD güveni (0–100), NSS'deki Boss barının yerini alır ve eşikleri anlamlıdır: <40 ise yedek, 40–60 rotasyon, 60–80 ilk 11, >80 kilit oyuncu. Her 10 puanlık aralık ilk 11 şansını %15 değiştirir. NSS'deki "%55 ile %100 arasında fark yok" sorunu biter.
83. **[v1][P0]** Kadro kararı performansa bağlıdır: son 3 maçın reyting ortalaması ≥7,5 olan oyuncu, TD güveninden bağımsız olarak en az rotasyonda tutulur. "Hat-trick yaptım ama ilişki düştü diye yedeğim" durumu yaşanmaz.
84. **[v1][P0]** Güven değişiminin nedenleri maç sonunda listelenir: "+4 gol, +2 taktik uyum, −3 antrenmana geç kalma". Gizli hesaplama yoktur.
85. **[v1][P1]** Yedek kulübesine düşünce karar kartı açılır: TD ile konuş, antrenmanda kendini göster ya da kamuoyuna şikâyet et. Her seçeneğin olası etkisi çiplerle gösterilir.
86. **[v1][P1]** Maç içinde oyuncu değişikliği talep edilebilir (sakatlık ya da yorgunluk >85). TD %70 olasılıkla kabul eder. Reddedilirse oyuna devam etmek sakatlık riskini artırır.
87. **[v1][P1]** Kaptanlık koşulu: kulüpte en az 1,5 sezon, Liderlik ≥65, TD güveni ≥75 ve takım ilişki ortalaması ≥60. Takım içi oylama olayıyla atanır.
88. **[v1][P1]** Kaptan yetkileri: maç başına 2 koşu yönü komutu, penaltıyı kimin kullanacağına karar, maç sonu röportajlarında öncelik ve +%10 sözleşme bonusu.
89. **[v2][P2]** Kaptan olarak diziliş önerisi: maç öncesi TD'ye 3 formasyondan biri önerilir. Kabul olasılığı Liderlik ve TD güvenine bağlıdır, kabul edilirse sonuca göre güven ±5 değişir.
90. **[v2][P1]** Devre arası konuşma mini oyunu (NSM klişe oyunundan uyarlandı): kaptanken 5 saniyede 4–5 cümle arasından doğru tonu seçersin. Her doğru seçim ikinci yarıda takım moralini +3 artırır. Yanlış seçim oyunu bitirmez, yalnızca o seçimin bonusu kaybedilir.

#### I. Milli Takım

91. **[v1][P0]** Milli takım basamakları U17, U19, U21 ve A Milli'dir. Her basamağın çağrı ölçütü açıktır, örneğin U21 için "ülke havuzundaki ilk 23 OVR içinde olmak veya son 10 maçta reyting ortalaması ≥7,2".
92. **[v1][P0]** Milli takım ilgi göstergesi 0–100 aralığında sayısal olarak görünür ve kadro açıklanmadan 2 hafta önce "kesin, olası, sınırda veya dışarıda" etiketi verilir. NSS'deki "50 MOTM'ye rağmen çağrı yok" belirsizliği biter.
93. **[v1][P1]** Lig kademesi çarpanı uygulanır: 1. kademe ×1,0, 2. kademe ×0,8, 3. kademe ×0,6. Ölçüt açık olduğu için oyuncu alt ligden çağrılmak için ne gerektiğini bilir.
94. **[v1][P1]** Milli maç takvimi her sezon 4 arada 8 maç ve 2 yılda bir turnuvadan oluşur. Turnuva yılında sezon sonu takvimi otomatik uzar.
95. **[v1][P1]** Çifte vatandaşlık seçimi: kökenden gelen ikinci ülke A Milli'de ilk resmî maça kadar seçilebilir. Seçim olay kartı ve ailenin tepkisi ile gelir.
96. **[v2][P2]** Milli takım kaptanlığı ve milli takım rolü (yedek, rotasyon, ilk 11) kulüp sisteminin aynısıyla ayrı bir milli TD güveni üzerinden yürür.
97. **[v1][P1]** Milli maçlardan dönen oyuncuda yorgunluk +15 olur, kulüp TD'si bunu ilk 11 kararında dikkate alır. Bilgi hub'da gösterilir.

#### J. Ödüller, Rekorlar ve Kariyer Hedefleri

98. **[v1][P0]** Ödüller şeffaf bir puan formülüyle verilir. "Altın Yıldız" puanı şöyle hesaplanır: gol ve asist katkısı %30, ortalama reyting %25, takım başarısı (kupalar) %25, büyük maç performansı %10, milli takım %10. Aday listesi ve her adayın puanı tören ekranında gösterilir.
99. **[v1][P0]** Oylama simülasyonu: 100 kurgusal gazeteci oy verir ve dağılım ±%5 gürültü içerir. Formülde açık ara önde olan oyuncu (≥%15 fark) ödülü kesin kazanır. NSS'deki "65 maçta 65 gol attım ama ödül alamadım" adaletsizliği engellenir.
100. **[v1][P1]** Ödül takvimi: Ayın Oyuncusu (lig başına), Sezonun Oyuncusu, Gol Kralı, Asist Kralı, Altın Eldiven, Genç Oyuncu (≤21), Altın Yıldız, Yılın Golü (oyuncu oylamalı) ve Yılın 11'i.
101. **[v1][P1]** Rekor takibi: kulüp, lig, ülke ve dünya rekorları (sezonda en çok gol, en genç golcü, art arda gol atılan maç sayısı). Bir rekora yaklaşıldığında "Rekora 2 gol kaldı" bildirimi gelir.
102. **[v1][P1]** Kariyer hedefleri her sezon başında önerilir: 3 kısa hedef ("İlk 11'e gir") ve 1 uzun hedef ("25 yaşından önce Altın Yıldız"). Tamamlanan hedef kariyer skoruna puan ekler.
103. **[v1][P1]** Sezon değerlendirmesi ekranında TD ve kulüp yönetimi oyuncuya sezonu A–F arasında notlar ve gerekçesini yazar.
104. **[v2][P2]** "Efsane Yolu" uzun vadeli meydan okumaları: "Tek kulüp efsanesi (15 sezon)", "5 ülkede şampiyon", "Kalecilikte 100 gol yemeden maç serisi" gibi nadir hedefler.
105. **[v1][P1]** Sadakat unvanları: 100 maç "Taraftar Favorisi", 250 maç "Kulüp Kahramanı", 500 maç "Ölümsüz Efsane". Her unvan kalıcı bir perk benzeri bonus getirir (o kulüpte taraftar etkisi +%10).

#### K. Emeklilik, Kariyer Sonrası ve Miras

106. **[v1][P0]** Emeklilik isteğe bağlıdır. 33 yaşından sonra her sezon sonunda "devam mı, bırak mı" kartı gelir. Kariyer skoru şu bileşenlerden hesaplanır: kupalar, ödüller, rekorlar, gol, asist ve kurtarış, OVR zirvesi, sadakat. Döküm ekranında her bileşenin katkısı görünür.
107. **[v1][P1]** Zorunlu emeklilik yoktur, ama 38 yaşından sonra fiziksel düşüş sezonda 4–6 puana çıkar. Bu, NSS'deki "100 yaşında oynayan oyuncu" absürtlüğünü doğal olarak engeller.
108. **[v1][P1]** Sakatlık nedenli emeklilik kararı: ağır sakatlıktan sonra doktor "kariyeri riskli" raporu verirse oyuncu devam etmeyi seçebilir, risk ekranda yazılı olur.
109. **[v2][P1]** Jübile maçı: emeklilik sezonu sonunda kariyer boyunca en yüksek ilişkiye sahip 10 takım arkadaşıyla özel bir maç oynanır. Gelir hayır kurumuna gidebilir.
110. **[v2][P1]** Teknik Direktör modu: emeklilikten sonra alt ligden bir kulübe TD olunur. Aynı maç motoru "takımı yönet" anlarıyla oynanır (taktik, değişiklik ve ver-kaç komutları). Oyuncuların menajerlik isteği karşılanır, mod isteğe bağlıdır.
111. **[v2][P2]** Yorumcu yolu: haftalık maç yorumlama mini oyunu (oyuncu tahmini ve analiz soruları). Gelir ve şöhret sağlar, futbol dünyası arka planda dönmeye devam eder.
112. **[v3][P2]** Kulüp Başkanı modu: bir kulübün hissesini satın alıp bütçe, tesis yükseltmeleri ve TD atama kararları verilir. Kariyer boyunca biriktirilen servet burada anlam kazanır.
113. **[v2][P1]** Antrenörlük yolu: eski kulübün akademisinde çalışılır. Genç oyuncuları geliştirmek, kariyer skoruna "mirasın" bir parçası olarak eklenir.
114. **[v2][P0]** Miras (Legacy): yeni kariyer oğlun ya da kızın olarak başlar. Yüz facesjs `relative` ile üretilir. Ünlü soyadı +15 başlangıç şöhreti verir, ama "babasının gölgesi" baskı olayları da gelir. Aile servetinin %30'u devralınır ve 1 seçilmiş perk mirası olarak aktarılır.
115. **[v2][P1]** Nesiller arası dünya sürekliliği: önceki kariyerin kulüpleri, rekorları ve rakipleri miras kariyerinde yaşar. Eski takım arkadaşları artık TD ya da ajandır.
116. **[v1][P1]** Onur Listesi müzesi: tüm kariyerlerin kupaları, rekorları, kariyer skoru ve oyuncu kartı tek bir galeride durur. Miras ağacı da burada görselleştirilir.

#### L. Zorluk, İlerleme Dengesi ve Save-Scum Politikası

117. **[v1][P0]** Zorluk 4 hazır ayardan seçilir (Kolay, Normal, Zor, Efsane) ve isteğe göre özel ayar yapılır. Özel ayarın kaydırıcıları: maç yardımı, XP çarpanı, transfer gerçekçiliği, erime hızı. Hard mod NSS'deki gibi kilitli değildir, baştan seçilebilir.
118. **[v1][P0]** Normal modda gerçekçi istatistik bandı: tam sezonda lig golü beklentisi 15–45 aralığındadır. Bunu aşan performans için rakiplerin YZ adaptasyonu (çift markaj) artar. NSS'deki "bir sezonda 500 gol" engellenir.
119. **[v1][P0]** Save-scum politikası: maç sonucu ve maç içi seed'ler maç başlamadan önce kayda yazılır. Uygulamayı kapatıp açmak aynı anları aynı koşullarla tekrar getirir, sonuç ancak daha iyi oynanarak değiştirilebilir. NSS'deki "kapat-aç" istismarının tersine, sonuç önceden belirlenmez.
120. **[v1][P1]** "Bir Daha Dene" hakkı: maç başına 1 an tekrar hakkı (NSM'deki retry'den alındı) Kolay ve Normal modda vardır. Zor ve Efsane modda kapalıdır, kullanımı kariyer skoruna yansır (%−1).
121. **[v1][P1]** Demir Adam (Ironman) seçeneği: tek kayıt slotu kullanılır, geri dönüş yoktur ve kariyer skoruna ×1,2 çarpan uygulanır. Global sıralamada ayrı bir kategoride listelenir.
122. **[v1][P1]** Kariyerin ilk 2 sezonunda olumsuz olayların (sakatlık, ilişki düşüşü) etkisi %50 azaltılır. Yeni oyuncu erken kariyerde cezalandırılmaz.
123. **[v1][P1]** İlerleme hızı kalibrasyonu: ortalama bir oyuncu 25 oyun yılında (yaklaşık 40–60 saat) zirveye ulaşır. Hedef, simülasyon testleriyle 1.000 kariyerde doğrulanır: medyan zirve OVR 84 ± 4.

#### M. Late-Game İçerik

124. **[v1][P1]** Rakip yıldız (nemesis) sistemi: aynı yaşta ve mevkide prosedürel bir rakip, ödül yarışında ve transfer söylentilerinde sürekli karşına çıkar. Kafa kafaya istatistik kartı tutulur.
125. **[v2][P1]** Takım arkadaşı mentorluğu: 30 yaşından sonra genç bir NPC oyuncuya mentor olunabilir. Haftalık 1 zaman dilimi harcanır, NPC'nin gelişimi +%20 olur. Mentorluk yapılan oyuncu yıldız olursa kariyer skoruna bonus eklenir.
126. **[v2][P2]** Oyuncu-Teknik Direktör (Player-Manager) geçişi: 34 yaşından sonra kulüp "oyuncu-TD" teklifi yapabilir. Hem maçta oynanır hem kadro ve taktik kararları verilir (Dino Dini's Player Manager benzeri isteğe karşılık).
127. **[v2][P2]** "Son Dans" sezonu: emeklilik ilan edilen sezonda her deplasman maçında saygı alkışı olayı yaşanır, taraftar etkisi +%20 olur ve özel bir veda röportajı mini oyunu oynanır.
128. **[v3][P2]** Kariyer sonu belgeseli: kariyer zaman çizelgesinden otomatik derlenen, anahtar anların tekrarları ve manşetlerinden oluşan bir "belgesel" ekranı. Paylaşılabilir özet olarak sunulur.


### 2.4 Sosyal Hayat, İlişkiler, Kararlar ve Olaylar

NSS'de ilişkiler beş bardan, kararlar da sığ ve kendini tekrar eden bir ikilem havuzundan ibaretti. StarPath'te ilişkiler hafızası olan kişilerdir. Kararlar, sonucu görünen zincirlerdir. Olay motoru da veriyle çalışır, test edilebilir ve genişletilebilir.

#### A. İlişki Modeli (Çekirdek)

1. **[v1][P0]** Kişi bazlı ilişki değeri: Her NPC'nin -100..100 arası ayrı bir ilişki değeri olur. NSS'deki tek "TEAM" barı yerine her takım arkadaşı ayrı izlenir. Test: 25 kişilik kadroda 25 bağımsız değer kayıtta saklanır ve UI'da listelenir.
2. **[v1][P0]** İlişki hafızası: Her kişi son 5 önemli olayı neden-etki metniyle hatırlar ("Kupa finalinde ona pas vermedin, -8"). Kişi kartında "Hatırladıkları" sekmesi bulunur.
3. **[v1][P0]** Kademeli eşikler: NSS'de Boss %55 ile %100 arasında hiçbir fark yaratmıyordu. Bizde her 20 puanlık bant ayrı bir etki verir: -100..-60 düşman, -60..-20 soğuk, -20..20 nötr, 20..60 sıcak, 60..100 sadık. Her bandın en az bir oynanış etkisi vardır ve bu etkiler ilişki ekranında yazılı durur.
4. **[v1][P0]** Doğal sönümleme: İhmal edilen ilişki haftada değerinin %2'si kadar sıfıra doğru yaklaşır. Aile ilişkileri yarı hızla söner. Sönümleme, sıcak bandın altına tek seferde 3 puandan fazla düşüremez.
5. **[v1][P0]** "Neden değişti?" kaydı: Her ilişki değişimi kaynak olayla birlikte kayıt defterine yazılır (tarih, olay ID, miktar). İlişki ekranındaki ok simgesine dokunan oyuncu son 10 değişimi görür.
6. **[v1][P0]** Performans ile ilişki ayrımı: Hat-trick ve 2 asistlik bir maçtan sonra takım ilişkisi düşmez. Maç sonucundaki kötü performansın faturası bireysel katkıya göre dağıtılır. Test: Rating ≥8.0 olan maçta takım ilişkisinde net negatif değişim olmaz.
7. **[v1][P0]** Sıfır toplamlı ikilemlerin yasaklanması: Bir seçenekte bir tarafın kaybı, öbür tarafın kazancının en fazla 1,5 katı olabilir. Olay doğrulayıcı (linter) bu oranı aşan seçenekleri derleme sırasında reddeder.
8. **[v1][P1]** İlişki boyutları: Ana değerin yanında iki gizli alt eksen tutulur: Güven (sözünü tutma) ve Saygı (sahadaki başarı). Bazı olaylar ancak "Güven ≥40" gibi koşullarla açılır.
9. **[v1][P1]** Kişilik özellikleri: Her NPC'nin 2 özelliği vardır (Kıskanç, Sadık, Hırslı, Esprili, Muhafazakâr, Parti Sever...). Aynı eylem farklı kişide farklı tepki doğurur. Test: Kıskanç bir takım arkadaşı, oyuncunun lüks paylaşımına -5 verirken Esprili bir takım arkadaşı +2 verir.
10. **[v1][P1]** Etkileşim azalan getirisi: Aynı kişiyle aynı hafta tekrarlanan etkileşimin etkisi her seferinde yarıya iner. Böylece yemek ısmarlayarak sonsuz puan toplama (grind) engellenir.
11. **[v1][P0]** Memory mini oyununun kaldırılması: NSS'nin kart eşleştirme oyunu yerine bağlama özgü kısa sahneler gelir: konuşma seçimi (3 seçenek), ortak aktivite (birlikte antrenman, yemek, oyun gecesi). Her sahne 20 saniyenin altında biter.
12. **[v2][P1]** İlişki ağı görseli: Kişiler arası ilişkiler (yalnızca oyuncuyla olanlar değil) görünür olur. Örnek: "Kaptan ile yeni transfer arasında gerilim var" bilgisi çizgi rengiyle gösterilir.
13. **[v1][P1]** Barların yerine hikâye: Ana ekranda "Partner %43" gibi yüzdeler yerine durum cümleleri görünür ("Deniz son günlerde sana küs"). Sayısal değer ayrıntı ekranında kalır.

#### B. Aile

14. **[v1][P0]** Başlangıç ailesi: Kariyer anne, baba ya da tek ebeveyn, 0–2 kardeş ve 1 çocukluk arkadaşıyla başlar. Aile yapısı geçmiş hikâyesine göre prosedürel olarak belirlenir ve "ebeveynsiz/koruyucu aile" seçeneği de vardır.
15. **[v1][P0]** Aile mutluluğa bağlıdır, zorunlu değildir: Aile ilişkisi mutluluğun bileşenlerinden biridir ve tek başına kariyeri çökertemez. Test: Aile -100 olsa bile mutluluk tavanı en fazla 25 puan düşer.
16. **[v1][P1]** Aileye para desteği: "Annemin ev kredisini öde", "Kardeşimin üniversite harcı" gibi olaylar çıkar. Reddetmek değeri düşürür. Kabul etmenin şöhret etkisi yoktur, yalnızca aile ve mutluluk etkisi vardır.
17. **[v1][P1]** Ebeveyn tavsiyesi: Baba/anne, transfer ya da sözleşme kararlarından önce yorum yapar ("Bence şehir değiştirmek için erken"). Tavsiyeye uymak +4, uymamak -2 verir. Tavsiyenin isabeti sezon sonunda "haklıymış" diye geri bildirilir.
18. **[v1][P1]** Kardeş yan hikâyesi: Kardeşin kendi hedefi olur (futbolcu olmak, iş kurmak, okul). Oyuncu destek verirse kardeşin hikâyesi 3–5 olaylık bir zincirle ilerler.
19. **[v1][P1]** Çocukluk arkadaşı: Şöhret arttıkça "beni unuttun" gerilimi doğar. Arkadaş ya sadık kalır, ya basına konuşur ya da ajana dönüşür. Bu üç olası sonun tetikleyicileri belgelenir.
20. **[v2][P1]** Aile ziyareti aktivitesi: Akşam dilimini harcar. Stres -10, aile +6 verir. Deplasmandaysa video görüşme olarak yapılır ve etkisi yarıdır.
21. **[v2][P2]** Aile kaybı ve yas: Nadir ve yaşa bağlı bir olaydır (ebeveyn hastalığı/kaybı). Oyuncu maçtan izin alabilir. TD'nin tepkisi kişiliğine göre değişir. İçerik uyarısı ve "bu tür olayları kapat" ayarı bulunur.
22. **[v2][P2]** Aile işi zinciri: Babanın dükkânı batmak üzeredir. Oyuncu kurtarabilir, ortak olabilir ya da uzak durabilir. Para tarafı 2.5'teki işletme sistemine bağlanır.

#### C. Aşk, Evlilik, Ayrılık ve Çocuk

23. **[v1][P0]** Romantizm tamamen opsiyonel: Partner yokluğu hiçbir göstergeye ceza vermez. NSS'deki "mutlu olmak için kız arkadaş şart" sorunu ortadan kalkar. Test: Bekâr oyuncu %100 mutluluğa ulaşabilir.
24. **[v1][P0]** Cinsiyet-nötr partner: Oyuncu, partnerin cinsiyetini ve hangi cinsiyetlerle tanışmak istediğini ayarlardan seçer. Eşcinsel ilişkiler tam desteklidir ve oyuncunun cinsiyetini değiştirmek partnerinkini değiştirmez.
25. **[v1][P0]** Partner krizi Boss'u çökertmez: NSS'deki "partner öfke krizi = Boss çöküşü" kaldırılır. Partner gerilimi stres ve mutluluk üzerinden dolaylı etki yapar ve tek olayda TD ilişkisine en fazla -5 yansır.
26. **[v1][P1]** Tanışma yolları: Parti, ortak arkadaş, hayır etkinliği, sosyal medya mesajı, mahalle. Her yolun başlangıç uyumu ve risk profili farklıdır. Örneğin sosyal medyadan tanışılan kişi %15 olasılıkla "ilgi peşinde" çıkar.
27. **[v1][P1]** Partner kişiliği ve hedefleri: Partnerin mesleği (doktor, müzisyen, sporcu, girişimci) ve kendi takvimi olur. Deplasmanlarla çakışan önemli günleri (doğum günü, sergisi) kaçırmak ayrı olaylar üretir.
28. **[v1][P1]** İlişki aşamaları: Flört → Sevgili → Birlikte yaşama → Nişan → Evlilik. Her aşamaya geçiş, oyuncuya sorulan bir karar kartıdır ve hiçbiri otomatik gerçekleşmez.
29. **[v2][P1]** Evlilik töreni: Tören büyüklüğü seçilir (sade, orta, gösterişli). Gösterişli tören şöhret +, stres +, takım arkadaşı davet listesi ise ilişki etkisi yaratır. Davet edilmeyen yakın arkadaş -10 alır.
30. **[v2][P1]** Ayrılık ve boşanma: Ayrılık bir olay zinciridir (tartışma → ara → karar). Kamuoyuna duyurma biçimi seçilir (sessiz, ortak açıklama, röportaj). Boşanmanın mal paylaşımı 2.5'e bağlanır.
31. **[v2][P1]** Çocuklar: Evlilik ya da birlikte yaşamadan sonra opsiyonel olarak çocuk sahibi olunur, evlat edinme de mümkündür. Çocuğun doğum günü, okul gösterisi ve ilk maç izlemesi gibi olaylar çıkar. Çocuk olayları maç öncesi gününe denk gelirse "uyku eksikliği" (kondisyon -5) oluşur.
32. **[v2][P1]** Miras köprüsü: Çocuğun yetiştirilme kararları (futbola teşvik, okula odak, serbest) Miras modunda çocuğun başlangıç özelliklerine ve kişiliğine yansır.
33. **[v1][P2]** Paparazzi ve özel hayat: Partnerle yapılan tatil fotoğraflanabilir. Oyuncu ya ilişkiyi açıklar, ya gizler (risk birikir) ya da hukuki yola başvurur.
34. **[v2][P2]** Uzak ilişki: Yurt dışına transferde partner taşınmayı reddedebilir. Haftalık görüntülü arama sağlanmazsa ilişki iki kat hızlı söner.
35. **[v1][P1]** Reddetme hakkı: Partnerin tüm teklifleri (taşınma, evlilik, çocuk) reddedilebilir. Ret, en fazla tek seferlik bir -15 kayıp doğurur, kalıcı bir ceza zinciri başlatmaz.

#### D. Takım Arkadaşları

36. **[v1][P0]** Pas sıklığı görünürlüğü: GDD'deki "Arda sana pas vermiyor" ipucu uygulanır. Maç içinde topu tutan takım arkadaşının ilişki bandı küçük bir ikonla görünür. Maç sonu raporu "X sana 2 pas verdi, 4 fırsatı kendi kullandı" bilgisini verir.
37. **[v1][P0]** Arkadaşlık kurma: Oyuncunun en fazla 3 kişilik bir "yakın arkadaş" listesi olur. Yakın arkadaş, kriz anında yanında durur, transfer söylentisinde içeriden bilgi verir ve ver-kaç fırsatı +%10 artar.
38. **[v1][P1]** Rakip takım arkadaşı: Aynı pozisyonda oynayan yıldız, oyuncunun doğal rakibidir. Rekabet ilişkisi ayrı izlenir ve ilk 11 kararlarında TD'ye yorum yapar.
39. **[v1][P1]** Klikler: Kadro 2–4 klike ayrılır (kıdemliler, yabancılar, akademi çocukları, parti grubu). Bir klike yaklaşmak diğerinde hafif kayıp yaratır, ancak bu kayıp kazancın en fazla yarısı kadar olur. Klik haritası "Soyunma Odası" ekranında görünür.
40. **[v1][P1]** Mentorluk (alma): Kariyer başında 30+ yaşlı bir kıdemli mentor olmayı teklif eder. Mentorlu oyuncu haftalık Soğukkanlılık XP'sinde +%10 alır. Mentor emekli olduğunda veda olayı çıkar.
41. **[v2][P1]** Mentorluk (verme): 28 yaştan sonra oyuncu bir genci yanına alabilir. Gencin gelişimi haberlerde "X'in öğrencisi" olarak geçer ve Liderlik özelliği +XP alır.
42. **[v1][P1]** Yeni transferi karşılama: Kulübe yeni gelen oyuncuya yardım etmek (şehri gezdirmek) +15 ilişki verir. Görmezden gelmenin cezası yoktur.
43. **[v1][P1]** Takım arkadaşı davetleri: NSS'deki alışveriş ve kumarhane davetleri genişletilir: oyun gecesi, golf, doğum günü, düğün, hayır yemeği. Her davetin bir zaman dilimi maliyeti ve risk notu vardır.
44. **[v2][P2]** Eski takım arkadaşları: Transferden sonra eski kulüpteki arkadaşlıklar sönümle devam eder. Eski kulübe karşı oynanan maç öncesinde mesaj olayları çıkar.
45. **[v1][P1]** Ortak sevinç: Gol sevinci seçimi (takım arkadaşına koşmak, asist yapana teşekkür etmek) ilgili kişiye +3 verir. Bu, NSS5'teki sevinç mekaniğinin ilişki karşılığıdır.

#### E. Teknik Direktör ve Ajan

46. **[v1][P0]** TD güveni ile forma kararının ayrılması: Kadro kararı en az %60 ağırlıkla form ve reytinge dayanır. İlişki en fazla %25 etkiler. Test: Son 5 maç rating ortalaması ≥7.5 olan oyuncu, TD ilişkisi -50 olsa bile ilk 11'den düşmez.
47. **[v1][P0]** TD'nin açık beklentileri: TD haftalık 1–2 beklenti söyler ("Pres yap", "Bireysel oynama"). Karşılanan beklenti +4 verir ve maç sonu raporda işaretlenir.
48. **[v1][P1]** TD görüşmesi aktivitesi: Oyuncu rol, pozisyon ya da forma şansı konuşmak için randevu ister. Ton seçimi (saygılı, net, ültimatom) yapılır. Ültimatomun %50 olasılıkla geri tepeceği önceden "riskli" ipucuyla gösterilir.
49. **[v1][P1]** TD değişikliği: Yeni TD geldiğinde ilişki sıfırlanmaz, %50'si korunur. Yeni TD'nin taktik kimliği ve gözdesi açıklanır.
50. **[v1][P1]** Ajan sadakati: Ajanın da ilişki değeri vardır. Düşük ilişkide ajan gizli ilgi bilgisini paylaşmaz ve başka müşteriyi kayırır. Ajandan ayrılmanın tek seferlik bir şöhret/basın olayı olur.
51. **[v2][P2]** Ajan skandalı: Ajanın başka bir oyuncuyla yaptığı yasa dışı anlaşma ortaya çıkar. Oyuncu ondan uzaklaşmazsa itibar zarar görür.

#### F. Takım İçi Kararlar

52. **[v1][P0]** Penaltıyı kim atacak: Maç içinde penaltı kazanıldığında "Topu iste / Kaptana bırak / Formdakine ver" seçimi çıkar. Kaçırılan istenmiş penaltı -6 takım, gol +4 verir. Kaptanın kişiliği tepkiyi değiştirir.
53. **[v1][P0]** Kaptanlık seçimi: Sezon başında kaptanlık oylaması yapılır. Oyuncunun oyu ve kampanya yapması (kıdemlilerle yemek) ilişkileri etkiler. Kaybeden adayla sezon boyu süren bir rekabet bayrağı tutulur.
54. **[v1][P1]** Soyunma odası kavgası: İki takım arkadaşı tartışır. Oyuncu taraf tutar, arabuluculuk yapar ya da uzak durur. Arabuluculuk Liderlik ≥50 ile açılır ve başarı şansı ekranda gösterilir.
55. **[v1][P1]** Devre arası konuşması: Kaptan oyuncu, NSM'den esinlenen 10 saniyelik bir konuşma seçer (sakinleştir, ateşle, taktik hatırlat). Doğru seçim ikinci yarı takım moralini +5 artırır.
56. **[v1][P1]** Takım toplantısında söz alma: Kötü seri sonrası yapılan toplantıda oyuncu sorumluluk alır, eleştiri yapar ya da sessiz kalır. Her seçeneğin TD, kıdemliler ve klikler üzerindeki etkisi farklıdır.
57. **[v2][P1]** Prim boykotu: Takım ödenmemiş primler için antrenman boykotu planlar. Katılmak takımı +, TD ve yönetimi - etkiler. Bu olay kulübün mali durumuna bağlı olarak tetiklenir.
58. **[v2][P2]** Doping şüphesi olan arkadaş: Bir takım arkadaşının şüpheli takviye kullandığını görürsün. Sessiz kalmak, yüzleşmek ya da kulübe bildirmek seçenekleri vardır. Bu olay 3 adımlı bir zincirdir.
59. **[v1][P1]** Yedek kalınca tepki: Yedek bırakılan oyuncu "sessizce çalış", "basına dert yan" ya da "TD ile konuş" seçeneklerinden birini seçer. Basına dert yanmak taraftar desteği getirir ama TD'yi kızdırır.

#### G. Basın ve Röportajlar

60. **[v1][P0]** Röportaj etkisine tavan: Kötü röportaj mükemmel bir maçın kazancını silemez. Tek bir röportajın ilişki etkisi, o maçın rating kaynaklı etkisinin en fazla %40'ı olur.
61. **[v1][P0]** Röportaj mini oyunu: 3 soru sorulur. Her soru için ton seçilir (mütevazı, iddialı, eleştirel, esprili), cevaplar da serbest metin değil 3 seçenekli diyalogdur. Gazeteci tuzak soru sorduğunda kısa bir "tuzak" ipucu çıkar (Soğukkanlılık ≥60 ise).
62. **[v1][P1]** Gazeteci kişilikleri: 6–8 tekrar eden gazeteci olur (dedikoducu, analist, yerel muhabir, düşmanca köşe yazarı). Her biriyle ayrı ilişki tutulur. İyi ilişki sizdırılan haberlerin yumuşak yazılmasını sağlar.
63. **[v1][P1]** Basın toplantısı: Büyük maç öncesinde yapılır. Oyuncunun söyledikleri ("Onları yeneceğiz") rakibe motivasyon olayı ve maç sonunda "sözünü tuttu / tutmadı" manşeti üretir.
64. **[v1][P1]** Basına konuşmama hakkı: "Yorum yok" her zaman bir seçenektir. Küçük bir basın cezası (-3) getirir ama asla büyük kayıp üretmez.
65. **[v1][P0]** Manşet sisteminin gerekçeli olması: Her gazete manşeti (ör. kumar ya da stil manşeti) tetikleyen eylemi belirtir. Kumarhaneye tek bir ziyaret "kumar bağımlısı" manşeti üretmez. Bu manşetin eşiği, bir ayda 3+ ziyaret ya da yüksek kayıptır.
66. **[v1][P1]** Stil manşetleri: NSS'nin "style moron" mizahı korunur ama kurala bağlanır. Tarz puanı ile ortam uyumu karşılaştırılır (ör. ödül törenine eşofmanla gitmek). Olumlu karşılığı da vardır ("Haftanın en şık futbolcusu").
67. **[v2][P2]** Sesli röportaj sunumu: Röportajlar TV stüdyosu ve mikser alanı sahnesiyle sunulur (2.2'deki görsel sunumla uyumlu). Metin hızı ayarlanabilir.
68. **[v2][P1]** Belgesel ve otobiyografi: Şöhret ≥80 olduğunda belgesel çekimi teklifi gelir. Oyuncu özel hayatını açabilir ya da kısıtlayabilir. Özel hayatı açmak şöhret getirir ama aile ve partner ilişkisini riske atar.

#### H. Sosyal Medya

69. **[v1][P0]** Sosyal medya akışı: Uygulama içinde kurgusal bir sosyal ağ olur ("Akış"). Takipçi sayısı, beğeni ve taraftar yorumları prosedürel olarak üretilir. Haftada en fazla 3 paylaşım yapılır ve her paylaşım bir zaman dilimi harcamaz.
70. **[v1][P0]** Paylaşım tipleri: Antrenman, lüks, aile, hayır, provokasyon, taraftara teşekkür, rakibe gönderme. Her tipin takipçi, şöhret ve ilişki etkisi paylaşım öncesinde çiplerle gösterilir.
71. **[v1][P1]** Viral olasılığı: Her paylaşımın %2–10 viral olma şansı vardır ve bu şans şöhrete ve içeriğe bağlıdır. Viral olumlu içerik takipçiyi 2–5 kat artırır, viral olumsuz içerik ise bir kriz zinciri başlatır.
72. **[v1][P1]** Nefret yorumları: Kötü maçtan sonra yorumların bir kısmı nefret içerir (küfürsüz, filtrelenmiş metinler). Etkisi stres artışıdır. "Yorumları kapat" aksiyonu stresi düşürür ama taraftar etkileşimini azaltır.
73. **[v1][P1]** Transfer söylentileri: Akışta ve haberlerde oyuncu hakkında söylentiler çıkar. Söylentilerin bir kısmı gerçek ilgiye, bir kısmı uydurmaya dayanır. Ajan seviyesi doğruluğu ayırt etme şansını artırır.
74. **[v1][P1]** Marka işbirliği DM'leri: Takipçi eşiği aşıldığında küçük marka teklifleri DM olarak gelir. Kurgusal markalarla yapılır. Şüpheli tekliflerin dolandırıcılık olma ihtimali vardır (bkz. madde 92).
75. **[v1][P2]** Rakiple atışma: Rakip yıldız göndermeli bir paylaşım yapar. Yanıt vermek, görmezden gelmek ya da sahada cevap vermek ("bir sonraki maçta gol at" görevi) seçilebilir.
76. **[v2][P1]** Sosyal medya danışmanı: Tutulan danışman riskli paylaşımları önceden uyarır ve viral olumsuz olasılığını yarıya indirir.
77. **[v2][P2]** Eski paylaşım krizi: Yıllar önce yapılmış bir provokasyon paylaşımı kariyerin zirvesinde ortaya çıkar. Bu, kariyer kayıt defterinden gelen gecikmeli bir olaydır.
78. **[v1][P1]** Sosyal medyadan uzak durma: Oyuncu hesabını dondurabilir. Takipçi artışı durur ama nefret yorumlarından gelen stres sıfırlanır. Bu geçerli ve cezasız bir oyun tarzıdır.

#### I. Taraftarlar

79. **[v1][P0]** Taraftar grupları: Her kulübün 2–3 taraftar grubu olur (ultralar, aile tribünü, yerel dernek). Grupların beklentileri farklıdır: ultralar sadakat ve mücadele, aile tribünü güler yüz ve imza ister.
80. **[v1][P1]** Taraftar etkileşimi: İmza günü, antrenman sonrası fotoğraf, hasta çocuk ziyareti. Her etkileşim zaman dilimi harcar ve ilgili grubu artırır.
81. **[v1][P1]** Rakip kulübe transfer tepkisi: Ezeli rakibe giden oyuncu eski kulüpte "hain" bayrağı alır. İlk dönüş maçında ıslık ve odak testi olayı yaşanır.
82. **[v1][P1]** Taraftar marşı: Taraftar ilişkisi ≥70 ve 25+ gol olduğunda taraftarlar oyuncu için marş besteler. Bu bir başarım ve tribün sesi olarak duyulur (2.8 ile bağlantılı).
83. **[v2][P2]** Taraftar protestosu: Kulüp kötü giderken taraftarlar protesto yapar. Oyuncu destek verirse taraftar +, yönetim - etkisi olur.

#### J. Skandallar, Hukuk ve Sağlık

84. **[v1][P0]** Rüşvet olayının yeniden tasarlanması: Şüpheli karakter teklifi kariyer sonu getiren rastgele bir tuzak olmaktan çıkar. Teklifi reddetme ve polise bildirme seçenekleri açıktır. "Kabul et" seçeneği belirgin bir "ağır risk" uyarısı taşır. Reddetmek hiçbir zaman ceza vermez. Kendi maçına bahis yapmak ise GDD'ye uygun olarak ağır skandaldır.
85. **[v1][P0]** Skandal şiddeti ölçeği: Skandallar 4 seviyeye ayrılır (dedikodu, kriz, skandal, yıkım). Yıkım seviyesine yalnızca oyuncunun açık bir yasadışı seçimiyle ulaşılabilir, rastgele olaylar en fazla "kriz" seviyesine çıkar.
86. **[v1][P1]** Kriz yönetimi: Skandal sonrasında halkla ilişkiler seçenekleri sunulur: özür, inkâr, sessizlik, hukuki yol. Doğru seçim skandalın etkisini %30–60 azaltır. Her yolun risk ipucu görünür.
87. **[v1][P1]** Gece hayatı riskleri: Maç arifesinde parti kondisyonu düşürür ve fotoğraflanma riski taşır. Risk, partiye gitmeden önce yüzdeyle gösterilir. Alkol tasviri derecelendirme kurallarına uyar (bkz. 2.12) ve araç kullanma gibi yasadışı seçenekler sunulmaz.
88. **[v2][P1]** Hukuki davalar: Trafik cezası, sözleşme anlaşmazlığı, iftira davası. Avukat tutulur, mahkeme süreci 2–6 haftalık bir zincir olarak işler ve sonuç olasılıkları avukatın seviyesine bağlıdır.
89. **[v1][P1]** Sakatlık psikolojisi: Uzun sakatlıkta (6+ hafta) motivasyon olayları çıkar: tedaviye odaklanma, aile desteği, terapist. Gerçekçi ama umut veren bir tonla yazılır.
90. **[v1][P0]** Ruh sağlığı ve stres hassasiyeti: Yüksek stres "tükenmişlik" olarak tasvir edilir ve çözüm yolları (dinlenme, terapi, aile) her zaman ulaşılabilir durur. Kendine zarar ve intihar gibi temalar kesinlikle yer almaz. Ruh sağlığı olaylarında yardım hattı bilgisi bulunur. Bu ilke yazım rehberinde zorunludur.
91. **[v2][P2]** Doping kontrolü: Rastgele kontroller yapılır. Temiz oyuncu için bu yalnızca bir anlatı olayıdır. Şüpheli takviye satın alınmışsa (yalnızca açık bir seçimle) risk oluşur.
92. **[v1][P1]** Dolandırıcılık: Sahte yatırım teklifi, sahte menajer ve kimlik avı DM'si gibi olaylar çıkar. Uyarı işaretleri metinde ipucu olarak bulunur. Ajan veya danışman sahibi olmak uyarı sağlar. Bu olaylar oyuncuya gerçek hayat dersi verecek şekilde yazılır.
93. **[v2][P2]** Şantaj: Özel fotoğraf veya gizli bir bilgi üzerinden şantaj yapılır. Ödeme, polis ya da kamuoyuna açıklama seçenekleri vardır. Ödemek zinciri tekrarlatır, bu tasarım gereği "en kötü seçim" olarak öğretilir.

#### K. Hayır İşleri ve Toplum

94. **[v1][P1]** Vakıf kurma: Şöhret ≥50 olduğunda kendi vakfını kurma olayı açılır. Odak seçilir (eğitim, sağlık, mahalle sahaları). Haftalık bağış, şöhret ve taraftar ilişkisini besler.
95. **[v1][P1]** Mahalle sahasına dönüş: Çocukluk sahasının yenilenmesi için bir hikâye zinciri vardır. Çocukluk arkadaşı ve aile bu zincire bağlanır.
96. **[v2][P2]** Elçilik görevleri: Kurgusal uluslararası kuruluşlar için elçilik yapılır. Milli maç aralarında seyahat eder, yorgunluk + ve şöhret + getirir.
97. **[v1][P2]** Sahte hayır skandalı önlemi: Hayır işini yalnızca paylaşım için yapmak ("bağış yapmadan fotoğraf") ortaya çıkarsa ters teper. Bu bir olası olaydır.

#### L. İsimlendirilmiş Zincir Olaylar (Örnek Senaryolar)

98. **[v1][P0]** Zincir "Eski Mahalle": Çocukluk arkadaşı borç ister → verirsen 4 hafta sonra geri öder ya da kaybolur → kaybolursa 10 hafta sonra basına "unuttu bizi" röportajı verir → yüzleşme ya da affetme seçimi yapılır. 4 adım, 3 farklı son.
99. **[v1][P0]** Zincir "Penaltı Tartışması": Kaptan ile penaltı kavgası çıkar → topu alırsan sonuç gol ya da kaçan penaltıdır → soyunma odası toplantısı yapılır → sezon sonu kaptanlık oylamasına etki eder. 4 adım.
100. **[v1][P0]** Zincir "Gece Yarısı Fotoğrafı": Maç arifesi parti → %25 olasılıkla fotoğraflanma → kulüp disiplin görüşmesi → PR seçimi → 3 maç sonra "kendini kanıtla" görevi (rating ≥7.5). 5 adım.
101. **[v1][P0]** Zincir "Yabancı Ülkede Yalnız": Yurt dışı transferinden sonra dil engeli ve yalnızlık stresi oluşur → dil kursu, vatandaşlarla arkadaşlık ya da aileyi getirme seçimi → uyum puanı 8 haftada belirlenir.
102. **[v1][P0]** Zincir "Şüpheli Teklif": Bahis çetesinden yaklaşma → reddet/bildir/kabul → bildirirsen polis işbirliği ve dürüstlük ödülü haberi → kabul edersen soruşturma, men ve haber. Kabul seçeneği dışında hiçbir yol kariyeri bitirmez.
103. **[v1][P1]** Zincir "Kıskanç Yıldız": Aynı pozisyondaki yıldız oyuncuyu dışlar → pas vermez (maç içinde ikon görünür) → TD'ye şikâyet, sahada yanıt ya da arabulucu bir kıdemli → çözüm ya da yıldızın satılması.
104. **[v1][P1]** Zincir "Kardeşin Hayali": Kardeş akademi denemesine çağrılır → destek verirsen antrenman sahnesi → kabul ya da ret → kabulde kardeşin kariyeri arka planda simüle edilir ve aynı ligde karşılaşma olayı çıkar.
105. **[v2][P1]** Zincir "Büyük Aşk, Büyük Şehir": Partnerin başka şehirde iş teklifi → kariyer ya da ilişki önceliği seçimi → uzak ilişki, birlikte taşınma talebiyle transfer isteme ya da ayrılık.
106. **[v2][P1]** Zincir "Belgesel Kamerası": Belgesel ekibi bir sezon boyunca takip eder → her ay bir "kamera önünde" kararı → sezon sonunda belgesel yayınlanır ve içeriği alınan kararlarla prosedürel olarak oluşur.
107. **[v2][P1]** Zincir "Vakfın Gölgesi": Vakıf yöneticisinin yolsuzluk iddiası → iç denetim, kovma ya da örtbas → örtbas edilirse 6 ay sonra skandal patlar.
108. **[v1][P1]** Zincir "Akademi Çocuğu": 17 yaşındaki bir genç oyuncuyu idol olarak görür → mentorluk teklifi → genç yükselirse "öğrenci hocayı geçti" manşeti, düşerse destek olayı çıkar.
109. **[v2][P2]** Zincir "Emeklilik Sofrası": 33+ yaşta aile emeklilik konuşması başlatır → partner ve çocuklar görüş bildirir → bir sezon daha oynama ya da veda maçı kararı verilir (2.3'teki emeklilik ile bağlantılı).

#### M. Olay Motoru, Araçlar ve İçerik Hedefleri

110. **[v1][P0]** Veri odaklı olay şeması: `id, kategori, koşullar, ağırlık, bekleme süresi, metin anahtarları, seçenekler[], sonuçlar[], bayraklar, gecikmeli tetikler` alanları kullanılır. Olaylar JSON/TS veri dosyalarında tutulur ve Zod şemasıyla derleme sırasında doğrulanır.
111. **[v1][P0]** İçerik hedefi: v1'de en az 150, v2'de 400+ olay olacak. v1'de her kategoride (takım, aile, aşk, basın, sosyal medya, taraftar, gece hayatı, hayır, iş, dolandırıcılık, sağlık, hukuk, milli takım, rakip, söylenti, ödül) en az 6 olay bulunur.
112. **[v1][P0]** Tekrar önleme: Aynı olay kariyer başına en fazla 2 kez çıkar (tekrarlanabilir olarak işaretlenenler hariç). Kategori bazlı bekleme süresi uygulanır. Test: 10 sezonluk simülasyonda hiçbir olay 3. kez görünmez.
113. **[v1][P0]** Seçenek etkisi ön izlemesi: Her seçeneğin altında yön çipleri görünür (Takım ↑, TD ↓, Risk 🎲). Kesin sayılar gizli kalır, ama zorluk ayarından "tam şeffaflık" modu açılabilir.
114. **[v1][P0]** Gecikmeli sonuçlar kaydı: Gecikmeli tetiklenen her olay, tetikleyen eski kararı metinde hatırlatır ("3 ay önce verdiğin borç..."). Bu, "neden oldu" kayıt defterine bağlanır.
115. **[v1][P1]** Olay editörü (geliştirici aracı): Tarayıcıda çalışan bir olay editörü olur: koşul oluşturucu, seçenek etkisi, önizleme, test kariyerinde tetikleme. Mod desteği için v2'de kullanıcıya açılır.
116. **[v1][P1]** Olay kapsam raporu: CI'da 1000 sezonluk simülasyon çalıştırılır ve hiç tetiklenmeyen olaylar ile aşırı sık tetiklenenler (her sezon %80+) raporlanır.
117. **[v1][P1]** Olay linter'ı: Etki oranı kuralı (madde 7), metin anahtarı varlığı, zamir değişkenleri, en az 2 seçenek ve "çıkış" seçeneğinin varlığı otomatik denetlenir.
118. **[v1][P0]** Zamir ve cinsiyet değişkenleri: Tüm olay metinleri `{oyuncu.zamir}` ve ICU select yapısıyla yazılır. Test: Kadın kariyerinde tüm olaylar taranır ve hiçbir metinde yanlış zamir kalmaz.
119. **[v1][P1]** Olay yoğunluğu ayarı: Ayarlarda "Sakin / Normal / Pembe Dizi" seçenekleri bulunur ve haftalık olay sayısını 0–1 / 1–2 / 2–4 aralığında belirler. Hikâye sevmeyen oyuncu için olay sayısı azaltılabilir.
120. **[v1][P1]** Olay kategorisi filtreleri: Oyuncu romantizm, aile kaybı, gece hayatı ve skandal kategorilerini tek tek kapatabilir. Kapatılan kategori hiçbir göstergeyi cezalandırmaz.
121. **[v1][P1]** Yazım rehberi: Ton, kısa cümle, mizah dozu (NSS'nin tabloid mizahı korunur), stereotiplerden kaçınma, gerçek kişi ya da marka yasağı, uzunluk sınırı (gövde ≤ 280 karakter, seçenek ≤ 60 karakter) belgelenir. Her yeni olay bu rehbere göre incelemeden geçer.
122. **[v2][P2]** Topluluk olay paketleri: Mod kullanıcıları olay paketi yükleyebilir. Paketler aynı linter'dan geçer ve kayıt dosyasında paket kimliği tutulur.
123. **[v1][P1]** Kariyer anı defteri: Önemli olaylar ve kararlar kronolojik bir "Anılar" ekranında toplanır. Emeklilik ekranında bu anılardan kariyer hikâyesi özeti üretilir.


### 2.5 Ekonomi, Lüks Yaşam, Yatırım, İşletme ve Kumarhane

NSS'nin en çok 1–3★ almasının tek başına en büyük nedeni, kendi kazancını yiyen ekonomisiydi. "NRG evden pahalı" oldu, maç başına 1 coin kazanılırken bir içecek 8 coin tuttu. StarPath'te kural basit: daha iyi sözleşme imzalayan oyuncu gerçekten zenginleştiğini hissetmeli. Temel ihtiyaçlar sabit kalır, artan masraflar yalnızca lüks ve statüden gelir. Gerçek para hiçbir zaman güç ya da zaman satın almaz.

#### A. Gelir: Maaş, Bonus, Vergi ve Komisyon
1. **[v1][P0]** Gerçekçi ölçekte maaş: Maaş haftalık ve kurgusal para birimiyle ("Yıldız", simgesi ✦) tutulur, ama ayarlardan yerel biçimde gösterilir (✦12.500 / "≈ ₺/€/$ karşılığı" kapalı varsayılan). Alt ligde haftalık ✦400–1.500, üst ligde ✦40.000–400.000 bandı; NSS'nin "maç başı 1–3 coin" ölçeği terk edilir.
2. **[v1][P0]** Para simgesi her yerde görünür: Fiyat, bakiye ve maliyet gösterilen her ekranda para birimi simgesi ve binlik ayıracı zorunlu (UI lint kuralı: simgesiz sayı içeren fiyat bileşeni build'i kırar). NSS'deki "simgeleri kaldırıp yanıltma" iddiasına doğrudan yanıt.
3. **[v1][P0]** Performans primleri sözleşmede ayrı kalem: Gol, asist, gol yemeden bitirilen maç (savunma/kaleci), Maçın Oyuncusu, oynanan maç ve galibiyet primleri; maç sonu "Kazanç Dökümü" ekranında kalem kalem listelenir.
4. **[v1][P0]** Mevkiye göre adil prim: Kaleci ve stoperler için gol primi yerine "kurtarış ≥5", "gol yemeden bitirilen maç", "başarılı müdahale ≥6" primleri; simülasyonda mevki başına sezonluk prim gelirinin ±%20 içinde kalması test edilir.
5. **[v1][P0]** Sezon sonu takım primleri: Şampiyonluk, kupa, yükselme ve Avrupa'ya katılım için toplu prim; ilk 11 oyuncusu tam, rotasyon oyuncusu %60, yedek %30 pay alır.
6. **[v1][P1]** İmza parası (signing fee): Transferde maaşın 4–26 haftalığı kadar tek seferlik ödeme; ajan seviyesi bu aralığın üst sınırını açar. Ekranda brüt ve net gösterilir.
7. **[v1][P1]** Sadakat bonusu: Aynı kulüpte her tamamlanan sezon için yıllık maaşın %5'i (en fazla %25). Hızlı kulüp değiştirmeye karşı ekonomik bir karşı ağırlık.
8. **[v1][P0]** Basit ve görünür vergi: Ülkeye göre sabit gelir vergisi (%15–45, kurgusal ülke verisinde tanımlı) haftalık bordroda kesilir. Brüt ve net yan yana gösterilir; vergi "sürpriz kesinti" olarak sezon sonunda çıkmaz.
9. **[v2][P2]** Vergi planlaması kararı: Mali danışman tutulursa yatırım gelirinde %10 indirim; "riskli vergi düzeni" seçeneği, %8 ihtimalle denetim olayını ve skandal zincirini tetikler.
10. **[v1][P0]** Ajan komisyonu şeffaf: Ajan maaş artışının ve sponsor gelirinin %5–15'ini alır. Komisyon her bordro satırında ayrı görünür. Ajan sözleşmesi sezon/yıl bazlıdır, maç sayısına bağlı değildir ve bitiş tarihi kartında yazar.
11. **[v1][P0]** Personel süresinin açık olması: Ajan, kişisel antrenör ve fizyoterapist sözleşmelerinde bitiş tarihi, kalan süre çubuğu ve bitişten 4 hafta önce bildirim bulunur. NSS'nin "150 maç sonra habersiz biten antrenör" şikâyeti olmaz.
12. **[v1][P1]** Milli maç ücreti: Milli takım maçı başına sabit ücret ve turnuva primi; kulüp maaşından küçük ama prestij etkisi yüksek (şöhret +).
13. **[v1][P1]** Forma satışı payı: Şöhret ≥60 olduğunda sözleşmeye "forma satış payı %1–5" maddesi eklenebilir. Haftalık satış tahmini kulüp ekranında görünür.
14. **[v2][P1]** Görüntü hakları şirketi: Şöhret ≥75'te açılır; sponsor gelirinin bir kısmı şirket üzerinden %10 vergi avantajıyla akar, ama kulüp pazarlığında "görüntü hakları payı" kalemi doğar.
15. **[v1][P0]** Kazanç-gider dengesi değişmezi: Simülasyon testi: 10.000 seed'lik normal kariyerde ortalama oyuncu hiçbir sezon sonunda temel giderleri (kira, yemek, ulaşım, temel bakım) karşılayamaz duruma düşmez. Sadece lüks harcamalar borç yaratabilir.

#### B. Enerji ve Zaman Modeli (Para ile Enerji Satılmaz)
16. **[v1][P0]** Enerji satın alınamaz: Enerji içeceği, "NRG" benzeri tüketilebilir ya da reklamla enerji yoktur. Enerji yalnızca uyku, dinlenme günü, beslenme planı ve tesislerle döner. Kod kuralı: `energy` alanına para işleminden yazılamaz.
17. **[v1][P0]** Zaman dilimleri asıl kısıt: Günde 3 dilim (Sabah/Öğleden sonra/Akşam), haftada 5–7 aktivite günü. Antrenman, ilişki ve maç aynı enerji havuzuna değil, zaman ve yorgunluk takvimine bağlıdır. NSS'deki "enerji hepsine yetmiyor" sorununu çözer.
18. **[v1][P0]** Uyku ile tam toparlanma: Gece uykusu enerjiyi ev kalitesine göre %70–100 doldurur. Yorgunluk (maç sonrası) ayrı değerdir ve 1–3 günde iner.
19. **[v1][P0]** Sabit maliyet ilkesi: Temel ihtiyaçların (beslenme planı, ulaşım, fizyoterapi seansı) fiyatı oyuncunun maaşından ya da yıldız seviyesinden bağımsızdır. Yalnızca enflasyon ayarı (yılda en fazla %2) uygulanır.
20. **[v1][P1]** Beslenme planı: Haftalık sabit fiyatlı üç kademe (✦150 / ✦600 / ✦2.000). Toparlanmaya %0/+5/+10 etkisi var. Pahalı kademe gelire oranla hep küçük kalır (üst ligde maaşın %2'sinden azı).
21. **[v1][P1]** Ev kalitesi toparlanma etkisi: Kiralık oda +0, daire +%3, ev +%6, villa +%8 uyku toparlanması. Üst sınır +%10, yani pahalı ev "zorunlu" değil.
22. **[v1][P0]** Para ile zaman atlatma yok: "Antrenmanı bitir", "sakatlığı hemen iyileştir" gibi para karşılığı hızlandırma yoktur. Kriyoterapi gibi tesisler sakatlık süresini en fazla %20 kısaltır ve bir kez satın alınır.

#### C. Giderler ve Para Yutucular (Sink) Dengesi
23. **[v1][P0]** Statüye bağlı yaşam gideri: Haftalık yaşam gideri sahip olunan varlıkların bakımından doğar, maaştan doğmaz. Hiçbir şey almayan oyuncu üst ligde gelirinin %90'ından fazlasını biriktirebilir.
24. **[v1][P0]** Harcama eğrisi hedefi: Sim telemetrisiyle doğrulanan hedef: tipik oyuncu kariyerin ilk 3 sezonunda gelirinin %40–60'ını, zirve döneminde %50–70'ini harcar. Emeklilikte net servet medyanı = kariyer brüt gelirinin %20–35'i.
25. **[v1][P1]** Haftalık gider dökümü: Finans ekranında "Bu hafta: gelir ✦X, gider ✦Y, net ✦Z" kartı ve gider kalemleri (bakım, kira, personel, kredi taksiti, vergi) halka grafikte görünür.
26. **[v1][P1]** Para cezaları: Kulüp disiplin cezası (geç kalma, kart, basına sızan gece hayatı) haftalık maaşın %10–100'ü. Ceza nedeni ve tutarı olay kaydında açıkça yazar.
27. **[v1][P1]** Ailenin finansal talepleri: Ebeveyne ev alma, kardeşin okul masrafı gibi olaylar mutluluk ve ilişki kazandıran isteğe bağlı para yutuculardır; reddetmek ilişkiyi düşürür ama ilerlemeyi cezalandırmaz.
28. **[v2][P1]** Enflasyon ve maaş tavanı: Dünya ekonomisi yılda %0–3 enflasyon uygular, maaş bandı da aynı oranda kayar. 20 sezonluk sim'de fiyat/maaş oranının ±%10 içinde kaldığı test edilir.
29. **[v1][P0]** Geç oyun para sorunu: Zirvedeki oyuncu için anlamlı harcama hedefleri (koleksiyon, hayır vakfı, işletme, kulüp hissesi, miras fonu) olsun. Hedef: 10. sezondan sonra "parayla yapacak bir şey kalmadı" hissi oluşmasın (telemetri: bakiye/harcama oranı uyarısı).

#### D. Banka, Kredi ve Kredi Notu
30. **[v1][P1]** Vadesiz ve vadeli hesap: Vadesiz %0, vadeli (13/26/52 hafta) yıllık %2–6 faiz. Vadeden önce bozmak faizi siler, anaparayı silmez.
31. **[v1][P1]** Kredi çekme: Ev ve araç için kredi. Tutar sözleşmede kalan maaşın en fazla %60'ı kadar, faiz kredi notuna göre %4–18. Taksit tablosu imza öncesi tam gösterilir.
32. **[v1][P1]** Kredi notu (300–850): Zamanında ödeme +, gecikme −, iflas −200. Not sözleşme pazarlığına etki etmez, sadece faizi ve kredi limitini belirler.
33. **[v1][P1]** Gecikme ve haciz: 3 gecikmiş taksitte banka uyarı gönderir, 6'da teminat varlığı (ev/araç) %70 değerden satılır. Her adım önceden bildirilir.
34. **[v1][P2]** Otomatik ödeme talimatı: Kredi ve bakım giderleri için otomatik ödeme; bakiye yetersizse işlem öncesi bildirim gelir ve oyuncu satış/erteleme seçebilir.
35. **[v2][P2]** Kredi kartı limiti: Lüks harcamalarda %24 faizli kredi kartı; "borç sarmalı" olay zinciri ve finans danışmanı uyarısı. Varsayılan kapalı, finans ekranından açılır.

#### E. Yatırımlar
36. **[v1][P1]** Endeks fonu: Yıllık beklenen getiri %6, oynaklık %15. Haftalık dalgalanma seed'li RNG alt akışından (`rng.fork('market')`) gelir; kayıt/yükleme ile değiştirilemez.
37. **[v1][P1]** Tahvil fonu: Beklenen %3, oynaklık %4. Emeklilik planı için güvenli seçenek.
38. **[v1][P1]** Gayrimenkul kira geliri: Kiraya verilen mülk değerinin yıllık %3–6'sı kira getirir, %1–2 bakım ve boşluk riski (%10 ihtimalle bir çeyrek kiracısız) taşır.
39. **[v1][P2]** Riskli girişim: Arkadaşın/kuzenin girişimi olay kartı olarak gelir: %60 batar, %30 başa baş, %10 ×3–10 getirir. Olasılık bandı kartta "Yüksek risk" etiketiyle yazar.
40. **[v2][P2]** Volatil dijital varlık: Kurgusal "kripto benzeri" varlık; yıllık oynaklık %80, %5 ihtimalle "çöküş" olayı (−%70). Şöhret ≥50'de dolandırıcı teklif zinciri tetiklenebilir.
41. **[v1][P1]** Portföy ekranı: Toplam servet, varlık dağılımı (nakit, fon, gayrimenkul, işletme, eşya) ve 52 haftalık çizgi grafik.
42. **[v1][P0]** Yatırım yüklemede sabittir: Piyasa hareketi gün geçişinde hesaplanır ve RNG durumu kayıtta tutulur. Aynı kayıttan tekrar yüklemek aynı piyasa sonucunu verir (save-scum ile kazanç yok).
43. **[v2][P1]** Mali danışman personeli: Haftalık ücretli danışman portföyü "temkinli/dengeli/agresif" profile göre otomatik dağıtır; yanlış yönlendirme ihtimali danışman kalitesine göre %2–10.
44. **[v2][P2]** Emeklilik fonu: Maaşın %0–20'si otomatik kesilip emeklilikte yıllık gelir olarak döner; miras moduna aktarılabilir.

#### F. İşletmeler
45. **[v2][P1]** İşletme modeli: Kafe, spor salonu, giyim markası, futbol okulu, restoran. Her biri: kuruluş maliyeti, haftalık sabit gider, talep (şöhret + şehir + kalite), yönetici atama.
46. **[v2][P1]** Kafe: Kuruluş ✦80.000, haftalık gider ✦2.500. Gelir şehir nüfusu ve şöhretle ölçeklenir. İlk yıl zarar etme ihtimali %40, yönetici tutunca %25.
47. **[v2][P1]** Spor salonu: Oyuncuya da antrenman tesisi işlevi görür (antrenman XP +%5) ve üye geliri getirir.
48. **[v2][P1]** Kendi giyim markası: Logo ve renk seçimi, koleksiyon çıkarma kararı (sezonda 2). Satış şöhret ve sosyal medya takipçisiyle ölçeklenir; skandal satışları 4 hafta %50 düşürür.
49. **[v2][P1]** Futbol okulu: Memleket şehrinde kurulur, kâr değil itibar ve hayır puanı getirir. Okulun yetiştirdiği NPC genç yıllar sonra profesyonel ligde çıkabilir (miras bağlantısı).
50. **[v2][P2]** İşletme olay kartları: Yangın, kötü yorum, ortağın dolandırıcılığı, franchise teklifi gibi 15+ olay; her biri kısa ve uzun vadeli sonuçla.
51. **[v2][P1]** İşletme zaman maliyeti: Yönetici yoksa işletme ayda 1 akşam dilimi ister. Yönetici maaşı kârın %15–25'i.
52. **[v2][P2]** İşletme satışı: Son 52 haftalık kârın 3–6 katı fiyatla satılabilir. Zararda olan işletme defter değerinin %40'ına satılır.
53. **[v1][P0]** İşletme futbolu ezmesin: Sim değişmezi: işletmelerin toplam yıllık geliri aynı dönem futbol gelirinin (maaş + prim + sponsor) %50'sini aşamaz. Aşmaya başlarsa doygunluk eğrisi devreye girer.

#### G. Sponsorluk Sözleşmeleri
54. **[v1][P0]** Kurgusal sponsor kategorileri: Krampon, spor içeceği, saat, giyim, oyun/teknoloji, otomobil, kozmetik, yiyecek, takı, bahis-dışı finans. Gerçek marka adı yok, sponsor logoları prosedürel üretilir.
55. **[v1][P0]** Sözleşme şartları açık: Süre (sezon), yıllık ücret, performans bonusu (gol/kupa), şöhret eşiği, davranış maddesi, münhasırlık (aynı kategoride ikinci sponsor yok). Hepsi imza ekranında tek tabloda.
56. **[v1][P1]** Davranış maddesi: Skandal seviyesine göre uyarı → %50 kesinti → fesih. Feshin nedeni sponsor mesajı olarak gelir ve olay kaydına düşer.
57. **[v1][P1]** Reklam çekimi aktivitesi: 1 zaman dilimi ister, sabit ücret öder ve sponsor ilişkisini +5 artırır. Sezonda sponsor başına en fazla 3 çekim.
58. **[v1][P1]** Sponsor seçimi peşin mi bonus mu: Teklifte "peşin ✦X" ya da "daha düşük taban + gol başına bonus" seçeneği. Sim'de iki seçeneğin beklenen değeri ±%15 içinde dengelenir.
59. **[v1][P1]** Sponsor sayısı tavanı: Aynı anda en fazla 6 aktif sponsor. Fazlası sosyal medyada "reklam panosu" algısı yaratır (taraftar ilişkisi −).
60. **[v1][P0]** Sponsor çekmek için lüks şart değil: NSS'de "sponsor gelmiyorsa lifestyle eşyan yoktur" kuralı vardı. Bizde sponsor ilgisi %70 performans + şöhret, %30 imaj (sosyal medya, davranış) ile hesaplanır. Lüks eşya en fazla imajın %20'si.
61. **[v2][P2]** Sponsor çatışması: Kulübün resmi sponsoru ile kişisel sponsorun çakışması olay kartı: birini seçmek, kulüp yönetimi ya da sponsor ilişkisini etkiler.
62. **[v1][P0]** Bahis sponsoru yok: Bahis şirketi sponsorluğu oyunda bulunmaz. Yaş derecelendirmesi ve sorumluluk gerekçesi tasarım belgesinde yazılıdır.

#### H. Lüks Eşyalar, Varlıklar ve Etkileri
63. **[v1][P0]** Etki odaklı katalog: Her eşyanın fiyatı, haftalık bakım gideri, mutluluk etkisi, şöhret/imaj etkisi ve **somut oynanış etkisi** kartında yazar. NSS'deki 60 eşyanın çoğu yalnızca puan veriyordu; bizde en az %50'sinin özel etkisi olur.
64. **[v1][P0]** Kategoriler ve hedef sayı: v1'de Ev (12), Araç (15), Saat (8), Moda (10), Teknoloji (8), Evcil hayvan (6), Deniz (4), Hava (3), Sanat (10), Diğer (10) = 86 eşya. v2'de 150+.
65. **[v1][P1]** Özel jet: Deplasman yolculuğu yorgunluğunu −%30, milli takım seyahatini −%20 azaltır. Bakım gideri yüksek (değerin haftalık %0,4'ü). Kısa mesafeli ligde getirisi düşük, bu kartta yazar.
66. **[v1][P1]** Şehir içi ulaşım araçları: Bisiklet ve scooter antrenmana gidiş dilimini serbest bırakmaz ama mutluluk +; şoförlü araç her gün 1 küçük enerji kazancı (+%3) verir.
67. **[v1][P1]** Spor otomobil: Şöhret +, mutluluk +. Ama "hız cezası" olay ihtimali haftalık %1; disiplin puanı düşükse %3.
68. **[v1][P1]** Ev spor salonu: Evde antrenman yapılabilir (dilim kazancı yok ama antrenman XP +%5). Bir kez alınır, bakım düşüktür.
69. **[v1][P1]** Ev sineması ve oyun odası: Stres −, dinlenme gününde mutluluk toparlanması +%10. Gece hayatı olaylarının yerine "evde kalma" seçeneğini güçlendirir.
70. **[v1][P1]** Havuz ve kriyoterapi odası: Sakatlık iyileşme süresi −%10 / −%20 (ayrı ayrı, toplam üst sınır −%25).
71. **[v1][P0]** Bakım kuralları anlamlı: Yalnızca kullanılan ve mekanik eşyalar (araç, tekne, uçak, ev) bakım ister ve yıpranır. Sanat, saat, takı, dövme yıpranmaz. NSS'nin "heykel neden bozuluyor?" şikâyeti giderilir.
72. **[v1][P1]** Bakım ihmali sonucu: Bakımı ödenmeyen araç önce etkisini (%50), 8 hafta sonra kullanılabilirliğini kaybeder. Eşya kaybolmaz, onarım fiyatı yeniden alımın en fazla %25'idir.
73. **[v1][P1]** İkinci el satış ve değer kaybı: Araçlar yılda %15, teknoloji %40, tekne %10 değer kaybeder. Satış fiyatı her an kartta görünür.
74. **[v1][P1]** Değer kazanan sanat: Sanat eserleri yıllık −%5 ile +%15 arasında dalgalanır. Nadir eserler (kurgusal sanatçı ve serisiyle) müzayedede satılabilir.
75. **[v2][P2]** Müzayede mini oyunu: Ayda bir müzayede; 2–4 NPC teklif verir. Artırma süresi kısıtlı, NPC bütçeleri gizli ama ipucu verilir.
76. **[v1][P1]** Koleksiyon setleri: Aynı serinin 3–5 parçası (ör. "Retro Kramponlar", "Klasik Saatler") tamamlanınca rozet ve şöhret +2. Set ilerlemesi koleksiyon rafında görünür.
77. **[v1][P1]** Kupa dolabı ve koleksiyon rafı: Sahip olunan eşyalar izometrik ikonlarla rafta durur. Ev büyüdükçe raf kapasitesi artar.
78. **[v1][P1]** Evcil hayvan: Köpek, kedi, at dahil 6 tür. Stresi düşürür (−%5/hafta), günlük 0 dilim maliyeti ama deplasmanda bakıcı ücreti. İhmal edilirse hayvan barınağına gider olayı (mutluluk −), ölüm yok.
79. **[v1][P1]** Ev seçiminin konumu: Kulüp şehrinde ev, transfer olunca satılabilir ya da kiraya verilebilir. Eski şehirdeki boş ev haftalık bakım gideri yazar, kartta uyarı çıkar.
80. **[v1][P0]** Erken harcama tuzağı uyarısı: NSS'de fiyatların sabit olması "erken harcama" stratejisini öne çıkarıyordu. Bizde fiyat/maaş oranı satın alma ekranında "Bu eşya ✦X = Y haftalık maaşın" şeklinde gösterilir.
81. **[v2][P2]** Tasarım dekorasyonu: Evi odalara göre döşeme; yalnızca kozmetik, mutluluk etkisi küçük (+%2 sınırı).
82. **[v3][P2]** Özel ada ve kale: Geç oyun prestij varlıkları; misafir ağırlama olayları, düğün ve jübile partisi mekânı olarak kullanılır.

#### I. At Sahipliği (Sınırlı ve Dengeli)
83. **[v1][P1]** At sahipliği tavanı: Ahır kapasitesi 1/3/6 at (ahır seviyesine göre); en fazla 6. NSS'deki 40+ at ve "at yarışı oyunu" algısı oluşmaz.
84. **[v1][P0]** At geliri tavanı: Sim değişmezi: at yarışlarının sezonluk net kazancı, oyuncunun sezonluk futbol gelirinin %20'sini aşamaz. Aşma eğiliminde yarış ödülleri lig seviyesine göre ölçeklenir.
85. **[v1][P1]** Atın gerçek giderleri: Her atın haftalık bakım, antrenör ve veteriner masrafı vardır. NSS'deki "masrafsız at" yoktur. Ortalama bir at sezonda yalnızca başa baş getirir.
86. **[v1][P1]** Toplu yarış komutu: "Tüm atları yarıştır" tek tuşla sezon yarış programına katar, sonuç özetini tek kartta gösterir. Oyuncuların açık isteği.
87. **[v1][P2]** At gelişimi ve emeklilik: Atlar 2–8 yaş arası yarışır, sonra damızlık ya da emekliliğe ayrılır. Damızlık gelir sınırlı (yılda ✦ tavanlı).
88. **[v1][P1]** At yarışı bahsi ayrı: Kendi atına bahis yapılabilir, ama yarış sonucu atın gücü + seed'li şans ile belirlenir. Oranlar gerçek olasılıktan %15 marjla hesaplanır (beklenen değer <1).

#### J. Kumarhane (Gerçek Para Asla Yok)
89. **[v1][P0]** Gerçek para ile kumar yok: Fiş/jeton satın alınamaz, kumarhanede kazanılan şey gerçek paraya ya da IAP'ye dönüştürülemez. Kumarhane yalnızca oyun içi kariyer parasıyla oynanır. Bu kural kodda (IAP SKU listesinde kumarhane ilişkili ürün yok) ve mağaza beyanlarında belgelenir.
90. **[v1][P0]** Kumarhaneyi tamamen kapatma ayarı: Ayarlar > İçerik > "Kumarhane ve bahis içeriği: Açık/Kapalı". Kapalıyken haritada kumarhane, at yarışı bahsi ve ilgili olaylar görünmez; kariyer dengesi etkilenmez.
91. **[v1][P0]** Yaş kapısı: Karakter 18 yaşından küçükse kumarhaneye giremez. Kapıda nazik ret metni gösterilir. NSS'deki "içeri girip yakalanıp ağır ceza" tuzağı yoktur, ama takım arkadaşının daveti olayı yine de reddedilecek bir karar olarak gelir.
92. **[v1][P0]** Doğru kasa avantajı: Tüm oyunlarda beklenen değer <1 olmalı. Slot geri ödeme oranı (RTP) %92–96. NSS'deki pozitif beklenen değerli slot hatası CI'da 10 milyon spin simülasyonuyla test edilir (RTP ≥1 ise build kırılır).
93. **[v1][P1]** Blackjack kuralları: 6 deste, krupiye soft 17'de durur, blackjack 3:2 öder, double ve split vardır, sigorta yoktur, 5-kart Charlie yoktur. Kurallar masada "Kurallar" butonunda doğru yazılır (NSS'deki yanlış "16" yardım metni olmaz). Optimal oyunda kasa avantajı ≈%0,5.
94. **[v1][P1]** Rulet: Avrupa ruleti (tek sıfır), kasa avantajı %2,7. Kırmızı/siyah, tek/çift, düzine, sütun ve tek sayı bahisleri doğru oranlarla. NSS'deki "yeşil 17:1" gibi hatalı oranlar olmaz.
95. **[v1][P1]** Slot makinesi: 3 makara, 5 hat, kurgusal simgeler. Kazanç tablosu ekranda, RTP bilgisi "Bilgi" panelinde yazılı.
96. **[v1][P1]** At yarışı (izleyici bahsi): 6–8 at, oranlar form ve güce göre. Sadece birinciye değil, "ilk üç" bahsi de var. Marj %15.
97. **[v2][P2]** Poker (NPC'lere karşı): Texas Hold'em, takım arkadaşları ve ünlü NPC'lerle özel masa. İlişki etkisi var (kazandığın kişiyle ilişki −2).
98. **[v1][P1]** Bahis limitleri: Masa başına minimum ve maksimum bahis; maksimum, bakiyenin %10'u ya da masa limitinden küçük olanıdır. "Tüm parayı tek elde kaybetme" önlenir.
99. **[v1][P0]** Bağımlılık göstergesi (oyun içi kurgu): Haftalık kumar dilimi ve kayıp tutarı izlenir. 0–100 "Kumar Eğilimi" değeri yükseldikçe stres +, disiplin −, gazeteye sızma ihtimali artar (eğilim ≥60'ta haftalık %15).
100. **[v1][P1]** Kayıp kovalama uyarısı: Aynı gün iki kez üst üste kaybedip tekrar oturunca ajan/aile mesajı gelir. "Bırak" seçeneği eğilimi −5 azaltır.
101. **[v1][P1]** Kendini sınırlama: Kariyer içinde "kumarhaneye 4/12 hafta girmeyeceğim" kararı alınabilir; bu, eğilimi düşürür ve aile ilişkisini artırır.
102. **[v1][P0]** Kendi maçına bahis = ağır skandal: Kendi maçına (veya ligine) bahis teklifi olay olarak gelir. Kabul edersen %35 ihtimalle ortaya çıkar: 6–24 ay men, sponsor feshi, şöhret −40. Kabul etmezsen ilişki/şöhret dengesi korunur. Seçeneğin kartında "ağır yasal risk" etiketi var.
103. **[v1][P0]** Rüşvet olayı adil: Maç satma teklifi geldiğinde reddetmek her zaman güvenlidir ve küçük disiplin/şöhret ödülü verir. Kabul etmenin sonuçları açıkça uyarılır. NSS'deki "reddetsen de kariyerin mahvoldu" hissi verilmez; tuzak senaryosu yalnızca kabul edilirse işler.
104. **[v1][P1]** Takım arkadaşıyla kumarhane: Davet kabul edilirse takım ilişkisi +, ama teknik direktör öğrenme ihtimali %20 (disiplin −). Sonuç ve olasılık bandı kartta önceden gösterilir.
105. **[v1][P0]** Mağaza derecelendirmesi notu: Kumarhane içeriği "Simulated Gambling" beyanını gerektirir. Gerçek para, satın alınabilir fiş ve kumarhane ile bağlantılı IAP olmadığı tasarım kuralı olarak sabittir (ayrıntı: 2.12).

#### K. Hayır İşleri, Borç ve İflas
106. **[v1][P1]** Hayır kurumu bağışları: Kurgusal 6 vakıf (çocuk sağlığı, eğitim, hayvan barınağı vb.). Bağış şöhrete (+), mutluluğa (+) etki eder ve vergiden düşülür. Sezonda azalan getiri (ilk bağış tam etki, sonrakiler %50).
107. **[v2][P1]** Kendi vakfını kurma: Şöhret ≥70; yıllık gider ve gala gecesi olayları. Vakıf, emeklilik sonrası ve miras modunda süren bir itibar kaynağıdır.
108. **[v1][P1]** Memlekete katkı: Doğduğun şehirdeki amatör kulübe saha veya forma bağışı; taraftar ve aile ilişkisi +, yerel medya manşeti.
109. **[v1][P0]** Borç sarmalı uyarıları: Bakiye 4 hafta üst üste negatife giderse finans danışmanı uyarısı, 8 haftada "Varlık sat" önerileri listesi (en az kayıpla sıralı) gelir.
110. **[v1][P1]** İflas senaryosu: Borç toplam varlığın 1,5 katını geçerse iflas kararı: lüks varlıklar satılır, kredi notu −200, şöhret −15, kariyer devam eder. İflas kariyeri bitirmez, ama sponsorların %50'si davranış maddesini işletir.
111. **[v1][P2]** Dolandırıcılık olayları: Sahte yatırım, sahte menajer, sahte hayır kurumu. Her olayda dikkatli oyuncunun fark edebileceği 1–2 ipucu bulunur (ör. "garantili %40 getiri"). Ajan kalitesi ipucunu belirgin yapar.

#### L. Monetizasyon Kuralları ve Fiyat Şeffaflığı
112. **[v1][P0]** İş modeli: Steam'de premium ($9.99–14.99, demo ile). Mobilde ücretsiz deneme (ilk sezon) + tek seferlik "Tam Kariyer" kilidi ($4.99–6.99). Deneme kaydı tam sürüme olduğu gibi aktarılır.
113. **[v1][P0]** Yalnızca kozmetik IAP: Krampon/forma görünümü, saç stilleri, kutlama animasyonları, stadyum ve ev temaları. Sim katmanı kozmetik ID'leri kabul etmez (TS tip sınırı + ESLint import kısıtı + test: kozmetik takılıyken ve takılı değilken 1.000 maçlık sim çıktısı hash'i aynı).
114. **[v1][P0]** Tüm IAP'ler non-consumable: Her ürün bir kez alınır, tüm cihazlarda ve yeniden kurulumda "Satın Alımları Geri Yükle" ile döner. Tüketilebilir ürün, premium para birimi, enerji, lootbox, gacha ve abonelik yoktur.
115. **[v1][P0]** Oyun içi para satılmaz: Kariyer parası (✦) hiçbir koşulda gerçek parayla alınamaz. Oyun içi parayla açılan hiçbir içerik sonradan gerçek paraya taşınmaz (NSS'nin 2026'daki şikâyeti); bu bir sürüm politikasıdır ve sürüm notlarında taahhüt olarak yer alır.
116. **[v1][P0]** Reklam varsayılan olarak yok: Tam sürümde reklam yoktur. Deneme sürümünde reklam eklenecekse yalnızca isteğe bağlı, ödüllü ve kozmetik ödüllü olur; maç, antrenman ya da mini oyun sırasında asla gösterilmez. Zorunlu 15–80 saniyelik interstitial yoktur.
117. **[v1][P0]** Eski alımlar korunur: İş modeli değişse bile daha önce satın alınan her şey tanınır. Mağaza makbuzu ile hak doğrulaması yapılır, oyuncu destek talebinde 48 saat içinde manuel çözüm SLA'sı vardır.
118. **[v1][P0]** Teşvikli yorum yok: Mağazada yorum yazma karşılığı ödül verilmez (NSS'deki "10 bux karşılığı yorum" uygulaması). Yorum istemi yalnızca sistem API'si ile, olumlu bir andan sonra ve en fazla yılda 3 kez gösterilir.
119. **[v1][P0]** Satın alma güvencesi: Satın alma işlemi makbuz doğrulanmadan "tamamlandı" sayılmaz; doğrulanıp hak verilmeyen işlemler bir sonraki açılışta otomatik yeniden denenir ve kullanıcıya durum gösterilir. "Ödedim, gelmedi" sorunu için Ayarlar > Satın Alımlar sayfası işlem geçmişini listeler.
120. **[v1][P0]** Fiyat şeffaflığı: Mağaza sayfasında her kozmetik paketin içeriği önizleme ile tam listelenir; yerel para biriminde fiyat, "istatistik etkisi yok" etiketi ve geri yükleme bilgisi her üründe görünür.
121. **[v1][P1]** Bölgesel fiyatlandırma: Steam, Play ve App Store fiyat katmanlarına göre bölgesel fiyat. Türkiye dahil düşük gelirli pazarlarda ana kilit için öneri katmanı uygulanır.
122. **[v1][P0]** Karanlık örüntü yasağı: Geri sayımlı teklif, "son şans" pop-up'ı, buton yeri değiştiren onay pencereleri ve sahte indirimler yasaktır. Tasarım incelemesinde kontrol listesi maddesidir.
123. **[v2][P1]** Genişleme paketleri: Ücretli içerik yalnızca yeni mod ve içerik (menajerlik modu, yeni kıta ligleri, kaleci kariyeri genişlemesi gibi) olabilir. Var olan kariyerin dengesini değiştirmez.
124. **[v2][P2]** Destekçi paketi: Steam'de soundtrack ve dijital sanat kitabı; oyun içinde yalnızca jenerikte isim ve kozmetik rozet.

#### M. Ekonomi Telemetrisi ve Simülasyonla Dengeleme
125. **[v1][P0]** Ekonomi sim harness'i: CI'da 1.000 seed × 20 sezonluk "bot kariyerleri" (tutumlu, dengeli, savurgan, kumarbaz profilleri) çalışır. Servet, borç, iflas oranı ve gelir kaynağı dağılımı rapor edilir.
126. **[v1][P0]** Dengeleme değişmezleri: Tutumlu profil 10. sezonda servet ≥ kariyer gelirinin %50'si. Savurgan profilde iflas oranı ≤%15. Kumarbaz profilin net kumar sonucu 10 sezonda negatif (≥%95 seed'de). Hiçbir yan sistem (at, işletme, yatırım) futbol gelirini geçmez.
127. **[v1][P1]** Opt-in ekonomi telemetrisi: Anonim olaylar: sezon başı/sonu bakiye, en çok alınan 10 eşya, kumarhane kullanım oranı, iflas olayları. Kişisel veri yok, kullanıcı onayı olmadan gönderilmez.
128. **[v1][P1]** Uzak denge yaması yerine veri paketi: Fiyat ve oranlar `economy.json` veri paketinde durur, güncelleme ile değişebilir. Ancak değişiklik yalnızca yeni sezon başında uygulanır ve sürüm notlarında listelenir; kayıtlı kariyerde eşya değerine geriye dönük dokunulmaz.
129. **[v1][P1]** "Neden param azaldı?" açıklaması: Finans ekranında son 4 haftanın en büyük 3 gider kalemi ve değişim nedeni metin olarak özetlenir ("Yat bakımı ✦12.000, maaşının %18'i").


### 2.6 Dünya, Ligler, Kupalar, NPC Oyuncular, Rakipler, Veri ve Mod Desteği

NSS'nin dünyası geniştir ama kırıktır: Norwich ile Man U aynı güçte oynar, kadrolar yıllarca eskir, Avrupa kupası fikstürleri sezonu erken bitirir ve takım arkadaşlarının adı bile yoktur. StarPath'te dünya tamamen kurgusaldır, kendi başına döner, her kuralı test edilmiştir ve oyuncu tarafından düzenlenebilir.

#### A. Dünya Üretimi ve Coğrafya

1. **[v1][P0]** Seed'li dünya üretimi: Yeni kariyerde tek bir 64 bit dünya seed'i ülkeleri, şehirleri, kulüpleri, oyuncuları, armaları ve formaları üretir; aynı seed + aynı sürüm her cihazda bayt bayt aynı dünyayı verir (CI'da hash testi).
2. **[v1][P0]** v1 ülke kapsamı: En az 8 oynanabilir kurgusal ülke (ör. Anadolu benzeri, İber benzeri, Britanya benzeri, Germen, Latin, Frankofon, Kuzey, Güney Amerika benzeri); her ülkede 2–4 lig kademesi, kademe başına 16–20 takım, toplam ≥ 450 kulüp.
3. **[v2][P1]** Genişletilmiş dünya: v2'de 24 oynanabilir ülke ve 60+ lig; kalan ülkeler "milli takım + tek kademe simüle lig" olarak arka planda döner, böylece NSS'nin 100+ ülke ölçeğine bellek patlamadan yaklaşılır.
4. **[v3][P2]** 6 kıta tam piramit: v3'te 40+ oynanabilir ülke, 100+ lig; kıta başına kendi kupa ve federasyon yapısı.
5. **[v1][P0]** Kültüre göre isim üretici: Her ülke için ad/soyad havuzu, ek kuralları ve kısaltma şablonu (ör. İber ülkesinde iki soyadı, Kuzey'de "-sen/-son" ekleri); aynı kulüpte aynı ad-soyad çifti üretilmez.
6. **[v1][P1]** Göçmen ve çift kökenli isimler: Oyuncuların %8–15'i komşu ülkenin isim havuzundan gelir; çift vatandaşlık bayrağı milli takım seçimini etkiler.
7. **[v1][P0]** Şehir üretici: Ülke başına 12–30 kurgusal şehir, nüfus kademesi (köy, kasaba, şehir, metropol) ve harita konumu; kulübün taraftar tabanı ve stadyum kapasitesi şehrin nüfusuyla sınırlanır.
8. **[v1][P1]** Derbi üretimi: Aynı şehirdeki veya 80 km içindeki kulüpler arasında otomatik rekabet puanı (0–100); ≥ 70 olan eşleşmeler "derbi" etiketi, ekstra kalabalık sesi ve medya ilgisi alır.
9. **[v1][P0]** Kulüp adı üretici: Şehir adı + kültürel ek ("Spor", "Atletik", "Birlik", "FK", "Real" benzeri kurgusal karşılıklar) + kuruluş yılı; NSS'nin 6 karakterlik "MAN C" kısaltmaları yerine tam ad, kısa ad (≤ 12 karakter) ve 3 harfli kod ayrı alanlarda tutulur.
10. **[v1][P0]** Gerçek isim kara listesi: Üretilen kulüp, oyuncu ve lig adları gerçek kulüp/oyuncu/turnuva adları içeren bir kara listeye karşı CI'da taranır; eşleşme varsa yeniden üretilir.
11. **[v1][P0]** Arma ve forma benzerlik kontrolü: Prosedürel arma (figür + renk + bölme) ve forma (desen + renk) kombinasyonları, ünlü gerçek kulüp kombinasyonlarını tarif eden kural listesine (ör. "sarı-lacivert dikey çizgi + kuş figürü") karşı kontrol edilir; eşleşen kombinasyon reddedilir.
12. **[v1][P1]** Bölgesel renk eğilimleri: Ülke/şehir bazında renk havuzları (ör. liman şehirlerinde mavi-beyaz eğilimi) üretimi doğal gösterir ama aynı ligde iki takımın ΔE < 15 olan birincil renkleri olamaz.
13. **[v2][P2]** Tarihçe üretici: Dünya oluşturulurken geriye dönük 30 sezonluk sentetik tarih simüle edilir; her kulübün şampiyonluk sayısı, efsane oyuncuları ve rekorları sıfırdan değil, "yaşanmış" gibi başlar.
14. **[v1][P1]** Dünya önizleme ekranı: Kariyer başında seed ile üretilen dünyanın özeti (ülke listesi, en güçlü 5 kulüp, lig kademeleri) gösterilir; "Yeniden üret" ve seed'i elle girme seçeneği vardır.
15. **[v1][P2]** Paylaşılabilir seed kodu: 10 karakterlik seed kodu arkadaşa verilir, aynı dünyada başka kariyer başlatılır (haftalık meydan okumalarla uyumlu).

#### B. Kulüp Modeli

16. **[v1][P0]** Kulüp itibarı (0–10.000): Her kulübün sayısal itibarı vardır; maç motorunda takım gücünün, transfer çekiciliğinin, maaş tavanının ve medya ilgisinin temel girdisidir. NSS'deki "Norwich = Man U" sorunu buradan çözülür.
17. **[v1][P0]** Takım gücü farkı testi: Simülasyon testi, aynı ligde itibar farkı ≥ 3.000 olan iki takımın 1.000 maçlık karşılaşmasında güçlü tarafın en az %62 kazanmasını, zayıf tarafın en az %12 kazanmasını doğrular (sürpriz mümkün ama nadir).
18. **[v1][P0]** Lig kademesi farkı testi: Bir alt lig takımının üst lig orta sıra takımını kupada yenme oranı 1.000 simülasyonda %18–28 aralığında kalmalı; NSS'deki "alt lig takımıyla üst ligi kolayca yenmek" sorunu ölçülebilir hâle gelir.
19. **[v1][P0]** Kulüp bütçesi: Yıllık gelir (bilet, yayın payı, sponsor, transfer satışı, ödül parası) ve gider (maaş, tesis, transfer); maaş bütçesi gelirin %55–70'i ile sınırlıdır ve sözleşme tekliflerinin üst sınırını belirler.
20. **[v1][P1]** Mali kriz olayı: Bütçe açığı iki sezon üst üste gelirin %20'sini aşarsa kulüp maaş kesintisi, transfer yasağı veya zorunlu yıldız satışı olaylarından birini tetikler; oyuncuya haber ve karar kartı olarak düşer.
21. **[v1][P1]** Taktik kimlik: Her kulübün bir oyun felsefesi vardır (kontra, topa sahip olma, yüksek pres, uzun top, kanat oyunu); maç simülasyonu ve oyuncuya düşen An tipleri (ör. kanat oyunu = daha çok orta anı) bundan etkilenir.
22. **[v1][P1]** Taktik kimlik uyumu: Oyuncunun özellik profili kulüp felsefesine ne kadar uyuyorsa transfer ekranında "Sistem uyumu %0–100" gösterilir ve teknik direktör güveni ona göre başlar.
23. **[v1][P1]** Tesis seviyeleri: Antrenman tesisi, sağlık merkezi ve akademi 1–5 arası seviyelidir; tesis seviyesi oyuncunun antrenman XP'sine (+%0–20) ve sakatlık süresine (−%0–25) yansır, kulüp seçerken görünür.
24. **[v1][P1]** Stadyum modeli: Kapasite (2.000–90.000), çatı tipi, zemin kalitesi ve doluluk oranı; kalabalık sesi, ev sahibi avantajı (+%0–6) ve bilet geliri buna bağlanır.
25. **[v2][P2]** Stadyum genişletme: Başarılı kulüpler 3–5 sezonda kapasite artırır; inşaat sezonunda geçici kapasite düşer ve haber üretir.
26. **[v1][P1]** Taraftar tabanı: Kulübün taraftar sayısı ve sadakati (0–100) vardır; sadakat yüksekse kötü seride bile ıslık eşiği geç dolar, düşükse 3 yenilgide yuhalama başlar.
27. **[v1][P2]** Taraftar grubu kimliği: Büyük kulüplerde kurgusal adlı organize taraftar grubu üretilir; oyuncunun gol sevinci ve röportajları bu grupla ilişkiyi değiştirir.
28. **[v1][P1]** Kulüp başkanı ve yönetim: Her kulübün bir başkanı (kişilik: sabırsız, sabırlı, popülist, tutumlu) ve sezon hedefi vardır (şampiyonluk, ilk 4, ligde kalma); hedef kaçarsa teknik direktör değişikliği olasılığı artar.
29. **[v1][P1]** Kulüp hafızası: Oyuncu bir kulüpten ayrılıp yıllar sonra dönerse kulüp kaldığı yerden devam eder (kadro, itibar, rekorlar, oyuncuyla ilgili anılar); NSS'deki "dönünce her şey sıfırlanıyor" şikâyeti kapanır.
30. **[v2][P2]** Kulüp el değiştirmesi: Düşük ihtimalle (sezonda %1–2) zengin bir yatırımcı kulübü satın alır; bütçe 3 katına çıkar, transfer söylentileri artar.
31. **[v1][P2]** Kulüp sayfası: Kulüp profili; kuruluş yılı, stadyum, kupa dolabı, efsaneler, son 10 sezonun lig sıralaması grafiği, mevcut kadro ve teknik ekip.

#### C. Kadro, Takım Arkadaşları ve Teknik Direktörler

32. **[v1][P0]** İsimli takım arkadaşları: Her takım arkadaşının adı, forma numarası, pozisyonu, yaşı, OVR'si, kişiliği ve facesjs yüzü vardır; NSS'deki "takım arkadaşlarımın ismi yok, kadro ekranı yok" şikâyeti doğrudan kapanır.
33. **[v1][P0]** Kadro ekranı: Kendi kulübünün tam kadrosu; ilk 11, yedekler, sakatlar, cezalılar, sözleşme bitişleri, oyuncuyla ilişki göstergesi (pas sıklığına etkisiyle birlikte).
34. **[v1][P0]** Rakip kadro önizlemesi: Maç öncesi ekranda rakibin muhtemel ilk 11'i, formdaki oyuncusu ve kalecisinin refleks puanı görülür.
35. **[v1][P1]** Kadro dengesi kuralı: NPC kulüpler her pozisyonda en az 2 oyuncu, toplamda 22–30 kişilik kadro tutar; sezon ortasında 18'in altına düşen kadro serbest oyuncu imzalamak zorundadır (simülasyon değişmezi testi).
36. **[v1][P0]** NPC kişilik özellikleri: Her NPC'nin 2–4 trait'i vardır: Sadık, Hırslı, Tembel, Lider, Kavgacı, Kırılgan, Demir Adam, Duran Top Ustası, Bencil, Takım Oyuncusu. Trait'ler pas tercihine, kart ihtimaline ve soyunma odası olaylarına yansır.
37. **[v1][P1]** Bencil takım arkadaşı: "Bencil" trait'li forvet, oyuncunun koşusu daha iyi olsa bile %35 daha sık şut tercih eder; maç içinde "Kaan pas vermedi" balonuyla görünür.
38. **[v1][P1]** Takım arkadaşı ilişki ağı: NPC'ler kendi aralarında da ilişki puanı tutar; klikler (yerliler, yabancılar, gençler) oluşur ve oyuncunun hangi kliğe yakın olduğu görünür.
39. **[v1][P0]** Teknik direktör NPC'leri: Her TD'nin adı, yaşı, taktik tercihi (formasyon, oyun stili), gençlere güven puanı ve sabır puanı vardır; oyuncunun forma şansı bu değerlere bağlıdır.
40. **[v1][P0]** TD kovulma ve atama: Sezon içinde kötü giden kulüpte TD kovulma olasılığı hedef farkına göre hesaplanır; yeni TD gelince oyuncunun TD güveni 50'ye yakınsar ("yeni sayfa") ve haber olur.
41. **[v1][P1]** TD kariyer döngüsü: Kovulan TD'ler 0–3 ay işsiz kalıp başka kulübe geçer; oyuncu eski TD'siyle başka kulüpte karşılaşırsa eski ilişki puanı taşınır.
42. **[v2][P1]** TD'nin oyuncuyu istemesi: Oyuncuyla ilişkisi ≥ 70 olan TD yeni kulübüne geçerse o kulüpten transfer ilgisi gelme olasılığı +%40 olur.
43. **[v1][P1]** Kaptanlık hiyerarşisi: Her kulübün kaptanı ve 2 yardımcı kaptanı vardır; kaptan ayrılınca bayrak en yüksek "Lider" puanlı ve kıdemli oyuncuya geçer, oyuncu da aday olabilir.
44. **[v1][P2]** Asistan antrenör ve scout NPC'leri: Kulübün yardımcı antrenörü ve baş scout'u adlı karakterlerdir; ileride oyuncunun menajerlik modunda işe alınabilecek NPC havuzunu oluşturur.

#### D. NPC Oyuncu Yaşam Döngüsü

45. **[v1][P0]** NPC gelişim eğrisi: NPC'ler oyuncuyla aynı yaş eğrisini kullanır (17–23 hızlı gelişim, 24–29 zirve, 30+ fiziksel düşüş); gizli potansiyelleri vardır ve her sezon sonu güncellenir.
46. **[v1][P0]** NPC transferleri: Yaz ve kış pencerelerinde NPC'ler arasında gerçek transferler olur; kulüp ihtiyaç (pozisyon açığı), bütçe ve itibar farkına göre teklif verir. Sezon başına lig başına 30–80 transfer hedefi simülasyonla test edilir.
47. **[v1][P0]** NPC emekliliği: 33–40 yaş arasında olasılıksal emeklilik; emekli olan efsane NPC'ler "efsane" listesine girer, bazıları TD olarak geri döner.
48. **[v1][P0]** Gençlik üretimi: Her sezon sonu her kulüp akademisinden 2–5 genç (15–17 yaş) üretilir; akademi seviyesi potansiyel dağılımını belirler. Dünya nüfusu 50 sezonluk testte ±%5 bandında sabit kalmalı.
49. **[v1][P1]** Wonderkid'ler: Her sezon dünya genelinde 10–20 yüksek potansiyelli genç üretilir; haber akışında "geleceğin yıldızları" listesiyle duyurulur ve oyuncunun rakibi olabilir.
50. **[v1][P1]** NPC sakatlıkları: NPC'ler de sakatlanır (süre 1 gün–9 ay); uzun sakatlık takımın ilk 11'ini değiştirir ve oyuncuya forma fırsatı açabilir.
51. **[v1][P1]** NPC sözleşmeleri: Her NPC'nin sözleşme bitiş tarihi ve maaşı vardır; bitişi yaklaşanlar serbest kalır ve serbest oyuncu havuzuna girer.
52. **[v1][P1]** Kiralık NPC'ler: Büyük kulüpler 18–21 yaş gençlerini alt kulüplere kiralar; oyuncu da aynı sistemle kiralık gidebilir (2.3 ile bağlantılı).
53. **[v2][P2]** NPC mevki değişimi: Yaşlanan kanat oyuncusunun %30'u bek veya orta sahaya kayar; dünya daha gerçekçi görünür.
54. **[v1][P0]** Kadın futbolu NPC'leri: Kadın liglerinde tüm NPC'ler kadın görünüm parametreleriyle üretilir (sakal parametresi kapalı); NSS'deki "kadın liginde sakallı oyuncu" hatası, üretici seviyesinde birim testiyle engellenir.
55. **[v1][P0]** Zamir doğruluğu: Anlatım, haber ve olay metinleri kişinin cinsiyet alanından zamir ve ek seçer; kadın kariyerinde "he" hatası, tüm metin şablonlarının iki cinsiyetle render testiyle CI'da yakalanır.

#### E. Rakipler ve Nemesis Sistemi

56. **[v1][P1]** Rakip yıldız ataması: Kariyerin 2. sezonunda aynı yaş grubundan ve aynı pozisyondan, benzer potansiyelli bir NPC "rakip" olarak işaretlenir; haber akışı iki oyuncuyu düzenli olarak karşılaştırır.
57. **[v2][P1]** Nemesis olayları: Rakip yıldızla karşılaşılan maçlarda özel ön haber, maç içinde "Rakip ceza sahasında" uyarısı ve maç sonrası karşılaştırmalı istatistik kartı gösterilir.
58. **[v2][P1]** Rakiple sezon yarışı: Gol krallığı, Altın Yıldız oylaması ve milli takım forması için rakiple puan farkı, hub ekranında küçük bir yarış göstergesiyle izlenir.
59. **[v2][P2]** Rakibin kişiliği: Rakip yıldız kibirli, sessiz veya provokatör olabilir; provokatör rakip sosyal medyada laf atar, oyuncu cevap verip vermemeye karar verir.
60. **[v2][P2]** Rakip dönüşümü: Rakiple aynı kulübe veya milli takıma düşülürse ilişki sıfırdan başlar; "eski düşmanlar takım arkadaşı" olay zinciri açılır.
61. **[v1][P2]** Kulüp rakipleri: Oyuncunun kulübünün tarihsel rakibine attığı gol, taraftar ilişkisine 2 kat etki eder; rakip kulübe transfer olmak taraftarda büyük bir öfke olayı tetikler.

#### F. Lig Kuralları ve Sezon Yapısı

62. **[v1][P0]** Yükselme/düşme kuralları: Her lig kademesi için ayrı kural seti (doğrudan yükselen sayısı, play-off katılımcıları, düşen sayısı) JSON'da tanımlanır ve kademe toplam takım sayısı her sezon sonu korunur (değişmez testi).
63. **[v1][P0]** Play-off formatları: Tek maç final, çift maçlı yarı final ve 3–6 takımlı merdiven play-off şablonları desteklenir; play-off eşleşmeleri ve sahası kurala göre üretilir.
64. **[v1][P1]** Şampiyonluk/küme grupları: Bazı ülkelerde normal sezon sonrası lig ikiye bölünür (şampiyonluk ve düşme grupları, puanların yarıya bölünmesi seçeneği); şablon olarak tanımlanır.
65. **[v1][P0]** Puan eşitliği kuralları: Ülkeye göre averaj, ikili averaj, atılan gol, ikili maç sonucu ve gerekirse tek maç play-off sırası tanımlanır; lig tablosunda sıralamayı belirleyen kriter ipucuyla gösterilir.
66. **[v1][P1]** Yabancı oyuncu kuralı: Ligler için yabancı kontenjanı (ör. maç kadrosunda en fazla 8) ve yerli oyuncu zorunluluğu tanımlanabilir; yurt dışına transfer olan oyuncu, kontenjan doluysa ilk 11 şansı düşen bir kulüp uyarısı görür.
67. **[v1][P1]** Kart cezası kuralları: Lig başına sarı kart birikim eşiği (4, 5 veya 10) ve kırmızı kart men süresi; cezalar kupa ve lig için ayrı sayılır.
68. **[v1][P0]** Takvim ve yıl bilgisi: Hub ekranında her zaman tarih (gün, ay, yıl), sezon adı (2027/28), hafta numarası ve bir sonraki büyük turnuvanın yılı ve ev sahibi görünür; NSS'deki "hangi yıldayım, Dünya Turnuvası ne zaman" sorusu kapanır.
69. **[v1][P0]** Fikstür üretici: Çift devreli lig fikstürü round-robin algoritmasıyla üretilir; aynı takım art arda en fazla 2 iç saha/deplasman oynar, derbiler sezonun ilk 3 haftasına konmaz.
70. **[v1][P0]** Fikstür çakışma çözücü: Lig, yerel kupa, kıtasal kupa ve milli takım tarihleri aynı takvimde çözülür; bir takım 72 saatten kısa aralıkla iki maç oynamaz (değişmez testi).
71. **[v1][P0]** 100 sezon fikstür doğrulaması: CI'da 20 farklı seed ile 100'er sezon simüle edilir; her turnuvanın tamamlandığı, hiçbir maçın atlanmadığı, sezonun planlanandan erken bitmediği ve finalin oynandığı doğrulanır. NSS'deki Euro çeyrek final ve Avrupa kupası fikstür hataları bu testle hedeflenir.
72. **[v1][P0]** Oyuncusuz maç yasağı: Oyuncunun kadroda olduğu bir maç asla arka planda "kendiliğinden" oynanmaz; oyuncu sakat veya cezalı değilse maç oynanabilir bir An oturumu olarak açılır ya da oyuncu açıkça "simüle et" der.
73. **[v1][P1]** Sezon arası: Sezon sonu ile yeni sezon arasında 4–6 haftalık ara; hazırlık maçları, transfer penceresi ve tatil olayları bu aralıkta yer alır.
74. **[v1][P2]** Hazırlık turnuvası: Yaz arasında kurgusal 4 takımlı hazırlık kupası; düşük baskı, yeni takım arkadaşlarıyla ilişki kurma fırsatı.
75. **[v1][P1]** Kış arası: Bazı ülkelerde 2–3 haftalık kış arası vardır; bu dönemde antrenman kampı olayı ve form sıfırlanması olur.

#### G. Kupalar ve Kıtasal Turnuvalar

76. **[v1][P0]** Yerel kupa: Her ülkede eleme usulü yerel kupa; alt kademe takımlar ilk turlardan, üst lig takımları 3. turdan başlar. Kura gösterimi ve "dev avcısı" haberleri vardır.
77. **[v1][P1]** İkinci yerel kupa: Büyük ülkelerde sadece üst iki kademenin katıldığı lig kupası; kadrosu geniş kulüpler burada gençleri oynatır, bu da genç oyuncu için forma fırsatıdır.
78. **[v1][P1]** Ulusal süper kupa: Lig şampiyonu ile kupa şampiyonu arasında sezon açılış maçı; NSS'de olmayan bu maç "Süper Kupa Şampiyonu" başarımı ve haberi üretir.
79. **[v1][P0]** Kıtasal kupa 1. kademe (kurgusal "Kıta Şampiyonlar Kupası"): Ön eleme turları, 32 takımlı grup aşaması, son 16'dan itibaren çift maçlı eleme, tek maç final.
80. **[v1][P1]** Kıtasal kupa 2. kademe: Lig sıralamasında bir alt dilimden gelen takımların turnuvası; 1. kademe gruplarında 3. olanlar buraya düşer.
81. **[v2][P1]** Kıtasal kupa 3. kademe: Daha küçük ülkelerin takımlarına kıtasal deneyim veren üçüncü turnuva; NSS oyuncularının istediği "Konferans" benzeri eksikliği kapatır.
82. **[v2][P1]** Kıtasal süper kupa: 1. kademe şampiyonu ile 2. kademe şampiyonu arasında sezon başında tek maç.
83. **[v2][P1]** Kulüpler Dünya Turnuvası: 4 yılda bir kıta şampiyonlarının katıldığı turnuva; takvimde yaz arasına konur ve oyuncunun tatilini kısaltır (yorgunluk etkisi).
84. **[v1][P0]** Kupa kotası devri: Bir takım hem ligden hem kupadan kıtasal hak kazanırsa kontenjan bir sonraki lig sırasına devredilir; kural JSON'da tanımlıdır ve test edilir.
85. **[v1][P1]** Kura motoru: Torbalar, aynı ülkeden takımların gruplarda karşılaşmaması kuralı ve seri başı mantığı; kura animasyonu atlanabilir ve sonucu seed'e bağlıdır.
86. **[v1][P1]** Deplasman golü kuralı ayarı: Kıtasal eleme kuralları (deplasman golü var/yok, uzatma, penaltı) turnuva ayarıdır; varsayılan modern kurallardır.

#### H. Katsayı Sistemi

87. **[v1][P0]** Ülke katsayısı: Son 5 sezonun kıtasal sonuçlarından hesaplanan ülke katsayısı, her ülkenin kıtasal kontenjanını (1–4 takım her kademe için) belirler ve her sezon sonu güncellenir.
88. **[v1][P1]** Kulüp katsayısı: Kura torbaları için kulüp bazında 5 sezonluk puan; büyük kulüpler seri başı olur.
89. **[v1][P1]** Katsayı ekranı: Ülke katsayısı tablosu, oyuncunun ülkesinin sıralamasındaki değişim ve "bu sezon kıtada attığın goller ülkene X puan kazandırdı" bilgisi.
90. **[v2][P2]** Lig gücünün katsayıya bağlanması: Katsayısı yükselen ülkenin yayın geliri ve kulüp bütçeleri sonraki sezon %5–15 artar; dünya zamanla değişen bir güç dengesine sahip olur.

#### I. Milli Takımlar

91. **[v1][P0]** Milli takım havuzu: Her ülkenin milli takımı, o ülke vatandaşı olan tüm oyunculardan (yurt dışında oynayanlar dahil) OVR, form ve TD tercihine göre seçilir.
92. **[v1][P0]** Şeffaf çağrı kriteri: Milli TD'nin çağrı puanı (form, OVR, lig seviyesi, ilişki) oyuncuya gösterilir ve "çağrılmak için ortalama +0,4 maç notu gerekir" gibi somut ipucu verir; NSS'deki "50 maç üst üste maçın adamı oldum, yine çağrılmadım" sorunu kapanır.
93. **[v1][P0]** Eleme grupları: Dünya Turnuvası ve kıta şampiyonası elemeleri gruplu ve torbalı; gerçek dünyadaki eleme düzenine benzer ama kurgusal federasyon adlarıyla. Eleme maçları milli takım haftalarına konur.
94. **[v1][P0]** Dünya Turnuvası (kurgusal ad: "Dünya Turnuvası" / "Küre Kupası"): 4 yılda bir, 32 takım (v1), grup + eleme; 3.lük maçı ve ev sahibi ülke vardır.
95. **[v2][P1]** 48 takımlı format seçeneği: Dünya ayarında 32 veya 48 takımlı format seçilebilir.
96. **[v1][P1]** Kıta şampiyonaları: Her kıtanın 4 yılda bir kendi şampiyonası (Dünya Turnuvası'ndan 2 yıl kaydırılmış); Asya ve diğer kıtaların turnuvaları da üretilir, NSS'deki eksik Asya Kupası benzeri turnuvalar kapanır.
97. **[v1][P1]** Ev sahibi seçimi: Turnuva ev sahibi 6 yıl önceden, itibar ve stadyum kapasitesine göre seçilir; haberde duyurulur ve takvimde görünür.
98. **[v2][P1]** Altyaş milli takımlar: U17, U19 ve U21 takımları ile kendi turnuvaları; 16–21 yaş arası oyuncu buralardan A takıma yükselir.
99. **[v2][P2]** Uluslar ligi benzeri turnuva: Dostluk maçları yerine kademeli milli takım ligi; v2'de dünya ayarıyla açılıp kapatılabilir.
100. **[v1][P1]** Milli takım seçimi: Çift vatandaş oyuncu 21 yaşına kadar A takımda resmî maça çıkmadıysa hangi ülkeyi seçeceğine karar verir; karar ailesi ve taraftarlarla olay zinciri tetikler.
101. **[v1][P1]** Kurgusal dünya sıralaması: Milli takımların puan tabanlı sıralaması, kura torbalarını belirler ve milli takım ekranında gösterilir.

#### J. Ödüller ve İstatistik Veritabanı

102. **[v1][P0]** Şeffaf ödül formülü: Ayın Oyuncusu, Sezonun Oyuncusu ve Altın Yıldız oylaması gol, asist, ortalama not, kupa ve takım başarısının ağırlıklı toplamıyla hesaplanır; aday listesi ve puanları gösterilir. NSS'deki "65 maçta 65 gol attım, ödül alamadım" mantıksızlığı test senaryosuna dönüşür.
103. **[v1][P0]** Altın Yıldız töreni: Yıl sonunda ilk 30 aday listesi, ilk 3 ve kazanan açıklanır; NPC'ler de kazanır ve dünya tarihine yazılır.
104. **[v1][P1]** Lig ödülleri: Gol kralı, asist kralı, en iyi genç, en iyi kaleci (gol yememe sayısı), sezonun 11'i; her lig için ayrı.
105. **[v2][P1]** Yılın Golü oylaması: Sezonun en iyi 10 golü (oyuncunun ve NPC'lerin) aday olur; oyuncunun golü tekrar kaydından seçilir.
106. **[v1][P0]** Gol ve asist krallığı ekranı: Her ligin ve kupanın canlı gol/asist sıralaması; NSS oyuncularının açıkça istediği özellik.
107. **[v1][P0]** Kulüp rekorları: Kulübün tüm zamanların golcüsü, en çok maça çıkan oyuncu, en büyük galibiyet, rekor transfer; oyuncu bir rekoru kırınca haber ve tören olayı tetiklenir.
108. **[v1][P1]** Lig ve dünya rekorları: Bir sezonda en çok gol, en genç golcü gibi dünya rekorları; rekora yaklaşınca "rekora 3 gol kaldı" bildirimi.
109. **[v1][P1]** Geçmiş sezon arşivi: Her ligin geçmiş şampiyonları, gol kralları ve final tabloları sınırsız sezon geriye saklanır (kayıt boyutu bütçesi: sezon başına ≤ 40 KB sıkıştırılmış).
110. **[v1][P1]** Kafa kafaya istatistik: İki kulüp veya iki oyuncu arasındaki tarihsel karşılaşma istatistikleri maç öncesinde gösterilir.
111. **[v2][P2]** Onur listesi ve dünya efsaneleri: Emekli olan en iyi 100 oyuncu (NPC ve oyuncunun eski kariyerleri) dünya efsaneleri listesinde tutulur.

#### K. Haber Dünyası

112. **[v1][P1]** Dünya haber akışı: Oyuncuyla doğrudan ilgili olmayan büyük olaylar (rekor transfer, TD kovulması, sürpriz şampiyonluk) haftada 3–8 manşet olarak gelir; dünya oyuncu olmadan da yaşar.
113. **[v1][P1]** Kurgusal medya kuruluşları: Her ülkede 2–3 kurgusal gazete ve spor kanalı vardır; tonları farklıdır (magazin, ciddi, kulüp yanlısı) ve aynı olayı farklı başlıkla verir.
114. **[v1][P2]** Transfer söylentisi motoru: Söylentilerin %40–60'ı gerçekleşir; güvenilir kaynak etiketi doğruluk oranını yansıtır. Oyuncu hakkındaki söylentiler de buradan çıkar.
115. **[v2][P2]** Sezon önü tahminleri: Medyanın sezon başındaki şampiyonluk ve düşme tahminleri sezon sonunda gerçek sonuçla karşılaştırılır.

#### L. Kadın Futbolu Dünyası

116. **[v1][P0]** Ayrı kadın lig piramidi: Kadın kariyeri seçildiğinde dünya kadın ligleri, kupaları ve milli takımlarıyla üretilir; erkek dünyası kopyalanıp cinsiyet değiştirilmez, kulüp itibarları ve bütçeleri ayrı dengelenir.
117. **[v1][P1]** Karma dünya ayarı: Aynı kayıtta iki piramidin de arka planda simüle edilmesi (haber akışında her ikisinin manşetleri) isteğe bağlı açılır; performans bütçesi aşılırsa yalnızca üst kademe simüle edilir.
118. **[v1][P1]** Kadın futbolu ekonomisi: Maaş ve transfer bedelleri kendi ölçeğindedir ama oyuncunun ilerleme hissi aynı olur (sözleşme iyileştikçe gerçekten zenginleşme); ödül eşikleri buna göre normalize edilir.

#### M. Veri Formatı, Mod Desteği ve Sürümleme

119. **[v1][P0]** Veri ve ilerleme ayrımı: Dünya şablon verisi (lig kuralları, isim havuzları, turnuva formatları) ile kariyer ilerlemesi ayrı dosyalarda tutulur; veri paketi güncellemesi ilerlemeyi bozmaz.
120. **[v1][P0]** JSON şeması: Ülke, lig, kulüp, oyuncu, turnuva ve isim havuzu için sürümlü JSON şeması (Zod ile doğrulanır) belgelenir; şema dışı alan içeren dosya yüklenmez ve satır numaralı hata verir.
121. **[v1][P0]** Veri doğrulayıcı: Yüklenen veri paketi için kural kontrolü (ligdeki takım sayısı fikstüre uygun mu, yükselme/düşme kotaları kademelerle tutarlı mı, aynı ID iki kez var mı); başarısız paket uyarıyla reddedilir, oyun çökmez.
122. **[v1][P1]** İsim paketi (mod): Kullanıcı kendi JSON dosyasıyla kulüp ve oyuncu adlarını değiştirebilir; oyun mağaza sürümünde hiçbir gerçek isim paketi bulunmaz, öne çıkarılmaz ve oyun içinden indirilemez.
123. **[v1][P1]** Mod yükleme yeri: Masaüstünde `userData/mods`, mobilde dosya seçiciyle içe aktarma; yüklenen paket yalnızca yeni kariyere veya açık onayla mevcut kariyere uygulanır.
124. **[v2][P1]** Oyun içi veri editörü: Kulüp adı, renkler, arma parametreleri, oyuncu adı ve özellikleri düzenlenebilir; değişiklik ayrı bir "kullanıcı yaması" katmanında tutulur ve geri alınabilir.
125. **[v2][P2]** Arma/forma editörü: Prosedürel üreticinin parametreleri (kalkan, bölme, figür, renk, desen) editörde açılır; kullanıcı kendi kulüp kimliğini tasarlar.
126. **[v3][P2]** Steam Workshop: Dünya paketleri, isim paketleri ve görsel temalar Workshop'tan abone olunarak yüklenir; içerik moderasyonu ve şikâyet akışı Workshop kurallarına bağlanır, gerçek marka içeren paketler için yayıncı sorumluluğu belirtilir.
127. **[v1][P0]** Veri sürümleme: Her veri paketinin `dataVersion` alanı ve değişiklik listesi vardır; kayıt dosyası hangi veri sürümüyle başladığını saklar.
128. **[v1][P0]** Mevcut kariyerlere güvenli veri güncellemesi: NSS'de veri güncellemeleri yalnız yeni kariyerlere uygulanıyordu. StarPath'te yeni lig/turnuva kuralları mevcut kariyere sezon sonunda, kullanıcı onayıyla ve önce otomatik yedek alınarak uygulanır; oyuncunun kendi kulübü ve sözleşmesi değişmez.
129. **[v1][P1]** Dünya ayar dosyası: Sezon uzunluğu, takım sayısı, yabancı kuralı, maç başına An sayısı, transfer zorluğu gibi ayarlar kariyer başında "Dünya Kuralları" ekranında düzenlenebilir ve kayda yazılır.
130. **[v2][P2]** Veri dışa aktarma: Kendi dünyanı (seed + kullanıcı yamaları) tek bir paket olarak dışa aktarıp paylaşma; arkadaşın aynı dünyada başlar.
131. **[v1][P1]** Simülasyon performans bütçesi: 8 ülke, ~450 kulüp, ~12.000 NPC'lik v1 dünyasının bir haftalık arka plan simülasyonu düşük uçlu Android'de Worker içinde ≤ 150 ms, tam sezon sonu işlemleri ≤ 2 sn sürmeli.
132. **[v1][P1]** Dünya sağlık raporu (geliştirici aracı): 100 sezonluk simülasyon sonunda gol ortalaması (maç başı 2,4–3,0), ev sahibi galibiyet oranı (%42–48), şampiyonların çeşitliliği (10 sezonda en az 3 farklı şampiyon) gibi metrikler otomatik raporlanır ve sınır dışına çıkınca CI uyarı verir.


### 2.7 UI/UX ve Görsellik

NSS'nin arayüzü işlevsel ama eski; oyuncular hem "classic" hem "modern" görünümü okunaksız buluyor, 2024 güncellemesi de sadeliği bozduğu için tepki aldı. StarPath'in arayüzü "Gece Maçı" kimliği üzerine kurulur: Preact + Signals ile DOM katmanı, maç sahnesi Phaser'da, her ekranda tek birincil aksiyon ve her sayının nedeni açıklanabilir. Aşağıdaki maddeler araştırma 03'teki 120 maddelik listenin tekrarları birleştirilmiş, erişilebilirlik (→ 2.11), ses (→ 2.8) ve maç içi sunum (→ 2.2) maddeleri ayrılmış ve yeni ekran akışlarıyla genişletilmiş hâlidir.

#### A. Görsel Dil, Tema ve Design Token'lar
1. **[v1][P0]** Gece Maçı varsayılan tema: Zemin `--bg-1 #0B1220`, kart `--surface-1 #131C2E`, birincil `--brand-pitch #1FD47A`, ödül/para `--accent-gold #FFC83D`. Tüm metin/zemin çiftleri WCAG AA (≥4.5:1) testini CI'da geçer.
2. **[v1][P0]** Token zorunluluğu: Renk, aralık, yarıçap ve gölge değerleri yalnızca `tokens.css` + `tokens.ts` dosyalarından gelir. Bileşen kodunda sabit hex kullanımını ESLint/stylelint kuralı yakalar ve build kırılır.
3. **[v1][P1]** Kulüp rengi sızması: Oyuncunun kulübünün birincil rengi üst bara ve vurgu çizgilerine %12–20 opaklıkla yansır. Transfer onaylandıktan sonraki ilk ekran açılışında yeni renge 400 ms'lik crossfade ile geçilir.
4. **[v1][P1]** Katman derinliği: Kartlarda `inset 0 1px 0 rgba(255,255,255,.06)` üst highlight ve `0 8px 24px rgba(0,0,0,.35)` gölge kullanılır. Düşük güç profilinde (`.lowfx`) gölge tek katmana iner.
5. **[v1][P2]** Zemin dokusu: Düz renk zemin yerine %3 opaklıkta noise dokusu ve radyal projektör ışığı (tek CSS gradient, görsel dosya yok) kullanılır. `.lowfx` profilinde kapanır.
6. **[v1][P1]** TV grafiği şeritleri: Yalnızca ekran başlıkları ve skor tabelası `skewX(-8deg)` paralelkenar şeritte gösterilir. Kartlar ve butonlar düz kalır; kuralın ihlali görsel regresyon testinde yakalanır.
7. **[v1][P0]** 8 px aralık ızgarası: Tüm boşluklar 4/8/12/16/24/32/48 değerlerinden biridir. Stylelint dışındaki değerleri reddeder.
8. **[v1][P0]** Yarıçap sistemi: Çip 6 px, buton 10 px, kart 14 px, modal ve bottom-sheet 20 px; başka yarıçap kullanılmaz.
9. **[v2][P2]** Gün/gece hub arka planı: Oyun içi saat sabah, öğleden sonra ya da akşam dilimindeyse hub gradient'i sırasıyla açık mavi, turuncu ya da lacivert olur. Geçiş 600 ms sürer.
10. **[v2][P2]** Sezon temaları: Kış transfer döneminde soğuk mavi vurgular, sezonun son 4 haftasında altın detay çizgileri kullanılır. Tema yalnızca vurgu token'larını değiştirir, okunurluk token'larına dokunmaz.
11. **[v1][P1]** Classic görsel mod: Ayarlarda "Classic" seçeneği bulunur: düz renkler, gölgesiz kartlar, animasyon süreleri yarıya iner, saha sprite'ları sade 2D'dir. Mod aynı bileşenleri kullanır, yalnızca token setini değiştirir. Ders: NSS'nin 2024 güncellemesi sadeliği bozduğu için sadık oyuncuları kaçırdı; sadelik bir özelliktir.
12. **[v2][P2]** Retro piksel modu: Maç sahnesi için 16-bit piksel sprite seti (CC0 kaynaklı) bir easter egg/kozmetik olarak açılır. Statlara etkisi sıfırdır.
13. **[v1][P0]** Açık tema: `--bg`/`--surface`/`--text` token'larının açık tema karşılıkları tanımlıdır; tema değişimi uygulama yeniden başlatılmadan 1 karede uygulanır.

#### B. Tipografi
14. **[v1][P0]** Font üçlüsü: Başlık ve etiketlerde Barlow Condensed (700–900, italik), gövde ve tablolarda Inter (400/500), skor ve rating için Teko (600). Fontlar `fontsource` ile self-host edilir ve yalnızca `latin` + `latin-ext` alt kümeleri yüklenir; toplam font yükü ≤ 220 KB.
15. **[v1][P0]** Tablo rakamları: Tüm sayısal sütunlarda `font-variant-numeric: tabular-nums` kullanılır ve sayılar sağa hizalanır. Lig tablosunda puan değişince satır genişliği 0 px kayar (görsel regresyon testi).
16. **[v1][P0]** Tipografi ölçeği: Ölçek 1.25 oranlıdır ve `clamp()` ile akışkandır. Display 40–56 px, H1 28–32 px, H2 20–22 px, gövde 15–16 px / `line-height 1.45`, mikro 11 px büyük harf `letter-spacing .08em`.
17. **[v1][P1]** Akıllı isim kısaltma: 14 karakteri aşan isimler kart üstünde "M. Yılmazoğlu" biçimine iner. Hâlâ sığmıyorsa font en fazla %85'e kadar küçülür; daha fazla küçülme yapılmaz.
18. **[v1][P1]** Satır uzunluğu: Haber ve olay metinlerinde satır 45–75 karakterdir. Geniş ekranda metin sütunu `max-width: 68ch` ile sınırlanır.
19. **[v1][P1]** Metin içi vurgu: Olay ve haber metinlerinde oyuncu adı kalın, para miktarı `--accent-gold`, olumsuz değer `--state-danger` ile işaretlenir. İşaretleme çeviri dosyasında `<b>`, `<money>` etiketleriyle yapılır.
20. **[v1][P2]** Manşet fontu: Gazete ekranında başlıklar Oswald 700 ile, gazete kâğıdı tonunda bir kartta gösterilir. Bu font yalnızca haber modülünde yüklenir (lazy).

#### C. Navigasyon ve Bilgi Mimarisi
21. **[v1][P0]** Alt navigasyon (mobil): 5 sekme vardır: Ana Sayfa, Kariyer, Yaşam, Takım, Profil. Sekmeler başparmak bölgesindedir, 56 px yüksekliktedir ve seçili ikon `fill` stiliyle gösterilir.
22. **[v1][P0]** Hub'da tek CTA: "Sıradaki Maç" kartı her zaman en üsttedir ve ekrandaki tek dolu (chunky) butondur. Oyunun ana döngüsü hub'dan en fazla 1 dokunuşla ilerler.
23. **[v1][P0]** 2 dokunuş kuralı: Antrenman, ilişkiler, mağaza, sözleşme, haberler, lig tablosu ve ayarlar hub'dan en fazla 2 dokunuşla açılır. Bu, bir navigasyon haritası testiyle doğrulanır.
24. **[v1][P0]** Haftalık takvim şeridi: Yatay kaydırılabilir 7 günlük şerittir. Her gün 3 zaman dilimi ikonu (sabah/öğle/akşam) ve etkinlik rozetleri (maç, antrenman, sosyal, sponsor çekimi) gösterir. Dolu dilim gri, boş dilim çerçeveli görünür.
25. **[v1][P0]** Tutarlı geri hareketi: Android sistem geri tuşu, predictive back ve sol üstteki ok aynı yığını izler. Modal açıkken geri hareketi yalnızca modalı kapatır.
26. **[v1][P1]** Bağlamsal başlıklar: Breadcrumb yerine "Transferler · 3 teklif" gibi başlık ve alt başlık kullanılır. Alt başlık ekranın canlı özetini taşır.
27. **[v1][P1]** Bildirim rozetleri: Sekmelerde kırmızı nokta ve sayı gösterilir; 9'u aşan sayı "9+" olur. Rozet, ilgili ekran açıldığında temizlenir; okunmamış olay kalmadığı hâlde görünen "hayalet rozet" olmaz.
28. **[v2][P1]** Global arama: Oyuncu, kulüp, eşya ve ayar araması yapılabilir. Masaüstünde `Ctrl+K` ile açılır, sonuçlar ilk 3 harften sonra listelenir. Aramada Türkçe karakterler normalize edilir ("sukru" yazmak "Şükrü"yü bulur).
29. **[v1][P1]** Bottom-sheet derin ekranlar: Oyuncu detayı, eşya detayı ve teklif detayı bottom-sheet olarak açılır; altta kalan ekran %40 karartılır ve bağlam kaybolmaz. Sheet aşağı kaydırılarak kapatılabilir.
30. **[v1][P0]** Masaüstü düzeni: 1280 px'in üzerindeki ekranlarda sol kenar navigasyonu ve 2–3 sütunlu düzen kullanılır (örneğin hub'da sol takvim, orta maç kartı, sağ haber akışı). Telefon arayüzü büyütülerek gösterilmez.
31. **[v1][P0]** Klavye kısayolları: `Space` sonraki dilim, `M` maça git, `T` antrenman, `I` ilişkiler, `Esc` geri. Kısayol listesi `?` tuşuyla açılır.
32. **[v1][P0]** Gamepad odak sistemi: Spatial navigation kullanılır; odak halkası 3 px `--accent-blue` ve 2 px offset ile çizilir. Tüm ekranlar fareye dokunmadan gezilebilir; bu, Playwright gamepad simülasyonuyla test edilir.
33. **[v1][P1]** Dinamik tuş ikonları: Son kullanılan giriş cihazına göre klavye, Xbox, PlayStation ya da Steam Deck glifleri 1 kare içinde değişir. Kenney Input Prompts (CC0) kullanılır.
34. **[v1][P0]** Steam Deck yerleşimi: 1280×800 çözünürlükte hiçbir metin 12 px'in altına düşmez ve sanal klavye isim girişinde otomatik açılır. Steam Deck Verified kontrol listesi bir release kapısıdır.
35. **[v1][P1]** Kilitli özellik önizlemesi: Kilitli sistemler bulanık önizleme ve "Şöhret 40'ta açılır" etiketiyle gösterilir. Gerçek para kilidi gerektiren hiçbir oyun sistemi yoktur; deneme sürümündeki kilit yalnızca "Tam Kariyer" ile açılır.
36. **[v1][P1]** Maç gününe atla / otopilot: Hub'da "Maç gününe kadar otomatik geç" butonu bulunur. Butonun altında seçili rutin özetlenir (örneğin "3× antrenman, 1× dinlenme, 1× aile"). Geçiş sırasında karar gerektiren bir olay çıkarsa otopilot durur ve olay kartı açılır.
37. **[v1][P2]** Ekran içi hızlı geçiş: Kariyer sekmesindeki alt sayfalar (İstatistik, Sözleşme, Transfer, Ödüller) yatay swipe ile değiştirilebilir. Masaüstünde aynı geçiş `Q`/`E` tuşlarıyla yapılır.

#### D. Bileşen Kütüphanesi
38. **[v1][P0]** Chunky CTA butonu: 52 px yükseklik, `#2BE88A → #1FD47A` gradient, `0 4px 0 #0E9F57` bevel. Basılınca `translateY(3px)` ile 80 ms'de iner. Ekranda tek dolu buton kuralı geçerlidir.
39. **[v1][P0]** İkincil butonlar: Outline ve ghost varyantlar 44 px yüksekliktedir. Yıkıcı aksiyonlar (sat, ayrıl, emekli ol) `--state-danger` outline ile gösterilir ve hiçbir zaman varsayılan odakta olmaz.
40. **[v1][P0]** Oyuncu kartı: 5:7 oranlıdır. Sol üstte Teko ile rating, altında facesjs avatarı, en altta tek satırda 6 stat ve kulüp arması yer alır. Çerçeve rengi bronz, gümüş, altın, elit ya da efsane kademesine göre belirlenir.
41. **[v1][P2]** Elit kart parlaması: Elit ve efsane kartlarda 4 saniyelik döngüyle kayan bir shine efekti oynar. Azaltılmış hareket ayarında ve `.lowfx` profilinde kapanır.
42. **[v1][P0]** Çipler: Mevki, form, sakatlık, sözleşme durumu ve "kiralık" bilgisi 24 px yükseklikte çiplerle gösterilir. Her çipte ikon + metin bulunur; bilgi yalnızca renkle verilmez.
43. **[v1][P0]** ProgressRing: Enerji, moral, kondisyon ve XP 48 px halkalarla gösterilir; değer halkanın ortasında Teko ile yazılır. Değer %20'nin altına inince halka `--state-danger` olur ve bir uyarı ikonu belirir.
44. **[v1][P0]** StatBar ve delta: Atribüt barları renk skalasıyla dolar (çok zayıf `#FF4D5E` … elit `#3DE0E0`). Değişim "+3 ▲" ya da "−1 ▼" olarak 3 saniye görünür.
45. **[v1][P1]** Skeleton yükleme: Sim hesaplaması 150 ms'yi aşarsa skeleton gösterilir; boş beyaz ekran asla görünmez. Skeleton, gerçek düzenle aynı boyuttadır, böylece içerik geldiğinde düzen kayması (CLS) 0 olur.
46. **[v1][P1]** Boş durum ekranları: Her listenin boş durumu bir illüstrasyon ve aksiyon önerisi içerir (örneğin "Henüz teklif yok. Form ortalamanı 7.0'ın üstüne çıkar."). Boş durumların hepsi bir envanter dosyasında listelenir.
47. **[v1][P1]** Toast: Toast mobilde üstte, masaüstünde sağ üstte çıkar; 4 saniye görünür ve kaydırılarak kapatılabilir. Aynı anda en fazla 3 toast gösterilir, fazlası kuyruğa girer.
48. **[v1][P0]** Geri al (undo): Satış, eşya atma ve antrenman planı silme gibi geri alınabilir aksiyonlarda onay diyaloğu yerine 6 saniyelik "Geri al" toast'u gösterilir. Gerçekten geri alınamayan aksiyonlarda (emeklilik, kariyer silme) iki adımlı onay istenir.
49. **[v1][P1]** Sticky başlıklar: Kadro, transfer ve haber listelerinde grup başlıkları kaydırma sırasında üstte sabit kalır.
50. **[v1][P0]** Sayısal girdi: Bahis, maaş teklifi ve kira gibi değerler slider ile ±adım butonlarıyla girilir; klavye zorunlu değildir. Slider adımı değere göre ölçeklenir (₺1.000 / ₺10.000 / ₺100.000).
51. **[v1][P1]** Karşılaştırma görünümü: İki teklif ya da iki oyuncu yan yana gösterilir ve farklar yeşil/kırmızı vurgulanır. Transfer teklifinde maaş, süre, rol ve şehir satırları karşılaştırılır.
52. **[v1][P1]** Uzun basma önizlemesi: Oyuncu, eşya ya da kulüp üzerine 400 ms basılı tutulduğunda bir önizleme balonu açılır. Masaüstünde aynı balon fare üzerinde 300 ms bekletince gelir.
53. **[v1][P1]** Sanallaştırılmış listeler: 20 satırı aşan listeler (kadro, transfer pazarı, lig tablosu, haber arşivi) sanallaştırılır. 1.000 satırlık listede kaydırma düşük uçlu Android'de ≥55 fps'te kalır.
54. **[v1][P2]** Avatar bileşeni: facesjs SVG'si bir kez üretilir, ImageBitmap'e dönüştürülür ve IndexedDB'de önbelleğe alınır. Aynı yüz ikinci kez 5 ms'nin altında çizilir.

#### E. Veri Görselleştirme
55. **[v1][P0]** Atribüt radarı: Pozisyona göre 6 eksenli radar çizilir; kaleci kartında kaleci eksenleri kullanılır. Önceki sezonun değeri kesikli çizgiyle üst üste gösterilir.
56. **[v1][P0]** Form göstergesi: Son 10 maçın reytingi sparkline ve renkli nokta dizisiyle (≥7.5 yeşil, 6–7.4 sarı, <6 kırmızı) gösterilir. Noktaya dokunmak o maçın özetini açar.
57. **[v1][P1]** Reyting tarihçesi: Kariyer boyu maç reytingi çizgi grafikte izlenir; sezon sınırları dikey çizgilerle ve kulüp değişimleri arma ikonlarıyla işaretlenir.
58. **[v1][P1]** Isı haritası ve şut haritası: Maç sonu ekranında oyuncunun dokunduğu bölgeler 12×8 hücreli bir ızgarada gösterilir. Şut haritasında gol ●, isabetli ○ ve isabetsiz × şekilleriyle ayrılır.
59. **[v1][P0]** Finans grafikleri: Gelir ve gider halka grafikte kategori bazında, son 12 haftanın bakiyesi çizgi grafikte gösterilir. Her dilime dokunulduğunda kalem kalem döküm açılır.
60. **[v1][P0]** Lig tablosu bölgeleri: Kıtasal kupa, play-off ve küme düşme sıraları satırın solunda 4 px'lik renkli şeritle ve bir lejantla belirtilir. Oyuncunun kulübünün satırı `--surface-3` ile vurgulanır.
61. **[v1][P1]** Kariyer zaman çizelgesi: Yatay timeline'da kulüpler (arma), kupalar, ödüller, sakatlıklar ve dönüm noktaları yer alır. Pinch ile yakınlaştırılabilir; 20 sezonluk kariyer akıcı biçimde gezilir.
62. **[v2][P1]** İlişki ağı: Oyuncu merkezde durur; teknik direktör, takım arkadaşları, aile ve ajan çevresine dizilir. Çizgi kalınlığı ilişki gücünü, rengi yönünü gösterir; bir düğüme dokunmak son 5 olayı listeler.
63. **[v1][P0]** Atribüt renk skalası: Tüm atribüt değerleri aynı 6 kademeli skalayla renklendirilir. Renk körlüğü modunda kademe numarası (1–6) da yazılır.
64. **[v1][P1]** Dokunmalı tooltip: Grafikteki bir noktaya dokunulduğunda değer balonu açılır; balon 3 saniye ya da ikinci bir dokunuşla kapanır. Masaüstünde hover ile çalışır.
65. **[v2][P2]** Rakip karşılaştırma grafiği: Nemesis oyuncuyla sezon gol, asist ve reyting çizgileri aynı grafikte gösterilir.

#### F. Maç HUD'u ve Maç Çevresi Ekranları
66. **[v1][P0]** Minimal maç HUD'u: Ekranda yalnızca skor + dakika (Teko, Phaser BitmapText), kondisyon çubuğu ve duraklat butonu bulunur. Diğer her şey duraklat menüsündedir; HUD ekran alanının ≤ %8'ini kaplar.
67. **[v1][P0]** Kahraman işaretçisi: Kullanıcının oyuncusunun altında `--brand-pitch` halka, topa sahip oyuncunun üstünde küçük bir ok durur. Halka renk körlüğü modunda çift çizgiye döner.
68. **[v1][P0]** Nişan göstergesi: Pas ve şut için yarı saydam bir yay ve güç barı çizilir. Güç barı %90'ı aşınca kırmızıya döner ve "aşırı güç" riskini görsel olarak bildirir.
69. **[v1][P1]** Ofsayt ve VAR görseli: Ofsayt çizgisi ince mavi tarama çizgisi olarak gösterilir. VAR incelemesinde ekranda 1,5 saniyelik bir "İnceleme" bandı belirir. (Animasyonlu sunum 2.2'de.)
70. **[v1][P1]** Kart pop-up'ı: Sarı ya da kırmızı kart gösterildiğinde oyuncu adıyla birlikte 1,2 saniyelik bir kart ikonu çıkar. Kart sayısı HUD'da küçük bir rozet olarak kalır.
71. **[v1][P0]** Maç öncesi ekranı: Rakibin form noktaları, iki takımın gücü (OVR çubuğu), hava durumu, stadyum kapasitesi, oyuncunun rolü ve TD'nin beklentisi (örneğin "En az 1 isabetli şut") tek ekranda verilir; "Başla" tek CTA'dır.
72. **[v1][P0]** Maç sonu reyting dökümü: Maç notunun bileşenleri satır satır gösterilir: "+1,5 gol, +0,8 asist, +0,3 başarılı dribbling, −0,4 kaçan pas, −0,2 top kaybı = 7,4". Formülün kendisi gizli tutulmaz.
73. **[v1][P0]** Maç sonu akışı: Sıra skor → reyting dökümü → Maçın Oyuncusu kartı → kazanç dökümü (maaş, gol/asist bonusu, sponsor) → ilişki değişimleri → röportaj kararıdır. Ekranlar "Atla" ile geçilebilir ve tüm akış ≤ 6 dokunuşta biter.
74. **[v1][P0]** Anlar arası ekran: Canlı skor, mini radar (2D noktalar) ve metin anlatımı gösterilir. Hız seçenekleri 1×, 2×, 4× ve "sonraki ana atla"dır.
75. **[v1][P1]** Paylaşılabilir maç kartı: Maç sonunda skor, reyting, gol dakikaları ve avatardan oluşan 1080×1350 bir PNG üretilir. Görselde kişisel veri ya da cihaz bilgisi bulunmaz.
76. **[v1][P1]** Duraklat menüsü: Taktik odağı (hücum/denge/savunma), yardım seviyesi, ses ve "maçı simüle et" seçenekleri burada yer alır. Uygulama arka plana geçince maç otomatik duraklar.
77. **[v2][P2]** Devre arası ekranı: İlk yarı istatistikleri, TD'nin konuşma balonu ve bir "odak değiştir" kararı gösterilir; en fazla 3 dokunuşta biter.

#### G. Ekran Akışları (Kariyer ve Yaşam)
78. **[v1][P0]** Hub ekranı: Yukarıdan aşağı sıra sabittir: Sıradaki Maç kartı, takvim şeridi, enerji/mutluluk/stres halkaları, bekleyen kararlar (en fazla 3 kart), haber önizlemesi.
79. **[v1][P0]** Karakter yaratma: 4 adımlık sihirbazdır: Kimlik, Görünüm (canlı önizleme), Pozisyon/Arketip, Geçmiş hikâyesi. Tüm adımlar geri dönülebilir ve 90 saniyenin altında tamamlanabilir; "Rastgele" butonu her adımı doldurur.
80. **[v1][P0]** Antrenman ekranı: Mini oyun kartlarında hedef atribüt, enerji maliyeti, son yıldız sonucu ve erime uyarısı ("Pas 3 gün sonra 1 puan düşebilir") gösterilir. Mini oyun 1 dokunuşla başlar.
81. **[v1][P0]** İlişkiler ekranı: Her kişi için avatar, −100..100 değer, eğilim oku ve son 5 olayın hafıza listesi yer alır. Kişiye dokunmak etkileşim seçeneklerini maliyetleriyle (zaman dilimi, enerji, ₺) açar.
82. **[v1][P0]** İlişki değişim nedenleri: Her değişim kaynağıyla birlikte görünür: "TD −4: Antrenmana geç kaldın", "Arda +3: Ona 2 asist yaptın". Nedeni yazılmayan değişim olmaz.
83. **[v1][P0]** "Neden oldu?" paneli: Yedek kalma, transfer reddi, sponsor kaybı ve ödül kaybı gibi sonuçlarda bir "Neden?" butonu çıkar. Panel en etkili 3 faktörü yüzde katkılarıyla listeler.
84. **[v1][P0]** Mağaza ekranı: Kategoriler (Ev, Araba, Saat, Moda, Teknoloji, Evcil Hayvan, Tekne, Uçak, Sanat, İşletme) sekme olarak dizilir. Her üründe fiyat, haftalık bakım, mutluluk ve şöhret bonusu çiplerle gösterilir. Tüm fiyatlar oyun içi para simgesiyle (örneğin ₺) yazılır; simgesiz fiyat bulunmaz.
85. **[v1][P0]** Gerçek para mağazası ayrımı: Kozmetik ve Tam Kariyer satın alımları ayrı bir "Destek Ol / Mağaza" ekranındadır ve mağaza fiyatı yerel para birimiyle (örneğin "₺149,99") gösterilir. Oyun içi para ile gerçek para aynı ekranda karışmaz.
86. **[v1][P0]** Koleksiyon rafı: Sahip olunan ev, araba ve eşyalar izometrik flat ikonlarla bir "raf" görünümünde dizilir. Her eşyada kondisyon %'si ve ikinci el değeri görünür.
87. **[v1][P0]** Kumarhane ekranı: Girişte bakiye, günlük kayıp limiti ve oturum süresi bandı sabittir. Her oyunda bahis seçimi slider ile yapılır; oyuncunun kendi maçıyla ilgili bahis seçeneği hiçbir zaman arayüzde gösterilmez.
88. **[v1][P0]** Sözleşme ekranı: Maaş, süre, imza parası, gol/asist bonusu, serbest kalma bedeli, oynama süresi garantisi ve sigorta satırları gösterilir. Pazarlıkta karşı tarafın sabrı bir bar ile görünür; her teklifin bu barı ne kadar düşüreceği önceden tahmin edilir.
89. **[v1][P0]** Transfer ekranı: İlgilenen kulüpler "scout izliyor", "ilgi var" ve "teklif hazır" kademelerinde listelenir. Her kulüpte lig, rol beklentisi, şehir ve maaş aralığı yer alır; teklif karşılaştırması tek dokunuşla açılır.
90. **[v1][P0]** Haber ekranı: Gazete manşeti tipografisi, kulüp renkli duotone prosedürel "fotoğraf" ve tarih/kaynak satırı kullanılır. Manşete dokunmak, haberi doğuran olayı ve etkisini gösterir.
91. **[v1][P0]** Telefon metaforu: Mesajlar, Ajan aramaları, Takvim, Sosyal Medya ve Banka "uygulamaları" bir telefon çerçevesinde açılır. Okunmamış mesajlar uygulama ikonunda rozetle belirtilir.
92. **[v1][P1]** Sosyal medya akışı: Paylaşım tipi seçimi (antrenman, lüks, aile, hayır, provokasyon) ve beklenen etki çipleri ile taraftar yorumları (DiceBear avatarlı), beğeni sayacı ve trend etiketleri. Nefret yorumları ayarlardan gizlenebilir.
93. **[v1][P0]** Olay kartı: Solda game-icons rozeti, ortada başlık ve 2–4 cümlelik metin, altta 2–3 seçenek bulunur. Her seçeneğin altında bilinen etkiler çip olarak gösterilir ("+5 Mutluluk", "−₺2.000"). Belirsiz etkiler "🎲 riskli" çipiyle belirtilir.
94. **[v1][P0]** İstatistik ekranı: Sezon / Kariyer / Kulüp bazında gol, asist, reyting, Maçın Oyuncusu ve dakika istatistikleri tutulur. Gol krallığı ve asist sıralaması ligdeki tüm NPC'leri içerir.
95. **[v1][P1]** Kadro (takım sayfası): Takım arkadaşları isim, forma numarası, mevki, rating ve oyuncuyla ilişkisiyle listelenir. NSS'de bulunmayan takım listesi talebinin karşılığıdır.
96. **[v1][P1]** Kupa dolabı: Prosedürel kupalar 3D hissi veren raflarda dizilir. Kupaya dokunmak sezonunu, finalin skorunu ve oyuncunun o turnuvadaki katkısını gösterir.
97. **[v1][P1]** Başarım vitrini: Rozetler nadirlik çerçevelidir. Kilitli başarımlarda ilerleme çubuğu bulunur ("Kariyer golü 67/100"); gizli başarımlarda yalnızca "?" gösterilir.
98. **[v1][P0]** Kayıt slotları ekranı: 3 slot vardır. Her slot oyuncu adı, kulüp, sezon, oynama süresi, son kayıt zamanı ve küçük ekran görüntüsünü gösterir. "Yedekten geri yükle" ve "Dışa aktar" seçenekleri her slotun menüsündedir.
99. **[v1][P0]** Ayarlar ekranı: Gruplar sabittir: Oyun (yardım seviyesi, maç hızı), Görüntü (tema, Classic mod, kalite), Ses, Kontroller, Erişilebilirlik, Dil, Kayıt/Bulut, Gizlilik. Her ayarın yanında 1 satırlık açıklama yer alır.
100. **[v1][P1]** Haftalık özet: Hafta sonunda form, para değişimi, ilişki değişimleri, haber başlıkları ve gelecek haftanın kritik olayları tek kartta özetlenir; ekran 1 dokunuşla kapanır.
101. **[v2][P1]** Sezon sonu "Yıl Özeti": Sezonun özeti Wrapped tarzında kaydırılan 6–8 kartla verilir (en iyi gol, en uzun seri, en çok harcanan kategori, en iyi arkadaş). Her kart ayrı ayrı paylaşılabilir.
102. **[v2][P2]** Emeklilik ve Onur Listesi ekranı: Kariyer skoru dökümü, en iyi 5 an, kariyer kartı ve "Miras olarak devam et" CTA'sı gösterilir.

#### H. Animasyon, Hareket ve Geri Bildirim
103. **[v1][P0]** Hareket süreleri: Mikro etkileşim 80–150 ms, ekran geçişi 220–320 ms, kutlama 600–1200 ms. Girişte `cubic-bezier(.2,.8,.2,1)`, çıkışta `cubic-bezier(.4,0,1,1)` kullanılır. Yalnızca `transform` ve `opacity` animasyonu yapılır.
104. **[v1][P1]** Yön anlamı: İleri gezinti sağdan, geri gezinti soldan kayar; modal alttan çıkar. Azaltılmış harekette bunların hepsi 150 ms crossfade olur.
105. **[v1][P0]** Count-up sayaçlar: Para, rating ve XP değişimleri 400–800 ms'de sayarak artar ya da azalır. Artışta yeşil, düşüşte kırmızı kısa bir parlama olur.
106. **[v1][P1]** Tek kahraman kuralı: Aynı anda yalnızca bir kutlama oynar. Konfeti, sarsıntı ve stinger birlikte yalnızca gol, kupa, transfer ve ödül anlarında kullanılır.
107. **[v1][P1]** Ödül ve rozet animasyonu: Spring animasyonu (stiffness 300, damping 20), nadirlik rengine göre ışık patlaması ve kart çevirme kullanılır. Animasyon süresince ekrana dokunmak onu anında bitirir.
108. **[v1][P1]** Transfer giydirme: İmza ekranında eski forma kayarak çıkar, yeni forma (prosedürel) gelir ve arma büyür; toplam 1.000 ms sürer.
109. **[v1][P2]** Stagger: Liste öğeleri 30 ms arayla gelir; 8. öğeden sonrakiler anında görünür.
110. **[v1][P2]** Tematik yükleme: Uzun sim hesaplamalarında dönen top ya da dolan stadyum loader'ı gösterilir. 2 saniyeyi aşan bekleyişlerde metinle ilerleme verilir ("Lig simüle ediliyor 12/38").
111. **[v1][P1]** Haptik eşleme: Onay seçim titreşimi, hata `notification error`, gol `notification success`, direk `impact Heavy`. Haptik tek bir ayarla kapatılır ve iOS'ta sistem ayarına uyulur.
112. **[v2][P2]** Sonraki güne geçme jesti: Hub'da yukarı kaydırma ve 600 ms basılı tutma ile "sonraki dilime geç" yapılabilir. Yanlışlıkla tetiklemeye karşı ilerleme halkası gösterilir.
113. **[v1][P2]** Bildirim zili: Yeni olay geldiğinde zil 400 ms hafifçe sallanır. Azaltılmış harekette yalnızca rozet gösterilir.

#### I. Karakter, Avatar ve Kişiselleştirme
114. **[v1][P0]** facesjs karakter oluşturucu: Yüz, saç, ten, sakal, kaş ve aksesuar canlı önizlemeyle seçilir; her değişiklik 50 ms içinde önizlemeye yansır. Ten rengi seçimi kaldırılmaz (NSS bunu kaldırmıştı).
115. **[v1][P1]** Yaşlanan yüz: Her sezon sonunda facesjs parametreleri güncellenir: 30 yaştan sonra saç beyazlaması, kırışıklık ve sakal seçenekleri gelir. Kariyer zaman çizelgesinde her sezonun yüzü görüntülenebilir.
116. **[v1][P1]** Kozmetiklerin sahaya yansıması: Krampon rengi, saç stili, bant ve dövme maç sprite'ında da görünür. Kozmetik ID'leri simülasyona girmez; bu, kod düzeyinde zorlanır.
117. **[v1][P1]** Yan karakter avatarları: TD, ajan, sevgili, gazeteci ve taraftarlar DiceBear CC0 stilleriyle tutarlı ama oyuncu avatarından ayırt edilebilir biçimde çizilir.
118. **[v1][P1]** Ruh hâli yüz ifadesi: Mutluluk ve stres değerine göre facesjs ağız ve kaş parametreleri 5 kademede değişir. Hub'daki avatar oyuncunun ruh hâlini metinsiz olarak da anlatır.
119. **[v2][P2]** Kişisel marka: Oyuncu kendi markası için logo (prosedürel şekil + monogram) ve renk seçer. Marka giyim işletmesi ürünlerinde ve sosyal medya profilinde görünür.
120. **[v1][P1]** Prosedürel kulüp kimliği: Her kurgusal kulübün seed'den üretilen forması (12+ desen) ve arması (10+ kalkan, heraldik bölmeler) vardır. Gerçek kulüplere benzerlik bir kara liste kontrolünden geçer.
121. **[v2][P2]** Yıllık forma varyasyonu: Kulüp formaları her sezon küçük bir varyasyonla yenilenir (örneğin "2027/28 iç saha"). Eski formalar kariyer zaman çizelgesinde görünür.

#### J. Onboarding, Yardım ve Bilgilendirme
122. **[v1][P0]** 60 saniyelik etkileşimli onboarding: İlk maç anı (şut), ilk antrenman ve ilk olay kartı oynatılarak öğretilir. Her adımda tek bir özellik tanıtılır ve adımlar atlanabilir.
123. **[v1][P0]** Kademeli açılış: Kumarhane, yatırım ve işletme sistemleri ilk 3 haftada gizlidir; açıldıklarında 1 kartlık bir tanıtım gösterilir. Bu, NSS'nin "yeni başlayana fazla özellik" şikâyetinin karşılığıdır.
124. **[v1][P1]** Bağlamsal tooltip'ler: Her gösterge ilk görüldüğünde 1 kez açıklanır ("Disiplin: kulübün senin hakkındaki görüşü"). Tooltip'ler Ayarlar > Yardım'dan sıfırlanabilir.
125. **[v1][P1]** Sözlük ekranı: OVR, form, potansiyel, serbest kalma bedeli gibi terimlerin açıklamaları tek listede toplanır ve aranabilir.
126. **[v1][P1]** Ön-maç yardım ipucu: Maç anlarının kontrol özeti (swipe = şut, uzunluk = güç, eğri = falso) ilk 5 maçta, anın başında 2 saniyelik bir overlay olarak gösterilir.

#### K. Dürüst Arayüz (Dark Pattern Yasakları)
127. **[v1][P0]** Sabit buton konumu: Onay ve gizlilik pencerelerinde "Kabul" ve "Reddet" butonları aynı boyut ve kontrasttadır, konumları hiçbir koşulda yer değiştirmez. Bu kural bir UI testiyle doğrulanır (NSS'nin 2019'daki Ogury dersi).
128. **[v1][P0]** Para simgesi zorunlu: Gerçek ya da oyun içi her fiyat, simgesi ve birimiyle gösterilir. Simgesiz fiyat bileşeni derlenmez (TypeScript tipi `Price` zorunludur).
129. **[v1][P0]** Yoruma ödül yok: Mağaza puanı istemi ödülsüzdür ve en fazla 1 kez gösterilir; yalnızca olumlu bir an sonrasında (kupa, ödül) ve sistem API'si (SKStoreReview / In-App Review) ile açılır.
130. **[v1][P0]** Kapanabilir pencereler: Her modalın kapatma butonu 44×44 px'tir ve sağ üstte sabittir. "Kapat" butonunun 3 saniye geciktirilmesi gibi uygulamalar yasaktır.
131. **[v1][P0]** Süre ve kapsam şeffaflığı: Satın alma ekranı ürünün kalıcı olduğunu ("Bir kez al, sonsuza dek; geri yüklenebilir") ve neleri içerdiğini açıkça yazar. Hiçbir ürünün gizli bir maç ya da süre sınırı yoktur.
132. **[v1][P1]** Sahte aciliyet yok: Geri sayımlı teklif, "son 2 adet" uyarısı ya da FOMO bildirimi kullanılmaz; bu kural UI kopya incelemesinin kontrol listesinde yer alır.


### 2.8 Ses ve Müzik

NSS'de ses minimaldi: maçta müzik yoktu, birkaç tezahürat, yağmur sesi ve 2.0 ile gelen güçlü "whack" vuruş sesi vardı. Oyuncunun kendi müziğini çalabilmesi ise sevilen bir özellikti. StarPath'te ses, maçın gerilimini taşıyan dinamik bir katman olacak; ama sade, kapatılabilir ve kullanıcının müziğine saygılı kalacak.

#### A. Ses Mimarisi ve Karıştırma
1. **[v1][P0]** Ayrı ses kanalları: Ana ses, Müzik, Efekt, Kalabalık/Ambiyans, UI ve (v3) Anlatım için 6 ayrı kaydırıcı. Ayarlar her slot için değil global saklanır.
2. **[v1][P0]** Kullanıcının kendi müziği: Arka planda Spotify vb. bir uygulama çalarken oyun müziği otomatik susar, efektler devam eder. iOS'ta `ambient` audio session kategorisi kullanılır. NSS 2.0'da geri gelen ve sevilen davranış korunur.
3. **[v1][P0]** iOS sessiz anahtarı: Sessiz moddayken oyun ses çalmaz (ambient kategori). Ayarlarda "sessiz modda da çal" seçeneği vardır.
4. **[v1][P0]** Arka plana geçişte susma: Uygulama arka plana geçince AudioContext 100 ms içinde askıya alınır, döndüğünde fade-in ile (300 ms) devam eder.
5. **[v1][P0]** Web Audio kilidi: İlk kullanıcı dokunuşunda ses bağlamı açılır. Açılmamışsa ana menüde küçük bir "sesi aç" ikonu görünür ve sessiz başlangıç hata sayılmaz.
6. **[v1][P1]** Ducking: Gol stinger'ı ve önemli UI sesleri çaldığında kalabalık kanalı 150 ms'de −6 dB iner ve 600 ms'de geri döner. Müzik, maç anında −9 dB'ye çekilir.
7. **[v1][P1]** Ses önceliği ve eşzamanlılık: Aynı anda en fazla 24 ses. Önceliği düşük olanlar (çim adımı, UI hover) önce kesilir, gol/düdük asla kesilmez.
8. **[v1][P1]** Ses yüksekliği normalizasyonu: Tüm efektler ve müzikler −16 LUFS (mobil) hedefine göre normalize edilir. Hiçbir efekt tepe noktası −1 dBTP'yi geçmez.
9. **[v1][P1]** Rastgele varyasyon: Sık tekrarlanan seslerde (vuruş, pas, adım) her oynatmada ±%6 perde ve ±2 dB ses rastgeleliği ile 3–5 örnek arasında dönüşüm yapılır. "Makineli tüfek" tekrarı önlenir.
10. **[v2][P2]** Uzamsal ses: Stereo panlama topun ekrandaki yatay konumuna göre (−0.6..+0.6) yapılır. Kulaklıkta direk sesi doğru taraftan gelir.
11. **[v1][P2]** Ses ön ayarları: "Stadyum" (kalabalık önde), "Odak" (efekt önde, kalabalık kısık) ve "Sessiz maç" ön ayarları.

#### B. Kalabalık ve Ambiyans
12. **[v1][P0]** Katmanlı kalabalık: Taban uğultu (loop), ritmik tezahürat, tepki katmanı (oh, ah, alkış, ıslık) ve gol patlaması olmak üzere 4 katman. Her katman ayrı şiddetle karışır.
13. **[v1][P0]** Kapasiteye göre ölçek: Kalabalık ses yüksekliği ve yoğunluğu stadyumdaki gerçek seyirci sayısına bağlıdır. 2.000 kişilik alt lig maçı ile 70.000 kişilik final belirgin biçimde farklı duyulur (en az 3 farklı uğultu örneği).
14. **[v1][P0]** Skora duyarlı ambiyans: Gerideyken taban uğultu gerginleşir (alçak frekans katmanı +3 dB), önde iken tezahürat sıklığı artar, son 5 dakikada yoğunluk yükselir.
15. **[v1][P1]** An öncesi gerilim: Top kahramana geldiğinde kalabalık 400 ms içinde "nefesini tutar" (−8 dB filtre). Şut sonucuna göre patlama veya "ahh" tepkisi gelir. Bullet-time sesi bu filtreyle bütünleşir.
16. **[v1][P1]** Ev sahibi ve deplasman farkı: Deplasmanda bizim golümüzde yalnızca küçük deplasman tribünü sevinir, ana kalabalık susar. Bu fark bilinçli olarak duyulur.
17. **[v1][P1]** Islık ve yuhalama: Kötü form, provokatif kutlama veya eski kulübe dönüşte oyuncu topa dokununca ıslık katmanı devreye girer. Taraftar ilişkisine bağlıdır.
18. **[v2][P1]** İsimli tezahürat: Şöhret 70'i geçince taraftarlar oyuncunun soyadına uygun tempolu bir tezahürat ritmi söyler. İsim seslendirilmez; ritim ve "ooo" melodisiyle temsil edilir (yerelleştirme ve TTS riskinden kaçınmak için).
19. **[v2][P2]** Yerelleştirilmiş tezahürat havuzu: Ülkeye göre farklı ritim ve melodi kalıpları (en az 4 bölgesel paket). Gerçek kulüp marşı veya telifli melodi kullanılmaz.
20. **[v1][P2]** Hava ambiyansı: Yağmurda yağmur loop'u ve çim üzerinde ıslak adımlar, rüzgârda bayrak çırpınması ve düşük frekanslı uğultu. Rüzgâr şiddeti ses yüksekliğine doğrusal yansır.
21. **[v1][P2]** Boş stadyum: Alt liglerde ve hazırlık maçlarında oyuncu ve antrenör bağırışları belirgin duyulur, yankı (reverb) artar.
22. **[v2][P2]** Gece maçı ambiyansı: Projektör vızıltısı çok düşük seviyede (−30 dB) ve daha "kapalı" bir reverb.

#### C. Maç Efektleri
23. **[v1][P0]** Vuruş ses ailesi: Hafif pas, sert pas, plase, sert şut ("whack") ve aşırtma için ayrı örnekler. Ses şiddeti topa verilen güce göre ölçeklenir. NSS 2.0'daki tatmin edici "whack" sesi referans alınır.
24. **[v1][P0]** File sesi: Top fileye çarpınca file sürtünme sesi. Sert şutta daha uzun ve gergin, plasede daha yumuşak.
25. **[v1][P0]** Direk ve üst direk: Metalik "çınlama", şiddete göre 2 seviye. Haptik Heavy ile aynı karede çalar (±1 kare).
26. **[v1][P0]** Hakem düdüğü: Kısa (faul), uzun (devre/maç sonu), üçlü (maç sonu) ve avantaj sinyali olmak üzere 4 farklı desen. Düdük asla ducking'e girmez.
27. **[v1][P1]** Kafa vuruşu: Daha tok ve kısa bir temas sesi. Top ve kafa çarpışmasının ardından kalabalık tepkisi gelir.
28. **[v1][P1]** Kaleci sesleri: Eldivenle tutma ("tok"), yumruklama ve yere düşme. Kaleci kariyerinde kurtarış sesi ayrıca vurgulanır (+2 dB).
29. **[v1][P1]** Kayarak müdahale: Çim sürtünmesi ve temas sesi. Faul olursa düdük 200–400 ms gecikmeyle gelir.
30. **[v1][P2]** Top sekmesi: Yerde sekme sesi, zemine göre değişir (kuru, ıslak, karlı).
31. **[v1][P2]** Oyuncu sesleri: Pas isteme bağırışları ("burada!" yerine sözsüz efor ve ıslık), çarpışmada efor sesi. Dil bağımsız olmaları için sözlü içerik kullanılmaz.
32. **[v2][P2]** Teknik direktör sesi: Kenardan sözsüz bağırış ve ıslık; NSS5'teki konuşma balonlarının sesli eşlikçisi.
33. **[v1][P1]** Bullet-time sesi: Zaman yavaşlayınca alçak geçiren filtre ve hafif kalp atışı katmanı. Normal hıza dönüşte 120 ms "whoosh".
34. **[v1][P2]** Ofsayt bayrağı: Yan hakem bayrağı kalkınca kısa kumaş sesi ve düdük.

#### D. Müzik
35. **[v1][P0]** Hub müziği: Ana kariyer ekranı için 3–5 dakikalık en az 2 döngü. Gün/gece ve sezon fazına (sezon başı, transfer dönemi, sezon finali) göre değişir.
36. **[v1][P0]** Maç içinde müzik varsayılan kapalı: NSS'de maçta müzik yoktu ve bu atmosferi korudu. StarPath'te maç sırasında ambiyans ön plandadır, "maç müziği" ayarı isteğe bağlı açılır.
37. **[v2][P1]** Dinamik maç müziği (isteğe bağlı): Açık olduğunda 3 yoğunluk katmanı (sakin, gerilim, son dakika) skora ve dakikaya göre crossfade yapar. Geçişler müzikal ölçü sınırında olur.
38. **[v1][P1]** Stinger'lar: Gol, Maçın Oyuncusu, seviye atlama, transfer, kupa, sözleşme imzası ve skandal için en fazla 3 sn'lik kısa müzikal imzalar. Görsel banner ile aynı karede çalar (±16 ms).
39. **[v1][P1]** Maç öncesi müzik: Maç öncesi ekranında 20–40 sn'lik yükselen bir parça. Maç başlayınca 800 ms'de kalabalığa crossfade olur.
40. **[v2][P2]** Sezon sonu teması: Ödül töreni ve yıl özeti için ayrı, duygusal bir parça.
41. **[v2][P2]** Kumarhane müziği: Lounge/caz tonlu ayrı döngü. Kumarhanede uzun süre kalındığında müzik incelir; bilinçli olarak "heyecan pompalamaz".
42. **[v2][P2]** Lüks yaşam ekranları: Yat, malikâne ve jet gibi büyük alımlarda kısa "lüks" stinger'ı.
43. **[v3][P2]** Özel besteler: Kimlik için 3–5 özgün loop, telif hakkı tamamen stüdyoya devredilir. Steam'de ayrıca soundtrack DLC olarak satılabilir.
44. **[v2][P2]** Müzik çalar: Ayarlarda açılmış parçaları seçip sıralama ve tekrar/rastgele modu.

#### E. UI ve Yaşam Sesleri
45. **[v1][P0]** Tutarlı UI ses ailesi: Tık, onay, geri, hata ve sekme geçişi tek bir ton ailesinden (Kenney Interface Sounds CC0). Her ses 150 ms'den kısadır.
46. **[v1][P1]** Para sesleri: Gelir için yükselen "jingle", gider için kısa alçalan ton. Count-up animasyonuyla senkron tıkırtı; 20'den fazla tıkta hızlanır.
47. **[v1][P1]** Olay kartı sesleri: Kart açılma, seçim ve sonuç. Riskli seçimin sonucu olumsuzsa uyarı tonu.
48. **[v1][P1]** Kumarhane sesleri: Kart karıştırma/dağıtma, rulet topu, slot makaraları ve at yarışı nal sesleri (Kenney Casino Audio CC0). Kazanç sesi kayıp sesinden abartılı tutulmaz (sorumlu oyun ilkesi).
49. **[v1][P2]** Telefon arayüzü: Mesaj bildirimi, ajan araması zil sesi ve sosyal medya bildirimi için kısa ve ayırt edilebilir sesler.
50. **[v1][P2]** Antrenman mini oyunları: Koni çarpması, hedefe isabet, başarısızlık ve yıldız kazanma sesleri. Yıldız sayısı ses perdesiyle de anlatılır (1/2/3 yıldız artan perde).

#### F. Haptik ve Erişilebilirlik
51. **[v1][P0]** Haptik-ses senkronu: Vuruş (Medium), direk (Heavy), gol (notification success) ve menü seçimi (selection) haptikleri ilgili sesle aynı karede tetiklenir. Haptik ayrı kapatılabilir.
52. **[v1][P0]** Görsel ses ipuçları: Kalabalık tepkisi, düdük ve yan hakem bayrağı için ekranda ikonlu görsel karşılık. "Ses ipuçlarını göster" ayarı, işitme engelli oyuncular için tüm kritik ses olaylarını görselleştirir.
53. **[v1][P1]** Altyazılar: Sesli içerik eklendiğinde (v3 anlatım, sözlü sahneler) altyazı varsayılan açıktır, boyutu ve arka plan opaklığı ayarlanabilir.
54. **[v1][P1]** Mono ses seçeneği: Tek kulaklı kullanıcılar için stereo panlamayı kapatma.
55. **[v1][P2]** Ani ses koruması: "Yumuşak gol patlaması" ayarı gol patlamasını 6 dB kısıtlar (sese hassas kullanıcılar ve gece oyunu için).

#### G. Lisans, Format ve Teknik Bütçe
56. **[v1][P0]** Lisans kuralı: Yalnızca Kenney (CC0), Freesound'da yalnızca CC0 filtreli kayıtlar, Sonniss GDC paketi ve Pixabay kullanılır. BY-NC ve BY-SA lisanslı ses projeye giremez. Her ses `assets/LICENSES.csv` dosyasına kaynak URL'si ile işlenir ve CI'da lisanssız dosya build'i durdurur.
57. **[v1][P0]** Dosya formatları: Müzik OGG 96 kbps (iOS için M4A/AAC 96 kbps), efektler OGG/M4A 64 kbps mono. Toplam ses bütçesi v1'de 12 MB'ı geçmez.
58. **[v1][P1]** Ses yükleme stratejisi: UI ve maç efektleri açılışta, müzik ise akış (stream) olarak gerektiğinde yüklenir. İlk maçın sesi 1 sn içinde hazır olur.
59. **[v1][P1]** Sprite sheet ses: Kısa efektler tek bir ses atlasında (audio sprite) birleştirilir. HTTP/dosya istek sayısı 10'un altında tutulur.
60. **[v1][P2]** Ses gecikmesi testi: Vuruş girdisi ile ses arasındaki gecikme orta segment Android'de 80 ms'yi, masaüstünde 40 ms'yi geçmez.
61. **[v3][P1]** Sesli anlatım: TR ve EN için profesyonel seslendirme ile en az 400 anlatım satırı. Oyuncunun adı seslendirilmez; "golcü", "numaralı oyuncu" gibi genel ifadeler ve forma numarası kullanılır. Cinsiyete doğru satırlar ayrı kaydedilir.
62. **[v3][P2]** Anlatım yoğunluğu ayarı: "Sadece önemli anlar", "Normal" ve "Konuşkan". Aynı satır 3 maç içinde tekrar etmez.
63. **[v2][P2]** Yapay zekâ eğitimi yasağına uyum: Sonniss paketinden alınan sesler hiçbir ML eğitim veri setine konmaz. Lisans PDF'i yıl bazında arşivlenir.


### 2.9 Platform ve Teknik (PC + Mobil)

Bu bölüm, araştırma 04'teki 135 maddelik kontrol listesinin sadeleştirilmiş ve tekrarları ayıklanmış hâlidir. Tek kod tabanı (TypeScript + Vite + Phaser 4 + Preact DOM UI) ile PC (Steam), mobil (Android/iOS) ve PWA hedeflenir. Erişilebilirlik ve yerelleştirme 2.11'de; mağaza derecelendirmesi, QA süreci ve telemetri etiği 2.12'de ele alınır.

#### A. Proje Altyapısı ve Kod Düzeni
1. **[v1][P0]** Monorepo: pnpm workspaces ile `apps/web`, `apps/mobile`, `apps/desktop`, `packages/sim`, `packages/save`, `packages/i18n`, `packages/platform` yapısı kurulur; `pnpm -r build` tek komutla tüm paketleri derler.
2. **[v1][P0]** Sıkı TypeScript: `strict: true` ve `noUncheckedIndexedAccess: true` açık; CI'da `tsc --noEmit` sıfır hata vermeden PR birleşmez.
3. **[v1][P0]** Vite yapılandırması: `base: './'` (Capacitor/Electron `file://` uyumu) ve `build.target: 'es2020'`; üç platformda aynı build çıktısı açılır.
4. **[v1][P0]** Phaser sürüm sabitleme: Phaser 4 `~4.2.x` olarak kilitlenir; küçük sürüm yükseltmeleri ayrı PR'da, görsel regresyon testi geçtikten sonra alınır.
5. **[v1][P0]** Simülasyon izolasyonu: `packages/sim` içinde DOM, Phaser veya platform importu ESLint `import/no-restricted-paths` ile yasaktır; sim Node'da tarayıcısız çalışır.
6. **[v1][P0]** Platform arayüzü: haptik, IAP, başarım, bulut, paylaşım ve depolama tek `Platform` arayüzünden çağrılır; web, Capacitor ve Electron için üç uygulama bulunur, oyun kodunda `if (isAndroid)` geçmez.
7. **[v1][P1]** Derleme bayrakları: `__PLATFORM__`, `__STEAM__`, `__DEMO__` derleme zamanı sabitleriyle demo ve tam sürüm aynı koddan çıkar; ölü kod tree-shake edilir.
8. **[v1][P1]** Kaynak haritaları: source map üretilir, yayın paketine konmaz, yalnızca çökme servisine yüklenir.
9. **[v1][P1]** Lisans taraması: `license-checker` CI'da çalışır; GPL/AGPL veya NC lisanslı bağımlılık girerse build kırılır.
10. **[v1][P1]** Tek olay veriyolu: Phaser ile DOM UI arasında tipli bir event bus kullanılır; oyun durumu tek bir signals store'da tutulur, sahneler yalnızca bu store'u okur.
11. **[v2][P2]** Kaçış planı: render katmanı soyutlanır; maç sahnesi gerekirse PixiJS'e taşınabilecek biçimde sim ile render arasındaki arayüz belgelenir.

#### B. Motor, Render ve Performans
12. **[v1][P0]** Mantıksal çözünürlük: 1920×1080 tasarım alanı, Phaser Scale `FIT` + genişletilmiş alan; 21:9'da saha daha geniş görünür, HUD kenarlara sabitlenir.
13. **[v1][P0]** DPR sınırı: `devicePixelRatio` masaüstünde en fazla 2, mobil "Düşük" profilde 1–1.5 ile sınırlanır.
14. **[v1][P0]** İki modlu render: tam ekran menü açıkken Phaser döngüsü `game.loop.sleep()` ile uyutulur; menüde GPU kullanımı ölçümde maç moduna göre en az %60 düşer.
15. **[v1][P0]** Texture atlas boru hattı: tüm sprite'lar otomatik script ile 2048×2048'i aşmayan atlas sayfalarına paketlenir; tek tek PNG yüklemesi build'de uyarı verir.
16. **[v1][P0]** Nesne havuzları: partikül, top izi ve oyuncu sprite'ları havuzdan gelir; maç döngüsünde frame başına yeni dizi/obje oluşturulmaz, 90 saniyelik an boyunca GC duraksaması 8 ms'yi aşmaz.
17. **[v1][P0]** WebGL bağlam kaybı: `webglcontextlost/restored` yakalanır, dokular yeniden yüklenir; testte zorla bağlam kaybı sonrası maç kaldığı yerden sürer.
18. **[v1][P0]** Sabit adımlı simülasyon: fizik 1/60 s sabit adımla, render interpolasyonla çalışır; 30, 60, 120 ve 144 Hz ekranlarda top yörüngesi birebir aynıdır.
19. **[v1][P1]** Grafik ön ayarları: Düşük/Orta/Yüksek + ilk açılışta otomatik algılama (GPU adı ve kısa benchmark); düşük profilde blur, shine ve partikül yoğunluğu kapatılır.
20. **[v1][P1]** Sıkıştırılmış doku: Phaser 4'ün KTX2/Basis desteği prototipte doğrulanır; çalışıyorsa doku belleği en az %40 azaltılır.
21. **[v1][P1]** Geliştirici overlay'i: FPS, frame süresi, JS heap ve doku belleği gösteren panel yalnızca dev build'de `F3` ile açılır.
22. **[v1][P0]** Bellek bütçesi: JS heap < 150 MB, doku belleği < 128 MB; referans düşük uçlu Android'de 3 sezonluk oturumda aşılmaz.
23. **[v1][P0]** FPS hedefi: maçta referans düşük uçlu Android'de (2 GB RAM, Mali-G52 sınıfı) en az 30 FPS sabit, orta segmentte 60 FPS; menüde 60 FPS.
24. **[v1][P1]** Pil tasarrufu modu: ayarlardan seçilince maç 30 FPS'e, menü 20 FPS'e kilitlenir; 30 dakikalık oturumda pil tüketimi normal moda göre en az %25 düşük ölçülür.
25. **[v1][P1]** Termal izleme: 10 dakikalık sürekli oynanışta frame süresi %20'den fazla artarsa otomatik olarak bir alt grafik profiline geçilir ve kullanıcıya bildirilir.

#### C. Simülasyon ve Determinizm
26. **[v1][P0]** Seed'li RNG: PCG32 veya xoshiro128** kullanılır; `rng.fork('transfer')`, `rng.fork('match:1234')` alt akışlarıyla bir sistemdeki değişiklik diğerlerinin dizisini kaydırmaz.
27. **[v1][P0]** Yasaklı API'ler: `Math.random` ve `Date.now` sim paketinde ESLint `no-restricted-properties` ile yasaktır; ihlal CI'ı kırar.
28. **[v1][P0]** RNG durumu kayıtta: tüm RNG alt akışlarının durumu kayıt dosyasına yazılır; yükleme sonrası aynı girdilerle aynı sonuç alınır.
29. **[v1][P0]** Platform bağımsız matematik: maç sonucu ve lig simülasyonunu etkileyen hesaplar sabit nokta aritmetiği veya kendi trigonometri tablolarıyla yapılır; Chrome, WebKit ve Node'da aynı seed aynı hash'i üretir.
30. **[v1][P0]** Worker'da sezon simülasyonu: toplu lig/kupa simülasyonu Web Worker'da koşar; düşük uçlu Android'de bir sezon < 2 sn sürer, UI donmaz.
31. **[v1][P0]** Golden master testi: sabit seed ile 10 sezon simüle edilir ve çıktı hash'i snapshot'la karşılaştırılır; kasıtsız değişiklik testi kırar.
32. **[v1][P1]** Özellik tabanlı testler: fast-check ile değişmezler doğrulanır (gol ≥ 0, bütçe toplamı tutarlı, yaş her sezon +1, kadro 18–40 arası).
33. **[v1][P0]** Oyun içi takvim: sim yalnızca oyun takvimini kullanır; gerçek saat ve saat dilimi sonucu etkilemez.
34. **[v1][P1]** Deterministik girdi kaydı: şut/pas girdileri `{t, dx, dy, curve}` olay olarak kaydedilir; seed + girdi ile hata raporundaki maç birebir yeniden oynatılır.
35. **[v1][P1]** Sıralı iterasyon: sim içinde `Map` ve sıralı diziler kullanılır, `Object.keys` sırasına dayanan kod lint kuralıyla işaretlenir.
36. **[v1][P0]** Veri paketi ayrımı: oyuncu/lig veritabanı ilerleme kaydından ayrı ve sürümlüdür; veri paketi güncellemesi devam eden kariyeri bozmaz.
37. **[v1][P0]** Save-scum politikası: maç anının sonucu, an başlamadan önce kayda yazılan RNG durumundan türetilir; uygulamayı kapatıp açmak sonucu değiştirmez, ama oyuncunun girdisi sonucu değiştirir (NSS'deki "kapat-aç" istismarı kapanır).

#### D. Kayıt Sistemi
38. **[v1][P0]** SaveStore arayüzü: `list/read/writeAtomic/remove`; web'de IndexedDB, mobilde Capacitor Filesystem, masaüstünde Node `fs` adaptörü.
39. **[v1][P0]** Mobilde dosya sistemi: Android/iOS'ta kariyer kaydı IndexedDB'de değil `Directory.Data`/Library içinde tutulur; WebView deposu silinse de kayıt kalır.
40. **[v1][P0]** Kayıt zarfı: `magic "SPF1", schemaVersion, gameVersion, createdAt, updatedAt, platform, seed, checksum (SHA-256), payload`.
41. **[v1][P0]** Atomik yazma: `slot.tmp` yaz → `fsync` → geri okuyup checksum doğrula → `rename`; yazma ortasında güç kesintisi testinde son sağlam kayıt korunur.
42. **[v1][P0]** Rotasyonlu yedek: her başarılı yazmada `bak1→bak2→bak3` döner; ayrıca her sezon başında 3 adet kilometre taşı yedeği ayrı tutulur.
43. **[v1][P0]** Otomatik kurtarma: yüklemede checksum hatalıysa sırayla bak1, bak2, bak3 denenir; kullanıcıya "Son sağlam yedek yüklendi (tarih)" mesajı gösterilir.
44. **[v1][P0]** Yazma kuyruğu: tek mutex ile aynı anda iki yazma olamaz; hızlı ardışık kayıtlar birleştirilir.
45. **[v1][P0]** Otomatik kayıt anları: maç sonu, gün geçişi, ekran değişimi ve uygulama arka plana geçişi (`visibilitychange`, `appStateChange`, `before-quit`); arka plan yazması önceden serileştirilmiş veriyle 500 ms altında biter.
46. **[v1][P0]** Disk dolu yönetimi: `QuotaExceededError`/ENOSPC yakalanır, eski kayıt asla önce silinmez, kullanıcıya yer açma uyarısı çıkar.
47. **[v1][P0]** Şema migrasyon zinciri: `migrations[v]` ile v→v+1→…→güncel; her şema sürümü için fixture kayıt depoda tutulur ve CI'da hepsi güncel sürüme taşınıp doğrulanır.
48. **[v1][P0]** Migrasyon öncesi kopya: taşıma yapılmadan önce `pre-migration-vN.bak` alınır; migrasyon hatasında otomatik geri dönülür.
49. **[v1][P0]** İleri uyumsuzluk koruması: daha yeni sürümün kaydı eski istemcide açılırsa "Lütfen oyunu güncelleyin" uyarısı çıkar, dosyaya asla yazılmaz.
50. **[v1][P0]** Dışa/içe aktarma: kayıt tek dosya olarak paylaşım sayfası (mobil) veya dosya diyaloğu (PC) ile dışarı alınır ve başka cihazda içe aktarılır.
51. **[v1][P1]** Sıkıştırma ve doğrulama: payload gzip (CompressionStream/fflate) ile sıkıştırılır, yüklemede Zod/Valibot şemasıyla doğrulanır; tipik kariyer kaydı < 2 MB.
52. **[v1][P1]** Meta dosyası: slot listesi için oyuncu adı, kulüp, sezon, oynama süresi ve küçük resim ayrı dosyada tutulur; slot ekranı tam kaydı açmadan 200 ms'de dolar.
53. **[v1][P1]** Fuzz testi: CI'da rastgele bayt çevrilmiş kayıtlar yüklenir; her durumda yedekten kurtarma ya da anlamlı hata mesajı beklenir, çökme kabul edilmez.
54. **[v1][P1]** Ayarlar ayrımı: tercih ayarları `@capacitor/preferences`/ayrı dosyada; ayar bozulması kariyer kaydını etkilemez.
55. **[v1][P1]** Web kalıcılığı: PWA'da `navigator.storage.persist()` çağrılır; izin verilmezse kullanıcıya "tarayıcı kaydı silebilir, dışa aktarın" uyarısı gösterilir.
56. **[v1][P1]** Anonim kayıt hata raporu: kayıt hata kodu, şema sürümü ve dosya hash'i (içerik değil) çökme servisine gönderilir.

#### E. Bulut Kayıt
57. **[v1][P0]** Steam Auto-Cloud: Windows `%APPDATA%`, macOS `Application Support`, Linux `~/.local/share` kayıt klasörleri Steamworks panelinde tanımlanır; iki PC arasında kariyer taşınması test edilir.
58. **[v2][P1]** iCloud senkronu: iOS/macOS'ta CloudKit veya iCloud Documents ile kayıt eşitlenir.
59. **[v2][P1]** Google Play Games Services v2 Saved Games: Android'de Snapshots API ile bulut kayıt; gerekirse küçük özel Capacitor eklentisi yazılır.
60. **[v1][P0]** Çakışma ekranı: yerel ve bulut kaydı farklıysa "Bu cihaz: 12. sezon, 41 saat / Bulut: 11. sezon, 38 saat" gösterilir, kullanıcı seçer; sessiz üzerine yazma yoktur.
61. **[v3][P2]** Çapraz platform bulut: PC ↔ mobil kariyer aktarımı için isteğe bağlı hesaplı backend (2.10'daki hesap modeline bağlı); hesap silme yolu zorunlu.

#### F. Mobil (Capacitor)
62. **[v1][P0]** Capacitor 8 temel ayarları: Android minSdk 24, compile/targetSdk 36; iOS dağıtım hedefi 15.0.
63. **[v1][P0]** Apple SDK şartı: 28 Nisan 2026'dan itibaren tüm iOS build'leri Xcode 26 / iOS 26 SDK ile derlenir; CI macOS runner'ı buna sabitlenir.
64. **[v1][P0]** Play hedef API: 31 Ağustos 2026 şartına uygun olarak API 36 hedeflenir; uzatma tarihine (1 Kasım 2026) güvenilmez.
65. **[v1][P0]** Play Billing Library 8: IAP eklentisinin (RevenueCat veya CdvPurchase v13+) PBL 8 kullandığı doğrulanır; PBL 7 ile build gönderilmez.
66. **[v1][P0]** Edge-to-edge: Android 15/16'da opt-out olmadığı için status/navigation bar inset'leri CSS `env(safe-area-inset-*)` ve Phaser kamerasına aktarılır; çentikli, delikli ve gesture bar'lı cihazlarda HUD kesilmez.
67. **[v1][P0]** Büyük ekran yönlendirmesi: Android 16'da ≥600dp ekranlarda yönlendirme kilidi yok sayıldığı için maç sahnesi dikeyde letterbox ile oynanabilir, menüler dikey ve yatayda duyarlıdır.
68. **[v1][P1]** Telefonlarda yatay kilit: `@capacitor/screen-orientation` ile yalnızca maç sahnesinde yatay kilit; menüye dönünce kilit kalkar.
69. **[v1][P0]** WKWebView süreç sonlanması: iOS beyaz ekranında `visibilitychange` ile alınmış son durumdan otomatik kurtarma yapılır, oyuncu en fazla son ekranı kaybeder.
70. **[v1][P0]** Ses oturumu: iOS sessiz anahtarına ve audio session kategorisine uyulur; arka plana geçince AudioContext askıya alınır, dönünce ilk dokunuşta açılır.
71. **[v1][P0]** Tam çevrimdışı: tüm asset'ler `webDir` içinde paketlenir; uçak modunda yeni kariyer → ilk maç → kayıt akışı sorunsuz çalışır.
72. **[v1][P0]** Soğuk açılış: orta segment Android'de < 3 sn, düşük uçlu referans cihazda < 5 sn ana menüye ulaşılır.
73. **[v1][P0]** Paket boyutu: Android AAB indirmesi < 40 MB, iOS < 60 MB; müzik OGG/M4A 96 kbps, efektler 64 kbps, görseller WebP/AVIF, fontlar Latin + Türkçe alt kümeli.
74. **[v1][P1]** Phaser özel build: kullanılmayan fizik motorları (Matter.js) ve eklentiler çıkarılır; bundle boyutu CI'da raporlanır, %10'dan fazla artış uyarı verir.
75. **[v1][P1]** Splash ve ikonlar: `@capacitor/assets` ile adaptive icon, iOS tüm boyutlar ve koyu tema splash üretilir.
76. **[v1][P0]** Android geri tuşu: predictive back dahil sistem geri hareketi menü yığınında bir adım geri gider; maçta duraklatma menüsünü açar, uygulamayı kapatmaz.
77. **[v1][P0]** Otomatik duraklatma: telefon çağrısı, bildirim perdesi veya arka plana geçişte maç anında oyun anında durur.
78. **[v1][P1]** Dokunma davranışı: uzun basma metin seçimi, büyüteç, bağlam menüsü ve çift dokunma zoom'u CSS ile kapatılır (`user-select:none`, `touch-action:none`).
79. **[v1][P1]** Haptik: `@capacitor/haptics` ile vuruş (Medium), direk (Heavy), gol (success), menü (selection); ayarlardan kapatılır, iOS sistem ayarına uyulur.
80. **[v1][P1]** Minimum WebView kontrolü: Android System WebView sürümü belirlenen Chromium sürümünün altındaysa güncelleme bağlantılı uyarı gösterilir.
81. **[v1][P2]** Yerel bildirim: `@capacitor/local-notifications` yalnızca opt-in, haftada en fazla 2 "maç günü" hatırlatması.
82. **[v1][P0]** Satın alma geri yükleme: StoreKit 2 `Transaction.currentEntitlements` ve PBL `queryPurchasesAsync` ile non-consumable tam sürüm kilidi geri yüklenir; "Satın Alımları Geri Yükle" butonu ayarlar ve mağaza ekranında bulunur.
83. **[v1][P0]** Çevrimdışı kilit durumu: doğrulanmış satın alma yerel olarak önbelleklenir; internetsiz açılışta tam sürüm kilitli görünmez.
84. **[v1][P1]** Privacy Manifest: `PrivacyInfo.xcprivacy` ve required-reason API beyanları (UserDefaults, dosya zaman damgası, disk alanı) Capacitor eklentilerinin manifestleriyle birleştirilerek kontrol edilir.
85. **[v1][P1]** Takipsiz mimari: IDFA ve uygulamalar arası takip kullanılmaz, ATT istemi gerekmez.

#### G. Masaüstü (Electron + Steam)
86. **[v1][P0]** Electron güvenliği: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, IPC yalnızca `contextBridge` beyaz listesiyle; Electron Fuses ile RunAsNode kapalı.
87. **[v1][P0]** steamworks.js: main süreçte `init(appId)`; renderer'a yalnızca başarım, istatistik, bulut, overlay ve oyuncu adı API'leri açılır.
88. **[v1][P0]** Steam Overlay: `electronEnableSteamOverlay()` ile Windows ve Linux'ta Shift+Tab overlay'i açılır ve test edilir.
89. **[v1][P0]** Steam başarımları ve istatistikleri: ID'ler panelde tanımlanır (ör. `FIRST_HATTRICK`); toplam gol ve sezon sayısı ilerleme başarımları için istatistik olarak tutulur.
90. **[v1][P0]** DRM yok: Steam DRM wrapper kullanılmaz; oyun Steam çevrimdışı modunda tam çalışır (NSS5'in DRM şikâyetine doğrudan yanıt).
91. **[v1][P1]** Steam dışı başlatma: `restartAppIfNecessary` ile Steam'den başlatılmadıysa Steam üzerinden yeniden açılır; itch/GOG build'inde bu çağrı derlemeden çıkar.
92. **[v1][P0]** Pencere modları: borderless (varsayılan), tam ekran, pencereli; `Alt+Enter` ve `F11` geçiş yapar, pencere boyutu, konumu ve monitör seçimi kaydedilir.
93. **[v1][P0]** En-boy testleri: 16:9, 16:10, 21:9, 32:9 ve 1280×800'de tüm ekranlar test edilir; ultrawide'da menü içeriği ortada maksimum genişlikte sütunla sınırlanır.
94. **[v1][P0]** Steam Deck Verified: tam kontrolcü gezintisi, 1280×800'de en küçük metin ≥ 12 px, isim girişinde `ShowGamepadTextInput` sanal klavyesi, varsayılan kontrolcü şablonu.
95. **[v1][P0]** Gamepad desteği: Gamepad API standard mapping ile Xbox, PlayStation, Switch Pro ve Deck test edilir; ölü bölge ayarlanabilir, buton ikonları aktif cihaza göre değişir.
96. **[v1][P1]** Gamepad titreşimi: `vibrationActuator.playEffect('dual-rumble')` ile gol ve direkte titreşim; ayardan kapatılır.
97. **[v1][P0]** Klavye/fare: fareyle sürükle-bırak şut ve klavye alternatifi (güç çubuğu + yön); tüm menüler Tab/ok/Enter/Esc ile gezilir, odak halkası görünür.
98. **[v1][P0]** Windows kod imzalama: Azure Trusted Signing veya EV sertifikayla imzalanır; SmartScreen uyarısı çıkmaz.
99. **[v1][P0]** macOS imzalama: hardened runtime + `notarytool` notarization; Apple Silicon yerel (arm64) ve x64 build'leri ayrı ya da universal.
100. **[v1][P1]** Linux: Steam Linux Runtime (sniper) altında test; eski glibc uyumu için ubuntu-22.04 üzerinde derleme.
101. **[v2][P2]** Tauri 2 ikincil build: overlay gerekmeyen itch.io/GOG sürümü için Tauri 2 paketi (~5–15 MB); Linux WebKitGTK WebGL performansı ayrıca doğrulanmadan yayınlanmaz.
102. **[v1][P1]** Yüksek yenileme hızı: 120/144/240 Hz monitörlerde sim hızı değişmez, render interpolasyonu akıcıdır; testte top yörüngesi 60 Hz ile birebir eşleşir.

#### H. PWA / Web
103. **[v1][P1]** Workbox service worker: tüm asset'ler precache edilir; ilk yüklemeden sonra web sürümü çevrimdışı açılır.
104. **[v1][P1]** Güncelleme bildirimi: yeni sürüm hazır olunca "Güncelleme hazır, menüye dönünce yüklenecek" gösterilir; maç ortasında zorla yenileme yapılmaz.
105. **[v1][P2]** Web demo: PWA, ilk sezonla sınırlı demo olarak Cloudflare Pages/itch.io'da yayınlanır; demo kaydı tam sürüme dışa aktarılabilir.
106. **[v1][P1]** Lighthouse PWA bütçesi: Lighthouse CI'da Performance ≥ 85 ve PWA kontrolleri geçer.

#### I. Çökme Raporlama ve Analitik (Teknik Uygulama)
107. **[v1][P0]** Çökme raporlama: Sentry veya kendi barındırılan GlitchTip; web, Capacitor ve Electron SDK'ları, `sendDefaultPii: false`, IP saklanmaz, source map yüklenir.
108. **[v1][P1]** Opt-in analitik: Aptabase veya kendi barındırılan PostHog anonim modda; ilk açılışta açık onay ekranı, reddedilirse hiçbir olay gönderilmez.
109. **[v1][P1]** Çevrimdışı olay kuyruğu: analitik ve çökme olayları çevrimdışıyken en fazla 500 olay/1 MB kuyruğa alınır, bağlantı gelince gönderilir.
110. **[v1][P1]** Minimal olay seti: oturum başlangıcı, öğretici adımları, sezon ilerlemesi, maç süresi, kayıt hata kodu, kilit açma; kişisel veri ve serbest metin yok (etik çerçeve 2.12'de).
111. **[v1][P0]** Gizlilik metinleri: TR/EN gizlilik politikası ve KVKK aydınlatma metni hem mağaza sayfasında hem oyun içi ayarlarda; veri silme talebi için e-posta adresi.

#### J. CI/CD ve Otomatik Test
112. **[v1][P0]** PR hattı: her PR'da lint, typecheck, Vitest (coverage raporlu) ve Playwright E2E (Chromium + WebKit + mobil viewport) çalışır.
113. **[v1][P0]** E2E temel akış: "yeni kariyer → ilk maç → kaydet → uygulamayı kapat → yükle" Playwright'ta her PR'da yeşil olmak zorundadır; çevrimdışı varyantı `context.setOffline(true)` ile koşar.
114. **[v1][P1]** Görsel regresyon: `?testMode=1` ile animasyonlar sabitlenir, deterministik seed ile 20 kritik ekranın ekran görüntüsü karşılaştırılır.
115. **[v1][P0]** Android hattı: JDK 21 + SDK 36, `cap sync`, `bundleRelease`, keystore GitHub Secrets'tan; Fastlane supply ile Play internal track'e otomatik yükleme.
116. **[v1][P0]** iOS hattı: macOS runner (Xcode 26), Fastlane match (şifreli sertifika reposu) + gym + pilot ile TestFlight; App Store Connect API anahtarı.
117. **[v1][P0]** Masaüstü hattı: electron-builder ile Windows (NSIS/zip), macOS (imzalı + notarized), Linux (AppImage + Steam dizini).
118. **[v1][P0]** Steam dağıtımı: `steamcmd`/steam-deploy ile beta branch'e otomatik yükleme; default branch'e geçiş yalnızca manuel onayla.
119. **[v1][P1]** PR önizlemesi: her PR için web build önizleme URL'si üretilir; tasarımcı ve QA tarayıcıdan test eder.
120. **[v1][P1]** Sürümleme: Changesets veya semantic-release; `versionCode`/`CFBundleVersion` otomatik artar, etiket (tag) sürüm hattını tetikler.
121. **[v1][P0]** Gizli anahtar güvenliği: imzalama anahtarları yalnızca `environment: production` korumalı ortamda; upload keystore yedeği güvenli kasada, Play App Signing etkin.
122. **[v1][P1]** Önbellekler: pnpm, Gradle ve CocoaPods önbellekleri ile tam matris build süresi 25 dakikanın altında tutulur.
123. **[v1][P1]** Performans bütçesi kontrolü: bundle boyutu, AAB/IPA boyutu ve sim süresi (1 sezon) CI'da ölçülür; bütçe aşımı PR'ı işaretler.
124. **[v1][P1]** Gerçek cihaz matrisi: en az 1 düşük uçlu Android (Redmi 9A sınıfı), 1 eski iPhone (iOS 15), 1 tablet, Steam Deck, 1 Mac, 1 Windows dizüstü; her sürüm adayında elle duman testi.
125. **[v2][P2]** Bulut cihaz testi: Firebase Test Lab veya BrowserStack App Automate ile 10+ düşük uçlu Android modelinde otomatik açılış ve maç testi.

#### K. Monetizasyonun Teknik Güvenceleri
126. **[v1][P0]** Kozmetik izolasyonu: kozmetik ID'ler `packages/sim`'e hiç girmez; tip sistemi ve bir birim testi kozmetiğin istatistik etkisinin sıfır olduğunu doğrular.
127. **[v1][P0]** Deneme → tam sürüm: deneme kaydı tam sürüm satın alındığında aynı slottan kesintisiz devam eder; satın alma sonrası yeniden başlatma gerekmez.
128. **[v1][P0]** Tasarım kuralı belgesi: "lootbox yok, enerji/zaman kapısı yok, premium para birimi yok" kuralı repo içinde ADR olarak belgelenir; ihlal eden PR inceleme kontrol listesinde reddedilir.
129. **[v1][P1]** Bölgesel fiyat katmanları: Steam, Play ve App Store fiyat katmanları bölge bazında tanımlanır (Türkiye için yerel katman kontrolü).
130. **[v1][P0]** Güncelleme politikası: her güncelleme önceki tüm kayıtlarla uyumludur (fixture testi), sürüm notlarında kayıt uyumluluğu açıkça yazılır.


### 2.10 Meta, Sosyal/Online, Canlı Operasyon ve Topluluk

StarPath çevrimdışı ve tek oyunculu bir oyundur; çevrimiçi katman tamamen isteğe bağlıdır ve hiçbir çekirdek özellik internete bağlı değildir. NSS oyuncularının istediği "dünya çapında lider tablosu" ve paylaşım, Top Eleven tarzı zorunlu PvP ekonomisine dönüşmeden asenkron meydan okumalar, ghost maçlar ve paylaşılabilir anlarla sunulur.

#### A. Hesap Modeli ve Çevrimiçi Temeller
1. **[v1][P0]** Hesapsız varsayılan: oyun ilk açılışta hiçbir hesap, e-posta veya giriş istemez; tüm kariyer çevrimdışı oynanır.
2. **[v1][P0]** Platform kimliği: lider tablosu ve meydan okumalar için yalnızca Steam, Game Center veya Google Play Games kimliği kullanılır; ek şifre veya kayıt formu yoktur.
3. **[v1][P0]** Açık katılım: çevrimiçi özellikler ayarlardan "Çevrimiçi Özellikler: Kapalı/Açık" anahtarıyla açılır; kapalıyken hiçbir ağ isteği gönderilmez (ağ izlemesiyle test edilir).
4. **[v1][P1]** Takma ad: lider tablosunda platform adı yerine 3–16 karakterlik takma ad seçilebilir; küfür filtresi TR/EN listeleriyle çalışır.
5. **[v2][P1]** Hesap silme: çevrimiçi profil oyun içinden ve web formundan tek adımda silinir; 30 gün içinde tüm sunucu verisi kalkar.
6. **[v1][P1]** Çevrimdışı dayanıklılık: çevrimiçi meydan okuma sonucu bağlantı yokken yerelde saklanır ve 7 gün içinde bağlantı gelince gönderilir.
7. **[v1][P1]** Sunucu kesintisi davranışı: arka uç kapalıyken meta ekranları "Şu an çevrimiçi değil" kartı gösterir; kariyer ve ana menü etkilenmez.

#### B. Liderlik Tabloları
8. **[v1][P0]** Kariyer skoru tablosu: emeklilikte hesaplanan kariyer skoru (gol, asist, kupa, ödül, sadakat ağırlıklı) küresel tabloya gönderilir; formül oyunda açıkça gösterilir.
9. **[v1][P1]** Zorluk ayrımı: Kolay, Normal, Zor ve Özel ayarlı kariyerler ayrı tablolarda; Özel ayarlı kariyer küresel tabloya girmez.
10. **[v1][P1]** Sezon tabloları: "tek sezonda en çok gol", "en çok asist", "en yüksek ortalama maç notu" tabloları; yalnızca belirli lig kademesinde ve en az 20 maçla geçerli.
11. **[v1][P1]** Pozisyon tabloları: kaleci (gol yememe serisi, kurtarış), stoper (top kapma) ve orta saha (asist) için ayrı tablolar; golcü olmayan kariyerler de görünür olur.
12. **[v1][P1]** Arkadaş tablosu: platform arkadaş listesindekilerle sınırlı tablo varsayılan sekmedir; küresel tablo ikinci sekmede.
13. **[v1][P2]** Ülke tablosu: oyuncunun seçtiği kurgusal ülke ve gerçek bölgesi (isteğe bağlı) için ayrı sıralama.
14. **[v1][P1]** Yakın çevre görünümü: oyuncunun kendi sırasının 5 üstü ve 5 altı gösterilir; "ilk 100" dışındakiler de motive olur.
15. **[v1][P0]** Modlu tablo ayrımı: veri modu veya oynanış modu yüklü kariyerler otomatik olarak "Modlu" tablosuna gider; resmi tablo yalnızca imzalı resmi veriyle oynanır.
16. **[v2][P2]** Tarihî Onur Listesi: her sezon sonunda ilk 10, tablonun "geçmiş sezonlar" arşivine kalıcı yazılır.

#### C. Haftalık ve Günlük Meydan Okumalar
17. **[v1][P0]** Haftalık senaryo: her pazartesi sunucunun yayınladığı tek seed'li senaryo herkes için aynıdır (ör. "90. dakika, 1-0 gerideyiz, 3 anın var"); skor yalnızca girdiye bağlıdır.
18. **[v1][P0]** Sabit oyuncu profili: meydan okumada herkes aynı özellik değerlerine sahip hazır bir oyuncuyla oynar; kariyerdeki gelişim avantaj sağlamaz.
19. **[v1][P0]** Deneme hakkı: haftalık senaryo sınırsız denenebilir ama tabloya yalnızca en iyi deneme yazılır; ilk denemenin ayrı "ilk deneme" tablosu vardır.
20. **[v1][P1]** Senaryo türleri: son dakika dönüşü, serbest vuruş seti (5 farklı mesafe), penaltı serisi (kaleci olarak 5 penaltı), 10 kişi savunma, kontra atak bitirme; dönüşümlü takvim.
21. **[v1][P1]** Puanlama şeffaflığı: senaryo puanı maç sonunda kalemlere ayrılır (gol +500, asist +300, kalan süre bonusu, falso/zorluk çarpanı).
22. **[v1][P1]** Çevrimdışı arşiv: geçmiş 12 haftanın senaryoları çevrimdışı tekrar oynanabilir (tabloya yazılmaz).
23. **[v1][P2]** Günlük mini meydan okuma: antrenman mini oyunlarından birinin günlük seed'li versiyonu, 60 saniyelik; ödül yalnızca kozmetik rozet.
24. **[v1][P1]** Ödül politikası: meydan okuma ödülleri yalnızca kozmetiktir (rozet, krampon rengi, kutlama); kariyere para veya özellik puanı aktarılmaz.
25. **[v1][P1]** Seri takibi: arka arkaya katılınan hafta sayısı gösterilir ama kaçırılan haftada ceza veya kayıp olmaz (FOMO'suz seri).
26. **[v2][P2]** Topluluk senaryosu haftası: ayda bir hafta, topluluk oylamasıyla seçilen senaryo yayınlanır; yazarın takma adı senaryo kartında görünür.

#### D. Ghost Maçlar
27. **[v1][P1]** Ghost kaydı: her meydan okuma denemesi seed + zaman damgalı girdi günlüğü olarak saklanır (tipik boyut < 20 KB).
28. **[v1][P1]** Ghost'a karşı oyna: lider tablosundaki herhangi bir denemenin ghost'u indirilir; aynı senaryoda rakibin topu ve şutları yarı saydam izle aynı anda oynanır.
29. **[v1][P1]** Ayrık sonuç: ghost ile oyuncu birbirini fiziksel olarak etkilemez; iki deneme yan yana skorlanır, kazanan ekranda gösterilir.
30. **[v2][P1]** Arkadaş ghost'u: arkadaşın en iyi denemesi otomatik rakip olarak önerilir; "Arda'nın skorunu 1.240 puanla geçtin" bildirimi (yalnızca oyun içi).
31. **[v2][P2]** Geliştirici ghost'u: her senaryoda ekipten bir "hedef ghost" bulunur; yeni oyuncuya ulaşılabilir hedef verir.
32. **[v1][P1]** Ghost oynatma görünümü: ghost yalnızca izlenebilir; 0.5x, 1x, 2x hız ve zaman çizelgesinde ileri-geri sarma vardır.
33. **[v2][P2]** Asenkron düello: iki oyuncu aynı seed'li 3 senaryoluk seriyi 48 saat içinde oynar; sonuç iki tarafa da bildirilir, gerçek zamanlı ağ gerekmez.

#### E. Highlight Klipleri, Fotoğraf Modu ve Paylaşım
34. **[v1][P0]** Deterministik tekrar: her gol anı seed + girdi kaydıyla saklanır; tekrar video kaydı tutmadan motorla yeniden oynatılır.
35. **[v1][P1]** Klip dışa aktarma: tekrar 16:9 ve 9:16 (dikey) formatta WebM/MP4 olarak dışa aktarılır; mobilde 720p 30 FPS, PC'de 1080p 60 FPS, klip ≤ 15 sn.
36. **[v1][P1]** GIF seçeneği: 6 saniyelik, 480 px genişlikte, < 8 MB GIF dışa aktarma.
37. **[v1][P1]** Filigran: klipte köşede küçük StarPath logosu ve oyuncunun takma adı; tam sürümde filigran kapatılabilir.
38. **[v1][P1]** Kamera seçimi: dışa aktarmadan önce tekrar için 3 kamera (yayın, arka kale, oyuncu takibi) ve ağır çekim aralığı seçilir.
39. **[v1][P1]** Skor bilgisi katmanı: klipte dakika, skor, golcü adı ve "Sezonun 23. golü" gibi bilgi bandı isteğe bağlı eklenir.
40. **[v1][P0]** Sistem paylaşım sayfası: klip mobilde `@capacitor/share`, PC'de dosya kaydetme ve klasörü açma ile paylaşılır; oyun hiçbir sosyal ağ hesabına bağlanmaz.
41. **[v1][P1]** Telifsiz ses: dışa aktarılan klipte yalnızca lisanslı oyun sesleri ve kendi müziğimiz bulunur; streamer modu açıkken müzik çıkarılır.
42. **[v1][P1]** Gol defteri: kariyer boyunca seçilen en fazla 100 gol "Gol Arşivi"nde saklanır, istenildiğinde tekrar izlenir ve dışa aktarılır.
43. **[v2][P1]** Fotoğraf modu: maç duraklatıldığında serbest kamera (pan, zoom, yükseklik), 6 filtre (yayın, retro, siyah-beyaz, gazete duotone vb.), HUD gizleme, 4K'ya kadar PNG (PC).
44. **[v2][P2]** Fotoğraf modunda poz: gol kutlaması anında karakter pozu seçimi (kollar açık, diz kayması vb.) ve çerçeve şablonları (gazete manşeti, oyuncu kartı).
45. **[v1][P1]** Paylaşılabilir oyuncu kartı: oyuncunun sezon kartı (nadirlik çerçeveli, statlar, kulüp arması) PNG olarak 1080×1350 dışa aktarılır.
46. **[v1][P1]** Maç sonu paylaşım görseli: skor, maç notu, Star Man ve ısı haritası içeren tek görsel; tek dokunuşla paylaşım sayfası.
47. **[v2][P2]** Gazete manşeti üreticisi: oyunun prosedürel gazete sayfası kullanıcının kariyer olayından PNG olarak dışa aktarılır.

#### F. Sezon Özeti ve Kariyer Hikâyesi
48. **[v1][P1]** "Sezon Özeti" kartları: sezon sonunda 6–8 kartlık kaydırmalı özet (gol, asist, en iyi maç, en uzun gol, en çok pas verdiğin takım arkadaşı, en çok harcadığın kategori).
49. **[v1][P1]** Kart başına paylaşım: her özet kartı 9:16 görsel olarak ayrı ayrı dışa aktarılır.
50. **[v2][P1]** Kariyer belgeseli: emeklilikte kariyerin en iyi 10 anı ve dönüm noktaları otomatik sıralanır, 60–90 sn'lik video olarak dışa aktarılır.
51. **[v2][P2]** Kariyer zaman çizelgesi paylaşımı: kulüpler, kupalar ve ödüllerden oluşan yatay zaman çizelgesi tek uzun görsel olarak dışa aktarılır.
52. **[v1][P2]** Karşılaştırmalı istatistik: "Bu sezon oyuncuların %12'sinden fazla gol attın" bilgisi yalnızca çevrimiçi özellik açıksa, anonim toplu veriden gösterilir.

#### G. Kariyer Paylaşım Kodu ve Senaryolar
53. **[v1][P1]** Kariyer kodu: dünya seed'i, başlangıç ülkesi, mevki, zorluk ve özel ayarlar 12 karakterlik kodla paylaşılır; aynı kodla başlayan iki oyuncu aynı dünyada başlar.
54. **[v1][P1]** Kod doğrulama: kod oyun sürümünü ve veri paketi sürümünü içerir; uyumsuz sürümde "Bu kod 1.2 verisiyle üretildi" uyarısı çıkar.
55. **[v2][P1]** Senaryo başlangıçları: "35 yaşında son sezon", "küme düşmüş kulübün kaptanı", "sakatlıktan dönüş" gibi hazır başlangıçlar; topluluk kendi başlangıcını kodla paylaşabilir.
56. **[v2][P2]** Meydan okuma kuralları (ironman): "transfer yok, tek kulüp", "lüks harcama yok" gibi kurallı kariyerler; kural ihlali olursa rozet kaybedilir.
57. **[v2][P2]** Kariyer karşılaştırma: aynı kodla başlayan iki oyuncunun 5. sezon sonundaki durumları yan yana karşılaştırılır (arkadaş tablosu).

#### H. Mod Desteği
58. **[v1][P1]** JSON veri paketleri: lig, kulüp, oyuncu adları, renkler ve stadyumlar şema doğrulamalı JSON paketleriyle yüklenir; hatalı paket ayrıntılı hata raporuyla reddedilir.
59. **[v1][P1]** Oyun içi veri editörü: kulüp adı, kısaltma, renk, arma parametreleri ve oyuncu adları oyun içinden düzenlenir ve paket olarak kaydedilir.
60. **[v1][P0]** Mod güvenliği: modlar yalnızca veri içerir (JSON, PNG, OGG); çalıştırılabilir kod yüklenmez, dosya boyutu ve görsel boyutu sınırlandırılır.
61. **[v1][P1]** Mod klasörü: PC'de `userData/mods`, mobilde içe aktarma ile dosya seçimi; yüklü modlar ana menüde listelenir ve tek tek kapatılabilir.
62. **[v1][P0]** Kayıtta mod imzası: kariyer kaydı kullanılan modların kimlik ve sürümünü saklar; mod eksikse yükleme öncesi uyarı verilir.
63. **[v2][P1]** Olay paketi formatı: topluluk karar kartı yazabilir (`id, koşullar, ağırlık, metin, seçenekler, sonuçlar`); paket şema ve sınır kontrolünden geçer (ör. tek seçenek en fazla ±20 ilişki).
64. **[v2][P1]** Olay paketi test aracı: yazar, olayı belirli koşullarla anında tetikleyen "test modu"nu kullanır; zincir olay bayrakları ekranda izlenir.
65. **[v2][P2]** Yerelleştirme paketi: topluluk çevirisi mod olarak yüklenebilir; resmi çevirilere aday çeviriler Weblate üzerinden gelir.
66. **[v3][P1]** Steam Workshop: veri, olay, forma/arma ve senaryo paketleri Workshop'tan abone olunarak yüklenir; abone olunan içerik otomatik güncellenir.
67. **[v3][P2]** Mobil mod tarayıcı: onaylı topluluk paketleri için oyun içi küratörlü liste; Apple/Google kurallarına uygun olarak yalnızca veri paketleri.
68. **[v2][P1]** Mod içerik kuralları: gerçek kulüp/oyuncu adı içeren paketlerin resmi kanallarda dağıtımı yapılmaz; sorumluluk reddi ve kaldırma süreci 2.12'deki hukuki çerçeveye bağlıdır.
69. **[v3][P2]** Mod araç takımı: arma, forma ve stadyum üreticilerinin bağımsız web sürümü; çıktı doğrudan paket olarak indirilir.

#### I. Canlı Operasyon ve İçerik Takvimi
70. **[v1][P0]** Ücretsiz içerik sözü: tam sürüm sahiplerine çıkış sonrası ilk 12 ayda en az 4 ücretsiz içerik güncellemesi yapılacağı yol haritasında açıkça yazılır.
71. **[v1][P1]** Sezonluk güncelleme: her gerçek futbol sezonu başında kurgusal veri tazelemesi (yeni genç oyuncular, kulüp renk varyasyonları, yeni sezon formaları).
72. **[v1][P0]** Sezon kartı (battle pass) yok: ücretli sezon kartı yoktur; varsa kozmetik ilerleme yolu tamamen ücretsizdir ve süresi dolan ödül yoktur.
73. **[v1][P1]** Etkinlik takvimi: büyük turnuva dönemlerine denk gelen kurgusal etkinlikler ("Kıtalar Kupası haftası" senaryoları); gerçek turnuva adı ve logosu kullanılmaz.
74. **[v1][P1]** Etkinliklerin kalıcılığı: zamanlı etkinliğin içeriği bitince silinmez, arşivden çevrimdışı oynanabilir; yalnızca tablo kapanır.
75. **[v1][P1]** Uzaktan içerik paketi: yeni haftalık senaryolar ve olay kartları imzalı küçük veri paketleriyle (< 200 KB) gelir; uygulama güncellemesi gerekmez.
76. **[v1][P0]** Paket imzası: uzaktan gelen her içerik paketi Ed25519 ile imzalanır; imzası doğrulanmayan paket yüklenmez.
77. **[v2][P1]** Olay havuzu genişletmesi: her içerik güncellemesinde en az 30 yeni karar kartı ve 2 yeni zincir olay eklenir (v1'de 150+, v2'de 400+ hedefine giden yol).
78. **[v1][P1]** Özellik bayrakları: yeni çevrimiçi özellikler uzaktan bayrakla kademeli açılır (%5 → %25 → %100); sorun çıkınca istemci güncellemesi olmadan kapatılır.
79. **[v2][P2]** Topluluk hedefleri: "Bu hafta topluluk olarak 1 milyon serbest vuruş golü" gibi toplu hedef; ulaşılırsa herkese kozmetik ödül.
80. **[v1][P1]** Sıcak düzeltme süreci: veri hatası (yanlış fikstür, eksik kupa) uzaktan veri paketiyle 48 saat içinde düzeltilir; NSS'deki "yıllarca düzelmeyen fikstür hatası" tekrarlanmaz.
81. **[v2][P2]** Mevsimsel kozmetikler: kış, yaz ve sezon finali temalı ücretsiz menü temaları ve forma desenleri.

#### J. Bildirimler ve Geri Dönüş
82. **[v1][P0]** Opt-in bildirim: bildirim izni ilk açılışta değil, oyuncu ilk haftalık meydan okumayı bitirdikten sonra gerekçesiyle istenir.
83. **[v1][P0]** Bildirim sınırı: haftada en fazla 2 bildirim (yeni haftalık senaryo, arkadaş rekoru); "enerjin doldu" tipi baskı bildirimi yoktur.
84. **[v1][P1]** Bildirim kategorileri: meydan okuma, arkadaş, güncelleme ayrı ayrı kapatılır; varsayılanlar ayarlarda açıkça görünür.
85. **[v1][P1]** Sessiz saatler: yerel saatle 22:00–09:00 arası bildirim gönderilmez.
86. **[v1][P0]** Dönüş cezası yok: oyuna uzun süre girmemek kariyerde hiçbir kayıp yaratmaz (yetenek erimesi veya ilişki düşüşü gerçek zamana bağlı değildir).
87. **[v1][P2]** Dönüş özeti: 14 günden uzun aradan sonra açılışta "Son kaldığın yer" kartı (kulüp, sezon, sıradaki maç, açık hedefler) gösterilir.

#### K. Topluluk ve Geri Bildirim
88. **[v1][P0]** Oyun içi geri bildirim: ayarlarda "Hata bildir" formu; isteğe bağlı olarak kayıt dosyası, cihaz bilgisi ve son 3 maçın seed/girdi kaydı eklenir.
89. **[v1][P1]** Ekran görüntüsü ekleme: hata bildiriminde mevcut ekranın görüntüsü otomatik eklenir, gönderilmeden önce önizlenir ve kaldırılabilir.
90. **[v1][P1]** Discord sunucusu: duyuru, hata bildirimi, öneri, mod ve klip kanalları; moderasyon kuralları sabitlenmiş, çıkıştan önce kurulur.
91. **[v1][P1]** Herkese açık geri bildirim panosu: öneriler oylanır; en çok oylanan 10 öneri için her ay "durum" (planlandı/düşünülüyor/yapılmayacak + gerekçe) yazılır.
92. **[v1][P1]** Açık yol haritası: v1/v2/v3 hedefleri web sayfasında ve oyun içinde "Yol Haritası" ekranında gösterilir; tarih vaadi yerine sıra verilir.
93. **[v1][P0]** Sürüm notları: her güncellemede oyun içi "Yenilikler" ekranı; denge değişiklikleri sayılarla yazılır (ör. "Kaleci refleks gecikmesi 0.22 → 0.19 sn").
94. **[v1][P1]** Geliştirici günlüğü: ayda bir kısa geliştirici yazısı veya videosu; topluluk önerisinden gelen özellikler önerenin takma adıyla anılır (izinle).
95. **[v2][P1]** Yaratıcı programı: içerik üreticilerine erken erişim anahtarı, basın kiti (logo, kapsül görseller, klip), telifsiz müzik paketi.
96. **[v1][P1]** Streamer modu: telif riski taşıyan hiçbir içerik yoktur, ayrıca streamer modu oyuncu adını ve takma adları gizler, sohbet tarafından tetiklenebilecek kişisel veri göstermez.
97. **[v2][P2]** Twitch/YouTube entegrasyonu yerine oylama kodu: yayıncı karar kartında "sohbet oylaması" modunu açar; izleyiciler 30 sn içinde A/B yazar (yayıncının kendi bot aracıyla, oyun ağ isteği yapmaz).
98. **[v1][P1]** Beta kanalı: Steam beta branch ve Play/TestFlight açık testi; beta oyuncuları geri bildirim panosunda rozetle görünür.
99. **[v2][P2]** Topluluk turnuvası aracı: Discord yöneticisi için özel seed'li senaryo kodu üretip katılımcı skorlarını toplayan basit turnuva sayfası.
100. **[v1][P1]** Davranış kuralları: topluluk kanallarında nefret söylemi ve taciz için açık kurallar ve 3 aşamalı yaptırım; lider tablosu takma adları da aynı kurallara tabidir.

#### L. Lider Tablosu Hile Önleme (Özellik Düzeyi)
101. **[v1][P0]** Sunucu tarafından seed: haftalık senaryo seed'i yalnızca sunucudan gelir ve denemeye özgü tek kullanımlık jetonla eşleşir.
102. **[v1][P0]** Girdi günlüğü gönderimi: skor tek başına gönderilmez; seed + girdi günlüğü + istemci sürümü gönderilir.
103. **[v1][P0]** Sunucuda yeniden oynatma: deterministik sim Node'da girdi günlüğünü yeniden oynatır; çıkan skor gönderilenle eşleşmezse kayıt reddedilir.
104. **[v1][P1]** İnsan dışı girdi tespiti: frame-mükemmel tekrar eden zamanlama, insanüstü tepki süresi (< 80 ms) veya imkânsız sürükleme hızı olan denemeler incelemeye düşer.
105. **[v1][P1]** Aykırı değer tespiti: tablonun ilk %0,1'ine giren skorlar, ilk 100'e girmeden önce otomatik yeniden doğrulamadan geçer.
106. **[v1][P1]** Kariyer skoru doğrulaması: kariyer skoru gönderiminde sezon sonu özetlerinin imzalı zinciri gönderilir; zincir kopuksa skor "doğrulanmamış" etiketiyle yalnızca kişisel tabloda kalır.
107. **[v1][P1]** Sürüm eşleşmesi: yalnızca son iki istemci sürümünün skorları kabul edilir; eski sürümde "güncelleyin" uyarısı çıkar.
108. **[v1][P1]** Şikâyet butonu: tablodaki her kayıt için "şüpheli bildir"; 5 bağımsız bildirim alan kayıt yeniden doğrulanır.
109. **[v1][P1]** Şeffaf sıfırlama: hile tespiti nedeniyle silinen kayıtlar için haftalık özet yayımlanır (adlar gizli, sayı açık).
110. **[v1][P0]** Hile kariyeri etkilemez: çevrimdışı kariyerde hile veya kayıt düzenleme serbesttir; yalnızca çevrimiçi tablolar korunur (ayrıntılı risk analizi 2.12'de).

#### M. Başarımlar ve Uzun Vadeli Meta
111. **[v1][P0]** Platform başarımları: Steam, Game Center ve Play Games'te aynı başarım seti (v1'de 80+); çevrimdışıyken kazanılanlar bağlantı gelince senkronlanır.
112. **[v1][P1]** Pozisyona özel başarımlar: kaleci, defans ve orta saha kariyerleri için en az 10'ar özel başarım (ör. "Penaltı serisinde 3 kurtarış").
113. **[v1][P1]** Gizli başarımlar: hikâye zincirlerini bozmamak için 10 gizli başarım; açıklaması kazanılınca görünür.
114. **[v2][P1]** Miras meta ilerlemesi: kariyerler arası kalıcı "Onur Listesi" ve aile ağacı; yeni kariyer önceki kariyerin soyadı ve kupa müzesini görür.
115. **[v1][P1]** Oyuncu profili sayfası: toplam oynama süresi, tamamlanan kariyerler, en iyi kariyer skoru, başarım yüzdesi; çevrimdışı da görünür.
116. **[v2][P2]** Koleksiyon albümü: kariyerlerde karşılaşılan efsane rakip yıldızların kartları albümde toplanır (yalnızca kozmetik, satın alınamaz).


### 2.11 Erişilebilirlik ve Yerelleştirme

NSS'de erişilebilirlik ayarı neredeyse hiç yoktu. Kadın kariyerinde yorumcunun "he" demesi gibi yerelleştirme hataları da yıllarca düzeltilmedi. StarPath'te erişilebilirlik ve çok dillilik sonradan eklenecek bir katman olarak değil, mimari kural olarak ele alınır: DOM tabanlı arayüz, ICU mesajları ve Türkçeye duyarlı metin işleme ilk günden kurulur.

#### A. Görme ve Renk
1. **[v1][P0]** Renk körlüğü modları: Deuteranopi, protanopi ve tritanopi için ayrı durum ve takım renk paletleri sunulur. Her palet simülasyon filtresiyle test edilir; ΔE ≥ 20 olmayan renk çifti kabul edilmez.
2. **[v1][P0]** Renk dışı ipuçları: Gol, kart, sakatlık ve form gibi tüm durumlar renkle birlikte bir şekil veya ikonla da verilir (● ○ ×, ▲ ▼, çarpı ikonu). Gri tonlamalı ekran görüntüsü testinde hiçbir bilgi kaybolmaz.
3. **[v1][P0]** Takım ayrımı: Sahada takımlar yalnızca forma rengiyle ayrılmaz; desen maskesi ve isteğe bağlı A/B harf etiketi de kullanılır. Renk farkı yetersiz kaldığında (ΔE < 25) deplasman forması otomatik devreye girer.
4. **[v1][P1]** Yüksek kontrast modu: Tüm metin/zemin çiftleri ≥ 7:1 (WCAG AAA) olur, gölge ve gradient'ler kapanır, çerçeveler 2 px'e çıkar.
5. **[v1][P0]** UI ölçeği: Arayüz %80 ile %200 arasında ölçeklenir ve tüm ölçüler `rem` tabanlıdır. %200'de hiçbir ekranda yatay kaydırma ya da metin kesilmesi olmaz; bu, Playwright görsel testiyle doğrulanır.
6. **[v1][P0]** Sistem font ölçeğine uyum: Android TextZoom ve iOS Dynamic Type değerleri okunur ve oyun içi ölçekle çarpılır. Toplam ölçek %200 ile sınırlanır.
7. **[v1][P1]** Disleksi dostu font: Ayarlardan gövde fontu Atkinson Hyperlegible ya da OpenDyslexic yapılabilir (ikisi de OFL). Değişiklik yeniden başlatma gerektirmez.
8. **[v1][P1]** Minimum metin boyutu: Mobilde 12 px, Steam Deck'te (1280×800) 12 px ve masaüstünde 13 px'in altında metin yoktur. CI'daki bir stil taraması daha küçük değerleri reddeder.
9. **[v1][P1]** Maç sahnesi kontrastı: Top çevresine isteğe bağlı 2 px'lik kontur ve büyütülmüş top modu (%130) eklenir. Kahraman halkası kalınlığı 3 kademede ayarlanabilir.

#### B. Ekran Okuyucu ve Klavye
10. **[v1][P0]** Semantik HTML ve ARIA: Tüm menüler `button`, `nav`, `dialog` ve `table` gibi doğru öğelerle kurulur. İkon butonlarının `aria-label` değeri çeviri dosyasından gelir; axe-core taraması CI'da 0 kritik hata vermelidir.
11. **[v1][P0]** Maç olayları için aria-live: Gol, kart, oyuncu değişikliği ve "top sende" anları `aria-live="polite"` bölgesinde ("Dakika 67, gol, StarPath 2–1") duyurulur. Kritik anlar `assertive` önceliğiyle okunur.
12. **[v1][P0]** Odak yönetimi: Modal açıldığında odak modalın içinde tutulur (focus trap), kapanınca tetikleyen öğeye döner. Odak halkası hiçbir zaman `outline: none` ile gizlenmez.
13. **[v1][P0]** Ekran okuyucu testleri: Her sürümden önce VoiceOver (iOS), TalkBack (Android) ve NVDA (Windows Electron) ile 10 adımlık bir senaryo koşulur: yeni kariyer → antrenman → olay kararı → maç → kayıt.
14. **[v1][P1]** Grafik metin alternatifleri: Radar, sparkline ve ısı haritası için aynı veriyi veren gizli bir tablo ya da 1 cümlelik özet bulunur ("Form yükseliyor: son 5 maç ortalaması 7,3").
15. **[v1][P0]** Tam klavye erişimi: Tüm ekranlar Tab, ok tuşları, Enter ve Esc ile kullanılır. Maç anlarında klavyeyle şut yapılabilir (yön + basılı tutarak güç).
16. **[v2][P2]** Maç anı sesli tarifi: Ekran okuyucu modunda her an başlarken pozisyon tek cümleyle anlatılır ("Ceza sahası sağında, kaleci yakın direkte, 2 savunmacı"); seçenekler pas, şut ve dribling olarak sunulur.

#### C. Motor Beceri ve Kontroller
17. **[v1][P0]** Kontrol yeniden atama: Klavye, gamepad ve fare tuşlarının hepsi yeniden atanabilir. Çakışan atamalar uyarı verir; varsayılana dönme tek tıkla yapılır.
18. **[v1][P0]** Alternatif şut şeması: Swipe yerine "dokun-ve-güç çubuğu" seçilebilir: hedefe dokun, güç çubuğu salınır, ikinci dokunuşla vur. Falso için ayrı bir slider kullanılır.
19. **[v1][P0]** Sol el modu: Joystick ile aksiyon butonlarının yerleri ayna simetriyle değiştirilir ve HUD elemanları da aynalanır.
20. **[v1][P0]** Dokunma alanı ölçeği: Maç kontrollerinin dokunma alanı %100, %125, %150 ve %175 kademelerinde büyütülebilir. Menülerde minimum hedef her zaman 44×44 px'tir.
21. **[v1][P0]** Tek elle oynanış: Tek elle modda tüm kritik aksiyonlar ekranın alt %40'ına taşınır, maç anları da tek başparmakla (swipe) oynanabilir.
22. **[v1][P0]** Bullet-time süresi: Ağır çekim nişan penceresi Varsayılan (Soğukkanlılık'a bağlı), +%50, +%100 ve Sınırsız seçeneklerine sahiptir. Sınırsız seçenek leaderboard'a giren modlarda kapalıdır ve bu durum açıkça etiketlenir.
23. **[v1][P0]** Zamanlama pencereleri: Kafa vuruşu, kaleci refleksi ve penaltı gibi zamanlamalı girdilerde pencere ×1,5 ya da ×2 genişletilebilir.
24. **[v1][P1]** Yardımlı nişan: Tam yardım modunda şut yayı hedefe 8°'ye kadar mıknatıslanır, pas en yakın uygun takım arkadaşına kilitlenir. Yardım seviyesi maç sonu ekranında gösterilir.
25. **[v1][P1]** Basılı tutma yerine geçiş (toggle): Sprint ve güç doldurma için "basılı tut" yerine "bir kez bas, tekrar bas" seçeneği sunulur.
26. **[v1][P1]** Otomatik sim seçeneği: Her maç anı için "Bu anı simüle et" butonu bulunur ve sonuç oyuncunun atribütlerine göre hesaplanır. Tüm maçı simüle etme seçeneği de vardır. İkisi de ilerlemeyi kilitlemez.
27. **[v1][P2]** Gamepad ölü bölgesi: Sol ve sağ çubuk için ölü bölge %5–30 arasında ayarlanabilir, tetik eşiği de ayrıca belirlenir.
28. **[v1][P1]** Titreşim ayarı: Haptik ve gamepad titreşimi Kapalı, Hafif ve Normal seçeneklerine sahiptir ve ayrı ayrı kapatılabilir.

#### D. İşitme, Hareket ve Bilişsel Yük
29. **[v1][P0]** Görsel ses ipuçları: Düdük, ofsayt bayrağı, kalabalık patlaması ve TD bağırışı ekran kenarında ikonlu göstergeyle verilir ("🔔 Düdük"). Bu ipuçları ses kapalıyken de çalışır.
30. **[v1][P1]** Altyazı ve metin hızı: Maç anlatımı ve diyaloglar için Yavaş, Normal, Hızlı ve "dokununca ilerle" seçenekleri vardır. Altyazı boyutu ve arka plan opaklığı (%0–90) ayarlanabilir.
31. **[v1][P0]** Azaltılmış hareket: Sistemin `prefers-reduced-motion` ayarı ve oyun içi seçenek, parallax, ekran sarsıntısı, shine ve konfetiyi kapatır; geçişler crossfade olur.
32. **[v1][P0]** Flaş koruması: Gol anındaki tribün flaşları saniyede 3'ü aşmaz (WCAG 2.3.1); "Flaşları kapat" seçeneği ayrıca bulunur.
33. **[v1][P1]** Kamera sarsıntısı kaydırıcısı: Sarsıntı %0–100 aralığında ayarlanır. Varsayılan %60'tır; azaltılmış hareket modunda %0 olur.
34. **[v1][P1]** Bilişsel yük azaltma: "Sade mod"da finans, yatırım ve işletme menüleri otomatik yönetilir (sabit yatırım planı). Hub'da aynı anda en fazla 3 bekleyen karar gösterilir.
35. **[v1][P1]** Kararlarda süre baskısı yok: Olay kartlarında, sözleşme pazarlığında ve röportajda varsayılan olarak zamanlayıcı yoktur. Zamanlayıcılı mod yalnızca isteğe bağlı bir zorluk seçeneğidir.
36. **[v1][P1]** Hatırlatıcı özet: Oyun 24 saatten uzun ara verildikten sonra açıldığında "Neredeydin?" kartı son hedefi, sıradaki maçı ve bekleyen kararları tek ekranda özetler.
37. **[v1][P2]** Sesli efekt ayrımı: Ses, müzik, UI ve ambiyans için ayrı ses kaydırıcıları vardır; anlatım kanalı müzikten bağımsız ayarlanır.

#### E. Standartlar ve Süreç
38. **[v1][P0]** Kılavuz uyumu: Game Accessibility Guidelines'ın Basic maddelerinin tamamı ve Intermediate maddelerinin en az %70'i karşılanır. Kontrol listesi depoda tutulur ve her milestone'da güncellenir.
39. **[v1][P1]** Xbox Accessibility Guidelines eşlemesi: XAG 101–119 maddeleri için durum tablosu tutulur; Steam ve konsol vitrininde erişilebilirlik özellikleri listelenir.
40. **[v2][P1]** Erişilebilirlik play-test'i: Beta'da motor, görme ve işitme engelli en az 5 oyuncudan oluşan bir grupla moderasyonlu test yapılır; bulgular P0/P1 olarak backlog'a girer.
41. **[v1][P1]** Ön ayar profilleri: İlk açılışta "Erişilebilirlik ayarlarını şimdi yapmak ister misin?" kartı çıkar ve 4 ön ayar sunar: Görme, Motor, İşitme, Sade.

#### F. Yerelleştirme Altyapısı
42. **[v1][P0]** i18n çatısı: i18next + ICU MessageFormat (ya da FormatJS) kullanılır. Çoğul, cinsiyet ve `select` kalıpları ICU sözdizimindedir; kodda tek bir sabit kullanıcı metni bulunmaz (ESLint `i18next/no-literal-string`).
43. **[v1][P0]** v1 dilleri Türkçe ve İngilizce: Her iki dil %100 tamamlanmadan sürüm çıkmaz. Eksik anahtar CI'da build'i kırar.
44. **[v2][P1]** Genişleme dilleri: İspanyolca, Portekizce (BR), Almanca, Fransızca, İtalyanca ve Endonezce eklenir. Bu sıra mağaza yorumlarındaki ülke dağılımına göre belirlenmiştir.
45. **[v1][P0]** Pseudo-localization testi: `?lang=pseudo` modu her metni %40 uzatır ve aksanlı karakterle sarar ("[Ŝéçéñéķ ~~~]"). Tüm ekranlar bu modda taşmasız çalışmalıdır.
46. **[v1][P0]** Metin genişleme payı: Butonlar ve kartlar sabit genişlik kullanmaz. Almanca metnin ~%30 daha uzun olacağı varsayılarak tasarlanır ve en uzun dil ile yapılan görsel regresyon testi CI'da koşar.
47. **[v1][P0]** Metinler veri dosyasında: Tüm olay ve diyalog metinleri anahtar tabanlı JSON dosyalarında durur. 150+ olay metni için bağlam notu (kim konuşuyor, ton) çevirmene iletilir.
48. **[v2][P1]** Topluluk çevirisi: Weblate (açık kaynak) ya da Crowdin kullanılır. Çevirmen kredisi Credits ekranına otomatik eklenir; makine çevirisi taslak olarak işaretlenir.

#### G. Türkçe ve Dil Tuzakları
49. **[v1][P0]** Locale'e duyarlı büyük harf: Tüm büyük harf dönüşümleri `toLocaleUpperCase('tr-TR')` ile yapılır ve `<html lang>` dinamik olarak ayarlanır. "istanbul" → "İSTANBUL" ve "ılgaz" → "ILGAZ" için birim testi vardır.
50. **[v1][P0]** Türkçe sıralama: Lig, kadro ve arama listelerinde `Intl.Collator('tr')` kullanılır; "Çağlar" "Cem"den sonra, "Şahin" "Sezer"den sonra gelir.
51. **[v1][P0]** Ek üretici: `suffix(name, 'dative' | 'locative' | 'ablative' | 'accusative' | 'genitive')` yardımcısı ünlü uyumuna, kaynaştırma harfine ve kısaltmalara göre ek üretir ("Kartal'a", "Ege FK'ya", "Yıldızspor'dan"). 200 isimlik bir test tablosuyla doğrulanır.
52. **[v1][P0]** Eksiz kalıp tercihi: Ek üreticinin güvensiz olduğu durumlarda (sayı, yabancı isim) "Transfer: {kulüp}" gibi eksiz cümle kalıbına düşülür. Kalıp seçimi çeviri dosyasında işaretlenir.
53. **[v1][P0]** Cinsiyet ve zamir doğruluğu: Anlatım, haber ve olay metinleri oyuncunun ve partnerinin cinsiyetini ICU `select` ile kullanır. Kadın kariyerinde İngilizce metin "she/her" kullanır ve tüm metinleri tarayan bir test hiçbir "he" sızıntısı bulmamalıdır. Partner cinsiyeti oyuncudan bağımsız seçilir.
54. **[v1][P0]** Sayı, para ve tarih biçimi: `Intl.NumberFormat` ve `Intl.DateTimeFormat` kullanılır. Türkçede "₺1.250.000,00" ve "7 Ekim 2027", İngilizcede "₺1,250,000.00" biçimi uygulanır. Büyük sayılar kısaltılır ("1,2 Mn ₺" / "₺1.2M").
55. **[v1][P1]** Oyun içi para birimi: Kurgusal para birimi simgesi dilden bağımsızdır; isteğe bağlı olarak yerel para birimiyle "yaklaşık değer" gösterilir. Gerçek kur verisi çekilmez.
56. **[v1][P1]** Kültürel isim üretimi: NPC isimleri ülke bazlı isim havuzlarından üretilir (ad ve soyad ayrı, cinsiyete uygun). Havuzlar argo, hakaret ve gerçek ünlü futbolcu kombinasyonları için bir kara liste filtresinden geçer.
57. **[v1][P1]** Font glif kapsamı: Seçilen her dil için font alt kümesinin gerekli tüm glifleri içerdiği CI'da kontrol edilir (Türkçe için ğ ş ı İ ç ö ü). Eksik glif "tofu" karakteriyle görünmez, build hatası verir.
58. **[v1][P0]** Mağaza listeleri: App Store, Google Play ve Steam açıklamaları, ekran görüntüsü metinleri ve anahtar kelimeleri her dil için ayrı hazırlanır. Ekran görüntülerindeki metinler o dilin build'inden alınır.
59. **[v2][P2]** Dile özel sözlük: Futbol terimleri için onaylı bir terim listesi tutulur ("kaleci", "falso", "aşırtma"; "goalkeeper", "curl", "chip"). Çevirmenler bu listeye bağlıdır ve tutarsızlık bir QA betiğiyle yakalanır.
60. **[v3][P2]** RTL hazırlığı: Tüm düzen `margin-inline-start` gibi mantıksal CSS özellikleriyle yazılır, ikon yönleri `dir` değerine göre aynalanır. Arapça için pseudo-RTL testi v3'te yapılır.
61. **[v2][P2]** Dil bazlı anlatım tonu: Haber manşetlerinde kelime oyunları dil başına ayrı yazılır, birebir çevrilmez. Her dilde en az 30 özgün manşet şablonu bulunur.


### 2.12 "Aklına Gelmeyenler": Riskler, Hukuk, Mağaza, Pazarlama, QA ve Etik

Bu bölüm, oyunun tasarımı kadar önemli olan ama genellikle son haftaya bırakılan konuları topluyor: hukuki güvenlik, yaş derecelendirmesi, mağaza görünürlüğü, topluluk, kalite güvencesi ve etik. Yaş derecelendirmesi ve mağaza politikasıyla ilgili maddeler bu çalışmada web taraması yapılmadan, genel bilgiyle yazıldı. **Gönderimden 4–6 hafta önce resmî anketler (IARC, Apple yaş anketi, ESRB/PEGI) ve güncel politika sayfalarıyla yeniden doğrulanmalı.**

#### A. Marka, Ad ve Ticari Takdim

1. **[v1][P0]** "New Star" adı yasak: Oyun adı, alt başlık, mağaza metni, anahtar kelime alanı, dosya/paket adı (`com.*.newstar*` gibi) ve oyun içi metinlerde "New Star" ya da "NSS" geçmeyecek. CI'da metin ve manifest dosyalarında `new ?star|nss` için büyük/küçük harf duyarsız tarama çalışacak, eşleşme olursa build kırılacak.
2. **[v1][P0]** Güvenli konumlandırma dili: Mağaza ve basın metninde "NSS'nin halefi/devamı" yerine "klasik futbol kariyer simülasyonlarından ilham alan" ifadesi kullanılacak. Basın röportajında sorulursa "türü seven bir ekip olarak" çerçevesinde konuşulacak. Bu dil, pazarlama kılavuzuna yazılı kural olarak girecek.
3. **[v1][P0]** Ticari takdim (trade dress) mesafesi: NSS'nin ikonik ekran düzeni, renkleri, "NRG" kutu tasarımı, "Star Man" ve "Star Bux" adları ile Hi-Lo pazarlık görseli birebir kopyalanmayacak. Bizdeki karşılıklar: "Maçın Yıldızı", enerji içeceği yok ya da farklı adlı, pazarlık farklı mekanikle.
4. **[v1][P1]** Karşılaştırmalı reklam: Reklamlarda rakip oyun adı, logosu ve ekran görüntüsü kullanılmayacak. "Enerji duvarı yok, reklam yok" gibi kendi özelliklerimizi anlatan mesajlar yeterli.
5. **[v1][P0]** "StarPath" marka araştırması: TÜRKPATENT, EUIPO (TMview), USPTO ve WIPO Global Brand Database'de 9. (yazılım/oyun) ve 41. (eğlence hizmetleri) sınıflarda benzer marka taraması yapılacak. Sonuç ve tarih karar kaydına yazılacak.
6. **[v1][P0]** Mağaza isim çakışması kontrolü: App Store, Google Play, Steam ve itch.io'da "StarPath" ve "Star Path" aranacak. Spor ya da oyun kategorisinde çakışma varsa yedek ad (en az 3 aday) hazır tutulacak. Ad `GAME_NAME` sabitinden değiştirilebildiği için teknik maliyet düşük.
7. **[v1][P1]** Marka tescili: İsim kesinleşince en azından TR ve AB (EUIPO) başvurusu yapılacak. ABD başvurusu Steam lansmanından önce değerlendirilecek. Bütçe 3.2'de.
8. **[v1][P0]** Alan adı ve sosyal hesap rezervasyonu: `starpath` varyasyonlarıyla .com/.gg/.game alan adları ve X, TikTok, YouTube, Instagram, Reddit, Discord vanity, Steam geliştirici sayfası kullanıcı adları ad kesinleşir kesinleşmez alınacak.
9. **[v2][P2]** Logo özgünlüğü: Logo ve ikon ters görsel aramayla (Google Lens, TinEye) kontrol edilecek. Yıldız + yol motifi yaygın olduğu için belirgin benzerlik çıkarsa revize edilecek.

#### B. Gerçek Kulüp, Oyuncu, Lig ve Sponsor Adları

10. **[v1][P0]** Tamamen kurgusal dünya: Varsayılan veritabanında gerçek kulüp, oyuncu, teknik direktör, lig, kupa, stadyum, federasyon ve sponsor adı olmayacak. Ülke adları kullanılabilir, lig adları kurgusal olacak ("Anadolu Süper Ligi" gibi değil, "Birinci Kademe", "Kıyı Ligi" gibi).
11. **[v1][P0]** Turnuva adları: "Şampiyonlar Ligi", "Dünya Kupası", "Ballon d'Or", "EURO", "Copa" gibi tescilli adlar yerine "Kıta Şampiyonlar Kupası", "Dünya Turnuvası", "Altın Yıldız" kullanılacak. Kupa görselleri gerçek kupaların silüetini taklit etmeyecek.
12. **[v1][P0]** Yarı bozulmuş isim yasağı: NSS5'teki "Man U", "Chels" tarzı kısaltmalar kullanılmayacak. Bunlar hâlâ tanınabilir olduğu için hukuki koruma sağlamaz.
13. **[v1][P0]** Arma ve forma kara listesi: Prosedürel arma ve forma üreticisi, büyük kulüplerin bilinen kombinasyonlarına (renk çifti + desen + figür) karşı kara liste kontrolünden geçecek. Örneğin sarı-lacivert dikey çizgi + kanarya, kırmızı-beyaz + yıldız-hilal arması, bordo-mavi + belirli figür. Kara listedeki kombinasyon üretilirse otomatik yeniden üretilecek.
14. **[v1][P1]** Kurgusal isim üretici filtresi: Prosedürel oyuncu adı üretici, ünlü futbolcuların tam ad-soyad kombinasyonlarını üretmeyecek. 5.000 isimlik bir "ünlü isim" kara listesiyle tam eşleşme kontrolü yapılacak.
15. **[v1][P0]** Oyuncu imaj hakları: Gerçek oyuncu adı, yüzü veya istatistiği hiçbir şekilde kullanılmayacak. FIFPRO ve ulusal oyuncu birlikleri toplu imaj haklarını lisansladığı için gerçek isim kullanımı lisans gerektirir.
16. **[v1][P0]** Gerçek kişilerin yüzleri: facesjs ve avatar üreticileri gerçek kişilere benzetilmek için ön ayar içermeyecek. Kullanıcının karakteri ünlü birine benzetmesi engellenmez, ama oyun bunu teşvik eden "ünlü şablonları" sunmaz.
17. **[v1][P1]** Kurgusal sponsorlar: Sponsor markaları prosedürel olacak. Gerçek marka adları ve logolarına (spor giyim, içecek, saat) benzememesi için isim üreticide kara liste olacak.
18. **[v1][P1]** Gerçek şehir ve stadyum adları: Şehir adları serbest. Stadyum adları kurgusal olacak, gerçek stadyum isimleri ("... Arena" gibi sponsor isimleri dahil) kullanılmayacak.
19. **[v2][P1]** Gerçek ülke milli takımları: Ülke adı ve bayrak renkleri kullanılabilir. Federasyon logoları ve resmî milli forma tasarımları kullanılmayacak, milli formalar bayrak renklerinden prosedürel üretilecek.

#### C. Düzenlenebilir Veritabanı ve Mod Sorumluluğu

20. **[v2][P0]** Mod sorumluluk modeli: Oyun gerçek isim içeren veri paketi dağıtmaz, yalnızca kullanıcının kendi dosyasını yükleyebileceği editör ve JSON şeması sağlar. Bu model (FM ve PES "option file" topluluklarının çalıştığı yapı) hukuki riski kullanıcıya bırakır ama EULA'da açıkça yazılmalıdır.
21. **[v2][P0]** EULA ve kullanım şartları: Kullanıcı içeriğinin sorumluluğu, üçüncü taraf haklarını ihlal eden içeriğin yasak olduğu, bildirim üzerine kaldırma hakkımız ve mod dosyalarını ticari olarak satma yasağı EULA'da yer alacak. Metin TR ve EN olacak, avukat onayından geçecek.
22. **[v2][P0]** DMCA/kaldırma süreci: Hak sahiplerinin başvurabileceği bir e-posta adresi ve web formu olacak. 72 saat içinde ilk yanıt, geçerli taleplerde kaldırma ve kaldırılan içerik kaydı tutulacak.
23. **[v2][P1]** Steam Workshop moderasyonu: Workshop açılırsa, gerçek isim/logo içeren paketler için Steam'in kendi şikâyet mekanizmasına ek olarak önizleme görselinde logo bulunan içerikler raporlanabilir olacak. Oyun içi mod tarayıcısında "resmî olmayan içerik" etiketi gösterilecek.
24. **[v2][P1]** Mobil mod sınırı: Mobilde mod paketi içe aktarma yalnızca kullanıcının kendi dosyasıyla, mağaza içinde katalog olmadan yapılacak. Apple 2.5.2 (indirilen çalıştırılabilir kod yasağı) nedeniyle modlar yalnızca veri (JSON + görsel) olacak, kod içermeyecek.
25. **[v2][P1]** Mod içeriği filtresi: İçe aktarılan JSON'daki metinler küfür/nefret filtresinden geçmeyecek (kullanıcının kendi cihazı), ama paylaşımlı sunucu özelliklerine (lider tablosu adı, kulüp adı) gönderilirken filtrelenecek.
26. **[v2][P2]** Mod imzalama: Workshop'tan gelen veri paketleri şema doğrulamasından geçmeden yüklenmeyecek. Bozuk mod kariyer kaydını bozmasın diye mod verisi kayıttan ayrı tutulacak, kayıt yalnızca mod kimliği ve sürümünü referans alacak.

#### D. Asset, Font, Müzik ve Açık Kaynak Lisansları

27. **[v1][P0]** Lisans kaydı zorunlu: Projeye giren her asset `assets/LICENSES.csv` dosyasına yol, kaynak URL, yazar, lisans, indirme tarihi ve arşiv linkiyle girilecek. Kayıtsız asset'i tespit eden CI kontrolü (dosya listesi ↔ CSV karşılaştırması) olacak.
28. **[v1][P0]** CC BY-NC ve CC BY-SA yasağı: NC lisanslı içerik ticari oyunda kullanılamaz. SA lisansı türev asset'lere bulaşır. İkisi de projeye girmeyecek. CSV'de bu lisanslar görülürse CI hata verecek.
29. **[v1][P0]** CC BY atıfları otomatik: game-icons.net (CC BY 3.0) ve Incompetech (CC BY 4.0) atıfları build sırasında CSV'den otomatik üretilip Credits ekranına ve mağaza açıklamasındaki "Üçüncü taraf lisanslar" bağlantısına yazılacak.
30. **[v1][P0]** Sonniss lisans arşivi: Sonniss GDC paketlerinin her yılın lisans PDF'i depoda arşivlenecek. Bu seslerin yapay zekâ eğitiminde kullanılmaması ve ham dosyaların dağıtılmaması kuralı ekip kılavuzuna yazılacak.
31. **[v1][P1]** Pixabay ve itch.io kontrolü: Pixabay'deki yapay zekâ üretimi yüklemeler tek tek dinlenecek. Lisansı açıkça yazmayan itch.io paketleri kullanılmayacak.
32. **[v1][P0]** Font lisansları: Barlow Condensed, Inter ve Teko (SIL OFL 1.1) self-host edilecek ve OFL metni dağıtıma eklenecek. Font dosyası değiştirilirse (alt kümeleme hariç) yeniden adlandırma kuralı uygulanacak.
33. **[v1][P0]** Açık kaynak uyumu: `license-checker` (veya eşdeğeri) her build'de çalışacak. GPL/AGPL bağımlılık bulunursa build kırılacak. MIT, ISC ve Apache-2.0 lisans metinleri ile NOTICE dosyaları `THIRD_PARTY_LICENSES.txt` içine otomatik toplanacak.
34. **[v1][P1]** Müzik telif ve yayıncı güvenliği: Oyundaki tüm müzikler için YouTube Content ID ve Twitch DMCA riski kontrol edilecek. Content ID'ye kayıtlı parçalar (bazı stok müzik siteleri kayıt yapar) kullanılmayacak. Ayarlarda "Yayıncı modu" lisansı belirsiz her parçayı kapatacak.
35. **[v2][P1]** Özel müzik sözleşmesi: Bestecilerle yapılan sözleşmede telif devri, Content ID'ye kayıt yapmama taahhüdü ve soundtrack satış hakkı açıkça yer alacak.
36. **[v1][P1]** Yapay zekâ üretimi içerik politikası: Yapay zekâyla üretilen görsel veya ses kullanılırsa Steam'in içerik beyan formunda bildirilecek. Kaynak, araç ve hak durumu LICENSES.csv'ye yazılacak.

#### E. Kumarhane, Yaş Derecelendirmesi ve Hassas İçerik

37. **[v1][P0]** Gerçek para bağlantısı sıfır: Kumarhane yalnızca oynayarak kazanılan oyun içi parayla çalışacak. Fiş, jeton ya da oyun içi para gerçek parayla satılmayacak. Kazanç hiçbir şekilde gerçek paraya, hediye kartına veya devredilebilir öğeye çevrilemeyecek. Bu kural kodda zorlanacak: IAP katalogu ile kumarhane para birimi arasında bağlantı yok.
38. **[v1][P0]** PEGI değerlendirmesi: PEGI'nin uygulamasına göre simüle kumar içeren oyunlar genellikle en az PEGI 12 alır. Kumarı öğreten, teşvik eden ya da gerçek parayla bağlantılı içerik ise PEGI 18'e kadar çıkabilir. Hedefimiz PEGI 12. Kumarhane eğitici değil, sonuçları olan bir yaşam aktivitesi olarak sunulacak. **Kesin sınıf, gönderim öncesi güncel PEGI kriterleri ve IARC anketiyle doğrulanacak.**
39. **[v1][P0]** ESRB değerlendirmesi: Kumarhane büyük olasılıkla "Simulated Gambling" içerik tanımlayıcısı getirir ve oyunu T (Teen) bandına iter. ESRB'nin gerçek para kumarı için ayrı bir tanımlayıcısı ("Real Gambling") olduğu, bunun ise yetişkin bandına ittiği bilinmeli. Biz yalnızca simüle kumarla kalacağız. Steam ve konsol için IARC/ESRB yolu ayrıca doğrulanacak.
40. **[v1][P0]** Apple yaş anketi: Apple'ın 2026 sistemi 4+/9+/13+/16+/18+ bantlarından oluşur. Ankette "Simüle Kumar" sıklığı (Yok/Seyrek/Sık) sorulur. Sık simüle kumar yüksek banda iter. Kumarhanenin ana döngüde değil isteğe bağlı yan aktivite olması ve kariyer başına sınırlı oturum hakkı, "Seyrek" beyanını desteklemek için tasarlanacak. Hedef 13+, kesin sonuç anket sonrası belli olacak.
41. **[v1][P0]** Google Play IARC ve politika: IARC anketinde simüle kumar, alkol ve rüşvet doğru beyan edilecek. Play'in simüle kumar politikası (gerçek para kazanma ihtimali olmaması, gerçek para kumar uygulamalarına yönlendirme yapılmaması) okunup uyum kontrol listesine eklenecek. Kumarhane uygulamanın ana kategorisi değil, spor/simülasyon kategorisinde kalacak.
42. **[v1][P0]** Bölgesel kumarhane bayrağı: `FEATURE_CASINO` derleme ve uzaktan yapılandırma bayrağı olacak. Kumar temalı içeriğin kısıtlı olduğu pazarlarda (bazı Orta Doğu ve Asya ülkeleri; listeyi yayın öncesi hukuki danışmanla netleştireceğiz) kumarhane ve at yarışı bahsi devre dışı kalacak, yerine "Hipodrom sahipliği (bahissiz)" ve "Yatırım" seçenekleri gösterilecek.
43. **[v1][P0]** Oyuncu tarafı kumarhane kapatma: Ayarlarda "Kumarhane ve bahis içeriğini gizle" seçeneği olacak. Açıldığında kumarhane menüsü, kumar olayları ve kumarla ilgili manşetler oyundan çıkacak, kariyer dengesi bundan etkilenmeyecek.
44. **[v1][P1]** Türkiye hassasiyeti: Türkiye'de kumar ve şans oyunları sıkı düzenlenir, kumar teması toplumsal açıdan hassastır. TR mağaza metninde "kumarhane" yerine "eğlence mekânı" gibi örtmeci bir ifade değil, dürüst bir dil kullanılacak ("simüle edilmiş kumarhane oyunları içerir, gerçek para kullanılmaz"). Ekran görüntülerinde kumarhane öne çıkarılmayacak.
45. **[v1][P0]** Sorumlu oyun mesajı: Kumarhane ilk açıldığında "Bu bir simülasyondur, gerçek para kullanılmaz. Gerçek hayatta kumar sorunu yaşıyorsanız yardım alabilirsiniz" notu gösterilecek. Yardım hattı bilgisi bölgeye göre yerelleştirilecek (TR için Yeşilay danışma hattı gibi doğrulanmış kaynaklar).
46. **[v1][P0]** Slot beklenen değeri negatif: NSS'deki pozitif beklenen değerli slot hatası tekrarlanmayacak. Tüm kumarhane oyunlarının beklenen değeri negatif olacak (ör. slot RTP %92–96). Bu, Monte Carlo testleriyle CI'da doğrulanacak. Amaç "kumar kazandırır" mesajı vermemek.
47. **[v1][P1]** Yakın kayıp (near-miss) manipülasyonu yok: Slot makinesi gerçek kumar makinelerindeki gibi yapay "neredeyse kazandın" sonuçlarını artırmayacak. Sonuçlar seed'li RNG'den dürüstçe gelecek.
48. **[v1][P0]** Lootbox yok: Para ile alınan rastgele ödül, paket, kart ya da kasa bulunmayacak. Belçika'nın 2018'de ücretli lootbox'ları kumar saymasını ve Hollanda'daki yaptırım tartışmalarını hatırlayarak bu kural tasarım belgesine "değişmez kural" olarak yazılacak.
49. **[v1][P1]** Ücretsiz rastgele ödüllerde dikkat: Oynayarak kazanılan rastgele ödüller (ör. sezon sonu kozmetik çekilişi) bile "paket açma" estetiğiyle sunulmayacak, olasılıklar gösterilecek.
50. **[v1][P1]** Alkol, gece hayatı ve sigara: Gece hayatı olayları metinle anlatılacak, alkol tüketimi olumsuz sonuçlarla (form, disiplin) birlikte gösterilecek ve özendirici sunulmayacak. Sigara ve uyuşturucu içeriği olmayacak. 18 yaş altı karakterin alkol olaylarına katılımı oyunda yasak (olay koşulu: yaş ≥ 18).
51. **[v1][P1]** Rüşvet ve şike tasviri: Şike teklifini kabul etmek her zaman ağır sonuçlu olacak (ceza, men, manşet). Oyun şikeyi "kârlı strateji" olarak ödüllendirmeyecek. Bu, derecelendirme anketinde suç teması olarak doğru beyan edilecek.
52. **[v1][P0]** Kendi maçına bahis: GDD'deki "kendi maçına bahis = ağır skandal" kuralı korunacak ve bu olayın sonuçları açıkça caydırıcı olacak.
53. **[v1][P0]** Hedef kitle 13+: Play'de hedef kitle 13 yaş ve üzeri seçilecek, Families politikası kapsamına girilmeyecek. Çocuklara yönelik pazarlama (çizgi film estetiği, çocuk kanallarında reklam) yapılmayacak.
54. **[v1][P0]** COPPA ve çocuk verisi: Oyun hesap gerektirmeyecek ve kişisel veri toplamayacak. Böylece 13 yaş altı bir kullanıcı oyunu indirse bile COPPA ve benzeri düzenlemeler açısından veri riski oluşmaz. Online özelliklerde (v2) yaş kapısı ve ebeveyn onayı tasarlanacak.
55. **[v1][P1]** Romantik içerik sınırı: İlişki sistemi fade-to-black olacak, cinsel içerik bulunmayacak. Bu, 13+/PEGI 12 hedefini korur. Eşcinsel ilişkiler seçilebilir olacak. Bazı pazarlarda bunun mağaza kısıtına yol açıp açmadığı yayın öncesi kontrol edilecek, ama içerik bölgeye göre sansürlenmeyecek. Gerekirse o pazar listeden çıkarılacak, bu bir ürün kararı olarak kayda geçecek.
56. **[v1][P2]** Derecelendirme dosyası: Her mağazaya verilen anket yanıtları, ekran görüntüleri ve alınan sınıflar tek bir "derecelendirme dosyası"nda tutulacak. İçerik değişikliği (yeni kumar oyunu, yeni olay türü) yapıldığında yeniden değerlendirme kontrol listesi tetiklenecek.

#### F. Mağaza Optimizasyonu (ASO) ve Steam Sayfası

57. **[v1][P0]** Teşvikli yorum yasak: Yorum karşılığında oyun içi para, öğe veya herhangi bir ödül verilmeyecek. NSS'nin "yorum yaz, 10 bux al" uygulaması App Store puanını şişirdi ve hem Apple hem Google kurallarına aykırı. Bizde yorum isteği hiçbir ödülle ilişkilendirilmeyecek.
58. **[v1][P0]** Yerel yorum API'si zamanlaması: iOS `SKStoreReviewController` ve Play In-App Review API yalnızca olumlu bir anın hemen ardından çağrılacak (ilk kupa, ilk büyük transfer, sezonun oyuncusu). En erken 3. oturumda ve en az 2 saatlik oyundan sonra, yılda en fazla 3 kez. Çökme ya da kayıp yaşanmış oturumda hiç çağrılmayacak.
59. **[v1][P0]** Başlık ve alt başlık: App Store adı (30 karakter) ve alt başlığı (30 karakter), Play başlığı (30 karakter) ve kısa açıklaması (80 karakter) TR ve EN için ayrı yazılacak. Örnek EN: "StarPath Football" + "Pro Career & Life Sim". Örnek TR: "StarPath Futbol" + "Futbolcu Kariyeri ve Yaşamı". Rakip oyun adı anahtar kelime olarak kullanılmayacak.
60. **[v1][P0]** Anahtar kelime seti: EN için "football career", "soccer career", "football life sim", "soccer manager player", "offline football", "no ads football"; TR için "futbolcu kariyeri", "futbol yaşam simülasyonu", "çevrimdışı futbol", "futbol menajer", "reklamsız futbol oyunu". App Store'un 100 karakterlik keyword alanı tekrarsız ve virgülle doldurulacak.
61. **[v1][P0]** Ekran görüntüsü stratejisi: İlk 3 görüntü ilk 3 saniyede satmalı: (1) maç anı + "Her şut senin elinde", (2) yaşam/lüks ekranı + "Sahada ve sahne dışında efsane ol", (3) kariyer zaman çizelgesi + "16 yaşından emekliliğe". Kumarhane ilk 5 görüntüde yer almayacak. Dikey ve yatay setler ile tablet setleri ayrı hazırlanacak.
62. **[v1][P1]** Tanıtım videosu: 15–30 saniyelik, ilk 3 saniyede gol anı içeren, sessiz izlenebilen (yazılı başlıklı) bir video. Sonunda "Reklamsız. Enerji duvarı yok." kartı.
63. **[v1][P1]** Mağaza A/B deneyleri: Play Store Listing Experiments ve App Store Product Page Optimization ile ikon ve ilk ekran görüntüsü üzerinde en az 3 deney. Her deney en az 7 gün ve istatistiksel anlamlılık ile sonuçlanacak.
64. **[v1][P1]** Yerelleştirilmiş listeler: Lansmanda TR ve EN, ilk 3 ayda ES, PT-BR, DE, FR, IT, ID mağaza metni ve ekran görüntüsü başlıkları. Ekran görüntülerindeki oyun içi metin de o dilde olacak.
65. **[v1][P0]** Fiyat şeffaflığı mağaza metninde: "Ücretsiz dene: ilk sezon bedava. Tam kariyer tek seferlik ödeme. Reklam yok, enerji yok, premium para yok." cümlesi açıklamanın ilk paragrafında yer alacak.
66. **[v1][P1]** İkon testi: İkon 3 varyantla küçük boyutta (29 px, 48 px) okunabilirlik testinden geçecek. Top + yıldız silüeti, yazı yok.
67. **[v1][P0]** Steam kapsül görselleri: Header, small, main, vertical, library hero ve logo kapsülleri Steam'in güncel ölçüleriyle hazırlanacak. Kapsülde oyun adı 120×45 küçük kapsülde okunur olacak.
68. **[v1][P0]** Steam etiketleri: "Sports", "Football (Soccer)", "Life Sim", "Simulation", "RPG", "Singleplayer", "Career", "Management", "2D", "Indie", "Casual", "Offline" ile ilk 5 etiket en güçlü keşif kümeleri olacak şekilde sıralanacak.
69. **[v1][P0]** Wishlist hedefi: Steam sayfası lansmandan en az 9–12 ay önce açılacak. Lansman günü hedefi 15.000+ wishlist (Steam algoritmasında görünürlük için kabul gören eşik bandı), alt sınır 7.000.
70. **[v1][P0]** Steam demo ve Next Fest: İlk sezonun ilk 8 haftasını kapsayan demo, lansmandan 4–6 ay önceki Next Fest'e yetiştirilecek. Demo ilerlemesi tam sürüme taşınabilecek.
71. **[v2][P2]** Steam etkinlikleri: Lansman sonrası yılda en az 4 Steam etkinliğine (yaz/kış indirimi, spor temalı festival) katılım ve her sezon güncellemesinde "Major Update" etkinlik sayfası.
72. **[v1][P1]** Ön kayıt: Google Play ön kayıt ve App Store ön sipariş, lansmandan 6–8 hafta önce açılacak.

#### G. Pazarlama ve Topluluk

73. **[v1][P0]** Paylaşılabilir highlight klipleri: Oyun içi "Klibi kaydet" özelliği 9:16 ve 16:9 formatında 10–20 saniyelik, oyun logosu filigranlı klip üretecek. TikTok, YouTube Shorts ve Reels için birincil organik pazarlama kanalı bu klipler olacak.
74. **[v1][P0]** Nostalji mesajı: Hedef kitle 2012–2016 arasında mobil futbol kariyer oyunlarıyla büyüyen, bugün 20–30 yaşındaki oyuncular. Mesaj: "Çocukken oynadığın kariyer oyununu büyüttük". Rakip oyun adı geçmeden bu duyguya hitap edilecek.
75. **[v1][P0]** Saygılı iletişim: Ekip, sosyal medyada başka bir oyunu veya geliştiricisini küçümseyen hiçbir içerik paylaşmayacak. Türün topluluklarına (forumlar, alt-dizinler) reklam spam'i yapılmayacak, yalnızca kurallar izin veriyorsa ve moderatör onayıyla tanıtım yapılacak.
76. **[v1][P0]** Discord sunucusu: Dikey kesit aşamasında açılacak. Kanallar: duyuru, hata raporu (şablonlu), öneri (oylamalı), klip paylaşımı, TR ve EN genel sohbet. Kurallar ve moderasyon ekibi (en az 2 gönüllü + 1 ekip üyesi) lansmandan önce hazır olacak.
77. **[v1][P1]** Reddit varlığı: Resmî alt-dizin açılacak, ama asıl etkileşim spor oyunları ve mobil oyun topluluklarında kurallara uygun "geliştirici günlüğü" paylaşımlarıyla yapılacak. Ayda en fazla 2 tanıtım paylaşımı.
78. **[v1][P1]** İçerik üreticileri: Mobil futbol ve kariyer oyunu içerik üreten 50 YouTube/TikTok üreticisinden oluşan liste. Lansmandan 2 hafta önce erken erişim anahtarı ve basın kiti. Sponsorlu içerikte reklam etiketi zorunlu.
79. **[v1][P1]** Basın kiti: presskit() formatında sayfa: kısa/uzun açıklama, 10 ekran görüntüsü, 3 GIF, fragman, logo paketi (SVG/PNG, açık/koyu), ekip bilgisi, iletişim. TR ve EN.
80. **[v1][P1]** Lansman takvimi: T-12 ay Steam sayfası, T-9 ay Discord, T-6 ay kapalı beta, T-4 ay Next Fest demosu, T-8 hafta ön kayıt, T-2 hafta basın ve içerik üretici anahtarları, T0 eşzamanlı Steam + mobil, T+2 hafta ilk yama, T+6 hafta ilk içerik güncellemesi.
81. **[v1][P2]** Türk futbol medyası: Türkiye'de oyun ve spor medyasına yerel bir hikâye ("Türk bağımsız ekipten dünya pazarı için futbol kariyer oyunu") ile ulaşılacak.
82. **[v2][P2]** Topluluk yarışmaları: "Ayın golü" klip yarışması (kozmetik ödüllü, gerçek para ödülsüz), topluluk tarafından tasarlanan kurgusal kulüp armasının resmî veriye eklenmesi.
83. **[v1][P1]** Herkese açık yol haritası: Trello/Notion benzeri bir panoda "Planlanan / Geliştiriliyor / Yayında" sütunları olacak. Topluluk oylaması ile v2 önceliklerinden 2'si belirlenecek.
84. **[v1][P0]** Kriz iletişimi şablonu: Kayıt kaybı, kötü yama ve yanlış fiyat gibi durumlar için önceden yazılmış özür + çözüm + telafi (kozmetik) şablonları ve 24 saat içinde ilk açıklama kuralı.

#### H. Kalite Güvence (QA) Planı

85. **[v1][P0]** Test matrisi: En az şu cihazlar: düşük uçlu Android (2 GB RAM, Mali-G52, Android 10), orta Android (Android 14), Android 16 tablet/katlanabilir, iPhone SE 2. nesil (iOS 15 tabanı), güncel iPhone, iPad, Windows dizüstü (entegre GPU), Mac (Apple Silicon), Steam Deck, Linux masaüstü. Her sürüm adayı bu matrisin tamamında duman testinden geçer.
86. **[v1][P0]** Simülasyon denge testi: Her gece CI'da 10.000 sezon (farklı seed'ler) koşulacak. Kontrol edilenler: lig başına ortalama gol (2,4–3,0 bandı), ev sahibi galibiyet oranı (%42–48), en güçlü takımın şampiyonluk oranı (%25–45), oyuncu kariyerinde enflasyon (sezon 10 harcama/gelir oranı 0,4–0,9), at yarışı/kumarhane gelirinin futbol gelirinin %20'sini aşmaması. Bant dışı sonuç alarmı.
87. **[v1][P0]** Botla kariyer testi: Rastgele ve "açgözlü" stratejiyle oynayan iki bot her gece 20 sezonluk kariyer oynayacak. Kilitlenme, sonsuz döngü, negatif bakiye hatası ve ulaşılamayan başarım raporlanacak.
88. **[v1][P0]** Kayıt fuzz testi: Rastgele bayt çevirme, kesilmiş dosya, boş dosya, eski şema ve gelecek şema dosyaları ile her PR'da 500 vaka. Beklenen sonuç: çökme yok, yedekten kurtarma ya da anlaşılır hata.
89. **[v1][P0]** Soak testi: Gerçek cihazda 4 saat kesintisiz oyun (otomatik bot ile). Bellek artışı < %10, FPS düşüşü < %10, çökme 0.
90. **[v1][P0]** Kesinti testleri: Maç ortasında arama gelmesi, uygulamanın arka plana alınması, pilin bitmesi (zorla kapatma), uçak modu, saat dilimi değişikliği ve disk dolması senaryoları elle test edilecek. Her biri sonunda kayıt sağlam olmalı.
91. **[v1][P0]** Regresyon paketi: Playwright ile 40 kritik akış (yeni kariyer, ilk maç, transfer, satın alma, kayıt/yükleme, dil değiştirme, kilit açma, geri yükleme). Her PR'da çalışır, kırmızıysa birleştirme yok.
92. **[v1][P1]** Görsel regresyon: Deterministik seed ile 60 ekranın ekran görüntüsü karşılaştırması. TR ve EN için ayrı, en uzun dil (DE) için taşma kontrolü.
93. **[v1][P0]** Hata önceliklendirme: S1 (kayıt kaybı, çökme, satın alma hatası: 24 saatte düzeltme planı, yayını durdurur), S2 (ilerlemeyi engelleyen: sürüm adayını durdurur), S3 (yanlış ama geçici çözümü olan), S4 (kozmetik). Kayıt kaybı her zaman S1.
94. **[v1][P0]** Beta grupları: Kapalı alfa 30 kişi (Discord'dan seçilmiş, NSS tecrübeli), kapalı beta 300–500 kişi (TestFlight, Play kapalı test, Steam Playtest), açık beta/soft launch. Play'in yeni hesaplar için "12 test kullanıcısı / 14 gün" şartı en az 20 kullanıcıyla karşılanacak.
95. **[v1][P0]** Sertifikasyon kontrol listeleri: Apple İnceleme Yönergeleri (özellikle 2.1 eksik özellik, 3.1.1 IAP, 4.2 minimum işlev, 5.1 gizlilik), Play politika kontrol listesi (Data safety, hedef API, simüle kumar), Steam Deck Verified kriterleri. Her sürüm adayında kontrol listesi bir sorumlu tarafından imzalanır.
96. **[v1][P1]** Yerelleştirme QA: Her dil için anadili konuşan bir kişi oyunun ilk 2 saatini oynayarak dil testi yapacak. Kontrol edilenler: kırpılan metin, yanlış çoğul, cinsiyet uyumsuzluğu, Türkçe ek hatası.
97. **[v1][P1]** Erişilebilirlik QA: VoiceOver, TalkBack ve NVDA ile ana menü → maç → sonuç akışının ekrana bakmadan tamamlanabildiğinin testi. Renk körlüğü simülasyonuyla 20 kritik ekranın kontrolü.
98. **[v1][P1]** Ekonomi QA hile kontrolü: Sonsuz para döngüsü arayan özel test (ör. eşya al-sat, at yarışı, faiz ve kredi kombinasyonu). Bulunan her istismar S2 olarak işlenecek.

#### I. Telemetri Etiği ve Gizlilik

99. **[v1][P0]** Açık onay (opt-in): Ürün analitiği varsayılan olarak kapalı olacak. İlk açılışta sade bir ekranda "Anonim kullanım verisi göndermek ister misin?" sorusu gösterilecek. "Hayır" ve "Evet" butonları aynı boyut ve renkte, yerleri sabit olacak. Çökme raporu da ayrı bir onayla açılacak.
100. **[v1][P0]** Dark pattern yasağı: NSS döneminde Ogury onay penceresinde "Reddet"e basınca butonların yer değiştirdiği pencere bir 1★ dalgası yarattı ve AB hukukuna aykırı olduğu iddia edildi. Bizde onay penceresi bir kez gösterilecek. Ret tekrar sorulmayacak, ayarlardan istenildiğinde değiştirilebilecek.
101. **[v1][P0]** Veri minimizasyonu: Toplanacak olaylar sabit bir listede tutulacak (oturum başlangıcı ve süresi, tutorial adımı, sezon ilerlemesi, maç süresi, kayıt hata kodu, kilit açma, cihaz sınıfı). Listeye ekleme kod incelemesi ve gizlilik onayı gerektirecek. İsim, e-posta, reklam kimliği, IP ve hassas konum toplanmayacak.
102. **[v1][P0]** Kalıcı kimlik yok: Analitik kimliği rastgele üretilecek, cihaz kimliğine bağlı olmayacak ve 90 günde bir yenilenecek. Kullanıcı ayarlardan "kimliğimi sıfırla" diyebilecek.
103. **[v1][P0]** Saklama süreleri: Ham olaylar 90 gün, toplulaştırılmış metrikler 25 ay, çökme raporları 90 gün saklanacak. Süreler gizlilik politikasında yazılacak.
104. **[v1][P1]** Kullanıcıya veri gösterme: Ayarlar > Gizlilik ekranında "Gönderilen verileri göster" butonu, kuyruktaki son 50 olayı okunabilir JSON olarak gösterecek.
105. **[v1][P0]** Sunucu konumu ve işleyiciler: Analitik kendi barındırdığımız (AB veya TR) sunucuda tutulacak. Üçüncü taraf işleyiciler gizlilik politikasında listelenecek. KVKK kapsamında yurt dışına aktarım varsa açık rıza ve aydınlatma metni hazırlanacak.
106. **[v1][P0]** Data safety ve Nutrition Labels doğruluğu: Mağaza beyanları gerçek SDK davranışıyla çelişirse ret ve güven kaybı riski var. Her sürümde ağ trafiği proxy ile (mitmproxy) kontrol edilip beyanla karşılaştırılacak.
107. **[v1][P1]** Oyuncu davranışı manipülasyonu yok: Telemetri, harcamayı artıracak kişiselleştirilmiş fiyatlandırma veya "balina" hedeflemesi için kullanılmayacak. Kullanım alanı denge, hata ve tutorial iyileştirmeyle sınırlı. Bu ilke gizlilik politikasında açıkça yazılacak.
108. **[v1][P1]** Bildirim etiği: Yerel bildirimler varsayılan olarak kapalı olacak. Açılırsa haftada en fazla 2 bildirim gönderilecek, "enerjin doldu" tarzı geri çağırma mesajları olmayacak, yalnızca "maç günü" hatırlatması olacak.

#### J. Lider Tabloları ve Hile Önleme (Risk Perspektifi)

109. **[v2][P0]** Çevrimdışı kariyere müdahale yok: Tek oyunculu kariyerde hile yapmak (kayıt düzenleme, bellek düzenleme) oyuncunun kendi tercihi. Bu kariyer, lider tablolarına "doğrulanmamış" etiketiyle gönderilmeyecek ama oyuncu cezalandırılmayacak ve uyarı ekranı gösterilmeyecek.
110. **[v2][P0]** Rekabetçi modlar ayrı: Lider tablosuna giren tüm modlar (haftalık meydan okuma, ghost maç) sunucunun imzaladığı seed ile başlayacak. Gönderim seed + girdi kaydı (input log) olacak. Sunucu aynı deterministik simülasyonu yeniden koşturup skoru kendisi hesaplayacak, istemcinin bildirdiği skor kullanılmayacak.
111. **[v2][P0]** Determinizm riski: Platformlar arası kayan nokta farkı (Math.sin/pow) doğrulamada yanlış pozitif üretebilir. Rekabetçi sim yolunda yalnızca sabit nokta aritmetik ve kendi trigonometri tabloları kullanılacak. CI'da aynı replay Node, Chromium, WebKit ve Android WebView'da koşturulup hash eşitliği test edilecek.
112. **[v2][P1]** Hız hilesi: Girdi kaydındaki olay zaman damgaları sim tikleri cinsinden olacak. İnsan dışı tepki süresi (ör. 20 ms altı sürekli tepki) ve imkânsız girdi yoğunluğu sunucuda istatistiksel olarak işaretlenecek. Otomatik ban yerine "inceleme kuyruğu" kullanılacak.
113. **[v2][P1]** Bellek ve istemci düzenleme: İstemcide gizleme (obfuscation) yalnızca caydırıcı düzeyde tutulacak. Asıl koruma sunucu tarafı replay doğrulaması olacak. Bu sayede istemciye ağır anti-cheat yazılımı eklenmeyecek.
114. **[v2][P1]** Replay sunucu maliyeti: Doğrulama maliyeti (CPU) her gönderim için < 200 ms hedefiyle ölçülecek. Haftalık meydan okuma hacmi tahmini ile sunucu bütçesi hesaplanacak. Bütçe aşılırsa yalnızca ilk %10 sıralama doğrulanacak, gerisi örneklemeyle kontrol edilecek.
115. **[v2][P2]** Lider tablosu adı moderasyonu: Kullanıcı adları ve kulüp adları küfür/nefret listesine karşı filtrelenecek (TR, EN ve sonraki diller). Raporla ve gizle butonu olacak.
116. **[v2][P2]** Sezonluk sıfırlama: Kalıcı lider tabloları yerine haftalık ve sezonluk tablolar olacak. Böylece tespit edilemeyen hileler zamanla kendiliğinden temizlenir.

#### K. Performans Bütçesi ve Kayıt Bozulması (Risk Perspektifi)

117. **[v1][P0]** Düşük uçlu cihazda FPS riski: Risk: WebView + DOM katmanının düşük uçlu Android'de maçı 30 FPS altına düşürmesi. Önlem: iki modlu render ve düşük kalite profili. İzleme: opt-in telemetride cihaz sınıfına göre maç içi p5 FPS. Alarm: p5 < 24 FPS olan cihaz oranı > %5.
118. **[v1][P0]** Termal kısma riski: Risk: 20 dakikalık oturumda cihazın ısınması ve FPS'in yarıya inmesi. Önlem: menüde 30 FPS, maçta dinamik çözünürlük. İzleme: soak testinde 20. dakika FPS / 1. dakika FPS oranı ≥ 0,85.
119. **[v1][P0]** iOS WebContent sonlanması: Risk: bellek baskısında beyaz ekran ve kayıt kaybı. Önlem: arka plana geçişte anında kayıt ve yeniden yüklemede kurtarma. İzleme: "beklenmeyen yeniden başlatma" olay sayısı / oturum < %0,3.
120. **[v1][P0]** Kayıt bozulması riski: Risk: yazma sırasında çökme veya disk dolması. Önlem: atomik yazma, 3 nesil yedek, checksum. İzleme: yüklemede checksum hatası oranı ve yedekten kurtarma oranı. Alarm: 1/100.000 yüklemeyi aşan bozulma, S1 olay.
121. **[v1][P0]** Migrasyon riski: Risk: güncelleme sonrası eski kayıtların açılmaması (NSS'de en acı şikâyetlerden biri). Önlem: her şema sürümü için fixture testi ve migrasyon öncesi kopya. İzleme: güncellemeden sonraki 72 saatte "migrasyon hatası" olay sayısı = 0. Sıfır değilse aşamalı dağıtım durdurulur.
122. **[v1][P0]** Aşamalı dağıtım: Mobil güncellemeler %5 → %20 → %50 → %100 aşamalı yayılacak. Her aşamada çökme oranı ve kayıt hataları 24 saat izlenecek. Play staged rollout ve App Store phased release kullanılacak.
123. **[v1][P1]** Uygulama boyutu kayması: Risk: asset eklendikçe AAB'nin 40 MB'ı aşması ve dönüşümün düşmesi. Önlem: CI'da boyut bütçesi kontrolü. Alarm: bir PR'ın boyutu 1 MB'tan fazla artırması incelemeye düşer.
124. **[v1][P1]** Sim süresi riski: Risk: dünya büyüdükçe sezon sonu simülasyonunun uzun sürmesi. Bütçe: düşük uçlu cihazda 1 sezon < 2 sn. CI'da performans testi, %20 gerileme varsa PR kırmızı olur.

#### L. Yerelleştirme Tuzakları (Risk Perspektifi)

125. **[v1][P0]** Türkçe büyük harf: `toUpperCase()` "i" harfini "I" yapar, Türkçede "İ" olmalı. ESLint kuralıyla locale'siz `toUpperCase/toLowerCase` kullanımı yasaklanacak. Testte "istanbul" → "İSTANBUL" doğrulanacak.
126. **[v1][P0]** Türkçe ekler: "{kulüp}'e transfer oldu" gibi şablonlar ünlü uyumunu bozar. Cümleler eksiz kurulacak ("Yeni kulüp: {kulüp}") ya da test edilmiş `ek(isim, 'yönelme')` yardımcısı kullanılacak. Kurgusal isim üreticisinin ürettiği 1.000 isimle ek testi yapılacak.
127. **[v1][P0]** Cinsiyetli dil: NSS kadın kariyerinde yorumcunun "he" demesi şikâyet konusu oldu. Tüm anlatım metinleri ICU `select` ile cinsiyete göre çekimlenecek. Eksik varyant CI'da hata verecek. İngilizce, İspanyolca, Fransızca, Almanca ve Portekizcede özellikle kontrol edilecek.
128. **[v1][P1]** Metin genişlemesi: Almancada metinler yaklaşık %30 uzar. Butonlarda sabit genişlik olmayacak. Görsel regresyonda "sözde yerelleştirme" (pseudo-localization, %40 uzatılmış metin) ile taşma testi yapılacak.
129. **[v1][P1]** Para ve sayı biçimi: "₺1.250.000" ile "$1,250,000" farkı için `Intl.NumberFormat` kullanılacak. Oyun içi kurgusal para birimi simgesi tek ve tutarlı olacak, gerçek döviz kuru ima edilmeyecek.
130. **[v1][P1]** Kültürel hassasiyet: Olay metinlerinde dini, etnik ve siyasi göndermeler ile alkol ve kumar teması her pazar için gözden geçirilecek. Ülke bayrakları ve harita sınırları tartışmalı bölgeler için nötr gösterilecek (harita yerine liste).
131. **[v2][P1]** Topluluk çevirisi riski: Weblate/Crowdin'de topluluk çevirileri kalite ve küfür kontrolünden geçmeden yayına girmeyecek. Her dil için onaylı bir denetçi atanacak.
132. **[v1][P2]** Mağaza metni ve oyun içi tutarlılık: Mağazada kullanılan özellik adları ("Kariyer Modu", "Yaşam") oyundaki terimlerle birebir aynı olacak. Bir terim sözlüğü (glossary) tutulacak.

#### M. İş ve Proje Riskleri

133. **[v1][P0]** Kapsam şişmesi: Bu belgedeki 1.000+ maddenin hepsi v1 değil. Her milestone sonunda [v1] maddeleri yeniden puanlanacak. P2 olan [v1] maddeleri otomatik olarak [v2]'ye kayabilir. "Yeni özellik dondurma" tarihi Beta başlangıcı olacak.
134. **[v1][P0]** Tek kişilik bilgi bağımlılığı: Maç motoru, kayıt sistemi ve yayın boru hattı gibi kritik alanların her biri için en az 2 kişi kodu bilecek. Mimari karar kayıtları (ADR) tutulacak. İmzalama anahtarları ve mağaza hesapları en az 2 yetkiliyle ve kasada saklanacak.
135. **[v1][P0]** Platform politika değişikliği: Apple, Google ve Steam kuralları yılda birkaç kez değişiyor (hedef API, faturalama, yaş derecelendirmesi). Çeyrekte bir "politika taraması" yapılacak ve lansmandan 6 hafta önce zorunlu tam kontrol olacak.
136. **[v1][P1]** Bölgesel fiyatlandırma: Tek seferlik kilit fiyatı ABD'de 5,99 $ civarında. Türkiye, Brezilya, Hindistan ve Endonezya için satın alma gücüne göre mağaza fiyat katmanları kullanılacak. Steam'in önerdiği bölgesel fiyatlar gözden geçirilecek. Risk: çok düşük fiyatın VPN ile istismarı, ama tek oyunculu oyunda tolere edilebilir.
137. **[v1][P1]** İade oranı: Steam'de 2 saatlik iade penceresi var. İlk 2 saatte oyunun en iyi yüzü (ilk transfer, ilk lüks alım, ilk derbi) gösterilmeli. İade oranı > %10 olursa ilk 2 saatin akışı yeniden tasarlanacak.
138. **[v1][P1]** Korsan APK: Kilitli mobil sürümün kırılmış APK'ları yayılacak. Buna ağır DRM ile değil, makbuz doğrulamasıyla karşılık verilecek. Kırılmış sürümde kayıt aktarımı ve bulut özellikleri çalışmayacak, ama kullanıcıya saldırgan mesaj gösterilmeyecek. Resmî olmayan kopyaların kötü amaçlı yazılım riski hakkında topluluk bilgilendirilecek.
139. **[v1][P1]** Klonlar: Başarı hâlinde mağazalarda benzer isim ve ikonla klonlar çıkabilir. Marka tescili (madde 7) bu durumda mağazalara bildirim yapmayı mümkün kılar. Mağaza "fikri mülkiyet ihlali" formları için bir süreç belgelenecek.
140. **[v1][P0]** "Pay-to-win" algısı: Kozmetik IAP'ler bile yanlış sunulursa "para ile güç" algısı yaratabilir. Hiçbir kozmetik statistik değiştirmeyecek. Mağaza açıklamasında ve oyun içi dükkânda "yalnızca görünüm" etiketi olacak. Kozmetik kimliklerin sim'e girmediği kodda zorlanacak.
141. **[v1][P1]** Ücretsiz denemenin yanlış algılanması: "Ücretsiz" etiketli mağaza sayfasında kilit duvarı "tuzak" gibi algılanabilir. Kilidin nerede olduğu (1. sezon sonu) mağaza metninde ve oyunun ilk ekranında açıkça yazılacak. Deneme kaydı tam sürüme eksiksiz aktarılacak.
142. **[v1][P1]** Eski satın alımların tanınmaması dersi: NSS'nin F2P'ye geçişte eski ödeyenleri mağdur etmesi kalıcı öfke yarattı. İş modeli değişse bile mevcut tam sürüm sahipleri her zaman korunacak. Bu taahhüt mağaza açıklamasına yazılacak.
143. **[v1][P1]** Destek yükü: Küçük ekipte destek talepleri geliştirme süresini yer. Oyun içi "Destek" ekranı SSS, kayıt dışa aktarma ve otomatik tanı paketi (sürüm, cihaz, kayıt hash'i, son 20 hata, PII yok) sunacak. Hedef: e-posta taleplerinin %50'si SSS ile çözülsün.
144. **[v2][P2]** Sunucu bağımlılığı riski: NSS5'in kapatılan sunucuları oyunu oynanamaz hâle getirdi. Bizde tek oyunculu kariyer hiçbir sunucuya bağlı olmayacak. Online özellikler kapatılsa bile oyun eksiksiz çalışacak. "Sunucu kapanış planı" belgede tutulacak.
145. **[v1][P2]** Para birimi ve kur riski: Gelirler USD, giderler TL ağırlıklı olacak. Kur dalgalanmasına karşı nakit akışı 3 aylık tamponla planlanacak.


## 3. Yol Haritası

Takvim, 4–6 kişilik çekirdek ekip ve yarı zamanlı serbest çalışanlar varsayımıyla hesaplandı. 1.0'a kadar toplam süre yaklaşık **20–24 ay**. Her aşamanın çıkış kriterleri karşılanmadan bir sonraki aşamaya geçilmez. Kriter karşılanmazsa takvim değil kapsam esnetilir: önce P2, sonra P1 maddeleri [v2]'ye kaydırılır.

### 3.1 Kilometre Taşları

| # | Aşama | Süre | Ana teslimatlar | Çıkış kriterleri (ölçülebilir) | Sorumlu roller |
|---|---|---|---|---|---|
| M0 | **Ön Üretim ve Teknik Prototip** | 6–8 hafta | Phaser 4 + Capacitor swipe-şut prototipi; Electron + steamworks.js "merhaba Steam"; `packages/sim` iskeleti, seed'li RNG; `packages/save` atomik yazma + fuzz testi; ad ve marka taraması; GDD v1 donması | Düşük uçlu Android'de maç sahnesi ≥ 30 FPS (p5 ≥ 26); 1 sezon simülasyonu < 2 sn; 500 fuzz vakasında kayıt kaybı 0; 10 test oyuncusundan ≥ 7'si "şut hissi NSS kadar iyi veya daha iyi" diyor; isim çakışması yok | Teknik lider, oyun tasarımcısı, yapımcı |
| M1 | **Dikey Kesit (Vertical Slice)** | 12–14 hafta | 1 ülke, 2 lig kademesi, 1 tam sezon; forvet mevkiinde maç anları (şut, pas, dribbling, korner, penaltı); 4 antrenman mini oyunu; ilişkiler + 40 olay; sözleşme ve kış transferi; hub, takvim ve haber ekranları "Gece Maçı" görsel kimliğiyle; TR + EN; Discord açılışı | Yeni oyuncu ilk maça < 3 dk'da ulaşıyor; kapalı 30 kişilik testte ilk sezonu bitirme ≥ %60; SUS (kullanılabilirlik) puanı ≥ 75; çökme oranı < %1 oturum; "bir sezon daha oynamak isterim" ≥ %70 | Tüm çekirdek ekip |
| M2 | **Alfa (Özellik Tamamlama)** | 20–24 hafta | Tüm [v1] sistemleri: 8+ ülke, kupalar, milli takım, kaleci ve defans kariyeri, kumarhane (bölge bayrağıyla), lüks/finans, 150+ olay, emeklilik ve kariyer skoru, başarımlar, erişilebilirlik temel seti, PC kontrolleri + gamepad, Steam sayfası yayında | [v1] özellik listesinin %100'ü oynanabilir (cila hariç); bot 20 sezon kilitlenmeden oynuyor; gece 10.000 sezon denge testleri bant içinde; açık S1 hata sayısı 0; wishlist ≥ 2.000 | Tüm ekip + serbest sanatçı/sesçi |
| M3 | **Beta (İçerik ve Cila)** | 16–20 hafta | Özellik dondurma; içerik genişletme (olaylar 200+, lüks eşya 120+); ses ve müzik; denge turları; yerelleştirme (TR/EN tam, ES/PT-BR/DE başlangıç); kapalı beta 300–500 kişi (TestFlight, Play kapalı test, Steam Playtest); Next Fest demosu | Çökmesiz oturum ≥ %99,5; kayıt bozulması 0 (beta boyunca); D1 ≥ %40 / D7 ≥ %15 (beta kohortu); beta anketi "tavsiye ederim" ≥ %80; Next Fest sonrası wishlist ≥ 8.000; tüm sertifikasyon kontrol listeleri yeşil | Tüm ekip + QA serbest çalışanı + topluluk yöneticisi |
| M4 | **Soft Launch (Mobil)** | 8–10 hafta | 2–3 test pazarında (ör. Filipinler, Kanada, Hollanda gibi İngilizce bilinen, gelir verisi temsil eden pazarlar; Türkiye ayrıca değerlendirilir) mobil yayın; deneme → tam sürüm kilidi gerçek fiyatla; opt-in telemetri; mağaza A/B deneyleri | D1 ≥ %45, D7 ≥ %20, D30 ≥ %10 (hedef bandın alt sınırı); deneme→tam sürüm ≥ %4; çökmesiz kullanıcı ≥ %99,5; ANR < %0,47; mağaza puanı ≥ 4,5 (ilk 200 yorum); tutorial tamamlama ≥ %85 | Yapımcı, veri/canlı operasyon, pazarlama |
| M5 | **1.0 Küresel Lansman** | 4–6 hafta hazırlık + lansman | Steam + Google Play + App Store eşzamanlı; TR/EN/ES/PT-BR/DE/FR/IT; basın kiti, içerik üretici anahtarları; T+2 hafta ilk yama | Lansman wishlist ≥ 15.000 (alt sınır 7.000); ilk hafta Steam olumlu ≥ %90; iade < %8; mobil puan ≥ 4,7; S1 hata 72 saat içinde kapanıyor | Tüm ekip |
| M6 | **Lansman Sonrası Sezon 1** | 12 hafta | Ücretsiz büyük güncelleme: Teknik Direktör modu başlangıcı veya miras (oğul/kız) sistemi [v2]; haftalık meydan okumalar + lider tablosu (sunucu doğrulamalı); bulut kayıt (iCloud, Play Games); 50 yeni olay; ilk kozmetik paket | Güncelleme sonrası DAU artışı ≥ %25; geri dönen oyuncu (30 gün pasif → aktif) ≥ %8; kayıt migrasyon hatası 0 | Tüm ekip |
| M7 | **Sezon 2** | 12 hafta | Rakip yıldızlar (nemesis), VAR, gece/gündüz ışığı, çoklu kamera, işletme sahipliği, mod/veri editörü (PC), Steam Workshop | Workshop'ta ilk 30 günde ≥ 200 içerik; olumlu yorum ≥ %90 korunuyor | Tüm ekip |
| M8 | **Sezon 3 ve sonrası** | 12'şer hafta | Kulüp başkanlığı [v3], sesli anlatım [v3], ek diller (ID, JA, KO), konsol değerlendirmesi (Switch 2), genişleme paketi (ör. kadın futbolu derin kariyer, yeni kıtalar) | Her sezonun kendi KPI hedefi; yıllık gelirin ≥ %30'u lansman sonrası satışlardan | Tüm ekip |

**Aşama kapıları (her geçişte):** (1) çıkış kriterleri tablosu yeşil, (2) açık S1 = 0 ve S2 ≤ 5, (3) kayıt fixture testleri yeşil, (4) bir sonraki aşamanın kapsamı yeniden puanlanmış.

### 3.2 Ekip ve Maliyet Tahmini

**Varsayımlar:** Rakamlar Ekim 2026 itibarıyla kaba tahmindir. Türkiye maaşları brüt işveren maliyeti olarak, yaklaşık 1 USD ≈ 41–45 TL bandıyla düşünülmüştür. Kur, enflasyon ve vergi teşvikleri (Teknokent, AR-GE indirimi, KOSGEB, TÜBİTAK 1501/1507 gibi destekler) maliyeti belirgin biçimde değiştirebilir, mali müşavirle doğrulanmalıdır.

**Çekirdek ekip (yalın senaryo: 5 kişi, rahat senaryo: 7 kişi)**

| Rol | FTE (yalın / rahat) | Aylık maliyet, Türkiye (TL, brüt işveren) | Aylık maliyet, uluslararası uzaktan (USD) | Ana sorumluluk |
|---|---|---|---|---|
| Yapımcı / Oyun Tasarımcısı (kurucu) | 1 / 1 | 110.000–160.000 | 6.000–9.000 | Tasarım, denge, yol haritası, mağaza |
| Teknik Lider (TS/Phaser, sim) | 1 / 1 | 140.000–200.000 | 8.000–12.000 | Mimari, maç motoru, sim, kayıt |
| Oyun Programcısı (UI/platform) | 1 / 2 | 100.000–150.000 | 5.500–9.000 | Preact UI, Capacitor/Electron, IAP, CI |
| 2D Sanatçı / UI Tasarımcı | 1 / 1 | 80.000–120.000 | 4.500–7.000 | Görsel kimlik, prosedürel sanat parametreleri, UI |
| İçerik Yazarı / Anlatı Tasarımcısı (TR/EN) | 0,5 / 1 | 60.000–90.000 (tam zamanlı) | 3.500–6.000 | Olaylar, manşetler, anlatım metinleri |
| QA + Topluluk Yöneticisi | 0,5 / 1 | 50.000–75.000 (tam zamanlı) | 3.000–5.000 | Test matrisi, beta, Discord |

**Serbest çalışanlar ve hizmetler (proje boyunca)**

| Kalem | Tahmini maliyet (USD) | Not |
|---|---|---|
| Ses tasarımı ve 5–8 özgün müzik loop'u | 4.000–12.000 | Telif devri ve Content ID taahhüdü şartıyla |
| Fragman ve kapsül görselleri | 3.000–8.000 | Steam kapsülleri + mağaza videosu |
| Çeviri (5 ek dil, ~120.000 kelime) | 12.000–25.000 | Profesyonel + topluluk denetimi |
| Hukuk (EULA, gizlilik, marka başvurusu TR + AB, ABD opsiyonel) | 4.000–10.000 | Marka harçları dahil |
| Gerçek cihaz havuzu (8–10 cihaz) | 2.500–4.000 | Tek seferlik |
| Uzaktan cihaz testi (Firebase Test Lab / BrowserStack) | 100–300 / ay | Beta döneminde |

**Platform ve araç giderleri**

| Kalem | Maliyet |
|---|---|
| Apple Developer Program | 99 $ / yıl |
| Google Play geliştirici hesabı | 25 $ (tek seferlik) |
| Steam Direct | 100 $ / uygulama (belirli gelir eşiğinden sonra iade edilir) |
| Kod imzalama (Windows: Azure Trusted Signing veya EV sertifika) | 120–500 $ / yıl |
| Sentry / GlitchTip | 0–80 $ / ay (GlitchTip kendi sunucumuzda ~20 $ / ay) |
| Analitik (Aptabase / PostHog kendi sunucu) | 0–50 $ / ay |
| Bulut (lider tablosu, replay doğrulama, v2) | 50–400 $ / ay (hacme bağlı) |
| GitHub (Team) + macOS CI dakikaları | 50–200 $ / ay |
| Figma, Crowdin/Weblate, alan adları, e-posta | 50–150 $ / ay |

**Pazarlama bütçesi:** Yalın senaryoda 8.000–15.000 $ (içerik üretici anahtarları, küçük ücretli içerik üretici iş birlikleri, fuar/etkinlik başvuru ücretleri, kapsül ve fragman). Rahat senaryoda 30.000–60.000 $ (ek olarak soft launch kullanıcı edinme testleri ve lansman haftası reklamları). Ana strateji organik: klipler, Next Fest ve topluluk.

**Toplam bütçe (22 aylık geliştirme + lansman sonrası ilk 3 ay):**

| Senaryo | Ekip | Türkiye bazlı toplam | Uluslararası uzaktan ekip toplamı |
|---|---|---|---|
| **Yalın** | 5 FTE (bazı roller yarı zamanlı), kurucular piyasa altı maaş | ≈ 12–16 milyon TL (≈ 280.000–380.000 $) | ≈ 650.000–850.000 $ |
| **Rahat** | 7 FTE, tam piyasa maaşı, daha geniş pazarlama | ≈ 20–27 milyon TL (≈ 470.000–640.000 $) | ≈ 1,1–1,4 milyon $ |

Her iki senaryoda da beklenmeyen giderler için %15 yedek ve 3 aylık nakit tamponu (kur riski) bütçeye eklenmelidir. Başa baş noktası kaba hesapla, ortalama net gelir/satış ≈ 3,5 $ (mağaza payı, vergi ve bölgesel fiyatlar sonrası) ile yalın senaryoda yaklaşık 80.000–110.000 tam sürüm satışıdır.

### 3.3 Risk Kaydı

Olasılık ve etki: **D** = Düşük, **O** = Orta, **Y** = Yüksek.

| ID | Risk | Olasılık | Etki | Önlem | Sahip | Tetikleyici |
|---|---|---|---|---|---|---|
| R01 | Maç hissi NSS'nin "kısa, gergin an" hissine ulaşamaz | O | Y | M0'da his prototipi, 10 kişilik kör karşılaştırma testi, yeterli olmazsa M1'i 4 hafta uzatma | Oyun tasarımcısı | Test puanı < 7/10 |
| R02 | Düşük uçlu Android'de WebView performansı yetersiz | O | Y | İki modlu render, düşük kalite profili, gerekirse PixiJS'e render geçişi (sim ayrık) | Teknik lider | p5 FPS < 26 |
| R03 | Kayıt bozulması veya kaybı | D | Y | Atomik yazma, 3 yedek, fuzz testi, fixture migrasyon testleri, aşamalı dağıtım | Teknik lider | Herhangi bir doğrulanmış kayıt kaybı raporu |
| R04 | Kapsam şişmesi, 1.0'ın 6+ ay gecikmesi | Y | Y | Milestone sonu yeniden puanlama, Beta'da özellik dondurma, P2 → v2 kaydırma | Yapımcı | Alfa çıkışı 4 haftadan fazla gecikirse |
| R05 | Ekonomi dengesi bozulur (NSS NRG enflasyonu, at yarışı istismarı) | O | Y | Gece 10.000 sezon testi, gelir kaynağı payı sınırları, ekonomi botu | Oyun tasarımcısı | Yan gelir > %20 futbol geliri |
| R06 | Yaş derecelendirmesi beklenenden yüksek çıkar (16+/PEGI 16–18) | O | O | Kumarhaneyi isteğe bağlı ve seyrek tasarlama, bölge bayrağı, anket öncesi danışmanlık | Yapımcı | Anket sonucu > 13+ / PEGI 12 |
| R07 | "StarPath" adında marka çakışması | O | O | M0'da tarama, 3 yedek ad, `GAME_NAME` sabiti | Yapımcı | Tarama sonucu benzer kayıt |
| R08 | Gerçek kulüp/marka benzerliği nedeniyle hukuki uyarı | D | Y | Kara liste, kurgusal adlar, DMCA süreci | Yapımcı + hukuk | Hak sahibinden bildirim |
| R09 | Mağaza ret (Apple 4.2 WebView, 3.1.1 IAP) | O | O | Yerel özellikler (haptik, Game Center), restore butonu, kontrol listesi | Programcı (platform) | İlk gönderim reddi |
| R10 | Platform politika değişikliği (hedef API, faturalama) | Y | O | Çeyreklik politika taraması, Capacitor sürüm takibi | Programcı (platform) | Yeni politika duyurusu |
| R11 | Kritik bilginin tek kişide toplanması | O | Y | ADR, ikili kod incelemesi, anahtarların kasada ve iki yetkiliyle tutulması | Teknik lider | Bir kişinin 2+ hafta ulaşılamaz olması |
| R12 | Deneme→tam sürüm dönüşümü düşük | O | Y | Kilidin yerini ve fiyatı test etme, ilk sezonun sonunda güçlü cliffhanger | Yapımcı | Soft launch dönüşümü < %3 |
| R13 | Steam'de görünürlük eksikliği (wishlist yetersiz) | O | Y | Next Fest, demo, klip stratejisi, içerik üreticileri | Pazarlama | Lansmandan 3 ay önce < 5.000 wishlist |
| R14 | Yüksek iade oranı (Steam) | D | O | İlk 2 saatin akışını optimize etme | Oyun tasarımcısı | İade > %10 |
| R15 | Yerelleştirme hataları (Türkçe ek, cinsiyetli dil) | O | O | ICU, ek yardımcısı, anadili konuşan testçi | İçerik yazarı | Beta'da dilsel hata raporu > 20 |
| R16 | Lider tablosu hileleri (v2) | Y | D | Sunucu replay doğrulaması, haftalık sıfırlama | Teknik lider | Doğrulanamayan üst sıralar |
| R17 | Determinizm farkı (platformlar arası replay uyumsuzluğu) | O | O | Sabit nokta aritmetik, çapraz motor CI testi | Teknik lider | Hash uyumsuzluğu |
| R18 | Korsan APK ve klonlar | Y | D | Makbuz doğrulaması, marka tescili, mağaza bildirim süreci | Yapımcı | Klonun mağazada görülmesi |
| R19 | Kur dalgalanması ve nakit sıkışması | O | Y | 3 aylık tampon, USD gelirli destek ve yayıncı alternatifleri | Yapımcı | Nakit < 4 ay giderin altına düşerse |
| R20 | Ekip tükenmesi (crunch) | O | Y | Kapsam esnetme kuralı, sürdürülebilir sprint, lansman sonrası izin planı | Yapımcı | Fazla mesai 3 hafta üst üste |
| R21 | Topluluğun "pay-to-win" algısı (kozmetik IAP yüzünden) | D | Y | Kozmetiklerin sim'e girmediğinin kodda zorlanması, açık iletişim | Yapımcı | Yorumlarda "P2W" ifadesi > %2 |
| R22 | Telemetri veya gizlilik ihlali iddiası | D | Y | Opt-in, veri minimizasyonu, ağ trafiği denetimi | Teknik lider | Kullanıcı şikâyeti / mağaza uyarısı |
| R23 | Sunucu maliyetinin online özelliklerde kontrolden çıkması | D | O | Örneklemeli doğrulama, bütçe alarmı | Teknik lider | Aylık bulut > 400 $ |
| R24 | Yayıncı/destek bulunamaması, bütçe açığı | O | Y | Yalın senaryo planı, kademeli kapsam, Steam erken satış alternatifi | Yapımcı | M2 sonunda finansman < 9 ay |

## 4. Başarı Metrikleri

Aşağıdaki değerler **hedef ve varsayımdır**. Kullanıcı davranışı metrikleri yalnızca **açık onay (opt-in) veren oyunculardan** ölçülür. Onay oranının %35–55 olacağı varsayılmaktadır. Onay veren oyuncular genellikle daha bağlı kullanıcılardır, bu yüzden elde tutma metrikleri gerçek değerin biraz üstünde çıkabilir (seçilim yanlılığı). Bunu dengelemek için mağaza konsollarının (Play Console, App Store Connect, Steamworks) onaysız toplulaştırılmış verileriyle karşılaştırma yapılır. Çökme metrikleri platform konsollarından ve ayrıca onaylı çökme raporlarından okunur.

### 4.1 Elde Tutma ve Etkileşim

| Metrik | Hedef | Ölçüm yöntemi | Alarm eşiği |
|---|---|---|---|
| D1 elde tutma (mobil) | ≥ %45 | Opt-in analitik kohortu + mağaza konsolu karşılaştırması | < %38 |
| D7 elde tutma (mobil) | ≥ %20 | Aynı | < %15 |
| D30 elde tutma (mobil) | ≥ %10 | Aynı | < %7 |
| D1 / D7 / D30 (Steam, satın alan oyuncular) | ≥ %65 / %40 / %22 | Opt-in analitik | < %55 / %30 / %15 |
| Ortalama oturum süresi (mobil) | 12–20 dk | Oturum başlangıç/bitiş olayları | < 8 dk veya > 35 dk (aşırı uzun oturum dengesizlik işareti olabilir) |
| Ortalama oturum süresi (PC) | 35–60 dk | Aynı | < 20 dk |
| Günlük oturum sayısı (aktif mobil oyuncu) | 2,5–4 | Aynı | < 1,8 |
| Tutorial tamamlama | ≥ %85 | Tutorial adım olayları | < %75 |
| İlk maça ulaşma süresi | < 3 dk (medyan) | Kurulumdan ilk maç başlangıcına | > 4 dk |
| İlk sezonu tamamlama (başlayanların) | ≥ %45 | Sezon ilerleme olayı | < %35 |
| 3. sezona ulaşma (tam sürüm sahipleri) | ≥ %55 | Aynı | < %40 |
| Emekliliğe ulaşan kariyer oranı (90 gün) | ≥ %12 | Emeklilik olayı | — (izleme amaçlı) |
| Opt-in telemetri onay oranı (varsayım) | %35–55 | Onay ekranı sonucu (sayaç, kimliksiz) | < %20 (örneklem çok küçük) |

### 4.2 Gelir ve Mağaza

| Metrik | Hedef | Ölçüm yöntemi | Alarm eşiği |
|---|---|---|---|
| Deneme → tam sürüm dönüşümü (mobil) | %4–8 | Mağaza konsolu satın alma / yeni kurulum | < %3 |
| Steam wishlist → ilk ay satış dönüşümü | ≥ %15 | Steamworks raporları | < %8 |
| Steam lansman wishlist | ≥ 15.000 (alt sınır 7.000) | Steamworks | Lansmandan 3 ay önce < 5.000 |
| Steam iade oranı | < %8 | Steamworks | > %10 |
| Steam olumlu yorum oranı | ≥ %90 ("Çok Olumlu" ve üstü) | Steam mağaza sayfası | < %80 |
| Mobil mağaza puanı (App Store + Play) | ≥ 4,7 | Mağaza konsolları | < 4,5 |
| 1★ yorumlarda "kayıt", "reklam", "pay to win" konu oranı | < %5 | Aylık yorum etiketleme | > %10 |
| Kozmetik IAP bağlanma oranı (tam sürüm sahipleri) | %8–15 | Mağaza konsolu | — (izleme amaçlı, baskı aracı olarak kullanılmaz) |

### 4.3 Teknik Kalite

| Metrik | Hedef | Ölçüm yöntemi | Alarm eşiği |
|---|---|---|---|
| Çökmesiz oturum oranı | ≥ %99,8 | Sentry/GlitchTip + Play Vitals + Xcode Organizer | < %99,5 |
| Çökmesiz kullanıcı oranı | ≥ %99,5 | Aynı | < %99,0 |
| ANR oranı (Android, kullanıcı algılı) | < %0,25 (Play'in %0,47 kötü davranış eşiğinin belirgin altı) | Play Console Android Vitals | ≥ %0,40 |
| Kayıt bozulma oranı | < 1 / 100.000 yükleme | Checksum hata olayı (opt-in) + destek talepleri | Herhangi bir doğrulanmış kalıcı kayıp |
| Yedekten otomatik kurtarma başarı oranı | %100 (bozulan kayıtlar içinde) | Kurtarma olayı | < %99 |
| Migrasyon hatası (güncelleme sonrası 72 saat) | 0 | Migrasyon olayı | ≥ 1 → aşamalı dağıtım durur |
| Maç içi FPS (düşük uçlu referans, p5) | ≥ 26 FPS | Opt-in performans örneklemesi | < 24 FPS |
| Soğuk açılış süresi (orta segment Android) | < 4 sn | Otomatik cihaz testi + opt-in | > 6 sn |
| Sezon simülasyonu süresi (düşük uçlu, Worker) | < 2 sn | CI performans testi + opt-in | > 3 sn |
| Uygulama boyutu (AAB / IPA) | < 40 MB / < 60 MB | CI boyut bütçesi | Bütçe aşımı |
| S1 hatalarının kapanma süresi | ≤ 72 saat | Hata takip sistemi | > 5 gün |

### 4.4 Topluluk ve Güven

| Metrik | Hedef | Ölçüm yöntemi | Alarm eşiği |
|---|---|---|---|
| Discord üye sayısı (lansman) | ≥ 5.000 | Discord | < 2.000 |
| Paylaşılan highlight klibi / aktif oyuncu (ay) | ≥ 0,15 | "Klibi kaydet/paylaş" olayı | < 0,05 |
| Destek talebi yanıt süresi | ≤ 48 saat | Destek aracı | > 96 saat |
| SSS ile çözülen talep oranı | ≥ %50 | Destek aracı etiketleri | < %30 |
| Kayıt kaybı destek talebi | Ayda 0 doğrulanmış vaka | Destek aracı | ≥ 1 |

**Değerlendirme ritmi:** Haftalık teknik kalite gözden geçirmesi, iki haftalık elde tutma ve ekonomi raporu, aylık yorum analizi. Her sezon güncellemesinden önce hedefler yeniden kalibre edilir. Metrikler tasarımı yönlendirir, ama "daha fazla para çıkarmak" amacıyla oyuncu deneyimini kötüleştiren hiçbir değişikliği gerekçelendirmek için kullanılmaz.


