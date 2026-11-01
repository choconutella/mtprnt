<script setup lang="ts">
type SettingsResponse = { data?: { sla?: { pending_setelah_jam?: number } } }

const { request, message } = useServiceApi()
const pendingAfterHours = ref(24)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function clearNotice() {
  errorMessage.value = ''
  successMessage.value = ''
}

async function loadSettings() {
  loading.value = true
  clearNotice()
  try {
    const response = await request<SettingsResponse>('/pengaturan?role=admin')
    pendingAfterHours.value = Number(response.data?.sla?.pending_setelah_jam || 24)
  } catch (error) {
    errorMessage.value = message(error, 'Pengaturan SLA gagal dimuat.')
  } finally { loading.value = false }
}

async function saveSettings() {
  if (!Number.isInteger(Number(pendingAfterHours.value)) || Number(pendingAfterHours.value) < 1 || Number(pendingAfterHours.value) > 720) {
    errorMessage.value = 'Nilai SLA harus berupa bilangan bulat antara 1 dan 720 jam.'
    successMessage.value = ''
    return
  }
  saving.value = true
  clearNotice()
  try {
    await request('/pengaturan/sla-pending-komplain', { method: 'PUT', body: { pending_setelah_jam: Number(pendingAfterHours.value) } })
    successMessage.value = 'SLA pending komplain berhasil disimpan.'
  } catch (error) {
    errorMessage.value = message(error, 'SLA gagal disimpan.')
  } finally { saving.value = false }
}

onMounted(loadSettings)
</script>

<template>
  <div class="space-y-6">
    <UPageHeader title="SLA Pending Komplain" description="Atur batas waktu komplain berstatus New sebelum otomatis menjadi Pending." />
    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
    <UAlert v-if="successMessage" color="success" variant="subtle" :title="successMessage" />
    <UCard>
      <UForm :state="{ pendingAfterHours }" class="space-y-5" @submit="saveSettings">
        <div>
          <h2 class="font-semibold text-highlighted">Batas Pending Komplain</h2>
          <p class="text-sm text-dimmed">Komplain berstatus New akan diproses menjadi Pending setelah batas waktu ini tercapai.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <UFormField label="Pending setelah" hint="1–720 jam" class="w-full sm:max-w-xs" required>
            <div class="flex items-center gap-2"><UInput v-model.number="pendingAfterHours" type="number" min="1" max="720" step="1" class="w-full" :disabled="loading || saving" /><span class="text-sm text-dimmed">jam</span></div>
          </UFormField>
          <UButton type="submit" icon="i-lucide-save" label="Simpan SLA" :loading="saving" :disabled="loading" />
        </div>
      </UForm>
    </UCard>
  </div>
</template>
