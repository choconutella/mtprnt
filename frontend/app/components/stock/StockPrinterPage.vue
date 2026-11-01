<script setup lang="ts">
type Row = Record<string, any>

const { request, message } = useServiceApi()
const rows = ref<Row[]>([])
const categories = ref<Row[]>([])
const models = ref<Row[]>([])
const warehouses = ref<Row[]>([])
const technicians = ref<Row[]>([])
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
const crudModalOpen = ref(false)
const crudSaving = ref(false)
const crudError = ref('')
const editing = ref<Row | null>(null)
const form = reactive({ mp_no: '', serial_number: '', model_id: '', gudang_id: '', tanggal_pembelian: '', tanggal_maintenance_berikutnya: '', interval_maintenance_bulan: null as number | null, keterangan: '' })
const quickModelModalOpen = ref(false)
const quickModelSaving = ref(false)
const quickModelError = ref('')
const quickModel = reactive({ kategori_id: '', kode_model: '', merek: '', nama_model: '' })
const quickWarehouseModalOpen = ref(false)
const quickWarehouseSaving = ref(false)
const quickWarehouseError = ref('')
const quickWarehouse = reactive({ kode_gudang: '', nama_gudang: '', jenis_gudang: 'utama', teknisi_id: '', alamat: '' })
const createModelValue = '__create_model__'
const createWarehouseValue = '__create_warehouse__'
const createCategoryValue = '__create_category__'
const quickCategoryModalOpen = ref(false)
const quickCategorySaving = ref(false)
const quickCategoryError = ref('')
const quickCategory = reactive({ kode_kategori: '', nama_kategori: '' })

const categoryOptions = computed(() => [...categories.value.filter(item => item.aktif).map(item => ({ label: `${item.kode_kategori} — ${item.nama_kategori}`, value: item.id })), { label: '+ Buat Kategori', value: createCategoryValue }])
const modelOptions = computed(() => [...models.value.filter(item => item.aktif).map(item => ({ label: `${item.merek} — ${item.nama_model}`, value: item.id })), { label: '+ Buat Model', value: createModelValue }])
const warehouseOptions = computed(() => warehouses.value.filter(item => item.aktif).map(item => ({ label: `${item.kode_gudang} — ${item.nama_gudang}`, value: item.id })))
const warehouseCreateOptions = computed(() => [...warehouseOptions.value, { label: '+ Buat Gudang', value: createWarehouseValue }])
const technicianOptions = computed(() => technicians.value.filter(item => item.role === 'teknisi' && item.active).map(item => ({ label: `${item.user_id} — ${item.name}`, value: item.id })))
const modelSelection = computed({ get: () => form.model_id, set: (value: string) => { if (value === createModelValue) openQuickModel(); else form.model_id = value } })
const warehouseSelection = computed({ get: () => form.gudang_id, set: (value: string) => { if (value === createWarehouseValue) openQuickWarehouse(); else form.gudang_id = value } })
const quickCategorySelection = computed({ get: () => quickModel.kategori_id, set: (value: string) => { if (value === createCategoryValue) openQuickCategory(); else quickModel.kategori_id = value } })
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
    const [categoryResponse, modelResponse, warehouseResponse] = await Promise.all([
      request<{ data: { items: Row[] } }>('/printer-kategori?halaman=1&batas=100'),
      request<{ data: { items: Row[] } }>('/printer-model?halaman=1&batas=100'),
      request<{ data: { items: Row[] } }>('/gudang?halaman=1&batas=100')
    ])
    categories.value = categoryResponse.data.items
    models.value = modelResponse.data.items
    warehouses.value = warehouseResponse.data.items
  } catch (error) {
    errorMessage.value = message(error, 'Filter printer gagal dimuat.')
  }
}

function resetPage() { page.value = 1 }

function resetForm() {
  Object.assign(form, { mp_no: '', serial_number: '', model_id: '', gudang_id: '', tanggal_pembelian: '', tanggal_maintenance_berikutnya: '', interval_maintenance_bulan: null, keterangan: '' })
}

function openQuickModel() {
  Object.assign(quickModel, { kategori_id: '', kode_model: '', merek: '', nama_model: '' })
  quickModelError.value = ''
  quickModelModalOpen.value = true
}

function openQuickCategory() {
  Object.assign(quickCategory, { kode_kategori: '', nama_kategori: '' })
  quickCategoryError.value = ''
  quickCategoryModalOpen.value = true
}

async function createQuickCategory() {
  if (!quickCategory.kode_kategori.trim() || !quickCategory.nama_kategori.trim()) {
    quickCategoryError.value = 'Lengkapi kode dan nama kategori.'
    return
  }
  quickCategorySaving.value = true
  quickCategoryError.value = ''
  try {
    const response = await request<{ data: Row }>('/printer-kategori', { method: 'POST', body: { kode_kategori: quickCategory.kode_kategori.trim(), nama_kategori: quickCategory.nama_kategori.trim(), aktif: true } })
    categories.value.push(response.data)
    quickModel.kategori_id = response.data.id
    quickCategoryModalOpen.value = false
    successMessage.value = 'Kategori printer berhasil dibuat dan dipilih.'
  } catch (error) {
    quickCategoryError.value = message(error, 'Kategori printer gagal dibuat.')
  } finally { quickCategorySaving.value = false }
}

async function createQuickModel() {
  if (!quickModel.kategori_id || !quickModel.kode_model.trim() || !quickModel.merek.trim() || !quickModel.nama_model.trim()) {
    quickModelError.value = 'Lengkapi kategori, kode model, merek, dan nama model.'
    return
  }
  quickModelSaving.value = true
  quickModelError.value = ''
  try {
    const response = await request<{ data: Row }>('/printer-model', { method: 'POST', body: { kategori_id: quickModel.kategori_id, kode_model: quickModel.kode_model.trim(), merek: quickModel.merek.trim(), nama_model: quickModel.nama_model.trim(), aktif: true } })
    models.value.push(response.data)
    form.model_id = response.data.id
    quickModelModalOpen.value = false
    successMessage.value = 'Model printer berhasil dibuat dan dipilih.'
  } catch (error) {
    quickModelError.value = message(error, 'Model printer gagal dibuat.')
  } finally { quickModelSaving.value = false }
}

async function openQuickWarehouse() {
  Object.assign(quickWarehouse, { kode_gudang: '', nama_gudang: '', jenis_gudang: 'utama', teknisi_id: '', alamat: '' })
  quickWarehouseError.value = ''
  quickWarehouseModalOpen.value = true
  try {
    const response = await request<{ data: Row[] }>('/pengguna')
    technicians.value = response.data
  } catch { technicians.value = [] }
}

async function createQuickWarehouse() {
  if (!quickWarehouse.kode_gudang.trim() || !quickWarehouse.nama_gudang.trim() || (quickWarehouse.jenis_gudang === 'teknisi' && !quickWarehouse.teknisi_id)) {
    quickWarehouseError.value = 'Lengkapi kode, nama, dan teknisi jika jenis gudang adalah Teknisi.'
    return
  }
  quickWarehouseSaving.value = true
  quickWarehouseError.value = ''
  try {
    const response = await request<{ data: Row }>('/gudang', { method: 'POST', body: { kode_gudang: quickWarehouse.kode_gudang.trim(), nama_gudang: quickWarehouse.nama_gudang.trim(), jenis_gudang: quickWarehouse.jenis_gudang, teknisi_id: quickWarehouse.jenis_gudang === 'teknisi' ? quickWarehouse.teknisi_id : null, alamat: quickWarehouse.alamat.trim() || null, aktif: true } })
    warehouses.value.push(response.data)
    form.gudang_id = response.data.id
    quickWarehouseModalOpen.value = false
    successMessage.value = 'Gudang berhasil dibuat dan dipilih.'
  } catch (error) {
    quickWarehouseError.value = message(error, 'Gudang gagal dibuat.')
  } finally { quickWarehouseSaving.value = false }
}

function openCreate() {
  editing.value = null
  resetForm()
  crudError.value = ''
  crudModalOpen.value = true
}

function openEdit(row: Row) {
  editing.value = row
  Object.assign(form, { mp_no: row.mp_no || '', serial_number: row.serial_number || '', model_id: row.model_id || '', gudang_id: row.gudang_id || '', tanggal_pembelian: row.tanggal_pembelian?.slice?.(0, 10) || '', tanggal_maintenance_berikutnya: row.tanggal_maintenance_berikutnya?.slice?.(0, 10) || '', interval_maintenance_bulan: row.interval_maintenance_bulan || null, keterangan: row.keterangan || '' })
  crudError.value = ''
  crudModalOpen.value = true
}

async function savePrinter() {
  if (!form.mp_no.trim() || !form.model_id || !form.gudang_id) {
    crudError.value = 'Lengkapi MP No, model, dan gudang.'
    return
  }
  crudSaving.value = true
  crudError.value = ''
  try {
    const body = { ...form, mp_no: form.mp_no.trim(), serial_number: form.serial_number.trim() || null, interval_maintenance_bulan: form.interval_maintenance_bulan ? Number(form.interval_maintenance_bulan) : null }
    if (editing.value) await request(`/printer/${editing.value.id}`, { method: 'PUT', body })
    else await request('/printer', { method: 'POST', body })
    crudModalOpen.value = false
    successMessage.value = `Unit printer berhasil ${editing.value ? 'diperbarui' : 'dibuat'}.`
    await loadRows()
  } catch (error) {
    crudError.value = message(error, 'Unit printer gagal disimpan.')
  } finally { crudSaving.value = false }
}

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
        <div class="flex shrink-0 justify-end gap-2"><UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" aria-label="Refresh data" :loading="loading" @click="loadRows" /><UButton icon="i-lucide-plus" label="Tambah Unit" @click="openCreate" /></div>
      </div>
    </UCard>
    <UCard>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold text-highlighted">Daftar Unit Printer</h2><p class="text-sm text-dimmed">{{ total }} unit ditemukan</p></div><USelect v-model="pageSize" :items="[10, 25, 50].map(value => ({ label: `${value} baris`, value }))" class="w-32" /></div>
      <UTable :data="paginatedRows" :columns="columns" :loading="loading">
        <template #serial_number-cell="{ row }">{{ row.original.serial_number || '-' }}</template>
        <template #status_operasional-cell="{ row }"><UBadge color="info" variant="subtle">{{ row.original.status_operasional || row.original.status || '-' }}</UBadge></template>
        <template #actions-cell="{ row }"><div class="flex flex-wrap gap-1"><UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" aria-label="Edit unit" @click="openEdit(row.original)" /><UButton v-if="row.original.status === 'available'" size="xs" color="primary" variant="ghost" label="Transfer" @click="openAction(row.original, 'transfer')" /><UButton v-if="row.original.status === 'available'" size="xs" color="warning" variant="ghost" label="Keluarkan" @click="openAction(row.original, 'withdraw')" /><UButton v-if="row.original.status === 'issued'" size="xs" color="success" variant="ghost" label="Kembalikan" @click="openAction(row.original, 'return')" /></div></template>
        <template #empty><div class="py-8 text-center text-sm text-dimmed">{{ loading ? 'Memuat data...' : 'Belum ada unit printer.' }}</div></template>
      </UTable>
      <div class="mt-4 flex justify-end"><UPagination v-model:page="page" :page-count="pageSize" :total="total" /></div>
    </UCard>
    <UModal v-model:open="actionModalOpen" :title="actionTitle">
      <template #body><UForm :state="actionForm" class="space-y-4" @submit="submitAction"><p class="text-sm text-dimmed">{{ actionRow?.mp_no }}</p><UFormField v-if="action !== 'withdraw'" label="Gudang Tujuan" name="gudang_id" required><USelect v-model="actionForm.gudang_id" :items="warehouseOptions.filter(item => item.value !== actionRow?.gudang_id)" placeholder="Pilih gudang" class="w-full" /></UFormField><UFormField label="Alasan" name="alasan" required><UTextarea v-model="actionForm.alasan" placeholder="Tuliskan alasan aksi" class="w-full" /></UFormField><UButton type="submit" block :loading="saving">Proses</UButton></UForm></template>
    </UModal>
    <UModal v-model:open="crudModalOpen" :title="editing ? 'Edit Unit Printer' : 'Tambah Unit Printer'">
      <template #body>
        <UForm :state="form" class="space-y-4" @submit="savePrinter">
          <UAlert v-if="crudError" color="error" variant="subtle" :title="crudError" />
          <UFormField label="MP No" name="mp_no" required><UInput v-model="form.mp_no" class="w-full" /></UFormField>
          <UFormField label="Serial Number" name="serial_number"><UInput v-model="form.serial_number" class="w-full" /></UFormField>
          <UFormField label="Model" name="model_id" required><USelect v-model="modelSelection" :items="modelOptions" placeholder="Pilih model" class="w-full" /></UFormField>
          <UFormField v-if="!editing" label="Gudang Awal" name="gudang_id" required><USelect v-model="warehouseSelection" :items="warehouseCreateOptions" placeholder="Pilih gudang" class="w-full" /></UFormField>
          <div class="grid gap-4 sm:grid-cols-2"><UFormField label="Tanggal Pembelian"><UInput v-model="form.tanggal_pembelian" type="date" /></UFormField><UFormField label="Maintenance Berikutnya"><UInput v-model="form.tanggal_maintenance_berikutnya" type="date" /></UFormField></div>
          <UFormField label="Interval Maintenance (Bulan)"><UInput v-model="form.interval_maintenance_bulan" type="number" min="1" max="120" /></UFormField>
          <UFormField label="Keterangan"><UTextarea v-model="form.keterangan" class="w-full" /></UFormField>
          <UButton type="submit" block :loading="crudSaving">Simpan</UButton>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="quickModelModalOpen" title="Buat Model Printer">
      <template #body>
        <UForm :state="quickModel" class="space-y-4" @submit="createQuickModel">
          <UAlert v-if="quickModelError" color="error" variant="subtle" :title="quickModelError" />
          <UFormField label="Kategori" name="kategori_id" required><USelect v-model="quickCategorySelection" :items="categoryOptions" placeholder="Pilih kategori" class="w-full" /></UFormField>
          <UFormField label="Kode Model" name="kode_model" required><UInput v-model="quickModel.kode_model" class="w-full" /></UFormField>
          <UFormField label="Merek" name="merek" required><UInput v-model="quickModel.merek" class="w-full" /></UFormField>
          <UFormField label="Nama Model" name="nama_model" required><UInput v-model="quickModel.nama_model" class="w-full" /></UFormField>
          <UButton type="submit" block :loading="quickModelSaving">Simpan Model</UButton>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="quickWarehouseModalOpen" title="Buat Gudang">
      <template #body>
        <UForm :state="quickWarehouse" class="space-y-4" @submit="createQuickWarehouse">
          <UAlert v-if="quickWarehouseError" color="error" variant="subtle" :title="quickWarehouseError" />
          <UFormField label="Kode Gudang" name="kode_gudang" required><UInput v-model="quickWarehouse.kode_gudang" class="w-full" /></UFormField>
          <UFormField label="Nama Gudang" name="nama_gudang" required><UInput v-model="quickWarehouse.nama_gudang" class="w-full" /></UFormField>
          <UFormField label="Jenis Gudang" name="jenis_gudang" required><USelect v-model="quickWarehouse.jenis_gudang" :items="[{ label: 'Utama', value: 'utama' }, { label: 'Cabang', value: 'cabang' }, { label: 'Teknisi', value: 'teknisi' }]" class="w-full" /></UFormField>
          <UFormField v-if="quickWarehouse.jenis_gudang === 'teknisi'" label="Teknisi" name="teknisi_id" required><USelect v-model="quickWarehouse.teknisi_id" :items="technicianOptions" placeholder="Pilih teknisi" class="w-full" /></UFormField>
          <UFormField label="Alamat" name="alamat"><UTextarea v-model="quickWarehouse.alamat" class="w-full" /></UFormField>
          <UButton type="submit" block :loading="quickWarehouseSaving">Simpan Gudang</UButton>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="quickCategoryModalOpen" title="Buat Kategori Printer">
      <template #body>
        <UForm :state="quickCategory" class="space-y-4" @submit="createQuickCategory">
          <UAlert v-if="quickCategoryError" color="error" variant="subtle" :title="quickCategoryError" />
          <UFormField label="Kode Kategori" name="kode_kategori" required><UInput v-model="quickCategory.kode_kategori" class="w-full" /></UFormField>
          <UFormField label="Nama Kategori" name="nama_kategori" required><UInput v-model="quickCategory.nama_kategori" class="w-full" /></UFormField>
          <UButton type="submit" block :loading="quickCategorySaving">Simpan Kategori</UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
