import { useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { hardwareSchemaFor } from '../components/AdminTechnicalFields'
import { adminService } from '../services/adminService'

const CATEGORIES = [
  ['PROCESSADOR', 'Processadores'],
  ['PLACA_MAE', 'Placas-mãe'],
  ['MEMORIA_RAM', 'Memórias RAM'],
  ['PLACA_VIDEO', 'Placas de vídeo'],
  ['ARMAZENAMENTO', 'Armazenamento'],
  ['FONTE', 'Fontes'],
  ['GABINETE', 'Gabinetes'],
  ['COOLER', 'Coolers'],
  ['VENTOINHA', 'Ventoinhas'],
]

const STATUS_OPTIONS = [
  ['', 'Todos'],
  ['PRONTO', 'Prontos para cadastrar'],
  ['PRECISA_REVISAO', 'Precisam revisão'],
  ['FICHA_INCOMPLETA', 'Ficha incompleta'],
]

const STATUS_LABEL = {
  PRONTO: 'Pronto',
  PRECISA_REVISAO: 'Precisa revisão',
  FICHA_INCOMPLETA: 'Ficha incompleta',
}

const HIDDEN_TECH_KEYS = new Set(['dataLancamento'])
const FORBIDDEN_DISPLAY_TOKENS = ['preco', 'price', 'oferta']

function hasValue(value) {
  if (value === 0 || value === false) return true
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function text(value, fallback = '—') {
  if (value === 0) return '0'
  if (value === false) return 'Não'
  if (value === true) return 'Sim'
  if (!hasValue(value)) return fallback
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function humanize(key = '') {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function listStrings(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).filter(([, enabled]) => enabled !== false && enabled !== null).map(([key, item]) => typeof item === 'string' ? item : key)
      : value ? [value] : []
  return [...new Set(source.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item).trim()
    return String(item?.nome || item?.name || item?.fonte || item?.provider || item?.id || '').trim()
  }).filter(Boolean))]
}

function candidatePayload(item) {
  // Contrato final da Etapa 2: `payload` é o objeto oficial que o backend
  // devolve na descoberta e espera receber novamente no cadastro.
  // Aliases antigos ficam apenas como fallback visual para não quebrar uma resposta em cache.
  const payload = item?.payload || item?.payloadHardware || item?.hardware || {}
  return payload && typeof payload === 'object' ? payload : {}
}

function candidateId(item, index = 0) {
  return String(item?.idTemporario || item?.chaveComparacao || item?.identidade?.chave || `${candidatePayload(item)?.marca || 'hardware'}-${candidatePayload(item)?.modelo || candidatePayload(item)?.nome || index}`)
}

function normalizePercent(value) {
  let number = Number(value)
  if (!Number.isFinite(number) && value && typeof value === 'object') {
    number = Number(value.percentual ?? value.percent ?? value.valor ?? value.score)
  }
  if (!Number.isFinite(number)) return null
  if (number > 0 && number <= 1) number *= 100
  return Math.max(0, Math.min(100, Math.round(number)))
}

function candidateQuality(item) {
  return normalizePercent(item?.qualidade ?? item?.coberturaTecnica)
}

function candidateStatus(item) {
  const explicit = String(item?.statusFicha || '').toUpperCase()
  if (STATUS_LABEL[explicit]) return explicit
  const requiredMissing = listStrings(item?.camposObrigatoriosAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
  if (requiredMissing.length) return 'FICHA_INCOMPLETA'
  if (conflicts.length) return 'PRECISA_REVISAO'
  return 'PRONTO'
}

function candidateIdentity(item, payload) {
  return {
    nome: payload?.nome || item?.nome || 'Hardware sem nome',
    marca: payload?.marca || item?.marca || '',
    modelo: payload?.modelo || item?.modelo || '',
    mpn: payload?.mpn || item?.mpn || '',
    gtin: payload?.gtin || payload?.ean || item?.gtin || item?.ean || '',
  }
}

function fieldValue(type, value) {
  if (!hasValue(value)) return '—'
  if (type === 'boolean') return value === true ? 'Sim' : value === false ? 'Não' : text(value)
  if ((type === 'csv' || type === 'csvNumber' || type === 'multiSelect') && Array.isArray(value)) return value.join(', ')
  if (type === 'date') return String(value).slice(0, 10)
  return text(value)
}

function techDataFor(item) {
  const payload = candidatePayload(item)
  const categoria = String(payload?.categoria || item?.categoria || '').toUpperCase()
  const schema = hardwareSchemaFor(categoria)
  const spec = schema ? (payload?.[schema.key] || item?.especificacoesEncontradas || {}) : (item?.especificacoesEncontradas || {})
  const rows = []
  const covered = new Set()

  if (schema) {
    schema.fields.forEach(([key, label, type]) => {
      covered.add(key)
      if (HIDDEN_TECH_KEYS.has(key)) return
      const value = spec?.[key]
      if (hasValue(value)) rows.push({ key, label, value: fieldValue(type, value), raw: value })
    })
    ;(schema.repeaters || []).forEach((repeater) => {
      covered.add(repeater.key)
      const value = spec?.[repeater.key]
      if (hasValue(value)) rows.push({ key: repeater.key, label: repeater.title, value: text(value), raw: value, repeater })
    })
  }

  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    Object.entries(spec).forEach(([key, value]) => {
      const lower = key.toLowerCase()
      if (covered.has(key) || HIDDEN_TECH_KEYS.has(key) || FORBIDDEN_DISPLAY_TOKENS.some((token) => lower.includes(token)) || !hasValue(value)) return
      rows.push({ key, label: humanize(key), value: text(value), raw: value })
    })
  }

  return { categoria, schema, spec, rows }
}

function SpecValue({ row }) {
  if (Array.isArray(row.raw) && row.raw.some((item) => item && typeof item === 'object')) {
    return <div className="admin-discovery-repeater-list">{row.raw.map((item, index) => <div key={`${row.key}-${index}`} className="admin-discovery-repeater-item"><strong>{row.label} {index + 1}</strong><dl>{Object.entries(item || {}).filter(([, value]) => hasValue(value)).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{text(value)}</dd></div>)}</dl></div>)}</div>
  }
  return <span>{row.value}</span>
}

function HardwareCard({ item, index, selected, busy, itemError, onToggle, onOpen, onAdd }) {
  const payload = candidatePayload(item)
  const identity = candidateIdentity(item, payload)
  const { categoria, rows } = techDataFor(item)
  const quality = candidateQuality(item)
  const status = candidateStatus(item)
  const sources = listStrings(item?.fontes)
  const missing = listStrings(item?.camposObrigatoriosAusentes?.length ? item.camposObrigatoriosAusentes : item?.camposAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
  const warnings = listStrings(item?.avisos)
  const key = candidateId(item, index)

  return (
    <article className={`admin-discovery-card status-${status.toLowerCase().replaceAll('_', '-')}`}>
      <div className="admin-discovery-card-top">
        <label className="admin-discovery-select" title="Selecionar para cadastro em lote">
          <input type="checkbox" checked={selected} onChange={() => onToggle(key)} disabled={busy} />
          <span>Selecionar</span>
        </label>
        <span className={`admin-discovery-status admin-discovery-status--${status.toLowerCase().replaceAll('_', '-')}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="admin-discovery-card-title">
        <span className="admin-discovery-category-mark" aria-hidden="true">{categoria === 'PROCESSADOR' ? 'CPU' : categoria === 'PLACA_VIDEO' ? 'GPU' : categoria === 'PLACA_MAE' ? 'MB' : categoria === 'MEMORIA_RAM' ? 'RAM' : categoria === 'ARMAZENAMENTO' ? 'SSD' : categoria === 'FONTE' ? 'PSU' : categoria === 'GABINETE' ? 'CASE' : categoria === 'VENTOINHA' ? 'FAN' : 'HW'}</span>
        <div>
          <h2>{identity.nome}</h2>
          <p>{[identity.marca, identity.modelo].filter(Boolean).join(' · ') || categoria.replaceAll('_', ' ')}</p>
        </div>
      </div>

      {(identity.mpn || identity.gtin) && <div className="admin-discovery-identifiers">
        {identity.mpn && <span><small>MPN</small><strong>{identity.mpn}</strong></span>}
        {identity.gtin && <span><small>GTIN</small><strong>{identity.gtin}</strong></span>}
      </div>}

      <dl className="admin-discovery-spec-preview">
        {rows.slice(0, 7).map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{Array.isArray(row.raw) && row.raw.some((entry) => entry && typeof entry === 'object') ? `${row.raw.length} item(ns)` : row.value}</dd></div>)}
        {!rows.length && <div className="admin-discovery-no-spec"><dt>Ficha técnica</dt><dd>Dados técnicos ainda não encontrados.</dd></div>}
      </dl>

      <div className="admin-discovery-quality">
        <div><span>Cobertura da ficha</span><strong>{quality === null ? '—' : `${quality}%`}</strong></div>
        <div className="admin-discovery-quality-track" aria-hidden="true"><span style={{ width: `${quality ?? 0}%` }} /></div>
      </div>

      {(warnings.length > 0 || missing.length > 0 || conflicts.length > 0) && <div className="admin-discovery-alerts">
        {warnings.length > 0 && <span>{warnings.length} aviso(s)</span>}
        {missing.length > 0 && <span>{missing.length} campo(s) ainda ausente(s)</span>}
        {conflicts.length > 0 && <span>{conflicts.length} conflito(s) para revisar</span>}
      </div>}

      {itemError && <div className="admin-discovery-item-error" role="alert">{itemError}</div>}

      <div className="admin-discovery-sources">
        <small>Fontes</small>
        <div>{sources.length ? sources.slice(0, 4).map((source) => <span key={source}>{source}</span>) : <span>Não informada</span>}{sources.length > 4 && <span>+{sources.length - 4}</span>}</div>
      </div>

      <div className="admin-discovery-card-actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => onOpen(item)} disabled={busy}>Ver ficha completa</button>
        <button type="button" className="btn btn-primario btn-pequeno" onClick={() => onAdd(item, index)} disabled={busy}>{busy ? 'Cadastrando...' : 'Cadastrar'}</button>
      </div>
    </article>
  )
}

function HardwareDetailModal({ item, onClose, onAdd, busy }) {
  const payload = candidatePayload(item)
  const identity = candidateIdentity(item, payload)
  const { categoria, rows } = techDataFor(item)
  const sources = listStrings(item?.fontes)
  const missing = listStrings(item?.camposAusentes)
  const requiredMissing = listStrings(item?.camposObrigatoriosAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
  const warnings = listStrings(item?.avisos)
  const quality = candidateQuality(item)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return <div className="admin-discovery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="admin-discovery-modal" role="dialog" aria-modal="true" aria-labelledby="discovery-detail-title">
      <header className="admin-discovery-modal-head">
        <div><small>{categoria.replaceAll('_', ' ')}</small><h2 id="discovery-detail-title">{identity.nome}</h2><p>{[identity.marca, identity.modelo].filter(Boolean).join(' · ') || 'Ficha técnica encontrada pela IA'}</p></div>
        <button type="button" className="admin-discovery-modal-close" onClick={onClose} aria-label="Fechar">×</button>
      </header>

      <div className="admin-discovery-modal-body">
        <section className="admin-discovery-detail-summary">
          <div><span>Cobertura técnica</span><strong>{quality === null ? '—' : `${quality}%`}</strong></div>
          <div><span>Status</span><strong>{STATUS_LABEL[candidateStatus(item)]}</strong></div>
          <div><span>MPN</span><strong>{identity.mpn || '—'}</strong></div>
          <div><span>GTIN</span><strong>{identity.gtin || '—'}</strong></div>
        </section>

        {payload?.descricao && <section className="admin-discovery-detail-section"><h3>Descrição</h3><p className="admin-discovery-description">{payload.descricao}</p></section>}

        <section className="admin-discovery-detail-section">
          <h3>Ficha técnica completa</h3>
          {rows.length ? <dl className="admin-discovery-full-spec">{rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd><SpecValue row={row} /></dd></div>)}</dl> : <div className="admin-empty">Nenhuma especificação técnica estruturada foi retornada.</div>}
        </section>

        <section className="admin-discovery-detail-section admin-discovery-detail-columns">
          <div><h3>Fontes utilizadas</h3><div className="admin-discovery-chip-list">{sources.length ? sources.map((source) => <span key={source}>{source}</span>) : <span>Não informada</span>}</div>{item?.urlFontePrincipal && <a href={item.urlFontePrincipal} target="_blank" rel="noreferrer" className="admin-discovery-source-link">Abrir fonte principal</a>}</div>
          <div><h3>Campos ainda ausentes</h3><div className="admin-discovery-chip-list admin-discovery-chip-list--warning">{[...new Set([...requiredMissing, ...missing])].length ? [...new Set([...requiredMissing, ...missing])].map((field) => <span key={field}>{humanize(field)}</span>) : <span>Nenhum campo ausente informado</span>}</div></div>
        </section>

        {(warnings.length > 0 || conflicts.length > 0 || item?.erroDetalhamento) && <section className="admin-discovery-detail-section">
          <h3>Revisão</h3>
          <div className="admin-discovery-review-list">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            {conflicts.map((conflict, index) => <p key={`conflict-${index}`}>{typeof conflict === 'string' ? conflict : text(conflict)}</p>)}
            {item?.erroDetalhamento && <p>{text(item.erroDetalhamento)}</p>}
          </div>
        </section>}
      </div>

      <footer className="admin-discovery-modal-actions">
        <button type="button" className="btn btn-secundario" onClick={onClose}>Fechar</button>
        <button type="button" className="btn btn-primario" onClick={() => onAdd(item)} disabled={busy}>{busy ? 'Cadastrando...' : 'Cadastrar Hardware'}</button>
      </footer>
    </section>
  </div>
}

export default function AdminHardwareDiscovery() {
  const toast = useAdminToast()
  const [categoria, setCategoria] = useState('PROCESSADOR')
  const [marca, setMarca] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(50)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [addingIds, setAddingIds] = useState(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [batchErrors, setBatchErrors] = useState({})
  const [batchSummary, setBatchSummary] = useState(null)

  const items = useMemo(() => Array.isArray(result?.itens) ? result.itens : [], [result])
  const filteredItems = useMemo(() => items.filter((item) => !statusFilter || candidateStatus(item) === statusFilter), [items, statusFilter])
  const selectedItems = useMemo(() => items.filter((item, index) => selected.has(candidateId(item, index))), [items, selected])
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selected.has(candidateId(item, items.indexOf(item))))

  async function search(targetPage = 1) {
    setLoading(true)
    setError('')
    setSelected(new Set())
    setBatchErrors({})
    setBatchSummary(null)
    try {
      const payload = await adminService.hardwares.discover({
        categoria,
        ...(marca.trim() ? { marca: marca.trim() } : {}),
        pagina: targetPage,
        limite: Number(limite),
      })
      setResult(payload || { itens: [] })
      setPagina(Number(payload?.pagina) || targetPage)
      if (!Array.isArray(payload?.itens) || !payload.itens.length) toast.show('Nenhum Hardware novo encontrado para estes filtros.', 'info')
    } catch (err) {
      setError(err?.message || 'Não foi possível buscar novos Hardwares.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(key) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filteredItems.forEach((item) => next.delete(candidateId(item, items.indexOf(item))))
      else filteredItems.forEach((item) => next.add(candidateId(item, items.indexOf(item))))
      return next
    })
  }

  function removeCandidates(keys) {
    const remove = new Set(keys)
    setResult((current) => {
      if (!current) return current
      const nextItems = (current.itens || []).filter((item, index) => !remove.has(candidateId(item, index)))
      return { ...current, itens: nextItems, novos: Math.max(0, Number(current.novos ?? current.itens?.length ?? 0) - ((current.itens?.length || 0) - nextItems.length)) }
    })
    setSelected((current) => {
      const next = new Set(current)
      remove.forEach((key) => next.delete(key))
      return next
    })
  }

  async function addOne(item, index = items.indexOf(item)) {
    const key = candidateId(item, index)
    setAddingIds((current) => new Set(current).add(key))
    try {
      const response = await adminService.hardwares.createDiscovered({
        idTemporario: item?.idTemporario || key,
        payload: candidatePayload(item),
      })
      const status = String(response?.status || response?.resultado || '').toUpperCase()
      if (status === 'JA_EXISTE') {
        toast.show('Este Hardware já havia sido cadastrado e foi removido da lista.', 'info')
        removeCandidates([key])
      } else if (status === 'CRIADO') {
        toast.show('Hardware cadastrado com sucesso.')
        removeCandidates([key])
      } else {
        throw new Error(response?.mensagem || response?.message || 'O backend retornou um status de cadastro inesperado.')
      }
      setBatchErrors((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
      if (detailItem && candidateId(detailItem) === key) setDetailItem(null)
    } catch (err) {
      const message = err?.message || 'Não foi possível cadastrar o Hardware.'
      setBatchErrors((current) => ({ ...current, [key]: message }))
      toast.show(message, 'erro')
    } finally {
      setAddingIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function addBatch() {
    if (!selectedItems.length) return
    if (!window.confirm(`Cadastrar ${selectedItems.length} Hardware(s) selecionado(s)?`)) return
    setBatchBusy(true)
    try {
      const sent = selectedItems.map((item, index) => ({
        idTemporario: item?.idTemporario || candidateId(item, index),
        payload: candidatePayload(item),
      }))
      const response = await adminService.hardwares.createDiscoveredBatch(sent)
      const results = Array.isArray(response?.resultados) ? response.resultados : []
      const selectedByTemporaryId = new Map(selectedItems.map((item, index) => {
        const key = candidateId(item, items.indexOf(item) >= 0 ? items.indexOf(item) : index)
        return [String(item?.idTemporario || key), key]
      }))
      const successfulKeys = []
      const itemErrors = {}

      results.forEach((entry) => {
        const temporaryId = String(entry?.idTemporario || '')
        const key = selectedByTemporaryId.get(temporaryId)
        if (!key) return
        const status = String(entry?.status || entry?.resultado || '').toUpperCase()
        if (status === 'CRIADO' || status === 'JA_EXISTE') {
          successfulKeys.push(key)
          return
        }
        if (status === 'ERRO') {
          itemErrors[key] = entry?.mensagem || entry?.message || (entry?.erro ? text(entry.erro) : '') || 'Erro ao cadastrar este Hardware.'
        }
      })

      removeCandidates(successfulKeys)
      setBatchErrors((current) => {
        const next = { ...current }
        successfulKeys.forEach((key) => delete next[key])
        Object.assign(next, itemErrors)
        return next
      })

      const summary = {
        totalSolicitado: Number(response?.totalSolicitado ?? selectedItems.length),
        criados: Number(response?.criados || 0),
        jaExistiam: Number(response?.jaExistiam || 0),
        erros: Number(response?.erros || 0),
      }
      setBatchSummary(summary)
      const message = `Lote concluído: ${summary.criados} criado(s), ${summary.jaExistiam} já existente(s), ${summary.erros} erro(s).`
      toast.show(message, summary.erros ? 'info' : undefined)
    } catch (err) {
      toast.show(err?.message || 'Não foi possível cadastrar o lote.', 'erro')
    } finally {
      setBatchBusy(false)
    }
  }

  const totalFound = Number(result?.totalEncontrados ?? 0)
  const alreadyRegistered = Number(result?.jaCadastrados ?? 0)
  const newCount = Number(result?.novos ?? items.length)
  const duplicateCount = Number(result?.duplicadosNaBusca ?? 0)
  const discardedCount = Number(result?.descartadosInvalidos ?? 0)

  return <>
    <AdminPageHeader title="Descobrir Hardwares com IA" description="Encontre novos modelos em fontes técnicas. O backend remove os Hardwares que já existem e você decide quais deseja cadastrar." />

    <section className="admin-discovery-search-card">
      <div className="admin-discovery-search-grid">
        <label className="admin-toolbar-field"><span>Categoria *</span><select className="admin-select" value={categoria} onChange={(event) => { setCategoria(event.target.value); setPagina(1); setResult(null); setSelected(new Set()); setBatchErrors({}); setBatchSummary(null) }}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-toolbar-field"><span>Marca</span><input className="admin-input" value={marca} onChange={(event) => setMarca(event.target.value)} placeholder="Ex.: Intel, AMD, ASUS" /></label>
        <label className="admin-toolbar-field"><span>Limite</span><select className="admin-select" value={limite} onChange={(event) => setLimite(Number(event.target.value))}><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></label>
        <label className="admin-toolbar-field"><span>Página</span><input className="admin-input" type="number" min="1" step="1" value={pagina} onChange={(event) => setPagina(Math.max(1, Number(event.target.value) || 1))} /></label>
      </div>
      <div className="admin-discovery-search-actions">
        <div className="admin-discovery-source-note">O navegador chama somente o backend do CriaByte. A consulta às fontes técnicas e a deduplicação são feitas no servidor.</div>
        <button className="btn btn-primario" type="button" onClick={() => search(pagina)} disabled={loading}>{loading ? 'Buscando com IA...' : 'Descobrir Hardwares'}</button>
      </div>
    </section>

    {error && <div className="admin-error-box admin-discovery-error"><strong>Não foi possível concluir a descoberta.</strong><span>{error}</span><button className="btn btn-secundario btn-pequeno" type="button" onClick={() => search(pagina)}>Tentar novamente</button></div>}

    {loading && <section className="admin-discovery-loading"><span className="route-loading__spinner" aria-hidden="true" /><div><strong>Procurando novos Hardwares...</strong><p>A IA está consultando e enriquecendo as fichas técnicas. Os modelos que já existem no CriaByte não serão mostrados.</p></div></section>}

    {result && !loading && <>
      <section className="admin-discovery-stats" aria-label="Resumo da descoberta">
        <article><span>Encontrados</span><strong>{totalFound}</strong></article>
        <article><span>Já cadastrados</span><strong>{alreadyRegistered}</strong><small>não exibidos</small></article>
        <article><span>Duplicados na busca</span><strong>{duplicateCount}</strong></article>
        <article><span>Descartados inválidos</span><strong>{discardedCount}</strong></article>
        <article className="is-new"><span>Novos</span><strong>{newCount}</strong><small>exibidos abaixo</small></article>
      </section>

      {(duplicateCount > 0 || discardedCount > 0) && <div className="admin-discovery-diagnostics">{duplicateCount > 0 && <span>{duplicateCount} duplicata(s) removida(s) da própria busca.</span>}{discardedCount > 0 && <span>{discardedCount} resultado(s) inválido(s) descartado(s).</span>}</div>}

      {batchSummary && <section className={`admin-discovery-batch-summary ${batchSummary.erros ? 'has-errors' : ''}`} aria-label="Resumo do cadastro em lote"><strong>Último lote</strong><span>Solicitados: {batchSummary.totalSolicitado}</span><span>Criados: {batchSummary.criados}</span><span>Já existiam: {batchSummary.jaExistiam}</span><span>Erros: {batchSummary.erros}</span></section>}

      <section className="admin-discovery-list-toolbar">
        <div className="admin-discovery-list-filters">
          <label className="admin-discovery-check-all"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} disabled={!filteredItems.length || batchBusy} /> <span>Selecionar exibidos</span></label>
          <label><span>Status da ficha</span><select className="admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="admin-discovery-batch-actions"><span>{selected.size} selecionado(s)</span><button type="button" className="btn btn-primario" disabled={!selectedItems.length || batchBusy} onClick={addBatch}>{batchBusy ? 'Cadastrando...' : `Cadastrar selecionados${selectedItems.length ? ` (${selectedItems.length})` : ''}`}</button></div>
      </section>

      {filteredItems.length ? <section className="admin-discovery-grid">{filteredItems.map((item) => {
        const originalIndex = items.indexOf(item)
        const key = candidateId(item, originalIndex)
        return <HardwareCard key={key} item={item} index={originalIndex} selected={selected.has(key)} busy={addingIds.has(key) || batchBusy} itemError={batchErrors[key] || ''} onToggle={toggle} onOpen={setDetailItem} onAdd={addOne} />
      })}</section> : <section className="admin-discovery-empty"><strong>Nenhum Hardware novo para exibir.</strong><p>{items.length ? 'Nenhum resultado corresponde ao filtro de status atual.' : 'Todos os modelos encontrados já estão cadastrados, foram descartados ou a IA não encontrou candidatos novos.'}</p></section>}

      <div className="admin-discovery-pagination">
        <button type="button" className="btn btn-secundario btn-pequeno" disabled={loading || pagina <= 1} onClick={() => search(Math.max(1, pagina - 1))}>← Página anterior</button>
        <span>Página {pagina}</span>
        <button type="button" className="btn btn-secundario btn-pequeno" disabled={loading || totalFound < limite} onClick={() => search(pagina + 1)}>Próxima página →</button>
      </div>
    </>}

    {!result && !loading && <section className="admin-discovery-intro">
      <span className="admin-discovery-intro-icon" aria-hidden="true">IA</span>
      <div><h2>Descubra o que ainda falta no catálogo</h2><p>Escolha uma categoria, informe a marca se quiser reduzir o escopo e faça a busca. O backend devolve somente candidatos novos.</p><ul><li>Nenhum Produto, Oferta ou preço é criado nesta página.</li><li>Você pode revisar a ficha completa antes de cadastrar.</li><li>O cadastro em lote valida cada Hardware individualmente.</li></ul></div>
    </section>}

    {detailItem && <HardwareDetailModal item={detailItem} onClose={() => setDetailItem(null)} onAdd={addOne} busy={addingIds.has(candidateId(detailItem)) || batchBusy} />}
  </>
}
