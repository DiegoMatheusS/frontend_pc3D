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
  ['Celulares', '/loja?grupo=celulares'],
  ['Tablets', '/loja?grupo=tablets'],
  ['Games', '/loja?grupo=games'],
  ['TV e Áudio', '/loja?grupo=tv-audio'],
  ['Foto e Vídeo', '/loja?grupo=fotografia'],
  ['Casa Inteligente', '/loja?grupo=casa-inteligente'],
  ['Eletroportáteis', '/loja?grupo=eletroportateis'],
  ['Rede e Internet', '/loja?grupo=rede'],
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__content">
        <div className="site-footer__columns">
          <section className="site-footer__intro">
            <Link className="site-footer__logo" to="/">CRIA<span>BYTE</span></Link>
            <p>Compare eletrônicos, encontre ofertas e monte seu PC com informações técnicas e comunidade.</p>
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
            <h2>Loja de eletrônicos</h2>
            <nav aria-label="Loja de eletrônicos no rodapé">
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
