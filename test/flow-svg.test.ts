import { describe, expect, test } from 'vitest'
import { fliesst, punktDauer, DAUER_RASTER_S, DAUER_SCHNELL_S, DAUER_LANGSAM_S } from '../src/flow-svg'

/* Bewegung. Der Kern dieser Tests: die Punktdauer darf NICHT davon abhängen,
   was gerade anderswo in der Anlage passiert. Genau daran lag es, dass die
   Animation mehrmals pro Sekunde neu startete. */

describe('Punktdauer', () => {
  test('hängt nur vom Wert und den festen Grenzen ab', () => {
    // Derselbe Fluss, zweimal berechnet, ergibt dasselbe — unabhängig davon,
    // welcher andere Fluss gerade der größte ist.
    expect(punktDauer(1500, 1000, 5000)).toBe(punktDauer(1500, 1000, 5000))
  })

  test('ein kräftiger Fluss läuft schneller als ein schwacher', () => {
    expect(punktDauer(5000, 1000, 5000)).toBeLessThan(punktDauer(1200, 1000, 5000))
  })

  test('die Dauer bleibt in ihren Grenzen', () => {
    for (const wert of [0, 1, 900, 5000, 999999]) {
      const dauer = punktDauer(wert, 1000, 5000)
      expect(dauer, `${wert} W`).toBeGreaterThanOrEqual(DAUER_SCHNELL_S - DAUER_RASTER_S)
      expect(dauer, `${wert} W`).toBeLessThanOrEqual(DAUER_LANGSAM_S)
    }
  })

  test('kleine Schwankungen ändern die Dauer nicht', () => {
    // Ohne die Rasterung wechselte `dur` bei jedem Messwert, und SMIL beginnt
    // bei einer Änderung von vorn: der Punkt sprang zurück.
    const werte = [2000, 2005, 2010, 2020, 2050]
    const dauern = new Set(werte.map((wert) => punktDauer(wert, 1000, 5000)))
    expect(dauern.size).toBe(1)
  })

  test('das Vorzeichen spielt keine Rolle', () => {
    expect(punktDauer(-3000, 1000, 5000)).toBe(punktDauer(3000, 1000, 5000))
  })

  test('eine unsinnige Obergrenze bricht die Rechnung nicht', () => {
    expect(Number.isFinite(punktDauer(500, 1000, 0))).toBe(true)
    expect(Number.isFinite(punktDauer(500, 0, 0))).toBe(true)
  })
})

describe('Fließt eine Kante?', () => {
  test('erst ab einem Watt', () => {
    expect(fliesst(0)).toBe(false)
    expect(fliesst(0.4)).toBe(false)
    expect(fliesst(1)).toBe(true)
    expect(fliesst(-1)).toBe(true)
  })

  test('unbekannt fließt nicht', () => {
    expect(fliesst(null)).toBe(false)
    expect(fliesst(undefined)).toBe(false)
    expect(fliesst(Number.NaN)).toBe(false)
    expect(fliesst(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
