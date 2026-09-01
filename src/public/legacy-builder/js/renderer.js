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
// 7. EXPORTAÇÕES
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