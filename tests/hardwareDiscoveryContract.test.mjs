import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { nextHardwareDiscoveryPage } from '../src/admin/utils/hardwareDiscovery.js'

let server, service, Page
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

before(async () => {
  globalThis.window = { location: { origin: 'http://localhost' } }
  server = await createServer({ logLevel: 'error', server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true } })
  service = (await server.ssrLoadModule('/src/admin/services/adminService.js')).adminService
  Page = (await server.ssrLoadModule('/src/admin/pages/AdminHardwareDiscovery.jsx')).default
})

after(async () => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  await server?.close()
})

test('busca envia modelo e 100 resultados; página vazia preserva a continuação da API', async () => {
  let sent
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url, 'http://localhost').pathname, '/api/admin/hardwares/descobrir')
    assert.equal(options.method, 'POST')
    sent = JSON.parse(options.body)
    return new Response(JSON.stringify({ pagina: 1, totalEncontrados: 0, itens: [], temMais: true, proximaPagina: 2 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const result = await service.hardwares.discover({ categoria: 'PROCESSADOR', consulta: 'i5-9500', limite: 100, pagina: 1 })
  assert.equal(sent.consulta, 'i5-9500')
  assert.equal(sent.limite, 100)
  assert.equal(nextHardwareDiscoveryPage(result), 2)
})

test('tela oferece busca por família/modelo e opção de 100 itens', () => {
  const html = renderToStaticMarkup(React.createElement(Page))
  assert.match(html, /Modelo ou família/)
  assert.match(html, /<option value="100">100<\/option>/)
  assert.match(html, /i5-9500/)
})
