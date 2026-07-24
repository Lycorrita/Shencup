<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTournament } from '@/stores/tournament'
import type { Song } from '@/types'
import { metaLine, noteLine, hasNote } from '@/lib/format'
import { renderResultImage, downloadDataUrl } from '@/lib/exportImage'
import { submitResult, BACKEND_READY, MAX_SUBMITS, getSubmitCount, isRunReported } from '@/lib/rank'

const t = useTournament()
const router = useRouter()

const QR_URL = 'http://shenhub-d6gzyobpw735191a7-1457577066.tcloudbaseapp.com/'
// 十强位次标签（index 0 = 冠军）
const POS10 = ['冠军', '亚军', '季军', '第 4', '第 5', '第 6', '第 7', '第 8', '第 9', '第 10']

const rest9 = computed(() => t.ranking.slice(1).filter((s): s is Song => !!s))
const royalty = computed(() => t.royaltyTop3)
const tiers = computed(() => t.allTiers)
// 梯队展开
const openTier = ref<number | null>(null)
function tierSongs(ids: string[]) {
  return ids.map((id) => t.byId.get(id)).filter(Boolean) as Song[]
}

const exporting = ref(false)
const imgUrl = ref<string | null>(null)
const submitting = ref(false)
// 上报：每浏览器限 MAX_SUBMITS 次；同一局不可重复
const submitCount = ref(getSubmitCount())
const reported = ref(isRunReported(t.summary.runId))
const reportReason = ref('')
const atLimit = computed(() => submitCount.value >= MAX_SUBMITS)
const canReport = computed(() => BACKEND_READY && !submitting.value && !reported.value && !atLimit.value)
const reportLabel = computed(() => {
  if (reported.value) return '本局已上报 ✓'
  if (atLimit.value) return `已达上限 ${MAX_SUBMITS}/${MAX_SUBMITS}`
  return submitCount.value > 0 ? `上报榜单 (${submitCount.value}/${MAX_SUBMITS})` : '上报榜单'
})

async function doExport() {
  if (!t.champion) return
  exporting.value = true
  try {
    const d = new Date()
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    const top10 = t.ranking
      .map((s) => (s ? { song: s, revives: t.revivesOf(s.id) } : null))
      .filter((x): x is { song: Song; revives: number } => !!x)
    const url = await renderResultImage({
      artist: t.artist,
      champion: t.champion,
      top10,
      royalty: t.royaltyTop3,
      tier1: tierSongs(t.tier1),
      tier2: tierSongs(t.tier2),
      rescuedTop10: t.rescuedSongs.slice(0, 10),
      date,
      qrUrl: QR_URL,
    })
    imgUrl.value = url
  } finally {
    exporting.value = false
  }
}
function saveImg() {
  if (imgUrl.value) downloadDataUrl(imgUrl.value, `Shencup-${t.champion?.title || '冠军'}.png`)
}
async function report() {
  if (!canReport.value) return
  submitting.value = true
  reportReason.value = ''
  try {
    const meta = t.songs.map((s) => ({ id: s.id, title: s.title, album: s.album, year: s.year }))
    const res = await submitResult({ artist: t.artist, summary: t.summary, meta })
    if (res.ok) {
      reported.value = true
      if (typeof res.count === 'number') submitCount.value = res.count
    } else {
      reportReason.value = res.reason || '上报失败'
      if (typeof res.count === 'number') submitCount.value = res.count
      reported.value = isRunReported(t.summary.runId)
    }
  } finally {
    submitting.value = false
  }
}
function restart() {
  t.reset()
  router.push('/')
}
</script>

<template>
  <section class="screen with-bar with-cta">
    <div class="champ-head">
      <span class="crown">✦</span>
      <span class="eyebrow">Champion</span>
    </div>

    <div v-if="t.champion" class="champ-block">
      <h1 class="ctitle brand-mark">{{ t.champion.title }}</h1>
      <p class="cmeta">{{ metaLine(t.champion) }}</p>
      <p v-if="hasNote(t.champion)" class="ccred">{{ noteLine(t.champion) }}</p>
      <p v-if="t.revivesOf(t.champion.id) > 0" class="crevive">本局捞回 {{ t.revivesOf(t.champion.id) }} 次</p>
    </div>

    <!-- 十强（带捞回次数） -->
    <div v-if="rest9.length" class="sec">
      <div class="sec-label">十 强 · 最 终 排 位</div>
      <ul class="rank-list">
        <li v-for="(s, i) in rest9" :key="s.id" class="rank-row">
          <span class="rpos">{{ POS10[i + 1] }}</span>
          <span class="rtitle">{{ s.title }}</span>
          <span class="rmeta">
            <span v-if="t.revivesOf(s.id) > 0" class="tag-gold">捞回 {{ t.revivesOf(s.id) }}</span>
            {{ metaLine(s) }}
          </span>
        </li>
      </ul>
    </div>

    <!-- 皇族 Top3（十强内捞回最少） -->
    <div v-if="royalty.length" class="sec royalty">
      <div class="sec-label">皇 族 · 十强中捞回最少</div>
      <ul class="rank-list">
        <li v-for="(r, i) in royalty" :key="r.song.id" class="rank-row">
          <span class="rpos">{{ ['一', '二', '三'][i] }}</span>
          <span class="rtitle">{{ r.song.title }}</span>
          <span class="rmeta">捞回 {{ r.revives }} 次</span>
        </li>
      </ul>
    </div>

    <!-- 所有 PK 梯队 -->
    <div v-if="tiers.length" class="sec">
      <div class="sec-label">P K 梯 队 · 每轮阵容</div>
      <div v-for="(ids, i) in [...tiers].map((t2, idx) => ({ ids: t2, idx }))" :key="i" class="tier-row">
        <button class="tier-head" @click="openTier = openTier === ids.idx ? null : ids.idx">
          <span class="tname">第 {{ ids.idx + 1 }} 轮 · {{ ids.ids.length }} 首</span>
          <span class="tcount num">
            <span v-if="ids.idx === tiers.length - 1" class="badge-t1">第一梯队</span>
            <span v-else-if="ids.idx === tiers.length - 2" class="badge-t2">第二梯队</span>
            {{ openTier === ids.idx ? '收起' : '展开' }}
          </span>
        </button>
        <ul v-if="openTier === ids.idx" class="tier-list">
          <li v-for="s in tierSongs(ids.ids)" :key="s.id">
            <span class="tl-title">{{ s.title }}</span>
            <span class="tl-meta">{{ metaLine(s) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- 所有捞回遗珠 -->
    <div v-if="t.rescuedSongs.length" class="sec">
      <div class="sec-label">捞 回 遗 珠 · 复活 + 换位累计</div>
      <ul class="rank-list">
        <li v-for="r in t.rescuedSongs" :key="r.song.id" class="rank-row">
          <span class="rpos small">遗珠</span>
          <span class="rtitle">{{ r.song.title }}</span>
          <span class="rmeta">捞回 {{ r.count }} 次</span>
        </li>
      </ul>
    </div>

    <div class="cta-bar">
      <button class="btn btn-gold" :disabled="exporting" @click="doExport">
        {{ exporting ? '生成中…' : '导出结果图' }}
      </button>
    </div>
    <div class="sec-actions">
      <button class="btn btn-ghost btn-sm" :disabled="!canReport" @click="report">
        {{ submitting ? '上报中…' : reportLabel }}
      </button>
      <RouterLink to="/rank" class="btn btn-ghost btn-sm">查看榜单</RouterLink>
      <button class="btn btn-ghost btn-sm" @click="restart">重新开始</button>
    </div>
    <p v-if="reportReason" class="report-reason">{{ reportReason }}</p>

    <div v-if="imgUrl" class="modal" @click.self="imgUrl = null">
      <button class="modal-x" @click="imgUrl = null">✕</button>
      <img :src="imgUrl" alt="Shencup 结果图" class="modal-img" />
      <button class="btn btn-gold btn-block save" @click="saveImg">保存图片</button>
    </div>
  </section>
</template>

<style scoped>
.champ-head {
  text-align: center;
  margin-bottom: 20px;
}
.crown {
  display: block;
  font-size: 30px;
  color: var(--gold);
  margin-bottom: 8px;
}
.champ-block {
  text-align: center;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 24px;
}
.ctitle {
  font-size: clamp(28px, 7.5vw, 38px);
  font-weight: 700;
  line-height: 1.2;
}
.cmeta {
  margin-top: 10px;
  color: var(--dim);
  font-size: 14px;
}
.ccred {
  margin-top: 8px;
  color: var(--dim-2);
  font-size: 12px;
}
.crevive {
  margin-top: 6px;
  color: var(--gold-2);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.sec {
  margin-bottom: 24px;
}
.sec-label {
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--gold);
  margin-bottom: 10px;
}
.rank-list {
  list-style: none;
}
.rank-row {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line-soft);
}
.rpos {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gold);
}
.rpos.small {
  color: var(--dim-2);
  font-weight: 600;
}
.rtitle {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rmeta {
  font-size: 11px;
  color: var(--dim-2);
  white-space: nowrap;
  text-align: right;
}
.tag-gold {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border: 1px solid var(--gold-2);
  border-radius: 999px;
  color: var(--gold);
  font-size: 10px;
}
.royalty .rank-row {
  grid-template-columns: 40px 1fr auto;
}
.royalty .rpos {
  color: var(--gold-bright);
}

/* 梯队 */
.tier-row {
  border-bottom: 1px solid var(--line-soft);
}
.tier-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  text-align: left;
}
.tname {
  font-size: 14px;
  font-weight: 600;
  color: var(--paper);
}
.tcount {
  font-size: 11px;
  color: var(--dim-2);
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge-t1,
.badge-t2 {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.04em;
}
.badge-t1 {
  background: var(--gold-soft);
  color: var(--gold-bright);
  border: 1px solid var(--gold-2);
}
.badge-t2 {
  border: 1px solid var(--line-strong);
  color: var(--dim);
}
.tier-list {
  list-style: none;
  padding-bottom: 10px;
}
.tier-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-top: 1px solid var(--line-soft);
}
.tl-title {
  font-size: 13.5px;
  color: var(--paper);
}
.tl-meta {
  font-size: 11px;
  color: var(--dim-2);
  white-space: nowrap;
}

.sec-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(76px + var(--safe-b));
  z-index: 29;
  padding: 0 20px;
}
.sec-actions .btn {
  flex: 0 1 150px;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(5, 5, 7, 0.92);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: calc(50px + var(--safe-t)) 22px calc(24px + var(--safe-b));
}
.modal-x {
  position: absolute;
  top: calc(16px + var(--safe-t));
  right: 18px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--paper);
}
.modal-img {
  max-width: 86vw;
  max-height: 70vh;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
}
.save {
  max-width: 320px;
}
.report-reason {
  text-align: center;
  font-size: 11px;
  color: var(--gold-2);
  margin-top: 6px;
}
</style>
