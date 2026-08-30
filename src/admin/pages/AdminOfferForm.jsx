import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminBack, AdminError, AdminLoading, AdminPageHeader, formatMoney } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const EMPTY = {
  targetType: 'produto', targetId: '', parceiroId: '', vendedorNome: '', vendedorIdentificador: '',
  urlOriginal: '', urlAfiliada: '', preco: '', precoAnterior: '', frete: '', validoAte: '', status: 'ATIVA',
}

function toLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function AdminOfferForm() {
  const { id } = useParams()
  const editing = id && id !== 'novo'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useAdminToast()
  const suggestionId = !editing && searchParams.get('origem') === 'sugestao-oferta' ? searchParams.get('sugestaoId') : ''
  const initialProductId = searchParams.get('produtoId') || ''
  const initialHardwareId = searchParams.get('hardwareId') || ''

  const [form, setForm] = useState(() => ({
    ...EMPTY,
    targetType: initialHardwareId ? 'hardware' : 'produto',
    targetId: initialHardwareId || initialProductId,
  }))
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      adminService.offers.partners(),
      adminService.products.list().catch(() => []),
      adminService.hardwares.list().catch(() => []),
      editing ? adminService.offers.get(id) : Promise.resolve(null),
      suggestionId ? adminService.offerSuggestions.get(suggestionId).catch(() => null) : Promise.resolve(null),
    ]).then(([partners, products, hardwares, item, suggestion]) => {
      if (!active) return
      setData({ partners, products, hardwares })
      if (item) {
        setForm({
          ...EMPTY,
          ...item,
          targetType: item.hardwareId ? 'hardware' : 'produto',
          targetId: item.hardwareId || item.produtoId || '',
          vendedorNome: item.vendedorNome ?? '',
          vendedorIdentificador: item.vendedorIdentificador ?? '',
          urlOriginal: item.urlOriginal ?? '',
          urlAfiliada: item.urlAfiliada ?? '',
          validoAte: toLocal(item.validoAte),
          preco: item.preco ?? '',
          precoAnterior: item.precoAnterior ?? '',
          frete: item.frete ?? '',
        })
      } else if (suggestion) {
        setForm((current) => ({
          ...current,
          targetType: 'produto',
          targetId: initialProductId || suggestion.produto?.id || suggestion.produtoId || current.targetId,
          parceiroId: suggestion.parceiro?.id || suggestion.parceiroId || current.parceiroId,
          urlOriginal: suggestion.urlOriginal || current.urlOriginal,
          preco: suggestion.preco ?? current.preco,
          precoAnterior: suggestion.precoAnterior ?? current.precoAnterior,
        }))
      }
    }).catch((err) => active && setError(err))
    return () => { active = false }
  }, [editing, id, suggestionId, initialProductId])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const targets = useMemo(() => form.targetType === 'hardware' ? (data?.hardwares || []) : (data?.products || []), [data, form.targetType])

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        parceiroId: Number(form.parceiroId),
        vendedorNome: String(form.vendedorNome ?? '').trim() || (editing ? null : undefined),
        vendedorIdentificador: String(form.vendedorIdentificador ?? '').trim() || (editing ? null : undefined),
        urlOriginal: String(form.urlOriginal ?? '').trim(),
        urlAfiliada: String(form.urlAfiliada ?? '').trim() || (editing ? null : undefined),
        preco: Number(form.preco),
        precoAnterior: form.precoAnterior === '' ? (editing ? null : undefined) : Number(form.precoAnterior),
        frete: form.frete === '' ? (editing ? null : undefined) : Number(form.frete),
        validoAte: form.validoAte ? new Date(form.validoAte).toISOString() : (editing ? null : undefined),
        ...(!editing ? { [form.targetType === 'hardware' ? 'hardwareId' : 'produtoId']: Number(form.targetId) } : {}),
        ...(editing ? { status: form.status } : {}),
      }
      const saved = editing ? await adminService.offers.update(id, body) : await adminService.offers.create(body)
      toast.show('Oferta salva.')
      if (suggestionId && !editing) {
        navigate(`/admin/sugestoes-ofertas/${encodeURIComponent(suggestionId)}?produtoId=${encodeURIComponent(form.targetId)}&ofertaId=${encodeURIComponent(saved?.id || '')}`, { replace: true })
      } else {
        navigate(`/admin/ofertas/${saved?.id || id}`, { replace: true })
      }
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  if (!data && !error) return <AdminLoading />
  if (error && !data) return <AdminError error={error} />

  const currentTarget = targets.find((target) => Number(target.id) === Number(form.targetId))
  const currentPartner = data?.partners.find((partner) => Number(partner.id) === Number(form.parceiroId))


  async function deleteOffer() {
    if (!editing || saving) return
    const confirmed = window.confirm('Excluir esta oferta? Esta ação não pode ser desfeita.')
    if (!confirmed) return
    setSaving(true)
    setError(null)
    try {
      await adminService.offers.remove(id)
      toast.show('Oferta excluída.', 'sucesso')
      navigate('/admin/ofertas', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function reactivateNow() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const saved = await adminService.offers.setStatus(id, 'ATIVA')
      setForm((current) => ({ ...current, status: 'ATIVA' }))
      toast.show(saved?.validoAte
        ? 'Oferta reativada. Confira a validade antes de mantê-la publicada.'
        : 'Oferta reativada com sucesso.', 'sucesso')
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return <>
    <AdminPageHeader
      title={editing ? 'Editar oferta' : 'Cadastrar oferta'}
      description={suggestionId ? 'Crie a Oferta comercial usando os dados enviados na sugestão. Depois você volta automaticamente para concluir a análise.' : 'Associe uma oferta a um Produto comercial ou Hardware técnico.'}
    >
      <AdminBack to={suggestionId ? `/admin/sugestoes-ofertas/${suggestionId}` : '/admin/ofertas'}>Cancelar</AdminBack>
    </AdminPageHeader>

    {suggestionId && <div className="admin-suggestion-return-banner"><strong>Oferta da sugestão #{suggestionId}</strong><span>URL original e preço já foram preenchidos. Informe o link afiliado aqui, se necessário. Isso não acontece no botão “Aceitar Oferta”.</span></div>}

    <form className="admin-form-layout" onSubmit={submit}>
      <div className="admin-form-card">
        <section className="admin-form-section">
          <h2>Vínculo</h2>
          <div className="admin-form-grid">
            <div className="admin-field"><label>Tipo</label><select className="admin-select" value={form.targetType} disabled={editing || Boolean(suggestionId)} onChange={(event) => { update('targetType', event.target.value); update('targetId', '') }}><option value="produto">Produto</option><option value="hardware">Hardware</option></select></div>
            <div className="admin-field"><label>Item</label><select className="admin-select" value={form.targetId} disabled={editing} required onChange={(event) => update('targetId', event.target.value)}><option value="">Selecione</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.nome}</option>)}</select></div>
            <div className="admin-field"><label>Parceiro</label><select className="admin-select" required value={form.parceiroId} onChange={(event) => update('parceiroId', event.target.value)}><option value="">Selecione</option>{data?.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.nome}</option>)}</select></div>
            <div className="admin-field"><label>Status</label><select className="admin-select" value={form.status} disabled={!editing} onChange={(event) => update('status', event.target.value)}><option>ATIVA</option><option>INDISPONIVEL</option><option>DESCONTINUADA</option></select></div>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Preço e vendedor</h2>
          <div className="admin-form-grid">
            <div className="admin-field"><label>Preço atual</label><input className="admin-input" type="number" min="0.01" step="0.01" required value={form.preco} onChange={(event) => update('preco', event.target.value)} /></div>
            <div className="admin-field"><label>Preço anterior</label><input className="admin-input" type="number" min="0.01" step="0.01" value={form.precoAnterior} onChange={(event) => update('precoAnterior', event.target.value)} /></div>
            <div className="admin-field"><label>Frete</label><input className="admin-input" type="number" min="0" step="0.01" value={form.frete} onChange={(event) => update('frete', event.target.value)} /></div>
            <div className="admin-field"><label>Validade</label><input className="admin-input" type="datetime-local" value={form.validoAte} onChange={(event) => update('validoAte', event.target.value)} /></div>
            <div className="admin-field"><label>Vendedor</label><input className="admin-input" value={form.vendedorNome} onChange={(event) => update('vendedorNome', event.target.value)} /></div>
            <div className="admin-field"><label>ID do vendedor</label><input className="admin-input" value={form.vendedorIdentificador} onChange={(event) => update('vendedorIdentificador', event.target.value)} /></div>
          </div>
        </section>

        <section className="admin-form-section">
          <h2>Links</h2>
          <div className="admin-form-grid">
            <div className="admin-field full"><label>URL original</label><input className="admin-input" type="url" required value={form.urlOriginal} onChange={(event) => update('urlOriginal', event.target.value)} /></div>
            <div className="admin-field full"><label>URL afiliada</label><input className="admin-input" type="url" value={form.urlAfiliada} onChange={(event) => update('urlAfiliada', event.target.value)} /></div>
          </div>
        </section>

        {error && <div className="admin-form-section"><p className="admin-form-error">{error.message}</p></div>}
        <footer className="admin-form-footer admin-form-footer--offer">
          {editing && <button className="btn btn-perigo" type="button" disabled={saving} onClick={deleteOffer}>Excluir oferta</button>}
          {editing && form.status !== 'ATIVA' && <button className="btn btn-secundario" type="button" disabled={saving} onClick={reactivateNow}>Reativar agora</button>}
          <button className="btn btn-primario" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar oferta'}</button>
          {editing && <small className="admin-offer-status-help">Status atual: <strong>{form.status}</strong>. A loja/parceiro pode ser alterada normalmente e a oferta também pode ser excluída.</small>}
        </footer>
      </div>

      <aside className="admin-sticky-side">
        <div className="admin-card">
          <header className="admin-card-header"><h2>Prévia</h2></header>
          <div className="admin-card-body"><article className="admin-preview-card"><div className="admin-preview-content"><small>{currentPartner?.nome || 'Parceiro'}</small><h3>{currentTarget?.nome || 'Item da oferta'}</h3><strong className="admin-preview-price">{formatMoney(form.preco)}</strong>{Number(form.precoAnterior) > Number(form.preco) && <span className="admin-preview-discount">Preço anterior {formatMoney(form.precoAnterior)}</span>}</div></article></div>
        </div>
      </aside>
    </form>
  </>
}
