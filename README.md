# Kickborn

Futbol kariyeri ve yaşam simülasyonu. 16 yaşında bir oyuncu olarak başlarsın; maçlarda kritik anları kendin oynarsın, saha dışında antrenman, ilişkiler, para, transferler ve kararlarla kariyerini yönetirsin. Oyun PC (Windows/macOS/Linux, Steam), mobil (Android/iOS) ve web için tek kod tabanından derlenir.

Kod `game/` klasöründedir: TypeScript, Vite, Preact (arayüz) ve Phaser 4 (maç ve antrenman sahneleri).

## Hızlı başlangıç

```bash
cd game
npm install
npm run dev
```

Tarayıcıda açılan adrese şunları ekleyebilirsin:

| Parametre | Ne yapar |
|---|---|
| `?autostart=1` | Hazır bir kariyerle doğrudan ana ekrana girer |
| `?autostart=1&dev=<ekran>` | Belirli bir ekrana atlar (ör. `liveMatch`, `casino`, `seasonEnd`) |
| `?mock=1` | Gerçek simülasyon yerine sahte verilerle açar (arayüz geliştirme) |
| `?pseudo=1` | Uzatılmış sahte metinlerle açar (taşan yazıları yakalamak için) |
| `?flavor=trial` / `premium` / `demo` | Para modeli sürümünü dener |

Maç anlarını tek tek denemek için: `/match-demo.html?kind=penalty&seed=3` (`auto=1` eklersen bot oynar).

## Komutlar (`game/` içinde)

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tip kontrolü + üretim derlemesi (`dist/`) |
| `npm test` | Birim testleri (Vitest) |
| `npm run test:coverage` | Kapsam raporuyla birim testleri |
| `npm run e2e` | Tarayıcı testleri (Playwright, yüklü Chrome ile) |
| `npm run lint` / `npm run lint:i18n` | ESLint / arayüzde çevrilmemiş metin kontrolü |
| `npm run desktop:dev` | Electron masaüstü sürümü (geliştirme) |
| `npm run desktop:build:win` | Windows kurulum + taşınabilir exe (`release/`) |
| `npm run android:apk` | Android debug APK |
| `npm run licenses` / `npm run legal` | Lisans listesi / yasal sayfaları üret |

Denge raporu (30 kariyer × 10 sezon, ~7 dk):

```bash
BALANCE=1 npx vitest run src/sim/game/balance.test.ts --reporter=verbose
```

## Belgeler (`docs/`)

| Belge | İçerik |
|---|---|
| `GDD.md` | Oyun tasarım belgesi |
| `ANALIZ-VE-PLAN.md` | Mevcut oyun envanteri, her konu için 100+ maddelik geliştirme planı, yol haritası |
| `GAP-AUDIT.md` | Planın ne kadarının yapıldığı, kalan iş paketleri, dışarıya bağımlı işler |
| `BALANCE.md` | Denge hedefleri ve ölçümler (kariyer, ekonomi, maç hissi) |
| `PLATFORM.md` | Platform derlemeleri, mağaza kontrol listeleri, satın alma kuralları |
| `ACCESSIBILITY.md` | Erişilebilirlik kontrol listesi |
| `research/` | Orijinal oyun analizi, mağaza yorumları, UI/asset ve teknik araştırma |
| `legal/` | Gizlilik politikası ve kullanım koşulları **taslakları** (hukuki inceleme gerekli) |
| `store/` | Mağaza açıklamaları, anahtar kelimeler, yaş sınırı notları |

## Kod yapısı (`game/src/`)

| Klasör | İçerik |
|---|---|
| `core/` | Ortak veri modeli, seed'li RNG, ayarlar |
| `sim/world/` | Kurgusal dünya: ligler, kupalar, milli takımlar, transferler, ödüller |
| `sim/match/` | Maç simülasyonu, an üretimi, puanlama, anlatım |
| `sim/career/` | Gelişim, antrenman, sözleşme, transfer, takım içi rol |
| `sim/life/` | Yaşam, ilişkiler, ekonomi, kumarhane, sosyal medya, olaylar (`events/`) |
| `sim/game/` | Oyun döngüsü ve arayüzün çağırdığı eylemler |
| `game/` | Phaser maç sahnesi, fizik, yapay zekâ, kontroller, antrenman mini oyunları |
| `ui/` | Preact arayüzü; `ui/backend/` simülasyonu arayüze bağlar |
| `audio/` | Kodla üretilen ses ve müzik (ses dosyası yok) |
| `state/` | Yedekli, sürümlü kayıt sistemi |
| `platform/` | Electron / Capacitor / web farkları |
| `store-iap/` | Satın almalar ve sürüm (deneme / premium / demo) |

## Kurallar

- Simülasyon (`sim/`, `core/`) deterministiktir: `Date.now` ve `Math.random` yasaktır (ESLint hata verir); bütün rastgelelik `Rng` ile gelir.
- Simülasyon davranışı bilerek değişirse altın referans güncellenir: `UPDATE_GOLDEN=1 npx vitest run src/sim/golden.test.ts`.
- Kayıt şeması değişirse `core/config.ts` içindeki `SAVE_VERSION` artırılır ve `state/save.ts` içine geçiş (migration) eklenir.
- Kurgusal dünya kullanılır: gerçek kulüp, oyuncu, turnuva ya da marka adı yoktur.
