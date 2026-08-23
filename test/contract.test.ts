import { describe, expect, test } from 'vitest'
import { abonnierteEntitaeten, hatSichGeaendert, leseVertrag, zustandsAbzug } from '../src/contract'
import type { FlowConfig, Hass, HassEntity } from '../src/types'

/* Lesen und Prüfen der beiden Entitäten. */

const CONFIG = 'sensor.skytech_hems_flow_config'
const STATUS = 'sensor.skytech_hems_flow_status'

function hass(eintraege: Record<string, Partial<HassEntity>>): Hass {
  const states: Record<string, HassEntity> = {}
  for (const [entity_id, teil] of Object.entries(eintraege)) {
    states[entity_id] = { entity_id, state: '', attributes: {}, ...teil }
  }
  return { states }
}

/** Die Attribute einer HA-Entität sind untypisiert; der Vertrag steckt darin. */
function attribute(config: FlowConfig): Record<string, unknown> {
  return config as unknown as Record<string, unknown>
}

const beispiel: FlowConfig = {
  schema_version: 1,
  revision: 'a3f19c02b7d4',
  standard: {
    pv_power_entities: ['sensor.dach'],
    grid_power_entity: 'sensor.netz',
    batterie: { soc_entity: 'sensor.soc', charge_power_entity: 'sensor.laden' },
  },
  devices: [{
    id: 'heizstab', power_kind: 'watt', power_entity: 'sensor.elwa',
    voltage_entities: ['sensor.l1', '', ''],
  }],
}

describe('leseVertrag', () => {
  test('ohne hass gibt es keine Daten', () => {
    expect(leseVertrag(null, CONFIG, STATUS).fehler).toEqual({ art: 'keine_daten' })
  })

  test('fehlende Konfigurationsentität meldet keine Daten', () => {
    expect(leseVertrag(hass({}), CONFIG, STATUS).fehler).toEqual({ art: 'keine_daten' })
  })

  test('unavailable zählt wie fehlend', () => {
    const vertrag = leseVertrag(
      hass({ [CONFIG]: { state: 'unavailable', attributes: attribute(beispiel) } }), CONFIG, STATUS)
    expect(vertrag.fehler).toEqual({ art: 'keine_daten' })
  })

  test('eine höhere schema_version wird nicht geraten, sondern gemeldet', () => {
    const vertrag = leseVertrag(
      hass({ [CONFIG]: { state: 'x', attributes: { schema_version: 2 } } }), CONFIG, STATUS)
    expect(vertrag.fehler).toEqual({ art: 'zu_neu', version: 2 })
    expect(vertrag.config).toBeNull()
  })

  test('fehlende Statusentität ist kein Fehler', () => {
    const vertrag = leseVertrag(
      hass({ [CONFIG]: { state: 'a3f1', attributes: attribute(beispiel) } }), CONFIG, STATUS)
    expect(vertrag.fehler).toBeNull()
    expect(vertrag.config?.revision).toBe('a3f19c02b7d4')
    expect(vertrag.status).toBeNull()
  })

  test('ein zu neuer Status wird verworfen, die Grafik bleibt', () => {
    const vertrag = leseVertrag(hass({
      [CONFIG]: { state: 'a3f1', attributes: attribute(beispiel) },
      [STATUS]: { state: '3240', attributes: { schema_version: 9 } },
    }), CONFIG, STATUS)
    expect(vertrag.fehler).toBeNull()
    expect(vertrag.status).toBeNull()
  })
})

describe('abonnierteEntitaeten', () => {
  test('sammelt jeden Verweis genau einmal', () => {
    const ids = abonnierteEntitaeten(beispiel, CONFIG, STATUS)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      CONFIG, STATUS, 'sensor.dach', 'sensor.netz', 'sensor.soc',
      'sensor.laden', 'sensor.elwa', 'sensor.l1',
    ]))
  })

  test('leere Verweise landen nicht in der Menge', () => {
    expect(abonnierteEntitaeten(beispiel, CONFIG, STATUS)).not.toContain('')
  })

  test('ohne Konfiguration bleiben die beiden Entitäten selbst', () => {
    expect(abonnierteEntitaeten(null, CONFIG, STATUS)).toEqual([CONFIG, STATUS])
  })
})

describe('Änderungserkennung', () => {
  const ids = [CONFIG, STATUS, 'sensor.elwa']

  test('ein unveränderter Zustand löst kein Rendern aus', () => {
    const zustand = hass({
      [CONFIG]: { state: 'a3f1' },
      [STATUS]: { state: '3240', attributes: { last_cycle_at: '23.08.2026 18:04:12' } },
      'sensor.elwa': { state: '1400' },
    })
    const abzug = zustandsAbzug(ids, zustand, STATUS)
    expect(hatSichGeaendert(ids, abzug, zustand, STATUS)).toBe(false)
  })

  test('ein geänderter Messwert löst Rendern aus', () => {
    const vorher = hass({ 'sensor.elwa': { state: '1400' } })
    const abzug = zustandsAbzug(ids, vorher, STATUS)
    const nachher = hass({ 'sensor.elwa': { state: '1500' } })
    expect(hatSichGeaendert(ids, abzug, nachher, STATUS)).toBe(true)
  })

  test('ein neuer Zyklus löst Rendern aus, auch wenn der Pool gleich bleibt', () => {
    // Der Zustand der Statusentität ist pool_w. Bleibt er stehen, während
    // sich ein Gerät darin ändert, darf die Karte das nicht verschlafen.
    const vorher = hass({
      [STATUS]: { state: '3240', attributes: { last_cycle_at: '23.08.2026 18:04:12' } },
    })
    const abzug = zustandsAbzug(ids, vorher, STATUS)
    const nachher = hass({
      [STATUS]: { state: '3240', attributes: { last_cycle_at: '23.08.2026 18:04:42' } },
    })
    expect(hatSichGeaendert(ids, abzug, nachher, STATUS)).toBe(true)
  })
})
