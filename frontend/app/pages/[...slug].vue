<script setup lang="ts">
const route = useRoute()
const title = computed(() => route.path.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') || 'Workspace')
</script>

<template>
  <UPageHeader
    :title="title"
    description="Halaman ini tersedia di navigasi MultiPrint dan siap diimplementasikan berdasarkan kontrak API."
    class="capitalize"
  />
</template>
