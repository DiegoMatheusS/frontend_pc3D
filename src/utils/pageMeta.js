export function setDocumentMeta({ title, description }) {
  if (title) document.title = title
  if (!description) return

  const selectors = [
    ['meta[name="description"]', 'name', 'description'],
    ['meta[property="og:description"]', 'property', 'og:description'],
  ]

  selectors.forEach(([selector, attr, value]) => {
    let node = document.head.querySelector(selector)
    if (!node) {
      node = document.createElement('meta')
      node.setAttribute(attr, value)
      document.head.appendChild(node)
    }
    node.setAttribute('content', description)
  })

  let ogTitle = document.head.querySelector('meta[property="og:title"]')
  if (!ogTitle) {
    ogTitle = document.createElement('meta')
    ogTitle.setAttribute('property', 'og:title')
    document.head.appendChild(ogTitle)
  }
  if (title) ogTitle.setAttribute('content', title)
}
