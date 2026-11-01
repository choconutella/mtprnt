<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PermissionRow = Record<string, any>

const { request, message } = useServiceApi()
const roles = ref<string[]>([])
const modules = ref<{ key: string, label: string }[]>([])
const actions = ref<string[]>([])
const permissions = ref<PermissionRow[]>([])
const selectedRole = ref('admin')
const moduleSearch = ref('')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const roleLabels: Record<string, string> = {
  admin: 'Admin', sales: 'Sales', 'sales-admin': 'Sales Admin', sales_admin: 'Sales Admin',
  'kepala-teknisi': 'Kepala Teknisi', kepala_teknisi: 'Kepala Teknisi', teknisi: 'Teknisi', warehouse: 'Warehouse'
}
const actionLabels: Record<string, string> = { view: 'Lihat', create: 'Buat', update: 'Ubah', delete: 'Hapus', resolve: 'Resolve', workflow: 'Workflow' }
const permissionColumns = computed(() => [
  { accessorKey: 'modul', header: 'Modul' },
  ...actions.value.map(action => ({ accessorKey: `can_${action}`, header: actionLabel(action) })),
])
const filteredRows = computed(() => {
  const query = moduleSearch.value.trim().toLocaleLowerCase()
  return permissions.value.filter(row => !query || `${row.modul} ${moduleLabel(row.modul)}`.toLocaleLowerCase().includes(query))
})
const viewableModules = computed(() => permissions.value.filter(row => row.can_view).length)
const isAdmin = computed(() => selectedRole.value === 'admin')

function roleLabel(role: string) { return roleLabels[role] || role.replaceAll('_', ' ') }
function normalizeRole(role: string) { return role.replaceAll('-', '_') }
function actionLabel(action: string) { return actionLabels[action] || action }
function moduleLabel(key: string) { return modules.value.find(module => module.key === key)?.label || key.replaceAll('_', ' ') }
function permissionKey(action: string) { return `can_${action}` }
function clearNotice() { errorMessage.value = ''; successMessage.value = '' }

async function loadSettings(role = selectedRole.value) {
  loading.value = true
  clearNotice()
  try {
    const response = await request<{ data: { roles: string[], modules: { key: string, label: string }[], actions: string[], selected_role: string, permissions: PermissionRow[] } }>(`/pengaturan?role=${encodeURIComponent(role)}`)
    roles.value = (response.data.roles || []).map(normalizeRole)
    modules.value = response.data.modules || []
    actions.value = response.data.actions || []
    selectedRole.value = response.data.selected_role || role
    permissions.value = response.data.permissions || []
  } catch (error) {
    errorMessage.value = message(error, 'Pengaturan permission gagal dimuat.')
  } finally { loading.value = false }
}

async function changeRole() { await loadSettings(selectedRole.value) }

async function savePermissions() {
  saving.value = true
  clearNotice()
  try {
    await request('/pengaturan/role-permission', { method: 'PUT', body: { role: selectedRole.value, permissions: permissions.value } })
    successMessage.value = 'Permission role berhasil disimpan.'
    await loadSettings(selectedRole.value)
  } catch (error) {
    errorMessage.value = message(error, 'Permission role gagal disimpan.')
  } finally { saving.value = false }
}

onMounted(() => loadSettings())
</script>

<template>
  <div class="space-y-6">
    <UPageHeader title="Role Permission" description="Atur modul dan aksi yang diizinkan untuk setiap role." />
    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
    <UAlert v-if="successMessage" color="success" variant="subtle" :title="successMessage" />
    <UCard>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Pilih Role" class="w-56"><USelect v-model="selectedRole" :items="roles.map(role => ({ label: roleLabel(role), value: role }))" class="w-full" :disabled="loading || saving" @update:model-value="changeRole" /></UFormField>
        <UFormField label="Filter Modul" class="min-w-64 flex-1"><UInput v-model="moduleSearch" icon="i-lucide-search" placeholder="Semua modul" class="w-full" /></UFormField>
        <div class="text-sm text-dimmed sm:ms-auto"><span class="block">Ringkasan Akses</span><span class="font-medium text-highlighted">{{ isAdmin ? 'Admin memiliki akses penuh.' : `${roleLabel(selectedRole)} memiliki ${viewableModules} modul yang bisa dilihat.` }}</span></div>
        <UButton icon="i-lucide-save" label="Simpan Permission" :loading="saving" :disabled="loading" @click="savePermissions" />
      </div>
    </UCard>
    <UCard>
      <UTable :data="filteredRows" :columns="permissionColumns" :loading="loading">
        <template #modul-cell="{ row }"><span class="font-medium text-highlighted">{{ moduleLabel(row.original.modul) }}</span></template>
        <template v-for="action in actions" :key="action" #[`${permissionKey(action)}-cell`]="{ row }">
          <UCheckbox v-model="row.original[permissionKey(action)]" :disabled="isAdmin || loading || saving" :aria-label="`${actionLabel(action)} ${moduleLabel(row.original.modul)}`" />
        </template>
        <template #empty><div class="py-10 text-center text-sm text-dimmed">{{ loading ? 'Memuat permission...' : 'Modul tidak ditemukan.' }}</div></template>
      </UTable>
    </UCard>
  </div>
</template>
