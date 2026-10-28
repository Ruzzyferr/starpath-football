# Yaş Derecelendirmesi Anketi Notları (TASLAK, DOĞRULANMASI GEREKLİ)

> Bu notlar IARC (Google Play), Apple ve Steam/PEGI/USK anket yanıtlarını hazırlamak içindir. Resmi soru metinleri değişir: **her mağazada güncel anket, oyun içeriği gözden geçirilerek yeniden doldurulmalıdır.** Aşağıdaki yanıtlar kodun ve içeriğin mevcut halinden çıkarılmış ön değerlendirmedir. Model: ücretsiz oyun, elmas, nakit paketleri, ödüllü reklam, Pro Contract aboneliği (bkz. `docs/MONETIZASYON.md` §8.2).

## Önemli nokta: simüle kumar + satın alınabilir oyun içi para

Oyunda bir kumarhane bölümü var (slot, blackjack vb.; `src/sim/life/casino.ts`). Özellikleri:

- Yalnızca **oyun içi para** ile oynanır; gerçek ödül yoktur, oyun içi para **hiçbir zaman gerçek paraya çevrilemez**.
- **Oyun içi para gerçek parayla satın alınabilir** (nakit paketleri ve elmastan nakde çevirme) ve bu para kumarhanede harcanabilir. Eski "gerçek para ile oyun içi para arasında bağ yoktur" varsayımı artık **geçersizdir**.
- Karakter yaşı `CASINO_MIN_AGE` altındaysa bölüm kapalıdır (oyun içi kapı; oyuncunun gerçek yaşı değildir).
- Kutu/ganimet kutusu, rastgele ücretli ödül yoktur.

### Verilecek yanıt ve sonuç

- "Simüle kumar" sorusu: **evet, sık/yoğun (frequent/intense)** olarak işaretlenir. Satın alınabilir para kumarhanede kullanılabildiği için "seyrek/hafif" yanıtı savunulamaz.
- Beklenen sonuç: **Apple 17+** (App Store Connect'te "Simulated Gambling: Frequent/Intense"), **IARC** için Google Play'de yüksek bant (ülkeye göre 16+/18+ ve ek "simüle kumar" uyarısı). USK/PEGI ve Türkiye sınıflaması ayrıca kontrol edilir.
- "Gerçek para ile kumar" sorusu **hayır** kalır (kazanç çevrilemez, ödül yok).
- Anketler **nakit paketi satışa çıkmadan önce** yeniden doldurulur.

### Uygulanan durum: yaş kapısı kapsamı

- Yaş kapısı **kumarhane VE nakit satın alma** (nakit paketleri ve elmastan nakde çevirme) için geçerlidir.
- 18 yaş altı veya yaşı bilinmeyen oyuncuya reklamlar **kişiselleştirilmemiş** istenir.
- Elmas paketleri ve kozmetikler yaşa göre kapatılmaz; mağazanın ebeveyn denetimleri (satın alma onayı, harcama limiti) geçerlidir.
- Doğum yılı yalnızca cihazda tutulur.

### Uygulamaya eklenecek uygulama içi yaş kapısı (in-app age gate)

- İlk açılışta yaş sorusu (doğum yılı/ay veya "18 yaşında veya daha büyüğüm" onayı); cevap cihazda tutulur.
- 18 yaş altı veya cevap vermeyen kullanıcıda: kumarhane kapalı, nakit paketleri ve elmastan nakde çevirme gizli/kilitli, ödüllü reklam isteğe bağlı kalır ve kişiselleştirilmemiş istek gönderilir.
- Reklam rızası: AB/BK'de Google UMP formu, iOS'ta takip yok, ATT istemi yok (yalnızca kişiselleştirilmemiş reklam).
- Satın alma ekranında açık metin: "Oyun içi para gerçek paraya çevrilemez."
- Kumarhaneye günlük kayıp limiti (oyun içi) ve karakter yaşı kapısı korunur.
- Bu kapı mağaza derecesinin yerine geçmez; yalnızca onu destekleyen ek önlemdir.

## Soru bazlı ön yanıtlar

| Konu | Ön yanıt | Not |
|---|---|---|
| Gerçek para ile kumar | Hayır | Oyun içi para nakde çevrilemez, ödül yok |
| Simüle kumar | **Evet, sık/yoğun** | Satın alınabilir para kumarhanede kullanılır; Apple 17+ |
| Şiddet | Yok / çok hafif | Futbol teması; sakatlık metinleri var, grafik şiddet yok. Doğrulanacak |
| Cinsellik / çıplaklık | Yok | İlişki olayları metinseldir; içerik taraması yapılacak |
| Küfür | Doğrulanacak | Olay metinleri ve yorumlar taranmalı |
| Madde (alkol, sigara, uyuşturucu) | Doğrulanacak | Hayat olaylarında partiler/alkol anıları olabilir; olay içerikleri (`sim/life/events/content`) taranmalı |
| Korku | Yok | |
| Kullanıcı etkileşimi / sohbet | Yok | Kullanıcılar arası etkileşim yok |
| Konum paylaşımı | Yok | |
| Kişisel veri toplama | Evet (anonim mağaza hesabı, cihaz kimliği, satın alma geçmişi) | `docs/legal/PRIVACY.*.md` ve `PrivacyInfo.xcprivacy` ile tutarlı |
| Reklam | Evet (isteğe bağlı ödüllü reklam, Google AdMob) | Zorla reklam yok; UMP (iOS'ta takip yok); Play'de AD_ID beyanı |
| Uygulama içi satın alma | Evet | Elmas ve nakit paketleri (tüketilen), Pro Contract aboneliği; rastgele ödül yok |
| Dijital satın alma sıklığı/ebeveyn onayı | Mağaza mekanizması | Aile paylaşımı/ebeveyn onayı mağazada |
| Çocuklara yönelik | Hayır (genel kitle) | "Designed for Families" / Kids kategorisine başvurulmaz |

## Yapılacaklar (insan doğrulaması)

- [ ] Her mağazada güncel anketi doldurup kumar yanıtının çıkardığı yaş sınırını not al (Apple 17+, IARC bandı)
- [ ] Uygulama içi yaş kapısını (yukarıdaki liste) geliştir ve mağaza derecesiyle uyumlu karara bağla
- [ ] Olay metinlerini alkol/uyuşturucu/küfür/cinsellik için tara ve yanıtları buna göre kesinleştir
- [ ] Türkiye için (Bilgi ve İletişim; Google/Apple bölgesel sınıflama) ve Almanya USK için ek soruları kontrol et
- [ ] Apple "App Privacy" ve Google "Data safety" formlarını yeni veri akışlarına göre doldur
- [ ] Hukuk incelemesi (docs/legal) ile birlikte son kararı onayla
