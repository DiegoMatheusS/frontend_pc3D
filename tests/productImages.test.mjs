import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const paths = ['/src/admin/services/productImageService.js', '/src/src/admin/services/productImageService.js']
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
let server
const modules = new Map()

before(async () => {
  globalThis.window = { location: { origin: 'http://localhost' } }
  server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true },
  })
  for (const path of paths) modules.set(path, await server.ssrLoadModule(path))
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
  test(`${path}: formulário busca pela identidade sem enviar outros campos`, async () => {
    const { productImageService } = modules.get(path)
    const requests = []
    const envelope = { imagemUrl: 'https://http2.mlstatic.com/foto.webp?width=1200', urlFonte: 'https://mercadolivre.com.br/produto', fonte: 'Mercado Livre' }
    globalThis.fetch = async (url, options) => { requests.push({ url, options }); return response(envelope) }
    const result = await productImageService.search({ nome: ' Placa Zotac RTX 4060 ', marca: ' Zotac ', modelo: ' RTX 4060 ', preco: 1999, publicado: true, imagemUrl: 'https://foto-antiga.test/foto.jpg' })
    assert.deepEqual(result, envelope)
    assert.equal(requests.length, 1)
    assert.equal(new URL(requests[0].url, 'http://localhost').pathname, '/api/admin/produtos/buscar-imagem')
    assert.equal(requests[0].options.method, 'POST')
    assert.equal(requests[0].options.credentials, 'include')
    assert.deepEqual(JSON.parse(requests[0].options.body), { nome: 'Placa Zotac RTX 4060', marca: 'Zotac', modelo: 'RTX 4060', mpn: '', gtin: '' })
    assert.notEqual(result.imagemUrl, result.urlFonte)
  })

  test(`${path}: lista salva usando o ID do Produto`, async () => {
    const { productImageService } = modules.get(path)
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url, 'http://localhost').pathname, '/api/admin/produtos/42/imagem')
      assert.equal(options.method, 'POST')
      assert.equal(options.body, undefined)
      return response({ produtoId: 42, imagemUrl: 'https://cdn.test/foto.jpg' })
    }
    assert.equal((await productImageService.searchAndSave(42)).produtoId, 42)
  })

  test(`${path}: busca exige nome e modelo, MPN ou GTIN`, () => {
    const { canSearchProductImage } = modules.get(path)
    assert.equal(canSearchProductImage({ nome: 'Zotac RTX 4060' }), false)
    assert.equal(canSearchProductImage({ nome: 'Zotac RTX 4060', modelo: '   ' }), false)
    for (const key of ['modelo', 'mpn', 'gtin']) assert.equal(canSearchProductImage({ nome: 'Produto', [key]: '1234567890123' }), true)
    assert.equal(canSearchProductImage({ modelo: 'RTX 4060' }), false)
  })

  test(`${path}: falha da loja não dispara gravação ou nova tentativa`, async () => {
    const { productImageService } = modules.get(path)
    let requests = 0
    globalThis.fetch = async () => { requests += 1; return response({ mensagem: 'Imagem não encontrada' }, 502) }
    await assert.rejects(productImageService.searchAndSave(42), /Imagem não encontrada/)
    assert.equal(requests, 1)
  })
}
