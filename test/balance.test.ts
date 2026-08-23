import { describe, expect, test } from 'vitest'
import { berechneBilanz, fliesst, type BilanzEingabe } from '../src/balance'
import type { Aufloesung } from '../src/power'

/* Bilanzregeln. Reine Funktionen — die Eingaben stehen hier als Zahlen,
   nicht als HA-Zustände. */

const direkt = (wert: number): Aufloesung => ({ wert, quelle: 'direkt' })
const unbekannt: Aufloesung = { wert: null, quelle: 'unbekannt' }

function eingabe(teil: Partial<BilanzEingabe> = {}): BilanzEingabe {
  return {
    pv: direkt(0),
    netz: { hin: direkt(0), her: direkt(0) },
    batterie: { hin: direkt(0), her: direkt(0) },
    haus: unbekannt,
    geraete: [],
    ...teil,
  }
}

describe('Hausleistung', () => {
  test('Hausleistung wird gerechnet, wenn kein Hausensor gesetzt ist', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(3000),
      netz: { hin: direkt(500), her: direkt(0) },
      batterie: { hin: direkt(0), her: direkt(200) },
    }))
    expect(bilanz.haus.wert).toBe(3700)
    expect(bilanz.hinweise).toEqual([])
  })

  test('ein gesetzter Hausensor schlägt die Rechnung', () => {
    const bilanz = berechneBilanz(eingabe({ pv: direkt(3000), haus: direkt(1200) }))
    expect(bilanz.haus.wert).toBe(1200)
  })

  test('negative Hausbilanz wird auf 0 geklemmt und gemeldet', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(0),
      netz: { hin: direkt(0), her: direkt(2000) },
    }))
    expect(bilanz.haus.wert).toBe(0)
    expect(bilanz.hinweise).toContain('bilanz_unplausibel')
  })

  test('ohne Erzeugung und ohne Netzwert bleibt die Hausleistung unbekannt', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: unbekannt,
      netz: { hin: unbekannt, her: unbekannt },
    }))
    expect(bilanz.haus.wert).toBeNull()
  })
})

describe('Geräte gegen das Haus', () => {
  test('Gerätesumme wird proportional auf die Hausleistung gedeckelt', () => {
    const bilanz = berechneBilanz(eingabe({
      haus: direkt(1000),
      geraete: [
        { id: 'a', leistung: direkt(1500) },
        { id: 'b', leistung: direkt(500) },
      ],
    }))
    expect(bilanz.geraete.map((g) => g.fluss)).toEqual([750, 250])
    expect(bilanz.hinweise).toContain('geraete_ueber_haus')
    expect(bilanz.uebrigesHaus).toBe(0)
  })

  test('ohne Überschreitung wird nicht gedeckelt und nichts gemeldet', () => {
    const bilanz = berechneBilanz(eingabe({
      haus: direkt(2000),
      geraete: [{ id: 'a', leistung: direkt(1400) }],
    }))
    expect(bilanz.geraete[0]!.fluss).toBe(1400)
    expect(bilanz.uebrigesHaus).toBe(600)
    expect(bilanz.hinweise).toEqual([])
  })

  test('unbekannte Geräte zählen in der Summe mit 0, bleiben aber Knoten', () => {
    const bilanz = berechneBilanz(eingabe({
      haus: direkt(1000),
      geraete: [
        { id: 'a', leistung: unbekannt },
        { id: 'b', leistung: direkt(400) },
      ],
    }))
    expect(bilanz.geraete).toHaveLength(2)
    expect(bilanz.geraete[0]!.fluss).toBe(0)
    expect(bilanz.geraete[0]!.leistung.wert).toBeNull()
    expect(bilanz.uebrigesHaus).toBe(600)
  })
})

describe('Herkunft und Verbleib', () => {
  test('PV deckt zuerst das Haus, dann die Batterie, dann das Netz', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(5000),
      haus: direkt(2000),
      batterie: { hin: direkt(1000), her: direkt(0) },
    }))
    expect(bilanz.pvInsHaus).toBe(2000)
    expect(bilanz.pvInBatterie).toBe(1000)
    expect(bilanz.pvInsNetz).toBe(2000)
    expect(bilanz.netzInBatterie).toBe(0)
  })

  test('das Haus wird nach PV aus der Batterie und erst dann aus dem Netz gedeckt', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(500),
      haus: direkt(2000),
      batterie: { hin: direkt(0), her: direkt(800) },
      netz: { hin: direkt(700), her: direkt(0) },
    }))
    expect(bilanz.pvInsHaus).toBe(500)
    expect(bilanz.batterieInsHaus).toBe(800)
    expect(bilanz.netzInsHaus).toBe(700)
  })

  test('Netzladen erscheint, wenn mehr geladen wird als die Erzeugung hergibt', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(0),
      haus: direkt(0),
      batterie: { hin: direkt(2000), her: direkt(0) },
      netz: { hin: direkt(2000), her: direkt(0) },
    }))
    expect(bilanz.netzInBatterie).toBe(2000)
    expect(bilanz.pvInBatterie).toBe(0)
  })
})

describe('Kanten', () => {
  test('Kanten mit Wert 0 entstehen nicht', () => {
    expect(fliesst(0)).toBe(false)
    expect(fliesst(0.4)).toBe(false)
    expect(fliesst(1)).toBe(true)
  })

  test('unbekannte Werte erzeugen keine Kante', () => {
    expect(fliesst(null)).toBe(false)
    expect(fliesst(undefined)).toBe(false)
    expect(fliesst(Number.NaN)).toBe(false)
  })
})
