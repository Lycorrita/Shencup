import type { Song } from '@/types'

/** 专辑 · 年份（接受任意含 album/year 的对象，兼容榜单条目） */
export function metaLine(s: { album?: string; year?: number | null }): string {
  const parts = [s.album, s.year ? String(s.year) : ''].filter(Boolean)
  return parts.join('  ·  ')
}

/** 词 X · 曲 Y · 编 Z · 制 W（跳过空值） */
export function creditsLine(s: Song): string {
  const parts: string[] = []
  if (s.lyricist) parts.push('词 ' + s.lyricist)
  if (s.composer) parts.push('曲 ' + s.composer)
  if (s.arranger) parts.push('编 ' + s.arranger)
  if (s.producer) parts.push('制 ' + s.producer)
  return parts.join('   ·   ')
}

export function hasCredits(s: Song): boolean {
  return !!(s.lyricist || s.composer || s.arranger || s.producer)
}
