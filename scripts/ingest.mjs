// 深杯 · 曲库摄取脚本
// 用法: npm run ingest
// 读取 data/ 下的 CSV（优先 catalog.csv / 周深曲库.csv，回退到模板），
// 校验并产出 src/data/catalog.json。
// 请用 Excel「另存为 → CSV UTF-8」保存，避免乱码。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const candidates = [
  'data/catalog.csv',
  'data/周深曲库.csv',
  'data/曲库模板.csv',
]
const csvPath = candidates.map((c) => resolve(root, c)).find((p) => existsSync(p))
if (!csvPath) {
  console.error('✗ 未在 data/ 下找到曲库 CSV。请把表格放到 data/catalog.csv')
  process.exit(1)
}

let text = readFileSync(csvPath, 'utf8')
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // 去 BOM

/** 极简 CSV 解析（支持引号包裹的字段、字段内逗号与转义引号） */
function parseCSV(src) {
  const rows = []
  let row = []
  let field = ''
  let inQ = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''))
if (rows.length < 2) {
  console.error('✗ CSV 没有数据行')
  process.exit(1)
}

const header = rows[0].map((h) => h.trim())
const idx = (kw) => header.findIndex((h) => h.includes(kw))
const I = {
  title: idx('歌曲名') >= 0 ? idx('歌曲名') : idx('曲名'),
  album: idx('专辑'),
  year: idx('年份') >= 0 ? idx('年份') : idx('年'),
  division: idx('赛道'),
  lyricist: idx('作词') >= 0 ? idx('作词') : idx('词'),
  composer: idx('作曲') >= 0 ? idx('作曲') : idx('曲'),
  arranger: idx('编曲') >= 0 ? idx('编曲') : idx('编'),
  producer: idx('制作') >= 0 ? idx('制作') : idx('制'),
  seed: idx('热度'),
}

if (I.title < 0) {
  console.error('✗ 缺少「歌曲名」列')
  process.exit(1)
}

const seen = new Set()
const songs = []
let n = 0
for (let r = 1; r < rows.length; r++) {
  const col = rows[r]
  const title = (col[I.title] || '').trim()
  if (!title || title.startsWith('示例')) continue
  let id = 'zs-' + String(++n).padStart(3, '0')
  // 去重：同名追加序号
  if (seen.has(title)) {
    let k = 2
    while (seen.has(title + '#' + k)) k++
    seen.add(title + '#' + k)
  } else {
    seen.add(title)
  }
  const yearRaw = (col[I.year] || '').trim()
  const year = yearRaw ? parseInt(yearRaw.replace(/[^0-9]/g, '').slice(0, 4), 10) : null
  const seedRaw = I.seed >= 0 ? (col[I.seed] || '').trim() : ''
  let seed = seedRaw ? parseFloat(seedRaw) : NaN
  if (!isFinite(seed)) seed = Math.round(30 + Math.random() * 50) // 无热度则随机 30–80
  seed = Math.max(0, Math.min(100, seed))
  const f = (i) => (i >= 0 ? (col[i] || '').trim() : '')
  songs.push({
    id,
    title,
    album: f(I.album),
    year: year && year > 1900 && year < 2100 ? year : null,
    division: f(I.division) || '录音室',
    lyricist: f(I.lyricist),
    composer: f(I.composer),
    arranger: f(I.arranger),
    producer: f(I.producer),
    seed,
  })
}

if (!songs.length) {
  console.error('✗ 解析后无有效曲目（请检查表头与数据）')
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

console.log(`✓ 摄取完成：${songs.length} 首 → src/data/catalog.json`)
console.log(`  来源: ${csvPath.replace(root, '.')}`)
