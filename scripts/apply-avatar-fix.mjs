import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, before, after, path) {
  if (!source.includes(before)) throw new Error(`Padrão esperado ausente em ${path}: ${before.slice(0, 60)}`)
  const next = source.replace(before, after)
  if (next === source) throw new Error(`Nenhuma alteração em ${path}`)
  return next
}

for (const base of ['src', 'src/src']) {
  const targets = [
    {
      path: `${base}/components/Header/Header.jsx`,
      oldImport: "import './Header.css'",
      newImport: "import { userInitials } from '../../utils/userInitials'\nimport './Header.css'",
      oldUse: 'initials(user.nome)',
    },
    {
      path: `${base}/admin/AdminLayout.jsx`,
      oldImport: "import './Admin.css'",
      newImport: "import { userInitials } from '../utils/userInitials'\nimport './Admin.css'",
      oldUse: 'initials(user?.nome)',
    },
    {
      path: `${base}/pages/Account/Account.jsx`,
      oldImport: "import './Account.css'",
      newImport: "import { userInitials } from '../../utils/userInitials'\nimport './Account.css'",
      oldUse: 'initials(user.nome)',
    },
  ]
  for (const target of targets) {
    let contents = readFileSync(target.path, 'utf8')
    if (contents.includes('import { userInitials }')) continue // idempotente
    contents = replaceOnce(contents, target.oldImport, target.newImport, target.path)
    const originalHelper = /function initials\(name = ''\) \{[^]*?\n\}\n\n/
    if (!originalHelper.test(contents)) throw new Error(`Função antiga de avatar não encontrada: ${target.path}`)
    contents = contents.replace(originalHelper, '')
    if (!contents.includes(target.oldUse)) throw new Error(`Chamada antiga não encontrada: ${target.path}`)
    contents = contents.replaceAll(target.oldUse, 'userInitials(user)')
    if (contents.includes('initials(')) throw new Error(`Referência antiga restante em ${target.path}`)
    writeFileSync(target.path, contents)
    console.log(`Avatar compartilhado: ${target.path}`)
  }
}
