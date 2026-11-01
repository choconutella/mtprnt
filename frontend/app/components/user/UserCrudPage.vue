<script setup lang="ts">
// User records use a different response shape from the paginated master endpoints.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const { request, message } = useServiceApi()
const auth = useAuth()

const rows = ref<Row[]>([])
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const modalOpen = ref(false)
const editing = ref<Row | null>(null)
const form = reactive<Row>({})

const title = 'Master Akun / User'
const description = 'Kelola User ID, nama, role, email, dan status aktif akun.'
const canWrite = computed(() => auth.isAdmin.value)
const roleOptions = [
  { label: 'Admin', value: 'admin' },
  { label: 'Sales', value: 'sales' },
  { label: 'Sales Admin', value: 'sales-admin' },
  { label: 'Kepala Teknisi', value: 'kepala-teknisi' },
  { label: 'Teknisi', value: 'teknisi' },
  { label: 'Warehouse', value: 'warehouse' }
]
const columns = [
  { accessorKey: 'user_id', header: 'User ID' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'active', header: 'Status' },
  { id: 'actions', header: 'Aksi' }
]
const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return rows.value
  return rows.value.filter(row => [row.user_id, row.name, row.role, row.email]
    .some(value => String(value || '').toLowerCase().includes(keyword)))
})
const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

function resetForm() {
  Object.keys(form).forEach(key => Reflect.deleteProperty(form, key))
  Object.assign(form, {
    user_id: '',
    name: '',
    role: 'teknisi',
    email: '',
    password: '',
    active: true
  })
}

function openCreate() {
  editing.value = null
  resetForm()
  modalOpen.value = true
}

function openEdit(row: Row) {
  editing.value = row
  Object.assign(form, {
    user_id: row.user_id,
    name: row.name,
    role: row.role,
    email: row.email,
    password: '',
    active: row.active
  })
  modalOpen.value = true
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await request<{ data: Row[] }>('/pengguna')
    rows.value = response.data
    if (page.value > Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))) page.value = 1
  } catch (error) {
    errorMessage.value = message(error, 'Data pengguna gagal dimuat.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canWrite.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const data = { ...form }
    if (editing.value && !data.password) delete data.password
    if (editing.value) await request(`/pengguna/${editing.value.id}`, { method: 'PUT', body: data })
    else await request('/pengguna', { method: 'POST', body: data })
    modalOpen.value = false
    successMessage.value = `${title} berhasil disimpan.`
    await load()
  } catch (error) {
    errorMessage.value = message(error, `${title} gagal disimpan.`)
  } finally {
    saving.value = false
  }
}

async function deactivate(row: Row) {
  if (!canWrite.value || !window.confirm(`Nonaktifkan user ${row.user_id}?`)) return
  try {
    await request(`/pengguna/${row.id}`, { method: 'DELETE' })
    successMessage.value = 'Pengguna berhasil dinonaktifkan.'
    await load()
  } catch (error) {
    errorMessage.value = message(error, 'Pengguna gagal dinonaktifkan.')
  }
}

watch(search, () => { page.value = 1 })
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      :title="title"
      :description="description"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UAlert
      v-if="successMessage"
      color="success"
      variant="subtle"
      :title="successMessage"
    />

    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari User ID, nama, role, atau email"
          class="lg:max-w-sm"
        />
        <div class="flex items-center gap-2 lg:ms-auto">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            aria-label="Refresh data"
            :loading="loading"
            @click="load"
          />
          <UButton
            icon="i-lucide-plus"
            label="Buat"
            :disabled="!canWrite"
            :title="canWrite ? 'Tambah pengguna' : 'Akun ini tidak memiliki izin mengelola pengguna'"
            @click="openCreate"
          />
        </div>
      </div>
    </UCard>

    <UCard>
      <UTable
        :data="paginatedRows"
        :columns="columns"
        :loading="loading"
      >
        <template #role-cell="{ row }">
          <UBadge
            color="info"
            variant="subtle"
          >
            {{ roleOptions.find(item => item.value === row.original.role)?.label || row.original.role }}
          </UBadge>
        </template>
        <template #active-cell="{ row }">
          <UBadge
            :color="row.original.active ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ row.original.active ? 'Aktif' : 'Nonaktif' }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div
            v-if="canWrite"
            class="flex flex-wrap gap-1"
          >
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit"
              @click="openEdit(row.original)"
            />
            <UButton
              size="xs"
              color="warning"
              variant="ghost"
              icon="i-lucide-power"
              aria-label="Nonaktifkan"
              @click="deactivate(row.original)"
            />
          </div>
          <span
            v-else
            class="text-sm text-dimmed"
          >
            -
          </span>
        </template>
      </UTable>
      <div class="mt-4 flex justify-end">
        <UPagination
          v-model:page="page"
          :page-count="pageSize"
          :total="filteredRows.length"
        />
      </div>
    </UCard>

    <UModal
      v-model:open="modalOpen"
      :title="editing ? `Edit ${title}` : `Tambah ${title}`"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="User ID"
              name="user_id"
              required
            >
              <UInput
                v-model="form.user_id"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Nama"
              name="name"
              required
            >
              <UInput
                v-model="form.name"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Role"
            name="role"
            required
          >
            <USelect
              v-model="form.role"
              :items="roleOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Email"
            name="email"
            required
          >
            <UInput
              v-model="form.email"
              type="email"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="editing ? 'Password Baru (opsional)' : 'Password'"
            name="password"
            :required="!editing"
          >
            <UInput
              v-model="form.password"
              type="password"
              class="w-full"
            />
          </UFormField>
          <UCheckbox
            v-model="form.active"
            label="Aktif"
          />
          <UButton
            type="submit"
            block
            :loading="saving"
          >
            Simpan
          </UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
