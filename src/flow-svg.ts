import { svg, type SVGTemplateResult } from 'lit'
import type { Knoten } from './layout'
import { kantenPfad } from './layout'

/* SVG-Bausteine: Kanten, Punktanimation, Ringe, Richtungspfeile.

   Inline-Werte gibt es hier ausschließlich für berechnete Geometrie —
   Pfadangaben, Positionen, Bogenlängen. Farben kommen ohne Ausnahme aus den
   Token in styles.ts. */

/** Untere und obere Grenze der Punktdauer in Sekunden. Ein kräftiger Fluss
    läuft schnell, ein schwacher zäh — die Leistung steckt in der
    Geschwindigkeit, nicht in der Strichbreite. */
export const DAUER_SCHNELL_S = 0.9
export const DAUER_LANGSAM_S = 6

/** Rasterung der Punktdauer. Ohne sie änderte sich `dur` bei jedem
    Messwert und die Animation begänne von vorn — mehrmals pro Sekunde. */
export const DAUER_RASTER_S = 0.5

/** Ab diesem Betrag gilt eine Kante als fließend. Darunter wird sie gezeichnet,
    aber ausgegraut: das Gerüst der Grafik soll stehen bleiben, statt bei jedem
    Nulldurchgang zu verschwinden. */
export const FLUSS_SCHWELLE_W = 1

export interface Kante {
  von: Knoten
  nach: Knoten
  /** Watt. `0` heißt: Linie zeichnen, aber ohne Punkt und ausgegraut. */
  wert: number
  /** CSS-Variable der Flussfarbe, z. B. `--spfc-pv`. */
  farbe: string
  beschreibung: string
}

/** Punktdauer aus einem **festen** Erwartungsbereich, nicht aus dem gerade
    größten Fluss. Sonst hinge die Geschwindigkeit jeder Linie daran, was
    anderswo in der Anlage passiert. */
export function punktDauer(wert: number, minLeistung: number, maxLeistung: number): number {
  const unten = Math.max(1, minLeistung)
  const oben = Math.max(unten * 2, maxLeistung)
  const anteil = Math.min(1, Math.max(0, (Math.abs(wert) - unten) / (oben - unten)))
  const roh = DAUER_LANGSAM_S - anteil * (DAUER_LANGSAM_S - DAUER_SCHNELL_S)
  return Math.round(roh / DAUER_RASTER_S) * DAUER_RASTER_S
}

export function fliesst(wert: number | null | undefined): boolean {
  return typeof wert === 'number' && Number.isFinite(wert) && Math.abs(wert) >= FLUSS_SCHWELLE_W
}

/** Eine Kante. Strichbreite ist immer 1 — `non-scaling-stroke` hält sie auch
    dann bei einem Bildschirmpunkt, wenn die Karte skaliert wird. */
export function zeichneKante(
  kante: Kante, animation: boolean, minLeistung: number, maxLeistung: number, index: number,
): SVGTemplateResult {
  const pfad = kantenPfad(kante.von, kante.nach)
  const id = `spfc-kante-${index}`
  const aktiv = fliesst(kante.wert)

  return svg`
    <g style=${`color: var(${kante.farbe})`} aria-hidden="true">
      <path
        id=${id}
        class=${`kante${aktiv ? '' : ' ruhend'}`}
        d=${pfad}
        vector-effect="non-scaling-stroke"
      ></path>
      ${aktiv && animation ? svg`
        <circle class="punkt" r="1" vector-effect="non-scaling-stroke">
          <animateMotion
            dur=${`${punktDauer(kante.wert, minLeistung, maxLeistung)}s`}
            repeatCount="indefinite"
            calcMode="paced"
          >
            <mpath href=${`#${id}`}></mpath>
          </animateMotion>
        </circle>
      ` : null}
    </g>
  `
}

/** Ladestandsring um den Speicherknoten. `null` heißt: kein Ring. */
export function socRing(knoten: Knoten, prozent: number | null): SVGTemplateResult | null {
  if (prozent === null) return null
  const radius = knoten.r - 2
  const umfang = 2 * Math.PI * radius
  const gefuellt = (Math.min(100, Math.max(0, prozent)) / 100) * umfang
  return svg`
    <g aria-hidden="true" transform=${`rotate(-90 ${knoten.x} ${knoten.y})`}>
      <circle class="soc-bahn" cx=${knoten.x} cy=${knoten.y} r=${radius}></circle>
      <circle
        class="soc-fuellung" cx=${knoten.x} cy=${knoten.y} r=${radius}
        stroke-dasharray=${`${gefuellt.toFixed(1)} ${(umfang - gefuellt).toFixed(1)}`}
      ></circle>
    </g>
  `
}

export interface HausAnteil {
  /** Anteil am Hausverbrauch, 0…1. */
  anteil: number
  klasse: string
}

/** Der Herkunftsring des Hausknotens: ein Ring, in Bögen nach Quelle geteilt.

    Das ist das Detail, das dem Vorbild sein Aussehen gibt — der Hausknoten
    trägt seine Herkunft, statt ein weiterer grauer Kreis zu sein. */
export function hausRing(knoten: Knoten, anteile: HausAnteil[]): SVGTemplateResult | null {
  const gesamt = anteile.reduce((summe, teil) => summe + Math.max(0, teil.anteil), 0)
  if (gesamt <= 0) return null

  const radius = knoten.r - 2
  const umfang = 2 * Math.PI * radius
  let gelaufen = 0

  return svg`
    <g aria-hidden="true" transform=${`rotate(-90 ${knoten.x} ${knoten.y})`}>
      ${anteile.map((teil) => {
        const laenge = (Math.max(0, teil.anteil) / gesamt) * umfang
        const versatz = -gelaufen
        gelaufen += laenge
        if (laenge <= 0) return null
        return svg`
          <circle
            class=${`haus-anteil ${teil.klasse}`}
            cx=${knoten.x} cy=${knoten.y} r=${radius}
            stroke-dasharray=${`${laenge.toFixed(1)} ${(umfang - laenge).toFixed(1)}`}
            stroke-dashoffset=${versatz.toFixed(1)}
          ></circle>
        `
      })}
    </g>
  `
}

/** Der Akzentring markiert ein Gerät, das gerade vom HEMS geregelt wird.
    Zustand nie allein über Farbe: ein ruhendes Gerät bekommt zusätzlich eine
    gestrichelte Linie und einen Untertitel. */
export function akzentRing(knoten: Knoten, aktiv: boolean): SVGTemplateResult {
  return svg`
    <circle
      class=${`knoten-ring${aktiv ? '' : ' ruhend'}`}
      cx=${knoten.x} cy=${knoten.y} r=${knoten.r + 4}
      aria-hidden="true"
    ></circle>
  `
}

/** Kleiner Richtungspfeil neben einem Wert im Knoten.

    Bewusst ein gezeichnetes Dreieck statt eines Symbols: es bleibt bei 9 px
    scharf, kostet kein weiteres `foreignObject` und trägt die Richtung auch
    dann, wenn sich nichts bewegt (`prefers-reduced-motion`). */
export function richtungsPfeil(
  x: number, y: number, richtung: 'hoch' | 'runter' | 'links' | 'rechts',
): SVGTemplateResult {
  const g = 4
  const punkte: Record<string, string> = {
    hoch: `${x} ${y - g}, ${x - g} ${y + g}, ${x + g} ${y + g}`,
    runter: `${x} ${y + g}, ${x - g} ${y - g}, ${x + g} ${y - g}`,
    links: `${x - g} ${y}, ${x + g} ${y - g}, ${x + g} ${y + g}`,
    rechts: `${x + g} ${y}, ${x - g} ${y - g}, ${x - g} ${y + g}`,
  }
  return svg`<polygon class="pfeil" points=${punkte[richtung]} aria-hidden="true"></polygon>`
}
