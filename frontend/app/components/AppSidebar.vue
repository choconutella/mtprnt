<script setup lang="ts">
import { navigationGroups } from '~/data/navigation'
import logoUrl from '~/assets/img/logo-multi-transparent.png'

const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{ logout: [] }>()

function closeOnNavigate() {
  if (import.meta.client && window.innerWidth < 1024) open.value = false
}

function handleLogout() {
  emit('logout')
  closeOnNavigate()
}
</script>

<template>
  <aside
    class="fixed inset-y-0 inset-s-0 z-40 flex w-72 -translate-x-full flex-col border-e border-default bg-default transition-transform duration-200 lg:translate-x-0"
    :class="open && 'translate-x-0'"
    aria-label="Navigasi utama"
  >
    <div class="flex h-16 items-center gap-3 border-b border-default px-5">
      <img
        :src="logoUrl"
        alt="MultiPrint"
        class="h-auto w-3/4 object-contain object-left"
      >
      <UButton
        class="ms-auto lg:hidden"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Tutup menu"
        @click="open = false"
      />
    </div>
    <UScrollArea class="flex-1 px-3 py-4">
      <nav class="space-y-5">
        <section
          v-for="group in navigationGroups"
          :key="group.label"
        >
          <p class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-dimmed">
            {{ group.label }}
          </p>
          <div class="space-y-1">
            <SidebarMenuItem
              v-for="item in group.items"
              :key="item.label"
              :item="item"
              @logout="handleLogout"
            />
          </div>
        </section>
      </nav>
    </UScrollArea>
  </aside>
  <button
    v-if="open"
    type="button"
    class="fixed inset-0 z-30 bg-black/40 lg:hidden"
    aria-label="Tutup menu"
    @click="open = false"
  />
</template>
