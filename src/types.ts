// Shencup · 数据与赛事类型

/** 一首曲目（无封面、无试听，纯元数据） */
export interface Song {
  id: string
  title: string
  album: string
  year: number | null
  /** 赛道：录音室 / Live / OST / 翻唱 / 巡演 */
  division: string
  /** 词 */
  lyricist: string
  /** 曲 */
  composer: string
  /** 编 */
  arranger: string
  /** 制 */
  producer: string
  /** 热度 0–100（仅用于展示排序，不参与对阵） */
  seed: number
}

/** 赛事阶段 */
export type Phase = 'home' | 'groups' | 'knockout' | 'champion'

/** 一局结束的汇总（用于上报全局榜单与结果页） */
export interface RunSummary {
  championId: string | null
  runnerUpId: string | null
  semifinalIds: string[]
  /** 每首歌本局被遗珠卡捞回的次数 */
  rescues: Record<string, number>
}

export interface Catalog {
  artist: string
  generatedAt: string
  songs: Song[]
}
