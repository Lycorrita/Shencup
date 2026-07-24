<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournament } from '@/stores/tournament'
import { ANNOUNCEMENT, RULES } from '@/data/content'

const t = useTournament()
const router = useRouter()

const count = computed(() => t.songs.length)

const showRules = ref(false)
const showAnnounce = ref(false)
const ANNOUNCE_KEY = 'shencup:announce-seen'

onMounted(() => {
  if (ANNOUNCEMENT.trim() && !sessionStorage.getItem(ANNOUNCE_KEY)) {
    showAnnounce.value = true
  }
})
function closeAnnounce() {
  sessionStorage.setItem(ANNOUNCE_KEY, '1')
  showAnnounce.value = false
}

function begin() {
  t.start()
  router.push('/play')
}
function resumeRun() {
  router.push('/play')
}
</script>

<template>
  <section class="home screen">
    <div class="hero">
      <span class="eyebrow">Zhou Shen · Full Catalog</span>

      <h1 class="wordmark brand-mark">
        <span>Shen</span><span class="gold-text">cup</span>
      </h1>

      <div class="rule"><i></i></div>

      <p class="tagline">周深曲库心肝大比拼</p>
      <p class="sub">
        曲库随机分组，缩圈、晋级、<b class="gold-text">换位、复活</b>——<br />
        不让任何一首心肝因命运而蒙尘！
      </p>
    </div>

    <div class="actions">
      <button v-if="t.hasProgress" class="btn btn-gold btn-block" @click="resumeRun">
        继续上次对决
      </button>
      <button class="btn btn-block" :class="t.hasProgress ? 'btn-ghost' : 'btn-gold'" @click="begin">
        {{ t.hasProgress ? '重新开始' : '开始对决' }}
      </button>
      <div class="home-links">
        <button class="linklist" @click="showRules = true">规则说明</button>
        <RouterLink to="/rank" class="linklist">全局榜单</RouterLink>
        <button v-if="ANNOUNCEMENT.trim()" class="linklist" @click="showAnnounce = true">公告</button>
      </div>
    </div>

    <div class="meta-row">
      <div class="meta">
        <b class="num">{{ count }}</b>
        <span>首曲目</span>
      </div>
      <div class="meta">
        <b class="num">8</b>
        <span>组缩圈</span>
      </div>
      <div class="meta">
        <b class="num">1</b>
        <span>冠军</span>
      </div>
    </div>

    <p class="note">数据仅存于本机，仅供娱乐，不可作为任何参考指标</p>

    <!-- 公告 -->
    <div v-if="showAnnounce" class="modal" @click.self="closeAnnounce">
      <div class="modal-card">
        <div class="modal-head">
          <span class="modal-eyebrow">Announcement</span>
          <span class="modal-title">公 告</span>
        </div>
        <p class="modal-body">{{ ANNOUNCEMENT }}</p>
        <button class="btn btn-gold btn-block" @click="closeAnnounce">我知道了</button>
      </div>
    </div>

    <!-- 规则说明 -->
    <div v-if="showRules" class="modal" @click.self="showRules = false">
      <div class="modal-card wide">
        <button class="modal-x" @click="showRules = false">✕</button>
        <div class="modal-head">
          <span class="modal-eyebrow">Rules</span>
          <span class="modal-title">全 程 规 则</span>
        </div>
        <div class="rules">
          <section v-for="(r, i) in RULES" :key="i" class="rule-sec">
            <h3 class="rule-h">{{ r.h }}</h3>
            <p class="rule-p">{{ r.body }}</p>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home {
  justify-content: space-between;
  min-height: 100vh;
  min-height: 100dvh;
  padding-top: calc(var(--safe-t) + 56px);
}
.hero {
  margin-top: auto;
  text-align: center;
}
.hero .eyebrow {
  display: block;
  margin-bottom: 22px;
}
.wordmark {
  font-size: clamp(52px, 15vw, 92px);
  line-height: 1;
  letter-spacing: 0.01em;
  font-weight: 800;
}
.wordmark span {
  display: inline-block;
}
.rule {
  display: flex;
  justify-content: center;
  margin: 26px 0 22px;
}
.rule i {
  width: 64px;
  height: 1px;
  background: var(--gold);
}
.tagline {
  font-size: clamp(19px, 5.4vw, 23px);
  font-weight: 700;
  letter-spacing: 0.16em;
  padding-left: 0.16em;
}
.sub {
  margin-top: 14px;
  color: var(--dim);
  font-size: 13.5px;
  line-height: 1.8;
}

.actions {
  margin: 40px auto 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 320px;
}
.linklist {
  text-align: center;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--dim);
  margin-top: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  transition: color 0.2s;
  text-decoration: none;
}
.linklist:hover {
  color: var(--gold);
}
.home-links {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

/* 弹窗（公告 / 规则） */
.modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(5, 5, 7, 0.82);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(24px + var(--safe-t)) 20px calc(24px + var(--safe-b));
}
.modal-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--ink-2);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 26px 24px 22px;
}
.modal-card.wide {
  max-width: 440px;
}
.modal-x {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--dim);
  background: none;
  cursor: pointer;
}
.modal-head {
  text-align: center;
  margin-bottom: 18px;
}
.modal-eyebrow {
  display: block;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--gold-2);
  margin-bottom: 6px;
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--paper);
}
.modal-body {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--dim);
  white-space: pre-line;
  margin-bottom: 22px;
}
.rules {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rule-h {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--gold);
  margin-bottom: 6px;
}
.rule-p {
  font-size: 13px;
  line-height: 1.8;
  color: var(--dim);
}

.meta-row {
  margin-bottom: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--line);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.meta {
  background: var(--ink);
  padding: 20px 6px 18px;
  text-align: center;
}
.meta b {
  display: block;
  font-size: 30px;
  font-weight: 400;
  color: var(--paper);
  line-height: 1.1;
}
.meta span {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--dim-2);
}
.note {
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--dim-3);
  margin-top: 26px;
}
</style>
