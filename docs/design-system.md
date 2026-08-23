# Design-System

> Verbindlich für die Darstellung der Karte. Aufbau und Code-Muster stehen in
> [architektur.md](architektur.md), der Inhalt der Texte in [nutzertexte.md](nutzertexte.md) —
> beides wird hier nicht wiederholt. Hier steht nur das Aussehen: Tokens, Zustände, Bewegung,
> Kontrast.

## Designsprache

Für dieses Projekt gilt **Home Assistant**, Akzent `#18BCF2` (eiserne Regel 10 in
[`../AGENTS.md`](../AGENTS.md)). Die Karte ist eine HA-Karte; eine andere Zuordnung stand nie zur
Debatte.

Der Akzent markiert **eine** Sache: Geräte, die das HEMS gerade regelt, bekommen einen Ring in
dieser Farbe. Er trennt sie sichtbar von der übrigen Hauslast. Großflächig wird er nirgends
eingesetzt — täte er das, wäre die Karte ein Skytech-Produkt in einem fremden Dashboard statt
einer Karte, die dort dazugehört.

## Hell und Dunkel

Die Karte bringt **keinen eigenen Umschalter** mit (D-006). Sie baut ausschließlich auf den
Theme-Variablen von Home Assistant auf und folgt damit jedem Theme in beiden Modi — auch einem
selbstgebauten.

Jede übernommene Variable bekommt einen Rückfallwert für Themes, die sie nicht setzen. Ohne den
wäre die Karte in einem sparsamen Theme unsichtbar.

## Tokens

Definiert **genau einmal**, am Wurzelelement in [`../src/styles.ts`](../src/styles.ts). Danach
wird ausschließlich über `var(--…)` zugegriffen.

```css
:host {
  /* Aus dem HA-Theme, mit Rückfallwert */
  --spfc-surface: var(--card-background-color, #fff);
  --spfc-text:    var(--primary-text-color, #212121);
  --spfc-text-2:  var(--secondary-text-color, #727272);
  --spfc-border:  var(--divider-color, #e0e0e0);

  /* Flussfarben — dieselben, die HA für seine Energiekarten setzt */
  --spfc-pv:      var(--energy-solar-color, #ff9800);
  --spfc-grid:    var(--energy-grid-consumption-color, #488fc2);
  --spfc-export:  var(--energy-grid-return-color, #8353d1);
  --spfc-battery: var(--energy-battery-out-color, #4db6ac);
  --spfc-house:   var(--energy-non-fossil-color, #0f9d58);

  --spfc-accent:  #18bcf2;
  --spfc-unknown: var(--disabled-text-color, #bdbdbd);
  --spfc-warn:    var(--warning-color, #ff9800);
}
```

Die `--energy-*`-Variablen sind die Farben der HA-eigenen Energiekarten. Sie zu verwenden lässt
die Karte im Dashboard zu Hause wirken und respektiert Themes, die sie umdefinieren.

**Keine Literalfarbe außerhalb dieses Blocks.** Die einzige Ausnahme ist `--spfc-accent` selbst:
er ist die Projektfarbe und kommt aus keinem Theme.

## Inline-Werte

Gestaltende Inline-Styles sind verboten. Zulässig sind Inline-Werte ausschließlich für **berechnete
Geometrie** — Pfadangaben, Strichbreiten, Positionen, Radien. Sie stehen im SVG, weil sie sich je
Renderlauf ändern; eine CSS-Klasse dafür gäbe es nicht.

Die einzige Ausnahme bei Farbe ist `devices[].farbe`: der Benutzer trägt sie im HEMS-Panel ein,
sie kann deshalb nicht als Token vorliegen. Sie wirkt nur auf den Rand des betreffenden Knotens.

## Zustände

**Zustand wird nie allein über Farbe transportiert.** Jeder Zustand, den eine Farbe trägt, hat
zusätzlich Text, Form oder Symbol:

| Zustand | Farbe | Zusätzlich |
|---|---|---|
| Gerät wird geregelt | Akzentring | durchgezogene Linie, Vorlesetext „vom HEMS geregelt" |
| Gerät regelt nicht mit | grauer Ring | **gestrichelte** Linie, Grund als Untertitel am Knoten |
| Wert unbekannt | gedämpft | `—` statt einer Zahl, **keine** Flusslinie |
| Warnung am Kopf | Warnfarbe | Klartext im Abzeichen, z. B. „Geräteleistung übersteigt Hausleistung" |
| Ladestand | Ring um den Knoten | Prozentzahl in der Beschriftung |

## Bewegung

- **Punktanimation:** ein `<circle>` je Kante, bewegt über `<animateMotion>` entlang desselben
  Pfades. Die Geschwindigkeit steigt mit der Leistung, gedeckelt auf einen Bereich, der ruhig
  bleibt. Kein Fluss heißt kein Punkt.
- **`prefers-reduced-motion: reduce` schaltet sie ab** — unabhängig davon, was der Vertrag sagt.
  Die Flussrichtung muss dann aus den Pfeilspitzen ablesbar bleiben. Deshalb trägt **jede** Kante
  eine Pfeilspitze, nicht nur die animierten.
- Zustandswechsel dauern höchstens 0,2 s. Nichts animiert länger als nötig.

## Kontrast

Mindestens **4,5:1** für Text, **3:1** für Linien und Ränder — in hellen wie in dunklen Themes.
Weil die Farben aus dem Theme kommen, ist das nicht allein durch die Tokens sicherzustellen: die
Sichtprüfung gehört zu jeder Änderung an der Zeichnung.

## Responsiv

Die Karte kennt **keine Medienabfrage**. Der `viewBox` wird aus der tatsächlichen Knotenzahl
berechnet, `preserveAspectRatio` erledigt die Skalierung. Das SVG ist `width: 100%; height: auto`.

Der Umbruch passiert in der Geometrie, nicht im CSS:

| Knoten rechts | Verhalten |
|---|---|
| bis 6 | eine Spalte |
| ab 7 | zwei Spalten |
| ab 13 | zusätzlich kleinere Knoten und kleinere Schrift |

Es wird **nie gescrollt und nie abgeschnitten**.

## Symbole

Ausschließlich `<ha-icon>` mit `mdi:`-Namen. Keine mitgelieferte Schrift, kein Bild, kein
CDN-Aufruf. Trägt ein Gerät kein eigenes Symbol, wählt die Karte eines nach `class`.

Symbole sind Dekoration: sie tragen `aria-hidden="true"`, die Bedeutung steht im `aria-label` des
Knotens.

## Barrierefreiheit

- Das SVG trägt `role="img"` und ein `aria-label` mit der **Zusammenfassung der Bilanz**, damit
  ein Bildschirmleser die Karte erfassen kann, ohne jeden Einzelknoten abzugehen.
- Jeder anklickbare Knoten ist über die Tastatur erreichbar (`tabindex="0"`, Auslösen mit Enter
  und Leertaste) und trägt ein `aria-label` in der Form *„Heizstab, 1,4 Kilowatt, vom HEMS
  geregelt"*. Die Einheit wird dort **ausgeschrieben** — „kW" liest eine Vorlesestimme nicht
  verlässlich.
- Ein Knoten **ohne** Leitentität ist nicht anklickbar und zeigt keinen Klickzeiger. Ein Ziel
  vorzutäuschen, das es nicht gibt, ist schlimmer als keines anzubieten.
- Der Fokus ist sichtbar: `:focus-visible` setzt einen Rahmen in der Akzentfarbe.
- Rein dekorative Elemente — Animationspunkte, Verbindungslinien, Ringe — sind `aria-hidden`.

## Beim Erweitern

1. Erst prüfen, ob ein vorhandenes Token trägt. Ein neues Token braucht eine Begründung.
2. Keine neue Klasse für einen Einzelfall.
3. Neue Farbe? Zuerst fragen, ob Home Assistant sie schon als `--energy-*` oder Theme-Variable
   führt. Eine eigene Farbe ist die Ausnahme, nicht der Anfang.
4. Beide Modi prüfen, dazu mindestens ein Theme mit abweichenden `--energy-*`-Farben.
