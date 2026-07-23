<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTournament } from '@/stores/tournament'

const t = useTournament()
const router = useRouter()

const count = computed(() => t.songs.length)

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

      <p class="tagline">周深全曲库巅峰对决</p>
      <p class="sub">
        全曲库随机分组，缩圈、淘汰、<b class="gold-text">遗珠卡复活</b>——<br />
        不让任何一首心头好因赛制而蒙尘。
      </p>
    </div>

    <div class="actions">
      <button v-if="t.hasProgress" class="btn btn-gold btn-block" @click="resumeRun">
        继续上次对决
      </button>
      <button class="btn btn-block" :class="t.hasProgress ? 'btn-ghost' : 'btn-gold'" @click="begin">
        {{ t.hasProgress ? '重新开始' : '开始对决' }}
      </button>
      <RouterLink to="/rank" class="linklist">查看全局榜单 →</RouterLink>
    </div>

    <div class="meta-row">
      <div class="meta">
        <b class="num">{{ count }}</b>
        <span>首曲目</span>
      </div>
      <div class="meta">
        <b class="num">8</b>
        <span>人/组缩圈</span>
      </div>
      <div class="meta">
        <b class="num">1</b>
        <span>冠军</span>
      </div>
    </div>

    <p class="note">无需注册 · 点击即玩 · 数据仅存于本机</p>
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
  transition: color 0.2s;
}
.linklist:hover {
  color: var(--gold);
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
