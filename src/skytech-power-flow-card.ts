import { LitElement, html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit'
import { styles } from './styles'
import {
  STANDARD_CONFIG_ENTITY, STANDARD_STATUS_ENTITY,
  type CardConfig, type Device, type FlowConfig, type FlowStatus, type Hass,
} from './types'
import {
  abonnierteEntitaeten, hatSichGeaendert, istSicheresZiel, leseVertrag, zustandsAbzug,
  type Vertrag, type VertragsFehler,
} from './contract'
import {
  batterieLeistung, geraeteLeistung, hausLeistung, ladestand, netzLeistung, pvLeistung,
  type Aufloesung,
} from './power'
import {
  berechneBilanz, type Bilanz, type Hinweis, type SpeicherFluss,
} from './balance'
import {
  baueGeometrie, beschriftungsBreite, findeKnoten, knotenInhalt, kuerze, wertSchrift,
  zeichenBreite, PFEIL_PLATZ,
  type Geometrie, type KnotenInhalt, type Massstab, type Knoten,
} from './layout'
import {
  akzentRing, hausRing, richtungsPfeil, socRing, zeichneKante,
  type HausAnteil, type Kante,
} from './flow-svg'

/** Luft zwischen Kreisrand und einer Beschriftung, die ÜBER dem Knoten steht.
    Etwas knapper als unten, weil dort keine zweite Zeile folgt. */
const LUFT_AUSSEN_OBEN = 8
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

/** Obergrenze des Erwartungsbereichs für die Punktgeschwindigkeit, wenn der
    Vertrag keine nennt. */
const STANDARD_MAX_LEISTUNG_W = 5000

/** Breite, mit der gerechnet wird, bevor der ResizeObserver gemessen hat. */
const STANDARD_BREITE = 480

/** Zusammenfassungsfenster fürs Rendern. Die abonnierten Sensoren ändern sich
    mehrmals pro Sekunde; ohne dieses Fenster rechnet und zeichnet die Karte
    genauso oft, und die Zahlen flackern unlesbar. */
const RENDER_FENSTER_MS = 1000

/** So viele Erzeugungszeilen passen unter den Knoten. */
const PV_DETAIL_MAX = 2

/** Ein AC-Speicher ist ein HEMS-Gerät, aber kein Verbraucher: er kann das
    Haus speisen. Er wird deshalb beim Hausspeicher gezeichnet (D-010). */
function acSpeicher(config: FlowConfig): Device[] {
  return (config.devices ?? []).filter((device) => device.class === 'battery')
}

function verbraucher(config: FlowConfig): Device[] {
  return (config.devices ?? []).filter((device) => device.class !== 'battery')
}

const GERAETE_FARBEN = [
  '--spfc-geraet-1', '--spfc-geraet-2', '--spfc-geraet-3', '--spfc-geraet-4',
]

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
    _breite: { state: true },
  }

  private _config: CardConfig = { type: 'custom:skytech-power-flow-card' }
  private _hass: Hass | null = null
  private _entitaeten: string[] = []
  private _abzug: Record<string, string> = {}
  private _revision = ''
  private _uhr?: ReturnType<typeof setInterval>
  private _beobachter?: ResizeObserver
  private _renderTimer?: ReturnType<typeof setTimeout>

  declare _vertrag: Vertrag
  declare _jetzt: number
  declare _breite: number

  constructor() {
    super()
    this._vertrag = { config: null, status: null, fehler: { art: 'keine_daten' } }
    this._jetzt = Date.now()
    this._breite = STANDARD_BREITE
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

    // Die Karte rechnet in Bildschirmpunkten. Dazu muss sie wissen, wie breit
    // sie tatsächlich ist — eine Medienabfrage kennt nur das Fenster, nicht
    // die Spalte, in der die Karte steht.
    if (typeof ResizeObserver !== 'undefined') {
      this._beobachter = new ResizeObserver((eintraege) => {
        const breite = Math.round(eintraege[0]?.contentRect.width ?? 0)
        if (breite > 0 && Math.abs(breite - this._breite) > 2) this._breite = breite
      })
      this._beobachter.observe(this)
    }
  }

  override disconnectedCallback(): void {
    if (this._uhr) clearInterval(this._uhr)
    this._uhr = undefined
    if (this._renderTimer) clearTimeout(this._renderTimer)
    this._renderTimer = undefined
    this._beobachter?.disconnect()
    this._beobachter = undefined
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

    // Eine neue Revision heißt: ein Gerät kam dazu oder fiel weg. Das darf
    // nicht bis zu einer Sekunde warten.
    const revision = (this._hass?.states[configEntity]?.attributes as FlowConfig | undefined)
      ?.revision ?? ''
    if (revision !== this._revision) {
      this._neuLesen(configEntity, statusEntity)
      return
    }

    // Sonst wird zusammengefasst: die abonnierten Sensoren ändern sich
    // mehrmals pro Sekunde, und jede Änderung einzeln zu zeichnen macht die
    // Zahlen unlesbar und lässt die Punkte springen.
    if (this._renderTimer) return
    this._renderTimer = setTimeout(() => {
      this._renderTimer = undefined
      this._neuLesen(this._configEntity(), this._statusEntity())
    }, RENDER_FENSTER_MS)
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
    return html`
      <ha-card>
        <div class="kopf">
          <span class="titel">${this._config.title || 'Leistungsfluss'}</span>
        </div>
        <div class="hinweis">${this._hinweisText(fehler)}</div>
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
        <span class="titel">${titel}</span>
        ${abzeichen.map((eintrag) => html`
          <span class=${`abzeichen${eintrag.warnung ? ' warnung' : ''}`}>${eintrag.text}</span>
        `)}
      </div>
    `
  }

  /** Der Status gilt als alt, wenn die Entität länger nicht mehr aktualisiert
      wurde als das Fünffache des Regelintervalls. Gemessen wird an
      `last_updated` der Entität, nicht am Zeitstempel im Text: der ist für
      Menschen formatiert, nicht zum Rechnen. */
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
    const aufloesen = (device: Device) => ({
      id: device.id,
      leistung: geraeteLeistung(this._hass, device, status),
    })
    return berechneBilanz({
      pv: pvLeistung(this._hass, standard),
      netz: netzLeistung(this._hass, standard),
      batterie: batterieLeistung(this._hass, standard?.batterie),
      haus: hausLeistung(this._hass, standard),
      geraete: verbraucher(config).map(aufloesen),
      speicher: acSpeicher(config).map(aufloesen),
    })
  }

  private _renderGrafik(
    config: FlowConfig, status: FlowStatus | null, bilanz: Bilanz, schwelle: number,
  ): TemplateResult {
    const standard = config.standard ?? {}
    const anzeige = config.anzeige ?? {}
    const hausKnoten = anzeige.haus_knoten_anzeigen !== false

    const geometrie = baueGeometrie({
      pv: (standard.pv_power_entities ?? []).length > 0,
      netz: Boolean(standard.grid_power_entity || standard.grid_import_entity
        || standard.grid_export_entity),
      batterie: Boolean(standard.batterie),
      hausKnoten,
      geraeteIds: verbraucher(config).map((device) => device.id),
      speicherIds: acSpeicher(config).map((device) => device.id),
      rest: bilanz.uebrigesHaus > 0,
      breite: this._breite,
    })

    const kanten = this._kanten(geometrie, bilanz, schwelle, hausKnoten)
    const animation = anzeige.animation !== false
    const maxLeistung = anzeige.max_erwartete_leistung_w ?? STANDARD_MAX_LEISTUNG_W

    return html`
      <svg
        viewBox=${`0 0 ${geometrie.breite} ${geometrie.hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label=${this._zusammenfassung(bilanz, schwelle)}
      >
        ${kanten.map((kante, index) =>
          zeichneKante(kante, animation, schwelle, maxLeistung, index))}
        ${this._knoten(geometrie, config, status, bilanz, schwelle)}
      </svg>
    `
  }

  /** Alle Kanten der Anlage — auch die mit dem Wert `0`.

      Eine Nulllinie wird ausgegraut gezeichnet statt weggelassen: das Gerüst
      der Grafik soll stehen bleiben, statt bei jedem Nulldurchgang zu
      verschwinden. Weggelassen wird nur, was es gar nicht gibt. */
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
      if (!von || !nach) return
      kanten.push({
        von, nach, wert, farbe, spalte: geometrie.spalte,
        beschreibung: `${was} ${leistung(wert, schwelle)}`,
      })
    }

    anlegen(pv, mitte, bilanz.pvInsHaus, '--spfc-pv', 'Erzeugung ins Haus')
    anlegen(pv, batterie, bilanz.pvInBatterie, '--spfc-battery-in', 'Erzeugung in die Batterie')
    anlegen(pv, netz, bilanz.pvInsNetz, '--spfc-export', 'Einspeisung')
    anlegen(netz, mitte, bilanz.netzInsHaus, '--spfc-grid', 'Netzbezug ins Haus')
    anlegen(netz, batterie, bilanz.netzInBatterie, '--spfc-grid', 'Netzbezug in die Batterie')
    anlegen(batterie, mitte, bilanz.batterieInsHaus, '--spfc-battery', 'Batterie ins Haus')

    // Ein AC-Speicher bekommt EINE Kante zum Hausknoten, deren Richtung das
    // Vorzeichen setzt. Woher er lädt, weiß die Karte nicht — das aufzuteilen
    // wie beim Hausspeicher wäre erfunden.
    for (const eintrag of bilanz.speicher) {
      const knoten = findeKnoten(geometrie, eintrag.id)
      if (eintrag.entladen > 0) {
        anlegen(knoten, mitte, eintrag.entladen, '--spfc-battery', 'Speicher ins Haus')
      } else {
        anlegen(mitte, knoten, eintrag.laden, '--spfc-battery-in', 'Haus in den Speicher')
      }
    }

    bilanz.geraete.forEach((geraet, index) => {
      anlegen(mitte, findeKnoten(geometrie, geraet.id), geraet.fluss,
        GERAETE_FARBEN[index % GERAETE_FARBEN.length]!, 'Gerät')
    })
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
    const reihenfolge = new Map(bilanz.geraete.map((geraet, index) => [geraet.id, index]))
    const fluesse = new Map(bilanz.geraete.map((geraet) => [geraet.id, geraet]))
    const ringFarbeRoh = config.anzeige?.freigabe_ring_farbe || ''

    return geometrie.knoten.map((knoten) => {
      switch (knoten.art) {
        case 'pv':
          return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
            symbol: SYMBOLE.pv!,
            beschriftung: standard.pv_label || 'Photovoltaik',
            farbe: '--spfc-pv',
            werte: [{ wert: bilanz.pv, richtung: 'runter' }],
            untertitel: this._pvAufschluesselung(standard, schwelle),
            leitEntitaet: (standard.pv_power_entities ?? [])[0],
            ziel: standard.pv_navigation,
            schwelle,
          })
        case 'netz':
          return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
            symbol: SYMBOLE.netz!,
            beschriftung: standard.grid_label || 'Netz',
            farbe: bilanz.netzeinspeisung > bilanz.netzbezug ? '--spfc-export' : '--spfc-grid',
            werte: this._netzWerte(bilanz),
            leitEntitaet: standard.grid_power_entity || standard.grid_import_entity,
            ziel: standard.grid_navigation,
            schwelle,
          })
        case 'haus':
        case 'verteiler':
          return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
            symbol: knoten.art === 'haus' ? SYMBOLE.haus! : SYMBOLE.verteiler!,
            beschriftung: standard.house_label || 'Haus',
            farbe: '--spfc-house',
            werte: [{ wert: bilanz.haus }],
            ring: hausRing(knoten, this._hausAnteile(bilanz)),
            randlos: true,
            leitEntitaet: standard.house_power_entity,
            ziel: standard.house_navigation,
            schwelle,
          })
        case 'batterie': {
          const soc = ladestand(this._hass, standard.batterie?.soc_entity)
          return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
            symbol: SYMBOLE.batterie!,
            beschriftung: standard.batterie?.label || 'Batterie',
            farbe: bilanz.laden > 0 ? '--spfc-battery-in' : '--spfc-battery',
            werte: this._batterieWerte(bilanz),
            ring: socRing(knoten, soc),
            zusatz: soc === null ? '' : `Ladestand ${prozent(soc)}`,
            untertitel: soc === null ? '' : prozent(soc),
            leitEntitaet: standard.batterie?.soc_entity,
            ziel: standard.batterie?.navigation,
            schwelle,
          })
        }
        case 'rest':
          return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
            symbol: SYMBOLE.rest!,
            beschriftung: 'Übriges Haus',
            farbe: '--spfc-house',
            werte: [{ wert: { wert: bilanz.uebrigesHaus, quelle: 'direkt' } }],
            ziel: standard.rest_navigation,
            schwelle,
          })
        case 'speicher': {
          const eintrag = bilanz.speicher.find((s) => s.id === knoten.id)
          return this._zeichneSpeicher(
            geometrie, knoten, geraete.get(knoten.id), eintrag, status, schwelle, ringFarbeRoh)
        }
        default: {
          const device = geraete.get(knoten.id)
          const index = reihenfolge.get(knoten.id) ?? 0
          return this._zeichneGeraet(
            geometrie, knoten, device, fluesse.get(knoten.id)?.leistung, status, index, schwelle,
            ringFarbeRoh)
        }
      }
    })
  }

  /** Woraus sich der Hausverbrauch speist — die Anteile des Herkunftsrings. */
  private _hausAnteile(bilanz: Bilanz): HausAnteil[] {
    return [
      { anteil: bilanz.pvInsHaus, klasse: 'von-pv' },
      { anteil: bilanz.batterieInsHaus, klasse: 'von-batterie' },
      { anteil: bilanz.netzInsHaus, klasse: 'von-netz' },
    ]
  }

  /** Netz und Speicher zeigen **beide** Richtungen. Eine einzelne
      vorzeichenbehaftete Zahl an einem Knoten ist nicht zu deuten: −1,1 kW
      kann Einspeisung oder ein Messfehler sein. */
  private _netzWerte(bilanz: Bilanz): KnotenWert[] {
    const werte: KnotenWert[] = []
    if (bilanz.netzeinspeisung > 0 || bilanz.netzbezug === 0) {
      werte.push({
        wert: { wert: bilanz.netzeinspeisung, quelle: 'direkt' },
        richtung: 'links', farbe: '--spfc-export',
      })
    }
    if (bilanz.netzbezug > 0 || werte.length === 0) {
      werte.push({
        wert: { wert: bilanz.netzbezug, quelle: 'direkt' },
        richtung: 'rechts', farbe: '--spfc-grid',
      })
    }
    return werte
  }

  private _batterieWerte(bilanz: Bilanz): KnotenWert[] {
    const werte: KnotenWert[] = []
    if (bilanz.laden > 0 || bilanz.entladen === 0) {
      werte.push({
        wert: { wert: bilanz.laden, quelle: 'direkt' },
        richtung: 'runter', farbe: '--spfc-battery-in',
      })
    }
    if (bilanz.entladen > 0) {
      werte.push({
        wert: { wert: bilanz.entladen, quelle: 'direkt' },
        richtung: 'hoch', farbe: '--spfc-battery',
      })
    }
    return werte
  }

  /** Die Erzeugungszeilen, die laut Vertrag **nicht** summiert werden.

      Je Zeile eine eigene Textzeile: aneinandergereiht wären sie länger als
      der Knoten breit ist und würden abgeschnitten. Mehr als drei passen nicht
      in den Zeilenabstand — der Rest wird gezählt statt gezeigt.

      Die Zeilen halten dieselbe Breite ein wie jede andere Beschriftung. Früher
      durften sie 1,6 Spalten belegen, weil in der obersten Reihe neben ihnen
      nichts lag — seit die Kanten seitlich abgehen, läuft dort der senkrechte
      Korridor. */
  private _pvAufschluesselung(standard: FlowConfig['standard'], schwelle: number): string[] {
    const entities = standard?.pv_detail_entities ?? []
    if (entities.length === 0) return []

    const zeilen = entities.slice(0, PV_DETAIL_MAX).map((entity: string) => {
      const state = this._hass?.states[entity]
      const name = String(state?.attributes?.['friendly_name'] ?? entity)
      const wert = Number(state?.state)
      const text = Number.isFinite(wert) ? leistung(wert, schwelle) : UNBEKANNT_TEXT
      return `${name} ${text}`
    })
    const rest = entities.length - zeilen.length
    if (rest > 0) zeilen.push(`und ${rest} weitere`)
    return zeilen
  }

  /** Ein AC-Speicher: wie der Hausspeicher gezeichnet, aber mit den
      HEMS-Merkmalen eines Geräts.

      Der Wert steht **immer positiv** — die Richtung trägt der Pfeil und die
      Flusslinie. Eine negative Zahl am Knoten ließe offen, ob sie Einspeisung
      oder Messfehler ist. */
  private _zeichneSpeicher(
    geometrie: Geometrie, knoten: Knoten, device: Device | undefined,
    eintrag: SpeicherFluss | undefined, status: FlowStatus | null, schwelle: number,
    ringFarbeRoh: string,
  ): SVGTemplateResult {
    const soc = ladestand(this._hass, device?.soc_entity)
    const statusEintrag = device ? status?.devices?.[device.id] : undefined
    const aktiv = !status || statusEintrag?.runtime_active !== false
    const grund = aktiv ? '' : (statusEintrag?.inactive_reasons ?? [])[0] ?? 'regelt gerade nicht mit'

    const unbekannt = eintrag === undefined || eintrag.leistung.wert === null
    const laedt = (eintrag?.laden ?? 0) > 0
    const speist = (eintrag?.entladen ?? 0) > 0
    const betrag = laedt ? eintrag!.laden : speist ? eintrag!.entladen : 0

    const untertitel = [soc === null ? '' : prozent(soc), grund].filter(Boolean)

    return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
      symbol: device?.icon || SYMBOLE.battery!,
      beschriftung: device?.label || device?.id || '',
      farbe: laedt ? '--spfc-battery-in' : '--spfc-battery',
      farbeRoh: device?.farbe || '',
      werte: [{
        wert: unbekannt
          ? { wert: null, quelle: 'unbekannt' }
          : { wert: betrag, quelle: eintrag!.leistung.quelle },
        ...(laedt ? { richtung: 'runter' as const, farbe: '--spfc-battery-in' } : {}),
        ...(speist ? { richtung: 'hoch' as const, farbe: '--spfc-battery' } : {}),
      }],
      ring: socRing(knoten, soc),
      ringElement: akzentRing(knoten, aktiv),
      ringFarbeRoh,
      untertitel,
      zusatz: [
        laedt ? 'lädt' : speist ? 'speist ins Haus' : '',
        soc === null ? '' : `Ladestand ${prozent(soc)}`,
        aktiv ? 'vom HEMS geregelt' : grund,
      ].filter(Boolean).join(', '),
      leitEntitaet: device?.soc_entity || device?.power_entity,
      ziel: device?.navigation,
      schwelle,
    })
  }

  private _zeichneGeraet(
    geometrie: Geometrie, knoten: Knoten, device: Device | undefined,
    wert: Aufloesung | undefined, status: FlowStatus | null,
    index: number, schwelle: number, ringFarbeRoh: string,
  ): SVGTemplateResult {
    const eintrag = device ? status?.devices?.[device.id] : undefined
    // Fehlt die Statusentität, gilt jedes Gerät aus devices[] als geregelt —
    // es steht ja nur dort, weil das HEMS es kennt.
    const aktiv = !status || eintrag?.runtime_active !== false
    const grund = aktiv ? '' : (eintrag?.inactive_reasons ?? [])[0] ?? 'regelt gerade nicht mit'

    return this._zeichneKnoten(knoten, geometrie.mass, geometrie.spalte, {
      symbol: device?.icon || SYMBOLE[device?.class ?? ''] || SYMBOLE.controllable!,
      beschriftung: device?.label || device?.id || '',
      farbe: GERAETE_FARBEN[index % GERAETE_FARBEN.length]!,
      farbeRoh: device?.farbe || '',
      werte: [{ wert: wert ?? { wert: null, quelle: 'unbekannt' } }],
      leitEntitaet: device?.power_entity || device?.switch_entity,
      ziel: device?.navigation,
      ringElement: akzentRing(knoten, aktiv),
      ringFarbeRoh,
      untertitel: grund,
      zusatz: aktiv ? 'vom HEMS geregelt' : grund,
      schwelle,
    })
  }

  private _zeichneKnoten(
    knoten: Knoten, mass: Massstab, spalte: number, teil: KnotenTeil,
  ): SVGTemplateResult {
    const ziel = istSicheresZiel(teil.ziel) ? teil.ziel! : ''
    const klickbar = Boolean(ziel || teil.leitEntitaet)
    const farbe = teil.farbeRoh || `var(${teil.farbe})`
    const ringFarbe = teil.ringFarbeRoh ? `; --spfc-freigabe-ring: ${teil.ringFarbeRoh}` : ''
    const inhalt = knotenInhalt(mass, teil.werte.length)

    const symbolY = knoten.y + inhalt.symbolY
    const beschriftungY = knoten.beschriftung === 'oben'
      ? knoten.y - knoten.r - LUFT_AUSSEN_OBEN
      : knoten.y + knoten.r + inhalt.beschriftungY
    const untertitelY = knoten.beschriftung === 'oben'
      ? knoten.y + knoten.r + inhalt.beschriftungY
      : beschriftungY + inhalt.untertitelSchritt
    const untertitel = typeof teil.untertitel === 'string'
      ? (teil.untertitel ? [teil.untertitel] : [])
      : (teil.untertitel ?? [])

    // Die Beschriftung darf weder die Nachbarspalte noch den senkrechten
    // Korridor der Kanten berühren. Frühere Fassungen rechneten mit dem
    // Knotendurchmesser statt mit dem Spaltenabstand — bei engen Spalten liefen
    // die Namen ineinander.
    const spaltenBreite = beschriftungsBreite(mass, spalte)

    const beschreibung = [
      teil.beschriftung,
      ...teil.werte.map((eintrag) => leistungGesprochen(eintrag.wert.wert, teil.schwelle)),
      teil.werte.some((eintrag) => eintrag.wert.quelle === 'status') ? 'aus dem HEMS-Status' : '',
      teil.zusatz ?? '',
      // Eine Vorlesestimme muss wissen, dass der Klick die Seite wechselt.
      ziel ? 'öffnet eine andere Seite' : '',
    ].filter(Boolean).join(', ')

    // Ein Grad für ALLE Wertzeilen eines Knotens: unterschiedlich große Zahlen
    // übereinander lesen sich als Fehler, nicht als Anpassung.
    const wertGrad = teil.werte.reduce((grad, eintrag, index) => Math.min(grad, wertSchrift(
      leistung(eintrag.wert.wert, teil.schwelle).length,
      Boolean(eintrag.richtung) && eintrag.wert.wert !== null,
      knoten.r,
      inhalt.werteY[index] ?? 0,
      mass.schrift,
    )), mass.schrift)

    return svg`
      <g
        class=${`knoten${klickbar ? ' klickbar' : ''}`}
        style=${`color: ${farbe}${ringFarbe}`}
        role=${klickbar ? (ziel ? 'link' : 'button') : 'group'}
        tabindex=${klickbar ? '0' : nothing}
        aria-label=${beschreibung}
        @click=${() => this._klick(ziel, teil.leitEntitaet)}
        @keydown=${(event: KeyboardEvent) => this._taste(event, ziel, teil.leitEntitaet)}
      >
        <circle
          class=${`knoten-flaeche${teil.randlos ? ' randlos' : ''}`}
          cx=${knoten.x} cy=${knoten.y} r=${knoten.r}
        ></circle>
        ${teil.ring ?? null}
        ${teil.ringElement ?? null}
        <foreignObject
          x=${knoten.x - inhalt.symbol / 2} y=${symbolY - inhalt.symbol / 2}
          width=${inhalt.symbol} height=${inhalt.symbol}
          aria-hidden="true"
        >
          <ha-icon
            class="symbol" icon=${teil.symbol}
            style=${`--mdc-icon-size: ${inhalt.symbol}px`}
          ></ha-icon>
        </foreignObject>
        ${teil.werte.map((eintrag, index) => this._zeichneWert(
          knoten, eintrag, index, teil.schwelle, wertGrad, inhalt))}
        <text class="beschriftung" x=${knoten.x} y=${beschriftungY} font-size=${mass.schrift}>
          ${kuerze(teil.beschriftung, spaltenBreite, mass.schrift)}
          <title>${teil.beschriftung}</title>
        </text>
        ${untertitel.map((zeile, index) => svg`
          <text
            class="untertitel" x=${knoten.x}
            y=${untertitelY + index * inhalt.untertitelSchritt}
            font-size=${mass.untertitel}
          >
            ${kuerze(zeile, spaltenBreite, mass.untertitel)}
            <title>${zeile}</title>
          </text>
        `)}
      </g>
    `
  }

  /** Ein Wert **im** Kreis, mit Richtungspfeil davor.

      Pfeil und Zahl bilden **einen** Block, der auf der Knotenmitte zentriert
      wird. Zuvor stand die Zahl zentriert und der Pfeil links daneben — der
      Block saß dadurch außermittig und stieß auf der unteren Wertzeile gegen
      den Kreisrand. */
  private _zeichneWert(
    knoten: Knoten, eintrag: KnotenWert, index: number, schwelle: number,
    schrift: number, inhalt: KnotenInhalt,
  ): SVGTemplateResult {
    const y = knoten.y + (inhalt.werteY[index] ?? inhalt.werteY[0] ?? 0)
    const text = leistung(eintrag.wert.wert, schwelle)
    const unbekannt = eintrag.wert.wert === null
    const mitPfeil = Boolean(eintrag.richtung) && !unbekannt

    const textBreite = text.length * zeichenBreite(schrift)
    const links = knoten.x - (textBreite + (mitPfeil ? PFEIL_PLATZ : 0)) / 2

    return svg`
      <g style=${eintrag.farbe ? `color: var(${eintrag.farbe})` : nothing}>
        ${mitPfeil
          ? richtungsPfeil(links + 4, y - schrift / 3, eintrag.richtung!) : null}
        <text
          class=${`wert${unbekannt ? ' unbekannt' : ''}`}
          x=${mitPfeil ? links + PFEIL_PLATZ + textBreite / 2 : knoten.x} y=${y}
          font-size=${schrift}
        >${text}</text>
      </g>
    `
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
    for (const speicher of bilanz.speicher) {
      if (speicher.laden > 0) {
        teile.push(`${speicher.id} lädt mit ${leistungGesprochen(speicher.laden, schwelle)}`)
      } else if (speicher.entladen > 0) {
        teile.push(`${speicher.id} speist ${leistungGesprochen(speicher.entladen, schwelle)}`)
      }
    }
    return `Leistungsfluss: ${teile.join(', ')}.`
  }

  /* ---------------------------------------------------------------------
     Interaktion — ausschließlich lesend
     --------------------------------------------------------------------- */

  /** Ist ein Ziel gesetzt, wird navigiert; sonst öffnet der More-Info-Dialog. */
  private _klick(ziel: string, entityId?: string): void {
    if (ziel) {
      this._navigiere(ziel)
      return
    }
    this._oeffneDialog(entityId)
  }

  /** Seitenwechsel auf dem Weg, den das HA-Frontend selbst geht. */
  private _navigiere(pfad: string): void {
    history.pushState(null, '', pfad)
    const ereignis = new Event('location-changed', { bubbles: true, composed: true })
    ;(ereignis as Event & { detail?: unknown }).detail = { replace: false }
    this.dispatchEvent(ereignis)
  }

  private _oeffneDialog(entityId?: string): void {
    if (!entityId) return
    const ereignis = new Event('hass-more-info', { bubbles: true, composed: true })
    ;(ereignis as Event & { detail?: unknown }).detail = { entityId }
    this.dispatchEvent(ereignis)
  }

  private _taste(event: KeyboardEvent, ziel: string, entityId?: string): void {
    if (!ziel && !entityId) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    this._klick(ziel, entityId)
  }
}

interface KnotenWert {
  wert: Aufloesung
  richtung?: 'hoch' | 'runter' | 'links' | 'rechts'
  farbe?: string
}

interface KnotenTeil {
  symbol: string
  beschriftung: string
  farbe: string
  werte: KnotenWert[]
  schwelle: number
  /** Vom Benutzer im HEMS gesetzte Farbe. Sie schlägt die Palette. */
  farbeRoh?: string
  /** Vom Benutzer im HEMS gesetzte Farbe des Freigabe-Rings. Leer = weißer
      Standardwert aus dem Token. Wirkt nur auf den aktiven Ring — der graue
      gestrichelte Ring eines gesperrten Geräts setzt seine Farbe fest. */
  ringFarbeRoh?: string
  leitEntitaet?: string
  /** Dashboard-Ansicht, auf die ein Klick springt. Leer = More-Info-Dialog. */
  ziel?: string
  ring?: SVGTemplateResult | null
  ringElement?: SVGTemplateResult | null
  randlos?: boolean
  /** Eine Zeile oder mehrere. Mehr als drei passen nicht unter den Knoten. */
  untertitel?: string | string[]
  zusatz?: string
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
