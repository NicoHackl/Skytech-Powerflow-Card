import { describe, expect, test } from 'vitest'
import { berechneBilanz, type BilanzEingabe } from '../src/balance'
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

  test('negative Hausbilanz gilt als unbekannt und wird gemeldet', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(0),
      netz: { hin: direkt(0), her: direkt(2000) },
    }))
    expect(bilanz.haus.wert).toBeNull()
    expect(bilanz.hinweise).toContain('bilanz_unplausibel')
  })

  test('eine unplausible Hausbilanz deckelt die Geräte NICHT auf 0', () => {
    // Vorher wurde hier auf 0 geklemmt; anschließend deckelte die Bilanz jeden
    // Gerätefluss auf 0, und die Karte zeigte Geräte mit 2,7 kW, die an keiner
    // Linie hingen. Der Knoten widersprach damit der Grafik.
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(0),
      netz: { hin: direkt(0), her: direkt(2000) },
      geraete: [{ id: 'heizstab', leistung: direkt(2700) }],
    }))
    expect(bilanz.hinweise).toContain('bilanz_unplausibel')
    expect(bilanz.geraete[0]!.fluss).toBe(2700)
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
  test('ohne Erzeugung und ohne Netz gibt es keine Herkunft zu verteilen', () => {
    const bilanz = berechneBilanz(eingabe({ haus: direkt(1000) }))
    expect(bilanz.pvInsHaus).toBe(0)
    expect(bilanz.batterieInsHaus).toBe(0)
    expect(bilanz.netzInsHaus).toBe(1000)
  })
})

describe('AC-Speicher', () => {
  // Ein AC-Speicher ist ein HEMS-Gerät, aber kein Verbraucher: er kann das
  // Haus auch speisen. Vorher wurde er über max(0, Wert) auf 0 gedeckelt —
  // der Knoten zeigte eine negative Zahl und hing an keiner Linie.
  const speicher = (wert: number) => [{ id: 'acspeicher1', leistung: direkt(wert) }]

  test('ein entladender Speicher erhöht die gerechnete Hausleistung', () => {
    const ohne = berechneBilanz(eingabe({ pv: direkt(1000) }))
    const mit = berechneBilanz(eingabe({ pv: direkt(1000), speicher: speicher(-607) }))
    expect(mit.haus.wert).toBe((ohne.haus.wert ?? 0) + 607)
  })

  test('ein ladender Speicher senkt sie', () => {
    const bilanz = berechneBilanz(eingabe({ pv: direkt(2000), speicher: speicher(800) }))
    expect(bilanz.haus.wert).toBe(1200)
  })

  test('der Betrag ist in beiden Richtungen positiv', () => {
    expect(berechneBilanz(eingabe({ pv: direkt(1000), speicher: speicher(-607) }))
      .speicher[0]).toMatchObject({ laden: 0, entladen: 607 })
    expect(berechneBilanz(eingabe({ pv: direkt(2000), speicher: speicher(800) }))
      .speicher[0]).toMatchObject({ laden: 800, entladen: 0 })
  })

  test('der Speicher wird nicht auf 0 gedeckelt', () => {
    // Selbst wenn die Hausleistung klein ist: der Speicher hängt nicht am
    // Hausknoten und unterliegt der Deckelung nicht.
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(100), haus: direkt(50), speicher: speicher(-607),
    }))
    expect(bilanz.speicher[0]!.entladen).toBe(607)
    expect(bilanz.hinweise).not.toContain('geraete_ueber_haus')
  })

  test('der Speicher zählt nicht in „übriges Haus"', () => {
    const bilanz = berechneBilanz(eingabe({
      haus: direkt(1000), speicher: speicher(800),
      geraete: [{ id: 'heizstab', leistung: direkt(400) }],
    }))
    expect(bilanz.uebrigesHaus).toBe(600)
  })

  test('Speicherstrom ins Haus füllt den Herkunftsring, egal aus welchem Speicher', () => {
    const bilanz = berechneBilanz(eingabe({
      pv: direkt(0), haus: direkt(1000), speicher: speicher(-400),
      batterie: { hin: direkt(0), her: direkt(200) },
    }))
    expect(bilanz.batterieInsHaus).toBe(600)
  })

  test('ohne Speicher bleibt die Bilanz unverändert', () => {
    const bilanz = berechneBilanz(eingabe({ pv: direkt(1000) }))
    expect(bilanz.speicher).toEqual([])
    expect(bilanz.haus.wert).toBe(1000)
  })
})
