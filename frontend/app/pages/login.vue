<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const auth = useAuth()
const username = ref('')
const password = ref('')
const showPassword = ref(false)

async function submit() {
  try {
    await auth.login(username.value.trim(), password.value)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } catch {
    // Error message is exposed by useAuth and rendered below.
  }
}
</script>

<template>
  <UApp>
    <main class="flex min-h-screen items-center justify-center bg-elevated p-4">
      <UCard class="w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
            <UIcon
              name="i-lucide-printer"
              class="size-7"
            />
          </div>
          <h1 class="text-2xl font-semibold text-highlighted">
            MultiPrint
          </h1>
          <p class="mt-1 text-sm text-dimmed">
            Masuk ke aplikasi manajemen operasional
          </p>
        </div>
        <UAlert
          v-if="auth.errorMessage.value"
          color="error"
          variant="subtle"
          :title="auth.errorMessage.value"
          class="mb-5"
        />
        <UForm
          :state="{ username, password }"
          class="space-y-5"
          @submit="submit"
        >
          <UFormField
            label="Username"
            name="username"
            required
          >
            <UInput
              v-model="username"
              class="w-full"
              autocomplete="username"
              autofocus
            />
          </UFormField>
          <UFormField
            label="Password"
            name="password"
            required
          >
            <UInput
              v-model="password"
              class="w-full"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="ghost"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>
          <UButton
            type="submit"
            block
            :loading="auth.loading.value"
            label="Login"
          />
        </UForm>
      </UCard>
    </main>
  </UApp>
</template>
