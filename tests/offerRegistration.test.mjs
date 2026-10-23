import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOfferRegistration, newBuildOffers } from '../src/admin/utils/offerRegistration.js'

test('PC completo abre o cadastro mesmo quando o catálogo de peças está indisponível', async () => {
  let hardwareCalls = 0
  const catalog = { products: { list: async () => [] }, hardwares: { list: async () => { hardwareCalls++; throw new Error('HTTP 403') } } }
  const result = await resolveOfferRegistration({ destinoSugerido: 'PC_MONTADO', normalizacao: { camposNormalizados: { nome: 'PC completo Ryzen 5 5600G 16GB SSD 512GB' } } }, 'PC_MONTADO', catalog)
  assert.equal(hardwareCalls, 0)
  assert.equal(result.product, null)
})
test('PC não é confundido com seu processador; anúncio existente continua reutilizado', async () => {
  const preview = { destinoSugerido: 'PC_MONTADO', normalizacao: { camposNormalizados: { nome: 'PC Ryzen 5600G 16GB' } } }
  const product = { id: 9, tipo: 'BUILD', nome: 'PC Ryzen 5600G 16GB' }
  const result = await resolveOfferRegistration(preview, 'PC_MONTADO', { products: { list: async () => [{ id: 1, tipo: 'HARDWARE', nome: product.nome }, product] } })
  assert.equal(result.product.id, 9)
})
test('ofertas do PC são enviadas junto com o cadastro, sem produtoId provisório', () => {
  assert.deepEqual(newBuildOffers([{ preco: 100 }, { _removed: true }], row => ({ ...row, produtoId: 1, parceiroId: 2 })), [{ preco: 100, parceiroId: 2 }])
})
