import { LitElement, html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit'
import { styles } from './styles'
import {
  STANDARD_CONFIG_ENTITY, STANDARD_STATUS_ENTITY,
  type CardConfig, type Device, type FlowConfig, type FlowStatus, type Hass,
} from './types'
import {
  abonnierteEntitaeten, hatSichGeaendert, leseVertrag, zustandsAbzug,
  type Vertrag, type VertragsFehler,
} from './contract'
import {
  batterieLeistung, geraeteLeistung, hausLeistung, ladestand, netzLeistung, pvLeistung,
  type Aufloesung,
} from './power'
import { berechneBilanz, fliesst, type Bilanz, type Hinweis } from './balance'
import { baueGeometrie, findeKnoten, type Geometrie, type Knoten } from './layout'
import { akzentRing, pfeilDefinition, socRing, zeichneKante, type Kante } from './flow-svg'
import { leistung, leistungGesprochen, prozent, uhrzeit, UNBEKANNT_TEXT } from './format'
import './editor'

/* Die Karte selbst: Registrierung, Zustandsübernahme, Render.

   Sie liest ausschließlich `hass.states`. Es gibt keinen HTTP-Aufruf, keine
   Ingress-Session, kein Polling und keine Anforderung von Adminrechten.
   Geschaltet wird nichts — die einzige Interaktion ist der More-Info-Dialog
   von Home Assistant. */

const STANDARD_SCHWELLE = 1000
const STANDARD_INTERVALL_S = 30
/** Ab dem Fünffachen des Regelintervalls gelten die Statusdaten als alt. */
const VERALTET_FAKTOR = 5

const SYMBOLE: Record<string, string> = {
  pv: 'mdi:solar-power-variant',
  netz: 'mdi:transmission-tower',
  haus: 'mdi:home',
  verteiler: 'mdi:call-split',
  batterie: 'mdi:battery-high',
  rest: 'mdi:home-lightning-bolt-outline',
  controllable: 'mdi:flash',
  binary: 'mdi:toggle-switch-outline',
  battery: 'mdi:battery-charging',
}

export class SkytechPowerFlowCard extends LitElement {
  static override styles = styles

  static override properties = {
    _vertrag: { state: true },
    _jetzt: { state: true },
  }

  private _config: CardConfig = { type: 'custom:skytech-power-flow-card' }
  private _hass: Hass | null = null
  private _entitaeten: string[] = []
  private _abzug: Record<string, string> = {}
  private _revision = ''
  private _uhr?: ReturnType<typeof setInterval>

  declare _vertrag: Vertrag
  declare _jetzt: number

  constructor() {
    super()
    this._vertrag = { config: null, status: null, fehler: { art: 'keine_daten' } }
    this._jetzt = Date.now()
  }

  /* ---------------------------------------------------------------------
     Pflichtschnittstelle einer Lovelace-Karte
     --------------------------------------------------------------------- */

  setConfig(config: CardConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Die Karte braucht eine Konfiguration.')
    }
    for (const schluessel of ['config_entity', 'status_entity', 'title'] as const) {
      const wert = config[schluessel]
      if (wert !== undefined && typeof wert !== 'string') {
        throw new Error(`Der Wert von „${schluessel}" muss Text sein.`)
      }
    }
    this._config = { ...config }
    // Die Entitätsmenge hängt an der Konfiguration und wird neu gebildet.
    this._entitaeten = []
    this._abzug = {}
    this._revision = ''
    if (this._hass) this._uebernehmeZustand(this._hass, true)
  }

  set hass(hass: Hass) {
    this._uebernehmeZustand(hass, false)
  }

  get hass(): Hass | null {
    return this._hass
  }

  getCardSize(): number {
    const geraete = this._vertrag.config?.devices?.length ?? 0
    return 4 + Math.ceil(geraete / 2)
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('skytech-power-flow-card-editor')
  }

  static getStubConfig(): CardConfig {
    return { type: 'custom:skytech-power-flow-card' }
  }

  override connectedCallback(): void {
    super.connectedCallback()
    // Nur für das Abzeichen „HEMS-Daten veraltet": es wird allein durch
    // Zeitablauf wahr, ohne dass sich eine Entität ändert.
    this._uhr = setInterval(() => { this._jetzt = Date.now() }, 30_000)
  }

  override disconnectedCallback(): void {
    if (this._uhr) clearInterval(this._uhr)
    this._uhr = undefined
    super.disconnectedCallback()
  }

  /* ---------------------------------------------------------------------
     Zustandsübernahme
     --------------------------------------------------------------------- */

  /** Nur neu rendern, wenn sich eine ABONNIERTE Entität geändert hat.

      Ohne diese Prüfung rendert die Karte bei jeder Zustandsänderung im
      ganzen Haus — bei einer HA-Instanz mit vielen Entitäten sind das
      Dutzende Renderläufe je Sekunde. */
  private _uebernehmeZustand(hass: Hass, erzwingen: boolean): void {
    const vorher = this._hass
    this._hass = hass

    const configEntity = this._configEntity()
    const statusEntity = this._statusEntity()

    if (!vorher || erzwingen || this._entitaeten.length === 0) {
      this._neuLesen(configEntity, statusEntity)
      return
    }

    if (!hatSichGeaendert(this._entitaeten, this._abzug, hass, statusEntity)) return
    this._neuLesen(configEntity, statusEntity)
  }

  private _neuLesen(configEntity: string, statusEntity: string): void {
    const vertrag = leseVertrag(this._hass, configEntity, statusEntity)
    this._vertrag = vertrag

    // Die Entitätsmenge wird neu gebildet, sobald sich die Revision ändert —
    // dann kann ein Gerät dazugekommen oder weggefallen sein.
    const revision = vertrag.config?.revision ?? ''
    if (revision !== this._revision || this._entitaeten.length === 0) {
      this._revision = revision
      this._entitaeten = abonnierteEntitaeten(vertrag.config, configEntity, statusEntity)
    }
    this._abzug = zustandsAbzug(this._entitaeten, this._hass, statusEntity)
  }

  private _configEntity(): string {
    return this._config.config_entity || STANDARD_CONFIG_ENTITY
  }

  private _statusEntity(): string {
    return this._config.status_entity || STANDARD_STATUS_ENTITY
  }

  /* ---------------------------------------------------------------------
     Render
     --------------------------------------------------------------------- */

  override render(): TemplateResult {
    const { config, status, fehler } = this._vertrag
    if (fehler || !config) return this._renderHinweis(fehler)

    const bilanz = this._bilanz(config, status)
    const anzeige = config.anzeige ?? {}
    const schwelle = anzeige.watt_schwelle ?? STANDARD_SCHWELLE
    const titel = this._config.title ?? anzeige.titel ?? ''

    return html`
      <ha-card>
        ${this._renderKopf(titel, config, status, bilanz)}
        ${this._renderGrafik(config, status, bilanz, schwelle)}
      </ha-card>
    `
  }

  private _renderHinweis(fehler: VertragsFehler | null): TemplateResult {
    const text = this._hinweisText(fehler)
    return html`
      <ha-card>
        <div class="kopf">
          <span class="titel">${this._config.title || 'Leistungsfluss'}</span>
        </div>
        <div class="hinweis">${text}</div>
      </ha-card>
    `
  }

  private _hinweisText(fehler: VertragsFehler | null): string {
    switch (fehler?.art) {
      case 'unvollstaendig':
        return 'Die Kartendaten des Skytech HEMS sind unvollständig.'
      case 'zu_neu':
        return 'Diese Karte ist älter als die Daten des Skytech HEMS. '
          + 'Bitte die Karte aktualisieren.'
      default:
        return 'Das Skytech HEMS veröffentlicht noch keine Kartendaten. '
          + 'Im HEMS-Panel unter „Flow Card" die Veröffentlichung einschalten.'
    }
  }

  private _renderKopf(
    titel: string, config: FlowConfig, status: FlowStatus | null, bilanz: Bilanz,
  ): TemplateResult {
    const abzeichen: { text: string; warnung: boolean }[] = []

    if (status) {
      if (status.ems_enabled === false) abzeichen.push({ text: 'HEMS aus', warnung: false })
      if (status.hard_lockout) abzeichen.push({ text: 'HEMS gesperrt', warnung: true })
      if (this._veraltet(config)) {
        const zeit = uhrzeit(status.last_cycle_at)
        abzeichen.push({
          text: zeit === UNBEKANNT_TEXT
            ? 'HEMS-Daten veraltet'
            : `HEMS-Daten veraltet, zuletzt ${zeit}`,
          warnung: true,
        })
      }
    }

    for (const hinweis of bilanz.hinweise) {
      abzeichen.push({ text: HINWEIS_TEXTE[hinweis], warnung: true })
    }

    if (!titel && abzeichen.length === 0) return html``
    return html`
      <div class="kopf">
        ${titel ? html`<span class="titel">${titel}</span>` : html`<span class="titel"></span>`}
        ${abzeichen.map((eintrag) => html`
          <span class=${`abzeichen${eintrag.warnung ? ' warnung' : ''}`}>${eintrag.text}</span>
        `)}
      </div>
    `
  }

  /** Der Status gilt als alt, wenn die Entität länger nicht mehr
      aktualisiert wurde als das Fünffache des Regelintervalls. Gemessen wird
      an `last_updated` der Entität, nicht am Zeitstempel im Text: der ist
      für Menschen formatiert, nicht zum Rechnen. */
  private _veraltet(config: FlowConfig): boolean {
    const entity = this._hass?.states[this._statusEntity()]
    const marke = entity?.last_updated ?? entity?.last_changed
    if (!marke) return false
    const alter = Date.parse(marke)
    if (!Number.isFinite(alter)) return false
    const intervall = config.hems?.interval_s
    const sekunden = typeof intervall === 'number' && intervall > 0
      ? intervall : STANDARD_INTERVALL_S
    return this._jetzt - alter > sekunden * VERALTET_FAKTOR * 1000
  }

  /* ---------------------------------------------------------------------
     Bilanz und Grafik
     --------------------------------------------------------------------- */

  private _bilanz(config: FlowConfig, status: FlowStatus | null): Bilanz {
    const standard = config.standard
    return berechneBilanz({
      pv: pvLeistung(this._hass, standard),
      netz: netzLeistung(this._hass, standard),
      batterie: batterieLeistung(this._hass, standard?.batterie),
      haus: hausLeistung(this._hass, standard),
      geraete: (config.devices ?? []).map((device) => ({
        id: device.id,
        leistung: geraeteLeistung(this._hass, device, status),
      })),
    })
  }

  private _renderGrafik(
    config: FlowConfig, status: FlowStatus | null, bilanz: Bilanz, schwelle: number,
  ): TemplateResult {
    const standard = config.standard ?? {}
    const devices = config.devices ?? []
    const anzeige = config.anzeige ?? {}
    const hausKnoten = anzeige.haus_knoten_anzeigen !== false

    const geometrie = baueGeometrie({
      pv: (standard.pv_power_entities ?? []).length > 0,
      netz: Boolean(standard.grid_power_entity || standard.grid_import_entity
        || standard.grid_export_entity),
      batterie: Boolean(standard.batterie),
      hausKnoten,
      geraeteIds: devices.map((device) => device.id),
      rest: bilanz.uebrigesHaus > 0,
    })

    const kanten = this._kanten(geometrie, bilanz, schwelle, hausKnoten)
    const maximalfluss = kanten.reduce((groesster, kante) => Math.max(groesster, kante.wert), 0)
    const animation = anzeige.animation !== false

    return html`
      <svg
        viewBox=${`0 0 ${geometrie.breite} ${geometrie.hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label=${this._zusammenfassung(bilanz, schwelle)}
      >
        ${pfeilDefinition()}
        ${kanten.map((kante, index) => zeichneKante(kante, maximalfluss, animation, index))}
        ${this._knoten(geometrie, config, status, bilanz, schwelle)}
      </svg>
    `
  }

  /** Nur Kanten, die tatsächlich fließen. Kein Strich, kein Punkt, keine
      Beschriftung für einen Wert von `0` oder `null`. */
  private _kanten(
    geometrie: Geometrie, bilanz: Bilanz, schwelle: number, hausKnoten: boolean,
  ): Kante[] {
    const mitte = findeKnoten(geometrie, hausKnoten ? 'haus' : 'verteiler')
    const pv = findeKnoten(geometrie, 'pv')
    const netz = findeKnoten(geometrie, 'netz')
    const batterie = findeKnoten(geometrie, 'batterie')
    const kanten: Kante[] = []
    if (!mitte) return kanten

    const anlegen = (
      von: Knoten | undefined, nach: Knoten | undefined,
      wert: number, farbe: string, was: string,
    ) => {
      if (!von || !nach || !fliesst(wert)) return
      kanten.push({ von, nach, wert, farbe, beschreibung: `${was} ${leistung(wert, schwelle)}` })
    }

    anlegen(pv, mitte, bilanz.pvInsHaus, '--spfc-pv', 'Erzeugung ins Haus')
    anlegen(pv, batterie, bilanz.pvInBatterie, '--spfc-pv', 'Erzeugung in die Batterie')
    anlegen(pv, netz, bilanz.pvInsNetz, '--spfc-export', 'Einspeisung')
    anlegen(netz, mitte, bilanz.netzInsHaus, '--spfc-grid', 'Netzbezug ins Haus')
    anlegen(netz, batterie, bilanz.netzInBatterie, '--spfc-grid', 'Netzbezug in die Batterie')
    anlegen(batterie, mitte, bilanz.batterieInsHaus, '--spfc-battery', 'Batterie ins Haus')

    for (const geraet of bilanz.geraete) {
      anlegen(mitte, findeKnoten(geometrie, geraet.id), geraet.fluss, '--spfc-house', 'Gerät')
    }
    anlegen(mitte, findeKnoten(geometrie, 'rest'), bilanz.uebrigesHaus,
      '--spfc-house', 'Übriges Haus')

    return kanten
  }

  private _knoten(
    geometrie: Geometrie, config: FlowConfig, status: FlowStatus | null,
    bilanz: Bilanz, schwelle: number,
  ): SVGTemplateResult[] {
    const standard = config.standard ?? {}
    const geraete = new Map((config.devices ?? []).map((device) => [device.id, device]))
    const fluesse = new Map(bilanz.geraete.map((geraet) => [geraet.id, geraet]))

    return geometrie.knoten.map((knoten) => {
      switch (knoten.art) {
        case 'pv':
          return this._zeichneKnoten(geometrie, knoten, {
            symbol: SYMBOLE.pv!,
            beschriftung: standard.pv_label || 'Photovoltaik',
            wert: bilanz.pv,
            leitEntitaet: (standard.pv_power_entities ?? [])[0],
            schwelle,
          })
        case 'netz':
          return this._zeichneKnoten(geometrie, knoten, {
            symbol: SYMBOLE.netz!,
            beschriftung: standard.grid_label || 'Netz',
            wert: this._netzAnzeige(bilanz),
            leitEntitaet: standard.grid_power_entity || standard.grid_import_entity,
            schwelle,
          })
        case 'haus':
        case 'verteiler':
          return this._zeichneKnoten(geometrie, knoten, {
            symbol: knoten.art === 'haus' ? SYMBOLE.haus! : SYMBOLE.verteiler!,
            beschriftung: standard.house_label || 'Haus',
            wert: bilanz.haus,
            leitEntitaet: standard.house_power_entity,
            schwelle,
          })
        case 'batterie':
          return this._zeichneKnoten(geometrie, knoten, {
            symbol: SYMBOLE.batterie!,
            beschriftung: standard.batterie?.label || 'Batterie',
            wert: this._batterieAnzeige(bilanz),
            leitEntitaet: standard.batterie?.soc_entity,
            soc: ladestand(this._hass, standard.batterie?.soc_entity),
            schwelle,
          })
        case 'rest':
          return this._zeichneKnoten(geometrie, knoten, {
            symbol: SYMBOLE.rest!,
            beschriftung: 'Übriges Haus',
            wert: { wert: bilanz.uebrigesHaus, quelle: 'direkt' },
            schwelle,
          })
        default: {
          const device = geraete.get(knoten.id)
          const fluss = fluesse.get(knoten.id)
          return this._zeichneGeraet(geometrie, knoten, device, fluss?.leistung, status, schwelle)
        }
      }
    })
  }

  private _zeichneGeraet(
    geometrie: Geometrie, knoten: Knoten, device: Device | undefined,
    wert: Aufloesung | undefined, status: FlowStatus | null, schwelle: number,
  ): SVGTemplateResult {
    const eintrag = device ? status?.devices?.[device.id] : undefined
    // Fehlt die Statusentität, gilt jedes Gerät aus devices[] als geregelt —
    // es steht ja nur dort, weil das HEMS es kennt.
    const aktiv = !status || eintrag?.runtime_active !== false
    const grund = aktiv ? '' : (eintrag?.inactive_reasons ?? [])[0] ?? 'regelt gerade nicht mit'

    return this._zeichneKnoten(geometrie, knoten, {
      symbol: device?.icon || SYMBOLE[device?.class ?? ''] || SYMBOLE.controllable!,
      beschriftung: device?.label || device?.id || '',
      wert: wert ?? { wert: null, quelle: 'unbekannt' },
      leitEntitaet: device?.power_entity || device?.switch_entity,
      farbe: device?.farbe,
      ring: aktiv ? 'aktiv' : 'ruhend',
      untertitel: grund,
      zusatz: aktiv ? 'vom HEMS geregelt' : grund,
      schwelle,
    })
  }

  private _zeichneKnoten(geometrie: Geometrie, knoten: Knoten, teil: {
    symbol: string
    beschriftung: string
    wert: Aufloesung
    schwelle: number
    leitEntitaet?: string
    soc?: number | null
    farbe?: string
    ring?: 'aktiv' | 'ruhend'
    untertitel?: string
    zusatz?: string
  }): SVGTemplateResult {
    const klickbar = Boolean(teil.leitEntitaet)
    const text = leistung(teil.wert.wert, teil.schwelle)
    const unbekannt = teil.wert.wert === null
    const symbolGroesse = knoten.r * 1.1

    const beschreibung = [
      teil.beschriftung,
      leistungGesprochen(teil.wert.wert, teil.schwelle),
      teil.soc !== undefined && teil.soc !== null ? `Ladestand ${prozent(teil.soc)}` : '',
      teil.wert.quelle === 'status' ? 'aus dem HEMS-Status' : '',
      teil.zusatz ?? '',
    ].filter(Boolean).join(', ')

    return svg`
      <g
        class=${`knoten${klickbar ? ' klickbar' : ''}`}
        role=${klickbar ? 'button' : 'group'}
        tabindex=${klickbar ? '0' : nothing}
        aria-label=${beschreibung}
        @click=${() => this._oeffneDialog(teil.leitEntitaet)}
        @keydown=${(event: KeyboardEvent) => this._taste(event, teil.leitEntitaet)}
      >
        ${teil.soc !== undefined ? socRing(knoten, teil.soc ?? null) : null}
        ${teil.ring ? akzentRing(knoten, teil.ring === 'aktiv') : null}
        <circle
          class="knoten-flaeche" cx=${knoten.x} cy=${knoten.y} r=${knoten.r}
          style=${teil.farbe ? `stroke: ${teil.farbe}` : nothing}
        ></circle>
        <foreignObject
          x=${knoten.x - symbolGroesse / 2} y=${knoten.y - symbolGroesse / 2}
          width=${symbolGroesse} height=${symbolGroesse}
          aria-hidden="true"
        >
          <ha-icon class="symbol" icon=${teil.symbol}></ha-icon>
        </foreignObject>
        <text
          class="beschriftung" x=${knoten.x} y=${knoten.y + knoten.r + 16}
          font-size=${geometrie.schrift}
        >${teil.beschriftung}</text>
        <text
          class=${`wert${unbekannt ? ' unbekannt' : ''}`}
          x=${knoten.x} y=${knoten.y + knoten.r + 16 + geometrie.schrift + 2}
          font-size=${geometrie.schrift - 1}
        >${text}${teil.soc !== undefined && teil.soc !== null ? ` · ${prozent(teil.soc)}` : ''}</text>
        ${teil.untertitel ? svg`
          <text
            class="untertitel" x=${knoten.x}
            y=${knoten.y + knoten.r + 16 + (geometrie.schrift + 2) * 2}
            font-size=${geometrie.schrift - 2}
          >${teil.untertitel}</text>
        ` : null}
      </g>
    `
  }

  private _netzAnzeige(bilanz: Bilanz): Aufloesung {
    if (bilanz.netzbezug === 0 && bilanz.netzeinspeisung === 0) {
      // Beide Richtungen leer kann „nichts fließt" oder „nichts bekannt"
      // heißen. Unterschieden wird an der Quelle, nicht an der Zahl.
      return { wert: 0, quelle: 'direkt' }
    }
    return bilanz.netzbezug > 0
      ? { wert: bilanz.netzbezug, quelle: 'direkt' }
      : { wert: -bilanz.netzeinspeisung, quelle: 'direkt' }
  }

  private _batterieAnzeige(bilanz: Bilanz): Aufloesung {
    if (bilanz.laden > 0) return { wert: bilanz.laden, quelle: 'direkt' }
    if (bilanz.entladen > 0) return { wert: -bilanz.entladen, quelle: 'direkt' }
    return { wert: 0, quelle: 'direkt' }
  }

  /** Damit ein Bildschirmleser die Karte erfassen kann, ohne jeden
      Einzelknoten abzugehen. */
  private _zusammenfassung(bilanz: Bilanz, schwelle: number): string {
    const teile = [
      `Erzeugung ${leistungGesprochen(bilanz.pv.wert, schwelle)}`,
      `Haus ${leistungGesprochen(bilanz.haus.wert, schwelle)}`,
    ]
    if (bilanz.netzbezug > 0) teile.push(`Netzbezug ${leistungGesprochen(bilanz.netzbezug, schwelle)}`)
    if (bilanz.netzeinspeisung > 0) {
      teile.push(`Einspeisung ${leistungGesprochen(bilanz.netzeinspeisung, schwelle)}`)
    }
    if (bilanz.laden > 0) teile.push(`Batterie lädt mit ${leistungGesprochen(bilanz.laden, schwelle)}`)
    if (bilanz.entladen > 0) {
      teile.push(`Batterie entlädt mit ${leistungGesprochen(bilanz.entladen, schwelle)}`)
    }
    return `Leistungsfluss: ${teile.join(', ')}.`
  }

  /* ---------------------------------------------------------------------
     Interaktion — ausschließlich lesend
     --------------------------------------------------------------------- */

  private _oeffneDialog(entityId?: string): void {
    if (!entityId) return
    const ereignis = new Event('hass-more-info', { bubbles: true, composed: true })
    ;(ereignis as Event & { detail?: unknown }).detail = { entityId }
    this.dispatchEvent(ereignis)
  }

  private _taste(event: KeyboardEvent, entityId?: string): void {
    if (!entityId) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    this._oeffneDialog(entityId)
  }
}

const HINWEIS_TEXTE: Record<Hinweis, string> = {
  bilanz_unplausibel: 'Bilanz unplausibel',
  geraete_ueber_haus: 'Geräteleistung übersteigt Hausleistung',
}

customElements.define('skytech-power-flow-card', SkytechPowerFlowCard)

// Damit die Karte im Karten-Auswahldialog erscheint.
interface CustomCard {
  type: string
  name: string
  description: string
  preview: boolean
  documentationURL: string
}
const fenster = window as Window & { customCards?: CustomCard[] }
fenster.customCards = fenster.customCards || []
fenster.customCards.push({
  type: 'skytech-power-flow-card',
  name: 'Skytech Power Flow Card',
  description: 'Leistungsfluss, der sich seine Geräte selbst aus dem Skytech HEMS holt.',
  preview: true,
  documentationURL: 'https://github.com/NicoHackl/Skytech-Powerflow-Card',
})

export { }
