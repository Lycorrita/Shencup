<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchRank, BACKEND_READY, type RankEntry } from '@/lib/rank'
import { metaLine } from '@/lib/format'

type TabKey = 'champions' | 'runnerUps' | 'semifinals' | 'rescues'
const tabs: { key: TabKey; label: string }[] = [
  { key: 'champions', label: '冠军榜' },
  { key: 'runnerUps', label: '亚军榜' },
  { key: 'semifinals', label: '四强榜' },
  { key: 'rescues', label: '遗珠榜' },
]
const tab = ref<TabKey>('champions')
const entries = ref<RankEntry[]>([])
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    entries.value = await fetchRank()
  } finally {
    loading.value = false
  }
})

const sorted = computed(() =>
  [...entries.value]
    .sort((a, b) => (b[tab.value] || 0) - (a[tab.value] || 0))
    .filter((e) => (e[tab.value] || 0) > 0)
    .slice(0, 100),
)
const max = computed(() => sorted.value.reduce((m, e) => Math.max(m, e[tab.value] || 0), 1))
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

    <div v-if="loading" class="state">加载中…</div>

    <ol v-else-if="sorted.length" class="rank-list">
      <li v-for="(e, i) in sorted" :key="e.id" class="rrow">
        <span class="rnum num" :class="{ top: i < 3 }">{{ String(i + 1).padStart(2, '0') }}</span>
        <div class="rinfo">
          <span class="rtitle">{{ e.title }}</span>
          <span class="rmeta">{{ metaLine(e) }}</span>
        </div>
        <div class="rbar"><i :style="{ width: ((e[tab] || 0) / max) * 100 + '%' }"></i></div>
        <span class="rpts num">{{ e[tab] }}</span>
      </li>
    </ol>

    <div v-else class="state empty">
      <p>暂无数据。</p>
      <p class="dim">完成一局并上报后，这里会汇聚大家的投票。</p>
      <p v-if="!BACKEND_READY" class="dim tiny">（全局聚合后端部署后开启，见 DEPLOY.md）</p>
    </div>
  </section>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.tab {
  flex: 1;
  padding: 12px 4px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dim-2);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.2s, border-color 0.2s;
}
.tab.on {
  color: var(--gold);
  border-bottom-color: var(--gold);
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
}
.rrow {
  display: grid;
  grid-template-columns: 30px 1fr 26% 30px;
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
  font-size: 14px;
  color: var(--dim);
}
</style>
