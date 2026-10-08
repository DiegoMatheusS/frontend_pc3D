import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeConfirmedListingComponents } from '../src/admin/utils/listingComponents.js'
import { findExistingProductFromAi } from '../src/admin/utils/catalogMatching.js'

const cpu = { id: 180, nome: 'Ryzen 5 5500', marca: 'AMD', modelo: 'Ryzen 5 5500', categoria: 'PROCESSADOR', tipo: 'HARDWARE' }
test('vincula somente a peça confirmada e presente no catálogo', () => {
  const confirmed = { hardwareId: 180, categoria: 'PROCESSADOR', vinculoConfirmadoNoAnuncio: true }
  assert.equal(mergeConfirmedListingComponents([], [confirmed], [cpu])[0].hardwareId, 180)
  assert.deepEqual(mergeConfirmedListingComponents([], [{ ...confirmed, revisaoNecessaria: true }], [cpu]), [])
  assert.deepEqual(mergeConfirmedListingComponents([], [{ ...confirmed, hardwareId: 999 }], [cpu]), [])
  assert.deepEqual(mergeConfirmedListingComponents([], [{ ...confirmed, categoria: 'FONTE' }], [cpu]), [])
  assert.deepEqual(mergeConfirmedListingComponents([], [{ ...confirmed, vinculoConfirmadoNoAnuncio: false }], [cpu]), [])
  const existing = [{ hardwareId: 12, categoria: 'PROCESSADOR' }]
  assert.deepEqual(mergeConfirmedListingComponents(existing, [confirmed], [cpu]), existing)
})
test('PC com Ryzen 5 5500 não é identificado como o Produto do processador', () => {
  const preview = { destinoSugerido: 'PC_MONTADO', cadastroSugerido: { payload: {
    nome: 'PC Gamer AMD Ryzen 5 5500', marca: 'AMD', modelo: 'Ryzen 5 5500',
  } } }
  assert.deepEqual(findExistingProductFromAi([cpu], preview), { product: null, ambiguous: [] })
  const pc = { ...cpu, id: 200, nome: 'PC Gamer AMD Ryzen 5 5500', tipo: 'BUILD' }
  assert.equal(findExistingProductFromAi([cpu, pc], preview).product.id, 200)
})
