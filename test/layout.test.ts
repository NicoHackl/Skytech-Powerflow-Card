import { describe, expect, test } from 'vitest'
import { baueGeometrie, findeKnoten, kantenPfad, type LayoutEingabe } from '../src/layout'

/* Geometrie. Geprüft wird, dass sich Knoten nicht überlagern und dass ein
   fehlender Knoten kein Loch hinterlässt — beides ohne DOM. */

function eingabe(teil: Partial<LayoutEingabe> = {}): LayoutEingabe {
  return { pv: true, netz: true, batterie: true, hausKnoten: true, geraeteIds: [], rest: false, ...teil }
}

function geraete(anzahl: number): string[] {
  return Array.from({ length: anzahl }, (_, index) => `geraet_${index + 1}`)
}

/** Zwei Knoten überlagern sich, wenn ihr Abstand kleiner ist als die Summe
    ihrer Radien plus etwas Luft für die Beschriftung. */
function ueberschneidungsfrei(knoten: { x: number; y: number; r: number }[]): boolean {
  for (let a = 0; a < knoten.length; a += 1) {
    for (let b = a + 1; b < knoten.length; b += 1) {
      const links = knoten[a]!
      const rechts = knoten[b]!
      const abstand = Math.hypot(links.x - rechts.x, links.y - rechts.y)
      if (abstand < links.r + rechts.r + 8) return false
    }
  }
  return true
}

describe('Grundanordnung', () => {
  test('0 Geräte ergeben eine gültige Geometrie', () => {
    const geometrie = baueGeometrie(eingabe())
    expect(geometrie.breite).toBeGreaterThan(0)
    expect(geometrie.hoehe).toBeGreaterThan(0)
    expect(ueberschneidungsfrei(geometrie.knoten)).toBe(true)
  })

  test('1, 5 und 12 Geräte erzeugen jeweils überschneidungsfreie Knoten', () => {
    for (const anzahl of [1, 5, 12]) {
      const geometrie = baueGeometrie(eingabe({ geraeteIds: geraete(anzahl) }))
      expect(ueberschneidungsfrei(geometrie.knoten), `${anzahl} Geräte`).toBe(true)
    }
  })

  test('ab 7 Geräten entstehen zwei Spalten', () => {
    const sechs = baueGeometrie(eingabe({ geraeteIds: geraete(6) }))
    const sieben = baueGeometrie(eingabe({ geraeteIds: geraete(7) }))
    const spalten = (geometrie: ReturnType<typeof baueGeometrie>) =>
      new Set(geometrie.knoten.filter((k) => k.art === 'geraet').map((k) => k.x)).size
    expect(spalten(sechs)).toBe(1)
    expect(spalten(sieben)).toBe(2)
  })

  test('ab 13 Knoten rechts werden Knoten und Schrift kleiner', () => {
    const normal = baueGeometrie(eingabe({ geraeteIds: geraete(12) }))
    const eng = baueGeometrie(eingabe({ geraeteIds: geraete(13) }))
    expect(eng.schrift).toBeLessThan(normal.schrift)
    expect(findeKnoten(eng, 'haus')!.r).toBeLessThan(findeKnoten(normal, 'haus')!.r)
  })
})

describe('Fehlende Knoten', () => {
  test('fehlender PV-Knoten hinterlässt kein Loch', () => {
    const ohnePv = baueGeometrie(eingabe({ pv: false }))
    expect(findeKnoten(ohnePv, 'pv')).toBeUndefined()
    // Das Haus rückt nach oben, statt eine leere Zeile stehen zu lassen.
    const mitPv = baueGeometrie(eingabe())
    expect(findeKnoten(ohnePv, 'haus')!.y).toBeLessThan(findeKnoten(mitPv, 'haus')!.y)
  })

  test('fehlende Batterie verkürzt die Grafik', () => {
    const ohne = baueGeometrie(eingabe({ batterie: false }))
    const mit = baueGeometrie(eingabe())
    expect(findeKnoten(ohne, 'batterie')).toBeUndefined()
    expect(ohne.hoehe).toBeLessThan(mit.hoehe)
  })

  test('fehlendes Netz lässt die übrigen Knoten stehen', () => {
    const geometrie = baueGeometrie(eingabe({ netz: false }))
    expect(findeKnoten(geometrie, 'netz')).toBeUndefined()
    expect(findeKnoten(geometrie, 'haus')).toBeDefined()
    expect(ueberschneidungsfrei(geometrie.knoten)).toBe(true)
  })

  test('haus_knoten_anzeigen false hängt die Geräte an den Verteilpunkt', () => {
    const geometrie = baueGeometrie(eingabe({ hausKnoten: false, geraeteIds: geraete(2), rest: true }))
    expect(findeKnoten(geometrie, 'haus')).toBeUndefined()
    const verteiler = findeKnoten(geometrie, 'verteiler')
    expect(verteiler).toBeDefined()
    expect(findeKnoten(geometrie, 'rest')!.x).toBeGreaterThan(verteiler!.x)
  })
})

describe('Kantenpfade', () => {
  test('der Pfad beginnt und endet auf den Knotenrändern, nicht im Mittelpunkt', () => {
    const von = { id: 'a', art: 'pv' as const, x: 0, y: 0, r: 10 }
    const nach = { id: 'b', art: 'haus' as const, x: 100, y: 0, r: 10 }
    expect(kantenPfad(von, nach)).toBe('M 10 0 Q 50 16 90 0')
  })

  test('Hin- und Rückrichtung liegen nicht auf demselben Pfad', () => {
    const a = { id: 'a', art: 'pv' as const, x: 0, y: 0, r: 10 }
    const b = { id: 'b', art: 'haus' as const, x: 100, y: 0, r: 10 }
    expect(kantenPfad(a, b)).not.toBe(kantenPfad(b, a))
  })
})
