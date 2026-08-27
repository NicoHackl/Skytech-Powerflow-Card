import { describe, expect, test } from 'vitest'
import { istSicheresZiel } from '../src/contract'

/* Die Karte prüft das Navigationsziel selbst, obwohl der Vertrag aus dem
   eigenen Add-on kommt und dasselbe prüft. Sie springt nicht ungeprüft
   dorthin, wohin ein Attributwert zeigt. */

describe('Navigationsziel', () => {
  test('Pfade dieser Instanz sind erlaubt', () => {
    for (const pfad of ['/dashboard-pv/pv', '/lovelace/0', '/dashboard-pv/überschussverbraucher']) {
      expect(istSicheresZiel(pfad), pfad).toBe(true)
    }
  })

  test('fremde Ziele werden abgelehnt', () => {
    // //host waere protokollrelativ, ein Doppelpunkt liesse http:// und
    // javascript: durch.
    for (const pfad of ['http://boese.de', 'https://boese.de', '//boese.de',
                        'javascript:alert(1)', 'data:text/html,x']) {
      expect(istSicheresZiel(pfad), pfad).toBe(false)
    }
  })

  test('ein Pfad ohne führenden Schrägstrich ist kein Ziel', () => {
    expect(istSicheresZiel('dashboard-pv/pv')).toBe(false)
  })

  test('Leerraum im Pfad wird abgelehnt', () => {
    expect(istSicheresZiel('/dashboard pv/pv')).toBe(false)
    expect(istSicheresZiel('/dashboard-pv/pv ')).toBe(false)
  })

  test('kein Ziel ist kein Ziel', () => {
    expect(istSicheresZiel('')).toBe(false)
    expect(istSicheresZiel(undefined)).toBe(false)
    expect(istSicheresZiel(null)).toBe(false)
  })
})
