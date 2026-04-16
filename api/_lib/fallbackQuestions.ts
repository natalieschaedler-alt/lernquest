/**
 * fallbackQuestions.ts – Generischer Fragen-Pool für AI-Ausfälle
 *
 * 20 Fragen pro Welt-Theme (8 MC + 4 T/F + 4 Memory-Paare + 4 Lückentexte).
 * Wird von api/generate.ts verwendet wenn alle Retry-Versuche scheitern.
 */

// ── Typen (spiegeln das AI-API-Schema wider) ──────────────────

export interface MCQuestion {
  question: string
  correct: string
  wrong: string[]
  difficulty: 1 | 2 | 3
  explanation: string
}

export interface TFQuestion {
  statement: string
  is_true: boolean
  explanation: string
}

export interface MemoryPair {
  term: string
  definition: string
}

export interface FillBlank {
  sentence: string  // enthält genau einmal ___
  answer: string
  hint: string
}

export interface FallbackWorld {
  summary: string
  key_concepts: string[]
  difficulty_overall: number
  multiple_choice: MCQuestion[]
  true_false: TFQuestion[]
  memory_pairs: MemoryPair[]
  fill_blanks: FillBlank[]
}

// ── WATER (Ozean & Naturwissenschaft) ─────────────────────────

const waterFallback: FallbackWorld = {
  summary: 'Grundlegende Konzepte der Ozeanografie und des Wasserkreislaufs.',
  key_concepts: ['Verdunstung', 'Osmose', 'Tiefsee', 'Strömungen', 'pH-Wert'],
  difficulty_overall: 2,
  multiple_choice: [
    { question: 'Welchen Salzgehalt hat Meerwasser durchschnittlich?', correct: 'ca. 3,5 %', wrong: ['ca. 1 %', 'ca. 7 %', 'ca. 10 %'], difficulty: 1, explanation: 'Meerwasser enthält im Durchschnitt rund 35 Gramm Salz pro Liter (3,5 %).' },
    { question: 'Wie heißt die tiefste Stelle der Weltmeere?', correct: 'Marianengraben', wrong: ['Atacamagraben', 'Sundagraben', 'Puerto-Rico-Graben'], difficulty: 1, explanation: 'Der Marianengraben im Pazifik ist mit ca. 11 000 m die tiefste bekannte Stelle.' },
    { question: 'Was treibt die thermohaline Zirkulation an?', correct: 'Dichteunterschiede durch Temperatur und Salzgehalt', wrong: ['Erdrotation allein', 'Mondgravitation', 'Vulkanische Aktivität'], difficulty: 2, explanation: 'Kälteres und salzreicheres Wasser ist dichter und sinkt ab – das erzeugt die globale Tiefenzirkulation.' },
    { question: 'Welcher Prozess wandelt flüssiges Wasser in Wasserdampf um?', correct: 'Verdunstung', wrong: ['Kondensation', 'Sublimation', 'Gefrieren'], difficulty: 1, explanation: 'Bei der Verdunstung nimmt Wasser Energie auf und wechselt in den gasförmigen Zustand.' },
    { question: 'Womit misst man den pH-Wert des Ozeans?', correct: 'pH-Elektrode oder Indikatorfarbstoffe', wrong: ['Barometer', 'Refraktometer', 'Echolot'], difficulty: 2, explanation: 'pH-Elektroden messen die Wasserstoffionenkonzentration und damit den Säuregrad des Wassers.' },
    { question: 'Was bedeutet Biolumineszenz im Meer?', correct: 'Lichterzeugung durch lebende Organismen', wrong: ['Reflexion von Mondlicht', 'Phosphorgehalt im Wasser', 'UV-Strahlung'], difficulty: 2, explanation: 'Viele Meereslebewesen erzeugen durch chemische Reaktionen in ihren Zellen sichtbares Licht.' },
    { question: 'Warum steigt der Meeresspiegel beim Klimawandel?', correct: 'Schmelzendes Eis und Wärmeausdehnung des Wassers', wrong: ['Zunahme von Niederschlägen', 'Tektonische Absenkung der Kontinente', 'Verdunstungsrückgang'], difficulty: 3, explanation: 'Beide Effekte zusammen – thermische Expansion und Schmelzwasser – sind die Hauptursachen.' },
    { question: 'Was versteht man unter der euphotischen Zone?', correct: 'Die lichtdurchflutete Oberflächenschicht bis ca. 200 m Tiefe', wrong: ['Die Schicht ohne Licht ab 1000 m', 'Den Meeresboden', 'Die Übergangszone bei ca. 500 m'], difficulty: 3, explanation: 'In der euphotischen Zone findet Photosynthese statt und leben die meisten Meerespflanzen.' },
  ],
  true_false: [
    { statement: 'Der Pazifik ist der größte Ozean der Erde.', is_true: true, explanation: 'Der Pazifik bedeckt mit rund 165 Mio. km² mehr als ein Drittel der Erdoberfläche.' },
    { statement: 'Salzwasser gefriert bei genau 0 °C.', is_true: false, explanation: 'Salz senkt den Gefrierpunkt – Meerwasser gefriert erst bei ca. −1,8 °C.' },
    { statement: 'Korallen sind Tiere, keine Pflanzen.', is_true: true, explanation: 'Korallen gehören zum Tierstamm der Nesseltiere (Cnidaria), obwohl sie sessil leben.' },
    { statement: 'Der Golfstrom transportiert warmes Wasser von der Karibik nach Europa.', is_true: true, explanation: 'Der Golfstrom ist ein warmer Meeresströmungszweig, der das Klima Westeuropas mildert.' },
  ],
  memory_pairs: [
    { term: 'Osmose', definition: 'Wasserbewegung durch semipermeable Membran zum höheren Salzgehalt hin' },
    { term: 'Phytoplankton', definition: 'Mikroskopische pflanzliche Organismen, Basis der marinen Nahrungskette' },
    { term: 'Gezeiten', definition: 'Wechsel von Ebbe und Flut durch Gravitationswirkung von Mond und Sonne' },
    { term: 'Halocline', definition: 'Schicht mit starkem Salzgehaltsgradienten in der Tiefsee' },
  ],
  fill_blanks: [
    { sentence: 'Die ___  bedeckt etwa 71 % der Erdoberfläche.', answer: 'Weltmeere', hint: 'Gesamtheit der Ozeane' },
    { sentence: 'Beim Wasserkreislauf steigt Wasserdampf auf, kühlt ab und fällt als ___ zurück.', answer: 'Niederschlag', hint: 'Regen, Schnee oder Hagel' },
    { sentence: 'Tiefseeorganismen sind an extremen ___ und Kälte angepasst.', answer: 'Druck', hint: 'physikalische Kraft pro Fläche' },
    { sentence: 'Die ___ ist die Grenzfläche zwischen Süß- und Salzwasser in Flussmündungen.', answer: 'Halocline', hint: 'Salzgehaltssprungschicht' },
  ],
}

// ── CYBER (Informatik & Digitale Welt) ────────────────────────

const cyberFallback: FallbackWorld = {
  summary: 'Grundkonzepte der Informatik: Algorithmen, Netzwerke und Datensicherheit.',
  key_concepts: ['Algorithmus', 'Binärsystem', 'Verschlüsselung', 'Protokoll', 'Bit'],
  difficulty_overall: 2,
  multiple_choice: [
    { question: 'Was ist ein Algorithmus?', correct: 'Eine eindeutige Schritt-für-Schritt-Anleitung zur Lösung eines Problems', wrong: ['Ein Computerchip', 'Eine Programmiersprache', 'Ein Netzwerkprotokoll'], difficulty: 1, explanation: 'Algorithmen beschreiben präzise Abfolgen von Schritten, die zu einem definierten Ergebnis führen.' },
    { question: 'Wie viele Bits hat ein Byte?', correct: '8', wrong: ['4', '16', '32'], difficulty: 1, explanation: 'Ein Byte besteht aus 8 Bits (binären Stellen 0 oder 1).' },
    { question: 'Was macht ein Compiler?', correct: 'Übersetzt Quellcode in Maschinencode', wrong: ['Führt Code direkt aus', 'Verschlüsselt Daten', 'Verwaltet Netzwerkverbindungen'], difficulty: 2, explanation: 'Ein Compiler übersetzt den gesamten Quellcode in Maschinencode, bevor das Programm ausgeführt wird.' },
    { question: 'Was ist das OSI-Modell?', correct: 'Ein 7-Schichten-Referenzmodell für Netzwerkkommunikation', wrong: ['Ein Betriebssystem', 'Eine Programmiersprache', 'Ein Verschlüsselungsstandard'], difficulty: 2, explanation: 'Das OSI-Modell standardisiert Netzwerkkommunikation in 7 Schichten von der Physik bis zur Anwendung.' },
    { question: 'Was versteht man unter Big O Notation?', correct: 'Eine Methode zur Beschreibung der Zeitkomplexität von Algorithmen', wrong: ['Eine Datenbankabfragesprache', 'Ein Netzwerkprotokoll', 'Ein Compilerfehlerformat'], difficulty: 2, explanation: 'Big O beschreibt, wie die Laufzeit eines Algorithmus mit der Eingabegröße n wächst.' },
    { question: 'Was ist ein Stack-Overflow?', correct: 'Speicherüberlauf durch zu viele verschachtelte Funktionsaufrufe', wrong: ['Ein Netzwerkangriff', 'Ein Speicherlesefehler', 'Ein Displayfehler'], difficulty: 2, explanation: 'Jeder Funktionsaufruf belegt Speicher auf dem Call-Stack; zu viele Ebenen füllen diesen auf.' },
    { question: 'Was ist der Unterschied zwischen TCP und UDP?', correct: 'TCP garantiert Zustellung; UDP ist schneller aber unzuverlässig', wrong: ['TCP ist schneller; UDP garantiert Pakete', 'Beide sind identisch', 'TCP ist für WLAN; UDP für Kabel'], difficulty: 3, explanation: 'TCP bestätigt den Empfang jedes Pakets (Handshake), UDP sendet ohne Bestätigung für geringere Latenz.' },
    { question: 'Warum ist symmetrische Verschlüsselung allein im Internet unsicher?', correct: 'Der Schlüssel muss sicher übertragen werden – was ohne asymm. Kryptografie kaum gelingt', wrong: ['Weil Quantencomputer sie sofort brechen', 'Weil symmetrische Verschlüsselung keine Schlüssel nutzt', 'Weil Browser kein AES unterstützen'], difficulty: 3, explanation: 'Das Schlüsselaustauschproblem wird durch asymmetrische Verfahren (z. B. RSA, ECDH) gelöst.' },
  ],
  true_false: [
    { statement: 'Eine IP-Adresse identifiziert eindeutig ein Gerät im Internet.', is_true: false, explanation: 'Durch NAT können viele Geräte hinter einer öffentlichen IP sein; auch DHCP ändert IPs dynamisch.' },
    { statement: 'HTML ist eine Programmiersprache.', is_true: false, explanation: 'HTML ist eine Auszeichnungssprache (Markup Language), keine Programmiersprache – sie enthält keine Logik.' },
    { statement: 'Der binäre Wert 1010 entspricht der Dezimalzahl 10.', is_true: true, explanation: '1×8 + 0×4 + 1×2 + 0×1 = 10.' },
    { statement: 'Ein HTTPS-Zertifikat schützt vor Phishing-Angriffen.', is_true: false, explanation: 'HTTPS verschlüsselt die Verbindung, beweist aber nicht, dass der Server kein Betrüger ist.' },
  ],
  memory_pairs: [
    { term: 'CPU', definition: 'Zentraler Prozessor – führt Rechenanweisungen aus' },
    { term: 'DNS', definition: 'Domain Name System – übersetzt Domainnamen in IP-Adressen' },
    { term: 'API', definition: 'Schnittstelle, über die Programme miteinander kommunizieren' },
    { term: 'Cache', definition: 'Schneller Zwischenspeicher für häufig genutzte Daten' },
  ],
  fill_blanks: [
    { sentence: 'Das Internet basiert auf dem ___ / TCP-Protokollstapel.', answer: 'IP', hint: 'Netzwerkprotokoll, 2 Buchstaben' },
    { sentence: 'Ein ___ ist ein Schadprogramm, das sich selbst repliziert und andere Dateien befällt.', answer: 'Virus', hint: 'Typ von Malware' },
    { sentence: 'Objektorientierte Programmierung fasst Daten und Methoden in ___ zusammen.', answer: 'Klassen', hint: 'Baupläne für Objekte' },
    { sentence: 'Die kürzeste Zeiteinheit bei CPU-Takten ist ein ___.', answer: 'Takt', hint: 'auch: Zyklus' },
  ],
}

// ── FOREST (Biologie & Ökologie) ──────────────────────────────

const forestFallback: FallbackWorld = {
  summary: 'Grundlagen der Ökologie: Ökosysteme, Nahrungsnetze und Photosynthese.',
  key_concepts: ['Photosynthese', 'Nahrungskette', 'Biodiversität', 'Ökosystem', 'Chlorophyll'],
  difficulty_overall: 2,
  multiple_choice: [
    { question: 'Was ist die Hauptfunktion der Photosynthese?', correct: 'Umwandlung von Lichtenergie in chemische Energie (Glukose)', wrong: ['Zellatmung', 'Wasseraufnahme', 'Mineralstoffaufnahme'], difficulty: 1, explanation: 'Bei der Photosynthese nutzen Pflanzen Licht, CO₂ und Wasser zur Synthese von Glukose und Sauerstoff.' },
    { question: 'Welches Pigment ist für die grüne Farbe von Blättern verantwortlich?', correct: 'Chlorophyll', wrong: ['Melanin', 'Carotin', 'Anthocyan'], difficulty: 1, explanation: 'Chlorophyll absorbiert rotes und blaues Licht und reflektiert grünes – deshalb erscheinen Blätter grün.' },
    { question: 'Was ist ein Produzent in einer Nahrungskette?', correct: 'Ein Organismus, der durch Photosynthese eigene Nährstoffe herstellt', wrong: ['Ein Fleischfresser', 'Ein Zersetzer', 'Ein Allesfresser'], difficulty: 1, explanation: 'Produzenten (Pflanzen, Algen) bilden die Basis jeder Nahrungskette durch autotrophe Ernährung.' },
    { question: 'Was beschreibt der Begriff "Biodiversität"?', correct: 'Die Vielfalt der Arten, Gene und Ökosysteme in einem Gebiet', wrong: ['Die Anzahl der Bäume im Wald', 'Die Menge an Biomasse', 'Das Alter eines Waldes'], difficulty: 2, explanation: 'Biodiversität umfasst die genetische Vielfalt, die Artenvielfalt und die Ökosystemvielfalt.' },
    { question: 'Was versteht man unter einem Ökosystem?', correct: 'Lebensgemeinschaft aller Organismen und ihre abiotische Umwelt in einem Gebiet', wrong: ['Eine einzelne Tierart', 'Ein Nationalpark', 'Eine Pflanzengesellschaft ohne Tiere'], difficulty: 2, explanation: 'Ein Ökosystem verbindet die biotischen Faktoren (Lebewesen) mit abiotischen Faktoren (Boden, Wasser, Klima).' },
    { question: 'Welche Rolle spielen Destruenten im Ökosystem?', correct: 'Sie zersetzen abgestorbene organische Substanz und recyceln Nährstoffe', wrong: ['Sie sind die größten Raubtiere', 'Sie konkurrieren mit Produzenten', 'Sie fressen ausschließlich Herbivore'], difficulty: 2, explanation: 'Destruenten (Pilze, Bakterien) schließen den Nährstoffkreislauf, indem sie tote Biomasse abbauen.' },
    { question: 'Warum können Ökosysteme durch den Verlust einer einzigen Schlüsselart kollabieren?', correct: 'Schlüsselarten regulieren andere Populationen; ihr Fehlen löst Kaskadeneffekte aus', wrong: ['Weil Schlüsselarten die größten sind', 'Weil sie kein Futter brauchen', 'Weil Ökosysteme keine Redundanz haben'], difficulty: 3, explanation: 'Das klassische Beispiel: ohne Wölfe explodiert die Hirschpopulation, was Vegetation und Flüsse schädigt.' },
    { question: 'Was unterscheidet einen primären von einem sekundären Sukzessionsprozess?', correct: 'Primär: Besiedelung nackten Substrats; Sekundär: Wiederbesiedlung nach Störung', wrong: ['Primär ist schneller', 'Sekundär beginnt ohne Boden', 'Es gibt keinen Unterschied'], difficulty: 3, explanation: 'Bei der Primärsukzession fehlt Boden und Humus; bei der Sekundärsukzession ist der Boden noch vorhanden.' },
  ],
  true_false: [
    { statement: 'Pilze sind Pflanzen, weil sie im Boden wachsen.', is_true: false, explanation: 'Pilze bilden ein eigenes Reich (Fungi); sie betreiben keine Photosynthese und haben andere Zellwände als Pflanzen.' },
    { statement: 'Regenwälder bedecken etwa 6 % der Landfläche, beherbergen aber über 50 % aller Arten.', is_true: true, explanation: 'Tropische Regenwälder zählen zur artenreichsten Biome der Erde trotz kleiner Fläche.' },
    { statement: 'Alle Pflanzen benötigen direktes Sonnenlicht zum Überleben.', is_true: false, explanation: 'Viele Pflanzen wie Farne oder Moose gedeihen auch im Schatten und benötigen wenig Licht.' },
    { statement: 'Symbiose bedeutet, dass beide Partner von der Beziehung profitieren.', is_true: false, explanation: 'Symbiose ist ein Oberbegriff; Mutualismus ist die Form, bei der beide profitieren – Parasitismus schadet einem Partner.' },
  ],
  memory_pairs: [
    { term: 'Herbivore', definition: 'Pflanzenfresser; primäre Konsumenten in der Nahrungskette' },
    { term: 'Nische', definition: 'Gesamtheit der Umweltbedingungen und Ressourcen, die eine Art nutzt' },
    { term: 'Allelopathie', definition: 'Chemische Hemmung anderer Pflanzen durch Wurzelausscheidungen' },
    { term: 'Trophieebene', definition: 'Stufe in der Nahrungskette: Produzenten, Konsumenten 1./2./3. Ordnung' },
  ],
  fill_blanks: [
    { sentence: 'Pflanzen produzieren bei der Photosynthese ___ als Nebenprodukt.', answer: 'Sauerstoff', hint: 'Gas, das Menschen atmen' },
    { sentence: 'Der ___ ist das Gebiet, in dem ein Organismus natürlich vorkommt.', answer: 'Lebensraum', hint: 'auch: Habitat' },
    { sentence: 'Das Aussterben einer Art kann über Kaskadeneffekte weitere ___ in einem Ökosystem auslösen.', answer: 'Aussterbeereignisse', hint: 'Plural von Aussterbe-...' },
    { sentence: 'Ohne ___ wäre der Kohlenstoffkreislauf unterbrochen.', answer: 'Destruenten', hint: 'Zersetzer und Mineralisierer' },
  ],
}

// ── COSMOS (Astronomie & Physik) ──────────────────────────────

const cosmosFallback: FallbackWorld = {
  summary: 'Grundlagen der Astronomie: Sonnensystem, Galaxien und Kosmologie.',
  key_concepts: ['Lichtjahr', 'Schwarzes Loch', 'Galaxie', 'Supernova', 'Gravitation'],
  difficulty_overall: 2,
  multiple_choice: [
    { question: 'Was ist ein Lichtjahr?', correct: 'Die Strecke, die Licht in einem Jahr zurücklegt (ca. 9,46 × 10¹² km)', wrong: ['Die Zeit, in der ein Stern ein Jahr alt wird', 'Der Durchmesser der Milchstraße', 'Eine Einheit der Helligkeit'], difficulty: 1, explanation: 'Lichtjahre sind Entfernungsmaße; das nächste Sternensystem α Centauri ist ~4,2 Lichtjahre entfernt.' },
    { question: 'Welcher Planet hat die größte Anzahl bekannter Monde?', correct: 'Saturn', wrong: ['Jupiter', 'Uranus', 'Neptun'], difficulty: 1, explanation: 'Saturn hat über 140 bestätigte Monde, knapp vor Jupiter mit ebenfalls über 90.' },
    { question: 'Was ist eine Supernova?', correct: 'Die explosive Endphase eines massereichen Sterns', wrong: ['Eine neue Sternbildung', 'Eine Galaxienkollision', 'Ein Asteroid-Einschlag'], difficulty: 1, explanation: 'Massenreiche Sterne kollabieren am Ende ihres Lebens und explodieren als Supernova – dabei entstehen oft Neutronensterne oder Schwarze Löcher.' },
    { question: 'Was hält die Planeten auf ihren Umlaufbahnen?', correct: 'Gravitation der Sonne kombiniert mit der Eigengeschwindigkeit der Planeten', wrong: ['Magnetfelder der Planeten', 'Dunkle Materie', 'Lichtdruck der Sonne'], difficulty: 2, explanation: 'Die Gravitation der Sonne zieht die Planeten an; ihre Bahngeschwindigkeit verhindert den Absturz – beides zusammen erzeugt die stabile Ellipsenbahn.' },
    { question: 'Was versteht man unter kosmischer Hintergrundstrahlung?', correct: 'Das Nachleuchtsen des Urknalls – Mikrowellenstrahlung aus der Frühzeit des Universums', wrong: ['Strahlung von Quasaren', 'UV-Strahlung der Sonne', 'Magnetfeldstrahlung der Erde'], difficulty: 2, explanation: 'Die CMB (Cosmic Microwave Background) wurde 1965 entdeckt und gilt als stärkstes Indiz für den Urknall.' },
    { question: 'Was ist der Unterschied zwischen einem Stern und einem Planeten?', correct: 'Sterne erzeugen durch Kernfusion Licht; Planeten reflektieren nur fremdes Licht', wrong: ['Sterne sind kleiner als Planeten', 'Planeten haben keine Atmosphäre', 'Sterne sind kälter als Planeten'], difficulty: 2, explanation: 'In Sternen findet Kernfusion statt (Wasserstoff → Helium); Planeten sind zu klein für eigene Fusionsreaktionen.' },
    { question: 'Warum sehen wir weit entfernte Galaxien, wie sie in der Vergangenheit aussahen?', correct: 'Weil Licht endlich schnell ist und für große Distanzen Millionen Jahre braucht', wrong: ['Weil Teleskope die Zeit zurückdrehen', 'Weil das Universum geschlossen ist', 'Wegen gravitativer Linseneffekte'], difficulty: 3, explanation: 'Das Licht einer Galaxie 1 Mrd. Lichtjahre entfernt startete vor 1 Mrd. Jahren – wir sehen ein Vergangenheitsbild.' },
    { question: 'Was ist Dunkle Materie und wie weist man sie nach?', correct: 'Nicht-leuchtende Materie, nachgewiesen durch Gravitationseffekte auf Galaxienrotation', wrong: ['Materie in Schwarzen Löchern', 'Gas zwischen Sternen', 'Antimaterie'], difficulty: 3, explanation: 'Galaxien rotieren schneller als durch sichtbare Masse erklärbar – Dunkle Materie erklärt diese Diskrepanz.' },
  ],
  true_false: [
    { statement: 'Die Sonne ist ein Stern des Spektraltyps G.', is_true: true, explanation: 'Die Sonne ist ein gelber Zwergstern der Spektralklasse G2V.' },
    { statement: 'Auf dem Mars gibt es flüssiges Wasser an der Oberfläche.', is_true: false, explanation: 'Der Mars hat zu geringen Luftdruck; flüssiges Wasser würde sofort verdunsten oder gefrieren.' },
    { statement: 'Das Universum ist etwa 13,8 Milliarden Jahre alt.', is_true: true, explanation: 'Messungen der kosmischen Hintergrundstrahlung und der Ausdehnung des Universums bestätigen dieses Alter.' },
    { statement: 'Licht kann einer Schwarzen-Loch-Singularität entkommen.', is_true: false, explanation: 'Am Ereignishorizont eines Schwarzen Lochs überschreitet die Fluchtgeschwindigkeit die Lichtgeschwindigkeit – kein Licht entkommt.' },
  ],
  memory_pairs: [
    { term: 'Ereignishorizont', definition: 'Grenze eines Schwarzen Lochs, ab der nichts mehr entkommen kann' },
    { term: 'Rotverschiebung', definition: 'Streckung von Lichtwellen durch Entfernung – Indikator für Expansionsgeschwindigkeit' },
    { term: 'Neutronenstern', definition: 'Extrem dichtes Überbleibsel einer Supernova, fast ausschließlich aus Neutronen' },
    { term: 'Parallaxe', definition: 'Methode zur Entfernungsmessung naher Sterne durch scheinbare Positionsverschiebung' },
  ],
  fill_blanks: [
    { sentence: 'Die Milchstraße ist eine ___ Galaxie mit spiralförmigen Armen.', answer: 'Spiralgalaxie', hint: 'Form der Galaxie' },
    { sentence: 'Das ___ besagt, dass sich das Universum seit dem Urknall kontinuierlich ausdehnt.', answer: 'Hubble-Gesetz', hint: 'Benannt nach einem Astronomen' },
    { sentence: 'Bei einem schwarzen Loch ist die ___ so groß, dass selbst Licht nicht entkommen kann.', answer: 'Gravitation', hint: 'fundamentale Kraft' },
    { sentence: 'Merkur ist der ___ Planet unseres Sonnensystems.', answer: 'innerste', hint: 'Position: am nächsten zur Sonne' },
  ],
}

// ── Export-Funktion ───────────────────────────────────────────

const FALLBACK_BY_THEME: Record<string, FallbackWorld> = {
  water:  waterFallback,
  cyber:  cyberFallback,
  forest: forestFallback,
  cosmos: cosmosFallback,
}

/**
 * Gibt den Fallback-Fragenpool für ein bestimmtes World-Theme zurück.
 * Fällt auf das 'cosmos'-Theme zurück wenn das angeforderte Theme unbekannt ist.
 */
export function getFallbackWorld(theme: string): FallbackWorld {
  return FALLBACK_BY_THEME[theme] ?? cosmosFallback
}

/** Alle verfügbaren Fallback-Themes */
export const FALLBACK_THEMES = Object.keys(FALLBACK_BY_THEME)
