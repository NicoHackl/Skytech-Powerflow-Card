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
  name: 'normal', r: 40, symbol: 24, schrift: 12, untertitel: 11,
  spalteMin: 104, spalteMax: 150,
}

export const KOMPAKT: Massstab = {
  name: 'kompakt', r: 30, symbol: 20, schrift: 11, untertitel: 10,
  spalteMin: 78, spalteMax: 104,
}

export const ECKE = 22
const RAND = 12

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
  const zeilenAbstand = mass.schrift + 3
  const innenHoehe = mass.symbol + LUFT_INNEN + mass.schrift + (werte - 1) * zeilenAbstand
  const oben = -innenHoehe / 2

  const werteY: number[] = []
  for (let index = 0; index < werte; index += 1) {
    // Grundlinie: Oberkante des Blocks + Symbol + Luft + eine volle Zeile.
    werteY.push(oben + mass.symbol + LUFT_INNEN + mass.schrift + index * zeilenAbstand)
  }

  // Der Schritt richtet sich nach der GRÖSSEREN der beiden Schriften: er
  // trennt zuerst die Beschriftung vom ersten Untertitel.
  const untertitelSchritt = Math.round(
    Math.max(mass.schrift, mass.untertitel) * ZEILE_FAKTOR)
  const beschriftungY = LUFT_AUSSEN + mass.schrift

  return {
    symbolY: oben + mass.symbol / 2,
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

/** Rechtwinklige Führung mit **einer** gerundeten Ecke.

    Senkrechter Stummel aus dem Knoten, Ecke, waagerechter Lauf in den
    Zielknoten — dieselbe Form wie im Vorbild. Diagonalen gibt es nicht mehr:
    sie kreuzten die Fläche zwischen den Spalten und ließen die Karte unruhig
    wirken. Fluchten zwei Knoten, wird eine gerade Linie gezogen. */
export function kantenPfad(von: Knoten, nach: Knoten): string {
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
  const startY = von.y + hoch * von.r
  const zielX = nach.x - seite * nach.r
  const ecke = Math.min(ECKE, Math.abs(nach.y - startY), Math.abs(zielX - von.x))

  return `M ${r(von.x)} ${r(startY)} `
    + `V ${r(nach.y - hoch * ecke)} `
    + `Q ${r(von.x)} ${r(nach.y)} ${r(von.x + seite * ecke)} ${r(nach.y)} `
    + `H ${r(zielX)}`
}

function r(wert: number): number {
  return Math.round(wert * 10) / 10
}
