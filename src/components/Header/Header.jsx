import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import { getNotifications, markNotificationRead } from '../../services/notificationsService'
import './Header.css'

const CHAVE_TEMA = 'pcBuilderTema'

const STORE_GROUP_LABELS = {
  hardwares: 'Peças para PC',
  computadores: 'Computadores',
  celulares: 'Celulares',
  tablets: 'Tablets',
  notebooks: 'Notebooks',
  monitores: 'Monitores',
  perifericos: 'Periféricos',
  games: 'Games',
  'tv-audio': 'TV e Áudio',
  fotografia: 'Foto e Vídeo',
  'casa-inteligente': 'Casa Inteligente',
  eletroportateis: 'Eletroportáteis',
  rede: 'Rede e Internet',
  impressao: 'Impressão',
  wearables: 'Wearables',
  maker: 'Eletrônica e Maker',
  acessorios: 'Acessórios',
  setup: 'Setup',
}

const STORE_SECTION_LABELS = {
  computadores: 'Computadores',
  mobilidade: 'Celulares e mobilidade',
  games: 'Games',
  'tv-audio-foto-video': 'TV, áudio, foto e vídeo',
  'casa-inteligente': 'Casa inteligente',
  eletroportateis: 'Eletroportáteis',
  'rede-impressao-maker': 'Rede, impressão e maker',
  'acessorios-ofertas': 'Acessórios e ofertas',
}

const STORE_CATEGORY_LABELS = {
  celulares: 'Celulares',
  tablets: 'Tablets',
  'e-readers': 'E-readers',
  'mini-computadores': 'Mini PCs',
  'videogames-consoles': 'Videogames',
  jogos: 'Jogos',
  'controles-videogame': 'Controles',
  joysticks: 'Joysticks',
  volantes: 'Volantes',
  'smart-tvs': 'Smart TVs',
  tvs: 'TVs',
  projetores: 'Projetores',
  cameras: 'Câmeras',
  'cameras-de-acao': 'Câmeras de ação',
  drones: 'Drones',
  'relogios-inteligentes': 'Smartwatches',
  'aspiradores-de-po': 'Aspiradores',
  'robos-aspiradores': 'Robôs aspiradores',
  'smart-speakers': 'Smart speakers',
  'cameras-de-seguranca': 'Câmeras de segurança',
  'lampadas-inteligentes': 'Lâmpadas inteligentes',
  'tomadas-inteligentes': 'Tomadas inteligentes',
  'fechaduras-inteligentes': 'Fechaduras inteligentes',
  'air-fryers': 'Air fryers',
  cafeteiras: 'Cafeteiras',
  liquidificadores: 'Liquidificadores',
  ventiladores: 'Ventiladores',
  climatizadores: 'Climatizadores',
}

const STORE_MENU_SECTIONS = [
  {
    id: 'computadores',
    title: 'Computadores',
    links: [
      ['Todos os produtos', '/loja'],
      ['Peças para PC', '/pecas'],
      ['Notebooks', '/notebooks'],
      ['Mini computadores', '/loja?categoria=mini-computadores'],
      ['Monitores', '/loja?grupo=monitores'],
    ],
  },
  {
    id: 'mobilidade',
    title: 'Celulares e mobilidade',
    links: [
      ['Celulares', '/loja?categoria=celulares'],
      ['Tablets', '/loja?categoria=tablets'],
      ['Smartwatches', '/loja?categoria=relogios-inteligentes'],
      ['E-readers', '/loja?categoria=e-readers'],
      ['Power banks', '/loja?categoria=power-banks'],
    ],
  },
  {
    id: 'games',
    title: 'Games',
    links: [
      ['Videogames e consoles', '/loja?categoria=videogames-consoles'],
      ['Jogos', '/loja?categoria=jogos'],
      ['Controles', '/loja?categoria=controles-videogame'],
      ['Joysticks', '/loja?categoria=joysticks'],
      ['Volantes', '/loja?categoria=volantes'],
    ],
  },
  {
    id: 'tv-audio-foto-video',
    title: 'TV, áudio, foto e vídeo',
    links: [
      ['Smart TVs', '/loja?categoria=smart-tvs'],
      ['Projetores', '/loja?categoria=projetores'],
      ['Câmeras e fotografia', '/loja?categoria=cameras'],
      ['Câmeras de ação', '/loja?categoria=cameras-de-acao'],
      ['Drones', '/loja?categoria=drones'],
      ['Caixas de som', '/loja?categoria=caixas-de-som'],
      ['Soundbars', '/loja?categoria=soundbars'],
      ['Home theaters', '/loja?categoria=home-theaters'],
    ],
  },
  {
    id: 'casa-inteligente',
    title: 'Casa inteligente',
    links: [
      ['Robôs aspiradores', '/loja?categoria=robos-aspiradores'],
      ['Aspiradores de pó', '/loja?categoria=aspiradores-de-po'],
      ['Smart speakers', '/loja?categoria=smart-speakers'],
      ['Câmeras de segurança', '/loja?categoria=cameras-de-seguranca'],
      ['Lâmpadas inteligentes', '/loja?categoria=lampadas-inteligentes'],
      ['Tomadas inteligentes', '/loja?categoria=tomadas-inteligentes'],
      ['Fechaduras inteligentes', '/loja?categoria=fechaduras-inteligentes'],
    ],
  },
  {
    id: 'eletroportateis',
    title: 'Eletroportáteis',
    links: [
      ['Air fryers', '/loja?categoria=air-fryers'],
      ['Cafeteiras', '/loja?categoria=cafeteiras'],
      ['Liquidificadores', '/loja?categoria=liquidificadores'],
      ['Ventiladores', '/loja?categoria=ventiladores'],
      ['Climatizadores', '/loja?categoria=climatizadores'],
    ],
  },
  {
    id: 'rede-impressao-maker',
    title: 'Rede, impressão e maker',
    links: [
      ['Roteadores', '/loja?categoria=roteadores'],
      ['Repetidores Wi-Fi', '/loja?categoria=repetidores-wifi'],
      ['Switches de rede', '/loja?categoria=switches-de-rede'],
      ['Impressoras e scanners', '/loja?grupo=impressao'],
      ['Impressoras 3D', '/loja?categoria=impressoras-3d'],
      ['Arduino e robótica', '/loja?categoria=kits-arduino-robotica'],
    ],
  },
  {
    id: 'acessorios-ofertas',
    title: 'Acessórios e ofertas',
    links: [
      ['Carregadores', '/loja?categoria=carregadores'],
      ['Cabos e adaptadores', '/loja?categoria=cabos-adaptadores'],
      ['Hubs e docks', '/loja?grupo=acessorios'],
      ['Armazenamento externo', '/loja?categoria=armazenamento-externo'],
      ['Periféricos', '/loja?grupo=perifericos'],
      ['Setup', '/loja?grupo=setup'],
      ['Ofertas', '/ofertas'],
    ],
  },
]


function obterTemaInicial() {
  const salvo = localStorage.getItem(CHAVE_TEMA)
  if (salvo === 'dark' || salvo === 'light') return salvo
  return 'light'
}

function getStoreSectionLabel(location) {
  const path = location.pathname
  if (path.startsWith('/notebooks')) return 'Notebooks'
  if (path.startsWith('/ofertas')) return 'Ofertas'
  if (path.startsWith('/pecas')) return 'Peças'
  if (path.startsWith('/produto')) return 'Produtos'
  if (path === '/loja') {
    const params = new URLSearchParams(location.search)
    const section = params.get('secao')
    const category = params.get('categoria')
    const group = params.get('grupo')
    if (section && STORE_SECTION_LABELS[section]) return STORE_SECTION_LABELS[section]
    if (category && STORE_CATEGORY_LABELS[category]) return STORE_CATEGORY_LABELS[category]
    if (group && STORE_GROUP_LABELS[group]) return STORE_GROUP_LABELS[group]
  }
  return 'Loja'
}

function initials(name = '') {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] || 'C'}${parts[1]?.[0] || 'B'}`.toUpperCase()
}

function notificationReferenceUrl(item = {}) {
  const referenceType = String(item?.referenciaTipo || '').toUpperCase()
  const referenceId = String(item?.referenciaId || '').trim()
  if (referenceType === 'BUILD_COMUNIDADE' && referenceId) return `/comunidade/${encodeURIComponent(referenceId)}`
  return null
}

function notificationView(item = {}) {
  const type = String(item?.tipo || item?.type || '').toUpperCase()
  const reason = String(item?.motivo || item?.detalhes?.motivo || item?.metadata?.motivo || '').trim()
  const referenceUrl = notificationReferenceUrl(item)

  if (type === 'SUGESTAO_OFERTA_APROVADA') {
    return {
      title: item?.titulo || 'Sugestão de oferta aprovada',
      message: item?.mensagem || item?.texto || 'Sua sugestão de oferta foi aprovada e publicada.',
      url: item?.url || item?.link || referenceUrl || (item?.produtoId ? `/produto/${item.produtoId}` : '/conta'),
      tone: 'success',
    }
  }

  if (type === 'SUGESTAO_OFERTA_REJEITADA') {
    const base = item?.mensagem || item?.texto || 'Sua sugestão de oferta foi rejeitada.'
    return {
      title: item?.titulo || 'Sugestão de oferta rejeitada',
      message: reason && !String(base).includes(reason) ? `${base} Motivo: ${reason}` : base,
      url: item?.url || item?.link || referenceUrl || '/conta',
      tone: 'danger',
    }
  }

  if (type.includes('REMOVID') || type.includes('MODER') || type.includes('ALTERADA_ADMIN') || type.includes('ALTERADO_ADMIN')) {
    return {
      title: item?.titulo || 'Alteração da administração',
      message: item?.mensagem || item?.texto || 'A administração alterou um conteúdo que você publicou.',
      url: item?.url || item?.link || referenceUrl || '/conta',
      tone: 'danger',
    }
  }

  if (type.includes('COMENT')) return { title: item?.titulo || 'Novo comentário', message: item?.mensagem || item?.texto || 'Há um novo comentário relacionado ao seu conteúdo.', url: item?.url || item?.link || referenceUrl || '/conta', tone: 'info' }
  if (type.includes('RESPOST')) return { title: item?.titulo || 'Nova resposta', message: item?.mensagem || item?.texto || 'Responderam a um dos seus comentários.', url: item?.url || item?.link || referenceUrl || '/conta', tone: 'info' }
  if (type.includes('LIKE') || type.includes('CURTID')) return { title: item?.titulo || 'Nova curtida', message: item?.mensagem || item?.texto || 'Seu conteúdo recebeu uma nova curtida.', url: item?.url || item?.link || referenceUrl || '/conta', tone: 'like' }
  if (type.includes('AVALI') || type.includes('ESTRELA')) return { title: item?.titulo || 'Nova avaliação', message: item?.mensagem || item?.texto || 'Há uma nova avaliação relacionada ao seu conteúdo.', url: item?.url || item?.link || referenceUrl || '/conta', tone: 'rating' }

  return {
    title: item?.titulo || 'Nova atividade',
    message: item?.mensagem || item?.texto || 'Há uma nova interação relacionada à sua conta.',
    url: item?.url || item?.link || referenceUrl || '/conta',
    tone: 'default',
  }
}

export default function Header() {
  const { user, loading, logout } = useAuth()
  const isLoggedIn = Boolean(user)
  const userIdentity = String(user?.id ?? user?.email ?? '')
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)
  const [lojaAberta, setLojaAberta] = useState(false)
  const [contaAberta, setContaAberta] = useState(false)
  const [tema, setTema] = useState(obterTemaInicial)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const accountRef = useRef(null)
  const storeRef = useRef(null)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)
  const notificationsRef = useRef(null)
  const lojaAtiva = ['/loja', '/pecas', '/notebooks', '/ofertas', '/produto'].some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))
  const lojaLabel = getStoreSectionLabel(location)
  const lojaSecaoAtiva = location.pathname.startsWith('/loja')
    ? new URLSearchParams(location.search).get('secao')
    : null

  const carregarNotificacoes = useCallback(async () => {
    if (!isLoggedIn) {
      setNotifications([])
      setUnreadNotifications(0)
      return
    }
    try {
      const result = await getNotifications(30)
      setNotifications(result.notifications)
      setUnreadNotifications(result.unread)
    } catch {
      // A notificação é auxiliar e não deve interromper a navegação.
    }
  }, [isLoggedIn, userIdentity])

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    document.documentElement.dataset.tema = tema === 'dark' ? 'escuro' : 'claro'
    localStorage.setItem(CHAVE_TEMA, tema)
  }, [tema])

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([])
      setUnreadNotifications(0)
      return undefined
    }

    let active = true
    const updateNotifications = () => {
      if (!active || document.visibilityState === 'hidden') return
      carregarNotificacoes()
    }

    updateNotifications()
    const timer = window.setInterval(updateNotifications, 30000)
    window.addEventListener('focus', updateNotifications)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', updateNotifications)
    }
  }, [isLoggedIn, userIdentity, carregarNotificacoes])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) setContaAberta(false)
      if (storeRef.current && !storeRef.current.contains(event.target)) setLojaAberta(false)
      if (searchRef.current && !searchRef.current.contains(event.target)) setBuscaAberta(false)
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) setNotificacoesAbertas(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setMenuAberto(false)
      setLojaAberta(false)
      setContaAberta(false)
      setBuscaAberta(false)
      setNotificacoesAbertas(false)
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const fecharMenus = () => {
    setMenuAberto(false)
    setLojaAberta(false)
    setContaAberta(false)
    setBuscaAberta(false)
    setNotificacoesAbertas(false)
  }

  function toggleStore() {
    setLojaAberta((value) => !value)
    setContaAberta(false)
    setBuscaAberta(false)
  }

  function toggleAccount() {
    setContaAberta((value) => !value)
    setLojaAberta(false)
    setBuscaAberta(false)
    setNotificacoesAbertas(false)
  }

  function toggleSearch() {
    setBuscaAberta((value) => {
      const next = !value
      if (next) window.requestAnimationFrame(() => searchInputRef.current?.focus())
      return next
    })
    setLojaAberta(false)
    setContaAberta(false)
  }

  function submitSearch(event) {
    event.preventDefault()
    const term = busca.trim()
    if (!term) {
      searchInputRef.current?.focus()
      return
    }
    navigate(`/loja?busca=${encodeURIComponent(term)}`)
    setBuscaAberta(false)
    setMenuAberto(false)
  }

  async function handleLogout() {
    await logout()
    setNotifications([])
    setUnreadNotifications(0)
    fecharMenus()
  }

  async function abrirNotificacao(item, url) {
    if (item?.id && item?.lida !== true) {
      setNotifications((current) => current.map((notification) => (
        notification?.id === item.id ? { ...notification, lida: true } : notification
      )))
      setUnreadNotifications((current) => Math.max(0, current - 1))
      markNotificationRead(item.id).catch(() => carregarNotificacoes())
    }
    fecharMenus()
    navigate(url)
  }

  return (
    <header className="site-header">
      <div className="site-header__inner page-container">
        <Link className="site-logo" to="/" onClick={fecharMenus}>CriaByte</Link>

        <button
          className="mobile-menu-button"
          type="button"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-controls="menu-principal"
          aria-expanded={menuAberto}
          onClick={() => {
            setMenuAberto((value) => !value)
            setLojaAberta(false)
            setContaAberta(false)
            setBuscaAberta(false)
          }}
        >
          {menuAberto ? '×' : '☰'}
        </button>

        <nav id="menu-principal" className={`site-nav ${menuAberto ? 'site-nav--open' : ''}`} aria-label="Menu principal">
          <NavLink to="/montar" onClick={fecharMenus}>Monte seu PC</NavLink>
          <NavLink to="/" onClick={fecharMenus}>Início</NavLink>
          <NavLink to="/montados" onClick={fecharMenus}>Montados</NavLink>

          <div className={`store-menu ${lojaAberta ? 'store-menu--open' : ''}`} ref={storeRef}>
            <button
              type="button"
              className={`store-menu__trigger ${lojaAtiva ? 'active' : ''}`}
              aria-controls="menu-loja"
              aria-expanded={lojaAberta}
              onClick={toggleStore}
            >
              <span className="store-menu__label">{lojaLabel}</span> <span aria-hidden="true">▾</span>
            </button>
            <div id="menu-loja" className="store-menu__dropdown store-menu__mega">
              {STORE_MENU_SECTIONS.map((section) => (
                <section className="store-menu__section" key={section.title}>
                  <Link
                    className={`store-menu__section-title ${lojaSecaoAtiva === section.id ? 'is-active' : ''}`.trim()}
                    to={`/loja?secao=${section.id}`}
                    onClick={fecharMenus}
                  >
                    {section.title}
                  </Link>
                  <div>
                    {section.links.map(([label, to]) => (
                      <NavLink key={to} to={to} onClick={fecharMenus}>{label}</NavLink>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <NavLink to="/comunidade" onClick={fecharMenus}>Comunidade</NavLink>

          <div className="mobile-nav-tools">
            <button
              type="button"
              className="mobile-nav-theme"
              onClick={() => setTema((value) => value === 'dark' ? 'light' : 'dark')}
            >
              <span aria-hidden="true">{tema === 'dark' ? '☀' : '◐'}</span>
              <span>{tema === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}</span>
            </button>

            {!loading && !user && (
              <Link className="mobile-nav-profile" to="/entrar" onClick={fecharMenus}>Entrar</Link>
            )}

            {!loading && user && (
              <div className="mobile-nav-account">
                <div className="mobile-nav-account__identity">
                  <span className="account-menu__avatar" aria-hidden="true">{initials(user.nome)}</span>
                  <span><strong>{user.nome}</strong><small>{user.email}</small></span>
                </div>
                <Link to="/conta" onClick={fecharMenus}>Minha conta</Link>
                <Link to="/conta/editar" onClick={fecharMenus}>Alterar cadastro</Link>
                <Link to="/minhas-builds" onClick={fecharMenus}>Minhas builds</Link>
                <Link to="/comunidade/publicar" onClick={fecharMenus}>Publicar build</Link>
                <Link to="/enviar-oferta" onClick={fecharMenus}>Enviar oferta</Link>
                {['ADMIN', 'EDITOR', 'REVISOR'].includes(String(user.papel || '').toUpperCase()) && <Link to="/admin" onClick={fecharMenus}>Abrir Admin</Link>}
                {['ADMIN', 'EDITOR'].includes(String(user.papel || '').toUpperCase()) && <Link to="/busca-ofertas" onClick={fecharMenus}>Busca de Ofertas</Link>}
                <button type="button" onClick={handleLogout}>Sair</button>
              </div>
            )}
          </div>
        </nav>

        <div className="site-header__actions">
          <div className={`header-search ${buscaAberta ? 'header-search--open' : ''}`} ref={searchRef}>
            <button
              type="button"
              className="header-search__trigger"
              aria-label="Pesquisar produtos"
              aria-controls="pesquisa-global"
              aria-expanded={buscaAberta}
              title="Pesquisar"
              onClick={toggleSearch}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m16 16 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <form id="pesquisa-global" className="header-search__panel" role="search" onSubmit={submitSearch}>
              <label htmlFor="pesquisa-global-campo">Pesquisar no catálogo</label>
              <div>
                <input
                  id="pesquisa-global-campo"
                  ref={searchInputRef}
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Produto, marca ou categoria"
                  autoComplete="off"
                />
                <button type="submit">Buscar</button>
              </div>
            </form>
          </div>

          <button
            type="button"
            className="theme-button"
            aria-label={tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={() => setTema((value) => value === 'dark' ? 'light' : 'dark')}
          >
            {tema === 'dark' ? '☀' : '◐'}
          </button>

          {!loading && !user && (
            <Link className="login-button" to="/entrar" onClick={fecharMenus}>Entrar</Link>
          )}

          {!loading && user && (
            <div className={`header-notifications ${notificacoesAbertas ? 'header-notifications--open' : ''}`} ref={notificationsRef}>
              <button
                className="header-notifications__trigger"
                type="button"
                aria-label={unreadNotifications ? `${unreadNotifications} notificações não lidas` : 'Notificações'}
                aria-expanded={notificacoesAbertas}
                onClick={() => {
                  setNotificacoesAbertas((value) => {
                    const next = !value
                    if (next) carregarNotificacoes()
                    return next
                  })
                  setContaAberta(false); setLojaAberta(false); setBuscaAberta(false)
                }}
              >
                <span aria-hidden="true">🔔</span>
                {unreadNotifications > 0 && <b>{unreadNotifications > 99 ? '99+' : unreadNotifications}</b>}
              </button>
              <div className="header-notifications__panel">
                <header><strong>Notificações</strong><span>Comentários, respostas e alterações nas suas publicações</span></header>
                {notifications.length ? (
                  <div className="header-notifications__list">
                    {notifications.slice(0, 8).map((item, index) => {
                      const view = notificationView(item)
                      return (
                        <button
                          key={item?.id || index}
                          type="button"
                          className={`${item?.lida === false ? 'is-unread ' : ''}notification-tone-${view.tone}`.trim()}
                          onClick={() => abrirNotificacao(item, view.url)}
                        >
                          <strong>{view.title}</strong>
                          <span>{view.message}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : <p className="header-notifications__empty">Nenhuma notificação por enquanto.</p>}
              </div>
            </div>
          )}

          {!loading && user && (
            <div className={`account-menu ${contaAberta ? 'account-menu--open' : ''}`} ref={accountRef}>
              <button
                type="button"
                className="account-menu__trigger"
                aria-controls="menu-conta"
                aria-expanded={contaAberta}
                onClick={toggleAccount}
              >
                <span className="account-menu__avatar" aria-hidden="true">{initials(user.nome)}</span>
                <span className="account-menu__name">{user.nome.split(' ')[0]}</span>
                <span aria-hidden="true">▾</span>
              </button>

              <div id="menu-conta" className="account-menu__dropdown">
                <div className="account-menu__identity">
                  <strong>{user.nome}</strong>
                  <span>{user.email}</span>
                </div>
                <Link to="/conta" onClick={fecharMenus}>Minha conta</Link>
                <Link to="/conta/editar" onClick={fecharMenus}>Alterar cadastro</Link>
                <Link to="/minhas-builds" onClick={fecharMenus}>Minhas builds</Link>
                <Link to="/comunidade/publicar" onClick={fecharMenus}>Publicar build</Link>
                <Link to="/enviar-oferta" onClick={fecharMenus}>Enviar oferta</Link>
                {['ADMIN', 'EDITOR', 'REVISOR'].includes(String(user.papel || '').toUpperCase()) && <Link to="/admin" onClick={fecharMenus}>Abrir Admin</Link>}
                {['ADMIN', 'EDITOR'].includes(String(user.papel || '').toUpperCase()) && <Link to="/busca-ofertas" onClick={fecharMenus}>Busca de Ofertas</Link>}
                <button type="button" onClick={handleLogout}>Sair</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
