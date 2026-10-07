# 01 — Mevcut Oyun Analizi: New Star Soccer (Mobil) + NSS5 (PC) + Kardeş Oyunlar

> Amaç: New Star Soccer (NSS) serisinde bulunan tüm sistemleri, ekranları ve mekanikleri tersine mühendislikle (yalnızca araştırmayla) kataloglamak. Hedef, daha iyi bir halef oyun tasarlamak.
> Yöntem: Fandom wiki'nin (new-star-soccer.fandom.com) API ile çekilen ham wikitext'i, App Store / Google Play açıklamaları ve sürüm notları, Steam mağaza sayfası ve başarım listesi, basındaki incelemeler (PocketGamer, TouchArcade, GodisaGeek, Invision, Gamepressure, FourFourTwo), geliştirici röportajları (Simon Read), forum başlıkları (TouchArcade, Steam), New Star Manager ve Retro Goal rehberleri.
> Araştırma tarihi: 2026-10-07.
>
> **Güven etiketleri:**
> - **[D]** Doğrulandı: birincil veya güçlü bir kaynakta açıkça geçiyor.
> - **[T]** Topluluk kaynağı: wiki, forum ya da oyuncu yorumunda geçiyor; oyun içinde birebir doğrulanmadı.
> - **[Ç]** Çıkarım: dolaylı kanıta dayanan tahmin.
>
> Her bölümün sonunda **Bilinmeyen/Doğrulanamayan** notları var.

---

## 0. Seri Özeti ve Sürüm Tarihçesi

| Sürüm | Yıl | Öne çıkanlar |
|---|---|---|
| NSS 1 | Haziran 2003 | Metin tabanlı maç anlatımı, karar odaklı oynanış [D] |
| NSS 2 | 2004 | Aynı model, metin anlatımı [D] |
| NSS 3 | 2005/06 | Klavye, joystick ya da gamepad ile doğrudan oyuncu kontrolü, 2D. GameTunnel "Yılın Spor Oyunu", PC Zone "Ayın Indie Oyunu" [D]. Simon Read bu oyunun geliriyle tam zamanlı bağımsız geliştiriciliğe geçti [D]. |
| NSS 4 / NSS 2010 | 7 Kasım 2008 | 360° kontrol, 3D grafik, 30.000+ oyuncu, 3.000 takım ve stadyumdan oluşan veritabanı. GameTunnel "Yılın Spor Oyunu" [D] |
| NSS 5 (PC/Mac) | Ağustos 2011 (Steam: 27 Eylül 2012) | 2D'ye dönüş, yeni maç motoru. Freemium: ücretsiz hesapta günde 3 maç (kayıtta 5 bonus maç), Premium hesap 20 $ ile sınırsız maç. Takım arkadaşları gerçek oyuncuların yarattığı karakterlerden rastgele seçiliyor. Online sıralama [D] |
| NSS Mobil (iOS/Android) | 2012 | "Kritik anlar" (highlight) tabanlı maç. 2012'de App Store'da 1 numara, 2013'te BAFTA (Spor/Fitness) ödülü [D] |
| Mobil 1.4 civarı | 2012–13 | Ortalar, kornerler, sekmeler ve dönen toplar, maç sonu röportajları, kulüp geçmişi kaydı; reyting sistemi yumuşatıldı, 5-5 gibi skorlar azaltıldı [D] |
| Mobil 1.5 | Eylül 2013 | Kadın oyuncu, kafa vuruşu, gece maçları, hücum/denge/savunma odağı, emeklilik ve kariyer skoru, ajan ve antrenör, NRG Bolt, yeni kramponlar (Swerve), yeni yaşam eşyaları (dövme, telefon, bilardo masası, oyun konsolu), 3 kayıt slotu, stadyum boyutları, yeni ikilemler, ödüller (Yılın Oyuncusu vb.), kilidi açılan Zor mod, yetenek erimesi, savunmacıların şut nişanı sırasında üstüne gelmesi [D] |
| Mobil (2014) | 2014 | Form sistemi ("klasik 10 numara", "orta saha maestrosu", "ölümcül bitirici" gibi oyun stili etiketleri), Practice modunda ödül ve ilişki takviyesi, kramponları dükkânda deneme, yeni başarımlar, transfer değeri, Game Center lider tablosu [D] |
| Mobil (kaptanlık güncellemesi) | 2014–15 | Kaptanlık: daha çok röportaj, sözleşme bonusu, takım arkadaşlarına koşu yönü verme. Ofsayt eklendi [D] |
| Mobil (Pro License kaldırıldı) | 2015 civarı | PACE antrenmanı ve maçlarda "intercept" görevinin yerini dribbling aldı. Pro License kısıtı kalktı, oyun tamamen ücretsiz oldu. Oyuncu yaratırken ten rengi seçimi kaldırıldı [D] |
| Mobil 2.0 | 27 Eylül 2016 | Tam grafik yenilemesi: 3D oyuncu modelleri, yeni menüler, hava efektleri, tekrar (replay) sistemi, FourFourTwo sponsorluğunda haberler. "Classic" retro görünüme istendiğinde geçilebiliyor [D] |
| Mobil 2.11–2.14.3 | 2017–2018 | Gol ağı fiziği, Facebook'ta görsel paylaşma, 2017/18 verisi, at isimleri (Facebook ve Goal.com okurlarından), kornerde ofsayt düzeltmesi [D] |
| Mobil 2.15–2.29+ | 2019–2025 | Güvenlik ve gizlilik güncellemeleri, ödüllü reklam düzeltmeleri, 2025/26 verisi, ECL ve EUROPE2/3 grup düzeltmeleri. Oyun hâlâ güncelleniyor [D] |
| Spin-off'lar | 2016+ | New Star Soccer G-Story (iOS, kendi maceranı seç), New Star Cricket (2016), New Star Manager (2019), New Star Baseball (2020), Retro Bowl (2020), Retro Goal (2021), Retro Slam Tennis (2024), New Star GP (2023) [D] |

- Motor: Monkey X (çapraz platform dili) [T]. Mobil uygulamanın wiki'deki sürümü 2.14 [T].
- Ölçek: NSS ~10 milyon indirme; diğer spin-off'lar toplam ~3 milyon [D]. Google Play'de 30.000+ yorum, ortalama 4.7; App Store açıklamasında 200.000+ yorum, ortalama 4.6 [D].
- Tasarım felsefesi (Simon Read): "Zaten yapılmış bir şeyi yapmanın anlamı yok." FIFA (aksiyon) ile Football Manager (yönetim) arasındaki boşluk hedeflendi. Futbolun "pembe dizi" tarafı sahadaki oyun kadar önemli tutuldu. İlham kaynakları: "Footballer of the Year", "Player of the Year", Sensible Soccer, Championship Manager ve 90'ların Beckham ünlülük kültürü. Mobilde ekran joystick'i yerine "basit fiske/vuruş" kontrolü seçildi. NSS4'ün aşırı hırslı 3D ve prosedürel sistemleri, mobil için bilinçli olarak sadeleştirildi [D].
- Read'in bir NSS2 için düşündükleri: sahayı pinch ile tümüyle görme (daha uzun paslar), verilen pası aynı hamlede geri alma (ver-kaç), ilişki barlarının yerine "daha derin", karmaşık yaşam kararları [D]. **Halef için doğrudan tasarım ipucu.**

**Bilinmeyen/Doğrulanamayan:** NSS1–4'ün ayrıntılı mekanikleri bu rapora alınmadı. G-Story'nin içeriği araştırılmadı.

---

## 1. Kariyer Başlangıcı ve Karakter Yaratma

### 1.1 Mobil NSS
1. Başlangıç yaşı her zaman **16** [D].
2. **Ülke seçimi.** Kariyer, seçilen ülkenin **en alt (oynanabilir) ligindeki** bir kulüpte başlar [D]. Örnek: Portekiz D2'den başlayan oyuncu [T].
3. **İsim** girilir [D].
4. **Cinsiyet:** Erkek ya da kadın (1.5'ten beri) [D]. Ana ekranda isim yanındaki cinsiyet simgesine dokunularak istenildiği zaman, istenildiği kadar değiştirilebilir. Bu durumda partnerin cinsiyeti de değişir, yani eşcinsel ilişki mümkün değil [T]. Kadın kariyerinde yorumcunun yine "he" demesi şikâyet konusu [D].
5. **Ten rengi** seçimi bir güncellemeyle kaldırıldı [D].
6. **Zorluk:** Normal ve Hard. Hard başta kilitliydi, sonra açılabilir oldu [D].
7. **Kayıt slotu:** 3 [D].
8. **Mevki:** Mobilde pratikte hücum odaklı tek bir rol var: gol, asist ve pas. Kullanıcı yorumlarında "defans veya kaleci olarak oynama seçeneği ekleyin" isteği geçiyor [D]. Bu da mevki seçimi olmadığını gösteriyor.
9. Kariyer **Practice modu** ile birlikte geliyor. Practice'te ödül ve ilişki takviyesi kazanılabiliyor, dükkândaki her krampon denenebiliyor [D].
10. Eski sürümde ücretsiz kısım "Arcade" moduydu, kariyer IAP ile açılıyordu (0.99 $ / 69p). Android'de "profesyonel olmak" 68p'ydi. Pro License olmadan transfer ve sözleşme pazarlığı yoktu [D]. Bu kısıt sonradan tümüyle kaldırıldı.

### 1.2 NSS5 (PC)
1. 16 yaşında başlangıç; **mevki ve kulüp seçimi** var, ikisi de sonradan değiştirilebilir [D].
2. Lisans olmadığı için kulüp adları kısaltma ya da bozma: "Man U", "Chels" [D].
3. Kariyer başlatırken ve ücretsiz hesapta her maçta internet gerekir. Premium hesap 50 maçta bir online doğrulama ister ve oyuncu global veritabanına kaydedilir [D].

**Bilinmeyen/Doğrulanamayan:** Mobilde forma numarası, görünüm (saç, yüz) özelleştirmesi var mı, net değil. Bir kullanıcı "oyuncu karakterinin görünür olmasını" istiyor; bu, karakterin sahada ayırt edilemediğini düşündürüyor [Ç]. Başlangıç kulübünün nasıl seçildiği (rastgele mi, deneme maçı mı) tam olarak bilinmiyor. "Training ground'a git ve ilk sözleşmeni kazan" ifadesi [D], ilk sözleşmenin antrenman ya da deneme sonrası geldiğini düşündürüyor.

---

## 2. Yetenekler (Skills), Puanlama ve Antrenman

### 2.1 Mobil NSS: 5 Yetenek [D]
| Yetenek | Maçtaki etkisi | Antrenman mini oyunu |
|---|---|---|
| **PACE** | Dribbling hızı ve kontrolü, rakibi geçme; eskiden pas kesme (intercept) şansı. Üst liglerde dribbling mini oyunu yüksek Pace olmadan neredeyse geçilemez [D] | Koniler arasında topu konilere çarptırmadan sürme; ilerleyen seviyede süre sınırı [T]. (Eskiden: pas kesme) |
| **POWER** | Şut ve uzun pas gücü. Nişan okunun maksimum boyunu artırdığı düşünülüyor [T] | Kaleciye karşı topu ağlara gönderme; ilerleyen seviyede **rüzgâr** [T] |
| **TECHNIQUE** | Pas ve şut isabeti, falso (bend/curve), aşırtma ve düşen top (chip/dip) [D/T] | İki direk arasındaki boşluktan topu geçirme; direğe çarpmak ya da ıskalamak başarısızlık. Rüzgâr var [T] |
| **VISION** | Daha çok ve daha iyi pas seçeneği (daha fazla takım arkadaşı görme), ofsayttaki oyuncuyu fark etme [D/T] | Sahadaki metal mankene topu isabet ettirme; rüzgâr [T] |
| **FREE KICKS** | Serbest vuruş ve penaltılarda başarı; daha çok duran top fırsatı [T] | Kaleci ve sahte oyunculardan baraj; rüzgâr "büyük rol oynar" [T] |

- **Yıldız puanlama:** Her antrenman 1–3 yıldızla sonuçlanır; yıldız sayısı başarısız deneme sayısına bağlıdır. Bir antrenmanda **3 kez başarısız** olunursa yetenek artmaz [T].
- **Yetenek erimesi (1.5+):** Yetenekler zamanla düşer; yaş ilerledikçe daha sık antrenman gerekir [D]. Her yeteneğin bir "zamanlayıcısı" var. Başarısız antrenman zamanlayıcıyı sıfırlamaz, ama yetenek NRG içeceği (mavi, altın, siyah) sıfırlar [T]. Antrenör, bir yetenek puanı kaybedilmeden önce uyarır [T].
- **Yetenek reytingi (%):** Hepsini maksimuma çıkarınca "100% skill rating" başarımı [D].
- **Ek beceri reytingleri:** Başarım listesine göre ayrıca Short Passing, Long Passing, Finishing, Long Shots, Headings, Crossing, Set-Pieces ve Dribbling için "maksimum reyting" var [T]. Bunlar büyük olasılıkla 2014'te gelen **form / oyun stili** sisteminin alt ölçümleri: "Her şut ve pas formunuza işler; klasik 10 numara, orta saha maestrosu, ölümcül bitirici..." [D/Ç].
- Antrenman **enerji** harcar. Trainer bu maliyeti %15/20/25 düşürür [T].
- Seviye ilerledikçe zorluk artar: üst ligde kaleciler daha reaktif, rüzgâr ve savunmacı sayısı artıyor, hedef desenleri zorlaşıyor [T].

### 2.2 NSS5: 7 Yetenek [D, Steam başarımlarından]
**Pace, Flair, Dribbling, Passing, Shooting, Heading, Tackling.** Her biri için "Maximum ..." başarımı ve "100% Skill" başarımı var. Antrenman sahada mini meydan okumalarla yapılır [D].

### 2.3 Star Rating (Yıldız Seviyesi)
- Oyuncunun genel seviyesi. Wiki'deki tablolar SR1–SR15'e kadar uzanıyor [T]; forumda "star level 11" ifadesi geçiyor [T].
- Maç reytingindeki Boss, Team ve Fans bileşenlerinden etkilenir [T].
- Ücret yaklaşık olarak yıldız seviyesine eşit. Örnek: SR11'de maç başı ~13–14 [T].
- **NRG fiyatları ve ajan/antrenör ücretleri SR ile artar**, yaşam eşyalarının fiyatı ise sabit kalır [D, FourFourTwo / geliştirici ipuçları].

**Bilinmeyen/Doğrulanamayan:** Yetenek değerlerinin sayısal ölçeği (0–100 mü, adım sayısı mı) net değil. Krampon bonusları (+40) yüzlük bir ölçeği ima ediyor [Ç]. SR'nin tam formülü ve üst sınırı (10 mu, 15 mi, sınırsız mı) bilinmiyor. Erimenin hızı ve yaşa bağlı eğrisi sayısal olarak bilinmiyor.

---

## 3. Maç Motoru

### 3.1 Mobil: Highlights (Kritik An) Modu [D]
1. Maç, **kayan bir metin akışı** (commentary ticker) olarak ilerler. Top size geldiğinde ya da size bir fırsat düştüğünde oyun **üstten görünümlü** etkileşimli sahneye geçer.
2. Maç başına "birkaç" fırsat ("chances") düşer. Takım arkadaşı ilişkisi yüksekse daha fazla fırsat gelir [T/D].
3. Sahne tipleri:
   - Pas (ara pas dahil)
   - Şut
   - **Pas kesme (intercept):** sonradan dribbling ile değiştirildi
   - **Dribbling**
   - Serbest vuruş
   - Penaltı
   - Orta ve **korner** (asist ve doğrudan korner golü mümkün)
   - **Kafa vuruşu** (1.5+)
   - **Sekme ve dönen top (rebound)**
   - Kaptanken takım arkadaşını koşturma
4. **Kontrol:** Topun üzerinden **geriye doğru sürükle** (sapan mantığı); sürükleme yönü açıyı, uzunluğu gücü belirler. Eski sürümde ikinci bir ekrana geçilir ve topun **neresine dokunulduğu** güç, falso (swerve) ve yüksekliği (lift) belirler. Topa aşağıdan ve az güçle vurmak aşırtma (chip) yapar [D]. Fare sürümünde: "Fareyle nişan al, sonra vur" [D].
5. **Swerve (havada falso):** Premium kramponlarla (SWERVE) şutu attıktan sonra parmağı kaydırarak topu havada bükme (aftertouch). Swerve ve Control özellikleri krampona bağlı [D/T].
6. **Control** özelliği (CONTROL kramponları) top kontrolü sağlar [T]. Tam işlevi net değil.
7. **Savunmacılar** nişan alırken üzerinize gelir (1.5+). Rakip yaklaşana kadar beklemek boşluk açabilir ya da aşırtmaya fırsat verir [D].
8. **Kaleciler "ray üzerinde":** Tek eksende (sağ-sol) hareket eder, davranışları tahmin edilebilir. Yavaş bir yan pasla kaleci dışarı çekilip arkadaşa boş kale bırakılabilir [T].
9. **Penaltı:** Kaleci her zaman bir tarafa atlar, bu yüzden ortaya, yerden, düşük-orta güçte vuruş güvenli. Penaltıda topu geriye arkadaşa pas vermek de mümkün; kaleci çıkar, arkadaş boş kaleye atar [T].
10. **Ofsayt:** Pas hedefi ofsaytta olabilir. Vision bunu görmeyi kolaylaştırır. Kaptan oyuncuları geri çekebilir. Kornerde ofsayt hatası 2.14.3'te düzeltildi [D].
11. **Oyun odağı:** Hücum, dengeli ya da savunma. Maç içi enerji ve rol üzerinde etkili [D].
12. **Hava ve zemin:** Rüzgâr, yağmur (2.0'da ses efektli), gece maçları, farklı stadyum boyutları; "Pitch & Weather Pack" IAP [D].
13. **Tekrar (Replay)** (2.0+): Golü, zaman çizelgesinde ileri-geri sararak izleme; sayaç bitmeden butona basmak gerekir [D].
14. **Önceden belirlenmiş sonuç iddiası:** Topluluk, maç sonuçlarının önceden belirlendiğine inanıyor; takım arkadaşının direğe vurması "kazanamayacaksın" işareti sayılıyor. Uygulamayı kapatıp maçı yeniden oynamak bir istismar yöntemi [T]. Kullanıcı yorumu: "3–4 fırsatım olduğu hâlde kaybettiğim maçlar var" [D].
15. **Maç sonu ekranı:** Final skoru, reytingler, Star Man, röportaj, sözleşme bildirimi, ödeme (PAY) ve istatistik ekranları var (wiki görsel isimleri: FINAL SCORE, STAR MAN, INTERVIEW, CONTRACT AFTER MATCH, PAY, STATS, TABLE, FIXTURES) [T].

### 3.2 Maç Reytingi ve Star Man
- Her maçta **Boss, Team ve Fans** için **-5 ile +5** arasında reyting [T].
- Reytingi besleyen 4 faktör: **Fırsatlar (Chances), Goller, Asistler, Paslar** [T].
  - Pas ve asist → Team ilişkisi.
  - Fırsat sayısı ve galibiyet/beraberlik → Fans.
  - Gol → Boss; ayrıca milli takım hocasının dikkati.
- Eskiden gol atmamak sert cezalandırılıyordu; bir güncellemeyle yumuşatıldı [D].
- **Star Man** (maçın oyuncusu) ödülü; 1/10/25/50 ve sezonda 20 Star Man başarımları [D]. "Arka arkaya 5 maksimum maç reytingi" başarımı da var [D].
- Patron her 10 golde 1 coin ödüyor (wiki iddiası) [T].

### 3.3 NSS5 Maç Motoru (PC) [D]
- 2D, üstten, tam 90 dakikalık gerçek zamanlı maç; siz tek oyuncuyu kontrol ediyorsunuz.
- Kontrol: Yön tuşları ile koşma. Varsayılanda tek tuş (Z) top çağırma, pas, top kapma (tackle), kafa ve şut işini görür. Gelişmiş modda üç tuş: **Shoot, Pass, Lob**. Topsuzken **pas isteme** ya da **kayarak müdahale (sliding tackle)**. Tek dokunuş hızlı pas veya şut; basılı tutup nişan almak güç ve yön verir. "Simple control" tek tuş seçeneği var. Kablolu Xbox 360 gamepad öneriliyor; aftertouch ile falso gamepad'de daha iyi [D/T].
- **Ofsayt:** Ofsayttayken kafanızın üzerinde bayrak yanıp söner, hocanız bağırır. Ofsayt durumu siz geri dönene kadar sürer [D].
- Hoca maç içinde çizgi roman tarzı **konuşma balonlarıyla** geri bildirim verir [D].
- **Gol sevinçleri:** Taraftara, kameralara, hocaya (bench) koşma ya da topu orta yuvarlağa götürme (takım). Her biri ilgili ilişkiyi etkiler [D].
- Maç ayarları: maç hızı, **devre süresi** (örn. 7 dakikalık devreler) [T].
- Başarımlar: Clean sheet, 5/10/15 tackle, 10/20/30 pas, 20 m'den gol (Great Strike), 30 m'den gol (Super Strike) [D].
- Şut taktiği: "Kaleciyi çizgisinden çıkar, uzak direğe yaklaşık %75 güçle bitir" [T].
- Maça ne kadar katılacağınızı enerji, hoca memnuniyeti ve sakatlık belirler [D].
- Maç sonu: Kırmızı ve sarı kartlar NSS5'te büyük olasılıkla var (tackle mekaniği) [Ç].

### 3.4 Kartlar, Sakatlık, Hakem
- Mobil: Kart sistemine dair net bir kaynak yok. Oyuncu müdahale yapmadığı için (intercept dışında) muhtemelen yok [Ç].
- Sakatlık: NSS5'te sakatlık yeteneği ve uygunluğu etkiliyor; "Pain Killers" (ağrı kesici) satın alınabiliyor [D]. Mobilde aşırı yüklenmenin sakatlığa yol açtığından söz ediliyor [T, düşük güven].
- Enerji içecekleri NSS5'te maçın en kötü anında **mide krampı** yapabilir [D].

**Bilinmeyen/Doğrulanamayan:** Mobilde maç başına fırsat sayısının formülü bilinmiyor; Team ilişkisi, odak modu ve enerjiye bağlı olduğu düşünülüyor. Kart, sarı/kırmızı ya da hakem mekaniği mobilde doğrulanamadı. Mobil sakatlık süreleri bilinmiyor. "Control" kramponunun işlevi tam bilinmiyor. Kafa vuruşu kontrolü mobilde ayrıntılı belgelenmemiş. Sonucun "önceden belirlenmesi" iddiası resmî olarak doğrulanmadı.

---

## 4. İlişkiler

### 4.1 Mobil: 5 İlişki Barı + Mutluluk [D/T]
| İlişki | Nasıl artar | Eşik ve etki |
|---|---|---|
| **BOSS** (Hoca/Menajer) | Gol, efor, iyi maç, ikilemlerde doğru seçim | %100 ile %55 arasında fark yok. **%50'nin altında yedek**, **%10'un altında kadro dışı** [T]. Başarısız sözleşme pazarlığı **-%20** [T]. Kumarhaneye takım arkadaşlarıyla gitmek ve reşit değilken yakalanmak düşürür [T] |
| **TEAM** (Takım arkadaşları) | Pas ve asist; alışveriş davetlerine katılmak (eşya yükseltme ya da onarım da sayılır) [D] | Yüksek Team = maçta **daha fazla fırsat** [T/D]. Erken kariyerde en önemli ilişki [D] |
| **FANS** (Taraftar) | Fırsat değerlendirmek, galibiyet/beraberlik [T] | Sponsorluk ve şöhretle bağlantılı [T] |
| **SPONSORS** | Performans, yaşam tarzı eşyaları [D] | **1/3'ün altında sözleşmeyi iptal ederler** [T]. Önerilen: 60'ın üstünde tutmak [T] |
| **GIRLFRIEND/BOYFRIEND** (Partner) | İlişki mini oyunu, lüks yaşam (jet-ski, ev vb. partner çeker) [D/T] | Çok düşerse "öfke krizine girip" BOSS ilişkisini mahvedebilir [D]. Sıfıra çok yaklaşmadıkça ayrılmaz [T]. Topluluk tavsiyesi: "Partner edinmeyin, sadece sorun çıkarır" [T] |

- **Genel Mutluluk (Happiness):** İlişkiler ve **Lifestyle reytingi**nden beslenir. Düşük mutluluk olumsuz gazete haberlerine ve (doğrulanmamış) maçta daha çok enerji tüketimine yol açar [T]. "%100 Happiness" başarımı var [D].
- **Öncelik sırası (topluluk):** Boss >%50 iken Team > Boss > Fans; Boss <%50 iken Boss > Team > Fans; Sponsors >1/3; partner en sonda [T].
- **İlişki mini oyunu:** **Eşleştirme (memory, kart çevirme).** Simgeler gösterilir, ters çevrilir, karıştırılır, sonra çiftler bulunur. Epey enerji harcar [D]. Hile: ekran görüntüsü almak [T].
- **Milli takım hocası** ayrı bir ilgi ölçüsü: yüksek seviyede, rekabetçi bir ligde oynamak gerekir [D]. Sponsorlar da milli hocadaki itibarı etkiler [T].

### 4.2 NSS5: 8 İlişki/Katsayı [D]
Steam ve Gamepressure'a göre: **Boss, Team, Fans, Friends, Girlfriend, Sponsors** + **Fame** (şöhret, "100% Fame" başarımı) + **Lifestyle**; ayrıca genel **Happiness**. Kesin 8'li liste mağazada "boss, fans, girlfriend and sponsors dahil 8 ilişki" diye geçiyor. "Arkadaşlarla vakit geçirmek", "at yarışı", "pub" (partner bulma şansını artırır), "taraftarla vakit geçirmek", "hoca toplantılarına gitmemek (hocayı kızdırır)" gibi sosyal eylemler var [D].

**Bilinmeyen/Doğrulanamayan:** Mobilde evlilik, çocuk ya da aile mekaniği **bulunamadı**; yalnızca "girlfriend/boyfriend/partner" var. "Aile" ilişkisi NSS'de doğrulanmadı. NSS5'in 8 ilişkisinin kesin listesi doğrulanamadı (Friends, Fame ve Lifestyle'ın sayıma girip girmediği belirsiz). Barların sayısal artış/azalış miktarları bilinmiyor; yalnızca -5..+5 maç reytingi biliniyor.

---

## 5. Enerji, Para ve Yaşam

### 5.1 Enerji (NRG) [D]
- Her şey enerji harcar: antrenman, ilişki mini oyunu, alışveriş, sosyal aktiviteler, kumar ("kumar enerjiyi yavaşça tüketir") ve maçlar [D/T].
- Maça çıkmak için yeterli enerji gerekir. Ana ekranda enerji düşükken **"Substitute" (yedek) barı** görünür [T]. Yorgunken hoca kadroya almaz ve ilişki düşer ("çok parti yapıyor") [T].
- Maç sonrası toparlanma: **Mülkler (properties) toparlanmayı artırır**, Trainer +%15/20/25 ekler [D/T].
- Ödüllü video ile ücretsiz enerji [T].
- İpucu: Enerji %45–60 civarındayken önce antrenman yap, sonra NRG iç; böylece içecek israf olmaz [T/D].

### 5.2 NRG İçecekleri (Mobil) [T, wiki]
| İçecek | Etki | Fiyat |
|---|---|---|
| NRG Classic | %100 enerji | **3×SR − 1** (SR1=2, SR2=5 … SR10=29) |
| NRG Skills (mavi) | %100 enerji + 1 yetenek takviyesi | **5×SR − 1** (SR1=4 … SR10=49) |
| NRG Charm | %100 enerji + 1 ilişki takviyesi | 5×SR − 1 |
| NRG Gold | %100 enerji + 1 ilişki + 1 yetenek | **7×SR − 1** (SR1=6 … SR10=69) |
| NRG Bolt (siyah) | %100 enerji + 3 ilişki + 3 yetenek | IAP £0.99; 4'lü paket £2.99 |

- Altın kural: **SR2'ye çıkmadan önce mümkün olduğunca çok Classic stokla** (geliştiricinin kendi önerisi) [D].
- NSS5 tüketilebilirleri: **NRG içecekleri, Booze (alkol), Pain Killers (ağrı kesici), Boots, Shin Pads (tekmelik)** [D]. Ayrıca deplasman yolculuğunda enerji toplamak için **oyun, film, müzik** alınabiliyor [D]. Enhancer'lardan da söz ediliyor [D].

### 5.3 Kramponlar (Mobil) [T]
| Krampon | Pace | Power | Technique | Maç süresi | Özellik | Fiyat (SR1) |
|---|---|---|---|---|---|---|
| NS-Pure | +5 | +5 | +5 | 5 | — | 3 |
| TRU-Carnivore | +10 | +5 | +10 | 7 | — | 5 |
| TRU-Hunter | +15 | +20 | +20 | 15 | — | 30 |
| NS-Cortex | +20 | +20 | +15 | 15 | — | 30 |
| K1K-Uzi | +25 | +25 | +25 | 25 | — | 100 |
| CONTROL Mk2 | +20 | +20 | +20 | 30 | Control | 400 |
| SWERVE Mk1 | +30 | +30 | +30 | 45 | Swerve | ? |
| CONTROL Mk3 | +40 | +40 | +40 | 100 | Control | £0.99 |
| SWERVE Mk2 | +40 | +40 | +40 | 100 | Swerve | £0.99 |
| CONTROLSWERVE | +40 | +40 | +40 | 150 | İkisi birden | £2.99 |

- App Store IAP isimleri: NS CNTRL v4 £0.99, NS SWRV v1 £0.99, NS SWRV v2 £2.99 [D]. Oyuncu tanıklığı: "70 bux'a 40 maç boyunca +40" [T].
- Kramponlar dükkânda/Practice'te denenebilir; geliştirici Swerve'ü öneriyor: "kendini amorti eder" [D].
- NSS5'te kramponlar ve tekmelikler birkaç maçlık stat artışı verir [D].

### 5.4 Para, Maaş ve Banka
- Mobil para birimi: **"bucks/bux/coins"** (oyun içi) ve **Star Bux / Starbux** (premium, IAP ile alınır, video ve tekliflerle bedava kazanılabilir) [D]. Mobil sürüm gerçekçi para değerleri kullanmıyor; NSS5 kullanıyordu ($1M transfer, $25M banka başarımları) [D/T].
- Gelir kaynakları: maç başı **ücret (wage)**, **gol bonusu**, **asist bonusu**, sponsorluklar, kaptanlık (+1), at yarışı, kumar, Practice ödülleri, milli maç ücretleri [D/T].
- "Bankada 10.000 bux" başarımı (mobil), "$1M / $10M / $25M bankada" başarımları (NSS5) [D]. Ayrı bir faiz ya da yatırım sistemi **bulunamadı** [Ç].
- Kullanıcı şikâyeti: NRG fiyatları SR ile katlanırken ücret aynı hızla artmıyor; NRG neredeyse bir ev fiyatına çıkıyor [D]. **Halef için ekonomi dengesi uyarısı.**

### 5.5 Yaşam Tarzı (Lifestyle) Eşyaları (Mobil) [T, wiki; fiyatlar sabit, D]
**Eşyalar (20):** Tattoo 5 (yıpranmayan tek eşya; erkekte üst kol, kadında bel), Phone 10, Game Console 15, Music Player 20, Pool Table 25, Arcade Machine 30, TV 35, Tablet 40, Pinball Table 45, Designer Suit/Dress 50, Laptop 55, Jukebox 60, Silver Chain 65, Gold Ring 70, Cufflinks/Earrings 75, Watch 80, Home Cinema 85, Art Sculpture 90, Antique Furniture 100, Painting 150.

**Araçlar (20):** Bicycle 10, Hang Glider 20, Scooter 30, Jet Ski 40, Small Car 50, Sailing Boat 60, Fishing Boat 70, Motorbike 80, SUV 90, Hot Air Balloon 100, Sports Car 110, Hover Car 120, Big Rig 130, Limo 140 (kadın karakterde pembe), Helicopter 150, Yacht 175, Private Jet 200, Tank 250, Racing Car 500, Jet Fighter 1000.

**Mülkler (20):** Apartment 25, Bungalow 50, House 75, Cabin 100, Town House 150, Cottage 200, Beach House 250, Holiday Villa 300, Café 400, Ski Chalet 500, Farm 600, Windmill 650, **Stable 700** (yarış atı almayı açar, at sayısı sınırsız; 49+ doğrulanmış), Mansion 800, Vineyard 900, Castle 1000, Hotel 1250, Private Island 1500, Shopping Mall 2500, Sky Scraper 5000.

- Toplam 60 eşya; "tüm eşyalar / tüm araçlar / tüm mülkler / %100 Lifestyle" başarımları var [D].
- **Yıpranma ve onarım:** Eşyalar zamanla yıpranır (dövme hariç). "Repair All" seçeneği var; tamamen bozulduktan sonra yeniden almaktan çok daha ucuz [T].
- **Bonuslar:** Lifestyle reytingi → mutluluk; sponsor çekme ("sponsor gelmiyorsa yeterli lifestyle eşyan yoktur") [D]; mülkler → toparlanma [D]; partner çekme [T]; giyim ve stil → gazetelerde "style moron" gibi manşetler [D].
- Fiyatlar seviyeyle artmadığı için geliştirici "erken harcamayın, lüks yaşam sonra" diyor [D].

### 5.6 Kumar, Casino ve At Yarışı [T/D]
- **Casino'ya kendiniz gidebilirsiniz** ya da takım arkadaşları davet eder. Arkadaşlarla gidildiğini öğrenirse hoca kızar [T].
- **18 yaş altı** (ilk 2 sezon) güvenlik yakalayıp atar → hoca öfkelenir; geliştiriciye göre "cezalar çok ağır" [D/T].
- Uzun süreli ya da yüksek bahisli kumar → gazetelerde **"kumar bağımlısı"** manşeti → Boss, Fans ve Partner ilişkileri tehlikeye girer [T].
- Bahis miktarları: **1, 2, 5, 7, 10, 15, 25, 50** [T].
- **Blackjack:** Krupiye soft-17'de durur (oyun içi yardım yanlışlıkla "16" der); blackjack 1:1 öder, kazanınca 2× geri; berabere biten blackjack kazandırır; **5-kart Charlie**; double ve split yok. Optimal oyunda beklenen getiri ×0.998562, yani kayıp [T].
- **Rulet:** Amerikan (0 ve 00). Kırmızı/Siyah 1:1, 1-12 / 13-24 / 25-36 2:1, Yeşil (0/00) 17:1 [T].
- **Slot:** 3 makara, 8 simge; çift 2:1, üçlü (Jackpot) 6:1. Topluluğa göre **pozitif beklenen değerli** [T].
- **At yarışı:** 6 at; oranlar atın gücüne göre değişir; yalnızca birinci kazandırır; ödemeler ~$2 (1:1) ile ~$11 (10:1) arası [T].
- **Kendi atın:** Stable (700) + at (~100). Atlar yıldızlı (1–5), antrenmanla yıldız atlatılabilir, yarıştıkça yorulur, masraf çıkarmaz. Kendi atınla 1. olmak **100**, 2. olmak 50, 3. olmak 25 [T]. Bir oyuncu 40 adet 4–5 yıldızlı atla 5–6 maçta bir ~4000 kazandığını yazıyor [D, kullanıcı yorumu]. Atlara Facebook ve Goal.com okurlarının seçtiği isimler verildi [D].
- NSS5'te de Blackjack, Roulette, Slots ve at yarışı ile at sahibi olma var [D].

### 5.7 Personel: Ajan ve Antrenör (Mobil) [T]
| Tür | Seviye | Süre (maç) | Etki | Ücret |
|---|---|---|---|---|
| Agent | Amateur | 50 | Ücret, gol bonusu, asist bonusu ve sponsorluk +%10; transferde imza parası 1× ücret; zam zamanını bildirir | 30 + 5×(SR−1) (SR1=30 … SR10=75) |
| Agent | Pro | 100 | +%20; imza parası 2× | £1.99 |
| Agent | Expert | 150 | +%30; imza parası 3× | £3.99 |
| Trainer | Amateur | 50 | Maç sonu toparlanma +%15, antrenman enerjisi −%15, erime uyarısı | 30…75 |
| Trainer | Pro | 100 | +%20 / −%20 | £1.99 |
| Trainer | Expert | 150 | +%25 / −%25 | £3.99 |

- Ajan bonusu 1'den küçük çıkarsa 1'e yuvarlanır; ücret 1 iken ajan geliri fiilen ikiye katlar [T].
- Sözleşmeler bitince yenilemek "ciddi nakit" ister [D].

**Bilinmeyen/Doğrulanamayan:** Yat, jet ve ada dışında evcil hayvan **yok**; at tek "hayvan". Poker **yok**; casino 4 oyundan ibaret (Blackjack, Roulette, Slots, Horses). Eşyaların lifestyle puanına katkısı ve yıpranma hızı sayısal olarak bilinmiyor. Mülklerin toparlanmaya katkısının formülü bilinmiyor. NSS5'te ev, araba ve eşya listeleri doğrulanmadı ("All Luxury Items / All Vehicles / All Properties" başarımları kategorilerin var olduğunu gösteriyor).

---

## 6. Sözleşme, Transfer, Kulüp ve Kariyer

### 6.1 Sözleşme (Mobil) [T]
- İlk sözleşme: **Ücret 1, gol bonusu 1, asist bonusu 0** [T].
- **Pazarlık = Hi-Lo mini oyunu.** Değerler 1–11, en fazla 4 tahmin. İstediğin an "Finalise Negotiations" ile o ana kadarki kazancı alabilirsin. Başarısızlık **Boss −%20** ve görüşmenin iptali demek [T].
- Ödül tablosu (kümülatif): 1 doğru → yok; 2 → +1 ücret; 3 → +1 ücret, +1 gol bonusu; 4 → +2 ücret, +1 gol, +1 asist [T].
- Başlangıç sayısı 1, 2, 10 ya da 11 ise risk düşük [T].
- Teklifler önceki sözleşmeye değil **yalnızca SR'ye** bağlı [T].
- Yeniden pazarlık için şartlar: hocayla aranın iyi olması, yakın zamanda pazarlık yapmamış olmak, SR'nin artmış olması. Hoca hazır değilse ilişki biraz düşer ve şartını açıkça söyler [D].
- SR2'de başarılı pazarlıkla 2-1-0 sözleşme 4-2-1'e çıkabiliyor [T].
- **Rüşvet (bribe):** Maç öncesi "şüpheli karakter" maçı satman için para önerir. Kabul edip yine de iyi oynamak "sigorta" işlevi görür. Nadiren teklif bir **gazetenin tuzağıdır**: maç sonrası skandal tüm ilişkileri sıfıra yakın düşürür ve fiilen emekliliğe zorlar [T]. "Shady character incident" sürüm notunda geçiyor [D].

### 6.2 Transfer [D/T]
- **Ocak transfer döneminde** takımlar teklif yapar. Sezon sonunda (yaz) yeterli performans varsa takım seçilebilir [D].
- Transfer değeri £0'dan başlar, maç performansıyla iner ve çıkar; sözleşme ekranında "New Star istatistikçilerinin tahmini" olarak gösterilir [D/T].
- Yükselmek için Star Man ve kupa toplamak değeri artırır [T]. Üst liglere erken çıkmak zorluk yüzünden önerilmez [D].
- Ajan imza parası alır [T].
- NSS5: $1M, $5M, $10M ve $20M transfer başarımları [D].
- Oyuncu isteği: "mutsuzken transfer talep etme" özelliği **yok** [D, kullanıcı isteği].

### 6.3 Kaptanlık [D]
- "Yıldız gücü ve kulüp sadakati" ödüllendirilir: daha çok röportaj, sözleşme bonusu ve **takım arkadaşlarına nereye koşacaklarını söyleme** (pas öncesi pozisyon ayarı, ribaund için ceza sahasına oyuncu gönderme) [D].
- Başarısız pazarlık kaptanlığı kaybettirebilir [T].
- Kulüp ve milli takım kaptanlığı başarımları, 18 yaş ve altında kaptanlık başarımı [T].

### 6.4 Lig, Kupa ve Sezon Yapısı [T, wiki]
- 80+ lig (Kongregate) [D]. Avrupa, Afrika, CONCACAF, CONMEBOL, AFC ve OFC'de 100'ü aşkın ülke; birçok ülkede 2. ve 3.+ lig (örn. İngiltere 6 kademe, İskoçya 4).
- Kulüp adları 6 karakterlik kısaltma: "MAN C", "L'POOL", "DORTMU", "B MÖN" [T].
- Örnek Premier Lig: 20 takım, çift devreli lig (38 maç); 1–6. sıra ECL grupları, 7. sıra EL grupları, 18–20. sıra küme düşer; 2 doğrudan + play-off finali galibi yükselir [T].
- **Kupalar:** Ülke kupaları ("CUP R1…", FA Cup, EFL Cup = "Mickey Mouse Cup"/"Worthless Cup", FA Trophy, DFB-Pokal; üst ligler 2. turdan başlar), kıtasal kupalar (UEFA Champions League "ECL", Europa League "EUROPA", Conference League; Copa Libertadores, Sudamericana, CONCACAF Champions Cup, Caribbean Cup, Central American Cup, CAF CL, AFC CL) [T].
- **UEFA katsayıları** (2015-16 bazlı) Avrupa kotasını belirler; ön elemeler Q1–Q3, play-off; çift kotada kupa hakkı lige devredilir [T].
- **Milli takım:** World Cup (4 yılda bir, Y4'ten başlar, 32 takım, 8×4 grup, 2. tur, çeyrek final, yarı final, final; 3.lük maçı yok; eşleşmeler rastgele; ev sahibi yok; elemelerle toplam 1.114 maç; 211 federasyon), EURO, Copa América, Afrika Uluslar Kupası. Nations League, Kulüpler Dünya Kupası ve Süper Kupalar **yok** [T].
- Özel play-off formatları; örn. Danimarka DEN1 şampiyonluk ve küme grupları [T].
- Veri: mobil 2017 veri setini kullanır (wiki), NSS5 2020 verisini; ama mobil App Store notları 2025/26 güncellemesi diyor [D]. Güncellemeler yalnızca yeni kariyerlere uygulanır [D].
- Bir sezonda kupalarla 77–78 maç oynanabilir; oyuncu "bir sezonda 405 gol" iddiasında [D, kullanıcı].
- **Haftalık özet (Weekly review)** ekranı var [D].

### 6.5 Ödüller [D/T]
Young Player of the Year, Club/Division/League Player of the Year, **World Player of the Year** (Ballon d'Or eşdeğeri; 3 kez kazanma başarımı), Star Man. Ayrıca sadakat unvanları: 100 maç "fan favourite/local hero", 250 "club hero", 500 "all-time legend" (NSS5: 100 / 200).

### 6.6 Emeklilik ve Kariyer Skoru [D]
- 1.5'ten beri isteğe bağlı emeklilik; amaç, yetenekler çöküp "geçmiş başarıların hatırasını lekelemeden" bırakmak. **Kariyer skoru** hesaplanır ve lider tablosuna gider.
- Zorunlu emeklilik yok; New Star Games'e göre 100 yaşını geçmiş oyuncular var [D, NSG X gönderisi].
- NSS5: "20 sezondan sonra emekli ol" başarımı [D].

### 6.7 NSS5'te Menajerlik
- Araştırmada NSS5'te **emeklilik sonrası menajer olma modu bulunamadı.** Menajerlik deneyimi ayrı oyun olarak **New Star Manager**'a (2019) taşındı. Read'in ifadesiyle "NSS maç motorunu geliştirip tüm takımı kontrol etmeye uygun buldum" [D].

### 6.8 Başarımlar (Mobil, 107 adet) [T]
Kategoriler: ilk sözleşme, gol, hat-trick, çift hat-trick; 5/10 pas; 1/3 asist; Star Man 1/10/25/50 ve sezonda 20; 5 maksimum reyting; lig ve kupa galibiyeti, kupa ve lig şampiyonluğu, alt lig şampiyonluğu, 5 farklı galibiyet; sezonda 20/50 gol, 200 pas, 20 asist; kariyerde 50/100 gol; NRG ve krampon alma; tüm eşya, araç ve mülkler, %100 lifestyle; rulet, slot, blackjack ve at yarışı kazancı, at alma, kendi atınla kazanma, süper krampon; 10.000 bux; transfer; sponsorluk ve 10 sponsorun hepsi; Pace, Power, Technique, Vision ve FK maksimumu, %100 skill; partner edinme; Boss, Team, Fans, Sponsors ve Partner %100, %100 mutluluk; 10 sezon; milli takım maçı, golü, hat-trick'i, galibiyeti, turnuvası, 50/100 milli gol; kıtasal kupa maçı, golü, hat-trick'i, galibiyeti, turnuvası; tüm yıllık ödüller; ajan ve antrenör tutma; Dünya Kupası; 100/250/500 maç; son dakika golü; kulüp ve milli takım kaptanlığı, kaptanken lig ve Dünya Kupası; 8 beceri reytingi maksimumu; 250/500/1000 maç; 3 farklı kulüple lig; 3× dünyanın en iyisi; kornerden doğrudan gol; maçta 3 başarılı dribbling; direğe vurma 1/3; 18 yaş altı kaptan; yenilgisiz sezon; tüm lig maçlarını kazanma; tek kulüpte lig şampiyonluğu; treble.

**Bilinmeyen/Doğrulanamayan:** Sezon başına maç ve "hafta" sayısı lige göre değişiyor; maçlar arasında kaç aksiyon yapılabildiği (zaman yerine enerji kısıtı mı) tam belli değil; enerji tek kısıt gibi görünüyor [Ç]. Kiralık (loan) sistemi bulunamadı. Kulüp seviyelerinin (itibar) sayısal karşılığı bilinmiyor.

---

## 7. Olaylar, İkilemler ve Medya

### Doğrulanmış ya da topluluk kaynaklı olay türleri
1. **İkilemler (Dilemmas):** Çoklu seçimli karar kartları; seçenekler ilişkileri değiştirir. 1.5 ile "yeni ikilemler" geldi [D].
2. **Takım arkadaşı alışveriş daveti:** Katılırsan Team artar; eşya yükseltmek ya da onarmak da sayılır [D].
3. **Takım arkadaşı casino daveti:** Kabul etmek hocayı kızdırma riski taşır [T].
4. **Reşit değilken casinoda yakalanma** [D].
5. **Kumar bağımlılığı manşeti** [T].
6. **Rüşvet / şüpheli karakter** (maç satma) ve **gazete tuzağı skandalı** [T/D].
7. **Partner öfke krizi** (Boss ilişkisi çöker) [D].
8. **Stil manşeti:** "style moron" [D].
9. **Düşük mutluluk haberleri** [T].
10. **Maç sonu röportajı (mini oyun):** Kaptanlar daha sık röportaja çıkar. Başarısızlık ödülü 0'lar; bu bazen negatif ödülden iyidir [T]. NSS5 ve mağaza tanıtımı "post-match interview mini-game" diyor; içeriği seçim ya da "simon says" tarzı olarak geçiyor [T, düşük güven].
11. **Sözleşme teklifi** (maç sonrası ekran), **transfer teklifleri** (Ocak), **sponsorluk teklifleri** (rastgele, performansa bağlı) [D/T].
12. **Milli takım çağrısı** [D].
13. **Gazete manşetleri:** Dünya Kupası galibi, başarılar, başarısızlıklar, skandallar; 2.0'dan beri FourFourTwo markalı [D].
14. **Hocanın konuşma balonları** (NSS5) [D].
15. **Replika forma satışı** (NSS5; haftada 100+ forma başarımı) ve **şöhret (Fame)** [D].
16. **Kameraman ve taraftarla etkileşim** (NSS5 gol sevinçleri) [D].

**Bilinmeyen/Doğrulanamayan:** İkilem havuzunun tam listesi ve metinleri bulunamadı. Halef için en büyük bilinmeyen bu ve sıfırdan yazılmalı. Röportaj mini oyununun kesin mekaniği doğrulanamadı.

---

## 8. Sponsorlar [T]
- 10 kategori: **Boots, Sports Drink, Sports Clothing, Casual Clothing, Food, Cosmetics, Watch, Electronics, Jewellery, Car.** Wiki ayrıca kaptanlığı "sponsor" gibi listeliyor (+1 coin).
- Mobilde sponsor başına maç başı 1–3 bux; örnek: 5 sponsordan toplam 9 bux [T].
- Performans ve lifestyle ile kazanılır; kötü performans ya da düşük ilişki ile kolayca kaybedilir [T/D].
- Ajan sponsorluk gelirini %10/20/30 artırır [T].
- Sponsorlar transfer değerini ve milli hocadaki itibarı etkiler [T].
- NSS5: "maksimum sponsor sayısı" ve "%100 Sponsors" başarımları [D].

---

## 9. Para Birimi ve Gelir Modeli (Monetizasyon)

### Mobil [D]
- 2012: Ücretsiz Arcade + kariyer kilidi (0.99 $). Android ilk başta 1.99 £ ücretliydi, sonra Thumbstar ile F2P oldu ("profesyonel olmak" 68p). Sonra **Pro License** kaldırıldı ve oyun tamamen ücretsiz oldu.
- **Star Bux / Starbux** paketleri (tüketilebilir IAP). Ödüllü video ve tekliflerle bedava Starbux; App Store yorumu için 10 Star Bux verildiği yönünde kullanıcı beyanı var.
- Güncel IAP listesi (UK App Store): **Remove Ads Pro License £3.99**, NS CNTRL v4 £0.99, NS SWRV v1 £0.99, NS SWRV v2 £2.99, Pitch & Weather Pack £0.99, Agent Pro £1.99 / Expert £3.99, Trainer Expert £3.99, NRG Bolt £0.99, 4× NRG Bolt £2.99.
- Reklamlar: interstitial ve ödüllü video ("reklamlar bazen fazla", "ad-free satın aldım") [D].
- **Ücretsiz enerji** promosyon videosundan [T].

### NSS5 [D]
- Ücretsiz hesap: kayıtta 5 maç, sonra **günde 3 maç**, her maçta online.
- Premium hesap **20 $**: sınırsız maç, 50 maçta bir online.

### Değerlendirme
NSS "pay-to-win" algısını büyük ölçüde önlemiş: IAP'lerin hepsi oyunla da kazanılabiliyor. Ana sürtünme, SR'ye endeksli NRG fiyatı.

**Bilinmeyen/Doğrulanamayan:** Starbux paketlerinin güncel fiyat ve miktarları bulunamadı. Starbux ile oyun içi "bucks" arasındaki dönüşüm, aynı para birimi mi, belirsiz; wiki tek "coins/bucks" diyor [Ç].

---

## 10. UI, Ekranlar, Görsel Stil ve Ses

### 10.1 Ekran ve Menü Envanteri (Mobil) [D/T, wiki görsel isimleri + incelemeler]
1. Ana menü: New Career / Continue (3 slot), Practice, Options, About. "About" eskiden hatalıydı.
2. Oyuncu yaratma: isim, ülke, cinsiyet, zorluk.
3. **Ana ekran (Home/Career hub):** isim, cinsiyet simgesi, enerji barı, Substitute barı, sonraki maç, menü kısayolları.
4. **Training:** 5 mini oyun seçimi (PACE, POWER, TECHNIQUE, VISION, FREE KICKS; görseller: TECHNIQUE.PNG, VISION TRIAL.PNG, FREE KICKS.PNG).
5. **Relationships:** 5 bar ve eşleştirme mini oyunu (RELATIONSHIP.PNG).
6. **Shop:** NRG, Boots (deneme butonu), Lifestyle (Items/Vehicles/Property, Repair All), Staff (Agent/Trainer), Star Bux mağazası.
7. **Casino:** Blackjack, Roulette, Slots, Horse Racing; Stable ekranı (at listesi; 12'den fazla atta kaydırma hatası) [T].
8. **Contract** ekranı: ücret, gol bonusu, asist bonusu, transfer değeri, Renew; Hi-Lo pazarlık.
9. **Fixtures**, **League Table**, **Stats** (sezon ve kariyer), **Club History** (kulüp geçmişi), **Form** sayfası.
10. **Maç:** metin akışı, etkileşimli sahne, replay, final skoru, **Star Man**, **PAY** (kazanç dökümü), röportaj, sözleşme teklifi.
11. **Gazete** (FourFourTwo) ve **Weekly Review**.
12. **Achievements**, Game Center / Google Play lider tablosu.
13. **Pre-match stats** (1.5+) ve **pre-match help**.
14. Emeklilik ve kariyer skoru ekranı.
15. Facebook paylaşımı.

### 10.2 Görsel Stil [D]
- **Classic:** "Noughties (2000'ler) Flash oyunu hissi"; basit 2D, sprite oyuncular, üstten saha. Pocket Gamer: Amiga klasiklerini andırıyor. "Touch-screen Subbuteo".
- **2.0 "New look":** 3D oyuncu modelleri, hafif yakın kamera, dinamik hava, iOS 7 öncesi skeuomorphic hissiyatlı menüler; Classic'e geçiş butonu (pil tasarrufu da sağlıyor).
- NSS5: 2D piksel adamlar, yeşil saha.
- Renk paleti: kaynaklarda açıkça tarif edilmiyor. Ekran görüntülerinden bilinen genel izlenim: yeşil saha, koyu mavi/lacivert menü zeminleri, beyaz metin, sarı ve turuncu vurgular [Ç, doğrulanmadı].
- Yazı tipleri ve ikon seti için kaynak bulunamadı.

### 10.3 Ses [D]
- Yağmur sesi, güçlü "whack" vuruş sesi (2.0), az sayıda tribün tezahüratı (NSS5), aksiyon efektleri.
- Arka planda kullanıcının kendi müziğini çalabilme (2.0'da geri geldi).
- "Mute" butonu ana menüde. Maç içinde müzik yok, minimal ses.

**Bilinmeyen/Doğrulanamayan:** Tam ekran akış diyagramı, buton yerleşimi ve renk kodları doğrulanmadı. Bunlar için oyunun ekran görüntüleri ya da video karelerinin ayrıca incelenmesi gerekiyor (bkz. 03-ui-ve-asset-arastirmasi.md).

---

## 11. Kardeş Oyunlardan Alınabilecek Mekanikler

### 11.1 New Star Manager (2019; mobil, Switch, PS4, PC) [D/T]
- **Maç motoru:** Metin ticker'ı + yalnızca hücum anlarında 3D etkileşim. Oyuncuya dokunup pas verme, oyuncuyu geriye sürükleyip koşu çizme, ara pas, şut ekranında kaleye nişan. Ok rengi gücü gösterir; maksimumda (koyu kırmızı) kısa bir gecikmeden sonra dribbling'e geçer. Topa yandan vurmak falso verir (yetenekle artar). Kafa: kaleye tıklama; topun üstüne vurmak aşağı, altına vurmak yukarı kafa. **Kayarak müdahale:** okun kırmızıya döndüğü mesafede, arkadan girmek her zaman faul. Kamera döndürme ve zoom. **CANCEL** butonu. **Maç başına 1 RETRY hakkı.**
- **Taktik:** Formasyonlar (4-4-2, 4-3-3, 3-4-3, 5-3-2...), L/C/R mevki uygunluğu, work rate, oyun stili (direkt, kontra), oyuncu değişikliği, "Assistant Pick", rakip dizilişini görme, asistan uyarıları.
- **Oyuncu kartları:** Bronz / Gümüş / Altın / Siyah nadirlik. Yetenekler 1–20 (Tackling, Technique, Dribbling, Pace, Strength). Potansiyel. Mutluluk 1–100 (<65 alarm). Endişeler: Management, Development, Contract, Team Form. Pozitif (yeşil) ve negatif (kırmızı) **özellikler (traits)**, örn. "Red Mist". Yaşlı oyuncular daha hızlı yorulur, gençler daha pahalı.
- **Kart tipleri:** Training (Youth/Fitness/Skill/Scout), **Team Talk**, **Contract**, **NRG boost**, **Staff** kartları; board hedefleri, basın toplantısı ve ikilem ödülleri.
- **Devre arası konuşma mini oyunu:** 4–5 yeşil klişeyi ezberle, 5 saniyede seç; her doğru takım enerjisini artırır, tek yanlış oyunu bitirir.
- **Tesisler:** Medical Office (4.000 bux, physio; Lv2 traits görünür, Lv3 rakip traits), Scout's Office (5.000 bux; scout olmadan transfer yok, serbest oyuncu bulma), Youth Academy (7.000 bux; maç sonu genç oyuncu, 8 maç bekleme), Training Ground (Lv1 skill coach, Lv2 ek kart, Lv3–6 bekleme süresi azaltma), Fitness Center (Lv2 hızlı toparlanma), **Pitch** (1. yükseltme pas isabeti, sonrakiler enerji kaybı ve sakatlık azaltma), Stadium (taraftar kadro kalitesiyle gelir), **Club Shop** (kol ve tabela sponsorlarını açar).
- **Transfer:** Hi-Lo pazarlık; shortlist; filtreleme (mevki, yaş, reyting, potansiyel, fiyat); transfer penceresi sezon başında birkaç maç; scout serbest oyuncu bulur; sözleşme süreleri.
- **Kulüp menüsü:** Fans, Press, Sponsors, Board. Sponsor seçimi: peşin para mı, galibiyet ve gol bonusu mu; **taraftar onayı** forma satışını ve seyirciyi etkiler. Board'dan fon istemek hissedar maliyetini artırır. **Board hedefleri** ödül ya da kovulma getirir.
- **Basın toplantısı (bilgi sınavı):** Kendi kulübünle ilgili sorular (personel isimleri, en büyük galibiyet, golcü, asist lideri, tesis seviyeleri). Doğru cevap Contract kartı ve ilişki getirir. Oyuncular bazı soruları "kafa karıştırıcı / anlamsız" buluyor.
- **Menajer seviyesi:** Başarımlar talep edilir, seviye atlayınca ödül.

### 11.2 Retro Goal (2021; mobil, Switch, Apple Arcade "Retro Goal+") [D/T]
- 16-bit görsel, **yandan görünüm**; yalnızca gol fırsatı olan hücumlar oynanır (maç başına ~6), gerisi simüle edilir.
- Kontrol: sürükleme, dokunma ve kaydırma ile pas, şut, dribbling ve kafa; çeşitli pas ve şut tipleri.
- Oyuncu özellikleri: **Speed, Dribbling, Tackling, Technique, Condition**; morale; potansiyel; yaş; sözleşme süresi; değer.
- **Traits:** Pozitif: Loyal, Bench Warmer, Recovery, Unbreakable, Tireless, Adaptable, Dead Ball. Negatif: Demanding, Chopper, Red Mist, Lazy, Sick Note, Fragile.
- Para: **Bux** (galibiyet ve hasılat) + Retro Bowl'daki gibi **coaching credits** ile "Meeting" menüsü (moral artırma, kondisyon, seviye atlatma, sözleşme uzatma) [T].
- Yönetim: stadyum genişletme (hasılat), antrenman tesisleri, gençlik akademisi, koç ve personel kiralama/uzatma, transfer listesi, kiralık, formasyon ve taktik (Balanced, Counter-Attack, work rate).
- Düşük moral sarı/kırmızı karta yol açar [T].
- IAP ile zorluk ayarı ve premium [D].

**Bilinmeyen/Doğrulanamayan:** NSM'deki finans tablosunun (gelir/gider kalemleri) ayrıntıları ve Retro Goal'daki credits fiyatları bulunamadı.

---

## 12. Halef İçin Çıkarımlar (Kısa)
1. **Korunacak çekirdek:** Kısa kritik an maçları, sapan gibi sürükle-bırak vuruş + aftertouch falso, enerji ekonomisi, ilişki barları, gülünç lüks eşya listesi, kumar ve atlar, gazete manşetleri, Star Man, kariyer skoru ile emeklilik.
2. **Düzeltilecek zaaflar:**
   - SR'ye endeksli NRG enflasyonu.
   - "Önceden belirlenmiş" maç hissi ve save-scum istismarı.
   - Önemsiz eşiklere sahip ilişki barları (Boss'ta %55 ile %100 arasında fark olmaması).
   - Sığ ve tekrarlayan ikilem havuzu.
   - Raydaki kaleciler.
   - Mevki seçiminin olmaması (defans ve kaleci).
   - Kadın kariyerinde zamir hataları.
   - Transfer talep edememek.
   - Atların ekonomiyi kırması ("bu aslında bir at yarışı oyunu" yorumu).
   - Slotun pozitif beklenen değeri.
   - Ofsayt ve korner hataları.
3. **Read'in kendi NSS2 fikirleri:** Pinch ile tüm saha, ver-kaç ve barların yerine derin yaşam kararları. Bunlar doğrudan yol haritasına alınabilir.
4. **NSM ve Retro Goal'dan alınabilecekler:** Traits, oyuncu kartları ve nadirlik, basın toplantısı sınavı, devre arası klişe mini oyunu, tesis yükseltmeleri, maç başına 1 retry, ok rengiyle güç/dribbling geçişi, kayarak müdahale.

---

## Kaynaklar
- New Star Soccer Fandom Wiki (MediaWiki API ile çekilen wikitext): https://new-star-soccer.fandom.com/wiki/New_Star_Soccer_(NSS)_Wiki — alt sayfalar: Skills, Boots, NRG, Staff, Contracts, Sponsors, Life, Black_Jack, Star_Rating, Awards/Achievements, Tips_and_Tricks_for_beginners, Competitions, Clubs, Clubs/Germany, Premier_League, World_Cup, World_Cup/Qualifiers, UEFA_coefficients, General_Information
- Wikipedia — New Star Soccer: https://en.wikipedia.org/wiki/New_Star_Soccer
- Wikipedia — New Star Games: https://en.wikipedia.org/wiki/New_Star_Games
- Wikipedia — Retro Goal: https://en.wikipedia.org/wiki/Retro_Goal
- App Store (UK) — New Star Soccer (açıklama, IAP, sürüm geçmişi): https://apps.apple.com/gb/app/new-star-soccer/id498973162
- Google Play — New Star Soccer: https://play.google.com/store/apps/details?id=com.newstargames.newstarsoccer
- New Star Games — NSS: https://www.newstargames.com/new-star-soccer
- New Star Games — Retro Goal: https://www.newstargames.com/retro-goal
- Steam — New Star Soccer 5: https://store.steampowered.com/app/212780/New_Star_Soccer_5/
- Steam — NSS5 başarımları: https://steamcommunity.com/stats/212780/achievements/
- Steam NSS5 rehberi (ofsayt): https://steamcommunity.com/sharedfiles/filedetails/?id=1117456766
- Steam — New Star Manager Hints and Tips: https://steamcommunity.com/sharedfiles/filedetails/?id=1540480689
- Steam — NSM basın soruları: https://steamcommunity.com/app/883130/discussions/0/1738883070318884391/
- Kongregate — NSS: https://www.kongregate.com/en/games/siread/new-star-soccer
- TouchArcade forum başlığı: https://toucharcade.com/community/threads/new-star-soccer-by-new-star-games.125601/
- TouchArcade 2.0 güncellemesi: https://toucharcade.com/2016/09/27/new-star-soccer-update/
- PocketGamer incelemesi: https://www.pocketgamer.com/new-star-soccer/new-star-soccer/
- PocketGamer 1.52 güncellemesi: https://www.pocketgamer.com/articles/054583/r/
- PocketGamer ortalar ve kornerler güncellemesi: https://www.pocketgamer.com/articles/042369/r/
- PocketGamer 2.0'ın 5 yeniliği: https://www.pocketgamer.com/new-star-soccer/5-ways-new-star-soccer-version-2-feels-like-a-new-game/
- PocketGamer 1.5 ekran görüntüleri: https://www.pocketgamer.com/new-star-soccer/new-star-soccer-dev-posts-fresh-screenshots-of-the-games-next-major-update/
- PocketGamer Retro Goal App Army: https://www.pocketgamer.com/retro-goal/app-army-assemble-retro-goal-does-new-star-games-latest-effort-hit-the-back-of-t/
- PocketGamer NSM incelemesi: https://www.pocketgamer.com/new-star-manager/new-star-soccer-manager-review-the-beautiful-game-that-will-become-an-addiction/
- PocketGamer.biz Simon Read röportajı: https://www.pocketgamer.biz/interview/69167/from-virtual-boots-to-managerial-suits-simon-read-on-the-evolution-of-new-star-soccer/
- GodisaGeek — Simon Read röportajı: https://godisageek.com/2013/08/interview-simon-read-future-star-soccer-star-games/
- GodisaGeek — NSS 1.5: https://godisageek.com/?p=133158
- GodisaGeek — devam oyunu fikirleri: https://godisageek.com/?p=126748
- GodisaGeek — Android F2P: https://www.godisageek.com/2013/11/star-soccer-free-android
- The Set Pieces — Simon Read röportajı: https://thesetpieces.com/interviews/story-new-star-soccer/
- FourFourTwo — 19 ipucu (geliştirici kaynaklı): https://www.fourfourtwo.com/features/19-tips-making-it-big-time-new-star-soccer
- Force for Good — NSS5: https://forceforgood.co.uk/sport/new-star-soccer-5/
- Invision Game Community — NSS5 incelemesi: https://invisioncommunity.co.uk/new-star-soccer-5-review/
- Gamepressure — NSS5: https://www.gamepressure.com/games/new-star-soccer-5/z43728
- Metacritic — NSS5: https://www.metacritic.com/game/new-star-soccer-5/
- Cheatbook — NSS5: https://www.cheatbook.de/files/newstarsoccer5.htm
- The Average Gamer: http://www.theaveragegamer.com/2013/12/02/new-star-soccer/
- Pixelsport incelemesi: https://pixelsport.wordpress.com/2012/05/13/review-new-star-soccer-mobile-iosandroid/
- Stuff.tv: https://www.stuff.tv/news/drop-everything-and-try-new-star-soccer/
- PandaHelp ipuçları: https://pandahelp.vip/new-star-soccer/helpful-tips-and-guides-to-play-new-star-soccer-game-2024/
- LevelWinner — NSM rehberi: https://www.levelwinner.com/new-star-manager-advanced-guide-10-tips-tricks-take-your-club-to-next-level/
- Rapid Reviews UK — NSM: https://www.rapidreviewsuk.com/new-star-manager/
- GamingonPhone — Retro Goal rehberleri: https://gamingonphone.com/guides/retro-goal-the-complete-players-guide-with-tips/ , https://gamingonphone.com/guides/retro-goal-beginners-guide-with-tips/
- New Star Games X (uzun kariyer gönderisi): https://x.com/newstargames/status/1271390010344906753
