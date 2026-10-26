<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Plus, Search, X } from "lucide-vue-next";
import api from "../../services/api";

const props = defineProps({ role: { type: String, default: "" } });
const emit = defineEmits(["open-surat", "open-legacy"]);
const catalog = ref({});
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const search = ref("");
const category = ref("");
const status = ref("");
const busy = ref(false);
const error = ref("");
const message = ref("");
const modal = ref(false);
const tab = ref("general");
const selected = ref(null);
const accounts = ref([]);
const customers = ref([]);
const printers = ref([]);
const printerSearch = ref("");
const toners = ref([]);
const models = ref([]);
const sales = ref([]);
const contracts = ref([]);
const trialTickets = ref([]);
const form = reactive({ kategori: "", jenis: "", account_id: "", customer_id: "", sales_id: "", mode: "", kontrak_id: "", tiket_asal_id: "", tanggal_transaksi: "", tanggal_akhir: "", lokasi_internal: "", deskripsi: "", alasan: "", hasil: "", printer_ids: [], printer_utama_id: "", printer_pengganti_id: "", printer_lama_id: "", toner_id: "", jumlah: 1, newPrinters: [{ mp_no: "", model_id: "", sumber: "" }] });

const categoryNames = { delivery: "Delivery", komplain: "Komplain", internal: "Internal", inbound: "Inbound", maintenance: "Maintenance" };
const kindNames = { kontrak: "Kontrak", trial: "Trial", stand_by: "Stand-by", event: "Event", sell: "Sell", toner_purchase: "Toner Purchase", on_site_service: "On-site Service", back_up: "Back-up", repair: "Repair", qc: "QC", internal_use: "Internal Use", return: "Return", penerimaan_printer: "Penerimaan Printer", maintenance: "Maintenance" };
const owners = { delivery: "sales_admin", komplain: "sales_admin", internal: "kepala_teknisi", inbound: "warehouse", maintenance: "kepala_teknisi" };
const normalizedRole = computed(() => String(props.role).replace(/-/g, "_"));
const canCreate = computed(() => normalizedRole.value === "admin" || Object.values(owners).includes(normalizedRole.value));
const canCreateSt = computed(() => ["admin", "kepala_teknisi"].includes(normalizedRole.value) || normalizedRole.value === "warehouse" && (selected.value?.kategori === "inbound" || selected.value?.jenis === "back_up" || selected.value?.jenis === "kontrak" && selected.value?.mode === "tukar"));
const allowedCategories = computed(() => Object.keys(catalog.value).filter((key) => normalizedRole.value === "admin" || owners[key] === normalizedRole.value));
const availableKinds = computed(() => Object.keys(catalog.value[form.kategori] || {}));
const selectedAccountCustomers = computed(() => customers.value.filter((item) => item.account_id === form.account_id && item.aktif));
const availablePrinters = computed(() => printers.value.filter((item) => {
  if (["delivery", "komplain", "maintenance"].includes(form.kategori) && ["on_site_service", "maintenance"].includes(form.jenis)) return item.lokasi_jenis === "customer" && item.customer_id === form.customer_id;
  if (["return", "back_up"].includes(form.jenis)) return item.lokasi_jenis === "customer" && item.customer_id === form.customer_id;
  if (["repair", "qc"].includes(form.jenis)) return item.lokasi_jenis === "gudang";
  return item.lokasi_jenis === "gudang" && item.kondisi === "ready" && !item.surat_tugas_aktif_id;
}));
const customerRequired = computed(() => ["delivery", "komplain", "maintenance"].includes(form.kategori) || form.jenis === "return");
const dateTimeLocal = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const iso = (value) => value ? new Date(value).toISOString() : undefined;
const errorText = (err) => err.response?.data?.pesan || err.response?.data?.message || err.message || "Permintaan gagal.";
const unit = (id) => printers.value.find((item) => item.id === id);
let printerRequest = 0;
let printerSearchTimer;

async function searchPrinters() {
  const requestId = ++printerRequest;
  try {
    const response = await api.get("/printer", { params: { batas: 100, ...(printerSearch.value ? { cari: printerSearch.value } : {}) } });
    if (requestId !== printerRequest) return;
    const selectedIds = [
      ...form.printer_ids, form.printer_utama_id, form.printer_pengganti_id, form.printer_lama_id
    ].filter(Boolean);
    const selectedUnits = printers.value.filter((item) => selectedIds.includes(item.id));
    printers.value = [...new Map([...selectedUnits, ...response.data.data.items].map((item) => [item.id, item])).values()];
  } catch (err) { error.value = errorText(err); }
}

watch(printerSearch, () => {
  clearTimeout(printerSearchTimer);
  printerSearchTimer = setTimeout(searchPrinters, 250);
});

async function all(endpoint) {
  const result = [];
  for (let halaman = 1; halaman <= 20; halaman++) {
    const response = await api.get(endpoint, { params: { halaman, batas: 100 } });
    const data = response.data.data;
    const chunk = Array.isArray(data) ? data : data?.items || [];
    result.push(...chunk);
    if (Array.isArray(data) || chunk.length < 100 || result.length >= (data?.meta?.total || Infinity)) break;
  }
  return result;
}

async function loadOptions() {
  try {
    const [a, c, p, t, m, u, k, trial, types] = await Promise.all([
      all("/account"), all("/account/lokasi-customer"), api.get("/printer", { params: { batas: 100 } }), all("/toner"), all("/printer-model"), all("/pengguna"), all("/kontrak"), all("/tiket?jenis=trial&status=solved"), api.get("/tiket/catalog")
    ]);
    accounts.value = a.filter((item) => item.aktif);
    customers.value = c;
    printers.value = p.data.data.items;
    toners.value = t;
    models.value = m;
    sales.value = u.filter((item) => ["sales", "sales-admin", "sales_admin"].includes(item.role || item.peran));
    contracts.value = k.filter((item) => item.status === "aktif");
    trialTickets.value = trial.filter((item) => item.hasil === "berhasil");
    catalog.value = types.data.data;
  } catch (err) { error.value = errorText(err); }
}

async function load() {
  busy.value = true;
  try {
    const response = await api.get("/tiket", { params: { halaman: page.value, batas: limit.value, ...(search.value ? { cari: search.value } : {}), ...(category.value ? { kategori: category.value } : {}), ...(status.value ? { status: status.value } : {}) } });
    rows.value = response.data.data.items;
    total.value = response.data.data.meta.total;
    error.value = "";
  } catch (err) { error.value = errorText(err); }
  finally { busy.value = false; }
}

function openNew() {
  selected.value = null;
  printerSearch.value = "";
  Object.assign(form, { kategori: allowedCategories.value[0] || "", jenis: "", account_id: "", customer_id: "", sales_id: "", mode: "", kontrak_id: "", tiket_asal_id: "", tanggal_transaksi: dateTimeLocal(), tanggal_akhir: "", lokasi_internal: "", deskripsi: "", alasan: "", hasil: "", printer_ids: [], printer_utama_id: "", printer_pengganti_id: "", printer_lama_id: "", toner_id: "", jumlah: 1, newPrinters: [{ mp_no: "", model_id: "", sumber: "" }] });
  form.jenis = Object.keys(catalog.value[form.kategori] || {})[0] || "";
  tab.value = "general";
  modal.value = true;
}

async function openDetail(item, targetTab = "general") {
  try {
    const response = await api.get(`/tiket/${item.id}`);
    selected.value = response.data.data;
    Object.assign(form, { deskripsi: selected.value.deskripsi || "", hasil: selected.value.hasil || "", alasan: selected.value.alasan || "", lokasi_internal: selected.value.lokasi_internal || "" });
    tab.value = targetTab;
    modal.value = true;
  } catch (err) { error.value = errorText(err); }
}

function printerLine(id, peran = "utama") {
  const item = unit(id);
  return item ? { printer_id: item.id, mp_no: item.mp_no, peran } : null;
}

function buildPayload() {
  const lines = [];
  if (form.jenis === "penerimaan_printer") lines.push(...form.newPrinters.map((row) => ({ mp_no: row.mp_no.trim(), model_id: row.model_id, sumber: row.sumber.trim(), peran: "utama" })));
  else if (form.jenis === "back_up") lines.push(printerLine(form.printer_utama_id, "utama"), printerLine(form.printer_pengganti_id, "pengganti"));
  else if (form.jenis !== "toner_purchase") {
    lines.push(...form.printer_ids.map((id) => printerLine(id)));
    if (form.jenis === "kontrak" && form.mode === "tukar") lines.push(printerLine(form.printer_lama_id, "unit_lama"));
  }
  return {
    kategori: form.kategori, jenis: form.jenis,
    account_id: form.account_id || null, customer_id: form.customer_id || null,
    sales_id: form.sales_id || null, mode: form.mode || null,
    kontrak_id: form.kontrak_id || null, tiket_asal_id: form.tiket_asal_id || null,
    tanggal_transaksi: iso(form.tanggal_transaksi), tanggal_akhir: iso(form.tanggal_akhir) || null,
    deskripsi: form.deskripsi || null, alasan: form.alasan || null, lokasi_internal: form.lokasi_internal || null,
    printer: lines.filter(Boolean),
    toner: form.jenis === "toner_purchase" && form.toner_id ? [{ toner_id: form.toner_id, jumlah: Number(form.jumlah) }] : []
  };
}

async function save() {
  busy.value = true;
  try {
    if (selected.value) await api.put(`/tiket/${selected.value.id}`, { deskripsi: form.deskripsi, alasan: form.alasan, hasil: form.hasil, lokasi_internal: form.lokasi_internal || null });
    else await api.post("/tiket", buildPayload());
    modal.value = false;
    message.value = "Tiket tersimpan.";
    await load();
  } catch (err) { error.value = errorText(err); }
  finally { busy.value = false; }
}

async function action(kind) {
  if (!selected.value) return;
  if (kind === "cancel" && !window.confirm("Batalkan tiket ini?")) return;
  busy.value = true;
  try {
    await api.post(`/tiket/${selected.value.id}/${kind}`);
    modal.value = false;
    message.value = kind === "resolve" ? "Tiket selesai." : "Tiket dibatalkan.";
    await load();
  } catch (err) { error.value = errorText(err); }
  finally { busy.value = false; }
}

watch([category, status, limit], () => { page.value = 1; load(); });
watch(() => form.kategori, () => { form.jenis = Object.keys(catalog.value[form.kategori] || {})[0] || ""; form.printer_ids = []; });
watch(() => form.account_id, () => { form.customer_id = ""; });
onMounted(async () => {
  await Promise.all([load(), canCreate.value ? loadOptions() : api.get("/tiket/catalog").then((response) => { catalog.value = response.data.data; })]);
});
</script>

<template>
  <div class="tkt-page">
    <div class="tkt-toolbar">
      <label class="tkt-search"><Search :size="17" /><input v-model="search" placeholder="Cari nomor atau deskripsi" @keyup.enter="page = 1; load()" /></label>
      <select v-model="category"><option value="">Semua kategori</option><option v-for="(group, key) in catalog" :key="key" :value="key">{{ categoryNames[key] }}</option></select>
      <select v-model="status"><option value="">Semua status</option><option v-for="value in ['new','pending','progress','solved','cancelled']" :key="value" :value="value">{{ value }}</option></select>
      <button v-if="canCreate" class="primary-button" type="button" @click="openNew"><Plus :size="16" /> Tiket</button>
    </div>
    <p v-if="error" class="tkt-error">{{ error }}</p><p v-else-if="message" class="tkt-message">{{ message }}</p>
    <div class="tkt-table table-wrap"><table><thead><tr><th>No. Tiket</th><th>Kategori</th><th>Jenis</th><th>Customer</th><th>Tanggal</th><th>Status</th><th>ST</th></tr></thead><tbody>
      <tr v-for="item in rows" :key="item.id" class="tkt-row" @click="openDetail(item)"><td>{{ item.nomor_tiket }}</td><td>{{ categoryNames[item.kategori] }}</td><td>{{ kindNames[item.jenis] }}</td><td>{{ item.master_customer?.nama_customer || '—' }}</td><td>{{ new Date(item.tanggal_transaksi).toLocaleDateString('id-ID') }}</td><td><span class="tkt-status">{{ item.status }}</span></td><td>{{ item.surat_tugas?.length || 0 }}</td></tr>
      <tr v-if="!rows.length"><td colspan="7" class="tkt-empty">{{ busy ? 'Memuat...' : 'Belum ada tiket.' }}</td></tr>
    </tbody></table><div class="tkt-footer"><span>{{ total }} tiket</span><div><select v-model.number="limit"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select><button type="button" :disabled="page <= 1" @click="page--; load()">‹</button><span>{{ page }} / {{ Math.max(1, Math.ceil(total / limit)) }}</span><button type="button" :disabled="page * limit >= total" @click="page++; load()">›</button></div></div></div>
    <div v-if="modal" class="modal-backdrop"><section class="tkt-modal" :class="{ 'tkt-legacy': selected?.pengaduan_lama_id }" role="dialog" aria-modal="true"><header class="tkt-modal-header"><div><small>{{ selected ? selected.nomor_tiket : 'DATA BARU' }}</small><h2>{{ selected ? kindNames[selected.jenis] : 'Buat Tiket' }}</h2></div><button type="button" aria-label="Tutup" @click="modal = false"><X :size="19" /></button></header>
      <nav v-if="selected" class="tkt-tabs"><button type="button" :class="{ active: tab === 'general' }" @click="tab = 'general'">General</button><button type="button" :class="{ active: tab === 'st' }" @click="tab = 'st'">Surat Tugas ({{ selected.surat_tugas?.length || 0 }})</button></nav>
      <div v-if="selected?.pengaduan_lama_id" class="tkt-legacy-note"><span>Tiket ini berasal dari Komplain lama. Lanjutkan pekerjaan yang masih aktif melalui alur lama.</span><button class="secondary-button" type="button" @click="emit('open-legacy', selected)">Buka Komplain Arsip</button></div>
      <div class="tkt-modal-body"><form v-if="tab === 'general'" id="tkt-form" class="tkt-form" @submit.prevent="save">
        <template v-if="!selected"><label>Kategori<select v-model="form.kategori" required><option v-for="key in allowedCategories" :key="key" :value="key">{{ categoryNames[key] }}</option></select></label><label>Jenis<select v-model="form.jenis" required><option v-for="key in availableKinds" :key="key" :value="key">{{ kindNames[key] }}</option></select></label>
          <label v-if="customerRequired">Account<select v-model="form.account_id" required><option value="">Pilih Account</option><option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.nama_account }}</option></select></label><label v-if="customerRequired">Customer / Site<select v-model="form.customer_id" required><option value="">Pilih Customer</option><option v-for="c in selectedAccountCustomers" :key="c.id" :value="c.id">{{ c.nama_customer }}</option></select></label>
          <label v-if="['delivery','komplain'].includes(form.kategori)">Sales<select v-model="form.sales_id" required><option value="">Pilih Sales</option><option v-for="u in sales.filter(x => (x.role || x.peran) === 'sales')" :key="u.id" :value="u.id">{{ u.name || u.user_id }}</option></select></label>
          <label v-if="!['toner_purchase','penerimaan_printer'].includes(form.jenis)" class="wide">Cari MP No / serial<input v-model="printerSearch" placeholder="Ketik MP No atau serial" /></label>
          <label>Tanggal Transaksi<input v-model="form.tanggal_transaksi" type="datetime-local" required /></label><label v-if="['trial','event'].includes(form.jenis)">Tanggal Akhir<input v-model="form.tanggal_akhir" type="datetime-local" required /></label>
          <label v-if="['kontrak','back_up'].includes(form.jenis)">Mode<select v-model="form.mode" required><option value="">Pilih mode</option><option v-if="form.jenis === 'kontrak'" value="baru">Baru</option><option v-if="form.jenis === 'kontrak'" value="tukar">Tukar</option><option v-if="form.jenis === 'back_up'" value="sementara">Sementara</option><option v-if="form.jenis === 'back_up'" value="permanen">Permanen</option></select></label>
          <label v-if="form.jenis === 'kontrak' && form.mode === 'tukar'">Kontrak Aktif<select v-model="form.kontrak_id" required><option value="">Pilih Kontrak</option><option v-for="k in contracts.filter(x => x.customer_id === form.customer_id)" :key="k.id" :value="k.id">{{ k.nomor_kontrak }}</option></select></label>
          <label v-if="form.jenis === 'kontrak' && form.mode === 'tukar'">Unit Lama<select v-model="form.printer_lama_id" required><option value="">Pilih Unit</option><option v-for="p in printers.filter(x => x.customer_id === form.customer_id && x.kontrak_id === form.kontrak_id && x.lokasi_jenis === 'customer')" :key="p.id" :value="p.id">{{ p.mp_no }}</option></select></label>
          <label v-if="form.jenis === 'kontrak' && form.mode === 'baru'">Dari Trial (opsional)<select v-model="form.tiket_asal_id"><option value="">Kontrak baru</option><option v-for="t in trialTickets.filter(x => x.customer_id === form.customer_id)" :key="t.id" :value="t.id">{{ t.nomor_tiket }}</option></select></label>
          <div v-if="form.jenis === 'penerimaan_printer'" class="tkt-new-units wide"><div v-for="(row, index) in form.newPrinters" :key="index" class="tkt-new-unit"><label>MP No<input v-model="row.mp_no" required /></label><label>Model<select v-model="row.model_id" required><option value="">Pilih Model</option><option v-for="m in models" :key="m.id" :value="m.id">{{ m.nama_model }}</option></select></label><label>Sumber / Pemasok<input v-model="row.sumber" required /></label><button v-if="form.newPrinters.length > 1" class="secondary-button" type="button" @click="form.newPrinters.splice(index, 1)">Hapus</button></div><button class="secondary-button" type="button" @click="form.newPrinters.push({ mp_no: '', model_id: '', sumber: '' })">Tambah Unit</button></div>
          <template v-else-if="form.jenis === 'back_up'"><label>Unit Bermasalah<select v-model="form.printer_utama_id" required><option value="">Pilih Unit</option><option v-for="p in availablePrinters" :key="p.id" :value="p.id">{{ p.mp_no }}</option></select></label><label>Unit Pengganti<select v-model="form.printer_pengganti_id" required><option value="">Pilih Unit</option><option v-for="p in printers.filter(x => x.lokasi_jenis === 'gudang' && x.kondisi === 'ready')" :key="p.id" :value="p.id">{{ p.mp_no }}</option></select></label></template>
          <label v-else-if="form.jenis === 'toner_purchase'">Toner<select v-model="form.toner_id" required><option value="">Pilih Toner</option><option v-for="t in toners" :key="t.id" :value="t.id">{{ t.nama_toner }}</option></select></label><label v-if="form.jenis === 'toner_purchase'">Jumlah<input v-model.number="form.jumlah" type="number" min="1" required /></label>
          <div v-if="!['penerimaan_printer','toner_purchase','back_up'].includes(form.jenis)" class="tkt-units wide"><strong>Unit Printer</strong><label v-for="p in (form.tiket_asal_id ? printers.filter(x => x.customer_id === form.customer_id && x.penempatan === 'trial') : availablePrinters)" :key="p.id"><input v-model="form.printer_ids" type="checkbox" :value="p.id" /> {{ p.mp_no }} · {{ p.master_printer_model?.nama_model }}</label><span v-if="!availablePrinters.length">Tidak ada unit sesuai kondisi dan lokasi yang dibutuhkan.</span></div>
        </template>
        <div v-else class="tkt-facts"><span>Kategori: {{ categoryNames[selected.kategori] }}</span><span>Customer: {{ selected.master_customer?.nama_customer || '—' }}</span><span>Status: {{ selected.status }}</span><span v-for="line in selected.tiket_printer" :key="line.id">{{ line.peran }}: {{ line.mp_no }}</span></div>
        <label v-if="(selected?.jenis || form.jenis) === 'internal_use'">Divisi / Lokasi Internal<input v-model="form.lokasi_internal" :readonly="!!selected?.pengaduan_lama_id" required /></label><label class="wide">Deskripsi<textarea v-model="form.deskripsi" rows="3" :readonly="!!selected?.pengaduan_lama_id" /></label><label v-if="(selected?.jenis || form.jenis) === 'return'">Alasan Return<input v-model="form.alasan" :readonly="!!selected?.pengaduan_lama_id" required /></label><label v-if="selected?.jenis === 'trial'">Hasil Trial<select v-model="form.hasil"><option value="">Belum ada hasil</option><option value="berhasil">Berhasil</option><option value="gagal">Gagal</option><option value="batal">Batal</option></select></label>
      </form>
      <div v-else><div class="tkt-subhead"><strong>Surat Tugas Terkait</strong><button v-if="canCreateSt" class="primary-button" type="button" @click="emit('open-surat', selected)">Buat Surat Tugas</button></div><div class="table-wrap"><table><thead><tr><th>Nomor</th><th>Jenis</th><th>Status</th></tr></thead><tbody><tr v-for="st in selected.surat_tugas" :key="st.id"><td>{{ st.nomor_surat_tugas }}</td><td>{{ st.jenis_tugas }}</td><td>{{ st.status }}</td></tr><tr v-if="!selected.surat_tugas?.length"><td colspan="3">Belum ada Surat Tugas.</td></tr></tbody></table></div></div>
      </div><footer class="tkt-modal-footer"><button v-if="selected && tab === 'general' && !['solved','cancelled'].includes(selected.status) && (normalizedRole === 'admin' || owners[selected.kategori] === normalizedRole)" class="secondary-button" type="button" @click="action('cancel')">Batalkan Tiket</button><button v-if="selected && tab === 'general' && !['solved','cancelled'].includes(selected.status) && (normalizedRole === 'admin' || owners[selected.kategori] === normalizedRole)" class="secondary-button" type="button" @click="action('resolve')">Resolve</button><button v-if="tab === 'general' && (!selected || (normalizedRole === 'admin' || owners[selected.kategori] === normalizedRole) && !['solved','cancelled'].includes(selected.status))" class="primary-button" type="submit" form="tkt-form" :disabled="busy">Simpan</button></footer>
    </section></div>
  </div>
</template>

<style scoped>
.tkt-page { padding: 24px 28px; }
.tkt-toolbar { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-bottom: 16px; }
.tkt-toolbar select,.tkt-search,.tkt-form input,.tkt-form select,.tkt-form textarea { border: 1px solid #29364b; border-radius: 6px; background: #0c1628; color: #eaf2fb; min-height: 38px; padding: 7px 10px; font: inherit; }
.tkt-search { display: flex; align-items: center; gap: 8px; min-width: 220px; }
.tkt-search input { border: 0; background: none; outline: 0; color: inherit; width: 100%; }
.tkt-table { border: 1px solid #263247; border-radius: 7px; }
.tkt-row { cursor: pointer; }.tkt-row:hover { background: #112139; }.tkt-empty { text-align: center; padding: 34px; }
.tkt-status { display: inline-block; padding: 4px 9px; border-radius: 4px; background: #183349; color: #8bd7e8; text-transform: capitalize; }
.tkt-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; color: #a8bad0; font-size: 12px; }.tkt-footer div { display: flex; align-items: center; gap: 10px; }.tkt-footer button,.tkt-footer select { background: #111e31; border: 1px solid #29364b; color: #eaf2fb; min-width: 34px; min-height: 32px; border-radius: 5px; }.tkt-footer button:disabled { opacity: .4; }
.tkt-error,.tkt-message { padding: 9px 12px; margin: 8px 0; border-radius: 4px; }.tkt-error { color: #ffadbd; background: #40202b; }.tkt-message { color: #9ce8c4; background: #143c36; }
.tkt-modal { width: min(800px, calc(100vw - 28px)); max-height: min(790px, calc(100vh - 40px)); display: flex; flex-direction: column; background: #091525; border: 1px solid #2c3a4e; border-radius: 8px; color: #eef5ff; }
.tkt-legacy-note { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; color: #b8c9d9; font-size: 12px; }.tkt-legacy-note button { flex: none; }.tkt-legacy .tkt-modal-footer,.tkt-legacy .tkt-subhead button { display: none; }
.tkt-modal-header { padding: 18px 20px; display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid #253246; }.tkt-modal-header small { color: #91a9c2; font-size: 11px; }.tkt-modal-header h2 { margin: 3px 0 0; font-size: 21px; }.tkt-modal-header button { background: none; color: #b8cadc; border: 1px solid #2d3b50; border-radius: 5px; width: 32px; height: 32px; }
.tkt-tabs { display: flex; gap: 4px; border-bottom: 1px solid #253246; padding: 8px 20px 0; }.tkt-tabs button { padding: 9px 14px; background: none; color: #a9bdd1; border: 0; border-radius: 5px 5px 0 0; }.tkt-tabs button.active { background: #2c3d54; color: white; }
.tkt-modal-body { padding: 18px 20px; overflow-y: auto; flex: 1; min-height: 0; }.tkt-form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }.tkt-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #b6c5d5; }.tkt-form .wide,.tkt-facts { grid-column: 1 / -1; }.tkt-form textarea { resize: vertical; }.tkt-facts { display: flex; flex-wrap: wrap; gap: 8px; }.tkt-facts span { font-size: 12px; color: #cbd8e6; border-bottom: 1px solid #294056; padding: 6px; }
.tkt-subhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }.tkt-modal-footer { border-top: 1px solid #253246; padding: 12px 20px; display: flex; justify-content: flex-end; gap: 8px; }
.tkt-units { max-height: 150px; overflow: auto; border-top: 1px solid #263247; padding: 10px 0; }.tkt-units strong { display: block; margin-bottom: 7px; }.tkt-units label { flex-direction: row; align-items: center; margin: 5px 0; }.tkt-units input { min-height: auto; }
.tkt-new-unit { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end; padding: 10px 0; border-bottom: 1px solid #263247; }.tkt-new-units > button { margin-top: 10px; }
@media(max-width:650px) { .tkt-new-unit { grid-template-columns: 1fr; } }
@media(max-width:650px) { .tkt-page { padding: 14px; }.tkt-toolbar { justify-content: stretch; }.tkt-toolbar > * { flex: 1; }.tkt-form { grid-template-columns: 1fr; }.tkt-modal { max-height: calc(100vh - 16px); } }
</style>
