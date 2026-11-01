<script setup lang="ts">
// The Surat Tugas payload contains several legacy relation shapes; keep the UI adapter tolerant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const { request, message } = useServiceApi()
const auth = useAuth()
const rows = ref<Row[]>([])
const options = reactive<Record<string, Row[]>>({ tickets: [], accounts: [], customers: [], contracts: [], printers: [], models: [], warehouses: [], users: [], toners: [], spareparts: [] })
const search = ref('')
const customerSearch = ref('')
const customerLoading = ref(false)
const technicianSearch = ref('')
const technicianSearchTerm = ref('')
const technicianLoading = ref(false)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const createOpen = ref(false)
const detailOpen = ref(false)
const detail = ref<Row | null>(null)
const tab = ref('general')
const printerSearch = ref('')
const printerLoading = ref(false)
const form = reactive({ tiket_id: '', jenis_tugas: '', mode: '', account_id: '', customer_id: '', kontrak_id: '', unit_asal_id: '', gudang_id: '', pic_teknisi_id: '', pic_warehouse_id: '', lokasi_internal: '', sumber: '', new_mp_no: '', new_model_id: '', printer_ids: [] as string[], hasil: '' })
const itemForm = reactive({ jenis_barang: 'toner', item_id: '', gudang_id: '', jumlah_pakai: 1, keterangan: '' })
const resultForms = reactive<Record<string, { hasil: string, kondisi_hasil: string, alasan: string }>>({})

const kinds: Record<string, string> = {
  kirim_kontrak: 'Pengiriman Kontrak', terima_tukar: 'Penerimaan Tukar', kirim_trial: 'Pengiriman Trial', kirim_stand_by: 'Pengiriman Stand-by', kirim_event: 'Pengiriman Event', kirim_sell: 'Penjualan', kirim_toner: 'Pengiriman Toner', on_site_service: 'On-site Service', kirim_back_up: 'Pengiriman Back-up', terima_unit_rusak: 'Terima Unit Rusak', repair: 'Repair', qc: 'QC', internal_use: 'Internal Use', terima_return: 'Return', terima_printer_baru: 'Penerimaan Printer', maintenance: 'Maintenance'
}
const role = computed(() => String(auth.user.value?.role || '').replaceAll('-', '_'))
const canCreate = computed(() => ['admin', 'kepala_teknisi', 'warehouse'].includes(role.value))
const isInbound = computed(() => form.jenis_tugas.startsWith('terima_'))
const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return rows.value
  return rows.value.filter(row => `${row.nomor_surat_tugas || ''} ${kinds[row.jenis_tugas] || row.jenis_tugas || row.jenis_pekerjaan || ''} ${row.status || ''} ${row.tiket?.nomor_tiket || ''}`.toLowerCase().includes(query))
})
const selectedTicket = computed(() => options.tickets.find(row => row.id === form.tiket_id))
const availablePrinters = computed(() => {
  return options.printers
})
const itemChoices = computed(() => itemForm.jenis_barang === 'toner' ? options.toners : options.spareparts)
const kindItems = computed(() => Object.entries(kinds).filter(([key]) => role.value !== 'warehouse' || key.startsWith('terima_')).map(([value, label]) => ({ label, value })))
const modeItems = computed(() => form.jenis_tugas === 'kirim_kontrak' ? [{ label: 'Baru', value: 'baru' }, { label: 'Tukar', value: 'tukar' }] : [{ label: 'Sementara', value: 'sementara' }, { label: 'Permanen', value: 'permanen' }])
const customerItems = computed(() => options.customers.filter(row => row.aktif !== false).map(row => {
  const account = options.accounts.find(item => item.id === row.account_id) || row.master_account || row.account
  return { label: `${row.nama_customer}${account?.nama_account ? ` · ${account.nama_account}` : ''}`, value: row.id }
}))
const warehouseItems = computed(() => options.warehouses.filter(row => row.aktif !== false).map(row => ({ label: row.nama_gudang, value: row.id })))
const technicianItems = computed(() => {
  const technicians = options.users.filter(row => (row.role || row.peran) === 'teknisi' && (row.active ?? row.aktif ?? true)).map(row => ({ label: row.name || row.nama_lengkap || row.user_id, value: row.id }))
  const query = technicianSearchTerm.value.trim().toLowerCase()
  const filtered = query ? technicians.filter(item => item.label.toLowerCase().includes(query)) : technicians.slice(0, 20)
  const selected = technicians.find(item => item.value === form.pic_teknisi_id)
  return selected && !filtered.some(item => item.value === selected.value) ? [selected, ...filtered] : filtered
})
const warehouseUserItems = computed(() => options.users.filter(row => (row.role || row.peran) === 'warehouse' && (row.active ?? row.aktif ?? true)).map(row => ({ label: row.name || row.nama_lengkap || row.user_id, value: row.id })))
function printerLocation(row: Row) {
  if (row.lokasi_jenis === 'customer' || row.master_customer) return `Customer/Site: ${row.master_customer?.nama_customer || row.nama_customer || '-'}${row.master_account?.nama_account ? ` · ${row.master_account.nama_account}` : ''}`
  if (row.lokasi_jenis === 'gudang' || row.master_gudang) return `Gudang: ${row.master_gudang?.nama_gudang || row.nama_gudang || '-'}`
  return `Lokasi: ${row.lokasi_jenis || 'lainnya'}`
}
const printerItems = computed(() => availablePrinters.value.map(row => ({ label: `${row.mp_no} · ${row.master_printer_model?.nama_model || row.nama_model || '-'}`, value: row.id })))
let customerSearchRequest = 0
let customerSearchTimer: ReturnType<typeof setTimeout> | undefined
let technicianSearchTimer: ReturnType<typeof setTimeout> | undefined
let printerSearchRequest = 0
let printerSearchTimer: ReturnType<typeof setTimeout> | undefined

function unwrap(response: Row): Row[] {
  const data = response?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  return []
}
async function all(path: string) {
  const response = await request<Row>(`${path}?halaman=1&batas=100`)
  return unwrap(response)
}
async function loadCustomers(query: string, initial = false) {
  const normalized = query.trim()
  if (!initial && normalized.length < 2) return
  const requestId = ++customerSearchRequest
  customerLoading.value = true
  try {
    const params = new URLSearchParams({ halaman: '1', batas: '20' })
    if (normalized) params.set('cari', normalized)
    const response = await request<Row>(`/account/lokasi-customer?${params}`)
    if (requestId === customerSearchRequest) options.customers = unwrap(response)
  } catch (error) {
    if (requestId === customerSearchRequest) errorMessage.value = message(error, 'Pencarian customer gagal.')
  } finally {
    if (requestId === customerSearchRequest) customerLoading.value = false
  }
}
const printerLocationParams = computed(() => {
  const shouldUseCustomer = isInbound.value || ['on_site_service', 'maintenance'].includes(form.jenis_tugas)
  return shouldUseCustomer && form.customer_id ? { customer_id: form.customer_id } : form.gudang_id ? { gudang_id: form.gudang_id } : {}
})
async function loadPrinters(query = '', initial = false) {
  const normalized = query.trim()
  if (!initial && normalized.length < 2) return
  const requestId = ++printerSearchRequest
  printerLoading.value = true
  try {
    const params = new URLSearchParams({ halaman: '1', batas: '20', ...printerLocationParams.value })
    if (normalized) params.set('cari', normalized)
    const response = await request<Row>(`/printer?${params}`)
    if (requestId === printerSearchRequest) {
      const selected = options.printers.filter(row => form.printer_ids.includes(row.id) || row.id === form.unit_asal_id)
      options.printers = [...new Map([...selected, ...unwrap(response)].map(row => [row.id, row])).values()]
    }
  } catch (error) {
    if (requestId === printerSearchRequest) errorMessage.value = message(error, 'Pencarian unit printer gagal.')
  } finally {
    if (requestId === printerSearchRequest) printerLoading.value = false
  }
}
async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    const [list, tickets, accounts, contracts, models, warehouses, users, toners, spareparts] = await Promise.all([
      all('/surat-tugas'), all('/tiket'), all('/account'), canCreate.value ? all('/kontrak') : Promise.resolve([]), all('/printer-model'), all('/gudang'), all('/pengguna'), all('/toner'), all('/suku-cadang')
    ])
    rows.value = list; Object.assign(options, { tickets, accounts, contracts, models, warehouses, users, toners, spareparts })
    await loadPrinters('', true)
  } catch (error) { errorMessage.value = message(error, 'Data Surat Tugas gagal dimuat.') } finally { loading.value = false }
}
function resetForm() { Object.assign(form, { tiket_id: '', jenis_tugas: '', mode: '', account_id: '', customer_id: '', kontrak_id: '', unit_asal_id: '', gudang_id: '', pic_teknisi_id: '', pic_warehouse_id: '', lokasi_internal: '', sumber: '', new_mp_no: '', new_model_id: '', printer_ids: [], hasil: '' }); printerSearch.value = '' }
function openCreate() { resetForm(); customerSearch.value = ''; errorMessage.value = ''; createOpen.value = true }
function useTicket() {
  const ticket = selectedTicket.value
  if (!ticket) return
  const map: Record<string, string> = { kontrak: 'kirim_kontrak', trial: 'kirim_trial', stand_by: 'kirim_stand_by', event: 'kirim_event', sell: 'kirim_sell', toner_purchase: 'kirim_toner', on_site_service: 'on_site_service', back_up: 'kirim_back_up', repair: 'repair', qc: 'qc', internal_use: 'internal_use', return: 'terima_return', penerimaan_printer: 'terima_printer_baru', maintenance: 'maintenance' }
  Object.assign(form, { account_id: ticket.account_id || '', customer_id: ticket.customer_id || '', mode: ticket.mode || '', kontrak_id: ticket.kontrak_id || '', lokasi_internal: ticket.lokasi_internal || '', jenis_tugas: map[ticket.jenis] || '' })
}
function selectCustomer(customerId: string) {
  const customer = options.customers.find(row => row.id === customerId)
  form.account_id = customer?.account_id || ''
}
function changeKind() { form.printer_ids = []; if (form.jenis_tugas !== 'kirim_kontrak') form.kontrak_id = '' }
function payload() {
  const ticket = selectedTicket.value
  const printer = form.jenis_tugas === 'terima_printer_baru'
    ? [{ mp_no: form.new_mp_no.trim(), model_id: form.new_model_id, sumber: form.sumber.trim(), peran: 'utama' }]
    : options.printers.filter(row => form.printer_ids.includes(row.id)).map(row => ({ printer_id: row.id, mp_no: row.mp_no, model_id: row.model_id, serial_number: row.serial_number, peran: 'utama' }))
  return { tiket_id: form.tiket_id || null, jenis_tugas: form.jenis_tugas, mode: form.mode || null, account_id: ticket?.account_id || form.account_id || null, customer_id: ticket?.customer_id || form.customer_id || null, kontrak_id: ticket?.kontrak_id || form.kontrak_id || null, unit_asal_id: form.unit_asal_id || null, gudang_id: form.gudang_id || null, pic_teknisi_id: form.pic_teknisi_id || null, pic_warehouse_id: form.pic_warehouse_id || null, lokasi_internal: form.lokasi_internal || null, sumber: form.sumber || null, printer }
}
async function create() { saving.value = true; errorMessage.value = ''; try { await request('/surat-tugas', { method: 'POST', body: payload() }); createOpen.value = false; successMessage.value = 'Surat Tugas berhasil dibuat.'; await load() } catch (error) { errorMessage.value = message(error, 'Surat Tugas gagal dibuat.') } finally { saving.value = false } }
async function openDetail(row: Row) { try { const response = await request<Row>(`/surat-tugas/${row.id}`); detail.value = response.data; tab.value = 'general'; form.hasil = detail.value?.hasil || ''; Object.keys(resultForms).forEach(key => delete resultForms[key]); detail.value?.surat_tugas_printer?.forEach((line: Row) => { resultForms[line.id] = { hasil: line.hasil || '', kondisi_hasil: line.kondisi_hasil || '', alasan: line.alasan || '' } }); detailOpen.value = true } catch (error) { errorMessage.value = message(error, 'Detail Surat Tugas gagal dimuat.') } }
function canAct(action: string) { const row = detail.value; if (!row) return false; const leader = ['admin', 'kepala_teknisi'].includes(role.value); const worker = ['admin', 'teknisi'].includes(role.value); const store = ['admin', 'warehouse'].includes(role.value); if (action === 'start') return (leader || (store && isInboundRow(row))) && row.status === 'pending'; if (action === 'ready-to-print') return worker && row.status === 'progress' && !isInboundRow(row); if (action === 'keluar') return store && row.status === 'ready_to_print' && !row.konfirmasi_keluar_pada && !isInboundRow(row); if (action === 'serah') return worker && row.status === 'ready_to_print' && !row.konfirmasi_serah_pada && (row.jenis_tugas?.startsWith('kirim_') || row.jenis_tugas === 'internal_use'); if (action === 'terima') return store && row.status === 'progress' && !row.konfirmasi_terima_pada && isInboundRow(row); if (action === 'selesai') return (worker || (store && isInboundRow(row))) && ['progress', 'ready_to_print', 'warehouse_validated'].includes(row.status); if (action === 'resolve') return leader && ['technician_completed', 'warehouse_validated'].includes(row.status); if (action === 'cancel') return (leader || (store && isInboundRow(row))) && !['solved', 'cancelled'].includes(row.status) && !row.konfirmasi_keluar_pada && !row.konfirmasi_serah_pada && !row.konfirmasi_terima_pada; return false }
function isInboundRow(row: Row) { return String(row.jenis_tugas || '').startsWith('terima_') }
async function action(name: string) { if (!detail.value || (name === 'cancel' && !window.confirm('Batalkan Surat Tugas ini?'))) return; saving.value = true; try { await request(`/surat-tugas/${detail.value.id}/${name}`, { method: 'POST', body: name === 'selesai' ? { hasil: form.hasil || null } : undefined }); successMessage.value = 'Status Surat Tugas diperbarui.'; await load(); await openDetail(detail.value) } catch (error) { errorMessage.value = message(error, 'Workflow Surat Tugas gagal diproses.') } finally { saving.value = false } }
async function assign() { if (!detail.value || !form.pic_teknisi_id) return; try { await request(`/surat-tugas/${detail.value.id}/assign`, { method: 'POST', body: { pic_teknisi_id: form.pic_teknisi_id } }); await openDetail(detail.value); successMessage.value = 'PIC teknisi ditugaskan.' } catch (error) { errorMessage.value = message(error, 'PIC gagal ditugaskan.') } }
async function saveResult(line: Row) { try { await request(`/surat-tugas/${detail.value?.id}/printer/${line.id}/hasil`, { method: 'PUT', body: resultForms[line.id] }); await openDetail(detail.value); successMessage.value = 'Hasil unit tersimpan.' } catch (error) { errorMessage.value = message(error, 'Hasil unit gagal disimpan.') } }
async function addItem() { try { const body = { gudang_id: itemForm.gudang_id, jenis_barang: itemForm.jenis_barang, jumlah_pakai: Number(itemForm.jumlah_pakai), keterangan: itemForm.keterangan || null, ...(itemForm.jenis_barang === 'toner' ? { toner_id: itemForm.item_id } : { suku_cadang_id: itemForm.item_id }) }; await request(`/surat-tugas/${detail.value?.id}/pemakaian`, { method: 'POST', body }); await openDetail(detail.value); tab.value = 'item'; successMessage.value = 'Item pemakaian ditambahkan.' } catch (error) { errorMessage.value = message(error, 'Item pemakaian gagal ditambahkan.') } }
async function deleteItem(item: Row) { if (!detail.value || !window.confirm('Hapus item pemakaian ini?')) return; try { await request(`/surat-tugas/${detail.value.id}/pemakaian/${item.id}`, { method: 'DELETE' }); await openDetail(detail.value); tab.value = 'item' } catch (error) { errorMessage.value = message(error, 'Item pemakaian gagal dihapus.') } }
onMounted(async () => { await load(); await loadCustomers('', true) })
watch(customerSearch, (value) => {
  if (customerSearchTimer) clearTimeout(customerSearchTimer)
  customerSearchTimer = setTimeout(() => loadCustomers(value), 300)
})
watch(technicianSearch, (value) => {
  if (technicianSearchTimer) clearTimeout(technicianSearchTimer)
  technicianLoading.value = true
  technicianSearchTimer = setTimeout(() => {
    technicianSearchTerm.value = value
    technicianLoading.value = false
  }, 300)
})
watch(printerSearch, (value) => {
  if (printerSearchTimer) clearTimeout(printerSearchTimer)
  printerLoading.value = true
  printerSearchTimer = setTimeout(() => loadPrinters(value), 300)
})
watch([() => form.customer_id, () => form.gudang_id, () => form.jenis_tugas], () => {
  if (createOpen.value) loadPrinters('', true)
})
</script>

<template>
  <div class="space-y-6">
    <UPageHeader title="Surat Tugas" description="Kelola penugasan, unit printer, pemakaian barang, dan workflow operasional." />
    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
    <UAlert v-if="successMessage" color="success" variant="subtle" :title="successMessage" />
    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center"><UInput v-model="search" icon="i-lucide-search" placeholder="Cari nomor, jenis, tiket, atau status" class="w-full lg:max-w-md" /><div class="flex gap-2 lg:ms-auto"><UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" aria-label="Refresh data" :loading="loading" @click="load" /><UButton v-if="canCreate" icon="i-lucide-plus" label="Buat Surat Tugas" @click="openCreate" /></div></div>
    </UCard>
    <UCard>
      <UTable :data="filteredRows" :columns="[{ accessorKey: 'nomor_surat_tugas', header: 'Nomor ST' }, { accessorKey: 'jenis_tugas', header: 'Jenis' }, { accessorKey: 'tiket', header: 'Tiket' }, { accessorKey: 'master_customer', header: 'Customer' }, { accessorKey: 'status', header: 'Status' }, { id: 'actions', header: 'Aksi' }]" :loading="loading">
        <template #jenis_tugas-cell="{ row }">{{ kinds[row.original.jenis_tugas] || row.original.jenis_pekerjaan || '-' }}</template>
        <template #tiket-cell="{ row }">{{ row.original.tiket?.nomor_tiket || 'Mandiri' }}</template>
        <template #master_customer-cell="{ row }">{{ row.original.master_customer?.nama_customer || '-' }}</template>
        <template #status-cell="{ row }"><UBadge :color="['solved', 'technician_completed'].includes(row.original.status) ? 'success' : ['cancelled'].includes(row.original.status) ? 'error' : 'info'" variant="subtle">{{ row.original.status || '-' }}</UBadge></template>
        <template #actions-cell="{ row }"><UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-eye" aria-label="Lihat detail" @click="openDetail(row.original)" /></template>
        <template #empty><div class="py-10 text-center text-sm text-dimmed">{{ loading ? 'Memuat data...' : 'Belum ada Surat Tugas.' }}</div></template>
      </UTable>
    </UCard>

    <UModal v-model:open="createOpen" title="Buat Surat Tugas" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body><UForm :state="form" class="space-y-4" @submit="create">
        <div class="grid gap-4"><UFormField label="Tiket (opsional)"><USelect v-model="form.tiket_id" :items="options.tickets.filter(row => !['solved', 'cancelled'].includes(row.status)).map(row => ({ label: `${row.nomor_tiket} · ${row.jenis || row.kategori || ''}`, value: row.id }))" placeholder="Surat Tugas mandiri" class="w-full" @update:model-value="useTicket" /></UFormField><UFormField label="Jenis Surat Tugas" required><USelectMenu v-model="form.jenis_tugas" :items="kindItems" value-key="value" searchable searchable-placeholder="Ketik untuk mencari jenis Surat Tugas" placeholder="Pilih jenis" class="w-full" @update:model-value="changeKind" /></UFormField></div>
        <div v-if="!selectedTicket" class="grid gap-4"><UFormField label="Customer / Site" :required="['kirim_kontrak', 'terima_tukar', 'terima_return'].includes(form.jenis_tugas)"><USelectMenu v-model="form.customer_id" v-model:search-term="customerSearch" :items="customerItems" value-key="value" :search-input="{ placeholder: 'Ketik untuk mencari customer atau site' }" :loading="customerLoading" placeholder="Pilih customer / site" class="w-full" @update:model-value="selectCustomer" /></UFormField></div>
        <div v-if="['kirim_kontrak', 'kirim_back_up'].includes(form.jenis_tugas)" class="grid gap-4"><UFormField label="Mode" required><USelect v-model="form.mode" :items="modeItems" placeholder="Pilih mode" class="w-full" /></UFormField><UFormField v-if="form.jenis_tugas === 'kirim_kontrak' && form.mode === 'tukar'" label="Kontrak Aktif" required><USelect v-model="form.kontrak_id" :items="options.contracts.filter(row => row.status === 'aktif' && row.customer_id === form.customer_id).map(row => ({ label: row.nomor_kontrak, value: row.id }))" placeholder="Pilih kontrak" class="w-full" /></UFormField></div>
        <div v-if="['kirim_kontrak', 'kirim_back_up'].includes(form.jenis_tugas) && form.mode !== 'baru'" class="grid gap-4"><UFormField label="Unit Lama"><USelect v-model="form.unit_asal_id" :items="printerItems" placeholder="Pilih unit customer" class="w-full" /></UFormField></div>
        <div v-if="['kirim_kontrak', 'kirim_trial', 'kirim_stand_by', 'kirim_event', 'kirim_sell', 'kirim_back_up', 'internal_use', 'kirim_toner', 'terima_tukar', 'terima_unit_rusak', 'terima_return', 'terima_printer_baru'].includes(form.jenis_tugas)" class="grid gap-4"><UFormField label="Gudang" required><USelect v-model="form.gudang_id" :items="warehouseItems" placeholder="Pilih gudang" class="w-full" /></UFormField><UFormField v-if="isInbound" label="PIC Warehouse" required><USelect v-model="form.pic_warehouse_id" :items="warehouseUserItems" placeholder="Pilih PIC warehouse" class="w-full" /></UFormField></div>
        <UFormField v-if="!isInbound" label="PIC Teknisi" required><USelectMenu v-model="form.pic_teknisi_id" v-model:search-term="technicianSearch" :items="technicianItems" value-key="value" ignore-filter :search-input="{ placeholder: 'Ketik untuk mencari teknisi' }" :loading="technicianLoading" placeholder="Pilih PIC teknisi" class="w-full" /></UFormField>
        <UFormField v-if="form.jenis_tugas === 'internal_use'" label="Divisi / Lokasi Internal" required><UInput v-model="form.lokasi_internal" class="w-full" /></UFormField>
        <div v-if="form.jenis_tugas === 'terima_printer_baru'" class="grid gap-4"><UFormField label="Sumber / Pemasok" required><UInput v-model="form.sumber" class="w-full" /></UFormField><UFormField label="MP No" required><UInput v-model="form.new_mp_no" class="w-full" /></UFormField><UFormField label="Model" required><USelect v-model="form.new_model_id" :items="options.models.map(row => ({ label: row.nama_model, value: row.id }))" placeholder="Pilih model" class="w-full" /></UFormField></div>
        <div v-if="form.jenis_tugas !== 'kirim_toner' && form.jenis_tugas !== 'terima_printer_baru'" class="space-y-2"><UFormField label="Unit Printer" required><USelectMenu v-model="form.printer_ids" v-model:search-term="printerSearch" :items="printerItems" value-key="value" multiple ignore-filter :search-input="{ placeholder: 'Cari MP No, serial, customer/site, atau gudang' }" :loading="printerLoading" placeholder="Pilih unit printer" class="w-full" /></UFormField><p class="text-xs text-dimmed">Lokasi printer mengikuti Customer/Site atau Gudang pada form.</p></div>
        <UButton type="submit" block :loading="saving">Simpan Surat Tugas</UButton>
      </UForm></template>
    </UModal>

    <UModal v-model:open="detailOpen" :title="detail?.nomor_surat_tugas || 'Detail Surat Tugas'" :ui="{ content: 'sm:max-w-4xl' }">
      <template #body><div v-if="detail" class="space-y-4"><div class="flex flex-wrap gap-2"><UBadge color="info" variant="subtle">{{ kinds[detail.jenis_tugas] || detail.jenis_pekerjaan }}</UBadge><UBadge color="neutral" variant="subtle">{{ detail.status }}</UBadge><span class="text-sm text-dimmed">{{ detail.tiket?.nomor_tiket || 'Mandiri' }} · {{ detail.master_customer?.nama_customer || 'Tanpa customer' }}</span></div><div class="flex gap-1 overflow-x-auto border-b border-default"><UButton v-for="item in [{ value: 'general', label: 'General' }, { value: 'unit', label: 'Unit Printer' }, { value: 'item', label: 'Item' }]" :key="item.value" size="sm" :variant="tab === item.value ? 'soft' : 'ghost'" @click="tab = item.value">{{ item.label }}</UButton></div>
        <div v-if="tab === 'general'" class="space-y-4"><div class="grid gap-3 sm:grid-cols-2"><UCard><p class="text-sm text-dimmed">PIC Teknisi</p><p class="font-medium text-highlighted">{{ detail.teknisi_surat_tugas?.[0]?.master_pengguna?.name || detail.teknisi_surat_tugas?.[0]?.master_pengguna?.nama_lengkap || '-' }}</p></UCard><UCard><p class="text-sm text-dimmed">Konfirmasi</p><p class="text-sm text-highlighted">Keluar: {{ detail.konfirmasi_keluar_pada ? 'Ya' : 'Belum' }} · Serah: {{ detail.konfirmasi_serah_pada ? 'Ya' : 'Belum' }} · Terima: {{ detail.konfirmasi_terima_pada ? 'Ya' : 'Belum' }}</p></UCard></div><div v-if="!detail.teknisi_surat_tugas?.length && detail.status === 'pending' && ['admin', 'kepala_teknisi'].includes(role)" class="flex gap-2"><USelectMenu v-model="form.pic_teknisi_id" v-model:search-term="technicianSearch" :items="technicianItems" value-key="value" ignore-filter :search-input="{ placeholder: 'Ketik untuk mencari teknisi' }" :loading="technicianLoading" placeholder="Pilih teknisi" class="w-full" /><UButton color="neutral" variant="outline" @click="assign">Assign PIC</UButton></div><UFormField label="Hasil pekerjaan"><UTextarea v-model="form.hasil" class="w-full" /></UFormField><div class="flex flex-wrap gap-2"><UButton v-for="name in ['start', 'ready-to-print', 'keluar', 'serah', 'terima', 'selesai', 'resolve', 'cancel']" v-show="canAct(name)" :key="name" size="sm" :color="name === 'cancel' ? 'error' : 'primary'" :loading="saving" @click="action(name)">{{ { start: 'Mulai', 'ready-to-print': 'Siap Cetak', keluar: 'Konfirmasi Keluar', serah: 'Konfirmasi Serah', terima: 'Konfirmasi Terima', selesai: 'Selesai Pekerjaan', resolve: 'Resolve', cancel: 'Batalkan' }[name] }}</UButton></div></div>
        <div v-else-if="tab === 'unit'" class="space-y-3"><UCard v-for="line in detail.surat_tugas_printer || []" :key="line.id"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="font-semibold text-highlighted">{{ line.mp_no }}</p><p class="text-sm text-dimmed">{{ line.peran }} · {{ line.serial_number || 'Serial belum diisi' }}</p></div><div v-if="['progress', 'ready_to_print', 'technician_completed'].includes(detail.status) && ['admin', 'teknisi'].includes(role)" class="grid min-w-64 gap-2"><UInput v-model="resultForms[line.id].hasil" placeholder="Hasil" /><USelect v-if="['qc', 'repair'].includes(detail.jenis_tugas)" v-model="resultForms[line.id].kondisi_hasil" :items="['ready', 'ready_with_condition', 'need_repair', 'unready', 'kanibal'].map(value => ({ label: value, value }))" placeholder="Kondisi hasil" /><UInput v-model="resultForms[line.id].alasan" placeholder="Alasan / keterangan" /><UButton size="sm" @click="saveResult(line)">Simpan Hasil</UButton></div><p v-else class="text-sm text-dimmed">{{ line.hasil || 'Belum ada hasil.' }}{{ line.kondisi_hasil ? ` · ${line.kondisi_hasil}` : '' }}</p></div></UCard><div v-if="!detail.surat_tugas_printer?.length" class="py-8 text-center text-sm text-dimmed">Tidak ada unit printer.</div></div>
        <div v-else class="space-y-4"><UTable :data="detail.pemakaian_barang_surat_tugas || []" :columns="[{ accessorKey: 'jenis_barang', header: 'Jenis' }, { accessorKey: 'jumlah_pakai', header: 'Jumlah' }, { accessorKey: 'master_gudang', header: 'Gudang' }, { id: 'actions', header: '' }]" ><template #master_gudang-cell="{ row }">{{ row.original.master_gudang?.nama_gudang || '-' }}</template><template #actions-cell="{ row }"><UButton v-if="['admin', 'teknisi'].includes(role) && ['progress', 'ready_to_print'].includes(detail.status)" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Hapus item" @click="deleteItem(row.original)" /></template><template #empty><div class="py-8 text-center text-sm text-dimmed">Belum ada item.</div></template></UTable><UForm v-if="['admin', 'teknisi'].includes(role) && ['progress', 'ready_to_print'].includes(detail.status)" :state="itemForm" class="grid gap-3 sm:grid-cols-2" @submit="addItem"><USelect v-model="itemForm.jenis_barang" :items="[{ label: 'Toner', value: 'toner' }, { label: 'Sparepart', value: 'suku_cadang' }]" /><USelect v-model="itemForm.item_id" :items="itemChoices.map(row => ({ label: row.nama_toner || row.nama_suku_cadang, value: row.id }))" placeholder="Pilih item" /><USelect v-model="itemForm.gudang_id" :items="warehouseItems" placeholder="Pilih gudang" /><UInput v-model.number="itemForm.jumlah_pakai" type="number" min="1" /><UInput v-model="itemForm.keterangan" placeholder="Catatan" /><UButton type="submit">Tambah Item</UButton></UForm></div>
      </div></template>
    </UModal>
  </div>
</template>
