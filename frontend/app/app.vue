<script setup lang="ts">
import faviconUrl from '~/assets/img/favicon.png'

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: faviconUrl }
  ],
  htmlAttrs: { lang: 'id' }
})

const title = 'MultiPrint'
const description = 'Workspace operasional MultiPrint untuk tiket, surat tugas, stok, dan master data.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
