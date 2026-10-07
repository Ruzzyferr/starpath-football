/** Domain vocabulary: positions, attributes, enums from core/types.ts. */
import type { Shape } from '../shape'

export const tr = {
  pos: {
    GK: 'KL', CB: 'STP', LB: 'SLB', RB: 'SĞB', DM: 'DOS', CM: 'MO', AM: 'OOS', LW: 'SLK', RW: 'SĞK', ST: 'SNT',
  },
  posLong: {
    GK: 'Kaleci', CB: 'Stoper', LB: 'Sol Bek', RB: 'Sağ Bek', DM: 'Defansif Orta Saha',
    CM: 'Merkez Orta Saha', AM: 'Ofansif Orta Saha', LW: 'Sol Kanat', RW: 'Sağ Kanat', ST: 'Santrfor',
  },
  foot: { L: 'Sol', R: 'Sağ', B: 'İki ayaklı' },
  attr: {
    pace: 'Hız', stamina: 'Dayanıklılık', strength: 'Güç', agility: 'Çeviklik', jumping: 'Zıplama',
    passing: 'Pas', shooting: 'Şut', finishing: 'Bitiricilik', dribbling: 'Dribbling', firstTouch: 'İlk Dokunuş',
    crossing: 'Orta', heading: 'Kafa', tackling: 'Top Kapma', setPieces: 'Duran Top',
    vision: 'Vizyon', composure: 'Soğukkanlılık', positioning: 'Pozisyon Alma', leadership: 'Liderlik', workRate: 'Çalışkanlık',
    reflexes: 'Refleks', handling: 'Top Tutma',
  },
  attrShort: {
    pace: 'HIZ', stamina: 'DAY', strength: 'GÜÇ', agility: 'ÇEV', jumping: 'ZIP',
    passing: 'PAS', shooting: 'ŞUT', finishing: 'BİT', dribbling: 'DRB', firstTouch: 'İLK',
    crossing: 'ORT', heading: 'KAF', tackling: 'KAP', setPieces: 'DUR',
    vision: 'VİZ', composure: 'SOĞ', positioning: 'POZ', leadership: 'LİD', workRate: 'ÇAL',
    reflexes: 'REF', handling: 'TUT',
  },
  group: { physical: 'Fiziksel', technical: 'Teknik', mental: 'Zihinsel', goalkeeping: 'Kalecilik', recovery: 'Toparlanma', tactical: 'Taktik' },
  archetype: {
    poacher: 'Golcü', playmaker: 'Oyun Kurucu', winger: 'Kanat Motoru', wall: 'Duvar', boxToBox: 'Box-to-Box', keeper: 'Kaleci',
  },
  archetypeDesc: {
    poacher: 'Ceza sahasında doğru yerde, doğru anda. Bitiricilik ve soğukkanlılık bonusu.',
    playmaker: 'Oyunu görür, pasla yönetir. Vizyon ve pas bonusu.',
    winger: 'Çizgiye iner, adam eksiltir. Hız ve dribbling bonusu.',
    wall: 'Hiçbir şey geçmez. Top kapma, güç ve kafa bonusu.',
    boxToBox: 'İki ceza sahası arasında yorulmaz. Dayanıklılık ve çalışkanlık bonusu.',
    keeper: 'Son kale. Refleks ve top tutma bonusu.',
  },
  background: { street: 'Sokak Futbolu', academy: 'Akademi Çocuğu', footballFamily: 'Futbolcu Ailesi', lateBloomer: 'Geç Keşfedilen' },
  backgroundDesc: {
    street: 'Mahalle maçlarında pişti. Dribbling ve hırs yüksek, para az.',
    academy: 'Disiplinli bir altyapıdan geldi. Dengeli özellikler, iyi ilk sözleşme.',
    footballFamily: 'Babası eski bir futbolcu. Bağlantılar ve biraz birikim var, beklenti de.',
    lateBloomer: 'Kimse fark etmedi, şimdi fark edecekler. Yüksek potansiyel, düşük başlangıç.',
  },
  personality: {
    professional: 'Profesyonel', loyal: 'Sadık', ambitious: 'Hırslı', party: 'Eğlence düşkünü',
    hothead: 'Asabi', quiet: 'Sessiz', leader: 'Lider', joker: 'Şakacı',
  },
  role: { youth: 'Altyapı', reserve: 'Yedek', rotation: 'Rotasyon', starter: 'İlk 11', star: 'Yıldız', captain: 'Kaptan' },
  relation: {
    mother: 'Anne', father: 'Baba', sibling: 'Kardeş', partner: 'Sevgili', bestFriend: 'En yakın arkadaş',
    manager: 'Teknik direktör', teammate: 'Takım arkadaşı', agent: 'Menajer', fans: 'Taraftarlar', press: 'Basın', chairman: 'Başkan',
  },
  assetCat: {
    house: 'Ev', car: 'Araba', watch: 'Saat', fashion: 'Moda', tech: 'Teknoloji', pet: 'Evcil hayvan',
    boat: 'Tekne', jet: 'Jet', art: 'Sanat', island: 'Ada', business: 'İşletme', facility: 'Tesis',
  },
  stat: {
    money: 'Para', energy: 'Enerji', happiness: 'Mutluluk', health: 'Sağlık', stress: 'Stres', discipline: 'Disiplin',
    reputation: 'Şöhret', followers: 'Takipçi', form: 'Form', morale: 'Moral', fatigue: 'Yorgunluk', sharpness: 'Maç formu',
    managerTrust: 'TD güveni', xp: 'XP', relation: 'İlişki', addiction: 'Bağımlılık', perkPoints: 'Yetenek puanı',
  },
  risk: { safe: 'Güvenli', low: 'Düşük risk', medium: 'Riskli', high: 'Çok riskli' },
  eventCat: {
    team: 'Takım', family: 'Aile', love: 'Aşk', press: 'Basın', social: 'Sosyal medya', fans: 'Taraftar',
    nightlife: 'Gece hayatı', charity: 'Hayır işi', business: 'İş fırsatı', scam: 'Şüpheli teklif', health: 'Sağlık',
    legal: 'Hukuk', national: 'Milli takım', rival: 'Rakip', transfer: 'Transfer', awards: 'Ödül',
  },
  activityCat: {
    training: 'Antrenman', rest: 'Dinlenme', social: 'Sosyal', family: 'Aile', media: 'Medya', business: 'İş',
    shopping: 'Alışveriş', nightlife: 'Gece hayatı', charity: 'Hayır', casino: 'Kumarhane',
  },
  day: { '0': 'Pazartesi', '1': 'Salı', '2': 'Çarşamba', '3': 'Perşembe', '4': 'Cuma', '5': 'Cumartesi', '6': 'Pazar' },
  dayShort: { '0': 'Pzt', '1': 'Sal', '2': 'Çar', '3': 'Per', '4': 'Cum', '5': 'Cmt', '6': 'Paz' },
  slot: { '0': 'Sabah', '1': 'Öğleden sonra', '2': 'Akşam' },
  difficulty: { easy: 'Kolay', normal: 'Normal', hard: 'Zor', legend: 'Efsane' },
  difficultyDesc: {
    easy: 'Hata affedilir, maçlar daha cömert.',
    normal: 'Dengeli kariyer; önerilen.',
    hard: 'Rakipler sert, kulüpler sabırsız.',
    legend: 'Tek kayıt hakkı yok. Her karar kalıcı.',
  },
  weather: { clear: 'Açık', rain: 'Yağmurlu', snow: 'Karlı', wind: 'Rüzgârlı', hot: 'Sıcak' },
  comp: { league: 'Lig', cup: 'Kupa', continental: 'Kıtasal', international: 'Milli', friendly: 'Hazırlık' },
  invest: { index: 'Endeks fonu', startup: 'Girişim', property: 'Gayrimenkul', crypto: 'Kripto', bonds: 'Tahvil' },
  interaction: {
    call: 'Ara', dinner: 'Yemeğe çık', gift: 'Hediye al', train: 'Birlikte çalış', party: 'Parti', holiday: 'Tatil', apologize: 'Özür dile',
  },
  post: {
    training: 'Antrenman', luxury: 'Lüks', family: 'Aile', charity: 'Hayır', provocative: 'Provokatif', fans: 'Taraftara mesaj',
  },
  tier: { bronze: 'Bronz', silver: 'Gümüş', gold: 'Altın', elite: 'Elit', legend: 'Efsane' },
  result: { W: 'G', D: 'B', L: 'M' },
  sponsorCat: { boots: 'Krampon', watch: 'Saat', drink: 'İçecek', fashion: 'Moda', gaming: 'Oyun', car: 'Otomobil' },
}

export const en: Shape<typeof tr> = {
  pos: {
    GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB', DM: 'DM', CM: 'CM', AM: 'AM', LW: 'LW', RW: 'RW', ST: 'ST',
  },
  posLong: {
    GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back', DM: 'Defensive Midfielder',
    CM: 'Central Midfielder', AM: 'Attacking Midfielder', LW: 'Left Winger', RW: 'Right Winger', ST: 'Striker',
  },
  foot: { L: 'Left', R: 'Right', B: 'Two-footed' },
  attr: {
    pace: 'Pace', stamina: 'Stamina', strength: 'Strength', agility: 'Agility', jumping: 'Jumping',
    passing: 'Passing', shooting: 'Shooting', finishing: 'Finishing', dribbling: 'Dribbling', firstTouch: 'First Touch',
    crossing: 'Crossing', heading: 'Heading', tackling: 'Tackling', setPieces: 'Set Pieces',
    vision: 'Vision', composure: 'Composure', positioning: 'Positioning', leadership: 'Leadership', workRate: 'Work Rate',
    reflexes: 'Reflexes', handling: 'Handling',
  },
  attrShort: {
    pace: 'PAC', stamina: 'STA', strength: 'STR', agility: 'AGI', jumping: 'JMP',
    passing: 'PAS', shooting: 'SHO', finishing: 'FIN', dribbling: 'DRI', firstTouch: 'FTC',
    crossing: 'CRO', heading: 'HEA', tackling: 'TAC', setPieces: 'SET',
    vision: 'VIS', composure: 'COM', positioning: 'POS', leadership: 'LEA', workRate: 'WRK',
    reflexes: 'REF', handling: 'HAN',
  },
  group: { physical: 'Physical', technical: 'Technical', mental: 'Mental', goalkeeping: 'Goalkeeping', recovery: 'Recovery', tactical: 'Tactical' },
  archetype: {
    poacher: 'Poacher', playmaker: 'Playmaker', winger: 'Wing Engine', wall: 'The Wall', boxToBox: 'Box-to-Box', keeper: 'Keeper',
  },
  archetypeDesc: {
    poacher: 'Right place, right time in the box. Finishing and composure bonus.',
    playmaker: 'Sees the game and runs it with the ball. Vision and passing bonus.',
    winger: 'Hugs the line and beats his man. Pace and dribbling bonus.',
    wall: 'Nothing gets past. Tackling, strength and heading bonus.',
    boxToBox: 'Tireless from box to box. Stamina and work rate bonus.',
    keeper: 'The last line. Reflexes and handling bonus.',
  },
  background: { street: 'Street Football', academy: 'Academy Kid', footballFamily: 'Football Family', lateBloomer: 'Late Bloomer' },
  backgroundDesc: {
    street: 'Raised on neighbourhood games. High flair and hunger, little money.',
    academy: 'Came through a disciplined academy. Balanced attributes, a good first contract.',
    footballFamily: 'Dad played the game. Connections and some savings — and expectations.',
    lateBloomer: 'Nobody noticed. They will now. High potential, low starting point.',
  },
  personality: {
    professional: 'Professional', loyal: 'Loyal', ambitious: 'Ambitious', party: 'Party lover',
    hothead: 'Hothead', quiet: 'Quiet', leader: 'Leader', joker: 'Joker',
  },
  role: { youth: 'Youth', reserve: 'Reserve', rotation: 'Rotation', starter: 'Starter', star: 'Star', captain: 'Captain' },
  relation: {
    mother: 'Mother', father: 'Father', sibling: 'Sibling', partner: 'Partner', bestFriend: 'Best friend',
    manager: 'Manager', teammate: 'Teammate', agent: 'Agent', fans: 'Fans', press: 'Press', chairman: 'Chairman',
  },
  assetCat: {
    house: 'Home', car: 'Car', watch: 'Watch', fashion: 'Fashion', tech: 'Tech', pet: 'Pet',
    boat: 'Boat', jet: 'Jet', art: 'Art', island: 'Island', business: 'Business', facility: 'Facility',
  },
  stat: {
    money: 'Money', energy: 'Energy', happiness: 'Happiness', health: 'Health', stress: 'Stress', discipline: 'Discipline',
    reputation: 'Fame', followers: 'Followers', form: 'Form', morale: 'Morale', fatigue: 'Fatigue', sharpness: 'Sharpness',
    managerTrust: 'Manager trust', xp: 'XP', relation: 'Relationship', addiction: 'Addiction', perkPoints: 'Perk points',
  },
  risk: { safe: 'Safe', low: 'Low risk', medium: 'Risky', high: 'Very risky' },
  eventCat: {
    team: 'Team', family: 'Family', love: 'Love', press: 'Press', social: 'Social media', fans: 'Fans',
    nightlife: 'Nightlife', charity: 'Charity', business: 'Business', scam: 'Shady offer', health: 'Health',
    legal: 'Legal', national: 'National team', rival: 'Rival', transfer: 'Transfer', awards: 'Awards',
  },
  activityCat: {
    training: 'Training', rest: 'Rest', social: 'Social', family: 'Family', media: 'Media', business: 'Business',
    shopping: 'Shopping', nightlife: 'Nightlife', charity: 'Charity', casino: 'Casino',
  },
  day: { '0': 'Monday', '1': 'Tuesday', '2': 'Wednesday', '3': 'Thursday', '4': 'Friday', '5': 'Saturday', '6': 'Sunday' },
  dayShort: { '0': 'Mon', '1': 'Tue', '2': 'Wed', '3': 'Thu', '4': 'Fri', '5': 'Sat', '6': 'Sun' },
  slot: { '0': 'Morning', '1': 'Afternoon', '2': 'Evening' },
  difficulty: { easy: 'Easy', normal: 'Normal', hard: 'Hard', legend: 'Legend' },
  difficultyDesc: {
    easy: 'Mistakes are forgiven, matches are kinder.',
    normal: 'A balanced career; recommended.',
    hard: 'Tough opponents, impatient clubs.',
    legend: 'No save scumming. Every decision sticks.',
  },
  weather: { clear: 'Clear', rain: 'Rain', snow: 'Snow', wind: 'Windy', hot: 'Hot' },
  comp: { league: 'League', cup: 'Cup', continental: 'Continental', international: 'International', friendly: 'Friendly' },
  invest: { index: 'Index fund', startup: 'Startup', property: 'Property', crypto: 'Crypto', bonds: 'Bonds' },
  interaction: {
    call: 'Call', dinner: 'Dinner', gift: 'Buy a gift', train: 'Train together', party: 'Party', holiday: 'Holiday', apologize: 'Apologise',
  },
  post: {
    training: 'Training', luxury: 'Luxury', family: 'Family', charity: 'Charity', provocative: 'Provocative', fans: 'Message to fans',
  },
  tier: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', elite: 'Elite', legend: 'Legend' },
  result: { W: 'W', D: 'D', L: 'L' },
  sponsorCat: { boots: 'Boots', watch: 'Watch', drink: 'Drink', fashion: 'Fashion', gaming: 'Gaming', car: 'Car' },
}
