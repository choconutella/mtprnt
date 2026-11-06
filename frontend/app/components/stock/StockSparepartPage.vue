<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const { request, message } = useServiceApi()
const auth = useAuth()
const rows = ref<Row[]>([])
const warehouses = ref<Row[]>([])
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const modalOpen = ref(false)
const form = reactive({ jenis_mutasi: 'masuk' as 'masuk' | 'keluar', gudang_asal_id: '', gudang_tujuan_id: '', suku_cadang_id: '', jumlah: 1, keterangan: '' })

const normalizedRole = computed(() => String(auth.user.value?.role || '').trim().toLowerCase().replaceAll('-', '_'))
const canManageStock = computed(() => ['admin', 'warehouse'].includes(normalizedRole.value))
const warehouseOptions = computed(() => warehouses.value.filter(item => item.aktif !== false).map(item => ({ label: `${item.kode_gudang} — ${item.nama_gudang}`, value: item.id })))
const sparepartOptions = computed(() => {
  const options = new Map<string, { label: string, value: string }>()
  rows.value.filter(item => item.master_suku_cadang?.id).forEach((item) => {
    if (!options.has(item.suku_cadang_id)) options.set(item.suku_cadang_id, { label: `${item.master_suku_cadang.kode_suku_cadang} — ${item.master_suku_cadang.nama_suku_cadang}`, value: item.suku_cadang_id })
  })
  return [...options.values()]
})
const keywords = computed(() => search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))
const filteredRows = computed(() => rows.value.filter((row) => {
  const text = [row.master_gudang?.kode_gudang, row.master_gudang?.nama_gudang, row.master_suku_cadang?.kode_suku_cadang, row.master_suku_cadang?.nama_suku_cadang].filter(Boolean).join(' ').toLocaleLowerCase()
  return keywords.value.every(keyword => text.includes(keyword))
}))
const total = computed(() => filteredRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const paginatedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const columns = [
  { accessorKey: 'gudang', header: 'Gudang' },
  { accessorKey: 'sparepart', header: 'Barang' },
  { accessorKey: 'jumlah_tersedia', header: 'Tersedia' },
  { id: 'actions', header: 'Aksi' }
]

function normalizeRows(items: Row[]) {
  return items.map(item => ({ ...item, gudang: item.belum_ditempatkan ? 'Belum ada gudang' : item.master_gudang?.nama_gudang || '-', sparepart: item.master_suku_cadang?.nama_suku_cadang || '-' }))
}

async function loadRows() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await request<{ data: { suku_cadang: Row[] } }>('/stok')
    rows.value = normalizeRows(response.data.suku_cadang || [])
    page.value = Math.min(page.value, totalPages.value)
  } catch (error) {
    errorMessage.value = message(error, 'Stok sparepart gagal dimuat.')
  } finally {
    loading.value = false
  }
}

async function loadWarehouses() {
  try {
    const response = await request<{ data: { items: Row[] } }>('/gudang?halaman=1&batas=100')
    warehouses.value = response.data.items || []
  } catch (error) {
    errorMessage.value = message(error, 'Daftar gudang gagal dimuat.')
  }
}

function openMutation(type: 'masuk' | 'keluar', row?: Row) {
  if (!canManageStock.value) return
  Object.assign(form, { jenis_mutasi: type, gudang_asal_id: type === 'keluar' ? row?.gudang_id || '' : '', gudang_tujuan_id: type === 'masuk' ? row?.gudang_id || '' : '', suku_cadang_id: row?.suku_cadang_id || '', jumlah: 1, keterangan: '' })
  errorMessage.value = ''
  modalOpen.value = true
}

async function saveMutation() {
  if (!form.suku_cadang_id || !form.jumlah || (form.jenis_mutasi === 'masuk' ? !form.gudang_tujuan_id : !form.gudang_asal_id)) {
    errorMessage.value = 'Lengkapi gudang, barang sparepart, dan jumlah.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await request('/mutasi-stok', { method: 'POST', body: { jenis_mutasi: form.jenis_mutasi, gudang_asal_id: form.jenis_mutasi === 'keluar' ? form.gudang_asal_id : null, gudang_tujuan_id: form.jenis_mutasi === 'masuk' ? form.gudang_tujuan_id : null, keterangan: form.keterangan.trim() || null, langsung_posting: true, detail: [{ jenis_barang: 'suku_cadang', suku_cadang_id: form.suku_cadang_id, jumlah: Number(form.jumlah), satuan: 'pcs' }] } })
    modalOpen.value = false
    successMessage.value = form.jenis_mutasi === 'masuk' ? 'Stok sparepart berhasil ditambahkan.' : 'Stok sparepart berhasil dikurangi.'
    await loadRows()
  } catch (error) {
    errorMessage.value = message(error, 'Mutasi stok gagal disimpan.')
  } finally {
    saving.value = false
  }
}

watch([search, pageSize], () => { page.value = 1 })
watch(page, () => { if (page.value > totalPages.value) page.value = totalPages.value })
onMounted(async () => { await Promise.all([loadRows(), loadWarehouses()]) })
</script>

<template>
  <div class="space-y-6">
    <UPageHeader title="Stok Sparepart" description="Pantau ketersediaan sparepart di setiap gudang." />
    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
    <UAlert v-if="successMessage" color="success" variant="subtle" :title="successMessage" />
    <UAlert v-if="!canManageStock" color="info" variant="subtle" title="Mode lihat saja: role Anda tidak memiliki akses mutasi stok." />
    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Cari gudang, kode, atau nama sparepart" class="w-full lg:max-w-xl" />
        <div class="flex items-center gap-2 lg:ms-auto"><UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" aria-label="Refresh data" :loading="loading" @click="loadRows" /><UButton icon="i-lucide-plus" label="Tambah Stok" :disabled="!canManageStock" @click="openMutation('masuk')" /></div>
      </div>
    </UCard>
    <UCard>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold text-highlighted">Daftar Stok Sparepart</h2><p class="text-sm text-dimmed">{{ total }} item ditemukan</p></div><USelect v-model="pageSize" :items="[5, 10, 25].map(value => ({ label: `${value} baris`, value }))" class="w-32" /></div>
      <UTable :data="paginatedRows" :columns="columns" :loading="loading">
        <template #gudang-cell="{ row }">{{ row.original.gudang }}</template>
        <template #sparepart-cell="{ row }"><div><p class="font-medium text-highlighted">{{ row.original.sparepart }}</p><p class="text-xs text-dimmed">{{ row.original.master_suku_cadang?.kode_suku_cadang || '-' }}</p></div></template>
        <template #jumlah_tersedia-cell="{ row }"><UBadge color="success" variant="subtle">{{ row.original.jumlah_tersedia }}</UBadge></template>
        <template #actions-cell="{ row }"><div class="flex flex-wrap gap-1"><UButton size="xs" color="success" variant="ghost" icon="i-lucide-plus" aria-label="Tambah stok" :disabled="!canManageStock || row.original.belum_ditempatkan" @click="openMutation('masuk', row.original)" /><UButton size="xs" color="warning" variant="ghost" icon="i-lucide-minus" aria-label="Kurangi stok" :disabled="!canManageStock || row.original.belum_ditempatkan || Number(row.original.jumlah_tersedia) <= 0" @click="openMutation('keluar', row.original)" /></div></template>
        <template #empty><div class="py-8 text-center text-sm text-dimmed">{{ loading ? 'Memuat stok...' : 'Belum ada stok sparepart.' }}</div></template>
      </UTable>
      <div class="mt-4 flex justify-end"><UPagination v-model:page="page" :page-count="pageSize" :total="total" /></div>
    </UCard>
    <UModal v-model:open="modalOpen" :title="form.jenis_mutasi === 'masuk' ? 'Tambah Stok Sparepart' : 'Kurangi Stok Sparepart'">
      <template #body><UForm :state="form" class="space-y-4" @submit="saveMutation"><UFormField label="Barang Sparepart" name="suku_cadang_id" required><USelect v-model="form.suku_cadang_id" :items="sparepartOptions" placeholder="Pilih sparepart" class="w-full" /></UFormField><UFormField :label="form.jenis_mutasi === 'masuk' ? 'Gudang Tujuan' : 'Gudang Asal'" name="gudang" required><USelect v-if="form.jenis_mutasi === 'masuk'" v-model="form.gudang_tujuan_id" :items="warehouseOptions" placeholder="Pilih gudang" class="w-full" /><USelect v-else v-model="form.gudang_asal_id" :items="warehouseOptions" placeholder="Pilih gudang" class="w-full" /></UFormField><UFormField label="Jumlah" name="jumlah" required><UInput v-model="form.jumlah" type="number" min="1" step="1" class="w-full" /></UFormField><UFormField label="Keterangan" name="keterangan"><UTextarea v-model="form.keterangan" placeholder="Opsional" class="w-full" /></UFormField><UButton type="submit" block :loading="saving">Simpan dan Posting</UButton></UForm></template>
    </UModal>
  </div>
</template>
