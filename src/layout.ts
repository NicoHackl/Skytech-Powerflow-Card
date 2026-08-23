/* Geometrie: Knotenpositionen und Kantenpfade.

   Reine Rechnerei ohne DOM — die Testbarkeit hängt daran. Der viewBox wird
   aus der tatsächlichen Knotenzahl gebildet; `preserveAspectRatio` erledigt
   die Skalierung, deshalb braucht die Karte keine Medienabfrage. */

export type KnotenArt = 'pv' | 'netz' | 'haus' | 'batterie' | 'geraet' | 'rest' | 'verteiler'

export interface Knoten {
  id: string
  art: KnotenArt
  x: number
  y: number
  r: number
}

export interface Geometrie {
  breite: number
  hoehe: number
  knoten: Knoten[]
  /** Schriftgröße der Beschriftung, schrumpft bei vielen Geräten. */
  schrift: number
}

export interface LayoutEingabe {
  pv: boolean
  netz: boolean
  batterie: boolean
  hausKnoten: boolean
  geraeteIds: string[]
  /** Ein eigener Knoten für den nicht vom HEMS geregelten Rest. */
  rest: boolean
}

const RADIUS_GROSS = 34
const RADIUS_KLEIN = 26
const SPALTE_X = 300
const SPALTE_ABSTAND = 150
const ZEILE_ABSTAND = 92
const RAND = 60

/** Ab hier zwei Spalten, ab `ENG_AB` zusätzlich kleinere Knoten und Schrift.
    Es wird nie gescrollt und nie abgeschnitten. */
const ZWEI_SPALTEN_AB = 7
const ENG_AB = 13

export function baueGeometrie(eingabe: LayoutEingabe): Geometrie {
  const anzahl = eingabe.geraeteIds.length + (eingabe.rest ? 1 : 0)
  const eng = anzahl >= ENG_AB
  const radius = eng ? RADIUS_KLEIN : RADIUS_GROSS
  const schrift = eng ? 11 : 13

  const knoten: Knoten[] = []

  /* Die linke Hälfte trägt Erzeugung, Netz, Haus und Speicher. Fehlt einer
     davon, rücken die übrigen zusammen — es entsteht kein Loch. */
  const zeilen: KnotenArt[] = []
  if (eingabe.pv) zeilen.push('pv')
  zeilen.push(eingabe.hausKnoten ? 'haus' : 'verteiler')
  if (eingabe.batterie) zeilen.push('batterie')

  const mitteIndex = zeilen.indexOf(eingabe.hausKnoten ? 'haus' : 'verteiler')
  const stammHoehe = (zeilen.length - 1) * ZEILE_ABSTAND
  const stammY = RAND + radius

  zeilen.forEach((art, index) => {
    knoten.push({ id: art, art, x: SPALTE_X, y: stammY + index * ZEILE_ABSTAND, r: radius })
  })

  const mitteY = stammY + mitteIndex * ZEILE_ABSTAND
  if (eingabe.netz) {
    knoten.push({ id: 'netz', art: 'netz', x: SPALTE_X - SPALTE_ABSTAND, y: mitteY, r: radius })
  }

  /* Die Geräte hängen rechts. Bis 6 Einträge eine Spalte, darüber zwei. */
  const rechts: string[] = [...eingabe.geraeteIds]
  if (eingabe.rest) rechts.push('rest')
  const spalten = rechts.length >= ZWEI_SPALTEN_AB ? 2 : 1
  const proSpalte = Math.ceil(rechts.length / spalten) || 1

  rechts.forEach((id, index) => {
    const spalte = Math.floor(index / proSpalte)
    const zeile = index % proSpalte
    knoten.push({
      id,
      art: id === 'rest' ? 'rest' : 'geraet',
      x: SPALTE_X + SPALTE_ABSTAND + spalte * SPALTE_ABSTAND,
      y: RAND + radius + zeile * ZEILE_ABSTAND,
      r: radius,
    })
  })

  const geraeteHoehe = (proSpalte - 1) * ZEILE_ABSTAND
  const hoehe = RAND * 2 + radius * 2 + Math.max(stammHoehe, rechts.length ? geraeteHoehe : 0) + 34
  const rechteKante = SPALTE_X + SPALTE_ABSTAND * (rechts.length ? spalten : 0)
  const breite = rechteKante + radius + RAND

  return { breite, hoehe, knoten, schrift }
}

export function findeKnoten(geometrie: Geometrie, id: string): Knoten | undefined {
  return geometrie.knoten.find((knoten) => knoten.id === id)
}

/** Quadratische Bézierkurve zwischen zwei Knotenrändern.

    Der Kontrollpunkt sitzt auf halber Strecke senkrecht zur Verbindung,
    damit sich Hin- und Rückrichtung zwischen denselben Knoten nicht
    überlagern. */
export function kantenPfad(von: Knoten, nach: Knoten, biegung = 0.16): string {
  const dx = nach.x - von.x
  const dy = nach.y - von.y
  const laenge = Math.hypot(dx, dy) || 1
  const ex = dx / laenge
  const ey = dy / laenge

  const startX = von.x + ex * von.r
  const startY = von.y + ey * von.r
  const endeX = nach.x - ex * nach.r
  const endeY = nach.y - ey * nach.r

  const mitteX = (startX + endeX) / 2
  const mitteY = (startY + endeY) / 2
  const versatz = laenge * biegung
  const kontrollX = mitteX - ey * versatz
  const kontrollY = mitteY + ex * versatz

  return `M ${r(startX)} ${r(startY)} Q ${r(kontrollX)} ${r(kontrollY)} ${r(endeX)} ${r(endeY)}`
}

function r(wert: number): number {
  return Math.round(wert * 10) / 10
}
