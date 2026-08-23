# Skytech Power Flow Card

Lovelace-Karte für Home Assistant, die den Leistungsfluss im Haus zeichnet — Erzeugung, Netz,
Speicher, Haus und die einzelnen Verbraucher.

Der Unterschied zu vergleichbaren Karten ist der Kern des Projekts: **im Dashboard wird keine
einzige Entität verdrahtet.** Die Karte liest ihre gesamte Konfiguration aus zwei Sensoren, die
das [Skytech HEMS](https://github.com/NicoHackl/SkytechHEMS) veröffentlicht. Wird dort ein Gerät
angelegt, umbenannt oder auf „nicht anzeigen" gesetzt, zieht die Karte ohne jede
Dashboard-Änderung nach.

Die minimale und im Regelfall vollständige Konfiguration lautet:

```yaml
type: custom:skytech-power-flow-card
```

## Warum fast keine Konfiguration

Die einzelnen Verbraucher einer Anlage sind genau die Geräte, die das HEMS ohnehin kennt und
regelt. Sie ein zweites Mal im Dashboard einzutragen hieße, zwei Wahrheiten über dieselbe Anlage
zu pflegen — und die zweite veraltet zuerst. Die Anlagenwerte, die das HEMS bisher nicht kannte
(Erzeugung, Netz, Hausleistung, Hausspeicher), stehen deshalb im HEMS-Panel unter „Flow Card".

Die Karte macht **keinen** Aufruf zum Add-on: sie liest ausschließlich `hass.states`. Dadurch
aktualisiert sie im Takt von Home Assistant statt im Regelintervall des HEMS, braucht keine
Adminrechte und zeichnet weiter, wenn das Add-on gerade steht.

Sie schaltet auch nichts. Ein Tippen auf einen Knoten öffnet den More-Info-Dialog von Home
Assistant, mehr nicht.

## Voraussetzung

Das Skytech HEMS in einer Version, die Kartendaten veröffentlicht, mit eingeschalteter
Veröffentlichung im Panel unter „Flow Card". Ohne die beiden Sensoren zeigt die Karte einen
Hinweis und sonst nichts — sie ist keine allgemeine Power-Flow-Karte.

## Installation

### Über HACS

1. HACS → Frontend → Menü → *Benutzerdefinierte Repositories*
2. `https://github.com/NicoHackl/Skytech-Powerflow-Card`, Kategorie *Lovelace*
3. Installieren, danach Home Assistant neu laden.

### Von Hand

1. `skytech-power-flow-card.js` aus dem [neuesten Release](https://github.com/NicoHackl/Skytech-Powerflow-Card/releases)
   nach `config/www/` legen.
2. Einstellungen → Dashboards → Menü → *Ressourcen* → hinzufügen:
   `/local/skytech-power-flow-card.js`, Typ *JavaScript-Modul*.

## Konfiguration

Alle drei Felder sind optional:

```yaml
type: custom:skytech-power-flow-card
config_entity: sensor.skytech_hems_flow_config   # Standard
status_entity: sensor.skytech_hems_flow_status   # Standard
title: "Leistungsfluss"                          # überschreibt die Überschrift aus dem HEMS
```

Alles andere — Erzeugung, Netz, Speicher, Geräteliste, Symbole, Farben, Animation — wird im
HEMS-Panel gepflegt.

## Wenn nichts angezeigt wird

| Was die Karte zeigt | Was zu tun ist |
|---|---|
| *„Das Skytech HEMS veröffentlicht noch keine Kartendaten."* | Im HEMS-Panel unter „Flow Card" die Veröffentlichung einschalten. Nach einem Neustart von Home Assistant kann es bis zu ein Regelintervall dauern, bis die Karte zurückkommt. |
| *„Die Kartendaten des Skytech HEMS sind unvollständig."* | Die genannte Entität existiert, trägt aber keine brauchbaren Attribute. Meist hilft ein Neustart des Add-ons. |
| *„Diese Karte ist älter als die Daten des Skytech HEMS."* | Die Karte über HACS aktualisieren. |
| Abzeichen *„HEMS aus"* oder *„HEMS gesperrt"* | Die Regelung ist ausgeschaltet beziehungsweise wegen eines unbrauchbaren Überschuss-Sensors gesperrt. Die Werte werden weiter gezeichnet. |
| Abzeichen *„HEMS-Daten veraltet"* | Das Add-on hat länger nicht mehr geschrieben. Die Karte zeichnet aus den HA-Entitäten weiter. |
| Ein Knoten zeigt `—` statt einer Zahl | Der zugehörige Sensor ist gerade nicht verfügbar. Das wird **nie** als `0 W` gezeichnet: eine fehlende Messung sähe sonst aus wie ein ausgeschaltetes Gerät. |
| Abzeichen *„Geräteleistung übersteigt Hausleistung"* | Die Summe der HEMS-Geräte ist größer als der gemessene Hausverbrauch. Die Karte kürzt die Flüsse anteilig und sagt es, statt still eine falsche Grafik zu zeigen. |

## Empfehlung: Recorder

Die Statusentität ändert sich in jedem Regelzyklus. Solange keine Historie gewünscht ist, gehören
beide Entitäten in die Ausschlussliste:

```yaml
recorder:
  exclude:
    entities:
      - sensor.skytech_hems_flow_config
      - sensor.skytech_hems_flow_status
```

## Entwicklung

```sh
npm ci
npm run typecheck
npm test
npm run build      # erzeugt genau eine Datei: dist/skytech-power-flow-card.js
```

Der Datenvertrag zum HEMS liegt in
[`vertrag_powerflow_card_hems/kontrakt.md`](vertrag_powerflow_card_hems/kontrakt.md) und ist für
jedes Feld autoritativ. Er liegt wortgleich auch im HEMS-Repository; geändert wird er nur additiv
(siehe [`docs/design-entscheidungen.md`](docs/design-entscheidungen.md)).

Regeln für die Arbeit am Projekt: [`AGENTS.md`](AGENTS.md).

## Lizenz

MIT — siehe [LICENSE](LICENSE).
