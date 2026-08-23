import type { Batterie, Device, FlowStatus, Hass, Standard } from './types'

/* Auflösung der Messwerte nach kontrakt.md, Abschnitt 5 und 6.

   Alle Ergebnisse sind Watt, positiv bedeutet Verbrauch beziehungsweise
   Laden. Neben contract.ts die einzige Stufe, die `hass` kennt. */

export type Quelle = 'direkt' | 'status' | 'unbekannt'

export interface Aufloesung {
  /** Watt. `null` heißt: unbekannt — ausdrücklich nicht `0`. */
  wert: number | null
  quelle: Quelle
}

export const UNBEKANNT: Aufloesung = { wert: null, quelle: 'unbekannt' }

/** Angenommene Spannung je Phase, wenn kein Spannungssensor gesetzt ist. */
export const STANDARD_SPANNUNG_V = 230

const UNGUELTIGE_ZUSTAENDE = new Set(['unavailable', 'unknown', 'none', ''])

/** Ein Zustand gilt als gültig, wenn er sich in eine ENDLICHE Zahl wandeln
    lässt. `unavailable`, `unknown`, `''`, `NaN` und `Infinity` sind ungültig. */
export function zahl(hass: Hass | null, entityId?: string | null): number | null {
  if (!hass || !entityId) return null
  const state = hass.states[entityId]?.state
  if (state === undefined || UNGUELTIGE_ZUSTAENDE.has(String(state).toLowerCase())) return null
  const wert = Number(state)
  return Number.isFinite(wert) ? wert : null
}

/** Ist ein Schalter an? `null` heißt: nicht feststellbar. */
export function schalter(hass: Hass | null, entityId?: string | null): boolean | null {
  if (!hass || !entityId) return null
  const state = hass.states[entityId]?.state
  if (state === undefined) return null
  const text = String(state).toLowerCase()
  if (text === 'on') return true
  if (text === 'off') return false
  return null
}

function direkt(wert: number | null): Aufloesung {
  return wert === null ? UNBEKANNT : { wert, quelle: 'direkt' }
}

/* --------------------------------------------------------------------------
   Geräte
   -------------------------------------------------------------------------- */

/** Die Leistung eines Geräts, mit Rückfallebene.

    Reihenfolge nach kontrakt.md Abschnitt 6, verbindlich:
    Direktwert → `status.devices[id].leistung_w` → unbekannt.
    Ungültig wird niemals zu `0` — eine fehlende Messung sähe sonst aus wie
    ein ausgeschaltetes Gerät, und das ist die gefährlichere Verwechslung. */
export function geraeteLeistung(
  hass: Hass | null, device: Device, status: FlowStatus | null,
): Aufloesung {
  const wert = direktWert(hass, device)
  if (wert.quelle === 'direkt') return wert

  const rueckfall = status?.devices?.[device.id]?.leistung_w
  if (typeof rueckfall === 'number' && Number.isFinite(rueckfall)) {
    return { wert: rueckfall, quelle: 'status' }
  }
  return UNBEKANNT
}

function direktWert(hass: Hass | null, device: Device): Aufloesung {
  switch (device.power_kind) {
    case 'watt':
      return direkt(zahl(hass, device.power_entity))

    case 'ampere':
      return direkt(ampere(hass, device))

    case 'binary_static':
      return binaerStatisch(hass, device)

    case 'battery_split': {
      const laden = zahl(hass, device.charge_power_entity)
      const entladen = zahl(hass, device.discharge_power_entity)
      if (laden === null || entladen === null) return UNBEKANNT
      return { wert: laden - entladen, quelle: 'direkt' }
    }

    case 'battery_signed': {
      const wert = zahl(hass, device.power_entity)
      if (wert === null) return UNBEKANNT
      return { wert: device.power_sign === 'positiv_entladen' ? -wert : wert, quelle: 'direkt' }
    }

    default:
      // Ein unbekannter power_kind ist kein Fehler: der Vertrag erlaubt
      // additive Erweiterungen, und die Karte ignoriert, was sie nicht kennt.
      return UNBEKANNT
  }
}

/** Ampere × Summe der Phasenspannungen.

    Je fehlender oder ungültiger Spannung gilt 230 V, begrenzt auf die
    Phasenzahl. Diese steht in `phases_entity`; ist sie leer, unbrauchbar
    oder kein Wert aus {1, 3}, gilt `phases_fallback`. */
function ampere(hass: Hass | null, device: Device): number | null {
  const strom = zahl(hass, device.power_entity)
  if (strom === null) return null

  const phasen = phasenZahl(hass, device)
  const spannungen = device.voltage_entities ?? []
  let summe = 0
  for (let index = 0; index < phasen; index += 1) {
    const gemessen = zahl(hass, spannungen[index])
    summe += gemessen === null || gemessen <= 0 ? STANDARD_SPANNUNG_V : gemessen
  }
  return strom * summe
}

export function phasenZahl(hass: Hass | null, device: Device): number {
  const gemeldet = zahl(hass, device.phases_entity)
  if (gemeldet === 1 || gemeldet === 3) return gemeldet
  const rueckfall = device.phases_fallback
  return rueckfall === 1 || rueckfall === 3 ? rueckfall : 3
}

/** Schalter `on` → `power_actual_entity`, sonst `static_power_w`.
    Schalter `off` → `0`. Das ist der eine Fall, in dem `0` richtig ist:
    hier ist der Zustand gemessen, nicht abwesend. */
function binaerStatisch(hass: Hass | null, device: Device): Aufloesung {
  const an = schalter(hass, device.switch_entity)
  if (an === null) return UNBEKANNT
  if (!an) return { wert: 0, quelle: 'direkt' }

  const gemessen = zahl(hass, device.power_actual_entity)
  if (gemessen !== null) return { wert: gemessen, quelle: 'direkt' }

  const statisch = device.static_power_w
  if (typeof statisch === 'number' && Number.isFinite(statisch)) {
    return { wert: statisch, quelle: 'direkt' }
  }
  return UNBEKANNT
}

/* --------------------------------------------------------------------------
   Anlagenwerte
   -------------------------------------------------------------------------- */

/** Erzeugung: Summe aller PV-Sensoren.

    Fällt ein einzelner Sensor aus, ist die Summe unbekannt — eine
    Teilsumme sähe aus wie eine gesunkene Erzeugung. Ohne konfigurierten
    Sensor gibt es keinen Erzeugungsknoten, das ist kein Fehler. */
export function pvLeistung(hass: Hass | null, standard: Standard | undefined): Aufloesung {
  const entities = standard?.pv_power_entities ?? []
  if (entities.length === 0) return UNBEKANNT

  let summe = 0
  for (const entity of entities) {
    const wert = zahl(hass, entity)
    if (wert === null) return UNBEKANNT
    summe += wert
  }
  return { wert: summe, quelle: 'direkt' }
}

export interface Richtungen {
  /** Bezug beziehungsweise Laden, immer ≥ 0. */
  hin: Aufloesung
  /** Einspeisung beziehungsweise Entladen, immer ≥ 0. */
  her: Aufloesung
}

/** Netz in Bezug und Einspeisung zerlegt.

    Bei getrennten Sensoren entfällt die Zerlegung — die Beträge werden
    direkt gelesen. */
export function netzLeistung(hass: Hass | null, standard: Standard | undefined): Richtungen {
  const importEntity = standard?.grid_import_entity
  const exportEntity = standard?.grid_export_entity
  if (importEntity || exportEntity) {
    return {
      hin: direkt(betrag(zahl(hass, importEntity))),
      her: direkt(betrag(zahl(hass, exportEntity))),
    }
  }

  const roh = zahl(hass, standard?.grid_power_entity)
  if (roh === null) return { hin: UNBEKANNT, her: UNBEKANNT }
  const signiert = standard?.grid_power_sign === 'positiv_einspeisung' ? -roh : roh
  return zerlege(signiert)
}

/** Batterie in Laden und Entladen zerlegt. */
export function batterieLeistung(hass: Hass | null, batterie: Batterie | null | undefined): Richtungen {
  if (!batterie) return { hin: UNBEKANNT, her: UNBEKANNT }

  const chargeEntity = batterie.charge_power_entity
  const dischargeEntity = batterie.discharge_power_entity
  if (chargeEntity || dischargeEntity) {
    return {
      hin: direkt(betrag(zahl(hass, chargeEntity))),
      her: direkt(betrag(zahl(hass, dischargeEntity))),
    }
  }

  const roh = zahl(hass, batterie.power_entity)
  if (roh === null) return { hin: UNBEKANNT, her: UNBEKANNT }
  const signiert = batterie.power_sign === 'positiv_entladen' ? -roh : roh
  return zerlege(signiert)
}

function zerlege(signiert: number): Richtungen {
  return {
    hin: { wert: signiert > 0 ? signiert : 0, quelle: 'direkt' },
    her: { wert: signiert < 0 ? -signiert : 0, quelle: 'direkt' },
  }
}

/** Getrennte Sensoren sind laut Vertrag immer positiv. Ein negativer Wert
    ist ein Messfehler und wird als Betrag gelesen, nicht als Gegenrichtung —
    sonst zeigte die Karte einen Fluss, den es nicht gibt. */
function betrag(wert: number | null): number | null {
  return wert === null ? null : Math.abs(wert)
}

export function hausLeistung(hass: Hass | null, standard: Standard | undefined): Aufloesung {
  return direkt(zahl(hass, standard?.house_power_entity))
}

export function ladestand(hass: Hass | null, entityId?: string | null): number | null {
  const wert = zahl(hass, entityId)
  if (wert === null) return null
  return Math.min(100, Math.max(0, wert))
}
