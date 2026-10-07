# Yaş Derecelendirmesi Anketi Notları (TASLAK, DOĞRULANMASI GEREKLİ)

> Bu notlar IARC (Google Play), Apple ve Steam/PEGI/USK anket yanıtlarını hazırlamak içindir. Resmi soru metinleri değişir: **her mağazada güncel anket, oyun içeriği gözden geçirilerek yeniden doğrulanmalıdır.** Aşağıdaki yanıtlar kodun ve içeriğin mevcut halinden çıkarılmış ön değerlendirmedir.

## Önemli nokta: simüle kumar

Oyunda bir kumarhane bölümü var (slot, blackjack vb.; `src/sim/life/casino.ts`). Özellikleri:

- Yalnızca **oyun içi sanal para** ile oynanır; gerçek para yatırılamaz, gerçek ödül yoktur, paraya çevrilemez.
- Gerçek para ile oyun içi para arasında bağ yoktur: mağaza satın alımları yalnızca "Tam Kariyer" kilidi ve görsel kozmetiklerdir, oyun içi para satmaz.
- Karakter 18 yaşından küçükse bölüm kapalıdır (oyun içi yaş kapısı, `ADULT_AGE`).
- Kutu/ganimet kutusu, rastgele ücretli ödül yoktur.

Mağaza anketlerinde "simüle kumar" ayrı bir sorudur ve **evet** işaretlenmesi beklenir; bu çoğu mağazada yaş derecesini yükseltir (ör. Apple'da 17+/18+ bandına, IARC'ta 12+ ila 16+ bandına çıkabilir; ülkeye göre değişir). Karar verilmeden önce, kumarhane bölümünün tamamı bir çocuk modu/bayrak ile çıkarılabilir mi diye ürün kararı alınmalıdır (daha düşük yaş derecesi için alternatif).

## Soru bazlı ön yanıtlar

| Konu | Ön yanıt | Not |
|---|---|---|
| Gerçek para ile kumar | Hayır | Gerçek para akışı yok |
| Simüle kumar (sanal para) | **Evet** | Yukarıda; doğrulanacak |
| Şiddet | Yok / çok hafif | Futbol teması; sakatlık metinleri var, grafik şiddet yok. Doğrulanacak |
| Cinsellik / çıplaklık | Yok | İlişki olayları metinseldir; içerik taraması yapılacak |
| Küfür | Doğrulanacak | Olay metinleri ve yorumlar taranmalı |
| Madde (alkol, sigara, uyuşturucu) | Doğrulanacak | Hayat olaylarında partiler/alkol anıları olabilir; olay içerikleri (`sim/life/events/content`) taranmalı |
| Korku | Yok | |
| Kullanıcı etkileşimi / sohbet | Yok | Çevrimiçi özellik yok |
| Konum paylaşımı | Yok | |
| Kişisel veri toplama | Hayır (hesap, analitik yok) | Gizlilik politikası taslağıyla tutarlı |
| Reklam | Yok | |
| Uygulama içi satın alma | Evet | Tam Kariyer (tüketilmeyen) + kozmetik paketler; rastgele ödül yok |
| Dijital satın alma sıklığı/ebeveyn onayı | Mağaza mekanizması | Aile paylaşımı/ebeveyn onayı mağazada |
| Çocuklara yönelik | Hayır (genel kitle) | "Designed for Families" / Kids kategorisine başvurulmaz |

## Yapılacaklar (insan doğrulaması)

- [ ] Her mağazada güncel anketi doldurup kumar yanıtının çıkardığı yaş sınırını not al
- [ ] Olay metinlerini alkol/uyuşturucu/küfür/cinsellik için tara ve yanıtları buna göre kesinleştir
- [ ] Kumarhane yaş kapısını hem oyun içi hem mağaza derecesiyle uyumlu karara bağla
- [ ] Türkiye için (Bilgi ve İletişim; Google/Apple bölgesel sınıflama) ve Almanya USK için ek soruları kontrol et
- [ ] Hukuk incelemesi (docs/legal) ile birlikte son kararı onayla
