import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['src', 'public', 'node_modules', 'dist', 'scripts'].includes(entry.name) && directory === resolve(root, 'src')) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) { if (!['node_modules', 'dist'].includes(entry.name)) await walk(path); continue }
    if (['eslint.config.js', 'vite.config.js'].includes(entry.name)) continue
    if (!['.js','.jsx','.css'].includes(extname(path))) continue
    const proxy = resolve(root, 'src/src', relative(resolve(root, 'src'), path))
    let target = relative(dirname(proxy), path).replaceAll('\\', '/')
    if (!target.startsWith('.')) target = `./${target}`
    const content = extname(path) === '.css' ? `@import "${target}";\n`
      : `// Compatibilidade: implementação única na raiz.\nexport * from '${target}'\n${(await readFile(path, 'utf8')).includes('export default ') ? `export { default } from '${target}'\n` : ''}`
    await mkdir(dirname(proxy), { recursive: true }); await writeFile(proxy, content)
  }
}
await walk(resolve(root, 'src'))
