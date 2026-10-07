/** Bilingual content catalogs for the mock backend. */
import type { AssetDef, AttributeGroup, GameState, LText, RelationKind, SponsorDeal } from '../../core/types'
import type {
  ActivityView, Delta, EventCategory, PerkView, Risk, TrainerOffer, TrainingSessionView,
} from '../store'

/** Delta with an optional relationship target (mock-internal). */
export type MDelta = Delta & { rel?: RelationKind }

const L = (tr: string, en: string): LText => ({ tr, en })
const d = (key: Delta['key'], value: number, uncertain?: boolean): MDelta => (uncertain ? { key, value, uncertain } : { key, value })
const rel = (kind: RelationKind, value: number, label: LText, uncertain?: boolean): MDelta => ({ key: 'relation', value, label, rel: kind, uncertain })

const R = {
  mother: L('Annen', 'Mum'),
  father: L('Baban', 'Dad'),
  partner: L('Sevgilin', 'Partner'),
  manager: L('Hocan', 'Manager'),
  fans: L('Taraftar', 'Fans'),
  press: L('Basın', 'Press'),
  friend: L('Kanka', 'Best mate'),
  teammate: L('Takım', 'Squad'),
  agent: L('Menajerin', 'Agent'),
  sibling: L('Kardeşin', 'Sibling'),
}

// ───────────────────────── Activities ─────────────────────────
export interface ActivityDef extends Omit<ActivityView, 'available' | 'lockedReason' | 'effects'> {
  effects: MDelta[]
  minReputation?: number
}

export const ACTIVITIES: ActivityDef[] = [
  { id: 'gym', category: 'training', name: L('Spor salonu', 'Gym session'), desc: L('Ağırlık ve kor çalışması. Güç ve dayanıklılık için.', 'Weights and core work. Builds strength and stamina.'), icon: 'barbell', slots: 1, energy: 22, cost: 0, effects: [d('strength', 1), d('stamina', 1), d('fatigue', 8)], risk: 'low' },
  { id: 'extra_shooting', category: 'training', name: L('Ekstra şut idmanı', 'Extra shooting'), desc: L('Antrenmandan sonra kaleye 200 şut.', '200 shots after the main session.'), icon: 'target', slots: 1, energy: 18, cost: 0, effects: [d('finishing', 1), d('shooting', 1), d('managerTrust', 2)], risk: 'safe' },
  { id: 'video', category: 'training', name: L('Video analizi', 'Video analysis'), desc: L('Rakibin savunma hattını izle.', 'Study the opponent’s back line.'), icon: 'eye', slots: 1, energy: 6, cost: 0, effects: [d('positioning', 1), d('vision', 1)], risk: 'safe' },
  { id: 'sprint', category: 'training', name: L('Sprint drilleri', 'Sprint drills'), desc: L('Kısa mesafe patlayıcılık.', 'Short-distance explosiveness.'), icon: 'run', slots: 1, energy: 24, cost: 0, effects: [d('pace', 1), d('agility', 1), d('fatigue', 10)], risk: 'medium' },
  { id: 'nap', category: 'rest', name: L('Kestirme', 'Power nap'), desc: L('Yirmi dakika kapat gözlerini.', 'Twenty minutes, eyes shut.'), icon: 'bed', slots: 1, energy: -20, cost: 0, effects: [d('energy', 20), d('stress', -4)], risk: 'safe' },
  { id: 'spa', category: 'rest', name: L('Spa ve masaj', 'Spa & massage'), desc: L('Kaslar gevşer, kafa boşalır.', 'Loose muscles, clear head.'), icon: 'heartbeat', slots: 1, energy: -15, cost: 450, effects: [d('fatigue', -15), d('stress', -8), d('happiness', 3)], risk: 'safe' },
  { id: 'cryo', category: 'rest', name: L('Kriyoterapi', 'Cryotherapy'), desc: L('Eksi 110 derecede üç dakika.', 'Three minutes at minus 110.'), icon: 'snowflake', slots: 1, energy: -5, cost: 900, effects: [d('fatigue', -25), d('health', 3)], risk: 'safe', minReputation: 30 },
  { id: 'coffee_team', category: 'social', name: L('Takımla kahve', 'Coffee with the lads'), desc: L('Soyunma odası kimyası sahaya yansır.', 'Dressing-room chemistry shows on the pitch.'), icon: 'chat', slots: 1, energy: 6, cost: 60, effects: [rel('teammate', 4, R.teammate), d('happiness', 2)], risk: 'safe' },
  { id: 'date', category: 'social', name: L('Akşam yemeği randevusu', 'Dinner date'), desc: L('Telefonları masaya ters koy.', 'Phones face down on the table.'), icon: 'fork-knife', slots: 1, energy: 8, cost: 320, effects: [rel('partner', 6, R.partner), d('happiness', 5)], risk: 'safe' },
  { id: 'friends', category: 'social', name: L('Mahalleye uğra', 'Visit the old neighbourhood'), desc: L('Eski arkadaşlar, aynı halı saha.', 'Old friends, same five-a-side pitch.'), icon: 'users', slots: 1, energy: 10, cost: 0, effects: [rel('bestFriend', 5, R.friend), d('happiness', 4), d('reputation', 1)], risk: 'safe' },
  { id: 'family_dinner', category: 'family', name: L('Aile yemeği', 'Family dinner'), desc: L('Annenin dolması, babanın taktik yorumları.', 'Mum’s cooking, Dad’s tactical takes.'), icon: 'house', slots: 1, energy: 5, cost: 0, effects: [rel('mother', 5, R.mother), rel('father', 4, R.father), d('happiness', 4)], risk: 'safe' },
  { id: 'sibling_game', category: 'family', name: L('Kardeşinle oyun', 'Gaming with your sibling'), desc: L('Konsolda derbi, gerçekte kahkaha.', 'A console derby, real laughs.'), icon: 'laptop', slots: 1, energy: 4, cost: 0, effects: [rel('sibling', 6, R.sibling), d('stress', -5)], risk: 'safe' },
  { id: 'interview', category: 'media', name: L('Röportaj ver', 'Give an interview'), desc: L('Spor kanalında on beş dakika.', 'Fifteen minutes on a sports channel.'), icon: 'megaphone', slots: 1, energy: 10, cost: 0, effects: [d('reputation', 2), rel('press', 5, R.press), d('stress', 3)], risk: 'low' },
  { id: 'stream', category: 'media', name: L('Canlı yayın aç', 'Go live on stream'), desc: L('Taraftarlarla soru-cevap.', 'Q&A with the fans.'), icon: 'camera', slots: 1, energy: 8, cost: 0, effects: [d('followers', 3500), rel('fans', 3, R.fans)], risk: 'low' },
  { id: 'photoshoot', category: 'business', name: L('Reklam çekimi', 'Ad shoot'), desc: L('Sponsor için bir günlük çekim.', 'A day on set for your sponsor.'), icon: 'spotlight', slots: 2, energy: 20, cost: -6000, effects: [d('money', 6000), d('reputation', 1), d('fatigue', 5)], risk: 'safe', minReputation: 20 },
  { id: 'meet_agent', category: 'business', name: L('Menajerle toplantı', 'Meet your agent'), desc: L('Sözleşme ve teklifler üzerine.', 'Contracts and offers.'), icon: 'handshake', slots: 1, energy: 6, cost: 0, effects: [rel('agent', 4, R.agent)], risk: 'safe' },
  { id: 'shopping', category: 'shopping', name: L('AVM turu', 'Mall trip'), desc: L('Yeni kramponlar, yeni kombin.', 'New boots, new fit.'), icon: 'shopping-bag', slots: 1, energy: 8, cost: 1800, effects: [d('happiness', 6), d('stress', -3)], risk: 'safe' },
  { id: 'luxury_shopping', category: 'shopping', name: L('Lüks butik', 'Luxury boutique'), desc: L('Kapıda güvenlik, içeride şampanya.', 'Security at the door, champagne inside.'), icon: 'hanger', slots: 1, energy: 8, cost: 12000, effects: [d('happiness', 9), d('reputation', 1), d('followers', 1500)], risk: 'safe', minReputation: 35 },
  { id: 'club_night', category: 'nightlife', name: L('Gece kulübü', 'Night club'), desc: L('Müzik yüksek, kameralar her yerde.', 'Loud music, cameras everywhere.'), icon: 'party', slots: 1, energy: 20, cost: 900, effects: [d('happiness', 8), d('stress', -6), d('discipline', -5, true), d('fatigue', 12)], risk: 'high' },
  { id: 'rooftop', category: 'nightlife', name: L('Teras partisi', 'Rooftop party'), desc: L('Ünlüler, influencerlar, gece uzun.', 'Celebrities, influencers, a long night.'), icon: 'moon', slots: 1, energy: 18, cost: 2500, effects: [d('followers', 6000), d('happiness', 6), d('discipline', -3, true)], risk: 'medium', minReputation: 40 },
  { id: 'hospital', category: 'charity', name: L('Çocuk hastanesi ziyareti', 'Children’s hospital visit'), desc: L('İmzalı formalar ve gülümsemeler.', 'Signed shirts and smiles.'), icon: 'hand-heart', slots: 1, energy: 10, cost: 500, effects: [d('reputation', 3), rel('fans', 5, R.fans), d('happiness', 5)], risk: 'safe' },
  { id: 'academy_visit', category: 'charity', name: L('Altyapı antrenmanı', 'Coach the academy kids'), desc: L('Kendi geldiğin yere geri ver.', 'Give back to where you came from.'), icon: 'whistle', slots: 1, energy: 12, cost: 0, effects: [d('leadership', 1), rel('chairman', 3, L('Başkan', 'Chairman'))], risk: 'safe' },
  { id: 'casino_visit', category: 'casino', name: L('Kumarhaneye git', 'Visit the casino'), desc: L('Kasa her zaman kazanır. Neredeyse.', 'The house always wins. Almost.'), icon: 'cards', slots: 1, energy: 10, cost: 0, effects: [d('addiction', 3), d('stress', -2, true), d('discipline', -2, true)], risk: 'high' },
  { id: 'poker_night', category: 'casino', name: L('Takımla poker gecesi', 'Poker night with the squad'), desc: L('Küçük bahis, büyük blöf.', 'Small stakes, big bluffs.'), icon: 'dice', slots: 1, energy: 8, cost: 300, effects: [rel('teammate', 3, R.teammate), d('addiction', 1)], risk: 'medium' },
]

// ───────────────────────── Events ─────────────────────────
export interface ChoiceDef {
  label: LText
  risk: Risk
  requirement?: { text: LText; check: (s: GameState) => boolean }
  preview: MDelta[]
  chance: number
  success: { text: LText; deltas: MDelta[] }
  fail?: { text: LText; deltas: MDelta[] }
}
export interface EventDef {
  id: string
  category: EventCategory
  title: LText
  body: LText
  person?: { rel: RelationKind; role: LText }
  choices: ChoiceDef[]
}

export const EVENTS: EventDef[] = [
  {
    id: 'penalty_taker', category: 'team', title: L('Penaltıyı kim atacak?', 'Who takes the penalty?'),
    body: L('Antrenmanda kaptan {captain} yanına geliyor: "Hoca bu hafta penaltıcıyı seçecek. Ben atarım diyorsan şimdi söyle."', 'Captain {captain} pulls you aside at training: "The gaffer picks the penalty taker this week. If you want it, say so now."'),
    person: { rel: 'teammate', role: L('Kaptan', 'Captain') },
    choices: [
      { label: L('"Topu ben alırım."', '"I’ll take it."'), risk: 'medium', preview: [d('managerTrust', 3, true), rel('teammate', -3, R.teammate, true)], chance: 0.6,
        success: { text: L('Hoca gülümsüyor: "Cesaretini sevdim." Penaltılar artık sende.', 'The manager grins: "I like the nerve." Penalties are yours now.'), deltas: [d('managerTrust', 4), d('composure', 1), rel('teammate', -2, R.teammate)] },
        fail: { text: L('Kaptan kaşlarını çatıyor. Soyunma odasında hava gergin.', 'The captain frowns. The dressing room cools.'), deltas: [rel('teammate', -6, R.teammate), d('stress', 4)] } },
      { label: L('"Kaptan atsın, ben desteklerim."', '"Captain takes it, I’ll back him."'), risk: 'safe', preview: [rel('teammate', 4, R.teammate)], chance: 1,
        success: { text: L('Kaptan omzuna vuruyor. "Senin günün de gelecek."', 'The captain slaps your back. "Your day will come."'), deltas: [rel('teammate', 5, R.teammate), d('leadership', 1)] } },
    ],
  },
  {
    id: 'mum_birthday', category: 'family', title: L('Annenin doğum günü', 'Mum’s birthday'),
    body: L('Annen bu cumartesi 50 yaşına giriyor. Aynı gün deplasman var; aile sürpriz parti hazırlıyor.', 'Mum turns 50 on Saturday. You’re away that day, and the family is planning a surprise party.'),
    person: { rel: 'mother', role: L('Annen', 'Mum') },
    choices: [
      { label: L('Pahalı bir hediye gönder', 'Send an expensive gift'), risk: 'safe', preview: [d('money', -4000), rel('mother', 6, R.mother)], chance: 1,
        success: { text: L('Annen hediyeyi çok seviyor ama sesinde biraz hüzün var.', 'Mum loves the gift, though she sounds a little wistful.'), deltas: [d('money', -4000), rel('mother', 6, R.mother), d('happiness', 2)] } },
      { label: L('Görüntülü arayıp sürprizi canlı izle', 'Video-call in for the surprise'), risk: 'safe', preview: [rel('mother', 8, R.mother), d('happiness', 4)], chance: 1,
        success: { text: L('Ekranda herkes el sallıyor. Annen gözyaşlarını tutamıyor.', 'Everyone waves at the screen. Mum can’t hold back the tears.'), deltas: [rel('mother', 9, R.mother), d('happiness', 5)] } },
      { label: L('Hocadan izin iste', 'Ask the manager for the day off'), risk: 'high', requirement: { text: L('TD güveni 60+', 'Manager trust 60+'), check: (s) => s.hero.managerTrust >= 60 }, preview: [rel('mother', 15, R.mother), d('managerTrust', -8, true)], chance: 0.45,
        success: { text: L('Hoca izin veriyor! Partide sürpriz sensin.', 'He says yes! You are the surprise at the party.'), deltas: [rel('mother', 15, R.mother), d('happiness', 10), d('managerTrust', -3)] },
        fail: { text: L('"Profesyonel ol." İzin yok, hoca da bozuldu.', '"Be a professional." No leave, and he’s annoyed.'), deltas: [d('managerTrust', -8), d('stress', 6)] } },
    ],
  },
  {
    id: 'tabloid_photo', category: 'press', title: L('Gece fotoğrafı', 'The late-night photo'),
    body: L('Bir magazin sitesi seni saat 03:00’te bir kulüpten çıkarken görüntülemiş. Manşet hazır.', 'A gossip site snapped you leaving a club at 3 a.m. The headline is ready.'),
    choices: [
      { label: L('Açıklama yap, özür dile', 'Issue an apology'), risk: 'low', preview: [d('reputation', -1), d('discipline', 3), rel('press', 2, R.press)], chance: 0.85,
        success: { text: L('Olgun tavrın takdir topluyor. Haber çabuk sönüyor.', 'Your mature response wins respect. The story fades fast.'), deltas: [d('discipline', 4), rel('press', 3, R.press), d('reputation', -1)] },
        fail: { text: L('Özür "samimiyetsiz" bulunuyor.', 'The apology is called "insincere".'), deltas: [d('reputation', -3), d('stress', 5)] } },
      { label: L('Görmezden gel', 'Ignore it'), risk: 'medium', preview: [d('reputation', -3, true), d('managerTrust', -3, true)], chance: 0.5,
        success: { text: L('Ertesi gün kimse hatırlamıyor bile.', 'By tomorrow nobody even remembers.'), deltas: [] },
        fail: { text: L('Hoca haberi okumuş. Antrenmanda soğuk bakışlar.', 'The manager read it. Cold stares at training.'), deltas: [d('managerTrust', -6), d('discipline', -5)] } },
      { label: L('Fotoğrafçıya sosyal medyadan yüklen', 'Blast the photographer online'), risk: 'high', preview: [d('followers', 8000, true), rel('press', -10, R.press)], chance: 0.3,
        success: { text: L('Taraftarlar arkanda; etiket gündeme oturuyor.', 'Fans rally behind you; the hashtag trends.'), deltas: [d('followers', 12000), rel('fans', 5, R.fans), rel('press', -8, R.press)] },
        fail: { text: L('Tepki çığ gibi büyüyor. Kulüp seni uyarıyor.', 'The backlash snowballs. The club issues a warning.'), deltas: [rel('press', -12, R.press), d('discipline', -8), d('stress', 8)] } },
    ],
  },
  {
    id: 'viral_skill', category: 'social', title: L('Videon viral oldu', 'Your clip went viral'),
    body: L('Antrenmandaki rabona golün 4 milyon izlendi. Bir enerji içeceği markası mesaj attı.', 'Your rabona from training hit 4 million views. An energy drink brand slid into your DMs.'),
    choices: [
      { label: L('Markayla anlaş', 'Take the brand deal'), risk: 'low', preview: [d('money', 15000), d('followers', 20000)], chance: 0.9,
        success: { text: L('Tek paylaşım, hızlı para.', 'One post, quick money.'), deltas: [d('money', 15000), d('followers', 20000), d('reputation', 2)] },
        fail: { text: L('Marka son anda geri çekiliyor.', 'The brand pulls out last minute.'), deltas: [d('followers', 5000)] } },
      { label: L('Taraftara teşekkür videosu çek', 'Post a thank-you to the fans'), risk: 'safe', preview: [rel('fans', 6, R.fans), d('followers', 12000)], chance: 1,
        success: { text: L('Yorumlar kalp dolu.', 'The comments are all hearts.'), deltas: [rel('fans', 7, R.fans), d('followers', 14000), d('happiness', 3)] } },
    ],
  },
  {
    id: 'shady_investment', category: 'scam', title: L('Kaçırılmayacak fırsat(!)', 'An unmissable opportunity(!)'),
    body: L('Tanımadığın bir "yatırım danışmanı" ayda %40 getiri vaat eden bir kripto fonu öneriyor. Minimum 25.000 €.', 'A "wealth advisor" you’ve never met pitches a crypto fund promising 40% a month. Minimum €25,000.'),
    choices: [
      { label: L('Yatır', 'Invest'), risk: 'high', requirement: { text: L('25.000 € nakit', '€25,000 cash'), check: (s) => s.life.money >= 25000 }, preview: [d('money', -25000), d('money', 60000, true)], chance: 0.12,
        success: { text: L('İnanılmaz ama gerçek: paran üçe katlandı. Bir daha deneme.', 'Unbelievable but true: your money tripled. Don’t try that again.'), deltas: [d('money', 50000)] },
        fail: { text: L('Site kapandı, danışman kayıp. 25.000 € uçtu.', 'The site is gone and so is the advisor. €25,000 vanished.'), deltas: [d('money', -25000), d('stress', 10), d('happiness', -6)] } },
      { label: L('Menajerine sor', 'Ask your agent'), risk: 'safe', preview: [rel('agent', 3, R.agent)], chance: 1,
        success: { text: L('Menajerin gülüyor: "Klasik dolandırıcılık. İyi ki sordun."', 'Your agent laughs: "Textbook scam. Glad you asked."'), deltas: [rel('agent', 4, R.agent), d('discipline', 2)] } },
      { label: L('Engelle', 'Block him'), risk: 'safe', preview: [], chance: 1, success: { text: L('Doğru karar.', 'Smart call.'), deltas: [] } },
    ],
  },
  {
    id: 'national_callup', category: 'national', title: L('Milli takım kapısı', 'National team knocking'),
    body: L('Ümit Milli Takım hocası seni izlemeye gelecek. Hafta sonu maçı kritik.', 'The U21 national coach is coming to watch you. This weekend matters.'),
    choices: [
      { label: L('Ekstra antrenmana kal', 'Stay for extra training'), risk: 'safe', preview: [d('fatigue', 10), d('finishing', 1), d('managerTrust', 2)], chance: 1,
        success: { text: L('Yorgunsun ama hazırsın.', 'Tired, but ready.'), deltas: [d('fatigue', 10), d('finishing', 1), d('managerTrust', 2), d('sharpness', 4)] } },
      { label: L('Erken yat, dinlen', 'Early night, rest up'), risk: 'safe', preview: [d('energy', 15), d('stress', -5)], chance: 1,
        success: { text: L('Sabaha zinde uyanıyorsun.', 'You wake up fresh.'), deltas: [d('energy', 15), d('stress', -5), d('form', 3)] } },
    ],
  },
  {
    id: 'partner_holiday', category: 'love', title: L('Tatil isteği', 'Holiday plans'),
    body: L('{partner} milli arada bir hafta Bodrum’a gitmek istiyor. "Hep futbol, hep futbol…"', '{partner} wants a week in Bodrum during the international break. "Always football, football…"'),
    person: { rel: 'partner', role: L('Sevgilin', 'Partner') },
    choices: [
      { label: L('Bodrum’a gidin', 'Go to Bodrum'), risk: 'safe', preview: [d('money', -8000), rel('partner', 12, R.partner), d('stress', -10)], chance: 1,
        success: { text: L('Gün batımı, deniz, telefonsuz bir hafta.', 'Sunsets, sea, a week without your phone.'), deltas: [d('money', -8000), rel('partner', 12, R.partner), d('stress', -10), d('happiness', 8)] } },
      { label: L('"Bu ara özel antrenman yapacağım."', '"I’m doing private training this break."'), risk: 'medium', preview: [rel('partner', -8, R.partner, true), d('stamina', 1)], chance: 0.5,
        success: { text: L('Anlayışla karşılıyor. "Ama sonra mutlaka."', 'She understands. "But next time, for sure."'), deltas: [rel('partner', -2, R.partner), d('stamina', 1)] },
        fail: { text: L('Kapı çarpıyor. İki gün mesaj yok.', 'The door slams. Two days of silence.'), deltas: [rel('partner', -10, R.partner), d('stress', 8), d('stamina', 1)] } },
    ],
  },
  {
    id: 'rival_trash_talk', category: 'rival', title: L('Rakipten laf', 'Trash talk from a rival'),
    body: L('Derbi öncesi rakip stoper basına "Onu cebimden çıkarmam" dedi.', 'Before the derby, the rival centre-back told reporters: "He won’t get out of my pocket."'),
    choices: [
      { label: L('"Sahada konuşuruz."', '"We’ll talk on the pitch."'), risk: 'low', preview: [rel('fans', 4, R.fans), d('composure', 1)], chance: 0.9,
        success: { text: L('Sakin tavrın taraftarı coşturuyor.', 'Your calm response fires up the fans.'), deltas: [rel('fans', 5, R.fans), d('composure', 1)] },
        fail: { text: L('Pek kimse ilgilenmiyor.', 'Nobody really bites.'), deltas: [] } },
      { label: L('Sert cevap ver', 'Fire back hard'), risk: 'high', preview: [d('followers', 10000, true), d('discipline', -4, true)], chance: 0.4,
        success: { text: L('Cevabın efsane oldu; tribünler pankart hazırlıyor.', 'Your reply goes legendary; the stands are making banners.'), deltas: [d('followers', 15000), rel('fans', 8, R.fans)] },
        fail: { text: L('Federasyon "sportmenlik dışı" diye uyarı yolluyor.', 'The federation sends an "unsporting conduct" warning.'), deltas: [d('discipline', -6), d('managerTrust', -4)] } },
    ],
  },
  {
    id: 'charity_gala', category: 'charity', title: L('Yardım gecesi', 'Charity gala'),
    body: L('Bir vakıf, okul inşaatı için gala düzenliyor. Senden imzalı forma ve bağış bekleniyor.', 'A foundation is holding a gala to build a school. They’d love a signed shirt and a donation.'),
    choices: [
      { label: L('10.000 € bağışla', 'Donate €10,000'), risk: 'safe', requirement: { text: L('10.000 € nakit', '€10,000 cash'), check: (s) => s.life.money >= 10000 }, preview: [d('money', -10000), d('reputation', 4), d('happiness', 6)], chance: 1,
        success: { text: L('Okulun bir sınıfına adın verilecek.', 'A classroom will carry your name.'), deltas: [d('money', -10000), d('reputation', 4), d('happiness', 6), rel('fans', 5, R.fans)] } },
      { label: L('Sadece forma gönder', 'Just send a shirt'), risk: 'safe', preview: [d('reputation', 1)], chance: 1,
        success: { text: L('Forman açık artırmada 3.000 €’ya satıldı.', 'Your shirt fetches €3,000 at auction.'), deltas: [d('reputation', 1)] } },
    ],
  },
  {
    id: 'injury_scare', category: 'health', title: L('Arka adalede gerginlik', 'Tight hamstring'),
    body: L('Sprint sonrası arka adalende bir çekilme hissettin. Sağlık ekibi karar vermeni istiyor.', 'You felt a pull in your hamstring after a sprint. The medical team wants your call.'),
    choices: [
      { label: L('İki gün dinlen', 'Rest for two days'), risk: 'safe', preview: [d('sharpness', -5), d('health', 5)], chance: 1,
        success: { text: L('Adale toparlandı. Akıllıca.', 'The muscle settles. Smart.'), deltas: [d('sharpness', -5), d('health', 6), d('fatigue', -10)] } },
      { label: L('Ağrı kesiciyle devam et', 'Play through with painkillers'), risk: 'high', preview: [d('managerTrust', 3), d('health', -15, true)], chance: 0.55,
        success: { text: L('Bir şey olmadı… bu sefer.', 'Nothing happened… this time.'), deltas: [d('managerTrust', 3)] },
        fail: { text: L('Adale yırtıldı. Üç hafta yoksun.', 'The muscle tears. Three weeks out.'), deltas: [d('health', -20), d('happiness', -8), d('managerTrust', -2)] } },
    ],
  },
]

// ───────────────────────── Training ─────────────────────────
export const TRAINING: TrainingSessionView[] = [
  { id: 'finishing_drill', name: L('Bitiricilik', 'Finishing'), desc: L('Ceza sahası içinde tek vuruş.', 'One-touch finishes in the box.'), group: 'technical', icon: 'target', energy: 18, focus: ['finishing', 'composure'], xp: 45, xpMax: 68, injuryRisk: 'safe', available: true, drill: { kind: 'finishing', variant: 'standard' } },
  { id: 'passing_rondo', name: L('Rondo', 'Rondo'), desc: L('Dar alanda hızlı pas.', 'Quick passing in tight space.'), group: 'technical', icon: 'ball', energy: 14, focus: ['passing', 'firstTouch', 'vision'], xp: 35, xpMax: 52, injuryRisk: 'safe', available: true, drill: { kind: 'passing', variant: 'standard' } },
  { id: 'dribble_course', name: L('Dripling parkuru', 'Dribble course'), desc: L('Kukalar arası slalom.', 'Slalom through the cones.'), group: 'technical', icon: 'shuffle', energy: 16, focus: ['dribbling', 'agility'], xp: 40, xpMax: 60, injuryRisk: 'low', available: true, drill: { kind: 'dribbling', variant: 'standard' } },
  { id: 'set_piece', name: L('Duran top', 'Set pieces'), desc: L('Frikik ve korner kalıpları.', 'Free-kick and corner routines.'), group: 'technical', icon: 'flag', energy: 10, focus: ['setPieces', 'crossing'], xp: 40, xpMax: 60, injuryRisk: 'safe', available: true, drill: { kind: 'finishing', variant: 'setPiece' } },
  { id: 'sprints', name: L('Patlayıcı sprint', 'Explosive sprints'), desc: L('10 × 30 m maksimum hız.', '10 × 30 m flat out.'), group: 'physical', icon: 'run', energy: 24, focus: ['pace', 'agility'], xp: 35, xpMax: 52, injuryRisk: 'medium', available: true, drill: { kind: 'fitness', variant: 'standard' } },
  { id: 'weights', name: L('Kuvvet', 'Strength'), desc: L('Ağırlık ve plyometri.', 'Weights and plyometrics.'), group: 'physical', icon: 'barbell', energy: 22, focus: ['strength', 'jumping'], xp: 35, xpMax: 52, injuryRisk: 'low', available: true, drill: null },
  { id: 'endurance', name: L('Dayanıklılık', 'Endurance'), desc: L('Interval koşuları.', 'Interval runs.'), group: 'physical', icon: 'heartbeat', energy: 26, focus: ['stamina', 'workRate'], xp: 35, xpMax: 52, injuryRisk: 'low', available: true, drill: { kind: 'fitness', variant: 'standard' } },
  { id: 'crossing', name: L('Orta İstasyonu', 'Cross Station'), desc: L('Kanattan hedef bölgelere orta.', 'Wing crosses into target zones.'), group: 'technical', icon: 'crosshair', energy: 18, focus: ['crossing', 'passing'], xp: 35, xpMax: 52, injuryRisk: 'safe', available: true, drill: { kind: 'crossing', variant: 'standard' } },
  { id: 'heading', name: L('Kafa Topu Makinesi', 'Header Machine'), desc: L('Zıpla, kafayla kaleciyi geç.', 'Jump and head past the keeper.'), group: 'technical', icon: 'goal', energy: 20, focus: ['heading', 'jumping'], xp: 35, xpMax: 52, injuryRisk: 'low', available: true, drill: { kind: 'heading', variant: 'standard' } },
  { id: 'tackling', name: L('Top Kapma Düellosu', 'Tackle Duel'), desc: L('Bire bir: faulsüz top kap.', 'One-on-one: win it cleanly.'), group: 'technical', icon: 'shield', energy: 20, focus: ['tackling', 'positioning'], xp: 35, xpMax: 52, injuryRisk: 'medium', available: true, drill: { kind: 'tackling', variant: 'standard' } },
  { id: 'tactics', name: L('Taktik oturumu', 'Tactical session'), desc: L('Pres tetikleyicileri ve koşu yolları.', 'Pressing triggers and runs.'), group: 'tactical', icon: 'tactics', energy: 8, focus: ['positioning', 'vision', 'leadership'], xp: 30, xpMax: 45, injuryRisk: 'safe', available: true, drill: { kind: 'passing', variant: 'standard' } },
  { id: 'recovery', name: L('Toparlanma', 'Recovery'), desc: L('Havuz, esneme, buz banyosu.', 'Pool, stretching, ice bath.'), group: 'recovery', icon: 'bed', energy: -10, focus: [], xp: 0, xpMax: 0, injuryRisk: 'safe', available: true, drill: null },
]

type PerkSeed = Omit<PerkView, 'owned' | 'available'>
export const PERKS: PerkSeed[] = [
  { id: 'clinical', name: L('Plase Uzmanı', 'Placement Expert'), desc: L('Plase şutlarda isabet +%10.', 'Placed shots +10% accuracy.'), icon: 'target', row: 0, col: 0, requires: [], cost: 1 },
  { id: 'engine', name: L('Maraton', 'Marathon'), desc: L('Maç içi dayanıklılık kaybı −%15.', 'In-match stamina drain −15%.'), icon: 'heartbeat', row: 0, col: 1, requires: [], cost: 1 },
  { id: 'vision', name: L('Kartal Gözü', 'Eagle Eye'), desc: L('Ara pas hedefleri daha geniş.', 'Wider through-ball windows.'), icon: 'eye', row: 0, col: 2, requires: [], cost: 1 },
  { id: 'iron', name: L('Demir Adam', 'Iron Man'), desc: L('Sakatlık riski −%20.', 'Injury risk −20%.'), icon: 'shield', row: 0, col: 3, requires: [], cost: 1 },
  { id: 'finesse', name: L('Falso Ustası', 'Finesse Master'), desc: L('Kavisli şutlarda +%15 falso.', '+15% curl on finesse shots.'), icon: 'sparkle', row: 1, col: 0, requires: ['clinical'], cost: 2 },
  { id: 'sprinter', name: L('Rüzgâr', 'Whirlwind'), desc: L('Sprintte ilk adım daha hızlı.', 'Faster first step when sprinting.'), icon: 'run', row: 1, col: 1, requires: ['engine'], cost: 2 },
  { id: 'maestro', name: L('Maestro', 'Maestro'), desc: L('Uzun paslarda sapma −%20.', 'Long-pass error −20%.'), icon: 'music', row: 1, col: 2, requires: ['vision'], cost: 2 },
  { id: 'aerial', name: L('Hava Hakimi', 'Aerial Threat'), desc: L('Kafa toplarında +%15 güç.', '+15% header power.'), icon: 'chevron-up', row: 1, col: 3, requires: ['iron'], cost: 2 },
  { id: 'ice_pen', name: L('Penaltı Buz Adam', 'Ice-Cold Penalties'), desc: L('Penaltıda nişan titremez.', 'No aim shake on penalties.'), icon: 'snowflake', row: 2, col: 0, requires: ['finesse'], cost: 2 },
  { id: 'rabona', name: L('Rabona', 'Rabona'), desc: L('Yeni beceri hareketi açılır.', 'Unlocks the rabona skill move.'), icon: 'shuffle', row: 2, col: 1, requires: ['sprinter'], cost: 2 },
  { id: 'captain', name: L('Kaptan Ruhu', 'Captain’s Spirit'), desc: L('Takım arkadaşlarına moral +5.', '+5 morale to teammates.'), icon: 'crown', row: 2, col: 2, requires: ['maestro'], cost: 3 },
  { id: 'long_throw', name: L('Uzun Taç', 'Long Throw'), desc: L('Taç atışları ceza sahasına ulaşır.', 'Throw-ins reach the box.'), icon: 'arrow-right', row: 2, col: 3, requires: ['aerial'], cost: 1 },
  { id: 'big_game', name: L('Büyük Maç Oyuncusu', 'Big Game Player'), desc: L('Derbi ve finallerde tüm özellikler +3.', '+3 all attributes in derbies and finals.'), icon: 'trophy', row: 3, col: 0, requires: ['ice_pen'], cost: 3 },
  { id: 'elastico', name: L('Elastico', 'Elastico'), desc: L('Elastico çalımı açılır.', 'Unlocks the elastico.'), icon: 'sparkle', row: 3, col: 1, requires: ['rabona'], cost: 3 },
  { id: 'general', name: L('Saha Generali', 'Field General'), desc: L('Takım taktik uyumu +%10.', 'Team tactical cohesion +10%.'), icon: 'tactics', row: 3, col: 2, requires: ['captain'], cost: 3 },
  { id: 'wall', name: L('Beton Duvar', 'Concrete Wall'), desc: L('İkili mücadele kazanma +%10.', 'Duel success +10%.'), icon: 'shield-check', row: 3, col: 3, requires: ['long_throw'], cost: 3 },
]

export const TRAINERS: TrainerOffer[] = [
  { id: 'tr_finish', name: 'Hakan Tekin', group: 'technical' as AttributeGroup, quality: 4, weeklyFee: 2400, bonus: 0.3, current: false, available: true },
  { id: 'tr_phys', name: 'Marta Ruiz', group: 'physical', quality: 3, weeklyFee: 1500, bonus: 0.2, current: false, available: true },
  { id: 'tr_mind', name: 'Dr. Selin Aksoy', group: 'mental', quality: 5, weeklyFee: 3800, bonus: 0.4, current: false, available: true },
  { id: 'tr_cheap', name: 'Rıfat Usta', group: 'technical', quality: 2, weeklyFee: 600, bonus: 0.1, current: false, available: true },
]

// ───────────────────────── Assets ─────────────────────────
const A = (id: string, category: AssetDef['category'], tr: string, en: string, price: number, upkeep: number, happiness: number, fame: number, icon: string, resale: number, extra: Partial<AssetDef> = {}): AssetDef =>
  ({ id, category, name: { tr, en }, price, upkeep, happiness, fame, icon, resale, ...extra })

export const ASSETS: AssetDef[] = [
  A('flat_city', 'house', 'Şehir merkezinde 2+1', 'City-centre flat', 220000, 300, 3, 0, 'house', 0.95),
  A('villa_sea', 'house', 'Deniz manzaralı villa', 'Sea-view villa', 1450000, 1800, 8, 3, 'house', 1.05, { minReputation: 40 }),
  A('penthouse', 'house', 'Gökdelen çatı katı', 'Skyscraper penthouse', 3800000, 4200, 12, 6, 'building', 1.02, { minReputation: 60 }),
  A('hatch', 'car', 'Kompakt hatchback', 'Compact hatchback', 28000, 80, 1, 0, 'car', 0.6),
  A('suv', 'car', 'Lüks SUV', 'Luxury SUV', 145000, 350, 4, 1, 'car', 0.55),
  A('supercar', 'car', 'İtalyan süper otomobil', 'Italian supercar', 420000, 1100, 8, 4, 'car', 0.7, { minReputation: 45 }),
  A('classic', 'car', 'Klasik ’67 coupe', 'Classic ’67 coupé', 260000, 600, 6, 2, 'car', 1.1),
  A('watch_steel', 'watch', 'Çelik dalgıç saati', 'Steel diver watch', 9500, 0, 2, 0, 'watch', 0.85),
  A('watch_gold', 'watch', 'Altın kronograf', 'Gold chronograph', 48000, 0, 4, 1, 'watch', 0.9),
  A('watch_tourbillon', 'watch', 'Tourbillon koleksiyon saati', 'Tourbillon collector piece', 310000, 0, 7, 3, 'watch', 1.08, { minReputation: 55 }),
  A('sneakers', 'fashion', 'Sınırlı sayıda sneaker', 'Limited-edition sneakers', 2200, 0, 2, 0, 'hanger', 0.7),
  A('designer', 'fashion', 'Tasarımcı gardırobu', 'Designer wardrobe', 35000, 150, 5, 2, 'hanger', 0.3),
  A('console', 'tech', 'Oyun odası', 'Gaming room', 6500, 40, 4, 0, 'laptop', 0.4, { effect: { key: 'stress_relief', value: 3 } }),
  A('home_cinema', 'tech', 'Ev sineması', 'Home cinema', 22000, 60, 4, 0, 'laptop', 0.4),
  A('dog', 'pet', 'Golden retriever', 'Golden retriever', 2500, 90, 6, 0, 'paw', 0, { effect: { key: 'stress_relief', value: 4 } }),
  A('cat', 'pet', 'Van kedisi', 'Turkish Van cat', 1200, 50, 5, 0, 'paw', 0),
  A('speedboat', 'boat', 'Sürat teknesi', 'Speedboat', 180000, 900, 6, 2, 'boat', 0.6, { minReputation: 35 }),
  A('yacht', 'boat', '42 m süper yat', '42 m superyacht', 6500000, 18000, 14, 8, 'boat', 0.7, { minReputation: 75 }),
  A('jet_share', 'jet', 'Jet paylaşımı', 'Jet share', 900000, 6000, 5, 3, 'airplane', 0.5, { effect: { key: 'travel_fatigue', value: -10 }, minReputation: 55 }),
  A('jet_private', 'jet', 'Özel jet', 'Private jet', 12000000, 30000, 12, 10, 'airplane', 0.65, { effect: { key: 'travel_fatigue', value: -25 }, minReputation: 80 }),
  A('art_print', 'art', 'Genç sanatçı tuvali', 'Emerging artist canvas', 15000, 0, 2, 0, 'palette', 1.25),
  A('art_master', 'art', 'Modern usta tablosu', 'Modern master painting', 950000, 500, 6, 4, 'palette', 1.4, { minReputation: 50 }),
  A('island', 'island', 'Ege’de özel ada', 'Private Aegean island', 25000000, 40000, 18, 15, 'palm', 1.1, { minReputation: 90 }),
  A('cafe', 'business', 'Mahalle kafesi', 'Neighbourhood café', 120000, 0, 3, 1, 'storefront', 0.8, { effect: { key: 'weekly_income', value: 900 } }),
  A('gym_biz', 'business', 'Fitness salonu', 'Fitness studio', 480000, 0, 3, 2, 'barbell', 0.85, { effect: { key: 'weekly_income', value: 3200 } }),
  A('clothing', 'business', 'Kendi giyim markan', 'Your own clothing line', 900000, 0, 6, 5, 'hanger', 0.7, { effect: { key: 'weekly_income', value: 6500 }, minReputation: 45 }),
  A('home_gym', 'facility', 'Ev spor salonu', 'Home gym', 30000, 100, 2, 0, 'barbell', 0.5, { effect: { key: 'training_xp', value: 10 } }),
  A('pool', 'facility', 'Rehabilitasyon havuzu', 'Rehab pool', 85000, 300, 3, 0, 'heartbeat', 0.6, { effect: { key: 'recovery', value: 15 } }),
  A('cryo_room', 'facility', 'Kriyoterapi odası', 'Cryotherapy chamber', 160000, 450, 2, 1, 'snowflake', 0.6, { effect: { key: 'injury_time', value: -20 }, minReputation: 30 }),
  A('mini_pitch', 'facility', 'Bahçede mini saha', 'Back-garden mini pitch', 60000, 200, 4, 1, 'pitch', 0.7, { effect: { key: 'training_xp', value: 5 } }),
]

export const SPONSOR_OFFERS: SponsorDeal[] = [
  { id: 'sp_boots', brand: 'Volta Boots', category: 'boots', weekly: 3500, untilSeason: 2028, minReputation: 30 },
  { id: 'sp_gaming', brand: 'PixelForge', category: 'gaming', weekly: 2200, untilSeason: 2027, minReputation: 25 },
  { id: 'sp_watch', brand: 'Chronica', category: 'watch', weekly: 6000, untilSeason: 2029, minReputation: 55 },
  { id: 'sp_car', brand: 'Aurelis Motors', category: 'car', weekly: 9000, untilSeason: 2029, minReputation: 70 },
]

export const HORSE_NAMES = ['Kara Şimşek', 'Rüzgârın Oğlu', 'Gece Yarısı', 'Altın Toz', 'Boğaz Fırtınası', 'Mavi Yolcu', 'Sultan Bey', 'Son Düdük']
export const HORSE_COLORS = ['#ff4d5e', '#3da5ff', '#ffc83d', '#1fd47a', '#8e5cff', '#ff8a3d', '#3de0e0', '#f2f5fa']
