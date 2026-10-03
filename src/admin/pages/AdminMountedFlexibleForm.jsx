import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { apiRequest } from '../../services/httpClient'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'
import AdminMultiOfferEditor from '../components/AdminMultiOfferEditor'
import { aiImportOfferRow, emptyOfferRow, normalizeOfferRow } from '../components/AdminMultiOfferEditor.utils'
import { clearAiImportPreview, readAiImportPreview } from '../utils/aiImportTransfer'
import { getAiOffer, getAiPayload } from '../utils/aiImportContract'

const EMPTY = {
  nome: '', marca: '', modelo: '', descricao: '', categoria: 'PC_MONTADO',
  finalidade: '', resolucaoRecomendada: '', imagemUrl: '', imagemHoverUrl: '',
  configuracao3D: '{}', publicado: false, ativo: true,
}
const CATEGORIAS_VINCULAVEIS = new Set([
  'PROCESSADOR', 'PLACA_MAE', 'MEMORIA_RAM', 'PLACA_VIDEO', 'ARMAZENAMENTO',
  'FONTE', 'GABINETE', 'COOLER', 'VENTOINHA',
])
const LABELS = {
  PROCESSADOR: 'Processador', PLACA_MAE: 'Placa-mãe', MEMORIA_RAM: 'Memória RAM',
  PLACA_VIDEO: 'Placa de vídeo', ARMAZENAMENTO: 'Armazenamento', FONTE: 'Fonte',
  GABINETE: 'Gabinete', COOLER: 'Cooler', VENTOINHA: 'Ventoinha',
}
const clean = (value) => String(value ?? '').trim()
const typeFromCategory = (value) => /KIT[_ -]?UPGRADE/i.test(clean(value)) ? 'KIT_UPGRADE' : 'PC_MONTADO'
const normalize = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const asComponents = (list) => Array.isArray(list) ? list.filter((item) => Number(item?.hardwareId ?? item?.hardware?.id) > 0).map((item, index) => ({
  hardwareId: Number(item.hardwareId ?? item.hardware.id),
  categoria: clean(item.categoria ?? item.hardware?.categoria).toUpperCase(),
  quantidade: Math.max(1, Number(item.quantidade) || 1),
  ...(clean(item.posicao) ? { posicao: clean(item.posicao) } : {}),
  ordem: Number.isInteger(Number(item.ordem)) ? Number(item.ordem) : index,
})).filter((item) => CATEGORIAS_VINCULAVEIS.has(item.categoria)) : []

function offerPayload(row, produtoId) {
  const preco = Number(row.preco)
  const parceiroId = Number(row.parceiroId)
  if (!Number.isInteger(parceiroId) || parceiroId < 1) throw new Error('Selecione o parceiro da oferta.')
  if (!Number.isFinite(preco) || preco <= 0) throw new Error('Informe um preço válido para a oferta.')
  if (!clean(row.urlOriginal)) throw new Error('Informe a URL original da oferta.')
  const precoAnterior = clean(row.precoAnterior) ? Number(row.precoAnterior) : null
  const frete = clean(row.frete) ? Number(row.frete) : null
  if (precoAnterior !== null && !(precoAnterior > 0)) throw new Error('Revise o preço anterior.')
  if (frete !== null && !(frete >= 0)) throw new Error('Revise o frete.')
  return {
    produtoId: Number(produtoId), parceiroId, preco, precoAnterior, frete,
    urlOriginal: clean(row.urlOriginal), urlAfiliada: clean(row.urlAfiliada) || null,
    vendedorNome: clean(row.vendedorNome) || null,
    vendedorIdentificador: clean(row.vendedorIdentificador) || null,
    validoAte: row.validoAte && !Number.isNaN(Date.parse(row.validoAte))
      ? new Date(row.validoAte).toISOString() : null,
  }
}

export default function AdminMountedFlexibleForm() {
  const { id } = useParams()
  const editing = Boolean(id && id !== 'novo')
  const navigate = useNavigate()
  const toast = useAdminToast()
  const { user } = useAuth()
  const canImport = String(user?.papel || '').toUpperCase() === 'ADMIN'
  const [form, setForm] = useState(EMPTY)
  const [componentes, setComponentes] = useState([])
  const [hardwares, setHardwares] = useState([])
  const [partners, setPartners] = useState([])
  const [offerRows, setOfferRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('TODOS')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisWarning, setAnalysisWarning] = useState('')
  const [transferredPreview] = useState(() => editing ? null : readAiImportPreview('PC_MONTADO'))
  const [transferredApplied, setTransferredApplied] = useState(false)

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))

  useEffect(() => {
    let alive = true
    Promise.all([
      adminService.hardwares.listForBuild().catch(() => []),
      adminService.offers.partners().catch(() => []),
      editing ? adminService.builds.get(id) : Promise.resolve(null),
    ]).then(([hardwareList, partnerList, existing]) => {
      if (!alive) return
      setHardwares(Array.isArray(hardwareList) ? hardwareList.filter((item) => item.ativo !== false) : [])
      setPartners(Array.isArray(partnerList) ? partnerList : [])
      if (existing) {
        setForm({
          ...EMPTY,
          nome: clean(existing.nome), marca: clean(existing.marca), modelo: clean(existing.modelo),
          descricao: clean(existing.descricao), categoria: clean(existing.categoria) || 'PC_MONTADO',
          finalidade: clean(existing.finalidade), resolucaoRecomendada: clean(existing.resolucaoRecomendada),
          imagemUrl: clean(existing.imagemUrl), imagemHoverUrl: clean(existing.imagemHoverUrl),
          configuracao3D: JSON.stringify(existing.configuracao3D || {}, null, 2),
          publicado: Boolean(existing.publicado), ativo: existing.ativo !== false,
        })
        setComponentes(asComponents(existing.componentes))
        setOfferRows(Array.isArray(existing?.produto?.ofertas) ? existing.produto.ofertas.map(normalizeOfferRow) : [])
      }
    }).catch((cause) => alive && setError(cause))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [editing, id])

  const hardwareById = useMemo(() => new Map(hardwares.map((item) => [Number(item.id), item])), [hardwares])
  const searchResults = useMemo(() => hardwares.filter((item) => CATEGORIAS_VINCULAVEIS.has(item.categoria))
    .filter((item) => categoryFilter === 'TODOS' || item.categoria === categoryFilter)
    .filter((item) => !clean(search) || normalize(`${item.nome} ${item.marca} ${item.modelo} ${item.id}`).includes(normalize(search)))
    .slice(0, 25), [hardwares, search, categoryFilter])

  function linkHardware(item) {
    const hardwareId = Number(item.hardwareId ?? item.id)
    const categoria = clean(item.categoria).toUpperCase()
    if (!Number.isInteger(hardwareId) || hardwareId < 1 || !CATEGORIAS_VINCULAVEIS.has(categoria)) return
    setComponentes((previous) => previous.some((part) => part.hardwareId === hardwareId)
      ? previous : [...previous, { hardwareId, categoria, quantidade: 1, ordem: previous.length }])
    setSearch('')
  }

  async function analyzeDescription(title = form.nome, description = form.descricao) {
    if (!clean(title) && !clean(description)) return
    setAnalyzing(true)
    setAnalysisWarning('')
    try {
      const result = await apiRequest('/api/admin/builds/analisar-anuncio', {
        method: 'POST', body: { titulo: title, descricao: description },
      })
      setAnalysis(result)
      if (result?.tipoSugerido === 'KIT_UPGRADE') update('categoria', 'KIT_UPGRADE')
      if (result?.tipoSugerido === 'PC_MONTADO' && !clean(form.categoria)) update('categoria', 'PC_MONTADO')
      if (result?.confirmacaoObrigatoria) setAnalysisWarning('A classificação é uma sugestão. Confirme se o anúncio é PC montado ou kit de upgrade.')
      if (result?.tipoSugerido === 'HARDWARE_INDIVIDUAL') setAnalysisWarning('A descrição parece conter apenas um hardware individual. Confira a categoria antes de cadastrar.')
      return result
    } catch (cause) {
      setAnalysisWarning(cause?.message || 'O ProjetoIA não conseguiu analisar a descrição; o cadastro manual continua disponível.')
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  async function applyImportPreview(preview, url) {
    const source = getAiPayload(preview) || {}
    const capturedDescription = [
      preview?.coleta?.descricao, preview?.coleta?.description,
      preview?.coleta?.meta?.description, source.descricao,
    ].find((value) => typeof value === 'string' && value.trim()) || ''
    const name = clean(source.nome || preview?.coleta?.titulo || preview?.coleta?.meta?.title)
    const description = clean(capturedDescription)
    setForm((previous) => ({
      ...previous,
      nome: name || previous.nome,
      marca: clean(source.marca) || previous.marca,
      modelo: clean(source.modelo) || previous.modelo,
      descricao: description || previous.descricao,
      imagemUrl: clean(source.imagemUrl || preview?.coleta?.meta?.['og:image']) || previous.imagemUrl,
      imagemHoverUrl: clean(source.imagemHoverUrl) || previous.imagemHoverUrl,
      finalidade: clean(source.finalidade) || previous.finalidade,
      categoria: clean(source.categoria) || previous.categoria,
      resolucaoRecomendada: clean(source.resolucaoRecomendada || source.resolucao) || previous.resolucaoRecomendada,
    }))
    const offer = getAiOffer(preview) || {}
    const originalUrl = clean(offer.urlOriginal || url || preview?.urlOrigem || preview?.urlFinal)
    if (originalUrl) {
      setOfferRows((previous) => previous.some((row) => clean(row.urlOriginal) === originalUrl)
        ? previous
        : [...previous, aiImportOfferRow({ ...offer, urlOriginal: originalUrl }, partners)])
    }
    // Não confiar em hardwareId gerado pela IA no payload; sempre consultar
    // a descrição e o catálogo atual e pedir confirmação de cada vínculo.
    await analyzeDescription(name || form.nome, description || form.descricao)
  }

  useEffect(() => {
    if (editing || loading || transferredApplied || !transferredPreview) return
    const url = clean(transferredPreview?.urlOrigem || transferredPreview?.urlFinal)
    setImportUrl(url)
    setTransferredApplied(true)
    void applyImportPreview(transferredPreview, url)
    clearAiImportPreview(transferredPreview)
  }, [editing, loading, transferredApplied, transferredPreview])

  async function importLink() {
    const url = clean(importUrl)
    if (!canImport || !url) return
    setImporting(true)
    setAnalysis(null)
    try {
      const result = await adminService.ai.importLink(url, 'PC_MONTADO')
      await applyImportPreview(result, url)
      toast.show('Anúncio importado. Revise a classificação, a descrição e cada vínculo antes de salvar.')
    } catch (cause) {
      setAnalysisWarning(cause?.message || 'Não foi possível importar o anúncio. Preencha manualmente.')
    } finally {
      setImporting(false)
    }
  }

  function updateOffer(index, key, value) {
    setOfferRows((rows) => rows.map((row, at) => at === index ? { ...row, [key]: value } : row))
  }

  async function saveOffers(produtoId) {
    for (const row of offerRows) {
      if (row._removed) {
        if (row.id) await adminService.offers.setStatus(row.id, 'INDISPONIVEL')
        continue
      }
      const payload = offerPayload(row, produtoId)
      if (row.id) {
        const { parceiroId, produtoId: ignored, ...updateFields } = payload
        void parceiroId
        void ignored
        await adminService.offers.update(row.id, updateFields)
      } else {
        await adminService.offers.create(payload)
      }
    }
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let configuracao3D
      try { configuracao3D = JSON.parse(form.configuracao3D || '{}') } catch {
        throw new Error('A configuração 3D avançada precisa conter JSON válido.')
      }
      if (!configuracao3D || Array.isArray(configuracao3D) || typeof configuracao3D !== 'object') {
        throw new Error('A configuração 3D deve ser um objeto JSON.')
      }
      if (!clean(form.nome)) throw new Error('Informe o nome do anúncio.')
      if (form.publicado && !clean(form.descricao) && componentes.length === 0) {
        throw new Error('Para publicar, informe a descrição original ou vincule algum hardware identificado.')
      }
      for (const row of offerRows) if (!row._removed) offerPayload(row, 1)
      const payload = {
        nome: clean(form.nome), marca: clean(form.marca) || (editing ? null : undefined),
        modelo: clean(form.modelo) || (editing ? null : undefined),
        descricao: clean(form.descricao) || (editing ? null : undefined),
        imagemUrl: clean(form.imagemUrl) || (editing ? null : undefined),
        imagemHoverUrl: clean(form.imagemHoverUrl) || (editing ? null : undefined),
        categoria: typeFromCategory(form.categoria) === 'KIT_UPGRADE' ? 'KIT_UPGRADE' : 'PC_MONTADO',
        finalidade: clean(form.finalidade) || (editing ? null : undefined),
        resolucaoRecomendada: clean(form.resolucaoRecomendada) || (editing ? null : undefined),
        configuracao3D, componentes: componentes.map((item, index) => ({ ...item, ordem: index })),
        publicado: Boolean(form.publicado), ativo: Boolean(form.ativo),
      }
      const saved = editing ? await adminService.builds.update(id, payload) : await adminService.builds.create(payload)
      const produtoId = Number(saved?.produtoId ?? saved?.produto?.id)
      if (offerRows.length) {
        if (Number.isInteger(produtoId) && produtoId > 0) {
          try { await saveOffers(produtoId) } catch (cause) {
            toast.show(`Cadastro salvo, mas ocorreu um problema nas ofertas: ${cause?.message || cause}`, 'alerta')
            navigate(`/admin/montados/${saved?.id || id}`, { replace: true })
            return
          }
        } else toast.show('Cadastro salvo, mas produtoId ausente para vincular as ofertas.', 'alerta')
      }
      toast.show('PC montado/kit salvo. Componentes não identificados continuam na descrição.')
      navigate(`/admin/montados/${saved?.id || id}`, { replace: true })
    } catch (cause) {
      setError(cause)
    } finally { setSaving(false) }
  }

  if (loading) return <AdminLoading />
  if (error && editing && !clean(form.nome)) return <AdminError error={error} />

  return <>
    <AdminPageHeader title={editing ? 'Editar PC montado / kit' : 'Cadastrar PC montado / kit'} description="Preserve a descrição do vendedor. Vincule somente os hardwares corretamente identificados; RAM sem marca, teclado e mouse ficam na descrição.">
      <AdminBack to="/admin/montados">Voltar</AdminBack>
    </AdminPageHeader>
    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        {canImport && <section className="admin-form-section admin-import-section">
          <div className="admin-section-heading"><div><h2>Importar anúncio com IA</h2><p>O ProjetoIA analisa a descrição, procura hardwares cadastrados e sugere se é PC montado ou kit de upgrade. O título sozinho não determina o tipo.</p></div></div>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Link do anúncio</label><input className="admin-input" type="url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://loja.com/anuncio" /></div>
            <div className="admin-field full"><button className="btn btn-primario" type="button" disabled={importing || analyzing || !clean(importUrl)} onClick={importLink}>{importing ? 'Importando anúncio...' : 'Importar anúncio e analisar descrição'}</button></div>
          </div>
        </section>}

        <section className="admin-form-section">
          <h2>Identificação e descrição original</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>Nome do anúncio</label><input className="admin-input" required maxLength={200} value={form.nome} onChange={(event) => update('nome', event.target.value)} /></div>
            <div className="admin-field"><label>Tipo de anúncio</label><select className="admin-select" value={typeFromCategory(form.categoria)} onChange={(event) => update('categoria', event.target.value)}><option value="PC_MONTADO">PC montado</option><option value="KIT_UPGRADE">Kit de upgrade</option></select></div>
            <div className="admin-field"><label>Marca (opcional)</label><input className="admin-input" maxLength={100} value={form.marca} onChange={(event) => update('marca', event.target.value)} /></div>
            <div className="admin-field"><label>Modelo (opcional)</label><input className="admin-input" maxLength={150} value={form.modelo} onChange={(event) => update('modelo', event.target.value)} /></div>
            <div className="admin-field"><label>Finalidade (opcional)</label><input className="admin-input" maxLength={150} value={form.finalidade} onChange={(event) => update('finalidade', event.target.value)} /></div>
            <div className="admin-field"><label>Resolução recomendada (opcional)</label><input className="admin-input" maxLength={80} value={form.resolucaoRecomendada} onChange={(event) => update('resolucaoRecomendada', event.target.value)} /></div>
            <div className="admin-field full"><label>Descrição completa do vendedor</label><textarea className="admin-textarea" style={{ minHeight: 210 }} maxLength={4000} value={form.descricao} onChange={(event) => update('descricao', event.target.value)} placeholder="Cole a descrição completa. Ex.: 16 GB de RAM sem marca; acompanha teclado e mouse. Esses itens não precisam ser vinculados." /><small className="admin-help">Itens sem marca/modelo ficam descritos aqui; nenhuma vinculação é obrigatória.</small></div>
            <div className="admin-field full"><button className="btn btn-secundario" type="button" disabled={analyzing || (!clean(form.nome) && !clean(form.descricao))} onClick={() => analyzeDescription()}>{analyzing ? 'Consultando ProjetoIA...' : 'Identificar componentes na descrição'}</button></div>
            <div className="admin-field full"><label>Imagem principal</label><input type="url" className="admin-input" value={form.imagemUrl} onChange={(event) => update('imagemUrl', event.target.value)} /></div>
            <div className="admin-field full"><label>Imagem secundária</label><input type="url" className="admin-input" value={form.imagemHoverUrl} onChange={(event) => update('imagemHoverUrl', event.target.value)} /></div>
          </div>
        </section>

        {(analysis || analysisWarning) && <section className="admin-form-section" aria-live="polite">
          <h2>Resultado da análise (sugestões)</h2>
          {analysisWarning && <p className="admin-inline-warning">{analysisWarning}</p>}
          {analysis && <>
            <p><strong>Tipo sugerido:</strong> {analysis.tipoSugerido === 'KIT_UPGRADE' ? 'Kit de upgrade' : analysis.tipoSugerido === 'PC_MONTADO' ? 'PC montado' : 'Revisar tipo'} — {analysis.motivo}</p>
            {Array.isArray(analysis.acessoriosNaDescricao) && analysis.acessoriosNaDescricao.length > 0 && <p className="admin-help">Acessórios mencionados, mantidos somente na descrição: {analysis.acessoriosNaDescricao.join(', ')}.</p>}
            <div className="admin-mounted-hardware-results">
              {(analysis.componentesDetectados || []).map((item) => <div className="admin-mounted-hardware-result" key={item.categoria}>
                <span><strong>{LABELS[item.categoria] || item.categoria}</strong><small>{(item.trechos || []).join(' | ').slice(0, 280)}</small></span>
                {Number(item.hardwareId) > 0 ? <button className="btn btn-secundario" type="button" disabled={componentes.some((linked) => linked.hardwareId === Number(item.hardwareId))} onClick={() => linkHardware({ hardwareId: item.hardwareId, categoria: item.categoria })}>{componentes.some((linked) => linked.hardwareId === Number(item.hardwareId)) ? 'Vinculado' : `Vincular #${item.hardwareId}`}</button> : <span className="admin-muted">Somente na descrição</span>}
              </div>)}
            </div>
            <p className="admin-help">A IA não cadastra peças faltantes nem vincula modelos genéricos. Revise cada sugestão.</p>
          </>}
        </section>}

        <section className="admin-form-section">
          <div className="admin-section-heading"><div><h2>Hardware vinculado (opcional)</h2><p>Selecione apenas peças com marca e modelo identificáveis no anúncio. Hardware não precisa ter oferta individual. Teclado, mouse e peças genéricas permanecem na descrição.</p></div><strong>{componentes.length} vínculo(s)</strong></div>
          <div className="admin-form-grid">
            <div className="admin-field"><label>Categoria</label><select className="admin-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="TODOS">Todas</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="admin-field"><label>Pesquisar pelo fabricante/modelo</label><input className="admin-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="AMD Ryzen 5 5600G, ASUS B550M..." /></div>
          </div>
          {componentes.length > 0 && <div className="admin-mounted-hardware-results">{componentes.map((item, index) => { const hardware = hardwareById.get(item.hardwareId); return <div className="admin-mounted-hardware-result" key={`${item.hardwareId}-${index}`}><span><strong>{hardware?.nome || `Hardware #${item.hardwareId}`}</strong><small>{LABELS[item.categoria] || item.categoria} — {hardware ? `${hardware.marca} ${hardware.modelo}` : 'Modelo vinculado'}</small></span><label>Quantidade <input className="admin-input" type="number" min="1" max="64" style={{ width: 78 }} value={item.quantidade} onChange={(event) => setComponentes((parts) => parts.map((part, at) => at === index ? { ...part, quantidade: Math.max(1, Number(event.target.value) || 1) } : part))} /></label><button className="btn btn-secundario" type="button" onClick={() => setComponentes((parts) => parts.filter((_, at) => at !== index))}>Remover</button></div> })}</div>}
          <div className="admin-mounted-hardware-results">{searchResults.map((hardware) => <button className="admin-mounted-hardware-result" type="button" key={hardware.id} disabled={componentes.some((part) => part.hardwareId === Number(hardware.id))} onClick={() => linkHardware(hardware)}><span><strong>{hardware.nome}</strong><small>{LABELS[hardware.categoria]} — {hardware.marca} {hardware.modelo}</small></span><span>{componentes.some((part) => part.hardwareId === Number(hardware.id)) ? 'Selecionado' : '+ Vincular'}</span></button>)}</div>
          {!hardwares.length && <p className="admin-help">Catálogo vazio ou indisponível: o cadastro pode ser concluído somente com a descrição.</p>}
        </section>

        <AdminMultiOfferEditor rows={offerRows} partners={partners} onChange={updateOffer}
          onAdd={() => setOfferRows((rows) => [...rows, emptyOfferRow()])}
          onRemove={(index) => setOfferRows((rows) => rows[index]?.id
            ? rows.map((row, at) => at === index ? { ...row, _removed: true } : row)
            : rows.filter((_, at) => at !== index))}
          title="Ofertas do computador ou kit" description="Preço e link de afiliado pertencem ao PC/kit, não às peças. Ofertas individuais dos hardwares são opcionais." />

        <section className="admin-form-section">
          <h2>Publicação e opções avançadas</h2>
          <div className="admin-form-grid">
            <label className="admin-field"><span>Publicado</span><input type="checkbox" checked={form.publicado} onChange={(event) => update('publicado', event.target.checked)} /></label>
            <label className="admin-field"><span>Ativo</span><input type="checkbox" checked={form.ativo} onChange={(event) => update('ativo', event.target.checked)} /></label>
            <div className="admin-field full"><label>Configuração 3D (JSON opcional)</label><textarea className="admin-textarea" value={form.configuracao3D} onChange={(event) => update('configuracao3D', event.target.value)} /><small className="admin-help">A visualização 3D só estará disponível quando houver peças e pontos de encaixe suficientes. Publicar não exige isso.</small></div>
          </div>
        </section>
        {error && <p role="alert" className="admin-inline-warning">{error.message || String(error)}</p>}
        <div className="admin-form-actions"><AdminBack to="/admin/montados">Cancelar</AdminBack><button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar e publicar conforme opção'}</button></div>
      </div>
    </form>
  </>
}
