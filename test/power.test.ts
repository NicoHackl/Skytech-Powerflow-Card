import { describe, expect, test } from 'vitest'
import {
  batterieLeistung, geraeteLeistung, netzLeistung, pvLeistung, STANDARD_SPANNUNG_V,
} from '../src/power'
import type { Device, FlowStatus, Hass, HassEntity } from '../src/types'

/* Auflösung der Messwerte, je power_kind Normalfall, Fehlerfall und
   Leerfall. Kein DOM, keine HA-Attrappe — power.ts liest nur `hass.states`. */

function hass(zustaende: Record<string, string>): Hass {
  const states: Record<string, HassEntity> = {}
  for (const [entity_id, state] of Object.entries(zustaende)) {
    states[entity_id] = { entity_id, state, attributes: {} }
  }
  return { states }
}

function geraet(teil: Partial<Device>): Device {
  return { id: 'testgeraet', ...teil }
}

describe('watt', () => {
  test('watt liest den Sensor direkt', () => {
    const wert = geraeteLeistung(
      hass({ 'sensor.ist': '1400' }),
      geraet({ power_kind: 'watt', power_entity: 'sensor.ist' }), null)
    expect(wert).toEqual({ wert: 1400, quelle: 'direkt' })
  })
})

describe('ampere', () => {
  const wallbox = (teil: Partial<Device> = {}) => geraet({
    power_kind: 'ampere', power_entity: 'sensor.strom',
    voltage_entities: ['sensor.l1', 'sensor.l2', 'sensor.l3'],
    phases_entity: 'input_number.phasen', phases_fallback: 3, ...teil,
  })

  test('ampere rechnet mit drei Phasen und Spannungssensoren', () => {
    const wert = geraeteLeistung(hass({
      'sensor.strom': '10', 'input_number.phasen': '3',
      'sensor.l1': '230', 'sensor.l2': '231', 'sensor.l3': '229',
    }), wallbox(), null)
    expect(wert.wert).toBe(10 * (230 + 231 + 229))
  })

  test('ampere nimmt 230 V an, wenn kein Spannungssensor gesetzt ist', () => {
    const wert = geraeteLeistung(hass({
      'sensor.strom': '16', 'input_number.phasen': '3',
    }), wallbox({ voltage_entities: ['', '', ''] }), null)
    expect(wert.wert).toBe(16 * 3 * STANDARD_SPANNUNG_V)
  })

  test('ampere rechnet bei einer Phase nur mit der ersten Spannung', () => {
    const wert = geraeteLeistung(hass({
      'sensor.strom': '16', 'input_number.phasen': '1',
      'sensor.l1': '235', 'sensor.l2': '235', 'sensor.l3': '235',
    }), wallbox(), null)
    expect(wert.wert).toBe(16 * 235)
  })

  test('ampere fällt auf phases_fallback zurück, wenn phases_entity ungültig ist', () => {
    const wert = geraeteLeistung(hass({
      'sensor.strom': '10', 'input_number.phasen': 'unavailable',
    }), wallbox({ voltage_entities: ['', '', ''], phases_fallback: 1 }), null)
    expect(wert.wert).toBe(10 * STANDARD_SPANNUNG_V)
  })
})

describe('binary_static', () => {
  const luefter = (teil: Partial<Device> = {}) => geraet({
    power_kind: 'binary_static', switch_entity: 'switch.luefter',
    static_power_w: 1500, ...teil,
  })

  test('binary_static liefert 0, wenn der Schalter aus ist', () => {
    const wert = geraeteLeistung(hass({ 'switch.luefter': 'off' }), luefter(), null)
    expect(wert).toEqual({ wert: 0, quelle: 'direkt' })
  })

  test('binary_static bevorzugt power_actual_entity vor static_power_w', () => {
    const wert = geraeteLeistung(
      hass({ 'switch.luefter': 'on', 'sensor.gemessen': '1320' }),
      luefter({ power_actual_entity: 'sensor.gemessen' }), null)
    expect(wert.wert).toBe(1320)
  })

  test('binary_static nimmt static_power_w, wenn der Messwert ausfällt', () => {
    const wert = geraeteLeistung(
      hass({ 'switch.luefter': 'on', 'sensor.gemessen': 'unavailable' }),
      luefter({ power_actual_entity: 'sensor.gemessen' }), null)
    expect(wert.wert).toBe(1500)
  })
})

describe('battery', () => {
  test('battery_split bildet laden minus entladen', () => {
    const wert = geraeteLeistung(
      hass({ 'sensor.laden': '0', 'sensor.entladen': '800' }),
      geraet({
        power_kind: 'battery_split',
        charge_power_entity: 'sensor.laden', discharge_power_entity: 'sensor.entladen',
      }), null)
    expect(wert.wert).toBe(-800)
  })

  test('battery_signed dreht das Vorzeichen bei positiv_entladen', () => {
    const wert = geraeteLeistung(
      hass({ 'sensor.speicher': '900' }),
      geraet({
        power_kind: 'battery_signed', power_entity: 'sensor.speicher',
        power_sign: 'positiv_entladen',
      }), null)
    expect(wert.wert).toBe(-900)
  })
})

describe('Ausfälle', () => {
  const heizstab = geraet({ id: 'heizstab', power_kind: 'watt', power_entity: 'sensor.ist' })

  test('unavailable wird nicht zu 0, sondern zu unbekannt', () => {
    const wert = geraeteLeistung(hass({ 'sensor.ist': 'unavailable' }), heizstab, null)
    expect(wert).toEqual({ wert: null, quelle: 'unbekannt' })
  })

  test('Rückfallwert aus der Statusentität greift, wenn der Direktwert fehlt', () => {
    const status: FlowStatus = { devices: { heizstab: { leistung_w: 1400 } } }
    const wert = geraeteLeistung(hass({ 'sensor.ist': 'unknown' }), heizstab, status)
    expect(wert).toEqual({ wert: 1400, quelle: 'status' })
  })

  test('ohne Direktwert und ohne Rückfallwert bleibt es unbekannt', () => {
    const status: FlowStatus = { devices: { heizstab: { leistung_w: null } } }
    const wert = geraeteLeistung(hass({}), heizstab, status)
    expect(wert.quelle).toBe('unbekannt')
  })

  test('unbekannter power_kind ergibt unbekannt statt Fehler', () => {
    const wert = geraeteLeistung(
      hass({ 'sensor.ist': '500' }),
      geraet({ power_kind: 'irgendwas_neues', power_entity: 'sensor.ist' }), null)
    expect(wert.quelle).toBe('unbekannt')
  })
})

describe('Anlagenwerte', () => {
  test('Erzeugung summiert alle PV-Sensoren', () => {
    const wert = pvLeistung(
      hass({ 'sensor.dach': '3000', 'sensor.garage': '1200' }),
      { pv_power_entities: ['sensor.dach', 'sensor.garage'] })
    expect(wert.wert).toBe(4200)
  })

  test('ein ausgefallener PV-Sensor macht die Summe unbekannt, nicht kleiner', () => {
    const wert = pvLeistung(
      hass({ 'sensor.dach': '3000', 'sensor.garage': 'unavailable' }),
      { pv_power_entities: ['sensor.dach', 'sensor.garage'] })
    expect(wert.quelle).toBe('unbekannt')
  })

  test('ohne PV-Sensor gibt es keinen Erzeugungswert', () => {
    expect(pvLeistung(hass({}), { pv_power_entities: [] }).quelle).toBe('unbekannt')
  })

  test('Netz zerlegt den signierten Sensor in Bezug und Einspeisung', () => {
    const netz = netzLeistung(hass({ 'sensor.netz': '-1200' }),
      { grid_power_entity: 'sensor.netz', grid_power_sign: 'positiv_bezug' })
    expect(netz.hin.wert).toBe(0)
    expect(netz.her.wert).toBe(1200)
  })

  test('Netz dreht das Vorzeichen bei positiv_einspeisung', () => {
    const netz = netzLeistung(hass({ 'sensor.netz': '1200' }),
      { grid_power_entity: 'sensor.netz', grid_power_sign: 'positiv_einspeisung' })
    expect(netz.her.wert).toBe(1200)
  })

  test('getrennte Netzsensoren werden direkt gelesen', () => {
    const netz = netzLeistung(hass({ 'sensor.bezug': '400', 'sensor.einspeisung': '0' }),
      { grid_import_entity: 'sensor.bezug', grid_export_entity: 'sensor.einspeisung' })
    expect(netz.hin.wert).toBe(400)
    expect(netz.her.wert).toBe(0)
  })

  test('Batterie ohne Konfiguration liefert unbekannt, nicht 0', () => {
    const batterie = batterieLeistung(hass({}), null)
    expect(batterie.hin.quelle).toBe('unbekannt')
    expect(batterie.her.quelle).toBe('unbekannt')
  })
})
