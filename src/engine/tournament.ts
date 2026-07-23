// Shencup · 赛事引擎（纯函数）
// 赛制：R1 随机 8 人分组缩圈（淘汰 3~5）→ 每轮随机两两 PK + 遗珠卡复活 → 四强起无卡。
// 不用固定签表，避免路径偏见导致的遗珠。

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 把数组切成 size 大小的若干块（最后一块可能更小） */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** 随机两两配对；若为奇数，最后一个不进对（由调用方处理轮空） */
export function randomPairs(ids: string[]): [string, string][] {
  const a = shuffle(ids)
  const pairs: [string, string][] = []
  for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]])
  return pairs
}

/** 每组可淘汰的 [最少, 最多] 首（保证每组至少留 3 首） */
export function elimRange(groupSize: number): [number, number] {
  const maxElim = Math.min(5, Math.max(0, groupSize - 3))
  const minElim = Math.min(3, maxElim)
  return [Math.max(1, minElim), Math.max(1, maxElim)]
}

/** 上榜积分（用于全局榜单加权；遗珠按被捞回次数计） */
export const TIER_POINTS = {
  champion: 10,
  runnerUp: 6,
  semifinal: 4,
  rescue: 1,
} as const

/**
 * 每轮赛后发放的遗珠卡数（按轮次 + 赛后剩余奇偶）。
 * round：0=缩圈赛后，1..6=pk 第 1..6 轮后；>=7 仅奇数补偶发 1。
 * count：该轮赛后剩余曲目数（决定奇偶）。
 */
const CARD_TABLE: Record<number, { e: number; o: number }> = {
  0: { e: 10, o: 9 },
  1: { e: 12, o: 13 },
  2: { e: 8, o: 7 },
  3: { e: 6, o: 7 },
  4: { e: 4, o: 3 },
  5: { e: 2, o: 3 },
  6: { e: 2, o: 1 },
}

export function rescueCards(round: number, count: number): number {
  const par = count % 2 === 0 ? 'e' : 'o'
  if (round >= 7) return par === 'o' ? 1 : 0
  return CARD_TABLE[round]?.[par] ?? 0
}
