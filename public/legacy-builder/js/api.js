/**
 * Camada única de dados do frontend.
 * No modo "local", lê os arquivos JSON do projeto.
 * Quando o backend público estiver pronto, basta trocar a configuração para
 * usar as rotas HTTP sem reescrever as páginas do catálogo e do montador.
 */
const CONFIGURACAO_PADRAO = Object.freeze({
  baseUrl: "",
  modo: "local",
  timeoutMs: 12000,
});

const configuracao = {
  ...CONFIGURACAO_PADRAO,
  ...(globalThis.PC_BUILDER_API_CONFIG ?? {}),
};


const CATEGORIA_HARDWARE_PARA_BUILDER = Object.freeze({
  PROCESSADOR: "processador",
  COOLER: "cooler",
  PLACA_MAE: "placa-mae",
  MEMORIA_RAM: "memoria",
  PLACA_VIDEO: "placa-video",
  ARMAZENAMENTO: "armazenamento",
  FONTE: "fonte",
  GABINETE: "gabinete",
  VENTOINHA: "ventoinha",
});

function primeiroObjeto(...valores) {
  return valores.find((valor) => valor && typeof valor === "object" && !Array.isArray(valor)) ?? {};
}

function melhorOfertaHardware(hardware) {
  const ofertas = Array.isArray(hardware?.produto?.ofertas) ? hardware.produto.ofertas : [];
  return ofertas[0] ?? null;
}

function normalizarFormatoPlacaMae(valor) {
  const mapa = {
    E_ATX: "eatx",
    ATX: "atx",
    MICRO_ATX: "matx",
    MINI_ITX: "mini-itx",
  };
  return mapa[String(valor || "").toUpperCase()] ?? String(valor || "").toLowerCase();
}

function normalizarFormatoGabinete(especificacao = {}) {
  const tamanho = String(especificacao.tamanho || "").toUpperCase();
  if (["SFF", "MINI_TOWER"].includes(tamanho)) return "compacto";
  if (tamanho === "FULL_TOWER") return "full-tower";
  return tamanho ? "mid-tower" : "";
}

function normalizarHardwareParaBuilder(hardware) {
  const categoria = CATEGORIA_HARDWARE_PARA_BUILDER[String(hardware?.categoria || "").toUpperCase()];
  if (!categoria) return null;

  const oferta = melhorOfertaHardware(hardware);
  const specs = primeiroObjeto(
    hardware.especificacaoProcessador,
    hardware.especificacaoPlacaMae,
    hardware.especificacaoMemoriaRam,
    hardware.especificacaoPlacaVideo,
    hardware.especificacaoArmazenamento,
    hardware.especificacaoFonte,
    hardware.especificacaoGabinete,
    hardware.especificacaoCooler,
    hardware.especificacaoVentoinha,
    hardware.especificacoes,
  );

  const tiposMemoria = Array.isArray(hardware?.especificacaoPlacaMae?.tiposMemoriaSuportados)
    ? hardware.especificacaoPlacaMae.tiposMemoriaSuportados
    : [];
  const preco = oferta?.preco ?? null;

  return {
    id: String(hardware.id),
    hardwareId: Number(hardware.id),
    origem: "CATALOGO",
    categoria,
    categoriaHardware: hardware.categoria,
    nome: hardware.nome,
    marca: hardware.marca || "",
    modelo: hardware.modelo || "",
    descricao: hardware.descricao || "",
    imagem: hardware.imagemUrl || hardware?.produto?.imagemHoverUrl || "",
    imagemUrl: hardware.imagemUrl || hardware?.produto?.imagemHoverUrl || "",
    preco,
    precoIndisponivel: preco === null || preco === undefined,
    loja: oferta?.parceiro?.nome || "",
    linkCompra: oferta?.urlAfiliada || oferta?.urlOriginal || "",
    linkAfiliado: oferta?.urlAfiliada || "",
    especificacoes: { ...specs },
    soquete: hardware?.especificacaoProcessador?.socket || hardware?.especificacaoPlacaMae?.socket || "",
    tipoRam: hardware?.especificacaoMemoriaRam?.tipo || tiposMemoria[0] || "",
    frequencia: hardware?.especificacaoMemoriaRam?.frequenciaMhz || 0,
    formato: hardware?.especificacaoPlacaMae
      ? normalizarFormatoPlacaMae(hardware.especificacaoPlacaMae.formato)
      : hardware?.especificacaoGabinete
        ? normalizarFormatoGabinete(hardware.especificacaoGabinete)
        : hardware?.especificacaoFonte?.formato || "",
    comprimentoMm: hardware?.especificacaoPlacaVideo?.comprimentoMm || 0,
    watts:
      hardware?.especificacaoProcessador?.tdpWatts ??
      hardware?.especificacaoPlacaVideo?.consumoWatts ??
      hardware?.especificacaoMemoriaRam?.consumoWatts ??
      hardware?.especificacaoArmazenamento?.consumoWatts ??
      hardware?.especificacaoCooler?.consumoWatts ??
      hardware?.especificacaoFonte?.potenciaWatts ??
      0,
  };
}

function normalizarListaHardwaresParaBuilder(resposta) {
  const itens = Array.isArray(resposta)
    ? resposta
    : Array.isArray(resposta?.itens)
      ? resposta.itens
      : Array.isArray(resposta?.dados)
        ? resposta.dados
        : [];

  return {
    pecas: itens.map(normalizarHardwareParaBuilder).filter(Boolean),
  };
}

function criarErroApi(mensagem, detalhes = {}) {
  const erro = new Error(mensagem);
  Object.assign(erro, detalhes);
  return erro;
}

async function requisitar(caminho, opcoes = {}) {
  const controlador = new AbortController();
  const timeout = window.setTimeout(
    () => controlador.abort(),
    Number(opcoes.timeoutMs) || configuracao.timeoutMs,
  );

  const url = /^https?:\/\//i.test(caminho)
    ? caminho
    : `${configuracao.baseUrl}${caminho}`;

  try {
    const resposta = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
        ...(opcoes.headers ?? {}),
      },
      ...opcoes,
      body:
        opcoes.body && typeof opcoes.body !== "string"
          ? JSON.stringify(opcoes.body)
          : opcoes.body,
      signal: controlador.signal,
    });

    if (!resposta.ok) {
      throw criarErroApi(`Falha na requisição (${resposta.status}).`, {
        status: resposta.status,
        url,
      });
    }

    const tipo = resposta.headers.get("content-type") ?? "";
    return tipo.includes("application/json")
      ? resposta.json()
      : resposta.text();
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw criarErroApi("A requisição demorou mais que o esperado.", {
        codigo: "TIMEOUT",
        url,
      });
    }
    throw erro;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function obterJsonLocal(caminho) {
  return requisitar(caminho, { method: "GET" });
}

export const api = Object.freeze({
  get modo() {
    return configuracao.modo;
  },

  configurar(novaConfiguracao = {}) {
    Object.assign(configuracao, novaConfiguracao);
  },

  requisitar,

  async listarPecas() {
    if (configuracao.modo === "local") {
      return obterJsonLocal(new URL("../pecas.json", import.meta.url).href);
    }

    const hardwares = await requisitar("/api/hardwares");
    return normalizarListaHardwaresParaBuilder(hardwares);
  },

  listarMontados() {
    return configuracao.modo === "local"
      ? obterJsonLocal(new URL("../builds.json", import.meta.url).href)
      : requisitar("/api/builds");
  },

  listarNotebooks() {
    return configuracao.modo === "local"
      ? obterJsonLocal(new URL("../notebooks.json", import.meta.url).href)
      : requisitar("/api/notebooks");
  },

  validarBuild(configuracaoBuild) {
    if (configuracao.modo === "local") {
      return Promise.resolve({ modo: "local", configuracao: configuracaoBuild });
    }

    return requisitar("/api/hardwares/compatibilidades/montagem", {
      method: "POST",
      body: configuracaoBuild,
    });
  },

  salvarBuild(build) {
    if (configuracao.modo === "local") {
      return Promise.resolve({ modo: "local", build });
    }

    return requisitar("/api/builds", {
      method: "POST",
      body: build,
    });
  },

  login(credenciais) {
    return requisitar("/api/auth/login", {
      method: "POST",
      body: credenciais,
    });
  },

  cadastrar(dados) {
    return requisitar("/api/auth/cadastro", {
      method: "POST",
      body: dados,
    });
  },

  logout() {
    return requisitar("/api/auth/logout", { method: "POST" });
  },
});
