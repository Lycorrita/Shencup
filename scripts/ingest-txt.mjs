// Shencup · 曲库摄取（txt 版，支持录音室《》与音综（）两种格式）
// 用法: npm run ingest
// 读取 data/ 下所有 *.txt，按文件名定赛道（录音室 / 音综 / …），
// 解析行 → { title, album, year, note }，合并产出 src/data/catalog.json。
// 音综曲目自动追加 " (Live)" 后缀；与录音室同名的音综曲目自动去重；
// note 字段尽量精简为「节目+期/季」（音综），录音室 note 留空。

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dataDir = resolve(root, 'data')

const CHANNELS = ['央视一套', '央视综艺', '央视一台', '央视', '江苏卫视', '湖南卫视', '浙江卫视', '东方卫视', '北京卫视', '广东卫视', '深圳卫视']
const TITLE_FIX = {
  'Time to co goodbye': 'Time to Say Goodbye',
  'caro mio ben': 'Caro Mio Ben',
  'city of stars': 'City of Stars',
}
const pad = (x) => String(x).padStart(2, '0')

/** 从「标题前的上下文」提取精简 note（节目+期/季） */
function extractNote(ctx) {
  let s = String(ctx)
    .replace(/^\s*\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?\s*/, '')
    .replace(/^\s*\d{4}\s*年\s*\d{1,2}\s*月\s*/, '')
    .replace(/^\s*\d{4}\s*年\s*/, '')
    .replace(/^\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*/, '')
    .replace(/^\s*\d{1,2}\s*月\s*\d{1,2}\s*日?\s*/, '')
    .replace(/^\s*\d{1,2}\s*月\s*/, '')
  for (const ch of CHANNELS) if (s.startsWith(ch)) { s = s.slice(ch.length).trim(); break }
  s = s.trim()
  let m = s.match(/《[^》]+》\s*(?:\d+期|第[一二三四五六七八九十百零0-9]+[季期站场轮])?/)
  if (m) return m[0].trim()
  m = s.match(/[一-龥A-Za-z·*][一-龥A-Za-z·*.]{1,}?第[一二三四五六七八九十百零0-9]+[季期站场轮]/)
  if (m) return m[0].trim()
  m = s.match(/第[一二三四五六七八九十百零0-9]+[季期站场轮]/)
  if (m) return m[0].trim()
  m = s.match(/^[^（(与和，,]+/)
  if (m) return m[0].trim().replace(/(新歌|主题曲|同名片尾.*|片尾.*|首演.*|收官.*|打样.*|致敬曲.*|成团.*|公演.*|总决赛.*|舞台.*)$/, '').trim()
  return ''
}

/** 解析一行 → { title, album, year, note } | null */
function parseLine(line) {
  // 去掉行首序号（1~3 位数字 + . ． 、，或单独的 . ．）
  let s = line.replace(/^\s*(\d{1,3}\s*)?[.．、]\s*/, '')
  // dated：YYYY.MM.DD(或 YYYY.MM) [ctx] 《title》 或 纯歌名
  let m = s.match(/^(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?\s+(.*)$/)
  if (m) {
    const [, Y, M, D, rest] = m
    const album = D ? `${Y}.${pad(M)}.${pad(D)}` : `${Y}.${pad(M)}`
    const tm = rest.match(/^(.*)《([^》]+)》\s*[^《]*$/)
    if (tm) return { title: tm[2].trim(), album, year: +Y, note: extractNote(tm[1]) }
    return { title: rest.trim(), album, year: +Y, note: '' }
  }
  // 音综 numbered：先取标题（（）或《》），年份从行首 YYYY年 取
  const ym = s.match(/^(\d{4})\s*年/)
  const Y = ym ? +ym[1] : null
  const album = Y ? String(Y) : ''
  let tm = s.match(/^(.*?)（([^）]+)）/) // （title）
  if (tm) return { title: tm[2].trim().replace(/^串烧[：:]\s*/, ''), album, year: Y, note: extractNote(tm[1]) }
  tm = s.match(/^(.*)《([^》]+)》\s*[^《]*$/) // 最后一个《title》
  if (tm) return { title: tm[2].trim(), album, year: Y, note: extractNote(tm[1]) }
  return null
}

const normTitle = (t) => TITLE_FIX[t] || t

// 文件排序：录音室在前（保证 zs-001.. 为录音室）
const files = readdirSync(dataDir)
  .filter((f) => f.toLowerCase().endsWith('.txt') || (f.includes('曲库') && !f.includes('.')))
  .sort((a, b) => (a.includes('录音室') ? -1 : b.includes('录音室') ? 1 : a.localeCompare(b)))
if (!files.length) {
  console.error('✗ data/ 下没有 .txt 曲库文件')
  process.exit(1)
}

let n = 0
const songs = []
const perFile = {}
const studioTitles = new Set() // 用于音综去重

for (const f of files) {
  const division = basename(f).replace(/\.txt$/i, '').replace(/曲库$/i, '').trim() || '未分类'
  let text = readFileSync(resolve(dataDir, f), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  let count = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^【\d{4}】/.test(line)) continue
    const r = parseLine(line)
    if (!r) continue
    let title = normTitle(r.title)
    if (division === '音综') {
      if (studioTitles.has(title)) continue // 与录音室同名 → 去重
      title = title + ' (Live)'
    } else {
      studioTitles.add(title)
    }
    songs.push({
      id: 'zs-' + String(++n).padStart(3, '0'),
      title,
      album: r.album,
      year: r.year,
      division,
      note: division === '音综' ? r.note : '',
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
writeFileSync(resolve(outDir, 'catalog.json'), JSON.stringify(out, null, 2) + '\n', 'utf8')

console.log(`✓ 摄取完成：共 ${songs.length} 首 → src/data/catalog.json`)
for (const [f, c] of Object.entries(perFile)) console.log(`  · ${f}: ${c} 首`)
