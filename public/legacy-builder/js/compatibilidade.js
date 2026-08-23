import { calcularConsumoMontagem } from "./montador/calculos.js";

// =======================================================
// DIAGNÓSTICO E COMPATIBILIDADE DO PC BUILDER
// O painel visual só recebe incompatibilidades e alertas reais.
// =======================================================

function escaparHtml(valor = "") {
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function criarLog(tipo, icone, titulo, mensagem) {
    return `
        <article class="diagnostico-item diagnostico-${tipo}">
            <span class="diagnostico-icone" aria-hidden="true">${icone}</span>
            <div>
                <strong>${escaparHtml(titulo)}</strong>
                <p>${escaparHtml(mensagem)}</p>
            </div>
        </article>
    `;
}

function criarResultadoBase() {
    return {
        temPecas: false,
        temErros: false,
        temAlertas: false,
        sistemaCompleto: false,
        podeFinalizar: false,
        erros: [],
        alertas: [],
        informacoes: [],
        faltando: [],
        consumoTotal: 0,
        fansIn: 0,
        fansOut: 0
    };
}

function normalizar(valor = "") {
    return String(valor).trim().toLowerCase();
}

function renderizarProblemas(conteudoLogs, erros, alertas, faltando = []) {
    if (!conteudoLogs) return;

    if (erros.length === 0 && alertas.length === 0 && faltando.length === 0) {
        conteudoLogs.innerHTML = "";
        return;
    }

    const informacoes = faltando.length > 0
        ? [criarLog(
            "info",
            "i",
            "Montagem incompleta",
            `Ainda faltam: ${faltando.join(", ")}.`
        )]
        : [];

    conteudoLogs.innerHTML = [
        ...informacoes,
        ...erros.map((mensagem) =>
            criarLog("erro", "✕", "Incompatível", mensagem)
        ),
        ...alertas.map((mensagem) =>
            criarLog("alerta", "!", "Atenção", mensagem)
        )
    ].join("");
}

export function verificarCompatibilidade(estadoMontagem, opcoes = {}) {
    const deveRenderizar = opcoes.renderizar !== false;
    const conteudoLogs = document.getElementById("conteudo-logs");
    const resultado = criarResultadoBase();

    if (!estadoMontagem) {
        if (deveRenderizar) renderizarProblemas(conteudoLogs, [], [], []);
        return resultado;
    }

    const gabinete = estadoMontagem.gabinete;
    const placaMae = estadoMontagem.placamae;
    const processador = estadoMontagem.processador;
    const gpu = estadoMontagem.placavideo;
    const fonte = estadoMontagem.fonte;
    const cooler = estadoMontagem.cooler;

    const memorias = (Array.isArray(estadoMontagem.memoria)
        ? estadoMontagem.memoria
        : []).filter(Boolean);

    const armazenamentos = (Array.isArray(estadoMontagem.armazenamento)
        ? estadoMontagem.armazenamento
        : []).filter(Boolean);

    const slotsVentoinhas = Array.isArray(estadoMontagem.ventoinhas)
        ? estadoMontagem.ventoinhas
        : [];

    const ventoinhas = slotsVentoinhas.filter(Boolean);
    const todasPecas = Object.values(estadoMontagem).flat().filter(Boolean);

    resultado.temPecas = todasPecas.length > 0;

    if (!resultado.temPecas) {
        if (deveRenderizar) renderizarProblemas(conteudoLogs, [], [], []);
        return resultado;
    }

    const erros = [];
    const alertas = [];

    // Gabinete, placa-mãe e GPU.
    const formatoGabinete = normalizar(gabinete?.formato);
    const formatoPlaca = normalizar(placaMae?.formato);

    if (gabinete && placaMae) {
        if (
            formatoGabinete === "compacto" &&
            ["atx", "eatx"].includes(formatoPlaca)
        ) {
            erros.push(`Placa-mãe ${formatoPlaca.toUpperCase()} não cabe no gabinete compacto.`);
        }

        if (formatoGabinete === "mid-tower" && formatoPlaca === "eatx") {
            erros.push("Gabinete Mid-Tower não comporta placa-mãe E-ATX.");
        }
    }

    if (
        gabinete &&
        gpu &&
        formatoGabinete === "compacto" &&
        Number(gpu.comprimentoMm) > 300
    ) {
        erros.push("A placa de vídeo é longa demais para o gabinete compacto.");
    }

    // Soquete.
    if (placaMae && processador) {
        const socketPlaca = normalizar(placaMae.soquete);
        const socketCpu = normalizar(processador.soquete);

        if (socketPlaca && socketCpu && socketPlaca !== socketCpu) {
            erros.push(
                `CPU ${socketCpu.toUpperCase()} e placa-mãe ${socketPlaca.toUpperCase()} usam soquetes diferentes.`
            );
        }
    }

    // Memória RAM.
    if (placaMae && memorias.length > 0) {
        const tipoRamPlaca = normalizar(placaMae.tipoRam);
        const tiposRam = [
            ...new Set(
                memorias
                    .map((ram) => normalizar(ram.tipoRam))
                    .filter(Boolean)
            )
        ];

        if (tiposRam.length > 1) {
            erros.push("Não misture memórias DDR4 e DDR5.");
        }

        if (tipoRamPlaca && tiposRam.some((tipo) => tipo !== tipoRamPlaca)) {
            erros.push(`A placa-mãe exige memória ${tipoRamPlaca.toUpperCase()}.`);
        }
    }

    if (memorias.length === 1) {
        alertas.push("Use dois módulos compatíveis para aproveitar Dual Channel.");
    } else if (memorias.length === 2) {
        const slotsAlternados = Boolean(
            estadoMontagem.memoria?.[1] && estadoMontagem.memoria?.[3]
        );

        if (!slotsAlternados) {
            alertas.push("Para Dual Channel, prefira os slots RAM 2 e 4.");
        }
    }

    const frequencias = memorias
        .map((ram) => Number(ram.frequencia))
        .filter(Number.isFinite);

    if (
        frequencias.length > 1 &&
        Math.min(...frequencias) !== Math.max(...frequencias)
    ) {
        alertas.push(`Memórias diferentes operarão perto de ${Math.min(...frequencias)} MHz.`);
    }

    // Energia. Fonte ausente entra em "faltando", não abre diagnóstico sozinha.
    const consumoTotal = calcularConsumoMontagem(estadoMontagem);

    const potenciaFonte = Number(fonte?.watts) || 0;

    if (fonte && consumoTotal > 0) {
        if (potenciaFonte < consumoTotal) {
            erros.push(`Fonte de ${potenciaFonte} W é menor que o consumo estimado de ${consumoTotal} W.`);
        } else if (potenciaFonte < consumoTotal * 1.2) {
            alertas.push(`Fonte próxima do limite: ${potenciaFonte} W para cerca de ${consumoTotal} W.`);
        }
    }

    // Componentes mínimos para finalizar e ligar. O gabinete é opcional: o
    // usuário pode validar a configuração antes de escolher um case.
    // Processadores com cooler incluso também satisfazem a refrigeração mínima.
    const faltando = [];
    const coolerInclusoProcessador = Boolean(
        processador?.coolerIncluso === true ||
        processador?.especificacoes?.coolerIncluso === true
    );
    const possuiRefrigeracaoCpu = Boolean(cooler) || coolerInclusoProcessador;

    if (!placaMae) faltando.push("placa-mãe");
    if (!processador) faltando.push("processador");
    if (!possuiRefrigeracaoCpu) faltando.push("cooler");
    if (memorias.length === 0) faltando.push("memória RAM");
    if (!fonte) faltando.push("fonte");
    if (armazenamentos.length === 0) faltando.push("armazenamento");

    // Fluxo de ar. Só avalia quando já existe ventoinha ou a build mínima está completa.
    const fansIn = ventoinhas.filter((fan) => fan.fluxo === "in").length;
    const fansOut = ventoinhas.filter((fan) => fan.fluxo === "out").length;
    const fanTraseira = slotsVentoinhas[0] ?? null;
    const fansFrontais = slotsVentoinhas.slice(1);

    if (fanTraseira?.fluxo === "in") {
        alertas.push("Ventoinha traseira costuma funcionar melhor como saída.");
    }

    if (fansFrontais.some((fan) => fan?.fluxo === "out")) {
        alertas.push("Ventoinhas frontais costumam funcionar melhor como entrada.");
    }

    if (ventoinhas.length > 0) {
        if (fansIn > 0 && fansOut === 0) {
            alertas.push("Há entrada de ar, mas falta uma ventoinha de saída.");
        } else if (fansOut > 0 && fansIn === 0) {
            alertas.push("Há saída de ar, mas falta uma ventoinha de entrada.");
        } else if (fansOut > fansIn) {
            alertas.push("Fluxo com pressão negativa pode puxar mais poeira.");
        }
    } else if (faltando.length === 0) {
        alertas.push("Adicione ventoinhas para melhorar o fluxo de ar.");
    }

    resultado.temErros = erros.length > 0;
    resultado.temAlertas = alertas.length > 0;
    resultado.sistemaCompleto = faltando.length === 0;
    resultado.podeFinalizar = resultado.sistemaCompleto && !resultado.temErros;
    resultado.erros = erros;
    resultado.alertas = alertas;
    resultado.faltando = faltando;
    resultado.informacoes = faltando.length > 0
        ? [`Ainda faltam: ${faltando.join(", ")}.`]
        : [];
    resultado.consumoTotal = consumoTotal;
    resultado.fansIn = fansIn;
    resultado.fansOut = fansOut;

    if (deveRenderizar) renderizarProblemas(conteudoLogs, erros, alertas, faltando);
    return resultado;
}
