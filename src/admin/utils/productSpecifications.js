import { publicSpecLabel, publicSpecValue } from '../../utils/productSpecPresentation.js'

export const PHONE_FIELDS = [
  ['processadorNome', 'Processador', 'text'], ['ramGb', 'Memória RAM (GB)', 'number'],
  ['armazenamentoGb', 'Armazenamento (GB)', 'number'], ['tamanhoTelaPolegadas', 'Tela (pol.)', 'number'],
  ['resolucao', 'Resolução', 'text'], ['taxaAtualizacaoHz', 'Taxa de atualização (Hz)', 'number'],
  ['tipoTela', 'Tipo de tela', 'text'], ['cameraPrincipalMp', 'Câmera principal (MP)', 'number'],
  ['cameraFrontalMp', 'Câmera frontal (MP)', 'number'], ['bateriaMah', 'Bateria (mAh)', 'number'],
  ['carregamentoWatts', 'Carregamento (W)', 'number'], ['cincoG', '5G', 'boolean'],
  ['nfc', 'NFC', 'boolean'], ['dualSim', 'Dual SIM', 'boolean'], ['esim', 'eSIM', 'boolean'],
  ['wifi', 'Wi-Fi', 'text'], ['bluetooth', 'Bluetooth', 'text'],
  ['sistemaOperacional', 'Sistema operacional', 'text'], ['pesoGramas', 'Peso (g)', 'number'],
  ['cor', 'Cor', 'text'], ['resistenciaAgua', 'Resistência à água', 'text'],
]

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
export const missingSpec = (value) => value === null || value === undefined ||
  (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)

export function mergeSpecificationGaps(current = {}, found = {}) {
  const next = { ...object(current) }
  for (const [key, value] of Object.entries(object(found))) {
    if (['__proto__', 'constructor', 'prototype', 'id', 'produtoId', 'hardwareId', 'criadoEm', 'atualizadoEm'].includes(key)) continue
    if (missingSpec(next[key]) && !missingSpec(value)) next[key] = value
  }
  return next
}

export function metadataSpecifications(metadata = {}) {
  return { ...object(metadata.especificacoesEncontradas), ...object(metadata.especificacoes) }
}

export function specificationDescription(specs, phone = false) {
  const entries = phone
    ? ['ramGb', 'armazenamentoGb', 'tamanhoTelaPolegadas', 'bateriaMah', 'processadorNome', 'cameraPrincipalMp', 'sistemaOperacional']
      .filter((key) => !missingSpec(specs?.[key])).slice(0, 4).map((key) => [key, specs[key]])
    : Object.entries(object(specs)).filter(([key, value]) => !missingSpec(value) &&
      !/^(?:id|produtoId|hardwareId|criadoEm|atualizadoEm|nome|descricao|origem|fontes|url|metodo|__proto__|constructor|prototype)$|pre[cç]o|price|frete|shipping|hist[oó]ria|history/i.test(key) &&
      (typeof value !== 'object' || (Array.isArray(value) && value.every(item => typeof item !== 'object'))) &&
      !/(?:conhe[cç]a|descubra|hist[oó]ria|melhor pre[cç]o|frete gr[aá]tis|foi desenvolvid[oa])/i.test(String(value)) &&
      String(value).length <= 180).slice(0, 12)
  return entries.map(([key, value]) => `${publicSpecLabel(key)}: ${publicSpecValue(key, value)}`).join(' · ')
}

export function buildSpecificationPrompt(product, schema, phone = false) {
  const fields = (schema?.fields || []).map(([key, , type]) => [key, type === 'boolean' ? 'boolean ou null' : type === 'number' ? 'número ou null' : 'texto ou null'])
  return `Pesquise a ficha do produto exato abaixo em fontes oficiais. Confira o modelo e a variante; não use dados de versões parecidas. Não invente: use null para o que não confirmar. Responda somente com um objeto JSON válido, sem Markdown.\n\nProduto: ${JSON.stringify({ nome: product.nome, marca: product.marca, modelo: product.modelo, mpn: product.mpn, gtin: product.gtin })}\n\nFormato: {"descricao":"descrição curta em português", "especificacoes":{}, "fontes":[{"url":"URL da fonte", "campos":["campo confirmado"]}]}\n${phone ? 'A descrição do celular deve destacar no máximo quatro especificações (prefira RAM, armazenamento, tela e bateria), em até duas frases. A ficha em especificacoes pode ser completa.' : 'A descrição deve destacar até cinco especificações, sem copiar a ficha inteira.'}\nUse NFC como true/false (não como texto) e bateria em mAh. Não inclua HTML, publicidade, preços ou links afiliados na descrição.\n${fields.length ? `Chaves e tipos de especificacoes: ${JSON.stringify(Object.fromEntries(fields))}` : 'Use nomes de campos claros e somente informações documentadas.'}`
}

export function parseSpecificationReply(text, schema) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/gi, '')
  let data
  try { data = JSON.parse(raw) } catch { throw new Error('JSON inválido. Cole o objeto completo retornado pelo Chat.') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('A resposta deve ser um objeto JSON.')
  const dangerous = (value) => value && typeof value === 'object' && Object.entries(value).some(([key, child]) => ['__proto__', 'constructor', 'prototype'].includes(key) || dangerous(child))
  if (dangerous(data)) throw new Error('O JSON contém uma chave não permitida.')
  const source = object(data.especificacoes || data.especificacoesEncontradas || data[schema?.key])
  const specs = schema ? Object.fromEntries(schema.fields.flatMap(([key, , type]) => {
    const value = source[key]
    if (missingSpec(value)) return []
    if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error(`O campo ${publicSpecLabel(key)} deve ser um número válido.`)
    if (type === 'boolean' && typeof value !== 'boolean') throw new Error(`O campo ${publicSpecLabel(key)} deve ser true ou false.`)
    if (['text', 'select', 'date', 'textarea'].includes(type) && typeof value !== 'string') throw new Error(`O campo ${publicSpecLabel(key)} deve ser texto.`)
    return [[key, value]]
  })) : mergeSpecificationGaps({}, source)
  return { data, especificacoes: specs, descricao: typeof data.descricao === 'string' ? data.descricao.trim().slice(0, 30000) : '' }
}
