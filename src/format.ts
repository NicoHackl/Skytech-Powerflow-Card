/* Anzeigeformate. Was der Nutzer liest, entsteht ausschließlich hier.

   Dezimaltrennzeichen ist das Komma (de-DE). Zeitstempel kommen bereits
   fertig formatiert aus dem Vertrag und werden unverändert übernommen —
   die Karte rechnet keine Zone um und hängt nie ein Kürzel an. */

/** Unbekannt. Ausdrücklich nicht `0 W`. */
export const UNBEKANNT_TEXT = '—'

const WATT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const KILOWATT = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
})

/** Leistung als `W` oder `kW`, je nach Schwelle aus dem Vertrag. */
export function leistung(wert: number | null | undefined, schwelle: number): string {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return UNBEKANNT_TEXT
  const grenze = Number.isFinite(schwelle) && schwelle > 0 ? schwelle : Infinity
  if (Math.abs(wert) >= grenze) return `${KILOWATT.format(wert / 1000)} kW`
  return `${WATT.format(wert)} W`
}

/** Dieselbe Zahl, aber für eine Vorlesestimme: „1,4 Kilowatt" statt „1,4 kW". */
export function leistungGesprochen(wert: number | null | undefined, schwelle: number): string {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return 'kein Wert'
  const grenze = Number.isFinite(schwelle) && schwelle > 0 ? schwelle : Infinity
  if (Math.abs(wert) >= grenze) return `${KILOWATT.format(wert / 1000)} Kilowatt`
  return `${WATT.format(wert)} Watt`
}

export function prozent(wert: number | null | undefined): string {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return UNBEKANNT_TEXT
  return `${Math.round(wert)} %`
}

export function kilowattstunden(wert: number | null | undefined): string {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return UNBEKANNT_TEXT
  return `${KILOWATT.format(wert)} kWh`
}

/** Zeitstempel des Vertrags. Er ist bereits `TT.MM.JJJJ hh:mm:ss` in
    Berliner Zeit — hier wird nichts umgerechnet und nichts angehängt. */
export function zeitpunkt(wert: string | null | undefined): string {
  const text = (wert ?? '').trim()
  return text || UNBEKANNT_TEXT
}

/** Nur die Uhrzeit aus einem Vertragszeitstempel, für knappe Abzeichen. */
export function uhrzeit(wert: string | null | undefined): string {
  const teile = (wert ?? '').trim().split(' ')
  return teile.length === 2 ? (teile[1] ?? '').slice(0, 5) : zeitpunkt(wert)
}
