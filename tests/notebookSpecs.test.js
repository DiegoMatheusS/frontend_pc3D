import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNotebookSpecs, notebookSpecValue, notebookPath } from '../src/utils/notebookSpecs.js'

test('backend notebook aliases are visible with units and confirmed negatives', () => {
  const spec = normalizeNotebookSpecs({
    sistemaOperacional: 'Windows 11 Home', webcam: false, wifi: 'Wi-Fi 6',
    resolucaoWebcam: '720p', tecladoNumerico: true, tecladoIluminado: 'false',
    clockBaseMhz: 2400, frequenciaMhz: 3200, slotsRamLivres: 0, bateriaWh: 45,
  })
  assert.equal(spec.os, 'Windows 11 Home')
  assert.equal(spec.cpuBaseClockGhz, 2.4)
  assert.equal(spec.ramFrequencyMhz, 3200)
  assert.equal(spec.freeRamSlots, 0)
  assert.equal(spec.webcamResolution, '720p')
  assert.equal(notebookSpecValue('webcam', spec.webcam), 'Não')
  assert.equal(notebookSpecValue('numericKeypad', spec.numericKeypad), 'Sim')
  assert.equal(notebookSpecValue('backlitKeyboard', spec.backlitKeyboard), 'Não')
  assert.equal(notebookSpecValue('batteryWh', spec.batteryWh, ' Wh'), '45 Wh')
  assert.equal(notebookSpecValue('cpuBaseClockGhz', spec.cpuBaseClockGhz, ' GHz'), '2,4 GHz')
})

test('absence stays unknown instead of false or zero', () => {
  const spec = normalizeNotebookSpecs({ wifi: 'Não encontrado', webcam: null })
  for (const key of ['dedicatedGpu', 'webcam', 'wifi', 'ramGb', 'os']) {
    assert.equal(notebookSpecValue(key, spec[key]), 'Não informado')
  }
  assert.equal(normalizeNotebookSpecs({ gpuDedicada: 'false' }).dedicatedGpu, false)
})

test('slug paths are escaped and legacy numeric links still resolve', () => {
  assert.equal(notebookPath({ id: 5, slug: 'acer-aspire-5' }), '/notebooks/acer-aspire-5')
  assert.equal(notebookPath({ id: 5 }), '/notebooks/5')
  assert.equal(notebookPath({ slug: 'acer/teste' }), '/notebooks/acer%2Fteste')
})
