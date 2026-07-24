// Shencup · 赛事状态机（Pinia setup store）+ localStorage 续赛
//
// R1 缩圈：8 人/组，主动晋级 3~5（未选=当轮遗珠）。
// PK 轮流程：duel（两两对决）→ swap（换位，自由交换 1 进 1 出，不改人数）→ rescue（遗珠卡捞回，改人数）。
//   卡（换位/遗珠）均不强制使用完；非十强收口轮要求剩余为偶数。
// 十强收口：某轮 duel 后赢家 n≤10 即进入十强角逐——n==10 发 1 换位卡直进；
//   n<10 发 1 换位卡 +(10−n) 遗珠卡补满 10。
// 十强决赛：附加赛(10→8) + 9/10 名赛 + 现有八强排位，精确排出 1~10 名。
// 「捞回次数」= 复活 + 换位累计（统一记入 rescues）。

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Song, Phase, RunSummary } from '@/types'
import catalog from '@/data/catalog.json'
import { shuffle, chunk, randomPairs, elimRange, rescueCards, swapCards as swapCardsForRound } from '@/engine/tournament'

const STORAGE_KEY = 'shencup:v7'
const GROUP_SIZE = 8
const FINALE_DUELS = 15 // 附加赛2 + 9/10名赛1 + 八强排位12

type KnockSub = 'rescue' | 'swap' | 'duel' | null
type FStage = 'playin' | 'place9' | 'qf' | 'place57sf' | 'sf' | 'place7' | 'place5' | 'place3' | 'final'

const STAGE_LABEL: Record<FStage, string> = {
  playin: '十强附加赛',
  place9: '第 9 名赛',
  qf: '八 强',
  place57sf: '5-8 名次赛',
  sf: '半 决 赛',
  place7: '第 7 名赛',
  place5: '第 5 名赛',
  place3: '季 军 赛',
  final: '决 赛',
}

interface FPools {
  wf: string[]
  lf: string[]
  pw: string[]
  pl: string[]
  ff: string[]
  sl: string[]
  byes: string[]
  q8: string[]
}

interface SwapRec {
  in: string
  out: string
}

interface Snapshot {
  phase: Phase
  groups: string[][]
  groupIndex: number
  groupPicks: string[]
  roundLosers: string[]
  roundPool: string[]
  survivors: string[]
  knockStart: number
  roundNumber: number
  knockSub: KnockSub
  pairs: [string, string][]
  duelIndex: number
  roundWinners: string[]
  cards: number
  swapCards: number
  roundSwaps: SwapRec[]
  swapIn: string | null
  swapOut: string | null
  finalApproach: boolean
  rescues: Record<string, number>
  roundRescuedIds: string[]
  marked: string[]
  tiers: string[][]
  finaleActive: boolean
  finaleDuelsDone: number
  fStage: FStage | null
  fPairs: [string, string][]
  fIdx: number
  fWinners: string[]
  fLosers: string[]
  fp: FPools
  ranks: (string | null)[]
  championId: string | null
  runnerUpId: string | null
  startedAt: number
}

export const useTournament = defineStore('tournament', () => {
  const artist = ref<string>(catalog.artist || '周深')
  const songs = ref<Song[]>((catalog.songs as Song[]) || [])
  const byId = computed(() => new Map(songs.value.map((s) => [s.id, s])))

  const phase = ref<Phase>('home')

  // R1
  const groups = ref<string[][]>([])
  const groupIndex = ref(0)
  const groupPicks = ref<Set<string>>(new Set())

  // 当轮遗珠池（不跨轮）
  const roundLosers = ref<string[]>([]) // 稳定列表（展示用）
  const roundPool = ref<Set<string>>(new Set()) // 可捞回/换入的集合

  // 淘汰赛
  const survivors = ref<string[]>([])
  const knockStart = ref(0)
  const roundNumber = ref(0) // 0 = 缩圈赛后救回阶段；1.. = pk 第几轮
  const knockSub = ref<KnockSub>(null)
  const pairs = ref<[string, string][]>([])
  const duelIndex = ref(0)
  const roundWinners = ref<string[]>([])
  const cards = ref(0) // 遗珠卡
  const swapCards = ref(0) // 换位卡
  const roundSwaps = ref<SwapRec[]>([])
  const swapIn = ref<string | null>(null)
  const swapOut = ref<string | null>(null)
  const finalApproach = ref(false) // 本轮是否为十强收口轮
  const rescues = ref<Record<string, number>>({}) // 捞回次数（复活+换位）
  const roundRescuedIds = ref<Set<string>>(new Set())
  const markedIds = ref<Set<string>>(new Set())
  const tiers = ref<string[][]>([]) // 每个 PK 轮的入场阵容（早→晚）

  // 十强排位决赛
  const finaleActive = ref(false)
  const finaleDuelsDone = ref(0)
  const fStage = ref<FStage | null>(null)
  const fPairs = ref<[string, string][]>([])
  const fIdx = ref(0)
  const fWinners = ref<string[]>([])
  const fLosers = ref<string[]>([])
  const fp = ref<FPools>({ wf: [], lf: [], pw: [], pl: [], ff: [], sl: [], byes: [], q8: [] })
  const ranks = ref<(string | null)[]>(new Array(11).fill(null))

  const championId = ref<string | null>(null)
  const runnerUpId = ref<string | null>(null)
  const startedAt = ref(0)

  const setRoundPool = (ids: string[]) => {
    roundLosers.value = ids
    roundPool.value = new Set(ids)
  }
  const clearRoundPool = () => {
    roundLosers.value = []
    roundPool.value = new Set()
  }
  const bumpRescue = (id: string, delta: number) => {
    rescues.value = { ...rescues.value, [id]: Math.max(0, (rescues.value[id] || 0) + delta) }
  }
  const toggleRoundRescue = (id: string, on: boolean) => {
    const s = new Set(roundRescuedIds.value)
    if (on) s.add(id)
    else s.delete(id)
    roundRescuedIds.value = s
  }
  function toggleMark(id: string) {
    const s = new Set(markedIds.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    markedIds.value = s
  }

  /* ============ 第一轮 · 缩圈（主动晋级 3~5） ============ */
  const currentGroupIds = computed(() => groups.value[groupIndex.value] || [])
  const groupSongs = computed(() =>
    currentGroupIds.value.map((id) => byId.value.get(id)!).filter(Boolean),
  )
  const groupSize = computed(() => currentGroupIds.value.length)
  const pickMinMax = computed(() => elimRange(groupSize.value))
  const groupPickCount = computed(() => groupPicks.value.size)
  const canConfirmGroup = computed(
    () =>
      groupPickCount.value >= pickMinMax.value[0] && groupPickCount.value <= pickMinMax.value[1],
  )
  const groupProgressText = computed(() => `${groupIndex.value + 1} / ${groups.value.length}`)

  function start() {
    const ids = songs.value.map((s) => s.id)
    groups.value = chunk(shuffle(ids), GROUP_SIZE)
    groupIndex.value = 0
    groupPicks.value = new Set()
    clearRoundPool()
    survivors.value = []
    knockStart.value = 0
    roundNumber.value = 0
    knockSub.value = null
    pairs.value = []
    duelIndex.value = 0
    roundWinners.value = []
    cards.value = 0
    swapCards.value = 0
    roundSwaps.value = []
    swapIn.value = null
    swapOut.value = null
    finalApproach.value = false
    rescues.value = {}
    roundRescuedIds.value = new Set()
    markedIds.value = new Set()
    tiers.value = []
    finaleActive.value = false
    finaleDuelsDone.value = 0
    fStage.value = null
    fPairs.value = []
    fIdx.value = 0
    fWinners.value = []
    fLosers.value = []
    fp.value = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [], byes: [], q8: [] }
    ranks.value = new Array(11).fill(null)
    championId.value = null
    runnerUpId.value = null
    startedAt.value = Date.now()
    phase.value = 'groups'
  }

  function toggleGroupPick(id: string) {
    const s = new Set(groupPicks.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    groupPicks.value = s
  }

  function confirmGroup() {
    const picks = [...groupPicks.value]
    survivors.value = [...survivors.value, ...picks]
    // 未选 → 当轮遗珠池（R1 阶段累积，赛后一次性救回）
    const cuts = currentGroupIds.value.filter((id) => !groupPicks.value.has(id))
    setRoundPool([...roundLosers.value, ...cuts])
    groupIndex.value++
    groupPicks.value = new Set()
    if (groupIndex.value >= groups.value.length) enterKnockout()
  }

  function replayGroup() {
    const idx = groupIndex.value
    const cur = groups.value[idx]
    const curCuts = new Set(cur.filter((id) => !groupPicks.value.has(id)))
    setRoundPool(roundLosers.value.filter((id) => !curCuts.has(id)))
    const next = groups.value.slice()
    next[idx] = shuffle(cur)
    groups.value = next
    groupPicks.value = new Set()
  }

  function enterKnockout() {
    survivors.value = shuffle(survivors.value)
    roundNumber.value = 0 // 缩圈赛后救回阶段（无换位）
    finalApproach.value = false
    phase.value = 'knockout'
    beginRescueStage()
  }

  /* ============ 赛后救回阶段 ============ */
  function beginRescueStage() {
    // 十强收口轮：补到 10；否则按赛程发遗珠卡
    cards.value = finalApproach.value
      ? Math.max(0, 10 - survivors.value.length)
      : rescueCards(roundNumber.value, survivors.value.length)
    roundRescuedIds.value = new Set()
    knockSub.value = 'rescue'
  }

  /** 救回：反复点选切换（误触可取消）。候选列表 roundLosers 保持稳定，已捞回的仍高亮、再点取消。 */
  function rescue(id: string) {
    if (knockSub.value !== 'rescue') return
    if (roundRescuedIds.value.has(id)) {
      survivors.value = survivors.value.filter((x) => x !== id)
      roundPool.value = new Set([...roundPool.value, id])
      bumpRescue(id, -1)
      cards.value = cards.value + 1
      toggleRoundRescue(id, false)
    } else if (cards.value > 0 && roundPool.value.has(id)) {
      survivors.value = [...survivors.value, id]
      const s = new Set(roundPool.value)
      s.delete(id)
      roundPool.value = s
      bumpRescue(id, 1)
      cards.value = cards.value - 1
      toggleRoundRescue(id, true)
    }
  }

  /** 进入下一阶段：十强收口轮要求正好 10；否则偶数 */
  const canEndRescue = computed(() =>
    finalApproach.value ? survivors.value.length === 10 : survivors.value.length % 2 === 0,
  )

  function endRescue() {
    if (!canEndRescue.value) return
    clearRoundPool()
    roundRescuedIds.value = new Set()
    cards.value = 0
    if (finalApproach.value) {
      enterFinale()
      return
    }
    startRound()
  }

  /* ============ 换位阶段（PK 轮 duel 之后、rescue 之前） ============ */
  function beginSwapStage() {
    swapCards.value = finalApproach.value ? 1 : swapCardsForRound(roundNumber.value)
    roundSwaps.value = []
    swapIn.value = null
    swapOut.value = null
    knockSub.value = 'swap'
  }

  function selectSwapIn(id: string) {
    if (knockSub.value !== 'swap' || !roundPool.value.has(id)) return
    swapIn.value = swapIn.value === id ? null : id
  }
  function selectSwapOut(id: string) {
    if (knockSub.value !== 'swap' || !survivors.value.includes(id)) return
    swapOut.value = swapOut.value === id ? null : id
  }
  const canConfirmSwap = computed(
    () => swapCards.value > 0 && !!swapIn.value && !!swapOut.value && swapIn.value !== swapOut.value,
  )
  function confirmSwap() {
    if (!canConfirmSwap.value) return
    const inId = swapIn.value!
    const outId = swapOut.value!
    // 晋级者：outId → inId
    survivors.value = survivors.value.map((id) => (id === outId ? inId : id))
    // 池：移除 inId，加入 outId
    const newPool = [...roundPool.value].filter((x) => x !== inId)
    newPool.push(outId)
    setRoundPool(newPool)
    bumpRescue(inId, 1) // 换入记 1 次捞回
    swapCards.value = swapCards.value - 1
    roundSwaps.value = [...roundSwaps.value, { in: inId, out: outId }]
    swapIn.value = null
    swapOut.value = null
  }
  function undoLastSwap() {
    const last = roundSwaps.value[roundSwaps.value.length - 1]
    if (!last) return
    const inId = last.in
    const outId = last.out
    survivors.value = survivors.value.map((id) => (id === inId ? outId : id))
    const newPool = [...roundPool.value].filter((x) => x !== outId)
    newPool.push(inId)
    setRoundPool(newPool)
    bumpRescue(inId, -1)
    swapCards.value = swapCards.value + 1
    roundSwaps.value = roundSwaps.value.slice(0, -1)
    swapIn.value = null
    swapOut.value = null
  }
  function endSwap() {
    beginRescueStage()
  }

  /* ============ 淘汰赛轮 ============ */
  function startRound() {
    roundNumber.value++
    if (roundNumber.value === 1) knockStart.value = survivors.value.length
    tiers.value = [...tiers.value, [...survivors.value]] // 记录该轮入场阵容（梯队）
    // 防御：异常状态下直接决出冠军，避免卡死
    if (survivors.value.length <= 1) {
      if (survivors.value.length === 1) {
        championId.value = survivors.value[0]
        phase.value = 'champion'
      }
      return
    }
    pairs.value = randomPairs(survivors.value) // 进入轮必为偶数
    duelIndex.value = 0
    roundWinners.value = []
    knockSub.value = 'duel'
    if (pairs.value.length === 0) endDuels()
  }

  function pick(winnerId: string) {
    if (finaleActive.value) return fPick(winnerId)
    if (knockSub.value !== 'duel') return
    const p = pairs.value[duelIndex.value]
    if (!p) return
    roundWinners.value.push(winnerId)
    duelIndex.value++
    if (duelIndex.value >= pairs.value.length) endDuels()
  }

  /** 返回上一步：撤销当前轮/当前决赛阶段内最近一次对决选择（防误触） */
  const canUndoPick = computed(() =>
    finaleActive.value ? fIdx.value > 0 : knockSub.value === 'duel' && duelIndex.value > 0,
  )
  function undoPick() {
    if (finaleActive.value) {
      if (fIdx.value > 0) {
        fIdx.value--
        fWinners.value = fWinners.value.slice(0, -1)
        fLosers.value = fLosers.value.slice(0, -1)
        finaleDuelsDone.value = Math.max(0, finaleDuelsDone.value - 1)
      }
      return
    }
    if (knockSub.value === 'duel' && duelIndex.value > 0) {
      duelIndex.value--
      roundWinners.value = roundWinners.value.slice(0, -1)
    }
  }

  function endDuels() {
    survivors.value = [...roundWinners.value]
    setRoundPool(
      pairs.value.flatMap((p) => [p[0], p[1]]).filter((id) => !roundWinners.value.includes(id)),
    )
    // 本轮对决赢家 n：≤10 即十强收口轮
    finalApproach.value = survivors.value.length <= 10
    beginSwapStage()
  }

  /* ---------- 十强排位决赛 ---------- */
  function enterFinale() {
    finaleActive.value = true
    finaleDuelsDone.value = 0
    fp.value = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [], byes: [], q8: [] }
    ranks.value = new Array(11).fill(null)
    startFStage('playin')
  }

  function startFStage(stage: FStage) {
    fStage.value = stage
    let input: string[] = []
    if (stage === 'playin') input = survivors.value
    else if (stage === 'place9') input = fp.value.lf
    else if (stage === 'qf') input = fp.value.q8
    else if (stage === 'place57sf') input = fp.value.lf
    else if (stage === 'sf') input = fp.value.wf
    else if (stage === 'place7') input = fp.value.pl
    else if (stage === 'place5') input = fp.value.pw
    else if (stage === 'place3') input = fp.value.sl
    else if (stage === 'final') input = fp.value.ff

    if (stage === 'playin') {
      // 10 首：随机取 4 打 2 场，余 6 轮空
      const a = shuffle(input)
      const fighters = a.slice(0, 4)
      fp.value = { ...fp.value, byes: a.slice(4) }
      fPairs.value = [
        [fighters[0], fighters[1]],
        [fighters[2], fighters[3]],
      ]
    } else {
      fPairs.value = randomPairs(input)
    }
    fIdx.value = 0
    fWinners.value = []
    fLosers.value = []
    if (fPairs.value.length === 0) fStageDone()
  }

  function fPick(winnerId: string) {
    const p = fPairs.value[fIdx.value]
    if (!p) return
    const loser = winnerId === p[0] ? p[1] : p[0]
    fWinners.value.push(winnerId)
    fLosers.value.push(loser)
    fIdx.value++
    finaleDuelsDone.value = finaleDuelsDone.value + 1
    if (fIdx.value >= fPairs.value.length) fStageDone()
  }

  function fStageDone() {
    const w = [...fWinners.value]
    const l = [...fLosers.value]
    const stage = fStage.value
    if (stage === 'playin') {
      // 2 胜 + 6 轮空 → 八强；2 败 → 9/10 名赛
      fp.value = { ...fp.value, q8: [...w, ...fp.value.byes], lf: l }
      startFStage('place9')
    } else if (stage === 'place9') {
      ranks.value = setRank(ranks.value, 9, w[0])
      ranks.value = setRank(ranks.value, 10, l[0])
      startFStage('qf')
    } else if (stage === 'qf') {
      fp.value = { ...fp.value, wf: w, lf: l }
      startFStage('place57sf')
    } else if (stage === 'place57sf') {
      fp.value = { ...fp.value, pw: w, pl: l }
      startFStage('sf')
    } else if (stage === 'sf') {
      fp.value = { ...fp.value, ff: w, sl: l }
      startFStage('place7')
    } else if (stage === 'place7') {
      ranks.value = setRank(ranks.value, 7, w[0])
      ranks.value = setRank(ranks.value, 8, l[0])
      startFStage('place5')
    } else if (stage === 'place5') {
      ranks.value = setRank(ranks.value, 5, w[0])
      ranks.value = setRank(ranks.value, 6, l[0])
      startFStage('place3')
    } else if (stage === 'place3') {
      ranks.value = setRank(ranks.value, 3, w[0])
      ranks.value = setRank(ranks.value, 4, l[0])
      startFStage('final')
    } else if (stage === 'final') {
      ranks.value = setRank(ranks.value, 1, w[0])
      ranks.value = setRank(ranks.value, 2, l[0])
      championId.value = w[0]
      runnerUpId.value = l[0]
      finaleActive.value = false
      phase.value = 'champion'
    }
  }

  function setRank(arr: (string | null)[], pos: number, id: string | undefined) {
    const next = [...arr]
    next[pos] = id ?? null
    return next
  }

  /* ---------- 视图 getter ---------- */
  const currentDuel = computed(() => {
    if (finaleActive.value) {
      const p = fPairs.value[fIdx.value]
      if (!p) return null
      const a = byId.value.get(p[0])
      const b = byId.value.get(p[1])
      return a && b ? { a, b } : null
    }
    if (knockSub.value !== 'duel') return null
    const p = pairs.value[duelIndex.value]
    if (!p) return null
    const a = byId.value.get(p[0])
    const b = byId.value.get(p[1])
    return a && b ? { a, b } : null
  })

  const roundLabel = computed(() => {
    if (finaleActive.value && fStage.value) return STAGE_LABEL[fStage.value]
    if (roundNumber.value === 0) return '缩 圈 遗 珠'
    return `第 ${roundNumber.value} 轮`
  })

  const progress = computed(() => {
    if (phase.value === 'champion') return 1
    if (phase.value !== 'knockout') return 0
    if (finaleActive.value) {
      const start = knockStart.value > 1 ? (knockStart.value - 8) / (knockStart.value - 1) : 0
      return Math.max(0, Math.min(1, start + (finaleDuelsDone.value / FINALE_DUELS) * (1 - start)))
    }
    return knockStart.value > 1
      ? Math.max(0, Math.min(1, (knockStart.value - survivors.value.length) / (knockStart.value - 1)))
      : 0
  })
  const progressText = computed(() => {
    if (finaleActive.value) return `十强排位 ${finaleDuelsDone.value}/${FINALE_DUELS}`
    if (roundNumber.value === 0) return `剩余 ${survivors.value.length}`
    return `剩余 ${survivors.value.length} / ${knockStart.value}`
  })
  const duelInRound = computed(() => (finaleActive.value ? fIdx.value : duelIndex.value) + 1)
  const duelsInRound = computed(() => (finaleActive.value ? fPairs.value.length : pairs.value.length))

  const champion = computed(() =>
    championId.value ? byId.value.get(championId.value) || null : null,
  )
  const runnerUp = computed(() =>
    runnerUpId.value ? byId.value.get(runnerUpId.value) || null : null,
  )
  /** 精确 1~10 名（index 0 = 冠军） */
  const ranking = computed(() =>
    ranks.value.slice(1, 11).map((id) => (id ? byId.value.get(id) || null : null)),
  )
  const rescuedSongs = computed(() =>
    Object.entries(rescues.value)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({ song: byId.value.get(id)!, count: n }))
      .filter((x) => x.song),
  )
  const rescueCandidates = computed(() =>
    roundLosers.value.map((id) => byId.value.get(id)!).filter(Boolean),
  )
  /** 换出候选 = 当前晋级者 */
  const swapOutCandidates = computed(() =>
    survivors.value.map((id) => byId.value.get(id)!).filter(Boolean),
  )

  function revivesOf(id: string) {
    return rescues.value[id] || 0
  }
  /** 皇族：十强内按捞回次数升序前三 */
  const royaltyTop3 = computed(() => {
    const ids = ranks.value.slice(1, 11).filter(Boolean) as string[]
    return ids
      .map((id) => ({ song: byId.value.get(id)!, revives: rescues.value[id] || 0 }))
      .filter((x) => x.song)
      .sort((a, b) => a.revives - b.revives)
      .slice(0, 3)
  })
  /** 梯队（每个 PK 轮入场阵容，早→晚） */
  const allTiers = computed(() => tiers.value)
  const tier1 = computed(() => tiers.value[tiers.value.length - 1] || []) // 倒数第一轮
  const tier2 = computed(() => tiers.value[tiers.value.length - 2] || []) // 倒数第二轮

  const summary = computed<RunSummary>(() => ({
    runId: startedAt.value,
    championId: championId.value,
    runnerUpId: runnerUpId.value,
    top10Ids: ranks.value.slice(1, 11).filter((x): x is string => !!x),
    rescues: { ...rescues.value },
    tiers: tiers.value.map((t) => [...t]),
  }))

  const hasProgress = computed(() => phase.value !== 'home')

  /* ---------- 持久化 ---------- */
  function snapshot(): Snapshot {
    return {
      phase: phase.value,
      groups: groups.value,
      groupIndex: groupIndex.value,
      groupPicks: [...groupPicks.value],
      roundLosers: roundLosers.value,
      roundPool: [...roundPool.value],
      survivors: survivors.value,
      knockStart: knockStart.value,
      roundNumber: roundNumber.value,
      knockSub: knockSub.value,
      pairs: pairs.value,
      duelIndex: duelIndex.value,
      roundWinners: roundWinners.value,
      cards: cards.value,
      swapCards: swapCards.value,
      roundSwaps: roundSwaps.value,
      swapIn: swapIn.value,
      swapOut: swapOut.value,
      finalApproach: finalApproach.value,
      rescues: rescues.value,
      roundRescuedIds: [...roundRescuedIds.value],
      marked: [...markedIds.value],
      tiers: tiers.value,
      finaleActive: finaleActive.value,
      finaleDuelsDone: finaleDuelsDone.value,
      fStage: fStage.value,
      fPairs: fPairs.value,
      fIdx: fIdx.value,
      fWinners: fWinners.value,
      fLosers: fLosers.value,
      fp: fp.value,
      ranks: ranks.value,
      championId: championId.value,
      runnerUpId: runnerUpId.value,
      startedAt: startedAt.value,
    }
  }

  function hydrate(s: Snapshot) {
    phase.value = s.phase
    groups.value = s.groups || []
    groupIndex.value = s.groupIndex || 0
    groupPicks.value = new Set(s.groupPicks || [])
    roundLosers.value = s.roundLosers || []
    roundPool.value = new Set(s.roundPool || [])
    survivors.value = s.survivors || []
    knockStart.value = s.knockStart || 0
    roundNumber.value = s.roundNumber || 0
    knockSub.value = s.knockSub ?? null
    pairs.value = s.pairs || []
    duelIndex.value = s.duelIndex || 0
    roundWinners.value = s.roundWinners || []
    cards.value = s.cards || 0
    swapCards.value = s.swapCards || 0
    roundSwaps.value = s.roundSwaps || []
    swapIn.value = s.swapIn ?? null
    swapOut.value = s.swapOut ?? null
    finalApproach.value = !!s.finalApproach
    rescues.value = s.rescues || {}
    roundRescuedIds.value = new Set(s.roundRescuedIds || [])
    markedIds.value = new Set(s.marked || [])
    tiers.value = s.tiers || []
    finaleActive.value = !!s.finaleActive
    finaleDuelsDone.value = s.finaleDuelsDone || 0
    fStage.value = (s.fStage as FStage) ?? null
    fPairs.value = s.fPairs || []
    fIdx.value = s.fIdx || 0
    fWinners.value = s.fWinners || []
    fLosers.value = s.fLosers || []
    fp.value = s.fp || { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [], byes: [], q8: [] }
    ranks.value = s.ranks || new Array(11).fill(null)
    championId.value = s.championId ?? null
    runnerUpId.value = s.runnerUpId ?? null
    startedAt.value = s.startedAt || 0
  }

  function persist() {
    if (phase.value === 'home') {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
    } catch {
      /* quota */
    }
  }

  function resume(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const s = JSON.parse(raw) as Snapshot
      if (!s || !s.phase || s.phase === 'home') return false
      hydrate(s)
      return true
    } catch {
      return false
    }
  }

  function reset() {
    phase.value = 'home'
    groups.value = []
    groupIndex.value = 0
    groupPicks.value = new Set()
    clearRoundPool()
    survivors.value = []
    knockStart.value = 0
    roundNumber.value = 0
    knockSub.value = null
    pairs.value = []
    duelIndex.value = 0
    roundWinners.value = []
    cards.value = 0
    swapCards.value = 0
    roundSwaps.value = []
    swapIn.value = null
    swapOut.value = null
    finalApproach.value = false
    rescues.value = {}
    roundRescuedIds.value = new Set()
    markedIds.value = new Set()
    tiers.value = []
    finaleActive.value = false
    finaleDuelsDone.value = 0
    fStage.value = null
    fPairs.value = []
    fIdx.value = 0
    fWinners.value = []
    fLosers.value = []
    fp.value = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [], byes: [], q8: [] }
    ranks.value = new Array(11).fill(null)
    championId.value = null
    runnerUpId.value = null
    startedAt.value = 0
    localStorage.removeItem(STORAGE_KEY)
  }

  watch(
    [
      phase,
      groups,
      groupIndex,
      groupPicks,
      roundLosers,
      roundPool,
      survivors,
      knockStart,
      roundNumber,
      knockSub,
      pairs,
      duelIndex,
      roundWinners,
      cards,
      swapCards,
      roundSwaps,
      swapIn,
      swapOut,
      finalApproach,
      rescues,
      roundRescuedIds,
      markedIds,
      tiers,
      finaleActive,
      finaleDuelsDone,
      fStage,
      fPairs,
      fIdx,
      fWinners,
      fLosers,
      fp,
      ranks,
      championId,
      runnerUpId,
    ],
    persist,
    { deep: true },
  )

  return {
    artist,
    songs,
    byId,
    phase,
    // R1
    groups,
    groupIndex,
    groupPicks,
    currentGroupIds,
    groupSongs,
    groupSize,
    pickMinMax,
    groupPickCount,
    canConfirmGroup,
    groupProgressText,
    start,
    toggleGroupPick,
    confirmGroup,
    replayGroup,
    // rescue
    roundLosers,
    roundPool,
    cards,
    roundRescuedIds,
    rescueCandidates,
    rescue,
    canEndRescue,
    endRescue,
    markedIds,
    toggleMark,
    // swap
    swapCards,
    roundSwaps,
    swapIn,
    swapOut,
    swapOutCandidates,
    canConfirmSwap,
    selectSwapIn,
    selectSwapOut,
    confirmSwap,
    undoLastSwap,
    endSwap,
    finalApproach,
    // knockout
    survivors,
    knockStart,
    roundNumber,
    knockSub,
    duelIndex,
    finaleActive,
    finaleDuelsDone,
    fStage,
    fIdx,
    currentDuel,
    roundLabel,
    progress,
    progressText,
    duelInRound,
    duelsInRound,
    pick,
    undoPick,
    canUndoPick,
    // result
    champion,
    runnerUp,
    ranking,
    rescuedSongs,
    royaltyTop3,
    allTiers,
    tier1,
    tier2,
    revivesOf,
    summary,
    // lifecycle
    hasProgress,
    resume,
    reset,
  }
})
