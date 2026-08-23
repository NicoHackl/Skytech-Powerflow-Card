# Architektur

> Beschreibt den **tatsächlichen** Stand. Geplantes, aber nicht Umgesetztes gehört nach
> [roadmap.md](roadmap.md), Abweichungen nach [bekannte-luecken.md](bekannte-luecken.md).

## Zweck und Abgrenzung

Lovelace-Karte für Home Assistant, die den Leistungsfluss im Haus zeichnet — Erzeugung, Netz, Speicher, Haus und die einzelnen Verbraucher. Ihre gesamte Konfiguration liest sie aus zwei Sensoren, die das Skytech HEMS veröffentlicht; im Dashboard wird keine einzige Entität verdrahtet.

**Nicht** Aufgabe dieses Projekts:

- <Was bewusst außerhalb liegt — verhindert schleichenden Scope-Zuwachs>

## Tech-Stack

| Schicht | Technologie | Warum |
|---|---|---|
| Sprache / Laufzeit | TypeScript (strict), Lit, Vite | <Begründung, oder Verweis auf D-xxx> |
| Persistenz | <…> | <…> |
| Schnittstelle | <…> | <…> |
| Tests | <…> | <…> |

## Komponenten

```text
<Textdiagramm der Komponenten und ihrer Aufrufrichtung>

  ┌──────────┐      liest       ┌──────────┐
  │ Komp. A  │ ───────────────► │ Komp. B  │
  └──────────┘                  └──────────┘
```

| Komponente | Verantwortung | Darf nicht |
|---|---|---|
| <Name> | <eine Aufgabe> | <was ausdrücklich Aufgabe einer anderen Komponente ist> |

Regel: Keine Komponente übernimmt Aufgaben einer anderen. Verschiebt sich eine Verantwortung,
ist das eine Design-Entscheidung → [design-entscheidungen.md](design-entscheidungen.md).

## Datenfluss

<Weg der Daten von der Quelle bis zur Ausgabe, mit den Stellen, an denen validiert oder
persistiert wird. Schema und Verträge nicht hier ausbreiten, sondern verlinken:>

Details zum Datenvertrag: [datenmodell.md](datenmodell.md).

## Verzeichnisstruktur

```text
src/
├── <modul>/          # <Aufgabe>
└── <modul>/          # <Aufgabe>
```

## Invarianten

Zusagen, auf die sich der gesamte Code verlässt. Wer eine davon bricht, bricht das System:

1. <z. B. „IDs sind unveränderlich und nie ein Dateipfad">
2. <z. B. „Schreibende Zugriffe erfolgen ausschließlich über Komponente X">
3. <z. B. „Ausgaben werden atomar geschrieben: temporäre Datei, dann umbenennen">

## Start und Betrieb

```bash
npm ci
npm run build
```

Konfiguration: [konfiguration.md](konfiguration.md).
