const specKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\W]+/g, ' ').toLowerCase();
const commercialSpec = new RegExp("avaliac|customer\\s*reviews?|^\\s*ratings?\\s*$|(?:customer|user)\\s*ratings?|review\\s*count|feedback|ranking|sales\\s*rank\\b|best\\s*seller|mais\\s*vendid|classificacao\\s*(?:dos|de)\\s*mais|parcel|installment|pagamento|payment|preco|price|frete|shipping|entrega|delivery|prazo|vendedor|seller|vendido\\s*por|loja\\b|estoque|stock|disponibilidade|availability|date\\s*first\\s*available|disponivel\\s*(?:para\\s*compra\\s*)?desde|devoluc|return\\s*policy|compras?\\s*no\\s*mes", 'i');
const scriptSpec = new RegExp("<\\s*(?:script|style)\\b|\\b(?:var|let|const)\\s+\\w+\\s*[=;]|\\bfunction\\s*\\(|=>\\s*\\{|\\b(?:window|document)\\s*[.\\[]|\\bP\\.when\\s*\\(|\\bue\\.count\\s*\\(", 'i');
export function isTechnicalAttribute(key, value) {
  if (!specKey(key).trim() || commercialSpec.test(specKey(key))) return false;
  if (Array.isArray(value)) return value.every(item => isTechnicalAttribute(key, item));
  if (value && typeof value === 'object') return Object.entries(value).every(([k, v]) => isTechnicalAttribute(k, v));
  return value !== null && value !== undefined && value !== '' && !scriptSpec.test(String(value));
}
