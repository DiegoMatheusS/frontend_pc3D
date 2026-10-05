import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { identicalOffersFeedback, identicalOffersHasFailures, identicalOffersSources } from '../src/admin/utils/identicalOffers.js'

const paths = ['/src/admin/services/adminService.js', '/src/src/admin/services/adminService.js']
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
let server
const services = []

before(async () => {
  globalThis.window = { location: { origin: 'http://localhost' } }
  server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true },
  })
  for (const path of paths) {
    const { adminService } = await server.ssrLoadModule(path)
    services.push({ path, service: adminService })
  }
})

after(async () => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  await server?.close()
})

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

for (const path of paths) {
  test(`${path}: busca preserva produto, ofertas, contadores e diagnóstico`, async () => {
    const { service } = services.find((entry) => entry.path === path)
    assert.equal(typeof service.products.findAndRegisterIdenticalOffers, 'function')
    const requests = []
    const envelope = {
      produto: { id: 42, nome: 'Mouse Logitech G502' },
      quantidadeEncontrada: 3,
      quantidadeCadastrada: 2,
      quantidadeIgnorada: 1,
      cadastradas: [{ id: 101, parceiro: { nome: 'Magazine Luiza' }, preco: 199 }],
      ignoradas: [{ motivo: 'JA_CADASTRADA', ofertaId: 100 }],
      fontes: { shopee: { configurada: false } },
      produtoAlterado: false,
      fichaTecnicaAlterada: false,
    }
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options })
      return response(envelope)
    }
    const result = await service.products.findAndRegisterIdenticalOffers(42)
    assert.deepEqual(result, envelope)
    assert.equal(requests.length, 1)
    assert.equal(new URL(requests[0].url, 'http://localhost').pathname, '/api/admin/busca-ofertas/produto/42/encontrar-e-cadastrar')
    assert.equal(requests[0].options.method, 'POST')
    assert.equal(requests[0].options.credentials, 'include')
    assert.equal(requests[0].options.body, undefined)
    assert.match(identicalOffersFeedback(result, envelope.produto.nome), /2 nova\(s\) oferta/)
  })

  for (const status of [401, 403, 404, 503]) {
    test(`${path}: HTTP ${status} é reportado sem repetir cadastro`, async () => {
      const { service } = services.find((entry) => entry.path === path)
      let calls = 0
      globalThis.fetch = async () => { calls += 1; return response({ mensagem: `Erro ${status}` }, status) }
      await assert.rejects(service.products.findAndRegisterIdenticalOffers(42), (error) => error.status === status)
      assert.equal(calls, 1)
    })
  }

  test(`${path}: oferta manual mantém produtoId ao variar parceiro, preço e link`, async () => {
    const { service } = services.find((entry) => entry.path === path)
    const sent = []
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url, 'http://localhost').pathname, '/api/admin/ofertas')
      assert.equal(options.method, 'POST')
      const offer = JSON.parse(options.body)
      sent.push(offer)
      return response({ id: sent.length, ...offer })
    }
    const offers = [
      { parceiroId: 1, preco: 199, urlOriginal: 'https://www.magazineluiza.com.br/mouse/p/123' },
      { parceiroId: 2, preco: 189, urlOriginal: 'https://produto.mercadolivre.com.br/MLB-123-mouse' },
      { parceiroId: 3, preco: 179, urlOriginal: 'https://shopee.com.br/mouse-i.123.456' },
    ]
    for (const offer of offers) await service.offers.create({ produtoId: 42, ...offer })
    assert.deepEqual(sent, offers.map((offer) => ({ produtoId: 42, ...offer })))
  })
}

test('ofertas incompletas não são apresentadas como duplicatas', () => {
  assert.match(identicalOffersFeedback({ quantidadeEncontrada: 1, quantidadeCadastrada: 0,
    quantidadeIgnorada: 1, ignoradas: [{ motivo: 'DADOS_INCOMPLETOS' }] }, 'Mouse'), /sem parceiro, preço ou link/)
  assert.match(identicalOffersFeedback({ quantidadeEncontrada: 1, quantidadeCadastrada: 0,
    quantidadeIgnorada: 1, ignoradas: [{ motivo: 'JA_CADASTRADA' }] }, 'Mouse'), /já estavam cadastradas/)
})

test('falha de coleta não é apresentada como ausência definitiva de ofertas', () => {
  assert.match(identicalOffersFeedback({ quantidadeEncontrada: 0, fontes: { magalu: { falhasColeta: 2 } } }, 'Mouse'), /não puderam ser consultadas/)
  assert.match(identicalOffersFeedback({ quantidadeEncontrada: 0, fontes: { mercadoLivre: { erro: 'Indisponível' } } }, 'Mouse'), /não puderam ser consultadas/)
  assert.match(identicalOffersFeedback({ quantidadeEncontrada: 0, fontes: {} }, 'Mouse'), /Nenhum produto idêntico/)
})

for (const statusBusca of ['BLOQUEADO', 'FALHA_TEMPORARIA', 'TEMPO_LIMITE', 'ERRO']) {
  test(`${statusBusca}: falha aparece mesmo quando outra loja cadastrou uma oferta`, () => {
    const result = { quantidadeEncontrada: 1, quantidadeCadastrada: 1,
      fontes: { mercadoLivre: { statusBusca, encontrados: 0 }, shopee: { configurada: true, encontrados: 1 } },
      cadastradas: [{ parceiro: { nome: 'Shopee', slug: 'shopee' } }] }
    assert.equal(identicalOffersHasFailures(result), true)
    assert.match(identicalOffersFeedback(result, 'SSD'), /busca ficou incompleta/)
    const sources = identicalOffersSources(result)
    assert.equal(sources[0].partial, true)
    assert.equal(sources[2].created, 1)
    assert.equal(sources[2].found, 1)
    assert.doesNotMatch(sources[0].message, /Nenhuma oferta idêntica/)
  })
}

test('resultado por loja preserva ofertas confirmadas após tempo limite e conta duplicadas', () => {
  const result = { fontes: { magalu: { encontrados: 2, statusBusca: 'TEMPO_LIMITE' } },
    cadastradas: [{ parceiro: { nome: 'Magazine Luiza', slug: 'magazine-luiza' } }],
    ignoradas: [{ marketplace: 'MAGALU', motivo: 'JA_CADASTRADA' }] }
  const source = identicalOffersSources(result)[1]
  assert.equal(source.found, 2)
  assert.equal(source.created, 1)
  assert.equal(source.duplicates, 1)
  assert.match(source.message, /excedeu o tempo/)
})

test('resultado diferencia integração ausente, identidade rejeitada e preço ausente', () => {
  const sources = identicalOffersSources({ fontes: { shopee: { configurada: false },
    mercadoLivre: { rejeitadosPorIdentidade: 2 }, magalu: { semPreco: 1 } } })
  assert.match(sources[0].message, /não confirmaram o mesmo/)
  assert.match(sources[1].message, /sem uma oferta válida/)
  assert.match(sources[2].message, /não configurada/)
})
