import test from 'node:test'
import assert from 'node:assert/strict'
import * as rootTransfer from '../src/admin/utils/aiImportTransfer.js'
import * as nestedTransfer from '../src/src/admin/utils/aiImportTransfer.js'
import { mergeAiImportPreview, getAiPayload, getAiOffer } from '../src/admin/utils/aiImportContract.js'

function withSession(run) {
  const previous = globalThis.window
  const values = new Map()
  globalThis.window = { sessionStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } }
  try { run(values) } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
}

for (const [name, transfer] of [['raiz', rootTransfer], ['segunda raiz', nestedTransfer]]) {
  test(`${name}: render descartado não perde os dados de cadastrar uma oferta`, () => withSession(() => {
    const listing = { destinoSugerido: 'PC_MONTADO', categoriaDetectada: 'PC_MONTADO',
      normalizacao: { camposNormalizados: {
        nome: 'Computador Ryzen 5 16GB SSD 512GB', descricao: 'Computador completo com teclado.',
        imagemUrl: 'https://loja.example/pc.jpg',
      } }, ofertaColetada: { preco: 2399.90, parceiroNome: 'Shopee', urlOriginal: 'https://shopee.com.br/product/1/2' } }
    const preview = mergeAiImportPreview(listing, { cadastroSugerido: { payload: { nome: '', descricao: null } } })
    assert.equal(transfer.storeAiImportPreview(preview), true)
    // Primeira tentativa de montar o formulário, descartada antes do commit.
    assert.deepEqual(transfer.readAiImportPreview('PC_MONTADO'), JSON.parse(JSON.stringify(preview)))
    // Nova tentativa: ainda tem os dados e pode aplicar no formulário.
    const committed = transfer.readAiImportPreview('PC_MONTADO')
    assert.equal(getAiPayload(committed).nome, listing.normalizacao.camposNormalizados.nome)
    assert.equal(getAiPayload(committed).descricao, listing.normalizacao.camposNormalizados.descricao)
    assert.equal(getAiPayload(committed).imagemUrl, listing.normalizacao.camposNormalizados.imagemUrl)
    assert.equal(getAiOffer(committed).preco, 2399.90)
    assert.equal(transfer.clearAiImportPreview(committed), true)
    assert.equal(transfer.readAiImportPreview('PC_MONTADO'), null)
  }))

  test(`${name}: abrir destino errado não remove a prévia`, () => withSession(() => {
    const preview = { destinoSugerido: 'NOTEBOOK', nome: 'Notebook' }
    transfer.storeAiImportPreview(preview)
    assert.equal(transfer.readAiImportPreview('HARDWARE'), null)
    assert.deepEqual(transfer.readAiImportPreview('NOTEBOOK'), preview)
  }))

  test(`${name}: confirmação antiga não apaga um novo produto transferido`, () => withSession(() => {
    const oldPreview = { destinoSugerido: 'PC_MONTADO', nome: 'Computador A' }
    const newPreview = { destinoSugerido: 'PC_MONTADO', nome: 'Computador B' }
    transfer.storeAiImportPreview(oldPreview)
    const mounted = transfer.readAiImportPreview('PC_MONTADO')
    transfer.storeAiImportPreview(newPreview)
    assert.equal(transfer.clearAiImportPreview(mounted), false)
    assert.deepEqual(transfer.readAiImportPreview('PC_MONTADO'), newPreview)
  }))

  test(`${name}: redirecionamento preserva a prévia do novo destino`, () => withSession(() => {
    const preview = { destinoSugerido: 'HARDWARE', nome: 'SSD' }
    transfer.storeAiImportPreview(preview)
    const productFormCopy = transfer.readAiImportPreview()
    transfer.clearAiImportPreview(productFormCopy)
    transfer.storeAiImportPreview(productFormCopy)
    assert.deepEqual(transfer.readAiImportPreview('HARDWARE'), preview)
  }))

  test(`${name}: armazenamento indisponível falha sem quebrar o cadastro`, () => withSession(() => {
    window.sessionStorage.getItem = () => { throw new Error('unavailable') }
    window.sessionStorage.setItem = () => { throw new Error('unavailable') }
    assert.equal(transfer.readAiImportPreview(), null)
    assert.equal(transfer.storeAiImportPreview({}), false)
    assert.equal(transfer.clearAiImportPreview({}), false)
  }))
}
