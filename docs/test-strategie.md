# Teststrategie

## Befehle

```bash
npm test              # alle Tests
npm test <pfad>       # gezielt eine Datei
npm run typecheck              # Linting und Formatprüfung
```

Beides muss vor jedem Commit fehlerfrei durchlaufen — siehe [git-workflow.md](git-workflow.md).

## Testarten

| Art | Umfang | Ort |
|---|---|---|
| Unit | Eine reine Stufe, keine externen Zugriffe | `test/<modul>.test.ts` |
| Vertrag | Die Nutzlast des HEMS wird so gelesen, wie `kontrakt.md` sie beschreibt | `test/contract.test.ts` |
| Regression | Ein konkret aufgetretener Bug, damit er nicht wiederkehrt | beim jeweiligen Modul |

Die Teststruktur spiegelt die Struktur des Quellcodes: zu `src/power.ts` gehört
`test/power.test.ts`.

**Getestet wird ohne DOM und ohne HA-Attrappe.** `contract.ts` und `power.ts` bekommen ein
schlichtes Objekt in der Form von `hass.states` gestellt; `balance.ts` und `layout.ts` rechnen
ohnehin auf Zahlen. Genau dafür sind die Stufen rein.

**Die Renderstufe hat bewusst keine automatisierten Tests.** Sie wird über `tsc --noEmit` und die
Sichtprüfung aus [design-system.md](design-system.md) abgesichert. Ein Test, der SVG-Markup gegen
eine erwartete Zeichenkette prüft, bricht bei jeder Formatierung und beweist nichts über das,
worauf es ankommt: Lesbarkeit, Kontrast und Bewegung.

## Pflicht-Testfälle

Für jede neue Funktion mindestens:

1. **Normalfall** — erwartete Eingabe, erwartetes Ergebnis
2. **Fehlerfall** — ungültige Eingabe, definierter Fehler statt Absturz
3. **Leerzustand** — leere Liste, `null`, fehlende Datei

Für Funktionen, deren Ergebnis ein Mensch liest (Formatierung, Meldungstexte), zusätzlich:

4. **Anzeigeform** — das Ergebnis entspricht dem Format aus
   [nutzertexte.md](nutzertexte.md): `15.08.2026`, `21:03`, `1.234,5` — **ohne** Zonenkürzel,
   Offset, Statuscode oder technische Kennung. Zeitfunktionen werden dabei mit einem festen
   Zeitpunkt geprüft, je einmal in Sommer- und Winterzeit, damit die Umrechnung nachweislich
   stimmt, ohne dass die Zone im Text auftaucht.
5. **Leerwert** — `null`, `undefined` und ein unbrauchbarer Wert ergeben den Platzhalter, nie
   `null`, `undefined` oder `NaN` als Text.

Ein Bugfix ohne Regressionstest ist nicht abgeschlossen. Der Test muss **vor** dem Fix
nachweislich fehlschlagen.

## Grundregeln

- Tests laufen **ohne** Netzwerkzugriff, ohne echte Zugangsdaten und ohne spezielle Hardware.
  Externe Dienste werden gemockt.
- Tests sind reihenfolgeunabhängig und hinterlassen keinen Zustand.
- Keine `sleep`-Aufrufe zur Synchronisierung — sie sind langsam und trotzdem instabil.
- Ein Test prüft **eine** Aussage. Der Testname beschreibt sie auf Deutsch und in ganzen Worten:
  `test('unavailable wird nicht zu 0, sondern zu unbekannt')`.
- Keine Zeitabhängigkeit ohne übergebenen Zeitpunkt.
- Testdaten stehen als Hilfsfunktion im Testmodul, nicht als kopierte Objektliterale in jedem
  einzelnen Test.

## Was mindestens abgedeckt sein muss

Coverage ist ein Warnsignal, kein Ziel an sich. Diese Aussagen müssen aber belegt sein, weil an
ihnen die Lesbarkeit der Karte hängt:

**`power.test.ts`** — je `power_kind` Normalfall, Fehlerfall und Leerfall, dazu:

- `unavailable` wird nicht zu `0`, sondern zu unbekannt
- der Rückfallwert aus der Statusentität greift, wenn der Direktwert fehlt
- ein unbekannter `power_kind` ergibt unbekannt statt Fehler
- ein ausgefallener PV-Sensor macht die Summe unbekannt, nicht kleiner

**`balance.test.ts`**

- die Hausleistung wird gerechnet, wenn kein Hausensor gesetzt ist
- eine negative Hausbilanz wird auf `0` geklemmt **und gemeldet**
- die Gerätesumme wird proportional auf die Hausleistung gedeckelt
- unbekannte Geräte zählen mit `0` in die Summe, bleiben aber Knoten
- Kanten mit Wert `0` entstehen nicht

**`layout.test.ts`**

- 0, 1, 5 und 12 Geräte erzeugen überschneidungsfreie Knoten
- ab 7 Geräten entstehen zwei Spalten
- ein fehlender Knoten hinterlässt kein Loch

**`contract.test.ts`**

- eine höhere `schema_version` wird gemeldet, nicht geraten
- eine fehlende Statusentität ist kein Fehler
- ein neuer Zyklus löst Rendern aus, auch wenn `pool_w` gleich bleibt

## Was nur von Hand prüfbar ist

Diese Punkte verlangen eine laufende HA-Instanz und stehen deshalb in
[bekannte-luecken.md](bekannte-luecken.md), bis sie geprüft sind: gestopptes Add-on, Neustart von
Home Assistant, helles und dunkles Theme, ein Theme mit abweichenden `--energy-*`-Farben,
`prefers-reduced-motion`, Tastaturbedienung und Bildschirmleserausgabe.
