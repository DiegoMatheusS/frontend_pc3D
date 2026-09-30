import { useState } from 'react'
import { apiRequest } from '../../services/httpClient'
import { useAdminToast } from './AdminToast'

/** Disponível apenas para administradores após o arquivamento do hardware. */
export default function AdminPermanentHardwareDelete({ hardware, onRefresh }) {
  const toast = useAdminToast()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (hardware.ativo !== false || deleting) return
    if (!window.confirm(`Excluir DEFINITIVAMENTE o hardware “${hardware.nome}” (#${hardware.id})? A operação é irreversível; vínculos protegidos pelo banco podem impedi-la.`)) return
    setDeleting(true)
    try {
      await apiRequest(`/api/admin/hardwares/${hardware.id}/permanente`, { method: 'DELETE' })
      const current = await onRefresh()
      if (current.some((item) => item.id === hardware.id)) {
        toast.show('A API respondeu, mas o hardware continua no banco. Exclusão não confirmada.', 'erro')
      } else {
        toast.show('Hardware excluído definitivamente.')
      }
    } catch (error) {
      toast.show(error?.message || 'Não foi possível excluir. Verifique se o hardware possui vínculos.', 'erro')
    } finally {
      setDeleting(false)
    }
  }

  if (hardware.ativo !== false) return null
  return <button type="button" className="admin-action-button" disabled={deleting} onClick={handleDelete}>
    {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
  </button>
}
