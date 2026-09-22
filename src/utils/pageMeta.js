const SITE_ORIGIN = 'https://criabyte.com.br'

function absoluteUrl(value) {
  if (!value) return null
  try {
    return new URL(value, SITE_ORIGIN).href
  } catch {
    return null
  }
}

function setMeta(selector, attribute, attributeValue, content) {
  if (!content) return
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attribute, attributeValue)
    document.head.appendChild(node)
  }
  node.setAttribute('content', String(content))
}

function setCanonical(value) {
  const url = absoluteUrl(value)
  if (!url) return
  let node = document.head.querySelector('link[rel="canonical"]')
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', 'canonical')
    document.head.appendChild(node)
  }
  node.setAttribute('href', url)
}

function setStructuredData(data) {
  document.head.querySelectorAll('script[data-criabyte-structured-data="true"]').forEach((node) => node.remove())
  if (!data) return

  const values = Array.isArray(data) ? data.filter(Boolean) : [data]
  values.forEach((value) => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.criabyteStructuredData = 'true'
    script.textContent = JSON.stringify(value).replace(/</g, '\\u003c')
    document.head.appendChild(script)
  })
}

export function clearDocumentStructuredData() {
  document.head.querySelectorAll('script[data-criabyte-structured-data="true"]').forEach((node) => node.remove())
}

export function setDocumentMeta({
  title,
  description,
  canonical,
  image,
  type = 'website',
  robots = 'index,follow',
  structuredData,
}) {
  if (title) document.title = title

  if (description) {
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
  }

  if (title) {
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
  }

  const canonicalUrl = absoluteUrl(canonical || (typeof window !== 'undefined' ? window.location.pathname : '/'))
  if (canonicalUrl) {
    setCanonical(canonicalUrl)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
  }

  setMeta('meta[property="og:type"]', 'property', 'og:type', type)
  setMeta('meta[name="robots"]', 'name', 'robots', robots)
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', image ? 'summary_large_image' : 'summary')

  const absoluteImage = absoluteUrl(image)
  if (absoluteImage) {
    setMeta('meta[property="og:image"]', 'property', 'og:image', absoluteImage)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', absoluteImage)
  }

  setStructuredData(structuredData)

  return () => {
    clearDocumentStructuredData()
  }
}
