import { useState } from 'react'

function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

const iconesCompatibilidade = {
  selecionada: '✓',
  compativel: '✓',
  atencao: '!',
  incompativel: '×',
  neutro: 'i',
}

function fallbackImagem(evento) {
  const imagem = evento.currentTarget
  imagem.onerror = null
  imagem.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22200%22 viewBox=%220 0 320 200%22%3E%3Crect width=%22320%22 height=%22200%22 fill=%22%23e5e7eb%22/%3E%3Ctext x=%22160%22 y=%22105%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2216%22 fill=%22%236b7280%22%3ESem imagem%3C/text%3E%3C/svg%3E'
}

function bridge() {
  return globalThis.PCBuilderLegacyBridge
}

export default function BuilderPartsList({ estado, termoPesquisa, somenteCompativeis }) {
  const [fluxosCandidatos, setFluxosCandidatos] = useState({})
  const apiLegada = bridge()

  if (!estado.catalogoPronto || !apiLegada?.obterListaPecas) {
    return <p className="mensagem-builder">Carregando componentes...</p>
  }

  const lista = apiLegada.obterListaPecas({
    categoria: estado.categoriaAtual,
    termo: termoPesquisa,
    somenteCompativeis,
  })

  if (lista?.modo === 'slots') {
    return (
      <div className="builder-react-lista" data-modo="slots">
        {lista.itens.map((item) => (
          <article
            className={`card-peca-mini ${item.peca ? 'selecionada' : ''}`}
            data-categoria={lista.categoria}
            data-peca-id={item.peca?.id || ''}
            data-slot={item.slot}
            key={`${lista.categoria}-${item.slot}`}
          >
            <img
              alt={item.nomeSlot}
              className="imagem-peca-mini"
              decoding="async"
              height="200"
              loading="lazy"
              onError={fallbackImagem}
              src={item.peca?.imagem || ''}
              width="320"
            />

            <div className="info-peca-mini">
              <small className="categoria-peca-mini">{item.nomeSlot}</small>
              <h4>{item.peca?.nome || 'Slot vazio'}</h4>
              <span className="preco-peca-mini">
                {item.peca ? formatarPreco(item.peca.preco) : 'Escolher componente'}
              </span>

              {item.peca?.linkCompra && (
                <a
                  aria-label={`Ver nas lojas: ${item.peca.nome}`}
                  className="link-loja-peca"
                  href={item.peca.linkCompra}
                  rel="sponsored noopener noreferrer"
                  target="_blank"
                >
                  Ver nas lojas
                </a>
              )}

              {lista.categoria === 'ventoinhas' && !item.peca && (
                <span className="recomendacao-fluxo-fan">
                  Recomendado: {item.fluxoRecomendado === 'out' ? 'Saída' : 'Entrada'}
                </span>
              )}

              {lista.categoria === 'ventoinhas' && item.peca && (
                <label className="controle-fluxo-fan">
                  <span>Fluxo</span>
                  <select
                    aria-label={`Alterar direção da ${item.nomeSlot}`}
                    onChange={(evento) => apiLegada.definirFluxoVentoinha?.(item.slot, evento.target.value)}
                    value={item.peca.fluxo || 'in'}
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Saída</option>
                  </select>
                </label>
              )}
            </div>

            <button
              aria-label={item.peca ? `Remover peça da ${item.nomeSlot}` : `Escolher peça para ${item.nomeSlot}`}
              className="btn-add-peca"
              onClick={() => {
                if (item.peca) apiLegada.removerSlot?.(lista.categoria, item.slot)
                else apiLegada.abrirSlot?.(lista.categoria, item.slot)
              }}
              type="button"
            >
              {item.peca ? '✓' : '+'}
            </button>
          </article>
        ))}
      </div>
    )
  }

  const itens = lista?.itens || []
  const termoAtivo = termoPesquisa.trim()

  return (
    <div className="builder-react-lista" data-modo="pecas">
      {lista?.slot !== null && lista?.slot !== undefined && (
        <button
          className="btn-voltar-slots"
          onClick={() => apiLegada.voltarSlots?.(lista.categoria)}
          type="button"
        >
          ← Voltar para os slots
        </button>
      )}

      {itens.length === 0 ? (
        <p className="mensagem-builder mensagem-filtro-compativel">
          {termoAtivo
            ? `Nenhum hardware encontrado para “${termoAtivo}”.`
            : somenteCompativeis && estado.diagnostico?.temPecas
              ? 'Nenhuma opção sem conflito nesta categoria. Desative o filtro para revisar todas.'
              : 'Nenhuma peça encontrada nesta categoria.'}
        </p>
      ) : itens.map((item) => {
        const fluxo = fluxosCandidatos[item.id] || 'in'
        const compatibilidade = item.compatibilidade || { tipo: 'neutro', texto: 'Compatibilidade será validada' }
        const icone = iconesCompatibilidade[compatibilidade.tipo] || 'i'

        return (
          <article
            className={`card-peca-mini ${item.selecionada ? 'selecionada' : ''}`}
            data-categoria={item.categoria}
            data-conflito={compatibilidade.tipo === 'incompativel' ? 'true' : 'false'}
            data-peca-id={item.id}
            key={`${item.categoria}-${item.id}`}
            onClick={(evento) => {
              if (evento.target.closest('button, select, input, label, a')) return
              apiLegada.destacarPeca?.(item.categoria, item.id)
            }}
          >
            <img
              alt={item.nome}
              className="imagem-peca-mini"
              decoding="async"
              height="200"
              loading="lazy"
              onError={fallbackImagem}
              src={item.imagem}
              width="320"
            />

            <div className="info-peca-mini">
              <small className="categoria-peca-mini">{item.nomeCategoria}</small>
              <h4>{item.nome}</h4>
              <span className="preco-peca-mini">{formatarPreco(item.preco)}</span>

              <span
                className="compatibilidade-card-builder"
                data-tipo={compatibilidade.tipo}
                title={compatibilidade.texto}
              >
                <span aria-hidden="true">{icone}</span>
                {compatibilidade.texto}
              </span>

              {item.linkCompra && (
                <a
                  aria-label={`Ver nas lojas: ${item.nome}`}
                  className="link-loja-peca"
                  href={item.linkCompra}
                  rel="sponsored noopener noreferrer"
                  target="_blank"
                >
                  Ver nas lojas
                </a>
              )}

              {item.aceitaFluxo && (
                <label className="controle-fluxo-fan">
                  <span>Fluxo</span>
                  <select
                    aria-label="Direção do fluxo de ar"
                    onChange={(evento) => setFluxosCandidatos((atual) => ({ ...atual, [item.id]: evento.target.value }))}
                    value={fluxo}
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Saída</option>
                  </select>
                </label>
              )}
            </div>

            {item.precisaEscolherSlot ? (
              <button
                aria-label={`Abrir ${item.nomeCategoria} para escolher o slot`}
                className="btn-add-peca btn-ir-categoria"
                onClick={() => apiLegada.selecionarCategoria?.(item.categoria)}
                title="Escolher slot"
                type="button"
              >
                →
              </button>
            ) : (
              <button
                aria-label={`${item.selecionada ? 'Remover' : 'Adicionar'} ${item.nome}`}
                aria-pressed={item.selecionada}
                className="btn-add-peca"
                onClick={() => apiLegada.selecionarPeca?.(
                  item.categoria,
                  item.id,
                  item.slot ?? '',
                  item.aceitaFluxo ? fluxo : '',
                )}
                type="button"
              >
                {item.selecionada ? '✓' : '+'}
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}
