import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import './PublicUiEnhancements.css'

const TITULOS_HARDWARE = new Map([
  ['Processador', 'Processadores'],
  ['Placa-mãe', 'Placas-mãe'],
  ['Memória RAM', 'Memórias RAM'],
  ['Placa de vídeo', 'Placas de vídeo'],
  ['Armazenamento', 'Armazenamento'],
  ['Fonte', 'Fontes'],
  ['Gabinete', 'Gabinetes'],
  ['Cooler', 'Coolers'],
  ['Ventoinhas', 'Ventoinhas'],
  ['Resumo', 'Resumo da montagem'],
])

function atualizarTitulosDoAssistente() {
  document.querySelectorAll('.ai-guided__heading strong').forEach((elemento) => {
    const atual = String(elemento.textContent || '').trim()
    const titulo = TITULOS_HARDWARE.get(atual)
    if (!titulo) return

    elemento.textContent = titulo
    elemento.classList.add('ai-guided__topic-title')
    elemento.closest('.ai-guided__heading')?.classList.add('ai-guided__heading--topic')
  })
}

function encontrarRotor(fan) {
  let rotor = null
  fan.traverse((objeto) => {
    if (!rotor && objeto?.userData?.rotacaoProcedural) rotor = objeto
  })
  return rotor
}

function criarMaterialFan(THREE, cor, opcoes = {}) {
  return new THREE.MeshStandardMaterial({
    color: cor,
    roughness: opcoes.roughness ?? 0.62,
    metalness: opcoes.metalness ?? 0.18,
  })
}

function melhorarFanDeCooler(fan, THREE) {
  if (!fan?.isGroup || fan.userData?.fanRadiadorAprimorado) return

  const rotor = encontrarRotor(fan)
  if (!rotor) return

  const aro = fan.children.find((filho) => filho?.isMesh && filho.geometry?.type === 'TorusGeometry')
  const raioAro = Number(aro?.geometry?.parameters?.radius)
  if (!Number.isFinite(raioAro) || raioAro <= 0) return

  const raio = raioAro / 0.88
  const tamanho = raio * 2.12
  const borda = Math.max(0.07, tamanho * 0.085)
  const profundidade = Math.max(0.14, Math.min(0.26, raio * 0.34))
  const metade = tamanho / 2
  const deslocamento = metade - borda / 2
  const materialFrame = criarMaterialFan(THREE, 0x111827, { roughness: 0.68, metalness: 0.22 })
  const materialParafuso = criarMaterialFan(THREE, 0x64748b, { roughness: 0.4, metalness: 0.7 })
  const materialPas = criarMaterialFan(THREE, 0x334155, { roughness: 0.48, metalness: 0.12 })

  const adicionarBarra = (largura, altura, profundidadeBarra, x, z) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(largura, profundidadeBarra, altura),
      materialFrame,
    )
    mesh.position.set(x, 0, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    fan.add(mesh)
  }

  // Moldura quadrada típica de fan de radiador de 120/140 mm.
  adicionarBarra(tamanho, borda, profundidade, 0, deslocamento)
  adicionarBarra(tamanho, borda, profundidade, 0, -deslocamento)
  adicionarBarra(borda, tamanho - borda * 2, profundidade, deslocamento, 0)
  adicionarBarra(borda, tamanho - borda * 2, profundidade, -deslocamento, 0)

  const raioParafuso = Math.max(0.022, borda * 0.24)
  const posParafuso = metade - borda * 0.72
  ;[-1, 1].forEach((sx) => {
    ;[-1, 1].forEach((sz) => {
      const parafuso = new THREE.Mesh(
        new THREE.CylinderGeometry(raioParafuso, raioParafuso, profundidade * 1.06, 16),
        materialParafuso,
      )
      parafuso.position.set(sx * posParafuso, 0, sz * posParafuso)
      parafuso.castShadow = true
      fan.add(parafuso)
    })
  })

  // Mantém a animação existente, mas deixa as pás menos finas e menos "disco".
  rotor.children.forEach((pa) => {
    if (!pa?.isMesh) return
    pa.material = materialPas
    pa.scale.x *= 1.04
    pa.scale.y *= 1.45
    pa.scale.z *= 1.12
    pa.castShadow = true
  })

  if (aro?.material) {
    aro.material = materialFrame
    aro.castShadow = true
  }

  fan.userData.fanRadiadorAprimorado = true
}

function aplicarCorrecoes3D(cena) {
  const THREE = globalThis.THREE
  if (!THREE || !cena?.traverse) return

  cena.traverse((objeto) => {
    if (!objeto?.isGroup || !objeto.userData?.procedural) return

    if (objeto.userData.categoria === 'cooler') {
      objeto.children
        .filter((filho) => filho?.isGroup)
        .forEach((fan) => melhorarFanDeCooler(fan, THREE))
    }

    // Os aros de gabinete procedural eram apenas decoração e podiam atravessar a carcaça.
    if (objeto.userData.categoria === 'gabinete') {
      objeto.traverse((filho) => {
        if (filho !== objeto && filho?.isMesh && filho.geometry?.type === 'TorusGeometry') {
          filho.visible = false
        }
      })
    }
  })
}

export default function PublicUiEnhancements() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/montar') return undefined

    atualizarTitulosDoAssistente()
    const observador = new MutationObserver(atualizarTitulosDoAssistente)
    observador.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observador.disconnect()
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname !== '/montar') return undefined

    let cancelado = false
    let temporizador = null
    let removerEvento = null

    const iniciar = async () => {
      if (cancelado) return
      if (!globalThis.THREE) {
        temporizador = window.setTimeout(iniciar, 120)
        return
      }

      try {
        // Mantém o renderer como asset público carregado em runtime. Usar uma
        // variável impede o Vite/Rolldown de tentar resolver /legacy-builder
        // durante o build, já que esse arquivo vive em public/.
        const rendererUrl = '/legacy-builder/js/renderer.js'
        const renderer = await import(/* @vite-ignore */ rendererUrl)
        if (cancelado) return
        const aplicar = () => aplicarCorrecoes3D(renderer.cena)
        document.addEventListener('pcbuilder:statechange', aplicar)
        removerEvento = () => document.removeEventListener('pcbuilder:statechange', aplicar)
        aplicar()
        window.setTimeout(aplicar, 180)
        window.setTimeout(aplicar, 650)
      } catch {
        if (!cancelado) temporizador = window.setTimeout(iniciar, 250)
      }
    }

    iniciar()
    return () => {
      cancelado = true
      if (temporizador) window.clearTimeout(temporizador)
      removerEvento?.()
    }
  }, [location.pathname])

  return null
}
