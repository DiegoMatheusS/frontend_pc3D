import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextHardwareDiscoveryPage } from '../src/admin/utils/hardwareDiscovery.js'

test('página curta ou vazia continua quando o servidor informa que há mais candidatos', () => {
  assert.equal(nextHardwareDiscoveryPage({ totalEncontrados: 0, temMais: true }, { pagina: 1 }), 2)
  assert.equal(nextHardwareDiscoveryPage({ totalEncontrados: 3, temMais: true, proximaPagina: 4 }, { pagina: 3 }), 4)
})

test('fim explícito encerra a paginação mesmo com uma página cheia', () => {
  assert.equal(nextHardwareDiscoveryPage({ totalEncontrados: 100, temMais: false }), null)
})

test('cadastro reinicia o conjunto atualizado sem pular modelos movidos para a página anterior', () => {
  assert.equal(nextHardwareDiscoveryPage({ temMais: false }, { pagina: 3, catalogChanged: true }), 1)
})

test('API anterior continua pela quantidade encontrada sem inventar uma página em resposta curta', () => {
  assert.equal(nextHardwareDiscoveryPage({ totalEncontrados: 50 }, { pagina: 2 }), 3)
  assert.equal(nextHardwareDiscoveryPage({ totalEncontrados: 5 }), null)
})
