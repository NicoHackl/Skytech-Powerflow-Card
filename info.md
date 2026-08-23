# Skytech Power Flow Card

Zeichnet den Leistungsfluss im Haus — Erzeugung, Netz, Speicher, Haus und die einzelnen
Verbraucher.

Der Unterschied zu vergleichbaren Karten: **im Dashboard wird keine einzige Entität
verdrahtet.** Die Karte liest ihre gesamte Konfiguration aus zwei Sensoren, die das
[Skytech HEMS](https://github.com/NicoHackl/SkytechHEMS) veröffentlicht. Wird dort ein Gerät
angelegt, umbenannt oder entfernt, zieht die Karte von selbst nach.

```yaml
type: custom:skytech-power-flow-card
```

Mehr steht im Regelfall nicht im Dashboard.

## Voraussetzung

Das Skytech HEMS muss laufen und im Panel unter „Flow Card" die Veröffentlichung eingeschaltet
haben. Ohne die veröffentlichten Kartendaten zeigt die Karte einen Hinweis und sonst nichts.
