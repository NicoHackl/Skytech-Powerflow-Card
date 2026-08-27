# Design-Entscheidungen

**Quelle der Wahrheit fürs „warum".** Wer wissen will, weshalb etwas so gebaut ist, schaut hier —
und ändert es nicht, ohne die Entscheidung hier zu widerrufen.

## Wann ein Eintrag entsteht

Immer, wenn eine Festlegung getroffen wird, die später jemand hinterfragen könnte:
Technologiewahl, Datenformat, Namensschema, Zuständigkeitsgrenze, bewusst nicht Gebautes,
neue Laufzeit-Abhängigkeit.

**Nicht** eingetragen werden reine Umsetzungsdetails, die der Code selbst zeigt.

## Ablauf

1. Nächste freie `D-xxx` vergeben (fortlaufend, nie wiederverwenden).
2. Zeile in die Tabelle unten eintragen.
3. Bei tragweiter Entscheidung zusätzlich ein ADR anlegen:
   `docs/adr/D-xxx-kurzname.md` auf Basis von [adr/0000-vorlage.md](adr/0000-vorlage.md), und aus
   der Tabelle darauf verlinken.
4. Wird eine Entscheidung später gekippt: alte Zeile auf Status **Ersetzt** setzen und auf die neue
   `D-yyy` verweisen. **Zeilen werden nie gelöscht** — sonst geht die Begründung verloren, warum
   der frühere Weg verworfen wurde.

## Status-Werte

| Status | Bedeutung |
|---|---|
| Aktiv | Gilt und ist umgesetzt |
| Geplant | Beschlossen, aber noch nicht im Code — siehe [roadmap.md](roadmap.md) |
| Ersetzt | Durch eine spätere Entscheidung abgelöst, Verweis in der Begründung |
| Verworfen | Bewusst nicht umgesetzt, Begründung bleibt als Warnung stehen |

## Log

| ID | Datum | Entscheidung | Status | Begründung / Verweis |
|---|---|---|---|---|
| D-001 | 23.08.2026 | Regeln für KI-Agenten liegen in `AGENTS.md`; `CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md` und `.cursor/rules/` sind reine Verweise darauf | Aktiv | Jede Regel existiert genau einmal. Alternative „je Tool eine eigene Datei" wurde verworfen, weil die Kopien erfahrungsgemäß auseinanderlaufen. |
| D-002 | 23.08.2026 | Datum immer `TT.MM.JJJJ`, Uhrzeit immer Berliner Zeit als `hh:mm` bzw. `hh:mm:ss`, ohne Offset oder Zonenkürzel (eiserne Regel 9 in [`AGENTS.md`](../AGENTS.md)) | Aktiv | Einheitliche Lesart in Doku, Changelog, Logs und UI. Alternative „ISO 8601 mit Offset überall" wurde verworfen: technisch korrekt, für die deutschsprachige Zielgruppe aber unlesbar. Maschinenformate bleiben davon ausgenommen. |
| D-003 | 23.08.2026 | Designsprachen über `data-design` (`ha` = Home Assistant mit `#18BCF2`, `fcr` = FC Ruderting), ohne Default und mit grauem Akzent als sichtbarem „nicht entschieden"; Hell/Dunkel über `data-theme` in jeder Sprache Pflicht (eiserne Regeln 10 und 11 in [`../AGENTS.md`](../AGENTS.md)) | Aktiv | Ein Vokabular, mehrere Akzentsätze. Alternative „je Designsprache eine eigene styles.css" wurde verworfen, weil dann jede Klassenänderung doppelt gepflegt werden müsste. Ein stiller Default wurde ebenfalls verworfen: er hätte fremde Projekte in den Farben eines anderen erscheinen lassen, statt die offene Entscheidung zu zeigen. |
| D-004 | 23.08.2026 | Ausgaben an den Nutzer zeigen nur, was ihn betrifft: keine Zeitzonen, Statuscodes, IDs, internen Zustandsnamen oder Stacktraces in der Oberfläche; Rohwerte laufen durch eine Formatierschicht (eiserne Regel 12 in [`../AGENTS.md`](../AGENTS.md), Details in [nutzertexte.md](nutzertexte.md)) | Aktiv | Umsetzungsvorgaben sind an mehreren Stellen als Anzeigetext gelandet („21:03 Berliner Zeit", „Anfrage fehlgeschlagen (500)"). Alternative „im Zweifel mehr anzeigen" wurde verworfen: technische Zusätze beantworten keine Frage des Nutzers, machen die Oberfläche unruhig und verlagern die Deutungsarbeit zu ihm. Die Angaben gehen nicht verloren, sie stehen im Log. |
| D-005 | 23.08.2026 | Die Karte ist ein einzelnes Lit-Web-Component, gebündelt zu genau einer Datei `dist/skytech-power-flow-card.js`, mit `lit` als einziger Laufzeitabhängigkeit und ohne jedes externe Asset (eiserne Regel 8 in [`../AGENTS.md`](../AGENTS.md)) | Aktiv | Die Vorlage schreibt React + Vite für Oberflächen fest — das gilt für eine eigenständige SPA und trifft hier nicht zu: die Karte läuft **im** Home-Assistant-Frontend, das selbst auf Lit aufbaut. Alternative „React mitliefern" wurde verworfen, weil sie eine zweite Rendering-Bibliothek in ein fremdes Frontend trägt, für ein einzelnes Custom Element. Alternative „ohne Bibliothek, direkt gegen die DOM-API" wurde ebenfalls verworfen: das reaktive Neuzeichnen bei jeder Zustandsänderung wäre handgeschriebener Wiederholcode. HACS liefert genau eine Datei aus, deshalb kein Code-Splitting. |
| D-009 | 27.08.2026 | Zwei Maßstäbe statt einer skalierten Zeichnung: passt der normale Satz an Maßen nicht in die gemessene Kartenbreite, wird der kompakte gezeichnet. Die Abstände im Knoten werden aus Symbol- und Schriftgröße gerechnet, nicht als Versätze gesetzt | Aktiv | Gemessen an der laufenden Anlage: bei 340 px Kartenbreite wurde die ganze Zeichnung auf Maßstab 0,77 verkleinert, die Schrift fiel von 12 auf 8,5 px, und Symbol, Wert und Beschriftung standen 1,4 beziehungsweise 2,3 px auseinander — sie lasen sich als ein Klumpen. Die Alternative „nur die Abstände vergrößern" wurde verworfen: sie hätte die Schrift auf dem Handy bei rund 9 px gelassen. Die Alternative „Geräte unter den Stamm klappen" wurde zurückgestellt — sie ändert die Anordnung je nach Breite und wird erst nötig, wenn auch kompakt nicht mehr passt. Preis: zwei Maßsätze, die beide geprüft werden müssen; die Tests laufen deshalb über beide. |
| D-007 | 24.08.2026 | Die Bildsprache folgt dem Vorbild `power-flow-card-plus`: feste Knotengrößen in Bildschirmpunkten statt einer mit der Kartenbreite skalierten Zeichnung, Werte **im** Kreis mit Richtungspfeil, rechtwinklige Führung mit einer gerundeten Ecke, konstante Strichbreite von 1 px, und die Leistung steckt in der **Punktgeschwindigkeit** statt in der Strichdicke | Aktiv | Die erste Fassung skalierte ein viewBox-Koordinatensystem auf die Kartenbreite und schrumpfte dabei 13-px-Text auf 11,3 px; Beschriftungen lagen strukturell im nächsten Knoten, weil die Zeilenhöhe fest gesetzt statt aus dem Textblock gerechnet war. Die Alternative „nur reparieren" wurde verworfen: sie hätte die Abstände geheilt, aber die Karte hätte weiter fremd im Dashboard gestanden. Die Alternative „HTML-Boxen wie im Vorbild" wurde ebenfalls verworfen — dort sind die Linienüberlagerungen je Konfiguration von Hand getunt und auf höchstens vier Einzelgeräte ausgelegt; das HEMS kennt beliebig viele, und deren Anordnung muss gerechnet werden. Geblieben ist ein SVG, das in echten Bildschirmpunkten rechnet. Preis: die Karte braucht einen `ResizeObserver`, um ihre eigene Breite zu kennen. |
| D-008 | 24.08.2026 | Das Rendern wird auf höchstens einmal pro Sekunde zusammengefasst; eine geänderte `revision` der Konfigurationsentität rendert weiterhin sofort | Aktiv | Gemessen an der laufenden Anlage: 197 DOM-Änderungen in 12 Sekunden. Die abonnierten Sensoren ändern sich viel häufiger als der Regelzyklus, und jede Änderung einzeln zu zeichnen ließ die Zahlen flackern. Die Alternative „seltener abonnieren" wurde verworfen: die Karte soll dem Messwert folgen, nur nicht jedem einzelnen Zwischenwert. Die Ausnahme für `revision` ist nötig, weil ein neu angelegtes Gerät sonst bis zu eine Sekunde fehlte. |
| D-006 | 23.08.2026 | Die Karte bringt **keinen** eigenen Hell/Dunkel-Schalter mit, sondern baut ausschließlich auf den Theme-Variablen von Home Assistant auf, jede mit Rückfallwert (eiserne Regel 11 in [`../AGENTS.md`](../AGENTS.md)) | Aktiv | Die Vorlage verlangt je Oberfläche einen sichtbaren Umschalter. Die Karte sitzt aber in einem fremden Dashboard, das seinen Schalter schon hat — ein zweiter wäre eine zweite Wahrheit und stünde nach einem Themewechsel falsch. Alternative „eigene Hell/Dunkel-Tokens" wurde verworfen: sie ignorierte jedes benutzerdefinierte Theme und ließe die Karte im Dashboard fremd wirken. Als Preis muss die Karte in beiden Modi und gegen mindestens ein Theme mit abweichenden `--energy-*`-Farben geprüft werden; das steht in den Abnahmekriterien. |
