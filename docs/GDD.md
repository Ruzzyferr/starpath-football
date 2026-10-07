# StarPath Football — Oyun Tasarım Belgesi (GDD)

> Çalışma adı: **StarPath Football** (TR: *Yıldız Yolu Futbol*). Ad `src/core/config.ts` içindeki `GAME_NAME` sabitinden değiştirilir.
> Hedef: New Star Soccer'ın (NSS) ruhunu koruyup her sistemini bir nesil ileri taşımak — "Max Payne 2 → Max Payne 3".
> Platform: PC (Windows/macOS/Linux, Steam) + Mobil (Android/iOS) + Web (PWA). Tek kod tabanı.

Durum etiketleri: **[v1]** bu sürümde yapılır · **[v2]** sonraki büyük güncelleme · **[v3]** uzun vade.

---

## 0. Tasarım Sütunları

1. **"Bir maç daha / bir gün daha" döngüsü** — NSS'nin bağımlılık yapan çekirdeği korunur: kısa maç anları + yaşam yönetimi.
2. **Gerçek beceri, gerçek sonuç** — Maçtaki performans oyuncunun elinin becerisine bağlıdır; para ile yetenek satın alınmaz (pay-to-win yok).
3. **Yaşayan dünya** — Ligler, transferler, rakipler, medya, aile; oyuncu olmadan da dönen bir dünya.
4. **Anlamlı kararlar** — Her olayın kısa ve uzun vadeli sonucu vardır, ve sonuçlar görünür (kayıt defteri / "neden oldu" açıklamaları).
5. **Adil para modeli** — Premium/tek seferlik kilit açma + sadece kozmetik. Enerji duvarı yok.
6. **Kayıp yok** — Atomik kayıt, otomatik yedek, bulut senkronu. NSS'nin "kayıt silindi" şikayeti bizde olmayacak.

---

## 1. Çekirdek Döngü

```
Gün başlar → Enerji/zaman blokları → Aktivite seç (antrenman, dinlenme, sosyal, iş, alışveriş, kumarhane, medya)
   → Olaylar (karar kartları) → Maç günü → Maç (interaktif anlar + canlı simülasyon)
   → Puan, ilişki, şöhret, para güncellemesi → Hafta/sezon ilerler → Transfer, ödül, sözleşme → ...
```

- Bir sezon ≈ 38–46 hafta. Her hafta: 0–2 maç, 5–7 gün aktivite.
- Bir gün = 3 zaman dilimi (Sabah / Öğleden sonra / Akşam). Her aktivite 1–2 dilim ve enerji harcar.
- Hızlı ilerleme: "Maç gününe kadar otomatik geç" (akıllı otopilot: önceden seçilen rutini uygular).

---

## 2. Karakter & Kariyer

### 2.1 Karakter Yaratma [v1]
- Ad, soyad, takma ad (forma adı), ülke, doğum şehri, yaş (16–18), pozisyon, tercih edilen ayak (sol/sağ/iki ayaklı = perk).
- Prosedürel avatar: ten rengi, saç modeli/rengi, sakal, kaş, göz, yüz şekli, aksesuar (bant, kolye), dövme (v2).
- Başlangıç arketipi (bonus dağılımı): Golcü, Oyun Kurucu, Kanat Motoru, Duvar, Box-to-Box, Kaleci.
- Geçmiş hikâyesi seçimi (Sokak Futbolu / Akademi Çocuğu / Futbolcu Ailesi / Geç Keşfedilen) → farklı başlangıç parası, ilişkiler ve özellikler.

### 2.2 Özellikler (Attribute) [v1]
| Grup | Özellikler |
|---|---|
| Fiziksel | Hız, Dayanıklılık, Güç, Çeviklik, Zıplama |
| Teknik | Pas, Şut, Bitiricilik, Dribbling, İlk Dokunuş, Orta, Kafa, Top Kapma, Duran Top |
| Zihinsel | Vizyon, Soğukkanlılık, Pozisyon Alma, Liderlik, Çalışkanlık |
| Kaleci | Refleks, Top Tutma, Pozisyon (kaleci) , Oyun Kurma (kaleci) |

- 0–100 ölçeği, pozisyona göre ağırlıklı **Genel (OVR)**.
- Gizli **Potansiyel** (oyuncu sadece yıldız tahmini görür; scout raporlarıyla netleşir).
- Yaşa bağlı eğri: 17–23 hızlı gelişim, 24–29 zirve, 30+ fiziksel düşüş (zihinsel artmaya devam eder).
- **Form** (son 5 maç), **Moral**, **Kondisyon (fitness)**, **Yorgunluk** ayrı değerler.

### 2.3 Gelişim [v1]
- Antrenman XP → özellik puanı. NSS'deki "skill point" sistemi korunur ama antrenman **mini oyunlarla** yapılır (beceri = daha çok XP).
- **Yetenek Ağacı / Perk**: her 5 OVR'de bir perk puanı. Örn: "Plase Uzmanı" (plase şutlarda kavis +), "Maraton" (dayanıklılık kaybı -%15), "Büyük Maç Oyuncusu", "Kaptan Ruhu", "Penaltı Buz Adam", "Rabona", "Elastico", "Uzun Taç".
- Antrenör tutma (özel antrenör: belirli gruba XP bonusu, maaş ister).
- Tesisler: ev spor salonu, havuz, kriyoterapi odası (sakatlık süresi -).

### 2.4 Sözleşme & Transfer [v1]
- Sözleşme: maaş, süre, imza parası, gol/asist bonusu, serbest kalma bedeli, oynama süresi garantisi, sakatlık sigortası.
- **Pazarlık mini oyunu**: menajer (agent) ile birlikte teklif–karşı teklif; kulübün sabrı göstergesi.
- Transfer pencereleri (yaz/kış). Kiralık transfer. Transfer talep etme. Serbest oyuncu.
- Ajan (menajer) tutma: kalite seviyesi; komisyon %; daha iyi teklifler, gizli ilgi bilgisi.
- Kulüp ilgisi listesi: scout'lar seni izliyor göstergesi.

### 2.5 Takım İçi Konum [v1]
- Rol: Yedek → Rotasyon → İlk 11 → Yıldız → Kaptan.
- Teknik direktör güveni barı. Kötü performans → yedek kulübesi; şikayet etme kararı.
- Takım arkadaşı ilişkileri pas verme sıklığını etkiler (NSS'den korunan efsane mekanik) — artık maç içinde görünür: "Arda sana pas vermiyor (ilişki: kötü)".

### 2.6 Kariyer Sonu & Sonrası [v1/v2]
- Emeklilik kararı (35+ veya sakatlık). Jübile maçı [v2].
- Emeklilik sonrası yollar: Teknik Direktör modu [v2], Yorumcu, Kulüp Başkanı [v3], Antrenör.
- **Miras (Legacy)**: Yeni kariyer oğlun/kızın olarak başlar; ünlü soyadı, başlangıç bonusu, aile servetinin bir kısmı [v2].
- **Onur Listesi**: tüm kariyerlerin müzesi (kupalar, rekorlar).

---

## 3. Maç Motoru

### 3.1 Genel Mimari [v1]
- **Tam maç simülasyonu** (deterministik, seed'li): 90 dk, dakika dakika olasılıksal olaylar — top hakimiyeti, bölge, atak, şut, gol, faul, kart, sakatlık, değişiklik. Takım gücü, taktik, moral, ev sahibi avantajı, yorgunluk.
- Kullanıcının oyuncusu sahadayken motor **"An" (Highlight)** üretir: topun oyuncuya geldiği / pozisyonun oluştuğu anlar.
- An'lar **gerçek zamanlı fizik sahnesinde** oynanır (Phaser). Sonuç (gol/kaçan/pas/top kaybı) simülasyona geri yazılır.
- Anlar arası: canlı skor + mini radar (2D noktalar) + metin anlatım, hızlandırılabilir.

### 3.2 Fizik [v1]
- 2.5D top: x, y yer düzlemi + z yükseklik; yerçekimi, zıplama (restitüsyon), çim sürtünmesi, hava direnci.
- **Magnus etkisi** (falso): şutun kavisi spin'e bağlı; spin tuşla/swipe eğrisiyle verilir.
- Top–oyuncu çarpışması, kale direği/üst direk sekmesi, file fiziği (görsel).
- Oyuncular: hız, ivme, dönüş hızı, stamina bağlı sprint.

### 3.3 Kontroller [v1]
| Eylem | Mobil | PC (klavye/fare) | Gamepad |
|---|---|---|---|
| Hareket | Sanal joystick (sol) | WASD / oklar | Sol analog |
| Pas | Hedefe dokun / kısa swipe | Sol tık hedef | A |
| Ara pas (koşu yoluna) | Boş alana swipe | Sağ tık | Y |
| Şut | Kaleye doğru swipe (uzunluk = güç, eğri = falso) | Basılı tut + bırak (güç barı), fare yönü | B (basılı tut) |
| Aşırtma (chip) | Yukarı ayrık swipe / iki parmak | Shift + şut | LB + B |
| Sprint | Sağ alttaki buton | Shift (basılı) | RT |
| Çalım / skill move | Çift dokunma / dairesel swipe | Space / Q-E | RB + analog |
| Orta | Kanat bölgesinde ceza sahasına swipe | Ctrl+tık | X |
- **Ağır çekim nişan (Bullet-time)** — NSS'nin "zamanı durdur nişan al" hissi korunur: topu alınca 0.25x hız penceresi (Soğukkanlılık özelliği süresini uzatır). Ayarlanabilir.
- Yardım seviyeleri: Tam yardım / Yarı / Manuel (zorluk + ödül çarpanı).

### 3.4 Yapay Zeka [v1]
- Takım arkadaşları: pozisyonel oyun (formasyon şablonu + top yönüne kayma), koşu yapma (derinlik/boş alan), pas için el kaldırma.
- Rakipler: alan kapatma, pres, top kapma denemesi (Top Kapma özelliğine bağlı başarı), ofsayt çizgisi.
- Kaleci AI: açı kapatma, refleks gecikmesi (Refleks özelliği), çıkış, uzanma, yumruklama, tutma, sekme bırakma.
- Hakem: faul eşiği, avantaj kuralı, kart kararları (sertlik ayarı), VAR [v2].

### 3.5 Duran Toplar [v1]
- Penaltı: kaleci okuma + nişan + güç; panik sistemi (soğukkanlılık ↓ → nişan titrer).
- Serbest vuruş: baraj, kavis, kaleci pozisyonu.
- Korner: kafa vuruşu mini anı. Taç (v2: uzun taç perk).

### 3.6 Maç Değerlendirmesi [v1]
- 0–10 puan: anlık katkılar (pas başarı, şut, gol, asist, top kaybı, kritik savunma).
- Maçın Oyuncusu ödülü. Isı haritası, istatistik ekranı, şut haritası.
- Maç sonrası: röportaj kararı (mütevazı / iddialı / eleştirel) → ilişki & şöhret etkisi.

### 3.7 Atmosfer [v1/v2]
- Stadyum kapasitesine göre kalabalık sesi, tezahürat, gol anında patlama; ıslık/yuhalama.
- Hava durumu: yağmur (top sürtünmesi ↓, kayma), kar (turuncu top), rüzgar (top sapması) [v1 hafif].
- Gece/gündüz ışıklandırma [v2], kamera sarsıntısı, gol tekrarı (replay) [v1 basit], çoklu kamera açısı [v2].

---

## 4. Yaşam Simülasyonu

### 4.1 Temel Göstergeler [v1]
Enerji, Mutluluk, Sağlık, Stres, Para, Şöhret, Disiplin (kulüp gözünde), Takipçi (sosyal medya).

### 4.2 İlişkiler [v1]
- Kişiler: Anne, Baba, Kardeş, Sevgili/Eş, Çocuklar [v2], Teknik Direktör, Takım arkadaşları (her biri ayrı), Ajan, Sponsor, Taraftar grubu, Basın, En yakın arkadaş (çocukluk).
- Her ilişkinin -100..100 değeri + "hafıza" (son 5 olay). İlişkiler zamanla doğal sönümlenir (ihmal).
- Etkiler: aile → mutluluk; sevgili → mutluluk/stres; takım arkadaşları → pas ve asist; TD → forma şansı; taraftar → moral & sponsor; basın → şöhret.
- Etkileşimler: ara, yemeğe çıkar, hediye al, birlikte antrenman, parti, tatil.

### 4.3 Varlıklar & Lüks [v1]
- Kategoriler: Ev, Araba, Saat, Moda, Teknoloji, Evcil Hayvan, Tekne/Yat, Uçak, Sanat, Ada, İşletme.
- Her eşya: fiyat, bakım gideri (haftalık), mutluluk bonusu, şöhret bonusu, özel etki (örn. jet → deplasman yorgunluğu -).
- İkinci el satış (değer kaybı / değer kazanan sanat eseri).

### 4.4 Finans [v1]
- Banka: vadesiz, vadeli faiz, kredi (faiz, taksit), kredi notu.
- Yatırımlar: endeks fonu, riskli girişim, gayrimenkul (kira geliri) [v1 basit], kripto benzeri volatil varlık [v2].
- İşletme sahibi olma: kafe, spor salonu, giyim markası (haftalık gelir/zarar) [v2].
- Vergi, menajer komisyonu, hayır işleri (şöhret+).

### 4.5 Kumarhane & Bahis [v1]
- Blackjack, Rulet, Slot makinesi, At yarışı, Zar (craps basit) [v1: blackjack, rulet, slot, at yarışı].
- Sorumlu oyun: bağımlılık göstergesi (stres ↑, disiplin ↓, sızan haber riski).
- **Kendi maçına bahis = ağır skandal** olayı (ceza, men).

### 4.6 Sosyal Medya [v1]
- Takipçi sayısı, paylaşım tipi (antrenman, lüks, aile, hayır, provokasyon) → şöhret/ilişki etkisi.
- Viral olay olasılığı, nefret yorumları (stres), marka işbirliği teklifi.

### 4.7 Sponsorluk [v1]
- Ayakkabı, saat, içecek, oyun markası. Şartlar: şöhret eşiği, davranış maddesi (skandal → fesih).
- Reklam çekimi aktivitesi (gün harcar, para kazandırır).

---

## 5. Olaylar & Kararlar

### 5.1 Olay Motoru [v1]
- Veri odaklı: her olay `id, koşullar, ağırlık, bekleme süresi, metin, seçenekler[], sonuçlar[]` şeklinde JSON/TS verisi.
- Koşullar: yaş, şöhret, ilişki, para, kulüp, form, gün tipi, önceki olay bayrakları (zincir olaylar).
- Sonuçlar: stat değişimi, ilişki, para, bayrak set, gecikmeli olay tetikleme, haber başlığı.
- Gizli olasılık + "tahmini risk" ipucu (örn. 🎲 riskli).
- Hedef: v1'de 150+ olay, v2'de 400+.

### 5.2 Olay Kategorileri
Takım içi (kaptanlık, soyunma odası kavgası, penaltıyı kim atacak, TD taktik tartışması), Aile, Aşk, Basın, Sosyal medya, Taraftar, Gece hayatı, Hayır işleri, İş fırsatları, Dolandırıcılık, Sağlık, Hukuk, Milli takım, Rakip oyuncular, Transfer söylentisi, Ödül töreni.

---

## 6. Dünya

### 6.1 Ligler & Kulüpler [v1]
- Prosedürel + gerçeğe benzeyen kurgusal dünya (lisans sorunu yok): 8+ ülke, ülke başına 2–4 lig kademesi, 16–20 takım.
- Kulüp: ad, şehir, renkler, arma (prosedürel), stadyum, itibar, bütçe, taktik kimlik, kadro (NPC oyuncular, rating + yaş + pozisyon).
- Düzenlenebilir veritabanı (mod desteği: JSON ile gerçek isimler yüklenebilir) [v2].

### 6.2 Turnuvalar [v1/v2]
- Lig (yükselme/düşme), Yerel Kupa (eleme), Kıtasal Kupa (grup + eleme) [v1 basit], Dünya Turnuvası/Kıta Şampiyonası (milli takım, 2 yılda bir) [v1 basit].
- Ödüller: Ayın Oyuncusu, Sezonun Oyuncusu, Gol Kralı, Altın Top eşdeğeri ("Altın Yıldız"), Genç Oyuncu, Yılın Golü (oylamalı).

### 6.3 Diğer Oyuncular [v1]
- NPC oyuncular yaşlanır, gelişir, transfer olur, emekli olur. Rakip yıldızlar (nemesis) [v2].

---

## 7. Ekonomi & Para Modeli
- Oyun içi para: maaş, bonus, sponsor, yatırım. **Premium para birimi yok** (v1).
- Monetizasyon önerisi: Ücretsiz deneme (1 sezon) + tek seferlik "Tam Kariyer" kilidi; kozmetik paketler (kramponlar, saç, kutlamalar). Reklam yok veya opsiyonel ödüllü reklam sadece kozmetik için.

---

## 8. Sunum
- Ses: kalabalık katmanları, hakem düdüğü, top vuruşu, file sesi, menü sesleri, dinamik müzik.
- Anlatım: metin tabanlı, Türkçe/İngilizce [v1]; sesli anlatım [v3].
- Haber Akışı: "Gazete manşeti" kartları, sosyal medya akışı.
- Kupa dolabı (3D değil, stilize kartlar), kariyer zaman çizelgesi.

---

## 9. Teknik
- TypeScript + Vite + Phaser 4 (maç sahnesi) + Preact (arayüz katmanı, DOM). 
- Simülasyon katmanı saf TS, render'dan bağımsız, birim testli (Vitest), seed'li RNG.
- Kayıt: IndexedDB, versiyonlu şema + migration, 3 slot, otomatik yedek (son 3), JSON dışa/içe aktarma.
- Mobil: Capacitor. Masaüstü: Tauri 2 (küçük boyut) / Steam için Electron + steamworks.js alternatifi.
- i18n: TR + EN. Erişilebilirlik: renk körü modu, yazı boyutu, titreşim aç/kapa, yardım seviyeleri.

Detaylı yapılacaklar listeleri: `docs/ANALIZ-VE-PLAN.md`.
