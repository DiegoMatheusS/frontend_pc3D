import { Link } from 'react-router-dom'
import './Footer.css'

const hardwareLinks = [
  ['Processadores', '/pecas?categoria=processador'],
  ['Coolers de processador', '/pecas?categoria=cooler'],
  ['Placas de vídeo', '/pecas?categoria=placa-video'],
  ['Placas-mãe', '/pecas?categoria=placa-mae'],
  ['Memórias', '/pecas?categoria=memoria'],
  ['Armazenamentos', '/pecas?categoria=armazenamento'],
  ['Gabinetes', '/pecas?categoria=gabinete'],
  ['Fontes', '/pecas?categoria=fonte'],
]

const storeLinks = [
  ['Monitores', '/loja?grupo=monitores'],
  ['Mouses', '/loja?grupo=perifericos&categoria=mouse'],
  ['Teclados', '/loja?grupo=perifericos&categoria=teclado'],
  ['Headsets e fones', '/loja?grupo=perifericos'],
  ['Mousepads', '/loja?grupo=setup&categoria=mousepad'],
  ['Cadeiras e setup', '/loja?grupo=setup'],
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__content">
        <div className="site-footer__columns">
          <section className="site-footer__intro">
            <Link className="site-footer__logo" to="/">PC <span>BUILDER</span></Link>
            <p>Monte, compare e compartilhe configurações de PC com informações técnicas, ofertas e comunidade.</p>
            <Link className="site-footer__primary-link" to="/montar">Monte seu PC em 3D →</Link>
          </section>

          <section className="site-footer__column">
            <h2>CriaByte</h2>
            <nav aria-label="CriaByte no rodapé">
              <Link to="/">Início</Link>
              <Link to="/montar">Monte seu PC</Link>
              <Link to="/montados">PCs Montados</Link>
              <Link to="/notebooks">Notebooks</Link>
              <Link to="/ofertas">Ofertas</Link>
              <Link to="/comunidade">Comunidade</Link>
            </nav>
          </section>

          <section className="site-footer__column">
            <h2>Hardware</h2>
            <nav aria-label="Hardware no rodapé">
              {hardwareLinks.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
            </nav>
          </section>

          <section className="site-footer__column">
            <h2>Periféricos e setup</h2>
            <nav aria-label="Periféricos no rodapé">
              {storeLinks.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
            </nav>
          </section>

          <section className="site-footer__column">
            <h2>Sobre</h2>
            <nav aria-label="Institucional no rodapé">
              <Link to="/sobre">Sobre nós</Link>
              <Link to="/termos">Termos de uso</Link>
              <Link to="/privacidade">Política de privacidade</Link>
              <Link to="/cookies">Preferências de cookies</Link>
              <Link to="/contato">Contato</Link>
            </nav>
          </section>
        </div>

        <div className="site-footer__bottom">
          <p>© 2026 CriaByte</p>
          <p>Marcas e imagens de produtos pertencem aos seus respectivos proprietários.</p>
        </div>
      </div>
    </footer>
  )
}
