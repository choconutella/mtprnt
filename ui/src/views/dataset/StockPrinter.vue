<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ArrowRightLeft, History, Plus, Search, Undo2, X } from "lucide-vue-next";
import api from "../../services/api";

defineOptions({ inheritAttrs: false });
defineProps({ canManageStock: { type: Boolean, default: false }, canCreatePrinter: { type: Boolean, default: false }, canViewAuditBarang: { type: Boolean, default: false } });
const emit = defineEmits(["create-printer", "open-history"]);
const rows = ref([]);
const categories = ref([]);
const models = ref([]);
const warehouses = ref([]);
const summary = reactive({ available: 0, reserved: 0, issued: 0, installed: 0 });
const filters = reactive({ cari: "", kategori_id: "", model_id: "", gudang_id: "", lokasi: "stok", halaman: 1, batas: 10 });
const total = ref(0);
const busy = ref(false);
const error = ref("");
const modal = ref(null);
const action = reactive({ gudang_id: "", alasan: "" });
const filteredModels = computed(() => models.value.filter((item) => !filters.kategori_id || item.kategori_id === filters.kategori_id));
const pages = computed(() => Math.max(1, Math.ceil(total.value / filters.batas)));
const first = computed(() => total.value ? (filters.halaman - 1) * filters.batas + 1 : 0);
const last = computed(() => Math.min(total.value, filters.halaman * filters.batas));

async function load() {
  busy.value = true;
  error.value = "";
  try {
    const [list, counts] = await Promise.all([
      api.get("/printer", { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")) }),
      api.get("/printer/summary")
    ]);
    rows.value = list.data.data.items;
    total.value = list.data.data.meta.total;
    Object.assign(summary, counts.data.data);
  } catch (caught) {
    error.value = caught.response?.data?.pesan || "Stok printer gagal dimuat.";
  } finally {
    busy.value = false;
  }
}

async function loadOptions() {
  try {
    const [kategori, model, gudang] = await Promise.all([
      api.get("/printer-kategori", { params: { batas: 100 } }),
      api.get("/printer-model", { params: { batas: 100 } }),
      api.get("/gudang", { params: { batas: 100 } })
    ]);
    categories.value = kategori.data.data.items;
    models.value = model.data.data.items;
    warehouses.value = gudang.data.data.items;
  } catch (caught) {
    error.value = caught.response?.data?.pesan || "Filter printer gagal dimuat.";
  }
}

function filterChanged() {
  filters.halaman = 1;
  load();
}

function locationChanged() {
  if (filters.lokasi !== "gudang") filters.gudang_id = "";
  filterChanged();
}

function locationLabel(row) {
  if (row.status === "installed") return `${row.master_account?.nama_account || "-"} / ${row.master_customer?.nama_customer || "-"}`;
  if (row.status === "issued") return "Dalam proses surat tugas";
  return `${row.master_gudang?.nama_gudang || "-"}`;
}

function statusLabel(status) {
  return { available: "Tersedia", reserved: "Direservasi", issued: "Keluar gudang", installed: "Di customer" }[status] || status;
}

function open(row, kind) {
  modal.value = { row, kind };
  action.gudang_id = "";
  action.alasan = "";
  error.value = "";
}

async function save() {
  if (!modal.value) return;
  busy.value = true;
  error.value = "";
  try {
    await api.post(`/printer/${modal.value.row.id}/${modal.value.kind}`, {
      ...(modal.value.kind === "withdraw" ? {} : { gudang_id: action.gudang_id }),
      alasan: action.alasan.trim()
    });
    modal.value = null;
    await load();
  } catch (caught) {
    error.value = caught.response?.data?.pesan || "Aksi printer gagal disimpan.";
  } finally {
    busy.value = false;
  }
}

function changePage(delta) {
  filters.halaman += delta;
  load();
}

onMounted(() => { loadOptions(); load(); });
</script>

<template>
  <section class="printer-stock">
    <div class="toolbar">
      <label class="search-box">
        <Search :size="17" />
        <input v-model="filters.cari" type="search" placeholder="Cari MP No / Serial" @keyup.enter="filterChanged" />
      </label>
      <button v-if="canCreatePrinter" class="primary-button" type="button" @click="emit('create-printer')"><Plus :size="16" />Tambah Unit</button>
    </div>
    <div class="printer-filters">
      <select v-model="filters.kategori_id" aria-label="Kategori" @change="filters.model_id = ''; filterChanged()"><option value="">Semua kategori</option><option v-for="row in categories" :key="row.id" :value="row.id">{{ row.nama_kategori }}</option></select>
      <select v-model="filters.model_id" aria-label="Model" @change="filterChanged"><option value="">Semua model</option><option v-for="row in filteredModels" :key="row.id" :value="row.id">{{ row.merek }} {{ row.nama_model }}</option></select>
      <select v-model="filters.lokasi" aria-label="Lokasi printer" @change="locationChanged"><option value="stok">Semua lokasi</option><option value="gudang">Di gudang</option><option value="customer">Di customer</option><option value="transit">Dalam surat tugas</option></select>
      <select v-if="filters.lokasi === 'gudang'" v-model="filters.gudang_id" aria-label="Gudang" @change="filterChanged"><option value="">Semua gudang</option><option v-for="row in warehouses" :key="row.id" :value="row.id">{{ row.nama_gudang }}</option></select>
    </div>
    <p v-if="error && !modal" class="printer-error" role="alert">{{ error }}</p>
    <section class="data-panel">
      <div class="section-heading"><h2>Stok Printer</h2><span>{{ summary.available }} tersedia di gudang · {{ summary.installed }} di customer</span></div>
      <div class="table-wrap"><table><thead><tr><th>MP No</th><th>Serial</th><th>Kategori</th><th>Model</th><th>Lokasi</th><th>Status</th><th v-if="canManageStock || canViewAuditBarang">Aksi</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
          <td>{{ row.mp_no }}</td><td>{{ row.serial_number || "-" }}</td><td>{{ row.master_printer_model?.master_printer_kategori?.nama_kategori || "-" }}</td><td>{{ row.master_printer_model?.merek }} {{ row.master_printer_model?.nama_model }}</td><td>{{ locationLabel(row) }}</td><td>{{ row.status_operasional || statusLabel(row.status) }}</td>
            <td v-if="canManageStock || canViewAuditBarang"><div class="row-actions">
              <button v-if="canViewAuditBarang" class="icon-action" type="button" title="Riwayat unit" aria-label="Riwayat unit" @click="emit('open-history', row)"><History :size="16" /></button>
              <button v-if="row.status === 'available'" class="icon-action" type="button" title="Pindah gudang" @click="open(row, 'transfer')"><ArrowRightLeft :size="16" /></button>
              <button v-if="row.status === 'available'" class="text-action" type="button" @click="open(row, 'withdraw')">Keluarkan</button>
              <button v-if="row.status === 'issued'" class="icon-action" type="button" title="Kembalikan ke gudang" @click="open(row, 'return')"><Undo2 :size="16" /></button>
            </div></td>
          </tr>
          <tr v-if="!rows.length"><td :colspan="canManageStock || canViewAuditBarang ? 7 : 6" class="empty-cell">{{ busy ? "Memuat data..." : "Belum ada unit." }}</td></tr>
        </tbody></table></div>
      <div class="pagination-bar"><div class="pagination-size"><select v-model.number="filters.batas" aria-label="Baris per halaman" @change="filterChanged"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option></select><span>Baris per halaman</span></div><span class="pagination-range">{{ first }}-{{ last }} dari {{ total }} unit</span><div class="pagination-actions"><strong>Halaman {{ filters.halaman }} dari {{ pages }}</strong><button class="secondary-button" type="button" :disabled="filters.halaman <= 1" @click="changePage(-1)">&lsaquo;</button><button class="secondary-button" type="button" :disabled="filters.halaman >= pages" @click="changePage(1)">&rsaquo;</button></div></div>
    </section>
    <div v-if="modal" class="modal-backdrop"><section class="modal-panel printer-action-modal" role="dialog" aria-modal="true"><div class="modal-heading"><div><p class="eyebrow">{{ modal.row.mp_no }}</p><h2>{{ modal.kind === 'transfer' ? 'Pindah Gudang' : modal.kind === 'return' ? 'Kembalikan Unit' : 'Keluarkan Unit' }}</h2></div><button class="icon-action" type="button" title="Tutup" @click="modal = null"><X :size="18" /></button></div><form class="data-form" @submit.prevent="save"><label v-if="modal.kind !== 'withdraw'"><span>Gudang Tujuan</span><select v-model="action.gudang_id" required><option value="">Pilih gudang</option><option v-for="row in warehouses.filter((item) => item.aktif && item.id !== modal.row.gudang_id)" :key="row.id" :value="row.id">{{ row.nama_gudang }}</option></select></label><label><span>Alasan</span><textarea v-model="action.alasan" rows="3" required /></label><p v-if="error" class="printer-error" role="alert">{{ error }}</p><div class="modal-actions"><button class="secondary-button" type="button" @click="modal = null">Batal</button><button class="primary-button" type="submit" :disabled="busy">Simpan</button></div></form></section></div>
  </section>
</template>

<style scoped>
.printer-filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
.printer-filters select { min-width: 150px; max-width: 240px; flex: 1 1 150px; min-height: 40px; padding: 0 12px; color: #f8fafc; background: #0d1628; border: 1px solid #29364d; border-radius: 6px; }
.printer-action-modal { max-width: 480px; }
.printer-action-modal .data-form { grid-template-columns: 1fr; }
.printer-error { color: #fb7185; margin: 12px 0; }
</style>
