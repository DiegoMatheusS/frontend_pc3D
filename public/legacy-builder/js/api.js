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

function numeroPrecoComercial(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (valor === null || valor === undefined) return null;

  const bruto = String(valor).trim();
  if (!bruto) return null;

  // Respostas JSON/Prisma Decimal normalmente chegam como "1037.40".
  // Number() precisa ser tentado antes de qualquer normalização pt-BR para não
  // transformar 1037.40 em 103740.
  const direto = Number(bruto);
  if (Number.isFinite(direto)) return direto;

  const limpo = bruto.replace(/[^\d,.-]/g, "");
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado = limpo;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // O último separador é tratado como decimal; os anteriores são milhares.
    if (ultimaVirgula > ultimoPonto) {
      normalizado = limpo.replace(/\./g, "").replace(",", ".");
    } else {
      normalizado = limpo.replace(/,/g, "");
    }
  } else if (ultimaVirgula >= 0) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function precoOfertaHardware(oferta) {
  if (!oferta || typeof oferta !== "object" || oferta.ativo === false) return null;
  const preco = numeroPrecoComercial(
    oferta.precoAtual ?? oferta.preco ?? oferta.valor ?? oferta.price,
  );
  return preco !== null && preco > 0 ? preco : null;
}

function escolherMelhorOfertaBuilder(ofertas = []) {
  return (Array.isArray(ofertas) ? ofertas : [])
    .filter((oferta) => precoOfertaHardware(oferta) !== null)
    .sort((a, b) => precoOfertaHardware(a) - precoOfertaHardware(b))[0] ?? null;
}

function melhorOfertaHardware(hardware) {
  // O preço do montador precisa seguir exatamente a mesma fonte comercial da
  // Loja. Quando o catálogo público de Produtos foi cruzado com o Hardware,
  // essa oferta tem prioridade sobre qualquer preço legado/nested do Hardware.
  if (hardware?.__catalogoLojaSincronizado === true) {
    const ofertaLoja = hardware?.__ofertaLojaBuilder;
    return ofertaLoja && typeof ofertaLoja === "object" ? ofertaLoja : null;
  }

  const ofertasProduto = Array.isArray(hardware?.produto?.ofertas)
    ? hardware.produto.ofertas
    : [];
  const ofertasHardware = Array.isArray(hardware?.ofertas)
    ? hardware.ofertas
    : [];
  return escolherMelhorOfertaBuilder([...ofertasProduto, ...ofertasHardware]);
}

function extrairProdutosPublicos(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.produtos)) return payload.produtos;
  if (Array.isArray(payload?.itens)) return payload.itens;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function listarTodosProdutosPublicosParaBuilder() {
  const primeiraPagina = await requisitar("/api/produtos?pagina=1&limite=100");
  const produtos = [...extrairProdutosPublicos(primeiraPagina)];
  const totalPaginas = Math.max(1, Number(primeiraPagina?.totalPaginas) || 1);

  for (let pagina = 2; pagina <= totalPaginas; pagina += 1) {
    const resposta = await requisitar(`/api/produtos?pagina=${pagina}&limite=100`);
    produtos.push(...extrairProdutosPublicos(resposta));
  }

  return produtos;
}

function cruzarHardwareComCatalogoComercial(hardwaresResposta, produtos) {
  const hardwares = Array.isArray(hardwaresResposta)
    ? hardwaresResposta
    : Array.isArray(hardwaresResposta?.itens)
      ? hardwaresResposta.itens
      : Array.isArray(hardwaresResposta?.dados)
        ? hardwaresResposta.dados
        : [];

  const produtoPorHardware = new Map();
  const produtoPorId = new Map();

  (Array.isArray(produtos) ? produtos : []).forEach((produto) => {
    const hardwareId = produto?.hardware?.id
      ?? produto?.hardwareId
      ?? produto?.hardwareId3D
      ?? produto?.hardware?.hardwareId
      ?? produto?.produtoHardwareId;
    if (hardwareId !== undefined && hardwareId !== null) {
      produtoPorHardware.set(String(hardwareId), produto);
    }
    if (produto?.id !== undefined && produto?.id !== null) {
      produtoPorId.set(String(produto.id), produto);
    }
  });

  return hardwares.map((hardware) => {
    const produtoLoja = produtoPorHardware.get(String(hardware?.id))
      ?? produtoPorId.get(String(hardware?.produtoId ?? hardware?.produto?.id ?? ""));

    if (!produtoLoja) {
      return {
        ...hardware,
        __catalogoLojaSincronizado: true,
        __ofertaLojaBuilder: null,
      };
    }

    const melhorOferta = escolherMelhorOfertaBuilder([
      ...(produtoLoja?.melhorOferta ? [produtoLoja.melhorOferta] : []),
      ...(Array.isArray(produtoLoja?.ofertas) ? produtoLoja.ofertas : []),
      ...(Array.isArray(produtoLoja?.offers) ? produtoLoja.offers : []),
    ]);

    return {
      ...hardware,
      __catalogoLojaSincronizado: true,
      __ofertaLojaBuilder: melhorOferta,
      produto: {
        ...(hardware?.produto && typeof hardware.produto === "object" ? hardware.produto : {}),
        id: produtoLoja.id ?? hardware?.produto?.id,
        imagemUrl: produtoLoja.imagemUrl ?? hardware?.produto?.imagemUrl,
        imagemHoverUrl: produtoLoja.imagemHoverUrl ?? hardware?.produto?.imagemHoverUrl,
        ofertas: melhorOferta ? [melhorOferta] : [],
      },
    };
  });
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
  const preco = precoOfertaHardware(oferta);
  const modelos3D = Array.isArray(hardware?.modelos3D) ? hardware.modelos3D : [];
  const modelo3DAtivo = hardware?.modelo3DAtivo
    || hardware?.modelo3D
    || modelos3D.find((modelo) => modelo?.ativo !== false && modelo?.aprovado !== false)
    || modelos3D[0]
    || null;
  const modelo3dUrl = String(
    hardware?.modelo3dUrl
      || hardware?.modelo3DUrl
      || hardware?.model3dUrl
      || hardware?.urlModelo3d
      || hardware?.urlModelo3D
      || modelo3DAtivo?.arquivoUrl
      || modelo3DAtivo?.urlArquivo
      || modelo3DAtivo?.cdnUrl
      || modelo3DAtivo?.cloudflareUrl
      || modelo3DAtivo?.url
      || "",
  );
  const transform3D = modelo3DAtivo
    ? {
        posicao: [
          Number(modelo3DAtivo.posicaoCorrecaoX) || 0,
          Number(modelo3DAtivo.posicaoCorrecaoY) || 0,
          Number(modelo3DAtivo.posicaoCorrecaoZ) || 0,
        ],
        rotacao: [
          Number(modelo3DAtivo.rotacaoCorrecaoX) || 0,
          Number(modelo3DAtivo.rotacaoCorrecaoY) || 0,
          Number(modelo3DAtivo.rotacaoCorrecaoZ) || 0,
        ],
        escala: [
          Number(modelo3DAtivo.escalaCorrecaoX) || 1,
          Number(modelo3DAtivo.escalaCorrecaoY) || 1,
          Number(modelo3DAtivo.escalaCorrecaoZ) || 1,
        ],
        centralizarNoPonto: true,
      }
    : undefined;

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
    modelo3dUrl,
    modelo3D: modelo3dUrl,
    ...(transform3D ? { transform3D } : {}),
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

    // Cruza o catálogo técnico com /api/produtos, que é a mesma fonte usada
    // pela Loja. Assim preço e link do PC 3D deixam de divergir do Produto.
    try {
      const produtos = await listarTodosProdutosPublicosParaBuilder();
      return normalizarListaHardwaresParaBuilder(
        cruzarHardwareComCatalogoComercial(hardwares, produtos),
      );
    } catch (erroProdutos) {
      console.warn("Não foi possível sincronizar preços da Loja no montador; usando relação do Hardware.", erroProdutos);
      return normalizarListaHardwaresParaBuilder(hardwares);
    }
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
