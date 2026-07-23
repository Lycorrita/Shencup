// Shencup · 结果图导出（Canvas，墨金版式）
// 八强排位决赛后：精确 1~8 名 + 本局救回的遗珠。

import type { Song } from '@/types'

export interface ExportInput {
  artist: string
  ranking: (Song | null)[] // index 0 = 第1名
  rescued: { song: Song; count: number }[]
  date: string
  site?: string
}

const COLORS = {
  ink: '#0E0E10',
  paper: '#F2F0EA',
  gold: '#C9A96A',
  gold2: '#B8965A',
  dim: 'rgba(242,240,234,.6)',
  dim2: 'rgba(242,240,234,.34)',
  soft: 'rgba(201,169,106,.22)',
}

const F = {
  brand: '700 24px "PingFang SC", "Microsoft YaHei", sans-serif',
  micro: '600 10px "PingFang SC", "Microsoft YaHei", sans-serif',
  eyebrow: '600 11px "PingFang SC", "Microsoft YaHei", sans-serif',
  title: '700 36px "PingFang SC", "Microsoft YaHei", sans-serif',
  meta: '13px "PingFang SC", "Microsoft YaHei", sans-serif',
  cred: '11px "PingFang SC", "Microsoft YaHei", sans-serif',
  tier: '700 12px "PingFang SC", "Microsoft YaHei", sans-serif',
  song: '15px "PingFang SC", "Microsoft YaHei", sans-serif',
  foot: '10px "PingFang SC", "Microsoft YaHei", sans-serif',
}

const POS = ['冠军', '亚军', '季军', '第 4 名', '第 5 名', '第 6 名', '第 7 名', '第 8 名']

function metaOf(s: Song): string {
  return [s.album, s.year ? String(s.year) : ''].filter(Boolean).join('  ·  ')
}
function credOf(s: Song): string {
  return [
    s.lyricist && '词 ' + s.lyricist,
    s.composer && '曲 ' + s.composer,
    s.arranger && '编 ' + s.arranger,
    s.producer && '制 ' + s.producer,
  ]
    .filter(Boolean)
    .join('   ·   ')
}

export async function renderResultImage(input: ExportInput): Promise<string> {
  const scale = 2
  const W = 540
  const padX = 42
  const cw = W - padX * 2
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')!

  const wrap = (text: string, font: string, maxW: number): string[] => {
    ctx.font = font
    const out: string[] = []
    for (const para of String(text).split('\n')) {
      if (para === '') {
        out.push('')
        continue
      }
      let line = ''
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          out.push(line)
          line = ch
        } else line += ch
      }
      out.push(line)
    }
    return out
  }

  function layout(draw: boolean): number {
    let y = 0
    const setLS = (v: string) => {
      if ('letterSpacing' in ctx) (ctx as any).letterSpacing = v
    }
    const text = (
      str: string,
      font: string,
      color: string,
      o: { lh: number; x?: number; ls?: number; align?: 'left' | 'right' | 'center'; mb?: number } = { lh: 18 },
    ) => {
      const { lh, x = padX, ls = 0, align = 'left', mb = 0 } = o
      const lines = wrap(str, font, cw)
      if (draw) {
        ctx.font = font
        ctx.fillStyle = color
        ctx.textAlign = align
        ctx.textBaseline = 'top'
        setLS(ls + 'px')
        const sx = align === 'center' ? W / 2 : align === 'right' ? padX + cw : x
        lines.forEach((ln, i) => ctx.fillText(ln, sx, y + i * lh))
        setLS('0px')
      }
      y += lines.length * lh + mb
    }
    const line = (color: string) => {
      if (draw) {
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padX, y + 0.5)
        ctx.lineTo(padX + cw, y + 0.5)
        ctx.stroke()
      }
      y += 1
    }
    /** 排位行：名次(金) + 曲名(纸白) 同行 */
    const rankRow = (posLabel: string, title: string, meta: string) => {
      if (draw) {
        ctx.textBaseline = 'top'
        ctx.font = F.tier
        ctx.fillStyle = COLORS.gold
        ctx.textAlign = 'left'
        setLS('1px')
        ctx.fillText(posLabel, padX, y)
        setLS('0px')
        ctx.font = F.song
        ctx.fillStyle = COLORS.paper
        ctx.fillText(title, padX + 78, y)
        if (meta) {
          ctx.font = F.foot
          ctx.fillStyle = COLORS.dim2
          ctx.fillText(meta, padX + 78, y + 16)
        }
      }
      y += meta ? 34 : 26
    }

    y += 40
    text('Shencup', F.brand, COLORS.gold, { lh: 26 })
    text(`SHENCUP  ·  ${input.date}`, F.micro, COLORS.dim2, { lh: 14, ls: 2, mb: 20 })
    line(COLORS.gold)
    y += 22

    const champ = input.ranking[0]
    if (champ) {
      text('CHAMPION', F.eyebrow, COLORS.gold2, { lh: 16, ls: 3, mb: 12 })
      text(champ.title, F.title, COLORS.paper, { lh: 44, mb: 8 })
      if (metaOf(champ)) text(metaOf(champ), F.meta, COLORS.dim, { lh: 18, mb: 6 })
      if (credOf(champ)) text(credOf(champ), F.cred, COLORS.dim2, { lh: 18, mb: 22 })
    }

    line(COLORS.soft)
    y += 18
    text('最 终 排 位', F.tier, COLORS.gold, { lh: 18, ls: 3, mb: 10 })
    for (let i = 1; i < input.ranking.length; i++) {
      const s = input.ranking[i]
      if (!s) continue
      rankRow(POS[i] || `第 ${i + 1} 名`, s.title, metaOf(s))
    }
    y += 6

    if (input.rescued.length) {
      line(COLORS.soft)
      y += 16
      text('本局遗珠之选', F.tier, COLORS.gold, { lh: 18, ls: 3, mb: 8 })
      text(
        input.rescued.map((r) => `${r.song.title} ×${r.count}`).join('   ·   '),
        F.song,
        COLORS.paper,
        { lh: 24, mb: 16 },
      )
    }

    y += 4
    line(COLORS.soft)
    y += 16
    text(input.site || 'Shencup · 周深全曲库对决 · 非官方粉丝作品', F.foot, COLORS.dim2, { lh: 14 })
    y += 40
    return y
  }

  const H = layout(false)
  cv.width = W * scale
  cv.height = H * scale
  ctx.scale(scale, scale)
  ctx.fillStyle = COLORS.ink
  ctx.fillRect(0, 0, W, H)
  layout(true)

  return cv.toDataURL('image/png')
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
