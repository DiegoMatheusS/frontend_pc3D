import { mkdir, writeFile } from 'node:fs/promises'

const SITE_URL = 'https://criabyte.com.br'
const RAW_API = String(process.env.VITE_API_BASE_URL || 'https://api.criabyte.com.br').trim().replace(/\/+$/, '')
const API_URL = RAW_API.replace(/\/api$/i, '')
const output = new URL('../public/sitemap.xml', import.meta.url)

const staticPages = [
  ['/', 'daily', '1.0'],
  ['/loja', 'daily', '0.9'],
  ['/pecas', 'daily', '0.9'],
  ['/ofertas', 'daily', '0.9'],
  ['/notebooks', 'daily', '0.9'],
  ['/montados', 'daily', '0.9'],
  ['/comunidade', 'daily', '0.8'],
  ['/montar', 'weekly', '0.8'],
  ['/sobre', 'monthly', '0.5'],
  ['/contato', 'monthly', '0.5'],
  ['/privacidade', 'yearly', '0.3'],
  ['/termos', 'yearly', '0.3'],
  ['/cookies', 'yearly', '0.3'],
]

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function dateOnly(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10)
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload
  for (const key of ['produtos', 'items', 'itens', 'dados', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

async function loadProducts() {
  const first = await fetchJson(`${API_URL}/api/produtos?pagina=1&limite=100`)
  const products = [...extractProducts(first)]
  const totalPages = Math.min(50, Math.max(1, Number(first?.totalPaginas ?? first?.totalPages ?? 1) || 1))

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        fetchJson(`${API_URL}/api/produtos?pagina=${index + 2}&limite=100`).catch(() => null),
      ),
    )
    remaining.filter(Boolean).forEach((payload) => products.push(...extractProducts(payload)))
  }

  const seen = new Set()
  return products.filter((product) => {
    if (!product || product.ativo === false || product.publicado === false) return false
    const slug = String(product.slug || product.id || '').trim()
    if (!slug || seen.has(slug)) return false
    seen.add(slug)
    return true
  })
}

let products = []
try {
  products = await loadProducts()
  console.log(`[sitemap] ${products.length} produtos públicos adicionados.`)
} catch (error) {
  console.warn(`[sitemap] API indisponível; gerando sitemap apenas com páginas estáticas: ${error?.message || error}`)
}

const today = new Date().toISOString().slice(0, 10)
const entries = [
  ...staticPages.map(([path, changefreq, priority]) => ({
    loc: `${SITE_URL}${path}`,
    lastmod: today,
    changefreq,
    priority,
  })),
  ...products.map((product) => ({
    loc: `${SITE_URL}/produto/${encodeURIComponent(String(product.slug || product.id))}`,
    lastmod: dateOnly(product.atualizadoEm || product.updatedAt || product.criadoEm),
    changefreq: 'daily',
    priority: '0.8',
  })),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>
`

await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(output, xml, 'utf8')
