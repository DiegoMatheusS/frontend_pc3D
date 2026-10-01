import { apiRequest } from '../../services/httpClient'

export const hardwareImageService = {
  searchAndSave: (hardwareId) => apiRequest(
    `/api/admin/hardwares/descobrir/${Number(hardwareId)}/imagem`,
    { method: 'POST' },
  ),
}
