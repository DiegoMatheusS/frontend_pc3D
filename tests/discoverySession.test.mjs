import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiscoverySession, getDiscoverySession } from '../src/admin/utils/discoverySession.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('hardware: filtros, página, seleção e fichas enriquecidas sobrevivem à recarga', () => {
  const storage = memoryStorage()
  const session = createDiscoverySession('hardware', storage, 'hardware')
  const result = { pagina: 3, novos: 1, itens: [{ idTemporario: 'rx6600', payload: { nome: 'RX 6600', vram: 8 }, cobertura: 100 }] }
  session.setters.setCategoria('PLACA_VIDEO')
  session.setters.setMarca('AMD')
  session.setters.setStatusFilter('PRONTO')
  session.setters.setPagina(3)
  session.setters.setLimite(30)
  session.setters.setResult(result)
  session.setters.setSelected(new Set(['rx6600']))
  session.setters.setBatchSummary({ criados: 2, erros: 0 })

  const restored = createDiscoverySession('hardware', storage, 'hardware').getSnapshot()
  assert.equal(restored.categoria, 'PLACA_VIDEO')
  assert.equal(restored.marca, 'AMD')
  assert.equal(restored.statusFilter, 'PRONTO')
  assert.equal(restored.pagina, 3)
  assert.equal(restored.limite, 30)
  assert.deepEqual(restored.result, result)
  assert.deepEqual(restored.selected, new Set(['rx6600']))
  assert.deepEqual(restored.batchSummary, { criados: 2, erros: 0 })
})

test('ofertas: pesquisa, promoção, análises e revisão de catálogo sobrevivem à recarga', () => {
  const storage = memoryStorage()
  const session = createDiscoverySession('offers', storage, 'offers')
  const results = [{ shopId: 1, itemId: 2, nome: 'SSD 1TB', preco: 399 }]
  const analyses = { '1-2': { preview: { nome: 'SSD 1TB', descricao: 'Ficha completa' } } }
  const reviews = { '1-2': { products: [{ id: 10, nome: 'SSD 1TB' }] } }
  session.setters.setQuery('SSD 1TB')
  session.setters.setOnlyPromotions(true)
  session.setters.setLimit(40)
  session.setters.setResults(results)
  session.setters.setSearchWarnings(['Um anúncio sem estoque.'])
  session.setters.setAnalyses(analyses)
  session.setters.setCatalogReviews(reviews)

  const restored = createDiscoverySession('offers', storage, 'offers').getSnapshot()
  assert.equal(restored.query, 'SSD 1TB')
  assert.equal(restored.onlyPromotions, true)
  assert.equal(restored.limit, 40)
  assert.deepEqual(restored.results, results)
  assert.deepEqual(restored.searchWarnings, ['Um anúncio sem estoque.'])
  assert.deepEqual(restored.analyses, analyses)
  assert.deepEqual(restored.catalogReviews, reviews)
})

test('resposta recebida fora da página fica disponível ao voltar, sem outra pesquisa', async () => {
  const session = createDiscoverySession('offers', memoryStorage(), 'offers')
  let notifications = 0
  const leavePage = session.subscribe(() => { notifications += 1 })
  session.setters.setLoading(true)
  leavePage()

  const results = await Promise.resolve([{ nome: 'Ryzen 5600', itemId: 1 }])
  session.setters.setResults(results)
  session.setters.setLoading(false)
  assert.equal(notifications, 1)
  assert.deepEqual(session.getSnapshot().results, results)

  const leaveAgain = session.subscribe(() => { notifications += 1 })
  session.setters.setAnalyses((current) => ({ ...current, 'shop-1': { preview: { nome: 'Ryzen 5600' } } }))
  assert.equal(notifications, 2)
  assert.equal(session.getSnapshot().analyses['shop-1'].preview.nome, 'Ryzen 5600')
  leaveAgain()
})

test('recarga preserva resultados, mas reinicia os indicadores de tarefas interrompidas', () => {
  const storage = memoryStorage()
  const hardware = createDiscoverySession('hardware', storage, 'hardware')
  hardware.setters.setLoading(true)
  hardware.setters.setBatchBusy(true)
  hardware.setters.setAddingIds(new Set(['cpu']))
  hardware.setters.setMetaAiBusyIds(new Set(['cpu']))
  hardware.setters.setIaTecnicaBusyIds(new Set(['cpu']))
  hardware.setters.setResult({ itens: [{ nome: 'CPU' }] })
  const restored = createDiscoverySession('hardware', storage, 'hardware').getSnapshot()
  assert.equal(restored.loading, false)
  assert.equal(restored.batchBusy, false)
  assert.equal(restored.addingIds.size, 0)
  assert.equal(restored.metaAiBusyIds.size, 0)
  assert.equal(restored.iaTecnicaBusyIds.size, 0)
  assert.equal(restored.result.itens.length, 1)

  const offers = createDiscoverySession('offers', storage, 'offers')
  offers.setters.setLoading(true)
  offers.setters.setAnalyzingId('1-2')
  offers.setters.setCheckingId('1-2')
  offers.setters.setResults([{ nome: 'SSD' }])
  const restoredOffers = createDiscoverySession('offers', storage, 'offers').getSnapshot()
  assert.equal(restoredOffers.loading, false)
  assert.equal(restoredOffers.analyzingId, null)
  assert.equal(restoredOffers.checkingId, null)
  assert.equal(restoredOffers.results.length, 1)
})

test('hardware cadastrado é removido também do resultado salvo', () => {
  const storage = memoryStorage()
  const session = createDiscoverySession('hardware', storage, 'hardware')
  session.setters.setResult({ itens: [{ idTemporario: 'cpu' }, { idTemporario: 'gpu' }] })
  session.setters.setSelected(new Set(['cpu', 'gpu']))
  session.setters.setResult((current) => ({ ...current, itens: current.itens.filter((item) => item.idTemporario !== 'cpu') }))
  session.setters.setSelected((current) => new Set([...current].filter((key) => key !== 'cpu')))
  const restored = createDiscoverySession('hardware', storage, 'hardware').getSnapshot()
  assert.deepEqual(restored.result.itens, [{ idTemporario: 'gpu' }])
  assert.deepEqual(restored.selected, new Set(['gpu']))
})

test('cache inválido ou de outra versão não quebra a descoberta', () => {
  for (const raw of ['{inválido', 'null', '{"version":999,"state":{"query":"antiga"}}']) {
    const session = createDiscoverySession('offers', { getItem: () => raw }, 'offers')
    assert.equal(session.getSnapshot().query, '')
    assert.deepEqual(session.getSnapshot().results, [])
  }
  const malformed = JSON.stringify({ version: 1, state: {
    result: { itens: 'inválido' }, selected: {}, pagina: -1, marca: {}, loading: true,
  } })
  const restored = createDiscoverySession('hardware', { getItem: () => malformed }, 'hardware').getSnapshot()
  assert.equal(restored.result, null)
  assert.equal(restored.selected.size, 0)
  assert.equal(restored.pagina, 1)
  assert.equal(restored.marca, '')
  assert.equal(restored.loading, false)
})

test('armazenamento bloqueado preserva os resultados durante a navegação em memória', () => {
  const blocked = {
    getItem: () => { throw new Error('bloqueado') },
    setItem: () => { throw new Error('quota excedida') },
  }
  const session = createDiscoverySession('offers', blocked, 'offers')
  session.setters.setResults([{ nome: 'SSD' }])
  assert.equal(session.getSnapshot().results[0].nome, 'SSD')
})

test('sessões ficam separadas por usuário e por página', () => {
  const firstUser = getDiscoverySession('offers', 'test-user-1')
  firstUser.setters.setQuery('Ryzen 5600')
  assert.equal(getDiscoverySession('offers', 'test-user-1'), firstUser)
  assert.equal(getDiscoverySession('offers', 'test-user-1').getSnapshot().query, 'Ryzen 5600')
  assert.equal(getDiscoverySession('offers', 'test-user-2').getSnapshot().query, '')
  assert.equal(getDiscoverySession('hardware', 'test-user-1').getSnapshot().result, null)
})
