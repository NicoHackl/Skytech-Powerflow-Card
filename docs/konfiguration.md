# Konfiguration

Die Karte hat **keine Umgebungsvariablen, keine Konfigurationsdatei und keine Secrets**. Sie läuft
im Browser im Home-Assistant-Frontend.

## Was im Dashboard steht

Alle drei Felder sind optional. Im Regelfall steht nur die erste Zeile da:

```yaml
type: custom:skytech-power-flow-card
config_entity: sensor.skytech_hems_flow_config   # Standard
status_entity: sensor.skytech_hems_flow_status   # Standard
title: "Leistungsfluss"                          # überschreibt die Überschrift aus dem HEMS
```

| Feld | Wirkung |
|---|---|
| `config_entity` | Andere Konfigurationsentität. Nur nötig, wenn mehrere HEMS-Instanzen in einer HA-Installation laufen |
| `status_entity` | Analog für den Status |
| `title` | Überschreibt `anzeige.titel` aus dem Vertrag. Leerer String heißt: keine Überschrift |

Ein leeres Feld wird vom Editor nicht gespeichert — eine Zeile ohne Wirkung gehört nicht ins
Dashboard-YAML.

## Was NICHT im Dashboard steht

Erzeugung, Netz, Hausleistung, Speicher, die Geräteliste, Symbole, Farben, Sichtbarkeit,
Animation und die W/kW-Schwelle werden im **HEMS-Panel unter „Flow Card"** gepflegt. Sie hier
noch einmal anzubieten wäre eine zweite Wahrheit, und die zweite veraltet zuerst.

## Installation

Über HACS oder von Hand als Lovelace-Ressource — beide Wege stehen in der
[README](../README.md#installation).

## Empfehlung: Recorder

Die Statusentität ändert sich in jedem Regelzyklus. Solange keine Historie gewünscht ist, gehören
beide Entitäten in die Ausschlussliste der Home-Assistant-Konfiguration:

```yaml
recorder:
  exclude:
    entities:
      - sensor.skytech_hems_flow_config
      - sensor.skytech_hems_flow_status
```

## Versionierung

Die Version steht in `package.json`. Sie ist von der Add-on-Version des HEMS **entkoppelt**: der
Datenvertrag ist die einzige Kopplung zwischen beiden Repositories, nicht die Versionsnummer.
