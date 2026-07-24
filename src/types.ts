// Shencup · 数据与赛事类型

/** 一首曲目（无封面、无试听，纯元数据） */
export interface Song {
  id: string
  title: string
  album: string
  year: number | null
  /** 赛道：录音室 / 音综 / … */
  division: string
  /** 备注：如音综曲目的「《节目》第X期」来源信息 */
  note: string
  /** 热度 0–100（仅用于展示排序，不参与对阵） */
  seed: number
}

/** 赛事阶段 */
export type Phase = 'home' | 'groups' | 'knockout' | 'champion'

/** 一局结束的汇总（用于上报全局榜单与结果页） */
export interface RunSummary {
  /** 本局唯一标识（= 开赛时间戳），用于后端按局去重 */
  runId: number
  championId: string | null
  runnerUpId: string | null
  /** 十强（精确 1~10 名，index 0 = 冠军） */
  top10Ids: string[]
  /** 每首歌本局被捞回的次数（复活 + 换位 累计） */
  rescues: Record<string, number>
  /** 每个 PK 轮的入场阵容（早→晚），用于结算页梯队展示 */
  tiers: string[][]
}

export interface Catalog {
  artist: string
  generatedAt: string
  songs: Song[]
}
