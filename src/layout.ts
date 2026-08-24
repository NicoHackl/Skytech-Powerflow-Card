/* Geometrie: Knotenpositionen und Kantenpfade.

   Gerechnet wird in **Bildschirmpunkten**, nicht in einem skalierten
   Koordinatensystem: die viewBox trägt genau die gemessene Kartenbreite. Nur
   so bleibt 12-px-Text auch 12 px groß. Die Vorgängerfassung skalierte die
   ganze Zeichnung auf die Kartenbreite und schrumpfte die Beschriftung dabei
   auf 11,3 px.

   Reine Rechnerei ohne DOM — die Testbarkeit hängt daran. */

export type KnotenArt = 'pv' | 'netz' | 'haus' | 'batterie' | 'geraet' | 'rest' | 'verteiler'

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

export interface Geometrie {
  breite: number
  hoehe: number
  knoten: Knoten[]
}

export interface LayoutEingabe {
  pv: boolean
  netz: boolean
  batterie: boolean
  hausKnoten: boolean
  geraeteIds: string[]
  rest: boolean
  /** Gemessene Breite der Karte. Reicht sie nicht, rücken die Spalten enger. */
  breite: number
}

/* Feste Maße wie im Vorbild — nichts davon skaliert mit der Kartenbreite. */
export const KNOTEN_R = 40
export const SYMBOL_GROESSE = 24
export const SCHRIFT = 12
/** Höhe des Beschriftungsblocks über beziehungsweise unter dem Kreis. */
export const BESCHRIFTUNG_H = 18
export const ECKE = 22
const RAND = 12
const SPALTE_MAX = 150
const SPALTE_MIN = 104
/* Zeilenhöhe = Kreis + Beschriftung + Untertitel + Luft. Sie wird aus dem
   tatsächlichen Textblock gerechnet, nicht geraten: die Vorgängerfassung setzte
   sie fest auf 92 und schob damit jede Wertzeile in den nächsten Knoten. */
const UNTERTITEL_H = 14
const ZEILE = KNOTEN_R * 2 + BESCHRIFTUNG_H + UNTERTITEL_H + 12

/** Ab so vielen Geräten bricht die Geräteliste in eine zweite Spalte um. */
const ZWEI_SPALTEN_AB = 7

export function baueGeometrie(eingabe: LayoutEingabe): Geometrie {
  const rechts = [...eingabe.geraeteIds, ...(eingabe.rest ? ['rest'] : [])]
  const geraeteSpalten = rechts.length >= ZWEI_SPALTEN_AB ? 2 : 1
  const proSpalte = Math.ceil(rechts.length / geraeteSpalten) || 0

  /* Der Stamm trägt Erzeugung, Netz, Haus und Speicher. Fehlt einer davon,
     rücken die übrigen zusammen — es entsteht kein Loch. */
  const stammZeilen = (eingabe.pv ? 1 : 0) + 1 + (eingabe.batterie ? 1 : 0)
  const zeilen = Math.max(stammZeilen, proSpalte, 1)

  const spaltenAnzahl = 3 + (rechts.length ? geraeteSpalten : 0)
  const spalte = spaltenBreite(eingabe.breite, spaltenAnzahl)

  const x = (index: number) => RAND + KNOTEN_R + index * spalte
  const breite = Math.max(eingabe.breite, x(spaltenAnzahl - 1) + KNOTEN_R + RAND)
  const versatzX = Math.max(0, (breite - (x(spaltenAnzahl - 1) + KNOTEN_R + RAND)) / 2)

  const oben = RAND + BESCHRIFTUNG_H
  const y = (zeile: number) => oben + zeile * ZEILE + KNOTEN_R

  const knoten: Knoten[] = []
  const setze = (id: string, art: KnotenArt, spalteIndex: number, zeile: number) => {
    knoten.push({
      id, art,
      x: x(spalteIndex) + versatzX,
      y: y(zeile),
      r: KNOTEN_R,
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
  if (eingabe.batterie) setze('batterie', 'batterie', 1, zeile)

  rechts.forEach((id, index) => {
    const spalteIndex = 3 + Math.floor(index / proSpalte)
    setze(id, id === 'rest' ? 'rest' : 'geraet', spalteIndex,
      geraeteVersatz + (index % proSpalte))
  })

  const hoehe = oben + zeilen * ZEILE + BESCHRIFTUNG_H + RAND
  return { breite, hoehe, knoten }
}

/** Passt der Spaltenabstand nicht in die Karte, wird er enger — bis zu einer
    Grenze, unter der sich die Kreise berühren würden. */
function spaltenBreite(kartenBreite: number, spalten: number): number {
  if (spalten <= 1) return SPALTE_MAX
  const verfuegbar = kartenBreite - 2 * RAND - 2 * KNOTEN_R
  const passend = verfuegbar / (spalten - 1)
  return Math.max(SPALTE_MIN, Math.min(SPALTE_MAX, passend))
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
