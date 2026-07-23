// 赛制自检 v5：R1 主动晋级 → 每轮赛后按赛程发卡救回(必须凑偶) → 八强补位 → 排位决赛(1~8)
// 运行: node scripts/selftest.ts

import { shuffle, chunk, randomPairs, elimRange, rescueCards } from '../src/engine/tournament.ts'

type FStage = 'qf' | 'place57sf' | 'sf' | 'place7' | 'place5' | 'place3' | 'final'
const rnd = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

interface Result {
  done: boolean
  ranks: (string | null)[]
  champion: string | null
  runnerUp: string | null
  semifinalIds: string[]
  steps: number
}

/** 复刻 store：R1 救回 + 各轮(赛后救回凑偶) + 八强排位决赛 */
function run(picks: string[], cuts: string[]): Result {
  let survivors = [...picks]
  let roundLosers = [...cuts]
  let roundPool = new Set(cuts)
  let roundNumber = 0
  let cards = 0
  const rescues: Record<string, number> = {}
  let steps = 0
  const GUARD = 500000

  // finale state
  let finaleActive = false
  let finaleSurvivors: string[] = []
  let fStage: FStage | null = null
  let fPairs: [string, string][] = []
  let fIdx = 0
  let fWinners: string[] = []
  let fLosers: string[] = []
  let fp: Record<string, string[]> = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] }
  let ranks: (string | null)[] = new Array(9).fill(null)
  let champion: string | null = null
  let runnerUp: string | null = null
  const semifinalIds: string[] = []
  let done = false

  const bump = (id: string, d: number) => {
    rescues[id] = Math.max(0, (rescues[id] || 0) + d)
  }

  function beginRescueStage() {
    cards = rescueCards(roundNumber, survivors.length)
  }
  /** 选一个合法救回数 R：使 survivors+R 为偶数 */
  function doRescue() {
    const sp = survivors.length % 2
    const opts: number[] = []
    for (let R = 0; R <= cards; R++) if (R % 2 === sp) opts.push(R)
    if (!opts.length) return
    const R = rnd(opts)
    const take = shuffle([...roundPool]).slice(0, R)
    for (const id of take) {
      survivors.push(id)
      roundPool.delete(id)
      bump(id, 1)
    }
    cards -= R
  }
  function fillToEight() {
    while (survivors.length < 8 && roundPool.size > 0) {
      const cand = [...roundPool].pop()!
      survivors.push(cand)
      roundPool.delete(cand)
      bump(cand, 1)
    }
  }
  function endRescue() {
    if (survivors.length <= 8) fillToEight()
    roundLosers = []
    roundPool = new Set()
    cards = 0
    if (survivors.length <= 8) {
      enterFinale()
    }
  }

  function startFStage(stage: FStage) {
    fStage = stage
    let input: string[] = []
    if (stage === 'qf') input = survivors
    else input = fp[{ place57sf: 'lf', sf: 'wf', place7: 'pl', place5: 'pw', place3: 'sl', final: 'ff' }[stage]!]
    fPairs = randomPairs(input)
    fIdx = 0
    fWinners = []
    fLosers = []
    if (fPairs.length === 0) fStageDone()
  }
  function fStageDone() {
    const w = [...fWinners]
    const l = [...fLosers]
    const st = fStage
    if (st === 'qf') { fp = { ...fp, wf: w, lf: l }; startFStage('place57sf') }
    else if (st === 'place57sf') { fp = { ...fp, pw: w, pl: l }; startFStage('sf') }
    else if (st === 'sf') { fp = { ...fp, ff: w, sl: l }; startFStage('place7') }
    else if (st === 'place7') { ranks[7] = w[0]; ranks[8] = l[0]; startFStage('place5') }
    else if (st === 'place5') { ranks[5] = w[0]; ranks[6] = l[0]; startFStage('place3') }
    else if (st === 'place3') { ranks[3] = w[0]; ranks[4] = l[0]; semifinalIds.push(w[0], l[0]); startFStage('final') }
    else if (st === 'final') { ranks[1] = w[0]; ranks[2] = l[0]; champion = w[0]; runnerUp = l[0]; finaleActive = false; done = true }
  }
  function playFinale() {
    finaleActive = true
    fp = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] }
    ranks = new Array(9).fill(null)
    startFStage('qf')
    while (!done && fPairs.length) {
      if (steps++ > GUARD) throw new Error('guard finale')
      const p = fPairs[fIdx]
      const winner = rnd(p)
      const loser = winner === p[0] ? p[1] : p[0]
      fWinners.push(winner)
      fLosers.push(loser)
      fIdx++
      if (fIdx >= fPairs.length) fStageDone()
    }
  }
  function enterFinale() {
    finaleSurvivors = [...survivors]
    if (new Set(finaleSurvivors).size !== finaleSurvivors.length) {
      console.log('  DEBUG finale survivors has dup:', JSON.stringify(finaleSurvivors))
    }
    playFinale()
  }

  function playRound(k: number) {
    if (steps++ > GUARD) throw new Error('guard round')
    roundNumber = k
    const pairs = randomPairs(survivors)
    const winners: string[] = []
    const losers: string[] = []
    for (const p of pairs) {
      const w = rnd(p)
      winners.push(w)
      losers.push(w === p[0] ? p[1] : p[0])
    }
    survivors = winners
    roundLosers = losers
    roundPool = new Set(losers)
    beginRescueStage()
    doRescue()
    endRescue()
    if (!done && survivors.length > 8) playRound(k + 1)
  }

  // R1 救回阶段（round 0）
  beginRescueStage()
  doRescue()
  endRescue()
  if (!done && survivors.length > 8) playRound(1)

  return { done, ranks, champion, runnerUp, semifinalIds, steps }
}

/** R1：n 首随机分 8 人组，每组主动晋级 [min,max] 首 */
function simulateR1(n: number): { picks: string[]; cuts: string[] } {
  const ids = Array.from({ length: n }, (_, i) => 's' + i)
  const groups = chunk(shuffle(ids), 8)
  const picks: string[] = []
  const cuts: string[] = []
  for (const g of groups) {
    const [mn, mx] = elimRange(g.length)
    const pickCount = mn + Math.floor(Math.random() * (mx - mn + 1))
    const pks = new Set(shuffle(g).slice(0, pickCount))
    for (const id of g) (pks.has(id) ? picks : cuts).push(id)
  }
  return { picks, cuts }
}

let fail = 0
let pass = 0
function assert(c: boolean, m: string) {
  if (c) pass++
  else { fail++; console.log('  ✗ ' + m) }
}

for (const n of [8, 16, 25, 50, 99, 150, 250, 400]) {
  for (let trial = 0; trial < 30; trial++) {
    const { picks, cuts } = simulateR1(n)
    const r = run(picks, cuts)
    assert(r.done, `[N=${n} #${trial}] 未终止`)
    assert(r.champion !== null, `[N=${n} #${trial}] 无冠军`)
    const top8 = r.ranks.slice(1, 9)
    assert(top8.every((x) => x !== null), `[N=${n} #${trial}] 1~8 名未排满`)
    assert(r.champion === r.ranks[1], `[N=${n} #${trial}] 冠军≠第1名`)
    assert(r.runnerUp === r.ranks[2], `[N=${n} #${trial}] 亚军≠第2名`)
    assert(
      r.semifinalIds.length === 2 &&
        r.semifinalIds.includes(r.ranks[3]!) &&
        r.semifinalIds.includes(r.ranks[4]!),
      `[N=${n} #${trial}] 四强≠3/4名`,
    )
    assert(new Set(top8 as string[]).size === 8, `[N=${n} #${trial}] 8名有重复`)
    assert(r.steps < 400000, `[N=${n} #${trial}] 步数异常`)
  }
}

assert(rescueCards(0, 10) === 10, 'rescueCards r1 even=10')
assert(rescueCards(0, 9) === 9, 'rescueCards r1 odd=9')
assert(rescueCards(1, 10) === 12, 'rescueCards r1pk even=12')
assert(rescueCards(1, 9) === 13, 'rescueCards r1pk odd=13')
assert(rescueCards(7, 9) === 1, 'rescueCards r7 odd=1')
assert(rescueCards(7, 10) === 0, 'rescueCards r7 even=0')

console.log(`\n共 ${pass + fail} 项断言：✓ ${pass}  ✗ ${fail}`)
console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
