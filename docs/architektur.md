# Architektur

> Beschreibt den **tatsächlichen** Stand. Geplantes, aber nicht Umgesetztes gehört nach
> [roadmap.md](roadmap.md), Abweichungen nach [bekannte-luecken.md](bekannte-luecken.md).

## Zweck und Abgrenzung

Lovelace-Karte für Home Assistant, die den Leistungsfluss im Haus zeichnet — Erzeugung, Netz,
Speicher, Haus und die einzelnen Verbraucher. Ihre gesamte Konfiguration liest sie aus zwei
Sensoren, die das Skytech HEMS veröffentlicht; im Dashboard wird keine einzige Entität verdrahtet.

**Nicht** Aufgabe dieses Projekts:

- **Schreibende Aktionen.** Freigabe schalten, Priorität ändern, Modus umstellen — das gehört ins
  HEMS-Panel. Die Karte öffnet den More-Info-Dialog von Home Assistant, mehr nicht.
- **Eine Konfigurationsoberfläche** für Erzeugung, Netz, Speicher oder Geräte. Eine zweite
  Pflegestelle wäre eine zweite Wahrheit — und genau die loszuwerden ist der Zweck der Karte.
- **Energie statt Leistung** (kWh je Tag, Autarkiegrad, Eigenverbrauchsquote). Der Vertrag trägt
  heute reine Leistungswerte; Energiefelder wären eine additive Vertragserweiterung.
- **Anlagen ohne Skytech HEMS.** Ohne die Konfigurationsentität zeigt die Karte ihren Hinweis und
  sonst nichts. Sie ist keine allgemeine Power-Flow-Karte.
- **Rückwärtskompatibilität zu `power-flow-card-plus`.** Deren YAML-Konfiguration wird nicht
  gelesen.

## Tech-Stack

| Schicht | Technologie | Warum |
|---|---|---|
| Sprache | TypeScript im `strict`-Modus | Der Datenvertrag ist der einzige Kopplungspunkt zu einem zweiten Repository — ein Tippfehler in einem Feldnamen muss beim Übersetzen auffallen, nicht im Dashboard |
| Rendering | [Lit](https://lit.dev) | Das HA-Frontend baut selbst darauf auf; eine zweite Rendering-Bibliothek in ein fremdes Frontend zu tragen wäre unverhältnismäßig (D-005) |
| Bündelung | Vite / Rollup, ein ES-Modul | HACS liefert genau eine Datei aus, deshalb kein Code-Splitting (D-005) |
| Gestaltung | Theme-Variablen von Home Assistant | Die Karte folgt jedem Theme in beiden Modi, ohne eigene Umschaltung (D-006) |
| Symbole | `<ha-icon>` | Keine mitgelieferte Schrift, kein externes Asset |
| Tests | Vitest, ohne DOM | Die rechnenden Stufen sind rein und brauchen keine HA-Attrappe |
| Persistenz | keine | Die Karte hält keinen Zustand über einen Renderlauf hinaus außer dem Zustandsabzug für die Änderungserkennung |

Laufzeitabhängigkeit ist ausschließlich `lit`.

## Komponenten

```text
  hass.states
      │
      ▼
  contract.ts   liest beide Entitäten, prüft schema_version
      │
      ▼
  power.ts      löst jeden Verweis auf → { wert, quelle }
      │
      ▼
  balance.ts    Knotenwerte und Kantenflüsse, Deckelung gegen die Hausleistung
      │
      ▼
  layout.ts     Knotenpositionen, Kantenpfade
      │
      ▼
  flow-svg.ts   Pfade, Strichbreiten, Punktanimation
      │
      ▼
  skytech-power-flow-card.ts   <ha-card> mit SVG, Beschriftungen, Kopfabzeichen
```

| Komponente | Verantwortung | Darf nicht |
|---|---|---|
| `src/skytech-power-flow-card.ts` | Kartenelement: Zustandsübernahme, Renderreihenfolge, More-Info-Dialog, Kopfabzeichen | Rechnen — Bilanz und Geometrie kommen fertig aus den Stufen darunter |
| `src/editor.ts` | Die drei Felder des Lovelace-Editors | Anlagenwerte oder Geräte anbieten; die gehören ins HEMS-Panel |
| `src/contract.ts` | Beide Entitäten lesen, Schemaversion prüfen, die Menge der abonnierten Entitäten bilden | Werte auflösen oder rechnen |
| `src/power.ts` | Jeden Verweis nach `power_kind` in Watt auflösen, Vorzeichen anwenden, Rückfallebene ziehen | Bilanzieren oder deckeln |
| `src/balance.ts` | Knotenwerte, Herkunft und Verbleib, Deckelung, Kartenhinweise | `hass` kennen |
| `src/layout.ts` | Geometrie: Positionen, viewBox, Kantenpfade | Farben oder Werte kennen |
| `src/flow-svg.ts` | SVG-Bausteine: Kante, Punkt, Ringe, Pfeilspitze | Entscheiden, welche Kante überhaupt gezeichnet wird |
| `src/format.ts` | Alles, was ein Mensch liest: W/kW, Prozent, `—`, Zeitpunkte | Rechnen oder umrechnen — Zeitstempel kommen fertig aus dem Vertrag |
| `src/styles.ts` | Token-Definition und Klassen | Literalfarben außerhalb des Tokenblocks |
| `src/types.ts` | Der Datenvertrag als Typen | Vom Vertrag abweichen |

Regel: Keine Komponente übernimmt Aufgaben einer anderen. Verschiebt sich eine Verantwortung,
ist das eine Design-Entscheidung → [design-entscheidungen.md](design-entscheidungen.md).

## Datenfluss

Jede Stufe ist **rein**: gleiche Eingabe, gleiche Ausgabe. Nur `contract.ts` und `power.ts` sehen
`hass`; alles danach rechnet auf Zahlen. Genau daran hängt, dass `power.ts`, `balance.ts` und
`layout.ts` ohne HA-Attrappe testbar sind.

Ausgelöst wird der Lauf vom `hass`-Setter. Er rendert **nur**, wenn sich eine abonnierte Entität
tatsächlich geändert hat — sonst rechnete die Karte bei jeder Zustandsänderung im ganzen Haus neu.
Die Menge der abonnierten Entitäten wird neu gebildet, sobald sich `revision` der
Konfigurationsentität ändert.

Für die Statusentität zählt zusätzlich `last_cycle_at`: ihr Zustand ist `pool_w` und kann gleich
bleiben, während sich ein Gerät in den Attributen ändert.

Details zum Datenvertrag: [datenmodell.md](datenmodell.md).

## Verzeichnisstruktur

```text
src/
├── skytech-power-flow-card.ts   Kartenelement, Registrierung, Render
├── editor.ts                    Lovelace-Editor, drei Felder
├── types.ts                     Datenvertrag als TypeScript-Typen
├── contract.ts                  Lesen und Prüfen der beiden Entitäten
├── power.ts                     Auflösung je power_kind, Vorzeichen, Zustände
├── balance.ts                   Bilanzregeln, Knoten- und Kantenwerte
├── layout.ts                    Geometrie: Knotenpositionen, Kantenpfade
├── flow-svg.ts                  SVG-Erzeugung, Linienstärke, Punktanimation
├── format.ts                    W/kW-Formatierung, Prozent, „—"
└── styles.ts                    Token-Definition und Klassen
test/
├── contract.test.ts
├── power.test.ts
├── balance.test.ts
└── layout.test.ts
```

`dist/` ist **nicht** eingecheckt: HACS und das GitHub-Release liefern die gebaute Datei aus.

## Invarianten

Zusagen, auf die sich der gesamte Code verlässt. Wer eine davon bricht, bricht das System:

1. **`devices[].id` ist die einzige Identität.** Gemerkte Zustände hängen an `id`, nie an `label`
   und nie an der Position im Array.
2. **Entity-IDs werden nie aus Präfixen zusammengesetzt.** Jede benötigte ID steht ausgeschrieben
   im Vertrag. Das Namensmuster der HEMS-Helfer ist Wissen des Erzeugers und bleibt es.
3. **Ungültig wird niemals `0`.** Ein unbrauchbarer Messwert erscheint als `—` ohne Flusslinie.
   Als `0 W` gezeichnet wäre er von einem ausgeschalteten Gerät nicht zu unterscheiden.
4. **Die Karte schreibt nichts.** Kein HTTP-Aufruf, kein Service-Aufruf, keine Zustandsänderung in
   Home Assistant.
5. **Nur `contract.ts` und `power.ts` kennen `hass`.** Alle folgenden Stufen rechnen auf reinen
   Daten.
6. **Ein unbekanntes Feld ist kein Fehler.** Der Vertrag wächst additiv; was die Karte nicht kennt,
   ignoriert sie. Nur eine höhere `schema_version` führt zum Hinweis statt zur Grafik.

## Start und Betrieb

```bash
npm ci
npm run build      # erzeugt genau eine Datei: dist/skytech-power-flow-card.js
```

Konfiguration: [konfiguration.md](konfiguration.md).
