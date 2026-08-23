import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../services/httpClient'

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'

const R2_PUBLIC_BASE_URL = 'https://pub-f75dfbdc12814aea925f2615df4d32a5.r2.dev/'
const HOME_MODEL_STORAGE_KEY = 'criabyte:home-modelo3d:v1'

function resolveModelUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('/')) return new URL(raw, window.location.origin).href
  return `${R2_PUBLIC_BASE_URL}${raw.replace(/^\/+/, '')}`
}

function hardwareItems(payload) {
  if (Array.isArray(payload)) return payload
  for (const key of ['itens', 'items', 'hardwares', 'dados', 'data', 'resultados', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

function modelFromHardware(hardware) {
  const directUrl = hardware?.modelo3dUrl
    || hardware?.modelo3DUrl
    || hardware?.model3dUrl
    || hardware?.urlModelo3d
    || hardware?.urlModelo3D
    || (typeof hardware?.modelo3D === 'string' ? hardware.modelo3D : '')
  if (directUrl) return resolveModelUrl(directUrl)

  const explicit = [hardware?.modelo3DAtivo, hardware?.modelo3D]
    .filter((item) => item && typeof item === 'object')
  const models = [
    ...explicit,
    ...(Array.isArray(hardware?.modelos3D) ? hardware.modelos3D : []),
  ]
  const model = models.find((item) => item?.ativo !== false && item?.aprovado !== false)
    || models.find((item) => item?.ativo !== false)
    || models[0]
  return resolveModelUrl(
    model?.arquivoUrl
      || model?.urlArquivo
      || model?.cdnUrl
      || model?.cloudflareUrl
      || model?.url,
  )
}

async function getHeroGpuModelUrl() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(HOME_MODEL_STORAGE_KEY) || 'null')
    const savedUrl = resolveModelUrl(saved?.arquivoUrl)
    if (savedUrl) return savedUrl
  } catch {
    // Sem seleção local: continua com a escolha automática da GPU pública.
  }

  let payload
  try {
    payload = await apiRequest('/api/hardwares?categoria=PLACA_VIDEO&pagina=1&limite=100')
  } catch {
    payload = await apiRequest('/api/hardwares')
  }

  const gpus = hardwareItems(payload).filter((hardware) => {
    const category = String(hardware?.categoria ?? hardware?.category ?? '').toUpperCase()
    return category === 'PLACA_VIDEO' && hardware?.ativo !== false && hardware?.publicado !== false
  })

  for (const gpu of gpus) {
    const url = modelFromHardware(gpu)
    if (url) return url
  }

  // O endpoint público específico é a fonte mais confiável quando /api/hardwares
  // não inclui modelos3D na listagem geral. Consulta só GPUs e para no primeiro GLB.
  for (const gpu of gpus.slice(0, 12)) {
    if (!gpu?.id) continue
    try {
      const modelPayload = await apiRequest(`/api/hardwares/${encodeURIComponent(gpu.id)}/modelos-3d`)
      const models = Array.isArray(modelPayload?.modelos)
        ? modelPayload.modelos
        : Array.isArray(modelPayload?.modelos3D)
          ? modelPayload.modelos3D
          : Array.isArray(modelPayload)
            ? modelPayload
            : []
      const url = modelFromHardware({ modelos3D: models })
      if (url) return url
    } catch {
      // Tenta a próxima GPU pública.
    }
  }

  // Fallback para versões da API que entregam o modelo somente no detalhe.
  for (const gpu of gpus.slice(0, 12)) {
    if (!gpu?.id) continue
    try {
      const detailPayload = await apiRequest(`/api/hardwares/${encodeURIComponent(gpu.id)}`)
      const detail = detailPayload?.hardware || detailPayload?.dado || detailPayload
      const url = modelFromHardware(detail)
      if (url) return url
    } catch {
      // Continua procurando outra GPU pública.
    }
  }
  return ''
}

function loadScript(src) {
  const existing = document.querySelector(`script[data-home-three-src="${src}"]`)
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve()
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.referrerPolicy = 'no-referrer'
    script.dataset.homeThreeSrc = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', reject, { once: true })
    document.head.appendChild(script)
  })
}

function orientGpuSideways(asset, THREE) {
  asset.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(asset)
  if (box.isEmpty()) return

  let size = box.getSize(new THREE.Vector3())
  // Na Home a GPU é uma peça de destaque, não um objeto em escala física.
  // Coloca o maior eixo no horizontal (X) e o eixo mais fino em profundidade (Z),
  // deixando a placa claramente "de lado" mesmo que o GLB tenha sido exportado
  // com X/Y/Z diferentes.
  const entries = [
    ['x', size.x],
    ['y', size.y],
    ['z', size.z],
  ].sort((a, b) => b[1] - a[1])
  const longest = entries[0][0]

  if (longest === 'z') asset.rotateY(Math.PI / 2)
  else if (longest === 'y') asset.rotateZ(-Math.PI / 2)

  asset.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(asset)
  size = box.getSize(new THREE.Vector3())

  // Depois do comprimento estar horizontal, a segunda maior dimensão deve ser
  // a altura. Se ela estiver em Z, gira a peça para deixar a face lateral visível.
  if (size.z > size.y) asset.rotateX(Math.PI / 2)
  asset.updateMatrixWorld(true)
}

function disposeScene(scene) {
  scene?.traverse?.((object) => {
    if (!object?.isMesh) return
    object.geometry?.dispose?.()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose?.()
      })
      material.dispose?.()
    })
  })
}

export default function HomeHero3D() {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    let frame = 0
    let resizeObserver
    let intersectionObserver
    let renderer
    let controls
    let scene
    let onResize
    let onVisibility

    async function start() {
      try {
        if (!window.THREE) await loadScript(THREE_URL)
        if (!window.THREE?.OrbitControls) await loadScript(ORBIT_URL)
        if (!window.THREE?.GLTFLoader) await loadScript(GLTF_URL)
        if (cancelled) return

        const container = containerRef.current
        const THREE = window.THREE
        if (!container || !THREE?.GLTFLoader || !THREE?.OrbitControls) throw new Error('Three.js indisponível')

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
        camera.position.set(7.8, 4.7, 8.2)

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
        renderer.setClearColor(0x000000, 0)
        renderer.outputEncoding = THREE.sRGBEncoding
        renderer.domElement.className = 'home-preview__webgl-canvas'
        container.appendChild(renderer.domElement)

        controls = new THREE.OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.055
        controls.enablePan = false
        controls.enableZoom = false
        controls.minPolarAngle = Math.PI * 0.27
        controls.maxPolarAngle = Math.PI * 0.72
        controls.target.set(0, 0.3, 0)

        scene.add(new THREE.HemisphereLight(0xdff8ff, 0x151425, 1.45))
        const keyLight = new THREE.DirectionalLight(0x9deeff, 2.5)
        keyLight.position.set(5, 7, 6)
        scene.add(keyLight)
        const rimLight = new THREE.DirectionalLight(0x8d64ff, 2.1)
        rimLight.position.set(-5, 2, -5)
        scene.add(rimLight)
        const fillLight = new THREE.PointLight(0x31dca0, 1.7, 18)
        fillLight.position.set(0, -2, 4)
        scene.add(fillLight)

        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.74, roughness: 0.3 })
        const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.48, 64), baseMaterial)
        base.scale.set(1, 1, 0.78)
        base.position.y = -2.35
        scene.add(base)

        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x35d9ef, transparent: true, opacity: 0.48 })
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.03, 0.035, 12, 96), ringMaterial)
        ring.rotation.x = Math.PI / 2
        ring.position.y = -2.08
        scene.add(ring)

        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(3.1, 64),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false }),
        )
        shadow.rotation.x = -Math.PI / 2
        shadow.position.y = -2.08
        scene.add(shadow)

        let model = null
        let pageVisible = !document.hidden
        let heroVisible = true

        const loader = new THREE.GLTFLoader()

        function showFallback() {
          if (cancelled) return
          const fallback = new THREE.Group()
            const corpo = new THREE.Mesh(
              new THREE.BoxGeometry(4.8, 2.25, 0.62),
              new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.72, roughness: 0.28 }),
            )
            fallback.add(corpo)

            const detalhe = new THREE.Mesh(
              new THREE.BoxGeometry(4.25, 1.65, 0.67),
              new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.55, roughness: 0.4 }),
            )
            detalhe.position.z = 0.05
            fallback.add(detalhe)

            const materialFan = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.38, roughness: 0.45 })
            ;[-1.28, 0, 1.28].forEach((x) => {
              const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 36), materialFan)
              fan.rotation.x = Math.PI / 2
              fan.position.set(x, 0, 0.42)
              fallback.add(fan)
            })

          model = fallback
          model.position.set(0, 0.2, 0)
          model.rotation.set(-0.04, -0.22, 0.03)
          scene.add(model)
          setStatus('ready')
        }

        const modelUrl = await getHeroGpuModelUrl().catch(() => '')
        if (cancelled) return
        if (!modelUrl) {
          showFallback()
        } else {
          loader.load(
            modelUrl,
            (gltf) => {
              if (cancelled) return
              const asset = gltf.scene
              orientGpuSideways(asset, THREE)
              asset.updateMatrixWorld(true)
              const initialBox = new THREE.Box3().setFromObject(asset)
              const size = initialBox.getSize(new THREE.Vector3())
              const largest = Math.max(size.x, size.y, size.z)
              if (Number.isFinite(largest) && largest > 0) {
                // Escala visual exclusiva da Home. No desktop a GPU é um destaque
                // propositalmente grande e pode ultrapassar visualmente o cartão.
                // No celular preservamos a escala anterior para não cortar a peça.
                const isMobileHero = window.matchMedia('(max-width: 620px)').matches
                const heroTargetSize = isMobileHero ? 6.15 : 8.65
                asset.scale.multiplyScalar(heroTargetSize / largest)
                asset.updateMatrixWorld(true)
                const fittedBox = new THREE.Box3().setFromObject(asset)
                const center = fittedBox.getCenter(new THREE.Vector3())
                asset.position.sub(center)
              }
              asset.traverse((object) => {
                if (!object.isMesh) return
                object.castShadow = false
                object.receiveShadow = false
                object.frustumCulled = false
              })

              model = new THREE.Group()
              model.add(asset)
              model.position.set(0, 0.2, 0)
              model.rotation.set(-0.04, -0.22, 0.03)
              scene.add(model)
              setStatus('ready')
            },
            undefined,
            showFallback,
          )
        }

        function resize() {
          if (!container || !renderer) return
          const width = Math.max(container.clientWidth, 1)
          const height = Math.max(container.clientHeight, 1)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height, false)
        }

        function animate(time) {
          frame = requestAnimationFrame(animate)
          if (!pageVisible || !heroVisible || !renderer) return
          controls.update()
          if (model && !reduceMotion) {
            const seconds = time * 0.001
            model.position.y = 0.2 + Math.sin(seconds * 1.4) * 0.16
            model.rotation.y += 0.0028
            ringMaterial.opacity = 0.4 + Math.sin(seconds * 1.7) * 0.08
          }
          renderer.render(scene, camera)
        }

        onVisibility = () => { pageVisible = !document.hidden }
        document.addEventListener('visibilitychange', onVisibility)

        if ('IntersectionObserver' in window) {
          intersectionObserver = new IntersectionObserver(([entry]) => {
            heroVisible = Boolean(entry?.isIntersecting)
          }, { threshold: 0.05 })
          intersectionObserver.observe(container)
        }

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(resize)
          resizeObserver.observe(container)
        } else {
          onResize = resize
          window.addEventListener('resize', onResize, { passive: true })
        }

        resize()
        frame = requestAnimationFrame(animate)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      if (onResize) window.removeEventListener('resize', onResize)
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
      controls?.dispose?.()
      renderer?.dispose?.()
      renderer?.domElement?.remove?.()
      disposeScene(scene)
    }
  }, [])

  return (
    <div ref={containerRef} className={`home-preview__webgl home-preview__webgl--${status}`} aria-label="Modelo 3D interativo de uma placa de vídeo">
      <div className="home-preview__fallback" aria-hidden={status === 'ready'}>
        <div className="home-preview__case">
          <span className="home-preview__motherboard" />
          <span className="home-preview__cpu" />
          <span className="home-preview__gpu" />
          <span className="home-preview__ram home-preview__ram--one" />
          <span className="home-preview__ram home-preview__ram--two" />
          <span className="home-preview__fan home-preview__fan--one" />
          <span className="home-preview__fan home-preview__fan--two" />
        </div>
      </div>
      {status === 'loading' && <span className="home-preview__3d-status">Carregando visualização 3D…</span>}
    </div>
  )
}
