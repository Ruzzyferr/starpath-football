# Playtest Raporu (baş tasarımcı, Ekim 2026)

**Soru:** StarPath Football, NSS hayranları için NSS'den daha bağımlılık yapıcı ve daha mantıklı mı?
**Kısa cevap:** Çekirdek sistemler (pozisyon, kaleci kariyeri, kadro rolü, transfer, kiralama, milli takım, zor seviye, kadın kariyeri, sakatlık, kart, röportaj, sosyal medya) NSS'nin sevilen maddelerinin hemen hepsini karşılıyor ve çoğunu geçiyor. Oyun boyunca hissi en çok bozan şeyler sistem eksikliği değildi; **tekrar**, **bağlamla çelişen metinler**, **Türkçe ek hataları** ve **"bu hafta neyin peşindeyim?" sorusuna cevap olmamasıydı**. Bunlar düzeltildi. Düzeltmelerden önceki ve sonraki ölçümler aşağıda.

## Yöntem

- Harness: `game/src/sim/game/playtest.node.test.ts` (`PLAYTEST=1`). Gerçek oyun cephesi (`sim/game`) kullanıldı. **5 kariyer × 6 sezon** (1320 hafta) oynandı. Kariyerlerin dağılımı:
  - TR ST erkek, "pro", 16 yaş
  - TR GK kadın, "social"
  - BR LW, "gambler"
  - DE CB, "party"
  - EN AM kadın, "spender", 16 yaş
- Davranış insan gibi kuruldu:
  - Günler çeşitli planlandı: antrenman (performans %35–95), spor salonu, video, röportaj, hayır işi, reklam çekimi, golf. Akşamlar aile, arkadaş, takım yemeği, randevu, parti, alışveriş, oyun ve ara sıra kumarhane.
  - Maçlar otomatik çözüldü; maçların %45'inde maç sonu röportajı yapıldı.
  - Kartlar persona zevkine göre cevaplandı.
  - Teklifler pazarlıkla alındı (%60'ında 1–2 tur karşı teklif).
  - Sponsor ve ajan tutuldu, 3 haftada bir alışveriş yapıldı, yedekteyken hocaya şikâyet edildi.
- Çıktılar: kariyer başına okunur Türkçe transkript (~10.000 satır) ve `analysis.md`. Analiz şunları içeriyor: frekans tabloları, ölü haftalar, otomatik tutarlılık bayrakları, bedelsiz baskın seçenekli kartlar, itibar kaynakları ve hedef istatistikleri.
- "Önce" ölçümü aynı harness ile düzeltmelerden önceki commit (`cf8b402`) üzerinde, ayrı bir worktree'de koşturuldu. Böylece karşılaştırma birebir.

## Bulgular (oyuncu etkisine göre sıralı)

### 1. Haftalık hedef yoktu: "Bu hafta neyin peşindeyim?" (en yüksek etki)
NSS'nin en çok oy alan geç oyun şikâyeti "Play the match, buy energy, train, & repeat" idi (98 oy). Bizde de bir sezon "antrenman → maç → kart" döngüsünden ibaretti. Hoca, taraftar, sponsor ya da aile oyuncudan hiçbir zaman somut bir şey istemiyordu. Kartlar haftaya olay katıyor ama **yön** vermiyordu. Ölü hafta metriği düşük çıkıyordu (%2,5), çünkü kartlar her haftayı dolduruyordu. Transkripti okuyunca ise bir sezonun ortası birbirine benziyordu.

**Düzeltme: kişisel hedefler (`sim/game/objectives.ts`).**
- Kısa hedefler, süreli ve ödüllü:
  - Hoca: gol, asist, gol yememe, 3 maç reyting ortalaması, formayı hak et (yedekler için), kart görme.
  - Taraftar: galibiyet sözü. Kulüp favoriyse 2 galibiyet, değilse 1.
  - Sponsor: takipçi kampanyası.
  - Aile: ziyaret. Sebepler her sezon bir kez kullanılır.
  - Menajer: transfer döneminde vitrin, ödülü transfer ilgisi.
- Sezon başında iki uzun hedef verilir: kulübün güç sırasına göre yönetimin lig hedefi ve geçen sezona göre kişisel hedef (gol, gol yememe ya da maç sayısı).
- Ödüller çoğunlukla ilişki, hoca güveni ve moral, azıcık para. İtibar yalnızca sezon hedeflerinden gelir; şöhret sahada kazanılır.
- Kaçan hoca hedefi en fazla −2 güven getirir. Diğer kaçan hedeflerin cezası yoktur. Sezon bitince yarım kalan kısa hedefler sessizce düşer.
- Hedefler kendi tohumlu RNG'siyle üretilir; ana RNG akışını kaydırmaz.

| Metrik | Önce | Sonra |
|---|---|---|
| Kariyer-sezon başına verilen hedef | 0 | 19,3 (her ~2 haftada bir yeni hedef, aynı anda en çok 3 kısa hedef) |
| Hedef başarı oranı | – | %60 (ilk sürümde %49'du; zorluklar ayarlandı: başarılabilir ama garanti değil) |
| Hafta başına hedef olayı (yeni, tamam ya da kaçtı) | 0 | ~0,9 |
| Ölü hafta (kart, maç, teklif, kahraman haberi ve hedef yok) | 33 / 1320 (%2,5), 2 ardışık dizi | 11 / 1320 (%0,8), 0 dizi |

### 2. Tekrar: aynı manşet ve aynı alıntı, sezonlar boyunca
- Maç manşetleri: "Elif geçit vermedi: kalesini gole kapattı" bir kariyerde ×27, "Çifte darbe: Arda yine sahnede" ×22. Manşetlerin yalnızca **%57'si** benzersizdi.
- Röportaj: "Planımız sahaya yansımadı" bir kariyerde ×15, "Bu daha başlangıç" ×13. Alıntılar sonuçtan bağımsızdı; galibiyetten sonra da "planımız yansımadı" deniyordu. 375 manşetin 151'i benzersizdi.
- Günlük satırları: "Dinlendin, enerjin yerine geldi." 6.300 kez geçiyordu (tüm satırların %17'si).
- Aynı kart kariyerde 12 kez çıkabiliyordu (`teammates.penalty_taker`). Bu sırada başka kartlar hiç görünmedi.

**Düzeltmeler:**
- Manşet havuzları 2–3 varyanttan 4–6 varyanta çıktı. Bazıları rakip adı içeriyor. Son 12 manşette geçen kalıp tekrar seçilmiyor. Savunmacı ve kaleci için ayrı havuz var. "Büyük maçın adamı" ifadesi "yıldızı" oldu.
- Röportaj seçenekleri artık sonuca (galibiyet, beraberlik, mağlubiyet) ve mevkiye göre alıntı varyantı taşıyor. Kaleciye "gol krallığı" yerine "en az gol yiyen kaleci" soruluyor. İki yeni nötr konu eklendi: hedefler/kariyer ve saha dışı.
- 17 aktiviteye 2–4 bitiş cümlesi eklendi. Seçim gün ve slottan hash ile yapılıyor; RNG akışı değişmiyor.
- Kart motoruna **yenilik azalması** eklendi: ağırlık × 0,7^(kariyerde görülme sayısı), taban 0,2. Ayrıca `fans.autograph_swarm` bekleme süresi 10'dan 15 haftaya çıktı.

| Metrik | Önce | Sonra |
|---|---|---|
| Benzersiz manşet oranı | %57 | %68 |
| En sık manşetin tekrarı (5 kariyer) | ×27 | ×11 |
| Röportaj manşeti benzersizliği | 151 / 375 | 233 / 374 |
| Bir kariyerde en çok tekrar eden kart | ×12 | ×9–11 (koşuya göre) |
| Görülen farklı kart | 225 | 226–231 |
| Farklı günlük satırı | 1.429 | 1.671 |
| "Dinlendin…" payı | 6.300 satır | 5 varyanta eşit dağılıyor (~1.200'er) |

### 3. Bağlamla çelişen metinler (mantık hissini bozuyordu)
- **Kulüp rekoru manşet seli:** "Arda Yıldız İstanbul FK tarihine geçti: Bir sezonda en çok gol" bir kariyerde **19 kez** çıktı; rekor her gol uzadığında yeniden manşet oluyordu. Bu manşet 5 kariyerde toplam 29 kez görüldü. Ayrıca sezon ortası transferden sonra eski kulüpte atılan goller yeni kulübün rekoruna sayılıyordu. Düzeltme: rekora yalnızca o kulüpte atılan goller sayılıyor. Rekor sezonda bir kez manşet oluyor; sonraki uzatmalar sessiz günlük satırı. Sonra: 8 manşet.
- **Röportajda yanlış soru:** dolgu konuları formdan bağımsız ekleniyordu. 1-0 yenilen kaleciye "Son haftalarda durdurulamıyorsun" deniyor, maç *sonrası* "Bu maçın baskısı omuzlarında mı?" diye soruluyordu (159 kez). Şimdi "durdurulamıyorsun" yalnızca form ≥ 60'ta, "eski sen değilsin" ≤ 42'de soruluyor. Baskı sorusu yalnızca maç öncesinde var. Maç sonrası yanlış soru 0'a indi.
- **Hayalet sevgili:** sevgilisi olmayan oyuncuya "{partnerName} ile yüzleş" seçeneği ve "{partnerName} gizemden hoşlanmadı" sonucu çıkıyordu. Uydurma bir isim kullanılıyordu (`rumour.romance_gossip` ve `romance_photo`). Artık bekâr oyuncuda anne devreye giriyor.
- **Sonsuz "Ailemle tanışır mısın?"**: "Biraz erken değil mi?" seçeneği kartı 8 haftada bir yeniden açıyordu; bir sezonda 4 kez görüldü. İkinci ertelemede konu kapanıyor.
- **Ay ödülü dili:** "Mayıs Ayın Oyuncusu" → "Mayıs Ayının Oyuncusu". Teklif satırındaki çift ikon (📨 📨) ve rekor satırındaki çift ikon temizlendi.
- **Yaşa uygunluk:** 16–17 yaşındaki oyuncuya en yakın arkadaşının "tefeciye kumar borcu" kartı geliyordu. Bu karta artık en az 18 yaş şartı var. Diğer otomatik "yaş" bayrakları yanlış alarm çıktı ("biraz" kelimesinin içindeki "bira"); harness düzeltildi.
- **Hedef sistemi kendi çelişkisini üretti ve düzeltildi:** "Annenin doğum günü" 8 haftada bir tekrarlanıyordu. Artık 4 farklı aile sebebi var ve her biri sezonda en çok bir kez kullanılıyor.

### 4. Türkçe ek hataları (her sahnede göze batıyordu)
Şablonlar örnek isme göre yazılmıştı (`{city}'de`, `{agentName}'ı`). Gerçek isim başka olunca şu hatalar çıkıyordu:
- "İstanbul'de", "Efe'in", "Can'in", "Ayşe'e", "Rui Costa Neto'ı", "Marco'ın", "Elif'dan", "NordlinePitch'ın"
- Toplam **337 otomatik bayrak**, onlarca farklı kalıp.

Düzeltme: `sim/career/trSuffix.ts`. Yer tutucudan hemen sonra gelen hal eki (ilgi, yönelme, belirtme, bulunma, ayrılma, vasıta, -daki) gerçek isme göre ünlü uyumu ve kaynaştırma harfiyle yeniden çekiliyor. Kart metinleri (`formatText`) ve tüm haber ve günlük satırları (`fill`) bundan geçiyor. Sonra **15 bayrak** kaldı; bunlar da tartışmalı yabancı okunuşlar ("Caps'i", "VIP'de").

### 5. Tempo: itibar kolay çiftçilik yapılıyordu
İnsan gibi oynayan harness'te itibarın yarısı PR'dan geliyordu (sezon başına itibar):

| Kaynak | Önce | Sonra |
|---|---|---|
| Röportaj aktivitesi | 2,83 | 1,18 |
| Hayır işi aktivitesi | 1,94 | 0,86 |
| Maç sonu röportajı | 1,55 | 1,44 |
| Maç (oynanan) | 2,14 | 3,09 |

Önce oyuncu 21 yaşında 100 itibara, OVR 72'yle ulaşıyordu; NSS'nin "her şeyi aldım, şimdi ne?" sorunu erken geliyordu. Yapılanlar:
- Aynı hafta tekrarlanan PR aktivitesi yarı yarıya etki ediyor ve şöhret arttıkça etkisi küçülüyor.
- Röportaj itibarı 0,5'ten 0,3'e, hayır işi itibarı 1'den 0,6'ya indi.
- Maç sonu röportajı itibar tavanı 2'den 1,2'ye indi.
- Şöhretin ana kaynağı artık saha.

Kalan not: harness'te çok gol atan forvet (34 maçta 49 gol, OVR 70) yine 22 yaşında 95 itibara çıkıyor. Kaynağı maç motorunun gol üretimi (bkz. Açık maddeler).

### 6. Bedelsiz baskın seçenekler (seçim değil, doğru cevap)
Statik analiz her kartın her seçeneğinin sonucunu tarıyor. 25 kartta "yalnızca artısı olan" bir seçenek bulundu; bu kartlar toplam 507 kez gösterilmişti. En sık görülen 8 karta gerçek bir bedel eklendi:

| Kart | Eklenen bedel |
|---|---|
| `press.rival_trash_talk` | "Sahada görüşürüz" seçeneğine derbi baskısı: stres +3 |
| `teammates.penalty_taker` | Penaltıyı bırakmak moralden götürür |
| `rumour.feud_gossip` | Ortak video çekmek yorgunluk getirir |
| `casino.teammate_cards` | Çekirdekle oynamanın yorgunluğu var |
| `health.insomnia_gaming` | Takım turnuvası artık yorgunluğu azaltmıyor |
| `manager.rest_or_play` | Yedek başlamayı önermek moral ve güven bedeli taşıyor |
| `nightlife.curfew_sneak` | Erkenden yatmak arkadaşı kırıyor |
| `community.school_visit` | Dürüst cevap stres ve enerji bedeli taşıyor |

Sonra bu kartların gösterim sayısı 507'den 337'ye indi. Kalanların çoğu kasıtlı "akıllı cevap" kartları (dolandırıcıya karşı menajeri aramak) ya da "parayı reddet" gibi fırsat maliyeti olan seçenekler.

### 7. Mutluluk metresi anlamsızdı
Mutluluk 1320 haftanın %64–90'ında 90 ve üstündeydi, hiçbir kariyerde 50'nin altına düşmedi. Stres ve enerji de sabit kalıyordu. Yani "mutluluk için" yapılan seçimlerin karşılığı yoktu. NSS'nin "Girlfriend is for happiness, but happiness is for what?" şikâyetinin aynısı. Düzeltme: zaten mutluyken eğlencenin etkisi azalıyor (yumuşak tavan, 75 üstünde lineer azalma, en düşük ×0,2). Bu ilk adım; metrenin maça etkisinin oyuncuya gösterilmesi gerekiyor (bkz. UI).

### 8. Para ve adalet
- Para anlamlı kalıyor: alışveriş, bakım ve kumar yeterince harcama yaratıyor. Ama 5. sezondan sonra yıldızlarda nakit birikiyor (11M+). Ada ve iş yatırımı gibi geç oyun lükslerinin bunu emmesi gerekiyor (açık madde).
- Bir adalet örneği incelendi: "offshore şirket" zincirinde (`money.creative_accountant` → `tax_audit`) iki kez yüksek riskli seçenek seçen kumarbaz kariyer bütün nakdini kaybetti (−257K). Bu, risk etiketli iki bilinçli seçimin sonucu. NSS hayranlarının sevdiği "seçimlerin sonucu var" ilkesine uyuyor. Ancak etiket ("ada şirketi") belirsiz; açık maddelere yazıldı.

## NSS'de sevilenler: bizde var mı, daha iyi mi?

| NSS'de sevilen | Bizde | Durum |
|---|---|---|
| "Bir maç daha" bağımlılığı | Kilit anlar + hafta hafta **hedefler** + kartlar | Hedeflerle daha güçlü |
| Saha dışı hayat, ilişki dengesi | 26 kategori, 230+ kart, ilişki defteri | Daha derin |
| Seçimlerin sonucu var | Risk etiketli zincirler | Var; 8 baskın seçenek düzeltildi |
| Tabloid mizahı | Gazete ve muhabir stilleri | Var; tekrar azaltıldı |
| 16 yaşından yıldızlığa | Kadro rolü, kiralık, transfer talebi | Daha mantıklı (pozisyon/rol) |
| Kaptanlık | `captain` rolü | Var |
| Milli takım, alt yaş takımları | U17, U21, A takım, çağrı ölçeri | Daha iyi |
| Kumarhane ve at yarışı | Blackjack, rulet, slot, at, zar | Var; futboldan fazla kazandırmıyor |
| Mülk ve lüks | Varlıklar, iş, banka | Var |
| Kadın futbolu | Cinsiyet seçimi, zamir şablonları | Var |
| Zor mod | 4 zorluk seviyesi | Var |
| Kaleci kariyeri (516 oy) | GK arketipi, kaleci primi, gol yememe hedefleri | Var |
| Röportaj mini oyunu | 3 soruluk, muhabir stilli oturum | Bağlam ve çeşitlilik düzeltildi |

## Arayüz (UI) için yapılacaklar (sim tarafı hazır)

Tüm veri `sim/game` cephesinden geliyor: `objectivesView(state)` (`ObjectivesView`). Sonuç satırları günlüğe `kind: 'career'`, ikon `🎯` (tamamlanan) ve `⌛` (kaçan) ile de düşüyor.

1. **Ana ekran hedef kartı.** `active` listesinden en fazla 3 hedef gösterilecek. Her hedefte:
   - kaynak ikonu ve adı (`icon`, `sourceName`)
   - başlık
   - ilerleme çubuğu (`ratio`, metin olarak `progress/target`; reyting hedefinde `progress` ortalama reytingdir)
   - kalan hafta (`weeksLeft`)
   - ödül metni (`reward`) ve varsa ceza metni (`penalty`)
   - sezon hedefleri (`seasonal: true`) ayrı ve küçük bir satırda.
2. **Hedef tamamlanınca toast/kutlama** (günlükte `🎯 Hedef tamamlandı…` satırı). Kaçan hedef için sade bir bilgi satırı (`⌛`).
3. **Kariyer veya sezon sonu ekranı:** `done` / `failed` sayaçları ve `recent` (son 5) listesi.
4. Mutluluk metresinin yanına "maçta soğukkanlılık etkisi" ipucu, böylece metre bir şeye yarar. Değer için mevcut `mentalMatchModifier` kullanılacak.

## Açık maddeler (benim alanım dışında ya da sonraki tur)

- **Maç motoru (match engineer):** harness'te OVR 66–70'lik bir forvet 2. ve 1. kademede sezonda 35–49 gol atıyor. Otomatik reyting ortalaması 6,29. Gol üretimi itibar enflasyonunun asıl kaynağı.
- Geç oyunda para emme: yıldızlar 6. sezonda 5–11M nakitle "parası boşta" haftalar yaşıyor (harness'te kariyer başına 16–28 hafta).
- `money.tax_audit` metni: "ada şirketin" yerine "offshore şirketin" denmeli. Zincirin cezası maaşa bağlı ve sert; risk etiketi var ama oyuncuya cezanın büyüklüğü önceden gösterilmeli.
- Kart frekansı haftada 1,7–1,8 ile hedefte. Yenilik azalmasıyla 230 kartın çoğu dolaşıyor. 10+ sezonluk kariyerler için yeni içerik eklenmeli: özellikle `business` ve `national` kategorileri (%0,3).

## Ölçüm ve doğrulama

- `npx vitest run src/sim`: 56 dosya, 589 test geçti (2 atlandı).
- `npm run lint`: 0 hata.
- Golden master bilerek güncellendi (`careerSeason`); commit mesajlarında belirtildi.
- Tam denge (`BALANCE=1`, 30 × 10). "Önce" sütunu düzeltmelerden önceki commit (`cf8b402`) üzerinde aynı koşuyla ölçüldü:

| Hedef | Önce | Sonra | Durum |
|---|---|---|---|
| İtibar 21 yaş ~50, 25 yaş 75–85 | 48 / 77 | 49 / 83 | Tutuyor |
| İlk 1. kademe (21–23 yaş) / elit kulüp (22–24 yaş) | 20 / 23 | 20 / 23 | Önceki gibi |
| Pot ≥ 85 → 25 yaşına kadar OVR 80+ | 9/9 | 9/9 | Tutuyor |
| 3. sezon net servet medyan ≤ 300K / max ≤ 2M | 113K / 1,4M | 171K / 2,2M | Medyan tutuyor; max tek bir aykırı kariyer (2,2M), sınırda |
| İflas yok (normal oyuncu) | %0 | %0 | Tutuyor |
| Haftalık kart 1,5–2,5 | 1,7 | 1,7 | Tutuyor |
| Sakatlık 1–2 / 3–6 hafta | 1,9 / 3,8 | 1,9 / 3,5 | Tutuyor |
| Enerji antrenmanı engellemez | %0 | %0 | Tutuyor |
| Kumarhane payı: kumarbaz %15–35 / tüm kariyerler ≤ %5 | %45 / %8 | %28 / %6 | İyileşti. Önceki sapma bu çalışmadan önce de vardı; BALANCE.md'deki %17 / %4 eski bir ölçüm |
