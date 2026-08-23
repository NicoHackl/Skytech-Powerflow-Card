import { LitElement, html, css, type TemplateResult } from 'lit'
import {
  STANDARD_CONFIG_ENTITY, STANDARD_STATUS_ENTITY,
  type CardConfig, type Hass,
} from './types'

/* Der Lovelace-Editor. Bewusst schmal: drei Felder.

   Erzeugung, Netz, Speicher und die Geräteliste werden im HEMS gepflegt.
   Sie hier ein zweites Mal anzubieten wäre eine zweite Wahrheit — und genau
   das ist der Zweck der Karte, sie loszuwerden. */

/** Die drei Felder, die der Editor anbietet. Alle optional. */
type OptionalesFeld = 'title' | 'config_entity' | 'status_entity'

export class SkytechPowerFlowCardEditor extends LitElement {
  static override styles = css`
    .felder {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 0;
    }

    .hinweis {
      color: var(--secondary-text-color, #727272);
      font-size: 0.875rem;
      line-height: 1.5;
      padding: 4px 0 8px;
    }
  `

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
  }

  declare hass: Hass | undefined
  declare _config: CardConfig

  constructor() {
    super()
    this._config = { type: 'custom:skytech-power-flow-card' }
  }

  setConfig(config: CardConfig): void {
    this._config = { ...config }
  }

  override render(): TemplateResult {
    return html`
      <div class="felder">
        <p class="hinweis">
          Erzeugung, Netz, Speicher und die Geräteliste werden im
          Skytech-HEMS-Panel unter „Flow Card" gepflegt — nicht hier.
        </p>

        <ha-textfield
          label="Überschrift"
          .value=${this._config.title ?? ''}
          helper="Leer lassen übernimmt die Überschrift aus dem HEMS."
          helperPersistent
          @input=${(event: Event) => this._setze(
            'title', (event.target as HTMLInputElement).value)}
        ></ha-textfield>

        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.config_entity ?? ''}
          .includeDomains=${['sensor']}
          label="Konfigurations-Entität"
          helper=${`Leer lassen verwendet ${STANDARD_CONFIG_ENTITY}.`}
          helperPersistent
          allow-custom-entity
          @value-changed=${(event: CustomEvent<{ value: string }>) => this._setze(
            'config_entity', event.detail.value)}
        ></ha-entity-picker>

        <ha-entity-picker
          .hass=${this.hass}
          .value=${this._config.status_entity ?? ''}
          .includeDomains=${['sensor']}
          label="Status-Entität"
          helper=${`Leer lassen verwendet ${STANDARD_STATUS_ENTITY}.`}
          helperPersistent
          allow-custom-entity
          @value-changed=${(event: CustomEvent<{ value: string }>) => this._setze(
            'status_entity', event.detail.value)}
        ></ha-entity-picker>
      </div>
    `
  }

  /** Ein leeres Feld wird entfernt statt als leerer String gespeichert —
      sonst stünde im Dashboard-YAML eine Zeile ohne Wirkung. */
  private _setze(schluessel: OptionalesFeld, wert: string): void {
    const config: CardConfig = { ...this._config }
    if (wert) {
      config[schluessel] = wert
    } else {
      delete config[schluessel]
    }
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }))
  }
}

customElements.define('skytech-power-flow-card-editor', SkytechPowerFlowCardEditor)
