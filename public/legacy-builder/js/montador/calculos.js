const CONSUMO_PADRAO_POR_CATEGORIA = Object.freeze({
  gabinete: 0,
  placamae: 40,
  processador: 65,
  cooler: 4,
  memoria: 4,
  placavideo: 150,
  armazenamento: 5,
  ventoinhas: 3,
});

const CAMPOS_CONSUMO = [
  "watts",
  "consumoWatts",
  "consumo_watts",
  "tdp",
  "tgp",
  "tbp",
  "consumo",
  "potenciaConsumo",
];

function numeroPositivo(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const encontrado = String(valor ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const numero = encontrado ? Number(encontrado[0]) : 0;
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

export function obterConsumoPeca(peca, categoria = "") {
  if (!peca) return 0;

  for (const campo of CAMPOS_CONSUMO) {
    const consumo = numeroPositivo(peca?.[campo]);
    if (consumo > 0) return consumo;
  }

  const especificacoes = peca?.especificacoes;
  if (especificacoes && typeof especificacoes === "object") {
    for (const campo of CAMPOS_CONSUMO) {
      const consumo = numeroPositivo(especificacoes?.[campo]);
      if (consumo > 0) return consumo;
    }
  }

  return CONSUMO_PADRAO_POR_CATEGORIA[categoria] ?? 0;
}

export function calcularConsumoMontagem(estadoMontagem = {}) {
  const total = Object.entries(estadoMontagem).reduce((acumulado, [categoria, estado]) => {
    if (categoria === "fonte") return acumulado;
    const pecas = Array.isArray(estado) ? estado : [estado];
    return acumulado + pecas.reduce(
      (soma, peca) => soma + obterConsumoPeca(peca, categoria),
      0,
    );
  }, 0);

  return Math.round(total);
}

export function calcularFonteRecomendada(consumoTotal) {
  if (consumoTotal <= 0) return 0;
  return Math.max(450, Math.ceil((consumoTotal * 1.3) / 50) * 50);
}

export function obterResumoFluxoAr(fansIn, fansOut) {
  const total = fansIn + fansOut;

  if (total === 0) {
    return {
      tipo: "alerta",
      titulo: "Sem ventoinhas instaladas",
      mensagem: "Adicione entrada e saída de ar para evitar acúmulo de calor.",
    };
  }

  if (fansIn > 0 && fansOut === 0) {
    return {
      tipo: "alerta",
      titulo: `${fansIn} entrada / 0 saída`,
      mensagem: "Existe entrada de ar, mas nenhuma exaustão para remover o ar quente.",
    };
  }

  if (fansOut > 0 && fansIn === 0) {
    return {
      tipo: "alerta",
      titulo: `0 entrada / ${fansOut} saída`,
      mensagem: "A pressão negativa pode puxar poeira pelas frestas do gabinete.",
    };
  }

  if (fansIn > fansOut) {
    return {
      tipo: "sucesso",
      titulo: `Pressão positiva: ${fansIn} entrada / ${fansOut} saída`,
      mensagem: "Boa configuração para reduzir poeira quando as entradas possuem filtro.",
    };
  }

  if (fansOut > fansIn) {
    return {
      tipo: "alerta",
      titulo: `Pressão negativa: ${fansIn} entrada / ${fansOut} saída`,
      mensagem: "O calor é removido, mas pode haver maior entrada de poeira.",
    };
  }

  return {
    tipo: "sucesso",
    titulo: `Fluxo equilibrado: ${fansIn} entrada / ${fansOut} saída`,
    mensagem: "Entrada e exaustão estão equilibradas para uma configuração inicial.",
  };
}
