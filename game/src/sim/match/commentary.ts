/**
 * Bilingual (TR/EN) match commentary.
 *
 * Templates use `{var}` placeholders. In Turkish, `{var:gen|dat|acc|loc|abl|ins}`
 * attaches a vowel-harmonized case suffix via {@link trSuffix}
 * ("{player:gen} şutu" → "Arda'nın şutu"). In English, `{var:gen}` renders the
 * possessive "'s" and the other cases render the bare name, so the same keys can
 * be used safely in both languages.
 */
import type { Gender, Lang } from '../../core/types'
import type { Rng } from '../../core/rng'
import { trSuffix, type TrCase } from './turkish'

export { trSuffix, trSuffixOnly, type TrCase } from './turkish'

/** Variables available to commentary templates. */
export interface CommentaryVars {
  player?: string
  assist?: string
  team?: string
  opp?: string
  gk?: string
  hero?: string
  passer?: string
  score?: string
  minute?: string | number
  out?: string
}

type Bank = Record<Lang, readonly string[]>

/** Every commentary situation the engine can narrate. */
export type CommentaryKey = keyof typeof LINES

const LINES = {
  kickoff: {
    tr: [
      'Hakemin düdüğüyle maç başladı! {team} ile {opp} karşı karşıya.',
      'Ve top yuvarlanıyor! {team} - {opp} mücadelesi başladı.',
      'Santra yapıldı, {team} ile {opp} arasındaki 90 dakika başlıyor.',
      'Tribünler dolu, atmosfer müthiş. Ve maç başladı!',
    ],
    en: [
      'The referee blows the whistle and we are under way! {team} against {opp}.',
      'And we are off! {team} versus {opp} has begun.',
      'Kick-off! Ninety minutes between {team} and {opp} start now.',
      'A packed stadium, a superb atmosphere — and the match is under way!',
    ],
  },
  goal: {
    tr: [
      'GOOOL! {player} ağları sarstı! {score}',
      'GOL! {player} kaleciyi avlıyor! Skor {score}.',
      '{player} affetmedi! Top ağlarda! {score}',
      'Muhteşem bitiriş! {player} topu köşeye yerleştirdi. {score}',
      'Kale önünde soğukkanlı! {player} skoru {score} yapıyor.',
      'Ve top ağlarda! Atan {player}! {score}',
      'Gol! {team} adına {player} sahnede! {score}',
      'Kalecinin yapabileceği bir şey yoktu! {player} ve gol! {score}',
      '{player} sert vurdu, top filelerle buluştu! {score}',
      'İnanılmaz! {player} harika bir golle tribünleri ayağa kaldırdı! {score}',
      'Kafa vuruşu ve GOL! {player} havada süzüldü! {score}',
      'Plase ve gol! {player} kaleciyi ters köşeye yatırdı. {score}',
      'İşte bu! {player} ceza sahasında fırsatı değerlendirdi! {score}',
      '{team} taraftarı coştu! {player} skoru değiştiriyor: {score}',
      'Ne bitiriş! {player} topu üst köşeye astı! {score}',
    ],
    en: [
      'GOOOAL! {player} finds the back of the net! {score}',
      'GOAL! {player} beats the keeper! It is {score}.',
      '{player} makes no mistake! In it goes! {score}',
      'Superb finish! {player} slots it into the corner. {score}',
      'Ice cold in front of goal! {player} makes it {score}.',
      'And it is in! The scorer is {player}! {score}',
      'Goal! {player} delivers for {team}! {score}',
      'The keeper had no chance! {player} scores! {score}',
      '{player} lashes it and the net bulges! {score}',
      'Incredible! {player} brings the crowd to its feet! {score}',
      'A header and a GOAL! {player} rises highest! {score}',
      'Placed and in! {player} sends the keeper the wrong way. {score}',
      'There it is! {player} pounces in the box! {score}',
      'The {team} fans erupt! {player} changes the scoreline: {score}',
      'What a finish! {player} hangs it in the top corner! {score}',
    ],
  },
  goalAssist: {
    tr: [
      'GOOOL! {assist:gen} pasında {player} ağları buldu! {score}',
      '{assist} çok iyi gördü, {player} bitirdi! {score}',
      'GOOOL! {assist} pası verdi, {player} gerisini getirdi. {score}',
      'Harika paslaşma! {assist} ara pası attı, {player} vurdu: GOL! {score}',
      '{assist} ortaladı, {player} tamamladı! {score}',
      'Asist {assist}, gol {player}! {score}',
      '{assist} ile {player} arasındaki uyum gol getirdi! {score}',
      '{assist} topu tabağa koydu, {player} affetmedi! {score}',
    ],
    en: [
      'GOOOAL! {assist} starts it, {player} finishes it! {score}',
      '{assist} spots the run and {player} buries it! {score}',
      'GOOOAL! {assist} with the pass, {player} with the rest. {score}',
      'Lovely move! {assist} slides it through, {player} strikes: GOAL! {score}',
      '{assist} crosses, {player} converts! {score}',
      'The assist from {assist}, the goal from {player}! {score}',
      'A great understanding between {assist} and {player} pays off! {score}',
      '{assist} serves it on a plate and {player} does the rest! {score}',
    ],
  },
  penaltyGoal: {
    tr: [
      'Penaltıda {player} hata yapmıyor! {score}',
      '{player} topu bir köşeye, kaleciyi diğerine gönderdi! {score}',
      'Soğukkanlı vuruş! {player} penaltıyı gole çevirdi. {score}',
      'Penaltı golü! {player} sorumluluğu aldı ve başardı. {score}',
      '{player} beyaz noktadan affetmiyor! {score}',
      'Kaleci doğru köşeye uzandı ama yetmedi! {player} attı. {score}',
      'Penaltı... ve GOL! {player} sahnede! {score}',
      '{player} sert ve köşeye! Penaltıdan gol! {score}',
    ],
    en: [
      '{player} makes no mistake from the spot! {score}',
      '{player} sends the keeper one way and the ball the other! {score}',
      'Calm as you like! {player} converts the penalty. {score}',
      'Penalty scored! {player} steps up and delivers. {score}',
      '{player} is clinical from twelve yards! {score}',
      'The keeper guessed right but it was not enough! {player} scores. {score}',
      'Penalty... and GOAL! {player} with the finish! {score}',
      '{player} goes hard and low! Penalty converted! {score}',
    ],
  },
  ownGoal: {
    tr: [
      'Kendi kalesine! {player} talihsiz bir dokunuşla topu ağlara gönderdi. {score}',
      'Eyvah! {player} uzaklaştırmak isterken kendi kalesine attı. {score}',
      'Kendi kalesine gol! {player} için kabus gibi bir an. {score}',
      'Top {player:abl} sekip ağlara gitti! Kendi kalesine gol. {score}',
      'Talihsizlik! {player} topu kendi filelerine yolladı. {score}',
      'Kaleci şaşkın! {player} kendi kalesine gol attı. {score}',
      '{opp} bu golü hediye olarak kabul ediyor, {player} kendi kalesine. {score}',
      'Kendi ağlarına! {player} yere bakıyor. {score}',
    ],
    en: [
      'Own goal! {player} turns it into {g:his|her} own net. {score}',
      'Oh no! {player} tries to clear but puts it past {g:his|her} own keeper. {score}',
      'An own goal! A nightmare moment for {player}. {score}',
      'It deflects off {player} and in! Own goal. {score}',
      'Unlucky! {player} diverts it into {g:his|her} own net. {score}',
      'The keeper is stunned! {player} scores an own goal. {score}',
      '{opp} gratefully accept a gift from {player}. {score}',
      'Into {g:his|her} own net! {player} cannot believe it. {score}',
    ],
  },
  save: {
    tr: [
      'Kaleci {gk} harika bir kurtarışla geçit vermiyor! {player} şaşkın.',
      '{player} vurdu, {gk} uzandı ve çeldi!',
      'Muhteşem refleks! {gk}, {player:gen} şutunu kurtardı.',
      '{gk} yerinde! {player} şutunu kolayca kontrol etti.',
      'Gol olacaktı! {gk} parmak uçlarıyla topu kornere çeldi.',
      '{player} kaleyi buldu ama {gk} sağlam.',
      'Ne kurtarış! {gk} sanki duvar gibi!',
      '{player} sert vurdu, {gk} iki hamlede topu kontrol etti.',
      '{gk} çıkışını iyi yaptı, açıyı kapattı ve kurtardı!',
      'Şut çerçevede ama {gk} geçit vermiyor.',
    ],
    en: [
      '{gk} with a brilliant save to deny {player}!',
      '{player} shoots, {gk} dives and pushes it away!',
      'Stunning reflexes! {gk} keeps out {player}.',
      'Comfortable for {gk}, who gathers the effort from {player}.',
      'That was in! {gk} tips it round the post with {g:his|her} fingertips.',
      '{player} hits the target but {gk} is equal to it.',
      'What a save! {gk} is a brick wall today!',
      '{player} drives it, {gk} spills then gathers at the second attempt.',
      '{gk} comes off {g:his|her} line, narrows the angle and saves!',
      'On target, but {gk} says no.',
    ],
  },
  miss: {
    tr: [
      '{player} vurdu ama top az farkla auta gitti.',
      'Fırsat kaçtı! {player} topu kalenin üstünden gönderdi.',
      '{player} denedi, top direğin yanından dışarıda.',
      'Ne kaçırdı! {player} boş kaleye atamadı!',
      '{player} gelişine vurdu, top tribünlere gitti.',
      'Çok iddialı bir deneme {player} oyuncusundan, ama isabet yok.',
      '{player} plase denedi, top az farkla yandan auta çıktı.',
      'Bu pozisyon gol olmalıydı! {player} başını ellerinin arasına aldı.',
      'Uzaktan deneme, {player} çerçeveyi bulamadı.',
      '{player} kafayı vurdu ama top üstten auta gitti.',
    ],
    en: [
      '{player} shoots but it drifts just wide.',
      'Chance gone! {player} blazes it over the bar.',
      '{player} tries {g:his|her} luck, past the post.',
      'What a miss! {player} somehow fails to score!',
      '{player} hits it first time and it flies into the stands.',
      'Ambitious from {player}, but nowhere near the target.',
      '{player} tries to place it, it rolls inches wide.',
      'That had to be a goal! {player} holds {g:his|her} head in {g:his|her} hands.',
      'A long-range effort, {player} cannot find the frame.',
      '{player} gets {g:his|her} head to it but it loops over.',
    ],
  },
  blocked: {
    tr: [
      '{player} vurdu, savunma bloke etti.',
      'Şut savunmaya çarptı! {player} şanssız.',
      '{player} kaleyi yokladı ama top bir savunmacıya takıldı.',
      'Cesur blok! {player:gen} şutu barajda kaldı.',
      'Savunma son anda ayak koydu, {player} gol sevincini yaşayamadı.',
      '{player} denedi, top bacaklara çarpıp döndü.',
      'Bloke edildi! {opp} savunması kenetlendi.',
      '{player} şut çekti ama vücutlar önündeydi.',
    ],
    en: [
      '{player} shoots, it is blocked.',
      'Blocked! Unlucky for {player}.',
      '{player} tests the keeper but it hits a defender.',
      'Brave block! The effort from {player} is charged down.',
      'A last-ditch leg denies {player}.',
      '{player} tries, it ricochets off a body.',
      'Blocked! The {opp} defence stands firm.',
      '{player} shoots but there are bodies in the way.',
    ],
  },
  woodwork: {
    tr: [
      'DİREK! {player:gen} şutu direkten döndü!',
      'Üst direk! {player} golü kıl payı kaçırdı!',
      'Top direği yaladı! {player} inanamıyor!',
      'Tahta yine engel! {player} şanssız.',
      'Ve direk! {player} çok yaklaştı!',
      'Direğe çarptı! {gk} şanslı.',
      '{player} vurdu, direk dedi ki "hayır"!',
      'Kale direkleri {team} takımına karşı! {player} direği buldu.',
    ],
    en: [
      'POST! The shot from {player} comes back off the woodwork!',
      'Off the bar! {player} so close!',
      'It kisses the post! {player} cannot believe it!',
      'The woodwork denies {player} again.',
      'And it hits the post! So close from {player}!',
      'Off the frame! {gk} is a {g:lucky man|lucky woman}.',
      '{player} strikes it and the post says no!',
      'The woodwork is against {team}! {player} hits the post.',
    ],
  },
  chance: {
    tr: [
      '{team} hızlı bir atak geliştiriyor, {player} topla.',
      '{player} ceza sahasına sokuluyor...',
      'Tehlikeli bir an! {player} pozisyona giriyor.',
      '{team} baskı kuruyor, {player} kale arıyor.',
      '{player} rakibinden sıyrılıp kaleye yöneldi.',
      '{passer} ara pasını verdi, {player} koşuda!',
      '{team} ön alanda kalabalık, {player} fırsat kolluyor.',
      '{player} kanattan içeri kat ediyor...',
      'İyi bir pas trafiği {team} takımından, top {player} oyuncusunda.',
      '{player} topla buluştu, önü açık!',
    ],
    en: [
      '{team} break quickly, {player} on the ball.',
      '{player} drives into the box...',
      'Dangerous moment! {player} finds space.',
      '{team} turn the screw, {player} looking for a shot.',
      '{player} shrugs off {g:his|her} marker and heads for goal.',
      '{passer} threads it through, {player} is in!',
      '{team} commit numbers forward, {player} waiting for the chance.',
      '{player} cuts inside from the flank...',
      'Neat passing from {team}, the ball finds {player}.',
      '{player} collects it with space ahead!',
    ],
  },
  corner: {
    tr: [
      '{team} korner kazandı.',
      'Korner! {team} için bir set fırsatı.',
      'Top kornere çıktı, {team} kalabalık bir şekilde ceza sahasında.',
      '{player} kullanacak, korner atışı {team} lehine.',
      'Bir korner daha {team} takımına.',
      'Savunma topu kornere atarak rahatladı.',
      'Korner {team} için, uzun boylular öne çıkıyor.',
      '{team} köşe vuruşu kullanacak.',
    ],
    en: [
      'Corner to {team}.',
      'Corner! A set-piece opportunity for {team}.',
      'Out for a corner, {team} pile bodies into the box.',
      '{player} will take it, corner for {team}.',
      'Another corner for {team}.',
      'The defence clears it behind for a corner.',
      'Corner for {team}, the {g:big men|tall players} go forward.',
      '{team} to take a corner kick.',
    ],
  },
  cornerHeader: {
    tr: [
      'Korner ortası... {player} kafayı vurdu!',
      'Köşe vuruşu geldi, {player} yükseldi!',
      '{player} ortaya kafa vurdu!',
      'Kornerden gelen topa {player} hareketlendi!',
      'Ortaya {player} çıktı!',
      'Arka direkte {player} kafayla buluştu!',
      'Korner ve {player} havalandı!',
      '{player} ön direkte topa dokundu!',
    ],
    en: [
      'Corner swung in... {player} gets a head on it!',
      'Here comes the delivery, {player} rises!',
      '{player} meets the cross with a header!',
      '{player} attacks the corner!',
      '{player} is first to it!',
      '{player} arrives at the back post!',
      'The corner, and {player} climbs highest!',
      '{player} flicks it at the near post!',
    ],
  },
  freekick: {
    tr: [
      '{team} tehlikeli bölgede serbest vuruş kazandı.',
      'Faul! {team} lehine serbest vuruş, ceza sahası yakınında.',
      '{player} yerde kaldı, hakem serbest vuruşu gösterdi.',
      'Serbest vuruş {team} için, baraj kuruluyor.',
      'İyi bir pozisyondan serbest vuruş kazanıldı.',
      'Hakem faulü verdi, {team} için duran top.',
      'Kaleye yakın bir serbest vuruş! {player} topun başında.',
      'Tehlikeli bölgede faul, {opp} itiraz ediyor.',
    ],
    en: [
      '{team} win a free kick in a dangerous area.',
      'Foul! Free kick to {team}, just outside the box.',
      '{player} goes down and the referee blows for a free kick.',
      'Free kick to {team}, the wall is lining up.',
      'A free kick from a promising position.',
      'The referee awards the foul, a set piece for {team}.',
      'Free kick within range! {player} stands over it.',
      'Foul in a dangerous area, {opp} protest.',
    ],
  },
  penaltyAwarded: {
    tr: [
      'PENALTI! Hakem beyaz noktayı gösterdi!',
      'Penaltı! {player} ceza sahasında düşürüldü!',
      'Hakem tereddüt etmedi: penaltı {team} lehine!',
      'Ceza sahasında faul! Penaltı!',
      'Penaltı kararı! {opp} oyuncuları itiraz ediyor.',
      'Ve penaltı! {team} büyük bir fırsat yakaladı.',
      'Penaltı noktası işaret edildi! {player} yerde.',
      'Bu net bir penaltı! {team} için altın fırsat.',
    ],
    en: [
      'PENALTY! The referee points to the spot!',
      'Penalty! {player} is brought down in the box!',
      'No hesitation from the referee: penalty to {team}!',
      'Foul in the area! Penalty!',
      'Penalty given! The {opp} players are furious.',
      'And it is a penalty! A huge chance for {team}.',
      'The referee points to the spot! {player} is down.',
      'That is a stonewall penalty! Golden chance for {team}.',
    ],
  },
  penaltyMiss: {
    tr: [
      'KURTARDI! {gk} penaltıda {player} karşısında kahraman!',
      '{player} penaltıyı kaçırdı! Top auta gitti!',
      'Penaltı direkte! {player} inanamıyor!',
      '{gk} doğru köşeye uzandı ve penaltıyı kurtardı!',
      '{player} üstten auta gönderdi! Penaltı kaçtı!',
      'Ne kurtarış! {gk} penaltıyı çeldi!',
      '{player} penaltıda yanıldı, top kalenin yanından dışarıda.',
      'Penaltı kurtarıldı! {gk} tribünleri coşturdu!',
    ],
    en: [
      'SAVED! {gk} is the hero against {player} from the spot!',
      '{player} misses the penalty! Wide!',
      'Penalty hits the post! {player} cannot believe it!',
      '{gk} guesses right and saves the penalty!',
      '{player} blazes it over! Penalty missed!',
      'What a save! {gk} keeps out the penalty!',
      '{player} gets it wrong, the penalty goes wide.',
      'Penalty saved! {gk} sends the fans wild!',
    ],
  },
  offside: {
    tr: [
      'Ofsayt! {player} erken çıktı.',
      'Yan hakem bayrağı kaldırdı, {player} ofsaytta.',
      '{player} ofsayt çizgisinin gerisinde kalamadı.',
      'Ofsayt bayrağı! {team} atağı sonuçsuz.',
      '{opp} ofsayt tuzağı işe yaradı.',
      'Ofsayt! {player} itiraz ediyor ama karar değişmiyor.',
      '{player} kaleciyle karşı karşıya kalmıştı ama ofsayt.',
      'Bayrak havada! Ofsayt pozisyonu.',
    ],
    en: [
      'Offside! {player} went too early.',
      'Up goes the flag, {player} is offside.',
      '{player} strays beyond the last defender.',
      'Flag up! The {team} attack breaks down.',
      'The {opp} offside trap works.',
      'Offside! {player} protests but the decision stands.',
      '{player} was through on goal, but offside.',
      'The flag is up! Offside.',
    ],
  },
  yellow: {
    tr: [
      'Sarı kart! {player} sert bir müdahalenin bedelini ödüyor.',
      'Hakem {player:dat} sarı kartını gösterdi.',
      '{player} geç kaldı ve sarı kartı gördü.',
      'Taktik faul, sarı kart: {player}.',
      'İtiraz eden {player} sarı kartla cezalandırıldı.',
      '{player} rakibini formasından çekti, sarı kart.',
      'Kart! {player} kitapçığa yazıldı.',
      'Sarı kart {player} için, bundan sonra dikkatli olmalı.',
      'Hakem cebine uzandı: {player} sarı kart gördü.',
    ],
    en: [
      'Yellow card! {player} pays for a reckless challenge.',
      'The referee shows {player} a yellow card.',
      '{player} arrives late and is booked.',
      'Cynical foul, yellow card: {player}.',
      '{player} is booked for dissent.',
      '{player} pulls back {g:his man|her opponent} by the shirt, yellow.',
      'Card! {player} goes into the book.',
      'Yellow for {player}, {g:he|she} must be careful now.',
      'The referee reaches for his pocket: {player} is booked.',
    ],
  },
  secondYellow: {
    tr: [
      'İkinci sarıdan kırmızı! {player} oyundan atıldı!',
      '{player} ikinci sarıyı gördü ve soyunma odasına gidiyor!',
      'Hakem affetmedi: ikinci sarı, kırmızı kart, {player} dışarıda!',
      '{team} 10 kişi kaldı! {player} ikinci sarıyla atıldı.',
      'Gereksiz bir faul ve {player} ikinci sarıdan oyun dışı.',
      '{player} için maç bitti, ikinci sarı kart!',
      'İkinci sarı! {player} takımını zor durumda bıraktı.',
      'Kırmızı! {player} zaten sarı kartlıydı.',
    ],
    en: [
      'Second yellow, red card! {player} is sent off!',
      '{player} sees a second yellow and walks!',
      'No mercy: second yellow, red card, {player} is off!',
      '{team} down to ten! {player} sent off for a second booking.',
      'An unnecessary foul and {player} is gone on a second yellow.',
      'The match is over for {player}, second yellow!',
      'Second yellow! {player} leaves {g:his|her} team in trouble.',
      'Red! {player} was already on a yellow.',
    ],
  },
  red: {
    tr: [
      'DİREKT KIRMIZI! {player} oyundan atıldı!',
      'Kırmızı kart! {player} çok sert girdi!',
      'Hakem kırmızıyı çıkardı! {team} 10 kişi!',
      '{player} son adam faulü yaptı, kırmızı kart!',
      'Ne yaptı {player}? Kırmızı kartla oyun dışı!',
      'Kırmızı! {player} tehlikeli müdahale nedeniyle atıldı.',
      '{player} kırmızı kartla soyunma odasının yolunu tuttu.',
      'Şok kırmızı kart! {player} dışarıda, {team} zor durumda.',
    ],
    en: [
      'STRAIGHT RED! {player} is sent off!',
      'Red card! {player} went in far too hard!',
      'The referee shows red! {team} down to ten!',
      '{player} commits a last-man foul, red card!',
      'What was {player} thinking? Sent off!',
      'Red! {player} dismissed for a dangerous tackle.',
      '{player} trudges off after a red card.',
      'Shock red card! {player} is off, {team} in trouble.',
    ],
  },
  injury: {
    tr: [
      '{player} yerde, sağlık ekibi sahada.',
      'Kötü haber {team} için: {player} sakatlandı.',
      '{player} sakatlık geçirdi, devam edemeyecek gibi.',
      '{player} topallıyor, kenara işaret ediyor.',
      'Sağlıkçılar {player} ile ilgileniyor, endişeli bir an.',
      '{player} hamstringini tutuyor, sakatlık var.',
      'Sert bir çarpışma, {player} yerden kalkamıyor.',
      '{player} sedyeyle oyundan çıkıyor.',
    ],
    en: [
      '{player} is down, the physios are on.',
      'Bad news for {team}: {player} is injured.',
      '{player} picks up a knock and looks unable to continue.',
      '{player} is limping and signalling to the bench.',
      'The medics attend to {player}, a worrying moment.',
      '{player} is clutching {g:his|her} hamstring.',
      'A heavy collision and {player} cannot get up.',
      '{player} leaves the field on a stretcher.',
    ],
  },
  sub: {
    tr: [
      'Oyuncu değişikliği {team} takımında: {player} oyunda, {out} kenara geliyor.',
      '{out} çıkıyor, yerine {player} giriyor.',
      '{team} hamle yaptı: {player} oyuna dahil oluyor, {out} dinlenmeye.',
      'Taze kan: {player} sahada, {out} alkışlarla çıkıyor.',
      'Değişiklik: {out} yerini {player:dat} bırakıyor.',
      'Teknik direktör {player} ile oyuna müdahale ediyor, {out} çıkıyor.',
      '{player} ısınmayı bitirdi ve oyunda; {out} kenarda.',
      '{team} değişikliği: {out} out, {player} in.',
    ],
    en: [
      'Substitution for {team}: {player} comes on for {out}.',
      '{out} makes way for {player}.',
      '{team} make a change: {player} on, {out} off.',
      'Fresh legs: {player} replaces {out}, who gets a warm round of applause.',
      'Change: {out} is replaced by {player}.',
      'The manager turns to {player}, {out} comes off.',
      '{player} is on after warming up; {out} heads to the bench.',
      '{team} substitution: {out} out, {player} in.',
    ],
  },
  heroSubOn: {
    tr: [
      'Ve beklenen an! {hero} ısınmayı bitirdi, oyuna giriyor!',
      'Teknik direktör {hero} ile oyuna müdahale ediyor! {out} çıkıyor.',
      '{hero} sahada! Taraftarlar alkışlarla karşılıyor.',
      'Değişiklik: {out} yerine {hero}! Şimdi fark yaratma zamanı.',
      '{hero} kenardan oyuna dahil oluyor, {out} dinlenmeye.',
      'Sıra sende {hero}! Oyuna giriyorsun.',
      'Hoca işaret etti, {hero} oyunda!',
      '{hero} forma giyiyor! {out} kenara geliyor.',
    ],
    en: [
      'Here we go! {hero} has finished warming up and is coming on!',
      'The manager turns to {hero}! {out} makes way.',
      '{hero} is on! The fans greet {g:him|her} with applause.',
      'Change: {hero} replaces {out}. Time to make a difference.',
      '{hero} comes off the bench, {out} goes off.',
      'Your turn, {hero}! You are coming on.',
      'The manager gives the nod, {hero} is on!',
      '{hero} enters the fray! {out} heads to the bench.',
    ],
  },
  heroSubOff: {
    tr: [
      '{hero} oyundan alınıyor, yerine {player} giriyor.',
      'Teknik direktör {hero} ile ilgili kararını verdi: değişiklik.',
      '{hero} kenara geliyor, {player} oyunda.',
      '{hero} için bugünlük bu kadar. Yerine {player}.',
      '{hero} başı önde kenara yürüyor, {player} giriyor.',
      'Hoca {hero:acc} çekiyor, {player} oyunda.',
      'Değişiklik: {hero} out, {player} in.',
      '{hero} soyunma odasına, {player} sahaya.',
    ],
    en: [
      '{hero} is taken off, {player} replaces {g:him|her}.',
      'The manager has made up his mind about {hero}: substitution.',
      '{hero} comes off, {player} goes on.',
      'That is it for {hero} today. {player} comes on.',
      '{hero} trudges off, {player} is on.',
      'The manager hooks {hero}, {player} is on.',
      'Change: {hero} out, {player} in.',
      '{hero} heads down the tunnel, {player} takes the field.',
    ],
  },
  heroIgnored: {
    tr: [
      '{passer} pası {hero} yerine başka bir arkadaşına verdi. Aralarında soğukluk var gibi.',
      '{hero} koşuyu yaptı ama {passer} görmezden geldi!',
      '{hero} boşta pas istiyor, {passer} kendi denemeyi tercih etti.',
      '{passer} bir kez daha {hero:acc} görmüyor... İlişki kötü.',
      '{hero} kolunu kaldırdı, {passer} başka tarafa çevirdi.',
      'Bu iki oyuncu anlaşamıyor: {passer}, {hero} yerine riskli pası seçti.',
      '{hero} çok iyi pozisyondaydı, {passer} oralı olmadı.',
      '{passer} ile {hero} arasında kopukluk; pas yine gelmedi.',
    ],
    en: [
      '{passer} picks out someone else instead of {hero}. There seems to be some friction.',
      '{hero} makes the run but {passer} ignores it!',
      '{hero} is screaming for it, {passer} goes alone instead.',
      '{passer} once again does not look for {hero}... the relationship is poor.',
      '{hero} raises an arm, {passer} turns the other way.',
      'These two are not clicking: {passer} chooses a risky pass over {hero}.',
      '{hero} was in a great position, {passer} did not want to know.',
      'Disconnect between {passer} and {hero}; the pass never comes.',
    ],
  },
  highlight: {
    tr: [
      'Top {hero:loc}! Senin anın!',
      'Pozisyon {hero} için geliyor...',
      '{hero} oyunun içinde, şimdi ne yapacak?',
      'İşte fırsat! {hero} devrede.',
      'Gözler {hero} üzerinde!',
      '{hero} kritik bir anda sahnede!',
      'Kontrol sende {hero}!',
      'Tribünler nefesini tuttu, {hero} topla buluşuyor...',
    ],
    en: [
      'The ball is with {hero}! This is your moment!',
      'Here comes a chance for {hero}...',
      '{hero} is involved, what will {g:he|she} do?',
      'Here it is! {hero} gets involved.',
      'All eyes on {hero}!',
      '{hero} steps up at a crucial moment!',
      'Over to you, {hero}!',
      'The crowd holds its breath as {hero} gets on the ball...',
    ],
  },
  heroPass: {
    tr: [
      'Akıllı bir pas {hero:gen} ayağından, atak devam ediyor.',
      '{hero} topu iyi dağıttı.',
      '{hero} oyunu güzel yönlendirdi.',
      'Temiz bir oyun {hero} oyuncusundan.',
      '{hero} topu kaptırmadı ve pasını verdi.',
      'İyi oyun okuması, {hero} topu doğru adrese gönderdi.',
      '{hero} baskı altında sakin kaldı.',
      '{hero} ile tempo yükseliyor.',
    ],
    en: [
      'A clever pass from {hero}, the move goes on.',
      '{hero} distributes it well.',
      '{hero} keeps things ticking.',
      'Tidy work from {hero}.',
      '{hero} keeps possession and finds a teammate.',
      'Good awareness, {hero} picks the right option.',
      '{hero} stays calm under pressure.',
      '{hero} raises the tempo.',
    ],
  },
  heroLostBall: {
    tr: [
      '{hero} topu kaptırdı.',
      'Top kaybı {hero:abl}, {opp} kontra atakta.',
      '{hero} fazla oyalandı ve topu kaybetti.',
      'Kötü bir dokunuş, {hero} topu kaçırdı.',
      '{hero} pası isabetsiz, top rakipte.',
      '{opp} savunması {hero:acc} durdurdu.',
      '{hero} sıkıştı ve topu kaptırdı.',
      'Bu sefer olmadı, {hero} topu kaybetti.',
    ],
    en: [
      '{hero} is dispossessed.',
      'Loose from {hero}, {opp} break.',
      '{hero} dwells on it and loses the ball.',
      'A heavy touch, {hero} lets it get away.',
      'A wayward pass from {hero}, it is the opposition’s ball.',
      'The {opp} defence shuts down {hero}.',
      '{hero} gets crowded out and loses it.',
      'Not this time, {hero} gives the ball away.',
    ],
  },
  heroDefended: {
    tr: [
      'Harika müdahale! {hero} topu temiz şekilde aldı.',
      '{hero} atağı durdurdu!',
      '{hero} son anda araya girdi!',
      'Kritik savunma {hero:abl}!',
      '{hero} rakibini geçirmedi.',
      'Mükemmel zamanlama, {hero} topu kaptı.',
      '{hero} tehlikeyi uzaklaştırdı.',
      'Duvar gibi! {hero} pozisyonu bitirdi.',
    ],
    en: [
      'Superb tackle! {hero} wins it cleanly.',
      '{hero} snuffs out the attack!',
      '{hero} intercepts at the last moment!',
      'Crucial defending from {hero}!',
      '{hero} does not let {g:his man|her opponent} past.',
      'Perfect timing, {hero} wins the ball.',
      '{hero} clears the danger.',
      'Like a wall! {hero} ends the threat.',
    ],
  },
  heroGkSave: {
    tr: [
      'HARİKA KURTARIŞ! {hero} kalesinde devleşiyor!',
      '{hero} uzandı ve topu çeldi!',
      'Refleks! {hero} golü önledi!',
      '{hero} birebirde kazandı!',
      'Ne kurtarış {hero}! Tribünler ayakta!',
      '{hero} topu güvenle kontrol etti.',
      '{hero} köşeye uçtu ve kurtardı!',
      '{hero} kalesini kapattı!',
    ],
    en: [
      'BRILLIANT SAVE! {hero} is unbeatable!',
      '{hero} stretches and turns it away!',
      'Reflexes! {hero} denies a goal!',
      '{hero} wins the one-on-one!',
      'What a save from {hero}! The crowd is on its feet!',
      '{hero} gathers it safely.',
      '{hero} flies into the corner to save!',
      '{hero} shuts the door!',
    ],
  },
  foulWon: {
    tr: [
      '{player} faulle durduruldu, serbest vuruş.',
      '{player} yerde, faul kararı.',
      'Hakem {player} lehine faul çaldı.',
      '{player} akıllıca faulü aldı.',
      '{player} rakibini zorladı ve faul kazandı.',
      'Faul! {player} hızını kesmek zorunda kaldılar.',
      '{player} çekildi, faul.',
      'Serbest vuruş, {player} düşürüldü.',
    ],
    en: [
      '{player} is fouled, free kick.',
      '{player} goes down, foul given.',
      'The referee gives the foul for {player}.',
      '{player} cleverly draws the foul.',
      '{player} forces the foul from {g:his|her} marker.',
      'Foul! They had to stop {player} somehow.',
      '{player} is pulled back, foul.',
      'Free kick, {player} is brought down.',
    ],
  },
  foulCommitted: {
    tr: [
      '{player} faul yaptı.',
      'Hakem {player} için faul çaldı.',
      '{player} geç kaldı, faul.',
      'Faul {player:abl}, serbest vuruş rakipte.',
      '{player} rakibini düşürdü.',
      '{player} müdahalede hata yaptı.',
      'Sert müdahale {player:abl}.',
      '{player} kolunu kullandı, faul.',
    ],
    en: [
      'Foul by {player}.',
      'The referee penalises {player}.',
      '{player} is late, foul.',
      'Foul from {player}, free kick to the opposition.',
      '{player} brings down {g:his man|her opponent}.',
      '{player} mistimes the challenge.',
      'Heavy challenge from {player}.',
      '{player} uses {g:his|her} arm, foul.',
    ],
  },
  flavor: {
    tr: [
      '{team} topa sahip olup oyunu yavaşlatıyor.',
      'Orta sahada sert bir mücadele var.',
      '{team} geriden oyun kuruyor.',
      '{opp} kompakt kalmaya çalışıyor.',
      'Tempo düştü, iki takım da birbirini kolluyor.',
      '{team} kanatları kullanmaya çalışıyor.',
      'Tribünlerden {team} takımına büyük destek var.',
      '{team} baskıyı artırıyor.',
      'Top uzun süredir orta sahada.',
      '{opp} kontra atak fırsatı kolluyor.',
    ],
    en: [
      '{team} keep the ball and slow the tempo.',
      'A fierce battle in midfield.',
      '{team} build patiently from the back.',
      '{opp} try to stay compact.',
      'The tempo has dropped, both sides wary.',
      '{team} look to use the flanks.',
      'Huge support for {team} from the stands.',
      '{team} turn up the pressure.',
      'The ball has been stuck in midfield for a while.',
      '{opp} wait for a chance to counter.',
    ],
  },
  halftime: {
    tr: [
      'İlk yarı sona erdi. Skor: {score}.',
      'Hakem ilk yarıyı bitirdi. {score}',
      'Devre arası! {team} ile {opp} soyunma odasına gidiyor. {score}',
      'İlk 45 dakika tamamlandı: {score}.',
    ],
    en: [
      'Half-time. The score: {score}.',
      'The referee blows for half-time. {score}',
      'Half-time! {team} and {opp} head down the tunnel. {score}',
      'The first 45 minutes are done: {score}.',
    ],
  },
  secondHalf: {
    tr: [
      'İkinci yarı başladı!',
      'Takımlar sahada, ikinci yarı başlıyor.',
      'İkinci 45 dakika başladı.',
      'Ve ikinci yarı start aldı!',
    ],
    en: [
      'The second half is under way!',
      'The teams are back out, the second half begins.',
      'The second 45 minutes have started.',
      'And we are off again for the second half!',
    ],
  },
  fulltimeWin: {
    tr: [
      'Maç sona erdi! {team} kazandı. {score}',
      'Son düdük! Zafer {team} takımının. {score}',
      'Ve bitti! {team} sahadan galip ayrılıyor. {score}',
      'Hakem maçı bitirdi, {team} üç puanı aldı. {score}',
    ],
    en: [
      'Full-time! {team} win. {score}',
      'The final whistle! Victory for {team}. {score}',
      'It is all over! {team} take the win. {score}',
      'The referee ends it, {team} claim the points. {score}',
    ],
  },
  fulltimeDraw: {
    tr: [
      'Maç berabere bitti. {score}',
      'Son düdük, puanlar paylaşıldı. {score}',
      'Kazanan yok! {score}',
      'Ve bitti, iki takım da yenişemedi. {score}',
    ],
    en: [
      'It ends all square. {score}',
      'Full-time, the points are shared. {score}',
      'No winner today! {score}',
      'It is over, neither side could find a winner. {score}',
    ],
  },
  extratime: {
    tr: [
      'Normal süre berabere bitti! Uzatmalara gidiyoruz.',
      'Eşitlik bozulmadı, 30 dakikalık uzatma oynanacak!',
      'Uzatma devreleri! Bacaklar yorgun ama mücadele sürüyor.',
      'Bu maç uzatmalara kaldı! {score}',
    ],
    en: [
      'Level after 90 minutes! We are going to extra time.',
      'Still all square, thirty minutes of extra time to come!',
      'Extra time! Tired legs, but the battle goes on.',
      'This one goes to extra time! {score}',
    ],
  },
  shootout: {
    tr: [
      'Uzatmalarda da kazanan çıkmadı! Penaltı atışlarına gidiyoruz!',
      'Kader penaltılarda belirlenecek!',
      'Penaltılar! Sinirler gerildi.',
      'Bu maçı penaltılar belirleyecek!',
    ],
    en: [
      'Still no winner after extra time! We go to penalties!',
      'It will be decided by a penalty shootout!',
      'Penalties! Nerves of steel required.',
      'This match will be settled from the spot!',
    ],
  },
  shootoutGoal: {
    tr: [
      '{player} attı! ({score})',
      '{player} sorumluluğu aldı ve gol! ({score})',
      'Gol! {player} hata yapmadı. ({score})',
      '{player} köşeye yerleştirdi. ({score})',
      '{player} soğukkanlı! ({score})',
      'Ağlarda! {player} başarılı. ({score})',
      '{player} kaleciyi ters köşeye yatırdı. ({score})',
      'Gol! {player} sevinçle arkadaşlarına koşuyor. ({score})',
    ],
    en: [
      '{player} scores! ({score})',
      '{player} steps up and scores! ({score})',
      'Goal! {player} makes no mistake. ({score})',
      '{player} tucks it into the corner. ({score})',
      '{player} is ice cold! ({score})',
      'In! {player} converts. ({score})',
      '{player} sends the keeper the wrong way. ({score})',
      'Goal! {player} runs back to {g:his|her} teammates. ({score})',
    ],
  },
  shootoutMiss: {
    tr: [
      '{player} kaçırdı! ({score})',
      '{gk} kurtardı! {player} üzgün. ({score})',
      '{player} üstten auta! ({score})',
      'Direk! {player} şanssız. ({score})',
      '{gk} doğru köşede! ({score})',
      '{player} kaleciye nişan aldı, kurtarıldı. ({score})',
      'Kaçtı! {player} yere çöktü. ({score})',
      '{player} yanlış karar verdi, top dışarıda. ({score})',
    ],
    en: [
      '{player} misses! ({score})',
      '{gk} saves! Heartbreak for {player}. ({score})',
      '{player} blazes over! ({score})',
      'Post! Unlucky {player}. ({score})',
      '{gk} goes the right way! ({score})',
      '{player} hits it at the keeper, saved. ({score})',
      'Missed! {player} sinks to {g:his|her} knees. ({score})',
      '{player} gets it all wrong, wide. ({score})',
    ],
  },
  shootoutWin: {
    tr: [
      '{team} penaltılarla kazandı! ({score})',
      'Ve bitti! {team} penaltılarda galip! ({score})',
      'Penaltı düellosunun kazananı {team}! ({score})',
      '{team} sinir harbinden zaferle çıktı! ({score})',
    ],
    en: [
      '{team} win on penalties! ({score})',
      'It is over! {team} prevail in the shootout! ({score})',
      '{team} win the penalty duel! ({score})',
      '{team} hold their nerve and win! ({score})',
    ],
  },
  extraHalf: {
    tr: [
      'Uzatmanın ilk yarısı bitti. {score}',
      'Uzatmada devre arası. {score}',
      'Uzatmanın ilk 15 dakikası tamam. {score}',
      'Takımlar son 15 dakika için yer değiştiriyor. {score}',
    ],
    en: [
      'The first half of extra time is over. {score}',
      'Half-time in extra time. {score}',
      'Fifteen minutes of extra time done. {score}',
      'The teams change ends for the final fifteen. {score}',
    ],
  },
} satisfies Record<string, Bank>

/** Prompt lines shown in the UI at the start of a highlight, per kind. */
export const HIGHLIGHT_PROMPTS = {
  build_up: { tr: 'Topu kontrol et, oyunu kur ve ileri taşı!', en: 'Control it, build the play and drive forward!' },
  counter: { tr: 'Kontra atak! Boşluğa koş ve sonuçlandır!', en: 'Counter attack! Run into space and finish it!' },
  one_on_one: { tr: 'Kaleciyle karşı karşıyasın! Soğukkanlı ol!', en: 'One on one with the keeper! Stay calm!' },
  cross: { tr: 'Kanattasın: ortala ya da ortaya bitir!', en: 'Out wide: deliver the cross or finish it!' },
  edge_of_box: { tr: 'Ceza sahası çizgisi! Şut mu, pas mı?', en: 'Edge of the box! Shoot or pass?' },
  freekick: { tr: 'Serbest vuruş! Barajın üstünden kaleyi bul!', en: 'Free kick! Bend it over the wall!' },
  penalty: { tr: 'Penaltı! Köşeni seç ve vur!', en: 'Penalty! Pick your corner and strike!' },
  corner: { tr: 'Korner geliyor! Doğru zamanda yüksel!', en: 'Corner incoming! Time your jump!' },
  defend: { tr: 'Rakip atakta! Yolunu kes, topu kap!', en: 'They are attacking! Cut off the attacker and win the ball!' },
  gk_save: { tr: 'Şut geliyor! Kaleni koru!', en: 'Shot incoming! Protect your goal!' },
  gk_penalty: { tr: 'Penaltı! Köşeyi oku ve uzan!', en: 'Penalty! Read the taker and dive!' },
  counter_2v1: { tr: '2’ye 1 kontra! Savunmacıyı üstüne çek, doğru anda pas ver ya da bitir!', en: '2-on-1 break! Draw the defender, then pass or finish!' },
  long_ball_control: { tr: 'Uzun top geliyor! Göğsüne al, sırtındaki adamı koru ve oyunu sürdür!', en: 'Long ball incoming! Bring it down, shield it and play on!' },
  rebound: { tr: 'Kaleci çeldi! Dönen topa herkesten önce yetiş!', en: 'The keeper parries! Be first to the rebound!' },
  interception: { tr: 'Pası oku! Pas yoluna gir ve topu kes!', en: 'Read the pass! Step into the lane and cut it out!' },
} as const satisfies Record<string, Record<Lang, string>>

const PLACEHOLDER = /\{(\w+)(?::(gen|dat|acc|loc|abl|ins))?\}/g

/**
 * Fills a template string with variables. Unknown variables render as ''.
 * Turkish case markers (`{player:gen}`) use vowel harmony; English renders
 * `{x:gen}` as "x's" and other cases as the bare value.
 */
export function fillTemplate(template: string, vars: CommentaryVars, lang: Lang, gender: Gender = 'male'): string {
  return resolveGenderAlt(template, gender).replace(PLACEHOLDER, (_m, key: string, kase?: TrCase) => {
    const raw = vars[key as keyof CommentaryVars]
    const value = raw === undefined ? '' : String(raw)
    if (!kase || !value) return value
    if (lang === 'tr') return trSuffix(value, kase)
    return kase === 'gen' ? (value.endsWith('s') ? `${value}'` : `${value}'s`) : value
  })
}

/** Number of variants available for a key in a language (for tests / tooling). */
export function variantCount(key: CommentaryKey, lang: Lang): number {
  return (LINES[key] as Bank)[lang].length
}

/** All commentary keys. */
export const COMMENTARY_KEYS = Object.keys(LINES) as CommentaryKey[]

/**
 * Picks a random variant for `key` and fills it. Uses the supplied seeded Rng so
 * commentary is deterministic for a given match seed.
 */
export function commentary(key: CommentaryKey, lang: Lang, vars: CommentaryVars, rng: Rng, gender: Gender = 'male'): string {
  const bank = (LINES[key] as Bank)[lang]
  return fillTemplate(rng.pick(bank), vars, lang, gender)
}

/**
 * Resolve `{g:male|female}` alternatives in a commentary line. Every player in
 * a match shares the world's gender (it follows the hero); referees and
 * managers keep fixed wording.
 */
export function resolveGenderAlt(text: string, gender: Gender = 'male'): string {
  return text.replace(/\{g:([^{}|]*)\|([^{}|]*)\}/g, (_m, m: string, f: string) => (gender === 'female' ? f : m))
}

/** Formats a score tuple like "2-1" (home first). */
export function formatScore(score: readonly [number, number]): string {
  return `${score[0]}-${score[1]}`
}
