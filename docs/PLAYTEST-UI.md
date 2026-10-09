# Arayüz Playtest Raporu (gerçek UI, Ekim 2026)

**Soru:** Oyun, gerçek bir oyuncunun elinde, gerçek arayüzden oynandığında çalışıyor mu, mantıklı mı, tutarlı mı, eğlenceli ve anlaşılır mı?

**Yöntem:**
- Playwright ile kurulu Chrome kullanıldı.
- Mobil 390×844, dokunmatik, simüle iPhone güvenli alanı (üst 47 px, alt 34 px; `--safe-area-inset-*`, `e2e/safe-area.spec.ts` ile aynı yol). Ayrıca masaüstü 1440×900.
- Dil çoğunlukla TR, yer yer EN.
- Her özellik önce elle denendi: sihirbaz, denemeler, planlayıcı, drill'ler, maç anları, telefon, kumarhane, sözleşme, milli takım, sezon sonu, emeklilik ve miras. Uzun aralıklar ancak bundan sonra `window.__sp` ile hızlandırıldı.
- Dört alan ayrı ayrı tarandı:
  - Kariyer başlangıcı ve antrenman
  - Maç
  - Yaşam telefonu ve kumarhane
  - Kariyer yayı ve meta ekranlar
- Ekran görüntüleri ve notlar oturum çalışma alanında (`scratchpad/play4/`): `shots/<etiket>-NN-*.png`, `notes-*.txt`. Aşağıda dosya adlarıyla anılıyor.

**Konsol:** Hiçbir oturumda konsol hatası, `pageerror` veya eksik i18n anahtarı görülmedi. Maç anları 60 fps'te kaldı.

## Özet

| Önem | Bulunan | Düzeltilen | Açık |
|---|---|---|---|
| P0 (bozuk) | 0 | – | – |
| P1 (yanlış / mantıksız) | 20 | 19 | 1 (C9: tasarım gereği) |
| P2 (cila) | ~60 | ~45 | ~15 (bkz. "Açık kalanlar") |

Oyunu kıran bir hata çıkmadı: kayıt bozulmadı, ekran kilitlenmedi, ölü uç yok. Hissi bozanlar başka şeylerdi:
- Ekranlar arasında birbirini tutmayan sayılar (XP aralığı, sözleşme yılı, kredi limiti, gol kralı).
- Reddedilen bir eylemin yine de "olmuş gibi" görünmesi: kapalı kumarhanede sahte sonuç, ilişkide çift toast, kulübün masadan kalkmasının "sen kalktın" diye yazılması.
- Etiketsiz ikon çipleri: antrenmanın neyi geliştirdiği anlaşılmıyordu.
- Türkçede ondalık nokta kullanımı ve İngilizce kalıntılar.

## P1: yanlış / mantıksız

Her satırda tekrar adımları ve ekran görüntüsü var. E2E sütunu, düzeltmeyi koruyan testi gösteriyor.

### Kariyer başlangıcı ve antrenman

| # | Bulgu | Tekrar | Görüntü | Durum / e2e |
|---|---|---|---|---|
| F6 | Deneme drill'i (kariyerin ilk mini oyunu; denemeler varsayılan olarak açık) doğrudan 3-2-1 geri sayımıyla başlıyordu. Ne hedef ne kontroller ne de gereken yüzde gösteriliyordu. İlk denemem %6 çıktı. | Yeni kariyer → Seçmelerle başla → Denemeyi oyna | `s2-02-drill-intro.png` | Düzeltildi: önce bir nasıl-oynanır kartı geliyor (diyagram, amaç, dokunmatik/PC kontrolleri, hedef %), "Başla" ile oyun açılıyor. `playtest-ui.spec.ts` PT-F6 |
| F1 | Drill tuvalinin HUD'u (kulüp, skor, süre) çentiğin / durum çubuğunun altında kalıyordu. Ipucu satırı da "Çık" düğmesinin altına giriyordu. MatchScene güvenli alanı hesaba katıyordu, TrainingScene katmıyordu. | Çentikli telefonda herhangi bir drill | `s2-04-drill-mid2.png` → `v1-03-trial-playing.png` | Düzeltildi: `.trn-drill-stage` güvenli alanlar kadar içeriden başlıyor. PT-F6 (stage ≥ inset) |
| F4 | Planlayıcıdaki aktivite çiplerinde nitelik kazancı "✨ +1?" diye görünüyordu: XP ile aynı ikon, etiket yok. Şut, Pas ve Top Sürme ayırt edilemiyordu; açıklamaları da aynıydı. | Günü planla → Sabah → Antrenman | `s4-02-picker.png` → `v1-04-picker.png` | Düzeltildi: nitelik çipleri adını taşıyor ("+1? Şut Gücü"). PT-F4 |
| F7 | XP aralığı üç yerde üç farklı değerdi: seans kartında "14–25" (otomatik..en çok), drill tanıtımında "6–25" (en çoğun %25'i). %0 performansta gerçek sonuç +2 XP. | Antrenman → Pas Çalışması → Drili oyna → hiçbir şey yapma | `s6-*` | Düzeltildi: iki ekran da gerçek %0..%100 aralığını gösteriyor (`xpMin`). "Otomatik (0.6)" → "Otomatik (%60)". PT-F7 |

### Maç

| # | Bulgu | Tekrar | Görüntü | Durum / e2e |
|---|---|---|---|---|
| M1 | Genç santrforun anlarının yarısı "Oyun kurma" (build_up) oluyordu: 3 maçta 15 anın 8'i. Maç önü önizlemesi bunu hiç söylemiyordu; yalnızca şut anlarını listeliyordu. Sebep: motorun adalet kuralı düşük şanslı şut anlarını build_up'a çeviriyor. | `?autostart=1&seed=777` → maç günü → Maça çık | `m1-02-prematch.png` | Düzeltildi (yalnız UI): önizleme aynı kuralı uygulayıp build_up'ı gösteriyor. `playtest-ui-match.spec.ts` PT-M1 ve M1b |

### Yaşam telefonu ve kumarhane

| # | Bulgu | Tekrar | Görüntü | Durum / e2e |
|---|---|---|---|---|
| L1 | Kumarhane akşamdan önce kapalı. Yine de her oyun sahte bir sonuç oynatıyordu: at yarışı koşuyor ("0 €"), slot dönüyor, rulet "0 Net: 0 €" diyor, blackjack boş el açıyor. Lobide kapalı olduğuna dair hiçbir ipucu yoktu. | 18+ kahraman, Pazartesi sabahı → Kumarhane → herhangi bir oyun | `l4-10-horses-result.png` | Düzeltildi: reddedilen eylem `rejected` dönüyor, ekran animasyon oynatmıyor; durum bandında "Kapalı: kumarhane akşam açılır" yazıyor. PT-L1 |
| L2 | Kredi kaydırıcısı 50.000 €'dan başlıyor ve 1,41 Mn €'ya kadar çıkıyordu. Banka ise "en fazla 19 Bin €" diyerek reddediyordu. Faiz ve taksit önceden gösterilmiyordu. | Banka → Kredi çek | `l2-*` | Düzeltildi: üst sınır bankanın gerçek limiti (`maxLoan`). Faiz ve haftalık taksit önizleniyor, %40 gelir kuralı önceden uyarıyor. PT-L2 |
| L3 | Reddedilen ilişki etkileşimi iki toast birden atıyordu: "Bugün X ile zaten vakit geçirdin" ve "X ile vakit geçirdin". | Bir kişiyi ara, sonra "Yemeğe çık" | `notes-l3.txt` | Düzeltildi: boş sonuçta başarı toast'ı yok. PT-L3 |
| L4 | Vadeli mevduat seçeneği "%4.5 yıllık" diyordu, açılan satır "%5". | Banka → Vadeli mevduat aç | `l2-*-bank-term.png` | Düzeltildi: oranlar ondalıklı ve TR biçiminde (%4,5) |
| L5 | Tasarruf hesabının TR adı "Vadeli hesap"tı. Bu, vadeli mevduatın "tasarruf hesabından yüksek faiz" metniyle çelişiyordu. | Banka | – | Düzeltildi: "Birikim hesabı" |
| L6 | At yarışında kesirli oran (2,05 × 50 €) cüzdana 102,5 € yazıyordu, sonuç ekranı ise +103 € gösteriyordu. | Kumarhane → At yarışı → oranı kesirli ata oyna, kazan | `e2e casino.spec` (tam koşuda yakalandı) | Düzeltildi: ödeme tam euroya yuvarlanıyor (golden değişmiyor). `casino.spec.ts` |

### Kariyer yayı ve meta ekranlar

| # | Bulgu | Tekrar | Görüntü | Durum / e2e |
|---|---|---|---|---|
| C1 | Emekli kariyer "zombi" oluyordu: Ana Sayfa'da hedefler, karar, İlerle ve kumarhane duruyordu. Başlıktaki "Devam et" oraya götürüyordu; İlerle'ye basınca yalnızca "Kariyerin sona erdi" toast'ı çıkıyordu. | 33+ yaş → Emekli ol → Ana Sayfa / yeniden yükle → Devam et | `c6-14-home-after-retire.png`, `c6-16-…` | Düzeltildi: emekli kayıt her yoldan (Ana Sayfa, Devam et, sekmeler) belgesele gidiyor; bitiş ekranlarında kabuk, olay modalı ve rehber yok. `playtest-ui-career.spec.ts` PT-C1 |
| C2 | Ana Sayfa "2 sezon kaldı" diyordu, Sözleşme ekranı aynı sözleşme için "3 sezon kaldı". | Ana Sayfa ↔ Sözleşme | `c1-06-contract.png` | Düzeltildi: Ana Sayfa içinde bulunulan sezonu da sayıyor. PT-C |
| C3 | Kulübün sabrı tükendiğinde sonuç "MASADAN KALKTIN — görüşmeleri sonlandırdın" diyordu; hemen altındaki alıntı "{kulüp} masadan kalktı". | Yenileme → ücreti zorla → gönder | `c10-*neg-resp.png` | Düzeltildi: kulüp kalkınca "Görüşmeler çöktü"; "Masadan kalktın" yalnız senin vazgeçişin. PT-C |
| C4 | Teklif yapmamış kulüplerde de "GÖRÜŞ" düğmesi vardı. Basınca kendi Sözleşme ekranına düşüp "henüz resmî teklif yok" toast'ı görüyordun. | Dünya → İlgi kartı → Görüş | `c9-*neg.png` | Düzeltildi: yalnız izleyen kulüpte Görüş düğmesi gerekçeyle devre dışı; ekran yalnız görüşme açılınca değişiyor. PT-C |
| C5 | Milli maçlarda saha ve iç saha/deplasman yanlıştı: ev sahibiyken "Deplasman", saha "—". | Milli takım çağrısı → maç günü | `c11-04`, `c11-05` | Düzeltildi: kahramanın milli takımı ev/deplasman tarafı, saha "{Ülke} Ulusal Stadı". PT-C |
| C6 | Rakip milli takımın kadrosu o ülkenin isimlerini taşımıyordu: Belçika kadrosu İngiliz isimleriyle dolu. | ″ | `c11-05-prematch.png` | Düzeltildi: lig simülasyonu olmayan ülkeler kendi isim stilini kullanıyor (`nameStyle.test.ts`; golden çıktısı değişmiyor). PT-C |
| C7 | Kadroda forma numaraları tekrar ediyordu: 34 üç kez, 2 üç kez. | Kulüp → Kadro | `c1-07-club.png` | Düzeltildi: kadro numaraları tekil ve sabit. PT-C |
| C8 | Gol kralı ödülü kendisiyle çelişiyordu: "Lig Gol Kralı: Kazandın", ardından "Gol Kralı: Kaçırdın" ve "Gol kralı: Harry Hayes". Başarım yine de açılıyor, kupa dolabı ise hâlâ hedef olarak gösteriyordu. | Sezon sonu → ödüller | `notes-c*` | Düzeltildi: küresel ödül "Altın Ayakkabı" oldu, başarım anahtarı birebir eşleşiyor, dolap kazanılmış ödülü önermiyor. PT-C |
| C9 | Yenileme teklifindeki piyasa referansı ligi hesaba katmıyordu: 3. ligdeki oyuncuya üst lig ücretleri gösteriliyordu. Güven düşük, çünkü test için oyuncu güçlendirilmişti. | Sözleşme → Yenile | – | Açık değil / tasarım: referans, benzer oyuncuları ligden bağımsız kıyaslıyor; yanlış görünümü güçlendirilmiş test oyuncusundan geliyordu. |

## P2: cila (seçme)

**Türkçe sayı biçimi.** Türkçede ondalık için virgül kullanılmalı. Nokta görülen yerler:
- Maç notu dökümü ve "Maç notun 7.2", ilişki defteri, ana sayfa formu: maç düzeltmesiyle giderildi.
- XP kazançları, sihirbazdaki "−0.5", bankadaki faizler, fon büyümesi, masa limiti: giderildi.
- Milli takım puanı, nişan yardımı "×0.85", piyasa değeri "×1.13", ödül puanları: kariyer düzeltmesiyle giderildi.
- Proje hissesi "5%" yazıyordu (TR'de "%5"): giderildi.

**Yanlış veya garip Türkçe:**
- Zorluk "Efsane" açıklaması "Tek kayıt hakkı yok" diyordu; "No save scumming" ifadesinin yanlış çevirisi. Giderildi.
- Drill'den çıkış düğmesi "Bırak"tı; jest talimatındaki "basılı tutup bırak" ile çakışıyordu. "Çık" oldu.
- Antrenörü kovma düğmesi "Ayrıl"dı. "Sözleşmeyi bitir" oldu.
- TR arayüzde "Coach Dani" gibi İngilizce unvanlar vardı. Kaldırıldı.
- Yatırım satma düğmesi "Boz"du. "Sat" oldu.
- Ana sayfadaki kilit çipi "18 yaşında" diyordu. "18 yaşında açılır" oldu.
- Masaüstü telefon panelinde "Arrows" İngilizce kalmıştı. "Ok tuşları" oldu.
- Maç kararı başlığı "Taktik çıkış"tı. "Takıma seslen" oldu.
- Kariyer düzeltmesiyle ayrıca giderilenler: "ST · TR", "Legends XI", TR olmayan kahramana "Ay Yıldızlı Forma", "Yönetim hedefi: Yönetim hedefi" tekrarı.

**Bilgi eksikliği:**
- Kilitli yetenekler yalnızca "Kilitli" diyordu. Artık eksik olanı listeliyor: "Şut Gücü en az 60 (şu an 39)", puan, kademe vb.
- Drill sonucundaki "KAZANILANLAR" çipleri etiketsizdi. Etiketlendi.
- Fazla etkiyi gösteren "+1" çipi bir stat değişimi gibi okunuyordu. "+1 etki daha" oldu.

**Görsel ve düzen:**
- Masaüstü Ana Sayfa'da iki ana "İLERLE" düğmesi vardı. Bağlam panelindeki gizlendi.
- Kaleci anında kontrol ipucu kaleciyi örtüyordu. İpucu yukarı alındı, kaleciye ÇALIM düğmesi gösterilmiyor.
- Kaleci maç sonu haritası "Şut çekmedin" diyordu. Artık "Kaledeydin: n kurtarış" yazıyor.
- Röportaj seçeneklerindeki etki çipleri etiketsizdi. Etiketlendi.
- Pas ağında 25 ile 26 puan farklı bantlara düşüyordu. Bant artık gösterilen yuvarlanmış değerden hesaplanıyor.
- Karar modalında varsayılan seçenek önceden seçilmiş gibi yeşildi. Artık nötr, "Varsayılan" etiketli.
- Kazanç adımı "Net 246 €" derken özet "+20 € Para" diyordu. Haftalık payın hafta sonunda yatacağı notu eklendi.
- Sihirbazda ülke araması yalnız arayüz dilinde çalışıyordu: TR arayüzde "ger" hiçbir şey bulmuyordu. Artık iki dilde arıyor.
- İlk gün tüm kişiler "Bu hafta görüştünüz" diyordu. Artık "Henüz bir anınız yok".
- Hiç bakım gideri olmayan varlıkta "0 € bakım" satırı çıkıyordu. Gizlendi.
- Masa limiti "%1.5 (500 €)" diyordu, oysa 500 € tabandı. Artık "en az 500 €" açıkça yazıyor.

## Açık kalanlar (bilinçli olarak ertelendi)

- **Maç (P2):**
  - 4× hız pratikte ~1,7× çalışıyor, çünkü karar modalı otomatik açılıp akışı durduruyor (tasarım gereği).
  - Kaleci anında DEPAR düğmesi duruyor (sweep / 1v1 için gerekli olabilir).
  - Masaüstünde build_up başında sprite'lar üst üste biniyor (sahne geometrisi).
  - Girdi verilmeyen gk_1v1 anı iki kez "kurtarıldı" bitti; rakip yapay zekâsı zayıf olabilir. Sim tarafı, paralel denge ajanına bırakıldı.
- **Yaşam (P2):**
  - Kumarhane lobisinde destek hattı cümlesi ve "Günlük kayıp limiti" başlığı iki kez görünüyor.
  - Blackjack split'te toplam bahis çipi el etiketinin üstüne biniyor; mobilde bahis ve DAĞIT ekranın altında kalıyor.
  - Telefon ana ekranındaki istatistik widget'ı 390 px'te yatay taşıyor.
  - Limit dolunca slot kolu bir sonraki yenilemeye kadar etkin görünüyor (sim spini zaten engelliyor).
  - Tarayıcı / PWA geri tuşu uygulamadan çıkıyor.
  - Zar oyununun sim tarafı var (`playDice`) ama arayüzü yok.
  - Kompakt tutar "250 B €" milyar gibi okunuyor.
  - "+2 Hatice" toast'ında "ilişki" kelimesi eksik.
  - "Ortak olduğun kulüp" ifadesi %0 hissede de çıkıyor.
- **Kariyer (P2):**
  - Miras (çocuk) sihirbazının 1. adımı yalnız soyadını dolduruyor; neyin miras kaldığını özet adımına kadar söylemiyor.
  - Kayıt içe aktarımı dolu bir yuvanın üzerine yazarken onay istiyor mu, kontrol edilmedi.
- **Genel (P2):**
  - Başarım ve hedef toast'ları ekranın üstünde uzun kalıp üst üste yığılabiliyor.
  - "Dilimi bitir", planlanmış antrenmanı drill'siz otomatik (%60) oynatıyor. Bu davranış belgelenmeli ya da UI'da söylenmeli.

## Gerçek cihaz gerektirenler

Simülasyonla doğrulanamayanlar:
- Gerçek çentik, Dinamik Ada ve Android hareket çubuğu ile güvenli alan (CSS yolu ve e2e insetleri doğrulandı).
- Gerçek parmakla kaydırma hızı, şut gücü hissi ve haptik.
- Klavye açıkken sayı alanlarının görünümü (ad, banka).
- iOS Safari'nin ses kilidi ve arka plana alınıp geri dönme.
- Düşük uçtaki Android'de drill ve maç fps'i.
- Mağaza sürümlerinde Steam metni ve IAP davranışı.

## Golden notu

`src/sim/golden.test.ts` çalışma ağacında `careerSeason` özetinde farklılık veriyor. Bu fark bu turun commit'lerinden gelmiyor: antrenör adı değişikliği geri alınarak denendi, fark sürdü. Kaynak, paralel ajanın commit'lenmemiş sim değişiklikleri (`createHero.ts`, `players.ts` vb.). Kariyer düzeltmesindeki isim stili değişikliği golden çıktısını değiştirmiyor (doğrulandı). Golden güncellemesi lider ajana bırakıldı.
