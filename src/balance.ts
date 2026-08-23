import type { Aufloesung, Richtungen } from './power'
import { UNBEKANNT } from './power'

/* Bilanzregeln nach plan-card.md.

   Ziel: eine Grafik, die sich nicht widerspricht, auch wenn die Sensoren es
   tun. Reine Funktionen, kein `hass` — deshalb ohne HA-Attrappe testbar. */

export interface GeraetEingabe {
  id: string
  leistung: Aufloesung
}

export interface GeraetFluss {
  id: string
  /** Der aufgelöste Wert, ungedeckelt — er steht am Knoten. */
  leistung: Aufloesung
  /** Der gezeichnete Fluss, gegen die Hausleistung gedeckelt. */
  fluss: number
}

export interface BilanzEingabe {
  pv: Aufloesung
  netz: Richtungen
  batterie: Richtungen
  haus: Aufloesung
  geraete: GeraetEingabe[]
}

/** Was am Kartenkopf zusätzlich gemeldet werden muss. */
export type Hinweis = 'bilanz_unplausibel' | 'geraete_ueber_haus'

export interface Bilanz {
  pv: Aufloesung
  netzbezug: number
  netzeinspeisung: number
  laden: number
  entladen: number
  haus: Aufloesung
  /** Hausverbrauch abzüglich der HEMS-Geräte. */
  uebrigesHaus: number
  geraete: GeraetFluss[]

  pvInsHaus: number
  pvInBatterie: number
  pvInsNetz: number
  netzInsHaus: number
  netzInBatterie: number
  batterieInsHaus: number

  hinweise: Hinweis[]
}

/** Eine Kante wird nur gezeichnet, wenn sie tatsächlich fließt. Werte
    unterhalb dieser Schwelle sind Rundungsrauschen; eine Karte voller
    Nulllinien ist unlesbar. */
export const FLUSS_SCHWELLE_W = 1

export function berechneBilanz(eingabe: BilanzEingabe): Bilanz {
  const hinweise: Hinweis[] = []

  const pvWert = eingabe.pv.wert
  const netzbezug = eingabe.netz.hin.wert ?? 0
  const netzeinspeisung = eingabe.netz.her.wert ?? 0
  const laden = eingabe.batterie.hin.wert ?? 0
  const entladen = eingabe.batterie.her.wert ?? 0

  const haus = hausLeistung(eingabe, pvWert, netzbezug, netzeinspeisung, laden, entladen, hinweise)
  const hausWert = haus.wert

  const geraete = deckele(eingabe.geraete, hausWert, hinweise)
  const geraeteSumme = geraete.reduce((summe, geraet) => summe + geraet.fluss, 0)
  const uebrigesHaus = hausWert === null ? 0 : Math.max(0, hausWert - geraeteSumme)

  // Herkunft der Hausleistung: erst PV, dann Batterie, dann Netz. Die
  // Reihenfolge ist Konvention und macht die Grafik über Zyklen hinweg
  // vergleichbar.
  const basis = hausWert ?? 0
  const pvInsHaus = Math.min(Math.max(pvWert ?? 0, 0), basis)
  const rest = basis - pvInsHaus
  const batterieInsHaus = Math.min(entladen, rest)
  const netzInsHaus = Math.max(0, rest - batterieInsHaus)

  // Verbleib der Erzeugung.
  const pvUebrig = Math.max(0, (pvWert ?? 0) - pvInsHaus)
  const pvInBatterie = Math.min(pvUebrig, laden)
  const pvInsNetz = Math.max(0, pvUebrig - pvInBatterie)
  const netzInBatterie = Math.max(0, laden - pvInBatterie)

  return {
    pv: eingabe.pv,
    netzbezug, netzeinspeisung, laden, entladen,
    haus, uebrigesHaus, geraete,
    pvInsHaus, pvInBatterie, pvInsNetz, netzInsHaus, netzInBatterie, batterieInsHaus,
    hinweise,
  }
}

/** Ist ein Hausensor gesetzt und gültig, gilt sein Wert. Sonst wird
    gerechnet — und ein negatives Ergebnis auf 0 geklemmt und gemeldet,
    statt eine unmögliche Bilanz zu zeichnen. */
function hausLeistung(
  eingabe: BilanzEingabe,
  pv: number | null, netzbezug: number, netzeinspeisung: number,
  laden: number, entladen: number,
  hinweise: Hinweis[],
): Aufloesung {
  if (eingabe.haus.wert !== null) return eingabe.haus

  // Ohne Erzeugungswert lässt sich die Bilanz nicht bilden. Sie zu raten
  // wäre schlimmer als sie offen unbekannt zu lassen.
  if (pv === null && eingabe.netz.hin.wert === null) return UNBEKANNT

  const gerechnet = (pv ?? 0) + netzbezug + entladen - netzeinspeisung - laden
  if (gerechnet < 0) {
    hinweise.push('bilanz_unplausibel')
    return { wert: 0, quelle: 'direkt' }
  }
  return { wert: gerechnet, quelle: 'direkt' }
}

/** Die HEMS-Geräte sind Teil der Hauslast. Werden sie zusätzlich zum
    Hausknoten gezeichnet, erscheint mehr Verbrauch als vorhanden.

    Übersteigt ihre Summe die Hausleistung, werden die Flüsse PROPORTIONAL
    gekürzt und der Kopf bekennt es. Ohne diesen Hinweis sähe die Karte
    richtig aus, obwohl sie es nicht ist. */
function deckele(
  geraete: GeraetEingabe[], haus: number | null, hinweise: Hinweis[],
): GeraetFluss[] {
  // Unbekannte Geräte zählen mit 0 in die Summe, bleiben aber Knoten:
  // sonst verschwänden sie scheinbar aus der Anlage.
  const roh = geraete.map((geraet) => Math.max(0, geraet.leistung.wert ?? 0))
  const summe = roh.reduce((a, b) => a + b, 0)

  if (haus === null || summe <= haus || summe === 0) {
    return geraete.map((geraet, index) => ({
      id: geraet.id, leistung: geraet.leistung, fluss: roh[index] ?? 0,
    }))
  }

  hinweise.push('geraete_ueber_haus')
  const faktor = haus / summe
  return geraete.map((geraet, index) => ({
    id: geraet.id, leistung: geraet.leistung, fluss: (roh[index] ?? 0) * faktor,
  }))
}

/** Wird diese Kante gezeichnet? */
export function fliesst(wert: number | null | undefined): boolean {
  return typeof wert === 'number' && Number.isFinite(wert) && wert >= FLUSS_SCHWELLE_W
}
