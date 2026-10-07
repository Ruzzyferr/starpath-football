/**
 * Name, city and club-naming data for the procedural world.
 *
 * Everything here is plain data. Lists are written as comma-separated strings
 * for compactness and parsed once (deduplicated) at module load.
 *
 * Club names are produced from patterns such as "{city} FC" or "Atlético {city}".
 * Because patterns + real cities can accidentally recreate a real, trademarked
 * club name, {@link isRealClubName} checks against a blacklist and the
 * generator skips any match.
 */

/** Key into the name pools; every Country.nameStyle is one of these. */
export type NameStyle =
  | 'turkish' | 'english' | 'spanish' | 'german' | 'italian' | 'french'
  | 'portuguese' | 'dutch' | 'brazilian' | 'argentine' | 'american' | 'japanese'

export const NAME_STYLES: readonly NameStyle[] = [
  'turkish', 'english', 'spanish', 'german', 'italian', 'french',
  'portuguese', 'dutch', 'brazilian', 'argentine', 'american', 'japanese',
]

export interface NamePool {
  /** Male first names (default world). */
  first: readonly string[]
  /** Female first names, used when the world is generated for a female hero. */
  firstFemale: readonly string[]
  last: readonly string[]
}

/** Split a comma-separated list, trim and deduplicate (order preserved). */
function list(csv: string): readonly string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of csv.split(',')) {
    const s = raw.trim()
    if (s && !seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}

// ───────────────────────── Person names ─────────────────────────

export const NAME_POOLS: Readonly<Record<NameStyle, NamePool>> = {
  turkish: {
    first: list(`Ahmet, Mehmet, Mustafa, Ali, Hüseyin, Hasan, İbrahim, İsmail, Osman, Yusuf, Murat, Emre, Burak,
      Can, Cem, Arda, Kerem, Kaan, Mert, Oğuz, Onur, Ozan, Serkan, Selçuk, Tolga, Umut, Volkan, Yasin, Yiğit,
      Barış, Berk, Bora, Cenk, Deniz, Doğan, Efe, Enes, Erdem, Eren, Ferhat, Furkan, Gökhan, Hakan, Halil, İlker,
      Kadir, Kemal, Koray, Levent, Mesut, Nuri, Okan, Orhan, Ömer, Rıdvan, Salih, Semih, Sinan, Taylan, Tarık,
      Uğur, Ufuk, Yunus, Zeki, Batuhan, Berkay, Çağlar, Alper, Abdülkadir, Ertuğrul, Egemen, Doruk, Atakan`),
    firstFemale: list(`Ayşe, Fatma, Zeynep, Elif, Emine, Merve, Esra, Büşra, Seda, Selin, Ece, Defne, Deniz, Derya, Dilek,
      Ebru, Eda, Gamze, Gizem, Gül, Hande, İrem, Kübra, Melek, Melis, Nazlı, Nur, Özge, Pınar, Sevgi, Sibel, Simge,
      Tuğba, Yasemin, Zehra, Aslı, Burcu, Cansu, Ceren, Damla, Duygu, Ezgi, Gökçe, İpek, Lale, Meltem, Nil, Rabia,
      Sena, Sude, Tuba, Yağmur, Beren, Buse, Ela, Aylin, Berfin, Hazal, Naz, Ilgın, Dilara, Şeyma, Begüm, Ecrin`),
    last: list(`Yılmaz, Kaya, Demir, Şahin, Çelik, Yıldız, Yıldırım, Öztürk, Aydın, Özdemir, Arslan, Doğan, Kılıç,
      Aslan, Çetin, Kara, Koç, Kurt, Özkan, Şimşek, Polat, Korkmaz, Özcan, Çakır, Erdoğan, Yavuz, Can, Acar, Şen,
      Aktaş, Güler, Yalçın, Güneş, Bozkurt, Bulut, Keskin, Ünal, Turan, Gül, Özer, Işık, Kaplan, Avcı, Sarı,
      Tekin, Taş, Köse, Yüksel, Ateş, Aksoy, Ekinci, Tunç, Akın, Altun, Uçar, Toprak, Erdem, Karaca, Özbek,
      Akbulut, Sevim, Durmaz, Toker, Soylu, Tuncer, Karakaya, Akgül, Gündoğdu, Kalkan, Ersoy, Uysal, Bayram,
      Coşkun, Duman, Ergin, Baysal, Karataş, Oral, Sezer, Tufan, Başaran, Kocabaş, Albayrak, Çınar, Eren`),
  },
  english: {
    first: list(`James, John, Harry, Jack, Oliver, George, Charlie, Thomas, William, Daniel, Joshua, Ryan, Lewis,
      Callum, Connor, Kieran, Jordan, Jamie, Luke, Mason, Ben, Sam, Tom, Joe, Alex, Adam, Aaron, Ashley, Bradley,
      Danny, Dean, Gary, Glenn, Jake, Jason, Kyle, Liam, Marcus, Matt, Michael, Nathan, Owen, Phil, Reece, Rhys,
      Robbie, Scott, Sean, Steven, Theo, Tyler, Wayne, Declan, Jude, Kai, Ethan, Freddie, Archie, Alfie, Harvey,
      Louis, Max, Noah, Ollie, Toby, Elliot, Cole, Jarrod, Morgan, Curtis`),
    firstFemale: list(`Olivia, Amelia, Isla, Ava, Emily, Sophie, Grace, Lily, Chloe, Ella, Jessica, Lucy, Hannah, Megan, Ellie,
      Katie, Lauren, Rachel, Georgia, Beth, Jade, Leah, Millie, Alex, Steph, Fran, Nikita, Lotte, Keira, Toni, Demi,
      Jill, Karen, Kelly, Rachel, Laura, Jordan, Abbie, Carly, Gemma, Ella, Freya, Imogen, Poppy, Rosie, Zoe, Holly,
      Amy, Anna, Charlotte, Eleanor, Harriet, Jemma, Kirsty, Libby, Maisie, Naomi, Phoebe, Sarah, Tilly, Victoria, Esme`),
    last: list(`Smith, Jones, Taylor, Brown, Williams, Wilson, Johnson, Davies, Robinson, Wright, Thompson, Evans,
      Walker, White, Roberts, Green, Hall, Wood, Jackson, Clarke, Harris, Lewis, Hughes, Edwards, Turner, Hill,
      Moore, Cooper, Ward, Morris, King, Watson, Harrison, Morgan, Baker, Young, Allen, Mitchell, Anderson,
      Marshall, Lee, Kelly, Bell, Parker, Bennett, Price, Cook, Shaw, Simpson, Griffiths, Richardson, Carter,
      Chapman, Webb, Rogers, Fletcher, Barnes, Holmes, Mills, Palmer, Knight, Lloyd, Butler, Russell, Barker,
      Stevens, Jenkins, Murphy, Dixon, Grant, Ellis, Foster, Gibson, Spencer, Kerr, Saunders, Mason, Pearce,
      Hayes, Lowe, Burgess, Sutton, Ramsey, Fowler, Whitaker`),
  },
  spanish: {
    first: list(`Alejandro, Álvaro, Adrián, Alberto, Andrés, Antonio, Carlos, César, Daniel, David, Diego,
      Eduardo, Enrique, Fernando, Francisco, Gonzalo, Guillermo, Hugo, Ignacio, Iker, Javier, Jesús, Joaquín,
      Jordi, Jorge, José, Juan, Julián, Luis, Manuel, Marcos, Mario, Martín, Miguel, Nacho, Óscar, Pablo, Pedro,
      Rafael, Raúl, Ricardo, Roberto, Rodrigo, Rubén, Santiago, Sergio, Víctor, Xavi, Unai, Aitor, Mikel, Borja,
      Dani, Gerard, Marc, Pau, Íñigo, Alonso, Fermín, Lucas, Mateo, Nico, Iván, Gabriel, Asier, Jon`),
    firstFemale: list(`María, Lucía, Paula, Laura, Marta, Andrea, Alba, Sara, Carmen, Ana, Elena, Irene, Cristina, Claudia,
      Alexia, Aitana, Jennifer, Mariona, Olga, Patricia, Salma, Esther, Vicky, Nerea, Ainhoa, Amaia, Leire, Itziar,
      Teresa, Raquel, Rocío, Silvia, Sonia, Beatriz, Inés, Julia, Noelia, Lorena, Marina, Nuria, Pilar, Rosa,
      Sandra, Tamara, Vanesa, Celia, Eva, Isabel, Lidia, Miriam, Natalia, Olivia, Belén, Candela, Carla, Daniela,
      Gema, Jimena, Lola, Maite, Paloma, Sofía`),
    last: list(`García, Fernández, González, Rodríguez, López, Martínez, Sánchez, Pérez, Gómez, Martín, Jiménez,
      Ruiz, Hernández, Díaz, Moreno, Muñoz, Álvarez, Romero, Alonso, Gutiérrez, Navarro, Torres, Domínguez,
      Vázquez, Ramos, Gil, Ramírez, Serrano, Blanco, Molina, Morales, Suárez, Ortega, Delgado, Castro, Ortiz,
      Rubio, Marín, Sanz, Núñez, Iglesias, Medina, Garrido, Cortés, Castillo, Santos, Lozano, Guerrero, Cano,
      Prieto, Méndez, Cruz, Calvo, Gallego, Vidal, León, Márquez, Herrera, Peña, Flores, Cabrera, Campos, Vega,
      Fuentes, Carrasco, Diez, Caballero, Reyes, Nieto, Aguilar, Pascual, Santana, Herrero, Lorenzo, Montero,
      Hidalgo, Giménez, Ibáñez, Ferrer, Durán, Soler, Arrieta, Etxeberria, Zubiaurre`),
  },
  german: {
    first: list(`Lukas, Leon, Jonas, Finn, Felix, Maximilian, Paul, Elias, Ben, Tim, Niklas, Jan, Tobias,
      Florian, Sebastian, Philipp, Kevin, Dennis, Marco, Mario, Thomas, Stefan, Michael, Christian, Andreas,
      Matthias, Daniel, Julian, Kai, Marcel, Patrick, Sven, Jens, Lars, Timo, Manuel, Mats, Toni, Joshua,
      Benedikt, Moritz, Jannik, Robin, Dominik, Fabian, Torsten, Bastian, Jürgen, Oliver, Karl, Henrik, Malte,
      Nils, Jakob, Konstantin, Luca, Emil, Anton, Erik, Ole, Till, Hannes, Kilian, Lennart, Nico, Marvin`),
    firstFemale: list(`Lena, Laura, Anna, Lea, Sophie, Marie, Hannah, Lisa, Sarah, Julia, Leonie, Emilia, Mia, Lina, Clara,
      Alexandra, Giulia, Lea, Svenja, Klara, Sydney, Merle, Jule, Kathrin, Melanie, Nadine, Birgit, Sandra, Tabea,
      Lara, Jana, Paulina, Selina, Franziska, Lina, Pia, Sara, Vivien, Ann-Katrin, Carolin, Elisa, Felicitas,
      Frieda, Greta, Ida, Johanna, Katharina, Luisa, Magdalena, Nele, Nina, Romy, Sina, Stefanie, Theresa, Verena,
      Wiebke, Zoe, Annika, Hanna, Kim, Linda, Marina, Sabrina, Tanja`),
    last: list(`Müller, Schmidt, Schneider, Fischer, Weber, Meyer, Wagner, Becker, Schulz, Hoffmann, Schäfer,
      Koch, Bauer, Richter, Klein, Wolf, Schröder, Neumann, Schwarz, Zimmermann, Braun, Krüger, Hofmann,
      Hartmann, Lange, Schmitt, Werner, Schmitz, Krause, Meier, Lehmann, Schmid, Schulze, Maier, Köhler,
      Herrmann, König, Walter, Mayer, Huber, Kaiser, Fuchs, Peters, Lang, Scholz, Möller, Weiß, Jung, Hahn,
      Schubert, Vogel, Friedrich, Keller, Günther, Frank, Berger, Winkler, Roth, Beck, Lorenz, Baumann, Franke,
      Albrecht, Schuster, Simon, Ludwig, Böhm, Winter, Kraus, Martin, Schumacher, Krämer, Vogt, Stein, Jäger,
      Otto, Sommer, Groß, Seidel, Heinrich, Brandt, Haas, Dietrich, Ziegler`),
  },
  italian: {
    first: list(`Alessandro, Andrea, Antonio, Daniele, Davide, Federico, Filippo, Francesco, Gabriele, Giacomo,
      Gianluca, Giorgio, Giovanni, Giuseppe, Lorenzo, Luca, Marco, Matteo, Mattia, Michele, Nicola, Nicolò,
      Paolo, Pietro, Riccardo, Roberto, Simone, Stefano, Tommaso, Valerio, Alberto, Claudio, Domenico,
      Emanuele, Fabio, Fabrizio, Gianluigi, Leonardo, Manuel, Massimo, Mauro, Raffaele, Salvatore, Sandro,
      Sergio, Vincenzo, Christian, Diego, Edoardo, Enrico, Ettore, Franco, Gennaro, Ivan, Luigi, Mirko, Rocco,
      Samuele, Sebastiano, Vito, Alessio, Dario, Giulio, Cesare`),
    firstFemale: list(`Giulia, Sofia, Aurora, Alice, Ginevra, Emma, Giorgia, Martina, Chiara, Francesca, Sara, Valentina, Elisa,
      Barbara, Cristiana, Manuela, Arianna, Benedetta, Cecilia, Lisa, Laura, Federica, Alessia, Beatrice, Camilla,
      Carolina, Daniela, Elena, Eleonora, Gaia, Ilaria, Irene, Ludovica, Marta, Matilde, Melania, Nicole, Noemi,
      Paola, Roberta, Rebecca, Serena, Silvia, Simona, Stefania, Teresa, Viola, Vittoria, Agnese, Angela, Anna,
      Bianca, Claudia, Dalila, Erica, Lucia, Maria, Rachele, Rossella, Veronica, Asia, Greta`),
    last: list(`Rossi, Russo, Ferrari, Esposito, Bianchi, Romano, Colombo, Ricci, Marino, Greco, Bruno, Gallo,
      Conti, De Luca, Mancini, Costa, Giordano, Rizzo, Lombardi, Moretti, Barbieri, Fontana, Santoro, Mariani,
      Rinaldi, Caruso, Ferrara, Galli, Martini, Leone, Longo, Gentile, Martinelli, Vitale, Lombardo, Serra,
      Coppola, De Santis, D'Angelo, Marchetti, Parisi, Villa, Conte, Ferraro, Ferri, Fabbri, Bianco, Marini,
      Grasso, Valentini, Messina, Sala, De Angelis, Gatti, Pellegrini, Palumbo, Sanna, Farina, Rizzi, Monti,
      Cattaneo, Morelli, Amato, Silvestri, Mazza, Testa, Grassi, Pellegrino, Carbone, Giuliani, Benedetti,
      Barone, Rossetti, Caputo, Montanari, Guerra, Palmieri, Bernardi, Martino, Fiore, De Rosa, Ferretti,
      Bellini, Basile`),
  },
  french: {
    first: list(`Antoine, Alexandre, Adrien, Benjamin, Baptiste, Bastien, Clément, Cyril, Damien, David, Didier,
      Dimitri, Florian, François, Gaël, Guillaume, Hugo, Jérôme, Julien, Kévin, Laurent, Léo, Lucas, Mathieu,
      Maxime, Nicolas, Olivier, Paul, Pierre, Quentin, Raphaël, Rémi, Romain, Samuel, Sébastien, Théo, Thomas,
      Thibault, Valentin, Yann, Yoann, Aurélien, Benoît, Christophe, Corentin, Emmanuel, Fabien, Grégory,
      Jordan, Loïc, Ludovic, Mickaël, Moussa, Ousmane, Patrice, Rayan, Steve, Teddy, Tanguy, Wilfried,
      Youssouf, Aymeric, Enzo, Noah, Mamadou, Ibrahima`),
    firstFemale: list(`Camille, Léa, Manon, Chloé, Emma, Inès, Jade, Louise, Lina, Sarah, Julie, Marie, Amandine, Wendie,
      Eugénie, Amélie, Delphine, Grace, Sakina, Selma, Clara, Ève, Sandie, Élisa, Kenza, Melvine, Griedge,
      Maëlle, Pauline, Anaïs, Aurélie, Céline, Charlotte, Elodie, Estelle, Fanny, Gaëlle, Héloïse, Justine, Laure,
      Laurine, Lucie, Margaux, Marion, Mathilde, Nadia, Noémie, Océane, Perle, Romane, Salomé, Solène, Valentine,
      Agathe, Alix, Apolline, Bérénice, Capucine, Clémence, Constance, Diane, Faustine, Juliette, Zoé`),
    last: list(`Martin, Bernard, Dubois, Thomas, Robert, Richard, Petit, Durand, Leroy, Moreau, Simon, Laurent,
      Lefebvre, Michel, Garcia, David, Bertrand, Roux, Vincent, Fournier, Morel, Girard, André, Lefèvre,
      Mercier, Dupont, Lambert, Bonnet, François, Martinez, Legrand, Garnier, Faure, Rousseau, Blanc, Guérin,
      Muller, Henry, Roussel, Nicolas, Perrin, Morin, Mathieu, Clément, Gauthier, Dumont, Lopez, Fontaine,
      Chevalier, Robin, Masson, Sanchez, Gérard, Nguyen, Boyer, Denis, Lemaire, Duval, Joly, Gautier, Roger,
      Roche, Roy, Noël, Meyer, Lucas, Meunier, Perez, Marchand, Dufour, Blanchard, Barbier, Brun, Dumas, Brunet,
      Schmitt, Leroux, Colin, Fernandez, Diallo, Traoré, Koné, Camara, Mendy, Sissoko, Cissé`),
  },
  portuguese: {
    first: list(`João, José, António, Francisco, Pedro, Miguel, Rui, Nuno, Tiago, Diogo, Gonçalo, Ricardo, Bruno,
      André, Luís, Paulo, Carlos, Jorge, Rafael, Hugo, Fábio, Vítor, Sérgio, Daniel, Duarte, Bernardo, Rodrigo,
      Martim, Afonso, Tomás, Henrique, Gustavo, Filipe, Fernando, Manuel, Mário, Marco, Renato, Raúl, Simão,
      Hélder, Vasco, Gil, Joel, Leandro, Nélson, Ivo, Rúben, Danilo, Eduardo, Fausto, Gelson, Lourenço, Otávio,
      Quim, Silvestre, Valter, Xavier, Zé, Beto, Ângelo, Celso, Salvador, Dinis`),
    firstFemale: list(`Maria, Ana, Beatriz, Inês, Mariana, Leonor, Carolina, Matilde, Sofia, Rita, Joana, Marta, Catarina,
      Diana, Andreia, Cláudia, Dolores, Jéssica, Kika, Tatiana, Telma, Vanessa, Patrícia, Sílvia, Sara, Raquel,
      Filipa, Francisca, Helena, Isabel, Lara, Madalena, Margarida, Mafalda, Mónica, Natália, Rafaela, Rosa, Susana,
      Teresa, Vera, Alice, Bárbara, Benedita, Camila, Constança, Daniela, Eva, Gabriela, Íris, Jacinta, Laura, Luísa,
      Mia, Olívia, Pilar, Sónia, Yara, Lúcia, Noémia, Irene, Graça`),
    last: list(`Silva, Santos, Ferreira, Pereira, Oliveira, Costa, Rodrigues, Martins, Jesus, Sousa, Fernandes,
      Gonçalves, Gomes, Lopes, Marques, Alves, Almeida, Ribeiro, Pinto, Carvalho, Teixeira, Moreira, Correia,
      Mendes, Nunes, Soares, Vieira, Monteiro, Cardoso, Rocha, Raposo, Neves, Coelho, Cruz, Cunha, Pires, Ramos,
      Reis, Simões, Antunes, Matos, Fonseca, Machado, Araújo, Barbosa, Tavares, Lourenço, Castro, Figueiredo,
      Azevedo, Freitas, Henriques, Lima, Batista, Brito, Campos, Carneiro, Domingues, Esteves, Faria, Guerreiro,
      Leite, Magalhães, Miranda, Morais, Nogueira, Paiva, Quaresma, Sá, Valente, Vaz, Veloso, Amaral, Borges,
      Calado, Dias, Fontes, Garcia, Medeiros, Patrício, Seabra, Taborda`),
  },
  dutch: {
    first: list(`Daan, Sem, Lucas, Levi, Finn, Milan, Jesse, Thijs, Bram, Lars, Ruben, Tim, Niels, Joris, Stijn,
      Sven, Jasper, Bas, Koen, Wouter, Pieter, Jan, Kees, Dirk, Frank, Ronald, Robin, Wesley, Rafael, Klaas,
      Jaap, Marten, Gijs, Teun, Luuk, Mats, Jurriën, Matthijs, Davy, Donny, Steven, Ryan, Dennis, Edwin, Marco,
      Patrick, Clarence, Jordi, Kenneth, Maarten, Hidde, Joost, Rick, Tijmen, Wout, Youri, Quinten, Calvin, Noa,
      Siem, Thom, Jelle, Sander, Mees, Guus`),
    firstFemale: list(`Emma, Julia, Sophie, Lotte, Tess, Sara, Anna, Fenna, Lieke, Vivianne, Daniëlle, Sherida, Jill, Lieke,
      Jackie, Victoria, Dominique, Kika, Esmee, Lineth, Merel, Stefanie, Anouk, Femke, Floor, Iris, Isa, Jente, Kim,
      Lisa, Lynn, Maartje, Maud, Noor, Roos, Sanne, Saskia, Tamara, Tessa, Yara, Zoë, Britt, Demi, Eline, Evi, Fleur,
      Hanna, Ilse, Inge, Joëlle, Kirsten, Laura, Liza, Marit, Myrthe, Nina, Romy, Silke, Suzanne, Veerle, Wendy, Babs`),
    last: list(`de Jong, Jansen, de Vries, van den Berg, van Dijk, Bakker, Janssen, Visser, Smit, Meijer, de Boer,
      Mulder, de Groot, Bos, Vos, Peters, Hendriks, van Leeuwen, Dekker, Brouwer, de Wit, Dijkstra, Smits,
      de Graaf, van der Meer, van der Linden, Kok, Jacobs, de Haan, Vermeulen, van den Heuvel, van der Veen,
      van den Broek, de Bruijn, de Bruin, van der Heijden, Schouten, van Beek, Willems, van Vliet, van de Ven,
      Hoekstra, Maas, Verhoeven, Koster, van Dam, van der Wal, Prins, Blom, Huisman, Peeters, de Kock, van Wijk,
      Post, Kuiper, Veenstra, Kramer, van den Brink, Scholten, van Wijngaarden, Timmermans, Boer, Groen, Bosman,
      Hermans, Koning, Wolters, Sluiter, Gerritsen, Kuipers, Bosch, Haverkamp, Stam, Zwart, Hoogland, Veldman,
      Oosterhuis, Wesselink, Brinkman, Kroon`),
  },
  brazilian: {
    first: list(`Gabriel, Lucas, Matheus, Pedro, Guilherme, Rafael, Felipe, Bruno, Thiago, Vinícius, Rodrigo,
      Leonardo, Gustavo, Eduardo, Daniel, Diego, Marcelo, Fernando, André, Carlos, Paulo, Luiz, Fábio, Renato,
      Wellington, Anderson, Everton, Willian, Douglas, Wesley, Jefferson, Cleiton, Caio, Igor, Murilo, Danilo,
      Ederson, Arthur, Bernardo, Breno, Cauã, Davi, Emerson, Enzo, Erick, Fabrício, Gilberto, Hélio, Henrique,
      Ítalo, Jean, João, Josué, Júlio, Kaio, Luan, Marcos, Márcio, Maurício, Otávio, Raphael, Reinaldo, Robson,
      Samuel, Tiago, Vitor, Washington, Yuri, Adriano, Ramires, Talles, Wanderson`),
    firstFemale: list(`Ana, Maria, Juliana, Fernanda, Camila, Larissa, Letícia, Gabriela, Bruna, Beatriz, Mariana, Amanda, Marta,
      Rayssa, Cristiane, Andressa, Giovana, Bia, Kerolin, Tamires, Rafaelle, Lauren, Adriana, Duda, Luana, Ludmila,
      Thaís, Aline, Alice, Bárbara, Carla, Carolina, Clara, Daniela, Débora, Eduarda, Elisa, Fabiana, Gisele, Helena,
      Isabela, Jéssica, Joana, Laís, Laura, Lívia, Luiza, Manuela, Natália, Patrícia, Priscila, Rafaela, Raquel,
      Renata, Sabrina, Sofia, Tainá, Valentina, Vitória, Yasmin, Kelly, Geyse`),
    last: list(`Silva, Santos, Oliveira, Souza, Lima, Pereira, Ferreira, Costa, Rodrigues, Almeida, Nascimento,
      Alves, Carvalho, Araújo, Ribeiro, Gomes, Martins, Rocha, Barbosa, Melo, Barros, Cardoso, Correia,
      Teixeira, Dias, Moreira, Monteiro, Mendes, Freitas, Nunes, Moura, Cavalcanti, Batista, Campos, Pinto,
      Vieira, Andrade, Fernandes, Castro, Azevedo, Ramos, Lopes, Machado, Soares, Fonseca, Borges, Miranda,
      Medeiros, Farias, Xavier, Brandão, Duarte, Siqueira, Queiroz, Tavares, Guimarães, Magalhães, Bezerra,
      Leite, Coelho, Paiva, Rezende, Pires, Bastos, Arruda, Peixoto, Viana, Sampaio, Macedo, Brito, Prado,
      Morais, Assis, Neves, Jesus, Matos, Aguiar, Lacerda, Bittencourt, Camargo, Damasceno, Fagundes`),
  },
  argentine: {
    first: list(`Juan, Martín, Lucas, Matías, Nicolás, Santiago, Facundo, Gonzalo, Agustín, Lautaro, Julián,
      Rodrigo, Franco, Emiliano, Leandro, Maximiliano, Ezequiel, Federico, Germán, Hernán, Ignacio, Javier,
      Leonel, Lisandro, Mauro, Nahuel, Pablo, Ramiro, Sebastián, Tomás, Valentín, Alejandro, Ángel, Cristian,
      Darío, Diego, Enzo, Exequiel, Fernando, Gabriel, Gustavo, Hugo, Joaquín, Marcos, Mariano, Oscar,
      Patricio, Rodolfo, Thiago, Walter, Alexis, Bruno, Claudio, Esteban, Fabricio, Guido, Iván, Luciano,
      Marcelo, Milton, Nehuén, Paulo, Ricardo, Sergio, Benjamín, Gastón, Kevin, Bautista`),
    firstFemale: list(`Sofía, Valentina, Martina, Lucía, Catalina, Camila, Florencia, Agustina, Micaela, Rocío, Julieta,
      Estefanía, Mariana, Yamila, Vanina, Romina, Daiana, Milagros, Paulina, Abril, Antonella, Aldana, Belén,
      Brenda, Carolina, Celeste, Constanza, Delfina, Emilia, Eugenia, Gabriela, Guadalupe, Jazmín, Josefina, Lara,
      Lorena, Luciana, Ludmila, Malena, María, Milena, Natalia, Noelia, Pilar, Priscila, Renata, Sabrina, Selene,
      Solana, Tamara, Victoria, Ximena, Zoe, Ailén, Bianca, Candela, Eliana, Ivana, Laura, Marisol, Paula, Sol`),
    last: list(`González, Rodríguez, Gómez, Fernández, López, Díaz, Martínez, Pérez, García, Sánchez, Romero,
      Sosa, Álvarez, Torres, Ruiz, Ramírez, Flores, Acosta, Benítez, Medina, Suárez, Herrera, Aguirre, Pereyra,
      Gutiérrez, Giménez, Molina, Silva, Castro, Rojas, Ortiz, Núñez, Luna, Juárez, Cabrera, Ríos, Ferreyra,
      Godoy, Morales, Domínguez, Moreno, Peralta, Vega, Carrizo, Quiroga, Castillo, Ledesma, Muñoz, Ojeda,
      Ponce, Vera, Cardozo, Velázquez, Coronel, Correa, Figueroa, Paz, Villalba, Arias, Maldonado, Mansilla,
      Olivera, Paredes, Barrios, Bustos, Insaurralde, Lucero, Báez, Campos, Farías, Palacios, Pacheco, Vargas,
      Zárate, Funes, Rivero, Montiel, Bianchi, Lombardi, Marchetti, Ferraro, Cavallero, Battaglia, Pellegrino`),
  },
  american: {
    first: list(`Michael, Christopher, Matthew, Joshua, Andrew, Ryan, Tyler, Brandon, Justin, Kyle, Zachary,
      Jacob, Austin, Cody, Dylan, Logan, Hunter, Chase, Cole, Brian, Kevin, Jason, Eric, Aaron, Jordan, Landon,
      Clint, DeAndre, Weston, Christian, Gio, Tim, Brad, Josh, Jesse, Miles, Caleb, Carter, Cameron, Connor,
      Devin, Elijah, Gavin, Isaiah, Jalen, Jaylen, Malik, Marcus, Nathan, Noah, Owen, Parker, Reggie, Trent,
      Wyatt, Zack, Luca, Diego, Alejandro, Julian, Ricardo, Paxton, Gianluca, Brenden, Tanner, Brody`),
    firstFemale: list(`Emily, Madison, Ashley, Sarah, Jessica, Samantha, Taylor, Megan, Alex, Lindsey, Crystal, Kelley, Mallory,
      Rose, Sophia, Trinity, Lindsey, Becky, Abby, Carli, Christen, Avery, Hope, Julie, Becky, Morgan, Lauren, Kristie,
      Allie, Andi, Ashlyn, Brianna, Casey, Catarina, Emma, Hailie, Jaedyn, Jenna, Kailen, Kaylie, Kennedy, Lynn,
      Margaret, Naomi, Olivia, Riley, Savannah, Sierra, Sydney, Tierna, Ali, Amanda, Brooke, Chelsea, Courtney,
      Danielle, Erika, Haley, Jordan, Kelly, Natalie, Rachel`),
    last: list(`Smith, Johnson, Williams, Brown, Jones, Miller, Davis, Garcia, Rodriguez, Wilson, Martinez,
      Anderson, Taylor, Thomas, Hernandez, Moore, Martin, Jackson, Thompson, White, Lopez, Lee, Gonzalez,
      Harris, Clark, Lewis, Robinson, Walker, Perez, Hall, Young, Allen, Sanchez, Wright, King, Scott, Green,
      Baker, Adams, Nelson, Hill, Ramirez, Campbell, Mitchell, Roberts, Carter, Phillips, Evans, Turner, Torres,
      Parker, Collins, Edwards, Stewart, Flores, Morris, Murphy, Rivera, Cook, Rogers, Morgan, Peterson, Cooper,
      Reed, Bailey, Bell, Gomez, Kelly, Howard, Ward, Cox, Diaz, Richardson, Wood, Watson, Brooks, Bennett,
      Gray, James, Reyes, Hughes, Price, Sullivan, Russell, Fischer, Novak`),
  },
  japanese: {
    first: list(`Hiroshi, Takashi, Kenji, Yuki, Daiki, Takumi, Shota, Kenta, Ryota, Yuto, Haruto, Sota, Kaito,
      Ren, Riku, Yuma, Kazuki, Naoki, Shinji, Keisuke, Makoto, Yasuhito, Yoshinori, Kaoru, Wataru, Daichi,
      Ritsu, Takehiro, Shuichi, Genki, Yuya, Tomoaki, Hiroki, Koji, Masato, Ryo, Satoshi, Shunsuke, Tatsuya,
      Yosuke, Akira, Junya, Kosuke, Takuma, Yuji, Hayato, Kota, Shin, Taichi, Tsubasa, Yudai, Sho, Ayumu, Reo,
      Kohei, Hidemasa, Kei, Asahi, Minato, Itsuki, Hinata, Sora, Yamato, Ryusei`),
    firstFemale: list(`Yui, Aoi, Sakura, Hina, Rin, Yuna, Mio, Saki, Haruka, Nanami, Misaki, Ayaka, Homare, Mana, Yuka, Aya,
      Hinata, Fuka, Riko, Miyabi, Jun, Saori, Kumi, Nahomi, Rumi, Asuna, Chika, Emi, Eri, Hana, Hikaru, Honoka,
      Kana, Kanako, Kaori, Kasumi, Kei, Kiko, Mai, Mami, Mayu, Megumi, Miho, Miku, Minami, Mizuki, Momoka, Nana,
      Natsuki, Nozomi, Risa, Sae, Shiori, Sora, Tomoko, Tsugumi, Yoko, Yuki, Yuri, Akane, Ami, Moeka`),
    last: list(`Sato, Suzuki, Takahashi, Tanaka, Watanabe, Ito, Yamamoto, Nakamura, Kobayashi, Kato, Yoshida,
      Yamada, Sasaki, Yamaguchi, Matsumoto, Inoue, Kimura, Hayashi, Shimizu, Yamazaki, Mori, Abe, Ikeda,
      Hashimoto, Yamashita, Ishikawa, Nakajima, Maeda, Fujita, Ogawa, Goto, Okada, Hasegawa, Murakami, Kondo,
      Ishii, Saito, Sakamoto, Endo, Aoki, Fujii, Nishimura, Fukuda, Ota, Miura, Fujiwara, Okamoto, Matsuda,
      Nakagawa, Nakano, Harada, Ono, Tamura, Takeuchi, Kaneko, Wada, Nakayama, Ishida, Ueda, Morita, Hara,
      Shibata, Sakai, Kudo, Yokoyama, Miyazaki, Miyamoto, Uchida, Takagi, Ando, Taniguchi, Ohno, Maruyama,
      Imai, Takada, Fujimoto, Takeda, Murata, Ueno, Sugiyama, Masuda, Sugawara, Hirano, Kubo`),
  },
}

// ───────────────────────── Cities ─────────────────────────

/**
 * Cities per country id, roughly ordered by size/footballing weight. The
 * generator places the strongest clubs in the first cities and lets the
 * biggest cities host several clubs (derbies).
 */
export const CITIES: Readonly<Record<string, readonly string[]>> = {
  TR: list(`İstanbul, Ankara, İzmir, Bursa, Antalya, Adana, Konya, Gaziantep, Kayseri, Trabzon, Samsun,
    Eskişehir, Mersin, Diyarbakır, Denizli, Sakarya, Malatya, Erzurum, Kocaeli, Manisa, Balıkesir, Sivas,
    Hatay, Rize, Aydın, Tekirdağ, Çanakkale, Ordu, Giresun, Muğla, Bolu, Edirne, Elazığ, Van`),
  EN: list(`London, Manchester, Liverpool, Birmingham, Leeds, Sheffield, Bristol, Newcastle, Nottingham,
    Leicester, Southampton, Portsmouth, Brighton, Plymouth, Norwich, Coventry, York, Derby, Hull, Bath, Oxford,
    Cambridge, Reading, Exeter, Sunderland, Bolton, Preston, Blackpool, Stoke, Wolverhampton, Ipswich,
    Carlisle, Chester, Gloucester, Worcester, Lancaster`),
  ES: list(`Madrid, Barcelona, Valencia, Sevilla, Zaragoza, Málaga, Murcia, Palma, Bilbao, Alicante, Córdoba,
    Valladolid, Vigo, Gijón, Granada, Oviedo, Santander, Pamplona, Almería, Cádiz, Huelva, Salamanca, Burgos,
    León, Logroño, Albacete, Tarragona, Castellón, Elche, Badajoz, Cartagena, Girona`),
  DE: list(`Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf, Dortmund, Essen, Leipzig, Bremen,
    Dresden, Hannover, Nürnberg, Duisburg, Bochum, Wuppertal, Bielefeld, Bonn, Münster, Karlsruhe, Mannheim,
    Augsburg, Wiesbaden, Kiel, Freiburg, Rostock, Kassel, Aachen, Mainz, Magdeburg, Regensburg, Paderborn,
    Darmstadt`),
  IT: list(`Roma, Milano, Napoli, Torino, Palermo, Genova, Bologna, Firenze, Bari, Catania, Venezia, Verona,
    Messina, Padova, Trieste, Brescia, Parma, Taranto, Prato, Modena, Reggio, Perugia, Livorno, Cagliari,
    Foggia, Salerno, Ferrara, Rimini, Pescara, Bergamo, Lecce, Udine, Ancona, Como, Pisa, Siena, Vicenza`),
  FR: list(`Paris, Marseille, Lyon, Toulouse, Nice, Nantes, Strasbourg, Montpellier, Bordeaux, Lille, Rennes,
    Reims, Le Havre, Toulon, Grenoble, Dijon, Angers, Nîmes, Brest, Tours, Amiens, Limoges, Metz, Besançon,
    Orléans, Rouen, Caen, Nancy, Lorient, Auxerre, Lens, Avignon, Perpignan, Clermont, Troyes`),
  PT: list(`Lisboa, Porto, Braga, Coimbra, Funchal, Setúbal, Aveiro, Faro, Viseu, Guimarães, Leiria, Évora,
    Vila Real, Barcelos, Chaves, Portimão, Covilhã, Famalicão, Estoril, Arouca, Tondela, Penafiel, Olhão,
    Bragança, Beja, Santarém, Castelo Branco, Viana do Castelo, Amadora, Matosinhos`),
  NL: list(`Amsterdam, Rotterdam, Den Haag, Utrecht, Eindhoven, Groningen, Tilburg, Almere, Breda, Nijmegen,
    Arnhem, Haarlem, Enschede, Maastricht, Zwolle, Leiden, Dordrecht, Alkmaar, Leeuwarden, Deventer, Delft,
    Venlo, Heerenveen, Emmen, Almelo, Sittard, Waalwijk, Volendam, Den Bosch, Apeldoorn, Amersfoort`),
  BR: list(`São Paulo, Rio de Janeiro, Belo Horizonte, Salvador, Fortaleza, Brasília, Curitiba, Recife,
    Porto Alegre, Manaus, Belém, Goiânia, Campinas, São Luís, Maceió, Natal, Teresina, João Pessoa,
    Florianópolis, Cuiabá, Santos, Ribeirão Preto, Londrina, Juiz de Fora, Joinville, Uberlândia, Sorocaba,
    Caxias do Sul, Vitória, Aracaju, Pelotas, Chapecó`),
  AR: list(`Buenos Aires, Córdoba, Rosario, Mendoza, La Plata, Tucumán, Mar del Plata, Salta, Santa Fe,
    San Juan, Resistencia, Neuquén, Corrientes, Posadas, Bahía Blanca, Paraná, San Luis, Jujuy, Río Cuarto,
    Rafaela, Junín, Santiago del Estero, Catamarca, La Rioja, Formosa, Comodoro Rivadavia, Ushuaia, Tandil,
    Olavarría, Pergamino, Mercedes`),
  US: list(`Seattle, Portland, San Diego, Phoenix, Denver, Dallas, Houston, Austin, Chicago, Detroit, Boston,
    Philadelphia, Baltimore, Atlanta, Miami, Tampa, Charlotte, Nashville, Memphis, Kansas City, St. Louis,
    Minneapolis, Milwaukee, Cleveland, Pittsburgh, Cincinnati, Columbus, Indianapolis, Louisville, Sacramento,
    San Jose, Las Vegas, Albuquerque, Tucson, Omaha, Oakland, Orlando, Richmond`),
  JP: list(`Tokyo, Yokohama, Osaka, Nagoya, Sapporo, Fukuoka, Kobe, Kawasaki, Kyoto, Saitama, Hiroshima,
    Sendai, Chiba, Kitakyushu, Sakai, Niigata, Hamamatsu, Kumamoto, Sagamihara, Shizuoka, Okayama,
    Kagoshima, Hachioji, Utsunomiya, Matsuyama, Kanazawa, Nagasaki, Oita, Nara, Gifu, Toyama, Kofu, Mito,
    Akita, Iwaki, Machida`),
}

// ───────────────────────── Club & stadium naming ─────────────────────────

/** Club naming patterns per name style. `{city}` is replaced by the club's city. */
export const CLUB_PATTERNS: Readonly<Record<NameStyle, readonly string[]>> = {
  turkish: ['{city}spor', '{city} FK', '{city} Gençlik SK', '{city} İdman Yurdu', '{city} Gücü',
    '{city} Yıldızspor', '{city} Birlikspor', '{city} Kartalspor', '{city} Akınspor', '{city} Futbol Kulübü',
    '{city} Doğanspor', '{city} Atletik'],
  english: ['{city} FC', '{city} United', '{city} City', '{city} Town', '{city} Rovers', '{city} Athletic',
    '{city} Albion', '{city} Wanderers', '{city} Rangers', 'AFC {city}', '{city} County', '{city} Harriers'],
  spanish: ['Real {city}', 'Atlético {city}', '{city} CF', 'CD {city}', 'Deportivo {city}', 'Racing {city}',
    'UD {city}', 'Sporting {city}', 'CF {city}', 'SD {city}', 'Club Deportivo {city}', 'Unión {city}'],
  german: ['SV {city}', 'FC {city}', 'VfB {city}', 'TSV {city}', 'Borussia {city}', 'Eintracht {city}',
    'Fortuna {city}', 'SpVgg {city}', 'VfL {city}', '1. FC {city}', 'Union {city}', 'Rot-Weiß {city}'],
  italian: ['AC {city}', '{city} Calcio', 'US {city}', 'SS {city}', 'Sporting {city}', 'AS {city}',
    'Virtus {city}', 'Atletico {city}', 'Pro {city}', 'Unione {city}', 'Polisportiva {city}', 'Real {city}'],
  french: ['FC {city}', 'Olympique {city}', 'AS {city}', 'Stade {city}', 'Racing {city}', 'US {city}',
    'SC {city}', 'Union Sportive {city}', 'En Avant {city}', 'Athlétique {city}', 'Entente {city}',
    'Étoile {city}'],
  portuguese: ['Sporting {city}', 'SC {city}', 'FC {city}', 'Académica {city}', 'União {city}',
    'Desportivo {city}', 'CD {city}', 'Atlético {city}', 'Vitória {city}', 'Clube {city}', 'Estrela {city}',
    'GD {city}'],
  dutch: ['FC {city}', 'SV {city}', 'VV {city}', '{city} Boys', 'SC {city}', 'Sparta {city}', 'Quick {city}',
    'Fortuna {city}', 'RKC {city}', 'Excelsior {city}', 'Velocitas {city}', 'Hercules {city}'],
  brazilian: ['{city} FC', 'Esporte Clube {city}', 'Atlético {city}', 'América {city}', 'Sport {city}',
    'Clube Atlético {city}', 'União {city}', 'Ferroviário {city}', 'Operário {city}', 'Nacional {city}',
    'Grêmio {city}', 'Associação {city}'],
  argentine: ['Club Atlético {city}', 'Deportivo {city}', 'Racing {city}', 'Sportivo {city}', 'Unión {city}',
    'Independiente {city}', 'Gimnasia {city}', 'Estudiantes {city}', 'Defensores de {city}', 'Talleres {city}',
    'Juventud {city}', 'Atlético {city}'],
  american: ['{city} FC', '{city} SC', '{city} United', 'Real {city}', '{city} Athletic', '{city} City',
    '{city} Rovers', 'FC {city}', '{city} Strikers', '{city} Republic', '{city} Rush', '{city} Stars'],
  japanese: ['{city} FC', 'FC {city}', '{city} United', 'Sporting {city}', '{city} Athletic', '{city} SC',
    '{city} Stars', '{city} Rising', '{city} Phoenix', '{city} Blaze', '{city} Wings', '{city} Storm'],
}

/**
 * Stadium naming patterns. `{city}` = club city, `{surname}` = a surname from
 * the country's pool (honouring a fictional club legend / founder).
 */
export const STADIUM_PATTERNS: Readonly<Record<NameStyle, readonly string[]>> = {
  turkish: ['{city} Stadyumu', '{surname} Stadyumu', '{city} Arena', 'Yeni {city} Stadı', '{surname} Spor Kompleksi'],
  english: ['{surname} Park', '{city} Stadium', '{surname} Road', 'The {surname} Ground', '{city} Arena', '{surname} Lane'],
  spanish: ['Estadio {surname}', 'Estadio Municipal de {city}', 'Campo {surname}', 'Nuevo Estadio de {city}'],
  german: ['{city} Arena', 'Stadion {city}', '{surname}-Stadion', 'Waldstadion {city}', '{surname}park'],
  italian: ['Stadio {surname}', 'Stadio Comunale di {city}', 'Arena {city}', 'Stadio Città di {city}'],
  french: ['Stade {surname}', 'Stade Municipal de {city}', 'Parc {surname}', 'Stade {city} Métropole'],
  portuguese: ['Estádio {surname}', 'Estádio Municipal de {city}', 'Estádio Cidade de {city}'],
  dutch: ['{surname} Stadion', '{city} Arena', 'Sportpark {surname}', 'Stadion {city}'],
  brazilian: ['Estádio {surname}', 'Arena {city}', 'Estádio Municipal {surname}'],
  argentine: ['Estadio {surname}', 'Estadio Ciudad de {city}', 'Estadio Libertad de {city}'],
  american: ['{city} Stadium', '{surname} Field', '{surname} Park', '{city} Soccer Stadium'],
  japanese: ['{city} Stadium', '{city} Athletic Stadium', '{city} Arena', '{city} Football Park'],
}

/**
 * Real (and frequently trademarked) club names that patterns + real cities
 * could reproduce. Compared after {@link normalizeClubName}.
 */
const REAL_CLUB_NAMES = list(`
  Trabzonspor, Bursaspor, Konyaspor, Sivasspor, Kayserispor, Antalyaspor, Rizespor, Gaziantepspor, Samsunspor,
  Denizlispor, Eskişehirspor, Malatyaspor, Erzurumspor, Kocaelispor, Sakaryaspor, Manisaspor, Adanaspor,
  Hatayspor, Giresunspor, Boluspor, Elazığspor, Balıkesirspor, Diyarbakırspor, Orduspor, İstanbulspor,
  Ankaraspor, Mersin İdman Yurdu, Ankara Gücü, Vanspor, Aydınspor, Edirnespor, Muğlaspor, Çanakkalespor,
  İzmirspor, Tekirdağspor, Gaziantep FK, Kayseri Erciyesspor, Karşıyaka,
  Manchester United, Manchester City, Newcastle United, Leeds United, Sheffield United, West Ham United,
  Leicester City, Norwich City, Stoke City, Bristol City, Bristol Rovers, Hull City, Birmingham City,
  Coventry City, Ipswich Town, Luton Town, Wigan Athletic, Charlton Athletic, Bolton Wanderers,
  Wolverhampton Wanderers, Derby County, Liverpool FC, Everton FC, Chelsea FC, Arsenal FC, Fulham FC,
  Brentford FC, Southampton FC, Burnley FC, Watford FC, Reading FC, Millwall FC, Portsmouth FC, Sunderland AFC,
  Oxford United, Cambridge United, Exeter City, Carlisle United, Plymouth Argyle, Preston North End,
  Blackpool FC, Brighton FC, York City, Chester FC, Gloucester City, Worcester City, Bath City, Lancaster City,
  Nottingham Forest, Stoke City FC, Hull City AFC, Exeter City FC, Norwich FC, Coventry FC, Sheffield FC,
  Real Madrid, Atlético Madrid, Real Zaragoza, Real Valladolid, Real Oviedo, Real Murcia, Racing Santander,
  Valencia CF, Sevilla FC, Málaga CF, Granada CF, Cádiz CF, Elche CF, Girona FC, Córdoba CF, UD Almería,
  UD Salamanca, Sporting Gijón, CD Tenerife, Burgos CF, CD Castellón, FC Cartagena, Real Burgos, CF Badajoz,
  CD Logroñés, UD Logroñés, Deportivo Alavés, Real Betis, RCD Mallorca, Real Sociedad, Barcelona CF,
  CD Leganés, Albacete CF, Atlético Baleares, Real Jaén, Deportivo La Coruña, Racing Ferrol, UD Las Palmas,
  Borussia Dortmund, Union Berlin, 1. FC Union Berlin, FC Köln, 1. FC Köln, Eintracht Frankfurt, VfB Stuttgart,
  Fortuna Düsseldorf, Werder Bremen, SV Werder Bremen, Hannover 96, 1. FC Nürnberg, FC Nürnberg, MSV Duisburg,
  VfL Bochum, Arminia Bielefeld, FC Augsburg, SV Wiesbaden, Holstein Kiel, SC Freiburg, Hansa Rostock,
  FC Hansa Rostock, Alemannia Aachen, FSV Mainz, FC Magdeburg, 1. FC Magdeburg, SC Paderborn, SV Darmstadt,
  FC Bayern München, Bayern München, TSV München, TSV 1860 München, FC St. Pauli, Hamburger SV, RB Leipzig,
  Dynamo Dresden, Rot-Weiß Essen, Rot-Weiss Essen, Wuppertaler SV, Preußen Münster, FC Kaiserslautern,
  Stuttgarter Kickers, VfL Wolfsburg, Borussia Mönchengladbach, Eintracht Braunschweig, SV Hamburg,
  FC Mannheim, SV Mannheim, SV Waldhof Mannheim, Hertha Berlin, Karlsruher SC, KSV Hessen Kassel, FC Bonn,
  Bonner SC, VfL Osnabrück, FC Hamburg, SpVgg Fürth, FC Leipzig, 1. FC Leipzig, Jahn Regensburg,
  AC Milan, AS Roma, SS Lazio, SSC Napoli, US Lecce, Genoa CFC, Bologna FC, AC Fiorentina, Hellas Verona,
  Torino FC, Calcio Padova, Parma Calcio, Brescia Calcio, Venezia FC, Palermo FC, US Palermo, Calcio Catania,
  Catania Calcio, Bari Calcio, AS Bari, Cagliari Calcio, US Salernitana, Pescara Calcio, Atalanta Bergamo,
  Udinese Calcio, Como Calcio, Calcio Como, AC Pisa, Pisa Calcio, AC Siena, Robur Siena, Calcio Vicenza,
  AC Perugia, US Livorno, AS Livorno, Modena FC, US Foggia, Calcio Foggia, US Ancona, AC Ancona, Rimini Calcio,
  AC Reggiana, US Triestina, Taranto FC, AC Prato, SPAL Ferrara, AC Parma, Napoli Calcio, Roma Calcio,
  Milano Calcio, Torino Calcio, Genova Calcio, Bologna Calcio, Firenze Calcio, Verona Calcio, Lecce Calcio,
  AS Livorno Calcio, AC Monza, Virtus Verona, SS Ancona, AC Messina, ACR Messina, US Cremonese,
  Olympique Marseille, Olympique de Marseille, Olympique Lyon, Olympique Lyonnais, Paris FC, Paris Saint-Germain,
  Stade Rennais, Stade Brestois, Stade Reims, Stade de Reims, Stade Rennes, Stade Brest, Toulouse FC,
  FC Toulouse, OGC Nice, FC Nantes, RC Strasbourg, Racing Strasbourg, Montpellier HSC, Girondins Bordeaux,
  FC Girondins Bordeaux, LOSC Lille, Lille OSC, Le Havre AC, AS Monaco, Grenoble Foot, Dijon FCO, Angers SCO,
  Nîmes Olympique, Olympique Nîmes, Tours FC, Amiens SC, FC Metz, FC Lorient, AJ Auxerre, RC Lens, Racing Lens,
  Clermont Foot, ES Troyes, AS Nancy, SM Caen, Stade Malherbe Caen, FC Rouen, US Orléans, AS Saint-Étienne,
  FC Sochaux, SC Toulon, Sporting Toulon, AS Béziers, US Créteil, Red Star FC, FC Lyon, FC Marseille,
  Sporting Lisboa, Sporting Braga, SC Braga, FC Porto, Académica Coimbra, Vitória Setúbal, Vitória Guimarães,
  CD Tondela, FC Arouca, FC Penafiel, Desportivo Chaves, GD Chaves, FC Famalicão, SC Covilhã,
  Sporting Covilhã, União Leiria, UD Leiria, SC Olhanense, Gil Vicente, Boavista FC, SC Beira-Mar,
  GD Estoril, Estoril Praia, CF Estrela Amadora, Estrela Amadora, Leixões SC, SC Farense, SC Espinho,
  Académica Viseu, Académico Viseu, CD Feirense, CD Nacional, Clube Desportivo Nacional, União Madeira,
  FC Utrecht, FC Groningen, FC Twente, FC Emmen, FC Volendam, FC Den Bosch, FC Eindhoven, SC Heerenveen,
  Sparta Rotterdam, Excelsior Rotterdam, Fortuna Sittard, RKC Waalwijk, VVV Venlo, FC Dordrecht,
  Heracles Almelo, NAC Breda, FC Zwolle, PEC Zwolle, AZ Alkmaar, SC Cambuur, Vitesse Arnhem, ADO Den Haag,
  MVV Maastricht, Ajax Amsterdam, Feyenoord Rotterdam, HFC Haarlem, Almere City, FC Almere, Quick Den Haag,
  Go Ahead Eagles, SC Telstar, FC Amsterdam, Sparta Nijmegen, SV Venlo,
  Fortaleza EC, Santos FC, Atlético Goianiense, América Mineiro, Sport Recife, Clube Atlético Mineiro,
  Atlético Mineiro, Joinville EC, Esporte Clube Vitória, EC Vitória, Esporte Clube Bahia, Ceará SC,
  Cuiabá EC, Esporte Clube Juventude, Londrina EC, Esporte Clube Pelotas, Chapecoense, América Natal,
  Nacional Manaus, Ferroviário Fortaleza, Brasília FC, Goiânia EC, Operário Ferroviário, Sport Club Recife,
  Atlético Paranaense, Clube Atlético Paranaense, Grêmio Porto Alegre, Associação Chapecoense,
  Esporte Clube São Paulo, São Paulo FC, Rio de Janeiro FC, Salvador FC, Natal FC, Manaus FC, Santos Atlético,
  Racing Córdoba, Talleres Córdoba, Instituto Córdoba, Belgrano Córdoba, Gimnasia La Plata, Estudiantes La Plata,
  Gimnasia Mendoza, Independiente Rivadavia, Unión Santa Fe, Colón Santa Fe, Atlético Tucumán,
  Club Atlético Tucumán, San Martín Tucumán, Gimnasia Jujuy, Atlético Rafaela, Club Atlético Rafaela,
  Sarmiento Junín, Aldosivi Mar del Plata, Estudiantes Río Cuarto, Juventud Antoniana, Olimpo Bahía Blanca,
  Unión Mar del Plata, Rosario Central, Gimnasia Salta, Juventud Unida, Racing Avellaneda,
  Independiente Avellaneda, Club Atlético Rosario, Talleres Remedios de Escalada, Deportivo Morón,
  Austin FC, Charlotte FC, Nashville SC, Minnesota United, Atlanta United, Orlando City, Orlando City SC,
  New York City FC, Chicago Fire, FC Dallas, Houston Dynamo, Seattle Sounders, Portland Timbers,
  Real Salt Lake, Sporting Kansas City, St. Louis City, St. Louis City SC, Columbus Crew, FC Cincinnati,
  Inter Miami, San Diego FC, Philadelphia Union, Colorado Rapids, San Jose Earthquakes, LA Galaxy,
  Los Angeles FC, Sacramento Republic, Louisville City, Louisville City FC, Indy Eleven, Pittsburgh Riverhounds,
  Tampa Bay Rowdies, Phoenix Rising, Las Vegas Lights, Oakland Roots, Detroit City, Detroit City FC,
  Memphis 901, Miami FC, Richmond Kickers, Charleston Battery, San Antonio FC, Tulsa FC, Oakland Athletic,
  Fort Lauderdale Strikers, Tampa Bay Rush, Austin Stars, Sacramento Republic FC, Seattle FC, Dallas FC,
  Cleveland SC, Tucson FC, Omaha FC, Kansas City FC, Phoenix FC, Detroit FC, Chicago FC,
  FC Tokyo, Tokyo Verdy, Yokohama FC, Yokohama F. Marinos, Cerezo Osaka, Gamba Osaka, FC Osaka,
  Nagoya Grampus, Consadole Sapporo, Avispa Fukuoka, Vissel Kobe, Kawasaki Frontale, Kyoto Sanga,
  Urawa Reds, Omiya Ardija, Sanfrecce Hiroshima, Vegalta Sendai, JEF United Chiba, JEF Chiba,
  Giravanz Kitakyushu, Albirex Niigata, Roasso Kumamoto, SC Sagamihara, Sagamihara SC, Shimizu S-Pulse,
  Fagiano Okayama, Kagoshima United, Kagoshima United FC, Tochigi SC, Ehime FC, FC Gifu, FC Imabari,
  Kataller Toyama, Ventforet Kofu, Mito HollyHock, Blaublitz Akita, Iwaki FC, FC Machida Zelvia,
  Machida Zelvia, Oita Trinita, V-Varen Nagasaki, Nara Club, FC Ryukyu, Zweigen Kanazawa, FC Kanazawa,
  Matsumoto Yamaga, Tokushima Vortis, Okayama FC, Kobe FC, Sendai FC, Chiba FC, Mito FC, Akita FC`)

/** Lowercase, strip diacritics/punctuation and collapse whitespace. */
export function normalizeClubName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const REAL_CLUB_SET: ReadonlySet<string> = new Set(REAL_CLUB_NAMES.map(normalizeClubName))

/** True when `name` matches a known real club (diacritics/case-insensitive). */
export function isRealClubName(name: string): boolean {
  return REAL_CLUB_SET.has(normalizeClubName(name))
}

/** Replace `{key}` placeholders in a pattern. Unknown keys are left untouched. */
export function formatPattern(pattern: string, vars: Readonly<Record<string, string>>): string {
  return pattern.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? vars[key] : m))
}
