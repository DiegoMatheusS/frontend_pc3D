import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import * as THREE from 'three'
import * as placement from '../public/legacy-builder/js/montador/model-placement.js'

globalThis.THREE = THREE

// Executa o motor real, com o DOM/rede substituídos. As caixas e os transforms
// são calculados pela mesma versão do Three.js usada na página (r128).
function motor(raiz = 'public', carregar = async () => { throw new Error('sem GLB') }) {
  const frames = []
  let tempo = 0
  const context = vm.createContext({
    THREE, ...placement, URL, console, performance: { now: () => tempo },
    cena: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    controles: { target: new THREE.Vector3(), update() {} }, carregador: {},
    carregarModelo3D: carregar, renderizador: { render() {} }, api: {}, mostrarToast() {},
    window: { addEventListener() {}, clearTimeout() {}, setTimeout() {},
      location: { href: 'http://localhost/montar', pathname: '/montar' } },
    document: { readyState: 'loading', hidden: true, addEventListener() {}, getElementById() { return null } },
    requestAnimationFrame: (fn) => frames.push(fn),
  })
  let source = fs.readFileSync(new URL(`../${raiz}/legacy-builder/js/pcbuildscript.js`, import.meta.url), 'utf8')
  source = source.replace(/^import\s[\s\S]*?from\s+"[^"]+";\s*/gm, '')
    .replaceAll('import.meta.url', '"http://localhost/legacy-builder/js/pcbuildscript.js"')
    .replace('export async function', 'async function')
  vm.runInContext(source, context)
  const state = vm.runInContext('({estadoMontagem, objetosPorCategoria, modelos3DAtivos, atualizarAncorasGabinete3D, atualizarPecaNo3D, reconstruirRepresentacoes3DParaGabinete, criarModeloProcedural, dimensoesFisicasAlvoModelo3D, destacarCategoria3D})', context)
  return {
    ...state, context,
    quadro(ms) { tempo = ms; frames.splice(0).forEach((frame) => frame(ms)) },
    async carregar(configuracao) {
      Object.assign(state.estadoMontagem, configuracao)
      state.reconstruirRepresentacoes3DParaGabinete()
      for (let i = 0; i < 6; i += 1) await Promise.resolve()
    },
  }
}

function caixa(objeto) {
  objeto.updateWorldMatrix(true, true)
  return new THREE.Box3().setFromObject(objeto)
}

function proximo(a, b, mensagem = '') {
  assert.ok(Math.abs(a - b) < 0.0001, `${mensagem}: ${a} != ${b}`)
}

function configuracao() {
  return {
    gabinete: { id: 'case', especificacoes: { larguraMm: 240, alturaMm: 460, profundidadeMm: 450 } },
    placamae: { id: 'mb', especificacoes: { formato: 'ATX' } },
    processador: { id: 'cpu' }, cooler: null,
    memoria: [{ id: 'ram' }, { id: 'ram' }, null, null],
    placavideo: { id: 'gpu', especificacoes: { alturaMm: 120, espessuraMm: 50, comprimentoMm: 280 } },
    fonte: { id: 'psu' },
    armazenamento: [{ id: 'ssd', nome: 'SSD SATA 2.5' }, { id: 'nvme', nome: 'SSD NVMe M.2 2280' }],
    ventoinhas: [{ id: 'fan' }, { id: 'fan' }, { id: 'fan' }, { id: 'fan' }],
  }
}

test('escala ausente, nula ou zerada não colapsa uma peça; calibração positiva é preservada', () => {
  for (const valor of [undefined, null, '', 0, -1, NaN, Infinity]) assert.equal(placement.escala3DPositiva(valor), 1)
  assert.equal(placement.escala3DPositiva(0.85), 0.85)
})

test('posição absoluta padrão não empilha slots; calibração absoluta válida é respeitada', () => {
  const slot = new THREE.Vector3(-1, 3, 0.8)
  assert.deepEqual(placement.resolverPosicaoEncaixe3D(slot, { modoPosicao: 'absoluta', posicao: [0, 0, 0] }).toArray(), slot.toArray())
  assert.deepEqual(placement.resolverPosicaoEncaixe3D(slot, { posicao: [0.1, 0, 0] }).toArray(), [-0.9, 3, 0.8])
  assert.deepEqual(placement.resolverPosicaoEncaixe3D(slot, { modoPosicao: 'absoluta', posicao: [1, 2, 3] }).toArray(), [1, 2, 3])
})

test('gabinetes em mm, slim e medidas parciais preservam a unidade e usam fallback só para dados ausentes', () => {
  const dimensoes = (especificacoes) => placement.dimensoesGabinete3D({ especificacoes })
  assert.deepEqual(dimensoes({ alturaMm: 469, larguraMm: 215, profundidadeMm: 447 }), { largura: 2.15, altura: 4.69, profundidade: 4.47 })
  assert.deepEqual(dimensoes({ alturaMm: 300, larguraMm: 90, profundidadeMm: 250 }), { largura: 0.9, altura: 3, profundidade: 2.5 })
  assert.deepEqual(dimensoes({ alturaMm: 39 }), { largura: 2.4, altura: 0.39, profundidade: 4.5 })
  assert.deepEqual(dimensoes({ alturaMm: null, larguraMm: 0, profundidadeMm: -1 }), { largura: 2.4, altura: 4.6, profundidade: 4.5 })
})

test('renderer usa as mesmas medidas corrigidas do PC-240 para posicionar fans e water cooler', () => {
  const source = fs.readFileSync(new URL('../public/legacy-builder/js/renderer.js', import.meta.url), 'utf8')
  const trecho = source.slice(source.indexOf('function obterDimensoesGabineteSnapshot()'), source.indexOf('function ehWaterCoolerSnapshot()'))
  const snapshot = vm.runInNewContext(`${trecho}\nobterDimensoesGabineteSnapshot()`, {
    dimensoesGabinete3D: placement.dimensoesGabinete3D,
    obterPecaSnapshot: () => ({ especificacoes: { alturaMm: 39, larguraMm: 24, profundidadeMm: 47 } }),
    textoPecaLayout3D: () => '', textoGrupoCena3D: () => '',
  })
  proximo(snapshot.largura, 2.4); proximo(snapshot.altura, 3.9); proximo(snapshot.profundidade, 4.7)
})

for (const raiz of ['public', 'src/public']) {
  test(`${raiz}: remover um GLB não descarta a geometria do cache ou de outra peça`, () => {
    const source = fs.readFileSync(new URL(`../${raiz}/legacy-builder/js/renderer.js`, import.meta.url), 'utf8')
    const cloneSource = source.slice(source.indexOf('function clonarCenaGltf('), source.indexOf('function carregarModelo3D('))
    const clonar = vm.runInNewContext(`${cloneSource}\nclonarCenaGltf`, { THREE })
    const scene = new THREE.Group()
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    scene.add(new THREE.Mesh(geometry), new THREE.Mesh(geometry))
    const primeiro = clonar({ scene }).scene
    const segundo = clonar({ scene }).scene
    assert.notEqual(primeiro.children[0].geometry, geometry)
    assert.notEqual(primeiro.children[0].geometry, segundo.children[0].geometry)
    assert.equal(primeiro.children[0].geometry, primeiro.children[1].geometry)
    let descartado = false
    geometry.addEventListener('dispose', () => { descartado = true })
    primeiro.children[0].geometry.dispose()
    assert.equal(descartado, false)
  })

  test(`${raiz}: montagem completa usa encaixes distintos e mantém GPU/fonte/fans dentro do gabinete`, async () => {
    const engine = motor(raiz)
    engine.context.document.hidden = false
    engine.quadro(1000)
    await engine.carregar(configuracao())
    engine.quadro(2000)
    const ativos = engine.modelos3DAtivos
    const gpu = caixa(ativos.placavideo).getCenter(new THREE.Vector3())
    const psu = caixa(ativos.fonte).getCenter(new THREE.Vector3())
    assert.ok(gpu.distanceTo(psu) > 1)
    assert.ok(caixa(ativos.processador).getCenter(new THREE.Vector3()).y > 3)
    assert.ok(ativos.memoria.children[0].position.distanceTo(ativos.memoria.children[1].position) > 0.05)
    for (const categoria of ['placavideo', 'fonte', 'ventoinhas']) {
      const bounds = caixa(ativos[categoria])
      assert.ok(bounds.min.x >= -1.201 && bounds.max.x <= 1.201, categoria)
      assert.ok(bounds.min.y >= 0 && bounds.max.y <= 4.601, categoria)
      assert.ok(bounds.min.z >= -2.251 && bounds.max.z <= 2.251, categoria)
    }
    for (const fan of ativos.ventoinhas.children) {
      const size = caixa(fan).getSize(new THREE.Vector3())
      proximo(size.x, 1.20); proximo(size.y, 1.20)
    }
    // SATA aparece na baia mesmo quando é o primeiro disco da build.
    const [sata, m2] = ativos.armazenamento.children
    proximo(sata.position.z, engine.objetosPorCategoria.armazenamento[1].position.z)
    proximo(m2.position.z, engine.objetosPorCategoria.armazenamento[0].position.z)
    assert.ok(caixa(sata).getSize(new THREE.Vector3()).y > 0.95)
    assert.ok(caixa(m2).getSize(new THREE.Vector3()).y < 0.25)
  })

  test(`${raiz}: GLBs com pivô deslocado ficam presos ao slot durante normalização, entrada e destaque`, async () => {
    const carregar = async () => {
      const scene = new THREE.Group()
      scene.position.set(320, -200, 75)
      scene.scale.setScalar(100)
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.8), new THREE.MeshStandardMaterial())
      mesh.position.set(-50, 75, -100)
      scene.add(mesh)
      return { scene }
    }
    const engine = motor(raiz, carregar)
    const config = configuracao()
    config.placavideo.modelo3D = 'gpu.glb'
    config.placavideo.transform3D = { modoPosicao: 'absoluta', posicao: [0, 0, 0], escala: [null, 0, 1] }
    await engine.carregar(config)
    const slot = engine.objetosPorCategoria.placavideo[0].position
    for (const tempo of [0, 120, 1000]) {
      engine.quadro(tempo)
      const centro = caixa(engine.modelos3DAtivos.placavideo).getCenter(new THREE.Vector3())
      assert.ok(centro.distanceTo(slot) < 0.0001, `centro fora do slot no quadro ${tempo}`)
    }
    const tamanho = caixa(engine.modelos3DAtivos.placavideo).getSize(new THREE.Vector3())
    proximo(tamanho.x, 1.2); proximo(tamanho.y, 0.5); proximo(tamanho.z, 2.8)
    engine.destacarCategoria3D('placavideo')
    engine.quadro(1190)
    assert.ok(caixa(engine.modelos3DAtivos.placavideo).getCenter(new THREE.Vector3()).distanceTo(slot) < 0.0001)
  })

  test(`${raiz}: troca de gabinete reconstrói posições sem acumular escalas ou peças antigas`, async () => {
    const engine = motor(raiz)
    const config = configuracao()
    await engine.carregar(config)
    const primeira = engine.modelos3DAtivos.placavideo
    const tamanho = caixa(primeira).getSize(new THREE.Vector3())
    config.gabinete.especificacoes = { larguraMm: 285, alturaMm: 500, profundidadeMm: 520 }
    await engine.carregar(config)
    engine.quadro(1000)
    assert.equal(primeira.parent, null)
    const segunda = engine.modelos3DAtivos.placavideo
    assert.ok(caixa(segunda).getSize(new THREE.Vector3()).distanceTo(tamanho) < 0.0001)
    assert.ok(segunda.children[0].position.distanceTo(primeira.children[0].position) > 0.1)
  })

  test(`${raiz}: selecionar White PC-240 com medidas legadas em cm mantém a carcaça e os encaixes no tamanho real`, async () => {
    const engine = motor(raiz)
    const referencia = motor(raiz)
    const config = configuracao()
    config.placamae.especificacoes.formato = 'MICRO_ATX'
    await engine.carregar(config)
    const gabineteAnterior = engine.modelos3DAtivos.gabinete
    // Payload público do hardware 139: valores em cm nos campos *Mm.
    config.gabinete = {
      id: '139', nome: 'Gabinete Gamer White Pc-240 Vidro Temperado M-atx 4 Fans',
      especificacoes: { tamanho: 'MINI_TOWER', alturaMm: 39, larguraMm: 24, profundidadeMm: 47 },
    }
    await engine.carregar(config)
    await referencia.carregar({ ...config, gabinete: { ...config.gabinete,
      especificacoes: { tamanho: 'MINI_TOWER', alturaMm: 390, larguraMm: 240, profundidadeMm: 470 },
    } })
    engine.quadro(1000)
    referencia.quadro(1000)
    assert.equal(gabineteAnterior.parent, null)
    const carcaça = caixa(engine.modelos3DAtivos.gabinete)
    const tamanho = carcaça.getSize(new THREE.Vector3())
    assert.ok(tamanho.x > 2.4 && tamanho.y > 3.9 && tamanho.z > 4.7)
    for (const categoria of ['gabinete', 'placamae', 'processador', 'memoria', 'placavideo', 'fonte', 'ventoinhas']) {
      const bounds = caixa(engine.modelos3DAtivos[categoria])
      const esperado = caixa(referencia.modelos3DAtivos[categoria])
      assert.ok(bounds.min.distanceTo(esperado.min) < 0.0001, `${categoria}: encaixe deslocado`)
      assert.ok(bounds.max.distanceTo(esperado.max) < 0.0001, `${categoria}: dimensão errada`)
      assert.ok(carcaça.clone().expandByScalar(0.01).containsBox(bounds), `${categoria}: fora do gabinete`)
    }
    assert.equal(config.gabinete.especificacoes.alturaMm, 39)
  })

  test(`${raiz}: E-ATX e mATX têm o mesmo formato no desenho e no encaixe`, () => {
    const engine = motor(raiz)
    for (const formato of ['E-ATX', 'M-ATX', 'Mini-ITX']) {
      const peca = { especificacoes: { formato } }
      engine.estadoMontagem.placamae = peca
      engine.atualizarAncorasGabinete3D()
      const modelo = engine.criarModeloProcedural('placamae', peca, engine.objetosPorCategoria.placamae[0])
      const size = caixa(modelo).getSize(new THREE.Vector3())
      const alvo = placement.dimensoesPlacaMae3D(peca)
      proximo(size.y, alvo.altura); proximo(size.z, alvo.profundidade)
    }
  })

  test(`${raiz}: air cooler usa aletas; AIO mantém bomba no CPU e radiador no teto`, async () => {
    const engine = motor(raiz)
    const config = configuracao()
    config.cooler = { id: 'aio', nome: 'Water cooler 240', especificacoes: { tamanhoRadiadorMm: 240 } }
    await engine.carregar(config)
    const aio = engine.modelos3DAtivos.cooler.children[0]
    assert.equal(aio.userData.waterCoolerNoTeto, true)
    const radiador = caixa(aio.children[0])
    assert.ok(radiador.min.y > 4 && radiador.max.y < 4.6)
    const air = engine.criarModeloProcedural('cooler', { nome: 'Air cooler torre' }, engine.objetosPorCategoria.cooler[0])
    assert.equal(air.userData.tipoCooler, 'ar')
    assert.ok(air.children.length >= 20)
  })
}
