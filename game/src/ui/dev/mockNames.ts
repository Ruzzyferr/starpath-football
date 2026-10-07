/** Name pools for the mock world (fictional, no real clubs or trademarks). */
import type { Country } from '../../core/types'

export const COUNTRIES: Country[] = [
  { id: 'TR', name: { tr: 'Türkiye', en: 'Turkey' }, adjective: { tr: 'Türk', en: 'Turkish' }, flag: ['#e30a17', '#ffffff', '#e30a17'], reputation: 72, nameStyle: 'tr' },
  { id: 'EN', name: { tr: 'Albion', en: 'Albion' }, adjective: { tr: 'Albiyonlu', en: 'Albionese' }, flag: ['#ffffff', '#c8102e', '#012169'], reputation: 90, nameStyle: 'en' },
  { id: 'ES', name: { tr: 'İberya', en: 'Iberia' }, adjective: { tr: 'İberyalı', en: 'Iberian' }, flag: ['#aa151b', '#f1bf00', '#aa151b'], reputation: 89, nameStyle: 'es' },
  { id: 'DE', name: { tr: 'Germanya', en: 'Germania' }, adjective: { tr: 'Germen', en: 'Germanic' }, flag: ['#000000', '#dd0000', '#ffce00'], reputation: 87, nameStyle: 'de' },
  { id: 'IT', name: { tr: 'Lazio Birliği', en: 'Latium Union' }, adjective: { tr: 'Latin', en: 'Latin' }, flag: ['#009246', '#ffffff', '#ce2b37'], reputation: 85, nameStyle: 'it' },
  { id: 'FR', name: { tr: 'Galya', en: 'Gallia' }, adjective: { tr: 'Galyalı', en: 'Gallic' }, flag: ['#0055a4', '#ffffff', '#ef4135'], reputation: 86, nameStyle: 'fr' },
  { id: 'PT', name: { tr: 'Luzitanya', en: 'Lusitania' }, adjective: { tr: 'Luzitanyalı', en: 'Lusitanian' }, flag: ['#006600', '#ff0000', '#ffcc00'], reputation: 80, nameStyle: 'pt' },
  { id: 'NL', name: { tr: 'Lowlands', en: 'Lowlands' }, adjective: { tr: 'Lowlandslı', en: 'Lowlander' }, flag: ['#ae1c28', '#ffffff', '#21468b'], reputation: 79, nameStyle: 'nl' },
  { id: 'BR', name: { tr: 'Brasilya', en: 'Brasilia' }, adjective: { tr: 'Brasilyalı', en: 'Brasilian' }, flag: ['#009c3b', '#ffdf00', '#002776'], reputation: 91, nameStyle: 'br' },
  { id: 'AR', name: { tr: 'Platina', en: 'Platina' }, adjective: { tr: 'Platinalı', en: 'Platinan' }, flag: ['#74acdf', '#ffffff', '#74acdf'], reputation: 88, nameStyle: 'ar' },
]

export const FIRST: Record<string, string[]> = {
  tr: ['Arda', 'Emre', 'Kerem', 'Mert', 'Burak', 'Ozan', 'Can', 'Barış', 'Yusuf', 'Efe', 'Kaan', 'Onur', 'Serkan', 'Tolga', 'Umut', 'Deniz', 'Volkan', 'Cengiz', 'Hakan', 'İlker', 'Oğuz', 'Selçuk', 'Çağlar', 'Gökhan'],
  en: ['Jack', 'Harry', 'Oliver', 'George', 'Callum', 'Mason', 'Reece', 'Tom', 'Kyle', 'Danny', 'Lewis', 'Ryan', 'Ben', 'Jordan', 'Luke', 'Aaron'],
  es: ['Pablo', 'Sergio', 'Álvaro', 'Iker', 'Dani', 'Marcos', 'Javi', 'Raúl', 'Hugo', 'Unai', 'Rubén', 'Mikel', 'Adrián', 'Carlos'],
  de: ['Lukas', 'Jonas', 'Leon', 'Felix', 'Timo', 'Niklas', 'Julian', 'Marco', 'Kai', 'Florian', 'Max', 'Tobias', 'Jan', 'Moritz'],
  it: ['Luca', 'Marco', 'Federico', 'Andrea', 'Matteo', 'Lorenzo', 'Davide', 'Simone', 'Nicolò', 'Giorgio'],
  fr: ['Hugo', 'Théo', 'Antoine', 'Lucas', 'Kylian', 'Maxime', 'Jules', 'Bastien', 'Rayan', 'Adrien'],
  pt: ['João', 'Rúben', 'Diogo', 'Bruno', 'Gonçalo', 'Tiago', 'Rafael', 'Nuno', 'André', 'Vítor'],
  nl: ['Daan', 'Sem', 'Bram', 'Jesse', 'Thijs', 'Ruben', 'Stefan', 'Joris', 'Wout', 'Niels'],
  br: ['Thiago', 'Gabriel', 'Lucas', 'Matheus', 'Rodrygo', 'Vinícius', 'Caio', 'Felipe', 'Gustavo', 'Danilo'],
  ar: ['Lautaro', 'Julián', 'Enzo', 'Nicolás', 'Facundo', 'Ezequiel', 'Gonzalo', 'Agustín', 'Thiago', 'Leandro'],
}

export const LAST: Record<string, string[]> = {
  tr: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Koç', 'Kurt', 'Özdemir', 'Polat', 'Erdem', 'Güneş', 'Tekin', 'Akın', 'Korkmaz', 'Ünal', 'Bulut', 'Karaca'],
  en: ['Walker', 'Bennett', 'Hughes', 'Fletcher', 'Marsh', 'Cole', 'Holloway', 'Pryce', 'Ashworth', 'Dunmore', 'Kerrigan', 'Lowe', 'Barlow', 'Whitlock', 'Tanner', 'Rowe'],
  es: ['García', 'Moreno', 'Navarro', 'Torres', 'Ruiz', 'Iglesias', 'Castillo', 'Ortega', 'Delgado', 'Romero', 'Vidal', 'Serrano', 'Medina', 'Herrera'],
  de: ['Becker', 'Hoffmann', 'Wagner', 'Schulz', 'Krämer', 'Vogt', 'Brandt', 'Lehmann', 'Keller', 'Weiß', 'Hartmann', 'Böhm', 'Seidel', 'Kühn'],
  it: ['Rossi', 'Bianchi', 'Esposito', 'Ferrari', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'Galli'],
  fr: ['Martin', 'Bernard', 'Dubois', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Roux', 'Fontaine', 'Chevalier'],
  pt: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Carvalho', 'Lopes', 'Sousa'],
  nl: ['de Jong', 'Bakker', 'Visser', 'Smit', 'Meijer', 'van Dijk', 'Mulder', 'Bos', 'Vos', 'Peters'],
  br: ['Oliveira', 'Souza', 'Lima', 'Barbosa', 'Ribeiro', 'Martins', 'Rocha', 'Nascimento', 'Araújo', 'Teixeira'],
  ar: ['Fernández', 'González', 'Álvarez', 'Domínguez', 'Acosta', 'Benítez', 'Sosa', 'Molina', 'Rojas', 'Paredes'],
}

export interface LeagueSeed {
  id: string
  countryId: string
  name: string
  tier: number
  promote: number
  relegate: number
  clubs: [name: string, short: string, city: string][]
}

export const LEAGUE_SEEDS: LeagueSeed[] = [
  {
    id: 'tr1', countryId: 'TR', name: 'Yıldız Ligi', tier: 1, promote: 1, relegate: 3,
    clubs: [
      ['Boğaziçi SK', 'BOĞ', 'İstanbul'], ['Ege Yıldızları', 'EGE', 'İzmir'], ['Anadolu Kartalları', 'ANK', 'Ankara'],
      ['Karadeniz Fırtınası', 'KRD', 'Trabzon'], ['Marmara Gücü', 'MAR', 'Bursa'], ['Haliç Spor', 'HAL', 'İstanbul'],
      ['Toros FK', 'TOR', 'Adana'], ['Kapadokya Atları', 'KAP', 'Nevşehir'], ['Akdeniz Dalgası', 'AKD', 'Antalya'],
      ['Fırat Kulübü', 'FRT', 'Elazığ'], ['Selçuklu Gençlik', 'SEL', 'Konya'], ['Çukurova Güneşi', 'ÇUK', 'Mersin'],
      ['Uludağ Kurtları', 'ULU', 'Bursa'], ['Galata Liman', 'GAL', 'İstanbul'], ['Kızılırmak SK', 'KIZ', 'Kayseri'],
      ['Ergene Spor', 'ERG', 'Tekirdağ'], ['Dicle Birlik', 'DİC', 'Diyarbakır'], ['Sakarya Akıncılar', 'SAK', 'Sakarya'],
    ],
  },
  {
    id: 'tr2', countryId: 'TR', name: '1. Yıldız Ligi', tier: 2, promote: 3, relegate: 3,
    clubs: [
      ['Kaçkar FK', 'KAÇ', 'Rize'], ['Bodrum Rüzgarı', 'BOD', 'Muğla'], ['Erciyes Gençlik', 'ERC', 'Kayseri'],
      ['Pamukkale SK', 'PAM', 'Denizli'], ['Van Gölü Spor', 'VAN', 'Van'], ['Sinop Fener', 'SİN', 'Sinop'],
      ['Göreme Yıldızı', 'GÖR', 'Nevşehir'], ['Edirne Sarayı', 'EDİ', 'Edirne'], ['Hatay Zeytin', 'HAT', 'Hatay'],
      ['Samsun Bafra', 'BAF', 'Samsun'], ['Eskişehir Lületaşı', 'LÜL', 'Eskişehir'], ['Malatya Kayısı', 'MAL', 'Malatya'],
      ['Gaziantep Baklava', 'GAZ', 'Gaziantep'], ['Kocaeli Tersane', 'KOC', 'Kocaeli'], ['Ordu Fındık', 'ORD', 'Ordu'],
      ['Manisa Lale', 'MAN', 'Manisa'], ['Zonguldak Kömür', 'ZON', 'Zonguldak'], ['Afyon Termal', 'AFY', 'Afyon'],
    ],
  },
  {
    id: 'en1', countryId: 'EN', name: 'Albion Premier', tier: 1, promote: 4, relegate: 3,
    clubs: [
      ['Ashford Rovers', 'ASH', 'Ashford'], ['Kingsbridge City', 'KGB', 'Kingsbridge'], ['Whitmoor United', 'WHU', 'Whitmoor'],
      ['Harrowgate Athletic', 'HAR', 'Harrowgate'], ['Brackenfield', 'BRK', 'Brackenfield'], ['Thornbury Town', 'THO', 'Thornbury'],
      ['Redcastle Albion', 'RCA', 'Redcastle'], ['Lowmere Wanderers', 'LOW', 'Lowmere'], ['Dunholm FC', 'DUN', 'Dunholm'],
      ['Saltcliff Port', 'SAL', 'Saltcliff'], ['Elmstead Forest', 'ELM', 'Elmstead'], ['Gravesmoor', 'GRV', 'Gravesmoor'],
      ['Northwick Villa', 'NWV', 'Northwick'], ['Castleford Rangers', 'CAS', 'Castleford'], ['Penhallow', 'PEN', 'Penhallow'],
      ['Ironbridge Works', 'IRB', 'Ironbridge'], ['Marlow Heath', 'MLH', 'Marlow'], ['Oakhurst Rovers', 'OAK', 'Oakhurst'],
      ['Silverdale', 'SIL', 'Silverdale'], ['Westcombe City', 'WCC', 'Westcombe'],
    ],
  },
  {
    id: 'es1', countryId: 'ES', name: 'Liga Ibérica', tier: 1, promote: 4, relegate: 3,
    clubs: [
      ['Real Valdemar', 'RVD', 'Valdemar'], ['Atlético Solana', 'ATS', 'Solana'], ['CD Costa Brava', 'CDB', 'Girona'],
      ['Deportivo Albarán', 'DAL', 'Albarán'], ['Unión Sierra', 'UNS', 'Sierra'], ['Racing Mareas', 'RAM', 'Mareas'],
      ['Sporting Olivares', 'SPO', 'Olivares'], ['CF Montealto', 'MON', 'Montealto'], ['Club Guadal', 'GUA', 'Guadal'],
      ['Real Alcántara', 'RAL', 'Alcántara'], ['UD Las Rocas', 'UDR', 'Las Rocas'], ['Nuevo Toledo', 'NTO', 'Toledo'],
      ['Ciudad del Sol', 'CDS', 'Sol'], ['Atlético Ribera', 'ATR', 'Ribera'], ['CF Pinares', 'PIN', 'Pinares'],
      ['Deportivo Faro', 'DFA', 'Faro'], ['Real Lucena', 'RLU', 'Lucena'], ['SD Almenara', 'SDA', 'Almenara'],
      ['Club Navarra Alta', 'CNA', 'Navarra'], ['Unión Valle Verde', 'UVV', 'Valle Verde'],
    ],
  },
  {
    id: 'de1', countryId: 'DE', name: 'Germania Liga', tier: 1, promote: 4, relegate: 2,
    clubs: [
      ['FC Rheinwald', 'RHW', 'Rheinwald'], ['Borussia Eichberg', 'BOE', 'Eichberg'], ['SV Nordhafen', 'SVN', 'Nordhafen'],
      ['Eintracht Lindau', 'EIL', 'Lindau'], ['VfB Steinfeld', 'VFS', 'Steinfeld'], ['1. FC Burgtal', 'FCB', 'Burgtal'],
      ['TSV Bergheim', 'TSV', 'Bergheim'], ['Fortuna Elster', 'FOE', 'Elster'], ['Union Hafenstadt', 'UHA', 'Hafenstadt'],
      ['SC Waldsee', 'SCW', 'Waldsee'], ['Alemannia Kronach', 'ALK', 'Kronach'], ['Viktoria Mühlberg', 'VIM', 'Mühlberg'],
      ['Rot-Weiß Talheim', 'RWT', 'Talheim'], ['Hertha Sandau', 'HSA', 'Sandau'], ['Kickers Ostend', 'KIO', 'Ostend'],
      ['Arminia Felsberg', 'ARF', 'Felsberg'], ['Germania Schwarzau', 'GES', 'Schwarzau'], ['Dynamo Grünau', 'DYG', 'Grünau'],
    ],
  },
]

export const MANAGERS = ['Fatih Ergün', 'Rıza Kocabaş', 'Mustafa Denizli', 'Şenol Güneşli', 'Ersun Yanar', 'Ünal Karaman', 'Graham Price', 'Steve Holt', 'Luis Echevarría', 'Jürgen Kalb', 'Carlo Mancetti', 'Didier Lamont', 'Abdullah Avcı', 'Hamza Tuncer', 'Bülent Uygur', 'Aykut Kocaman']

export const PALETTE = [
  '#c8102e', '#ffd100', '#003b8e', '#00843d', '#ffffff', '#111827', '#6d1a36', '#4aa3df', '#f47a20', '#5b2c83',
  '#0b6e4f', '#e10600', '#1d428a', '#fdb913', '#7a0019', '#00a3e0',
]
