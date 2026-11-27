import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizarNomeTecnico } from '../src/admin/utils/catalogContent.js'
import { getAiPayload, mergeAiImportPreview } from '../src/admin/utils/aiImportContract.js'
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

test('a importação parcial preserva a ficha do anúncio sem copiar a descrição comercial', () => {
  const preview = mergeAiImportPreview({
    categoriaDetectada: 'MEMORIA_RAM',
    cadastroSugerido: { payload: { nome: 'Kingston Fury Beast DDR4', especificacaoMemoriaRam: {
      capacidadePorModuloGb: 16, frequenciaMhz: 3200, possuiEcc: false,
    } } },
  }, {
    categoriaDetectada: 'MEMORIA_RAM', descricaoAnuncio: 'Conheça a história da marca. Frete grátis.',
    cadastroSugerido: { payload: { especificacaoMemoriaRam: { frequenciaMhz: null, latenciaCl: 16 } } },
  })
  const payload = getAiPayload(preview)
  assert.equal(payload.descricao, '')
  assert.equal(payload.especificacaoMemoriaRam.capacidadePorModuloGb, 16)
  assert.equal(payload.especificacaoMemoriaRam.frequenciaMhz, 3200)
  assert.equal(payload.especificacaoMemoriaRam.latenciaCl, 16)
  assert.equal(payload.especificacaoMemoriaRam.possuiEcc, false)
})
