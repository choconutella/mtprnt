<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { CalendarDays, Eye, X } from "lucide-vue-next";
import api from "../../services/api";

const props = defineProps({ target: { type: Object, default: null } });
const rows = ref([]);
const total = ref(0);
const busy = ref(false);
const error = ref("");
const selected = ref(null);
const page = ref(1);
const pageSize = ref(10);
const startInput = ref(null);
const endInput = ref(null);
const filter = reactive({ jenis_barang: "", barang: "", barang_id: "", tanggal_mulai: "", tanggal_selesai: "" });
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const first = computed(() => total.value ? (page.value - 1) * pageSize.value + 1 : 0);
const last = computed(() => Math.min(total.value, page.value * pageSize.value));
const hasFilter = computed(() => Object.values(filter).some(Boolean));
const labels = {
  mp_no: "MP No", serial_number: "Serial Number", model_id: "Model", status: "Status", lokasi_nama: "Lokasi",
  tanggal_pembelian: "Tanggal Pembelian", tanggal_maintenance_berikutnya: "Maintenance Berikutnya", interval_maintenance_bulan: "Interval Maintenance (Bulan)", status_operasional: "Status Operasional",
  kode_toner: "Kode Toner", nama_toner: "Nama Toner", warna: "Warna", tipe: "Tipe",
  kode_suku_cadang: "Kode Sparepart", nama_suku_cadang: "Nama Sparepart", aktif: "Aktif", keterangan: "Keterangan"
};

function formatTime(value) {
  return new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function stockText(value) {
  return value?.length ? value.map((row) => `${row.nama_gudang || "Gudang"}: ${Number(row.jumlah_tersedia)}`).join("; ") : "-";
}

function changeText(item) {
  if (item.jumlah == null) return item.status_sebelum && item.status_sesudah && item.status_sebelum !== item.status_sesudah
    ? `${item.status_sebelum} -> ${item.status_sesudah}` : "-";
  const sign = ["masuk"].includes(item.aksi) ? "+" : ["keluar", "pemakaian"].includes(item.aksi) ? "-" : "";
  return `${sign}${Number(item.jumlah)} / ${stockText(item.saldo_sesudah)}`;
}

function detailChanges(item) {
  const before = item.data_sebelum || {};
  const after = item.data_sesudah || {};
  return Object.entries(labels).filter(([key]) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .map(([key, label]) => ({ label, before: String(before[key] ?? "-"), after: String(after[key] ?? "-") }));
}

async function load() {
  if (!hasFilter.value) { rows.value = []; total.value = 0; return; }
  busy.value = true;
  error.value = "";
  try {
    const params = { ...Object.fromEntries(Object.entries(filter).filter(([, value]) => value)), halaman: page.value, batas: pageSize.value };
    const response = await api.get("/audit-barang", { params });
    rows.value = response.data.data.items;
    total.value = response.data.data.meta.total;
  } catch (caught) {
    error.value = caught.response?.data?.pesan || "Audit barang gagal dimuat.";
  } finally {
    busy.value = false;
  }
}

function search() { page.value = 1; load(); }
function textChanged() { filter.barang_id = ""; page.value = 1; }
function reset() {
  Object.assign(filter, { jenis_barang: "", barang: "", barang_id: "", tanggal_mulai: "", tanggal_selesai: "" });
  rows.value = [];
  total.value = 0;
  page.value = 1;
}
function changePage(delta) { page.value += delta; load(); }
function pickDate(target) {
  const input = target === "start" ? startInput.value : endInput.value;
  input?.focus();
  if (typeof input?.showPicker === "function") input.showPicker();
  else input?.click();
}
function useTarget(target) {
  if (!target) return;
  Object.assign(filter, { jenis_barang: target.jenis, barang: target.kode, barang_id: target.id, tanggal_mulai: "", tanggal_selesai: "" });
  search();
}
watch(() => props.target, useTarget);
onMounted(() => useTarget(props.target));
</script>

<template>
  <section class="audit-item-filters">
    <label><span>Tanggal Mulai</span><div class="date-input"><input ref="startInput" v-model="filter.tanggal_mulai" type="date" @change="search" /><button class="date-picker-button" type="button" title="Buka kalender" @click="pickDate('start')"><CalendarDays :size="16" /></button></div></label>
    <label><span>Tanggal Selesai</span><div class="date-input"><input ref="endInput" v-model="filter.tanggal_selesai" type="date" @change="search" /><button class="date-picker-button" type="button" title="Buka kalender" @click="pickDate('end')"><CalendarDays :size="16" /></button></div></label>
    <label><span>Jenis Barang</span><select v-model="filter.jenis_barang" @change="filter.barang_id = ''; filter.barang = ''; search()"><option value="">Semua barang</option><option value="printer">Printer</option><option value="toner">Toner</option><option value="suku_cadang">Sparepart</option></select></label>
    <label><span>No MP / Kode Barang</span><input v-model.trim="filter.barang" type="search" placeholder="Cari nomor atau kode" @input="textChanged" @keyup.enter="search" /></label>
    <button class="secondary-button audit-reset" type="button" @click="reset">Reset</button>
  </section>
  <p v-if="error" class="audit-item-error" role="alert">{{ error }}</p>
  <section class="data-panel">
    <div class="table-wrap"><table><thead><tr><th>Event</th><th>Tanggal dan Waktu</th><th>User</th><th>Barang</th><th>Lokasi Asal / Tujuan</th><th>Jumlah / Saldo</th><th>Referensi</th><th>Keterangan</th><th></th></tr></thead>
      <tbody>
        <tr v-for="item in rows" :key="item.id">
          <td><span class="status-badge neutral">{{ item.event_nama }}</span></td>
          <td>{{ formatTime(item.tanggal_audit) }}</td><td>{{ item.nama_pengguna || "Sistem" }}</td>
          <td>{{ item.kode_barang }}</td><td>{{ item.lokasi_asal || "-" }} &rarr; {{ item.lokasi_tujuan || "-" }}</td>
          <td>{{ changeText(item) }}</td><td>{{ item.referensi?.nomor || "-" }}</td><td>{{ item.keterangan || "-" }}</td>
          <td><button class="icon-action" type="button" title="Lihat perubahan" @click="selected = item"><Eye :size="16" /></button></td>
        </tr>
        <tr v-if="!rows.length"><td colspan="9" class="empty-cell">{{ busy ? "Memuat audit..." : hasFilter ? "Audit tidak ditemukan." : "Pilih filter untuk menampilkan audit barang." }}</td></tr>
      </tbody></table></div>
    <div class="pagination-bar"><div class="pagination-size"><select v-model.number="pageSize" aria-label="Baris per halaman" @change="search"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option></select><span>Baris per halaman</span></div><span class="pagination-range">{{ first }}-{{ last }} dari {{ total }} event</span><div class="pagination-actions"><strong>Halaman {{ page }} dari {{ pages }}</strong><button class="secondary-button" type="button" :disabled="page <= 1" @click="changePage(-1)">&lsaquo;</button><button class="secondary-button" type="button" :disabled="page >= pages" @click="changePage(1)">&rsaquo;</button></div></div>
  </section>
  <div v-if="selected" class="modal-backdrop"><section class="modal-panel audit-item-detail" role="dialog" aria-modal="true" aria-label="Detail audit barang"><div class="modal-heading"><div><p class="eyebrow">{{ selected.kode_barang }}</p><h2>{{ selected.event_nama }}</h2></div><button class="icon-action" type="button" title="Tutup" @click="selected = null"><X :size="18" /></button></div><div class="audit-detail-body"><p>{{ formatTime(selected.tanggal_audit) }} / {{ selected.nama_pengguna || "Sistem" }}</p><p>{{ selected.keterangan || "-" }}</p><div v-if="selected.jumlah != null" class="audit-detail-row"><strong>Jumlah</strong><span>{{ Number(selected.jumlah) }}</span></div><div v-if="selected.saldo_sebelum || selected.saldo_sesudah" class="audit-detail-row"><strong>Saldo</strong><span>{{ stockText(selected.saldo_sebelum) }} &rarr; {{ stockText(selected.saldo_sesudah) }}</span></div><div v-for="change in detailChanges(selected)" :key="change.label" class="audit-detail-row"><strong>{{ change.label }}</strong><span>{{ change.before }} &rarr; {{ change.after }}</span></div><div v-if="selected.referensi" class="audit-detail-row"><strong>Referensi</strong><span>{{ selected.referensi.nomor }}</span></div></div></section></div>
</template>

<style scoped>
.audit-item-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; align-items: end; gap: 12px; margin-bottom: 18px; }
.audit-item-filters label { display: grid; gap: 6px; color: #cbd5e1; font-size: 12px; }
.audit-item-filters input, .audit-item-filters select { min-height: 38px; width: 100%; padding: 7px 10px; color: #f8fafc; background: #0d1628; border: 1px solid #29364d; border-radius: 6px; }
.audit-item-filters .date-input { position: relative; }
.audit-item-filters .date-input input { padding-right: 38px; }
.audit-item-filters .date-picker-button { position: absolute; right: 4px; top: 3px; width: 32px; height: 32px; border: 0; background: transparent; color: #9fb1c7; cursor: pointer; }
.audit-reset { min-height: 38px; }
.audit-item-error { color: #fb7185; }
.audit-item-detail { width: min(540px, calc(100vw - 32px)); max-height: min(680px, calc(100vh - 40px)); }
.audit-detail-body { overflow-y: auto; padding: 18px; color: #cbd5e1; font-size: 13px; }
.audit-detail-row { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 16px; border-top: 1px solid #29364d; padding: 10px 0; }
.audit-detail-row strong { color: #f8fafc; }
@media (max-width: 1200px) { .audit-item-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .audit-item-filters { grid-template-columns: 1fr; } .audit-detail-row { grid-template-columns: 1fr; gap: 2px; } }
</style>
