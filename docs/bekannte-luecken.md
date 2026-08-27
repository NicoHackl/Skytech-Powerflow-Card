# Bekannte Lücken und Stolpersteine

**Vor jeder Annahme lesen.** Diese Datei existiert, weil Doku und Code auseinanderlaufen. Steht
etwas in [architektur.md](architektur.md), heißt das nicht, dass es implementiert ist — hier steht,
wo nicht.

## Ungeprüft, nicht unfertig

Der Code läuft gegen Tests und einen synthetischen HA-Zustand. **An einer laufenden
Home-Assistant-Instanz ist er nicht erprobt.** Die folgenden Zusagen sind gebaut, aber nicht
belegt — sie werden nicht als erfüllt gemeldet, bis sie geprüft sind:

| Thema | Was zugesagt ist | Warum ungeprüft |
|---|---|---|
| Gestopptes Add-on | Die Karte zeichnet aus den HA-Entitäten weiter und zeigt „HEMS-Daten veraltet" | Verlangt ein laufendes Add-on, das man anhalten kann |
| Neustart von Home Assistant | Die Karte zeigt kurz ihren Klartexthinweis und kommt von selbst zurück, sobald das HEMS die Konfigurationsentität neu geschrieben hat | Verlangt einen echten HA-Neustart |
| Themes | Helles und dunkles Theme, dazu mindestens ein Theme mit abweichenden `--energy-*`-Farben | Verlangt eine laufende Oberfläche |
| `prefers-reduced-motion` | Nichts bewegt sich, die Flussrichtung bleibt an den Pfeilspitzen ablesbar | Nur im Browser prüfbar |
| Tastatur und Bildschirmleser | Jeder anklickbare Knoten ist erreichbar und trägt eine sprechende Beschreibung | Nur mit echter Vorlesesoftware prüfbar |
| `<ha-icon>` im `<foreignObject>` | Symbole erscheinen mittig im Knoten | Das Element gibt es nur im HA-Frontend |

## Stolpersteine

Dinge, die schon einmal Zeit gekostet haben:

- **Ein Navigationsziel wird nicht auf Existenz geprüft.** Zeigt es auf eine gelöschte Ansicht,
  meldet Home Assistant das nach dem Klick selbst. Die Karte kann es nicht wissen — sie kennt die
  Dashboards nicht.
- **Die Karte kennt ihre eigene Breite nur über einen `ResizeObserver`.** Vor der ersten Messung
  rechnet sie mit 480 px. In einer Umgebung ohne `ResizeObserver` bleibt es dabei — die Zeichnung
  ist dann nicht auf die Spalte abgestimmt, aber vollständig.
- **Die Beschriftung wird nach einer mittleren Zeichenbreite gekürzt, nicht gemessen.** SVG-Text
  kann nicht von selbst auslassen. Gerechnet wird mit dem 0,53-fachen der Schriftgröße je Zeichen.
  Gemessen liegt der tatsächliche Faktor im Mittel bei 0,52, im Einzelfall aber bei 0,66 — ein Name
  aus lauter breiten Zeichen kann die zugestandene Breite also überschreiten. Der bislang breiteste
  gemessene Text kam auf 107 px gegen 112 px Zugeständnis; Luft bis zum Kantenkorridor sind 8 px.
  Wird die Kürzung einmal knapp, ist `getComputedTextLength()` der Ausweg — das kostet aber einen
  zweiten Renderdurchlauf, deshalb bisher nicht gebaut. Der volle Text steht im `<title>`.
- **Zwei Werte im Knoten passen im kompakten Maßstab nicht in jeder Größenordnung.** Zeigt ein
  Knoten beide Richtungen **und** liegen die Werte über der Kilowattschwelle, ragt die untere Zahl
  auf einer Handykarte um bis zu 3 px über den Kreisrand. Der Kreis gibt die Sehne dort schlicht
  nicht her — auch ohne Symbol nicht. Der Überstand bleibt kleiner als der Freiraum bis zur
  nächsten Linie, trifft also nichts. Kleiner gesetzt wird die Zahl nicht: unter zwei Punkte
  Abzug wäre sie unlesbar.
- **Der Zustand der Statusentität ist `pool_w`, nicht ihre Nutzlast.** Er kann gleich bleiben,
  während sich ein Gerät in den Attributen ändert. Wer die Änderungserkennung nur auf `state`
  aufbaut, verschläft solche Zyklen. Deshalb zählt für diese eine Entität zusätzlich
  `last_cycle_at` (`src/contract.ts`).
- **Ohne Release findet HACS die Karte nicht.** `dist/` ist nicht eingecheckt (D-005), also gibt
  es die Datei nur als Release-Anhang. Ein Stand, der bloß auf `main` liegt, führt zu
  *„Repository structure for main is not compliant"* — es fehlt der Tag, nicht der Code.
  Ablauf: [git-workflow.md](git-workflow.md#release).
- **Die Karte darf nicht bei jeder Zustandsänderung rendern.** Der `hass`-Setter feuert für jede
  Entität im ganzen Haus. Ohne die Prüfung gegen die abonnierte Menge sind das Dutzende
  Renderläufe je Sekunde.

## Offene Bugs

Keine bekannt.

## Bewusst nicht umgesetzt

| Thema | Warum nicht | Verweis |
|---|---|---|
| Eigener Hell/Dunkel-Schalter | Die Karte sitzt in einem fremden Dashboard, das seinen Schalter schon hat | D-006 |
| React statt Lit | Eine zweite Rendering-Bibliothek in einem fremden Frontend, für ein einzelnes Custom Element | D-005 |
| Konfigurationsoberfläche für Anlagenwerte und Geräte | Zweite Pflegestelle, zweite Wahrheit — das ist Aufgabe des HEMS-Panels | [architektur.md](architektur.md#zweck-und-abgrenzung) |
| Sourcemap im Release | HACS liefert genau eine Datei aus; eine nicht mitgelieferte Karte wäre totes Gewicht | D-005 |

---

Wird ein Punkt behoben, wird er hier **gelöscht** und im [CHANGELOG.md](../CHANGELOG.md) vermerkt.
Eine Liste voller erledigter Einträge liest niemand mehr.
