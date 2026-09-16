// ==========================================================================
// RENDERER 3D — PC BUILDER
// ==========================================================================

if (typeof THREE === "undefined") {
    throw new Error(
        "Three.js não foi carregado. Verifique a ordem dos scripts no HTML."
    );
}

if (typeof THREE.OrbitControls === "undefined") {
    throw new Error(
        "OrbitControls não foi carregado. Verifique o script no HTML."
    );
}

// ==========================================================================
// 1. CENA
// ==========================================================================

const cena = new THREE.Scene();
cena.background = new THREE.Color(0xeef2f7);

// ==========================================================================
// 2. CÂMERA
// ==========================================================================

const camera = new THREE.PerspectiveCamera(
    55,
    1,
    0.1,
    1000
);

camera.position.set(7, 5, 8);

// ==========================================================================
// 3. RENDERIZADOR
// ==========================================================================

const renderizador = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
});

const ambienteMobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
let qualidade3DPreferida = null;
try {
    qualidade3DPreferida = localStorage.getItem("criaByteQualidade3D");
} catch {
    qualidade3DPreferida = null;
}
let qualidade3DAtual = qualidade3DPreferida === "alta" || qualidade3DPreferida === "baixa"
    ? qualidade3DPreferida
    : (ambienteMobile ? "baixa" : "alta");

renderizador.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, qualidade3DAtual === "baixa" ? 1 : 2)
);

// 💡 Correção de cor sRGB: Faz os modelos .glb exibirem as cores reais e vivas
if ('outputColorSpace' in renderizador) {
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
} else {
    renderizador.outputEncoding = THREE.sRGBEncoding;
}

// O tamanho correto será definido pelo pcbuildscript.js
renderizador.setSize(1, 1, false);

renderizador.shadowMap.enabled = qualidade3DAtual !== "baixa";
renderizador.shadowMap.type = THREE.PCFSoftShadowMap;

function definirQualidade3D(nivel = "alta") {
    qualidade3DAtual = nivel === "baixa" ? "baixa" : "alta";
    const baixa = qualidade3DAtual === "baixa";
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, baixa ? 1 : 2));
    renderizador.shadowMap.enabled = !baixa;
    renderizador.domElement.dataset.qualidade3d = qualidade3DAtual;

    try {
        localStorage.setItem("criaByteQualidade3D", qualidade3DAtual);
    } catch {
        // A preferência é opcional; o 3D continua funcionando sem armazenamento local.
    }

    return qualidade3DAtual;
}

function alternarQualidade3D() {
    return definirQualidade3D(qualidade3DAtual === "alta" ? "baixa" : "alta");
}

function obterQualidade3D() {
    return qualidade3DAtual;
}

renderizador.domElement.dataset.qualidade3d = qualidade3DAtual;
renderizador.domElement.style.display = "block";
renderizador.domElement.style.width = "100%";
renderizador.domElement.style.height = "100%";

// ==========================================================================
// 4. CONTROLES DA CÂMERA
// ==========================================================================


const controles = new THREE.OrbitControls(
    camera,
    renderizador.domElement
);

controles.enableDamping = true;
controles.dampingFactor = 0.06;

controles.autoRotate = false;
controles.autoRotateSpeed = 2;

controles.enablePan = true;
controles.enableZoom = true;
controles.enableRotate = true;

controles.minDistance = 4;
controles.maxDistance = 18;

controles.target.set(0, 2.3, 0);
controles.update();


// O botão de rotação é configurado pelo pcbuildscript.js.

// ==========================================================================
// 5. ILUMINAÇÃO (Ajustada para clarear os modelos GLB)
// ==========================================================================

const luzAmbiente = new THREE.AmbientLight(
    0xffffff,
    2.2 // Aumentado para clarear globalmente todas as faces
);
cena.add(luzAmbiente);

// Luz Hemisférica para simular reflexos suaves de cima e tirar sombras escuras
const luzHemisferio = new THREE.HemisphereLight(
    0xffffff,
    0x444444,
    1.0
);
luzHemisferio.position.set(0, 10, 0);
cena.add(luzHemisferio);

const luzPrincipal = new THREE.DirectionalLight(
    0xffffff,
    1.5 // Luz principal reforçada
);

luzPrincipal.position.set(6, 9, 7);
luzPrincipal.castShadow = true;

cena.add(luzPrincipal);

const luzPreenchimento = new THREE.DirectionalLight(
    0xbfd7ff,
    0.8 // Preenchimento lateral mais forte
);

luzPreenchimento.position.set(-6, 5, -4);

cena.add(luzPreenchimento);

const luzAlerta = new THREE.PointLight(
    0xff3344,
    0,
    12
);

luzAlerta.position.set(2, 3, 2);

cena.add(luzAlerta);

// Luz extra de contra-luz / inferior para iluminar os ângulos traseiros e de baixo
const luzFundo = new THREE.DirectionalLight(
    0xffffff,
    0.9 // Intensidade para clarear os cantos que ficavam escuros
);

luzFundo.position.set(-6, -4, -6);
cena.add(luzFundo);

// ==========================================================================
// 6. GERENCIADOR DE CARREGAMENTO
// ==========================================================================

const gerenciador = new THREE.LoadingManager();

const telaCarregamento =
    document.getElementById("tela-carregamento");

const barraProgresso =
    document.getElementById("barra-progresso");

const textoCarregamento =
    document.getElementById("texto-carregamento-3d");

gerenciador.onStart = (url, itensCarregados, itensTotal) => {
    if (telaCarregamento) {
        telaCarregamento.hidden = false;
        telaCarregamento.style.display = "grid";
        telaCarregamento.style.opacity = "1";
    }

    if (barraProgresso) {
        const porcentagem = itensTotal > 0
            ? (itensCarregados / itensTotal) * 100
            : 8;
        barraProgresso.style.width = `${Math.max(8, porcentagem)}%`;
    }

    if (textoCarregamento) {
        textoCarregamento.textContent = "Carregando modelo 3D...";
    }
};

gerenciador.onProgress = (
    url,
    itensCarregados,
    itensTotal
) => {
    if (!barraProgresso || itensTotal <= 0) return;

    const porcentagem =
        (itensCarregados / itensTotal) * 100;

    barraProgresso.style.width =
        `${porcentagem}%`;
};

gerenciador.onLoad = () => {
    if (!telaCarregamento) return;

    telaCarregamento.style.opacity = "0";

    window.setTimeout(() => {
        telaCarregamento.style.display = "none";
        telaCarregamento.hidden = true;
        if (barraProgresso) barraProgresso.style.width = "0%";
    }, 350);
};

gerenciador.onError = (url) => {
    console.error(
        `Erro ao carregar o recurso 3D: ${url}`
    );

    if (textoCarregamento) {
        textoCarregamento.textContent = "Não foi possível carregar este modelo 3D.";
    }
};

THREE.Cache.enabled = true;

const carregador =
    typeof THREE.GLTFLoader === "function"
        ? new THREE.GLTFLoader(gerenciador)
        : null;

if (!carregador) {
    console.info(
        "GLTFLoader ainda não foi carregado. A maquete 3D continuará funcionando."
    );
}

const cacheModelos3D = new Map();

function clonarCenaGltf(gltf) {
    return {
        ...gltf,
        scene: gltf.scene.clone(true)
    };
}

/**
 * Carrega cada GLB uma única vez e devolve uma cópia da cena.
 * Quando o backend/CDN entrar, apenas a URL de origem precisará mudar.
 */
function carregarModelo3D(url) {
    if (!carregador) {
        return Promise.reject(new Error("GLTFLoader indisponível."));
    }

    if (!cacheModelos3D.has(url)) {
        cacheModelos3D.set(
            url,
            new Promise((resolve, reject) => {
                carregador.load(url, resolve, undefined, reject);
            }).catch((erro) => {
                cacheModelos3D.delete(url);
                throw erro;
            })
        );
    }

    return cacheModelos3D.get(url).then(clonarCenaGltf);
}

// ==========================================================================
// 7. CORREÇÕES DE ENCAIXE/ORIENTAÇÃO DA MONTAGEM
// ==========================================================================

const NOME_AIO_TETO_CORRIGIDO = "correcao-water-cooler-teto";
let snapshotMontagem3D = null;
let timersCorrecaoMontagem3D = [];

function limitarLayout3D(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
}

function textoPecaLayout3D(peca) {
    return [peca?.nome, peca?.marca, peca?.modelo, peca?.especificacoes?.tipo]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function obterPecaSnapshot(categoria) {
    const valor = snapshotMontagem3D?.configuracao?.[categoria];
    if (Array.isArray(valor)) return valor.find(Boolean) ?? null;
    return valor ?? null;
}

function mmParaLayout3D(valor, fallbackMm, minimo, maximo) {
    const numero = Number(valor);
    const unidade = Number.isFinite(numero) && numero > 0
        ? numero * 0.01
        : fallbackMm * 0.01;
    return limitarLayout3D(unidade, minimo, maximo);
}

function obterDimensoesGabineteSnapshot() {
    const gabinete = obterPecaSnapshot("gabinete");
    const specs = gabinete?.especificacoes && typeof gabinete.especificacoes === "object"
        ? gabinete.especificacoes
        : {};
    const texto = textoPecaLayout3D(gabinete);
    const ehFractalNorth = /fractal.*north|north.*fractal/.test(texto);

    const fallback = ehFractalNorth
        ? { largura: 215, altura: 469, profundidade: 447 }
        : { largura: 240, altura: 460, profundidade: 450 };

    return {
        largura: mmParaLayout3D(specs.larguraMm ?? gabinete?.larguraMm, fallback.largura, 1.5, 4.5),
        altura: mmParaLayout3D(specs.alturaMm ?? gabinete?.alturaMm, fallback.altura, 2.4, 7.2),
        profundidade: mmParaLayout3D(specs.profundidadeMm ?? gabinete?.profundidadeMm, fallback.profundidade, 2.5, 7.6),
        ehFractalNorth,
    };
}

function ehWaterCoolerSnapshot() {
    const cooler = obterPecaSnapshot("cooler");
    if (!cooler) return false;
    const specs = cooler.especificacoes && typeof cooler.especificacoes === "object"
        ? cooler.especificacoes
        : {};
    return /water|aio|liquid|radiador/.test(textoPecaLayout3D(cooler))
        || Number(specs.tamanhoRadiadorMm) > 0;
}

function descartarObjetoCorrecao3D(objeto) {
    if (!objeto) return;
    objeto.parent?.remove(objeto);
    objeto.traverse((filho) => {
        if (!filho.isMesh) return;
        filho.geometry?.dispose?.();
        if (Array.isArray(filho.material)) filho.material.forEach((material) => material?.dispose?.());
        else filho.material?.dispose?.();
    });
}

function criarFanHorizontalAio(raio, espessura) {
    const grupo = new THREE.Group();
    const materialFrame = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.68, metalness: 0.18 });
    const materialPas = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.46, metalness: 0.16 });

    const aro = new THREE.Mesh(
        new THREE.TorusGeometry(raio * 0.88, Math.max(0.018, raio * 0.075), 8, 28),
        materialFrame,
    );
    aro.rotation.x = Math.PI / 2;
    grupo.add(aro);

    const cubo = new THREE.Mesh(
        new THREE.CylinderGeometry(raio * 0.15, raio * 0.15, espessura, 18),
        materialFrame,
    );
    grupo.add(cubo);

    const quantidadePas = 7;
    for (let indice = 0; indice < quantidadePas; indice += 1) {
        const angulo = (indice / quantidadePas) * Math.PI * 2;
        const distancia = raio * 0.46;
        const pa = new THREE.Mesh(
            new THREE.BoxGeometry(raio * 0.55, Math.max(0.018, espessura * 0.18), raio * 0.12),
            materialPas,
        );
        pa.position.set(Math.cos(angulo) * distancia, 0, Math.sin(angulo) * distancia);
        pa.rotation.y = -angulo + 0.42;
        grupo.add(pa);
    }

    return grupo;
}

function restaurarCoolerOriginal() {
    const original = cena.getObjectByName("grupo-modelos-cooler");
    if (original) original.visible = true;
}

function aplicarWaterCoolerNoTeto() {
    const cooler = obterPecaSnapshot("cooler");
    const existente = cena.getObjectByName(NOME_AIO_TETO_CORRIGIDO);

    if (!cooler || !ehWaterCoolerSnapshot()) {
        if (existente) descartarObjetoCorrecao3D(existente);
        restaurarCoolerOriginal();
        return;
    }

    const original = cena.getObjectByName("grupo-modelos-cooler");
    if (original) original.visible = false;

    const specs = cooler.especificacoes && typeof cooler.especificacoes === "object"
        ? cooler.especificacoes
        : {};
    const gabinete = obterDimensoesGabineteSnapshot();
    const comprimentoMaximo = Math.max(1.2, gabinete.profundidade - 0.34);
    const larguraMaxima = Math.max(0.9, gabinete.largura - 0.26);
    const tamanhoRadiador = limitarLayout3D(
        mmParaLayout3D(specs.tamanhoRadiadorMm, 240, 1.2, 4.2),
        1.2,
        comprimentoMaximo,
    );
    const tamanhoFan = limitarLayout3D(
        mmParaLayout3D(specs.tamanhoVentoinhaMm, 120, 0.9, 1.5),
        0.9,
        larguraMaxima,
    );
    const espessuraRadiador = mmParaLayout3D(specs.espessuraRadiadorMm, 27, 0.12, 0.45);
    const espessuraFan = mmParaLayout3D(specs.espessuraVentoinhaMm, 25, 0.10, 0.38);
    const quantidadeSugerida = Math.max(1, Math.round(tamanhoRadiador / Math.max(0.9, tamanhoFan)));
    const quantidadeFans = limitarLayout3D(
        Math.round(Number(specs.quantidadeVentoinhas) || quantidadeSugerida),
        1,
        3,
    );

    const chave = [
        cooler.id,
        cooler.nome,
        gabinete.largura,
        gabinete.altura,
        gabinete.profundidade,
        tamanhoRadiador,
        tamanhoFan,
        espessuraRadiador,
        espessuraFan,
        quantidadeFans,
    ].join("|");

    if (existente?.userData?.chaveLayoutAio === chave) return;
    if (existente) descartarObjetoCorrecao3D(existente);

    const grupo = new THREE.Group();
    grupo.name = NOME_AIO_TETO_CORRIGIDO;
    grupo.userData = {
        tipo: "cooler",
        categoria: "cooler",
        nome: cooler.nome || "Water cooler",
        pecaId: String(cooler.id ?? ""),
        chaveLayoutAio: chave,
        waterCoolerNoTeto: true,
    };

    const materialRadiador = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.66,
        metalness: 0.42,
    });
    const radiador = new THREE.Mesh(
        new THREE.BoxGeometry(tamanhoFan * 0.96, espessuraRadiador, tamanhoRadiador),
        materialRadiador,
    );
    const yRadiador = gabinete.altura - 0.09 - espessuraRadiador / 2;
    radiador.position.set(0, yRadiador, 0);
    radiador.castShadow = true;
    radiador.receiveShadow = true;
    grupo.add(radiador);

    const intervalo = tamanhoRadiador / quantidadeFans;
    const yFans = yRadiador - espessuraRadiador / 2 - espessuraFan / 2 - 0.025;
    for (let indice = 0; indice < quantidadeFans; indice += 1) {
        const fan = criarFanHorizontalAio(tamanhoFan * 0.40, espessuraFan);
        fan.position.set(
            0,
            yFans,
            -tamanhoRadiador / 2 + intervalo * (indice + 0.5),
        );
        grupo.add(fan);
    }

    // Bloco/bomba continua sobre o processador; o radiador é que fica deitado no teto.
    const bomba = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.34 }),
    );
    bomba.rotation.z = Math.PI / 2;
    const xBomba = -gabinete.largura / 2 + Math.min(0.62, gabinete.largura * 0.28);
    const yBomba = limitarLayout3D(gabinete.altura * 0.72, 1.45, gabinete.altura - 0.80);
    const zBomba = limitarLayout3D(gabinete.profundidade * 0.20, -gabinete.profundidade * 0.30, gabinete.profundidade * 0.30);
    bomba.position.set(xBomba, yBomba, zBomba);
    grupo.add(bomba);

    cena.add(grupo);
}

function rotacionarObjetoNoCentroEmZ(objeto, angulo) {
    if (!objeto || !Number.isFinite(angulo)) return;
    objeto.updateMatrixWorld(true);
    const caixaAntes = new THREE.Box3().setFromObject(objeto);
    if (caixaAntes.isEmpty()) return;
    const centroAntes = caixaAntes.getCenter(new THREE.Vector3());

    objeto.rotateZ(angulo);
    objeto.updateMatrixWorld(true);

    const caixaDepois = new THREE.Box3().setFromObject(objeto);
    if (caixaDepois.isEmpty()) return;
    const centroDepois = caixaDepois.getCenter(new THREE.Vector3());
    objeto.position.add(centroAntes.sub(centroDepois));
    objeto.updateMatrixWorld(true);
}

function corrigirOrientacaoAsusTufRx9070() {
    const gpu = obterPecaSnapshot("placavideo");
    if (!gpu) return;
    const texto = textoPecaLayout3D(gpu);
    if (!/asus.*tuf.*(?:gaming.*)?(?:radeon.*)?rx\s*9070/.test(texto)) return;

    const grupo = cena.getObjectByName("grupo-modelos-placavideo");
    if (!grupo) return;

    const modeloReal = grupo.children.find((objeto) => objeto?.userData?.fallback3D === false);
    // O fallback procedural já nasce com as ventoinhas voltadas para baixo.
    if (!modeloReal || modeloReal.userData?.rx9070FansParaBaixo === true) return;

    rotacionarObjetoNoCentroEmZ(modeloReal, Math.PI);
    modeloReal.userData.rx9070FansParaBaixo = true;
}

function corrigirFansDentroDoGabinete() {
    const grupo = cena.getObjectByName("grupo-modelos-ventoinhas");
    if (!grupo) return;
    const gabinete = obterDimensoesGabineteSnapshot();
    const meiaP = gabinete.profundidade / 2;

    grupo.children.forEach((fan) => {
        fan.updateMatrixWorld(true);
        const caixa = new THREE.Box3().setFromObject(fan);
        if (caixa.isEmpty()) return;
        const centro = caixa.getCenter(new THREE.Vector3());
        const tamanho = caixa.getSize(new THREE.Vector3());
        const espessura = limitarLayout3D(Math.min(tamanho.x, tamanho.y, tamanho.z), 0.08, 0.45);

        let zAlvo = centro.z;
        if (centro.z < -0.05) zAlvo = -meiaP + espessura / 2 + 0.08;
        else if (centro.z > 0.05) zAlvo = meiaP - espessura / 2 - 0.08;

        if (Math.abs(zAlvo - centro.z) > 0.001) {
            fan.position.z += zAlvo - centro.z;
            fan.updateMatrixWorld(true);
        }
    });
}

function corrigirCirculosDecorativosFractalNorth() {
    const gabineteSelecionado = obterPecaSnapshot("gabinete");
    const grupo = cena.getObjectByName("grupo-modelos-gabinete");
    if (!grupo) return;
    const ehFractalNorth = /fractal.*north|north.*fractal/.test(textoPecaLayout3D(gabineteSelecionado));

    grupo.traverse((objeto) => {
        if (!objeto.isMesh || objeto.geometry?.type !== "TorusGeometry") return;
        if (ehFractalNorth) {
            objeto.userData.ocultoFractalNorth = true;
            objeto.visible = false;
        } else if (objeto.userData.ocultoFractalNorth) {
            objeto.visible = true;
            delete objeto.userData.ocultoFractalNorth;
        }
    });
}

function aplicarCorrecoesMontagem3D() {
    if (!snapshotMontagem3D?.configuracao) return;
    aplicarWaterCoolerNoTeto();
    corrigirOrientacaoAsusTufRx9070();
    corrigirFansDentroDoGabinete();
    corrigirCirculosDecorativosFractalNorth();
}

function agendarCorrecoesMontagem3D() {
    timersCorrecaoMontagem3D.forEach((timer) => window.clearTimeout(timer));
    timersCorrecaoMontagem3D = [0, 60, 180, 420, 900, 1600].map((atraso) =>
        window.setTimeout(aplicarCorrecoesMontagem3D, atraso)
    );
}

if (!globalThis.__criaByteCorrecoesLayout3DInstaladas) {
    globalThis.__criaByteCorrecoesLayout3DInstaladas = true;
    window.addEventListener("pcbuilder:statechange", (evento) => {
        snapshotMontagem3D = evento?.detail ?? null;
        agendarCorrecoesMontagem3D();
    });
}

// ==========================================================================
// 8. EXPORTAÇÕES
// ==========================================================================

export {
    cena,
    camera,
    renderizador,
    controles,
    luzAlerta,
    carregador,
    carregarModelo3D,
    definirQualidade3D,
    alternarQualidade3D,
    obterQualidade3D,
    telaCarregamento
};