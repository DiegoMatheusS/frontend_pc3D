import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizarNomeTecnico } from '../src/admin/utils/catalogContent.js'
import { getAiPayload } from '../src/admin/utils/aiImportContract.js'
import { specificationDescription } from '../src/admin/utils/productSpecifications.js'
const cases = JSON.parse(await readFile(new URL('./fixtures/catalog-names.json', import.meta.url), 'utf8'))
for (const item of cases) test(`nome técnico: ${item.nome.slice(0, 70)}`, () => {
  assert.equal(normalizarNomeTecnico(item.nome, item), item.esperado)
})
test('prévia usa resumo técnico e mantém configuração do PC', () => {
  const response = { categoriaDetectada: 'ARMAZENAMENTO', descricaoAnuncio: 'Toda a história da marca.', cadastroSugerido: { payload: { nome: 'SSD NV2 foi desenvolvido para transformar seu dia.', descricao: 'SSD NVMe de 1000 GB.' } } }
  assert.equal(getAiPayload(response).nome, 'SSD NV2')
  assert.equal(getAiPayload(response).descricao, 'SSD NVMe de 1000 GB.')
  assert.equal(getAiPayload({ ...response, categoriaDetectada: 'PC_MONTADO' }).descricao, response.descricaoAnuncio)
})
test('descrição da ficha descarta identificação interna e história comercial', () => {
  const description = specificationDescription({ id: 3, historia: 'Desde 1989', descricao: 'Conheça nosso legado.', preco: 399, dpiMaximo: 25600, wireless: false, pesoGramas: 0 })
  assert.match(description, /25\.?600/)
  assert.match(description, /Não/)
  assert.match(description, /0 g/)
  assert.doesNotMatch(description, /1989|legado|399|ID:/i)
})
