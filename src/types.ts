/* Der Datenvertrag zum Skytech HEMS als TypeScript-Typen.

   Autoritativ ist vertrag_powerflow_card_hems/kontrakt.md — bei jeder
   Abweichung gilt der Vertrag, nicht diese Datei. Die Feldnamen werden
   deshalb wortgleich übernommen, auch wo sie deutsch sind (`anzeige`,
   `farbe`, `reihenfolge`, `leistung_w`).

   Alle Felder sind optional getippt, wo der Erzeuger sie weglassen darf: die
   Karte muss mit einer unvollständigen Nutzlast umgehen können, statt beim
   ersten fehlenden Feld auszusteigen. */

/** Höchste `schema_version`, die diese Karte lesen kann. */
export const UNTERSTUETZTE_SCHEMA_VERSION = 1

export type GridPowerSign = 'positiv_bezug' | 'positiv_einspeisung'
export type BatteryPowerSign = 'positiv_laden' | 'positiv_entladen'

/** Wie sich die Leistung eines Geräts ermitteln lässt. Der Erzeuger setzt den
    Wert autoritativ; die Karte leitet ihn NICHT aus `class` ab, weil dieselbe
    Klasse verschiedene Varianten haben kann. */
export type PowerKind =
  | 'watt' | 'ampere' | 'binary_static' | 'battery_split' | 'battery_signed'

export interface Anzeige {
  titel?: string
  /** Ab diesem Betrag zeigt die Karte kW statt W. */
  watt_schwelle?: number
  animation?: boolean
  haus_knoten_anzeigen?: boolean
  /** Obergrenze des Erwartungsbereichs für die Punktgeschwindigkeit. Additiv
      ergänzt; fehlt sie, nimmt die Karte einen Standardwert an. */
  max_erwartete_leistung_w?: number
  /** CSS-Farbe des Freigabe-Rings eines freigegebenen Geräts. Additiv ergänzt;
      leer oder fehlend = der weiße Standardwert. Der graue gestrichelte Ring
      eines gesperrten Geräts bleibt davon unberührt. */
  freigabe_ring_farbe?: string
}

export interface Batterie {
  label?: string
  navigation?: string
  soc_entity?: string
  capacity_kwh?: number | null
  /** Variante A. Es gilt entweder dies oder das Paar unten, nie beides. */
  power_entity?: string
  power_sign?: BatteryPowerSign | string
  /** Variante B. */
  charge_power_entity?: string
  discharge_power_entity?: string
}

export interface Standard {
  /** Wird summiert. Leer heißt: kein Erzeugungsknoten. */
  pv_power_entities?: string[]
  /** Wird ausdrücklich **nicht** summiert: nur Aufschlüsselung am Knoten.
      So lassen sich Systemleistung und einzelne Strings nebeneinander
      eintragen, ohne die Erzeugung zu verdoppeln. */
  pv_detail_entities?: string[]
  pv_label?: string
  grid_power_entity?: string
  grid_power_sign?: GridPowerSign | string
  grid_import_entity?: string
  grid_export_entity?: string
  grid_label?: string
  /** Leer heißt: die Karte rechnet die Hausleistung selbst aus. */
  house_power_entity?: string
  house_label?: string

  /* Navigationsziele je Knoten. Leer heißt: Klick öffnet den More-Info-Dialog.
     Zulässig ist nur ein Pfad innerhalb derselben HA-Instanz — die Karte prüft
     das selbst, siehe `istSicheresZiel()`. */
  pv_navigation?: string
  grid_navigation?: string
  house_navigation?: string
  rest_navigation?: string
  /** `null` oder fehlend heißt: kein Batterieknoten. */
  batterie?: Batterie | null
}

/** Die Steuer-Helfer des HEMS, ausgeschrieben. Ein leerer Wert heißt
    „gibt es nicht" — die Karte setzt niemals einen Namen aus Präfixen
    zusammen. */
export interface DeviceControl {
  freigabe?: string
  technische_freigabe?: string
  modus?: string
  prioritat?: string
  anforderung?: string
}

export interface Device {
  /** Die einzige Identität. Zustände hängen hieran, nie an `label` oder an
      der Position im Array. */
  id: string
  label?: string
  class?: 'controllable' | 'binary' | 'battery' | string
  power_kind?: PowerKind | string
  icon?: string
  farbe?: string
  /** Dashboard-Ansicht, auf die ein Klick auf diesen Knoten springt. */
  navigation?: string
  reihenfolge?: number

  power_entity?: string
  power_sign?: BatteryPowerSign | string
  switch_entity?: string
  power_actual_entity?: string
  static_power_w?: number | null
  /** L1, L2, L3. Ein leerer Eintrag heißt: 230 V annehmen. */
  voltage_entities?: string[]
  phases_entity?: string
  phases_fallback?: number
  charge_power_entity?: string
  discharge_power_entity?: string
  soc_entity?: string
  capacity_kwh?: number | null

  control?: DeviceControl
}

export interface HemsRefs {
  ems_enabled_entity?: string
  regelmodus_entity?: string
  panel_pfad?: string
  /** Regelintervall in Sekunden. Additiv ergänzt: ohne diesen Wert kann die
      Karte nicht beurteilen, ab wann Statusdaten veraltet sind. */
  interval_s?: number
}

/** Attribute von `sensor.skytech_hems_flow_config`. */
export interface FlowConfig {
  schema_version?: number
  addon_version?: string
  revision?: string
  /** Bereits fertig formatiert, TT.MM.JJJJ hh:mm:ss. Wird unverändert
      angezeigt — die Karte formatiert Zeit nicht selbst um. */
  erzeugt_am?: string
  anzeige?: Anzeige
  standard?: Standard
  devices?: Device[]
  hems?: HemsRefs
}

export interface StatusDevice {
  /** Rückfallwert. Bewusst nicht der Primärwert — siehe power.ts. */
  leistung_w?: number | null
  /** Regelt das Gerät gerade mit? */
  runtime_active?: boolean
  /** Deutscher Klartext, bereits vom Erzeuger übersetzt. */
  inactive_reasons?: string[]
}

/** Attribute von `sensor.skytech_hems_flow_status`. Optional: fehlt die
    Entität, ist die Karte voll funktionsfähig, es entfallen nur Abzeichen
    und Rückfallebene. */
export interface FlowStatus {
  schema_version?: number
  last_cycle_at?: string
  cycle_count?: number
  ems_enabled?: boolean
  global_mode?: string
  hard_lockout?: boolean
  residual_w?: number
  hems_last_w?: number
  hausdefizit_w?: number
  pool_w?: number
  devices?: Record<string, StatusDevice>
}

/* --------------------------------------------------------------------------
   Home Assistant — nur das, was die Karte tatsächlich anfasst.
   -------------------------------------------------------------------------- */

export interface HassEntity {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_changed?: string
  /** Ändert sich auch bei reiner Attributänderung — die Statusentität
      aktualisiert oft nur ihre Attribute. */
  last_updated?: string
}

export interface Hass {
  states: Record<string, HassEntity>
  themes?: unknown
  locale?: unknown
}

/** Die Lovelace-Konfiguration der Karte. Alle Felder sind optional — im
    Regelfall steht im Dashboard nur `type`. */
export interface CardConfig {
  type: string
  config_entity?: string
  status_entity?: string
  /** Überschreibt `anzeige.titel` aus dem Vertrag. */
  title?: string
}

export const STANDARD_CONFIG_ENTITY = 'sensor.skytech_hems_flow_config'
export const STANDARD_STATUS_ENTITY = 'sensor.skytech_hems_flow_status'
