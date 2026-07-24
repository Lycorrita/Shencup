<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTournament } from '@/stores/tournament'
import { metaLine, noteLine, hasNote } from '@/lib/format'

const t = useTournament()

const duel = computed(() => t.currentDuel)
const duelKey = computed(() => `${t.roundNumber}-${t.duelIndex}-${t.fStage}-${t.fIdx}`)
const progWidth = computed(() => Math.round(t.progress * 100) + '%')

const rescueTitle = computed(() =>
  t.roundNumber === 0 ? '缩圈赛遗珠' : `第 ${t.roundNumber} 轮遗珠`,
)
const parityWord = computed(() => (t.survivors.length % 2 === 0 ? '偶数' : '奇数'))

// 救回 / 换入列表搜索
const rescueQuery = ref('')
const filteredRescue = computed(() => {
  const q = rescueQuery.value.trim().toLowerCase()
  const list = t.rescueCandidates
  const filtered = q ? list.filter((s) => s.title.toLowerCase().includes(q)) : list
  // 标记(★)的置顶
  return [...filtered].sort((a, b) => {
    const av = t.markedIds.has(a.id) ? 0 : 1
    const bv = t.markedIds.has(b.id) ? 0 : 1
    return av - bv
  })
})
watch(() => t.roundNumber, () => {
  rescueQuery.value = ''
})

// 换出（晋级者）搜索
const swapOutQuery = ref('')
const filteredSwapOut = computed(() => {
  const q = swapOutQuery.value.trim().toLowerCase()
  const list = t.swapOutCandidates
  return q ? list.filter((s) => s.title.toLowerCase().includes(q)) : list
})
const swapHint = computed(() => {
  if (t.finalApproach) return '十强收口轮：1 张换位卡，可换可不换'
  return `本轮 ${t.swapCards} 张换位卡，可换可不换`
})

// 选中后短暂停留，让用户看清胜负再翻页
const picking = ref<string | null>(null)
const lock = ref(false)
const LINGER = 480
function pickWithLinger(id: string) {
  if (lock.value || !duel.value) return
  picking.value = id
  lock.value = true
  window.setTimeout(() => {
    t.pick(id)
    picking.value = null
    lock.value = false
  }, LINGER)
}
</script>

<template>
  <section class="screen with-bar">
    <header class="kh">
      <span class="eyebrow">Knockout</span>
      <h2 class="brand-mark">{{ t.roundLabel }}</h2>
    </header>

    <!-- 进度条 -->
    <div class="prog-wrap">
      <div class="prog-top">
        <span>{{ t.progressText }}</span>
        <span v-if="duel" class="dim">本轮第 {{ t.duelInRound }} / {{ t.duelsInRound }} 场</span>
        <span v-else-if="t.knockSub === 'rescue'" class="card-badge">遗珠卡 ×{{ t.cards }}</span>
      </div>
      <div class="prog" :style="{ '--p': progWidth }"><i></i></div>
    </div>

    <div v-if="duel && t.canUndoPick" class="undo-bar">
      <button class="btn btn-ghost btn-xs" :disabled="lock" @click="t.undoPick">
        ↶ 返回上一步
      </button>
    </div>

    <Transition name="duel" mode="out-in">
      <!-- ① 对决 / 十强排位 -->
      <div v-if="duel && (t.knockSub === 'duel' || t.finaleActive)" :key="duelKey" class="duel">
        <div
          class="dcard"
          :class="{ win: picking === duel.a.id, lose: picking && picking !== duel.a.id, locked: lock }"
          @click="pickWithLinger(duel.a.id)"
        >
          <button
            class="dstar"
            :class="{ on: t.markedIds.has(duel.a.id) }"
            :aria-label="t.markedIds.has(duel.a.id) ? '取消标记' : '标记'"
            @click.stop="t.toggleMark(duel.a.id)"
          >★</button>
          <span class="didx num">01</span>
          <h3 class="dtitle">{{ duel.a.title }}</h3>
          <span class="dmeta">{{ metaLine(duel.a) }}</span>
          <span v-if="hasNote(duel.a)" class="dcred">{{ noteLine(duel.a) }}</span>
          <span class="dhint">{{ picking === duel.a.id ? '晋级' : '点击晋级 →' }}</span>
        </div>
        <div class="vs"><span class="brand-mark">VS</span></div>
        <div
          class="dcard"
          :class="{ win: picking === duel.b.id, lose: picking && picking !== duel.b.id, locked: lock }"
          @click="pickWithLinger(duel.b.id)"
        >
          <button
            class="dstar"
            :class="{ on: t.markedIds.has(duel.b.id) }"
            :aria-label="t.markedIds.has(duel.b.id) ? '取消标记' : '标记'"
            @click.stop="t.toggleMark(duel.b.id)"
          >★</button>
          <span class="didx num">02</span>
          <h3 class="dtitle">{{ duel.b.title }}</h3>
          <span class="dmeta">{{ metaLine(duel.b) }}</span>
          <span v-if="hasNote(duel.b)" class="dcred">{{ noteLine(duel.b) }}</span>
          <span class="dhint">{{ picking === duel.b.id ? '晋级' : '点击晋级 →' }}</span>
        </div>
      </div>

      <!-- ② 换位环节（自由交换：遗珠池换入 1，晋级者换出 1） -->
      <div v-else-if="t.knockSub === 'swap'" :key="'swap'" class="phase">
        <p class="phase-tip">
          换位环节 · <b class="gold-text">{{ swapHint }}</b><br />
          左侧选 1 首<strong>换出</strong>，右侧选 1 首<strong>换入</strong>，再点底部确认（不改人数，换入记 1 次捞回）。
        </p>
        <p class="parity">
          换位卡 <b class="num">{{ t.swapCards }}</b> · 已换 <b class="num">{{ t.roundSwaps.length }}</b> 次
        </p>

        <div class="swap-split">
          <div class="swap-pane">
            <div class="swap-head">换出 · 晋级者</div>
            <input class="swap-search" v-model="swapOutQuery" type="search" placeholder="搜索…" />
            <ul class="swap-list">
              <li
                v-for="s in filteredSwapOut"
                :key="s.id"
                class="swap-item"
                :class="{ picked: t.swapOut === s.id }"
                @click="t.selectSwapOut(s.id)"
              >
                <span class="si-title">{{ s.title }}</span>
                <span class="si-meta">{{ metaLine(s) }}</span>
              </li>
              <li v-if="!filteredSwapOut.length" class="swap-empty">无</li>
            </ul>
          </div>

          <div class="swap-pane">
            <div class="swap-head">换入 · 遗珠池</div>
            <input class="swap-search" v-model="rescueQuery" type="search" placeholder="搜索…" />
            <ul class="swap-list">
              <li
                v-for="s in filteredRescue"
                :key="s.id"
                class="swap-item"
                :class="{ picked: t.swapIn === s.id }"
                @click="t.selectSwapIn(s.id)"
              >
                <span class="si-title">{{ s.title }}</span>
                <span class="si-meta">{{ metaLine(s) }}</span>
              </li>
              <li v-if="!filteredRescue.length" class="swap-empty">无</li>
            </ul>
          </div>
        </div>

        <div class="swap-cta">
          <button class="btn btn-ghost btn-sm" :disabled="!t.roundSwaps.length" @click="t.undoLastSwap">
            撤回
          </button>
          <button class="btn btn-gold" :disabled="!t.canConfirmSwap" @click="t.confirmSwap">
            确认换位
          </button>
          <button class="btn btn-ghost btn-sm" @click="t.endSwap">下一步</button>
        </div>
      </div>

      <!-- ③ 赛后救回（可反复切换；十强收口需满 10，否则凑成偶数） -->
      <div v-else-if="t.knockSub === 'rescue'" :key="'rescue'" class="phase">
        <p class="phase-tip">
          {{ rescueTitle }}，还剩 <b class="gold-text">{{ t.cards }}</b> 张遗珠卡（不累计）。点选捞回，<b>再点取消</b>。
        </p>
        <p class="parity" :class="{ ok: t.canEndRescue }">
          <template v-if="t.finalApproach">
            十强收口：当前 <b class="num">{{ t.survivors.length }}</b> 首
            <template v-if="!t.canEndRescue"> — 再捞回 {{ 10 - t.survivors.length }} 首凑满 10</template>
            <template v-else> — 已满 10，可进入十强角逐</template>
          </template>
          <template v-else>
            当前 <b class="num">{{ t.survivors.length }}</b> 首 · {{ parityWord }}
            <template v-if="!t.canEndRescue"> — 再捞回或取消 1 首凑成偶数</template>
            <template v-else> — 可进入下一轮</template>
          </template>
        </p>
        <div class="rescue-search">
          <input
            v-model="rescueQuery"
            type="search"
            :placeholder="`搜索 ${t.rescueCandidates.length} 首遗珠…`"
          />
        </div>
        <ul class="pick-list">
          <li
            v-for="s in filteredRescue"
            :key="s.id"
            class="prow"
            :class="{ rescued: t.roundRescuedIds.has(s.id), marked: t.markedIds.has(s.id) }"
            @click="t.rescue(s.id)"
          >
            <span class="pname">{{ s.title }}</span>
            <span class="pmeta">{{ metaLine(s) }}</span>
            <span class="phint">
              <button
                class="star"
                :class="{ on: t.markedIds.has(s.id) }"
                :aria-label="t.markedIds.has(s.id) ? '取消标记' : '标记'"
                @click.stop="t.toggleMark(s.id)"
              >★</button>
              <span>{{ t.roundRescuedIds.has(s.id) ? '已捞回 · 点取消' : '捞回 →' }}</span>
            </span>
          </li>
          <li v-if="!filteredRescue.length" class="pempty">无匹配曲目</li>
        </ul>
        <div class="rescue-cta">
          <button class="btn btn-gold btn-block" :disabled="!t.canEndRescue" @click="t.endRescue()">
            {{ t.finalApproach ? '进入十强角逐' : '下一轮' }}
          </button>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.kh {
  text-align: center;
  margin-bottom: 14px;
}
.kh .eyebrow {
  display: block;
  margin-bottom: 8px;
}
.kh h2 {
  font-size: 28px;
  letter-spacing: 0.12em;
}

.prog-wrap {
  margin-bottom: 22px;
}
.undo-bar {
  display: flex;
  justify-content: flex-end;
  margin: -14px 0 18px;
}
.btn-xs {
  padding: 5px 12px;
  font-size: 11px;
}
.prog-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  color: var(--dim);
  letter-spacing: 0.04em;
  margin-bottom: 7px;
}
.dim {
  color: var(--dim-2);
}
.prog {
  height: 1px;
  background: var(--line-soft);
  position: relative;
  overflow: hidden;
}
.prog > i {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--p, 0%);
  background: var(--gold);
  transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.card-badge {
  padding: 2px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  color: var(--gold);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.phase-tip {
  text-align: center;
  color: var(--dim);
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 10px;
}
.parity {
  text-align: center;
  font-size: 12.5px;
  color: var(--dim-2);
  margin-bottom: 18px;
}
.parity b {
  font-size: 15px;
  color: var(--paper);
}
.parity.ok b {
  color: var(--gold);
}

.pick-list {
  list-style: none;
}
.prow {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 6px 12px;
  padding: 14px 12px 14px 16px;
  border-bottom: 1px solid var(--line-soft);
  cursor: pointer;
  transition: background 0.18s;
}
.prow:active,
.prow:hover {
  background: var(--ink-2);
}
.pname {
  font-size: 16px;
  font-weight: 600;
  grid-column: 1;
}
.pmeta {
  font-size: 12px;
  color: var(--dim-2);
  grid-column: 1;
}
.phint {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--gold);
  letter-spacing: 0.06em;
}
.prow.rescued {
  background: var(--ink-3);
}
.prow.rescued::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--gold);
}
.prow.rescued .pname {
  color: var(--gold-bright);
}
/* 标记(★)：未捞回时淡金底，已标记的行在列表里置顶 */
.prow.marked:not(.rescued) {
  background: rgba(201, 169, 106, 0.06);
}
.prow .star {
  font-size: 14px;
  line-height: 1;
  color: var(--dim-3);
  transition: color 0.15s, transform 0.15s;
}
.prow .star:active {
  transform: scale(0.85);
}
.prow .star.on {
  color: var(--gold);
}
/* 对决卡角标 ★ */
.dstar {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 3;
  font-size: 16px;
  line-height: 1;
  color: var(--dim-3);
  transition: color 0.15s, transform 0.15s;
}
.dstar:active {
  transform: scale(0.85);
}
.dstar.on {
  color: var(--gold);
}

.rescue-cta {
  margin-top: 22px;
}

/* 换位环节 · 左右双栏 */
.swap-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}
.swap-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.swap-head {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--gold-2);
  margin-bottom: 6px;
}
.swap-search {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 9px;
  background: var(--ink-2);
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
  color: var(--paper);
  font-size: 12px;
  margin-bottom: 6px;
}
.swap-search::placeholder {
  color: var(--dim-3);
}
.swap-list {
  list-style: none;
  height: 230px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--ink-2);
  border: 1px solid var(--line-soft);
  border-radius: var(--r-sm);
  padding: 4px;
}
.swap-item {
  padding: 8px 8px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s;
}
.swap-item:active,
.swap-item:hover {
  background: var(--ink-3);
}
.swap-item.picked {
  background: var(--ink-3);
  box-shadow: inset 2px 0 0 var(--gold);
}
.swap-item.picked .si-title {
  color: var(--gold-bright);
}
.si-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.si-meta {
  display: block;
  font-size: 10px;
  color: var(--dim-2);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.swap-empty {
  padding: 16px;
  text-align: center;
  color: var(--dim-3);
  font-size: 12px;
}
.swap-cta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.swap-cta .btn-gold {
  flex: 1;
}

/* 对决卡 */
.duel {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 10px;
}
.dcard {
  position: relative;
  text-align: left;
  min-height: 230px;
  padding: 22px 18px 18px;
  background: var(--ink-2);
  border: 1px solid var(--line-soft);
  border-radius: var(--r-md);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.18s, border-color 0.2s, background 0.2s, opacity 0.25s, filter 0.25s;
  overflow: hidden;
}
.dcard::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
  transition: background 0.2s;
}
.dcard:active {
  transform: scale(0.985);
}
.dcard:hover:not(.locked) {
  border-color: var(--line);
  background: var(--ink-3);
}
.dcard:hover:not(.locked)::before {
  background: var(--gold);
}
.dcard.win {
  border-color: var(--gold);
  background: var(--ink-3);
  transform: scale(1.02);
  box-shadow: 0 0 0 1px var(--gold), 0 14px 38px -14px var(--gold-soft);
}
.dcard.win::before {
  background: var(--gold);
}
.dcard.win .dhint {
  opacity: 1;
  color: var(--gold);
}
.dcard.lose {
  opacity: 0.32;
  filter: saturate(0.4);
  transform: scale(0.97);
}
.didx {
  font-size: 13px;
  color: var(--gold-2);
  letter-spacing: 0.1em;
}
.dtitle {
  font-size: 21px;
  font-weight: 700;
  line-height: 1.25;
  margin-top: 2px;
}
.dmeta {
  font-size: 12px;
  color: var(--dim);
  margin-top: auto;
}
.dcred {
  font-size: 11px;
  color: var(--dim-2);
}
.dhint {
  position: absolute;
  right: 14px;
  bottom: 12px;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--dim-3);
  opacity: 0;
  transition: opacity 0.2s;
}
.dcard:hover .dhint {
  opacity: 1;
  color: var(--gold);
}
.vs {
  display: grid;
  place-items: center;
  font-size: 14px;
  color: var(--gold);
  letter-spacing: 0.1em;
}
.vs span {
  background: var(--ink);
  padding: 6px 0;
}

@media (min-width: 760px) {
  .duel {
    gap: 18px;
  }
  .dcard {
    min-height: 280px;
    padding: 28px 24px;
  }
  .dtitle {
    font-size: 26px;
  }
}
</style>
