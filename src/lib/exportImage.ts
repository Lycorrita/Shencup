// Shencup · 结果图导出（Canvas，墨金版式）
// 十强排位决赛后：冠军 + 十强(带捞回) + 第一/第二梯队 + 遗珠Top10 + 二维码。

import QRCode from 'qrcode'
import type { Song } from '@/types'

export interface ExportInput {
  artist: string
  champion: Song
  /** 十强 1~10 名（index 0 = 冠军），各带捞回次数 */
  top10: { song: Song; revives: number }[]
  /** 皇族：十强中捞回次数最少的前三 */
  royalty: { song: Song; revives: number }[]
  tier1: Song[] // 第一梯队
  tier2: Song[] // 第二梯队
  rescuedTop10: { song: Song; count: number }[]
  date: string
  qrUrl: string
}

const QR_SIZE = 72

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

function metaOf(s: Song): string {
  return [s.album, s.year ? String(s.year) : ''].filter(Boolean).join('  ·  ')
}
function noteOf(s: Song): string {
  return (s.note || '').trim()
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function renderResultImage(input: ExportInput): Promise<string> {
  const scale = 2
  const W = 540
  const padX = 42
  const cw = W - padX * 2
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')!

  // 预生成二维码
  let qrImg: HTMLImageElement | null = null
  try {
    const qrSrc = await QRCode.toDataURL(input.qrUrl, { margin: 1, width: QR_SIZE * scale, color: { dark: '#F2F0EA', light: '#00000000' } })
    qrImg = await loadImg(qrSrc)
  } catch {
    qrImg = null
  }

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

  function layout(draw: boolean, qr: HTMLImageElement | null): number {
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
    /** 行：名次(金) + 曲名(纸白) + 捞回(金小)。alwaysShow=true 时 0 也显示（用于皇族）。 */
    const rankRow = (posLabel: string, title: string, revives: number, alwaysShow = false) => {
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
        const t = ctx.measureText(title).width
        ctx.fillText(title, padX + 64, y)
        if (revives > 0 || alwaysShow) {
          ctx.font = F.foot
          ctx.fillStyle = COLORS.gold2
          ctx.textAlign = 'right'
          ctx.fillText(`捞回 ×${revives}`, padX + cw, y + 2)
          ctx.textAlign = 'left'
        }
        void t
      }
      y += 24
    }
    /** 梯队：曲名串行换行 */
    const tierBlock = (label: string, songs: Song[]) => {
      text(label, F.tier, COLORS.gold, { lh: 18, ls: 3, mb: 8 })
      text(
        songs.map((s) => s.title).join('   ·   ') || '—',
        F.song,
        COLORS.paper,
        { lh: 22, mb: 14 },
      )
    }

    y += 40
    text('Shencup', F.brand, COLORS.gold, { lh: 26 })
    text(`SHENCUP  ·  ${input.date}`, F.micro, COLORS.dim2, { lh: 14, ls: 2, mb: 20 })
    line(COLORS.gold)
    y += 22

    // 冠军
    const champ = input.champion
    text('CHAMPION', F.eyebrow, COLORS.gold2, { lh: 16, ls: 3, mb: 12 })
    text(champ.title, F.title, COLORS.paper, { lh: 44, mb: 8 })
    if (metaOf(champ)) text(metaOf(champ), F.meta, COLORS.dim, { lh: 18, mb: 6 })
    if (noteOf(champ)) text(noteOf(champ), F.cred, COLORS.dim2, { lh: 18, mb: 22 })

    // 十强（1~10，带捞回）
    line(COLORS.soft)
    y += 18
    text('十  强', F.tier, COLORS.gold, { lh: 18, ls: 3, mb: 10 })
    for (let i = 0; i < input.top10.length; i++) {
      const it = input.top10[i]
      if (!it || !it.song) continue
      const label = i === 0 ? '冠' : i === 1 ? '亚' : i === 2 ? '季' : `${i + 1}`
      rankRow(label, it.song.title, it.revives)
    }
    y += 6

    // 皇族：十强中捞回最少前三（捞回 0 也显示）
    if (input.royalty.length) {
      line(COLORS.soft)
      y += 16
      text('皇 族 · 十强中捞回最少', F.tier, COLORS.gold, { lh: 18, ls: 3, mb: 10 })
      const RL = ['一', '二', '三']
      input.royalty.forEach((r, i) => {
        if (r && r.song) rankRow(RL[i] || String(i + 1), r.song.title, r.revives, true)
      })
      y += 6
    }

    // 双梯队
    if (input.tier1.length) {
      line(COLORS.soft)
      y += 16
      tierBlock('第 一 梯 队（倒数第一轮）', input.tier1)
    }
    if (input.tier2.length) {
      tierBlock('第 二 梯 队（倒数第二轮）', input.tier2)
    }

    // 遗珠 Top10
    if (input.rescuedTop10.length) {
      line(COLORS.soft)
      y += 16
      text('遗珠捞回 Top 10', F.tier, COLORS.gold, { lh: 18, ls: 3, mb: 8 })
      text(
        input.rescuedTop10.map((r) => `${r.song.title} ×${r.count}`).join('   ·   '),
        F.song,
        COLORS.paper,
        { lh: 22, mb: 16 },
      )
    }

    // 页脚 + 二维码
    y += 4
    line(COLORS.soft)
    y += 16
    const footH = Math.max(34, qr ? QR_SIZE + 4 : 34)
    if (draw && qr) {
      ctx.drawImage(qr, W - padX - QR_SIZE, y, QR_SIZE, QR_SIZE)
    }
    if (draw) {
      ctx.font = F.foot
      ctx.fillStyle = COLORS.dim2
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('Shencup · 周深全曲库对决', padX, y + 6)
      ctx.fillText('非官方粉丝作品', padX, y + 22)
    }
    y += footH
    y += 36
    return y
  }

  const H = layout(false, qrImg)
  cv.width = W * scale
  cv.height = H * scale
  ctx.scale(scale, scale)
  ctx.fillStyle = COLORS.ink
  ctx.fillRect(0, 0, W, H)
  layout(true, qrImg)

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
