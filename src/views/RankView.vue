<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchRank, BACKEND_READY, hasSubmitted, type RankEntry } from '@/lib/rank'
import { metaLine } from '@/lib/format'

type TabKey = 'champions' | 'runnerUps' | 'topTens' | 'rescues' | 'royal'
const tabs: { key: TabKey; label: string }[] = [
  { key: 'champions', label: '冠军榜' },
  { key: 'runnerUps', label: '亚军榜' },
  { key: 'topTens', label: '十强榜' },
  { key: 'rescues', label: '遗珠榜' },
  { key: 'royal', label: '皇族榜' },
]
const tab = ref<TabKey>('champions')
const entries = ref<RankEntry[]>([])
const loading = ref(true)
const submitted = ref(hasSubmitted())

onMounted(async () => {
  loading.value = true
  try {
    entries.value = await fetchRank()
  } finally {
    loading.value = false
  }
})

type MetricKey = Exclude<TabKey, 'royal'>
const metric = (e: RankEntry): number =>
  tab.value === 'royal' ? e.rescues : e[tab.value as MetricKey] || 0

const sorted = computed(() => {
  // 皇族榜：十强（topTens>0）按捞回次数升序；其余按对应指标降序
  if (tab.value === 'royal') {
    return entries.value
      .filter((e) => e.topTens > 0)
      .sort((a, b) => a.rescues - b.rescues || b.topTens - a.topTens)
      .slice(0, 100)
  }
  const k = tab.value as MetricKey
  return [...entries.value]
    .filter((e) => (e[k] || 0) > 0)
    .sort((a, b) => (b[k] || 0) - (a[k] || 0))
    .slice(0, 100)
})
const max = computed(() =>
  sorted.value.reduce(
    (m, e) => Math.max(m, tab.value === 'royal' ? e.topTens : metric(e)),
    1,
  ),
)
const locked = computed(() => !submitted.value)
</script>

<template>
  <section class="screen with-bar">
    <header class="page-head">
      <span class="eyebrow">Ranking</span>
      <h1>全 局 榜 单</h1>
      <p>每次对决上报后汇聚于此。完成一局别忘了在冠军页「上报榜单」。</p>
    </header>

    <div class="tabs">
      <button
        v-for="tb in tabs"
        :key="tb.key"
        class="tab"
        :class="{ on: tab === tb.key }"
        @click="tab = tb.key"
      >
        {{ tb.label }}
      </button>
    </div>

    <div class="board" :class="{ locked }">
      <div v-if="loading" class="state">加载中…</div>

      <ol v-else-if="sorted.length" class="rank-list">
        <li v-for="(e, i) in sorted" :key="e.id" class="rrow">
          <span class="rnum num" :class="{ top: i < 3 }">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="rinfo">
            <span class="rtitle">{{ e.title }}</span>
            <span class="rmeta">{{ metaLine(e) }}</span>
          </div>
          <div class="rbar">
            <i :style="{ width: ((tab === 'royal' ? e.topTens : metric(e)) / max) * 100 + '%' }"></i>
          </div>
          <span class="rpts num">
            <template v-if="tab === 'royal'">捞回 {{ e.rescues }}</template>
            <template v-else>{{ metric(e) }}</template>
          </span>
        </li>
      </ol>

      <div v-else class="state empty">
        <p>暂无数据。</p>
        <p class="dim">完成一局并上报后，这里会汇聚大家的投票。</p>
        <p v-if="!BACKEND_READY" class="dim tiny">（全局聚合后端部署后开启，见 DEPLOY.md）</p>
      </div>

      <!-- 毛玻璃锁定：未上报不透露具体排名 -->
      <div v-if="locked && !loading" class="glass">
        <div class="glass-card">
          <p class="glass-title">上报一局即可解锁榜单</p>
          <p class="glass-sub">为避免跟风，完成一局对决并上报后，全局排名才会显现。</p>
          <RouterLink to="/play" class="btn btn-gold">去完成一局</RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.tab {
  flex: 1 0 auto;
  padding: 12px 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dim-2);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
  transition: color 0.2s, border-color 0.2s;
}
.tab.on {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.board {
  position: relative;
  min-height: 200px;
}
.board.locked .rank-list {
  filter: blur(7px);
  pointer-events: none;
  user-select: none;
}

.state {
  padding: 60px 20px;
  text-align: center;
  color: var(--dim);
  font-size: 14px;
}
.state.empty .dim {
  margin-top: 10px;
  color: var(--dim-2);
  font-size: 13px;
}
.state.empty .tiny {
  margin-top: 14px;
  font-size: 11px;
  color: var(--dim-3);
}

.rank-list {
  list-style: none;
  transition: filter 0.25s;
}
.rrow {
  display: grid;
  grid-template-columns: 30px 1fr 26% 64px;
  align-items: center;
  gap: 12px;
  padding: 13px 2px;
  border-bottom: 1px solid var(--line-soft);
}
.rnum {
  font-size: 14px;
  font-weight: 600;
  color: var(--dim-2);
}
.rnum.top {
  color: var(--gold);
}
.rinfo {
  min-width: 0;
}
.rtitle {
  display: block;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rmeta {
  display: block;
  font-size: 11px;
  color: var(--dim-2);
  margin-top: 2px;
}
.rbar {
  height: 4px;
  background: var(--line-soft);
  border-radius: 2px;
  overflow: hidden;
}
.rbar i {
  display: block;
  height: 100%;
  background: var(--gold);
  min-width: 3px;
}
.rpts {
  text-align: right;
  font-size: 13px;
  color: var(--dim);
  white-space: nowrap;
}

/* 毛玻璃遮罩 */
.glass {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.glass-card {
  text-align: center;
  max-width: 320px;
  padding: 26px 22px;
  background: rgba(14, 14, 16, 0.72);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  backdrop-filter: blur(2px);
}
.glass-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--gold);
  margin-bottom: 8px;
}
.glass-sub {
  font-size: 12px;
  color: var(--dim-2);
  line-height: 1.6;
  margin-bottom: 16px;
}
</style>
