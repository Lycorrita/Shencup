// 赛制自检 v7：换位 + 十强收口 + 十强决赛(精确 1~10) + 发卡表 + 全流程收敛
// 运行: node scripts/selftest.ts   (Node 22+ 内置类型擦除，无需编译)
//
// 三组检查：
//   1) rescueCards / swapCards 发卡表与文档一致
//   2) 十强决赛：任意 10 首必能排出唯一且完整的 1~10 名
//   3) 全流程：从缩圈后到十强收口必收敛、无死锁、收口时赢家 n<=10

import { shuffle, randomPairs, rescueCards, swapCards } from '../src/engine/tournament.ts'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

/* ---------- 1) 发卡表 ---------- */
// rescueCards(round, count)：e=偶 / o=奇
const RESCUE = [
  [0, 228, 20], [0, 227, 19],
  [1, 114, 16], [1, 113, 17],
  [2, 60, 12], [2, 59, 11],
  [3, 30, 10], [3, 29, 11],
  [4, 24, 6], [4, 23, 7],
  [5, 20, 6], [5, 19, 5],
  [6, 16, 4], [6, 15, 5],
  [7, 12, 2], [7, 11, 3],
  [8, 10, 2], [8, 9, 1],
] as const
for (const [r, c, expect] of RESCUE) {
  check(`rescueCards(${r},${c})=${expect}`, rescueCards(r as number, c as number) === expect, `got ${rescueCards(r as number, c as number)}`)
}
check('swapCards(0)=0 (缩圈无换位)', swapCards(0) === 0)
check('swapCards(1..3)=5', [1, 2, 3].every((r) => swapCards(r) === 5))
check('swapCards(4..5)=3', [4, 5].every((r) => swapCards(r) === 3))
check('swapCards(6+)=1', [6, 7, 9, 20].every((r) => swapCards(r) === 1))

/* ---------- 2) 十强决赛：1~10 唯一完整 ---------- */
// 复刻 store 的 fStage 流转
function runFinale(input: string[]): (string | null)[] {
  const ranks: (string | null)[] = new Array(11).fill(null)
  const fp: Record<string, string[]> = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [], byes: [], q8: [] }
  let stage = 'playin'
  let fPairs: string[][] = []
  let fW: string[] = []
  let fL: string[] = []

  const start = (st: string) => {
    let inp: string[] = []
    if (st === 'playin') inp = input
    else if (st === 'place9') inp = fp.lf
    else if (st === 'qf') inp = fp.q8
    else if (st === 'place57sf') inp = fp.lf
    else if (st === 'sf') inp = fp.wf
    else if (st === 'place7') inp = fp.pl
    else if (st === 'place5') inp = fp.pw
    else if (st === 'place3') inp = fp.sl
    else if (st === 'final') inp = fp.ff
    if (st === 'playin') {
      const a = shuffle(inp)
      fp.byes = a.slice(4)
      fPairs = [[a[0], a[1]], [a[2], a[3]]]
    } else {
      fPairs = randomPairs(inp)
    }
    fW = []
    fL = []
  }
  const done = () => {
    const w = [...fW]
    const l = [...fL]
    const s = stage
    if (s === 'playin') { fp.q8 = [...w, ...fp.byes]; fp.lf = l; stage = 'place9'; start('place9'); return }
    if (s === 'place9') { ranks[9] = w[0]; ranks[10] = l[0]; stage = 'qf'; start('qf'); return }
    if (s === 'qf') { fp.wf = w; fp.lf = l; stage = 'place57sf'; start('place57sf'); return }
    if (s === 'place57sf') { fp.pw = w; fp.pl = l; stage = 'sf'; start('sf'); return }
    if (s === 'sf') { fp.ff = w; fp.sl = l; stage = 'place7'; start('place7'); return }
    if (s === 'place7') { ranks[7] = w[0]; ranks[8] = l[0]; stage = 'place5'; start('place5'); return }
    if (s === 'place5') { ranks[5] = w[0]; ranks[6] = l[0]; stage = 'place3'; start('place3'); return }
    if (s === 'place3') { ranks[3] = w[0]; ranks[4] = l[0]; stage = 'final'; start('final'); return }
    if (s === 'final') { ranks[1] = w[0]; ranks[2] = l[0]; stage = ''; return }
  }

  start('playin')
  let guard = 0
  while (stage && guard++ < 100) {
    for (const p of fPairs) { fW.push(p[0]); fL.push(p[1]) }
    done()
  }
  return ranks
}

for (let i = 0; i < 500; i++) {
  const input = Array.from({ length: 10 }, (_, k) => 's' + k)
  const r = runFinale(input)
  const placed = r.slice(1, 11) as string[]
  check(`finale #${i} 完整`, placed.every(Boolean))
  check(`finale #${i} 唯一`, new Set(placed).size === 10)
  check(`finale #${i} 属于输入`, placed.every((x) => input.includes(x)))
}

/* ---------- 3) 全流程收敛 ---------- */
function play(startN: number) {
  let survivors = Array.from({ length: startN }, (_, k) => 's' + k)
  let round = 0
  let guard = 0
  let finalN: number | null = null
  while (guard++ < 200) {
    round++
    const pairs = randomPairs(survivors)
    const winners = pairs.map((p) => p[Math.random() < 0.5 ? 0 : 1])
    const n = winners.length
    if (n <= 10) { finalN = n; break }
    // 换位不改人数；复活用最少卡凑偶
    const cards = rescueCards(round, n)
    if (n % 2 === 1) {
      if (cards < 1) return { deadlock: true }
      winners.push('POOL')
    }
    survivors = winners
  }
  return { finalN, rounds: round }
}

let deadlock = 0
let badEntry = 0
for (let i = 0; i < 300; i++) {
  const r = play(228)
  if ((r as any).deadlock) deadlock++
  else if (!(r as any).finalN >= 2 || !((r as any).finalN <= 10)) badEntry++
}
check('全流程无死锁', deadlock === 0, `${deadlock}/300`)
check('十强收口 n∈[2,10]', badEntry === 0, `${badEntry}/300`)

/* ---------- 汇总 ---------- */
console.log(`\nselftest v7: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
