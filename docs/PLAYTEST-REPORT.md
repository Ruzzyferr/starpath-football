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

---

# Tur 2 (baş tasarımcı, Ekim 2026): uzun kariyer, kariyer sonu, Legacy

**Soru:** Oyun 8–15 sezon boyunca, gençlikten emekliliğe ve çocuğun Legacy kariyerine kadar NSS'den daha bağımlılık yapıcı, daha mantıklı ve daha iyi hissettiriyor mu?
**Kısa cevap:** İlk 4–5 sezon NSS'den belirgin biçimde iyi. Hedefler, kartlar, röportajlar, milli takım ölçeri ve ödüller her haftaya bir sebep veriyor; ölü hafta yok denecek kadar az (%0,7). Sorunlar uzun kariyerde başlıyordu. Gol kralı bir forvet milli takıma hiç çağrılmadı. Oyun 32 yaşındaki bir yıldızı soru sormadan emekli etti. Legacy çocuğu 16 yaşında milyoner başladı. 8. sezondan sonra kart destesi tükendi. En ağır beşi düzeltildi; kalanlar aşağıda sıralı.

## Yöntem

- Harness genişletildi (`PLAYTEST=1 PLAYTEST_PLAN=r2`, `game/src/sim/game/playtest.node.test.ts`). Toplam 2.418 hafta oynandı:
  - **Uzun koşu:** TR ST, "pro", 20 yaşında başlayıp 15 sezon. Emeklilik kararı insan gibi veriliyor: 34+ yaşta yedekse ya da OVR zirvesinin 6 puan altına düştüyse emekli olur, 37'de kesin bırakır. Ardından jübile, belgesel ve Onur Listesi kaydı geliyor.
  - **5 kariyer × 8 sezon:**
    - GK, kadın, TR, "social"
    - CB, DE, "party"
    - AM, kadın, EN, "spender" (iş kurar)
    - **Legacy:** uzun koşunun emeklilik belgeselinden `legacyStartFrom` ile doğan çocuğu (LW, TR)
    - **Ağır kumarbaz:** BR LW, akşamların çoğu kumarhanede, masa limitinde oynuyor, at ve zar dahil
- Yeni ölçümler eklendi:
  - kariyer evresine göre tempo (genç ≤20, yükseliş 21–24, zirve 25–30, düşüş 31+)
  - sezona göre ilk kez görülen kart payı
  - evreye göre kahraman manşeti benzersizliği
  - özellik kullanımı tablosu
  - milli takım çağrı ölçeri dökümü (her hafta skor ve eşik)
  - emeklilik karar günlüğü
- **Harness hataları bulundu ve düzeltildi:**
  - Kumar bahsi masa limitinin (%1,5) üstündeydi. Ağır kumarbazın 458 kumarhane gecesinin 450'sinde tek bahis kabul edilmemişti. Tur 1'deki kumar gözlemleri bu yüzden eksikti.
  - Kişisel antrenör geçersiz bir grupla tutuluyordu. Bu yüzden günlükte `{n}` görünüyordu.
- "Önce" ölçümü, düzeltmelerden önceki kodla aynı harness üzerinde alındı. Sayılar `r2-before`, `r2-after` koşularından.

## Bulgular (oyuncu etkisine göre sıralı)

### 1. Gol kralı, milli takıma hiç çağrılmadı (en yüksek etki, NSS şikâyeti #45)
- **Kanıt:** Uzun koşudaki forvet 12 sezonda 382 maçta 336 gol attı, 34 ödül aldı, itibarı 95'e çıktı ve **0 milli maç** oynadı. Haftalık ölçer dökümü sebebi gösteriyor.
  - Kahramanın seçim skoru 81, Türkiye forvet barajı 89–91. Ölçerin "güç" parçası 8 sezon boyunca **0** kaldı.
  - Aynı tablo, OVR'si 80–82 olan EN AM, BR LW ve TR LW için de geçerli: 0 A milli maç. Yalnızca kaleci (kontenjan 3) çağrıldı.
  - Kök neden dünyada. Ortalama sabit tutuluyor ama üst kuyruk açılıyor. Dünya top-20 OVR ortalaması 4 sezonda 90'dan 95'e çıkıyor, %90'lık dilim 79'dan 84'e. Kahraman ise BALANCE hedefi gereği 80–83'te zirve yapıyor. NSS'deki "50 maç üst üste maçın adamı oldum, hâlâ çağrılmadım" şikâyetinin birebir aynısı.
- **Düzeltme (`sim/game/national.ts`):** Seçim skoruna −2…+10 arası bir **sezon performansı** eklendi:
  - reyting (6,7 üstü)
  - gol + asist / maç (forvet ve orta saha), gol yememe / maç (kaleci ve defans)
  - şöhret
  - Sezonun ilk 6 maçında geçen sezonla harmanlanıyor.
  - Çağrı ölçütü metni de güncellendi.
- **Ek tutarlılık düzeltmeleri:**
  - "Aday kadrodasın" telefonu (`national.first_callup`) artık yalnızca A takım ölçeri 48+ iken geliyor. Kadroya giremezsen duyuruda "aday listesindeydin ama son kadroya giremedin" kapanışı var.
  - "X, Türkiye kadrosunda" manşeti her duyuruda değil, yalnızca ilk çağrıda ya da geri dönüşte çıkıyor.
  - Milli gol manşetinin 6 varyantı var; ilk milli gol ayrı bir haber.
  - Yeni kart `national.international_retirement` ile milli takımı bırakmak mümkün. Kadro duyurusu bu kararı tanıyor.

| Metrik | Önce | Sonra |
|---|---|---|
| Uzun koşu (TR ST) A milli maç / gol | 0 / 0 | 47 / 40 |
| Legacy çocuğu (TR LW) A milli maç | 0 | 9 |
| GK (TR, kadın) A milli maç | 27 | 36 |
| EN AM / BR LW / DE CB | 0 / 0 / 0 | 0 / 0 / 0 (EN orta saha barajı 94–95; dünya sorunu, açık madde) |
| "X, Türkiye kadrosunda" en sık tekrar | ×15 | ilk çağrı ve geri dönüş |
| "X, Türkiye formasıyla # gol attı" | – (gol yoktu) | 6 varyant |

### 2. Oyun, 32 yaşındaki yıldızı sormadan emekli etti
- **Kanıt:** Uzun koşuda S13 H32'de çapraz bağ koptu (33 hafta). Oyuncu ilk 11'de, OVR 79, 41 gollük sezonun içindeydi. Aynı gün zorunlu emeklilik geldi. Karar kartı, "bir sezon daha" seçeneği ya da dönüş hikâyesi yoktu. 33 yaşında açılan yıllık emeklilik kararı hiç görülmedi; düşüş evresi 76 haftada kaldı.
- **Düzeltme (`retirement.ts`):** Kariyer bitiren sakatlık artık yalnızca 34+ yaşta ve 30+ haftalık yoklukta zorunlu (önce 31+ yaş ve 24+ hafta). Daha genç oyuncu ağır sakatlıkta yine isterse emekli olabiliyor (`canRetire`).
- **Sonra:** Karar günlüğü şöyle:
  - 33 yaş, OVR 78, yedek: "bir sezon daha"
  - 34 yaş, OVR 74, yedek: emekli
  - Ardından jübile 2-2, belgesel, Onur Listesi'nde "Ölümsüz Efsane" ve Legacy çocuğu.
  - Düşüş evresi 174 haftaya çıktı. Bu dönemde yedek kulübesi, rotasyon konuşması ve "Ne zaman bırakacaksın?" sofrası yaşanıyor.

### 3. Legacy çocuğu 16 yaşında milyoner (rags-to-riches atlanıyordu)
- **Kanıt:** Miras, ebeveynin net servetinin %5'i (tavan 2M). 31M'lık bir efsanenin çocuğu şöyle başladı:
  - 1. sezonda 810K nakit, 1,8M net servet, 15 lüks alım
  - 4. sezondan sonra her sezon 29–38 hafta "parası boşta"
  - 3. sezonda 2,57M net servet (BALANCE tavanı 2M)
  - 22 yaşında 82 itibar
- **Düzeltme (`legacy.ts`):**
  - Miras %2'ye indi (5K–150K).
  - İtibar bonusu en çok 10 (önce 15).
  - Ünlü soyadı perki ve ebeveyn ilişkisi duruyor.
  - İki yeni Legacy kartı var: "Efsanenin Gölgesi" (basın kıyaslaması) ve "Efsaneden Bir Ders". İkisi de ebeveyn ilişkisini oynatıyor.
- **Sonra:** 1. sezon nakdi 60K, 3. sezon net serveti 454K. Çocuk yine avantajlı ama tırmanış duruyor.

### 4. Kart destesi 8. sezonda tükeniyordu (uzun kariyerde tekrar)
- **Kanıt:**
  - İlk kez görülen kart payı: S1 %92 → S5 %16 → S8 %4 → S9–S13 %0–5.
  - 31+ evresinde kartların yalnızca %1'i yeniydi.
  - `fans.autograph_swarm` bir kariyerde ×24 çıktı.
  - Gençlik ve zirve kartları emeklilik yaşında da dönüyordu.
- **Düzeltmeler:**
  - `content/careerArc.ts`: evreye bağlı **16 yeni kart**.
    - Yıldız yılları: belgesel teklifi ve yayın (iki adımlı zincir), ödül kampanyası, "hesapta duran milyonlar" vakfı (geç oyun para emicisi).
    - Veteran yılları: toparlanma, rotasyon konuşması, formanı isteyen genç, yorumculuk teklifi, "Ne zaman bırakacaksın?", rakip tribünden alkış, soyunma odasının abisi/ablası, başkanın veda sezonu teklifi, MR sonuçları.
    - Ayrıca: milli takıma veda ve iki Legacy kartı.
  - Yenilik tabanı 0,2'den 0,1'e indi: çok görülen kart, görülmemiş kartın yanında artık gerçekten geri planda kalıyor.
  - İmza seli kartının bekleme süresi 15 haftadan 26 haftaya çıktı.

| Metrik | Önce | Sonra |
|---|---|---|
| Görülen farklı kart | 247 | 265 |
| İlk kez görülen kart payı S8 / S10 / S12 | %4 / %5 / %1 | %6 / %9 / %7 |
| Bir kariyerde en çok tekrar eden kart | ×24 | ×17 (15 sezonluk kariyerde) |
| Farklı günlük satırı | 2.344 | 2.553 |

**Kalan:** 15 sezonda yaklaşık 1.000 kart çıkıyor, deste 265 kart. Tekrar matematiksel olarak kaçınılmaz. 10+ sezon için 60–80 kart daha gerekiyor (bkz. Açık maddeler).

### 5. Röportaj alıntıları tekrar ediyordu
- **Kanıt:** Transfer, rakip, form, kulübe, hoca, kumar, maç önü, milli ve sözleşme konularında her tonun **tek** cümlesi vardı. Örnekler:
  - "Tek transferim yataktan mutfağa" ×18
  - "Kapıyı kapatmıyorum" ×16
  - "Özel hayatım beni ilgilendirir" ×13
  - "Gol atacağım" ×12
- **Düzeltme:** 25 seçeneğe bağlama uygun 2–3 varyant eklendi (`interview.ts`, `alts`). Kumarhane manşetlerine 5 varyant eklendi; "rulet" gibi olmayan bir ayrıntı uydurulmuyor.
- **Sonra:** Manşet benzersizliği %56'dan %60'a çıktı. Yıldızlık ve düşüş evrelerinde %55–65. "Tek transferim…" 15 sezonda ×10'a indi (önce 13 sezonda ×18). Listenin başında artık maç manşetleri var; kaynakları gol hacmi (bkz. Açık maddeler).

### 6. Belgesel, efsaneyi "Ayın Oyuncusu" listesine indiriyordu
- **Kanıt:** 60 ödül, 7 kupa ve 47 milli maçlık kariyerin "en iyi anları": sekiz satırın üçü "Ayın Oyuncusu (Ocak/Eylül)". Kupalar ve milli takım listede yoktu (ilk 8 ödül kronolojik kesiliyordu).
- **Düzeltme (`hallOfFame.ts`):** Anlar ağırlığa göre sıralanıyor: kupa, sezon ödülü, milli kariyer, en golcü sezon, aylık ödül. Tekrarlar gruplanıyor: "4× Lig Gol Kralı (2028–2033)", "3× 🏆 Süper Lig (…)", "🎽 47 milli maç, 40 gol".

### 7. Ağır kumarbazlığın sonucu (harness düzeltildikten sonra ilk kez ölçüldü)
- 380 kumarhane gecesinde ~5,2M bahis oynandı. Net sonuç +153K. Bu varyans: slot ve at yarışında büyük vurgunlar var; RTP testleri evi kârlı gösteriyor.
- Futbola etkisi var gibi görünüyor ama kanıt zayıf. Aynı tohumla önceki koşuda da kumarhane ziyaretleri vardı, yalnızca bahisler reddediliyordu. O koşuya göre:
  - 26 yaşında itibar 78 yerine 60
  - 2. kademede kaldı (önce 1. kademe)
  - maaş 155K yerine 53K
  - Ziyaretin disiplin ve basın bedeli iki koşuda da vardı. Farkın bir kısmı RNG sapması olabilir; tek tohumla kesin değil. Kumarın kariyere etkisi oyuncuya açıkça gösterilmiyor (bkz. UI madde 5).
- Mutluluk 100'de, stres 8–35 arasında kaldı; kumarın ruh hâline etkisi görünmüyor.
- Haftalık "Kumar düşüncesi aklından çıkmıyor" ve destek hattı satırı 205 kez aynı metinle düştü. Sorumlu oyun gereği kalmalı ama arayüzde gruplanmalı (bkz. UI).

### 8. Küçük mantık ve metin hataları (düzeltildi)
- Antrenör sözleşmesi satırında `{n}` görünüyordu (×20). Bilinmeyen grupta `trainerName` artık geri dönüş değeri kullanıyor.
- `family.sibling_trial`: "Menajerine telefon açtır" seçeneği artık menajer gerektiriyor (önce hayalet menajer çıkıyordu).
- Yeni kartta "MR'da" yerine "taramada" yazıyor. Bayraklarda kalan "Caps'i" ve "VIP'de" tartışmalı yabancı okunuşlar; dokunulmadı.

### 9. Tempo, evrelere göre (sonra)

| Evre | Kart/hf | Yeni kart payı | Kahraman haberi/hf | Hedef olayı/hf | Röportaj/hf | Ölü % |
|---|---|---|---|---|---|---|
| Genç (≤20) | 1,75 | %54 | 0,67 | 0,85 | 0,43 | 0,6 |
| Yükseliş (21–24) | 1,74 | %18 | 0,92 | 0,91 | 0,51 | 0,6 |
| Zirve (25–30) | 1,74 | %9 | 1,26 | 0,91 | 0,63 | 0,9 |
| Düşüş (31+) | 1,66 | %3 (veteran kartları sayesinde sezonda 4–9 yeni kart) | 1,00 | 0,95 | 0,52 | 1,1 |

- Hedefler, kartlar ve röportajlar her evrede aynı yoğunlukta. Ölü hafta oranı her yerde %1 civarında, ardışık ölü hafta yok.
- Eksik olan **evreye özgü hedef**. Hoca ve taraftar hedefleri 17 yaşında da 33 yaşında da aynı. Veteran için "gençlere ağabeylik", yıldız için "Altın Yıldız yarışı" gibi hedefler sonraki tura kaldı.

## Denge ve doğrulama

- **BALANCE** (`BALANCE=1`, 30 × 10, seed 1000). "Önce" ve "sonra" aynı anda, aynı HEAD'den alındı. "Önce" kopyasında yalnızca bu turun üç sim commit'i geri alındı; geçici kopya ölçümden sonra silindi.

| Hedef | Önce | Sonra | Durum |
|---|---|---|---|
| İtibar 21 yaş ~50, 25 yaş 75–85 | 44 / 78 | 47 / 75 | Tutuyor (25 yaşta alt sınırda) |
| İlk 1. kademe (21–23) / elit kulüp (22–24) | 21 / 24 (%67) | 21 / 23 (%50) | Tutuyor |
| Pot ≥ 85 → 25 yaşına kadar OVR 80+ | 9/9 | 9/9 | Tutuyor |
| 3. sezon net servet medyan ≤ 300K / max ≤ 2M | 161K / 1,1M | 157K / 1,6M | Tutuyor |
| İflas yok | %0 | %0 | Tutuyor |
| Haftalık kart 1,5–2,5 | 1,7 | 1,8 | Tutuyor |
| Sakatlık 1–2 / 3–6 hafta | 1,6 / 4,1 | 1,4 / 3,3 | Tutuyor |
| Kumarhane payı: kumarbaz %15–35 / herkes ≤ %5 | %6 / %1 | %5 / %1 | Kumarbaz hedefin altında. Bu tur öncesinden kalma, değişmedi (açık madde) |

- **Golden master değişmedi.** `golden.test.ts` yeniden üretim gerekmeden geçiyor; maç motoru ve sezon özeti etkilenmedi. `UPDATE_GOLDEN` kullanılmadı.
- **Hız ve his:** Maç motoruna, kontrollere ve render'a dokunulmadı. Harness süresi 6 kariyer × 8–15 sezon için ~90 sn.
- `npx vitest run`: 168 dosya, 1.424 test geçti (4 atlandı).
- `npm run lint`: 0 hata (39 uyarı, bu turdan önce de vardı).
- `npm run lint:i18n` ve `npm run build`: temiz.

## NSS'de sevilenler: bizde var mı, daha iyi mi? (Tur 2, uzun kariyer gözüyle)

| NSS'de sevilen | Bizde | Karar |
|---|---|---|
| Kararlar ve sonuçları | 265 farklı kart, risk etiketleri, zincirler, evreye bağlı kartlar | **Daha iyi**; 10+ sezonda deste hâlâ dar |
| İlişkiler | Defter, "neden değişti" günlüğü, Legacy ebeveyn ilişkisi | **Daha iyi** |
| Lüks alımlar | Kariyer başına 38–74 alım, iş kurma, vakıf | İlk 5 sezon daha iyi. Geç oyunda para yine boşta (sezonda 16–40 hafta) |
| Kumarhane | Blackjack, rulet, slot, at, zar; masa limiti; sorumlu oyun | Masa limiti ve sorumlu oyun sayesinde **daha mantıklı** ama daha az eğlenceli. Kariyer bedeli zayıf ve görünmüyor, mutluluğa etkisi yok |
| Transferler | Pazarlık, kiralık, kariyer başına 6–12 transfer | **Daha iyi**; kademe yolu gerçekçi |
| Milli takım | Ölçer, U19/U21/A, kaptanlık, milli takıma veda | Düzeltmeden önce NSS kadar kötüydü (#45). Şimdi **daha iyi**: performans sayılıyor. Güçlü ülkelerde dünya enflasyonu yüzünden hâlâ zor |
| Ödüller | Aylık ve sezonluk ödül, Altın Yıldız, tören | **Daha iyi**: performansa bağlı (NSS #46 yok); belgesel artık doğru öne çıkarıyor |
| Highlight maç | Kilit anlar, otomatik çözümde 30–35 maç/sezon | His tarafı test edilmedi (sim harness). Gol hacmi yüksek: 459 maçta 407 gol (NSS #47 "500 gol" riski) |
| Röportaj mini oyunu | 3 soru, muhabir stilleri, bağlam varyantları | **Daha iyi**; tekrar azaldı |
| 16'dan efsaneye ve emekliliğe | Karar kartı, jübile, belgesel, Onur Listesi, Legacy | NSS'de yok. **Bizim artımız**, artık mantıklı |

**Yeni sistemler entegre mi, eklenti gibi mi?**
- **Hedefler:** Entegre. Hoca, taraftar ve aile sesi, haftada ~0,9 olay.
- **Röportajlar:** Entegre. Manşetler alıntıdan geliyor, ilişkiler de değişiyor.
- **Milli takım:** Düzeltmeyle entegre. Kartlar ve duyurular ölçerle tutarlı.
- **Ödüller:** Entegre. Manşet, belgesel, miras puanı.
- **İş kurma:** **Hâlâ eklenti gibi**. Kariyer başına en çok 2 iş açılıyor, haftalık "İşletmelerin bu hafta" satırı dışında oyuncuya karar sormuyor. Yalnızca birkaç kart (`business.*`) bağlanıyor.

## Arayüz için yapılacaklar (sim tarafı hazır)

1. **Milli takım kartı:** "Güç" çubuğu artık sezon performansını da içeriyor. Ayrı bir "Sezon performansı" çubuğu gösterilmeli. Değer `heroPerformanceBonus(state)` ile alınır (−2…+10, `sim/game/national.ts`, dışa açık). Metin anahtarı `intl.national.parts`'a eklenmeli.
2. **Ağır sakatlıkta karar (31–33 yaş):** `retirementStatus(s).canRetire === true && forced === null` ve sakatlık şiddeti 3 iken bir "Geri dönüş mü, veda mı?" ekranı gösterilmeli. Şu an yalnızca zorunlu emeklilik ve 33+ yıllık karar ekranı açılıyor.
3. **Günlükte aynı satırın gruplanması:** Art arda gelen aynı metinli satırlar "×N" ile tek satırda gösterilmeli (kumar uyarısı, haftalık bakiye). Sorumlu oyun mesajı kaybolmaz, gürültü azalır.
4. **Geç oyun para emicileri:** Vakıf kartı (`money.foundation`, `flags.foundation`) için Profil'de bir "Vakfın" satırı. İş yükseltmelerinin ana ekrandan önerilmesi (`upgradeCost`).
5. **Kumarın ruh hâline etkisi:** Mutluluk metresinin yanında kumar bağımlılığı göstergesi (`life.casino.addiction`) ve bunun maçtaki soğukkanlılığa etkisi (Tur 1 madde 4 ile birlikte).

## Açık maddeler (benim alanım dışında ya da sonraki tur)

- **Dünya üst kuyruk enflasyonu (dünya sahibi):** *WP-B'de kapandı: dağılım (nicelik) çapası, 100 sezonda p95/p99/max ±2 içinde (BALANCE.md "WP-B denge turu").* Ortalama sabit, ama:
  - %90'lık dilim 4 sezonda 79'dan 84'e, top-20 ortalaması 90'dan 95'e çıkıyor.
  - OVR 88+ oyuncu sayısı 23'ten ~230'a çıkıyor.
  - Başlangıçta 219 oyuncunun potansiyeli 90 ve üstü.
  - Kahramanın 80–83 zirvesi göreli olarak "sıradan" kalıyor. EN/DE gibi güçlü ülkelerde milli takım barajı 94–95.
  - Bir kuyruk çapası ve wonderkid durgunluğu denendi ama tek başına yetmedi (genç yıldızlar 24 yaş altında 88+'ya çıkıyor). Potansiyel dağılımının kaynağında (üretim ve altyapı alımı) çözülmeli; dünya hash'i ve dengeyle birlikte ele alınmalı.
- **Maç motoru gol hacmi:** *WP-B: elit markaj (OVR 74–88) ile ST kariyer gol/maç 0,78–0,91'den 0,72–0,86'ya indi (BALANCE.md).* Uzun koşuda 459 maçta 407 gol; ST OVR 77–82 sezonda 33/43/47 gol (BALANCE tablosu). NSS #47 riski. İtibar enflasyonunun da kaynağı.
- **İtibar temposu (harness):** İnsan gibi PR yapan oyuncuda kaleci 23 yaşında 95, Legacy çocuğu 24 yaşında 94 itibara çıkıyor. BALANCE sim'inde hedefte (yukarıda); harness'te üst sınırın üstünde.
- **Kumarbaz persona payı (BALANCE):** %5–6, hedef %15–35. Bu tur öncesinden kalma; kumarbaz otomatik kariyerin bahis davranışı masa limitiyle birlikte yeniden ayarlanmalı.
- **Kart içeriği:** 10+ sezon için 60–80 kart daha, özellikle `business` (iş kararları), `national` (turnuva hikâyeleri) ve evreye özgü hedefler.
- **İşletme:** Karar üreten bir sistem değil, pasif gelir. İş başına aylık bir karar kartı ya da kriz zinciri gerekiyor.


---

# Tur 3 (baş tasarımcı, Ekim 2026): yeni sistemler gerçekten oyunun parçası mı?

**Soru:** Tur 2'den sonra eklenen sistemler (geç kariyer kartları, projeler, iş kararları, kumarhane VIP'i ve ağır kumar bedeli, maç içi karar pencereleri, pas ağı ve kişiliğe bağlı takım arkadaşı ilişkileri, kaleci nitelikleri, milli takım adaleti, dünya tepe çapası) bir NSS hayranının gözünde hikâye üretiyor mu, yoksa kenarda duran menüler mi?

**Kısa cevap:** Kart destesi, iş kararları ve kumar bedeli artık hikâye üretiyor. Kaleci kariyeri forvet kadar dolu. Ancak dört sistem ölçüldüğünde ya görünmüyordu ya da kendi amacına ters çalışıyordu:
- **Projeler:** Yatırımcı olmayan oyuncu 10 sezonda tek bir proje teklifi görmedi.
- **Maç içi kararlar:** Pencerelerin yarısı aynı "kışkırtma" anıydı. Penaltı penceresi hiç açılmadı. Kaleciye frikik kullanıp kullanmayacağı soruldu.
- **Takım arkadaşı ilişkileri:** Bir sezonda +80…+100'e doyuyordu. Kişilik farkı ve pas ağı anlamını yitiriyordu.
- **Takipçi sayısı:** Ünlü bir kariyerde 45 milyara çıktı.

En ağır yedisi düzeltildi; kalanlar aşağıda sıralı.

## Yöntem

- Harness'e üçüncü plan eklendi (`PLAYTEST=1 PLAYTEST_PLAN=r3`, `game/src/sim/game/playtest.node.test.ts`). Toplam 3.606 hafta, 2.740 maç oynandı.
  - **6 kariyer × 10 sezon:**
    - ST (TR, pro)
    - LW (BR, **ağır kumarbaz**, akşamların çoğu masa limitinde)
    - CM (TR, **yatırımcı**: akademi, stadyum, kulüp hissesi, miras fonu, 3 iş)
    - CB (DE, party)
    - GK (TR, social)
    - **kadın** AM (TR, spender)
  - **Uzun koşu:** TR ST, yatırımcı, 17 yaşından 18 sezon. Emeklilik, belgesel ve Legacy çocuğu (LW) ile 4 sezon daha.
- **Yeni ölçümler:**
  - **"Canlı izlenen" maçlar:** Maçların %40'ı canlı merkezdeki gibi dakika dakika oynanıyor. Karar pencereleri aynı saf kurallarla (`pickDecision`) açılıyor, cevaplar rastgele.
  - **Maç içi karar dağılımı:** Pencere türleri ve kumar sonucu tutup tutmadığı.
  - **Pas ağı:** En çok ve en az pas veren takım arkadaşı arasındaki fark.
  - **Takım arkadaşı ilişkileri:** Her sezon en düşük, ortalama ve en yüksek değer.
  - **Kartlar ve kumar:** Proje ve iş kartı sayıları, VIP kademesi.
- **"Önce" ölçümü:** Aynı harness ile bu turun düzeltmelerinden önceki kodla alındı (`r3-before`). "Sonra" son koddan (`r3-final`). Aynı tohumlar kullanıldı, ama RNG akışı değiştiği için kariyerler birebir aynı değil.

## Bulgular (oyuncu etkisine göre sıralı)

### 1. 75 OVR'lik forvet efsane oldu: 546 maçta 563 gol, 7 Gol Kralı, 106 ödül (NSS #47 geri döndü)
- **Kanıt:** Uzun koşudaki TR forvetin zirvesi 75 OVR. Buna rağmen:
  - Tur 3 önce: 543 maç / 536 gol (0,99/maç), 95 ödül, miras puanı 5.821. Ara koşuda 546 / 563, 106 ödül.
  - Dünya Gol Kralı 7 kez, Ligin En İyi Oyuncusu 12 kez.
  - 10 sezonluk TR forvetin (OVR 72–73) itibarı 26 yaşında 100.
- **Kök neden:** Elit markaj yalnızca OVR'ye bağlıydı (74'ten başlıyor). 72–75 OVR'lik bir golcü sezonda 40 gol atsa da savunmalar ona "sıradan" davranıyordu. Gol, itibarı; itibar da sponsor parasını şişiriyordu. BALANCE sim'inde ST 71–76 bandında p90 41, max 41: aynı kuyruk orada da var.
- **Düzeltme (`sim/game/match.ts` `markedMan`, `sim/match/highlightGen.ts`):** "Adam adama markaj" artık forma da bakıyor.
  - Maç başına 0,8 golün üstündeki bir seri (bu sezon; sezon başında geçen sezonla harmanlanıyor) elit markajla aynı şekilde temiz fırsatları azaltıyor.
  - Maç başına 1,3 golde tam etki.
  - Normal kariyerde değer 0; yalnızca uç değerleri frenliyor.

| Metrik (uzun koşu, TR ST, zirve OVR 75) | Önce | Sonra |
|---|---|---|
| Kariyer maç / gol (gol/maç) | 543 / 536 (0,99) | 505 / 373 (0,74) |
| Ödül / miras puanı | 95 / 5.821 | 50 / 3.509 (yine "Ölümsüz Efsane") |
| 10 sezonluk TR ST gol/maç | ~0,95 | 0,77 |

- BALANCE'ta ST kariyer medyanı 0,73 / 0,70 (hedef 0,6–0,8), en iyi sezon 1,10 / 0,96. Ayrıntı "Denge" bölümünde.

### 2. Projeler yatırımcı olmayana hiç görünmüyordu (para 5. sezondan sonra yine boşta)
- **Kanıt (önce):** Projeyi yalnızca harness'in "yatırımcı" personası (doğrudan Projeler ekranını kullanan) kurdu. Diğer altı kariyerde 10 sezonda:
  - akademi teklifi (`money.academy_blueprint`) 0
  - kulüp hissesi teklifi 0
  - miras fonu fikri 0
  - stadyum planı 1 kez
- Bu sırada GK 24 yaşında 8,7M nakitle oturuyordu, ST 26 yaşında 12M ile.
- **Kök neden:** Teklif kartları 27–29 yaş kapısındaydı. 10 sezonluk bir kariyer 26–28 yaşında bitiyor; zengin oyuncu ise ilk milyonunu 22–23 yaşında görüyor. Proje oyuncunun önüne hiç düşmüyordu.
- **Düzeltme (`events/content/projects.ts`):** Kapılar yaş yerine artık servetle açılıyor:
  - stadyum 22 yaş
  - akademi 23
  - miras fonu 24
  - kulüp hissesi 25
  - akademinin ilk mezunu 24
- **Sonra:** Yatırımcı olmayan beş kariyerin dördü en az bir projeye girdi:
  - ST: akademi, %5 hisse
  - GK: 2 akademi aşaması, fon, %10 hisse
  - kadın AM: fon, %5 hisse
  - CB: fon
- Proje kartı sayısı 120'den 176'ya çıktı. Kariyer başına 18–34 kart; kumarbazda bile 23.
- **Legacy dengesi:** Fon büyüdükçe çocuğa giden pay da büyüyordu (tavan 350K). Çocuk 17 yaşında 376K net servet ve 15 lüks alımla başladı.
  - Tavan **120K**'ya indi. Fon artık asıl karşılığını Onur Listesi'nde veriyor: kilitli her 1M için +1 miras puanı, en çok +10 (`projectsLegacyPoints`).
  - Legacy çocuğunun 1. sezon net serveti 376K'dan 216K'ya indi.

### 3. Maç içi kararlar: yarısı aynı kışkırtma, penaltı hiç yok, kaleciye frikik
- **Kanıt (önce, 1.101 canlı maç, 1.444 pencere):**
  - "Kışkırtma" %48 (kalecide 231 pencerenin 116'sı).
  - "Taktik çıkış" %23.
  - **Penaltı penceresi 0.**
  - Kaleci 25 kez "Frikik fırsatı: Ben atarım" seçeneğiyle karşılaştı.
- **Kök nedenler (`sim/match/decisions.ts`):**
  - Kışkırtma dakika başına %3,5 ile açılıyordu: geride ya da berabereyken maç başına ~%75.
  - Motor "penaltı verildi" olayını ve atışı aynı dakikada yayınlıyor. Kural yalnızca son olaya baktığı için penaltıyı hiç görmüyordu. Bu, canlı merkezde de aynı.
  - Pozisyon bilgisi yoktu.
- **Düzeltme:**
  - Kurallar son dakikanın tüm olaylarına bakıyor (`recent`).
  - Kaleciye penaltı ve frikik penceresi açılmıyor; kışkırtma yarı oranda.
  - Kışkırtma %0,8/dk, taktik çıkış %3 (geride) ve %1,2 (berabere), frikik penceresi %30.

| Pencere payı (tüm koşu) | Önce | Sonra |
|---|---|---|
| Kışkırtma | %48 | %20 |
| Gol sevinci | %15 | %32 |
| Frikik | %14 | %20 (kalecide 0) |
| Taktik çıkış | %23 | %22 |
| Penaltı | %0 | %6 |
| Toplam pencere / canlı maç | 1.444 / 1.101 (1,31) | 997 / 1.027 (0,97) |

- **Arayüz işi (aşağıda UI 1):** Canlı merkez `recent` ve `isKeeper` alanlarını geçmeden penaltı penceresi oyunda hâlâ açılmaz.

### 4. Takım arkadaşı ilişkileri bir sezonda doyuyordu: kişilik ve pas ağı anlamsızlaşıyordu
- **Kanıt (önce):**
  - Takım arkadaşı ortalaması yeni kulüpte ~10'dan başlıyor, bir sezon sonra 79–93'e çıkıyor (en düşük −13, en yüksek 100).
  - Ateşli (hothead) ile şakacı (joker) arasındaki fark bir sezonda kayboluyordu.
  - Galibiyet, takım yemeği, röportaj ve karar pencereleri bütün soyunma odasını birlikte yükseltiyordu.
  - Yan etki: `relationAvg` maç başına ~+1,3 an ekliyordu. Bu, golcü enflasyonunun ikinci kaynağıydı.
- **Düzeltme (`sim/life/relationships.ts`):**
  - Her takım arkadaşının kişiliğinden gelen bir **mizaç tabanı** var (`baseline`; eski kayıtlarda hash'ten türetiliyor).
  - İlişki her hafta tabana doğru %4 çekiliyor; kin için bu oran %2.
  - Emek hâlâ dostluk kazandırıyor, ama ateşli oyuncu şakacıdan soğuk kalıyor.
  - Defterde "Mizacı: kendi hâline döndü" satırı görünüyor.
- **Sonra:** Kurulu kadroda ortalama 40–56 aralığında, dağılım −14…+82 (önce 79–93 ortalama, 100 tavan). Pas ağı farkı (en çok − en az pas veren) maç başına 7–10 pas; kişilik sahada görünüyor.

### 5. 45 milyar takipçi (ve "3 haftada 80990574 yeni takipçi" hedefi)
- **Kanıt:**
  - Uzun koşu 14. sezonda 45.158,8 Mn takipçi, sponsor hedefi "85063935273 yeni takipçi".
  - 10 sezonluk TR forvet 2 milyar takipçide.
- **Kök neden:** Maç sonrası takipçi artışı orantılı (maç başına %0,4–1,6) ve ün tavanını (`followerCeiling`, itibar 100'de 150M) tanımıyordu. Tavanın üstündeki erime haftada yalnızca %1'di.
- **Düzeltme:**
  - Maçın orantılı artışı tavana kalan boşlukla çarpılıyor (`matchOutcome.ts`).
  - Tavan üstü fazla haftada %8 eriyor (`OVER_CEILING_FADE`). Denge değeri ≈ tavanın 1,3 katı.
  - Hedef başlığındaki sayı biçimleniyor (`fmtNum`: "3,2 Mn").
  - Sponsor değeri log ölçekli olduğu için (1M'da doyuyor) para etkilenmedi.

### 6. Ağır kumarbazın manşetleri tekrar ediyordu; VIP ikramı 312 kez aynı satır
- **Kanıt (önce):**
  - 482 kumarhane gecesinde 175 "Gece Bekçisi" manşeti.
  - "Objektifler yine … peşinde" ×25, "Gece yarısı, yeşil çuha" ×19.
  - "VIP ikramı" satırı ×312, "🎰 🎰 Kumarın bu haftaki bedeli" (çift ikon) ×407.
- **Düzeltme (`sim/life/casino.ts`):**
  - **Tabloid yorgunluğu:** 6 hafta içinde ikinci kumarhane manşeti basılmıyor. Disiplin ve basın bedeli yine ödeniyor; günlükte "gazeteler aynı haberi basmadı ama kulüpte herkes biliyor" satırı çıkıyor. Maç öncesi gece her zaman haber.
  - Bağımlılık 55+ iken tonu değişen 6 yeni manşet: danışmanlık, soyunma odası, taraftar grubu açıklaması, eski takım arkadaşı.
  - VIP ikramı haftada bir kez.
  - Çift ikon kaldırıldı.
- **Sonra:** 481 gecede 120 manşet. En sık manşet ×14 (önce ×25). Kumarın bedeli görünür:
  - itibar 28 yaşında 72 (aynı dönemdeki diğer forvetlerde 96–100)
  - net kumar −1,15M
  - VIP 2

### 7. Stoper kariyeri en sönüğüydü: 10 sezon, birinci lig, 0 ödül
- **Kanıt (önce):**
  - DE CB, OVR 80, 10 sezonun 6'sı birinci ligde: 0 ödül, 0 A milli maç, 28 yaşında itibar 56.
  - Aynı turda GK: 10 ödül, 53 milli maç, itibar 99. Forvet: 47 ödül.
  - Kalecinin Altın Eldiveni var; savunmacının kendine ait bir sezon ödülü yoktu.
- **Düzeltme (`sim/game/awards.ts`):**
  - Yeni **"Ligin En İyi Savunmacısı"** ödülü: Ligin En İyi Oyuncusu ile aynı skor, yalnızca CB, LB ve RB arasında.
  - İtibar ağırlığı Altın Eldiven'le aynı.
  - Belgeselde ağırlık 60.
- **Sonra:** CB'nin ilk ödülleri geldi (S8 Ligin En İyi Savunmacısı ve Sezonun 11'i, S10 Sezonun 11'i), 5 A milli maç.
- Stoper yine forvetten sakin. Bu doğal, ama artık hedefi var. Kalan iş: savunmacıya özgü hedefler ve kartlar (Açık maddeler).

### 8. Türkçe ve tutarlılık
- **Düzeltildi:**
  - `Sezonun 11'i ödülünü kazandı` → "X Sezonun 11'ine seçildi".
  - `Altın Yıldız 2.si ödülünü kazandı` → "X Altın Yıldız podyumunda: Altın Yıldız 2.si".
  - Kadın oyuncuya "Abi" diyen dört satır `{g:abi|abla}` oldu: akademi mezunu, veteran yılları ×2, söylenti.
  - "dizi yıldızı Ela Dağ habersiz…" küçük harfle başlıyordu → "Ünlü bir konuk habersiz Mavi Tabak'a geldi: dizi yıldızı Ela Dağ."
- **Temiz:** `{n}`, `undefined` ve İngilizce sızıntısı yok; cinsiyet ve yaş bayrağı 0.
- **Kalan:**
  - "Caps'i" (×33) ve "VIP'de" (×18) bilinçli okunuşlar; Tur 2 kararı korundu.
  - `hayalet-ajan` 4 bayrak: `scam.fake_agent` sahte menajer kartı, yanlış alarm.

### 9. Tekrar, tempo ve para (evreye göre)

| Metrik | Tur 2 (sonra) | Tur 3 önce | Tur 3 sonra |
|---|---|---|---|
| Görülen farklı kart | 265 | 337 | 342 |
| İlk kez görülen kart payı S8 / S10 | %6 / %9 | %8 / %5 | %12 / %8 |
| Bir kariyerde en çok tekrar eden kart | ×17 (15 sezon) | ×22 (`fans.autograph_swarm`, 18 sezon) | ×25 (`health.minor_knock`, 18 sezon) |
| `casino.teammate_cards` (tümü) | – | 84 (kumarbaz olmayanda ×18) | 10 kariyer tavanı, 20 hafta bekleme |
| Manşet benzersizliği | %60 | %53 | %57 |
| Ölü hafta / ardışık ölü hafta | %0,7 / 0 | %0,7 / 0 | %0,8 / 0 |
| Kart/hafta | 1,8 | 1,73 | 1,75 |

- **Tekrar sınırı:** İmza seli, şaka savaşı, rakip laf atması ve hastane ziyareti için kariyer başına 12 tavanı geldi. En sık tekrar artık "küçük darbe" (`health.minor_knock`), 18 sezonda ×25; gerçekçi bir dolgu.
- **Evre temposu:**

| Evre | Kart/hf | Yeni kart | Kahraman haberi/hf | Hedef/hf | Ölü % |
|---|---|---|---|---|---|
| Genç (≤20) | 1,78 | %56 | 0,75 | 0,91 | 0,7 |
| Yükseliş (21–24) | 1,76 | %18 | 0,96 | 0,90 | 1,1 |
| Zirve (25–30) | 1,71 | %8 | 0,95 | 0,90 | 0,5 |
| Düşüş (31+) | 1,61 | %10 | 0,72 | 0,89 | 0,6 (sessiz %2,9) |

- Düşüş evresi Tur 2'deki gibi veteran kartlarıyla canlı. Ama milli takım sesi bitiyor (0,01/hf) ve hedefler hâlâ evreye özgü değil (Açık maddeler).
- **Para:**
  - 10 sezonun sonunda net servet: kumarbazda 3,8M, CB'de 4,5M, yıldız GK'de 48M.
  - Uzun koşuda 95M (fon 64M dahil, çünkü yatırımcı her şeyi fona koyuyor).
  - Projeler artık parayı geç oyunda bir hedefe bağlıyor: akademi mezunları, stadyum mutluluğu, hisse temettüsü, miras puanı.
  - Yine de yatırımcı olmayan bir yıldız 26 yaşında 20–48M ile oturuyor. Projelerin toplam maliyeti (~16M + hisse 10M) yıldızın 2–3 sezonluk geliri. Para geç oyunda NSS'den anlamlı, ama hâlâ "bitmeyen kaynak".

## Denge ve doğrulama

- **BALANCE** (`BALANCE=1`, 30 × 10). Son kodla iki tohum (1000 · 2000):

| Hedef | Son ölçüm | Durum |
|---|---|---|
| İtibar 18 / 21 / 25 yaş (~15 / ~50 / 75–85) | 12/51/75 · 13/46/79 | Tutuyor (25 yaşta tohum 1000 alt sınırda) |
| İlk 1. kademe (21–23) / ilk elit kulüp (22–24) | 21,0 · 20,0 / 23,0 · 22,0 | Elit tutuyor. 1. kademe tohum 2000'de 20,0. Aynı tohumda değişiklik zinciri boyunca 20,5 ↔ 20,0 oynadı (RNG gürültüsü). |
| Pot ≥ 85 → 25 yaşına kadar OVR 80+ | 9/9 · 11/11 | Tutuyor |
| 3. sezon net servet medyan ≤ 300K / max ≤ 2M | 135K/746K · 143K/719K | Tutuyor |
| İflas yok | %0 · %0 | Tutuyor |
| Kart/hafta 1,5–2,5 | 1,7 · 1,8 | Tutuyor |
| Sakatlık 1–2 / 3–6 hafta | 1,4/3,5 · 1,5/3,7 | Tutuyor |
| Kumarhane: kumarbaz %15–35 / herkes ≤ %5 | %12 · %23 / %2 · %2 | Ortalama %17,5. Tohum 1000'de bu tur boyunca %12–22 arasında oynadı (6 kumarbaz kariyer; BALANCE.md'deki tohum gürültüsü notu) |
| ST kariyer gol/maç ~0,6–0,8 / en iyi sezon ~1,0–1,3 | 0,73 · 0,70 / 1,10 · 0,96 | Tutuyor (tohum 2000'de en iyi sezon alt sınırın hemen altında) |
| ST sezonluk gol 71–76: 18–28 / 77–82: 25–35 | 23 · 22 / 24 · 25 | Tutuyor (77–82 tohum 1000'de bir gol altta) |

- **Gece drift bekçisi** (`STATS_GUARD=1`, 40 × 10): tolerans içinde. `statsBaseline.json` yeniden merkezlenmedi.
- **Golden master bilinçli yenilendi** (`UPDATE_GOLDEN=1`, aynı commit). Sebepler: maç sonu takipçi artışı (tavan), "markaj" alanı, kumarhane manşet RNG'si ve kart tavanları kariyer akışını değiştiriyor.
- Yeni testler:
  - `markedMan.test.ts`
  - `decisions.test.ts`: penaltı aynı dakikada, kaleci, kışkırtma oranı
  - `relationships.test.ts`: mizaç tabanı
  - `projects.test.ts` ve `closeFriends.test.ts` yeni sabitlere uyarlandı.
- `npx vitest run`: 186 dosya, 1.527 test geçti (5 atlandı). `npm run lint`: 0 hata (40 uyarı; değiştirilen dosyalarda yalnızca harness'teki eski `take` uyarısı). `npm run lint:i18n` ve `npm run build`: temiz.

## NSS'de sevilenler: bizde var mı, daha iyi mi? (Tur 3)

| NSS'de sevilen | Bizde (Tur 3) | Karar |
|---|---|---|
| Kararlar ve sonuçları | 342 farklı kart, evreye bağlı ve geç kariyer kartları, iş ve proje zincirleri | **Daha iyi**; 15+ sezonda dolgu kartlar yine dönüyor |
| İlişkiler | Defter, mizaç tabanı, kişiliğe göre pas ağı, Legacy ebeveyn | **Daha iyi**. Kişilik artık bir sezonda silinmiyor |
| Lüks alımlar ve mülk | Kariyer başına 35–78 alım, koleksiyon, projeler | **Daha iyi**. Geç oyunda para artık bir hedefe bağlı, ama yıldız için hâlâ bitmiyor |
| Kumarhane ve at yarışı | 5 oyun, masa limiti, VIP, görünür kariyer bedeli, sorumlu oyun | **Daha mantıklı**. Bedel artık skorda görünüyor (itibar 72 vs 96–100). Manşetler daha az tekrarlıyor |
| Transferler | Pazarlık, kiralık, kariyer başına 3–10 transfer | **Daha iyi** |
| Milli takım | Performans payı, adalet, veda | **Daha iyi**. Güçlü ülkelerde (DE, BR) çağrı nadir ama artık sıfır değil (5 maç) |
| Ödüller | Aylık, sezonluk, Altın Yıldız, yeni Savunmacı ödülü | **Daha iyi**. Artık 75 OVR'lik forvete 106 ödül yok, stoperin de ödülü var |
| Highlight maç ve "ben" odağı | Kilit anlar, maç içi karar pencereleri | **Daha iyi**: kararlar çeşitlendi, penaltı geldi. His testi sim dışı |
| Röportaj mini oyunu | Maç önü, maç sonu, basın toplantısı | **Daha iyi** |
| 16'dan efsaneye, emeklilik ve Legacy | Karar kartı, jübile, belgesel, Onur Listesi, fon ve akademi mirası | NSS'de yok. **Bizim artımız** |
| Kaleci ve stoper kariyeri | GK: Altın Eldiven, 49 milli maç, itibar 100. CB: yeni ödül | GK **forvet kadar dolu**. CB hâlâ en sakin rol |

**Yeni sistemler entegre mi?**
- **İş kararları:** Entegre. İş sahibi kariyerde 47–93 iş kartı: denetim, ünlü misafir, kuzen, kriz. Kumarbaz gibi iş kurmayanlarda 2. Haftada ~0,5 karar; kendi hikâyesini yazıyor.
- **Projeler:** Bu tura kadar yalnızca menüdeydi. Kapılar servete bağlandıktan sonra entegre: proje kartı kariyer başına 18–34, akademi mezunu ve yönetim kurulu kartları geliyor.
- **Maç içi kararlar:** Tekdüzeydi, artık çeşitli. Kariyer etkisi (hoca güveni, takım, taraftar) yalnızca canlı izlenen maçlarda.
- **Pas ağı ve kişilik:** Mizaç tabanıyla anlamlı. Hâlâ yalnızca canlı maçta ve maç sonu ekranında görünüyor; kart veya hedefe bağlanmıyor.
- **Kumar bedeli:** Entegre ve görünür.

## Arayüz için yapılacaklar (sim tarafı hazır)

1. **Canlı merkez karar kuralları (`ui/backend/liveMatch.ts`, `maybeOpenDecision`):** `pickDecision` çağrısına iki alan eklenmeli. Bu yapılmadan **penaltı penceresi oyunda açılmaz** ve kaleciye frikik sorulur.
   ```ts
   recent: snap.events.filter((e) => snap.minute - e.minute <= 1).map((e) => ({ type: e.type, own: e.side ? e.side === side : null, minute: e.minute })),
   isKeeper: s.hero.position === 'GK',
   ```
2. **İlişki defteri:** Yeni "Mizacı: kendi hâline döndü" satırı `decay` nedeniyle geliyor ve ihmal satırıyla birleşebiliyor. Takım arkadaşı kartında mizaç tabanı (`relationship.baseline`) küçük bir işaret olarak gösterilebilir: "doğal mesafesi".
3. **Projeler ekranı:** Miras fonu metni artık 120K tavanı ve "her 1M için +1 miras puanı (en çok +10)" demeli. Sabitler: `LEGACY_FUND_CAP`, `FUND_POINTS_PER_M`, `FUND_POINTS_MAX`.
4. **Maç önü ekranı:** "Adam adama markaj" (`markedMan(hero)` > 0) bir ipucu olarak gösterilmeli: "Savunmalar seni çift adamla tutuyor". Oyuncu gol kıtlığının nedenini görmeli.
5. **Ödül töreni:** "Ligin En İyi Savunmacısı" (`defender_of_season`) adını `Award.name` üzerinden zaten taşıyor. Törende ikon veya renk eşlemesi varsa eklenmeli.

## Açık maddeler (sonraki tur)

- **Evreye özgü hedefler (Tur 2'den kalma):** Hedefler 17 ve 33 yaşta aynı. Eklenmesi gerekenler:
  - veteran için "gence asist"
  - yıldız için "Altın Yıldız yarışı"
  - stoper için "temiz sayfa serisi"
  - proje sahibi için "akademinden ilk profesyonel"
- **Geç oyun parası:** Projeler yetmiyor. Yıldız 26 yaşında 20–48M ile oturuyor. Daha büyük ve kalıcı karşılığı olan bir hedef gerekiyor: çoğunluk hissesi (başkanlık), kendi kulübünü alt ligden çıkarmak.
- **Stoper ve bek kariyeri:** Ödül geldi, ama hikâye kartları (forvetle kapışma, son dakika kurtarışı, kaptanlık) ve savunma hedefleri az.
- **Pas ağı otomatik çözümde görünmüyor:** Maçların çoğu otomatik çözülüyor. Pas ağı yalnızca canlı maçta ve maç sonu ekranında. Bir "seni dışlayan takım arkadaşı" kart zinciri, sistemi otomatik oyuncuya da taşır.
- **Harness'te itibar tavanı:** İnsan gibi PR yapan oyuncu 24–26 yaşında 96–100 itibara çıkıyor (BALANCE'ta 25 yaşında 75–79). Bu fark Tur 2'den beri sürüyor; harness personası sponsor ve röportajı her fırsatta kullanıyor.
- **Kumarbaz persona payı:** Tohuma göre %12–33. Hedef bandı (%15–35) ortalamada tutuyor, tek tohumda tutmayabiliyor.
