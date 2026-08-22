import {
  cena,
  camera,
  renderizador,
  controles,
  carregador,
  carregarModelo3D,
  alternarQualidade3D,
  obterQualidade3D,
} from "./renderer.js";

import { verificarCompatibilidade } from "./compatibilidade.js";
import { api } from "./api.js?v=react-v44-r2-glb-direct";
import { mostrarToast, copiarTexto, definirEstadoContainer } from "./ui-feedback.js";
import { confirmar, solicitarTexto } from "./dialogos.js?v=react-v40-1";
import {
  calcularConsumoMontagem,
  calcularFonteRecomendada,
  obterResumoFluxoAr,
} from "./montador/calculos.js";
import {
  criarUrlCompartilhamento,
  obterConfiguracaoCompartilhadaDaUrl,
} from "./montador/compartilhamento.js";
import {
  registrarHistorico,
  desfazerHistorico,
  limparHistorico,
} from "./montador/historico.js";
import {
  obterSessaoConta,
  obterRascunhoBuild,
  gravarRascunhoBuild,
  removerRascunhoBuild,
  obterChaveBuildsSalvas,
} from "./montador/persistencia.js";

/* =========================================================
   CONFIGURAÇÃO GERAL
========================================================= */

const RAIZ_SITE = new URL(globalThis.PC_BUILDER_ASSET_BASE_URL || "../", import.meta.url);
const POSICAO_CAMERA_INICIAL = new THREE.Vector3(8, 6, 8);
const ALVO_CAMERA_INICIAL = new THREE.Vector3(0, 2.3, 0);

const PLACEHOLDER_IMAGEM = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
        <rect width="160" height="120" fill="#eef2f7"/>
        <rect x="45" y="25" width="70" height="70" rx="8" fill="#d7dee8"/>
        <path d="M60 78l18-20 13 14 9-10 15 16H60z" fill="#94a3b8"/>
        <circle cx="95" cy="47" r="8" fill="#94a3b8"/>
    </svg>
`)}`;

const mapaCategoriasBuilder = {
  gabinete: "gabinete",
  processador: "processador",
  "placa-mae": "placamae",
  placamae: "placamae",
  cooler: "cooler",
  memoria: "memoria",
  ram: "memoria",
  "placa-video": "placavideo",
  placavideo: "placavideo",
  gpu: "placavideo",
  armazenamento: "armazenamento",
  fonte: "fonte",
  ventoinha: "ventoinhas",
  ventoinhas: "ventoinhas",
};

const nomesSlotsBuilder = {
  memoria: ["Slot RAM 1", "Slot RAM 2", "Slot RAM 3", "Slot RAM 4"],
  armazenamento: ["Slot M.2 / NVMe", "Compartimento SSD / SATA"],
  ventoinhas: [
    "Ventoinha traseira",
    "Ventoinha frontal superior",
    "Ventoinha frontal central",
    "Ventoinha frontal inferior",
  ],
};

const fluxoRecomendadoPorSlotFan = ["out", "in", "in", "in"];

function obterNomeSlot(categoria, indice) {
  return nomesSlotsBuilder[categoria]?.[indice] ?? `Slot ${indice + 1}`;
}

function obterFluxoRecomendadoFan(indice) {
  return fluxoRecomendadoPorSlotFan[indice] ?? "in";
}

// 💡 NOVIDADE: As categorias com várias peças agora são Arrays (Listas de Slots)
const estadoMontagem = {
  gabinete: null,
  processador: null,
  placamae: null,
  cooler: null,
  memoria: [null, null, null, null], // 4 Slots de RAM
  placavideo: null,
  armazenamento: [null, null], // 2 Slots (M.2 e SSD)
  fonte: null,
  ventoinhas: [null, null, null, null], // 4 Slots de Ventoinhas
};

let catalogoPecas = {};
let categoriaAtual = "todos";
let termoPesquisaBuilder = "";
let mostrarSomenteCompativeis = true;
let slotAtualSelecionado = null; // 💡 Controla qual slot estamos a editar
let sistemaLigado = false;
let tempoRGB = 0;
let observadorCanvas = null;
let podeLigarSistema = false;
let ultimoResultadoDiagnostico = null;
let categoriaDestaque3D = null;
let timeoutDestaqueCard = null;
let restauracaoInicialConcluida = false;
let timeoutSalvamentoAutomatico = null;
let catalogoCarregadoReact = false;
let erroCatalogoReact = "";

let buildPossuiAlteracoesNaoSalvas = false;

/* =========================================================
   PONTE DE ESTADO PARA O REACT
   O legado continua sendo a fonte da verdade nesta etapa,
   mas cada alteração relevante publica um snapshot imutável.
========================================================= */

function obterStatusBuildParaReact(resultado = ultimoResultadoDiagnostico) {
  if (!resultado?.temPecas) return { texto: "Build vazia", tipo: "neutro" };
  if (resultado.temErros) return { texto: "Build incompatível", tipo: "erro" };
  if (!resultado.sistemaCompleto) return { texto: "Build incompleta", tipo: "alerta" };
  return resultado.temAlertas
    ? { texto: "Build pronta com atenção", tipo: "alerta" }
    : { texto: "Build pronta para montar", tipo: "sucesso" };
}

function serializarPecaParaReact(peca, categoria = "") {
  if (!peca) return null;
  const hardwareIdNumero = Number(peca.hardwareId ?? (peca.origem === "CATALOGO" ? peca.id : null));
  const hardwareId = Number.isInteger(hardwareIdNumero) && hardwareIdNumero > 0 ? hardwareIdNumero : null;
  const precoDisponivel = peca.preco !== null && peca.preco !== undefined && String(peca.preco).trim() !== "" && !peca.precoIndisponivel;
  return {
    id: String(peca.id ?? ""),
    hardwareId,
    categoria,
    nome: String(peca.nome ?? "Peça sem nome"),
    marca: String(peca.marca ?? ""),
    modelo: String(peca.modelo ?? ""),
    descricao: String(peca.descricao ?? ""),
    origem: peca.origem || (hardwareId ? "CATALOGO" : "EXTERNO"),
    especificacoes: peca.especificacoes && typeof peca.especificacoes === "object" ? { ...peca.especificacoes } : {},
    fonteDadosUrl: String(peca.fonteDadosUrl ?? ""),
    modelo3dUrl: String(peca.modelo3dUrl ?? peca.modelo3D ?? ""),
    preco: precoDisponivel ? converterPreco(peca.preco) : null,
    precoFormatado: precoDisponivel ? formatarPreco(peca.preco) : "Preço indisponível",
    imagem: obterImagemPeca(peca),
    imagemUrl: String(peca.imagemUrl ?? peca.imagem ?? ""),
    loja: String(peca.loja ?? ""),
    linkCompra: hardwareId ? obterLinkCompraPeca(peca) : "",
    watts: Number(peca.watts) || 0,
    fluxo: peca.fluxo === "out" ? "out" : "in",
  };
}

function criarListaPecasReact() {
  const categoria = categoriaAtual;
  const estadoAtual = categoria === "todos" ? null : estadoMontagem[categoria];
  const isMultiSlot = Array.isArray(estadoAtual);

  if (isMultiSlot && slotAtualSelecionado === null) {
    return {
      modo: "slots",
      categoria,
      carregando: !catalogoCarregadoReact && !erroCatalogoReact,
      erro: erroCatalogoReact,
      itens: estadoAtual.map((pecaNoSlot, index) => ({
        tipo: "slot",
        slot: index,
        nomeSlot: obterNomeSlot(categoria, index),
        fluxoRecomendado: categoria === "ventoinhas" ? obterFluxoRecomendadoFan(index) : "",
        peca: serializarPecaParaReact(pecaNoSlot, categoria),
      })),
      totalCatalogo: (catalogoPecas[categoria] ?? []).length,
      totalVisivel: estadoAtual.length,
    };
  }

  const todasPecasCategoria = obterPecasDaCategoria(categoria);
  const termoNormalizado = normalizarTextoBuilder(termoPesquisaBuilder);
  const filtradasPesquisa = termoNormalizado
    ? todasPecasCategoria.filter((peca) => obterTextoPesquisaPeca(peca).includes(termoNormalizado))
    : todasPecasCategoria;
  const possuiBuild = configuracaoPossuiPecas(serializarEstadoMontagem());

  const itens = filtradasPesquisa.map((peca) => {
    const categoriaPeca = obterCategoriaBuilderDaPeca(peca);
    const estadoCategoriaPeca = estadoMontagem[categoriaPeca];
    const categoriaPossuiSlots = Array.isArray(estadoCategoriaPeca);
    const selecionada = categoria === "todos"
      ? verificarPecaSelecionada(categoriaPeca, peca)
      : isMultiSlot
        ? estadoAtual[slotAtualSelecionado]?.id === peca.id
        : estadoAtual?.id === peca.id;
    const precisaEscolherSlot = categoria === "todos" && categoriaPossuiSlots;
    const avaliacao = avaliarCompatibilidadePeca(categoriaPeca, peca);

    return {
      tipo: "peca",
      categoria: categoriaPeca,
      nomeCategoria: nomesCategoriasBuilder[categoriaPeca] ?? categoriaPeca,
      slot: isMultiSlot ? slotAtualSelecionado : null,
      precisaEscolherSlot,
      selecionada,
      conflito: avaliacao.tipo === "incompativel",
      compatibilidade: {
        tipo: avaliacao.tipo ?? "neutro",
        texto: avaliacao.texto ?? "Compatibilidade será validada",
      },
      peca: serializarPecaParaReact(peca, categoriaPeca),
    };
  });

  const visiveis = mostrarSomenteCompativeis && possuiBuild
    ? itens.filter((item) => !item.conflito)
    : itens;

  return {
    modo: "pecas",
    categoria,
    slotAtual: isMultiSlot ? slotAtualSelecionado : null,
    podeVoltarSlots: Boolean(isMultiSlot),
    carregando: !catalogoCarregadoReact && !erroCatalogoReact,
    erro: erroCatalogoReact,
    termoPesquisa: termoPesquisaBuilder,
    totalCatalogo: todasPecasCategoria.length,
    totalPesquisa: filtradasPesquisa.length,
    totalVisivel: visiveis.length,
    filtroOcultouTudo: Boolean(mostrarSomenteCompativeis && possuiBuild && itens.length > 0 && visiveis.length === 0),
    itens: visiveis,
  };
}

function criarResumoFinalReact(resultadoDiagnostico) {
  const itens = obterItensResumoFinal().map((item) => ({
    categoria: item.categoria,
    categoriaNome: item.categoriaNome,
    nomeSlot: item.nomeSlot,
    indice: item.indice,
    peca: serializarPecaParaReact(item.peca, item.categoria),
  }));
  const fansIn = Number(resultadoDiagnostico?.fansIn) || 0;
  const fansOut = Number(resultadoDiagnostico?.fansOut) || 0;
  const fluxo = obterResumoFluxoAr(fansIn, fansOut);

  return {
    itens,
    linksCompra: itens.filter((item) => item.peca?.linkCompra),
    fansIn,
    fansOut,
    fluxo: {
      tipo: fluxo?.tipo ?? "neutro",
      titulo: fluxo?.titulo ?? "Fluxo de ar",
      mensagem: fluxo?.mensagem ?? "Adicione ventoinhas para avaliar o fluxo de ar.",
    },
    alertas: [...(resultadoDiagnostico?.alertas ?? [])],
  };
}

function criarSnapshotMontadorReact() {
  const pecasSelecionadas = Object.values(estadoMontagem).flat().filter(Boolean);
  const pecasComPreco = pecasSelecionadas.filter((peca) =>
    peca?.preco !== null && peca?.preco !== undefined && String(peca.preco).trim() !== "" && !peca.precoIndisponivel,
  );
  const precoTotal = pecasComPreco.reduce(
    (total, peca) => total + converterPreco(peca.preco),
    0,
  );
  const pecasSemPreco = Math.max(0, pecasSelecionadas.length - pecasComPreco.length);
  const consumoTotal = calcularConsumoMontagem(estadoMontagem);
  const fonteRecomendada = calcularFonteRecomendada(consumoTotal);
  const diagnostico = ultimoResultadoDiagnostico ?? verificarCompatibilidade(estadoMontagem);
  const status = obterStatusBuildParaReact(diagnostico);
  const possuiLinksCompra = obterItensComLinkCompra().length > 0;

  return {
    categoriaAtual,
    slotAtualSelecionado,
    termoPesquisa: termoPesquisaBuilder,
    mostrarSomenteCompativeis,
    catalogoCarregado: catalogoCarregadoReact,
    erroCatalogo: erroCatalogoReact,
    listaPecas: criarListaPecasReact(),
    configuracao: serializarEstadoMontagem(),
    componentesResumo: criarResumoFinalReact(diagnostico),
    quantidadePecas: pecasSelecionadas.length,
    precoTotal,
    precoCompleto: pecasSemPreco === 0,
    pecasSemPreco,
    consumoTotal,
    fonteRecomendada,
    podeFinalizar: Boolean(diagnostico?.podeFinalizar),
    compraDisponivel: Boolean(diagnostico?.podeFinalizar) && possuiLinksCompra,
    status,
    diagnostico: {
      temPecas: Boolean(diagnostico?.temPecas),
      temErros: Boolean(diagnostico?.temErros),
      temAlertas: Boolean(diagnostico?.temAlertas),
      sistemaCompleto: Boolean(diagnostico?.sistemaCompleto),
      erros: [...(diagnostico?.erros ?? [])],
      alertas: [...(diagnostico?.alertas ?? [])],
      faltando: [...(diagnostico?.faltando ?? [])],
    },
  };
}

function emitirEstadoMontadorReact() {
  try {
    window.dispatchEvent(new CustomEvent("pcbuilder:statechange", {
      detail: criarSnapshotMontadorReact(),
    }));
  } catch (erro) {
    console.warn("Não foi possível publicar o estado do montador para o React:", erro);
  }
}

function atualizarEstadoBuildNaoSalva(valor) {
  buildPossuiAlteracoesNaoSalvas = Boolean(valor);
  document.documentElement.dataset.buildNaoSalva = String(buildPossuiAlteracoesNaoSalvas);
}

function serializarPecaParaPersistencia(peca, categoria = "") {
  if (!peca) return null;
  const externa = peca.origem === "EXTERNO" || peca.origem === "IA" || peca.hardwareId === null;
  if (!externa) {
    return categoria === "ventoinhas"
      ? { id: peca.id, fluxo: peca.fluxo === "out" ? "out" : "in" }
      : { id: peca.id };
  }

  return {
    id: peca.id,
    hardwareId: null,
    origem: peca.origem || "EXTERNO",
    nome: peca.nome || "Peça externa",
    marca: peca.marca || "",
    modelo: peca.modelo || "",
    imagemUrl: peca.imagemUrl || peca.imagem || "",
    modelo3dUrl: peca.modelo3dUrl || peca.modelo3D || "",
    fonteDadosUrl: peca.fonteDadosUrl || "",
    especificacoes: peca.especificacoes && typeof peca.especificacoes === "object" ? peca.especificacoes : {},
    ...(categoria === "ventoinhas" ? { fluxo: peca.fluxo === "out" ? "out" : "in" } : {}),
  };
}

function serializarEstadoMontagem() {
  return Object.fromEntries(
    Object.entries(estadoMontagem).map(([categoria, estado]) => {
      if (Array.isArray(estado)) {
        return [categoria, estado.map((peca) => serializarPecaParaPersistencia(peca, categoria))];
      }
      return [categoria, serializarPecaParaPersistencia(estado, categoria)];
    }),
  );
}

function configuracaoPossuiPecas(configuracao = {}) {
  return Object.values(configuracao).some((valor) =>
    Array.isArray(valor) ? valor.some(Boolean) : Boolean(valor),
  );
}

function atualizarStatusSalvamento(texto, tipo = "neutro") {
  const status = document.getElementById("status-salvamento-build");
  if (!status) return;
  status.textContent = texto;
  status.dataset.tipo = tipo;
}

function salvarRascunhoBuild() {
  if (!restauracaoInicialConcluida) return;

  const configuracao = serializarEstadoMontagem();

  if (!configuracaoPossuiPecas(configuracao)) {
    removerRascunhoBuild();
    atualizarStatusSalvamento("Build vazia — nada para salvar.", "neutro");
    return;
  }

  gravarRascunhoBuild(configuracao);

  atualizarStatusSalvamento("Salvo automaticamente neste navegador.", "salvo");
  atualizarEstadoBuildNaoSalva(false);
}

function agendarSalvamentoAutomatico(descricao = "Alteração na montagem") {
  if (!restauracaoInicialConcluida) return;

  registrarHistorico(serializarEstadoMontagem(), descricao);
  atualizarEstadoBuildNaoSalva(true);
  window.clearTimeout(timeoutSalvamentoAutomatico);
  atualizarStatusSalvamento("Salvando alterações...", "salvando");
  timeoutSalvamentoAutomatico = window.setTimeout(salvarRascunhoBuild, 280);
}

async function compartilharBuildAtual() {
  const configuracao = serializarEstadoMontagem();
  if (!configuracaoPossuiPecas(configuracao)) {
    mostrarToast("Adicione pelo menos uma peça para compartilhar.", "alerta");
    return;
  }

  const dados = {
    title: "Minha build no CriaByte",
    text: "Confira a configuração que montei no CriaByte.",
    url: criarUrlCompartilhamento(configuracao),
  };

  try {
    if (navigator.share) {
      await navigator.share(dados);
      return;
    }

    await copiarTexto(dados.url);
    mostrarToast("Link da build copiado.", "sucesso");
  } catch (erro) {
    if (erro?.name === "AbortError") return;
    console.error("Erro ao compartilhar a build:", erro);
    mostrarToast("Não foi possível compartilhar agora.", "erro");
  }
}

async function salvarBuildNaConta() {
  const sessao = obterSessaoConta();

  if (!sessao) {
    salvarRascunhoBuild();
    const retorno = encodeURIComponent("../pcbuild.html");
    window.location.href = `./paginas/login.html?retorno=${retorno}`;
    return;
  }

  const configuracao = serializarEstadoMontagem();
  if (!configuracaoPossuiPecas(configuracao)) {
    mostrarToast("Adicione peças antes de salvar a build.", "alerta");
    return;
  }

  const agora = new Date();
  const nomePadrao = `Build ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const nome = await solicitarTexto({
    titulo: "Salvar build",
    mensagem: "Escolha um nome para encontrar esta configuração depois.",
    rotulo: "Nome da build",
    valorInicial: nomePadrao,
    textoConfirmar: "Salvar build",
  });
  if (!nome) return;

  const itens = obterItensResumoFinal();
  const precoTotal = itens.reduce(
    (total, item) => total + converterPreco(item.peca.preco),
    0,
  );
  const consumoTotal = calcularConsumoMontagem(estadoMontagem);

  const chave = obterChaveBuildsSalvas(sessao.email);
  let builds = [];

  try {
    const dados = JSON.parse(localStorage.getItem(chave) || "[]");
    builds = Array.isArray(dados) ? dados : [];
  } catch {
    builds = [];
  }

  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `build-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  builds.unshift({
    id,
    nome,
    criadaEm: agora.toISOString(),
    atualizadaEm: agora.toISOString(),
    precoTotal,
    consumoTotal,
    quantidade: itens.length,
    configuracao,
    componentes: itens.map((item) => ({
      categoria: item.categoriaNome,
      slot: item.nomeSlot,
      nome: item.peca.nome,
      preco: converterPreco(item.peca.preco),
    })),
  });

  localStorage.setItem(chave, JSON.stringify(builds.slice(0, 60)));
  atualizarEstadoBuildNaoSalva(false);
  mostrarToast("Build salva na sua conta.", "sucesso");

  const botao = document.getElementById("btn-salvar-build");
  if (botao) {
    const original = botao.innerHTML;
    botao.innerHTML = '<span aria-hidden="true">✓</span> Build salva';
    botao.disabled = true;
    window.setTimeout(() => {
      botao.innerHTML = original;
      botao.disabled = false;
    }, 2200);
  }
}

/* =========================================================
   UTILITÁRIOS
========================================================= */

const nomesCategoriasBuilder = {
  gabinete: "Gabinete",
  processador: "CPU",
  placamae: "Placa-mãe",
  cooler: "Cooler",
  memoria: "Memória RAM",
  placavideo: "Placa de vídeo",
  armazenamento: "Armazenamento",
  fonte: "Fonte",
  ventoinhas: "Ventoinha",
};


/* IDs antigos usados pelas primeiras versões do builds.json.
 * Mantidos para que anúncios e builds salvos anteriormente continuem funcionando. */
const aliasesConfiguracao3D = {
  gabinete: {
    "mid-tower": "gabinete-corsair-4000d",
    "full-tower": "gabinete-corsair-4000d",
    compacto: "gabinete-cooler-master-nr200",
  },
  placamae: {
    "am4-matx": "placa-mae-asus-b550m",
    "am4-atx": "placa-mae-asus-b550m",
    "am5-atx": "placa-mae-b650e-atx-ddr5",
    "am5-mini-itx": "placa-mae-b650i-mini-itx-ddr5",
    "lga1200-atx": "placa-mae-asus-b550m",
  },
  processador: {
    am4: "processador-ryzen-7-5700x3d",
    am5: "processador-ryzen-7-7800x3d",
    lga1200: "Intel I7",
  },
  cooler: {
    "cooler-box": "cooler-deepcool-ak400",
    wc240: "cooler-deepcool-ak400",
    wc360: "cooler-deepcool-ak400",
  },
  memoria: {
    "ddr4-8gb-3200": "memoria-kingston-fury-16gb",
    "ddr4-16gb-3200": "memoria-kingston-fury-16gb",
    "ddr4-16gb-3600": "memoria-kingston-fury-16gb",
    "ddr5-16gb-6000": "memoria-ddr5-16gb-6000",
    "ddr5-16gb-6400": "memoria-ddr5-16gb-6000",
  },
  placavideo: {
    rx9060xt: "gpu-rtx-4060-8gb",
    rtx5070ti: "gpu-rx-7700-xt",
    rx9070xt: "gpu-rtx-3090",
  },
  armazenamento: {
    "ssd-m2": "ssd-kingston-nv2",
    "ssd-sata": "ssd-sata-crucial",
  },
  fonte: {
    "550w": "fonte-corsair-rm850x",
    "650w": "fonte-corsair-rm850x",
    "750w": "fonte-corsair-rm850x",
    "fonte-550w": "fonte-corsair-rm850x",
  },
  ventoinhas: {
    arctic_in: "fan-arctic-p12",
    arctic_out: "fan-arctic-p12",
  },
};

function resolverIdConfiguracao3D(categoria, idRecebido) {
  const id = String(idRecebido ?? "").trim();
  return aliasesConfiguracao3D[categoria]?.[id] ?? id;
}

function obterCategoriaBuilderDaPeca(peca) {
  return mapaCategoriasBuilder[peca?.categoria] ?? peca?.categoria ?? "";
}

function obterPecasDaCategoria(categoria) {
  if (categoria !== "todos") {
    return catalogoPecas[categoria] ?? [];
  }

  return Object.values(catalogoPecas).flat();
}

function verificarPecaSelecionada(categoria, peca) {
  const estadoCategoria = estadoMontagem[categoria];

  if (Array.isArray(estadoCategoria)) {
    return estadoCategoria.some((item) => item?.id === peca.id);
  }

  return estadoCategoria?.id === peca.id;
}


function normalizarConfiguracaoRecebida(configuracao = {}) {
  const criarLista = (valor, alternativos = []) => {
    if (Array.isArray(valor)) return valor;
    if (valor) return [valor];
    return alternativos;
  };

  return {
    gabinete: configuracao.gabinete,
    processador: configuracao.processador,
    placamae: configuracao.placamae ?? configuracao["placa-mae"],
    cooler: configuracao.cooler,
    memoria: criarLista(configuracao.memoria, [
      configuracao.ram1,
      configuracao.ram2,
      configuracao.ram3,
      configuracao.ram4,
    ]),
    placavideo:
      configuracao.placavideo ??
      configuracao["placa-video"] ??
      configuracao.gpu,
    armazenamento: Array.isArray(configuracao.armazenamento)
      ? configuracao.armazenamento
      : [configuracao.armazenamento, configuracao.armazenamento2].filter(Boolean),
    fonte: configuracao.fonte,
    ventoinhas: criarLista(configuracao.ventoinhas, [
      configuracao["fan-tras"],
      configuracao["fan-frente1"],
      configuracao["fan-frente2"],
      configuracao["fan-frente3"],
    ]),
  };
}

function criarPecaExternaDeSnapshot(categoria, dados = {}, indice = 0) {
  const specs = dados.especificacoes && typeof dados.especificacoes === "object" ? { ...dados.especificacoes } : {};
  const modelo3dUrl = dados.modelo3dUrl || dados.modelo3DUrl || dados.model3dUrl || "";
  const imagemUrl = dados.imagemUrl || dados.imagem || "";
  const watts = Number(
    specs.consumoWatts ?? specs.tdpWatts ?? specs.potenciaWatts ?? dados.watts ?? 0,
  ) || 0;

  return {
    id: dados.id || `ia-externo-${categoria}-${Date.now()}-${indice}`,
    hardwareId: null,
    categoria,
    nome: String(dados.nome || dados.titulo || "Peça externa"),
    marca: String(dados.marca || ""),
    modelo: String(dados.modelo || ""),
    descricao: "Peça fora do catálogo adicionada como snapshot da montagem.",
    origem: dados.origem === "IA" ? "IA" : "EXTERNO",
    especificacoes: specs,
    fonteDadosUrl: String(dados.fonteDadosUrl || ""),
    imagemUrl: String(imagemUrl || ""),
    imagem: String(imagemUrl || ""),
    modelo3dUrl: String(modelo3dUrl || ""),
    modelo3D: String(modelo3dUrl || ""),
    preco: null,
    precoIndisponivel: true,
    linkCompra: "",
    loja: "",
    watts,
    soquete: specs.socket ?? specs.soquete ?? dados.soquete,
    tipoRam: specs.tipo ?? specs.tipoRam ?? specs.tiposMemoriaSuportados?.[0],
    frequencia: specs.frequenciaMhz ?? specs.frequencia ?? dados.frequencia,
    formato: specs.formato ?? dados.formato,
    comprimento: specs.comprimentoMm ?? specs.comprimento ?? dados.comprimento,
    comprimentoMm: specs.comprimentoMm ?? dados.comprimentoMm,
    alturaMm: specs.alturaMm ?? dados.alturaMm,
    slotsOcupados: specs.slotsOcupados ?? dados.slotsOcupados,
  };
}

function resolverPecaConfiguracao(categoria, item, indice = 0) {
  if (!item) return null;
  const dados = item && typeof item === "object" ? item : { id: item };
  const pecasCategoria = catalogoPecas[categoria] ?? [];
  const candidato = dados.hardwareId ?? dados.id;
  const idResolvido = resolverIdConfiguracao3D(categoria, candidato);
  const catalogo = pecasCategoria.find(
    (peca) =>
      String(peca.id) === String(idResolvido) ||
      String(peca.hardwareId ?? "") === String(idResolvido),
  );
  if (catalogo) return { ...catalogo, origem: "CATALOGO", hardwareId: Number(catalogo.hardwareId ?? catalogo.id) || catalogo.hardwareId };

  const permiteSnapshot = dados.hardwareId === null || dados.origem === "EXTERNO" || dados.origem === "IA" || Boolean(dados.nome);
  return permiteSnapshot ? criarPecaExternaDeSnapshot(categoria, dados, indice) : null;
}

function aplicarMontagemIa(componentes = []) {
  if (!Array.isArray(componentes) || componentes.length === 0) return false;

  Object.keys(estadoMontagem).forEach((categoria) => {
    if (Array.isArray(estadoMontagem[categoria])) estadoMontagem[categoria].fill(null);
    else estadoMontagem[categoria] = null;
  });

  const contadorSlots = { memoria: 0, armazenamento: 0, ventoinhas: 0 };
  componentes.forEach((componente, indice) => {
    const categoriaApi = String(componente?.categoria || "").toLowerCase().replaceAll("_", "-");
    const categoria = mapaCategoriasBuilder[categoriaApi] ?? mapaCategoriasBuilder[categoriaApi.replaceAll("-", "")] ?? categoriaApi;
    if (!(categoria in estadoMontagem)) return;
    const peca = resolverPecaConfiguracao(categoria, componente, indice);
    if (!peca) return;

    if (Array.isArray(estadoMontagem[categoria])) {
      const slot = contadorSlots[categoria] ?? 0;
      if (slot >= estadoMontagem[categoria].length) return;
      if (categoria === "ventoinhas") peca.fluxo = componente.fluxo === "out" ? "out" : obterFluxoRecomendadoFan(slot);
      estadoMontagem[categoria][slot] = peca;
      contadorSlots[categoria] = slot + 1;
    } else {
      estadoMontagem[categoria] = peca;
    }
  });

  const possuiPecas = Object.values(estadoMontagem).some((valor) => Array.isArray(valor) ? valor.some(Boolean) : Boolean(valor));
  if (!possuiPecas) return false;

  atualizarAncorasGabinete3D(estadoMontagem.gabinete);
  Object.entries(estadoMontagem).forEach(([categoria, estado]) => atualizarPecaNo3D(categoria, estado));
  atualizarResumo();
  renderizarListaPecas(categoriaAtual);
  agendarSalvamentoAutomatico("Montagem aplicada pela IA");
  emitirEstadoMontadorReact();
  mostrarToast("Montagem da IA aplicada ao 3D.", "sucesso");
  return true;
}

function aplicarConfiguracaoRecebidaDaHome() {
  const configuracaoCompartilhada = obterConfiguracaoCompartilhadaDaUrl();
  const configuracaoSessao = sessionStorage.getItem("configurarPc3D");
  const configuracaoRascunho = obterRascunhoBuild();

  let configuracaoBruta = null;
  let origem = "";

  if (configuracaoCompartilhada) {
    configuracaoBruta = configuracaoCompartilhada;
    origem = "compartilhada";
  } else if (configuracaoSessao) {
    try {
      configuracaoBruta = JSON.parse(configuracaoSessao);
      origem = "sessao";
      sessionStorage.removeItem("configurarPc3D");
    } catch (erro) {
      console.error("A configuração recebida não é válida.", erro);
    }
  } else if (configuracaoRascunho) {
    configuracaoBruta = configuracaoRascunho;
    origem = "rascunho";
  }

  if (!configuracaoBruta) return false;

  const configuracao = normalizarConfiguracaoRecebida(configuracaoBruta);
  let aplicouAlgumaPeca = false;

  Object.entries(configuracao).forEach(([categoria, valor]) => {
    if (!valor || !(categoria in estadoMontagem)) return;

    const obterDadosRecebidos = (item) =>
      item && typeof item === "object" ? item : { id: item };

    const buscarPeca = (item, indice = 0) => resolverPecaConfiguracao(categoria, item, indice);

    if (Array.isArray(estadoMontagem[categoria])) {
      const itens = Array.isArray(valor) ? valor : [valor];
      estadoMontagem[categoria].fill(null);

      itens
        .slice(0, estadoMontagem[categoria].length)
        .forEach((item, indice) => {
          if (!item) return;

          const dados = obterDadosRecebidos(item);
          const pecaEncontrada = buscarPeca(dados, indice);
          if (!pecaEncontrada) return;

          const peca = { ...pecaEncontrada };
          if (categoria === "ventoinhas") {
            peca.fluxo =
              dados.fluxo === "out"
                ? "out"
                : dados.fluxo === "in"
                  ? "in"
                  : obterFluxoRecomendadoFan(indice);
          }

          estadoMontagem[categoria][indice] = peca;
          aplicouAlgumaPeca = true;
        });

      return;
    }

    const dados = obterDadosRecebidos(valor);
    const pecaEncontrada = buscarPeca(dados);
    if (!pecaEncontrada) return;

    estadoMontagem[categoria] = { ...pecaEncontrada };
    aplicouAlgumaPeca = true;
  });

  if (!aplicouAlgumaPeca) return false;

  atualizarAncorasGabinete3D(estadoMontagem.gabinete);
  Object.entries(estadoMontagem).forEach(([categoria, estado]) => {
    atualizarPecaNo3D(categoria, estado);
  });

  atualizarResumo();

  if (origem === "compartilhada" && window.history?.replaceState) {
    window.history.replaceState(null, "", window.location.pathname);
  }

  window.setTimeout(() => {
    if (origem === "compartilhada") {
      mostrarToast("Build compartilhada carregada no 3D.", "sucesso");
    } else if (origem === "sessao") {
      mostrarToast("Build carregada no montador.", "sucesso");
    } else if (origem === "rascunho") {
      mostrarToast("Montagem recuperada automaticamente.", "info");
    }
  }, 350);

  return true;
}

function normalizarTextoBuilder(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function obterTextoPesquisaPeca(peca) {
  return normalizarTextoBuilder(
    [
      peca?.nome,
      peca?.marca,
      peca?.descricao,
      peca?.loja,
      peca?.categoria,
      peca?.soquete,
      peca?.tipoRam,
      peca?.hardwareId,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
function caminhoSite(arquivo = "") {
  return new URL(arquivo, RAIZ_SITE).href;
}

function converterPreco(valor = 0) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined) return 0;

  const bruto = String(valor).trim();
  if (!bruto) return 0;

  // Decimal vindo da API/Prisma: "1037.40" precisa continuar 1037,40.
  // Antes o ponto era removido como se fosse milhar, gerando valores 10x/100x.
  const direto = Number(bruto);
  if (Number.isFinite(direto)) return direto;

  const limpo = bruto.replace(/[^\d,.-]/g, "");
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado = limpo;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    normalizado = ultimaVirgula > ultimoPonto
      ? limpo.replace(/\./g, "").replace(",", ".")
      : limpo.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarPreco(valor = 0) {
  if (valor === null || valor === undefined || String(valor).trim() === "") {
    return "Preço indisponível";
  }
  return converterPreco(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function obterImagemPeca(peca) {
  if (!peca?.imagem) return PLACEHOLDER_IMAGEM;
  try {
    return caminhoSite(peca.imagem);
  } catch {
    return PLACEHOLDER_IMAGEM;
  }
}

const CAMPOS_LINK_COMPRA_BUILDER = [
  "linkAfiliado",
  "linkVenda",
  "linkCompra",
  "urlCompra",
  "url",
];

function linkCompraValidoBuilder(link) {
  const valor = String(link ?? "").trim();
  if (!valor || valor === "#") return false;

  try {
    const url = new URL(valor, window.location.href);
    const host = url.hostname.toLowerCase();
    const hostsExemplo = [
      "sualoja.com",
      "www.sualoja.com",
      "example.com",
      "www.example.com",
      "localhost",
    ];

    return ["http:", "https:"].includes(url.protocol) && !hostsExemplo.includes(host);
  } catch {
    return false;
  }
}

function obterLinkCompraPeca(peca) {
  for (const campo of CAMPOS_LINK_COMPRA_BUILDER) {
    const link = String(peca?.[campo] ?? "").trim();
    if (linkCompraValidoBuilder(link)) return link;
  }

  return "";
}

function criarHtmlLinkLoja(peca, texto = "Ver nas lojas") {
  const link = obterLinkCompraPeca(peca);
  if (!link) return "";

  return `
    <a
      class="link-loja-peca"
      href="${escaparHtml(link)}"
      target="_blank"
      rel="sponsored noopener noreferrer"
      aria-label="${escaparHtml(texto)}: ${escaparHtml(peca?.nome ?? "componente")}" 
    >${escaparHtml(texto)}</a>
  `;
}

function obterItensComLinkCompra() {
  return obterItensResumoFinal()
    .map((item) => ({ ...item, linkCompra: obterLinkCompraPeca(item.peca) }))
    .filter((item) => item.linkCompra);
}

function escaparSeletor(valor = "") {
  const texto = String(valor);
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(texto);
  return texto.replace(/[^a-zA-Z0-9_-]/g, (caractere) => "\\" + caractere);
}

function obterPecaSelecionada(categoria, idPeca = "") {
  const estado = estadoMontagem[categoria];
  const pecas = Array.isArray(estado) ? estado.filter(Boolean) : [estado].filter(Boolean);
  return idPeca ? pecas.find((peca) => peca.id === idPeca) ?? null : pecas[0] ?? null;
}

function obterDadosObjeto3D(objeto) {
  let atual = objeto;

  while (atual) {
    if (atual.userData?.tipo || atual.userData?.categoria) {
      const categoria = atual.userData.categoria ?? atual.userData.tipo;
      const idPeca = atual.userData.pecaId ?? "";
      const peca = categoria && categoria !== "botao-power"
        ? obterPecaSelecionada(categoria, idPeca)
        : null;

      return {
        categoria,
        idPeca: idPeca || peca?.id || "",
        nome: atual.userData.nome ?? peca?.nome ?? "Componente",
        preco: atual.userData.preco ?? peca?.preco ?? "",
        objetoRaiz: atual.userData.objetoRaiz ?? atual
      };
    }

    atual = atual.parent;
  }

  return null;
}

function obterObjetosInterativos3D() {
  // O gabinete envolve fisicamente os demais componentes. Se ele participa do
  // raycast, a carcaça/vidro intercepta o clique antes de RAM, GPU, placa-mãe,
  // etc. O gabinete continua visível, mas a seleção dele é feita pela lista;
  // no 3D o ponteiro atravessa o case e alcança as peças internas.
  const modelos = Object.values(modelos3DAtivos ?? {})
    .filter(Boolean)
    .filter((modelo) => (modelo.userData?.categoria ?? modelo.userData?.tipo) !== "gabinete");
  const placeholdersVisiveis = objetosInterativos.filter((objeto) => objeto.visible !== false);
  return [...placeholdersVisiveis, ...modelos];
}

function destacarCardNaLista(categoria, idPeca = "") {
  const seletor = idPeca
    ? `.card-peca-mini[data-categoria="${escaparSeletor(categoria)}"][data-peca-id="${escaparSeletor(idPeca)}"]`
    : `.card-peca-mini[data-categoria="${escaparSeletor(categoria)}"]`;

  const card = document.querySelector(seletor);
  if (!card) return;

  document.querySelectorAll('.card-peca-mini.foco-3d').forEach((item) => {
    item.classList.remove('foco-3d');
  });

  card.classList.add('foco-3d');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  window.clearTimeout(timeoutDestaqueCard);
  timeoutDestaqueCard = window.setTimeout(() => {
    card.classList.remove('foco-3d');
  }, 1500);
}

function animarEscalaObjeto(objeto, intensidade = 1.08, duracao = 380) {
  if (!objeto) return;

  objeto.userData = objeto.userData ?? {};

  /*
   * Mantém uma escala-base fixa. Antes, vários cliques durante a animação
   * usavam a escala já aumentada como nova base, fazendo o placeholder
   * crescer a cada clique.
   */
  if (!objeto.userData.escalaBaseDestaque) {
    objeto.userData.escalaBaseDestaque = objeto.scale.clone();
  }

  const escalaBase = objeto.userData.escalaBaseDestaque.clone();
  const token = (objeto.userData.tokenAnimacaoEscala ?? 0) + 1;
  objeto.userData.tokenAnimacaoEscala = token;
  objeto.scale.copy(escalaBase);

  const inicio = performance.now();

  function quadro(agora) {
    if (objeto.userData.tokenAnimacaoEscala !== token) return;

    const progresso = Math.min(1, (agora - inicio) / duracao);
    const onda = Math.sin(progresso * Math.PI);
    const fator = 1 + (intensidade - 1) * onda;

    objeto.scale.copy(escalaBase).multiplyScalar(fator);

    if (progresso < 1) {
      requestAnimationFrame(quadro);
    } else {
      objeto.scale.copy(escalaBase);
    }
  }

  requestAnimationFrame(quadro);
}

function destacarCategoria3D(categoria, idPeca = "") {
  categoriaDestaque3D = categoria;
  const grupoModelo = modelos3DAtivos?.[categoria];
  const alvos = grupoModelo
    ? [grupoModelo]
    : (objetosPorCategoria[categoria] ?? []).filter((objeto) => objeto.visible);

  alvos.forEach((objeto) => animarEscalaObjeto(objeto));

  const alvoPrincipal = grupoModelo ?? alvos[0];
  if (alvoPrincipal) {
    const caixa = new THREE.Box3().setFromObject(alvoPrincipal);
    if (!caixa.isEmpty()) {
      const centro = caixa.getCenter(new THREE.Vector3());
      controles.target.lerp(centro, 0.45);
      controles.update();
    }
  }

  if (idPeca) destacarCardNaLista(categoria, idPeca);
}

function aplicarFeedbackSelecao(categoria, idPeca) {
  requestAnimationFrame(() => {
    const card = document.querySelector(
      `.card-peca-mini[data-categoria="${escaparSeletor(categoria)}"][data-peca-id="${escaparSeletor(idPeca)}"]`
    );

    if (card) {
      card.classList.remove('feedback-selecao');
      void card.offsetWidth;
      card.classList.add('feedback-selecao');
      window.setTimeout(() => card.classList.remove('feedback-selecao'), 520);
    }

    destacarCategoria3D(categoria, idPeca);
  });
}

function animarEntradaModelo(modelo, escalaFinal) {
  const inicio = performance.now();
  const duracao = 360;
  const estadosMateriais = new Map();

  modelo.scale.copy(escalaFinal).multiplyScalar(0.82);

  modelo.traverse((objeto) => {
    if (!objeto.isMesh) return;

    const materiais = Array.isArray(objeto.material)
      ? objeto.material
      : [objeto.material];

    materiais.filter(Boolean).forEach((material) => {
      /*
       * Um mesmo material pode ser compartilhado por vários meshes do GLB.
       * Ele deve ser registrado uma única vez; caso contrário, a segunda
       * passagem salvaria opacity 0 como valor final e partes da GPU
       * permaneceriam invisíveis.
       */
      if (estadosMateriais.has(material)) return;

      estadosMateriais.set(material, {
        opacity: material.opacity ?? 1,
        transparent: Boolean(material.transparent),
        depthWrite: material.depthWrite !== false,
      });

      material.transparent = true;
      material.depthWrite = false;
      material.opacity = 0;
      material.needsUpdate = true;
    });
  });

  function restaurarMateriais() {
    estadosMateriais.forEach((estado, material) => {
      material.opacity = estado.opacity;
      material.transparent = estado.transparent;
      material.depthWrite = estado.depthWrite;
      material.needsUpdate = true;
    });
  }

  function quadro(agora) {
    const progresso = Math.min(1, (agora - inicio) / duracao);
    const suavizado = 1 - Math.pow(1 - progresso, 3);

    modelo.scale
      .copy(escalaFinal)
      .multiplyScalar(0.82 + 0.18 * suavizado);

    estadosMateriais.forEach((estado, material) => {
      material.opacity = estado.opacity * suavizado;
    });

    if (progresso < 1) {
      requestAnimationFrame(quadro);
    } else {
      modelo.scale.copy(escalaFinal);
      restaurarMateriais();
    }
  }

  requestAnimationFrame(quadro);
}

function animarPlaceholder(objeto, mostrar, opacidadePersonalizada = null) {
  if (!objeto?.material) return;

  objeto.userData = objeto.userData ?? {};

  const token = (objeto.userData.tokenAnimacaoPlaceholder ?? 0) + 1;
  objeto.userData.tokenAnimacaoPlaceholder = token;

  const opacidadeFinal = opacidadePersonalizada ?? (
    mostrar
      ? (objeto.userData.opacidadeOriginal ?? 0.35)
      : 0
  );

  const opacidadeInicial = objeto.material.opacity ?? 0;
  const inicio = performance.now();
  const duracao = 220;

  if (mostrar) objeto.visible = true;
  objeto.material.transparent = true;

  function quadro(agora) {
    if (objeto.userData.tokenAnimacaoPlaceholder !== token) return;

    const progresso = Math.min(1, (agora - inicio) / duracao);
    objeto.material.opacity =
      opacidadeInicial + (opacidadeFinal - opacidadeInicial) * progresso;

    if (progresso < 1) {
      requestAnimationFrame(quadro);
    } else {
      objeto.material.opacity = opacidadeFinal;
      objeto.visible = mostrar;
    }
  }

  requestAnimationFrame(quadro);
}

/* =========================================================
   MAQUETE 3D
========================================================= */

const grupoMaquete = new THREE.Group();
grupoMaquete.name = "maquete-pc-builder";
cena.add(grupoMaquete);

function criarMaterial({ cor, opacidade = 0.35, wireframe = true }) {
  return new THREE.MeshBasicMaterial({
    color: cor,
    transparent: opacidade < 1,
    opacity: opacidade,
    wireframe,
  });
}

function criarObjeto({
  geometria,
  material,
  posicao,
  rotacao = null,
  tipo,
  nome,
}) {
  const objeto = new THREE.Mesh(geometria, material);
  objeto.position.set(...posicao);
  if (rotacao) objeto.rotation.set(...rotacao);
  objeto.userData = {
    tipo,
    nome,
    corOriginal: material.color.getHex(),
    opacidadeOriginal: material.opacity,
    wireframeOriginal: material.wireframe,
  };
  grupoMaquete.add(objeto);
  return objeto;
}

const slotGabinete = criarObjeto({
  geometria: new THREE.BoxGeometry(2.4, 4.6, 4.5),
  material: criarMaterial({ cor: 0x64748b, opacidade: 0.16 }),
  posicao: [0, 2.3, 0],
  tipo: "gabinete",
  nome: "Gabinete",
});

const psuCover = criarObjeto({
  geometria: new THREE.BoxGeometry(2.4, 1.2, 4.5),
  material: criarMaterial({ cor: 0x111827, opacidade: 0.55, wireframe: false }),
  posicao: [0, 0.6, 0],
  tipo: "gabinete",
  nome: "Compartimento inferior",
});

const slotPlacaMae = criarObjeto({
  geometria: new THREE.BoxGeometry(0.1, 3.0, 2.4),
  material: criarMaterial({ cor: 0x2563eb, opacidade: 0.25 }),
  posicao: [-1.15, 3.0, 0.8],
  tipo: "placamae",
  nome: "Slot da Placa-mãe",
});

const slotProcessador = criarObjeto({
  geometria: new THREE.BoxGeometry(0.1, 0.6, 0.6),
  material: criarMaterial({ cor: 0xef4444, opacidade: 0.3 }),
  posicao: [-1.05, 3.4, 1.0],
  tipo: "processador",
  nome: "Slot do Processador",
});

const posXRam = -0.9;
const slotsRam = [0.6, 0.5, 0.4, 0.3].map((z, indice) =>
  criarObjeto({
    geometria: new THREE.BoxGeometry(0.15, 1, 0.05),
    material: criarMaterial({ cor: 0x8b5cf6, opacidade: 0.35 }),
    posicao: [posXRam, 3.55, z],
    tipo: "memoria",
    nome: `Slot RAM ${indice + 1}`,
  }),
);

const slotM2 = criarObjeto({
  geometria: new THREE.BoxGeometry(0.05, 0.15, 0.6),
  material: criarMaterial({ cor: 0x06b6d4, opacidade: 0.4 }),
  posicao: [-1.05, 2.6, 1.0],
  tipo: "armazenamento",
  nome: "Slot M.2 NVMe",
});

const slotSsd = criarObjeto({
  geometria: new THREE.BoxGeometry(0.15, 1.0, 0.7),
  material: criarMaterial({ cor: 0xf59e0b, opacidade: 0.4 }),
  posicao: [-1.35, 2.5, 1.0],
  tipo: "armazenamento",
  nome: "Compartimento SSD",
});

const slotGpu = criarObjeto({
  geometria: new THREE.BoxGeometry(1.4, 0.6, 2.6),
  material: criarMaterial({ cor: 0xf97316, opacidade: 0.3 }),
  posicao: [-0.4, 2.2, 0.5],
  tipo: "placavideo",
  nome: "Slot PCIe GPU",
});

const slotCooler = criarObjeto({
  geometria: new THREE.BoxGeometry(0.6, 0.6, 0.6),
  material: criarMaterial({ cor: 0x0ea5e9, opacidade: 0.35 }),
  posicao: [-0.7, 3.4, 1.0],
  tipo: "cooler",
  nome: "Cooler do Processador",
});

const slotFonte = criarObjeto({
  geometria: new THREE.BoxGeometry(1.6, 1.1, 1.6),
  material: criarMaterial({ cor: 0xeab308, opacidade: 0.35 }),
  posicao: [-0.4, 0.6, 1.42],
  tipo: "fonte",
  nome: "Fonte de alimentação",
});

const listaFans = [];
function criarFan(posicao, nome) {
  const fan = criarObjeto({
    geometria: new THREE.CylinderGeometry(0.5, 0.5, 0.15, 24),
    material: criarMaterial({ cor: 0x06b6d4, opacidade: 0.45 }),
    posicao,
    rotacao: [Math.PI / 2, 0, 0],
    tipo: "ventoinhas",
    nome,
  });
  listaFans.push(fan);
  return fan;
}

const fanTras = criarFan([0.1, 3.5, 2], "Ventoinha traseira");
const fanFrente1 = criarFan([0, 3.9, -2.15], "Ventoinha frontal superior");
const fanFrente2 = criarFan([0, 2.8, -2.15], "Ventoinha frontal central");
const fanFrente3 = criarFan([0, 1.7, -2.15], "Ventoinha frontal inferior");

const botaoPower3D = criarObjeto({
  geometria: new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24),
  material: criarMaterial({ cor: 0xef4444, opacidade: 1, wireframe: false }),
  posicao: [0.8, 4.6, -2.1],
  rotacao: [0, 0, 0],
  tipo: "botao-power",
  nome: "Ligar ou desligar PC",
});

const objetosInterativos = [
  slotPlacaMae,
  slotProcessador,
  ...slotsRam,
  slotGpu,
  slotFonte,
  slotCooler,
  slotSsd,
  slotM2,
  fanTras,
  fanFrente1,
  fanFrente2,
  fanFrente3,
  botaoPower3D,
];

const objetosPorCategoria = {
  gabinete: [slotGabinete, psuCover],
  processador: [slotProcessador],
  placamae: [slotPlacaMae],
  cooler: [slotCooler],
  memoria: slotsRam,
  placavideo: [slotGpu],
  armazenamento: [slotM2, slotSsd],
  fonte: [slotFonte],
  ventoinhas: listaFans,
};

/*
 * Layout 3D relativo ao gabinete.
 * O gabinete define apenas os limites e pontos de montagem; as pecas nunca
 * sao escaladas para "caber". Quando uma peca e maior que o espaco fisico,
 * ela permanece no tamanho real e pode ultrapassar o limite visual, deixando
 * a incompatibilidade evidente.
 */
const DIMENSOES_GABINETE_PADRAO_3D = Object.freeze({
  largura: 2.4,
  altura: 4.6,
  profundidade: 4.5,
});

function numeroMmPara3DLayout(valor, fallbackMm, minimo, maximo) {
  const numero = Number(valor);
  const mm = Number.isFinite(numero) && numero > 0 ? numero : fallbackMm;
  return Math.min(maximo, Math.max(minimo, mm * 0.01));
}

function obterDimensoesMinimasConteudoGabinete3D() {
  // Limite visual mínimo do conjunto selecionado. As peças não são deformadas:
  // quando o gabinete procedural cadastrado é menor que o conjunto, cresce
  // apenas a carcaça/área útil da maquete para manter tudo dentro de contexto.
  let largura = 1.75;
  let altura = 2.80;
  let profundidade = 2.80;

  if (estadoMontagem.placamae) {
    const mb = obterDimensoesPlacaMaeLayout3D();
    altura = Math.max(altura, 1.10 + mb.altura + 0.32);
    profundidade = Math.max(profundidade, mb.profundidade + 0.30);
  }

  if (estadoMontagem.placavideo) {
    const gpu = obterDimensoesGpuLayout3D();
    largura = Math.max(largura, gpu.altura + 0.32);
    profundidade = Math.max(profundidade, gpu.comprimento + 0.30);
    altura = Math.max(altura, 1.08 + gpu.espessura + 1.40);
  }

  if (estadoMontagem.fonte) {
    const psu = obterDimensoesFonteLayout3D();
    largura = Math.max(largura, psu.largura + 0.25);
    profundidade = Math.max(profundidade, psu.profundidade + 0.28);
    altura = Math.max(altura, psu.altura + 2.20);
  }

  if (estadoMontagem.cooler) {
    const specs = estadoMontagem.cooler?.especificacoes && typeof estadoMontagem.cooler.especificacoes === "object"
      ? estadoMontagem.cooler.especificacoes
      : {};
    const texto = `${specs.tipo || ""} ${estadoMontagem.cooler?.nome || ""}`.toLowerCase();
    if (/water|aio|liquid|radiador/.test(texto) || specs.tamanhoRadiadorMm) {
      const radiador = numeroMmPara3DLayout(specs.tamanhoRadiadorMm, 240, 1.20, 4.20);
      profundidade = Math.max(profundidade, radiador + 0.30);
    } else {
      const alturaCooler = numeroMmPara3DLayout(specs.alturaMm, 155, 0.75, 2.20);
      largura = Math.max(largura, alturaCooler + 0.32);
    }
  }

  const fansFrontais = estadoMontagem.ventoinhas
    .slice(1, 4)
    .filter(Boolean);
  if (fansFrontais.length) {
    const maiorFan = Math.max(...fansFrontais.map((fan) => {
      const specs = fan?.especificacoes && typeof fan.especificacoes === "object" ? fan.especificacoes : {};
      return numeroMmPara3DLayout(specs.tamanhoMm, 120, 0.80, 1.60);
    }));
    altura = Math.max(altura, 1.05 + fansFrontais.length * maiorFan + 0.24);
    largura = Math.max(largura, maiorFan + 0.28);
  }

  return { largura, altura, profundidade };
}

function obterDimensoesGabineteLayout3D(peca = estadoMontagem.gabinete) {
  if (!peca) {
    const minimoConteudo = obterDimensoesMinimasConteudoGabinete3D();
    return {
      largura: Math.max(DIMENSOES_GABINETE_PADRAO_3D.largura, minimoConteudo.largura),
      altura: Math.max(DIMENSOES_GABINETE_PADRAO_3D.altura, minimoConteudo.altura),
      profundidade: Math.max(DIMENSOES_GABINETE_PADRAO_3D.profundidade, minimoConteudo.profundidade),
    };
  }
  const specs = peca?.especificacoes && typeof peca.especificacoes === "object"
    ? peca.especificacoes
    : {};

  const texto = [peca?.nome, peca?.marca, peca?.modelo, specs?.tamanho]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  let padrao = { ...DIMENSOES_GABINETE_PADRAO_3D };
  if (/SFF|MINI_ITX|MINI-ITX|NR200|COMPACT/.test(texto)) {
    padrao = { largura: 1.95, altura: 3.25, profundidade: 3.65 };
  } else if (/MINI_TOWER|MINI TOWER/.test(texto)) {
    padrao = { largura: 2.05, altura: 3.75, profundidade: 3.90 };
  } else if (/FULL_TOWER|FULL TOWER|COSMOS|7000D|7000X/.test(texto)) {
    padrao = { largura: 2.60, altura: 5.65, profundidade: 5.30 };
  } else if (/O11|H9|Y60|AQUARI|PANORAM|DUAL.?CHAMBER/.test(texto)) {
    padrao = { largura: 2.85, altura: 4.65, profundidade: 4.65 };
  } else if (/OPEN_FRAME|OPEN FRAME/.test(texto)) {
    padrao = { largura: 2.40, altura: 4.30, profundidade: 4.10 };
  }

  const larguraMm = Number(specs.larguraMm ?? peca.larguraMm);
  const alturaMm = Number(specs.alturaMm ?? peca.alturaMm);
  const profundidadeMm = Number(specs.profundidadeMm ?? peca.profundidadeMm);
  const dimensoesMmValidas =
    Number.isFinite(larguraMm) && larguraMm >= 140 && larguraMm <= 420 &&
    Number.isFinite(alturaMm) && alturaMm >= 250 && alturaMm <= 750 &&
    Number.isFinite(profundidadeMm) && profundidadeMm >= 250 && profundidadeMm <= 750;

  // Só usa dimensões cadastradas quando o conjunto inteiro é plausível. Isso
  // evita um único campo incorreto deformar o gabinete e jogar as peças para
  // fora de contexto. Na ausência delas, usa proporções coerentes por formato.
  if (!dimensoesMmValidas) {
    const minimoConteudo = obterDimensoesMinimasConteudoGabinete3D();
    return {
      largura: Math.max(padrao.largura, minimoConteudo.largura),
      altura: Math.max(padrao.altura, minimoConteudo.altura),
      profundidade: Math.max(padrao.profundidade, minimoConteudo.profundidade),
    };
  }

  const dimensoesBase = {
    largura: numeroMmPara3DLayout(larguraMm, padrao.largura * 100, 1.55, 4.2),
    altura: numeroMmPara3DLayout(alturaMm, padrao.altura * 100, 2.4, 7.2),
    profundidade: numeroMmPara3DLayout(profundidadeMm, padrao.profundidade * 100, 2.5, 7.6),
  };
  const minimoConteudo = obterDimensoesMinimasConteudoGabinete3D();

  return {
    largura: Math.max(dimensoesBase.largura, minimoConteudo.largura),
    altura: Math.max(dimensoesBase.altura, minimoConteudo.altura),
    profundidade: Math.max(dimensoesBase.profundidade, minimoConteudo.profundidade),
  };
}

function obterDimensoesPlacaMaeLayout3D() {
  const peca = estadoMontagem.placamae;
  const specs = peca?.especificacoes && typeof peca.especificacoes === "object" ? peca.especificacoes : {};
  const formato = String(specs.formato || peca?.formato || "ATX").toUpperCase();
  if (formato.includes("MINI")) return { altura: 1.70, profundidade: 1.70 };
  if (formato.includes("MICRO") || formato.includes("MATX") || formato.includes("M-ATX")) return { altura: 2.44, profundidade: 2.44 };
  if (formato.includes("E_ATX") || formato.includes("E-ATX") || formato.includes("EATX")) return { altura: 3.05, profundidade: 3.30 };
  return { altura: 3.05, profundidade: 2.44 };
}

function obterDimensoesGpuLayout3D() {
  const peca = estadoMontagem.placavideo;
  const specs = peca?.especificacoes && typeof peca.especificacoes === "object" ? peca.especificacoes : {};
  return {
    altura: numeroMmPara3DLayout(specs.alturaMm ?? peca?.alturaMm, 120, 0.65, 2.2),
    espessura: numeroMmPara3DLayout(specs.espessuraMm ?? (Number(specs.slotsOcupados || 2.5) * 20), 50, 0.24, 1.3),
    comprimento: numeroMmPara3DLayout(specs.comprimentoMm ?? peca?.comprimentoMm, 280, 1.25, 4.8),
  };
}

function obterDimensoesFonteLayout3D() {
  const peca = estadoMontagem.fonte;
  const specs = peca?.especificacoes && typeof peca.especificacoes === "object" ? peca.especificacoes : {};
  return {
    largura: numeroMmPara3DLayout(specs.larguraMm, 150, 1.0, 2.0),
    altura: numeroMmPara3DLayout(specs.alturaMm, 86, 0.62, 1.35),
    profundidade: numeroMmPara3DLayout(specs.comprimentoMm ?? specs.profundidadeMm, 160, 1.0, 2.7),
  };
}

function centroDentroDosLimites(tamanho, minimo, maximo, preferido) {
  const metade = Math.max(0, Number(tamanho) || 0) / 2;
  const limiteMin = minimo + metade;
  const limiteMax = maximo - metade;
  if (limiteMax < limiteMin) return (minimo + maximo) / 2;
  return Math.min(limiteMax, Math.max(limiteMin, preferido));
}

function atualizarGeometriaCaixa3D(objeto, largura, altura, profundidade) {
  if (!objeto) return;
  objeto.geometry?.dispose?.();
  objeto.geometry = new THREE.BoxGeometry(
    Math.max(0.03, largura),
    Math.max(0.03, altura),
    Math.max(0.03, profundidade),
  );
}

function atualizarAncorasGabinete3D(pecaGabinete = estadoMontagem.gabinete) {
  const { largura, altura, profundidade } = obterDimensoesGabineteLayout3D(pecaGabinete);
  const meiaL = largura / 2;
  const meiaP = profundidade / 2;
  const margem = 0.10;

  // Gabinete e compartimento inferior acompanham somente as dimensoes do case.
  slotGabinete.position.set(0, altura / 2, 0);
  atualizarGeometriaCaixa3D(slotGabinete, largura, altura, profundidade);

  const alturaShroud = Math.min(1.25, Math.max(0.72, altura * 0.245));
  psuCover.position.set(0, alturaShroud / 2, 0);
  atualizarGeometriaCaixa3D(psuCover, largura, alturaShroud, profundidade);

  // Placa-mae: encostada na bandeja lateral e alinhada pela traseira.
  const mb = obterDimensoesPlacaMaeLayout3D();
  const mbX = -meiaL + 0.08;
  const mbY = alturaShroud + margem + mb.altura / 2 + 0.06;
  const mbZ = meiaP - margem - mb.profundidade / 2;
  slotPlacaMae.position.set(mbX, mbY, mbZ);
  atualizarGeometriaCaixa3D(slotPlacaMae, 0.10, mb.altura, mb.profundidade);

  // CPU, RAM e M.2 seguem a placa-mae, nao o tamanho absoluto da cena.
  const cpuY = centroDentroDosLimites(0.42, alturaShroud + margem, altura - margem, mbY + Math.min(0.42, mb.altura * 0.14));
  const cpuZ = centroDentroDosLimites(0.42, -meiaP + margem, meiaP - margem, mbZ + Math.min(0.24, mb.profundidade * 0.10));
  slotProcessador.position.set(mbX + 0.10, cpuY, cpuZ);
  slotCooler.position.set(-meiaL + Math.min(0.62, largura * 0.28), cpuY, cpuZ);

  // DIMMs: usam exatamente a mesma referência visual desenhada no fallback da
  // placa-mãe. Assim cada pente entra no centro de um slot diferente em vez de
  // ficar apenas "perto" do socket. Os valores escalam levemente com o formato
  // da placa para continuar dentro de ATX, mATX e Mini-ITX.
  const deslocamentoRamY = Math.min(0.35, mb.altura * 0.14);
  const deslocamentoRamZ = -Math.min(0.45, mb.profundidade * 0.18);
  const espacamentoRamZ = Math.min(0.11, mb.profundidade * 0.045);
  const ramY = centroDentroDosLimites(1.32, alturaShroud + margem, altura - margem, mbY + deslocamentoRamY);
  slotsRam.forEach((slot, indice) => {
    const zSlot = mbZ + deslocamentoRamZ + indice * espacamentoRamZ;
    slot.position.set(
      mbX + 0.10,
      ramY,
      centroDentroDosLimites(0.08, -meiaP + margem, meiaP - margem, zSlot),
    );
  });

  slotM2.position.set(mbX + 0.10, mbY - Math.min(0.48, mb.altura * 0.16), mbZ + Math.min(0.22, mb.profundidade * 0.10));

  // GPU: mantem comprimento/altura/espessura reais e alinha a traseira no PCIe.
  const gpu = obterDimensoesGpuLayout3D();
  const gpuX = -meiaL + margem + gpu.altura / 2;
  const gpuY = centroDentroDosLimites(gpu.espessura, alturaShroud + margem, altura - margem, mbY - Math.min(0.82, mb.altura * 0.27));
  // A traseira da GPU permanece presa ao bracket PCIe. Se for longa demais,
  // ela ultrapassa a frente do gabinete em vez de ser encolhida/centralizada.
  const gpuZ = meiaP - margem - gpu.comprimento / 2;
  slotGpu.position.set(gpuX, gpuY, gpuZ);
  atualizarGeometriaCaixa3D(slotGpu, gpu.altura, gpu.espessura, gpu.comprimento);

  // Fonte: fundo/traseira, preservando as dimensoes reais.
  const psu = obterDimensoesFonteLayout3D();
  const psuX = -meiaL + margem + psu.largura / 2;
  const psuY = margem + psu.altura / 2;
  const psuZ = meiaP - margem - psu.profundidade / 2;
  slotFonte.position.set(psuX, psuY, psuZ);
  atualizarGeometriaCaixa3D(slotFonte, psu.largura, psu.altura, psu.profundidade);

  // SSD 2.5/HDD fica numa baia interna relativa ao case.
  slotSsd.position.set(
    -meiaL + Math.min(0.18, largura * 0.08),
    centroDentroDosLimites(0.9, alturaShroud + margem, altura - margem, alturaShroud + 0.70),
    centroDentroDosLimites(1.0, -meiaP + margem, meiaP - margem, -meiaP + 0.72),
  );

  // Fans frontais e traseira ficam presas as faces do gabinete.
  const tamanhosFans = estadoMontagem.ventoinhas.map((fan) => {
    const specs = fan?.especificacoes && typeof fan.especificacoes === "object" ? fan.especificacoes : {};
    return numeroMmPara3DLayout(specs.tamanhoMm, 120, 0.80, 1.60);
  });
  const fanPadrao = tamanhosFans.find(Boolean) || 1.20;
  const raioFan = fanPadrao * 0.40;
  const minFanY = alturaShroud + raioFan + 0.10;
  const maxFanY = Math.max(minFanY, altura - raioFan - 0.12);
  const fanYs = [maxFanY, (minFanY + maxFanY) / 2, minFanY];
  const zFrente = -meiaP + 0.10;
  const zTras = meiaP - 0.10;

  fanTras.position.set(0, maxFanY, zTras);
  fanFrente1.position.set(0, fanYs[0], zFrente);
  fanFrente2.position.set(0, fanYs[1], zFrente);
  fanFrente3.position.set(0, fanYs[2], zFrente);

  botaoPower3D.position.set(meiaL * 0.58, Math.max(0.2, altura - 0.03), -meiaP * 0.90);

  const baseSemConteudo = pecaGabinete
    ? (() => {
        const specs = pecaGabinete?.especificacoes && typeof pecaGabinete.especificacoes === "object" ? pecaGabinete.especificacoes : {};
        return {
          largura: numeroMmPara3DLayout(specs.larguraMm ?? pecaGabinete.larguraMm, largura * 100, 1.55, 4.2),
          altura: numeroMmPara3DLayout(specs.alturaMm ?? pecaGabinete.alturaMm, altura * 100, 2.4, 7.2),
          profundidade: numeroMmPara3DLayout(specs.profundidadeMm ?? pecaGabinete.profundidadeMm, profundidade * 100, 2.5, 7.6),
        };
      })()
    : DIMENSOES_GABINETE_PADRAO_3D;
  grupoMaquete.userData.dimensoesGabineteAtuais = {
    largura,
    altura,
    profundidade,
    alturaShroud,
    ajusteVisualAutomatico: largura > baseSemConteudo.largura + 0.01
      || altura > baseSemConteudo.altura + 0.01
      || profundidade > baseSemConteudo.profundidade + 0.01,
  };
}

function reconstruirRepresentacoes3DParaGabinete() {
  atualizarAncorasGabinete3D(estadoMontagem.gabinete);
  Object.entries(estadoMontagem).forEach(([categoria, estado]) => {
    atualizarPecaNo3D(categoria, estado);
  });
  atualizarVisual3D();
}

Object.values(objetosPorCategoria)
  .flat()
  .forEach((objeto) => {
    objeto.visible = true;
  });
botaoPower3D.visible = true;

const modelos3DAtivos = {};
const versaoCarregamento3D = {};

function atualizarVisual3D() {
  Object.entries(objetosPorCategoria).forEach(([categoria, objetos]) => {
    const estadoDaCategoria = estadoMontagem[categoria];
    const temPeca = Array.isArray(estadoDaCategoria)
      ? estadoDaCategoria.some(Boolean)
      : Boolean(estadoDaCategoria);
    const temRepresentacao3D = Boolean(modelos3DAtivos?.[categoria]);

    objetos.forEach((objeto, index) => {
      if (temRepresentacao3D && temPeca) {
        objeto.visible = false;
        return;
      }
      if (categoria === "gabinete") {
        objeto.visible = true;
        objeto.material.transparent = true;

        /*
         * Os gabinetes atuais não possuem GLB. Portanto a maquete do
         * gabinete continua translúcida para não esconder as peças internas.
         */
        if (objeto === slotGabinete) {
          objeto.material.wireframe = true;
          objeto.material.opacity = temPeca ? 0.09 : 0.16;
        } else {
          objeto.material.wireframe = false;
          objeto.material.opacity = temPeca ? 0.16 : 0.28;
        }
        return;
      }

      const slotPreenchido = Array.isArray(estadoDaCategoria)
        ? Boolean(estadoDaCategoria[index])
        : temPeca;

      objeto.material.wireframe = !slotPreenchido;
      objeto.material.opacity = slotPreenchido
        ? 0.92
        : objeto.userData.opacidadeOriginal;
    });
  });
}

/* =========================================================
   CANVAS, CÂMERA E INTERAÇÃO 3D
========================================================= */

function ajustarTamanho3D() {
  const container3D = document.getElementById("canvas-3d-container");
  if (!container3D || !renderizador) return;

  const largura = container3D.clientWidth;
  const altura = container3D.clientHeight;
  if (largura <= 0 || altura <= 0) return;

  renderizador.setSize(largura, altura, false);
  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", ajustarTamanho3D);

function restaurarCamera() {
  camera.position.copy(POSICAO_CAMERA_INICIAL);
  controles.target.copy(ALVO_CAMERA_INICIAL);
  controles.update();
}

function aproximarCamera(fator) {
  const deslocamento = camera.position
    .clone()
    .sub(controles.target)
    .multiplyScalar(fator);
  camera.position.copy(controles.target).add(deslocamento);
  controles.update();
}

function alternarEnergia() {
  const botaoLigar = document.getElementById("btn-rgb");

  if (!podeLigarSistema) {
    botaoLigar?.classList.remove("negado");
    void botaoLigar?.offsetWidth;
    botaoLigar?.classList.add("negado");
    botaoLigar?.setAttribute("title", "Complete a build e corrija incompatibilidades para ligar o PC.");
    return;
  }

  sistemaLigado = !sistemaLigado;
  cena.background = new THREE.Color(sistemaLigado ? 0x1f2937 : 0xeef2f7);
  botaoLigar?.classList.toggle("ativo", sistemaLigado);
  botaoLigar?.setAttribute("aria-pressed", String(sistemaLigado));
  botaoLigar?.setAttribute("title", sistemaLigado ? "Desligar PC" : "Ligar PC");

  if (!sistemaLigado) {
    objetosInterativos.forEach((objeto) => {
      if (objeto === botaoPower3D) return;
      objeto.material.color.setHex(objeto.userData.corOriginal);
    });
    atualizarVisual3D();
  }
}

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();

function obterIntersecoes(evento, canvas) {
  const rect = canvas.getBoundingClientRect();
  ponteiro.x = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
  ponteiro.y = -((evento.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ponteiro, camera);
  return raycaster.intersectObjects(obterObjetosInterativos3D(), true);
}

function configurarInteracao3D() {
  const canvas = renderizador?.domElement;
  const tooltip = document.getElementById("tooltip-3d");
  if (!canvas || canvas.dataset.interacaoConfigurada === "true") return;
  canvas.dataset.interacaoConfigurada = "true";

  canvas.addEventListener("mousemove", (evento) => {
    const objeto = obterIntersecoes(evento, canvas)[0]?.object;
    const dados = obterDadosObjeto3D(objeto);

    canvas.style.cursor = dados ? "pointer" : "grab";
    if (!tooltip) return;

    if (!dados?.nome) {
      tooltip.style.display = "none";
      return;
    }

    if (dados.categoria === "botao-power") {
      tooltip.innerHTML = podeLigarSistema
        ? `<strong>${sistemaLigado ? "Desligar PC" : "Ligar PC"}</strong><span>Build verificada</span>`
        : `<strong>Ligar PC</strong><span>Complete a build primeiro</span>`;
    } else {
      tooltip.innerHTML = `
        <strong>${escaparHtml(dados.nome)}</strong>
        ${dados.preco ? `<span>${escaparHtml(formatarPreco(dados.preco))}</span>` : ""}
      `;
    }

    tooltip.style.display = "block";
    tooltip.style.left = `${evento.clientX + 14}px`;
    tooltip.style.top = `${evento.clientY + 14}px`;
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "grab";
    if (tooltip) tooltip.style.display = "none";
  });

  canvas.addEventListener("click", (evento) => {
    const objeto = obterIntersecoes(evento, canvas)[0]?.object;
    const dados = obterDadosObjeto3D(objeto);
    if (!dados?.categoria) return;

    if (dados.categoria === "botao-power") {
      alternarEnergia();
      return;
    }

    mudarAbaUI(dados.categoria);
    destacarCategoria3D(dados.categoria, dados.idPeca);
    if (dados.idPeca) destacarCardNaLista(dados.categoria, dados.idPeca);
  });
}

function configurarControlesCamera() {
  const barraControles = document.querySelector(".controles-camera");
  if (!barraControles || barraControles.dataset.configurada === "true") return;
  barraControles.dataset.configurada = "true";

  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.minDistance = 4;
  controles.maxDistance = 18;
  controles.autoRotateSpeed = 1.2;

  const botaoGirar = document.getElementById("btn-girar");
  botaoGirar?.addEventListener("click", () => {
    controles.autoRotate = !controles.autoRotate;
    botaoGirar.classList.toggle("ativo", controles.autoRotate);
    botaoGirar.setAttribute("aria-pressed", String(controles.autoRotate));
    botaoGirar.title = controles.autoRotate
      ? "Parar rotação automática"
      : "Ativar rotação automática";
  });

  document.getElementById("btn-zoom-mais")?.addEventListener("click", () => aproximarCamera(0.85));
  document.getElementById("btn-zoom-menos")?.addEventListener("click", () => aproximarCamera(1.15));
  document.getElementById("btn-rgb")?.addEventListener("click", alternarEnergia);
  document.getElementById("btn-reset-camera")?.addEventListener("click", restaurarCamera);
}

/* =========================================================
   CATÁLOGO E CARDS (COM SUPORTE A SLOTS)
========================================================= */

async function carregarCatalogoBuilder() {
  const containerLista = document.getElementById("lista-pecas-builder");
  catalogoCarregadoReact = false;
  erroCatalogoReact = "";
  if (globalThis.PC_BUILDER_REACT_LIST !== true) {
    definirEstadoContainer(containerLista, "carregando", "Carregando componentes...");
  } else {
    emitirEstadoMontadorReact();
  }
  try {
    const dados = await api.listarPecas();

    if (!Array.isArray(dados.pecas)) {
      throw new Error(
        'O pecas.json não contém uma lista válida chamada "pecas".',
      );
    }

    catalogoPecas = dados.pecas.reduce((catalogo, peca) => {
      const categoriaBuilder =
        mapaCategoriasBuilder[peca.categoria] ?? peca.categoria;
      if (!catalogo[categoriaBuilder]) catalogo[categoriaBuilder] = [];
      catalogo[categoriaBuilder].push(peca);
      return catalogo;
    }, {});
    catalogoCarregadoReact = true;
    erroCatalogoReact = "";

    const restaurouConfiguracao = aplicarConfiguracaoRecebidaDaHome();
    restauracaoInicialConcluida = true;

    if (restaurouConfiguracao) {
      salvarRascunhoBuild();
    } else {
      atualizarStatusSalvamento(
        "Salvamento automático ativo neste navegador.",
        "neutro",
      );
    }

    renderizarListaPecas(categoriaAtual);
    registrarHistorico(serializarEstadoMontagem(), "Estado inicial");
  } catch (erro) {
    console.error("Erro ao carregar catálogo:", erro);
    catalogoCarregadoReact = false;
    erroCatalogoReact = "Não foi possível carregar as peças. Atualize a página para tentar novamente.";
    if (globalThis.PC_BUILDER_REACT_LIST !== true) {
      definirEstadoContainer(
        containerLista,
        "erro",
        erroCatalogoReact,
      );
    } else {
      emitirEstadoMontadorReact();
    }
    mostrarToast("Falha ao carregar o catálogo de peças.", "erro");
  }
}


function configurarFallbackImagens(container) {
  container.querySelectorAll("img").forEach((imagem) => {
    imagem.addEventListener("error", () => {
      imagem.src = PLACEHOLDER_IMAGEM;
    }, { once: true });
  });
}


function clonarEstadoMontagemParaSimulacao() {
  return Object.fromEntries(
    Object.entries(estadoMontagem).map(([categoria, estado]) => [
      categoria,
      Array.isArray(estado) ? estado.map((peca) => (peca ? { ...peca } : null)) : (estado ? { ...estado } : null),
    ]),
  );
}

function avaliarCompatibilidadePeca(categoria, peca) {
  if (!peca || !categoria || !(categoria in estadoMontagem)) {
    return { tipo: "neutro", texto: "Compatibilidade será validada" };
  }

  if (verificarPecaSelecionada(categoria, peca)) {
    return { tipo: "selecionada", texto: "Selecionada" };
  }

  if (!configuracaoPossuiPecas(serializarEstadoMontagem())) {
    return { tipo: "neutro", texto: "Escolha livre para começar" };
  }

  const simulacao = clonarEstadoMontagemParaSimulacao();
  const estadoCategoria = simulacao[categoria];

  if (Array.isArray(estadoCategoria)) {
    let indice = Number.isInteger(slotAtualSelecionado) ? slotAtualSelecionado : estadoCategoria.findIndex((item) => !item);
    if (indice < 0) {
      return { tipo: "neutro", texto: "Escolha um slot para substituir" };
    }

    simulacao[categoria][indice] = categoria === "ventoinhas"
      ? { ...peca, fluxo: obterFluxoRecomendadoFan(indice) }
      : { ...peca };
  } else {
    simulacao[categoria] = { ...peca };
  }

  const resultadoAtual = verificarCompatibilidade(estadoMontagem, { renderizar: false });
  const resultadoSimulado = verificarCompatibilidade(simulacao, { renderizar: false });
  const errosAtuais = new Set(resultadoAtual.erros ?? []);
  const alertasAtuais = new Set(resultadoAtual.alertas ?? []);
  const errosNovos = (resultadoSimulado.erros ?? []).filter((erro) => !errosAtuais.has(erro));
  const alertasNovos = (resultadoSimulado.alertas ?? []).filter((alerta) => !alertasAtuais.has(alerta));

  if (errosNovos.length > 0) {
    return { tipo: "incompativel", texto: errosNovos[0] };
  }

  if (alertasNovos.length > 0) {
    return { tipo: "atencao", texto: alertasNovos[0] };
  }

  return { tipo: "compativel", texto: "Sem conflito com a build atual" };
}

function criarHtmlCompatibilidadePeca(avaliacao) {
  const icones = {
    selecionada: "✓",
    compativel: "✓",
    atencao: "!",
    incompativel: "×",
    neutro: "i",
  };
  const icone = icones[avaliacao?.tipo] ?? "i";
  const texto = avaliacao?.texto ?? "Compatibilidade será validada";

  return `<span class="compatibilidade-card-builder" data-tipo="${escaparHtml(avaliacao?.tipo ?? "neutro")}" title="${escaparHtml(texto)}"><span aria-hidden="true">${icone}</span>${escaparHtml(texto)}</span>`;
}

function aplicarFiltroCompatibilidadeNosCards(container = document) {
  const cards = Array.from(container.querySelectorAll?.(".card-peca-mini[data-conflito]") ?? []);
  container.querySelector?.(".mensagem-filtro-compativel")?.remove();

  cards.forEach((card) => {
    card.hidden = mostrarSomenteCompativeis && card.dataset.conflito === "true";
  });

  const possuiVisivel = cards.some((card) => !card.hidden);
  if (mostrarSomenteCompativeis && cards.length > 0 && !possuiVisivel) {
    const aviso = document.createElement("p");
    aviso.className = "mensagem-builder mensagem-filtro-compativel";
    aviso.textContent = "Nenhuma opção sem conflito nesta categoria. Desative o filtro para revisar todas.";
    container.appendChild(aviso);
  }
}

function atualizarFiltroCompatibilidade(resultado) {
  // No Builder React o checkbox é controlado pelo estado do componente.
  if (globalThis.PC_BUILDER_REACT_FILTER === true) return;

  const filtro = document.getElementById("filtro-compativeis-builder");
  if (!filtro) return;

  filtro.disabled = !resultado?.temPecas;
  filtro.closest("label")?.classList.toggle("desabilitado", !resultado?.temPecas);
}

function configurarFiltroCompatibilidade() {
  // Quando o Builder React assume o filtro, não registramos o listener legado.
  if (globalThis.PC_BUILDER_REACT_FILTER === true) return;

  const filtro = document.getElementById("filtro-compativeis-builder");
  if (!filtro) return;

  mostrarSomenteCompativeis = filtro.checked;
  filtro.addEventListener("change", () => {
    mostrarSomenteCompativeis = filtro.checked;
    renderizarListaPecas(categoriaAtual);
  });
}

async function alternarTelaCheia3D() {
  const palco = document.querySelector(".pcbuilder-palco-3d");
  if (!palco || typeof palco.requestFullscreen !== "function") {
    mostrarToast("Tela cheia não está disponível neste navegador.", "alerta");
    return;
  }

  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await palco.requestFullscreen();
  } catch (erro) {
    console.error("Não foi possível alternar a tela cheia:", erro);
    mostrarToast("Não foi possível abrir o 3D em tela cheia.", "erro");
  }
}

function configurarTelaCheia3D() {
  const botao = document.getElementById("btn-expandir-3d");
  botao?.addEventListener("click", alternarTelaCheia3D);
  document.addEventListener("fullscreenchange", () => {
    const ativo = Boolean(document.fullscreenElement);
    botao?.setAttribute("aria-pressed", String(ativo));
    if (botao) {
      botao.textContent = ativo ? "×" : "⛶";
      botao.title = ativo ? "Sair da tela cheia" : "Abrir 3D em tela cheia";
    }
    window.setTimeout(ajustarTamanho3D, 80);
  });
}

// 🌟 A GRANDE MÁGICA DO MENU (COM O SEU LAYOUT ORIGINAL INTACTO)
function renderizarListaPecas(categoria) {
  if (globalThis.PC_BUILDER_REACT_LIST === true) {
    emitirEstadoMontadorReact();
    return;
  }

  const containerLista = document.getElementById("lista-pecas-builder");
  if (!containerLista) return;

  const estadoAtual = categoria === "todos" ? null : estadoMontagem[categoria];
  const isMultiSlot = Array.isArray(estadoAtual);

  if (isMultiSlot && slotAtualSelecionado === null) {
    containerLista.innerHTML = estadoAtual
      .map((pecaNoSlot, index) => {
        const nomeSlot = obterNomeSlot(categoria, index);
        const fluxoRecomendado = categoria === "ventoinhas"
          ? obterFluxoRecomendadoFan(index)
          : "";

        return `
          <article
            class="card-peca-mini ${pecaNoSlot ? "selecionada" : ""}"
            data-categoria="${categoria}"
            data-peca-id="${pecaNoSlot?.id ?? ""}"
            data-slot="${index}"
          >
            <img class="imagem-peca-mini" src="${obterImagemPeca(pecaNoSlot)}" alt="${escaparHtml(nomeSlot)}" loading="lazy" decoding="async" width="320" height="200">

            <div class="info-peca-mini">
              <small class="categoria-peca-mini">${escaparHtml(nomeSlot)}</small>
              <h4>${escaparHtml(pecaNoSlot?.nome ?? "Slot vazio")}</h4>
              <span class="preco-peca-mini">${pecaNoSlot ? formatarPreco(pecaNoSlot.preco) : "Escolher componente"}</span>
              ${pecaNoSlot ? criarHtmlLinkLoja(pecaNoSlot) : ""}

              ${categoria === "ventoinhas" && !pecaNoSlot ? `
                <span class="recomendacao-fluxo-fan">Recomendado: ${fluxoRecomendado === "out" ? "Saída" : "Entrada"}</span>
              ` : ""}

              ${categoria === "ventoinhas" && pecaNoSlot ? `
                <label class="controle-fluxo-fan">
                  <span>Fluxo</span>
                  <select class="select-fluxo-fan-instalado" data-slot="${index}" aria-label="Alterar direção da ${escaparHtml(nomeSlot)}">
                    <option value="in" ${pecaNoSlot.fluxo !== "out" ? "selected" : ""}>Entrada</option>
                    <option value="out" ${pecaNoSlot.fluxo === "out" ? "selected" : ""}>Saída</option>
                  </select>
                </label>
              ` : ""}
            </div>

            <button
              type="button"
              class="btn-add-peca ${pecaNoSlot ? "btn-remover-slot" : "btn-abrir-slot"}"
              data-slot="${index}"
              aria-label="${pecaNoSlot ? `Remover peça da ${escaparHtml(nomeSlot)}` : `Escolher peça para ${escaparHtml(nomeSlot)}`}"
            >${pecaNoSlot ? "✓" : "+"}</button>
          </article>
        `;
      })
      .join("");

    configurarFallbackImagens(containerLista);
    return;
  }

  const todasPecasCategoria = obterPecasDaCategoria(categoria);
  const termoNormalizado = normalizarTextoBuilder(termoPesquisaBuilder);
  const pecas = termoNormalizado
    ? todasPecasCategoria.filter((peca) => obterTextoPesquisaPeca(peca).includes(termoNormalizado))
    : todasPecasCategoria;

  const resultadoPesquisa = document.getElementById("resultado-pesquisa-builder");
  if (resultadoPesquisa && globalThis.PC_BUILDER_REACT_SEARCH !== true) {
    const local = categoria === "todos" ? "em todas as categorias" : "nesta categoria";
    resultadoPesquisa.textContent = termoNormalizado
      ? `${pecas.length} de ${todasPecasCategoria.length} encontrado(s) ${local}.`
      : `${todasPecasCategoria.length} hardware(s) ${local}.`;
  }

  const htmlTopo = isMultiSlot
    ? `<button type="button" class="btn-voltar-slots">← Voltar para os slots</button>`
    : "";

  if (pecas.length === 0) {
    containerLista.innerHTML = `${htmlTopo}<p class="mensagem-builder">${termoNormalizado
      ? `Nenhum hardware encontrado para “${escaparHtml(termoPesquisaBuilder)}”.`
      : "Nenhuma peça encontrada nesta categoria."}</p>`;
    return;
  }

  const htmlLista = pecas.map((peca) => {
    const categoriaPeca = obterCategoriaBuilderDaPeca(peca);
    const estadoCategoriaPeca = estadoMontagem[categoriaPeca];
    const categoriaPossuiSlots = Array.isArray(estadoCategoriaPeca);

    const selecionada = categoria === "todos"
      ? verificarPecaSelecionada(categoriaPeca, peca)
      : isMultiSlot
        ? estadoAtual[slotAtualSelecionado]?.id === peca.id
        : estadoAtual?.id === peca.id;

    const precisaEscolherSlot = categoria === "todos" && categoriaPossuiSlots;
    const nomeCategoria = nomesCategoriasBuilder[categoriaPeca] ?? categoriaPeca;
    const avaliacaoCompatibilidade = avaliarCompatibilidadePeca(categoriaPeca, peca);

    return `
      <article
        class="card-peca-mini ${selecionada ? "selecionada" : ""}"
        data-categoria="${categoriaPeca}"
        data-peca-id="${escaparHtml(peca.id)}"
        data-conflito="${avaliacaoCompatibilidade.tipo === "incompativel"}"
      >
        <img class="imagem-peca-mini" src="${obterImagemPeca(peca)}" alt="${escaparHtml(peca.nome ?? "Peça de computador")}" loading="lazy" decoding="async" width="320" height="200">

        <div class="info-peca-mini">
          <small class="categoria-peca-mini">${escaparHtml(nomeCategoria)}</small>
          <h4>${escaparHtml(peca.nome ?? "Peça sem nome")}</h4>
          <span class="preco-peca-mini">${formatarPreco(peca.preco)}</span>
          ${criarHtmlCompatibilidadePeca(avaliacaoCompatibilidade)}
          ${selecionada ? criarHtmlLinkLoja(peca) : ""}

          ${categoriaPeca === "ventoinhas" && !precisaEscolherSlot ? `
            <label class="controle-fluxo-fan">
              <span>Fluxo</span>
              <select class="select-fluxo-fan" aria-label="Direção do fluxo de ar">
                <option value="in">Entrada</option>
                <option value="out">Saída</option>
              </select>
            </label>
          ` : ""}
        </div>

        ${precisaEscolherSlot ? `
          <button
            type="button"
            class="btn-add-peca btn-ir-categoria"
            data-abrir-categoria="${categoriaPeca}"
            aria-label="Abrir ${escaparHtml(nomeCategoria)} para escolher o slot"
            title="Escolher slot"
          >→</button>
        ` : `
          <button
            type="button"
            class="btn-add-peca"
            data-categoria="${categoriaPeca}"
            data-peca-id="${escaparHtml(peca.id)}"
            data-slot="${isMultiSlot ? slotAtualSelecionado : ""}"
            aria-label="${selecionada ? "Remover" : "Adicionar"} ${escaparHtml(peca.nome ?? "peça")}"
            aria-pressed="${selecionada}"
          >${selecionada ? "✓" : "+"}</button>
        `}
      </article>
    `;
  }).join("");

  containerLista.innerHTML = htmlTopo + htmlLista;
  configurarFallbackImagens(containerLista);
  aplicarFiltroCompatibilidadeNosCards(containerLista);
}

function selecionarPeca(categoria, idPeca, slotStr = "", fluxoSelecionado = "") {
  if (!categoria || categoria === "todos" || !(categoria in estadoMontagem)) {
    console.error("Categoria inválida ao selecionar peça:", categoria);
    return false;
  }

  const pecasDaCategoria = catalogoPecas[categoria] ?? [];
  const pecaCatalogo = pecasDaCategoria.find((item) => item.id === idPeca);
  if (!pecaCatalogo) {
    console.error("Peça não encontrada:", categoria, idPeca);
    return false;
  }

  const peca = categoria === "ventoinhas"
    ? { ...pecaCatalogo, fluxo: fluxoSelecionado === "out" ? "out" : "in" }
    : pecaCatalogo;

  const isMultiSlot = Array.isArray(estadoMontagem[categoria]);
  let foiRemovida = false;

  if (isMultiSlot) {
    const slotIndex = Number.parseInt(slotStr, 10);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= estadoMontagem[categoria].length) return false;

    const atual = estadoMontagem[categoria][slotIndex];
    const jaSelecionada = atual?.id === peca.id &&
      (categoria !== "ventoinhas" || atual.fluxo === peca.fluxo);

    foiRemovida = jaSelecionada;
    estadoMontagem[categoria][slotIndex] = jaSelecionada ? null : peca;
    slotAtualSelecionado = null;
  } else {
    const atual = estadoMontagem[categoria];
    const jaSelecionada = atual?.id === peca.id;
    foiRemovida = jaSelecionada;
    estadoMontagem[categoria] = jaSelecionada ? null : peca;
  }

  const categoriaAfetaEnvelopeGabinete = [
    "gabinete",
    "placamae",
    "placavideo",
    "fonte",
    "cooler",
    "ventoinhas",
  ].includes(categoria);

  if (categoriaAfetaEnvelopeGabinete) {
    // Esses componentes podem alterar a área útil necessária do gabinete.
    // Recalcula as âncoras e refaz as representações para que o case acompanhe
    // o conjunto sem achatar/esticar cada peça individualmente.
    reconstruirRepresentacoes3DParaGabinete();
  } else {
    atualizarPecaNo3D(categoria, estadoMontagem[categoria]);
  }
  renderizarListaPecas(categoriaAtual);
  atualizarResumo();

  if (!foiRemovida) aplicarFeedbackSelecao(categoria, idPeca);
  return true;
}

function configurarPesquisaHardware() {
  // Na migração incremental, o React controla abrir/fechar, input e limpeza da pesquisa.
  if (globalThis.PC_BUILDER_REACT_SEARCH === true) return;

  const painel = document.getElementById("painel-pesquisa-hardware");
  const botaoAlternar = document.getElementById("btn-alternar-pesquisa");
  const input = document.getElementById("pesquisa-hardware-builder");
  const btnLimpar = document.getElementById("btn-limpar-pesquisa-builder");

  if (!input || input.dataset.configurado === "true") return;
  input.dataset.configurado = "true";

  function definirPesquisaAberta(aberta) {
    if (painel) painel.hidden = !aberta;
    botaoAlternar?.setAttribute("aria-expanded", String(aberta));
    if (aberta) requestAnimationFrame(() => input.focus());
  }

  botaoAlternar?.addEventListener("click", () => {
    definirPesquisaAberta(botaoAlternar.getAttribute("aria-expanded") !== "true");
  });

  input.addEventListener("input", () => {
    termoPesquisaBuilder = input.value;
    if (btnLimpar) btnLimpar.hidden = termoPesquisaBuilder.trim() === "";
    renderizarListaPecas(categoriaAtual);
  });

  btnLimpar?.addEventListener("click", () => {
    input.value = "";
    termoPesquisaBuilder = "";
    btnLimpar.hidden = true;
    renderizarListaPecas(categoriaAtual);
    input.focus();
  });
}

function configurarListaPecas() {
  if (globalThis.PC_BUILDER_REACT_LIST === true) return;

  const containerLista = document.getElementById("lista-pecas-builder");
  if (!containerLista || containerLista.dataset.configurado === "true") return;
  containerLista.dataset.configurado = "true";

  containerLista.addEventListener("click", lidarComCliqueLista);

  containerLista.addEventListener("change", (evento) => {
    const select = evento.target.closest?.(".select-fluxo-fan-instalado");
    if (!select) return;

    const slot = Number(select.dataset.slot);
    const fan = estadoMontagem.ventoinhas[slot];
    if (!fan) return;

    fan.fluxo = select.value === "out" ? "out" : "in";
    atualizarPecaNo3D("ventoinhas", estadoMontagem.ventoinhas);
    atualizarResumo();
    renderizarListaPecas("ventoinhas");
  });
}

function lidarComCliqueLista(evento) {
  const elemento = evento.target;
  if (!(elemento instanceof Element)) return;

  const btnSlot = elemento.closest(".btn-abrir-slot");
  if (btnSlot) {
    slotAtualSelecionado = Number(btnSlot.dataset.slot);
    renderizarListaPecas(categoriaAtual);
    return;
  }

  const btnVoltar = elemento.closest(".btn-voltar-slots");
  if (btnVoltar) {
    slotAtualSelecionado = null;
    renderizarListaPecas(categoriaAtual);
    return;
  }

  const btnRemover = elemento.closest(".btn-remover-slot");
  if (btnRemover) {
    const slot = Number(btnRemover.dataset.slot);
    const estadoCategoria = estadoMontagem[categoriaAtual];
    if (!Array.isArray(estadoCategoria) || !Number.isInteger(slot) || !estadoCategoria[slot]) return;

    estadoCategoria[slot] = null;
    atualizarPecaNo3D(categoriaAtual, estadoCategoria);
    renderizarListaPecas(categoriaAtual);
    atualizarResumo();
    return;
  }

  const btnIrCategoria = elemento.closest(".btn-ir-categoria");
  if (btnIrCategoria) {
    mudarAbaUI(btnIrCategoria.dataset.abrirCategoria);
    return;
  }

  const botaoAdd = elemento.closest(".btn-add-peca");
  if (botaoAdd && !botaoAdd.disabled) {
    const categoriaPeca = botaoAdd.dataset.categoria;
    const idPeca = botaoAdd.dataset.pecaId;
    const card = botaoAdd.closest(".card-peca-mini");
    const fluxoSelecionado = card?.querySelector(".select-fluxo-fan")?.value ?? "";

    selecionarPeca(categoriaPeca, idPeca, botaoAdd.dataset.slot ?? "", fluxoSelecionado);
    return;
  }

  const card = elemento.closest(".card-peca-mini");
  if (!card || elemento.closest("button, select, input, label, a")) return;

  const categoria = card.dataset.categoria;
  const idPeca = card.dataset.pecaId;
  if (categoria) destacarCategoria3D(categoria, idPeca);
}

/* =========================================================
   ABAS E RESUMO
========================================================= */

function configurarAbasCategorias() {
  // Quando o Builder React assume as abas, não registramos o listener legado.
  // A lista continua legada nesta etapa; abas, pesquisa e filtro já são controlados pelo React.
  if (globalThis.PC_BUILDER_REACT_TABS === true) return;

  const lista = document.querySelector(".lista-categorias");
  if (!lista || lista.dataset.configurada === "true") return;
  lista.dataset.configurada = "true";

  lista.addEventListener("click", (evento) => {
    const botao = evento.target.closest?.(".categoria-btn");
    if (!botao) return;
    mudarAbaUI(botao.dataset.categoria);
  });
}

function mudarAbaUI(categoriaDestino) {
  if (!categoriaDestino) return;
  categoriaAtual = categoriaDestino;
  slotAtualSelecionado = null; // Resetar a visualização de slots

  document.querySelectorAll(".categoria-btn").forEach((botao) => {
    const ativa = botao.dataset.categoria === categoriaDestino;
    botao.classList.toggle("ativo", ativa);
    botao.setAttribute("aria-selected", String(ativa));
  });

  renderizarListaPecas(categoriaAtual);
  emitirEstadoMontadorReact();
}

function atualizarEstadoFinalizacao(resultadoDiagnostico) {
  const botaoFinalizar = document.getElementById("btn-finalizar");
  const statusBuild = document.getElementById("status-build");
  const botaoLigar = document.getElementById("btn-rgb");
  if (!botaoFinalizar) return;

  ultimoResultadoDiagnostico = resultadoDiagnostico;
  podeLigarSistema = Boolean(resultadoDiagnostico?.podeFinalizar);

  botaoFinalizar.disabled = !podeLigarSistema;
  botaoFinalizar.classList.toggle("bloqueado", !podeLigarSistema);
  botaoFinalizar.setAttribute("aria-disabled", String(!podeLigarSistema));

  if (botaoLigar) {
    botaoLigar.disabled = !podeLigarSistema;
    botaoLigar.setAttribute("aria-disabled", String(!podeLigarSistema));
    botaoLigar.title = podeLigarSistema ? "Ligar PC" : "Complete a build para ligar o PC";
  }

  botaoPower3D.material.color.setHex(podeLigarSistema ? 0x22c55e : 0xef4444);
  botaoPower3D.userData.nome = podeLigarSistema ? "Ligar PC" : "Ligar PC — build incompleta";

  if (!podeLigarSistema && sistemaLigado) {
    sistemaLigado = false;
    cena.background = new THREE.Color(0xeef2f7);
    botaoLigar?.classList.remove("ativo");
  }

  if (!statusBuild) return;

  if (!resultadoDiagnostico?.temPecas) {
    statusBuild.textContent = "Build vazia";
    statusBuild.dataset.tipo = "neutro";
    botaoFinalizar.title = "Selecione os componentes do computador.";
    return;
  }

  if (resultadoDiagnostico.temErros) {
    statusBuild.textContent = "Build incompatível";
    statusBuild.dataset.tipo = "erro";
    botaoFinalizar.title = "Corrija as incompatibilidades antes de finalizar.";
    return;
  }

  if (!resultadoDiagnostico.sistemaCompleto) {
    statusBuild.textContent = "Build incompleta";
    statusBuild.dataset.tipo = "alerta";
    botaoFinalizar.title = `Faltam: ${resultadoDiagnostico.faltando.join(", ")}.`;
    return;
  }

  statusBuild.textContent = resultadoDiagnostico.temAlertas
    ? "Build pronta com atenção"
    : "Build pronta para montar";
  statusBuild.dataset.tipo = resultadoDiagnostico.temAlertas ? "alerta" : "sucesso";
  botaoFinalizar.title = "Finalizar a configuração do computador.";
}


function atualizarPainelDiagnostico(resultado) {
  const painel = document.getElementById("painel-diagnostico-builder");
  const resumo = document.getElementById("diagnostico-resumo");
  const botao = document.getElementById("btn-alternar-diagnostico");
  const conteudo = document.getElementById("conteudo-logs");
  const sinal = document.getElementById("diagnostico-sinal");
  if (!painel || !conteudo) return;

  const erros = resultado?.erros ?? [];
  const alertas = resultado?.alertas ?? [];
  const faltando = resultado?.faltando ?? [];
  const deveMostrar = Boolean(resultado?.temPecas) && (
    erros.length > 0 || alertas.length > 0 || faltando.length > 0
  );

  if (!deveMostrar) {
    painel.hidden = true;
    painel.dataset.aberto = "false";
    delete painel.dataset.progressoMostrado;
    conteudo.hidden = true;
    botao?.setAttribute("aria-expanded", "false");
    return;
  }

  painel.hidden = false;
  const nivel = erros.length > 0 ? "erro" : alertas.length > 0 ? "alerta" : "info";
  painel.dataset.nivel = nivel;
  if (sinal) sinal.textContent = nivel === "erro" ? "✕" : nivel === "alerta" ? "!" : "i";

  if (resumo) {
    if (erros.length > 0) {
      resumo.textContent = `${erros.length} incompatibilidade(s), ${alertas.length} alerta(s) e ${faltando.length} item(ns) pendente(s).`;
    } else if (alertas.length > 0) {
      resumo.textContent = `${alertas.length} alerta(s) e ${faltando.length} item(ns) pendente(s).`;
    } else {
      resumo.textContent = `Montagem em andamento: faltam ${faltando.length} componente(s).`;
    }
  }

  const primeiraSelecao = faltando.length > 0 && painel.dataset.progressoMostrado !== "true";
  const abrirAutomaticamente = erros.length > 0 || primeiraSelecao;
  if (primeiraSelecao) painel.dataset.progressoMostrado = "true";

  if (abrirAutomaticamente) {
    painel.dataset.aberto = "true";
    conteudo.hidden = false;
    botao?.setAttribute("aria-expanded", "true");
    if (botao) botao.textContent = "Ocultar diagnóstico";
  } else if (painel.dataset.aberto !== "true") {
    conteudo.hidden = true;
    botao?.setAttribute("aria-expanded", "false");
    if (botao) botao.textContent = "Ver diagnóstico";
  }

  requestAnimationFrame(ajustarTamanho3D);
}

function configurarPainelDiagnostico() {
  const painel = document.getElementById("painel-diagnostico-builder");
  const botao = document.getElementById("btn-alternar-diagnostico");
  const conteudo = document.getElementById("conteudo-logs");
  if (!painel || !botao || !conteudo || botao.dataset.configurado === "true") return;
  botao.dataset.configurado = "true";

  botao.addEventListener("click", () => {
    const abrir = painel.dataset.aberto !== "true";
    painel.dataset.aberto = String(abrir);
    conteudo.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
    botao.textContent = abrir ? "Ocultar diagnóstico" : "Ver diagnóstico";
    requestAnimationFrame(ajustarTamanho3D);
  });
}

async function limparBuild() {
  const temPecas = Object.values(estadoMontagem).flat().some(Boolean);
  if (!temPecas) return;
  const confirmou = await confirmar("Todas as peças selecionadas serão removidas.", {
    titulo: "Limpar montagem?",
    textoConfirmar: "Limpar build",
  });
  if (!confirmou) return;

  Object.keys(estadoMontagem).forEach((categoria) => {
    if (Array.isArray(estadoMontagem[categoria])) {
      estadoMontagem[categoria].fill(null);
    } else {
      estadoMontagem[categoria] = null;
    }
  });

  // Sem gabinete selecionado, restaura a maquete e todos os pontos de montagem
  // para as dimensoes padrao antes de reconstruir os placeholders.
  atualizarAncorasGabinete3D(null);
  Object.entries(estadoMontagem).forEach(([categoria, estado]) => {
    atualizarPecaNo3D(categoria, estado);
  });

  sistemaLigado = false;
  cena.background = new THREE.Color(0xeef2f7);
  document.getElementById("btn-rgb")?.classList.remove("ativo");
  slotAtualSelecionado = null;
  termoPesquisaBuilder = "";

  const input = document.getElementById("pesquisa-hardware-builder");
  if (input) input.value = "";
  const limparPesquisa = document.getElementById("btn-limpar-pesquisa-builder");
  if (limparPesquisa) limparPesquisa.hidden = true;

  renderizarListaPecas(categoriaAtual);
  atualizarResumo();
  restaurarCamera();
}

function configurarLimparBuild() {
  if (globalThis.PC_BUILDER_REACT_ACTIONS === true) return;
  const botao = document.getElementById("btn-limpar-build");
  if (!botao || botao.dataset.configurado === "true") return;
  botao.dataset.configurado = "true";
  botao.addEventListener("click", limparBuild);
}

const nomesCategoriasResumo = {
  gabinete: "Gabinete",
  processador: "Processador",
  placamae: "Placa-mãe",
  cooler: "Cooler",
  memoria: "Memória RAM",
  placavideo: "Placa de vídeo",
  armazenamento: "Armazenamento",
  fonte: "Fonte",
  ventoinhas: "Ventoinha",
};

let elementoFocoAntesModal = null;

function escaparHtml(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obterItensResumoFinal() {
  const itens = [];

  Object.entries(estadoMontagem).forEach(([categoria, estado]) => {
    const pecas = Array.isArray(estado) ? estado : [estado];

    pecas.forEach((peca, indice) => {
      if (!peca) return;

      const categoriaNome = nomesCategoriasResumo[categoria] ?? categoria;
      const nomeSlot = Array.isArray(estado)
        ? obterNomeSlot(categoria, indice)
        : categoriaNome;

      itens.push({
        categoria,
        categoriaNome,
        nomeSlot,
        indice,
        peca,
      });
    });
  });

  return itens;
}

function escaparHtmlRelatorio(valor = "") {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterHtmlRelatorioParaImpressao() {
  const conteudo = document.querySelector(
    "#modal-resumo-final .modal-resumo-conteudo",
  );

  if (!conteudo) {
    throw new Error("O relatório final não foi encontrado.");
  }

  const clone = conteudo.cloneNode(true);

  clone
    .querySelectorAll(
      ".btn-fechar-modal-resumo, .modal-resumo-rodape, button, [hidden]",
    )
    .forEach((elemento) => elemento.remove());

  clone.querySelectorAll("img[loading]").forEach((imagem) => {
    imagem.removeAttribute("loading");
  });

  return clone.outerHTML;
}

function criarDocumentoImpressaoRelatorio(conteudoRelatorio) {
  const titulo = escaparHtmlRelatorio(
    document.title || "Relatório da montagem",
  );
  const base = escaparHtmlRelatorio(document.baseURI);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${base}">
  <title>${titulo}</title>
  <style>
    @page { size: A4; margin: 11mm; }

    * { box-sizing: border-box; }

    html, body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      color: #111827;
      background: #ffffff;
      font-family: "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body { font-size: 11px; line-height: 1.4; }
    [hidden], button, .modal-resumo-rodape, .btn-fechar-modal-resumo { display: none !important; }

    .modal-resumo-conteudo {
      position: static;
      display: block;
      width: 100%;
      max-width: none;
      max-height: none;
      margin: 0;
      overflow: visible;
      background: #ffffff;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      transform: none;
    }

    .modal-resumo-cabecalho {
      display: block;
      padding: 0 0 12px;
      border-bottom: 2px solid #cbd5e1;
    }

    .modal-resumo-etiqueta {
      color: #166534;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .05em;
      text-transform: uppercase;
    }

    .modal-resumo-cabecalho h2 {
      margin: 4px 0;
      color: #111827;
      font-size: 21px;
      line-height: 1.15;
    }

    .modal-resumo-cabecalho p { margin: 0; color: #64748b; }
    .modal-resumo-corpo { display: block; padding: 15px 0 0; overflow: visible; }

    .resumo-final-metricas {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 7px;
      margin: 0 0 15px;
    }

    .resumo-final-metrica {
      min-width: 0;
      padding: 9px;
      background: #f8fafc;
      border: 1px solid #dbe2ea;
      border-radius: 7px;
      break-inside: avoid;
    }

    .resumo-final-metrica span {
      display: block;
      margin-bottom: 3px;
      color: #64748b;
      font-size: 9px;
      font-weight: 700;
    }

    .resumo-final-metrica strong {
      display: block;
      color: #0f172a;
      font-size: 11px;
      overflow-wrap: anywhere;
    }

    .resumo-final-secao { margin-top: 15px; }
    .resumo-final-secao:first-of-type { margin-top: 0; }
    .resumo-final-secao h3 {
      margin: 0 0 8px;
      color: #1e293b;
      font-size: 13px;
      break-after: avoid;
    }

    .resumo-final-titulo-secao {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .resumo-final-status {
      padding: 3px 7px;
      color: #166534;
      font-size: 8px;
      font-weight: 800;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
      border-radius: 999px;
    }

    .lista-componentes-resumo-final { display: grid; gap: 5px; }

    .item-componente-resumo-final {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      background: #ffffff;
      border: 1px solid #dbe2ea;
      border-radius: 7px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .item-componente-resumo-final img {
      width: 40px;
      height: 36px;
      object-fit: contain;
      background: #f8fafc;
      border-radius: 5px;
    }

    .item-componente-resumo-info { min-width: 0; }
    .item-componente-resumo-info > strong {
      display: block;
      color: #1e293b;
      font-size: 10px;
      overflow-wrap: anywhere;
    }

    .item-componente-categoria {
      display: block;
      margin-bottom: 2px;
      color: #64748b;
      font-size: 8px;
      font-weight: 700;
    }

    .item-componente-detalhes { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 3px; }
    .item-componente-detalhes > span { color: #64748b; font-size: 8px; }
    .item-componente-preco { color: #15803d; font-size: 10px; white-space: nowrap; }

    .resumo-final-badge {
      padding: 1px 5px;
      border-radius: 999px;
      font-weight: 800;
    }

    .resumo-final-badge.fluxo-entrada { color: #1d4ed8; background: #dbeafe; }
    .resumo-final-badge.fluxo-saida { color: #c2410c; background: #ffedd5; }

    .fluxo-ar-resumo-final {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px;
      border: 1px solid #dbe2ea;
      border-radius: 7px;
      break-inside: avoid;
    }

    .fluxo-ar-resumo-final[data-tipo="sucesso"] { background: #f0fdf4; border-color: #bbf7d0; }
    .fluxo-ar-resumo-final[data-tipo="alerta"] { background: #fffbeb; border-color: #fde68a; }
    .fluxo-ar-resumo-final p { margin: 3px 0 0; color: #64748b; }

    .contagem-fluxo-resumo { display: flex; gap: 5px; }
    .contagem-fluxo-resumo span {
      min-width: 58px;
      padding: 5px;
      text-align: center;
      background: rgba(255,255,255,.78);
      border: 1px solid #dbe2ea;
      border-radius: 6px;
    }
    .contagem-fluxo-resumo strong { display: block; font-size: 12px; }

    .lista-alertas-resumo-final {
      display: grid;
      gap: 5px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .lista-alertas-resumo-final li {
      padding: 7px 9px;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      break-inside: avoid;
    }

    .secao-compra-resumo-final,
    .item-link-compra-resumo-final {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .item-link-compra-resumo-final a {
      color: #111827;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    .item-link-compra-resumo-final a::after {
      content: " — " attr(href);
      color: #475569;
      font-size: 8px;
    }

    @media print {
      html, body { width: 100%; min-height: 0; }
    }
  </style>
</head>
<body>
  ${conteudoRelatorio}
</body>
</html>`;
}

function aguardarRecursosDaImpressao(janelaImpressao) {
  const documento = janelaImpressao.document;
  const imagens = Array.from(documento.images);
  const promessasImagens = imagens.map((imagem) => {
    if (imagem.complete) return Promise.resolve();

    return new Promise((resolve) => {
      imagem.addEventListener("load", resolve, { once: true });
      imagem.addEventListener("error", resolve, { once: true });
    });
  });

  const promessaFontes = documento.fonts?.ready ?? Promise.resolve();

  return Promise.all([
    promessaFontes,
    ...promessasImagens,
  ]);
}

function imprimirRelatorioEmJanelaIsolada() {
  let janelaImpressao;

  try {
    janelaImpressao = window.open(
      "",
      "relatorio-pc-builder",
      "popup=yes,width=960,height=760",
    );

    if (!janelaImpressao) {
      throw new Error("O navegador bloqueou a janela de impressão.");
    }

    janelaImpressao.document.open();
    janelaImpressao.document.write(
      criarDocumentoImpressaoRelatorio(
        obterHtmlRelatorioParaImpressao(),
      ),
    );
    janelaImpressao.document.close();

    janelaImpressao.addEventListener("afterprint", () => {
      janelaImpressao.close();
    }, { once: true });

    aguardarRecursosDaImpressao(janelaImpressao)
      .then(() => new Promise((resolve) => {
        janelaImpressao.requestAnimationFrame(() => {
          janelaImpressao.requestAnimationFrame(resolve);
        });
      }))
      .then(() => {
        janelaImpressao.focus();
        janelaImpressao.print();
      })
      .catch((erro) => {
        console.error("Erro ao preparar a impressão:", erro);
        janelaImpressao.close();
        mostrarToast("Não foi possível preparar o relatório para impressão.", "erro");
      });
  } catch (erro) {
    console.error("Erro ao abrir a impressão:", erro);
    janelaImpressao?.close();
    mostrarToast(
      "O navegador bloqueou a impressão. Permita pop-ups para este site e tente novamente.",
      "erro",
    );
  }
}


function criarModalResumoFinal() {
  if (globalThis.PC_BUILDER_REACT_ACTIONS === true) return;
  if (document.getElementById("modal-resumo-final")) return;

  const modal = document.createElement("div");
  modal.id = "modal-resumo-final";
  modal.className = "modal-resumo-final";
  modal.hidden = true;

  modal.innerHTML = `
        <div class="modal-resumo-overlay" data-fechar-modal-resumo></div>

        <section
            class="modal-resumo-conteudo"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-resumo-titulo"
            aria-describedby="modal-resumo-descricao"
        >
            <header class="modal-resumo-cabecalho">
                <div>
                    <span class="modal-resumo-etiqueta">Configuração concluída</span>
                    <h2 id="modal-resumo-titulo">Resumo final do PC</h2>
                    <p id="modal-resumo-descricao">
                        Confira os componentes, o consumo e o fluxo de ar da montagem.
                    </p>
                </div>

                <button
                    type="button"
                    class="btn-fechar-modal-resumo"
                    id="btn-fechar-modal-resumo"
                    aria-label="Fechar resumo final"
                >
                    &times;
                </button>
            </header>

            <div class="modal-resumo-corpo">
                <div class="resumo-final-metricas">
                    <article class="resumo-final-metrica">
                        <span>Preço total</span>
                        <strong id="modal-resumo-preco">R$ 0,00</strong>
                    </article>

                    <article class="resumo-final-metrica">
                        <span>Consumo estimado</span>
                        <strong id="modal-resumo-consumo">0 W</strong>
                    </article>

                    <article class="resumo-final-metrica">
                        <span>Fonte recomendada</span>
                        <strong id="modal-resumo-fonte">0 W</strong>
                    </article>

                    <article class="resumo-final-metrica">
                        <span>Componentes</span>
                        <strong id="modal-resumo-quantidade">0</strong>
                    </article>
                </div>

                <section class="resumo-final-secao">
                    <div class="resumo-final-titulo-secao">
                        <h3>Componentes selecionados</h3>
                        <span class="resumo-final-status">Compatível</span>
                    </div>

                    <div
                        id="lista-componentes-resumo-final"
                        class="lista-componentes-resumo-final"
                    ></div>
                </section>

                <section
                    id="secao-compra-resumo-final"
                    class="resumo-final-secao secao-compra-resumo-final"
                    hidden
                >
                    <div class="resumo-final-titulo-secao">
                        <div>
                            <h3>Onde comprar</h3>
                            <p class="texto-compra-resumo-final">
                                Compare as lojas somente depois de conferir a montagem.
                            </p>
                        </div>
                        <span class="resumo-final-status resumo-final-status--compra">Links disponíveis</span>
                    </div>

                    <div
                        id="lista-links-compra-resumo-final"
                        class="lista-links-compra-resumo-final"
                    ></div>

                    <p class="aviso-afiliado-resumo-final">
                        Alguns links podem gerar comissão para o CriaByte, sem custo adicional para você.
                    </p>
                </section>

                <section class="resumo-final-secao">
                    <h3>Fluxo de ar</h3>
                    <div
                        id="fluxo-ar-resumo-final"
                        class="fluxo-ar-resumo-final"
                    ></div>
                </section>

                <section
                    id="secao-alertas-resumo-final"
                    class="resumo-final-secao"
                    hidden
                >
                    <h3>Recomendações</h3>
                    <ul
                        id="lista-alertas-resumo-final"
                        class="lista-alertas-resumo-final"
                    ></ul>
                </section>
            </div>

            <footer class="modal-resumo-rodape">
                <button
                    type="button"
                    class="btn-ver-opcoes-compra"
                    id="btn-ver-opcoes-compra"
                    hidden
                >
                    Ver opções de compra
                </button>

                <button
                    type="button"
                    class="btn-salvar-build"
                    id="btn-salvar-build"
                    title="Salvar esta configuração na conta"
                >
                    <span aria-hidden="true">💾</span>
                    Salvar build
                </button>

                <button
                    type="button"
                    class="btn-compartilhar-build"
                    id="btn-compartilhar-build"
                    title="Compartilhar esta configuração"
                >
                    <span aria-hidden="true">🔗</span>
                    Compartilhar build
                </button>

                <button
                    type="button"
                    class="btn-imprimir-relatorio"
                    id="btn-imprimir-relatorio"
                >
                    <span aria-hidden="true">🖨</span>
                    Imprimir relatório
                </button>

                <button
                    type="button"
                    class="btn-continuar-editando"
                    id="btn-continuar-editando"
                >
                    Continuar editando
                </button>
            </footer>
        </section>
    `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-fechar-modal-resumo]").forEach((elemento) => {
    elemento.addEventListener("click", fecharModalResumoFinal);
  });

  document
    .getElementById("btn-fechar-modal-resumo")
    ?.addEventListener("click", fecharModalResumoFinal);

  document
    .getElementById("btn-continuar-editando")
    ?.addEventListener("click", fecharModalResumoFinal);

  document.getElementById("btn-ver-opcoes-compra")?.addEventListener("click", () => {
    document.getElementById("secao-compra-resumo-final")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });

  document
    .getElementById("btn-imprimir-relatorio")
    ?.addEventListener("click", imprimirRelatorioEmJanelaIsolada);

  document
    .getElementById("btn-salvar-build")
    ?.addEventListener("click", salvarBuildNaConta);

  document
    .getElementById("btn-compartilhar-build")
    ?.addEventListener("click", compartilharBuildAtual);

  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    if (modal.hidden) return;

    fecharModalResumoFinal();
  });
}

function abrirModalResumoFinal(resultadoDiagnostico) {
  criarModalResumoFinal();

  const modal = document.getElementById("modal-resumo-final");
  if (!modal) return;

  const botaoSalvar = document.getElementById("btn-salvar-build");
  if (botaoSalvar) {
    botaoSalvar.innerHTML = obterSessaoConta()
      ? '<span aria-hidden="true">💾</span> Salvar build'
      : '<span aria-hidden="true">↪</span> Entrar para salvar';
  }

  const itens = obterItensResumoFinal();
  const precoTotal = itens.reduce(
    (total, item) => total + converterPreco(item.peca.preco),
    0,
  );

  const consumoTotal = calcularConsumoMontagem(estadoMontagem);
  const fonteRecomendada = calcularFonteRecomendada(consumoTotal);
  const fansIn = Number(resultadoDiagnostico?.fansIn) || 0;
  const fansOut = Number(resultadoDiagnostico?.fansOut) || 0;
  const resumoFluxo = obterResumoFluxoAr(fansIn, fansOut);

  const precoElemento = document.getElementById("modal-resumo-preco");
  const consumoElemento = document.getElementById("modal-resumo-consumo");
  const fonteElemento = document.getElementById("modal-resumo-fonte");
  const quantidadeElemento = document.getElementById("modal-resumo-quantidade");
  const listaComponentes = document.getElementById(
    "lista-componentes-resumo-final",
  );
  const secaoCompra = document.getElementById("secao-compra-resumo-final");
  const listaLinksCompra = document.getElementById("lista-links-compra-resumo-final");
  const botaoOpcoesCompra = document.getElementById("btn-ver-opcoes-compra");
  const fluxoElemento = document.getElementById("fluxo-ar-resumo-final");
  const secaoAlertas = document.getElementById("secao-alertas-resumo-final");
  const listaAlertas = document.getElementById("lista-alertas-resumo-final");

  if (precoElemento) precoElemento.textContent = formatarPreco(precoTotal);
  if (consumoElemento) {
    consumoElemento.textContent = `${consumoTotal} W`;
    consumoElemento.title = consumoTotal > 0
      ? "Estimativa baseada no consumo/TDP cadastrado de cada componente."
      : "Selecione um componente para calcular o consumo estimado.";
  }
  if (fonteElemento) fonteElemento.textContent = `${fonteRecomendada} W`;
  if (quantidadeElemento) quantidadeElemento.textContent = String(itens.length);

  if (listaComponentes) {
    listaComponentes.innerHTML = itens
      .map((item) => {
        const watts = Number(item.peca.watts) || 0;
        const fluxo =
          item.categoria === "ventoinhas"
            ? item.peca.fluxo === "out"
              ? '<span class="resumo-final-badge fluxo-saida">Saída</span>'
              : '<span class="resumo-final-badge fluxo-entrada">Entrada</span>'
            : "";

        return `
                <article class="item-componente-resumo-final">
                    <img
                        src="${escaparHtml(obterImagemPeca(item.peca))}"
                        alt=""
                        loading="lazy"
                    >

                    <div class="item-componente-resumo-info">
                        <span class="item-componente-categoria">
                            ${escaparHtml(item.nomeSlot)}
                        </span>
                        <strong>${escaparHtml(item.peca.nome ?? "Peça sem nome")}</strong>

                        <div class="item-componente-detalhes">
                            ${fluxo}
                            ${watts > 0 ? `<span>${watts} W</span>` : ""}
                            ${item.peca.loja ? `<span>${escaparHtml(item.peca.loja)}</span>` : ""}
                            ${criarHtmlLinkLoja(item.peca, "Ver preço")}
                        </div>
                    </div>

                    <strong class="item-componente-preco">
                        ${formatarPreco(item.peca.preco)}
                    </strong>
                </article>
            `;
      })
      .join("");

    listaComponentes.querySelectorAll("img").forEach((imagem) => {
      imagem.addEventListener(
        "error",
        () => {
          imagem.src = PLACEHOLDER_IMAGEM;
        },
        { once: true },
      );
    });
  }

  const itensCompra = itens
    .map((item) => ({ ...item, linkCompra: obterLinkCompraPeca(item.peca) }))
    .filter((item) => item.linkCompra);

  if (secaoCompra && listaLinksCompra && botaoOpcoesCompra) {
    const possuiLinksCompra = itensCompra.length > 0;
    secaoCompra.hidden = !possuiLinksCompra;
    botaoOpcoesCompra.hidden = !possuiLinksCompra;

    listaLinksCompra.innerHTML = itensCompra
      .map((item) => `
        <article class="item-link-compra-resumo-final">
          <div>
            <span>${escaparHtml(item.nomeSlot)}</span>
            <strong>${escaparHtml(item.peca.nome ?? "Componente")}</strong>
            ${item.peca.loja ? `<small>${escaparHtml(item.peca.loja)}</small>` : ""}
          </div>

          <a
            href="${escaparHtml(item.linkCompra)}"
            target="_blank"
            rel="sponsored noopener noreferrer"
          >Ver preço</a>
        </article>
      `)
      .join("");
  }

  if (fluxoElemento) {
    fluxoElemento.dataset.tipo = resumoFluxo.tipo;
    fluxoElemento.innerHTML = `
            <div>
                <strong>${escaparHtml(resumoFluxo.titulo)}</strong>
                <p>${escaparHtml(resumoFluxo.mensagem)}</p>
            </div>

            <div class="contagem-fluxo-resumo">
                <span><strong>${fansIn}</strong> entrada</span>
                <span><strong>${fansOut}</strong> saída</span>
            </div>
        `;
  }

  const alertas = Array.isArray(resultadoDiagnostico?.alertas)
    ? resultadoDiagnostico.alertas
    : [];

  if (secaoAlertas && listaAlertas) {
    secaoAlertas.hidden = alertas.length === 0;
    listaAlertas.innerHTML = alertas
      .map((alerta) => `<li>${escaparHtml(alerta)}</li>`)
      .join("");
  }

  elementoFocoAntesModal = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("modal-resumo-aberto");

  window.requestAnimationFrame(() => {
    modal.classList.add("aberto");
    document.getElementById("btn-fechar-modal-resumo")?.focus();
  });
}

function fecharModalResumoFinal() {
  const modal = document.getElementById("modal-resumo-final");
  if (!modal || modal.hidden) return;

  modal.classList.remove("aberto");
  document.body.classList.remove("modal-resumo-aberto");

  window.setTimeout(() => {
    modal.hidden = true;

    if (elementoFocoAntesModal instanceof HTMLElement) {
      elementoFocoAntesModal.focus();
    }
  }, 180);
}

function atualizarResumo() {
  const pecasSelecionadas = Object.values(estadoMontagem).flat().filter(Boolean);

  const precoTotal = pecasSelecionadas.reduce(
    (total, peca) => total + converterPreco(peca.preco),
    0
  );

  const consumoTotal = calcularConsumoMontagem(estadoMontagem);
  const fonteRecomendada = calcularFonteRecomendada(consumoTotal);

  const consumoElemento = document.getElementById("consumo-watts");
  const fonteElemento = document.getElementById("fonte-recomendada");
  const precoElemento = document.getElementById("preco-total-montagem");

  if (consumoElemento) {
    consumoElemento.textContent = `${consumoTotal} W`;
    consumoElemento.title = consumoTotal > 0
      ? "Estimativa baseada no consumo, TDP ou TGP cadastrado de cada componente."
      : "Selecione um componente para calcular o consumo estimado.";
  }
  if (fonteElemento) {
    fonteElemento.textContent = `${fonteRecomendada} W`;
    fonteElemento.title = fonteRecomendada > 0
      ? "Recomendação com margem de segurança aproximada de 30%."
      : "A fonte ideal será calculada conforme as peças escolhidas.";
  }
  if (precoElemento) precoElemento.textContent = formatarPreco(precoTotal);

  const resultadoDiagnostico = verificarCompatibilidade(estadoMontagem);
  atualizarPainelDiagnostico(resultadoDiagnostico);
  atualizarEstadoFinalizacao(resultadoDiagnostico);
  atualizarFiltroCompatibilidade(resultadoDiagnostico);

  const botaoComprar = document.getElementById("btn-comprar-pecas");
  const avisoComprar = document.getElementById("aviso-compra-builder");
  const possuiLinksCompra = obterItensComLinkCompra().length > 0;
  const compraDisponivel = Boolean(resultadoDiagnostico?.podeFinalizar) && possuiLinksCompra;

  if (botaoComprar) botaoComprar.hidden = !compraDisponivel;
  if (avisoComprar) avisoComprar.hidden = !compraDisponivel;

  emitirEstadoMontadorReact();
  agendarSalvamentoAutomatico();
}

function configurarCompraPecas() {
  if (globalThis.PC_BUILDER_REACT_ACTIONS === true) return;
  const botaoComprar = document.getElementById("btn-comprar-pecas");
  if (!botaoComprar || botaoComprar.dataset.configurado === "true") return;
  botaoComprar.dataset.configurado = "true";

  botaoComprar.addEventListener("click", () => {
    window.location.href = new URL("../pecas.html", import.meta.url).href;
  });
}

function configurarFinalizacao() {
  if (globalThis.PC_BUILDER_REACT_ACTIONS === true) return;
  document.getElementById("btn-finalizar")?.addEventListener("click", () => {
    const resultadoDiagnostico = verificarCompatibilidade(estadoMontagem);

    if (!resultadoDiagnostico?.podeFinalizar) {
      atualizarEstadoFinalizacao(resultadoDiagnostico);
      return;
    }

    abrirModalResumoFinal(resultadoDiagnostico);
  });
}

/* =========================================================
   PRODUTIVIDADE DO MONTADOR
========================================================= */

function aplicarConfiguracaoDoHistorico(configuracao) {
  if (!configuracao) return false;
  const normalizada = normalizarConfiguracaoRecebida(configuracao);
  if (!normalizada || !configuracaoPossuiPecas(normalizada)) return false;

  Object.entries(estadoMontagem).forEach(([categoria, atual]) => {
    const recebida = normalizada[categoria];
    if (Array.isArray(atual)) {
      estadoMontagem[categoria] = Array.from({ length: atual.length }, (_, indice) => {
        const item = recebida?.[indice] ?? null;
        if (!item) return null;
        const peca = resolverPecaConfiguracao(categoria, item, indice);
        if (!peca) return null;
        if (categoria === "ventoinhas") {
          const dados = item && typeof item === "object" ? item : {};
          peca.fluxo = dados.fluxo === "out" ? "out" : "in";
        }
        return peca;
      });
    } else {
      estadoMontagem[categoria] = recebida
        ? resolverPecaConfiguracao(categoria, recebida)
        : null;
    }
  });

  atualizarAncorasGabinete3D(estadoMontagem.gabinete);
  Object.entries(estadoMontagem).forEach(([categoria, estado]) => {
    atualizarPecaNo3D(categoria, estado);
  });
  atualizarVisual3D();
  atualizarResumo();
  renderizarListaPecas(categoriaAtual);
  agendarSalvamentoAutomatico("Build restaurada pelo histórico");
  return true;
}

function desfazerUltimaAlteracao() {
  const configuracao = desfazerHistorico();
  if (!configuracao || !aplicarConfiguracaoDoHistorico(configuracao)) {
    mostrarToast("Não há alteração anterior para desfazer.", "alerta");
    return;
  }
  mostrarToast("Última alteração desfeita.", "sucesso");
}

function capturarImagem3D() {
  try {
    renderizador.render(cena, camera);
    const link = document.createElement("a");
    link.download = `pc-builder-3d-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = renderizador.domElement.toDataURL("image/png");
    link.click();
    mostrarToast("Imagem do PC 3D criada.", "sucesso");
  } catch (erro) {
    console.error("Falha ao capturar o 3D:", erro);
    mostrarToast("Não foi possível capturar a imagem 3D.", "erro");
  }
}

function configurarAtalhosMontador() {
  if (document.documentElement.dataset.atalhosMontadorConfigurados !== "true") {
    document.documentElement.dataset.atalhosMontadorConfigurados = "true";
    document.addEventListener("keydown", (evento) => {
    const alvo = evento.target;
    const digitando = alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement;
    if (digitando) return;

    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "z") {
      evento.preventDefault();
      desfazerUltimaAlteracao();
    }

    if (evento.key === "?") {
      document.getElementById("tutorial-montador")?.showModal();
    }
    });
  }

  document.getElementById("btn-desfazer-build")?.addEventListener("click", desfazerUltimaAlteracao);
  document.getElementById("btn-capturar-3d")?.addEventListener("click", capturarImagem3D);
  document.getElementById("btn-ajuda-montador")?.addEventListener("click", () => {
    document.getElementById("tutorial-montador")?.showModal();
  });
  document.querySelector("[data-fechar-tutorial]")?.addEventListener("click", () => {
    document.getElementById("tutorial-montador")?.close();
    localStorage.setItem("pcBuilderTutorialVisto", "1");
  });

  if (!localStorage.getItem("pcBuilderTutorialVisto")) {
    window.setTimeout(() => document.getElementById("tutorial-montador")?.showModal(), 650);
  }
}

function configurarAvisoSaida() {
  if (window.__pcBuilderAvisoSaidaConfigurado) return;
  window.__pcBuilderAvisoSaidaConfigurado = true;
  window.addEventListener("beforeunload", (evento) => {
    if (!buildPossuiAlteracoesNaoSalvas) return;
    evento.preventDefault();
    evento.returnValue = "";
  });
}

/* =========================================================
   INICIALIZAÇÃO E ANIMAÇÃO
========================================================= */

function conectarCanvas() {
  const container3D = document.getElementById("canvas-3d-container");
  if (!container3D || !renderizador?.domElement) return false;

  container3D.innerHTML = "";
  container3D.appendChild(renderizador.domElement);
  restaurarCamera();
  ajustarTamanho3D();

  observadorCanvas?.disconnect();
  if (typeof ResizeObserver === "function") {
    observadorCanvas = new ResizeObserver(() => ajustarTamanho3D());
    observadorCanvas.observe(container3D);
  }

  return true;
}

const objetosAnimadosProcedurais = new Set();
const ESCALA_MM_3D = 0.01;

function animar() {
  requestAnimationFrame(animar);
  if (document.hidden) return;

  controles.update();
  listaFans.forEach((fan) => {
    fan.rotation.y += sistemaLigado ? 0.35 : 0.04;
  });

  objetosAnimadosProcedurais.forEach((objeto) => {
    if (!objeto?.parent) {
      objetosAnimadosProcedurais.delete(objeto);
      return;
    }
    const velocidade = numero3DSeguro(objeto.userData?.velocidadeRotacao, 0.16);
    objeto.rotation.y += sistemaLigado ? velocidade : velocidade * 0.12;
  });

  if (sistemaLigado) {
    tempoRGB += 0.03;
    const r = Math.sin(tempoRGB) * 0.5 + 0.5;
    const g = Math.sin(tempoRGB + 2) * 0.5 + 0.5;
    const b = Math.sin(tempoRGB + 4) * 0.5 + 0.5;

    listaFans.forEach((fan) => fan.material.color.setRGB(r, g, b));

    // Verifica se existe alguma RAM instalada (sendo array)
    if (estadoMontagem.memoria.some(Boolean)) {
      slotsRam.forEach((ram) => ram.material.color.setRGB(r, g, b));
    }

    if (estadoMontagem.placavideo) slotGpu.material.color.setRGB(r, g, b);
  }
  renderizador.render(cena, camera);
}

/* Integração com o assistente de IA */
let _moduloIaCarregado = null;

async function _importarAssistenteIa() {
  try {
    return await import("./ia-assistente.js?v=react-v38");
  } catch {
    return null;
  }
}

function _construirContextoIaParaAssistente() {
  const contexto = {};
  Object.entries(estadoMontagem).forEach(([categoria, estado]) => {
    const pecas = Array.isArray(estado) ? estado.filter(Boolean) : [estado].filter(Boolean);
    if (pecas.length > 0) {
      contexto[categoria] = pecas.map((p) => ({
        id: p.id,
        hardwareId: p.hardwareId ?? null,
        nome: p.nome,
        marca: p.marca,
        modelo: p.modelo,
        categoria: p.categoria,
        origem: p.origem || (p.hardwareId ? "CATALOGO" : undefined),
        especificacoes: p.especificacoes,
        preco: p.precoIndisponivel ? null : p.preco,
      }));
    }
  });
  return contexto;
}

function _configurarBotaoMontarIa(modIa) {
  const btn = document.getElementById("btn-montar-ia");
  if (!btn || btn.dataset.configurado === "true") return;
  btn.dataset.configurado = "true";

  btn.addEventListener("click", () => {
    if (modIa?.definirContextoBuild) {
      modIa.definirContextoBuild(_construirContextoIaParaAssistente());
    }
    if (modIa?.abrirAssistenteIa) {
      modIa.abrirAssistenteIa("Quero montar um PC.");
    }
  });
}

export async function inicializarMontadorLegado() {
  const container3D = document.getElementById("canvas-3d-container");
  if (!container3D) return false;
  if (renderizador?.domElement?.parentElement === container3D && container3D.dataset.montadorInicializado === "true") {
    return true;
  }

  if (!conectarCanvas()) return false;
  container3D.dataset.montadorInicializado = "true";

  configurarAbasCategorias();
  configurarListaPecas();
  configurarPesquisaHardware();
  configurarControlesCamera();
  configurarTelaCheia3D();
  configurarFiltroCompatibilidade();
  configurarPainelDiagnostico();
  configurarLimparBuild();
  criarModalResumoFinal();
  configurarCompraPecas();
  configurarFinalizacao();
  configurarInteracao3D();
  configurarAtalhosMontador();
  configurarAvisoSaida();

  atualizarVisual3D();
  atualizarResumo();
  await carregarCatalogoBuilder();

  const modIa = await _importarAssistenteIa();
  _moduloIaCarregado = modIa;
  _configurarBotaoMontarIa(modIa);
  return true;
}

// Ponte temporária para o React: módulos ES não expõem exports no objeto global.
// Mantemos a função disponível para reconectar o motor quando a rota /montar for remontada.
globalThis.inicializarMontadorLegado = inicializarMontadorLegado;
globalThis.PCBuilderLegacyBridge = {
  obterEstado: criarSnapshotMontadorReact,
  selecionarCategoria: mudarAbaUI,
  aplicarMontagemIa(componentes = []) {
    return aplicarMontagemIa(componentes);
  },
  pesquisarHardware(termo = "") {
    termoPesquisaBuilder = String(termo ?? "");
    renderizarListaPecas(categoriaAtual);
    emitirEstadoMontadorReact();
  },
  filtrarCompatibilidade(ativo = true) {
    mostrarSomenteCompativeis = Boolean(ativo);
    renderizarListaPecas(categoriaAtual);
    emitirEstadoMontadorReact();
  },
  abrirSlot(slot) {
    const indice = Number(slot);
    const estadoCategoria = estadoMontagem[categoriaAtual];
    if (!Array.isArray(estadoCategoria) || !Number.isInteger(indice) || indice < 0 || indice >= estadoCategoria.length) return false;
    slotAtualSelecionado = indice;
    renderizarListaPecas(categoriaAtual);
    emitirEstadoMontadorReact();
    return true;
  },
  voltarSlots() {
    slotAtualSelecionado = null;
    renderizarListaPecas(categoriaAtual);
    emitirEstadoMontadorReact();
  },
  removerSlot(slot) {
    const indice = Number(slot);
    const estadoCategoria = estadoMontagem[categoriaAtual];
    if (!Array.isArray(estadoCategoria) || !Number.isInteger(indice) || !estadoCategoria[indice]) return false;
    estadoCategoria[indice] = null;
    atualizarPecaNo3D(categoriaAtual, estadoCategoria);
    renderizarListaPecas(categoriaAtual);
    atualizarResumo();
    return true;
  },
  alterarFluxoVentoinha(slot, fluxo = "in") {
    const indice = Number(slot);
    const fan = estadoMontagem.ventoinhas?.[indice];
    if (!fan) return false;
    fan.fluxo = fluxo === "out" ? "out" : "in";
    atualizarPecaNo3D("ventoinhas", estadoMontagem.ventoinhas);
    atualizarResumo();
    renderizarListaPecas("ventoinhas");
    return true;
  },
  destacarPeca(categoria, idPeca) {
    destacarCategoria3D(categoria, idPeca);
  },
  selecionarPecaAutomatica(categoria, idPeca) {
    const estadoCategoria = estadoMontagem[categoria];
    if (Array.isArray(estadoCategoria)) {
      // Para RAM, a ocupação automática prioriza A2/B2 (slots 2 e 4), que é
      // a disposição dual-channel mais comum. A seleção manual continua livre.
      const ordemSlots = categoria === "memoria" ? [1, 3, 0, 2] : estadoCategoria.map((_, indice) => indice);
      const slotLivre = ordemSlots.find((indice) => !estadoCategoria[indice]);
      if (!Number.isInteger(slotLivre)) return false;
      return selecionarPeca(categoria, idPeca, String(slotLivre), categoria === "ventoinhas" ? "in" : "");
    }
    return selecionarPeca(categoria, idPeca, "", "");
  },
  selecionarPeca,
  limparBuild,
  desfazer: desfazerUltimaAlteracao,
  alternarQualidade3D() {
    return alternarQualidade3D();
  },
  obterQualidade3D() {
    return obterQualidade3D();
  },
  destruirAssistenteIa() {
    _moduloIaCarregado?.destruirAssistenteIa?.();
    _moduloIaCarregado = null;
  },
  finalizar() {
    const resultado = verificarCompatibilidade(estadoMontagem);
    atualizarEstadoFinalizacao(resultado);
    if (!resultado?.podeFinalizar) {
      emitirEstadoMontadorReact();
      return { ok: false, estado: criarSnapshotMontadorReact() };
    }
    return { ok: true, estado: criarSnapshotMontadorReact() };
  },
  salvarBuild: salvarBuildNaConta,
  compartilharBuild: compartilharBuildAtual,
  imprimirRelatorio: imprimirRelatorioEmJanelaIsolada,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarMontadorLegado, { once: true });
} else {
  inicializarMontadorLegado();
}

window.addEventListener("pagehide", () => {
  window.clearTimeout(timeoutSalvamentoAutomatico);
  salvarRascunhoBuild();
});

animar();

function numero3DSeguro(valor, fallback = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function limitar3D(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function mmParaUnidade3D(valor, fallbackMm, minimo, maximo) {
  const mm = numero3DSeguro(valor, fallbackMm);
  return limitar3D(mm * ESCALA_MM_3D, minimo, maximo);
}

function especificacoesProcedurais(peca = {}) {
  return peca?.especificacoes && typeof peca.especificacoes === "object"
    ? peca.especificacoes
    : {};
}

function textoProcedural(peca = {}) {
  return [peca.nome, peca.marca, peca.modelo, peca.descricao]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function criarMaterialProcedural(cor, opcoes = {}) {
  return new THREE.MeshStandardMaterial({
    color: cor,
    roughness: opcoes.roughness ?? 0.55,
    metalness: opcoes.metalness ?? 0.2,
    transparent: Boolean(opcoes.transparent),
    opacity: opcoes.opacity ?? 1,
    side: opcoes.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: opcoes.depthWrite ?? true,
  });
}

function criarMeshProcedural(geometria, material, posicao = [0, 0, 0], rotacao = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometria, material);
  mesh.position.set(...posicao);
  mesh.rotation.set(...rotacao);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function registrarDadosProcedurais(grupo, categoria, peca) {
  const dados = {
    tipo: categoria,
    categoria,
    pecaId: String(peca?.id ?? ""),
    nome: peca?.nome || nomesCategoriasBuilder[categoria] || categoria,
    preco: peca?.preco ?? "",
    objetoRaiz: grupo,
    procedural: true,
  };

  grupo.userData = { ...grupo.userData, ...dados };
  grupo.traverse((objeto) => {
    if (!objeto.isMesh) return;
    objeto.userData = { ...objeto.userData, ...dados };
  });
}

function criarVentoinhaProcedural({
  raio = 0.48,
  espessura = 0.12,
  corFrame = 0x111827,
  corPas = 0x334155,
  velocidade = 0.16,
} = {}) {
  const grupo = new THREE.Group();
  const materialFrame = criarMaterialProcedural(corFrame, { roughness: 0.7, metalness: 0.1 });
  const materialPas = criarMaterialProcedural(corPas, { roughness: 0.45, metalness: 0.15 });

  const aro = criarMeshProcedural(
    new THREE.TorusGeometry(raio * 0.88, raio * 0.09, 8, 32),
    materialFrame,
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
  );
  grupo.add(aro);

  const cubo = criarMeshProcedural(
    new THREE.CylinderGeometry(raio * 0.16, raio * 0.16, espessura, 20),
    materialFrame,
  );
  grupo.add(cubo);

  const rotor = new THREE.Group();
  rotor.userData.rotacaoProcedural = true;
  rotor.userData.velocidadeRotacao = velocidade;

  const quantidadePas = 7;
  for (let indice = 0; indice < quantidadePas; indice += 1) {
    const angulo = (indice / quantidadePas) * Math.PI * 2;
    const distancia = raio * 0.47;
    const pa = criarMeshProcedural(
      new THREE.BoxGeometry(raio * 0.58, espessura * 0.22, raio * 0.13),
      materialPas,
      [Math.cos(angulo) * distancia, 0, Math.sin(angulo) * distancia],
      [0, -angulo + 0.42, 0],
    );
    rotor.add(pa);
  }

  grupo.add(rotor);
  objetosAnimadosProcedurais.add(rotor);
  return grupo;
}

function inferirQuantidadeFansGpu(peca, comprimento) {
  const texto = textoProcedural(peca);
  if (/blower|turbina|single\s*fan|1\s*fan/.test(texto)) return 1;
  if (/dual|duo|2\s*fan|2x\s*fan/.test(texto)) return 2;
  if (/triple|trio|3\s*fan|3x\s*fan/.test(texto)) return 3;
  if (comprimento < 2.25) return 1;
  if (comprimento < 2.85) return 2;
  return 3;
}

function criarGpuProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const comprimento = mmParaUnidade3D(specs.comprimentoMm ?? peca.comprimentoMm, 280, 1.8, 3.8);
  const altura = mmParaUnidade3D(specs.alturaMm, 120, 0.8, 1.7);
  const espessura = mmParaUnidade3D(
    specs.espessuraMm ?? (numero3DSeguro(specs.slotsOcupados, 2.5) * 20),
    50,
    0.3,
    0.9,
  );

  const grupo = new THREE.Group();
  grupo.position.copy(basePos);

  const shroud = criarMeshProcedural(
    new THREE.BoxGeometry(altura, espessura, comprimento),
    criarMaterialProcedural(0x202733, { roughness: 0.48, metalness: 0.32 }),
  );
  grupo.add(shroud);

  const pcb = criarMeshProcedural(
    new THREE.BoxGeometry(altura * 0.88, 0.035, comprimento * 0.94),
    criarMaterialProcedural(0x173a2a, { roughness: 0.72, metalness: 0.08 }),
    [0, espessura * 0.42, 0],
  );
  grupo.add(pcb);

  const quantidadeFans = inferirQuantidadeFansGpu(peca, comprimento);
  const raio = limitar3D(
    Math.min(altura * 0.39, comprimento / (quantidadeFans * 2.25)),
    0.24,
    0.55,
  );
  const intervalo = comprimento / quantidadeFans;

  for (let indice = 0; indice < quantidadeFans; indice += 1) {
    const fan = criarVentoinhaProcedural({
      raio,
      espessura: Math.min(0.10, espessura * 0.2),
      corFrame: 0x0f172a,
      corPas: 0x475569,
      velocidade: 0.23,
    });
    // A face das ventoinhas fica no lado oposto ao PCB. Isso evita que
    // o fallback apareca com as fans voltadas para baixo no gabinete.
    fan.position.set(0, -(espessura / 2 + 0.055), -comprimento / 2 + intervalo * (indice + 0.5));
    fan.rotation.x = Math.PI;
    grupo.add(fan);
  }

  const bracket = criarMeshProcedural(
    new THREE.BoxGeometry(altura * 1.03, espessura * 1.02, 0.05),
    criarMaterialProcedural(0x94a3b8, { roughness: 0.35, metalness: 0.75 }),
    [0, 0, comprimento / 2 + 0.03],
  );
  grupo.add(bracket);

  registrarDadosProcedurais(grupo, "placavideo", peca);
  return grupo;
}

function inferirTemplateGabinete(peca, specs) {
  const texto = textoProcedural(peca);
  if (/aqu[aá]rio|aquarium|panor[aâ]mico|panoramic|o11|h9|y60|dual.?chamber/.test(texto)) return "panoramico";
  if (/mesh|airflow|meshify|lancool|fractal/.test(texto)) return "mesh";
  if (/mini|compact|compacto|itx|nr200|sff/.test(texto) || String(specs.tamanho || "").includes("MINI")) return "compacto";
  if (/full.?tower|7000|cosmos/.test(texto) || String(specs.tamanho || "").includes("FULL")) return "full";
  return "torre";
}

function adicionarBarraGabinete(grupo, tamanho, posicao, material) {
  grupo.add(criarMeshProcedural(new THREE.BoxGeometry(...tamanho), material, posicao));
}

function criarGabineteProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const dimensoes = obterDimensoesGabineteLayout3D(peca);
  const largura = dimensoes.largura;
  const altura = dimensoes.altura;
  const profundidade = dimensoes.profundidade;
  const template = inferirTemplateGabinete(peca, specs);

  const grupo = new THREE.Group();
  grupo.position.copy(basePos);
  grupo.position.y = altura / 2;
  grupo.userData.templateGabinete = template;

  const matFrame = criarMaterialProcedural(0x1f2937, { roughness: 0.55, metalness: 0.48 });
  const matPainel = criarMaterialProcedural(0x111827, { roughness: 0.6, metalness: 0.28 });
  const matVidro = criarMaterialProcedural(0x93c5fd, {
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.13,
    doubleSide: true,
    depthWrite: false,
  });
  const esp = 0.055;
  const meiaL = largura / 2;
  const meiaA = altura / 2;
  const meiaP = profundidade / 2;

  // Estrutura principal — 12 travessas deixam o interior visível.
  [[-meiaL, -meiaP], [-meiaL, meiaP], [meiaL, -meiaP], [meiaL, meiaP]].forEach(([x, z]) => {
    adicionarBarraGabinete(grupo, [esp, altura, esp], [x, 0, z], matFrame);
  });
  [-meiaA, meiaA].forEach((y) => {
    [-meiaP, meiaP].forEach((z) => adicionarBarraGabinete(grupo, [largura, esp, esp], [0, y, z], matFrame));
    [-meiaL, meiaL].forEach((x) => adicionarBarraGabinete(grupo, [esp, esp, profundidade], [x, y, 0], matFrame));
  });

  // Piso e shroud inferior.
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(largura * 0.96, esp, profundidade * 0.96),
    matPainel,
    [0, -meiaA + esp * 1.5, 0],
  ));
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(largura * 0.94, altura * 0.20, profundidade * 0.88),
    criarMaterialProcedural(0x0f172a, { roughness: 0.72, metalness: 0.25, transparent: true, opacity: 0.58 }),
    [0, -meiaA + altura * 0.12, 0.06],
  ));

  // Lateral visível em vidro. Não recebe/projeta sombra para não virar um
  // grande plano claro dependendo do ângulo da câmera.
  const vidroLateral = criarMeshProcedural(
    new THREE.BoxGeometry(esp * 0.45, altura * 0.94, profundidade * 0.92),
    matVidro,
    [meiaL - esp * 0.6, 0, 0],
  );
  vidroLateral.castShadow = false;
  vidroLateral.receiveShadow = false;
  grupo.add(vidroLateral);

  if (template === "panoramico") {
    const vidroFrontal = criarMeshProcedural(
      new THREE.BoxGeometry(largura * 0.92, altura * 0.94, esp * 0.45),
      matVidro.clone(),
      [0, 0, -meiaP + esp * 0.6],
    );
    vidroFrontal.castShadow = false;
    vidroFrontal.receiveShadow = false;
    grupo.add(vidroFrontal);
  } else if (template === "mesh") {
    const barras = 11;
    for (let indice = 0; indice < barras; indice += 1) {
      const y = -meiaA * 0.82 + (indice / (barras - 1)) * altura * 0.82;
      adicionarBarraGabinete(grupo, [largura * 0.84, 0.025, 0.03], [0, y, -meiaP + esp], matFrame);
    }
    // Três círculos sugerem as entradas frontais sem inventar a fan real.
    [-0.28, 0, 0.28].forEach((fator) => {
      const aro = criarMeshProcedural(
        new THREE.TorusGeometry(Math.min(largura * 0.27, altura * 0.12), 0.025, 6, 28),
        matFrame,
        [0, fator * altura * 1.8, -meiaP + esp * 1.2],
      );
      grupo.add(aro);
    });
  } else {
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(largura * 0.90, altura * 0.88, esp),
      criarMaterialProcedural(template === "compacto" ? 0x334155 : 0x1e293b, {
        roughness: 0.66,
        metalness: 0.30,
        transparent: true,
        opacity: 0.70,
      }),
      [0, 0, -meiaP + esp],
    ));
  }

  // Tampa superior translúcida para manter a leitura interna.
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(largura * 0.94, esp * 0.5, profundidade * 0.92),
    criarMaterialProcedural(0x334155, { transparent: true, opacity: 0.30, depthWrite: false }),
    [0, meiaA - esp * 0.5, 0],
  ));

  registrarDadosProcedurais(grupo, "gabinete", peca);
  return grupo;
}

function criarPlacaMaeProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const formato = String(specs.formato || peca.formato || "ATX").toUpperCase();
  const dimensoes = formato.includes("MINI")
    ? [1.70, 1.70]
    : formato.includes("MICRO") || formato.includes("MATX")
      ? [2.44, 2.44]
      : formato.includes("E_ATX") || formato.includes("E-ATX")
        ? [3.30, 3.05]
        : [2.44, 3.05];
  const [larguraZ, alturaY] = dimensoes;

  const grupo = new THREE.Group();
  grupo.position.copy(basePos);
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(0.055, alturaY, larguraZ),
    criarMaterialProcedural(0x143b2d, { roughness: 0.68, metalness: 0.08 }),
  ));
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(0.08, 0.55, 0.55),
    criarMaterialProcedural(0x64748b, { roughness: 0.38, metalness: 0.65 }),
    [0.05, 0.35, 0.20],
  ));
  const deslocamentoRamY = Math.min(0.35, alturaY * 0.14);
  const deslocamentoRamZ = -Math.min(0.45, larguraZ * 0.18);
  const espacamentoRamZ = Math.min(0.11, larguraZ * 0.045);
  for (let indice = 0; indice < 4; indice += 1) {
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(0.07, 1.25, 0.035),
      criarMaterialProcedural(0x1d4ed8, { roughness: 0.55 }),
      [0.05, deslocamentoRamY, deslocamentoRamZ + indice * espacamentoRamZ],
    ));
  }
  registrarDadosProcedurais(grupo, "placamae", peca);
  return grupo;
}

function criarCpuProcedural(peca, basePos) {
  const grupo = new THREE.Group();
  grupo.position.copy(basePos);
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(0.065, 0.42, 0.42),
    criarMaterialProcedural(0xcbd5e1, { roughness: 0.25, metalness: 0.75 }),
  ));
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(0.02, 0.34, 0.34),
    criarMaterialProcedural(0x0f172a, { roughness: 0.55, metalness: 0.15 }),
    [-0.045, 0, 0],
  ));
  registrarDadosProcedurais(grupo, "processador", peca);
  return grupo;
}

function criarRamProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const alturaX = mmParaUnidade3D(specs.alturaMm, 35, 0.24, 0.65);
  const grupo = new THREE.Group();
  grupo.position.copy(basePos);
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(alturaX, 1.32, 0.075),
    criarMaterialProcedural(specs.rgb ? 0x6d28d9 : 0x1e293b, { roughness: 0.45, metalness: 0.18 }),
  ));
  for (let indice = 0; indice < 6; indice += 1) {
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(0.025, 0.13, 0.085),
      criarMaterialProcedural(0x0f172a, { roughness: 0.7 }),
      [alturaX * 0.08, -0.48 + indice * 0.19, 0],
    ));
  }
  registrarDadosProcedurais(grupo, "memoria", peca);
  return grupo;
}

function criarArmazenamentoProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const textoFormato = `${specs.formato || ""} ${specs.interface || ""}`.toUpperCase();
  const grupo = new THREE.Group();
  grupo.position.copy(basePos);

  if (textoFormato.includes("M2") || textoFormato.includes("M.2") || textoFormato.includes("NVME")) {
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(0.04, 0.22, 0.80),
      criarMaterialProcedural(0x166534, { roughness: 0.68, metalness: 0.08 }),
    ));
    for (let indice = 0; indice < 4; indice += 1) {
      grupo.add(criarMeshProcedural(
        new THREE.BoxGeometry(0.025, 0.13, 0.12),
        criarMaterialProcedural(0x111827, { roughness: 0.7 }),
        [0.035, 0, -0.25 + indice * 0.17],
      ));
    }
  } else {
    const hdd = String(specs.tipo || "").toUpperCase() === "HDD";
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(hdd ? 0.28 : 0.08, hdd ? 1.02 : 0.70, hdd ? 1.47 : 1.00),
      criarMaterialProcedural(0x475569, { roughness: 0.55, metalness: 0.42 }),
    ));
  }

  registrarDadosProcedurais(grupo, "armazenamento", peca);
  return grupo;
}

function criarFonteProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const largura = mmParaUnidade3D(specs.larguraMm, 150, 1.2, 1.8);
  const altura = mmParaUnidade3D(specs.alturaMm, 86, 0.72, 1.2);
  const profundidade = mmParaUnidade3D(specs.comprimentoMm ?? specs.profundidadeMm, 160, 1.2, 2.2);
  const grupo = new THREE.Group();
  grupo.position.copy(basePos);
  grupo.add(criarMeshProcedural(
    new THREE.BoxGeometry(largura, altura, profundidade),
    criarMaterialProcedural(0x111827, { roughness: 0.6, metalness: 0.42 }),
  ));
  const fan = criarVentoinhaProcedural({ raio: Math.min(largura, profundidade) * 0.31, espessura: 0.08, velocidade: 0.13 });
  fan.position.set(0, altura / 2 + 0.045, 0);
  grupo.add(fan);
  registrarDadosProcedurais(grupo, "fonte", peca);
  return grupo;
}

function criarCoolerProcedural(peca, basePos) {
  const specs = especificacoesProcedurais(peca);
  const texto = `${specs.tipo || ""} ${textoProcedural(peca)}`.toLowerCase();
  const grupo = new THREE.Group();
  grupo.position.copy(basePos);

  if (/water|aio|liquid|radiador/.test(texto) || specs.tamanhoRadiadorMm) {
    const tamanhoRad = mmParaUnidade3D(specs.tamanhoRadiadorMm, 240, 1.2, 3.6);
    const qtd = limitar3D(numero3DSeguro(specs.quantidadeVentoinhas, Math.round(tamanhoRad / 1.2)), 1, 3);
    const larguraRad = mmParaUnidade3D(specs.tamanhoVentoinhaMm, 120, 0.9, 1.5);
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(0.18, larguraRad, tamanhoRad),
      criarMaterialProcedural(0x1e293b, { roughness: 0.62, metalness: 0.38 }),
      [0.35, 0.62, 0],
    ));
    const intervalo = tamanhoRad / qtd;
    for (let indice = 0; indice < qtd; indice += 1) {
      const fan = criarVentoinhaProcedural({ raio: larguraRad * 0.38, espessura: 0.08, velocidade: 0.18 });
      fan.rotation.z = Math.PI / 2;
      fan.position.set(0.22, 0.62, -tamanhoRad / 2 + intervalo * (indice + 0.5));
      grupo.add(fan);
    }
    grupo.add(criarMeshProcedural(
      new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24),
      criarMaterialProcedural(0x0f172a, { roughness: 0.45, metalness: 0.35 }),
      [0, 0, 0],
      [0, 0, Math.PI / 2],
    ));
  } else {
    const altura = mmParaUnidade3D(specs.alturaMm, 155, 0.75, 1.9);
    const largura = mmParaUnidade3D(specs.larguraMm, 125, 0.65, 1.5);
    const profundidade = mmParaUnidade3D(specs.profundidadeMm, 95, 0.55, 1.4);
    grupo.add(criarMeshProcedural(
      new THREE.BoxGeometry(altura * 0.72, largura, profundidade),
      criarMaterialProcedural(0x94a3b8, { roughness: 0.34, metalness: 0.72 }),
      [altura * 0.18, 0, 0],
    ));
    const fan = criarVentoinhaProcedural({ raio: Math.min(largura, profundidade) * 0.40, espessura: 0.08, velocidade: 0.18 });
    fan.rotation.z = Math.PI / 2;
    fan.position.set(-altura * 0.22, 0, 0);
    grupo.add(fan);
  }

  registrarDadosProcedurais(grupo, "cooler", peca);
  return grupo;
}

function criarVentoinhaSlotProcedural(peca, slot) {
  const specs = especificacoesProcedurais(peca);
  const tamanho = mmParaUnidade3D(specs.tamanhoMm, 120, 0.8, 1.6);
  const fan = criarVentoinhaProcedural({
    raio: tamanho * 0.40,
    espessura: mmParaUnidade3D(specs.espessuraMm, 25, 0.10, 0.38),
    velocidade: 0.22,
    corFrame: 0x0f172a,
    corPas: specs.rgb || specs.argb ? 0x2563eb : 0x475569,
  });
  fan.position.copy(slot?.position ?? new THREE.Vector3());
  if (slot?.rotation) fan.rotation.copy(slot.rotation);
  registrarDadosProcedurais(fan, "ventoinhas", peca);
  return fan;
}

function criarModeloProcedural(categoria, peca, slot) {
  if (!peca) return null;
  const basePos = slot?.position?.clone?.() ?? new THREE.Vector3(0, 0, 0);

  switch (categoria) {
    case "gabinete": return criarGabineteProcedural(peca, basePos);
    case "placavideo": return criarGpuProcedural(peca, basePos);
    case "placamae": return criarPlacaMaeProcedural(peca, basePos);
    case "processador": return criarCpuProcedural(peca, basePos);
    case "memoria": return criarRamProcedural(peca, basePos);
    case "armazenamento": return criarArmazenamentoProcedural(peca, basePos);
    case "fonte": return criarFonteProcedural(peca, basePos);
    case "cooler": return criarCoolerProcedural(peca, basePos);
    case "ventoinhas": return criarVentoinhaSlotProcedural(peca, slot);
    default: {
      const grupo = new THREE.Group();
      grupo.position.copy(basePos);
      grupo.add(criarMeshProcedural(
        new THREE.BoxGeometry(0.7, 0.7, 0.7),
        criarMaterialProcedural(0x64748b, { transparent: true, opacity: 0.70 }),
      ));
      registrarDadosProcedurais(grupo, categoria, peca);
      return grupo;
    }
  }
}


function transform3DTemCalibracaoExplicita(transform = {}) {
  const posicao = Array.isArray(transform.posicao) ? transform.posicao : [0, 0, 0];
  const rotacao = Array.isArray(transform.rotacao) ? transform.rotacao : [0, 0, 0];
  const escala = Array.isArray(transform.escala)
    ? transform.escala
    : [transform.escala ?? 1, transform.escala ?? 1, transform.escala ?? 1];

  const deslocado = posicao.some((valor) => Math.abs(Number(valor) || 0) > 0.0001);
  const rotacionado = rotacao.some((valor) => Math.abs(Number(valor) || 0) > 0.0001);
  const escalado = escala.some((valor) => Math.abs((Number(valor) || 1) - 1) > 0.0001);
  return deslocado || rotacionado || escalado;
}

function normalizarGabineteGlbForaDeEscala(modelo, peca, basePos, transform = {}) {
  if (!modelo || transform3DTemCalibracaoExplicita(transform)) return;

  modelo.updateMatrixWorld(true);
  let caixa = new THREE.Box3().setFromObject(modelo);
  if (caixa.isEmpty()) return;

  const tamanho = caixa.getSize(new THREE.Vector3());
  const dimensoesEsperadas = obterDimensoesGabineteLayout3D(peca);
  const maiorAtual = Math.max(tamanho.x, tamanho.y, tamanho.z);
  const maiorEsperada = Math.max(
    dimensoesEsperadas.largura,
    dimensoesEsperadas.altura,
    dimensoesEsperadas.profundidade,
  );

  if (!Number.isFinite(maiorAtual) || maiorAtual <= 0.001) return;
  const proporcao = maiorAtual / maiorEsperada;

  // Arquivos GLB podem vir em metros, centímetros ou milímetros. Corrige
  // automaticamente diferenças claras de unidade e também garante que o case
  // visual não fique menor que a área útil calculada para as peças atuais.
  if (proporcao > 1.8 || proporcao < 0.55) {
    const fator = maiorEsperada / maiorAtual;
    modelo.scale.multiplyScalar(fator);
    modelo.updateMatrixWorld(true);
    caixa = new THREE.Box3().setFromObject(modelo);
  }

  const tamanhoAjustado = caixa.getSize(new THREE.Vector3());
  const fatoresParaConter = [
    dimensoesEsperadas.largura / Math.max(0.001, tamanhoAjustado.x),
    dimensoesEsperadas.altura / Math.max(0.001, tamanhoAjustado.y),
    dimensoesEsperadas.profundidade / Math.max(0.001, tamanhoAjustado.z),
  ];
  const fatorConter = Math.max(1, ...fatoresParaConter.filter(Number.isFinite));
  if (fatorConter > 1.02 && fatorConter < 2.5) {
    modelo.scale.multiplyScalar(fatorConter);
    modelo.updateMatrixWorld(true);
    caixa = new THREE.Box3().setFromObject(modelo);
    modelo.userData.ajusteVisualGabineteAutomatico = true;
  }

  // Mantém o gabinete no mesmo centro do layout, evitando modelos cuja origem
  // fica longe da malha aparecerem deslocados/"fora de contexto".
  const centro = caixa.getCenter(new THREE.Vector3());
  modelo.position.add(new THREE.Vector3().copy(basePos).sub(centro));
  modelo.updateMatrixWorld(true);
}

function removerModelo3D(categoria) {
  const modeloAtual = modelos3DAtivos[categoria];
  if (!modeloAtual) return;
  modelos3DAtivos[categoria] = null;

  const inicio = performance.now();
  const duracao = 180;
  const escalaInicial = modeloAtual.scale.clone();

  const materiais = [];
  modeloAtual.traverse((objeto) => {
    if (!objeto.isMesh) return;
    const lista = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
    lista.filter(Boolean).forEach((material) => {
      material.transparent = true;
      materiais.push({ material, opacidade: material.opacity ?? 1 });
    });
  });

  function finalizar() {
    cena.remove(modeloAtual);
    modeloAtual.traverse((objeto) => {
      if (objeto.userData?.rotacaoProcedural) objetosAnimadosProcedurais.delete(objeto);
      if (!objeto.isMesh) return;
      objeto.geometry?.dispose();
      if (Array.isArray(objeto.material)) objeto.material.forEach((mat) => mat.dispose());
      else objeto.material?.dispose();
    });
  }

  function quadro(agora) {
    const progresso = Math.min(1, (agora - inicio) / duracao);
    const restante = 1 - progresso;
    modeloAtual.scale.copy(escalaInicial).multiplyScalar(0.94 + 0.06 * restante);
    materiais.forEach(({ material, opacidade }) => {
      material.opacity = opacidade * restante;
    });

    if (progresso < 1) requestAnimationFrame(quadro);
    else finalizar();
  }

  requestAnimationFrame(quadro);
}

// 🌟 INJEÇÃO 3D DIRETO NO SLOT CORRETO
function atualizarPecaNo3D(categoria, estadoDaCategoria) {
  const versaoAtual = (versaoCarregamento3D[categoria] ?? 0) + 1;
  versaoCarregamento3D[categoria] = versaoAtual;

  removerModelo3D(categoria);

  const objetosPlaceholder = objetosPorCategoria[categoria] ?? [];
  const pecas = Array.isArray(estadoDaCategoria)
    ? estadoDaCategoria
    : [estadoDaCategoria];
  const selecionadas = pecas
    .map((peca, index) => ({ peca, index }))
    .filter(({ peca }) => Boolean(peca));

  // Sem peça: volta para o contorno de encaixe original.
  objetosPlaceholder.forEach((objeto, index) => {
    const peca = categoria === "gabinete" ? pecas[0] : pecas[index];
    objeto.material.transparent = true;

    if (!peca) {
      if (categoria === "gabinete") {
        objeto.material.wireframe = objeto === slotGabinete;
        animarPlaceholder(
          objeto,
          true,
          objeto === slotGabinete ? 0.16 : 0.28,
        );
      } else {
        objeto.material.wireframe = true;
        animarPlaceholder(objeto, true, objeto.userData.opacidadeOriginal ?? 0.35);
      }
      return;
    }

    // Toda peça selecionada recebe GLB real ou fallback procedural.
    // O placeholder fica escondido para não sobrepor a geometria final.
    animarPlaceholder(objeto, false);
  });

  if (selecionadas.length === 0) return;

  const grupoPrincipal = new THREE.Group();
  grupoPrincipal.name = `grupo-modelos-${categoria}`;
  grupoPrincipal.userData = {
    tipo: categoria,
    categoria,
    nome: nomesCategoriasBuilder[categoria] ?? categoria,
    objetoRaiz: grupoPrincipal,
  };

  let quantidadeRepresentacoes = 0;
  let carregamentosPendentes = 0;

  function slotDaPeca(index) {
    if (categoria === "gabinete") return slotGabinete;
    return objetosPlaceholder[index] ?? objetosPlaceholder[0] ?? null;
  }

  function adicionarProcedural(peca, index, motivo = "sem-modelo") {
    if (versaoCarregamento3D[categoria] !== versaoAtual) return false;
    const procedural = criarModeloProcedural(categoria, peca, slotDaPeca(index));
    if (!procedural) return false;
    procedural.userData = {
      ...procedural.userData,
      fallback3D: true,
      motivoFallback3D: motivo,
    };
    grupoPrincipal.add(procedural);
    quantidadeRepresentacoes++;
    return true;
  }

  function publicarGrupoSeNecessario() {
    if (versaoCarregamento3D[categoria] !== versaoAtual) return;
    if (quantidadeRepresentacoes <= 0) return;

    if (!grupoPrincipal.parent) cena.add(grupoPrincipal);
    modelos3DAtivos[categoria] = grupoPrincipal;
    controles.target.set(0, 2.3, 0);
    controles.update();
  }

  function finalizarCargaAssincrona() {
    carregamentosPendentes--;
    if (carregamentosPendentes <= 0) publicarGrupoSeNecessario();
  }

  selecionadas.forEach(({ peca, index }) => {
    const urlModelo = String(peca.modelo3D || peca.modelo3dUrl || "").trim();

    // A listagem pública de /api/hardwares pode não trazer modelos3D.
    // Nesse caso consultamos o endpoint público específico somente quando a
    // peça é realmente selecionada no PC 3D, evitando dezenas de requests no catálogo.
    if (!urlModelo && carregador && peca.hardwareId && peca.__modelo3dConsultado !== true) {
      peca.__modelo3dConsultado = true;
      adicionarProcedural(peca, index, "consultando-modelo");
      publicarGrupoSeNecessario();

      api.obterModelo3DHardware(peca.hardwareId)
        .then((resultado) => {
          if (versaoCarregamento3D[categoria] !== versaoAtual || !resultado?.modelo3dUrl) return;
          peca.modelo3D = resultado.modelo3dUrl;
          peca.modelo3dUrl = resultado.modelo3dUrl;
          if (resultado.transform3D) peca.transform3D = resultado.transform3D;
          atualizarPecaNo3D(categoria, estadoDaCategoria);
        })
        .catch((erro) => {
          console.warn(`Não foi possível localizar o GLB de "${peca.nome}".`, erro);
        });
      return;
    }

    if (!urlModelo || !carregador) {
      adicionarProcedural(peca, index, !urlModelo ? "sem-modelo" : "loader-indisponivel");
      return;
    }

    carregamentosPendentes++;
    const slotEspecifico = slotDaPeca(index);
    const basePos = slotEspecifico?.position ?? new THREE.Vector3(0, 0, 0);
    const caminhoModelo = new URL(urlModelo, RAIZ_SITE).href;

    carregarModelo3D(caminhoModelo)
      .then((gltf) => {
        if (versaoCarregamento3D[categoria] !== versaoAtual) {
          finalizarCargaAssincrona();
          return;
        }

        const modelo = gltf.scene;
        const materiaisClonados = new Map();

        modelo.traverse((objeto) => {
          if (!objeto.isMesh || !objeto.material) return;

          const clonarMaterial = (material) => {
            if (!material) return material;
            if (!materiaisClonados.has(material)) {
              materiaisClonados.set(material, material.clone());
            }
            return materiaisClonados.get(material);
          };

          objeto.material = Array.isArray(objeto.material)
            ? objeto.material.map(clonarMaterial)
            : clonarMaterial(objeto.material);
        });

        const transform = peca.transform3D ?? {};
        const posicaoJson = transform.posicao ?? [0, 0, 0];
        const posicaoTransform = new THREE.Vector3(...posicaoJson);
        const finalPos = transform.modoPosicao === "absoluta"
          ? posicaoTransform
          : new THREE.Vector3().copy(basePos).add(posicaoTransform);

        modelo.position.copy(finalPos);

        const rotacaoBase = transform.rotacao ?? [0, 0, 0];
        const rotacaoSaida = transform.rotacaoSaida ?? [0, 180, 0];
        const aplicarRotacaoSaida = categoria === "ventoinhas" && peca.fluxo === "out";

        modelo.rotation.set(
          THREE.MathUtils.degToRad(
            Number(rotacaoBase[0]) + (aplicarRotacaoSaida ? Number(rotacaoSaida[0]) : 0),
          ),
          THREE.MathUtils.degToRad(
            Number(rotacaoBase[1]) + (aplicarRotacaoSaida ? Number(rotacaoSaida[1]) : 0),
          ),
          THREE.MathUtils.degToRad(
            Number(rotacaoBase[2]) + (aplicarRotacaoSaida ? Number(rotacaoSaida[2]) : 0),
          ),
        );

        const escala = transform.escala ?? 1;
        if (Array.isArray(escala)) {
          modelo.scale.set(
            Number(escala[0]) || 1,
            Number(escala[1]) || 1,
            Number(escala[2]) || 1,
          );
        } else {
          modelo.scale.setScalar(Number(escala) || 1);
        }

        if (transform.centralizarNoPonto === true) {
          modelo.updateMatrixWorld(true);
          const caixaModelo = new THREE.Box3().setFromObject(modelo);
          if (!caixaModelo.isEmpty()) {
            const centroModelo = caixaModelo.getCenter(new THREE.Vector3());
            modelo.position.add(new THREE.Vector3().copy(finalPos).sub(centroModelo));
          }
        }

        if (categoria === "gabinete") {
          normalizarGabineteGlbForaDeEscala(modelo, peca, basePos, transform);
        }

        modelo.userData = {
          ...modelo.userData,
          tipo: categoria,
          categoria,
          pecaId: peca.id,
          nome: peca.nome,
          preco: peca.preco,
          objetoRaiz: modelo,
          fallback3D: false,
        };

        modelo.traverse((objeto) => {
          if (!objeto.isMesh) return;
          objeto.castShadow = true;
          objeto.receiveShadow = true;
          objeto.frustumCulled = false;
          objeto.userData = {
            ...objeto.userData,
            tipo: categoria,
            categoria,
            pecaId: peca.id,
            nome: peca.nome,
            preco: peca.preco,
            objetoRaiz: modelo,
            fallback3D: false,
          };
        });

        const escalaFinal = modelo.scale.clone();
        animarEntradaModelo(modelo, escalaFinal);
        grupoPrincipal.add(modelo);
        quantidadeRepresentacoes++;
        finalizarCargaAssincrona();
      })
      .catch((erro) => {
        console.error(`Erro ao carregar o modelo 3D de "${peca.nome}":`, erro);
        adicionarProcedural(peca, index, "falha-glb");
        mostrarToast(`Modelo 3D indisponível: ${peca.nome}. Usando representação aproximada.`, "alerta");
        finalizarCargaAssincrona();
      });
  });

  // Fallbacks procedurais entram imediatamente; GLBs são incorporados assim
  // que terminam de carregar. Isso evita deixar a montagem vazia enquanto a
  // rede/S3 responde.
  publicarGrupoSeNecessario();
  if (quantidadeRepresentacoes > 0) {
    animarEscalaObjeto(grupoPrincipal, 1.04, 360);
  }
}

