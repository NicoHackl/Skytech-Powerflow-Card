import { describe, expect, test } from 'vitest'
import {
  baueGeometrie, findeKnoten, kantenPfad, knotenInhalt, mindestBreite,
  KOMPAKT, LUFT_AUSSEN, LUFT_INNEN, NORMAL,
  type Geometrie, type Knoten, type LayoutEingabe,
} from '../src/layout'

/* Geometrie. Gerechnet wird in Bildschirmpunkten — geprüft wird deshalb, dass
   der Textblock eines Knotens den nächsten nicht berührt. Genau das war der
   Fehler der ersten Fassung: die Wertzeile lag 7 px im Kreis darunter. */

function eingabe(teil: Partial<LayoutEingabe> = {}): LayoutEingabe {
  return {
    pv: true, netz: true, batterie: true, hausKnoten: true,
    geraeteIds: [], rest: false, breite: 500, ...teil,
  }
}

function geraete(anzahl: number): string[] {
  return Array.from({ length: anzahl }, (_, index) => `geraet_${index + 1}`)
}

/** Der Platz, den ein Knoten samt Beschriftung und Untertitel beansprucht. */
function kasten(knoten: Knoten, geometrie: Geometrie) {
  const block = knotenInhalt(geometrie.mass, 1).textBlock
  const oben = knoten.beschriftung === 'oben'
    ? knoten.y - knoten.r - block
    : knoten.y - knoten.r
  const unten = knoten.y + knoten.r + block
  return { links: knoten.x - knoten.r, rechts: knoten.x + knoten.r, oben, unten }
}

function ueberschneidungsfrei(geometrie: Geometrie): boolean {
  const kaesten = geometrie.knoten.map((k) => kasten(k, geometrie))
  for (let a = 0; a < kaesten.length; a += 1) {
    for (let b = a + 1; b < kaesten.length; b += 1) {
      const l = kaesten[a]!
      const r = kaesten[b]!
      const waagerecht = l.rechts > r.links && r.rechts > l.links
      const senkrecht = l.unten > r.oben && r.unten > l.oben
      if (waagerecht && senkrecht) return false
    }
  }
  return true
}

describe('Textblock und Knoten', () => {
  test('die Beschriftung eines Knotens liegt nie im nächsten Knoten', () => {
    for (const anzahl of [0, 1, 3, 5, 8, 12]) {
      const geometrie = baueGeometrie(eingabe({ geraeteIds: geraete(anzahl), rest: true }))
      expect(ueberschneidungsfrei(geometrie), `${anzahl} Geräte`).toBe(true)
    }
  })

  test('unter dem Kreis bleibt Platz für Beschriftung und Untertitel', () => {
    const geometrie = baueGeometrie(eingabe({ geraeteIds: geraete(3) }))
    const oben = findeKnoten(geometrie, 'geraet_1')!
    const unten = findeKnoten(geometrie, 'geraet_2')!
    const luft = (unten.y - unten.r) - (oben.y + oben.r)
    expect(luft).toBeGreaterThanOrEqual(knotenInhalt(geometrie.mass, 1).textBlock + 6)
  })

  test('die oberste Reihe beschriftet über dem Kreis', () => {
    // Sonst läge die Beschriftung zwischen Knoten und abgehender Linie.
    const geometrie = baueGeometrie(eingabe())
    expect(findeKnoten(geometrie, 'pv')!.beschriftung).toBe('oben')
    expect(findeKnoten(geometrie, 'batterie')!.beschriftung).toBe('unten')
  })
})

describe('Grundanordnung', () => {
  test('0 Geräte ergeben eine gültige Geometrie', () => {
    const geometrie = baueGeometrie(eingabe())
    expect(geometrie.breite).toBeGreaterThan(0)
    expect(geometrie.hoehe).toBeGreaterThan(0)
    expect(ueberschneidungsfrei(geometrie)).toBe(true)
  })

  test('das Haus steht rechts der Erzeugung, das Netz links davon', () => {
    const geometrie = baueGeometrie(eingabe())
    const netz = findeKnoten(geometrie, 'netz')!
    const pv = findeKnoten(geometrie, 'pv')!
    const haus = findeKnoten(geometrie, 'haus')!
    expect(netz.x).toBeLessThan(pv.x)
    expect(pv.x).toBeLessThan(haus.x)
  })

  test('Netz und Haus stehen auf derselben Höhe', () => {
    const geometrie = baueGeometrie(eingabe())
    expect(findeKnoten(geometrie, 'netz')!.y).toBe(findeKnoten(geometrie, 'haus')!.y)
  })

  test('Geräte hängen rechts vom Haus', () => {
    const geometrie = baueGeometrie(eingabe({ geraeteIds: geraete(2) }))
    const haus = findeKnoten(geometrie, 'haus')!
    expect(findeKnoten(geometrie, 'geraet_1')!.x).toBeGreaterThan(haus.x)
  })

  test('ab 7 Geräten entstehen zwei Spalten', () => {
    const spalten = (anzahl: number) => new Set(
      baueGeometrie(eingabe({ geraeteIds: geraete(anzahl) }))
        .knoten.filter((k) => k.art === 'geraet').map((k) => k.x)).size
    expect(spalten(6)).toBe(1)
    expect(spalten(7)).toBe(2)
  })

  test('die Knoten behalten ihre Größe innerhalb eines Maßstabs', () => {
    for (const breite of [500, 700, 900]) {
      const geometrie = baueGeometrie(eingabe({ breite }))
      expect(findeKnoten(geometrie, 'haus')!.r, `${breite} px`).toBe(NORMAL.r)
    }
  })

  test('eine breite Karte zentriert die Zeichnung, statt sie zu dehnen', () => {
    const schmal = baueGeometrie(eingabe({ breite: 500 }))
    const breit = baueGeometrie(eingabe({ breite: 1200 }))
    expect(breit.breite).toBe(1200)
    const abstand = (g: Geometrie) =>
      findeKnoten(g, 'haus')!.x - findeKnoten(g, 'netz')!.x
    expect(abstand(breit)).toBe(abstand(schmal))
  })
})

describe('Fehlende Knoten', () => {
  test('fehlender PV-Knoten hinterlässt kein Loch', () => {
    const ohne = baueGeometrie(eingabe({ pv: false }))
    const mit = baueGeometrie(eingabe())
    expect(findeKnoten(ohne, 'pv')).toBeUndefined()
    expect(findeKnoten(ohne, 'haus')!.y).toBeLessThan(findeKnoten(mit, 'haus')!.y)
  })

  test('fehlende Batterie verkürzt die Grafik', () => {
    const ohne = baueGeometrie(eingabe({ batterie: false }))
    expect(findeKnoten(ohne, 'batterie')).toBeUndefined()
    expect(ohne.hoehe).toBeLessThan(baueGeometrie(eingabe()).hoehe)
  })

  test('fehlendes Netz lässt die übrigen Knoten stehen', () => {
    const geometrie = baueGeometrie(eingabe({ netz: false }))
    expect(findeKnoten(geometrie, 'netz')).toBeUndefined()
    expect(findeKnoten(geometrie, 'haus')).toBeDefined()
    expect(ueberschneidungsfrei(geometrie)).toBe(true)
  })

  test('haus_knoten_anzeigen false setzt den Verteilpunkt an dieselbe Stelle', () => {
    const geometrie = baueGeometrie(eingabe({ hausKnoten: false, geraeteIds: geraete(2) }))
    expect(findeKnoten(geometrie, 'haus')).toBeUndefined()
    const verteiler = findeKnoten(geometrie, 'verteiler')!
    expect(verteiler.x).toBe(findeKnoten(baueGeometrie(eingabe({ geraeteIds: geraete(2) })), 'haus')!.x)
  })
})

describe('Kantenpfade', () => {
  const knoten = (id: string, x: number, y: number): Knoten =>
    ({ id, art: 'geraet', x, y, r: 40, beschriftung: 'unten' })

  test('auf gleicher Höhe entsteht eine gerade Waagerechte', () => {
    expect(kantenPfad(knoten('a', 0, 0), knoten('b', 200, 0))).toBe('M 40 0 H 160')
  })

  test('in gleicher Spalte entsteht eine gerade Senkrechte', () => {
    expect(kantenPfad(knoten('a', 0, 0), knoten('b', 0, 200))).toBe('M 0 40 V 160')
  })

  test('versetzte Knoten bekommen genau eine gerundete Ecke', () => {
    const pfad = kantenPfad(knoten('a', 0, 0), knoten('b', 200, 150))
    expect(pfad).toBe('M 0 40 V 128 Q 0 150 22 150 H 160')
    // Keine Diagonale: der Pfad besteht nur aus V, Q und H.
    expect(pfad).not.toMatch(/L/)
  })

  test('Hin- und Rückrichtung liegen nicht auf demselben Pfad', () => {
    const a = knoten('a', 0, 0)
    const b = knoten('b', 200, 150)
    expect(kantenPfad(a, b)).not.toBe(kantenPfad(b, a))
  })
})

describe('Schmale Karte', () => {
  // Das ist der Kern: eine Handykarte darf NICHT verkleinert werden. Wird sie
  // es doch, schrumpft die Schrift mit — gemessen fiel sie bei 340 px von 12
  // auf 8,5 px, und Symbol, Wert und Beschriftung liefen ineinander.
  test('bei Handybreite passt die Zeichnung ohne Verkleinerung hinein', () => {
    for (const breite of [320, 340, 375, 390]) {
      const geometrie = baueGeometrie(eingabe({ breite, geraeteIds: geraete(4), rest: true }))
      expect(geometrie.breite, `${breite} px`).toBeLessThanOrEqual(breite)
    }
  })

  test('unterhalb der Schwelle gilt der kompakte Maßstab', () => {
    const mit = (breite: number) =>
      baueGeometrie(eingabe({ breite, geraeteIds: geraete(4) })).mass.name
    expect(mit(500)).toBe('normal')
    expect(mit(360)).toBe('kompakt')
  })

  test('ohne Geräte reichen drei Spalten, dort bleibt es normal', () => {
    // Weniger Spalten heißt geringere Mindestbreite — dann gibt es keinen
    // Grund, kleiner zu zeichnen.
    expect(baueGeometrie(eingabe({ breite: 360 })).mass.name).toBe('normal')
  })

  test('der kompakte Maßstab zeichnet kleiner, nicht kleiner skaliert', () => {
    const kompakt = baueGeometrie(eingabe({ breite: 360, geraeteIds: geraete(4) }))
    expect(kompakt.mass.r).toBe(KOMPAKT.r)
    expect(kompakt.mass.schrift).toBeLessThan(NORMAL.schrift)
    // Die Schrift bleibt lesbar, statt mit dem Maßstab wegzurutschen.
    expect(kompakt.mass.schrift).toBeGreaterThanOrEqual(11)
  })

  test('die Mindestbreiten stimmen mit der Schwelle überein', () => {
    expect(mindestBreite(NORMAL, 4)).toBe(416)
    expect(mindestBreite(KOMPAKT, 4)).toBe(318)
  })

  test('auch mit zwei Gerätespalten wird auf dem Handy nicht verkleinert', () => {
    const geometrie = baueGeometrie(eingabe({ breite: 400, geraeteIds: geraete(8) }))
    expect(geometrie.mass.name).toBe('kompakt')
    expect(geometrie.breite).toBeLessThanOrEqual(400)
  })
})

describe('Abstände im Knoten', () => {
  // Gemessen an der laufenden Anlage: Symbol zu Wert 1,4 px, Kreisrand zu
  // Beschriftung 2,3 px. Beides las sich als ein Klumpen.
  for (const mass of [NORMAL, KOMPAKT]) {
    for (const anzahl of [1, 2]) {
      test(`${mass.name}, ${anzahl} Wert(e): Symbol und Wert haben Luft`, () => {
        const inhalt = knotenInhalt(mass, anzahl)
        const symbolUnterkante = inhalt.symbolY + mass.symbol / 2
        // Oberkante der Versalien der ersten Wertzeile.
        const wertOberkante = inhalt.werteY[0]! - mass.schrift
        expect(wertOberkante - symbolUnterkante).toBeGreaterThanOrEqual(LUFT_INNEN)
      })

      test(`${mass.name}, ${anzahl} Wert(e): der Inhalt bleibt im Kreis`, () => {
        const inhalt = knotenInhalt(mass, anzahl)
        expect(inhalt.symbolY - mass.symbol / 2).toBeGreaterThan(-mass.r)
        expect(inhalt.werteY[inhalt.werteY.length - 1]!).toBeLessThan(mass.r)
      })
    }

    test(`${mass.name}: Kreisrand und Beschriftung haben Luft`, () => {
      const inhalt = knotenInhalt(mass, 1)
      expect(inhalt.beschriftungY - mass.schrift).toBeGreaterThanOrEqual(LUFT_AUSSEN)
    })

    test(`${mass.name}: zwei Werte stehen untereinander, nicht ineinander`, () => {
      const inhalt = knotenInhalt(mass, 2)
      expect(inhalt.werteY[1]! - inhalt.werteY[0]!).toBeGreaterThanOrEqual(mass.schrift + 2)
    })
  }
})

describe('Beschriftung und Untertitel', () => {
  // Gemessen: Beschriftung und Untertitel standen 12 px auseinander bei 11 px
  // Schrift — Unterlänge und Oberlänge berührten sich, der Name lief in den
  // Grund darunter.
  for (const mass of [NORMAL, KOMPAKT]) {
    test(`${mass.name}: Beschriftung und Untertitel überlappen nicht`, () => {
      const inhalt = knotenInhalt(mass, 1)
      expect(inhalt.untertitelSchritt).toBeGreaterThanOrEqual(mass.schrift * 1.25)
      expect(inhalt.untertitelSchritt).toBeGreaterThanOrEqual(mass.untertitel * 1.25)
    })

    test(`${mass.name}: der Textblock trägt zwei Untertitelzeilen`, () => {
      // Die Erzeugungs-Aufschlüsselung braucht zwei; passen sie nicht in die
      // reservierte Höhe, ragen sie in den nächsten Knoten.
      const inhalt = knotenInhalt(mass, 1)
      const gebraucht = inhalt.beschriftungY + 2 * inhalt.untertitelSchritt
      expect(inhalt.textBlock).toBeGreaterThanOrEqual(gebraucht)
    })
  }
})

describe('AC-Speicher', () => {
  test('stehen in der Spalte des Hausspeichers, eine Zeile darunter', () => {
    const geometrie = baueGeometrie(eingabe({
      breite: 600, geraeteIds: geraete(2), speicherIds: ['acspeicher1'],
    }))
    const haus = findeKnoten(geometrie, 'batterie')!
    const ac = findeKnoten(geometrie, 'acspeicher1')!
    expect(ac.x).toBe(haus.x)
    expect(ac.y).toBeGreaterThan(haus.y)
  })

  test('stehen nicht in der Gerätespalte', () => {
    const geometrie = baueGeometrie(eingabe({
      breite: 600, geraeteIds: geraete(2), speicherIds: ['acspeicher1'],
    }))
    const geraet = findeKnoten(geometrie, 'geraet_1')!
    expect(findeKnoten(geometrie, 'acspeicher1')!.x).toBeLessThan(geraet.x)
  })

  test('ohne Hausspeicher stehen sie an dessen Stelle', () => {
    const geometrie = baueGeometrie(eingabe({
      breite: 600, batterie: false, speicherIds: ['acspeicher1'],
    }))
    const mitHausspeicher = findeKnoten(
      baueGeometrie(eingabe({ breite: 600 })), 'batterie')!
    expect(findeKnoten(geometrie, 'acspeicher1')!.x).toBe(mitHausspeicher.x)
  })

  test('mehrere Speicher stapeln sich untereinander', () => {
    const geometrie = baueGeometrie(eingabe({
      breite: 600, speicherIds: ['a', 'b'],
    }))
    const a = findeKnoten(geometrie, 'a')!
    const b = findeKnoten(geometrie, 'b')!
    expect(b.x).toBe(a.x)
    expect(b.y).toBeGreaterThan(a.y)
    expect(ueberschneidungsfrei(geometrie)).toBe(true)
  })

  test('die zusätzliche Zeile überlappt nichts', () => {
    for (const anzahl of [1, 2]) {
      const geometrie = baueGeometrie(eingabe({
        breite: 340, geraeteIds: geraete(4), rest: true,
        speicherIds: Array.from({ length: anzahl }, (_, i) => `speicher_${i}`),
      }))
      expect(ueberschneidungsfrei(geometrie), `${anzahl} Speicher`).toBe(true)
      expect(geometrie.breite, `${anzahl} Speicher`).toBeLessThanOrEqual(340)
    }
  })
})
