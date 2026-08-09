/**
 * CriaByte — Assistente de IA do montador legado.
 * Integra chat livre + montagem guiada estruturada do backend.
 */

const CHAVE_BALAO_VISTO = "pcBuilderIaBalaoVisto";
const CHAVE_HISTORICO_SESSAO = "pcBuilderIaHistorico";
const LIMITE_HISTORICO = 12;
const API_BASE = (globalThis.PC_BUILDER_API_CONFIG?.baseUrl ?? "") + "/api";

const ROTULOS_ETAPA = {
  PROCESSADOR: "Processador",
  PLACA_MAE: "Placa-mãe",
  MEMORIA_RAM: "Memória RAM",
  PLACA_VIDEO: "Placa de vídeo",
  ARMAZENAMENTO: "Armazenamento",
  FONTE: "Fonte",
  GABINETE: "Gabinete",
  COOLER: "Cooler",
  VENTOINHA: "Ventoinhas",
  RESUMO: "Resumo",
};

const CATEGORIA_BUILDER = {
  PROCESSADOR: "processador",
  PLACA_MAE: "placamae",
  MEMORIA_RAM: "memoria",
  PLACA_VIDEO: "placavideo",
  ARMAZENAMENTO: "armazenamento",
  FONTE: "fonte",
  GABINETE: "gabinete",
  COOLER: "cooler",
  VENTOINHA: "ventoinhas",
};

const ROTULOS_COMPATIBILIDADE = {
  COMPATIVEL: "Compatível",
  INCOMPATIVEL: "Incompatível",
  COMPATIBILIDADE_PARCIAL: "Compatibilidade parcial",
  DADOS_INSUFICIENTES: "Dados insuficientes",
};

let _painelEl = null;
let _btnFlutuanteEl = null;
let _overlayEl = null;
let _mensagensEl = null;
let _textareaEl = null;
let _enviarEl = null;
let _aguardandoResposta = false;
let _contextoBuild = null;
let _historico = [];
let _fluxoGuiado = null;
let _metaFluxo = {};

function _escaparHtml(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function _formatarTexto(texto = "") {
  return _escaparHtml(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function _formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return "Preço indisponível";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function _classeCompatibilidade(status = "DADOS_INSUFICIENTES") {
  return String(status).toLowerCase().replaceAll("_", "-");
}

function _carregarHistorico() {
  try {
    const dados = JSON.parse(sessionStorage.getItem(CHAVE_HISTORICO_SESSAO) || "[]");
    _historico = Array.isArray(dados) ? dados.slice(-LIMITE_HISTORICO) : [];
  } catch {
    _historico = [];
  }
}

function _salvarHistorico() {
  try {
    sessionStorage.setItem(CHAVE_HISTORICO_SESSAO, JSON.stringify(_historico.slice(-LIMITE_HISTORICO)));
  } catch {
    // O histórico é auxiliar; falhar aqui não deve interromper a IA.
  }
}

function _componentesParaApi(componentes = []) {
  return (Array.isArray(componentes) ? componentes : []).flatMap((item) => {
    if (!item?.categoria || !item?.nome) return [];
    const hardwareId = Number(item.hardwareId);
    return [{
      categoria: item.categoria,
      ...(Number.isInteger(hardwareId) && hardwareId > 0 ? { hardwareId } : {}),
      nome: String(item.nome).slice(0, 200),
      ...(item.marca ? { marca: String(item.marca).slice(0, 100) } : {}),
      ...(item.modelo ? { modelo: String(item.modelo).slice(0, 150) } : {}),
      ...(item.imagemUrl ? { imagemUrl: String(item.imagemUrl).slice(0, 500) } : {}),
      ...(item.modelo3dUrl ? { modelo3dUrl: String(item.modelo3dUrl).slice(0, 500) } : {}),
      quantidade: Math.max(1, Number(item.quantidade) || 1),
      origem: item.origem || (Number.isInteger(hardwareId) && hardwareId > 0 ? "CATALOGO" : "EXTERNO"),
      ...(item.especificacoes && typeof item.especificacoes === "object" ? { especificacoes: item.especificacoes } : {}),
      ...(item.fonteDadosUrl ? { fonteDadosUrl: String(item.fonteDadosUrl).slice(0, 500) } : {}),
    }];
  });
}

async function _requisitar(caminho, corpo) {
  const resposta = await fetch(`${API_BASE}${caminho}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corpo),
  });

  let dados = null;
  try { dados = await resposta.json(); } catch { dados = null; }
  if (!resposta.ok) {
    const mensagem = dados?.mensagem || dados?.message;
    if (resposta.status === 429) throw new Error("Muitas solicitações em pouco tempo. Aguarde um momento e tente novamente.");
    if (resposta.status === 503) throw new Error("O assistente inteligente está temporariamente indisponível.");
    throw new Error(typeof mensagem === "string" ? mensagem : `Erro ${resposta.status} ao contatar o assistente.`);
  }
  return dados;
}

function _chamarChat(mensagem) {
  const corpo = { mensagem, historico: _historico.slice(-LIMITE_HISTORICO) };
  if (_contextoBuild && Object.keys(_contextoBuild).length > 0) corpo.buildAtual = _contextoBuild;
  return _requisitar("/ia/chat", corpo);
}

function _chamarMontarPc(dados) {
  return _requisitar("/ia/montar-pc", dados);
}

function _chamarMontagemGuiada({ acao, selecao, filtro, pagina } = {}) {
  const corpo = {
    acao,
    ...(_fluxoGuiado?.etapa ? { etapaAtual: _fluxoGuiado.etapa } : {}),
    componentes: _componentesParaApi(_fluxoGuiado?.componentes),
    ...(_metaFluxo.orcamento ? { orcamento: _metaFluxo.orcamento } : {}),
    ...(_metaFluxo.uso ? { uso: _metaFluxo.uso } : {}),
    ...(selecao ? { selecao: _componentesParaApi([selecao])[0] } : {}),
    ...(filtro ? { filtro: String(filtro).slice(0, 80) } : {}),
    ...(Number.isInteger(pagina) ? { pagina } : {}),
  };
  return _requisitar("/ia/montagem-guiada", corpo);
}

function _adicionarMensagem(texto, papel = "assistente", acoes = []) {
  if (!_mensagensEl) return null;
  const msg = document.createElement("div");
  msg.className = `ia-msg ia-msg-${papel}`;
  msg.innerHTML = _formatarTexto(texto);

  if (acoes.length > 0 && papel === "assistente") {
    const divAcoes = document.createElement("div");
    divAcoes.className = "ia-acoes";
    acoes.forEach((acao) => {
      const btn = document.createElement("button");
      btn.className = "ia-acao-btn";
      btn.type = "button";
      btn.textContent = acao.rotulo;
      btn.addEventListener("click", () => _executarAcao(acao));
      divAcoes.appendChild(btn);
    });
    msg.appendChild(divAcoes);
  }

  _mensagensEl.appendChild(msg);
  _rolarParaBaixo();
  return msg;
}

function _mostrarDigitando(texto = "") {
  if (!_mensagensEl) return null;
  const el = document.createElement("div");
  el.className = "ia-digitando ia-digitando-com-texto";
  el.setAttribute("aria-label", texto || "Assistente está processando");
  el.innerHTML = `<span></span><span></span><span></span>${texto ? `<small>${_escaparHtml(texto)}</small>` : ""}`;
  _mensagensEl.appendChild(el);
  _rolarParaBaixo();
  return el;
}

function _rolarParaBaixo() {
  if (_mensagensEl) _mensagensEl.scrollTop = _mensagensEl.scrollHeight;
}

function _criarBotao(texto, classe, aoClicar) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = classe;
  btn.textContent = texto;
  btn.addEventListener("click", aoClicar);
  return btn;
}

function _renderizarCompatibilidade(container, compatibilidade) {
  if (!compatibilidade) return;
  const bloco = document.createElement("section");
  bloco.className = "ia-fluxo-compatibilidade";
  const status = compatibilidade.status || "DADOS_INSUFICIENTES";
  const badge = document.createElement("strong");
  badge.className = `ia-status-compatibilidade ${_classeCompatibilidade(status)}`;
  badge.textContent = ROTULOS_COMPATIBILIDADE[status] || status;
  bloco.appendChild(badge);

  const mensagens = [
    ...(compatibilidade.erros || []).map((texto) => ({ tipo: "erro", texto })),
    ...(compatibilidade.alertas || []).map((texto) => ({ tipo: "alerta", texto })),
  ].slice(0, 4);
  mensagens.forEach((item) => {
    const p = document.createElement("p");
    p.className = `ia-compat-msg ${item.tipo}`;
    p.textContent = item.texto;
    bloco.appendChild(p);
  });
  container.appendChild(bloco);
}

function _renderizarResumoCompra(container, fluxo) {
  const compra = fluxo?.compra;
  if (!compra) return;
  const box = document.createElement("section");
  box.className = "ia-fluxo-compra";
  const total = document.createElement("strong");
  total.textContent = compra.completo ? `Preço total: ${_formatarPreco(compra.valorTotal)}` : `Total das peças com preço: ${_formatarPreco(compra.valorTotal)}`;
  box.appendChild(total);
  const indisponiveis = (compra.itens || []).filter((item) => !item.compravel);
  if (indisponiveis.length) {
    const p = document.createElement("p");
    p.textContent = `${indisponiveis.length} peça(s) ainda sem oferta no catálogo.`;
    box.appendChild(p);
  }
  container.appendChild(box);
}

function _abrirFormularioExterno(container) {
  container.querySelector(".ia-form-externo")?.remove();
  const form = document.createElement("form");
  form.className = "ia-form-externo";
  form.innerHTML = `
    <strong>Adicionar ${_escaparHtml(ROTULOS_ETAPA[_fluxoGuiado?.etapa] || "peça")} fora do catálogo</strong>
    <label>Nome *</label><input name="nome" maxlength="200" required placeholder="Nome da peça">
    <div class="ia-form-duplo"><label>Marca<input name="marca" maxlength="100"></label><label>Modelo<input name="modelo" maxlength="150"></label></div>
    <label>Especificações técnicas (JSON)</label><textarea name="especificacoes" rows="3" placeholder='{"socket":"AM5","tdpWatts":120}'></textarea>
    <label>Fonte dos dados</label><input name="fonteDadosUrl" type="url" placeholder="https://fabricante.com/...">
    <label>Modelo 3D externo (opcional)</label><input name="modelo3dUrl" type="url" placeholder="https://.../modelo.glb">
    <div class="ia-form-acoes"><button type="button" class="ia-acao-btn" data-cancelar>Cancelar</button><button type="submit" class="ia-acao-btn ia-acao-btn-primary">Adicionar</button></div>
  `;
  form.querySelector("[data-cancelar]").addEventListener("click", () => form.remove());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const dados = new FormData(form);
    let especificacoes = {};
    const bruto = String(dados.get("especificacoes") || "").trim();
    if (bruto) {
      try { especificacoes = JSON.parse(bruto); }
      catch {
        _adicionarMensagem("As especificações precisam estar em JSON válido.", "assistente");
        return;
      }
    }
    const selecao = {
      categoria: _fluxoGuiado.etapa,
      nome: String(dados.get("nome") || "").trim(),
      marca: String(dados.get("marca") || "").trim() || undefined,
      modelo: String(dados.get("modelo") || "").trim() || undefined,
      especificacoes,
      fonteDadosUrl: String(dados.get("fonteDadosUrl") || "").trim() || undefined,
      modelo3dUrl: String(dados.get("modelo3dUrl") || "").trim() || undefined,
      origem: "EXTERNO",
      quantidade: 1,
    };
    await _executarFluxo({ acao: "SELECIONAR", selecao }, "Analisando a peça externa...");
  });
  container.appendChild(form);
  form.querySelector("input[name='nome']")?.focus();
}

function _renderizarFluxoGuiado(fluxo) {
  if (!_mensagensEl || !fluxo || fluxo.tipo !== "MONTAGEM_GUIADA") return;
  _fluxoGuiado = fluxo;
  _mensagensEl.querySelectorAll(".ia-fluxo-guiado.is-current").forEach((el) => el.classList.remove("is-current"));

  const painel = document.createElement("section");
  painel.className = "ia-fluxo-guiado is-current";
  painel.dataset.etapa = fluxo.etapa || "";

  const topo = document.createElement("header");
  topo.className = "ia-fluxo-topo";
  topo.innerHTML = `<span>Montagem guiada</span><strong>${_escaparHtml(ROTULOS_ETAPA[fluxo.etapa] || fluxo.etapa || "Etapa")}</strong>`;
  painel.appendChild(topo);

  if (fluxo.mensagem) {
    const mensagem = document.createElement("p");
    mensagem.className = "ia-fluxo-mensagem";
    mensagem.textContent = fluxo.mensagem;
    painel.appendChild(mensagem);
  }

  const opcoes = Array.isArray(fluxo.opcoes) ? fluxo.opcoes.slice(0, 5) : [];
  if (opcoes.length) {
    const grade = document.createElement("div");
    grade.className = "ia-opcoes-grade";
    opcoes.forEach((opcao) => {
      const card = document.createElement("article");
      card.className = "ia-opcao-card";
      if (opcao.imagemUrl) {
        const img = document.createElement("img");
        img.src = opcao.imagemUrl;
        img.alt = "";
        img.loading = "lazy";
        img.addEventListener("error", () => img.remove(), { once: true });
        card.appendChild(img);
      }
      const conteudo = document.createElement("div");
      conteudo.className = "ia-opcao-conteudo";
      const nome = document.createElement("strong");
      nome.textContent = opcao.titulo || opcao.selecao?.nome || "Opção";
      conteudo.appendChild(nome);
      if (opcao.subtitulo) {
        const sub = document.createElement("small"); sub.textContent = opcao.subtitulo; conteudo.appendChild(sub);
      }
      const meta = document.createElement("div"); meta.className = "ia-opcao-meta";
      if (opcao.preco != null) { const preco = document.createElement("span"); preco.textContent = _formatarPreco(opcao.preco); meta.appendChild(preco); }
      if (opcao.compatibilidade) {
        const status = document.createElement("span");
        status.className = `ia-mini-status ${_classeCompatibilidade(opcao.compatibilidade)}`;
        status.textContent = ROTULOS_COMPATIBILIDADE[opcao.compatibilidade] || opcao.compatibilidade;
        meta.appendChild(status);
      }
      conteudo.appendChild(meta);
      const selecionar = _criarBotao("Selecionar", "ia-acao-btn ia-acao-btn-primary", () => _executarFluxo({ acao: "SELECIONAR", selecao: opcao.selecao }, "Validando compatibilidade..."));
      conteudo.appendChild(selecionar);
      card.appendChild(conteudo);
      grade.appendChild(card);
    });
    painel.appendChild(grade);
  }

  const filtros = Array.isArray(fluxo.filtrosRapidos) ? fluxo.filtrosRapidos : [];
  if (filtros.length) {
    const linha = document.createElement("div");
    linha.className = "ia-filtros-rapidos";
    filtros.slice(0, 6).forEach((filtro) => linha.appendChild(_criarBotao(String(filtro), "ia-chip", () => _executarFluxo({ acao: "FILTRAR", filtro: String(filtro) }, "Buscando opções..."))));
    painel.appendChild(linha);
  }

  if (Array.isArray(fluxo.componentes) && fluxo.componentes.length) {
    const resumo = document.createElement("details");
    resumo.className = "ia-resumo-atual";
    resumo.open = fluxo.etapa === "RESUMO";
    const summary = document.createElement("summary");
    summary.textContent = `Montagem atual · ${fluxo.componentes.length} componente(s)`;
    resumo.appendChild(summary);
    const lista = document.createElement("div");
    fluxo.componentes.forEach((item) => {
      const row = document.createElement("div");
      row.className = "ia-resumo-item";
      row.innerHTML = `<span>${_escaparHtml(ROTULOS_ETAPA[item.categoria] || item.categoria)}</span><strong>${_escaparHtml(item.nome)}</strong>`;
      lista.appendChild(row);
    });
    resumo.appendChild(lista);
    painel.appendChild(resumo);
  }

  _renderizarCompatibilidade(painel, fluxo.compatibilidade);
  if (fluxo.etapa === "RESUMO") _renderizarResumoCompra(painel, fluxo);

  const acoes = document.createElement("div");
  acoes.className = "ia-fluxo-acoes";
  const codigos = new Set(fluxo.acoes || []);
  if (codigos.has("VER_MAIS")) acoes.appendChild(_criarBotao("Ver mais opções", "ia-acao-btn", () => _executarFluxo({ acao: "VER_MAIS", pagina: fluxo.pagina }, "Buscando mais opções...")));
  if (codigos.has("IA_DECIDIR")) acoes.appendChild(_criarBotao("Deixar a IA decidir", "ia-acao-btn", () => _executarFluxo({ acao: "IA_DECIDIR" }, "Escolhendo uma opção compatível...")));
  if (codigos.has("ESCOLHER_MANUALMENTE")) acoes.appendChild(_criarBotao("Escolher manualmente", "ia-acao-btn", () => {
    const categoria = CATEGORIA_BUILDER[fluxo.etapa];
    if (categoria) globalThis.PCBuilderLegacyBridge?.selecionarCategoria?.(categoria);
    _fecharPainel();
  }));
  if (codigos.has("ADICIONAR_FORA_CATALOGO")) acoes.appendChild(_criarBotao("Adicionar fora do catálogo", "ia-acao-btn", () => _abrirFormularioExterno(painel)));
  if (codigos.has("PULAR")) acoes.appendChild(_criarBotao("Pular", "ia-acao-btn", () => _executarFluxo({ acao: "PULAR" }, "Avançando...")));
  if (codigos.has("VOLTAR")) acoes.appendChild(_criarBotao("Voltar", "ia-acao-btn", () => _executarFluxo({ acao: "VOLTAR" }, "Voltando uma etapa...")));
  if (codigos.has("ABRIR_3D")) acoes.appendChild(_criarBotao("Aplicar no 3D", "ia-acao-btn ia-acao-btn-primary", () => _aplicarFluxoNoMontador(false)));
  if (codigos.has("SALVAR_BUILD")) acoes.appendChild(_criarBotao("Finalizar e salvar", "ia-acao-btn ia-acao-btn-primary", () => _aplicarFluxoNoMontador(true)));
  painel.appendChild(acoes);

  const encerrar = _criarBotao("Encerrar montagem guiada", "ia-encerrar-fluxo", () => {
    _fluxoGuiado = null;
    _metaFluxo = {};
    painel.classList.remove("is-current");
    _adicionarMensagem("Montagem guiada encerrada. Você pode continuar conversando normalmente.", "assistente");
  });
  painel.appendChild(encerrar);

  _mensagensEl.appendChild(painel);
  _rolarParaBaixo();
}

async function _executarFluxo(acao, loading = "Analisando sua montagem...") {
  if (_aguardandoResposta || !_fluxoGuiado) return;
  _definirBloqueado(true);
  const indicador = _mostrarDigitando(loading);
  try {
    const proximo = await _chamarMontagemGuiada(acao);
    indicador?.remove();
    _renderizarFluxoGuiado(proximo);
  } catch (erro) {
    indicador?.remove();
    _adicionarMensagem(erro?.message || "Não foi possível continuar a montagem guiada.", "assistente", [{ codigo: "TENTAR_FLUXO", rotulo: "Tentar novamente", payload: acao }]);
  } finally {
    _definirBloqueado(false);
  }
}

function _aplicarFluxoNoMontador(abrirFinalizacao = false) {
  const componentes = _fluxoGuiado?.componentes || [];
  const aplicou = globalThis.PCBuilderLegacyBridge?.aplicarMontagemIa?.(componentes);
  if (!aplicou) {
    _adicionarMensagem("Não foi possível aplicar essa montagem no 3D.", "assistente");
    return;
  }
  try { sessionStorage.setItem("pcBuilderIaMontagemSnapshot", JSON.stringify(_componentesParaApi(componentes))); } catch { /* opcional */ }
  _fecharPainel();
  if (abrirFinalizacao) window.setTimeout(() => document.getElementById("btn-finalizar")?.click(), 120);
}

function _executarAcao(acao) {
  switch (acao.codigo) {
    case "ABRIR_3D":
      if (acao.configuracao) sessionStorage.setItem("configurarPc3D", JSON.stringify(acao.configuracao));
      window.location.href = _resolverCaminho("pcbuild.html");
      break;
    case "VER_OFERTAS": window.location.href = _resolverCaminho("ofertas.html"); break;
    case "ABRIR_PECAS": window.location.href = _resolverCaminho("pecas.html"); break;
    case "TENTAR_FLUXO": _executarFluxo(acao.payload); break;
    default: break;
  }
}

function _resolverCaminho(pagina) {
  const ehSubPasta = window.location.pathname.includes("/paginas/");
  return ehSubPasta ? `../${pagina}` : `./${pagina}`;
}

function _mapearAcoes(codigosAcoes = [], configuracao = null) {
  const mapa = {
    ABRIR_3D: { codigo: "ABRIR_3D", rotulo: "Abrir no 3D", configuracao },
    VER_OFERTAS: { codigo: "VER_OFERTAS", rotulo: "Ver ofertas" },
    ABRIR_PECAS: { codigo: "ABRIR_PECAS", rotulo: "Ver peças" },
  };
  return codigosAcoes.map((codigo) => mapa[codigo]).filter(Boolean);
}

function _detectarMetaMontagem(texto) {
  const match = texto.match(/(?:r\$|reais?|orçamento(?:\s+de)?|até)?\s*([1-9]\d{2,5}(?:[.,]\d{1,2})?)/i);
  let orcamento;
  if (match?.[1]) {
    const valor = Number(match[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(valor) && valor > 0) orcamento = valor;
  }
  const uso = /\b(jogo|gamer|game|gaming)\b/i.test(texto) ? "jogos" : /\b(trabalh|office|escritório|programa)\b/i.test(texto) ? "trabalho" : /\b(estudio|studio|música|audio|áudio|vídeo|video|edição)\b/i.test(texto) ? "estudio" : "geral";
  return { ...(orcamento ? { orcamento } : {}), uso };
}

async function _enviarMensagem() {
  if (!_textareaEl || _aguardandoResposta) return;
  const texto = _textareaEl.value.trim();
  if (!texto) return;

  _textareaEl.value = "";
  _textareaEl.style.height = "auto";
  _definirBloqueado(true);
  _adicionarMensagem(texto, "usuario");
  _historico.push({ papel: "usuario", conteudo: texto });
  const indicador = _mostrarDigitando(_fluxoGuiado ? "Analisando sua montagem..." : "Pensando...");

  try {
    const meta = _detectarMetaMontagem(texto);
    if (meta.orcamento) _metaFluxo = { ..._metaFluxo, ...meta };

    const intencaoMontarComOrcamento = Boolean(meta.orcamento) && /\b(mont|pc|computador|gamer|build|configura)/i.test(texto);
    const resposta = intencaoMontarComOrcamento
      ? await _chamarMontarPc({ orcamento: meta.orcamento, uso: meta.uso })
      : await _chamarChat(texto);

    indicador?.remove();
    if (resposta?.resposta) {
      _adicionarMensagem(resposta.resposta, "assistente", resposta.fluxoGuiado ? [] : _mapearAcoes(resposta.acoes || [], null));
      _historico.push({ papel: "assistente", conteudo: resposta.resposta });
    }
    if (resposta?.fluxoGuiado) {
      _metaFluxo = { ..._metaFluxo, ...meta };
      _renderizarFluxoGuiado(resposta.fluxoGuiado);
    }
    _salvarHistorico();
  } catch (erro) {
    indicador?.remove();
    _adicionarMensagem(erro?.message || "Não foi possível obter resposta. Verifique sua conexão e tente novamente.", "assistente");
  } finally {
    _definirBloqueado(false);
    _textareaEl?.focus();
  }
}

function _definirBloqueado(bloqueado) {
  _aguardandoResposta = bloqueado;
  if (_textareaEl) _textareaEl.disabled = bloqueado;
  if (_enviarEl) _enviarEl.disabled = bloqueado;
  _painelEl?.querySelectorAll(".ia-fluxo-guiado.is-current button").forEach((btn) => { btn.disabled = bloqueado; });
}

function _abrirPainel() {
  if (!_painelEl) return;
  _painelEl.dataset.aberto = "true";
  if (_overlayEl) _overlayEl.dataset.visivel = "true";
  if (_btnFlutuanteEl) {
    _btnFlutuanteEl.dataset.aberto = "true";
    _btnFlutuanteEl.title = "Fechar assistente";
    _btnFlutuanteEl.querySelector(".ia-btn-flutuante-icone").textContent = "✕";
  }
  _textareaEl?.focus();
  _rolarParaBaixo();
  _esconderBalao();
}

function _fecharPainel() {
  if (!_painelEl) return;
  _painelEl.dataset.aberto = "false";
  if (_overlayEl) _overlayEl.dataset.visivel = "false";
  if (_btnFlutuanteEl) {
    _btnFlutuanteEl.dataset.aberto = "false";
    _btnFlutuanteEl.title = "Assistente CriaByte";
    _btnFlutuanteEl.querySelector(".ia-btn-flutuante-icone").textContent = "✦";
  }
}

function _alternarPainel() {
  if (_painelEl?.dataset.aberto === "true") _fecharPainel();
  else _abrirPainel();
}

function _mostrarBalao() {
  if (!_painelEl || globalThis.PC_BUILDER_REACT_ACTIONS === true || localStorage.getItem(CHAVE_BALAO_VISTO)) return;
  const balao = document.createElement("div");
  balao.className = "ia-balao-boas-vindas";
  balao.setAttribute("role", "status");
  balao.innerHTML = `<strong>✦ Assistente CriaByte</strong>Precisa de ajuda para escolher suas peças?<button class="ia-balao-boas-vindas-fechar" type="button" aria-label="Fechar dica">×</button>`;
  document.body.appendChild(balao);
  balao.querySelector(".ia-balao-boas-vindas-fechar").addEventListener("click", () => _esconderBalao(balao));
  window.setTimeout(() => _esconderBalao(balao), 7000);
}

function _esconderBalao(el = document.querySelector(".ia-balao-boas-vindas")) {
  if (!el) return;
  localStorage.setItem(CHAVE_BALAO_VISTO, "1");
  el.style.opacity = "0";
  el.style.transition = "opacity .3s";
  window.setTimeout(() => el.remove(), 320);
}

function _usarPromptRapido(texto) {
  if (!_textareaEl || _aguardandoResposta) return;
  _textareaEl.value = texto;
  _textareaEl.dispatchEvent(new Event("input"));
  _enviarMensagem();
}

function _construirInterface() {
  if (globalThis.PC_BUILDER_REACT_ACTIONS !== true) {
    _btnFlutuanteEl = document.createElement("button");
    _btnFlutuanteEl.type = "button";
    _btnFlutuanteEl.className = "ia-btn-flutuante";
    _btnFlutuanteEl.title = "Assistente CriaByte";
    _btnFlutuanteEl.setAttribute("aria-label", "Abrir assistente de IA");
    _btnFlutuanteEl.dataset.aberto = "false";
    _btnFlutuanteEl.innerHTML = `<span class="ia-btn-flutuante-icone" aria-hidden="true">✦</span>`;
    _btnFlutuanteEl.addEventListener("click", _alternarPainel);
  }

  _overlayEl = document.createElement("div");
  _overlayEl.className = "ia-overlay";
  _overlayEl.dataset.visivel = "false";
  _overlayEl.setAttribute("aria-hidden", "true");
  _overlayEl.addEventListener("click", _fecharPainel);

  _painelEl = document.createElement("div");
  _painelEl.className = "ia-painel";
  _painelEl.dataset.aberto = "false";
  _painelEl.setAttribute("role", "dialog");
  _painelEl.setAttribute("aria-label", "Assistente CriaByte");
  _painelEl.setAttribute("aria-modal", "false");
  _painelEl.innerHTML = `
    <div class="ia-painel-cabecalho"><div class="ia-painel-icone" aria-hidden="true">✦</div><div class="ia-painel-titulo"><strong>Assistente CriaByte</strong><small>Chat + montagem guiada</small></div><button class="ia-painel-fechar" type="button" aria-label="Fechar assistente">✕</button></div>
    <div class="ia-mensagens" id="ia-mensagens-lista" aria-live="polite" aria-atomic="false"></div>
    <div class="ia-prompts-rapidos" aria-label="Sugestões rápidas">
      <button type="button" data-ia-prompt="Monta PC até R$ 4.000">Monta PC até R$ 4.000</button>
      <button type="button" data-ia-prompt="Quero um PC gamer custo-benefício">PC gamer custo-benefício</button>
      <button type="button" data-ia-prompt="Me ajude a escolher as peças">Me ajude a escolher peças</button>
    </div>
    <div class="ia-entrada"><textarea class="ia-entrada-texto" id="ia-entrada-texto" placeholder="Pergunte ou peça para montar um PC…" rows="1" maxlength="1000" aria-label="Mensagem para o assistente"></textarea><button class="ia-entrada-enviar" type="button" aria-label="Enviar mensagem">➤</button></div>
    <p class="ia-nota-afiliado">Alguns links apresentados são links de afiliado. O preço para você não muda.</p>`;

  if (_btnFlutuanteEl) document.body.appendChild(_btnFlutuanteEl);
  document.body.appendChild(_overlayEl);
  document.body.appendChild(_painelEl);

  function _ajustarTopo() {
    const cab = document.getElementById("cabecalho-dinamico");
    document.documentElement.style.setProperty("--ia-topo-painel", `${cab ? cab.getBoundingClientRect().height : 0}px`);
  }
  _ajustarTopo();
  window.addEventListener("resize", _ajustarTopo);
  document.addEventListener("cabecalhoInjetado", _ajustarTopo, { once: true });

  _mensagensEl = _painelEl.querySelector("#ia-mensagens-lista");
  _textareaEl = _painelEl.querySelector("#ia-entrada-texto");
  _enviarEl = _painelEl.querySelector(".ia-entrada-enviar");
  _painelEl.querySelector(".ia-painel-fechar").addEventListener("click", _fecharPainel);
  _enviarEl.addEventListener("click", _enviarMensagem);
  _painelEl.querySelectorAll("[data-ia-prompt]").forEach((botao) => {
    botao.addEventListener("click", () => _usarPromptRapido(botao.dataset.iaPrompt || botao.textContent || ""));
  });
  _textareaEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); _enviarMensagem(); }
  });
  _textareaEl.addEventListener("input", () => {
    _textareaEl.style.height = "auto";
    _textareaEl.style.height = `${Math.min(_textareaEl.scrollHeight, 110)}px`;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && _painelEl?.dataset.aberto === "true") _fecharPainel();
  });

  _carregarHistorico();
  _historico.forEach((msg) => _adicionarMensagem(msg.conteudo, msg.papel));
}

export function definirContextoBuild(contexto) {
  _contextoBuild = contexto;
}

export function abrirAssistenteIa(mensagemInicial = "") {
  if (!_painelEl) inicializarAssistenteIa();
  _abrirPainel();
  if (mensagemInicial && _textareaEl) {
    _textareaEl.value = mensagemInicial;
    _textareaEl.dispatchEvent(new Event("input"));
  }
}

export function destruirAssistenteIa() {
  document.querySelectorAll(".ia-btn-flutuante, .ia-overlay, .ia-painel, .ia-balao-boas-vindas").forEach((elemento) => elemento.remove());
  document.documentElement.style.removeProperty("--ia-topo-painel");
  _painelEl = null;
  _btnFlutuanteEl = null;
  _overlayEl = null;
  _mensagensEl = null;
  _textareaEl = null;
  _enviarEl = null;
  _aguardandoResposta = false;
  _fluxoGuiado = null;
}

export function inicializarAssistenteIa() {
  if (_painelEl) return;
  _construirInterface();
  window.setTimeout(_mostrarBalao, 2500);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializarAssistenteIa, { once: true });
else inicializarAssistenteIa();
