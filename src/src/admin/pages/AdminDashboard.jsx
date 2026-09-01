import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader } from '../components/AdminCommon'
import { useAdminPermissions } from '../components/AdminAccess'

function percent(part, total) {
  if (!total) return 100
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)))
}

function hasImage(item) {
  return Boolean(item?.imagemUrl || item?.imagem || item?.imagemPrincipal || item?.urlImagem)
}

export default function AdminDashboard() {
  const { canWriteCatalog, canCreateHardware, isAdmin } = useAdminPermissions()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const load = () => adminService.dashboard.load({ includeUsers: isAdmin })
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((err) => active && setError(err))

    void load()
    const refreshOnFocus = () => { if (document.visibilityState !== 'hidden') void load() }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      active = false
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [isAdmin, location.key])

  const stats = useMemo(() => {
    if (!data) return []
    const publishedProducts = data.produtos.filter((item) => item.publicado !== false && item.ativo !== false).length
    const publishedHardware = data.hardwares.filter((item) => item.publicado !== false && item.ativo !== false).length
    const activeOffers = data.ofertas.filter((item) => String(item.status || 'ATIVA').toUpperCase() === 'ATIVA').length
    const discontinuedOffers = data.ofertas.filter((item) => String(item.status || '').toUpperCase() === 'DESCONTINUADA').length
    const partners = data.parceiros.filter((item) => item.ativo !== false).length
    return [
      ['Produtos', data.produtos.length, `${publishedProducts} publicados`, '▣', '/admin/produtos'],
      ['Hardwares', data.hardwares.length, `${publishedHardware} publicados`, 'CPU', '/admin/hardwares'],
      ['Ofertas ativas', activeOffers, discontinuedOffers ? `${discontinuedOffers} descontinuada${discontinuedOffers === 1 ? '' : 's'} no histórico` : 'Nenhuma descontinuada', 'R$', '/admin/ofertas'],
      ['Parceiros', partners, `${data.parceiros.length} cadastrados`, '◇', '/admin/parceiros'],
    ]
  }, [data])

  const quality = useMemo(() => {
    if (!data) return []
    const productsWithImage = data.produtos.filter(hasImage).length
    const publishedHardware = data.hardwares.filter((item) => item.publicado !== false && item.ativo !== false).length
    const activeOffers = data.ofertas.filter((item) => String(item.status || 'ATIVA').toUpperCase() === 'ATIVA')
    const validOffers = activeOffers.filter((item) => Number(item.precoAtual || item.preco || 0) > 0 && Boolean(item.urlAfiliado || item.urlOriginal)).length
    const publishedNotebooks = data.notebooks.filter((item) => item.publicado !== false && item.ativo !== false).length
    const publishedBuilds = data.builds.filter((item) => item.publicado !== false && item.ativo !== false).length
    return [
      { label: 'Produtos com imagem', value: percent(productsWithImage, data.produtos.length), detail: `${productsWithImage}/${data.produtos.length}`, to: '/admin/produtos' },
      { label: 'Hardwares publicados', value: percent(publishedHardware, data.hardwares.length), detail: `${publishedHardware}/${data.hardwares.length}`, to: '/admin/hardwares' },
      { label: 'Ofertas prontas', value: percent(validOffers, data.ofertas.length), detail: `${validOffers}/${data.ofertas.length}`, to: '/admin/ofertas' },
      { label: 'Notebooks publicados', value: percent(publishedNotebooks, data.notebooks.length), detail: `${publishedNotebooks}/${data.notebooks.length}`, to: '/admin/notebooks' },
      { label: 'PCs Montados publicados', value: percent(publishedBuilds, data.builds.length), detail: `${publishedBuilds}/${data.builds.length}`, to: '/admin/montados' },
    ]
  }, [data])

  if (error) return <AdminError error={error} />
  if (!data) return <AdminLoading />

  const pending = [
    { title: 'Produtos sem imagem', count: data.produtos.filter((p) => !hasImage(p)).length, to: '/admin/produtos', icon: 'IMG' },
    { title: 'Hardwares em rascunho', count: data.hardwares.filter((p) => p.publicado === false).length, to: '/admin/hardwares', icon: 'TEC' },
    { title: 'Ofertas ativas sem validade', count: data.ofertas.filter((o) => String(o.status || 'ATIVA').toUpperCase() === 'ATIVA' && !o.validoAte).length, to: '/admin/ofertas', icon: 'R$' },
    { title: 'Notebooks não publicados', count: data.notebooks.filter((n) => n.ativo !== false && n.publicado === false).length, to: '/admin/notebooks', icon: 'NB' },
  ].filter((item) => item.count > 0)

  const sources = data.sources || []
  const onlineSources = sources.filter((source) => source.ok).length

  return (
    <>
      <AdminPageHeader title="Visão geral" description="Acompanhe o catálogo, ofertas e itens que precisam de atenção.">
        {canWriteCatalog && <Link className="btn btn-primario" to="/admin/produtos/novo">+ Novo produto</Link>}
      </AdminPageHeader>

      <section className="admin-grid-stats">
        {stats.map(([label, value, note, icon, to]) => (
          <Link className="admin-stat-card admin-stat-link" key={label} to={to}>
            <div className="admin-stat-top"><span>{label}</span><span className="admin-stat-icon">{icon}</span></div>
            <strong className="admin-stat-value">{value}</strong>
            <span className="admin-stat-note">{note}</span>
          </Link>
        ))}
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-card">
          <header className="admin-card-header"><div><h2>Qualidade do catálogo</h2><p>Visão rápida da completude dos dados já disponíveis.</p></div></header>
          <div className="admin-card-body admin-health-list">
            {quality.map((item) => (
              <Link className="admin-health-row" to={item.to} key={item.label}>
                <span className="admin-health-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
                <span className="admin-health-progress" aria-label={`${item.value}%`}><i style={{ width: `${item.value}%` }} /></span>
                <strong className="admin-health-value">{item.value}%</strong>
              </Link>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <header className="admin-card-header"><div><h2>Serviços do painel</h2><p>{onlineSources}/{sources.length || 0} fontes responderam nesta carga.</p></div><span className={`admin-source-summary ${onlineSources === sources.length ? 'ok' : 'warn'}`}>{onlineSources === sources.length ? 'Online' : 'Atenção'}</span></header>
          <div className="admin-card-body admin-source-list">
            {sources.map((source) => <div className="admin-source-row" key={source.name} title={source.message || undefined}><span className={`admin-source-dot ${source.ok ? 'ok' : 'erro'}`} /><span>{source.name}</span><strong>{source.ok ? 'OK' : 'Falhou'}</strong></div>)}
          </div>
        </article>
      </section>

      <section className="admin-dashboard-grid admin-dashboard-grid--secondary">
        <article className="admin-card">
          <header className="admin-card-header"><h2>Catálogo atual</h2><Link to="/admin/produtos">Ver catálogo</Link></header>
          <div className="admin-card-body admin-activity-list">
            <div className="admin-activity-item"><span className="admin-activity-dot" /><div><p>{data.notebooks.filter((item) => item.ativo !== false).length} notebook(s) ativo(s) · {data.notebooks.filter((item) => item.ativo === false).length} arquivado(s).</p><time>Catálogo atual</time></div></div>
            <div className="admin-activity-item"><span className="admin-activity-dot" /><div><p>{data.builds.filter((item) => item.ativo !== false).length} PC(s) montado(s) ativo(s) · {data.builds.filter((item) => item.ativo === false).length} arquivado(s).</p><time>Catálogo atual</time></div></div>
            {isAdmin && <div className="admin-activity-item"><span className="admin-activity-dot" /><div><p>{data.usuarios.length} usuário(s) cadastrados.</p><time>Catálogo atual</time></div></div>}
          </div>
        </article>
        <article className="admin-card">
          <header className="admin-card-header"><h2>Ações rápidas</h2></header>
          <div className="admin-card-body admin-quick-grid">
            {canWriteCatalog && <Link className="admin-quick-action" to="/admin/produtos/novo"><strong>Novo produto</strong><small>Produto comercial + oferta afiliada no mesmo fluxo.</small></Link>}
            {canCreateHardware && <Link className="admin-quick-action" to="/admin/hardwares/novo"><strong>Novo hardware</strong><small>Peça técnica usada pelo montador.</small></Link>}
            <Link className="admin-quick-action" to="/admin/modelos-3d"><strong>Modelo 3D</strong><small>Arquivo e transformação por hardware.</small></Link>
          </div>
        </article>
      </section>

      <section className="admin-card admin-pending-card" style={{ marginTop: 18 }}>
        <header className="admin-card-header"><div><h2>Pendências do catálogo</h2><p>Itens que merecem atenção antes de publicar.</p></div></header>
        <div className="admin-card-body admin-pending-list">
          {pending.length ? pending.map((item) => (
            <Link className="admin-pending-item" to={item.to} key={item.title}><span className="admin-pending-icon">{item.icon}</span><span><strong>{item.title}</strong><small>Revise estes registros no painel.</small></span><span className="admin-pending-count">{item.count}</span></Link>
          )) : <div className="admin-empty">Nenhuma pendência importante encontrada.</div>}
        </div>
      </section>
    </>
  )
}
