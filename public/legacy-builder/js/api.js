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


const R2_PUBLIC_BASE_URL = "https://pub-f75dfbdc12814aea925f2615df4d32a5.r2.dev/";

function resolverUrlModelo3D(valor) {
  const url = String(valor ?? "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return new URL(url, window.location.origin).href;
  return `${R2_PUBLIC_BASE_URL}${url.replace(/^\/+/, "")}`;
}

const CATEGORIA_HARDWARE_PARA_BUILDER = Object.freeze({
  PROCESSADOR: "processador",
  COOLER: "cooler",
  COOLERS: "cooler",
  COOLER_CPU: "cooler",
  AIR_COOLER: "cooler",
  WATER_COOLER: "cooler",
  REFRIGERACAO: "cooler",
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

function extrairHardwaresPublicos(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.hardwares)) return payload.hardwares;
  if (Array.isArray(payload?.itens)) return payload.itens;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function extrairPaginacaoHardwaresPublicos(payload) {
  const meta = payload?.paginacao || payload?.pagination || payload?.meta || {};
  const itens = extrairHardwaresPublicos(payload);
  const limiteInformado = Number(
    payload?.limite
      ?? payload?.limit
      ?? payload?.porPagina
      ?? payload?.pageSize
      ?? meta?.limite
      ?? meta?.limit
      ?? meta?.perPage
      ?? meta?.pageSize
      ?? 0,
  );
  const limite = Number.isFinite(limiteInformado) && limiteInformado > 0
    ? Math.floor(limiteInformado)
    : itens.length;

  const totalItens = Number(
    payload?.total
      ?? payload?.totalItens
      ?? payload?.totalItems
      ?? payload?.totalRegistros
      ?? payload?.quantidadeTotal
      ?? meta?.total
      ?? meta?.totalItens
      ?? meta?.totalItems
      ?? meta?.totalRecords
      ?? 0,
  );

  const totalPaginasInformado = Number(
    payload?.totalPaginas
      ?? payload?.pages
      ?? payload?.pageCount
      ?? meta?.totalPaginas
      ?? meta?.pageCount
      ?? meta?.pages
      ?? 0,
  );

  const totalPaginasInferido = Number.isFinite(totalItens) && totalItens > 0 && limite > 0
    ? Math.ceil(totalItens / limite)
    : 0;
  const totalPaginas = totalPaginasInformado > 0 ? totalPaginasInformado : totalPaginasInferido;

  return {
    totalPaginas: Number.isFinite(totalPaginas) && totalPaginas > 1 ? Math.floor(totalPaginas) : 1,
    limite: Number.isFinite(limite) && limite > 0 ? Math.floor(limite) : 0,
    totalItens: Number.isFinite(totalItens) && totalItens > 0 ? Math.floor(totalItens) : 0,
    possuiPaginacaoDeclarada: Boolean(totalPaginasInformado > 1 || totalPaginasInferido > 1),
  };
}

function mesclarHardwaresPublicos(...listas) {
  const porId = new Map();
  listas.flat().filter(Boolean).forEach((item) => {
    const chave = String(item?.id ?? `${item?.categoria ?? ""}:${item?.nome ?? ""}:${item?.modelo ?? ""}`);
    const anterior = porId.get(chave);
    if (!anterior) {
      porId.set(chave, item);
      return;
    }

    // Dados comerciais vindos de Produto/Oferta devem complementar o Hardware,
    // nunca apagar nome, categoria, marca, modelo ou ficha técnica já existente.
    const produtoAnterior = anterior?.produto && typeof anterior.produto === "object" ? anterior.produto : {};
    const produtoNovo = item?.produto && typeof item.produto === "object" ? item.produto : {};
    const combinado = {
      ...anterior,
      ...item,
      id: item?.id ?? anterior?.id,
      nome: item?.nome || anterior?.nome || produtoNovo?.nome || produtoAnterior?.nome || "",
      categoria: item?.categoria || anterior?.categoria || "",
      marca: item?.marca || anterior?.marca || produtoNovo?.marca || produtoAnterior?.marca || "",
      modelo: item?.modelo || anterior?.modelo || produtoNovo?.modelo || produtoAnterior?.modelo || "",
      descricao: item?.descricao || anterior?.descricao || produtoNovo?.descricao || produtoAnterior?.descricao || "",
      imagemUrl: item?.imagemUrl || anterior?.imagemUrl || produtoNovo?.imagemUrl || produtoAnterior?.imagemUrl || "",
      produto: {
        ...produtoAnterior,
        ...produtoNovo,
        nome: produtoNovo?.nome || produtoAnterior?.nome || item?.nome || anterior?.nome || "",
      },
    };
    porId.set(chave, combinado);
  });
  return [...porId.values()];
}

async function listarTodosHardwaresPublicosParaBuilder() {
  // A rota sem parâmetros é a fonte estável do montador. Não força limite=100,
  // pois algumas versões do backend rejeitam esse limite.
  const primeiraPagina = await requisitar("/api/hardwares");
  let hardwares = [...extrairHardwaresPublicos(primeiraPagina)];
  const paginacao = extrairPaginacaoHardwaresPublicos(primeiraPagina);

  if (paginacao.possuiPaginacaoDeclarada) {
    // Quando total/totalPaginas existe, percorre exatamente as páginas declaradas.
    for (let pagina = 2; pagina <= paginacao.totalPaginas; pagina += 1) {
      try {
        const resposta = await requisitar(`/api/hardwares?pagina=${pagina}`);
        hardwares = mesclarHardwaresPublicos(hardwares, extrairHardwaresPublicos(resposta));
      } catch {
        break;
      }
    }
  }
  // Não faz paginação especulativa quando a API não declara paginação.
  // A API pública atual rejeita `?pagina=2` nesse formato com HTTP 400.

  // Aceita tanto o contrato novo (COOLER) quanto dados antigos/filtros que ainda
  // respondam por COOLERS. Falhas nesses filtros não derrubam o catálogo geral.
  const consultasCooler = await Promise.allSettled([
    requisitar("/api/hardwares?categoria=COOLER"),
  ]);
  consultasCooler.forEach((resultado) => {
    if (resultado.status === "fulfilled") {
      hardwares = mesclarHardwaresPublicos(hardwares, extrairHardwaresPublicos(resultado.value));
    }
  });

  return hardwares;
}

function obterProdutoPublicoInterno(produto) {
  return produto?.produto && typeof produto.produto === "object" && !Array.isArray(produto.produto)
    ? produto.produto
    : produto;
}

function obterNomeProdutoPublico(produto) {
  const interno = obterProdutoPublicoInterno(produto);
  return produto?.nome
    || produto?.name
    || interno?.nome
    || interno?.name
    || [produto?.marca || interno?.marca, produto?.modelo || interno?.modelo].filter(Boolean).join(" ")
    || "";
}

function obterHardwareIdProdutoPublico(produto) {
  const interno = obterProdutoPublicoInterno(produto);
  return produto?.hardware?.id
    ?? interno?.hardware?.id
    ?? produto?.hardwareId
    ?? interno?.hardwareId
    ?? produto?.hardwareId3D
    ?? interno?.hardwareId3D
    ?? produto?.produtoHardwareId
    ?? interno?.produtoHardwareId
    ?? null;
}

function extrairHardwareDoProdutoPublico(produto) {
  const candidatos = [
    produto?.hardware,
    produto?.produto?.hardware,
    produto?.item?.hardware,
    produto?.data?.hardware,
  ];
  return candidatos.find((item) => item && typeof item === "object" && !Array.isArray(item)) || null;
}

async function complementarHardwaresComProdutosPublicos(hardwares, produtos) {
  const idsOriginais = new Set((Array.isArray(hardwares) ? hardwares : []).map((item) => String(item?.id ?? "")));
  const embutidos = (Array.isArray(produtos) ? produtos : [])
    .map((produto) => {
      const hardware = extrairHardwareDoProdutoPublico(produto);
      if (!hardware?.id) return null;
      return {
        ...hardware,
        produto: {
          ...(hardware?.produto && typeof hardware.produto === "object" ? hardware.produto : {}),
          id: produto?.id ?? produto?.produto?.id ?? hardware?.produto?.id,
          nome: obterNomeProdutoPublico(produto) || hardware?.produto?.nome || hardware?.nome || "",
          descricao: produto?.descricao ?? produto?.produto?.descricao ?? hardware?.produto?.descricao ?? "",
          imagemUrl: produto?.imagemUrl ?? produto?.produto?.imagemUrl ?? hardware?.produto?.imagemUrl ?? "",
          imagemHoverUrl: produto?.imagemHoverUrl ?? produto?.produto?.imagemHoverUrl ?? hardware?.produto?.imagemHoverUrl ?? "",
          ofertas: produto?.ofertas ?? produto?.produto?.ofertas ?? hardware?.produto?.ofertas ?? [],
        },
      };
    })
    .filter(Boolean);

  let resultado = mesclarHardwaresPublicos(hardwares, embutidos);

  // Não consulta `/api/hardwares/:id` para completar dados: essa rota pública
  // não existe na API atual. O Hardware da listagem e o Produto relacionado já
  // são suficientes para nome, imagem, preço e ficha disponível no Builder.

  return resultado;
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
    const hardwareId = obterHardwareIdProdutoPublico(produto);
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
        nome: obterNomeProdutoPublico(produtoLoja) || hardware?.produto?.nome || hardware?.nome || "",
        marca: produtoLoja.marca || hardware?.produto?.marca,
        modelo: produtoLoja.modelo || hardware?.produto?.modelo,
        descricao: produtoLoja.descricao || hardware?.produto?.descricao || '',
        imagemUrl: produtoLoja.imagemUrl || hardware?.produto?.imagemUrl || '',
        imagemHoverUrl: produtoLoja.imagemHoverUrl || hardware?.produto?.imagemHoverUrl || '',
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

function resolverCategoriaHardwareParaBuilder(hardware) {
  const categoriaOrigem = hardware?.categoria ?? hardware?.categoriaHardware ?? hardware?.category ?? "";
  const categoriaValor = categoriaOrigem && typeof categoriaOrigem === "object"
    ? categoriaOrigem.codigo ?? categoriaOrigem.code ?? categoriaOrigem.nome ?? categoriaOrigem.name ?? categoriaOrigem.slug ?? ""
    : categoriaOrigem;
  const categoriaBruta = String(categoriaValor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const categoriaDireta = CATEGORIA_HARDWARE_PARA_BUILDER[categoriaBruta];
  if (categoriaDireta) return categoriaDireta;

  // Fallback defensivo: alguns payloads públicos podem vir sem `categoria`,
  // mas ainda trazem a ficha técnica especializada. Isso evita esconder, em
  // especial, Coolers cadastrados corretamente no catálogo técnico.
  if (hardware?.especificacaoCooler) return "cooler";
  if (hardware?.especificacaoProcessador) return "processador";
  if (hardware?.especificacaoPlacaMae) return "placa-mae";
  if (hardware?.especificacaoMemoriaRam) return "memoria";
  if (hardware?.especificacaoPlacaVideo) return "placa-video";
  if (hardware?.especificacaoArmazenamento) return "armazenamento";
  if (hardware?.especificacaoFonte) return "fonte";
  if (hardware?.especificacaoGabinete) return "gabinete";
  if (hardware?.especificacaoVentoinha) return "ventoinha";

  return null;
}

function normalizarHardwareParaBuilder(hardware) {
  const categoria = resolverCategoriaHardwareParaBuilder(hardware);
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
  const modelo3dUrl = resolverUrlModelo3D(
    hardware?.modelo3dUrl
      || hardware?.modelo3DUrl
      || hardware?.model3dUrl
      || hardware?.urlModelo3d
      || hardware?.urlModelo3D
      || (typeof hardware?.modelo3D === "string" ? hardware.modelo3D : "")
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
          Number.isFinite(Number(modelo3DAtivo.escalaCorrecaoX)) ? Number(modelo3DAtivo.escalaCorrecaoX) : 1,
          Number.isFinite(Number(modelo3DAtivo.escalaCorrecaoY)) ? Number(modelo3DAtivo.escalaCorrecaoY) : 1,
          Number.isFinite(Number(modelo3DAtivo.escalaCorrecaoZ)) ? Number(modelo3DAtivo.escalaCorrecaoZ) : 1,
        ],
        dimensoesReaisMm: {
          altura: Number(modelo3DAtivo.alturaRealMm) || 0,
          largura: Number(modelo3DAtivo.larguraRealMm) || 0,
          profundidade: Number(modelo3DAtivo.profundidadeRealMm) || 0,
        },
        centralizarNoPonto: true,
      }
    : undefined;

  return {
    id: String(hardware.id),
    hardwareId: Number(hardware.id),
    origem: "CATALOGO",
    categoria,
    categoriaHardware: hardware.categoria,
    nome: hardware.nome
      || hardware.name
      || hardware?.produto?.nome
      || hardware?.produto?.name
      || hardware?.produto?.produto?.nome
      || [hardware.marca, hardware.modelo].filter(Boolean).join(" ")
      || `Hardware #${hardware.id}`,
    marca: hardware.marca || "",
    modelo: hardware.modelo || "",
    descricao: hardware.descricao || hardware?.produto?.descricao || "",
    imagem: hardware.imagemUrl || hardware?.produto?.imagemUrl || hardware?.produto?.imagemHoverUrl || "",
    imagemUrl: hardware.imagemUrl || hardware?.produto?.imagemUrl || hardware?.produto?.imagemHoverUrl || "",
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
      credentials: "include",
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

const cacheModelo3DHardwarePublico = new Map();

function extrairModelos3DPublicos(payload) {
  if (Array.isArray(payload)) return payload;

  const listas = [
    payload?.modelos,
    payload?.modelos3D,
    payload?.itens,
    payload?.dados,
    payload?.hardware?.modelos3D,
    payload?.item?.modelos3D,
    payload?.dado?.modelos3D,
    payload?.data?.modelos3D,
  ];
  const lista = listas.find(Array.isArray);
  if (lista) return lista;

  const unicos = [
    payload?.modelo3DAtivo,
    payload?.modelo3D,
    payload?.hardware?.modelo3DAtivo,
    payload?.hardware?.modelo3D,
    payload?.item?.modelo3DAtivo,
    payload?.item?.modelo3D,
    payload?.dado?.modelo3DAtivo,
    payload?.dado?.modelo3D,
  ].filter((item) => item && typeof item === "object" && !Array.isArray(item));

  return unicos;
}

function normalizarModelo3DPublico(modelo) {
  if (!modelo || typeof modelo !== "object") return null;
  const modelo3dUrl = resolverUrlModelo3D(
    modelo.arquivoUrl
      || modelo.urlArquivo
      || modelo.cdnUrl
      || modelo.cloudflareUrl
      || modelo.url
      || "",
  );
  if (!modelo3dUrl) return null;

  return {
    modelo3dUrl,
    modelo3D: modelo3dUrl,
    transform3D: {
      posicao: [
        Number(modelo.posicaoCorrecaoX) || 0,
        Number(modelo.posicaoCorrecaoY) || 0,
        Number(modelo.posicaoCorrecaoZ) || 0,
      ],
      rotacao: [
        Number(modelo.rotacaoCorrecaoX) || 0,
        Number(modelo.rotacaoCorrecaoY) || 0,
        Number(modelo.rotacaoCorrecaoZ) || 0,
      ],
      escala: [
        Number.isFinite(Number(modelo.escalaCorrecaoX)) ? Number(modelo.escalaCorrecaoX) : 1,
        Number.isFinite(Number(modelo.escalaCorrecaoY)) ? Number(modelo.escalaCorrecaoY) : 1,
        Number.isFinite(Number(modelo.escalaCorrecaoZ)) ? Number(modelo.escalaCorrecaoZ) : 1,
      ],
      dimensoesReaisMm: {
        altura: Number(modelo.alturaRealMm) || 0,
        largura: Number(modelo.larguraRealMm) || 0,
        profundidade: Number(modelo.profundidadeRealMm) || 0,
      },
      centralizarNoPonto: true,
    },
    modelo,
  };
}

async function obterModelo3DHardwarePublico(hardwareId) {
  const id = Number(hardwareId);
  if (!Number.isInteger(id) || id <= 0) return null;

  if (!cacheModelo3DHardwarePublico.has(id)) {
    cacheModelo3DHardwarePublico.set(id, (async () => {
      const escolherModelo = (payload) => {
        const modelos = extrairModelos3DPublicos(payload);
        const modelo = modelos.find((item) => item?.ativo !== false && item?.aprovado !== false)
          || modelos.find((item) => item?.ativo !== false)
          || modelos[0]
          || null;
        return normalizarModelo3DPublico(modelo);
      };

      // Algumas versões da API expõem uma rota dedicada; outras incluem o
      // modelo aprovado no detalhe do Hardware. Tentar as duas evita que CPU,
      // RAM, placa-mãe, SSD, fonte e fans dependam do formato da listagem geral.
      try {
        const payload = await requisitar(`/api/hardwares/${id}/modelos-3d`);
        const normalizado = escolherModelo(payload);
        if (normalizado) return normalizado;
      } catch {
        // Continua pelo detalhe público do Hardware.
      }

      // A API pública atual não expõe `/api/hardwares/:id`. Se a rota dedicada
      // de modelos não retornar um GLB, o Builder mantém o modelo já embutido
      // na listagem do Hardware e não gera uma sequência de 404 no Console.
      return null;
    })());
  }

  return cacheModelo3DHardwarePublico.get(id);
}

export const api = Object.freeze({
  get modo() {
    return configuracao.modo;
  },

  configurar(novaConfiguracao = {}) {
    Object.assign(configuracao, novaConfiguracao);
  },

  requisitar,

  obterModelo3DHardware(hardwareId) {
    if (configuracao.modo === "local") return Promise.resolve(null);
    return obterModelo3DHardwarePublico(hardwareId);
  },

  async listarPecas() {
    if (configuracao.modo === "local") {
      return obterJsonLocal(new URL("../pecas.json", import.meta.url).href);
    }

    const hardwaresComCoolers = await listarTodosHardwaresPublicosParaBuilder();

    // Cruza o catálogo técnico com /api/produtos, que é a mesma fonte usada
    // pela Loja. Assim preço e link do PC 3D deixam de divergir do Produto.
    try {
      const produtos = await listarTodosProdutosPublicosParaBuilder();
      const hardwaresComProdutos = await complementarHardwaresComProdutosPublicos(hardwaresComCoolers, produtos);
      return normalizarListaHardwaresParaBuilder(
        cruzarHardwareComCatalogoComercial(hardwaresComProdutos, produtos),
      );
    } catch (erroProdutos) {
      console.warn("Não foi possível sincronizar preços da Loja no montador; usando relação do Hardware.", erroProdutos);
      return normalizarListaHardwaresParaBuilder(hardwaresComCoolers);
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
