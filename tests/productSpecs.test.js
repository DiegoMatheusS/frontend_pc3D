import { test } from 'node:test'
import assert from 'node:assert/strict'
import { specLabel, specValue } from '../src/utils/productSpecs.js'

test('exibe NFC e preserva respostas negativas', () => {
  assert.equal(specLabel('nfc'), 'NFC')
  assert.equal(specValue('nfc', false), 'Não')
  assert.equal(specValue('nfc', 'false'), 'Não')
  assert.equal(specValue('nfc', true), 'Sim')
})
test('formata bateria com milhar e unidade uma única vez', () => {
  for (const value of [5000, '5000', '5.000 mAh', '5,000 mAh']) assert.equal(specValue('bateriaMah', value), '5.000 mAh')
})
test('exibe estruturas e rótulos legíveis', () => {
  assert.equal(specLabel('cameraPrincipalMp'), 'Câmera traseira')
  assert.equal(specValue('ports', {nfc: false}), 'NFC: Não')
  assert.equal(specValue('frequencyMhz', 3200), '3.200 MHz')
})
