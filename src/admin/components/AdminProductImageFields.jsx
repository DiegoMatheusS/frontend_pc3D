import { useEffect, useRef, useState } from 'react'
import { useAdminToast } from './AdminToast'
import { canSearchProductImage, productImageIdentity, productImageService } from '../services/productImageService'
import { safeHttpUrl } from '../../utils/safeUrl'

const FIELDS = [['imagemUrl', 'Imagem principal'], ['imagemHoverUrl', 'Imagem hover']]

export default function AdminProductImageFields({ product, onChange, disabled = false }) {
  const toast = useAdminToast()
  const [searching, setSearching] = useState('')
  const [source, setSource] = useState(null)
  const pending = useRef(null)
  const latestProduct = useRef(product)

  useEffect(() => { latestProduct.current = product }, [product])
  useEffect(() => () => { pending.current?.abort() }, [])

  async function searchImage(field) {
    if (disabled || pending.current || !canSearchProductImage(product)) return
    const controller = new AbortController()
    pending.current = controller
    setSearching(field)
    setSource(null)
    const identity = JSON.stringify(productImageIdentity(product))
    const previousImage = product[field]
    try {
      const result = await productImageService.search(product, { signal: controller.signal })
      if (controller.signal.aborted) return
      const image = safeHttpUrl(result?.imagemUrl, { allowRelative: false })
      if (!image) throw new Error('A busca terminou sem retornar um endereço de imagem válido.')
      const current = latestProduct.current
      if (identity !== JSON.stringify(productImageIdentity(current)) || current[field] !== previousImage) {
        toast.show('O produto ou a imagem mudou durante a busca. Busque novamente para usar os dados atuais.', 'alerta')
        return
      }
      onChange(field, image)
      setSource({ field, image, name: result?.fonte, url: safeHttpUrl(result?.urlFonte, { allowRelative: false }) })
      toast.show('Endereço da imagem preenchido. Salve o produto para confirmar.')
    } catch (error) {
      if (!controller.signal.aborted) toast.show(error?.message || 'Não foi possível buscar a imagem.', 'erro')
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setSearching('')
      }
    }
  }

  const canSearch = canSearchProductImage(product)
  return <>
    {FIELDS.map(([field, label]) => <div className="admin-field full" key={field}>
      <label htmlFor={`product-${field}`}>{label}</label>
      <input id={`product-${field}`} className="admin-input" value={product[field] || ''} disabled={disabled} onChange={(event) => onChange(field, event.target.value)} placeholder="https://..." />
      <div className="admin-row-actions"><button className="admin-action-button" type="button" disabled={disabled || Boolean(searching) || !canSearch} onClick={() => searchImage(field)}>
        {searching === field ? 'Buscando imagem...' : 'Buscar imagem'}
      </button></div>
      {source?.field === field && source.image === product[field] && <small className="admin-help">Imagem encontrada{source.name ? ` em ${source.name}` : ''}.{source.url && <> <a href={source.url} target="_blank" rel="noopener noreferrer">Ver produto na loja</a></>}</small>}
    </div>)}
    <small className="admin-help">Busca no Mercado Livre, Magazine Luiza e Shopee e preenche o endereço da imagem no campo escolhido.{!canSearch && ' Preencha o nome e o modelo, MPN ou GTIN/EAN para buscar.'}</small>
  </>
}
