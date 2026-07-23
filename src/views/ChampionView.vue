<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTournament } from '@/stores/tournament'
import type { Song } from '@/types'
import { metaLine, creditsLine, hasCredits } from '@/lib/format'
import { renderResultImage, downloadDataUrl } from '@/lib/exportImage'
import { submitResult, BACKEND_READY } from '@/lib/rank'

const t = useTournament()
const router = useRouter()

const POS = ['冠军', '亚军', '季军', '第 4 名', '第 5 名', '第 6 名', '第 7 名', '第 8 名']
const rest = () => t.ranking.slice(1).filter((s): s is Song => !!s)

const exporting = ref(false)
const imgUrl = ref<string | null>(null)
const submitting = ref(false)
const submitted = ref(false)

async function doExport() {
  if (!t.champion) return
  exporting.value = true
  try {
    const d = new Date()
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    const url = await renderResultImage({
      artist: t.artist,
      ranking: t.ranking,
      rescued: t.rescuedSongs,
      date,
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
  if (submitting.value || submitted.value || !t.champion) return
  submitting.value = true
  try {
    const meta = t.songs.map((s) => ({ id: s.id, title: s.title, album: s.album, year: s.year }))
    const res = await submitResult({ artist: t.artist, summary: t.summary, meta })
    if (res.ok) submitted.value = true
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
  <section class="screen with-cta">
    <div class="champ-head">
      <span class="crown">✦</span>
      <span class="eyebrow">Champion</span>
    </div>

    <div v-if="t.champion" class="champ-block">
      <h1 class="ctitle brand-mark">{{ t.champion.title }}</h1>
      <p class="cmeta">{{ metaLine(t.champion) }}</p>
      <p v-if="hasCredits(t.champion)" class="ccred">{{ creditsLine(t.champion) }}</p>
    </div>

    <div v-if="rest().length" class="sec">
      <div class="sec-label">最 终 排 位</div>
      <ul class="rank-list">
        <li v-for="(s, i) in rest()" :key="s.id" class="rank-row">
          <span class="rpos">{{ POS[i + 1] }}</span>
          <span class="rtitle">{{ s.title }}</span>
          <span class="rmeta">{{ metaLine(s) }}</span>
        </li>
      </ul>
    </div>

    <div v-if="t.rescuedSongs.length" class="sec">
      <div class="sec-label">本局救回的遗珠</div>
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
      <button class="btn btn-ghost btn-sm" :disabled="submitting || submitted || !BACKEND_READY" @click="report">
        {{ submitted ? '已上报 ✓' : submitting ? '上报中…' : '上报榜单' }}
      </button>
      <RouterLink to="/rank" class="btn btn-ghost btn-sm">查看榜单</RouterLink>
      <button class="btn btn-ghost btn-sm" @click="restart">重新开始</button>
    </div>

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
</style>
