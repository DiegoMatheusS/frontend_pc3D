import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/authContext'
import AdminAccess from './components/AdminAccess'
import { AdminToastProvider, useAdminToast } from './components/AdminToast'
import AdminAssistant from './components/AdminAssistant'
import { adminService } from './services/adminService'
import './Admin.css'

const NAV_ITEMS = [
  { key: 'dashboard', to: '/admin', icon: '▦', label: 'Dashboard', group: 'Geral', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'produtos', to: '/admin/produtos', icon: '▣', label: 'Produtos', group: 'Catálogo', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'hardwares', to: '/admin/hardwares', icon: 'CPU', label: 'Hardwares', group: 'Catálogo', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'descobrir-hardwares', to: '/admin/hardwares/descobrir', icon: 'IA', label: 'Descobrir Hardwares', group: 'Catálogo', roles: ['ADMIN'] },
  { key: 'notebooks', to: '/admin/notebooks', icon: 'NB', label: 'Notebooks', group: 'Catálogo', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'montados', to: '/admin/montados', icon: 'PC', label: 'PCs Montados', group: 'Catálogo', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'ofertas', to: '/admin/ofertas', icon: 'R$', label: 'Ofertas afiliadas', group: 'Comercial', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'sugestoes-ofertas', to: '/admin/sugestoes-ofertas', icon: '%+', label: 'Sugestões de ofertas', group: 'Comercial', roles: ['ADMIN'] },
  { key: 'parceiros', to: '/admin/parceiros', icon: '◇', label: 'Parceiros', group: 'Comercial', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'modelos', to: '/admin/modelos-3d', icon: '◈', label: 'Modelos 3D', group: '3D e compatibilidade', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'compatibilidade', to: '/admin/compatibilidade', icon: '✓', label: 'Compatibilidade', group: '3D e compatibilidade', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'encaixes', to: '/admin/encaixes', icon: '3D', label: 'Encaixes 3D', group: '3D e compatibilidade', roles: ['ADMIN', 'EDITOR', 'REVISOR'] },
  { key: 'avaliacoes', to: '/admin/avaliacoes', icon: '★', label: 'Avaliações', group: 'Gestão', roles: ['ADMIN'] },
  { key: 'usuarios', to: '/admin/usuarios', icon: '◎', label: 'Usuários', group: 'Gestão', roles: ['ADMIN'] },
  { key: 'auditoria', to: '/admin/auditoria', icon: 'LOG', label: 'Auditoria', group: 'Gestão', roles: ['ADMIN'] },
]

const ROUTE_META = [
  [/^\/admin\/produtos\/(novo|\d+)/, ['Produto', 'Cadastro e edição do catálogo comercial']],
  [/^\/admin\/produtos/, ['Produtos', 'Catálogo comercial e periféricos']],
  [/^\/admin\/hardwares\/descobrir/, ['Descobrir Hardwares com IA', 'Novos modelos técnicos encontrados e ainda não cadastrados']],
  [/^\/admin\/hardwares\/(novo|\d+)/, ['Hardware', 'Ficha técnica e compatibilidade']],
  [/^\/admin\/hardwares/, ['Hardwares', 'Peças usadas no montador e no catálogo técnico']],
  [/^\/admin\/sugestoes-ofertas\/\d+/, ['Analisar sugestão', 'Revisar oferta enviada por usuário']],
  [/^\/admin\/sugestoes-ofertas/, ['Sugestões de ofertas', 'Fila de ofertas enviadas por usuários']],
  [/^\/admin\/ofertas\/(novo|\d+)/, ['Oferta afiliada', 'Preço, parceiro e link comercial']],
  [/^\/admin\/ofertas/, ['Ofertas afiliadas', 'Preços e links comerciais']],
  [/^\/admin\/parceiros/, ['Parceiros', 'Lojas e programas de afiliados']],
  [/^\/admin\/modelos-3d/, ['Modelos 3D', 'Arquivos e correções de transformação']],
  [/^\/admin\/compatibilidade/, ['Compatibilidade', 'CPU, placa-mãe, memória e QVL']],
  [/^\/admin\/encaixes/, ['Encaixes 3D', 'Pontos físicos e ajustes específicos do montador']],
  [/^\/admin\/notebooks/, ['Notebooks', 'Catálogo técnico dedicado']],
  [/^\/admin\/montados/, ['PCs Montados', 'Builds comerciais publicadas no site']],
  [/^\/admin\/avaliacoes/, ['Avaliações', 'Moderação de notas e comentários']],
  [/^\/admin\/usuarios/, ['Usuários', 'Papéis, status e acesso']],
  [/^\/admin\/auditoria/, ['Auditoria', 'Registro de alterações administrativas']],
  [/^\/admin/, ['Dashboard', 'Resumo do catálogo e das ofertas']],
]

function initials(name = '') {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] || 'A'}${parts[1]?.[0] || 'D'}`.toUpperCase()
}

function AdminShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const userMenuRef = useRef(null)
  const quickSearchRef = useRef(null)
  const suggestionCountRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickQuery, setQuickQuery] = useState('')
  const [pendingSuggestions, setPendingSuggestions] = useState(0)
  const toast = useAdminToast()
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('pcBuilderTema')
    if (saved === 'dark' || saved === 'light') return saved
    return 'light'
  })

  const role = String(user?.papel || '').toUpperCase()
  const meta = useMemo(() => ROUTE_META.find(([pattern]) => pattern.test(location.pathname))?.[1] || ROUTE_META.at(-1)[1], [location.pathname])
  const availableNav = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role])
  const navGroups = useMemo(() => {
    const groups = []
    availableNav.forEach((item) => {
      let group = groups.find((entry) => entry.name === item.group)
      if (!group) {
        group = { name: item.group, items: [] }
        groups.push(group)
      }
      group.items.push(item)
    })
    return groups
  }, [availableNav])
  const quickResults = useMemo(() => {
    const query = quickQuery.trim().toLocaleLowerCase('pt-BR')
    if (!query) return availableNav
    return availableNav.filter((item) => `${item.label} ${item.group}`.toLocaleLowerCase('pt-BR').includes(query))
  }, [availableNav, quickQuery])

  useEffect(() => {
    if (role !== 'ADMIN') {
      suggestionCountRef.current = null
      return undefined
    }

    let active = true
    const checkSuggestions = async () => {
      try {
        const payload = await adminService.offerSuggestions.list({ status: 'EM_ANALISE' })
        if (!active) return
        const items = Array.isArray(payload?.sugestoes) ? payload.sugestoes : []
        const explicitCount = Number(payload?.emAnalise)
        const count = Number.isFinite(explicitCount) ? explicitCount : items.filter((item) => item?.status === 'EM_ANALISE').length
        const previous = suggestionCountRef.current
        setPendingSuggestions(count)
        suggestionCountRef.current = count
        if (previous !== null && count > previous) {
          const newItems = count - previous
          toast.show(`${newItems} nova${newItems > 1 ? 's' : ''} sugestão${newItems > 1 ? 'ões' : ''} de oferta recebida${newItems > 1 ? 's' : ''}.`, 'info')
        }
      } catch {
        // A notificação é auxiliar; falhas aqui não bloqueiam o painel.
      }
    }

    checkSuggestions()
    const interval = window.setInterval(checkSuggestions, 60000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [role, toast])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.tema = theme === 'dark' ? 'escuro' : 'claro'
    localStorage.setItem('pcBuilderTema', theme)
  }, [theme])

  useEffect(() => {
    document.title = `${meta[0]} | Administração CriaByte`
    let robots = document.head.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
    }
    robots.setAttribute('content', 'noindex,nofollow')
  }, [location.pathname, meta])

  useEffect(() => {
    const handler = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setUserOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuickOpen((open) => !open)
      }
      if (event.key === 'Escape') setQuickOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!quickOpen) return undefined
    const timeout = window.setTimeout(() => quickSearchRef.current?.focus(), 20)
    return () => window.clearTimeout(timeout)
  }, [quickOpen])

  async function handleLogout() {
    await logout()
    navigate('/entrar', { replace: true })
  }

  return (
    <div className={`admin-root ${menuOpen ? 'admin-menu-aberto' : ''}`} data-admin-role={role}>
      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Navegação administrativa">
          <div className="admin-brand">
            <Link to="/admin" className="admin-brand-link">
              <span className="admin-brand-mark">CB</span>
              <span><strong>CriaByte</strong><small>Administração</small></span>
            </Link>
            <button className="admin-sidebar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">×</button>
          </div>

          <nav className="admin-nav">
            {navGroups.map((group) => (
              <div className="admin-nav-group" key={group.name}>
                <span className="admin-nav-group-title">{group.name}</span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    end={item.to === '/admin'}
                    className={({ isActive }) => `admin-nav-link ${isActive ? 'ativo' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-bottom">
            <Link className="admin-site-link" to="/">← Voltar ao site</Link>
            <p>Painel integrado à sua sessão. As ações disponíveis dependem do seu papel.</p>
          </div>
        </aside>

        <button className="admin-overlay" type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />

        <div className="admin-main">
          <header className="admin-topbar">
            <button className="admin-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
            <div className="admin-topbar-title"><strong>{meta[0]}</strong><span>{meta[1]}</span></div>
            <div className="admin-topbar-actions">
              <button className="admin-quick-search-button" type="button" onClick={() => setQuickOpen(true)} aria-label="Pesquisar no painel" title="Pesquisar no painel (Ctrl+K)"><span aria-hidden="true">⌕</span><span>Pesquisar</span><kbd>Ctrl K</kbd></button>
              {role === 'ADMIN' && <Link className="admin-icon-button admin-notification-button" to="/admin/sugestoes-ofertas" aria-label={pendingSuggestions ? `${pendingSuggestions} sugestão(ões) de oferta em análise` : 'Nenhuma sugestão de oferta pendente'} title="Sugestões de ofertas"><span aria-hidden="true">♢</span>{pendingSuggestions > 0 && <span className="admin-notification-badge">{pendingSuggestions > 99 ? '99+' : pendingSuggestions}</span>}</Link>}
              <button className="admin-icon-button admin-ia-btn-topbar" data-ativo={aiOpen ? 'true' : 'false'} type="button" onClick={() => setAiOpen((value) => !value)} aria-label="Abrir assistente administrativo" title="Assistente Admin">✦</button>
              <button className="admin-icon-button" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema" title="Alternar tema">{theme === 'dark' ? '☀' : '◐'}</button>
              <div className={`admin-user-menu ${userOpen ? 'aberto' : ''}`} ref={userMenuRef}>
                <button className="admin-user-button" type="button" aria-haspopup="true" aria-expanded={userOpen} onClick={() => setUserOpen((open) => !open)}>
                  <span className="admin-avatar">{initials(user?.nome)}</span>
                  <span className="admin-user-text"><strong>{user?.nome || 'Administrador'}</strong><small>{role}</small></span>
                  <span aria-hidden="true">▾</span>
                </button>
                <div className="admin-user-dropdown" role="menu">
                  <Link to="/conta" role="menuitem" onClick={() => setUserOpen(false)}>Minha conta</Link>
                  <Link to="/conta/editar" role="menuitem" onClick={() => setUserOpen(false)}>Alterar cadastro</Link>
                  <Link to="/minhas-builds" role="menuitem" onClick={() => setUserOpen(false)}>Minhas builds</Link>
                  <Link to="/comunidade/publicar" role="menuitem" onClick={() => setUserOpen(false)}>Publicar build</Link>
                  {['ADMIN', 'EDITOR'].includes(role) && <Link to="/busca-ofertas" role="menuitem" onClick={() => setUserOpen(false)}>Busca de Ofertas</Link>}
                  <Link to="/" role="menuitem" onClick={() => setUserOpen(false)}>Abrir site público</Link>
                  <button type="button" onClick={handleLogout} role="menuitem">Sair</button>
                </div>
              </div>
            </div>
          </header>
          <main className="admin-content"><Outlet /></main>

          {quickOpen && (
            <div className="admin-quick-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickOpen(false) }}>
              <section className="admin-quick-dialog" role="dialog" aria-modal="true" aria-label="Pesquisa rápida do painel">
                <div className="admin-quick-search"><span aria-hidden="true">⌕</span><input ref={quickSearchRef} value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} placeholder="Ir para Produtos, Ofertas, Encaixes..." aria-label="Pesquisar página do painel" /><kbd>ESC</kbd></div>
                <div className="admin-quick-results">
                  {quickResults.map((item) => (
                    <button key={item.key} type="button" onClick={() => { navigate(item.to); setQuickOpen(false) }}>
                      <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                      <span><strong>{item.label}</strong><small>{item.group}</small></span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
                  {!quickResults.length && <p className="admin-quick-empty">Nenhuma área encontrada.</p>}
                </div>
              </section>
            </div>
          )}

          <AdminAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <AdminAccess>
      <AdminToastProvider>
        <AdminShell />
      </AdminToastProvider>
    </AdminAccess>
  )
}
