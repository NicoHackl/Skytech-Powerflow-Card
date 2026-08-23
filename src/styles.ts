import { css } from 'lit'

/* Token-Definition genau einmal, am Wurzelelement. Danach nur noch var(--…).

   Grundlage sind die Theme-Variablen von Home Assistant: die Karte folgt
   damit jedem Theme in beiden Modi, ohne eine eigene Hell/Dunkel-Umschaltung
   zu brauchen (D-006). Die --energy-*-Variablen sind die Farben, die HA für
   seine eigenen Energiekarten setzt — sie zu verwenden lässt die Karte im
   Dashboard zu Hause wirken. Der Rückfallwert greift, wenn ein Theme sie
   nicht kennt. */

export const styles = css`
  :host {
    --spfc-surface: var(--card-background-color, #fff);
    --spfc-text:    var(--primary-text-color, #212121);
    --spfc-text-2:  var(--secondary-text-color, #727272);
    --spfc-border:  var(--divider-color, #e0e0e0);

    --spfc-pv:      var(--energy-solar-color, #ff9800);
    --spfc-grid:    var(--energy-grid-consumption-color, #488fc2);
    --spfc-export:  var(--energy-grid-return-color, #8353d1);
    --spfc-battery: var(--energy-battery-out-color, #4db6ac);
    --spfc-house:   var(--energy-non-fossil-color, #0f9d58);

    --spfc-accent:  #18bcf2;
    --spfc-unknown: var(--disabled-text-color, #bdbdbd);
    --spfc-warn:    var(--warning-color, #ff9800);

    display: block;
  }

  ha-card {
    padding: 12px 12px 16px;
  }

  .kopf {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 4px 4px 10px;
  }

  .titel {
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--spfc-text);
    margin-right: auto;
  }

  .abzeichen {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    line-height: 1.6;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--spfc-border);
    color: var(--spfc-text-2);
    white-space: nowrap;
  }

  .abzeichen.warnung {
    border-color: var(--spfc-warn);
    color: var(--spfc-warn);
  }

  .hinweis {
    padding: 20px 16px;
    color: var(--spfc-text-2);
    line-height: 1.5;
    text-align: center;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .kante {
    fill: none;
    stroke-linecap: round;
  }

  .knoten-flaeche {
    fill: var(--spfc-surface);
    stroke: var(--spfc-border);
    stroke-width: 1.5;
  }

  .knoten-ring {
    fill: none;
    stroke: var(--spfc-accent);
    stroke-width: 2.5;
  }

  .knoten-ring.ruhend {
    stroke-dasharray: 4 4;
    stroke: var(--spfc-unknown);
  }

  .soc-bahn {
    fill: none;
    stroke: var(--spfc-border);
    stroke-width: 3;
  }

  .soc-fuellung {
    fill: none;
    stroke: var(--spfc-battery);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .knoten {
    cursor: default;
  }

  .knoten.klickbar {
    cursor: pointer;
  }

  .knoten.klickbar:focus-visible {
    outline: 2px solid var(--spfc-accent);
    outline-offset: 3px;
    border-radius: 50%;
  }

  .beschriftung {
    fill: var(--spfc-text);
    text-anchor: middle;
    font-weight: 500;
  }

  .wert {
    fill: var(--spfc-text-2);
    text-anchor: middle;
  }

  .wert.unbekannt {
    fill: var(--spfc-unknown);
  }

  .untertitel {
    fill: var(--spfc-unknown);
    text-anchor: middle;
  }

  .punkt {
    fill: currentColor;
  }

  .symbol {
    color: var(--spfc-text-2);
    --mdc-icon-size: 22px;
  }

  /* Bewegung ist eine Zugabe, kein Informationsträger: die Flussrichtung
     bleibt an den Pfeilspitzen ablesbar. */
  @media (prefers-reduced-motion: reduce) {
    .punkt {
      display: none;
    }
  }
`
