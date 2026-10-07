# Maç Sahnesi Sanat İncelemesi (MATCH-ART-REVIEW)

Kapsam: `game/src/game/**` maç sahnesinin görselleri (canlı an, kornerler, frikik barajı, penaltı, orta, kontra, kaleci anları, gol sevinci, tekrar), antrenman sahası. Hedef: New Star Soccer'ın düz, yukarıdan bakan özetlerinden belirgin biçimde bir kuşak ileride, stilize 2.5D "yayın" görünümü; mobil performans korunarak.

Yöntem: `match-demo.html?kind=<tür>&seed=<n>&auto=1` ile tüm türler, Low/Medium/High profilleri, gündüz/gece, yağmur/kar, 4 stadyum katmanı (local / mid / large / mega); 390x844 (iframe içinde, http üzerinden) ve 1440x900 ekran görüntüleri (Playwright, kurulu Chrome). Görüntüler: `scratchpad/shots/matchart-before-*.png` (önce) ve `matchart-v*-*.png` (sonra).

## Puanlar (10 üzerinden)

| Alan | Önce | Sonra | Not |
|---|---|---|---|
| Oyuncu/top okunabilirliği | 5 | 8 | Figürler 1,3x stilize, koyu dış hat; portre telefonda kadraj 24 m → 21 m; top ayaktayken oyuncunun önünde çizilir |
| Derinlik (2.5D) | 4 | 8 | Ayakta duran figürler, kafa/gövde yüksekliği, uzun gölgeler, file hacmi, tribün yükselişi |
| Işık | 3 | 8 | Kalıcı yayın vinyeti, gece projektör konileri + çim üzerinde ışık havuzları, gündüz tribün gölgesi, güneş yönünden düşen gölgeler |
| Çim dokusu / biçme | 5 | 8 | Kenarı yumuşayan biçme şeritleri, tekrar eden çim dokusu (bake'e gömülü, maliyetsiz), kale ağzı/penaltı noktası/orta yuvarlak/yan hakem koridoru aşınması, yumuşatılmış çizgiler |
| Oyuncu sprite'ları / animasyon | 3 | 8 | 26 poz × 5 yön (+ ayna): 8 kareli koşu, şut (vuruş + takip), kafa sıçrayışı, kayarak müdahale, kaleci plonjonu / topu tutma / hazır duruş, yerde, diz kayma, takla, kol açma/kaldırma/işaret, baraj |
| Gölgeler | 4 | 8 | Temas lekesi + güneş gölgesi (gündüz) ya da 1–4 projektör gölgesi (gece, profile göre); hepsi oyuncuların altında tek katmanda |
| Top (dönüş, iz) | 5 | 8 | Desen döner, ışık sabit kalır (gerçek dönüş hissi); hızlı topta 3 hayalet kare (hareket bulanıklığı); kahramanın sert şutlarında altın iz |
| File / kale | 5 | 8 | Yarı saydam file hacmi, arka direkler ve üst bar; yakın kale arkadan bakınca kutu olarak okunuyor |
| Seyirci | 3 | 8 | Ekranda sıkıştırılmaya göre önceden uzatılmış insanlar (gövde + kafa + şapka/atkı/kalkan kollar), basamaklar, merdiven boşlukları — artık piksel gürültüsü değil |
| HUD tipografisi | 4 | 8 | UI token'ları: Barlow Condensed (--font-display) + Teko (--font-score); skor bandı (altın dakika, takım renk çizgileri, beyaz skor), parlayan süre çubuğu, yayın tarzı "GOL!" bandı; masaüstünde %25 büyük HUD |
| Parçacıklar | 5 | 8 | Çim yaprağı parçacıkları, kayma/plonjonda toprak bulutu, yağmurda sekme sıçraması; bütçe (ParticleBudget) aynen geçerli |

## Önceki durumun başlıca sorunları

- Oyuncular yukarıdan bakılan bir disk + küçük kafa + çubuk bacaklardı; kol yoktu (sadece sevinçte), şut/kafa pozu yoktu, kayma ve plonjon diskin döndürülmesiydi. Bacaklar her karede 22 `Graphics` ile yeniden çiziliyordu.
- Çim düz renk bantlarıydı; doku, aşınma, ışık yoktu; çizgiler tırtıklıydı.
- Gece neredeyse gündüz gibi görünüyordu (koyulaştırma + ADD ışık havuzları birbirini götürüyordu).
- Seyirci 3 px noktalardı; tribün görüntüsü ekranda 0,25 oranında sıkıştırıldığı için piksel gürültüsüne dönüşüyordu.
- HUD sistem fontuyla düz metindi; telefonda yönerge ile "FULL AIM · ×0.80 XP" üst üste biniyordu; tekrarda letterbox skor yazılarının üstünde kalıyordu.
- Yakın kalenin filesi çerçeveden kopuk görünüyordu; top, top süren oyuncunun arkasında kalıp kayboluyordu.

## Yapılanlar

1. **`figures.ts` (yeni)** — her poz küçük bir 3B iskelet (pelvis, gövde eğimi, uyluk/baldır açıları, omuz/dirsek/el); sahnenin kendi izdüşümüyle (TILT, ZS) 5 yönde çizilir, sol yönler aynalanır. Yüklemede tek seferlik canvas çizimi:
   - Forma başına kit sayfası (forma deseni — çizgili, çember, yarım, kuşak, şerit — şort, tozluk, krampon, kaleci eldiveni/uzun kol, koyu dış hat; renk körlüğü / forma çakışmasında takım dış hattı rengi sayfaya gömülür),
   - Tek ortak ten sayfası (açık gri; oyuncu başına tint), 
   - Arka / yan / ön görünüşlü kafalar (saç stilleri, kadın oyuncularda at kuyruğu), forma numarası çıkartması (sırtta büyük, göğüste küçük).
   - Çözünürlük profile göre: Low 30, Medium 36, High 42 px/m.
2. **Maç sahnesi** — oyuncu başına `Graphics` bacak çizimi kalktı; yerine 4 görüntü (ten, kit, numara, kafa) + yerde yön oku; şut/kafa/tutuş animasyonları runtime olaylarından (`kick`, `header`, `save`) yalnızca görsel saatlerle tetiklenir. Sevinç pozları yeni karelere bağlandı; özel kol hareketleri (shush, kalp, robot, buz) çıplak kollu karenin üstüne çizilir.
3. **Saha** — `drawPitch` yeniden yazıldı; çizgiler ayrı bir katmanda, çim dokusu `DynamicTexture.repeat` ile aynı bake dokusuna gömülür (çalışma anında ek çizim yok). Antrenman sahası da artık tek seferlik bake.
4. **Işık** — gece koyulaştırması sahanın altına alındı (çim kendi gece paletini taşır), projektör konileri Medium/High'da tek bir ADD dokusuna bake edilir; vinyet her zaman açık (gündüz 0,26 / gece 0,42).
5. **UI ile renk eşleşmesi** — sahne çim renkleri `PITCH_COLORS` olarak dışa açıldı (`game/src/game/art.ts`): varsayılan çim `PITCH_COLORS.clear = ['#3f9140', '#358236', '#2c6d2e']` (açık şerit, koyu şerit, saha dışı); gece `PITCH_COLORS.night`.

## Performans (perf spec, 4x CPU kısıtlı mobil)

| Profil | Eşik | Sonra (counter / corner) |
|---|---|---|
| High | ≥60 | 149 / 153 fps (Phaser), p95 8,4 ms |
| Medium | ≥55 | 164 / 153 fps |
| Low | ≥60 | 172 / 171 fps |

Masaüstü 1440x900: tüm profillerde ~195 fps (Phaser). Oyuncu başına çizim artık yalnızca görüntü (Graphics yok), bu yüzden sahne eskisinden daha ucuz.

## Kalan / bilinçli bırakılanlar

- Tekrar karelerinde runtime olayı olmadığı için şut animasyonu tekrarlarda oynamaz (koşu/kayma/plonjon oynar).
- "Bazı saha çizgileri kenardan taşıyor" bulgusu: çizgiler saha sınırında; kamera dar kadrajda ekran kenarında kesiyor — tasarım gereği.
- Konfeti dünya katmanında, HUD bandının altında kalan kamera görüş alanına kırpılır; skor bandının üstüne çizilemez.
