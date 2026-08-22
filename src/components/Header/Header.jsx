import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/authContext'
import './Header.css'

const CHAVE_TEMA = 'pcBuilderTema'

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
    const group = params.get('grupo')
    if (group === 'perifericos') return 'Periféricos'
    if (group === 'monitores') return 'Monitores'
    if (group === 'setup') return 'Setup'
  }
  return 'Loja'
}

function initials(name = '') {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] || 'C'}${parts[1]?.[0] || 'B'}`.toUpperCase()
}

export default function Header() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)
  const [lojaAberta, setLojaAberta] = useState(false)
  const [contaAberta, setContaAberta] = useState(false)
  const [tema, setTema] = useState(obterTemaInicial)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const accountRef = useRef(null)
  const storeRef = useRef(null)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)
  const lojaAtiva = ['/loja', '/pecas', '/notebooks', '/ofertas', '/produto'].some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))
  const lojaLabel = getStoreSectionLabel(location)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    // Mantém também o atributo usado pelo CSS legado do montador/IA.
    document.documentElement.dataset.tema = tema === 'dark' ? 'escuro' : 'claro'
    localStorage.setItem(CHAVE_TEMA, tema)
  }, [tema])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setContaAberta(false)
      }
      if (storeRef.current && !storeRef.current.contains(event.target)) {
        setLojaAberta(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setBuscaAberta(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setMenuAberto(false)
      setLojaAberta(false)
      setContaAberta(false)
      setBuscaAberta(false)
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
    fecharMenus()
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
            <div id="menu-loja" className="store-menu__dropdown">
              <NavLink to="/loja" onClick={fecharMenus}>Todos os produtos</NavLink>
              <NavLink to="/pecas" onClick={fecharMenus}>Peças</NavLink>
              <NavLink to="/loja?grupo=perifericos" onClick={fecharMenus}>Periféricos</NavLink>
              <NavLink to="/loja?grupo=monitores" onClick={fecharMenus}>Monitores</NavLink>
              <NavLink to="/notebooks" onClick={fecharMenus}>Notebooks</NavLink>
              <NavLink to="/loja?grupo=setup" onClick={fecharMenus}>Setup</NavLink>
              <NavLink to="/ofertas" onClick={fecharMenus}>Ofertas</NavLink>
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
