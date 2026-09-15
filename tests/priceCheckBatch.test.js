import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verificarLotePrecos } from '../src/admin/utils/priceCheckBatch.js'

test('continua o lote excluindo IDs já processados e acumula o relatório', async () => {
  let calls = 0
  const progress = []
  const report = await verificarLotePrecos({
    request: async (limit, ids) => {
      calls++
      if (calls === 1) return { suportaContinuacao: true, restantesElegiveis: 2, resultados: [{ ofertaId: 1, status: 'ATUALIZADO' }, { ofertaId: 2, status: 'BLOQUEADO' }] }
      assert.equal(limit, 48)
      assert.deepEqual(ids, [1, 2])
      return { suportaContinuacao: true, restantesElegiveis: 0, resultados: [{ ofertaId: 3, status: 'SEM_ALTERACAO' }, { ofertaId: 4, status: 'ERRO' }] }
    }, onProgress: r => progress.push(r.verificadas),
  })
  assert.equal(calls, 2)
  assert.equal(report.verificadas, 4)
  assert.equal(report.atualizadas, 1)
  assert.equal(report.bloqueadas, 1)
  assert.equal(report.erros, 1)
  assert.deepEqual(progress, [2, 4])
})
test('encerra se o servidor repetir IDs sem progresso', async () => {
  let calls = 0
  await verificarLotePrecos({ request: async () => { calls++; return { suportaContinuacao: true, restantesElegiveis: 10, resultados: [{ ofertaId: 1, status: 'ERRO' }] } } })
  assert.equal(calls, 2)
})
test('parada preserva a parcela concluída e evita outra chamada', async () => {
  let stop = false, calls = 0
  const report = await verificarLotePrecos({ request: async () => { calls++; return { suportaContinuacao: true, restantesElegiveis: 10, resultados: [{ ofertaId: 1, status: 'ERRO' }] } }, onProgress: () => { stop = true }, shouldStop: () => stop })
  assert.equal(calls, 1)
  assert.equal(report.verificadas, 1)
})
test('backend antigo não recebe continuação desconhecida', async () => {
  let calls = 0
  await verificarLotePrecos({ request: async () => { calls++; return { restantesElegiveis: 10, resultados: [{ ofertaId: 1, status: 'ERRO' }] } } })
  assert.equal(calls, 1)
})
