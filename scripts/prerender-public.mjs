import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const text = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const safeUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' } }

export function renderProduct(template, product, site = 'https://criabyte.com.br') {
  const slug = String(product.slug || product.id || '')
  if (!slug || slug.length > 200 || /[\\/]|^\.{1,2}$/.test(slug)) throw new Error('Slug inválido')
  const name = text(product.nome)
  const description = text(product.descricao) || `Confira a ficha técnica e as ofertas de ${name} no CriaByte.`
  const canonical = `${site}/produto/${encodeURIComponent(slug)}`
  const image = safeUrl(product.imagemUrl)
  const offers = (product.ofertas || []).filter(offer => Number(offer.preco) > 0 && offer.status !== 'INDISPONIVEL')
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name, description, url: canonical,
    ...(image && { image }), ...(offers.length && { offers: offers.map(offer => ({ '@type': 'Offer', price: String(offer.preco), priceCurrency: 'BRL', url: safeUrl(offer.urlAfiliada || offer.urlOriginal) || canonical })) }) }
  const meta = `<title>${escapeHtml(name)} | CriaByte</title><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="product"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:title" content="${escapeHtml(name)} | CriaByte"><meta property="og:description" content="${escapeHtml(description.slice(0,300))}"><meta name="twitter:title" content="${escapeHtml(name)} | CriaByte"><meta name="twitter:description" content="${escapeHtml(description.slice(0,300))}">${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : ''}<script type="application/ld+json" data-criabyte-structured-data="true">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`
  const fields = product.especificacoes && typeof product.especificacoes === 'object' ? Object.entries(product.especificacoes).filter(([, value]) => ['string','number','boolean'].includes(typeof value)) : []
  const body = `<main class="page-container" aria-label="Produto"><a href="/loja">CriaByte · Loja</a><h1>${escapeHtml(name)}</h1>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="400" height="400">` : ''}<p>${escapeHtml(description)}</p><dl>${fields.map(([key,value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><a href="/montar">Montar meu PC</a></main>`
  return template.replace(/<meta[^>]+(?:property="og:(?:type|title|description|url|image)"|name="(?:description|twitter:(?:title|description|image))")[^>]*>/g, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<link\b[^>]*rel="canonical"[^>]*>/gi, '')
    .replace('</head>', `<meta name="description" content="${escapeHtml(description.slice(0,300))}">${meta}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

export async function prerender({ dist = resolve('dist'), api = process.env.VITE_API_BASE_URL || 'https://api.criabyte.com.br', request = fetch } = {}) {
  const template = await readFile(resolve(dist, 'index.html'), 'utf8')
  let count = 0
  const base = api.replace(/\/api\/?$/, '').replace(/\/$/, '')
  for (let page = 1; page <= 50; page++) {
    const response = await request(`${base}/api/produtos?pagina=${page}&limite=100`, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Catálogo HTTP ${response.status}`)
    const data = await response.json()
    const products = Array.isArray(data) ? data : data.dados || data.itens || data.produtos || []
    for (const product of products) {
      if (product.publicado === false || product.ativo === false) continue
      const html = renderProduct(template, product)
      const path = resolve(dist, 'produto', encodeURIComponent(String(product.slug || product.id)), 'index.html')
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, html)
      count++
    }
    if (page >= Number(data.totalPaginas || 1)) break
  }
  await writeFile(resolve(dist, 'prerender-report.json'), JSON.stringify({ produtos: count, geradoEm: new Date().toISOString() }))
  return count
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(`[pré-render] ${await prerender()} produtos exportados.`) }
  catch (error) { if (process.env.PRERENDER_REQUIRED === 'true') throw error; console.warn(`[pré-render] Catálogo indisponível: ${error.message}`) }
}
