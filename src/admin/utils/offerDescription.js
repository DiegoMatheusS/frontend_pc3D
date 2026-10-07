import { getAiPayload, mergeAiImportPreview } from './aiImportContract.js'
import { mergeResearchGaps, researchEvidenceRows, technicalResearchFromPreview } from './technicalResearch.js'

const text = (value) => typeof value === 'string' ? value.trim() : ''
const display = (value) => typeof value === 'boolean' ? (value ? 'Sim' : 'Não')
  : Array.isArray(value) ? value.join(', ') : String(value)

function confirmedFields(payload, research, schema) {
  if (!schema) return []
  const labels = new Map(schema.fields.map(([field, label]) => [field, label]))
  const conflicts = new Set((research?.conflitos || []).map((item) => item.campo))
  return researchEvidenceRows(research).flatMap((row) => {
    const value = payload?.[schema.key]?.[row.field] ?? payload?.[row.field]
    if (!labels.has(row.field) || value === undefined || value === null
      || value === '' || (Array.isArray(value) && !value.length)) return []
    if (conflicts.has(row.field) || conflicts.has(`${schema.key}.${row.field}`)) return []
    if (JSON.stringify(value) !== JSON.stringify(row.valor)) return []
    if (typeof value === 'object' && (!Array.isArray(value) || value.some((item) => typeof item === 'object'))) return []
    return [{ ...row, label: labels.get(row.field), value }]
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

/** Recupera a ficha pelo nome da busca quando a loja não entrega a descrição.
 * O resumo só usa campos com evidência, valor correspondente e sem conflito.
 */
export async function completeOfferDescription(preview, {
  category, schemaFor, researchSpecifications, buildAnalysis,
}) {
  if (text(getAiPayload(preview).descricao)) return { preview, descriptionNotice: '', descriptionWarning: '' }
  let completed = preview
  const schema = schemaFor(category)
  let researchError = ''
  if (schema && !confirmedFields(getAiPayload(completed), researchFrom(completed), schema).length
    && text(getAiPayload(completed).nome) && researchSpecifications) {
    try {
      const payload = getAiPayload(completed)
      // A consulta precisa obter evidências mesmo para valores já presentes na
      // ficha. A ficha original só é mesclada depois, preservando os ajustes.
      const identity = Object.fromEntries(['nome', 'marca', 'modelo', 'mpn', 'gtin']
        .filter((key) => text(payload[key])).map((key) => [key, payload[key]]))
      const found = await researchSpecifications({
        categoria: category, nome: payload.nome,
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
    const fields = confirmedFields(payload, researchFrom(completed), schema)
    if (fields.length) groups.push({ category, title: payload.nome || schema.title, fields })
  }
  if (category === 'PC_MONTADO') {
    for (const component of buildAnalysis?.componentesDetectados || []) {
      const componentSchema = schemaFor(component.categoria)
      const componentPayload = component.cadastroHardwareSugerido || component.pesquisaTecnica?.payload
        || { [componentSchema?.key]: component.especificacoesConfirmadas }
      const fields = confirmedFields(componentPayload, {
        ...component.pesquisaTecnica,
        origemPorCampo: component.origemPorCampo || component.pesquisaTecnica?.origemPorCampo,
      }, componentSchema)
      if (fields.length) groups.push({ category: component.categoria, title: component.nome || componentSchema.title, fields })
    }
  }

  if (!groups.length) return {
    preview: completed, descriptionNotice: '',
    descriptionWarning: [researchError, 'A loja não retornou a descrição e a pesquisa não confirmou dados suficientes para montá-la. Os dados da busca foram preservados; revise a descrição antes de salvar.'].filter(Boolean).join(' '),
  }

  const sections = []
  const evidence = []
  const intro = [
    ...(category === 'PC_MONTADO' && text(payload.nome) ? [`Anúncio da loja: ${payload.nome}`] : []),
    'Informações técnicas confirmadas:',
  ].join('\n\n')
  for (const group of groups) {
    const fields = group.fields.slice(0, 12)
    const section = [group.title, ...fields.map((field) => `${field.label}: ${display(field.value)}`)].join('\n')
    // Limite de descrição: inclui somente seções e URLs completas.
    const urls = [...new Set([...evidence, ...fields].map((field) => field.url))]
    if ([intro, ...sections, section, `Fontes técnicas:\n${urls.join('\n')}`].join('\n\n').length > 4900) continue
    sections.push(section)
    evidence.push(...fields.map((field) => ({ ...field, categoria: group.category })))
  }
  if (!sections.length) return {
    preview: completed, descriptionNotice: '',
    descriptionWarning: 'Os dados técnicos foram preservados. Revise a descrição antes de salvar.',
  }
  const sources = [...new Set(evidence.map((field) => field.url))]
  const description = [intro, ...sections, `Fontes técnicas:\n${sources.join('\n')}`].join('\n\n')
  completed = mergeAiImportPreview(completed, {
    cadastroSugerido: { payload: { ...payload, descricao: description } },
    descricaoPesquisa: { modo: 'RESUMO_TECNICO_CONFIRMADO', campos: evidence, fontes: sources },
  })
  return {
    preview: completed,
    descriptionNotice: 'A loja não forneceu a descrição. Uma descrição técnica foi montada com dados confirmados e fontes; revise antes de salvar.',
    descriptionWarning: '',
  }
}
