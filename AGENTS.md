# AGENTS.md — Skytech Power Flow Card

> **Diese Datei ist die einzige Quelle der Wahrheit für Projektregeln.**
> `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` und `.cursor/rules/` sind reine
> Verweise hierher und enthalten selbst **keine** Regeln. Regeln werden ausschließlich hier gepflegt.

## Projektzweck

Lovelace-Karte für Home Assistant, die den Leistungsfluss im Haus zeichnet — Erzeugung, Netz, Speicher, Haus und die einzelnen Verbraucher. Ihre gesamte Konfiguration liest sie aus zwei Sensoren, die das Skytech HEMS veröffentlicht; im Dashboard wird keine einzige Entität verdrahtet.

Tech-Stack: TypeScript (strict), Lit, Vite

## Präzedenz bei Widersprüchen

1. **Direkte Anweisung des Users im Gespräch** — schlägt alles.
2. **Diese Datei (`AGENTS.md`)** — die eisernen Regeln.
3. **`docs/`** — ausführliche technische Referenz.

Wenn `docs/` dieser Datei widerspricht, ist `docs/` falsch und wird korrigiert — nicht umgekehrt.

## Eiserne Regeln (nicht verhandelbar)

1. **Git:** Commit und Push erfolgen ausschließlich im Branch `claude/main` — nie direkt auf
   `main`. Existiert der Branch weder lokal noch remote, wird er beim ersten Arbeitspaket neu
   angelegt, nicht auf einen anderen Branch ausgewichen. Nach jeder abgeschlossenen Aufgabe wird
   committet und gepusht. Details: [docs/git-workflow.md](docs/git-workflow.md).
2. **Sprache Code:** Variablen, Funktionen, Klassen, Dateinamen **englisch**.
3. **Sprache Text:** Kommentare, Commit-Messages, Log-Meldungen, UI-Texte, Labels und
   User-Hinweise **deutsch**.
4. **Changelog-Pflicht:** Jede funktionale oder gestalterische Änderung bekommt im selben
   Arbeitspaket einen Eintrag in [CHANGELOG.md](CHANGELOG.md).
5. **Doku-Pflicht:** Ändert sich Verhalten, das in `docs/` beschrieben ist, wird die betroffene
   `docs/`-Datei im selben Arbeitspaket mitgeändert. Keine Nachreichung.
6. **Keine Secrets:** Keine API-Keys, Tokens oder Zugangsdaten im Code, in Logs, in Pfaden oder in
   Commit-Messages. Ausschließlich über Umgebungsvariablen, siehe
   [docs/konfiguration.md](docs/konfiguration.md).
7. **Nicht raten:** Ist eine Anforderung unklar, wird gefragt statt geraten. Getroffene Annahmen
   werden explizit genannt.
8. **Oberfläche:** Dieses Projekt ist keine Single-Page-Anwendung, sondern **ein einzelnes
   Web-Component**, das im Home-Assistant-Frontend läuft. Der Stack ist deshalb
   TypeScript (`strict`) + [Lit](https://lit.dev) + Vite, gebündelt zu **einer** Datei
   `dist/skytech-power-flow-card.js` (D-005). **Keine** weitere UI-Bibliothek, keine
   Diagrammbibliothek, kein CSS-Framework, kein State- oder Data-Fetching-Paket. **Keine externen
   Laufzeitabhängigkeiten und keine externen Assets** — keine Schriftart, kein Bild, kein
   CDN-Aufruf; Symbole kommen über das HA-eigene `<ha-icon>`. Einzige Laufzeitabhängigkeit ist
   `lit`. Keine Literalfarbe außerhalb der Token-Definition, keine gestaltenden Inline-Styles —
   berechnete Geometrie (Pfade, Strichbreiten, Positionen) ist davon ausgenommen. Vor der ersten
   Zeile Code [docs/architektur.md](docs/architektur.md),
   [docs/design-system.md](docs/design-system.md) und [docs/nutzertexte.md](docs/nutzertexte.md)
   lesen.
9. **Datum und Uhrzeit:** Datumsangaben ausnahmslos als `TT.MM.JJJJ` (z. B. `13.08.2026`).
   Uhrzeiten ausnahmslos in Berliner Zeit (`Europe/Berlin`, Sommer- wie Winterzeit) als `hh:mm`,
   bei Bedarf auf die Sekunde genau als `hh:mm:ss`. **Nie** ein Zeitzonen-Kürzel oder einen Offset
   anhängen — weder als Zeichen noch als Wort: kein `+02:00`, kein `Z`, kein `MESZ`, kein `UTC`,
   und ebenso wenig „Berliner Zeit", „Ortszeit" oder `(Europe/Berlin)` als Zusatz. Die Zeitzone ist
   eine **Umrechnungsvorschrift, kein Anzeigetext**; der Leser sieht `21:03`. Gilt für alle für
   Menschen lesbaren Ausgaben: Doku, `CHANGELOG.md`, ADRs, Commit-Messages, Log-Meldungen,
   UI-Texte und Fehlermeldungen. Maschinenformate (Datenbankspalten, API-Nutzlasten, Dateinamen)
   dürfen intern abweichen; bei der Ausgabe an den User wird nach Berliner Zeit in dieses Format
   umgesetzt. Wie viel davon überhaupt angezeigt wird, regelt Regel 12 und
   [docs/nutzertexte.md](docs/nutzertexte.md).
10. **Designsprache:** Es gibt zwei festgelegte, **einen Default gibt es nicht**, und geraten wird
    nie:
    - **FCR** (`data-design="fcr"`) — Vereinsfarben des FC Ruderting — für Aufgaben und Projekte
      mit Bezug zum **FC Ruderting**.
    - **Home Assistant** (`data-design="ha"`) — Weiß bzw. Schwarz je nach Hell-/Dunkel-Modus,
      Akzentfarbe **`#18BCF2`** an Stelle des Rots — für Aufgaben und Projekte mit Bezug zu
      **Home Assistant**.

    Für **jedes andere Projekt** und immer dann, wenn die Zuordnung nicht zweifelsfrei ist, wird
    die Farbwahl **erfragt, bevor die erste Zeile Oberfläche entsteht**. Die Frage entfällt nur,
    wenn der User die Designsprache bereits genannt hat — dann gilt ohne Rückfrage genau diese.
    Verlangt er ausdrücklich eine Rückfrage, wird **immer** gefragt, auch wenn die Zuordnung
    offensichtlich scheint. Fehlt `data-design`, bleibt der Akzent grau: eine Oberfläche ohne
    entschiedene Designsprache soll unfertig aussehen, nicht nach einem fremden Projekt.
    Für dieses Projekt gilt: **Home Assistant — Akzent `#18BCF2` (`data-design="ha"`)**.
    Details: [docs/design-system.md](docs/design-system.md).
11. **Hell und Dunkel:** Die Karte bringt **keinen eigenen Umschalter** mit — sie sitzt in einem
    fremden Dashboard, und ein zweiter Schalter neben dem von Home Assistant wäre eine zweite
    Wahrheit (D-006). Stattdessen baut sie ausschließlich auf den Theme-Variablen von Home
    Assistant auf (`--card-background-color`, `--primary-text-color`, `--secondary-text-color`,
    `--divider-color`, `--ha-card-border-radius`, `--energy-*`) und folgt damit jedem Theme in
    beiden Modi. Jede Variable bekommt einen Rückfallwert für Themes, die sie nicht setzen.
    Beide Modi sind zu prüfen, dazu mindestens ein Theme mit abweichenden `--energy-*`-Farben.
12. **Nur zeigen, was den Nutzer betrifft:** Eine Vorgabe an die Umsetzung ist **kein
    Anzeigetext**. Was der Nutzer sieht, beantwortet eine Frage, die er hat — alles andere gehört
    ins Log. Nie sichtbar sind deshalb: Zeitzonen und Offsets (Regel 9), HTTP-Statuscodes,
    Ausnahme- und Klassennamen, Stacktraces, Dateipfade, SQL, technische IDs, interne
    Zustands- und Feldnamen, Werkzeug- und Framework-Namen, `null`/`undefined`/`NaN` sowie
    Genauigkeit, die die Daten nicht hergeben. Prüffrage vor jeder Angabe: *Kann der Nutzer
    deswegen etwas anderes tun?* Nein → weglassen. Maßstab ist das **Publikum**: Was der
    Endnutzer liest, bleibt frei von Technik; was der Betreiber liest (Startabbruch,
    Konfigurationsfehler, Admin-CLI), nennt Pfad und Variablenname weiterhin — er soll es
    reparieren. Muss Technisches in einer Oberfläche doch erreichbar sein (Support,
    Administration), steht es aufgeklappt oder auf einer eigenen Seite, nie in der Hauptzeile.
    Details und Beispiele: [docs/nutzertexte.md](docs/nutzertexte.md).

## Befehle

| Zweck | Befehl |
|---|---|
| Abhängigkeiten installieren | `npm ci` |
| Tests | `npm test` |
| Linting / Formatierung | `npm run typecheck` |
| Build | `npm run build` |

Vor jedem Commit müssen Tests und Linting fehlerfrei durchlaufen.

## Wo steht was

Diese Datei enthält bewusst **keine** technischen Details. Vor der Arbeit an einem Thema die
passende Datei lesen, statt zu raten:

| Datei | Inhalt |
|---|---|
| [docs/README.md](docs/README.md) | Einstieg und Index der gesamten Doku |
| [docs/architektur.md](docs/architektur.md) | Komponenten, Datenfluss, Grenzen, Tech-Stack |
| [docs/entwicklerrichtlinien.md](docs/entwicklerrichtlinien.md) | Naming, Struktur, Fehlerbehandlung, Kommentarstil |
| [docs/design-system.md](docs/design-system.md) | Design-Tokens, Klassenkatalog, Zustände, Responsiv, Icons, Barrierefreiheit |
| [docs/nutzertexte.md](docs/nutzertexte.md) | Was der Nutzer zu sehen bekommt: Formatierung, Fehlermeldungen, Formulierung |
| [docs/git-workflow.md](docs/git-workflow.md) | Branches, Commit-Format, Versionierung, Release |
| [docs/test-strategie.md](docs/test-strategie.md) | Testarten, Pflicht-Testfälle, Coverage-Ziel |
| [docs/design-entscheidungen.md](docs/design-entscheidungen.md) | Entscheidungs-Log — Quelle der Wahrheit fürs „warum" |
| [docs/konfiguration.md](docs/konfiguration.md) | Env-Variablen, Config-Optionen, Secrets-Handhabung |
| [docs/datenmodell.md](docs/datenmodell.md) | Der Datenvertrag zum Skytech HEMS und wie die Karte ihn liest |
| [vertrag_powerflow_card_hems/kontrakt.md](vertrag_powerflow_card_hems/kontrakt.md) | **Der Datenvertrag selbst — autoritativ für jedes Feld** |
| [docs/sicherheit-datenschutz.md](docs/sicherheit-datenschutz.md) | Secrets, personenbezogene Daten, externe Dienste |
| [docs/bekannte-luecken.md](docs/bekannte-luecken.md) | Abweichungen Spec ↔ Code, Stolpersteine, offene Bugs |
| [docs/roadmap.md](docs/roadmap.md) | Meilensteine und Umsetzungsstand |

## Arbeitsablauf

1. Passende `docs/`-Datei lesen, bevor Code entsteht.
2. [docs/bekannte-luecken.md](docs/bekannte-luecken.md) prüfen, bevor angenommen wird, eine in der
   Doku beschriebene Funktion sei tatsächlich implementiert.
3. Implementieren, Tests und Linting laufen lassen.
4. Changelog- und Doku-Einträge im selben Arbeitspaket nachziehen.
5. Committen und pushen auf `claude/main`.
6. Neue Grundsatzentscheidung? → Eintrag in
   [docs/design-entscheidungen.md](docs/design-entscheidungen.md), ausführlich als ADR unter
   [docs/adr/](docs/adr/).
