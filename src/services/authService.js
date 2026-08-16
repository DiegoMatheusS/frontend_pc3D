import { ApiError, apiRequest } from './httpClient'

function normalizeProfile(data) {
  const source = data?.usuario
    || data?.perfil
    || data?.user
    || data?.dados?.usuario
    || data?.dados?.perfil
    || data?.sessao?.usuario
    || data?.dados
    || data
  if (!source || typeof source !== 'object') return null

  const id = source.id ?? source.usuarioId ?? null
  const email = typeof source.email === 'string' ? source.email : ''
  const nome = typeof source.nome === 'string' && source.nome.trim()
    ? source.nome.trim()
    : email.split('@')[0] || 'Usuário'

  if (!id && !email) return null

  return {
    ...source,
    id,
    nome,
    email,
    papel: String(source.papel || 'USUARIO').toUpperCase(),
  }
}

function registrationEndpoints() {
  const configured = String(import.meta.env.VITE_REGISTER_ENDPOINT || '').trim()
  return [...new Set([
    configured,
    '/api/auth/cadastro',
  ].filter(Boolean))]
}

async function createAccount(data) {
  let lastMissingRoute = null

  for (const path of registrationEndpoints()) {
    try {
      const response = await apiRequest(path, {
        method: 'POST',
        body: data,
      })
      return { response, path }
    } catch (error) {
      if (error?.status === 404 || error?.status === 405) {
        lastMissingRoute = error
        continue
      }
      throw error
    }
  }

  throw new ApiError(
    'A rota pública de cadastro não foi encontrada no servidor conectado.',
    {
      status: lastMissingRoute?.status || 404,
      data: lastMissingRoute?.data || null,
      url: lastMissingRoute?.url || '',
    },
  )
}

export const authService = {
  async profile() {
    return normalizeProfile(await apiRequest('/api/auth/perfil'))
  },

  async login(credentials) {
    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    return this.profile()
  },

  async register(data) {
    const normalized = {
      nome: String(data?.nome || '').trim(),
      email: String(data?.email || '').trim().toLowerCase(),
      senha: String(data?.senha || ''),
    }

    const { response } = await createAccount(normalized)

    // Alguns backends devolvem o usuário e já criam a sessão; outros apenas
    // criam a conta. Preferimos sempre validar o cookie real antes de considerar
    // o usuário autenticado.
    try {
      const profile = await this.profile()
      if (profile) return profile
    } catch (error) {
      if (error?.status !== 401) throw error
    }

    // Se a rota pública criou a conta sem sessão, entra automaticamente.
    try {
      return await this.login({ email: normalized.email, senha: normalized.senha })
    } catch (error) {
      const returnedProfile = normalizeProfile(response)
      if (returnedProfile && error?.status === 404) return returnedProfile
      throw error
    }
  },

  async updateProfile(data) {
    const response = await apiRequest('/api/usuarios/me', {
      method: 'PATCH',
      body: data,
    })
    return normalizeProfile(response) || this.profile()
  },

  async changePassword({ senhaAtual, novaSenha }) {
    return apiRequest('/api/usuarios/me/senha', {
      method: 'PATCH',
      body: { senhaAtual, novaSenha },
    })
  },

  async logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' })
  },
}
