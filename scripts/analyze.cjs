/**
 * Bundle size reporter.
 * Run via: npm run analyze
 * Outputs all JS and CSS chunks sorted by size.
 */
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist', 'assets')

if (!fs.existsSync(distDir)) {
  console.error('\n❌  dist/assets not found — run `npm run build` first.\n')
  process.exit(1)
}

const files = fs
  .readdirSync(distDir)
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => ({ name: f, size: fs.statSync(path.join(distDir, f)).size }))
  .sort((a, b) => b.size - a.size)

const totalBytes = files.reduce((s, f) => s + f.size, 0)
const maxSize = files[0]?.size ?? 1

console.log('\n📦  Bundle Analysis — dist/assets\n')
console.log('   Size      File')
console.log('─'.repeat(70))

files.forEach(({ name, size }) => {
  const kb = (size / 1024).toFixed(1).padStart(7)
  const barLen = Math.round((size / maxSize) * 20)
  const bar = '█'.repeat(barLen).padEnd(20)
  const warn = size > 200 * 1024 ? ' ⚠️' : ''
  console.log(`${kb} KB  ${bar}  ${name}${warn}`)
})

console.log('─'.repeat(70))
console.log(`${(totalBytes / 1024).toFixed(1).padStart(7)} KB  TOTAL (${files.length} chunks)\n`)
