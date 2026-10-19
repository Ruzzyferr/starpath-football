import type { Shape } from '../shape'

/** Free-to-play shop (docs/MONETIZASYON.md): diamonds held by the shop server, gear, cash, cosmetics, Pro Contract, optional rewarded ads. */
export const tr = {
  paywall: {
    restored: 'Satın alımların geri yüklendi.',
    nothingToRestore: 'Geri yüklenecek satın alım bulunamadı.',
  },
  store: {
    title: 'Mağaza',
    cosmeticOnly: 'Yalnızca kozmetik',
    owned: 'Sahipsin',
    buy: 'Satın al · {price}',
    buyNoPrice: 'Satın al',
    noStore: 'Bu sürümde satın alınabilir ürün yok.',
  },
  panel: {
    title: 'Satın alımlar',
    restore: 'Satın alımları geri yükle',
    restoreDesc: 'Cihaz değiştirdiysen ya da uygulamayı yeniden kurduysan önceki satın alımlarını geri getir.',
    list: 'Sahip olduklarım',
    none: 'Henüz satın alım yok.',
    premium: 'Bu sürümde mağaza yok; tüm kariyer zaten açık.',
    openStore: 'Mağazayı aç',
    build: 'Sürüm türü: {flavor}',
    history: 'Satın alma geçmişi',
    historyNone: 'Kayıtlı satın alma yok.',
    historyLine: '{date} · {source}',
    demo: 'Demo sürümü: kayıtlar kısa süre sonra otomatik sıfırlanır.',
  },
  legal: {
    title: 'Yasal',
    privacy: 'Gizlilik politikası',
    terms: 'Kullanım şartları',
    licenses: 'Açık kaynak lisansları',
    draftNote: 'Sorular için: info@swiip.app',
  },
}

export const en: Shape<typeof tr> = {
  paywall: {
    restored: 'Your purchases were restored.',
    nothingToRestore: 'No purchases found to restore.',
  },
  store: {
    title: 'Store',
    cosmeticOnly: 'Cosmetic only',
    owned: 'Owned',
    buy: 'Buy · {price}',
    buyNoPrice: 'Buy',
    noStore: 'Nothing to buy in this version.',
  },
  panel: {
    title: 'Purchases',
    restore: 'Restore purchases',
    restoreDesc: 'New device or reinstalled the app? Bring your earlier purchases back.',
    list: 'What I own',
    none: 'No purchases yet.',
    premium: 'This version has no store; the whole career is open.',
    openStore: 'Open store',
    build: 'Build flavor: {flavor}',
    history: 'Purchase history',
    historyNone: 'No purchases on record.',
    historyLine: '{date} · {source}',
    demo: 'Demo build: saves reset automatically after a short while.',
  },
  legal: {
    title: 'Legal',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    licenses: 'Open-source licences',
    draftNote: 'Questions: info@swiip.app',
  },
}
