import { svg, type SVGTemplateResult } from 'lit'
import type { Knoten } from './layout'
import { kantenPfad } from './layout'

/* Erzeugung der SVG-Bausteine: Kanten, Punktanimation, Knoten.

   Inline-Werte gibt es hier ausschließlich für berechnete Geometrie —
   Pfadangaben, Strichbreiten, Positionen. Farben kommen ohne Ausnahme aus
   den Token in styles.ts. */

export const BREITE_MIN = 1.5
export const BREITE_MAX = 7

/** Unter diesem Bezugswert wird nicht weiter herunterskaliert. Ohne ihn
    wäre bei einer 5-Watt-Anlage jede Linie maximal dick. */
export const MASSSTAB_MIN_W = 100

const DAUER_MIN_S = 1.6
const DAUER_MAX_S = 5

export interface Kante {
  von: Knoten
  nach: Knoten
  /** Watt. Kanten unterhalb der Flussschwelle werden gar nicht erst gebaut. */
  wert: number
  /** CSS-Variable der Flussfarbe, z. B. `--spfc-pv`. */
  farbe: string
  /** Beschreibung für die Zusammenfassung des Bildschirmlesers. */
  beschreibung: string
}

export function strichbreite(wert: number, maximalfluss: number): number {
  const bezug = Math.max(maximalfluss, MASSSTAB_MIN_W)
  return Math.min(BREITE_MAX, Math.max(BREITE_MIN, (wert / bezug) * BREITE_MAX))
}

/** Schneller Fluss, schnellerer Punkt — aber gedeckelt, damit die Karte
    ruhig bleibt. */
export function punktDauer(wert: number, maximalfluss: number): number {
  const bezug = Math.max(maximalfluss, MASSSTAB_MIN_W)
  const anteil = Math.min(1, Math.max(0, wert / bezug))
  return DAUER_MAX_S - anteil * (DAUER_MAX_S - DAUER_MIN_S)
}

export function zeichneKante(
  kante: Kante, maximalfluss: number, animation: boolean, index: number,
): SVGTemplateResult {
  const pfad = kantenPfad(kante.von, kante.nach)
  const breite = strichbreite(kante.wert, maximalfluss)
  const id = `spfc-kante-${index}`
  return svg`
    <g style="color: var(${kante.farbe})" aria-hidden="true">
      <path
        id=${id}
        class="kante"
        d=${pfad}
        stroke="currentColor"
        stroke-width=${breite}
        marker-end="url(#spfc-pfeil)"
      ></path>
      ${animation ? svg`
        <circle class="punkt" r=${Math.max(2, breite * 0.7)}>
          <animateMotion
            dur=${`${punktDauer(kante.wert, maximalfluss).toFixed(2)}s`}
            repeatCount="indefinite"
            path=${pfad}
          ></animateMotion>
        </circle>
      ` : null}
    </g>
  `
}

/** Die Pfeilspitze trägt die Flussrichtung auch dann, wenn sich nichts
    bewegt — bei `prefers-reduced-motion` oder abgeschalteter Animation. */
export function pfeilDefinition(): SVGTemplateResult {
  return svg`
    <defs>
      <marker
        id="spfc-pfeil" viewBox="0 0 10 10" refX="8" refY="5"
        markerWidth="5" markerHeight="5" orient="auto-start-reverse"
      >
        <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor"></path>
      </marker>
    </defs>
  `
}

/** Der Ladestandsring um den Batterieknoten. `null` heißt: kein Ring. */
export function socRing(knoten: Knoten, prozent: number | null): SVGTemplateResult | null {
  if (prozent === null) return null
  const radius = knoten.r + 6
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

/** Der Akzentring markiert ein Gerät, das gerade vom HEMS geregelt wird.
    Zustand nie allein über Farbe: ein ruhendes Gerät bekommt zusätzlich
    eine gestrichelte Linie und einen Untertitel. */
export function akzentRing(knoten: Knoten, aktiv: boolean): SVGTemplateResult {
  return svg`
    <circle
      class=${`knoten-ring${aktiv ? '' : ' ruhend'}`}
      cx=${knoten.x} cy=${knoten.y} r=${knoten.r + 4}
      aria-hidden="true"
    ></circle>
  `
}
