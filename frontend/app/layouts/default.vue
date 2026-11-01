<script setup lang="ts">
const sidebarOpen = ref(false)
const route = useRoute()
const auth = useAuth()
const pageTitle = computed(() => route.path === '/' ? 'Dashboard' : route.path.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') || 'Workspace')

function logout() {
  return auth.logout()
}
</script>

<template>
  <div class="min-h-screen bg-elevated">
    <AppSidebar
      v-model="sidebarOpen"
      @logout="logout"
    />
    <div class="min-h-screen lg:ps-72">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-default bg-default/90 px-4 backdrop-blur sm:px-6">
        <UButton
          class="lg:hidden"
          color="neutral"
          variant="ghost"
          icon="i-lucide-menu"
          aria-label="Buka menu"
          @click="sidebarOpen = true"
        />
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-dimmed">
            Workspace
          </p><h1 class="text-lg font-semibold capitalize text-highlighted">
            {{ pageTitle }}
          </h1>
        </div>
        <div class="ms-auto flex items-center gap-2">
          <UColorModeButton
            color="neutral"
            variant="ghost"
          /><UAvatar
            size="sm"
            :alt="auth.user.value?.name || 'User'"
          />
        </div>
      </header>
      <main class="p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
