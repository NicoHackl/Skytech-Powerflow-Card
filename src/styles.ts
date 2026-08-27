import { css } from 'lit'

/* Token-Definition genau einmal, am Wurzelelement. Danach nur noch var(--…).

   Grundlage sind die Theme-Variablen von Home Assistant: die Karte folgt damit
   jedem Theme in beiden Modi, ohne eine eigene Hell/Dunkel-Umschaltung zu
   brauchen (D-006). Die --energy-*-Variablen sind die Farben, die HA für seine
   eigenen Energiekarten setzt — sie zu verwenden lässt die Karte im Dashboard
   zu Hause wirken. Der Rückfallwert greift, wenn ein Theme sie nicht kennt. */

export const styles = css`
  :host {
    --spfc-surface: var(--card-background-color, #fff);
    --spfc-text:    var(--primary-text-color, #212121);
    --spfc-text-2:  var(--secondary-text-color, #727272);
    --spfc-border:  var(--divider-color, #e0e0e0);

    --spfc-pv:          var(--energy-solar-color, #ff9800);
    --spfc-grid:        var(--energy-grid-consumption-color, #488fc2);
    --spfc-export:      var(--energy-grid-return-color, #8353d1);
    --spfc-battery:     var(--energy-battery-out-color, #4db6ac);
    --spfc-battery-in:  var(--energy-battery-in-color, #f06292);
    --spfc-house:       var(--energy-non-fossil-color, #0f9d58);

    --spfc-accent:  #18bcf2;
    --spfc-unknown: var(--disabled-text-color, #bdbdbd);
    --spfc-warn:    var(--warning-color, #ff9800);

    /* Gerätefarben. Vier reichen: darüber hinaus wiederholt sich der Kranz,
       und die Zugehörigkeit trägt ohnehin die Beschriftung. */
    --spfc-geraet-1: #d0cc5b;
    --spfc-geraet-2: #964cb5;
    --spfc-geraet-3: #b54c9d;
    --spfc-geraet-4: #5bd0cc;

    display: block;
  }

  /* Seitlich keine Polsterung: die Zeichnung bringt ihren eigenen Rand mit,
     und eine zweite hier abgezogene Breite hätte die Karte doch wieder
     verkleinert — der Maßstab rechnet mit der gemessenen Kartenbreite. */
  ha-card {
    padding: 8px 0 12px;
    overflow: hidden;
  }

  .kopf {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 8px 4px;
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
  }

  /* ---------- Kanten ---------- */

  .kante {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Ein Nullfluss löscht die Linie nicht, er dämpft sie. Das Gerüst der
     Grafik bleibt damit stehen, statt bei jedem Nulldurchgang zu flackern. */
  .kante.ruhend {
    stroke: var(--spfc-unknown);
    opacity: 0.45;
  }

  .punkt {
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 4;
  }

  /* ---------- Knoten ---------- */

  .knoten-flaeche {
    fill: var(--spfc-surface);
    stroke: currentColor;
    stroke-width: 2;
  }

  .knoten-flaeche.randlos {
    stroke: none;
  }

  .knoten-ring {
    fill: none;
    stroke: var(--spfc-accent);
    stroke-width: 2;
  }

  .knoten-ring.ruhend {
    stroke-dasharray: 4 4;
    stroke: var(--spfc-unknown);
  }

  .soc-bahn {
    fill: none;
    stroke: var(--spfc-border);
    stroke-width: 4;
  }

  .soc-fuellung {
    fill: none;
    stroke: var(--spfc-battery);
    stroke-width: 4;
    stroke-linecap: butt;
  }

  .haus-anteil {
    fill: none;
    stroke-width: 4;
    /* Wechselt der Verbrauch die Herkunft, wandert der Ring weich mit,
       statt zu springen. */
    transition: stroke-dasharray 0.4s, stroke-dashoffset 0.4s;
  }

  .haus-anteil.von-pv      { stroke: var(--spfc-pv); }
  .haus-anteil.von-batterie { stroke: var(--spfc-battery); }
  .haus-anteil.von-netz    { stroke: var(--spfc-grid); }

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

  /* ---------- Text ---------- */

  /* Die Schriftgrößen kommen als Attribut aus dem Maßstab (normal/kompakt).
     Sie hier zu setzen würde das Attribut überstimmen — CSS schlägt eine
     Präsentationsangabe. */

  /* Eine Kontur in der Kartenfarbe, UNTER die Füllung gemalt. Sie deckt den
     einen Fall ab, den die seitliche Kantenführung nicht kennt: zwei Knoten in
     derselben Spalte werden weiterhin gerade verbunden, und diese Gerade läuft
     durch den Text darunter. */
  .beschriftung,
  .untertitel {
    paint-order: stroke;
    stroke: var(--spfc-surface);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .beschriftung {
    fill: var(--spfc-text);
    text-anchor: middle;
  }

  .wert {
    fill: currentColor;
    text-anchor: middle;
    font-weight: 500;
  }

  /* Gemessen im dunklen Theme: --spfc-unknown ergab 3,4:1 gegen den
     Kartengrund und blieb damit unter dem Mindestkontrast für Text. Dass der
     Wert unbekannt ist, sagt ohnehin das Zeichen selbst. */
  .wert.unbekannt {
    fill: var(--spfc-text-2);
  }

  .untertitel {
    fill: var(--spfc-text-2);
    text-anchor: middle;
  }

  .pfeil {
    fill: currentColor;
  }

  .symbol {
    color: currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  /* Bewegung ist eine Zugabe, kein Informationsträger: die Richtung bleibt an
     den Pfeilen in den Knoten ablesbar. */
  @media (prefers-reduced-motion: reduce) {
    .punkt {
      display: none;
    }
  }
`
