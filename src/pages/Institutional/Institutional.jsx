import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Institutional.css'

const pages = {
  sobre: {
    title: 'Sobre o CriaByte',
    intro: 'Uma plataforma criada para facilitar a escolha, a compatibilidade e a visualização de peças de computador.',
    sections: [
      ['Quem somos', [
        'O CriaByte é um projeto voltado para pessoas que desejam montar um computador, comparar configurações e entender melhor como cada componente participa da montagem.',
        'Nossa proposta é reunir informações sobre hardware com uma experiência visual em 3D, permitindo que o usuário visualize as peças antes de montar o computador real.',
      ]],
      ['Como o projeto funciona', []],
      ['Nosso objetivo', ['Queremos tornar a montagem de computadores mais acessível, visual e segura, principalmente para quem está montando o primeiro PC.']],
    ],
    highlights: [
      ['Montagem em 3D', 'Escolha gabinete, placa-mãe, processador, memória, armazenamento, placa de vídeo e outras peças.'],
      ['Compatibilidade', 'O sistema ajuda a identificar combinações incompatíveis e possíveis problemas entre os componentes.'],
      ['PCs e ofertas', 'Compare configurações, encontre ofertas e visualize a montagem antes de acessar a loja.'],
    ],
  },
  privacidade: {
    title: 'Política de privacidade',
    intro: 'Esta página explica como informações podem ser coletadas e utilizadas durante o acesso ao CriaByte.',
    updated: 'Última atualização: agosto de 2026.',
    sections: [
      ['1. Informações fornecidas pelo usuário', ['Podemos receber informações enviadas voluntariamente, como nome, e-mail e mensagens de contato, além dos dados necessários para criar e manter sua conta.']],
      ['2. Informações técnicas', ['O navegador pode fornecer dados técnicos básicos, como tipo de dispositivo, navegador utilizado, resolução de tela, páginas acessadas e possíveis mensagens de erro.']],
      ['3. Armazenamento no navegador', ['O CriaByte pode utilizar sessionStorage ou localStorage para preferências da interface, tema e configurações temporárias, incluindo builds salvas neste navegador.']],
      ['4. Uso das informações', ['As informações podem ser utilizadas para prestar o serviço, responder solicitações, melhorar funcionalidades, identificar falhas técnicas e proteger a plataforma contra usos indevidos.']],
      ['5. Compartilhamento', ['Não comercializamos informações pessoais. Dados poderão ser compartilhados apenas quando necessários ao funcionamento de serviços utilizados pelo site ou quando exigidos legalmente.']],
      ['6. Links externos', ['O site pode apresentar links para lojas e serviços externos. O CriaByte não controla as práticas de privacidade desses sites.']],
      ['7. Segurança', ['Adotamos medidas razoáveis para proteger as informações, mas nenhum sistema conectado à internet pode garantir segurança absoluta.']],
    ],
  },
  termos: {
    title: 'Termos de uso',
    intro: 'Estes termos apresentam as condições gerais para utilização do CriaByte.',
    updated: 'Última atualização: agosto de 2026.',
    sections: [
      ['1. Aceitação dos termos', ['Ao acessar e utilizar o CriaByte, você declara que leu e concorda com as condições apresentadas nesta página.']],
      ['2. Finalidade da plataforma', ['O CriaByte oferece ferramentas de visualização, comparação, comunidade, organização de peças e consulta de ofertas.', 'As informações possuem finalidade informativa e podem não representar todas as características técnicas ou condições comerciais de um produto.']],
      ['3. Compatibilidade das peças', ['O sistema procura ajudar na verificação de compatibilidade, mas o usuário deve confirmar as especificações diretamente com fabricantes e vendedores antes de realizar uma compra.']],
      ['4. Modelos e visualizações em 3D', ['Os modelos em 3D são representações visuais. Dimensões, cores, detalhes e proporções podem apresentar diferenças em relação aos produtos reais.']],
      ['5. Preços e lojas externas', ['Preços, disponibilidade, frete e condições de pagamento podem ser alterados pelas lojas sem aviso prévio.', 'Ao acessar um link externo, o usuário passa a estar sujeito aos termos, políticas e condições da loja correspondente.']],
      ['6. Uso permitido', ['Não é permitido utilizar a plataforma para comprometer o funcionamento do serviço, praticar atividades ilegais ou utilizar automações de forma abusiva.']],
      ['7. Alterações no serviço', ['Funcionalidades, conteúdos e estes termos podem ser modificados para acompanhar a evolução do projeto.']],
    ],
  },
  cookies: {
    title: 'Preferências de cookies',
    intro: 'Entenda como o CriaByte pode utilizar cookies e recursos de armazenamento do navegador.',
    updated: 'Última atualização: agosto de 2026.',
    sections: [
      ['O que são cookies?', ['Cookies são pequenos arquivos armazenados pelo navegador para lembrar informações e preferências durante a navegação.']],
      ['Armazenamento utilizado pelo CriaByte', ['O projeto pode utilizar armazenamento do navegador para sessão, tema, configurações temporárias, builds locais e preferências da interface.']],
      ['Cookies necessários', ['São recursos utilizados para manter funcionalidades básicas, como autenticação, preferências e configurações temporárias.']],
      ['Cookies de análise', ['Caso ferramentas de análise sejam adicionadas, elas poderão ajudar a entender quais páginas são mais acessadas e onde existem problemas de navegação.']],
      ['Como controlar o armazenamento', ['Você pode limpar ou bloquear cookies e dados armazenados utilizando as configurações do navegador. Algumas funcionalidades poderão deixar de operar corretamente.']],
    ],
  },
}

function ContactPage() {
  const [status, setStatus] = useState(null)
  const contactEmail = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim()

  function submitContact(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!contactEmail) {
      setStatus({ type: 'error', text: 'O canal de contato por e-mail está temporariamente indisponível.' })
      return
    }

    const name = String(form.get('nome') || '').trim()
    const email = String(form.get('email') || '').trim()
    const subject = String(form.get('assunto') || 'Contato pelo CriaByte').trim()
    const message = String(form.get('mensagem') || '').trim()
    const body = [`Nome: ${name}`, `E-mail: ${email}`, '', message].join('\n')
    const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(`[CriaByte] ${subject}`)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
    setStatus({ type: 'success', text: `Abrimos seu aplicativo de e-mail com a mensagem pronta para ${contactEmail}.` })
  }

  return (
    <InstitutionalShell title="Entre em contato" intro="Envie dúvidas, sugestões, correções ou propostas relacionadas ao CriaByte.">
      <form className="contact-form" onSubmit={submitContact}>
        <div className="contact-field"><label htmlFor="contact-name">Nome</label><input id="contact-name" name="nome" required maxLength={120} autoComplete="name" /></div>
        <div className="contact-field"><label htmlFor="contact-email">E-mail</label><input id="contact-email" type="email" name="email" required autoComplete="email" /></div>
        <div className="contact-field contact-field--full"><label htmlFor="contact-subject">Assunto</label><select id="contact-subject" name="assunto" required defaultValue=""><option value="" disabled>Selecione um assunto</option><option>Dúvida</option><option>Sugestão</option><option>Informar erro</option><option>Anúncios e parcerias</option><option>Outro assunto</option></select></div>
        <div className="contact-field contact-field--full"><label htmlFor="contact-message">Mensagem</label><textarea id="contact-message" name="mensagem" required maxLength={5000} /></div>
        <button className="button button--primary" type="submit">Enviar mensagem</button>
        {status && <p className={`contact-message ${status.type === 'error' ? 'contact-message--error' : ''}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.text}</p>}
      </form>
    </InstitutionalShell>
  )
}

function InstitutionalShell({ title, intro, updated, children }) {
  return <main className="institutional-page"><div className="page-container"><article className="institutional-card"><header className="institutional-top"><h1>{title}</h1><p>{intro}</p>{updated && <span className="institutional-updated">{updated}</span>}</header>{children}</article></div></main>
}

export default function Institutional({ page }) {
  if (page === 'contato') return <ContactPage />
  const content = pages[page]
  if (!content) return null
  return (
    <InstitutionalShell title={content.title} intro={content.intro} updated={content.updated}>
      {content.sections.map(([title, paragraphs], index) => (
        <section className="institutional-section" key={`${title}-${index}`}>
          <h2>{title}</h2>
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {page === 'sobre' && title === 'Como o projeto funciona' && <div className="about-highlights">{content.highlights.map(([heading, text]) => <article className="about-highlight" key={heading}><h3>{heading}</h3><p>{text}</p></article>)}</div>}
        </section>
      ))}
      <section className="institutional-section"><h2>Contato</h2><p>Dúvidas, correções ou sugestões podem ser enviadas pela página de <Link to="/contato">contato</Link>.</p></section>
    </InstitutionalShell>
  )
}
