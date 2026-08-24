import { describe, expect, test } from 'vitest'
import {
  baueGeometrie, findeKnoten, kantenPfad, BESCHRIFTUNG_H, KNOTEN_R,
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
function kasten(knoten: Knoten) {
  const oben = knoten.beschriftung === 'oben'
    ? knoten.y - knoten.r - BESCHRIFTUNG_H
    : knoten.y - knoten.r
  const unten = knoten.beschriftung === 'oben'
    ? knoten.y + knoten.r + BESCHRIFTUNG_H
    : knoten.y + knoten.r + BESCHRIFTUNG_H + 14
  return { links: knoten.x - knoten.r, rechts: knoten.x + knoten.r, oben, unten }
}

function ueberschneidungsfrei(geometrie: Geometrie): boolean {
  const kaesten = geometrie.knoten.map(kasten)
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
    expect(luft).toBeGreaterThanOrEqual(BESCHRIFTUNG_H + 14 + 6)
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

  test('die Knoten behalten ihre Größe, egal wie breit die Karte ist', () => {
    // Anders als in der ersten Fassung skaliert nichts mit der Kartenbreite —
    // sonst schrumpft die Beschriftung unter die Lesbarkeit.
    for (const breite of [320, 500, 900]) {
      const geometrie = baueGeometrie(eingabe({ breite }))
      expect(findeKnoten(geometrie, 'haus')!.r, `${breite} px`).toBe(KNOTEN_R)
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
