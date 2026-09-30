import assert from 'node:assert/strict'
import { userInitials as rootInitials } from '../src/utils/userInitials.js'
import { userInitials as alternateInitials } from '../src/src/utils/userInitials.js'

const cases = [
  [{ nome: 'Diego Matheus Santos', email: 'teste@example.com' }, 'DS'],
  [{ nome: 'Diego de Souza' }, 'DS'],
  [{ nome: 'Diego' }, 'D'],
  [{ nome: '', email: 'diego@example.com' }, 'D'],
  [{ nome: 'Érica Oliveira' }, 'ÉO'],
  [{ nome: '', email: '' }, '●'],
]
for (const getInitials of [rootInitials, alternateInitials]) {
  for (const [user, expected] of cases) {
    assert.equal(getInitials(user), expected, `Sigla incorreta para ${JSON.stringify(user)}`)
  }
}
console.log('Iniciais reais validadas nas duas raízes.')
