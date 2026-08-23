# Roadmap

Meilensteine und **ehrlicher** Umsetzungsstand. Der Status wird gegen den tatsächlichen Code
geprüft, nicht gegen die Absicht. Was hier „fertig" heißt, muss laufen.

## Status-Werte

`offen` · `in Arbeit` · `fertig` · `zurückgestellt`

## Meilensteine

### M1 — Die Karte zeichnet die Anlage

**Ziel:** Eine Karte, die mit `type: custom:skytech-power-flow-card` angelegt wurde, zeichnet die
vollständige Anlage. Ein im HEMS neu angelegtes Gerät erscheint, ohne dass das Dashboard angefasst
wird.

| Punkt | Status | Verweis |
|---|---|---|
| Datenvertrag als TypeScript-Typen | fertig | [datenmodell.md](datenmodell.md) |
| Lesen und Prüfen der beiden Entitäten | fertig | `src/contract.ts` |
| Auflösung aller fünf `power_kind`-Varianten | fertig | [datenmodell.md](datenmodell.md) |
| Bilanz, Deckelung und Kartenhinweise | fertig | `src/balance.ts` |
| Geometrie, Umbruch, responsive viewBox | fertig | `src/layout.ts` |
| SVG mit Punktanimation und Pfeilspitzen | fertig | `src/flow-svg.ts` |
| Kopfabzeichen aus dem HEMS-Status | fertig | `src/skytech-power-flow-card.ts` |
| Lovelace-Editor mit drei Feldern | fertig | `src/editor.ts` |
| Auslieferung über HACS und GitHub-Release | fertig | [README](../README.md#installation) |

### M2 — Erprobung an einer laufenden Anlage

**Ziel:** Was sich nur an einer echten HA-Instanz prüfen lässt, ist geprüft — und die Karte
verhält sich auch dann noch richtig, wenn etwas ausfällt.

| Punkt | Status | Verweis |
|---|---|---|
| Gestopptes Add-on: Karte zeichnet weiter, Abzeichen erscheint | offen | [bekannte-luecken.md](bekannte-luecken.md) |
| Neustart von Home Assistant: Karte kommt von selbst zurück | offen | [bekannte-luecken.md](bekannte-luecken.md) |
| Helles und dunkles Theme, dazu abweichende `--energy-*`-Farben | offen | [design-system.md](design-system.md) |
| `prefers-reduced-motion`: nichts bewegt sich, Richtung bleibt lesbar | offen | [design-system.md](design-system.md) |
| Tastaturbedienung und Bildschirmleserausgabe | offen | [design-system.md](design-system.md) |

## Zurückgestellt

| Thema | Warum zurückgestellt | Bedingung für Wiederaufnahme |
|---|---|---|
| Energie statt Leistung (kWh je Tag, Autarkiegrad, Eigenverbrauchsquote) | Der Vertrag trägt heute reine Leistungswerte. Energiefelder wären eine additive Vertragserweiterung und müssten zuerst im HEMS entstehen | Der Erzeuger veröffentlicht Energiewerte |
| Schreibende Aktionen aus der Karte heraus | Zwei Bedienstellen für dieselbe Freigabe wären zwei Wahrheiten. Das HEMS-Panel ist die eine | Nur nach ausdrücklicher Entscheidung, mit Eintrag im Entscheidungs-Log |

---

Beschlossen, aber noch nicht gebaut → hier mit Status `offen`.
Gebaut, aber abweichend von der Doku → [bekannte-luecken.md](bekannte-luecken.md).
Warum so entschieden → [design-entscheidungen.md](design-entscheidungen.md).
