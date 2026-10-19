# StarPath Football Gizlilik Politikası

> **TASLAK — hukuki inceleme gerekli.** Bu metin bir avukat tarafından incelenmeden yayımlanmamalıdır. Köşeli parantezli alanlar doldurulacaktır.

Son güncelleme: [TARİH] · Sürüm: taslak 0.2

## 1. Kısaca

- Oyun ücretsizdir. **Kariyerin ve kayıtların cihazında kalır.**
- Mağazayı hiç açmayan oyuncu sunucumuza hiçbir şey göndermez.
- Mağazayı açmak sunucumuzda **anonim bir mağaza hesabı** oluşturur (rastgele bir kimlik ve özetlenmiş bir gizli anahtar). Elmas bakiyeni ve satın alma kayıtlarını tutar; adını, e-postanı veya kariyerini tutmaz.
- Satın almaları Apple veya Google işler; kart bilgisini biz görmeyiz.
- İsteğe bağlı **ödüllü reklamlar** Google AdMob'dan gelir. Reklam izlemeyi reddetmek hiçbir ödülü kaybettirmez.
- Verini satmayız ve analitik SDK'sı çalıştırmayız.

## 2. Veri sorumlusu

[COMPANY], [ADDRESS], iletişim: [CONTACT_EMAIL]. (KVKK madde 10 / GDPR madde 13 aydınlatma metni.)

## 3. Hangi veriler, nerede, ne için

| Veri | Nerede tutulur | Amaç ve hukuki sebep | Cihaz dışına çıkar mı |
|---|---|---|---|
| Kariyer kayıtları (karakter adı, ilerleme), ayarlar, ipuçları, tuş atamaları | Cihazdaki depolama | Oyunu kaldığın yerden sürdürmek | Hayır (Steam Cloud'u açarsan Steam'in koşulları geçerlidir) |
| Hata günlüğü | Yerel depolama; **yalnızca Ayarlar'dan açarsan** | Raporu kopyalayıp bize kendin iletmen | Hayır; otomatik gönderilmez |
| Anonim mağaza hesabı: rastgele hesap kimliği, özetlenmiş gizli anahtar | Sunucumuz; mağazayı ilk açtığında oluşur | Mağazayı işletmek ve bakiyeni kurtarmak (sözleşme) | Evet, sunucumuza |
| Elmas bakiyesi, satın alma defteri, mağaza işlem kimlikleri ve makbuzları, abonelik durumu | Sunucumuz | Aldığını teslim etmek, iade ve dolandırıcılık süreçleri (sözleşme; meşru menfaat) | Evet |
| Ödüllü reklam oturumları, günlük sayaçlar, ücretsiz elmas talepleri | Sunucumuz | Ödülü bir kez vermek ve adil kullanım sınırları (meşru menfaat) | Evet |
| İmzalı onaylar (kariyere uygulanan elmas harcamaları) | Sunucumuz ve kaydın | Harcamanın bir kez ve ödenerek yapıldığını kanıtlamak (sözleşme) | Evet |
| IP adreslerini içeren denetim günlüğü | Sunucumuz | Güvenlik ve dolandırıcılığı önleme (meşru menfaat) | Evet |
| Web sunucusu ve sistem günlükleri (maskelenmiş IP adresleri) | Sunucumuz | Hizmeti işletmek ve korumak (meşru menfaat) | Evet |
| Sunucu verisinin şifreli yedekleri | Sunucu dışı depolama | Arızadan kurtarma (meşru menfaat) | Evet |
| Kumarhane ve mağazanın sorduğu doğum yılı | Yalnızca cihazdaki depolama | Kumarhane ve nakit satın alma için yaş kapısı | Hayır |
| Reklam kimliği / IDFA, reklam istekleri | Google AdMob | Ödüllü reklam göstermek. iOS'ta reklam kimliği yalnızca ATT iznin ile; AB/BK'de yalnızca Google'ın onay formunda (UMP) rıza verirsen. Kişiselleştirilmiş reklam rızaya dayanır | Evet, Google'a |
| Ödeme verisi | Apple App Store / Google Play | Ödeme ve makbuz | Mağaza ile senin aranda; biz yalnızca işlem kimliği ve makbuz alırız |

Hesap kimliğimiz, ödülün reklamla eşleştirilebilmesi için Google'a reklam doğrulama kullanıcı kimliği olarak gönderilir. Özel nitelikli veri, konum, rehber, kamera veya mikrofon toplamayız.

## 4. Barındırma ve aktarım

Sunucu, DigitalOcean'ın Frankfurt (AB) veri merkezinde çalışır. Google ve Apple verileri kendi gizlilik politikalarına göre işler ve kendi güvenceleriyle AEA dışına aktarabilir.

## 5. Saklama ve silme

- Denetim günlüğündeki IP adresleri 30 gün sonra özetlenir, 180 gün sonra silinir.
- Web sunucusu ve sistem günlükleri maskelenmiş IP adreslerini en çok 30 gün tutar.
- Yedekler şifrelidir, sunucu dışında saklanır ve 14 gün tutulur.
- Satın alması olmayan hesapların defter ve kazanç kayıtları 400 gün sonra anonimleştirilir. Mağaza işlem kayıtları vergi ve iade mevzuatı gereği 7 yıl tutulur. Bakiyesi boş ve etkin olmayan hesaplar 30 gün sonra silinir.
- Kumarhane ve mağazanın sorduğu doğum yılı yalnızca cihazında saklanır, bize gönderilmez.
- Cihazdaki veriler sen silene (Ayarlar > Veri) ya da uygulamayı kaldırana kadar kalır.
- **Dışa aktarma ve silme:** Ayarlar > Satın alımlar > Mağaza hesabı bölümünde "Mağaza verilerimi dışa aktar" mağaza verinin JSON kopyasını indirir; mağaza hesabını da aynı yerden silebilirsin (`DELETE /v1/account`). Hesap silinince bakiye kalkar; kullanılmamış elmaslar, yasanın gerektirdiği haller dışında iade edilmez.
- **Reklam rızası:** ödüllü reklam rızanı Ayarlar > Reklam gizlilik tercihleri (AB/BK) bölümünden değiştirebilirsin.

## 6. Çocuklar ve kumarhane

Oyun genel kitleye yöneliktir; reklam ve satın almalar yetişkinler içindir veya mağazadaki ebeveyn onayıyla yapılır. Çocuklardan bilerek veri toplamayız. Kumarhane mini oyunları oyun içi para kullanır; bu para gerçek parayla satın alınabilir ama asla nakde çevrilemez, oyunlar gerçek para veya ödül vermez; genç karakterlere kapalıdır ve yaş derecesine tabidir. [Yaş derecesi doğrulanacak.]

## 7. Haklarınız (KVKK madde 11 ve GDPR)

Verinin işlenip işlenmediğini öğrenme; erişim, düzeltme, silme, kısıtlama, taşınabilirlik talep etme ve işlemeye itiraz hakkın saklıdır. Kişiselleştirilmiş reklam rızanı istediğin an geri alabilirsin (iOS Ayarlar > Gizlilik > İzleme, Android reklam ayarları veya Google'ın onay formu). İletişim: [CONTACT_EMAIL]. Yetkili makama (Türkiye'de KVKK Kurulu) şikâyet edebilirsin. [Yetkili makam bilgisi eklenecek.]

## 8. Değişiklikler

Politika değişirse bu sayfa ve uygulama içindeki bağlantı güncellenir; önemli değişiklikler sürüm notlarında duyurulur.
