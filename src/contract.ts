import {
  UNTERSTUETZTE_SCHEMA_VERSION,
  type FlowConfig, type FlowStatus, type Hass,
} from './types'

/* Liest die beiden Entitäten aus `hass.states` und prüft, ob sich damit
   überhaupt zeichnen lässt. Die einzige Stelle neben power.ts, die `hass`
   kennt — alle folgenden Stufen rechnen auf reinen Daten. */

/** Warum gerade nicht gezeichnet werden kann. `null` heißt: es geht. */
export type VertragsFehler =
  | { art: 'keine_daten' }
  | { art: 'unvollstaendig'; entitaet: string }
  | { art: 'zu_neu'; version: number }

export interface Vertrag {
  config: FlowConfig | null
  status: FlowStatus | null
  fehler: VertragsFehler | null
}

const UNBRAUCHBAR = ['unavailable', 'unknown', '']

export function leseVertrag(
  hass: Hass | null,
  configEntity: string,
  statusEntity: string,
): Vertrag {
  const leer: Vertrag = { config: null, status: null, fehler: { art: 'keine_daten' } }
  if (!hass || !hass.states) return leer

  const configState = hass.states[configEntity]
  if (!configState || UNBRAUCHBAR.includes(configState.state)) return leer

  const config = configState.attributes as FlowConfig | undefined
  if (!config || typeof config !== 'object') {
    return { config: null, status: null, fehler: { art: 'unvollstaendig', entitaet: configEntity } }
  }

  const version = typeof config.schema_version === 'number' ? config.schema_version : 1
  if (version > UNTERSTUETZTE_SCHEMA_VERSION) {
    return { config: null, status: null, fehler: { art: 'zu_neu', version } }
  }

  return { config, status: leseStatus(hass, statusEntity), fehler: null }
}

/** Der Status ist optional: fehlt er, entfallen Abzeichen und Rückfallebene,
    die Karte zeichnet aber vollständig weiter. */
function leseStatus(hass: Hass, statusEntity: string): FlowStatus | null {
  const state = hass.states[statusEntity]
  if (!state || UNBRAUCHBAR.includes(state.state)) return null
  const status = state.attributes as FlowStatus | undefined
  if (!status || typeof status !== 'object') return null

  // Ein Status aus der Zukunft wird ignoriert statt falsch gedeutet. Die
  // Konfiguration trägt die Grafik, der Status nur die Zusatzangaben.
  const version = typeof status.schema_version === 'number' ? status.schema_version : 1
  return version > UNTERSTUETZTE_SCHEMA_VERSION ? null : status
}

/** Jede Entity-ID, die die Karte für diese Konfiguration liest.

    Der `hass`-Setter vergleicht nur diese Menge gegen den vorherigen Zustand.
    Ohne das rendert die Karte bei jeder Zustandsänderung im ganzen Haus neu. */
export function abonnierteEntitaeten(
  config: FlowConfig | null, configEntity: string, statusEntity: string,
): string[] {
  const ids = new Set<string>([configEntity, statusEntity])
  const add = (value?: string | null) => { if (value) ids.add(value) }

  const standard = config?.standard
  for (const entity of standard?.pv_power_entities ?? []) add(entity)
  add(standard?.grid_power_entity)
  add(standard?.grid_import_entity)
  add(standard?.grid_export_entity)
  add(standard?.house_power_entity)

  const batterie = standard?.batterie
  if (batterie) {
    add(batterie.soc_entity)
    add(batterie.power_entity)
    add(batterie.charge_power_entity)
    add(batterie.discharge_power_entity)
  }

  for (const device of config?.devices ?? []) {
    add(device.power_entity)
    add(device.switch_entity)
    add(device.power_actual_entity)
    add(device.phases_entity)
    add(device.charge_power_entity)
    add(device.discharge_power_entity)
    add(device.soc_entity)
    for (const entity of device.voltage_entities ?? []) add(entity)
  }

  return [...ids]
}

/** Hat sich an den abonnierten Entitäten wirklich etwas geändert? */
export function hatSichGeaendert(
  entitaeten: string[], vorher: Record<string, string>, hass: Hass | null,
  statusEntity: string,
): boolean {
  if (!hass) return false
  for (const id of entitaeten) {
    if (kennwert(hass, id, statusEntity) !== (vorher[id] ?? '')) return true
  }
  return false
}

/** Der Zustand der abonnierten Entitäten, zum Vergleich beim nächsten Setter. */
export function zustandsAbzug(
  entitaeten: string[], hass: Hass | null, statusEntity: string,
): Record<string, string> {
  const abzug: Record<string, string> = {}
  for (const id of entitaeten) abzug[id] = hass ? kennwert(hass, id, statusEntity) : ''
  return abzug
}

/** Der Vergleichswert einer Entität.

    Für gewöhnliche Entitäten ist das ihr Zustand. Die Statusentität trägt
    ihre Nutzlast aber in den Attributen, und ihr Zustand (`pool_w`) kann
    gleich bleiben, während sich ein Gerät darin ändert. Für sie zählt
    deshalb zusätzlich der Zykluszeitpunkt — er ist je Zyklus neu. Die
    Konfigurationsentität braucht das nicht: ihr Zustand IST der
    Revisionshash ihrer Nutzlast. */
function kennwert(hass: Hass, id: string, statusEntity: string): string {
  const entity = hass.states[id]
  if (!entity) return ''
  if (id !== statusEntity) return entity.state
  const status = entity.attributes as FlowStatus | undefined
  return `${entity.state}|${status?.last_cycle_at ?? ''}`
}

/** Zeigt dieser Pfad in dieselbe Home-Assistant-Instanz?

    Der Vertrag kommt aus dem eigenen Add-on und prüft dasselbe — die Karte
    springt trotzdem nicht ungeprüft dorthin, wohin ein Attributwert zeigt.
    `//host/…` wäre protokollrelativ, ein Doppelpunkt ließe `http://…` und
    `javascript:…` durch. */
export function istSicheresZiel(pfad: string | undefined | null): boolean {
  if (!pfad) return false
  if (!pfad.startsWith('/') || pfad.startsWith('//')) return false
  if (pfad.includes(':')) return false
  return !/\s/.test(pfad)
}
