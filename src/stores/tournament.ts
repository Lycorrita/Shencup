// Shencup · 赛事状态机（Pinia setup store）+ localStorage 续赛
//
// R1 缩圈：8 人/组，主动晋级 3~5（未选=当轮遗珠）。
// 赛后救回：每轮结束后按赛程发遗珠卡（见 engine.rescueCards），
//   从【当轮遗珠池】捞回（池不跨轮，过后清零；卡不累计）。
//   用户可不用完卡，但进入下一轮的曲目数【必须为偶数】。
// 八强（≤8）：遗珠补位至 8 → 排位决赛，排出精确 1~8 名。

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Song, Phase, RunSummary } from '@/types'
import catalog from '@/data/catalog.json'
import { shuffle, chunk, randomPairs, elimRange, rescueCards } from '@/engine/tournament'

const STORAGE_KEY = 'shencup:v6'
const GROUP_SIZE = 8
const FINALE_DUELS = 12

type KnockSub = 'rescue' | 'duel' | null
type FStage = 'qf' | 'place57sf' | 'sf' | 'place7' | 'place5' | 'place3' | 'final'

const STAGE_LABEL: Record<FStage, string> = {
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
  rescues: Record<string, number>
  roundRescuedIds: string[]
  marked: string[]
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
  semifinalIds: string[]
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
  const roundPool = ref<Set<string>>(new Set()) // 可捞回的集合

  // 淘汰赛
  const survivors = ref<string[]>([])
  const knockStart = ref(0)
  const roundNumber = ref(0) // 0 = 缩圈赛后救回阶段；1.. = pk 第几轮
  const knockSub = ref<KnockSub>(null)
  const pairs = ref<[string, string][]>([])
  const duelIndex = ref(0)
  const roundWinners = ref<string[]>([])
  const cards = ref(0)
  const rescues = ref<Record<string, number>>({})
  const roundRescuedIds = ref<Set<string>>(new Set())
  const markedIds = ref<Set<string>>(new Set()) // 全程标记（方便遗珠池查找）

  // 八强排位决赛
  const finaleActive = ref(false)
  const finaleDuelsDone = ref(0)
  const fStage = ref<FStage | null>(null)
  const fPairs = ref<[string, string][]>([])
  const fIdx = ref(0)
  const fWinners = ref<string[]>([])
  const fLosers = ref<string[]>([])
  const fp = ref<FPools>({ wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] })
  const ranks = ref<(string | null)[]>(new Array(9).fill(null))

  const championId = ref<string | null>(null)
  const runnerUpId = ref<string | null>(null)
  const semifinalIds = ref<string[]>([])
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
    rescues.value = {}
    roundRescuedIds.value = new Set()
    markedIds.value = new Set()
    finaleActive.value = false
    finaleDuelsDone.value = 0
    fStage.value = null
    fPairs.value = []
    fIdx.value = 0
    fWinners.value = []
    fLosers.value = []
    fp.value = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] }
    ranks.value = new Array(9).fill(null)
    championId.value = null
    runnerUpId.value = null
    semifinalIds.value = []
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
    // 重玩本轮：把本组之前的 cuts 从池里移除，重新打乱本组，清空选择
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
    roundNumber.value = 0 // 缩圈赛后救回阶段
    beginRescueStage()
  }

  /* ============ 赛后救回阶段 ============ */
  function beginRescueStage() {
    cards.value = rescueCards(roundNumber.value, survivors.value.length)
    roundRescuedIds.value = new Set()
    knockSub.value = 'rescue'
  }

  /** 救回：反复点选切换（误触可取消） */
  function rescue(id: string) {
    if (knockSub.value !== 'rescue') return
    if (roundRescuedIds.value.has(id)) {
      // 取消捞回
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

  /** 进入下一轮要求：剩余为偶数 */
  const canEndRescue = computed(() => survivors.value.length % 2 === 0)

  function endRescue() {
    if (!canEndRescue.value) return
    if (survivors.value.length <= 8) fillToEight()
    clearRoundPool()
    roundRescuedIds.value = new Set()
    cards.value = 0
    if (survivors.value.length <= 8) {
      enterFinale()
      return
    }
    startRound()
  }

  /** 八强补位：从当轮池补到 8 */
  function fillToEight() {
    while (survivors.value.length < 8 && roundPool.value.size > 0) {
      const cand = [...roundPool.value].pop()
      if (!cand) break
      survivors.value = [...survivors.value, cand]
      const s = new Set(roundPool.value)
      s.delete(cand)
      roundPool.value = s
      bumpRescue(cand, 1)
    }
  }

  /* ============ 淘汰赛轮 ============ */
  function startRound() {
    roundNumber.value++
    if (roundNumber.value === 1) knockStart.value = survivors.value.length
    // 防御：异常状态（如脏存档恢复）下队伍过小，直接进决赛，避免卡死
    if (survivors.value.length <= 1) {
      if (survivors.value.length === 1) {
        championId.value = survivors.value[0]
        phase.value = 'champion'
      }
      return
    }
    if (survivors.value.length <= 8) {
      enterFinale()
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
    const loser = winnerId === p[0] ? p[1] : p[0]
    roundWinners.value.push(winnerId)
    duelIndex.value++
    if (duelIndex.value >= pairs.value.length) endDuels()
  }

  function endDuels() {
    survivors.value = [...roundWinners.value]
    setRoundPool(pairs.value.flatMap((p) => [p[0], p[1]]).filter((id) => !roundWinners.value.includes(id)))
    beginRescueStage()
  }

  /* ---------- 八强排位决赛 ---------- */
  function enterFinale() {
    finaleActive.value = true
    finaleDuelsDone.value = 0
    fp.value = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] }
    ranks.value = new Array(9).fill(null)
    startFStage('qf')
  }

  function startFStage(stage: FStage) {
    fStage.value = stage
    let input: string[] = []
    if (stage === 'qf') input = survivors.value
    else if (stage === 'place57sf') input = fp.value.lf
    else if (stage === 'sf') input = fp.value.wf
    else if (stage === 'place7') input = fp.value.pl
    else if (stage === 'place5') input = fp.value.pw
    else if (stage === 'place3') input = fp.value.sl
    else if (stage === 'final') input = fp.value.ff
    fPairs.value = randomPairs(input)
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
    if (stage === 'qf') {
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
      semifinalIds.value = [w[0], l[0]]
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
    if (finaleActive.value) return `排位决赛 ${finaleDuelsDone.value}/${FINALE_DUELS}`
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
  const semifinalists = computed(() =>
    semifinalIds.value.map((id) => byId.value.get(id)!).filter(Boolean),
  )
  const ranking = computed(() =>
    ranks.value.slice(1, 9).map((id) => (id ? byId.value.get(id) || null : null)),
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

  const summary = computed<RunSummary>(() => ({
    championId: championId.value,
    runnerUpId: runnerUpId.value,
    semifinalIds: [...semifinalIds.value],
    rescues: { ...rescues.value },
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
      rescues: rescues.value,
      roundRescuedIds: [...roundRescuedIds.value],
      marked: [...markedIds.value],
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
      semifinalIds: semifinalIds.value,
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
    rescues.value = s.rescues || {}
    roundRescuedIds.value = new Set(s.roundRescuedIds || [])
    markedIds.value = new Set(s.marked || [])
    finaleActive.value = !!s.finaleActive
    finaleDuelsDone.value = s.finaleDuelsDone || 0
    fStage.value = (s.fStage as FStage) ?? null
    fPairs.value = s.fPairs || []
    fIdx.value = s.fIdx || 0
    fWinners.value = s.fWinners || []
    fLosers.value = s.fLosers || []
    fp.value = s.fp || { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] }
    ranks.value = s.ranks || new Array(9).fill(null)
    championId.value = s.championId ?? null
    runnerUpId.value = s.runnerUpId ?? null
    semifinalIds.value = s.semifinalIds || []
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
    rescues.value = {}
    roundRescuedIds.value = new Set()
    markedIds.value = new Set()
    finaleActive.value = false
    finaleDuelsDone.value = 0
    fStage.value = null
    fPairs.value = []
    fIdx.value = 0
    fWinners.value = []
    fLosers.value = []
    fp.value = { wf: [], lf: [], pw: [], pl: [], ff: [], sl: [] }
    ranks.value = new Array(9).fill(null)
    championId.value = null
    runnerUpId.value = null
    semifinalIds.value = []
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
      rescues,
      roundRescuedIds,
      markedIds,
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
      semifinalIds,
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
    // result
    champion,
    runnerUp,
    semifinalists,
    ranking,
    rescuedSongs,
    summary,
    // lifecycle
    hasProgress,
    resume,
    reset,
  }
})
