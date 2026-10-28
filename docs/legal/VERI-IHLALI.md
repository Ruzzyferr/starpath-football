# Kickborn: Veri ihlali müdahale prosedürü

Veri sorumlusu: Rüzgar Emir Bulut (bireysel geliştirici), info@swiip.app. Bu belge bir ihlal şüphesinde ne yapılacağını sırayla yazar. Hukuki dayanak: KVKK madde 12/5 ve Kurul'un 2019/10 sayılı kararı (öğrenmeden itibaren **en geç 72 saat** içinde Kurul'a bildirim, ilgili kişilere en kısa sürede bildirim); AB/BK kullanıcıları için GDPR madde 33 (denetim makamına 72 saat) ve madde 34 (yüksek risk varsa kişilere).

## Hangi veri nerede

| Veri | Yer |
|---|---|
| Hesap kimliği (rastgele, ad/e-posta yok), elmas bakiyesi, satın alma ve makbuz kayıtları, kurtarma kodu özeti | Sunucu `starpath-api` (DigitalOcean Frankfurt), SQLite, `/opt/starpath/data` |
| Erişim kayıtları (IP maskeli, sorgu dizisi silinmiş, en çok 30 gün) | Aynı sunucu, `/var/log/caddy/starpath.log` |
| Kariyer kayıtları | Yalnızca oyuncunun cihazında; sunucuya gitmez |
| Reklam verisi | Google AdMob (kendi veri sorumluluğu) |

## Saat 0: fark etme

1. Saati yaz (UTC ve TR saati). 72 saat bu andan başlar.
2. Bir olay günlüğü aç (`docs/legal/ihlal-YYYYMMDD.md`, repoya değil, şifreli bir yere): kim, ne zaman, ne gördü.

## İlk 4 saat: durdur ve koru

1. Sızıntıyı durdur: ilgili anahtarı iptal et (App Store Connect API anahtarı, Play hizmet hesabı, sunucu imza anahtarı, SSH anahtarı), gerekirse `systemctl stop starpath`.
2. Kanıtı silme: sunucunun DigitalOcean anlık görüntüsünü (snapshot) al, `/opt/starpath/data` ve Caddy günlüklerinin kopyasını sunucu dışına al.
3. Saldırganın erişimini kapat: SSH anahtarlarını ve root parolasını değiştir, DigitalOcean API anahtarlarını yenile, güvenlik duvarını kontrol et.

## İlk 24 saat: kapsamı belirle

1. Hangi veri türleri, kaç hesap, hangi tarih aralığı etkilendi?
2. Veri şifreli miydi, kişiyi tanımlıyor mu? (Hesap kimliği tek başına ad veya e-posta içermez; makbuzlar mağaza işlem numarası içerir.)
3. Risk düzeyini yaz: kişiler için olası sonuç ne (örneğin elmas bakiyesinin çalınması, satın alma geçmişinin görünmesi)?

## 72 saat dolmadan: bildir

1. **Kurul (KVKK):** kvkk.gov.tr üzerinden "Veri İhlali Bildirim Formu". Tüm bilgiler hazır değilse eldekilerle bildir, kalanı sonra tamamla (gecikmenin gerekçesini yaz).
2. **AB/BK kullanıcısı etkilendiyse:** ilgili denetim makamına GDPR madde 33 bildirimi (tek kuruluşu AB'de olmayan bir sorumlu olarak, etkilenen kullanıcıların bulunduğu ülkelerin makamları).
3. **İlgili kişiler:** e-posta adresimiz olmadığı için uygulama içi duyuru ve sitede (kickborn.swiip.app) açık bir duyuru: ne oldu, hangi veri, ne yaptık, kişinin ne yapması gerekir, iletişim adresi.
4. **Mağazalar:** ödeme veya hesap verisi etkilendiyse Apple ve Google geliştirici destek kanallarına haber ver.

## Sonrası

1. Kök nedeni düzelt ve testini ekle.
2. Olay günlüğünü kapat: zaman çizelgesi, alınan kararlar, bildirim tarihleri. Kurul isterse sunulmak üzere sakla.
3. Bu belgeyi ve `PRIVACY.tr.md` / `PRIVACY.en.md` dosyalarını gerekirse güncelle.
