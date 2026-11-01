<script setup lang="ts">
type Row = Record<string, any>

const { request, message } = useServiceApi()
const rows = ref<Row[]>([])
const warehouses = ref<Row[]>([])
const summary = ref({ available: 0, reserved: 0, issued: 0, installed: 0 })
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const actionModalOpen = ref(false)
const actionRow = ref<Row | null>(null)
const action = ref<'transfer' | 'withdraw' | 'return'>('transfer')
const actionForm = reactive({ gudang_id: '', alasan: '' })
const saving = ref(false)

const warehouseOptions = computed(() => warehouses.value.filter(item => item.aktif).map(item => ({ label: `${item.kode_gudang} — ${item.nama_gudang}`, value: item.id })))
const searchKeywords = computed(() => search.value.split(',').map(keyword => keyword.trim().toLocaleLowerCase()).filter(Boolean))
const filteredRows = computed(() => rows.value.filter((row) => {
  const haystack = [row.mp_no, row.serial_number, row.kategori, row.model, row.lokasi, row.status_operasional, row.status]
    .filter(Boolean).join(' ').toLocaleLowerCase()
  return searchKeywords.value.every(keyword => haystack.includes(keyword))
}))
const paginatedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const total = computed(() => filteredRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const columns = [
  { accessorKey: 'mp_no', header: 'MP No' },
  { accessorKey: 'serial_number', header: 'Serial' },
  { accessorKey: 'kategori', header: 'Kategori' },
  { accessorKey: 'model', header: 'Model' },
  { accessorKey: 'lokasi', header: 'Lokasi' },
  { accessorKey: 'status_operasional', header: 'Status' },
  { id: 'actions', header: 'Aksi' }
]
const actionTitle = computed(() => ({ transfer: 'Pindah Gudang', withdraw: 'Keluarkan Unit', return: 'Kembalikan Unit' })[action.value])

function locationLabel(row: Row) {
  if (row.status === 'installed') return `Customer: ${row.master_account?.nama_account || '-'} / ${row.master_customer?.nama_customer || '-'}`
  if (row.status === 'issued') return 'Dalam proses surat tugas'
  return `Gudang: ${row.master_gudang?.nama_gudang || '-'}`
}

function normalizeRow(row: Row) {
  return { ...row, kategori: row.master_printer_model?.master_printer_kategori?.nama_kategori || '-', model: [row.master_printer_model?.merek, row.master_printer_model?.nama_model].filter(Boolean).join(' ') || '-', lokasi: locationLabel(row) }
}

async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [listResponse, summaryResponse] = await Promise.all([
      request<{ data: { items: Row[], meta: { total: number } } }>('/printer?halaman=1&batas=100'),
      request<{ data: typeof summary.value }>('/printer/summary')
    ])
    const firstPage = listResponse.data.items
    const allItems = [...firstPage]
    const totalItems = listResponse.data.meta.total
    for (let nextPage = 2; allItems.length < totalItems; nextPage += 1) {
      const response = await request<{ data: { items: Row[] } }>(`/printer?halaman=${nextPage}&batas=100`)
      allItems.push(...response.data.items)
      if (!response.data.items.length) break
    }
    rows.value = allItems.map(normalizeRow)
    page.value = Math.min(page.value, totalPages.value)
    summary.value = summaryResponse.data
  } catch (error) {
    errorMessage.value = message(error, 'Stok printer gagal dimuat.')
  } finally {
    loading.value = false
  }
}

async function loadLookups() {
  try {
    const warehouseResponse = await request<{ data: { items: Row[] } }>('/gudang?halaman=1&batas=100')
    warehouses.value = warehouseResponse.data.items
  } catch (error) {
    errorMessage.value = message(error, 'Filter printer gagal dimuat.')
  }
}

function resetPage() { page.value = 1 }

function openAction(row: Row, nextAction: 'transfer' | 'withdraw' | 'return') {
  actionRow.value = row
  action.value = nextAction
  actionForm.gudang_id = ''
  actionForm.alasan = ''
  actionModalOpen.value = true
}

async function submitAction() {
  if (!actionRow.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await request(`/printer/${actionRow.value.id}/${action.value}`, { method: 'POST', body: { ...(action.value === 'withdraw' ? {} : { gudang_id: actionForm.gudang_id }), alasan: actionForm.alasan.trim() } })
    actionModalOpen.value = false
    successMessage.value = 'Aksi printer berhasil diproses.'
    await loadRows()
  } catch (error) {
    errorMessage.value = message(error, 'Aksi printer gagal diproses.')
  } finally { saving.value = false }
}

watch([search, pageSize], resetPage)
onMounted(async () => { await loadLookups(); await loadRows() })
</script>

<template>
  <div class="space-y-6">
    <UPageHeader title="Stok Printer" description="Unit printer di gudang dan di customer." />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="item in [{ key: 'available', label: 'Tersedia' }, { key: 'reserved', label: 'Direservasi' }, { key: 'issued', label: 'Keluar gudang' }, { key: 'installed', label: 'Di customer' }]" :key="item.key">
        <p class="text-sm text-dimmed">{{ item.label }}</p>
        <p class="mt-2 text-2xl font-semibold text-highlighted">{{ summary[item.key as keyof typeof summary] }}</p>
      </UCard>
    </div>
    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
    <UAlert v-if="successMessage" color="success" variant="subtle" :title="successMessage" />
    <UCard>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Cari MP No, Serial, kategori, model, lokasi — pisahkan keyword dengan koma" class="w-full" @keyup.enter="resetPage" />
        <div class="flex shrink-0 justify-end gap-2"><UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" aria-label="Refresh data" :loading="loading" @click="loadRows" /><UButton icon="i-lucide-plus" label="Tambah Unit" to="/master/printer" /></div>
      </div>
    </UCard>
    <UCard>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold text-highlighted">Daftar Unit Printer</h2><p class="text-sm text-dimmed">{{ total }} unit ditemukan</p></div><USelect v-model="pageSize" :items="[10, 25, 50].map(value => ({ label: `${value} baris`, value }))" class="w-32" /></div>
      <UTable :data="paginatedRows" :columns="columns" :loading="loading">
        <template #serial_number-cell="{ row }">{{ row.original.serial_number || '-' }}</template>
        <template #status_operasional-cell="{ row }"><UBadge color="info" variant="subtle">{{ row.original.status_operasional || row.original.status || '-' }}</UBadge></template>
        <template #actions-cell="{ row }"><div class="flex flex-wrap gap-1"><UButton v-if="row.original.status === 'available'" size="xs" color="primary" variant="ghost" label="Transfer" @click="openAction(row.original, 'transfer')" /><UButton v-if="row.original.status === 'available'" size="xs" color="warning" variant="ghost" label="Keluarkan" @click="openAction(row.original, 'withdraw')" /><UButton v-if="row.original.status === 'issued'" size="xs" color="success" variant="ghost" label="Kembalikan" @click="openAction(row.original, 'return')" /><span v-if="!['available', 'issued'].includes(row.original.status)" class="text-xs text-dimmed">—</span></div></template>
        <template #empty><div class="py-8 text-center text-sm text-dimmed">{{ loading ? 'Memuat data...' : 'Belum ada unit printer.' }}</div></template>
      </UTable>
      <div class="mt-4 flex justify-end"><UPagination v-model:page="page" :page-count="pageSize" :total="total" /></div>
    </UCard>
    <UModal v-model:open="actionModalOpen" :title="actionTitle">
      <template #body><UForm :state="actionForm" class="space-y-4" @submit="submitAction"><p class="text-sm text-dimmed">{{ actionRow?.mp_no }}</p><UFormField v-if="action !== 'withdraw'" label="Gudang Tujuan" name="gudang_id" required><USelect v-model="actionForm.gudang_id" :items="warehouseOptions.filter(item => item.value !== actionRow?.gudang_id)" placeholder="Pilih gudang" class="w-full" /></UFormField><UFormField label="Alasan" name="alasan" required><UTextarea v-model="actionForm.alasan" placeholder="Tuliskan alasan aksi" class="w-full" /></UFormField><UButton type="submit" block :loading="saving">Proses</UButton></UForm></template>
    </UModal>
  </div>
</template>
