/**
 * Lifestyle asset catalogue (GDD 4.3 "Varlıklar & Lüks").
 *
 * Price tiering intent — each category has a ladder whose rungs roughly track
 * the hero's weekly wage over a career (youth ~500/wk → superstar ~400K/wk):
 *  - Tier 1 (≤ 10K)      : buyable from a youth wage or the first signing bonus.
 *  - Tier 2 (10K–200K)   : a solid first-team pro after a season or two.
 *  - Tier 3 (200K–3M)    : established starter at a good club; minReputation gates kick in.
 *  - Tier 4 (3M–20M)     : star money; strong fame, big upkeep.
 *  - Tier 5 (20M+)       : global superstar endgame sinks (mega-yacht, long-range jet, island).
 *
 * Upkeep (weekly) design: houses/boats/jets/islands cost ~0.12–0.4% of price
 * per week (insurance, staff, mooring, crew, fuel) so the most expensive toys
 * are real money sinks that a falling wage cannot sustain — the classic
 * footballer-goes-broke arc. Watches/art/fashion have near-zero upkeep.
 *
 * `happiness` is passive weekly happiness while owned; economy.assetHappiness
 * applies diminishing returns across items (owning 10 watches ≠ 10× joy).
 * `fame` is a one-time reputation bump on purchase (also diminishing in economy).
 * `resale` is the value fraction after one year (art may be > 1: appreciates).
 *
 * All brand names are fictional. Effects follow the key contract documented
 * in sim/life/assetEffects.ts.
 */
import type { AssetCategory, AssetDef } from '../core/types'

type Opt = Partial<Pick<AssetDef, 'effect' | 'minReputation'>>

/** Compact constructor so the table stays readable. */
function a(
  id: string, category: AssetCategory, tr: string, en: string, icon: string,
  price: number, upkeep: number, happiness: number, fame: number, resale: number, opt: Opt = {},
): AssetDef {
  return { id, category, name: { tr, en }, price, upkeep, happiness, fame, resale, icon, ...opt }
}

const fx = (key: string, value: number) => ({ effect: { key, value } })

export const ASSETS: readonly AssetDef[] = [
  // ── Houses: resale ~0.9–1.0 (real estate holds value), upkeep ~0.15%/wk ──
  a('house_studio', 'house', 'Şehir Stüdyo Daire', 'City Studio Flat', '🏢', 90_000, 140, 2, 0, 0.96),
  a('house_flat', 'house', 'Merkezde 2+1 Daire', 'Central Two-Bed Flat', '🏬', 250_000, 380, 3, 0, 0.96),
  a('house_rental', 'house', 'Kiracılı Yatırım Dairesi', 'Buy-to-Let Apartment', '🏘️', 320_000, 320, 0, 0, 0.97, fx('rent_income', 1_150)),
  a('house_townhouse', 'house', 'Bahçeli Müstakil Ev', 'Townhouse with Garden', '🏡', 650_000, 950, 5, 1, 0.95, fx('sleep', 4)),
  a('house_penthouse', 'house', 'Gökdelen Çatı Katı', 'Skyline Penthouse', '🌆', 2_500_000, 3_800, 8, 3, 0.94, { ...fx('happiness_partner', 2), minReputation: 30 }),
  a('house_villa', 'house', 'Sahil Villası', 'Beachfront Villa', '🏖️', 6_000_000, 9_000, 10, 5, 0.94, { ...fx('happiness_partner', 3), minReputation: 45 }),
  a('house_mansion', 'house', 'Tepe Konağı', 'Hilltop Mansion', '🏰', 15_000_000, 22_000, 13, 7, 0.93, { ...fx('security', 0.5), minReputation: 60 }),
  a('house_estate', 'house', 'Bağ Evli Malikâne', 'Vineyard Estate', '🍇', 35_000_000, 48_000, 15, 9, 0.93, { ...fx('happiness_partner', 4), minReputation: 75 }),

  // ── Cars: resale 0.45–0.7 (depreciate hard); classics hold value ──
  a('car_scooter', 'car', 'Zipp Mini Scooter', 'Zipp Mini Scooter', '🛵', 1_500, 10, 1, 0, 0.5),
  a('car_hatch_used', 'car', 'İkinci El Pratik Hatchback', 'Used Pratik Hatchback', '🚗', 8_000, 45, 2, 0, 0.6),
  a('car_volta_ev', 'car', 'Volta City Elektrikli', 'Volta City EV', '🔌', 28_000, 70, 3, 0, 0.6),
  a('car_kestrel_gt', 'car', 'Kestrel GT Coupé', 'Kestrel GT Coupé', '🏎️', 65_000, 180, 4, 1, 0.62),
  a('car_aurelia_sedan', 'car', 'Aurelia S9 Lüks Sedan', 'Aurelia S9 Luxury Sedan', '🚘', 120_000, 300, 4, 1, 0.6),
  a('car_montero_suv', 'car', 'Montero Grand SUV', 'Montero Grand SUV', '🚙', 160_000, 380, 5, 1, 0.62),
  a('car_furia_v12', 'car', 'Furia V12 Süper Otomobil', 'Furia V12 Supercar', '🏁', 380_000, 1_100, 7, 3, 0.65, { ...fx('followers', 0.06), minReputation: 35 }),
  a('car_classic_roadster', 'car', '1962 Klasik Roadster', '1962 Classic Roadster', '🚗', 900_000, 1_200, 6, 3, 1.04, { minReputation: 40 }),
  a('car_spectra_hyper', 'car', 'Spectra Hiper Otomobil', 'Spectra Hypercar', '⚡', 2_400_000, 5_500, 9, 5, 0.7, { ...fx('followers', 0.12), minReputation: 60 }),

  // ── Watches: tiny upkeep (service), luxury pieces hold value ──
  a('watch_tik_sport', 'watch', 'Tik Spor Saat', 'Tik Sport Watch', '⌚', 300, 0, 1, 0, 0.3),
  a('watch_kronos_diver', 'watch', 'Kronos Dalgıç Saati', 'Kronos Diver', '⌚', 4_000, 5, 1, 0, 0.7),
  a('watch_valmont_chrono', 'watch', 'Valmont Kronograf', 'Valmont Chronograph', '⌚', 18_000, 15, 2, 1, 0.8),
  a('watch_helvetia_royal', 'watch', 'Helvetia Royal Otomatik', 'Helvetia Royal Automatic', '⌚', 55_000, 30, 2, 1, 0.9, { minReputation: 20 }),
  a('watch_duval_tourbillon', 'watch', 'Maison Duval Tourbillon', 'Maison Duval Tourbillon', '💎', 250_000, 80, 3, 2, 0.95, { minReputation: 40 }),
  a('watch_orbis_grand', 'watch', 'Orbis Grand Komplikasyon', 'Orbis Grand Complication', '👑', 1_200_000, 200, 4, 4, 1.05, { minReputation: 60 }),

  // ── Fashion: fast depreciation except limited/jewellery; boosts followers ──
  a('fashion_sneakers', 'fashion', 'Sokak Sneaker Paketi', 'Street Sneaker Pack', '👟', 800, 0, 1, 0, 0.2),
  a('fashion_suit_nero', 'fashion', 'Atelier Nero Takım Elbise', 'Atelier Nero Suit', '🤵', 6_000, 0, 1, 0, 0.3),
  a('fashion_gala', 'fashion', 'Tasarımcı Gala Kıyafeti', 'Designer Gala Outfit', '🎩', 15_000, 0, 2, 1, 0.3, fx('followers', 0.02)),
  a('fashion_limited_kicks', 'fashion', 'Sınırlı Üretim Sneaker Koleksiyonu', 'Limited Sneaker Collection', '🧾', 25_000, 10, 2, 1, 1.0, fx('followers', 0.03)),
  a('fashion_couture', 'fashion', 'Couture Gardırop', 'Couture Wardrobe', '👗', 40_000, 50, 3, 1, 0.35, { ...fx('followers', 0.04), minReputation: 20 }),
  a('fashion_tailored_year', 'fashion', 'Yıllık Özel Dikim Servisi', 'Year of Bespoke Tailoring', '🪡', 120_000, 100, 3, 2, 0.2, { ...fx('followers', 0.05), minReputation: 35 }),
  a('fashion_diamond_set', 'fashion', 'Elmas Mücevher Seti', 'Diamond Jewellery Set', '💍', 200_000, 60, 3, 2, 0.85, { minReputation: 35 }),

  // ── Tech: steepest depreciation (resale ~0.3), small upkeep ──
  a('tech_console', 'tech', 'Nexus 5 Oyun Konsolu', 'Nexus 5 Console', '🎮', 600, 5, 2, 0, 0.35),
  a('tech_phone', 'tech', 'Aurora Pro Telefon', 'Aurora Pro Phone', '📱', 1_500, 8, 1, 0, 0.3),
  a('tech_drone', 'tech', 'Skylens Kameralı Drone', 'Skylens Camera Drone', '🚁', 2_000, 5, 1, 0, 0.3, fx('followers', 0.02)),
  a('tech_gaming_pc', 'tech', 'Titan Oyuncu Bilgisayarı', 'Titan Gaming PC', '🖥️', 4_000, 10, 2, 0, 0.3),
  a('tech_somnia_bed', 'tech', 'Somnia Akıllı Yatak', 'Somnia Smart Bed', '🛏️', 9_000, 10, 1, 0, 0.3, fx('sleep', 6)),
  a('tech_stream_studio', 'tech', 'Yayın Stüdyosu Seti', 'Streaming Studio Rig', '🎙️', 12_000, 25, 2, 1, 0.3, fx('followers', 0.06)),
  a('tech_home_cinema', 'tech', 'Ev Sineması Sistemi', 'Home Cinema System', '📽️', 25_000, 30, 3, 0, 0.3),
  a('tech_smart_home', 'tech', 'Akıllı Ev Paketi', 'Smart Home Suite', '🏠', 60_000, 60, 2, 0, 0.25, fx('security', 0.2)),

  // ── Pets: no resale market (0), upkeep = food & vet; best stress relief per € ──
  a('pet_cat', 'pet', 'Tekir Kedi', 'Tabby Cat', '🐈', 300, 25, 2, 0, 0, fx('stress_relief', 1)),
  a('pet_parrot', 'pet', 'Konuşan Papağan', 'Talking Parrot', '🦜', 1_500, 20, 2, 0, 0),
  a('pet_golden', 'pet', 'Golden Retriever', 'Golden Retriever', '🐕', 2_000, 60, 3, 0, 0, fx('stress_relief', 2)),
  a('pet_akita', 'pet', 'Akita Bekçi Köpeği', 'Akita Guard Dog', '🐕‍🦺', 6_000, 80, 2, 0, 0, fx('security', 0.15)),
  a('pet_aquarium', 'pet', 'Tropikal Akvaryum', 'Tropical Aquarium', '🐠', 8_000, 40, 1, 0, 0.2, fx('stress_relief', 1)),
  a('pet_bengal', 'pet', 'Bengal Kedisi', 'Bengal Cat', '🐆', 4_000, 40, 2, 0, 0, fx('followers', 0.02)),
  a('pet_horse', 'pet', 'Safkan Arap Atı', 'Purebred Arabian Horse', '🐎', 120_000, 600, 3, 2, 0.6, { ...fx('stress_relief', 3), minReputation: 30 }),

  // ── Boats: brutal upkeep (~0.3–0.4%/wk: crew, mooring, fuel) ──
  a('boat_jetski', 'boat', 'WaveRider Jet Ski', 'WaveRider Jet Ski', '🚤', 15_000, 60, 2, 0, 0.55),
  a('boat_marlin28', 'boat', 'Marlin 28 Sürat Teknesi', 'Marlin 28 Speedboat', '🚤', 180_000, 600, 4, 1, 0.6, fx('stress_relief', 2)),
  a('boat_sirocco', 'boat', 'Sirocco Yelkenli', 'Sirocco Sailing Yacht', '⛵', 400_000, 1_200, 5, 2, 0.65, { ...fx('stress_relief', 3), minReputation: 25 }),
  a('boat_gulet', 'boat', 'Ahşap Gulet', 'Wooden Gulet', '⛵', 900_000, 2_800, 6, 2, 0.7, { ...fx('stress_relief', 4), minReputation: 35 }),
  a('boat_azure45', 'boat', 'Azure 45m Yat', 'Azure 45m Yacht', '🛥️', 8_000_000, 30_000, 9, 6, 0.65, { ...fx('stress_relief', 6), minReputation: 60 }),
  a('boat_leviathan90', 'boat', 'Leviathan 90m Mega Yat', 'Leviathan 90m Superyacht', '🛳️', 60_000_000, 220_000, 12, 10, 0.6, { ...fx('followers', 0.15), minReputation: 85 }),

  // ── Jets: travel fatigue reduction scales with size; enormous running cost ──
  a('jet_share', 'jet', 'Paylaşımlı Jet Üyeliği', 'Fractional Jet Membership', '🎫', 250_000, 1_500, 2, 1, 0.3, { ...fx('travel_fatigue', 0.15), minReputation: 35 }),
  a('jet_aeris_heli', 'jet', 'Aeris H4 Helikopter', 'Aeris H4 Helicopter', '🚁', 2_500_000, 9_000, 4, 3, 0.6, { ...fx('travel_fatigue', 0.2), minReputation: 50 }),
  a('jet_swift_light', 'jet', 'Swift Hafif Jet', 'Swift Light Jet', '✈️', 6_000_000, 18_000, 5, 4, 0.6, { ...fx('travel_fatigue', 0.35), minReputation: 60 }),
  a('jet_meridian_mid', 'jet', 'Meridian Orta Boy Jet', 'Meridian Midsize Jet', '✈️', 18_000_000, 45_000, 6, 6, 0.6, { ...fx('travel_fatigue', 0.5), minReputation: 70 }),
  a('jet_stratos_long', 'jet', 'Stratos Uzun Menzil Jet', 'Stratos Long-Range Jet', '🛩️', 55_000_000, 120_000, 8, 9, 0.6, { ...fx('travel_fatigue', 0.65), minReputation: 85 }),

  // ── Art: no upkeep beyond insurance; resale ≥ 1 for blue-chip (appreciates) ──
  a('art_young_canvas', 'art', 'Genç Sanatçıdan Tuval', 'Emerging Artist Canvas', '🖼️', 3_000, 0, 1, 0, 1.08),
  a('art_digital', 'art', 'Dijital Sanat Koleksiyonu', 'Digital Art Collection', '🧊', 20_000, 0, 1, 1, 0.6, fx('followers', 0.03)),
  a('art_bronze', 'art', 'Bronz Heykel', 'Bronze Sculpture', '🗿', 40_000, 20, 2, 1, 1.05),
  a('art_popart', 'art', 'Pop-Art Serigrafi', 'Pop-Art Silkscreen', '🎨', 90_000, 40, 2, 1, 1.12, { minReputation: 20 }),
  a('art_antique_vase', 'art', 'Antik Seramik Vazo', 'Antique Ceramic Vase', '🏺', 400_000, 150, 2, 2, 1.08, { minReputation: 35 }),
  a('art_impressionist', 'art', 'Empresyonist Peyzaj Tablosu', 'Impressionist Landscape', '🖼️', 1_500_000, 500, 3, 4, 1.18, { ...fx('followers', 0.04), minReputation: 50 }),
  a('art_masterpiece', 'art', 'Modern Ustanın Başyapıtı', 'Modern Master Painting', '🖼️', 12_000_000, 3_000, 4, 8, 1.25, { ...fx('followers', 0.08), minReputation: 70 }),

  // ── Islands: endgame flex; resale ~0.9, large upkeep, top fame ──
  a('island_lake', 'island', 'Göl Adacığı', 'Lake Islet', '🏝️', 3_000_000, 7_000, 6, 4, 0.9, { ...fx('stress_relief', 4), minReputation: 55 }),
  a('island_aegean', 'island', 'Ege Koyu Adası', 'Aegean Cove Island', '🏝️', 15_000_000, 30_000, 9, 7, 0.9, { ...fx('stress_relief', 6), minReputation: 70 }),
  a('island_tropic', 'island', 'Tropik Özel Ada', 'Private Tropical Island', '🌴', 55_000_000, 90_000, 12, 10, 0.9, { ...fx('stress_relief', 8), minReputation: 85 }),
  a('island_atoll', 'island', 'Mercan Atolü Cenneti', 'Coral Atoll Paradise', '🐚', 120_000_000, 180_000, 14, 12, 0.9, { ...fx('happiness_partner', 5), minReputation: 92 }),

  // ── Businesses: expected weekly income ≈ 0.4% of price vs upkeep ≈ 0.17%
  //    → ~12%/yr net before variance (economy applies ±60% weekly noise). ──
  a('biz_cafe', 'business', 'Mahalle Kahve Dükkânı', 'Neighbourhood Coffee Shop', '☕', 120_000, 200, 2, 1, 0.75, fx('business_income', 480)),
  a('biz_gym', 'business', 'Fitness Salonu', 'Fitness Gym', '💪', 450_000, 760, 2, 1, 0.75, fx('business_income', 1_800)),
  a('biz_academy', 'business', 'Çocuk Futbol Okulu', 'Kids Football Academy', '⚽', 600_000, 1_000, 3, 3, 0.7, fx('business_income', 2_300)),
  a('biz_clothing', 'business', 'Kendi Giyim Markan', 'Your Own Clothing Label', '👕', 900_000, 1_500, 3, 3, 0.7, { ...fx('business_income', 3_700), minReputation: 30 }),
  a('biz_restaurant', 'business', 'Şef Restoranı', "Chef's Restaurant", '🍽️', 1_200_000, 2_000, 3, 2, 0.75, { ...fx('business_income', 4_800), minReputation: 25 }),
  a('biz_esports', 'business', 'E-spor Takımı', 'Esports Team', '🕹️', 2_000_000, 3_400, 3, 3, 0.6, { ...fx('business_income', 8_000), minReputation: 35 }),
  a('biz_nightclub', 'business', 'Gece Kulübü', 'Nightclub', '🪩', 3_500_000, 6_000, 3, 3, 0.65, { ...fx('business_income', 14_500), minReputation: 40 }),
  a('biz_hotel', 'business', 'Butik Otel', 'Boutique Hotel', '🏨', 12_000_000, 20_000, 4, 5, 0.85, { ...fx('business_income', 48_000), minReputation: 55 }),

  // ── Facilities: the "pro" purchases — buy performance, not just status ──
  a('fac_home_gym', 'facility', 'Ev Spor Salonu', 'Home Gym', '🏋️', 35_000, 60, 1, 0, 0.4, fx('recovery', 0.08)),
  a('fac_spa', 'facility', 'Spa & Sauna', 'Spa & Sauna', '🧖', 90_000, 180, 2, 0, 0.5, fx('stress_relief', 2)),
  a('fac_pool', 'facility', 'Kapalı Yüzme Havuzu', 'Indoor Swimming Pool', '🏊', 150_000, 350, 2, 1, 0.6, fx('stress_relief', 3)),
  a('fac_physio_room', 'facility', 'Özel Fizyoterapi Odası', 'Private Physio Room', '🩺', 180_000, 450, 1, 0, 0.5, fx('injury_resist', 0.1)),
  a('fac_cryo', 'facility', 'Kriyoterapi Odası', 'Cryotherapy Chamber', '❄️', 220_000, 500, 1, 1, 0.5, fx('recovery', 0.15)),
  a('fac_security', 'facility', 'Güvenlik Sistemi & Koruma', 'Security System & Bodyguards', '🛡️', 250_000, 1_500, 1, 0, 0.3, fx('security', 0.5)),
  a('fac_mini_pitch', 'facility', 'Bahçede Mini Futbol Sahası', 'Backyard Mini Pitch', '🥅', 300_000, 400, 2, 1, 0.6, fx('xp_bonus', 0.05)),
  a('fac_oxygen', 'facility', 'Hiperbarik Oksijen Odası', 'Hyperbaric Oxygen Room', '🫧', 400_000, 700, 1, 0, 0.5, fx('sleep', 6)),
  a('fac_training_ground', 'facility', 'Özel Antrenman Sahası', 'Private Training Ground', '🏟️', 1_200_000, 2_500, 2, 2, 0.7, { ...fx('xp_bonus', 0.12), minReputation: 35 }),
  a('fac_perf_lab', 'facility', 'Performans Laboratuvarı', 'Performance Lab', '🧪', 3_000_000, 6_000, 1, 2, 0.6, { ...fx('xp_bonus', 0.1), minReputation: 50 }),
]

export const ASSET_BY_ID: Readonly<Record<string, AssetDef>> = Object.fromEntries(ASSETS.map((x) => [x.id, x]))

/** Assets of a category sorted by price ascending. */
export const assetsByCategory = (c: AssetCategory): AssetDef[] => ASSETS.filter((x) => x.category === c).sort((p, q) => p.price - q.price)
