import test from 'node:test'
import assert from 'node:assert/strict'
import { completeOfferDescription } from '../src/admin/utils/offerDescription.js'
import { getAiOffer, getAiPayload, mergeAiImportPreview } from '../src/admin/utils/aiImportContract.js'

const schema = {
  key: 'especificacaoProcessador', title: 'Processador',
  fields: [['nucleos', 'Núcleos'], ['threads', 'Threads'], ['tdpWatts', 'TDP (W)'], ['suportaEcc', 'Suporta ECC']],
}
const schemaFor = (category) => category === 'PROCESSADOR' ? schema : null
const source = (valor, extra = {}) => ({
  valor, trecho: `Technical specification: ${valor}`, evidenciaCampoConfirmada: true,
  fonte: 'FABRICANTE_OFICIAL', url: 'https://www.amd.com/en/products/processors/desktop/ryzen/5000-series/amd-ryzen-5-5600g.html', ...extra,
})
const offer = { preco: 499.90, urlOriginal: 'https://shopee.com.br/product/123/456', urlAfiliada: 'https://s.shopee.com.br/oferta', vendedorNome: 'Loja' }
const preview = (payload = {}, research = {}) => ({
  categoriaDetectada: 'PROCESSADOR', destinoSugerido: 'HARDWARE',
  cadastroSugerido: { payload: { nome: 'AMD Ryzen 5 5600G', categoria: 'PROCESSADOR', imagemUrl: 'https://loja.example/cpu.jpg', ...payload } },
  ofertaColetada: offer, pesquisaTecnica: research,
})

test('preserva a descrição da loja e não faz uma pesquisa redundante', async () => {
  const original = preview({ descricao: 'Descrição completa do anúncio.' })
  const result = await completeOfferDescription(original, {
    category: 'PROCESSADOR', schemaFor,
    researchSpecifications: () => { throw new Error('Não deve pesquisar') },
  })
  assert.equal(result.preview, original)
  assert.equal(result.descriptionWarning, '')
})

test('a descrição usa dados já confirmados, incluindo false, sem alterar a oferta', async () => {
  const original = preview({ especificacaoProcessador: { nucleos: 6, suportaEcc: false } }, {
    origemPorCampo: { nucleos: source(6), suportaEcc: source(false) },
  })
  const result = await completeOfferDescription(original, { category: 'PROCESSADOR', schemaFor })
  const description = getAiPayload(result.preview).descricao
  assert.match(description, /Núcleos: 6/)
  assert.match(description, /Suporta ECC: Não/)
  assert.match(description, /Fontes técnicas:/)
  assert.equal(result.descriptionWarning, '')
  assert.ok(result.descriptionNotice)
  assert.deepEqual(getAiOffer(result.preview), getAiOffer(original))
  assert.equal(original.cadastroSugerido.payload.descricao, undefined)
})

test('pesquisa pelo nome da busca mesmo quando a importação retornou campos vazios', async () => {
  const original = mergeAiImportPreview(preview({ especificacaoProcessador: { tdpWatts: 45 } }), {
    cadastroSugerido: { payload: { nome: '', descricao: null } },
  })
  let request
  const result = await completeOfferDescription(original, {
    category: 'PROCESSADOR', schemaFor,
    researchSpecifications: async (body) => {
      request = body
      return { payload: { nome: body.nome, especificacaoProcessador: { nucleos: 6, threads: 12, tdpWatts: 65 } },
        origemPorCampo: { nucleos: source(6), threads: source(12), tdpWatts: source(65) } }
    },
  })
  assert.equal(request.nome, 'AMD Ryzen 5 5600G')
  assert.deepEqual(request.payload.especificacaoProcessador, {})
  const payload = getAiPayload(result.preview)
  assert.equal(payload.especificacaoProcessador.nucleos, 6)
  assert.equal(payload.especificacaoProcessador.tdpWatts, 45)
  assert.match(payload.descricao, /Threads: 12/)
  assert.doesNotMatch(payload.descricao, /TDP/)
  assert.equal(payload.imagemUrl, 'https://loja.example/cpu.jpg')
  assert.equal(getAiOffer(result.preview).urlAfiliada, offer.urlAfiliada)
})

test('não usa valores sem comprovação, divergentes, em conflito ou com URL insegura', async () => {
  const original = preview({ especificacaoProcessador: { nucleos: 6, threads: 12, tdpWatts: 65, suportaEcc: false } }, {
    origemPorCampo: { nucleos: source(8), threads: source(12, { evidenciaCampoConfirmada: false }),
      tdpWatts: source(65, { url: 'javascript:alert(1)' }), suportaEcc: source(false) },
    conflitos: [{ campo: 'suportaEcc' }],
  })
  const result = await completeOfferDescription(original, { category: 'PROCESSADOR', schemaFor })
  assert.equal(getAiPayload(result.preview).descricao, '')
  assert.match(result.descriptionWarning, /não confirmou dados suficientes/)
})

test('PC recebe resumo da peça pesquisada sem inventar modelo de RAM ou SSD', async () => {
  const original = { ...preview({ nome: 'PC Gamer Ryzen 5 5600G 16GB RAM SSD 512GB' }), categoriaDetectada: 'PC_MONTADO', destinoSugerido: 'PC_MONTADO' }
  const buildAnalysis = { componentesDetectados: [
    { categoria: 'PROCESSADOR', nome: 'AMD Ryzen 5 5600G',
      cadastroHardwareSugerido: { especificacaoProcessador: { nucleos: 6 } }, origemPorCampo: { nucleos: source(6) } },
    { categoria: 'MEMORIA_RAM', nome: '16GB RAM', especificacoesConfirmadas: {}, origemPorCampo: {} },
  ] }
  const result = await completeOfferDescription(original, { category: 'PC_MONTADO', schemaFor, buildAnalysis })
  const description = getAiPayload(result.preview).descricao
  assert.match(description, /AMD Ryzen 5 5600G/)
  assert.match(description, /Núcleos: 6/)
  assert.doesNotMatch(description, /Corsair|Kingston|Samsung|RAM:/)
  assert.equal(result.preview.destinoSugerido, 'PC_MONTADO')
})

test('falha de pesquisa preserva título, imagem e oferta e deixa a descrição pendente', async () => {
  const original = preview()
  const result = await completeOfferDescription(original, {
    category: 'PROCESSADOR', schemaFor, researchSpecifications: async () => { throw new Error('Fonte indisponível') },
  })
  assert.equal(result.preview, original)
  assert.match(result.descriptionWarning, /Fonte indisponível/)
  assert.equal(getAiPayload(result.preview).nome, 'AMD Ryzen 5 5600G')
  assert.equal(getAiOffer(result.preview).preco, 499.90)
})

test('origens diretas da importação também permitem montar a descrição sem repetir pesquisa', async () => {
  const original = preview({ especificacaoProcessador: { nucleos: 6 } })
  delete original.pesquisaTecnica
  original.resultadoProdutoIa = { origemPorCampo: { nucleos: source(6) } }
  const result = await completeOfferDescription(original, { category: 'PROCESSADOR', schemaFor })
  assert.match(getAiPayload(result.preview).descricao, /Núcleos: 6/)
})

test('resumo conserva URLs completas e respeita o limite do campo de descrição', async () => {
  const original = preview({ nome: 'A'.repeat(4400), especificacaoProcessador: { nucleos: 6 } }, { origemPorCampo: { nucleos: source(6) } })
  const result = await completeOfferDescription(original, { category: 'PROCESSADOR', schemaFor })
  const description = getAiPayload(result.preview).descricao
  assert.ok(description.length < 5000)
  assert.ok(description.endsWith(source(6).url))
})
