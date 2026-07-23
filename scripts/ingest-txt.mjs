// Shencup · 曲库摄取（txt 版）
// 用法: npm run ingest
// 读取 data/ 下所有 *.txt（如 录音室曲库.txt / Live曲库.txt …），
// 解析 "序号. YYYY.MM.DD 《歌名》（可选后缀）" + 【YYYY】年份头，
// 合并产出 src/data/catalog.json。赛道(division)取自文件名。

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dataDir = resolve(root, 'data')

const files = readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith('.txt'))
if (!files.length) {
  console.error('✗ data/ 下没有 .txt 曲库文件')
  process.exit(1)
}

let n = 0
const songs = []
const perFile = {}

for (const f of files) {
  const division =
    basename(f)
      .replace(/曲库\.txt$/i, '')
      .replace(/\.txt$/i, '')
      .trim() || '未分类'
  let text = readFileSync(resolve(dataDir, f), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // 去 BOM

  let count = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^【\d{4}】/.test(line)) continue // 年份分组头
    // 序号(可选) + "." + YYYY.MM.DD + 《歌名》 + 可选后缀
    const m = line.match(/^(?:\d+)?\.?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\s*《(.+?)》\s*(.*)$/)
    if (!m) continue
    const [, Y, M, D, inner, suffix] = m
    const title = inner + (suffix ? suffix.trim() : '')
    const mm = String(M).padStart(2, '0')
    const dd = String(D).padStart(2, '0')
    songs.push({
      id: 'zs-' + String(++n).padStart(3, '0'),
      title,
      album: `${Y}.${mm}.${dd}`, // 发行日期（无专辑名时用日期占位）
      year: parseInt(Y),
      division,
      lyricist: '',
      composer: '',
      arranger: '',
      producer: '',
      seed: 50,
    })
    count++
  }
  perFile[f] = count
}

if (!songs.length) {
  console.error('✗ 解析后无有效曲目，请检查 txt 格式')
  process.exit(1)
}

const out = {
  artist: '周深',
  generatedAt: new Date().toISOString(),
  count: songs.length,
  songs,
}

const outDir = resolve(root, 'src/data')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'catalog.json'), JSON.stringify(out, null, 2), 'utf8')

console.log(`✓ 摄取完成：共 ${songs.length} 首 → src/data/catalog.json`)
for (const [f, c] of Object.entries(perFile)) console.log(`  · ${f}: ${c} 首`)
