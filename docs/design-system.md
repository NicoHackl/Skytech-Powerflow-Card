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

## Feste Maße

Die Karte **skaliert ihre Inhalte nicht** mit der Kartenbreite (D-007). Sie misst ihre Breite mit
einem `ResizeObserver` und rechnet in Bildschirmpunkten; die viewBox trägt genau diese Breite.

Es gibt **zwei Maßstäbe** (D-009). Passt der normale nicht in die gemessene Breite, wird der
kompakte gezeichnet — die Karte wird also kleiner **gezeichnet**, nicht als Ganzes verkleinert.
Eine verkleinerte Zeichnung nimmt die Schrift mit: bei 340 px Karte fiel sie so von 12 auf 8,5 px.

| Element | normal | kompakt |
|---|---|---|
| Knotendurchmesser | 80 px | 60 px |
| Symbol | 24 px | 20 px |
| Wert im Knoten | 12 px | 11 px |
| Beschriftung | 12 px | 11 px |
| Untertitel | 11 px | 10 px |
| Spaltenabstand | 104…150 px | 78…104 px |
| Mindestbreite bei vier Spalten | 416 px | **318 px** |

| Element | beide Maßstäbe |
|---|---|
| Strichbreite einer Kante | 1 px, `non-scaling-stroke` |
| Eckenradius einer Kante | 22 px |

Auf einer breiten Karte wird **zentriert, nicht gedehnt**. Reicht die Breite auch kompakt nicht,
rücken die Spalten enger zusammen — bis zu einer Grenze, unter der sich die Kreise berühren würden.

Die Karte hat seitlich **keine Polsterung**: die Zeichnung bringt ihren eigenen Rand mit. Eine
zweite Polsterung hätte von der gemessenen Breite abgezogen und die Karte doch wieder verkleinert.

**Mindestabstände**, in beiden Maßstäben eingehalten und geprüft:

| Abstand | mindestens |
|---|---|
| Symbol → Wert im Knoten | 6 px |
| Kreisrand → Beschriftung | 6 px |
| Beschriftung → Untertitel | das 1,35-fache der größeren Schrift |

Der Knoteninhalt wird auf der Knotenmitte **zentriert** und aus Symbolgröße, Schriftgröße und
diesen Abständen gerechnet — nicht mit festen Versätzen gesetzt. Verstreute Versätze waren der
Grund, warum Symbol und Wert 1,4 px auseinanderstanden und auf dem Handy ineinanderliefen.

Die Zeilenhöhe folgt daraus (Kreis + Beschriftung + zwei Untertitelzeilen + Luft). Zwei Zeilen,
weil die Erzeugungs-Aufschlüsselung so viele braucht.

## Aufbau

```text
        ┌───────────┐
        │ Erzeugung │
        └─────┬─────┘
              │             ┌───────────┐
  ┌──────┐    │             │ Heizstab  │
  │ Netz ├────┼────┬────────┼───────────┤
  └──────┘    │    │  Haus  │ Wallbox   │
        ┌─────┴──┐ │        ├───────────┤
        │Speicher├─┘        │ Heizlüfter│
        └────────┘          └───────────┘
```

Das Haus steht rechts der Erzeugung, die Quellen fließen von links und oben hinein — wie im
Vorbild. Die HEMS-Geräte hängen als Spalte rechts daneben und brechen ab sieben Einträgen in eine
zweite Spalte um.

Verbindungen laufen **rechtwinklig**: senkrechter Stummel aus dem Knoten, eine gerundete Ecke,
waagerechter Lauf in den Zielknoten. Fluchten zwei Knoten, wird eine gerade Linie gezogen.
Diagonalen gibt es nicht — sie kreuzten die Fläche zwischen den Spalten und machten die Karte
unruhig.

## Werte und Beschriftung

- Der Wert steht **im** Kreis, in der Quellfarbe, mit einem gezeichneten Richtungspfeil davor.
- Netz und Speicher zeigen **beide** Richtungen untereinander. Eine einzelne vorzeichenbehaftete
  Zahl an einem Knoten ist nicht zu deuten: `−1,1 kW` kann Einspeisung oder ein Messfehler sein.
- Die Beschriftung steht **außerhalb** — in der obersten Reihe über dem Kreis, sonst darunter.
  Über dem Kreis deshalb, weil die Linie dort nach unten abgeht und die Beschriftung sonst
  dazwischen läge.
- Beschriftungen werden auf Knotenbreite gekürzt; der volle Text steht im `<title>`.
- Der **Hausknoten** trägt keinen eigenen Rand, sondern einen nach Herkunft geteilten Ring:
  wie viel des Verbrauchs gerade aus Erzeugung, Speicher und Netz kommt.

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

  --spfc-battery-in: var(--energy-battery-in-color, #f06292);
  --spfc-accent:  #18bcf2;
  --spfc-unknown: var(--disabled-text-color, #bdbdbd);
  --spfc-warn:    var(--warning-color, #ff9800);

  /* Gerätefarben, zyklisch vergeben */
  --spfc-geraet-1: #d0cc5b;
  --spfc-geraet-2: #964cb5;
  --spfc-geraet-3: #b54c9d;
  --spfc-geraet-4: #5bd0cc;
}
```

Jeder Knoten trägt seine Farbe auf **Rand, Symbol, Wert und abgehendem Fluss** — nicht nur auf
einem davon. Ein grauer Kreis mit grauem Symbol neben einer farbigen Linie liest sich nicht als
dasselbe Ding.

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

## Speicherknoten

Der Hausspeicher und jeder AC-Speicher werden gleich gezeichnet:

- Ein Ring um den Knoten zeigt den **Ladestand**, die Prozentzahl steht als Untertitel darunter.
- Der Wert steht als **Betrag** im Kreis, mit Richtungspfeil: nach unten beim Laden, nach oben beim
  Einspeisen. Eine vorzeichenbehaftete Zahl an einem Knoten ließe offen, ob sie Einspeisung oder
  Messfehler ist.
- Die Farbe folgt der Richtung: `--spfc-battery-in` beim Laden, `--spfc-battery` beim Entladen.

Ein AC-Speicher trägt zusätzlich den **Akzentring** jedes HEMS-Geräts und, wenn er gerade nicht
mitregelt, den Grund als zweite Untertitelzeile.

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

- **Die Leistung steckt in der Geschwindigkeit, nicht in der Strichdicke.** Alle Linien sind
  gleich dünn. Eine zur Leistung proportionale Breite machte den größten Fluss immer maximal dick,
  egal wie klein die Anlage war.
- **Punktanimation:** ein `<circle>` je Kante, bewegt über `<animateMotion>` mit `<mpath>` und
  `calcMode="paced"`. Die Dauer kommt aus einem **festen** Erwartungsbereich und ist auf halbe
  Sekunden gerastert. Hinge sie am gerade größten Fluss, änderte sie sich bei jedem Messwert — und
  SMIL beginnt bei einer Änderung von vorn, der Punkt spränge zurück.
- **Ein Nullfluss löscht die Linie nicht**, er dämpft sie. Das Gerüst der Grafik bleibt damit
  stehen, statt bei jedem Nulldurchgang zu verschwinden.
- **`prefers-reduced-motion: reduce` schaltet die Punkte ab.** Die Richtung bleibt an den
  gezeichneten Pfeilen **in** den Knoten ablesbar. Pfeilspitzen an den Linien gibt es bewusst
  nicht: als `<marker>` skalierten sie mit der Strichbreite und lösten ihre Farbe im `<defs>`
  falsch auf.
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
