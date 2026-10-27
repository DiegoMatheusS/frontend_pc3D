import assert from 'node:assert/strict'
import { STORE_MENU_SECTIONS } from '../src/data/storeNavigation.js'

const catalog = [
  { id: 701, nome: 'Roteador TP-Link AX53', categoria: 'ROTEADOR', marca: 'TP-Link', preco: 499 },
  { id: 702, nome: 'Repetidor Wi-Fi RE305', categoria: 'REPETIDOR_WIFI', marca: 'TP-Link', preco: 199 },
  { id: 703, nome: 'Switch de rede SG108', categoria: 'SWITCH_REDE', marca: 'Mercusys', preco: 149 },
  { id: 704, nome: 'Cabo para roteador AX53', categoria: 'CABO_ADAPTADOR', marca: 'Genérica', preco: 15 },
  { id: 705, nome: 'Ryzen 5 5600G', categoria: 'PROCESSADOR', marca: 'AMD', preco: 799 },
].map((item) => ({ ...item, descricao: 'Especificações técnicas do produto.', ativo: true, publicado: true }))

export async function verifyStoreTopics(page, base) {
  let mode = 'available'
  let releaseCatalog
  const pendingCatalog = new Promise((resolve) => { releaseCatalog = resolve })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = [], status = 200
    if (path === '/api/produtos') {
      if (mode === 'pending') await pendingCatalog
      if (mode === 'error') { status = 503; body = { message: 'Catálogo temporariamente indisponível.' } }
      else body = { produtos: mode === 'empty' ? [] : catalog, totalPaginas: 1 }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const menuLink = async (name) => {
    const openMenu = page.getByRole('button', { name: 'Abrir menu', exact: true })
    if (await openMenu.isVisible()) await openMenu.click()
    await page.locator('.store-menu__trigger').focus()
    await page.locator('#menu-loja').getByRole('link', { name, exact: true }).click()
  }
  const names = () => page.locator('.store-results .product-card__title').allTextContents()
  const unavailable = () => page.locator('.store-empty').getByText('Indisponível', { exact: true }).waitFor()

  // Mesmo sem dados, o tópico selecionado e seu título devem aparecer desde o carregamento.
  mode = 'pending'
  await page.goto(`${base}/loja?categoria=roteadores`)
  await page.getByRole('heading', { level: 1, name: 'Roteadores', exact: true }).waitFor()
  await page.getByText('Carregando produtos…', { exact: true }).waitFor()
  assert.deepEqual(await names(), [])
  mode = 'available'; releaseCatalog()
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  assert.deepEqual(await names(), ['Roteador TP-Link AX53'])
  assert.equal(await page.getByLabel('Categoria', { exact: true }).inputValue(), 'roteadores')
  await page.getByLabel('Marca', { exact: true }).selectOption('TP-Link')
  await page.getByLabel('Preço máximo', { exact: true }).selectOption('300')
  await unavailable()

  await menuLink('Switches de rede')
  await page.getByRole('link', { name: 'Switch de rede SG108', exact: true }).waitFor()
  assert.deepEqual(await names(), ['Switch de rede SG108'])
  assert.equal(await page.getByLabel('Marca', { exact: true }).inputValue(), 'todos')
  assert.equal(await page.getByLabel('Preço máximo', { exact: true }).inputValue(), 'todos')
  await page.getByLabel('Categoria', { exact: true }).selectOption('roteadores')
  await page.getByRole('heading', { level: 1, name: 'Roteadores', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('categoria'), 'roteadores')
  assert.deepEqual(await names(), ['Roteador TP-Link AX53'])

  // Todas as categorias vazias do menu continuam vazias, sem retornar o catálogo inteiro.
  for (const section of STORE_MENU_SECTIONS) {
    for (const [label, href] of section.links) {
      const category = new URL(href, base).searchParams.get('categoria')
      if (!category || ['roteadores', 'repetidores-wifi', 'switches-de-rede', 'cabos-adaptadores'].includes(category)) continue
      await menuLink(label)
      await page.getByRole('heading', { level: 1, name: label, exact: true }).waitFor()
      await unavailable()
      assert.deepEqual(await names(), [], `A categoria vazia ${category} não deve mostrar outros produtos`)
      assert.equal(await page.getByLabel('Categoria', { exact: true }).inputValue(), category)
    }
  }
  await menuLink('Roteadores')
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  await menuLink('E-readers')
  await unavailable()
  await page.reload()
  await unavailable()
  assert.equal(await page.getByLabel('Categoria', { exact: true }).inputValue(), 'e-readers')
  await menuLink('Roteadores')
  await page.goBack()
  await unavailable()
  await page.goForward()
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  assert.deepEqual(await names(), ['Roteador TP-Link AX53'])

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await menuLink('Rede, impressão e maker')
  await page.getByRole('heading', { level: 1, name: 'Rede, impressão e maker', exact: true }).waitFor()
  assert.deepEqual((await names()).sort(), catalog.slice(0, 3).map((item) => item.nome).sort())
  await page.waitForFunction(() => window.scrollY === 0)
  await menuLink('Impressoras e scanners')
  await unavailable()
  await page.locator('.store-empty').getByRole('button', { name: 'Limpar filtros' }).click()
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  assert.equal((await names()).length, catalog.length)
  await page.getByLabel('Pesquisar', { exact: true }).fill('inexistente')
  await unavailable()
  await page.locator('.store-empty').getByRole('button', { name: 'Limpar filtros' }).click()
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  assert.equal(new URL(page.url()).searchParams.has('busca'), false)
  assert.equal((await names()).length, catalog.length)

  mode = 'empty'
  await page.goto(`${base}/loja?categoria=roteadores`)
  await unavailable()
  assert.deepEqual(await names(), [])
  mode = 'error'
  await page.reload()
  await page.getByText('Não foi possível carregar produtos.', { exact: true }).waitFor()
  assert.equal(await page.locator('.store-empty').count(), 0, 'Erro de consulta deve permitir tentar novamente')
  mode = 'available'
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await page.getByRole('link', { name: 'Roteador TP-Link AX53', exact: true }).waitFor()
  assert.deepEqual(await names(), ['Roteador TP-Link AX53'])
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
  await page.unroute('**/api/**')
}
