# Datenmodell

Die Karte hat **kein eigenes Schema und keine Persistenz**. Ihr einziges Datenmodell ist der
Vertrag zum Skytech HEMS.

## Der Datenvertrag

Autoritativ für jedes Feld, jeden Vorzeichenbegriff und jede Rückfallregel:
[`vertrag_powerflow_card_hems/kontrakt.md`](../vertrag_powerflow_card_hems/kontrakt.md).

Die Datei liegt **wortgleich** auch im HEMS-Repository. Bei Widerspruch zwischen ihr und einer
Beschreibung hier gilt sie, nicht diese Datei. Ihre TypeScript-Entsprechung steht in
[`src/types.ts`](../src/types.ts) und übernimmt die Feldnamen wortgleich — auch die deutschen
(`anzeige`, `farbe`, `reihenfolge`, `leistung_w`).

## Zwei Entitäten

| Entität | State | Inhalt | Fehlt sie? |
|---|---|---|---|
| `sensor.skytech_hems_flow_config` | Revisions-Kurzhash | Layout, Anlagenwerte, Geräteliste — ausschließlich **Verweise**, keine Messwerte | Die Karte zeigt einen Klartexthinweis und zeichnet nichts |
| `sensor.skytech_hems_flow_status` | `pool_w` | Kennzahlen des letzten Regelzyklus, Rückfallwert je Gerät | Kein Fehler. Es entfallen nur die Kopfabzeichen und die Rückfallebene |

Die Konfiguration trägt **Verweise, keine Messwerte**. Die Karte löst sie selbst gegen
`hass.states` auf. Dadurch aktualisiert die Grafik im Takt von Home Assistant und nicht im
Regelintervall des HEMS — und sie bleibt lesbar, wenn das Add-on gerade steht.

## Die fünf `power_kind`-Varianten

Der Erzeuger setzt `power_kind` autoritativ. Die Karte leitet ihn **nicht** aus `class` ab:
dieselbe Klasse kann verschiedene Varianten haben. Umsetzung in
[`src/power.ts`](../src/power.ts).

| `power_kind` | Herleitung |
|---|---|
| `watt` | Zustand von `power_entity` direkt |
| `ampere` | `power_entity` [A] × Summe der belegten `voltage_entities`, je fehlender Spannung 230 V, begrenzt auf die Phasenzahl |
| `binary_static` | Schalter `on` → `power_actual_entity`, sonst `static_power_w`; Schalter `off` → `0` |
| `battery_split` | `charge_power_entity` − `discharge_power_entity` |
| `battery_signed` | `power_entity`, bei `power_sign: positiv_entladen` mit −1 multipliziert |

Ein `power_kind`, den die Karte nicht kennt, ergibt **unbekannt** — keinen Fehler. Der Vertrag
erlaubt additive Erweiterungen.

## Die Geräteklasse entscheidet, was gezeichnet wird

`devices[].class` ist nicht nur Beschriftung. Ein Eintrag mit `class: "battery"` ist ein
**AC-Speicher**: ein HEMS-Gerät, das das Haus auch **speisen** kann. Er wird deshalb nicht bei den
Verbrauchern gezeichnet, sondern beim Hausspeicher — eine Zeile darunter, in derselben Spalte
(D-010).

| | Verbraucher (`controllable`, `binary`) | AC-Speicher (`battery`) |
|---|---|---|
| Ort | Spalte rechts vom Haus | unter dem Hausspeicher |
| Vorzeichen | immer Verbrauch | positiv = laden, negativ = ins Haus speisen |
| Anzeige | Wert wie gemessen | Betrag, **immer positiv**; die Richtung trägt der Pfeil |
| Ladestand | – | Ring um den Knoten plus Prozentzeile aus `soc_entity` |
| Hausbilanz | wird von der Hausleistung abgezogen | Laden senkt, Entladen erhöht sie |
| Deckelung | gegen die Hausleistung | keine — er hängt nicht am Hausknoten |

**Bewusste Vereinfachung:** Der Hausspeicher aus `standard.batterie` bekommt getrennte Kanten von
Erzeugung und Netz, weil die Karte seinen Anteil aus der Gesamtbilanz herleiten kann. Ein
AC-Speicher bekommt dagegen **eine** Kante zum Hausknoten. Woher er lädt, steht nirgends im
Vertrag; es aufzuteilen hieße, es zu erfinden.

## Drei Zustände jedes Werts

| Zustand | Wann | Darstellung |
|---|---|---|
| **gültig** | Entität vorhanden und in eine endliche Zahl wandelbar | Zahl, normale Farbe |
| **ersetzt** | Direktwert unbekannt, aber `status.devices[id].leistung_w` liefert eine Zahl | Zahl, in der Vorlesebeschreibung als „aus dem HEMS-Status" gekennzeichnet |
| **unbekannt** | weder das eine noch das andere | `—` in gedämpfter Farbe, **keine** Flusslinie |

Verbindlich: **„unbekannt" wird nie als `0` gezeichnet.** Eine fehlende Messung sähe sonst aus wie
ein ausgeschaltetes Gerät, und das ist die gefährlichere Verwechslung.

Die einzige Stelle, an der `0` richtig ist, ist ein binäres Gerät mit `switch_entity: off` — dort
ist der Zustand gemessen, nicht abwesend.

## Versionierung

`schema_version` ist eine ganze Zahl, aktuell **1**.

- **Additive Änderungen erhöhen sie nicht.** Neue optionale Felder, neue `power_kind`-Werte mit
  dokumentiertem Rückfallverhalten und neue Attribute sind jederzeit erlaubt; die Karte ignoriert,
  was sie nicht kennt.
- **Erhöht wird nur bei brechenden Änderungen:** ein Feld entfällt, wird umbenannt oder ändert
  seine Bedeutung oder Einheit.
- `schema_version` höher als unterstützt → Hinweis statt Grafik. Es wird nicht geraten.

So additiv ergänzt:

- `hems.interval_s` — der Vertrag verlangte von der Karte die Regel „Statusdaten älter als
  5 × Regelintervall", lieferte das Regelintervall aber nicht mit. Fehlt das Feld, nimmt die Karte
  30 Sekunden an.
- `standard.pv_detail_entities` — Erzeugungssensoren, die **nicht** summiert werden. Eine Anlage
  hat oft einen Sensor für die Systemleistung und je einen für die Strings; beides zu summieren
  verdoppelte die Erzeugung. Die Karte zeigt diese Zeilen als Aufschlüsselung unter dem
  Erzeugungsknoten und rechnet sie nie in die Summe.
- `anzeige.max_erwartete_leistung_w` — Obergrenze des Erwartungsbereichs für die
  Punktgeschwindigkeit. Fehlt sie, nimmt die Karte 5000 W an.

## Migrationen

Es gibt kein Schema, das migriert werden müsste. Ändert sich der Vertrag, werden im **selben**
Arbeitspaket geändert:

1. `vertrag_powerflow_card_hems/kontrakt.md` — **in beiden Repositories wortgleich**
2. `src/types.ts` und die auswertenden Stufen
3. diese Datei
4. die betroffenen Tests
