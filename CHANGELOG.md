# Changelog

Alle nennenswerten Änderungen an Skytech Power Flow Card.
Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Kategorien: `Hinzugefügt`, `Geändert`, `Veraltet`, `Entfernt`, `Behoben`, `Sicherheit`.

Einträge werden aus **Nutzersicht** formuliert — was sich für den Anwender ändert, nicht welche
Datei angefasst wurde.

## [Unveröffentlicht]

## [0.2.1] — 27.08.2026

### Behoben

- **Auf schmalen Karten liefen Leistungsangaben, Namen und Symbole ineinander.** Zwei Ursachen,
  beide behoben:
  - Die Anordnung brauchte mindestens 416 px Breite. Darunter wurde die **ganze Zeichnung**
    verkleinert und die Schrift mit ihr — bei 340 px Kartenbreite von 12 auf 8,5 px. Die Karte
    kennt jetzt einen zweiten, kompakten Maßstab mit kleineren Knoten und Symbolen. Sie wird damit
    kleiner **gezeichnet** statt verkleinert; ab rund 320 px bleibt die Schrift bei ihren echten
    11 px.
  - Die Abstände im Knoten waren schon im Entwurf zu klein: Symbol zu Wert 1,4 px, Kreisrand zu
    Beschriftung 2,3 px. Sie werden jetzt aus Symbol- und Schriftgröße gerechnet, mit 6 px als
    Untergrenze — und sind geprüft, was vorher nicht der Fall war.
- Beschriftung und Untertitel standen nur 12 px auseinander; Unterlängen und Oberlängen berührten
  sich. Der Zeilenabstand richtet sich jetzt nach der Schriftgröße.
- Die Karte hatte seitlich eine Polsterung, die von der gemessenen Breite abging — dadurch wurde
  die Zeichnung auch dann leicht verkleinert, wenn sie eigentlich gepasst hätte.

## [0.2.0] — 24.08.2026

### Geändert

- **Die Karte sieht anders aus.** Sie folgt jetzt der Bildsprache von `power-flow-card-plus`:
  Erzeugung oben, Netz links, Haus rechts, Speicher unten, die HEMS-Geräte als Spalte daneben.
  Die Werte stehen **im** Knoten, mit einem Richtungspfeil davor; die Beschriftung steht außen.
  Verbindungen laufen rechtwinklig mit einer gerundeten Ecke statt diagonal.
- **Knoten und Schrift behalten ihre Größe.** Vorher skalierte die ganze Zeichnung auf die
  Kartenbreite und schrumpfte die Beschriftung dabei unter die Lesbarkeit. Jetzt rechnet die Karte
  in Bildschirmpunkten; auf einer breiten Karte wird zentriert statt gedehnt.
- **Netz und Speicher zeigen beide Richtungen.** Statt einer vorzeichenbehafteten Zahl stehen
  Bezug und Einspeisung beziehungsweise Laden und Entladen untereinander — eine Zahl wie `−1,1 kW`
  an einem Knoten war nicht zu deuten.
- **Der Hausknoten trägt seine Herkunft.** Sein Ring ist nach Quelle in Bögen geteilt: wie viel des
  Verbrauchs gerade aus Erzeugung, Speicher und Netz kommt.
- **Die Leistung steckt in der Punktgeschwindigkeit, nicht in der Strichdicke.** Alle Linien sind
  gleich dünn. Vorher war der größte Fluss immer maximal dick, egal wie klein die Anlage war.
- Geräte bekommen eine eigene Farbe auf Rand, Symbol, Wert und Fluss.
- Erzeugungssensoren ohne Summenhaken erscheinen als Aufschlüsselung unter dem Knoten.

### Behoben

- **Beschriftungen lagen im Knoten darunter.** Die Zeilenhöhe war fest gesetzt und reichte für zwei
  bis drei Textzeilen nicht; bei Geräten ragte der Untertitel 22 px in den nächsten Kreis. Sie wird
  jetzt aus dem tatsächlichen Textblock gerechnet.
- **Symbole saßen rund 8 px nach oben links versetzt.** Der Rahmen um das Symbol war größer als das
  Symbol und zentrierte es nicht.
- **Bei unplausibler Hausbilanz verschwand jede Flusslinie.** Die Hausleistung wurde auf 0 geklemmt
  und deckelte damit jeden Gerätefluss auf 0 — die Karte zeigte Geräte mit mehreren Kilowatt, die
  an keiner Linie hingen. Eine unplausible Bilanz gilt jetzt als unbekannt; die Geräte behalten
  ihren eigenen Messwert, das Abzeichen bleibt.
- **Die Punkte sprangen statt zu laufen.** Ihre Geschwindigkeit hing am gerade größten Fluss der
  Anlage und änderte sich damit ständig; jede Änderung ließ die Animation von vorn beginnen. Sie
  kommt jetzt aus einem festen Erwartungsbereich und ist gerastert.
- **Die Karte zeichnete mehrmals pro Sekunde neu** (gemessen: 197 DOM-Änderungen in 12 Sekunden).
  Änderungen werden jetzt auf höchstens eine pro Sekunde zusammengefasst; ein neu angelegtes Gerät
  erscheint weiterhin sofort.
- **Pfeilspitzen waren zu groß und hatten die falsche Farbe.** Sie wuchsen mit der Strichbreite auf
  fast Knotengröße und erschienen in der Textfarbe statt in der Flussfarbe. Sie entfallen; die
  Richtung tragen die laufenden Punkte und die Pfeile in den Knoten.
- Linien mit dem Wert `0` verschwinden nicht mehr, sondern werden gedämpft gezeichnet — das Gerüst
  der Grafik bleibt stehen.

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
