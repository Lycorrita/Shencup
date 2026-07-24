<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useTournament } from '@/stores/tournament'

const t = useTournament()
const route = useRoute()

// 启动时尝试恢复上次未完成的对决（localStorage）
onMounted(() => {
  t.resume()
})

// 首页用自带页头，其余页显示极简顶栏
const showBar = computed(() => route.name !== 'home')
</script>

<template>
  <div class="shell">
    <!-- 氛围：克制的暗角 + 极淡颗粒（墨金不靠光晕，靠留白与发丝线） -->
    <div class="ambient" aria-hidden="true">
      <div class="vig"></div>
      <div class="grain"></div>
    </div>

    <header v-if="showBar" class="topbar">
      <RouterLink to="/" class="brand brand-mark">
        Shen<span class="gold-text">cup</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/play" class="nav-link">{{ t.hasProgress ? '继续' : '开始' }}</RouterLink>
        <RouterLink to="/rank" class="nav-link">榜单</RouterLink>
      </nav>
    </header>

    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <footer class="foot">
      <span class="brand-mark">Shen<span class="gold-text">cup</span></span>
      <span class="dim">· 为爱发电 仅供粉丝内部娱乐</span>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.ambient {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--ink);
}
.vig {
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 80% at 50% 0%, rgba(201, 169, 106, 0.05), transparent 55%);
}
.grain {
  position: absolute;
  inset: 0;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}

.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  height: calc(56px + var(--safe-t));
  padding: var(--safe-t) 22px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(14, 14, 16, 0.72);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border-bottom: 1px solid var(--line);
}
.brand {
  font-size: 18px;
  letter-spacing: 0.04em;
}
.nav {
  display: flex;
  gap: 22px;
}
.nav-link {
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--dim);
  transition: color 0.2s;
}
.nav-link:hover,
.router-link-active {
  color: var(--gold);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.foot {
  padding: 22px 22px calc(22px + var(--safe-b));
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--dim-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.foot .brand-mark {
  font-size: 14px;
}
.foot .dim {
  color: var(--dim-2);
}
</style>
