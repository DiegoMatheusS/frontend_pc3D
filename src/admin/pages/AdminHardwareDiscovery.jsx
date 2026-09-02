import { useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import { hardwareSchemaFor } from '../components/AdminTechnicalFields'
import { getAiPayload } from '../utils/aiImportContract'
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
  const payload = item?.payload || item?.payloadHardware || item?.hardware || item?.cadastroSugerido?.payload || {}
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
    nome: payload?.nome || item?.nome || item?.identidade?.nome || 'Hardware sem nome',
    marca: payload?.marca || item?.identidade?.marca || item?.marca || '',
    modelo: payload?.modelo || item?.identidade?.modelo || item?.modelo || '',
    mpn: payload?.mpn || item?.identidade?.mpn || item?.mpn || '',
    gtin: payload?.gtin || item?.identidade?.gtin || item?.gtin || '',
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

function sanitizePayload(payload) {
  const original = payload && typeof payload === 'object' ? payload : {}
  const copy = typeof structuredClone === 'function'
    ? structuredClone(original)
    : JSON.parse(JSON.stringify(original))

  // Reaproveita a mesma normalização já usada pela importação por URL (ex.: LGA 1151 -> LGA1151),
  // mas mantém somente o bloco oficial da ficha técnica para não enviar aliases como campos de topo.
  const categoria = String(copy?.categoria || '').toUpperCase()
  const schema = hardwareSchemaFor(categoria)
  if (schema) {
    const normalized = getAiPayload({ cadastroSugerido: { payload: copy } })
    if (normalized?.[schema.key] && typeof normalized[schema.key] === 'object') copy[schema.key] = normalized[schema.key]
  }

  function clean(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(clean)
      return
    }
    delete node.dataLancamento
    delete node.dataDeLancamento
    delete node.releaseDate
    delete node.preco
    delete node.precoAnterior
    delete node.oferta
    Object.values(node).forEach(clean)
  }
  clean(copy)
  return copy
}

function sourceName(item) {
  if (typeof item === 'string') return item
  return item?.nome || item?.name || item?.fonte || item?.provider || item?.id || ''
}

function sourceListFromResponse(payload) {
  const raw = payload?.fontes || payload?.itens || payload?.sources || payload?.dados || payload
  if (!raw) return []
  if (Array.isArray(raw)) return [...new Set(raw.map(sourceName).filter(Boolean))]
  if (typeof raw === 'object') return [...new Set(Object.entries(raw).filter(([, value]) => value !== false && value !== null).map(([key, value]) => sourceName(value) || key).filter(Boolean))]
  return []
}

function SpecValue({ row }) {
  if (Array.isArray(row.raw) && row.raw.some((item) => item && typeof item === 'object')) {
    return <div className="admin-discovery-repeater-list">{row.raw.map((item, index) => <div key={`${row.key}-${index}`} className="admin-discovery-repeater-item"><strong>{row.label} {index + 1}</strong><dl>{Object.entries(item || {}).filter(([, value]) => hasValue(value)).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{text(value)}</dd></div>)}</dl></div>)}</div>
  }
  return <span>{row.value}</span>
}

function HardwareCard({ item, index, selected, busy, onToggle, onOpen, onAdd }) {
  const payload = candidatePayload(item)
  const identity = candidateIdentity(item, payload)
  const { categoria, rows } = techDataFor(item)
  const quality = candidateQuality(item)
  const status = candidateStatus(item)
  const sources = listStrings(item?.fontes)
  const missing = listStrings(item?.camposObrigatoriosAusentes?.length ? item.camposObrigatoriosAusentes : item?.camposAusentes)
  const conflicts = Array.isArray(item?.conflitos) ? item.conflitos : []
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

      {(missing.length > 0 || conflicts.length > 0) && <div className="admin-discovery-alerts">
        {missing.length > 0 && <span>{missing.length} campo(s) ainda ausente(s)</span>}
        {conflicts.length > 0 && <span>{conflicts.length} conflito(s) para revisar</span>}
      </div>}

      <div className="admin-discovery-sources">
        <small>Fontes</small>
        <div>{sources.length ? sources.slice(0, 4).map((source) => <span key={source}>{source}</span>) : <span>Não informada</span>}{sources.length > 4 && <span>+{sources.length - 4}</span>}</div>
      </div>

      <div className="admin-discovery-card-actions">
        <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => onOpen(item)} disabled={busy}>Ver ficha completa</button>
        <button type="button" className="btn btn-primario btn-pequeno" onClick={() => onAdd(item, index)} disabled={busy}>{busy ? 'Adicionando...' : 'Adicionar'}</button>
      </div>
    </article>
  )
}

function HardwareDetailModal({ item, onClose, onAdd, onDetail, busy, detailing }) {
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
        <button type="button" className="btn btn-secundario" onClick={() => onDetail(item)} disabled={detailing || busy}>{detailing ? 'Atualizando ficha...' : 'Detalhar novamente com IA'}</button>
        <button type="button" className="btn btn-primario" onClick={() => onAdd(item)} disabled={busy || detailing}>{busy ? 'Adicionando...' : 'Adicionar Hardware'}</button>
      </footer>
    </section>
  </div>
}

export default function AdminHardwareDiscovery() {
  const toast = useAdminToast()
  const [categoria, setCategoria] = useState('PROCESSADOR')
  const [marca, setMarca] = useState('')
  const [consulta, setConsulta] = useState('')
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
  const [detailing, setDetailing] = useState(false)
  const [sources, setSources] = useState([])
  const [sessionAdded, setSessionAdded] = useState(0)

  useEffect(() => {
    let active = true
    adminService.hardwares.discoverySources()
      .then((payload) => { if (active) setSources(sourceListFromResponse(payload)) })
      .catch(() => { /* Fontes são informativas e não bloqueiam a página. */ })
    return () => { active = false }
  }, [])

  const items = useMemo(() => Array.isArray(result?.itens) ? result.itens : [], [result])
  const filteredItems = useMemo(() => items.filter((item) => !statusFilter || candidateStatus(item) === statusFilter), [items, statusFilter])
  const selectedItems = useMemo(() => items.filter((item, index) => selected.has(candidateId(item, index))), [items, selected])
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selected.has(candidateId(item, items.indexOf(item))))

  async function search(targetPage = 1) {
    setLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const payload = await adminService.hardwares.discover({
        categoria,
        ...(marca.trim() ? { marca: marca.trim() } : {}),
        ...(consulta.trim() ? { consulta: consulta.trim() } : {}),
        pagina: targetPage,
        limite: Number(limite),
        detalhar: true,
        enriquecer: true,
        noBrowser: false,
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
      const response = await adminService.hardwares.createDiscovered({ idTemporario: item?.idTemporario || key, payload: sanitizePayload(candidatePayload(item)) })
      const status = String(response?.status || response?.resultado || response?.situacao || '').toUpperCase()
      if (status === 'JA_EXISTE') toast.show('Este Hardware já estava cadastrado e foi removido da lista.', 'info')
      else toast.show('Hardware cadastrado com sucesso.')
      removeCandidates([key])
      if (status !== 'JA_EXISTE') setSessionAdded((value) => value + 1)
      if (detailItem && candidateId(detailItem) === key) setDetailItem(null)
    } catch (err) {
      toast.show(err?.message || 'Não foi possível cadastrar o Hardware.', 'erro')
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
        payload: sanitizePayload(candidatePayload(item)),
      }))
      const response = await adminService.hardwares.createDiscoveredBatch(sent)
      const results = Array.isArray(response?.resultados) ? response.resultados : Array.isArray(response?.results) ? response.results : []
      let successfulKeys = []
      if (results.length) {
        const successfulIds = new Set(results.filter((entry) => ['CRIADO', 'JA_EXISTE'].includes(String(entry?.status || entry?.resultado || '').toUpperCase())).map((entry) => String(entry?.idTemporario || entry?.id || '')))
        successfulKeys = selectedItems.map((item, index) => ({ item, key: candidateId(item, items.indexOf(item) >= 0 ? items.indexOf(item) : index) })).filter(({ item, key }) => successfulIds.has(String(item?.idTemporario || key))).map(({ key }) => key)
      } else if (Number(response?.erros || 0) === 0) {
        successfulKeys = selectedItems.map((item, index) => candidateId(item, items.indexOf(item) >= 0 ? items.indexOf(item) : index))
      }
      removeCandidates(successfulKeys)
      const created = Number(response?.criados)
      if (Number.isFinite(created)) setSessionAdded((value) => value + created)
      const message = `Lote concluído: ${Number(response?.criados || 0)} criado(s), ${Number(response?.jaExistiam || 0)} já existente(s), ${Number(response?.erros || 0)} erro(s).`
      toast.show(message, Number(response?.erros || 0) ? 'info' : undefined)
    } catch (err) {
      toast.show(err?.message || 'Não foi possível cadastrar o lote.', 'erro')
    } finally {
      setBatchBusy(false)
    }
  }

  async function detailAgain(item) {
    const payload = candidatePayload(item)
    const identity = candidateIdentity(item, payload)
    setDetailing(true)
    try {
      const response = await adminService.hardwares.discoverDetail({
        categoria: payload?.categoria || item?.categoria || categoria,
        nome: identity.nome,
        ...(item?.urlFontePrincipal ? { url: item.urlFontePrincipal } : {}),
        ...(item?.fontePrincipal ? { fonte: typeof item.fontePrincipal === 'string' ? item.fontePrincipal : sourceName(item.fontePrincipal) } : {}),
        ...(identity.marca ? { marca: identity.marca } : {}),
        enriquecer: true,
        noBrowser: false,
      })
      const detailed = response?.item || response?.candidato || response
      if (detailed && typeof detailed === 'object') {
        const oldKey = candidateId(item)
        const merged = { ...item, ...detailed, idTemporario: detailed.idTemporario || item.idTemporario }
        setResult((current) => current ? { ...current, itens: (current.itens || []).map((entry) => candidateId(entry) === oldKey ? merged : entry) } : current)
        setDetailItem(merged)
        toast.show('Ficha atualizada com os dados disponíveis.')
      }
    } catch (err) {
      toast.show(err?.message || 'Não foi possível detalhar novamente.', 'erro')
    } finally {
      setDetailing(false)
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
        <label className="admin-toolbar-field"><span>Categoria *</span><select className="admin-select" value={categoria} onChange={(event) => { setCategoria(event.target.value); setResult(null); setSelected(new Set()) }}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-toolbar-field"><span>Marca</span><input className="admin-input" value={marca} onChange={(event) => setMarca(event.target.value)} placeholder="Ex.: Intel, AMD, ASUS" /></label>
        <label className="admin-toolbar-field admin-discovery-query"><span>Busca</span><input className="admin-input" type="search" value={consulta} onChange={(event) => setConsulta(event.target.value)} placeholder="Ex.: Core i5, Ryzen 7, RTX 5070" onKeyDown={(event) => { if (event.key === 'Enter' && !loading) search(1) }} /></label>
        <label className="admin-toolbar-field"><span>Resultados por busca</span><select className="admin-select" value={limite} onChange={(event) => setLimite(Number(event.target.value))}><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></label>
      </div>
      <div className="admin-discovery-search-actions">
        <div className="admin-discovery-source-note">{sources.length ? <>Fontes disponíveis: <strong>{sources.slice(0, 5).join(', ')}</strong>{sources.length > 5 ? ` e mais ${sources.length - 5}` : ''}</> : <>A busca usa as fontes técnicas configuradas no Projeto IA.</>}</div>
        <button className="btn btn-primario" type="button" onClick={() => search(1)} disabled={loading}>{loading ? 'Buscando com IA...' : 'Buscar novos Hardwares'}</button>
      </div>
    </section>

    {error && <div className="admin-error-box admin-discovery-error"><strong>Não foi possível concluir a descoberta.</strong><span>{error}</span><button className="btn btn-secundario btn-pequeno" type="button" onClick={() => search(pagina)}>Tentar novamente</button></div>}

    {loading && <section className="admin-discovery-loading"><span className="route-loading__spinner" aria-hidden="true" /><div><strong>Procurando novos Hardwares...</strong><p>A IA está consultando e enriquecendo as fichas técnicas. Os modelos que já existem no CriaByte não serão mostrados.</p></div></section>}

    {result && !loading && <>
      <section className="admin-discovery-stats" aria-label="Resumo da descoberta">
        <article><span>Descobertos pela IA</span><strong>{totalFound}</strong></article>
        <article><span>Já cadastrados</span><strong>{alreadyRegistered}</strong><small>não exibidos</small></article>
        <article className="is-new"><span>Novos</span><strong>{newCount}</strong><small>exibidos abaixo</small></article>
        <article><span>Adicionados nesta sessão</span><strong>{sessionAdded}</strong></article>
      </section>

      {(duplicateCount > 0 || discardedCount > 0) && <div className="admin-discovery-diagnostics">{duplicateCount > 0 && <span>{duplicateCount} duplicata(s) removida(s) da própria busca.</span>}{discardedCount > 0 && <span>{discardedCount} resultado(s) inválido(s) descartado(s).</span>}</div>}

      <section className="admin-discovery-list-toolbar">
        <div className="admin-discovery-list-filters">
          <label className="admin-discovery-check-all"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} disabled={!filteredItems.length || batchBusy} /> <span>Selecionar exibidos</span></label>
          <label><span>Status da ficha</span><select className="admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="admin-discovery-batch-actions"><span>{selected.size} selecionado(s)</span><button type="button" className="btn btn-primario" disabled={!selectedItems.length || batchBusy} onClick={addBatch}>{batchBusy ? 'Adicionando...' : `Adicionar selecionados${selectedItems.length ? ` (${selectedItems.length})` : ''}`}</button></div>
      </section>

      {filteredItems.length ? <section className="admin-discovery-grid">{filteredItems.map((item) => {
        const originalIndex = items.indexOf(item)
        const key = candidateId(item, originalIndex)
        return <HardwareCard key={key} item={item} index={originalIndex} selected={selected.has(key)} busy={addingIds.has(key) || batchBusy} onToggle={toggle} onOpen={setDetailItem} onAdd={addOne} />
      })}</section> : <section className="admin-discovery-empty"><strong>Nenhum Hardware novo para exibir.</strong><p>{items.length ? 'Nenhum resultado corresponde ao filtro de status atual.' : 'Todos os modelos encontrados já estão cadastrados, foram descartados ou a IA não encontrou candidatos novos.'}</p></section>}

      <div className="admin-discovery-pagination">
        <button type="button" className="btn btn-secundario btn-pequeno" disabled={loading || pagina <= 1} onClick={() => search(Math.max(1, pagina - 1))}>← Página anterior</button>
        <span>Página {pagina}</span>
        <button type="button" className="btn btn-secundario btn-pequeno" disabled={loading || totalFound < limite} onClick={() => search(pagina + 1)}>Próxima página →</button>
      </div>
    </>}

    {!result && !loading && <section className="admin-discovery-intro">
      <span className="admin-discovery-intro-icon" aria-hidden="true">IA</span>
      <div><h2>Descubra o que ainda falta no catálogo</h2><p>Escolha uma categoria e faça a busca. A lista mostrará somente candidatos novos, com os dados que serão cadastrados em cada Hardware.</p><ul><li>Nenhum preço ou Oferta é criado nesta página.</li><li>Você pode revisar a ficha completa antes de adicionar.</li><li>O cadastro em lote valida cada Hardware individualmente.</li></ul></div>
    </section>}

    {detailItem && <HardwareDetailModal item={detailItem} onClose={() => setDetailItem(null)} onAdd={addOne} onDetail={detailAgain} busy={addingIds.has(candidateId(detailItem)) || batchBusy} detailing={detailing} />}
  </>
}
