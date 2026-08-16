const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, url = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.url = url
    this.code = typeof data?.codigo === 'string' ? data.codigo : ''
    this.details = data?.detalhes ?? null
  }
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function readResponse(response) {
  const type = response.headers.get('content-type') || ''
  if (response.status === 204) return null
  if (type.includes('application/json')) return response.json()
  return response.text()
}

function getErrorMessage(data, status) {
  if (Array.isArray(data?.message)) return data.message.join(' ')
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  if (typeof data?.mensagem === 'string' && data.mensagem.trim()) return data.mensagem
  if (typeof data?.erro?.mensagem === 'string' && data.erro.mensagem.trim()) return data.erro.mensagem
  if (typeof data === 'string' && data.trim()) return data

  if (status === 401) return 'E-mail ou senha incorretos, ou sua sessão expirou.'
  if (status === 403) return 'Você não tem permissão para realizar esta ação.'
  if (status === 409) return 'Já existe um cadastro com estes dados.'
  if (status === 413) return 'Os dados enviados são maiores do que o servidor permite.'
  if (status === 429) return 'Muitas solicitações em pouco tempo. Aguarde um momento e tente novamente.'
  if (status === 503) return 'O serviço está temporariamente indisponível. Tente novamente em instantes.'
  if (status >= 500) return 'O servidor encontrou um problema. Tente novamente.'
  return 'Não foi possível concluir a solicitação.'
}

export async function apiRequest(path, options = {}) {
  const url = buildUrl(path)
  const hasBody = options.body !== undefined && options.body !== null
  const method = String(options.method || 'GET').toUpperCase()

  let response
  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...options,
      method,
      // Dados do Admin mudam com frequência (arquivar, publicar, descontinuar etc.).
      // Evita que uma navegação de volta reaproveite uma resposta GET antiga.
      cache: options.cache ?? (method === 'GET' ? 'no-store' : undefined),
      body: hasBody && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
    })
  } catch (error) {
    throw new ApiError('Não foi possível conectar ao backend.', {
      data: error,
      url,
    })
  }

  const data = await readResponse(response)

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), {
      status: response.status,
      data,
      url,
    })
  }

  return data
}
