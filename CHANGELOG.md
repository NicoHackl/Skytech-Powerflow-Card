# Changelog

Alle nennenswerten Änderungen an Skytech Power Flow Card.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Kategorien: `Hinzugefügt`, `Geändert`, `Veraltet`, `Entfernt`, `Behoben`, `Sicherheit`.

Einträge werden aus **Nutzersicht** formuliert — was sich für den Anwender ändert, nicht welche
Datei angefasst wurde.

## [Unveröffentlicht]

## [0.1.0] — 23.08.2026

### Hinzugefügt

- **Die Karte zeichnet den Leistungsfluss der Anlage** — Erzeugung, Netz, Speicher, Haus und die
  einzelnen Verbraucher. Im Dashboard genügt `type: custom:skytech-power-flow-card`; es wird
  keine einzige Entität verdrahtet. Alles Weitere liest die Karte aus zwei Sensoren, die das
  Skytech HEMS veröffentlicht.
- Ein im HEMS neu angelegtes Gerät erscheint von selbst, ein auf „nicht anzeigen" gesetztes
  verschwindet. Ein umbenanntes Gerät ändert seine Beschriftung, behält aber seine Position.
- Ein Sensor, der gerade nichts liefert, erscheint als `—` ohne Flusslinie — **nie** als `0 W`.
  Eine fehlende Messung sähe sonst aus wie ein ausgeschaltetes Gerät.
- Fällt ein Direktsensor aus, greift der Rückfallwert aus dem HEMS-Status.
- Kopfabzeichen melden, wenn das HEMS aus oder gesperrt ist, wenn seine Daten veralten oder wenn
  die Bilanz nicht aufgeht — etwa weil die Geräteleistung die Hausleistung übersteigt. Die Karte
  kürzt die Flüsse dann anteilig und sagt es, statt still eine falsche Grafik zu zeigen.
- Geräte, die das HEMS gerade regelt, tragen einen Ring in der Skytech-Farbe; ein ruhendes Gerät
  bekommt eine gestrichelte Linie und den Grund als Untertitel.
- Tippen auf einen Knoten öffnet den More-Info-Dialog von Home Assistant. Die Karte schaltet
  nichts.
- Lovelace-Editor mit drei optionalen Feldern: Überschrift, Konfigurations- und Status-Entität.
- Auslieferung über HACS und als Anhang am GitHub-Release, jeweils genau eine Datei.

### Sicherheit

- Die Karte macht keinen einzigen Netzwerkaufruf und speichert nichts. Sie liest ausschließlich
  `hass.states` und braucht keine Adminrechte.
