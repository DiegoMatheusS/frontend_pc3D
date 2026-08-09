import { Outlet, useLocation } from 'react-router-dom'
import Header from '../Header/Header'
import Footer from '../Footer/Footer'
import RouteEffects from '../RouteEffects/RouteEffects'
import AIAssistant from '../AIAssistant/AIAssistant'

export default function Layout() {
  const location = useLocation()
  const isBuilder = location.pathname === '/montar'

  return (
    <div className={`app-shell ${isBuilder ? 'app-shell--builder' : ''}`}>
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
      <RouteEffects />
      <Header />
      <main id="conteudo-principal" className="app-main" tabIndex="-1">
        <Outlet />
      </main>
      {!isBuilder && <Footer />}
      <AIAssistant />
    </div>
  )
}
