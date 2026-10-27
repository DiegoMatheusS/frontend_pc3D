import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { verifyStoreTopics } from './store-topics-ui.mjs'

const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
const address = server.httpServer.address()
const base = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'] })
const name = 'PC Gamer Ryzen 5 5600G 16GB SSD 512GB'
const description = 'Ryzen 5 5600G, RAM 16 GB sem marca, SSD 512 GB. Acompanha teclado e mouse.\nGarantia de 12 meses.'
const original = 'https://shopee.com.br/product/123/456'
const offer = { parceiroNome: 'Shopee', parceiroId: 4, preco: 2399.9, urlOriginal: original, urlAfiliada: 'https://s.shopee.com.br/teste', vendedorNome: 'Loja PC', vendedorIdentificador: '123' }
const user = { id: 1, nome: 'Administrador QA', email: 'qa@example.test', papel: 'ADMIN' }
const oldTitle = 'Mouse Logitech G502 HERO foi desenvolvido para vencer. Conheça toda a história.'
const technicalDescription = 'Mouse Logitech G502 HERO\nDPI máximo: 25600\nPeso: 121 g\nWireless: Não'
let savedBodies = [], logged = true, failSave = true
let productWrites = 0
const errors = []
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 393, height: 852 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.setDefaultTimeout(25000)
    let parallelStarted = [], releaseFirst
    const firstSearch = new Promise(resolve => { releaseFirst = resolve })
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname, method = route.request().method()
      let body = [], status = 200
      if (path === '/api/auth/perfil') { body = logged ? user : { message: 'Sessão ausente' }; status = logged ? 200 : 401 }
      else if (path === '/api/auth/login') body = { requires2fa: true, desafio: 'challenge-qa-1234567890' }
      else if (path === '/api/auth/login-2fa') { logged = true; body = { usuario: user } }
      else if (path === '/api/auth/redefinir-senha') { assert.equal(route.request().postDataJSON().token, 'reset-token-qa-1234567890'); body = { mensagem: 'Senha redefinida. Entre novamente.' } }
      else if (/\/api\/admin\/busca-ofertas\/produto\/(201|202)\/encontrar-e-cadastrar/.test(path)) {
        const id = Number(path.split('/')[5]); parallelStarted.push(id)
        if (parallelStarted.length === 1) await firstSearch
        else releaseFirst()
        body = { quantidadeCadastrada: 0, quantidadeEncontrada: 0, ignoradas: [], fontes: {} }
      }
      else if (path === '/api/admin/produtos') body = [201,202].map(id=>({id,nome:`Mouse QA ${id}`,modelo:`M${id}`,marca:'QA',categoriaId:5,categoria:{nome:'Mouses',slug:'mouses'},ativo:true,publicado:true}))
      else if (path === '/api/admin/busca-ofertas/descobrir/status') body = { projetoIaConfigurado: true }
      else if (path === '/api/admin/busca-ofertas/descobrir') {
        const data = route.request().postDataJSON(); assert.ok(['MERCADO_LIVRE','MAGALU'].includes(data.loja))
        body = { itens: ['Placa de vídeo ASUS RTX 4060 8GB','Suporte para RTX 4060','ASUS RTX 4060 Ti 8GB'].map((nome,index)=>({nome,preco:1999.9,itemId:String(index),urlOriginal:data.loja === 'MERCADO_LIVRE' ? 'https://produto.mercadolivre.com.br/MLB-123456-rtx-4060' : 'https://www.magazineluiza.com.br/placa-rtx-4060/p/abcd1234/in/pcvd/',urlAfiliada:null})),avisos:[] }
      }
      else if (path === '/api/admin/busca-ofertas/shopee/status') body = { configurada: true }
      else if (path === '/api/admin/busca-ofertas/shopee/produtos') body = { itens: [{ nome: name, descricao: description, preco: 2399.9, urlOriginal: original, urlAfiliada: offer.urlAfiliada, itemId: '456', shopId: '123', loja: 'Loja PC' }] }
      else if (path === '/api/admin/ia/importar-link') body = { destinoSugerido: 'PC_MONTADO', categoriaDetectada: 'PC_MONTADO', normalizacao: { camposNormalizados: { nome: name, descricao: description } }, ofertaColetada: offer }
      else if (path === '/api/admin/builds/analisar-anuncio') body = { tipoSugerido: 'PC_MONTADO', componentesDetectados: [], descricaoOriginal: description }
      else if (path === '/api/admin/hardwares') { status = 503; body = { message: 'Catálogo de peças temporariamente indisponível' } }
      else if (path === '/api/admin/ofertas/parceiros') body = [{ id: 4, nome: 'Shopee', dominio: 'shopee.com.br', ativo: true }]
      else if (path === '/api/admin/categorias-produto') body = [{ id: 5, nome: 'Mouses', slug: 'mouses' }]
      else if (path === '/api/admin/produtos/101/buscar-especificacoes') body = { nomeTecnico: 'Mouse Logitech G502 HERO', descricaoTecnica: technicalDescription, especificacoes: { dpiMaximo: 25600, pesoGramas: 121, wireless: false }, camposPreenchidos: ['dpiMaximo', 'pesoGramas'], origemPorCampo: {} }
      else if (path === '/api/admin/produtos/101') {
        if (method !== 'GET') productWrites++
        body = { id: 101, categoriaId: 5, categoria: { id: 5, nome: 'Mouses', slug: 'mouses' }, nome: oldTitle, marca: 'Logitech', modelo: 'G502 HERO', descricao: 'História comercial do mouse.', metadados: {}, publicado: false, ativo: true }
      }
      else if (path === '/api/admin/builds' && method === 'POST') {
        const data = route.request().postDataJSON(); savedBodies.push(data)
        assert.equal(data.publicado, true); assert.equal(data.nome, name); assert.equal(data.descricao, description); assert.deepEqual(data.componentes, [])
        assert.equal(data.ofertas[0].preco, 2399.9); assert.equal(data.ofertas[0].urlAfiliada, offer.urlAfiliada)
        if (failSave) { failSave = false; status = 400; body = { message: 'Falha de teste: dados preservados para tentar novamente.' } }
        else { status = 201; body = { id: 10, produtoId: 101 } }
      } else if (path === '/api/admin/builds/10') body = { id: 10, produtoId: 101, nome: name, descricao: description, produto: { id: 101, ofertas: [{ id: 4, parceiroId: 4, ...offer }] }, componentes: [] }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, X-CriaByte-Account', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS' }, body: JSON.stringify(body) })
    })
    await page.goto(`${base}/admin/descobrir-ofertas`)
    await page.getByRole('searchbox').fill('pc gamer')
    await page.getByRole('button', { name: 'Pesquisar', exact: true }).click()
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
    await page.waitForURL('**/admin/montados/novo')
    await page.waitForFunction(expected => [...document.querySelectorAll('input')].some(input => input.value === expected), name)
    const save = page.getByRole('button', { name: 'Cadastrar e publicar conforme opção' })
    await page.getByLabel('Publicado', { exact: true }).check()
    await save.click()
    if (viewport.width === 1440) { await page.getByText('Falha de teste: dados preservados', { exact: false }).waitFor(); await save.click() }
    await page.waitForURL('**/admin/montados/10')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'Interface não pode exceder a largura da tela')
    await page.goto(`${base}/admin/produtos`)
    const firstRow = page.getByRole('row').filter({ hasText: 'Mouse QA 201' })
    const secondRow = page.getByRole('row').filter({ hasText: 'Mouse QA 202' })
    await firstRow.getByRole('button', {name:'Buscar em outras lojas',exact:true}).click()
    await firstRow.getByRole('button', {name:'Buscando lojas...',exact:true}).waitFor()
    assert.equal(await secondRow.getByRole('button', {name:'Buscar em outras lojas',exact:true}).isEnabled(),true)
    await secondRow.getByRole('button', {name:'Buscar em outras lojas',exact:true}).click()
    await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Resultado da busca em outras lojas"]').length===2)
    assert.deepEqual(parallelStarted.sort(),[201,202])
    await page.goto(`${base}/busca-ofertas`)
    await page.getByRole('button',{name:'Descobrir novas ofertas',exact:true}).click()
    for (const loja of ['MERCADO_LIVRE','MAGALU']) {
      await page.getByLabel('Loja da busca',{exact:true}).selectOption(loja)
      await page.getByRole('searchbox').fill('RTX 4060')
      await page.getByRole('button',{name:'Pesquisar',exact:true}).click()
      await page.getByRole('heading',{name:'Placa de vídeo ASUS RTX 4060 8GB',exact:true}).waitFor()
      assert.equal(await page.locator('.admin-discovery-card').count(),1)
      await page.getByLabel('Link afiliado de Placa de vídeo ASUS RTX 4060 8GB').fill('https://loja.example/affiliate-qa')
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2))
    }
    await page.goto(`${base}/admin/descobrir-ofertas`)
    assert.equal(await page.getByLabel('Loja da busca',{exact:true}).inputValue(),'MAGALU')
    await page.getByRole('heading',{name:'Placa de vídeo ASUS RTX 4060 8GB',exact:true}).waitFor()
    await page.goto(`${base}/admin/produtos/101`)
    const technicalName = page.getByLabel('Nome técnico', { exact: true })
    await technicalName.waitFor()
    assert.equal(await technicalName.inputValue(), oldTitle)
    await page.getByRole('button', { name: 'Limpar nome', exact: true }).click()
    assert.equal(await technicalName.inputValue(), 'Mouse Logitech G502 HERO')
    await page.getByRole('button', { name: 'Buscar especificações', exact: true }).click()
    await page.getByRole('button', { name: 'Aplicar descrição técnica', exact: true }).click()
    assert.equal(await page.getByLabel('Descrição', { exact: true }).inputValue(), technicalDescription)
    assert.equal(productWrites, 0, 'A prévia só modifica o formulário antes de salvar')
    await page.getByText('Alterações não salvas', { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
    if (viewport.width === 393) {
      for (const [pattern, path] of [
        ['https://cdnjs.cloudflare.com/**', 'build/three.min.js'],
        ['https://cdn.jsdelivr.net/**/OrbitControls.js', 'examples/js/controls/OrbitControls.js'],
        ['https://cdn.jsdelivr.net/**/GLTFLoader.js', 'examples/js/loaders/GLTFLoader.js'],
      ]) await context.route(pattern, async route => route.fulfill({ contentType: 'application/javascript', body: await readFile(new URL(`../node_modules/three/${path}`, import.meta.url), 'utf8') }))
      await page.goto(`${base}/montar`)
      await page.waitForFunction(() => globalThis.PCBuilderLegacyBridge?.obterDesempenho3D?.().quadros > 0)
      const metrics = await page.evaluate(() => globalThis.PCBuilderLegacyBridge.obterDesempenho3D())
      assert.equal(metrics.qualidade, 'baixa')
      console.log('3D em tela móvel:', JSON.stringify(metrics))
    }
    await verifyStoreTopics(page, base)
    console.log(`Loja: tópicos, categorias exatas, vazias, carregamento, histórico e falhas (${viewport.width}px): OK`)
    await context.close()
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  logged = false
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body = [], status = 200
    if (path === '/api/auth/perfil') { body = logged ? user : {}; status = logged ? 200 : 401 }
    if (path === '/api/auth/login') body = { requires2fa: true, desafio: 'challenge-qa-1234567890' }
    if (path === '/api/auth/login-2fa') { logged = true; body = { usuario: user } }
    if (path === '/api/auth/redefinir-senha') { assert.equal(route.request().postDataJSON().token, 'reset-token-qa-1234567890'); body = { mensagem: 'Senha redefinida. Entre novamente.' } }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, X-CriaByte-Account', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS' }, body: JSON.stringify(body) })
  })
  await page.goto(`${base}/entrar`)
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByPlaceholder('Digite sua senha').fill('TesteSeguro@2026')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.getByLabel('Código do autenticador ou de recuperação').fill('123456')
  assert.ok(page.url().endsWith('/entrar'), 'Primeiro fator não cria sessão')
  await page.getByRole('button', { name: 'Entrar na conta' }).click()
  await page.waitForURL('**/conta')
  await page.goto(`${base}/redefinir-senha#token=reset-token-qa-1234567890`)
  await page.getByLabel('Nova senha', { exact: true }).fill('SenhaNova@2026')
  await page.getByLabel('Repetir senha').fill('SenhaNova@2026')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await page.getByText('Senha redefinida. Entre novamente.', { exact: true }).waitFor()
  assert.equal(new URL(page.url()).hash, '')
  assert.deepEqual(errors, [])
  assert.equal(savedBodies.length, 3)
  console.log('Fluxos desktop/móvel, PC, buscas paralelas por produto, Mercado Livre/Magalu nas duas telas, ficha técnica e autenticação: OK')
  await context.close()
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
