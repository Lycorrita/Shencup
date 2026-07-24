<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTournament } from '@/stores/tournament'
import { metaLine, noteLine, hasNote } from '@/lib/format'

const t = useTournament()
const router = useRouter()

const list = computed(() => t.groupSongs)
const rangeText = computed(() => {
  const [a, b] = t.pickMinMax
  return a === b ? `${a} 首` : `${a}~${b} 首`
})
const progWidth = computed(() => {
  const [, b] = t.pickMinMax
  return Math.round((Math.min(t.groupPickCount, b) / b) * 100) + '%'
})

// 二次确认弹窗
const confirm = ref<null | 'replay' | 'restart'>(null)
const confirmText = computed(() =>
  confirm.value === 'replay'
    ? { title: '重玩本轮？', body: '将清空本组的选择并重新打乱本组顺序。' }
    : { title: '重新开始？', body: '将放弃当前所有进度，回到首页重新开始。' },
)
function doConfirm() {
  if (confirm.value === 'replay') t.replayGroup()
  else if (confirm.value === 'restart') {
    t.reset()
    router.push('/')
  }
  confirm.value = null
}
</script>

<template>
  <section class="screen with-bar with-cta">
    <header class="page-head">
      <span class="eyebrow">Round 01 · 缩圈</span>
      <h1>第一轮 · 缩圈</h1>
      <p>
        每组 8 首，点选 <b class="gold-text">{{ rangeText }}</b> 首<b class="gold-text">晋级</b>；<br />
        未选的进入遗珠池，之后可用复活卡捞回。
      </p>
      <p class="hint">遇到不得不淘汰的，可点 <b>★</b> 标记，之后在遗珠池里会置顶高亮。</p>
    </header>

    <div class="meter">
      <div class="meter-top">
        <span>第 <b class="num gold-text">{{ t.groupIndex + 1 }}</b> / {{ t.groups.length }} 组</span>
        <span class="dim">已晋级 {{ t.groupPickCount }} / {{ rangeText }}</span>
      </div>
      <div class="prog" :style="{ '--p': progWidth }"><i></i></div>
    </div>

    <ol class="g-list">
      <li
        v-for="(s, i) in list"
        :key="s.id"
        class="row"
        :class="{ picked: t.groupPicks.has(s.id) }"
        @click="t.toggleGroupPick(s.id)"
      >
        <span class="idx num">{{ String(i + 1).padStart(2, '0') }}</span>
        <div class="info">
          <span class="title">{{ s.title }}</span>
          <span class="meta">{{ metaLine(s) }}</span>
          <span v-if="hasNote(s)" class="cred">{{ noteLine(s) }}</span>
        </div>
        <div class="right">
          <button
            class="star"
            :class="{ on: t.markedIds.has(s.id) }"
            :aria-label="t.markedIds.has(s.id) ? '取消标记' : '标记，便于遗珠池查找'"
            @click.stop="t.toggleMark(s.id)"
          >★</button>
          <span v-if="t.groupPicks.has(s.id)" class="pk">晋级 ✓</span>
        </div>
      </li>
    </ol>

    <div class="bottom-fixed">
      <button class="btn btn-gold btn-block" :disabled="!t.canConfirmGroup" @click="t.confirmGroup()">
        {{ t.groupIndex + 1 >= t.groups.length ? '进入淘汰赛' : '确认 · 下一组' }}
      </button>
      <div class="sec-row">
        <button class="btn btn-ghost btn-sm" @click="confirm = 'replay'">重玩本轮</button>
        <button class="btn btn-ghost btn-sm" @click="confirm = 'restart'">重新开始</button>
      </div>
    </div>

    <!-- 二次确认 -->
    <div v-if="confirm" class="modal" @click.self="confirm = null">
      <div class="confirm-box">
        <h4>{{ confirmText.title }}</h4>
        <p>{{ confirmText.body }}</p>
        <div class="row-btns">
          <button class="btn btn-ghost" @click="confirm = null">取消</button>
          <button class="btn btn-gold" @click="doConfirm">确认</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.meter {
  margin-bottom: 14px;
}
.meter-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12.5px;
  color: var(--dim);
  margin-bottom: 8px;
}
.meter-top b {
  font-size: 16px;
}
.dim {
  color: var(--dim-2);
}

.g-list {
  list-style: none;
}
.row {
  position: relative;
  display: grid;
  grid-template-columns: 34px 1fr auto;
  align-items: baseline;
  gap: 12px;
  padding: 15px 12px 15px 16px;
  border-bottom: 1px solid var(--line-soft);
  cursor: pointer;
  transition: background 0.18s, opacity 0.18s;
}
.row:active {
  background: var(--ink-2);
}
/* 选中（晋级）：提亮 + 金色左边条 + 微底色 */
.row.picked {
  background: var(--ink-3);
}
.row.picked::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--gold);
}
.idx {
  font-size: 15px;
  color: var(--dim-2);
  font-weight: 600;
}
.row.picked .idx {
  color: var(--gold);
}
.info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row.picked .title {
  color: var(--gold-bright);
}
.meta {
  font-size: 12px;
  color: var(--dim);
}
.cred {
  font-size: 11px;
  color: var(--dim-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mark {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--gold);
  white-space: nowrap;
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.star {
  font-size: 15px;
  line-height: 1;
  padding: 2px;
  color: var(--dim-3);
  transition: color 0.15s, transform 0.15s;
}
.star:active {
  transform: scale(0.85);
}
.star.on {
  color: var(--gold);
}
.pk {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--gold);
  white-space: nowrap;
}
.hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--dim-3);
  letter-spacing: 0.02em;
}
.hint b {
  color: var(--gold-2);
}

.sec-row {
  display: flex;
  gap: 10px;
}
.sec-row .btn {
  flex: 1;
}
.bottom-fixed {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: 14px 20px calc(16px + var(--safe-b));
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: linear-gradient(to top, var(--ink) 62%, transparent);
}
.screen.with-cta {
  padding-bottom: calc(158px + var(--safe-b));
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: rgba(5, 5, 7, 0.7);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 22px;
}
.confirm-box {
  width: min(88vw, 340px);
  padding: 26px 22px 20px;
  border-radius: var(--r-md);
  background: var(--ink-2);
  border: 1px solid var(--line);
  text-align: center;
}
.confirm-box h4 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}
.confirm-box p {
  color: var(--dim);
  font-size: 13.5px;
  line-height: 1.6;
  margin-bottom: 22px;
}
.row-btns {
  display: flex;
  gap: 10px;
}
.row-btns .btn {
  flex: 1;
  min-height: 46px;
}
</style>
