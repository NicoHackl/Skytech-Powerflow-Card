/* Geometrie: Maßstab, Knotenpositionen und Kantenpfade.

   Gerechnet wird in **Bildschirmpunkten**, nicht in einem skalierten
   Koordinatensystem: die viewBox trägt genau die gemessene Kartenbreite.

   Damit das auch auf einer schmalen Karte trägt, gibt es zwei Maßstäbe. Passt
   der normale nicht in die gemessene Breite, gilt der kompakte — die Karte
   wird also kleiner gezeichnet statt als Ganzes herunterskaliert. Wird
   skaliert, schrumpft die Schrift mit: bei 340 px Karte fiel sie so von 12 auf
   8,5 px, und Symbol, Wert und Beschriftung liefen ineinander.

   Reine Rechnerei ohne DOM — die Testbarkeit hängt daran. */

export type KnotenArt =
  | 'pv' | 'netz' | 'haus' | 'batterie' | 'geraet' | 'rest' | 'verteiler'
  /** AC-Speicher aus der Geräteliste — steht beim Hausspeicher, nicht bei den
      Verbrauchern, weil er das Haus auch speisen kann. */
  | 'speicher'

/** Wo die Beschriftung steht. Über dem Kreis in der obersten Reihe, damit sie
    nicht zwischen Knoten und abgehender Linie liegt — wie im Vorbild. */
export type BeschriftungsSeite = 'oben' | 'unten'

export interface Knoten {
  id: string
  art: KnotenArt
  x: number
  y: number
  r: number
  beschriftung: BeschriftungsSeite
}

/** Alle Maße einer Darstellungsgröße. Nichts davon skaliert mit der
    Kartenbreite — gewechselt wird der ganze Satz. */
export interface Massstab {
  name: 'normal' | 'kompakt'
  r: number
  symbol: number
  /** Wert im Knoten und Beschriftung darunter. */
  schrift: number
  untertitel: number
  spalteMin: number
  spalteMax: number
}

export interface Geometrie {
  breite: number
  hoehe: number
  knoten: Knoten[]
  mass: Massstab
  /** Tatsächlicher Abstand der Spaltenmitten. Grundlage dafür, wie breit eine
      Beschriftung werden darf, ohne die Nachbarspalte zu berühren. */
  spalte: number
}

export interface LayoutEingabe {
  pv: boolean
  netz: boolean
  batterie: boolean
  hausKnoten: boolean
  /** Verbraucher. AC-Speicher gehören NICHT hierher. */
  geraeteIds: string[]
  /** AC-Speicher, in der Reihenfolge des Vertrags. */
  speicherIds?: string[]
  rest: boolean
  /** Gemessene Breite der Karte. Sie entscheidet über den Maßstab. */
  breite: number
}

export const NORMAL: Massstab = {
  name: 'normal', r: 46, symbol: 28, schrift: 14, untertitel: 12,
  spalteMin: 112, spalteMax: 160,
}

export const KOMPAKT: Massstab = {
  name: 'kompakt', r: 32, symbol: 21, schrift: 12, untertitel: 11,
  spalteMin: 80, spalteMax: 112,
}

export const ECKE = 22
const RAND = 12

/** Abstand, den eine Beschriftung zum senkrechten Korridor der Kanten hält.

    Der Korridor liegt auf halber Strecke zwischen zwei Spaltenmitten, also bei
    ±`spalte/2`; eine Beschriftung darf deshalb höchstens `spalte − 2·LUFT`
    breit werden. Damit die Untergrenze „mindestens so breit wie der Knoten"
    das nicht wieder aufhebt, erfüllen beide Maßstäbe
    `spalteMin ≥ 2·r + 2·LUFT_KORRIDOR`. */
export const LUFT_KORRIDOR = 8

/** Mittlere Zeichenbreite je Schriftgröße. Grundlage fürs Kürzen und für die
    Prüfung, ob ein Wert noch in den Kreis passt — SVG-Text kann weder von
    selbst auslassen noch von selbst kleiner werden. Fest auf 12 px zu
    kalibrieren ginge im kompakten Maßstab daneben. */
const ZEICHEN_FAKTOR = 0.53

export function zeichenBreite(schrift: number): number {
  return schrift * ZEICHEN_FAKTOR
}

/** Breite, die ein Richtungspfeil samt Abstand neben einem Wert belegt. */
export const PFEIL_PLATZ = 10

/** So stark schrumpft das Symbol, wenn ein Knoten **zwei** Werte trägt.

    Zwei Zeilen drücken die untere Grundlinie sonst so tief in den Kreis, dass
    daneben keine Zahl mehr Platz hat: im kompakten Maßstab blieben dort 31 px
    Sehne, „231 W" mit Pfeil braucht 42. Das Symbol ist Schmuck, die Zahlen
    sind die Aussage — also weicht das Symbol. */
const SYMBOL_FAKTOR_MEHRWERT = 0.65

/** Mindestabstand zwischen Symbol und Wert **im** Knoten. Darunter lesen sich
    die beiden als ein Klumpen — gemessen waren es 1,4 px. */
export const LUFT_INNEN = 6

/** Mindestabstand zwischen Kreisrand und Beschriftung darunter. */
export const LUFT_AUSSEN = 6

/** Zeilenabstand als Vielfaches der Schriftgröße. Bei knapp über 1 berühren
    sich Unterlängen und Oberlängen zweier Zeilen — gemessen überlappten
    Beschriftung und Untertitel bei einem Abstand von 12 px auf 11-px-Schrift. */
const ZEILE_FAKTOR = 1.35

/** So viele Untertitelzeilen hält jede Zeile frei. Zwei, weil die
    Erzeugungs-Aufschlüsselung so viele braucht. */
const UNTERTITEL_ZEILEN = 2

/** Ab so vielen Geräten bricht die Geräteliste in eine zweite Spalte um. */
const ZWEI_SPALTEN_AB = 7

/* --------------------------------------------------------------------------
   Knoteninhalt
   -------------------------------------------------------------------------- */

export interface KnotenInhalt {
  /** Kantenlänge des Symbols. Bei zwei Werten kleiner als `mass.symbol`. */
  symbol: number
  /** Mitte des Symbols, relativ zur Knotenmitte. */
  symbolY: number
  /** Grundlinien der Werte, relativ zur Knotenmitte. */
  werteY: number[]
  /** Grundlinie der Beschriftung, relativ zum Kreisrand. */
  beschriftungY: number
  /** Zeilenabstand der Untertitel. */
  untertitelSchritt: number
  /** Gesamthöhe des Textblocks außerhalb des Kreises. */
  textBlock: number
}

/** Wo Symbol, Werte und Beschriftung eines Knotens sitzen.

    Der Inhalt wird auf der Knotenmitte **zentriert**, statt mit festen
    Versätzen gesetzt. Nur so stimmen die Abstände in beiden Maßstäben und bei
    einem wie bei zwei Werten je Knoten. Die Vorgängerfassung streute die
    Versätze als Zahlen durch den Render; keine davon kannte die Schriftgröße,
    und keine war geprüft. */
export function knotenInhalt(mass: Massstab, anzahlWerte: number): KnotenInhalt {
  const werte = Math.max(1, anzahlWerte)
  const symbol = werte > 1 ? Math.round(mass.symbol * SYMBOL_FAKTOR_MEHRWERT) : mass.symbol
  const zeilenAbstand = mass.schrift + 3
  const innenHoehe = symbol + LUFT_INNEN + mass.schrift + (werte - 1) * zeilenAbstand
  const oben = -innenHoehe / 2

  const werteY: number[] = []
  for (let index = 0; index < werte; index += 1) {
    // Grundlinie: Oberkante des Blocks + Symbol + Luft + eine volle Zeile.
    werteY.push(oben + symbol + LUFT_INNEN + mass.schrift + index * zeilenAbstand)
  }

  // Der Schritt richtet sich nach der GRÖSSEREN der beiden Schriften: er
  // trennt zuerst die Beschriftung vom ersten Untertitel.
  const untertitelSchritt = Math.round(
    Math.max(mass.schrift, mass.untertitel) * ZEILE_FAKTOR)
  const beschriftungY = LUFT_AUSSEN + mass.schrift

  return {
    symbol,
    symbolY: oben + symbol / 2,
    werteY,
    beschriftungY,
    untertitelSchritt,
    textBlock: beschriftungY + UNTERTITEL_ZEILEN * untertitelSchritt,
  }
}

/* --------------------------------------------------------------------------
   Anordnung
   -------------------------------------------------------------------------- */

export function baueGeometrie(eingabe: LayoutEingabe): Geometrie {
  const rechts = [...eingabe.geraeteIds, ...(eingabe.rest ? ['rest'] : [])]
  const geraeteSpalten = rechts.length >= ZWEI_SPALTEN_AB ? 2 : 1
  const proSpalte = Math.ceil(rechts.length / geraeteSpalten) || 0
  const spaltenAnzahl = 3 + (rechts.length ? geraeteSpalten : 0)

  // Passt der normale Maßstab nicht, wird der kompakte gezeichnet — nicht der
  // normale verkleinert. Eine verkleinerte Zeichnung nimmt die Schrift mit.
  const mass = mindestBreite(NORMAL, spaltenAnzahl) <= eingabe.breite ? NORMAL : KOMPAKT

  /* Der Stamm trägt Erzeugung, Netz, Haus und die Speicher. Fehlt einer
     davon, rücken die übrigen zusammen — es entsteht kein Loch. */
  const speicherIds = eingabe.speicherIds ?? []
  const stammZeilen = (eingabe.pv ? 1 : 0) + 1 + (eingabe.batterie ? 1 : 0)
    + speicherIds.length
  const zeilen = Math.max(stammZeilen, proSpalte, 1)

  const spalte = spaltenBreite(mass, eingabe.breite, spaltenAnzahl)
  const inhalt = knotenInhalt(mass, 1)
  const zeilenHoehe = mass.r * 2 + inhalt.textBlock + 12

  const x = (index: number) => RAND + mass.r + index * spalte
  const gebraucht = x(spaltenAnzahl - 1) + mass.r + RAND
  const breite = Math.max(eingabe.breite, gebraucht)
  const versatzX = Math.max(0, (breite - gebraucht) / 2)

  const oben = RAND + inhalt.textBlock
  const y = (zeile: number) => oben + zeile * zeilenHoehe + mass.r

  const knoten: Knoten[] = []
  const setze = (id: string, art: KnotenArt, spalteIndex: number, zeile: number) => {
    knoten.push({
      id, art,
      x: x(spalteIndex) + versatzX,
      y: y(zeile),
      r: mass.r,
      beschriftung: zeile === 0 ? 'oben' : 'unten',
    })
  }

  // Kürzere Gruppe mittig zur längeren setzen, statt sie oben anzukleben.
  const stammVersatz = Math.floor((zeilen - stammZeilen) / 2)
  const geraeteVersatz = Math.floor((zeilen - proSpalte) / 2)

  let zeile = stammVersatz
  if (eingabe.pv) setze('pv', 'pv', 1, zeile++)
  const mitteZeile = zeile
  if (eingabe.netz) setze('netz', 'netz', 0, mitteZeile)
  setze(eingabe.hausKnoten ? 'haus' : 'verteiler',
    eingabe.hausKnoten ? 'haus' : 'verteiler', 2, mitteZeile)
  zeile += 1
  if (eingabe.batterie) setze('batterie', 'batterie', 1, zeile++)
  // Die AC-Speicher stehen unter dem Hausspeicher, in derselben Spalte. Ist
  // keiner konfiguriert, rücken sie an dessen Stelle.
  for (const id of speicherIds) setze(id, 'speicher', 1, zeile++)

  rechts.forEach((id, index) => {
    const spalteIndex = 3 + Math.floor(index / proSpalte)
    setze(id, id === 'rest' ? 'rest' : 'geraet', spalteIndex,
      geraeteVersatz + (index % proSpalte))
  })

  const hoehe = oben + zeilen * zeilenHoehe + inhalt.textBlock + RAND
  return { breite, hoehe, knoten, mass, spalte }
}

/** Wie breit die Karte mindestens sein muss, damit dieser Maßstab ohne
    Verkleinerung trägt. */
export function mindestBreite(mass: Massstab, spalten: number): number {
  return 2 * RAND + 2 * mass.r + Math.max(0, spalten - 1) * mass.spalteMin
}

/** Passt der Spaltenabstand nicht in die Karte, wird er enger — bis zu einer
    Grenze, unter der sich die Kreise berühren würden. */
function spaltenBreite(mass: Massstab, kartenBreite: number, spalten: number): number {
  if (spalten <= 1) return mass.spalteMax
  const verfuegbar = kartenBreite - 2 * RAND - 2 * mass.r
  const passend = verfuegbar / (spalten - 1)
  return Math.max(mass.spalteMin, Math.min(mass.spalteMax, passend))
}

export function findeKnoten(geometrie: Geometrie, id: string): Knoten | undefined {
  return geometrie.knoten.find((knoten) => knoten.id === id)
}

/** Rechtwinklige Führung: seitlich aus dem Knoten, senkrecht durch den
    Zwischenraum, seitlich in den Zielknoten.

    Der senkrechte Lauf liegt **nicht** auf der Knotenmitte, sondern auf halber
    Strecke zwischen den beiden Kreisrändern. Das ist der Kern: die Beschriftung
    steht auf der Knotenmitte, und eine dort abgehende Linie lief mitten durch
    sie hindurch — gemessen an der laufenden Anlage für Batterie, Haus und Netz.

    Der Korridor liegt eine **halbe Spalte** neben der Quelle. Für benachbarte
    Spalten ist das genau die Mitte dazwischen; überspringt eine Kante eine
    Spalte, bleibt sie trotzdem dicht an der Quelle, statt auf der übersprungenen
    Spaltenmitte zu landen — dort stünde deren Beschriftung.

    Alle Kanten, die denselben Knoten zur selben Seite verlassen, teilen sich
    damit eine Senkrechte: der gemeinsame Ausgang des Hauses zu allen
    Überschussverbrauchern entsteht aus der Formel, nicht aus einer Sonderregel.

    Diagonalen gibt es nicht. Fluchten zwei Knoten, wird gerade gezogen. */
export function kantenPfad(von: Knoten, nach: Knoten, spalte?: number): string {
  const dx = nach.x - von.x
  const dy = nach.y - von.y

  if (Math.abs(dy) < 1) {
    const richtung = Math.sign(dx) || 1
    return `M ${r(von.x + richtung * von.r)} ${r(von.y)} `
      + `H ${r(nach.x - richtung * nach.r)}`
  }

  if (Math.abs(dx) < 1) {
    const richtung = Math.sign(dy) || 1
    return `M ${r(von.x)} ${r(von.y + richtung * von.r)} `
      + `V ${r(nach.y - richtung * nach.r)}`
  }

  const hoch = Math.sign(dy)
  const seite = Math.sign(dx)
  const startX = von.x + seite * von.r
  const zielX = nach.x - seite * nach.r
  const korridor = korridorX(von, nach, spalte)
  const ecke = Math.min(
    ECKE,
    Math.abs(korridor - startX),
    Math.abs(zielX - korridor),
    Math.abs(dy) / 2,
  )

  return `M ${r(startX)} ${r(von.y)} `
    + `H ${r(korridor - seite * ecke)} `
    + `Q ${r(korridor)} ${r(von.y)} ${r(korridor)} ${r(von.y + hoch * ecke)} `
    + `V ${r(nach.y - hoch * ecke)} `
    + `Q ${r(korridor)} ${r(nach.y)} ${r(korridor + seite * ecke)} ${r(nach.y)} `
    + `H ${r(zielX)}`
}

/** Auf welcher Senkrechten die Kante zwischen diesen beiden Knoten läuft.

    Ohne `spalte` — in Tests und beim Zeichnen einzelner Kanten — gilt die Mitte
    zwischen beiden Knoten. Ist der Spaltenabstand bekannt, wird höchstens eine
    halbe Spalte von der Quelle abgerückt: sonst landete eine Kante, die eine
    Spalte überspringt, genau auf deren Beschriftung. */
export function korridorX(von: Knoten, nach: Knoten, spalte?: number): number {
  const seite = Math.sign(nach.x - von.x)
  const halbeStrecke = Math.abs(nach.x - von.x) / 2
  const abstand = spalte === undefined ? halbeStrecke : Math.min(halbeStrecke, spalte / 2)
  return von.x + seite * abstand
}

/** Größter Schriftgrad ≤ `basis`, bei dem `zeichen` Zeichen samt Pfeil auf der
    Grundlinie `grundlinie` noch zwischen die Kreisränder passen.

    Der Kreis wird nach unten hin schmal. Bei zwei Werten liegt die zweite
    Grundlinie so tief, dass die Sehne dort nur einen Bruchteil des
    Durchmessers misst — ohne diese Prüfung ragte die Zahl über den Rand. */
export function wertSchrift(
  zeichen: number, mitPfeil: boolean, radius: number, grundlinie: number, basis: number,
): number {
  // Unter diesen Grad wird nicht verkleinert: lieber eine Zahl, die den Kreis
  // um ein Haar überschreitet, als eine, die niemand mehr liest.
  const untergrenze = Math.max(1, basis - 2)
  for (let schrift = basis; schrift > untergrenze; schrift -= 0.5) {
    if (passtInKreis(zeichen, mitPfeil, radius, grundlinie, schrift)) return schrift
  }
  return untergrenze
}

function passtInKreis(
  zeichen: number, mitPfeil: boolean, radius: number, grundlinie: number, schrift: number,
): boolean {
  // Maßgeblich ist die Unterkante der Zahl, nicht ihre Grundlinie.
  const unterkante = Math.abs(grundlinie) + schrift * 0.25
  if (unterkante >= radius) return false
  const sehne = 2 * Math.sqrt(radius * radius - unterkante * unterkante)
  return zeichen * zeichenBreite(schrift) + (mitPfeil ? PFEIL_PLATZ : 0) <= sehne
}

/** SVG-Text kann nicht von selbst auslassen. Gekürzt wird deshalb hier, nach
    einer mittleren Zeichenbreite — der volle Text steht im `<title>`. */
export function kuerze(text: string, maxBreite: number, schrift: number): string {
  const zeichen = Math.floor(maxBreite / zeichenBreite(schrift))
  if (text.length <= zeichen) return text
  return `${text.slice(0, Math.max(1, zeichen - 1)).trimEnd()}…`
}

/** Wie breit eine Beschriftung unter diesem Knoten werden darf, ohne den
    senkrechten Korridor der Kanten zu berühren. */
export function beschriftungsBreite(mass: Massstab, spalte: number): number {
  return Math.max(mass.r * 2, spalte - 2 * LUFT_KORRIDOR)
}

function r(wert: number): number {
  return Math.round(wert * 10) / 10
}
