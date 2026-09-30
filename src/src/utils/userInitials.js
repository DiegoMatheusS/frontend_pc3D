// Todas as áreas do site devem calcular o avatar a partir da mesma conta.
// Não acrescentar letras arbitrárias (como AD/CB) a nomes de uma palavra.
export function userInitials(user) {
  const name = String(user?.nome ?? '').trim()
  const words = name.split(/\s+/u).filter(Boolean)
  const meaningful = words.filter((word, index) => index === 0 || !/^(?:de|da|do|das|dos|e)$/iu.test(word))

  if (meaningful.length >= 2) {
    return `${meaningful[0][0]}${meaningful[meaningful.length - 1][0]}`.toLocaleUpperCase('pt-BR')
  }
  if (meaningful.length === 1) return meaningful[0][0].toLocaleUpperCase('pt-BR')

  const emailName = String(user?.email ?? '').split('@')[0]
  return emailName.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase('pt-BR') || '●'
}
