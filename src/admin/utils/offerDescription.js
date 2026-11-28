import { getAiPayload, mergeAiImportPreview } from './aiImportContract.js'
import { limparDescricaoImportada } from './catalogContent.js'
import { missingSpec } from './productSpecifications.js'
import { mergeResearchGaps, researchEvidenceRows, technicalResearchFromPreview } from './technicalResearch.js'
import { isTechnicalAttribute } from '../../utils/technicalAttributes.js'

const text = (value) => typeof value === 'string' ? value.trim() : ''
const display = (value) => typeof value === 'boolean' ? (value ? 'Sim' : 'Não')
  : Array.isArray(value) ? value.join(', ') : String(value)

function technicalFields(payload, research, schema, listingPayload = {}) {
  if (!schema) return []
  const fieldName = (field) => String(field || '').split('.').at(-1)
  const conflicts = new Set((research?.conflitos || []).map((item) => fieldName(item.campo)))
  const declaredOrigins = new Set(Object.keys(research?.origemPorCampo || {}).map(fieldName))
  const evidence = new Map(researchEvidenceRows(research).map((row) => [fieldName(row.field), row]))
  return schema.fields.flatMap(([field, label]) => {
    const value = payload?.[schema.key]?.[field] ?? payload?.[field]
    if (missingSpec(value) || conflicts.has(field) || !isTechnicalAttribute(field, value)) return []
    if (typeof value === 'object' && (!Array.isArray(value) || value.some((item) => typeof item === 'object'))) return []
    if (display(value).length > 180 || limparDescricaoImportada(display(value)) !== display(value)) return []
    const row = evidence.get(field)
    if (row && JSON.stringify(value) === JSON.stringify(row.valor)) return [{ ...row, field, label, value }]
    if (declaredOrigins.has(field)) return []
    const listingValue = listingPayload?.[schema.key]?.[field] ?? listingPayload?.[field]
    return JSON.stringify(value) === JSON.stringify(listingValue) ? [{ field, label, value }] : []
  })
}

function researchFrom(preview) {
  const research = technicalResearchFromPreview(preview) || {}
  return {
    ...research,
    origemPorCampo: {
      ...preview?.resultadoProdutoIa?.origemPorCampo,
      ...preview?.origemPorCampo,
      ...research.origemPorCampo,
    },
  }
}

function mergeResearch(preview, found, schema) {
  const current = getAiPayload(preview)
  const payload = mergeResearchGaps(current, found.payload || {})
  payload[schema.key] = mergeResearchGaps(current[schema.key] || {}, found.payload?.[schema.key] || {})
  const previous = researchFrom(preview)
  const research = {
    ...previous, ...found,
    origemPorCampo: { ...previous.origemPorCampo, ...found.origemPorCampo },
    conflitos: [...(previous.conflitos || []), ...(found.conflitos || [])],
  }
  return mergeAiImportPreview(preview, {
    cadastroSugerido: { payload }, pesquisaTecnica: research,
    origemPorCampo: research.origemPorCampo,
  })
}

export async function completeOfferDescription(preview, {
  category, schemaFor, researchSpecifications, buildAnalysis, listingVerified = false,
}) {
  let completed = preview
  const schema = schemaFor(category)
  const initial = getAiPayload(preview)
  const listingPayload = listingVerified ? initial : {}
  const initialDescription = text(initial.descricao)
  const listingDescription = text(preview?.descricaoAnuncio) || text(preview?.resultadoProdutoIa?.descricaoAnuncio)
  const original = category === 'PC_MONTADO' && listingDescription ? listingDescription : initialDescription
  const cleaned = limparDescricaoImportada(original)
  const initialFields = technicalFields(initial, researchFrom(preview), schema, listingPayload)
  let researchError = ''
  if (schema && initialFields.length < 3 && (!cleaned || initialFields.length > 0 || cleaned !== original)
    && text(initial.nome) && researchSpecifications) {
    try {
      const identity = Object.fromEntries(['nome', 'marca', 'modelo', 'mpn', 'gtin']
        .filter((key) => text(initial[key])).map((key) => [key, initial[key]]))
      const found = await researchSpecifications({
        categoria: category, nome: initial.nome,
        payload: { ...identity, categoria: category, [schema.key]: {} },
      })
      if (found && typeof found.payload === 'object') completed = mergeResearch(completed, found, schema)
    } catch (cause) {
      researchError = text(cause?.message) || 'A pesquisa técnica não pôde ser concluída.'
    }
  }

  const payload = getAiPayload(completed)
  const groups = []
  if (schema) {
    const fields = technicalFields(payload, researchFrom(completed), schema, listingPayload)
    if (fields.length) groups.push({ category, title: payload.nome || schema.title, fields })
  }
  if (category === 'PC_MONTADO') {
    for (const component of buildAnalysis?.componentesDetectados || []) {
      const componentSchema = schemaFor(component.categoria)
      const componentPayload = component.cadastroHardwareSugerido || component.pesquisaTecnica?.payload
        || { [componentSchema?.key]: component.especificacoesConfirmadas }
      const fields = technicalFields(componentPayload, {
        ...component.pesquisaTecnica,
        origemPorCampo: component.origemPorCampo || component.pesquisaTecnica?.origemPorCampo,
      }, componentSchema)
      if (fields.length) groups.push({ category: component.categoria, title: component.nome || componentSchema.title, fields })
    }
  }

  const sections = cleaned && (category === 'PC_MONTADO' || !groups.length) ? [cleaned] : []
  const evidence = []
  for (const group of groups) {
    const fields = group.fields.slice(0, category === 'CELULAR' ? 4 : 8)
    const section = [group.title, ...fields.map((field) => `${field.label}: ${display(field.value)}`)].join('\n')
    if ([...sections, section].join('\n\n').length > 4900) continue
    sections.push(section)
    evidence.push(...fields.filter((field) => field.url).map((field) => ({ ...field, categoria: group.category })))
  }
  const sources = [...new Set(evidence.map((field) => field.url))]
  const description = sections.join('\n\n')
  if (description !== initialDescription || sources.length) {
    completed = {
      ...completed,
      descricaoParaCadastro: description,
      ...(sources.length && { descricaoPesquisa: { modo: 'RESUMO_TECNICO_CONFIRMADO', campos: evidence, fontes: sources } }),
    }
  }
  return {
    preview: completed,
    descriptionNotice: description && description !== original ? 'Descrição técnica preparada para revisão.' : '',
    descriptionWarning: description ? '' : [researchError, 'A pesquisa não confirmou dados suficientes para a descrição. Revise os dados do anúncio.'].filter(Boolean).join(' '),
  }
}
