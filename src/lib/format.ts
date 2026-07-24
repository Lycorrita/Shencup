import type { Song } from '@/types'

/** 专辑 · 年份（接受任意含 album/year 的对象；若专辑名已含年份则不重复） */
export function metaLine(s: { album?: string; year?: number | null }): string {
  const album = s.album || ''
  const year = s.year ? String(s.year) : ''
  const parts = [album, album.includes(year) ? '' : year].filter(Boolean)
  return parts.join('  ·  ')
}

/** 备注（如音综来源「《节目》第X期」） */
export function noteLine(s: { note?: string }): string {
  return (s.note || '').trim()
}

export function hasNote(s: { note?: string }): boolean {
  return !!(s.note && s.note.trim())
}
