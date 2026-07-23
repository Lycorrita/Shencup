<script setup lang="ts">
import { onMounted } from 'vue'
import { useTournament } from '@/stores/tournament'
import GroupsView from './GroupsView.vue'
import KnockoutView from './KnockoutView.vue'
import ChampionView from './ChampionView.vue'

const t = useTournament()

// 直接进入 /play 且无进度时，自动开启新一局
onMounted(() => {
  if (t.phase === 'home') t.start()
})
</script>

<template>
  <GroupsView v-if="t.phase === 'groups'" />
  <KnockoutView v-else-if="t.phase === 'knockout'" />
  <ChampionView v-else-if="t.phase === 'champion'" />
</template>
