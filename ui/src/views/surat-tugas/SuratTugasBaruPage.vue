<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Plus, X } from "lucide-vue-next";
import api from "../../services/api";

const props = defineProps({ role: { type: String, default: "" }, ticketPrefill: { type: Object, default: null } });
const emit = defineEmits(["print"]);
const rows = ref([]);
const tickets = ref([]);
const accounts = ref([]);
const customers = ref([]);
const contracts = ref([]);
const printers = ref([]);
const printerSearch = ref("");
const models = ref([]);
const gudang = ref([]);
const teknisi = ref([]);
const warehouse = ref([]);
const toner = ref([]);
const sparepart = ref([]);
const selected = ref(null);
const modal = ref(false);
const creating = ref(false);
const tab = ref("general");
const busy = ref(false);
const error = ref("");
const notice = ref("");
const search = ref("");
const form = reactive({ tiket_id: "", jenis_tugas: "", mode: "", account_id: "", customer_id: "", kontrak_id: "", unit_asal_id: "", gudang_id: "", pic_teknisi_id: "", pic_warehouse_id: "", lokasi_internal: "", sumber: "", printer_ids: [], new_mp_no: "", new_model_id: "", hasil: "" });
const itemForm = reactive({ jenis_barang: "toner", item_id: "", gudang_id: "", jumlah_pakai: 1, keterangan: "" });
const results = reactive({});
const role = computed(() => String(props.role).replace(/-/g, "_"));
const canCreate = computed(() => ["admin", "kepala_teknisi", "warehouse"].includes(role.value));
const kinds = {
  kirim_kontrak: "Pengiriman Kontrak", terima_tukar: "Penerimaan Tukar", kirim_trial: "Pengiriman Trial", kirim_stand_by: "Pengiriman Stand-by", kirim_event: "Pengiriman Event", kirim_sell: "Penjualan", kirim_toner: "Pengiriman Toner", on_site_service: "On-site Service", kirim_back_up: "Pengiriman Back-up", terima_unit_rusak: "Terima Unit Rusak", repair: "Repair", qc: "QC", internal_use: "Internal Use", terima_return: "Return", terima_printer_baru: "Penerimaan Printer", maintenance: "Maintenance"
};
const allowedKinds = computed(() => {
  const ticket = tickets.value.find((item) => item.id === form.tiket_id);
  if (ticket) {
    const map = { kontrak: form.mode === "tukar" ? ["kirim_kontrak", "terima_tukar"] : ["kirim_kontrak"], trial: ["kirim_trial"], stand_by: ["kirim_stand_by"], event: ["kirim_event"], sell: ["kirim_sell"], toner_purchase: ["kirim_toner"], on_site_service: ["on_site_service"], back_up: ["kirim_back_up", "terima_unit_rusak"], repair: ["repair"], qc: ["qc"], internal_use: ["internal_use"], return: ["terima_return"], penerimaan_printer: ["terima_printer_baru"], maintenance: ["maintenance"] };
    const choices = map[ticket.jenis] || [];
    return role.value === "warehouse" ? choices.filter((key) => key.startsWith("terima_")) : choices;
  }
  return Object.keys(kinds).filter((key) => role.value !== "warehouse" || key.startsWith("terima_"));
});
const chosenTicket = computed(() => tickets.value.find((item) => item.id === form.tiket_id));
const selectedCustomers = computed(() => customers.value.filter((item) => item.account_id === form.account_id && item.aktif));
const oldUnitOptions = computed(() => printers.value.filter((item) => item.lokasi_jenis === "customer" && item.customer_id === form.customer_id && (form.jenis_tugas !== "kirim_kontrak" || !form.kontrak_id || item.kontrak_id === form.kontrak_id)));
const assetsForSt = computed(() => {
  const ticket = chosenTicket.value;
  if (ticket) return ticket.tiket_printer?.filter((line) => {
    if (form.jenis_tugas === "kirim_kontrak") return line.peran === "utama";
    if (form.jenis_tugas === "terima_tukar") return line.peran === "unit_lama";
    if (form.jenis_tugas === "kirim_back_up") return line.peran === "pengganti";
    if (form.jenis_tugas === "terima_unit_rusak") return line.peran === "utama";
    return true;
  }) || [];
  return printers.value.filter((p) => ["terima_return", "terima_tukar", "terima_unit_rusak", "on_site_service", "maintenance"].includes(form.jenis_tugas) ? p.lokasi_jenis === "customer" && (!form.customer_id || p.customer_id === form.customer_id) : ["qc", "repair"].includes(form.jenis_tugas) ? p.lokasi_jenis === "gudang" : p.lokasi_jenis === "gudang" && p.kondisi === "ready");
});
const itemChoices = computed(() => itemForm.jenis_barang === "toner" ? toner.value : sparepart.value);
const errorText = (err) => err.response?.data?.pesan || err.response?.data?.message || err.message || "Permintaan gagal.";
let printerRequest = 0;
let printerSearchTimer;

async function searchPrinters() {
  const requestId = ++printerRequest;
  try {
    const response = await api.get("/printer", { params: { batas: 100, ...(printerSearch.value ? { cari: printerSearch.value } : {}) } });
    if (requestId !== printerRequest) return;
    const selectedUnits = printers.value.filter((item) => form.printer_ids.includes(item.id) || form.unit_asal_id === item.id);
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
    const [a, c, p, m, g, u, t, s, tk, k] = await Promise.all([all("/account"), all("/account/lokasi-customer"), api.get("/printer", { params: { batas: 100 } }), all("/printer-model"), all("/gudang"), all("/pengguna"), all("/toner"), all("/suku-cadang"), all("/tiket"), canCreate.value ? all("/kontrak") : Promise.resolve([])]);
    accounts.value = a.filter((item) => item.aktif); customers.value = c; printers.value = p.data.data.items; models.value = m; gudang.value = g.filter((item) => item.aktif); toner.value = t; sparepart.value = s; tickets.value = tk.filter((item) => !["solved", "cancelled"].includes(item.status)); contracts.value = k.filter((item) => item.status === "aktif");
    teknisi.value = u.filter((item) => (item.role || item.peran) === "teknisi" && (item.active ?? item.aktif));
    warehouse.value = u.filter((item) => (item.role || item.peran) === "warehouse" && (item.active ?? item.aktif));
  } catch (err) { error.value = errorText(err); }
}
async function load() {
  try {
    const response = await api.get("/surat-tugas");
    rows.value = response.data.data;
    error.value = "";
  } catch (err) { error.value = errorText(err); }
}
async function openDetail(item) {
  try {
    const response = await api.get(`/surat-tugas/${item.id}`);
    selected.value = response.data.data;
    creating.value = false; tab.value = "general"; modal.value = true;
    form.hasil = selected.value.hasil || "";
    itemForm.gudang_id = selected.value.gudang_id || "";
    Object.keys(results).forEach((key) => delete results[key]);
    selected.value.surat_tugas_printer?.forEach((line) => { results[line.id] = { hasil: line.hasil || "", kondisi_hasil: line.kondisi_hasil || "", alasan: line.alasan || "" }; });
  } catch (err) { error.value = errorText(err); }
}
function useTicket() {
  const ticket = chosenTicket.value;
  if (!ticket) {
    Object.assign(form, { jenis_tugas: "", mode: "", account_id: "", customer_id: "", kontrak_id: "", unit_asal_id: "", printer_ids: [] });
    return;
  }
  Object.assign(form, { account_id: ticket.account_id || "", customer_id: ticket.customer_id || "", mode: ticket.mode || "", kontrak_id: ticket.kontrak_id || "", lokasi_internal: ticket.lokasi_internal || "", jenis_tugas: ({ kontrak: "kirim_kontrak", trial: "kirim_trial", stand_by: "kirim_stand_by", event: "kirim_event", sell: "kirim_sell", toner_purchase: "kirim_toner", on_site_service: "on_site_service", back_up: "kirim_back_up", repair: "repair", qc: "qc", internal_use: "internal_use", return: "terima_return", penerimaan_printer: "terima_printer_baru", maintenance: "maintenance" })[ticket.jenis] || "" });
  if (role.value === "warehouse") form.jenis_tugas = allowedKinds.value[0] || "";
  form.printer_ids = [];
}
function changeKind() {
  form.printer_ids = [];
  if (!chosenTicket.value) {
    form.mode = "";
    form.kontrak_id = "";
    form.unit_asal_id = "";
  }
}
function openNew(ticket = null) {
  selected.value = null; creating.value = true; modal.value = true; tab.value = "general";
  printerSearch.value = "";
  Object.assign(form, { tiket_id: ticket?.id || "", jenis_tugas: "", mode: "", account_id: "", customer_id: "", kontrak_id: "", unit_asal_id: "", gudang_id: "", pic_teknisi_id: "", pic_warehouse_id: "", lokasi_internal: "", sumber: "", printer_ids: [], new_mp_no: "", new_model_id: "", hasil: "" });
  if (ticket) { if (!tickets.value.some((row) => row.id === ticket.id)) tickets.value.unshift(ticket); useTicket(); }
}
function buildPayload() {
  const ticket = chosenTicket.value;
  const source = ticket ? assetsForSt.value : form.jenis_tugas === "terima_printer_baru" ? [{ mp_no: form.new_mp_no.trim(), model_id: form.new_model_id, sumber: form.sumber, peran: "utama" }] : assetsForSt.value.filter((p) => form.printer_ids.includes(p.id));
  return {
    tiket_id: form.tiket_id || null, jenis_tugas: form.jenis_tugas, mode: form.mode || null,
    account_id: form.account_id || null, customer_id: form.customer_id || null, kontrak_id: form.kontrak_id || null, unit_asal_id: form.unit_asal_id || null,
    gudang_id: form.gudang_id || null, pic_teknisi_id: form.pic_teknisi_id || null, pic_warehouse_id: form.pic_warehouse_id || null,
    lokasi_internal: form.lokasi_internal || null, sumber: form.sumber || ticket?.alasan || null,
    printer: source.map((line) => ({ printer_id: line.printer_id || line.id || null, mp_no: line.mp_no, model_id: line.model_id || null, serial_number: line.serial_number || null, sumber: line.sumber || null, peran: line.peran || "utama" }))
  };
}
async function create() {
  busy.value = true;
  try {
    await api.post("/surat-tugas", buildPayload());
    modal.value = false; notice.value = "Surat tugas dibuat."; await load(); await loadOptions();
  } catch (err) { error.value = errorText(err); }
  finally { busy.value = false; }
}
async function action(name) {
  if (!selected.value) return;
  if (name === "cancel" && !window.confirm("Batalkan surat tugas ini?")) return;
  busy.value = true;
  try {
    await api.post(`/surat-tugas/${selected.value.id}/${name}`, name === "selesai" ? { hasil: form.hasil || null } : {});
    notice.value = "Status surat tugas diperbarui.";
    await load(); await openDetail(selected.value);
  } catch (err) { error.value = errorText(err); }
  finally { busy.value = false; }
}
async function assign() {
  if (!form.pic_teknisi_id) { error.value = "Pilih teknisi terlebih dahulu."; return; }
  try {
    await api.post(`/surat-tugas/${selected.value.id}/assign`, { pic_teknisi_id: form.pic_teknisi_id });
    notice.value = "PIC teknisi ditugaskan."; await load(); await openDetail(selected.value);
  } catch (err) { error.value = errorText(err); }
}
async function saveResult(line) {
  try {
    await api.put(`/surat-tugas/${selected.value.id}/printer/${line.id}/hasil`, { hasil: results[line.id].hasil, kondisi_hasil: results[line.id].kondisi_hasil || undefined, alasan: results[line.id].alasan || null });
    await openDetail(selected.value); notice.value = `Hasil ${line.mp_no} tersimpan.`;
  } catch (err) { error.value = errorText(err); }
}
async function addItem() {
  try {
    const body = { gudang_id: itemForm.gudang_id, jenis_barang: itemForm.jenis_barang, jumlah_pakai: Number(itemForm.jumlah_pakai), keterangan: itemForm.keterangan || null, ...(itemForm.jenis_barang === "toner" ? { toner_id: itemForm.item_id } : { suku_cadang_id: itemForm.item_id }) };
    await api.post(`/surat-tugas/${selected.value.id}/pemakaian`, body);
    await openDetail(selected.value); tab.value = "item"; notice.value = "Item ditambahkan.";
  } catch (err) { error.value = errorText(err); }
}
async function deleteItem(line) {
  if (!window.confirm("Hapus item ini dari surat tugas?")) return;
  try { await api.delete(`/surat-tugas/${selected.value.id}/pemakaian/${line.id}`); await openDetail(selected.value); tab.value = "item"; }
  catch (err) { error.value = errorText(err); }
}
function canAct(name) {
  const st = selected.value; if (!st?.jenis_tugas) return false;
  const leader = ["admin", "kepala_teknisi"].includes(role.value);
  const worker = ["admin", "teknisi"].includes(role.value);
  const store = ["admin", "warehouse"].includes(role.value);
  if (name === "start") return (leader || store && st.jenis_tugas.startsWith("terima_")) && st.status === "pending";
  if (name === "ready-to-print") return worker && st.status === "progress" && !st.jenis_tugas.startsWith("terima_");
  if (name === "keluar") return store && st.status === "ready_to_print" && !st.konfirmasi_keluar_pada && !st.jenis_tugas.startsWith("terima_");
  if (name === "serah") return worker && st.status === "ready_to_print" && !st.konfirmasi_serah_pada && (st.jenis_tugas.startsWith("kirim_") || st.jenis_tugas === "internal_use");
  if (name === "terima") return store && st.status === "progress" && !st.konfirmasi_terima_pada && st.jenis_tugas.startsWith("terima_");
  if (name === "selesai") return (worker || store && st.jenis_tugas.startsWith("terima_")) && ["progress", "ready_to_print", "warehouse_validated"].includes(st.status);
  if (name === "resolve") return leader && ["technician_completed", "warehouse_validated"].includes(st.status);
  if (name === "cancel") return (leader || store && st.jenis_tugas.startsWith("terima_")) && !["solved", "cancelled"].includes(st.status) && !st.konfirmasi_keluar_pada && !st.konfirmasi_serah_pada && !st.konfirmasi_terima_pada;
  return false;
}
watch(() => props.ticketPrefill, (ticket) => { if (ticket) openNew(ticket); }, { immediate: true });
watch(() => form.account_id, () => { if (!chosenTicket.value) form.customer_id = ""; });
onMounted(async () => { await Promise.all([load(), ...(["sales", "sales_admin"].includes(role.value) ? [] : [loadOptions()])]); if (props.ticketPrefill) openNew(props.ticketPrefill); });
defineExpose({ openNew });
</script>

<template>
  <div class="st-page"><div class="st-toolbar"><label><input v-model="search" placeholder="Cari nomor atau jenis" /></label><button v-if="canCreate" class="primary-button" type="button" @click="openNew()"><Plus :size="16" /> Surat Tugas</button></div>
    <p v-if="error" class="st-error">{{ error }}</p><p v-else-if="notice" class="st-notice">{{ notice }}</p>
    <div class="st-table table-wrap"><table><thead><tr><th>Nomor ST</th><th>Jenis</th><th>Tiket</th><th>Customer</th><th>PIC</th><th>Status</th></tr></thead><tbody><tr v-for="st in rows.filter(x => !search || `${x.nomor_surat_tugas} ${x.jenis_tugas || x.jenis_pekerjaan}`.toLowerCase().includes(search.toLowerCase()))" :key="st.id" @click="openDetail(st)"><td>{{ st.nomor_surat_tugas }}</td><td>{{ kinds[st.jenis_tugas] || `${st.jenis_pekerjaan} (arsip)` }}</td><td>{{ st.tiket?.nomor_tiket || 'Mandiri' }}</td><td>{{ st.master_customer?.nama_customer || '—' }}</td><td>{{ st.teknisi_surat_tugas?.[0]?.master_pengguna?.nama_lengkap || st.teknisi_surat_tugas?.[0]?.master_pengguna?.nama || '—' }}</td><td>{{ st.status }}</td></tr><tr v-if="!rows.length"><td colspan="6">Belum ada Surat Tugas.</td></tr></tbody></table></div>
    <div v-if="modal" class="modal-backdrop"><section class="st-modal" :class="{ 'st-legacy': !creating && !selected?.jenis_tugas }" role="dialog" aria-modal="true"><header><div><small>{{ creating ? 'DATA BARU' : selected?.nomor_surat_tugas }}</small><h2>{{ creating ? 'Buat Surat Tugas' : kinds[selected?.jenis_tugas] || 'Surat Tugas Arsip' }}</h2></div><button type="button" aria-label="Tutup" @click="modal = false"><X :size="18" /></button></header>
      <nav v-if="!creating && selected?.jenis_tugas"><button type="button" :class="{ active: tab === 'general' }" @click="tab = 'general'">General</button><button type="button" :class="{ active: tab === 'unit' }" @click="tab = 'unit'">Unit Printer</button><button type="button" :class="{ active: tab === 'item' }" @click="tab = 'item'">Item</button></nav>
      <p v-if="!creating && !selected?.jenis_tugas" class="st-legacy-note">Data dari alur Komplain lama tetap tersimpan. Surat Tugas ini hanya ditampilkan sebagai arsip di alur baru.</p>
      <div class="st-modal-body"><form v-if="creating" id="st-create" class="st-form" @submit.prevent="create"><label>Tiket (opsional)<select v-model="form.tiket_id" @change="useTicket"><option value="">Surat Tugas mandiri</option><option v-for="t in tickets" :key="t.id" :value="t.id">{{ t.nomor_tiket }} · {{ t.jenis }}</option></select></label><label>Jenis ST<select v-model="form.jenis_tugas" required @change="changeKind"><option value="">Pilih jenis</option><option v-for="key in allowedKinds" :key="key" :value="key">{{ kinds[key] }}</option></select></label>
        <label v-if="!chosenTicket">Account<select v-model="form.account_id"><option value="">Tidak berlaku</option><option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.nama_account }}</option></select></label><label v-if="!chosenTicket">Customer / Site<select v-model="form.customer_id"><option value="">Tidak berlaku</option><option v-for="c in selectedCustomers" :key="c.id" :value="c.id">{{ c.nama_customer }}</option></select></label>
        <label v-if="['kirim_kontrak','kirim_back_up'].includes(form.jenis_tugas) && !chosenTicket">Mode<select v-model="form.mode" required><option value="">Pilih mode</option><option v-if="form.jenis_tugas === 'kirim_kontrak'" value="baru">Baru</option><option v-if="form.jenis_tugas === 'kirim_kontrak'" value="tukar">Tukar</option><option v-if="form.jenis_tugas === 'kirim_back_up'" value="sementara">Sementara</option><option v-if="form.jenis_tugas === 'kirim_back_up'" value="permanen">Permanen</option></select></label>
        <label v-if="!chosenTicket && (form.jenis_tugas === 'kirim_kontrak' && form.mode === 'tukar' || form.jenis_tugas === 'terima_tukar')">Kontrak Aktif<select v-model="form.kontrak_id" required><option value="">Pilih kontrak</option><option v-for="k in contracts.filter(x => x.customer_id === form.customer_id)" :key="k.id" :value="k.id">{{ k.nomor_kontrak }}</option></select></label>
        <label v-if="!chosenTicket && (form.jenis_tugas === 'kirim_kontrak' && form.mode === 'tukar' || form.jenis_tugas === 'kirim_back_up')" class="st-wide">Unit Lama<select v-model="form.unit_asal_id" required><option value="">Pilih unit di customer</option><option v-for="p in oldUnitOptions" :key="p.id" :value="p.id">{{ p.mp_no }}</option></select></label>
        <label v-if="['kirim_kontrak','kirim_trial','kirim_stand_by','kirim_event','kirim_sell','kirim_back_up','internal_use','kirim_toner','terima_tukar','terima_unit_rusak','terima_return','terima_printer_baru'].includes(form.jenis_tugas)">Gudang<select v-model="form.gudang_id" required><option value="">Pilih Gudang</option><option v-for="g in gudang" :key="g.id" :value="g.id">{{ g.nama_gudang }}</option></select></label>
        <label v-if="!form.jenis_tugas.startsWith('terima_')">PIC Teknisi<select v-model="form.pic_teknisi_id" required><option value="">Pilih Teknisi</option><option v-for="u in teknisi" :key="u.id" :value="u.id">{{ u.name || u.user_id }}</option></select></label><label v-else>PIC Warehouse<select v-model="form.pic_warehouse_id" required><option value="">Pilih Warehouse</option><option v-for="u in warehouse" :key="u.id" :value="u.id">{{ u.name || u.user_id }}</option></select></label>
        <label v-if="form.jenis_tugas === 'internal_use'">Divisi / Lokasi Internal<input v-model="form.lokasi_internal" required /></label><label v-if="form.jenis_tugas === 'terima_printer_baru' && !chosenTicket">Sumber / Pemasok<input v-model="form.sumber" required /></label><label v-if="form.jenis_tugas === 'terima_printer_baru' && !chosenTicket">MP No<input v-model="form.new_mp_no" required /></label><label v-if="form.jenis_tugas === 'terima_printer_baru' && !chosenTicket">Model<select v-model="form.new_model_id" required><option value="">Pilih Model</option><option v-for="m in models" :key="m.id" :value="m.id">{{ m.nama_model }}</option></select></label>
        <label v-if="!chosenTicket && !['kirim_toner','terima_printer_baru'].includes(form.jenis_tugas)" class="st-wide">Cari MP No / serial<input v-model="printerSearch" placeholder="Ketik MP No atau serial" /></label>
        <div v-if="form.jenis_tugas !== 'kirim_toner' && (chosenTicket || form.jenis_tugas !== 'terima_printer_baru')" class="st-wide"><strong>Unit Printer</strong><template v-if="chosenTicket"><p v-for="line in assetsForSt" :key="line.id">{{ line.peran }} · {{ line.mp_no }}{{ line.sumber ? ` · ${line.sumber}` : '' }}</p></template><template v-else><label v-for="p in assetsForSt" :key="p.id" class="st-check"><input v-model="form.printer_ids" type="checkbox" :value="p.id" /> {{ p.mp_no }}</label></template></div><p v-if="chosenTicket && form.jenis_tugas === 'kirim_toner'" class="st-wide">Item toner mengikuti Tiket.</p>
      </form>
      <template v-else-if="tab === 'general'"><div class="st-facts"><span>Tiket: {{ selected.tiket?.nomor_tiket || 'Mandiri' }}</span><span>Status: {{ selected.status }}</span><span>Customer: {{ selected.master_customer?.nama_customer || '—' }}</span><span>Keluar: {{ selected.konfirmasi_keluar_pada ? 'Terkonfirmasi' : 'Belum' }}</span><span>Serah: {{ selected.konfirmasi_serah_pada ? 'Terkonfirmasi' : 'Belum' }}</span><span>Terima: {{ selected.konfirmasi_terima_pada ? 'Terkonfirmasi' : 'Belum' }}</span></div><div v-if="!selected.teknisi_surat_tugas?.length && selected.status === 'pending' && ['admin','kepala_teknisi'].includes(role)" class="st-assign"><select v-model="form.pic_teknisi_id"><option value="">Pilih Teknisi</option><option v-for="u in teknisi" :key="u.id" :value="u.id">{{ u.name || u.user_id }}</option></select><button class="secondary-button" type="button" @click="assign">Assign PIC</button></div><label class="st-result">Hasil pekerjaan<textarea v-model="form.hasil" rows="3" /></label><div class="st-actions"><button v-for="name in ['start','ready-to-print','keluar','serah','terima','selesai','resolve','cancel']" v-show="canAct(name) && (name !== 'start' || selected.teknisi_surat_tugas?.length || selected.jenis_tugas.startsWith('terima_'))" :key="name" class="secondary-button" type="button" :disabled="busy" @click="action(name)">{{ { start:'Mulai', 'ready-to-print':'Siap Cetak', keluar:'Konfirmasi Keluar', serah:'Konfirmasi Serah', terima:'Konfirmasi Terima', selesai:'Selesai Pekerjaan', resolve:'Resolve', cancel:'Batalkan' }[name] }}</button><button v-if="['ready_to_print','technician_completed','warehouse_validated','solved'].includes(selected.status)" class="secondary-button" type="button" @click="emit('print', selected)">PDF</button></div></template>
      <template v-else-if="tab === 'unit'"><div v-for="line in selected.surat_tugas_printer" :key="line.id" class="st-unit"><strong>{{ line.mp_no }}</strong><span>{{ line.peran }}</span><div v-if="['progress','ready_to_print','technician_completed'].includes(selected.status) && ['admin','teknisi'].includes(role)" class="st-form"><label>Hasil<input v-model="results[line.id].hasil" /></label><label v-if="['qc','repair'].includes(selected.jenis_tugas)">Kondisi<select v-model="results[line.id].kondisi_hasil"><option value="">Pilih</option><option v-for="value in ['ready','ready_with_condition','need_repair','unready','kanibal']" :key="value" :value="value">{{ value }}</option></select></label><label>Alasan / Keterangan<input v-model="results[line.id].alasan" /></label><button class="secondary-button" type="button" @click="saveResult(line)">Simpan Hasil</button></div><p v-else>{{ line.hasil || 'Belum ada hasil.' }} {{ line.kondisi_hasil || '' }}</p></div></template>
      <template v-else><div class="table-wrap"><table><thead><tr><th>Item</th><th>Jumlah</th><th>Gudang</th><th></th></tr></thead><tbody><tr v-for="line in selected.pemakaian_barang_surat_tugas" :key="line.id"><td>{{ line.master_toner?.nama_toner || line.master_suku_cadang?.nama_suku_cadang }}</td><td>{{ line.jumlah_pakai }}</td><td>{{ line.master_gudang?.nama_gudang }}</td><td><button v-if="['admin','teknisi'].includes(role) && ['progress','ready_to_print'].includes(selected.status)" type="button" @click="deleteItem(line)">Hapus</button></td></tr><tr v-if="!selected.pemakaian_barang_surat_tugas?.length"><td colspan="4">Belum ada item.</td></tr></tbody></table></div><form v-if="['admin','teknisi'].includes(role) && ['progress','ready_to_print'].includes(selected.status)" class="st-form st-item-form" @submit.prevent="addItem"><label>Jenis<select v-model="itemForm.jenis_barang" @change="itemForm.item_id = ''"><option value="toner">Toner</option><option value="suku_cadang">Sparepart</option></select></label><label>Item<select v-model="itemForm.item_id" required><option value="">Pilih item</option><option v-for="i in itemChoices" :key="i.id" :value="i.id">{{ i.nama_toner || i.nama_suku_cadang }}</option></select></label><label>Gudang<select v-model="itemForm.gudang_id" required><option value="">Pilih Gudang</option><option v-for="g in gudang" :key="g.id" :value="g.id">{{ g.nama_gudang }}</option></select></label><label>Jumlah<input v-model.number="itemForm.jumlah_pakai" type="number" min="1" required /></label><label>Catatan<input v-model="itemForm.keterangan" /></label><button class="primary-button" type="submit">Tambah Item</button></form></template>
      </div><footer v-if="creating"><button class="secondary-button" type="button" @click="modal = false">Batal</button><button class="primary-button" type="submit" form="st-create" :disabled="busy">Simpan</button></footer>
    </section></div>
  </div>
</template>

<style scoped>
.st-page { padding: 24px 28px; }.st-toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 16px; }.st-toolbar input,.st-form input,.st-form select,.st-result textarea { background: #0c1628; color: #eaf2fb; border: 1px solid #29364b; border-radius: 6px; padding: 7px 10px; min-height: 38px; font: inherit; }.st-toolbar input { width: 260px; }.st-table { border: 1px solid #263247; border-radius: 7px; }.st-table tbody tr { cursor: pointer; }.st-table tbody tr:hover { background: #112139; }.st-error,.st-notice { padding: 9px 12px; border-radius: 4px; }.st-error { background: #40202b; color: #ffadbd; }.st-notice { background: #143c36; color: #9ce8c4; }
.st-modal { width: min(840px, calc(100vw - 28px)); max-height: min(800px, calc(100vh - 40px)); display: flex; flex-direction: column; border: 1px solid #2c3a4e; border-radius: 8px; background: #091525; color: #eef5ff; }.st-modal header { padding: 18px 20px; display: flex; justify-content: space-between; border-bottom: 1px solid #253246; }.st-modal header small { color: #91a9c2; font-size: 11px; }.st-modal h2 { margin: 3px 0 0; font-size: 21px; }.st-modal header button { color: #b8cadc; background: none; border: 1px solid #2d3b50; border-radius: 5px; width: 32px; height: 32px; }.st-modal nav { display: flex; gap: 4px; border-bottom: 1px solid #253246; padding: 8px 20px 0; }.st-modal nav button { padding: 9px 14px; color: #a9bdd1; border: 0; background: none; }.st-modal nav button.active { color: white; background: #2c3d54; border-radius: 5px 5px 0 0; }.st-modal-body { padding: 18px 20px; overflow: auto; min-height: 0; flex: 1; }.st-form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }.st-form label,.st-result { display: flex; flex-direction: column; gap: 6px; color: #b6c5d5; font-size: 12px; }.st-wide { grid-column: 1 / -1; padding: 10px 0; border-top: 1px solid #263247; }.st-wide strong { display: block; margin-bottom: 8px; }.st-wide p { margin: 4px 0; }.st-check { display: inline-flex !important; flex-direction: row !important; align-items: center; margin: 4px 14px 4px 0; }.st-check input { min-height: auto; }.st-facts { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }.st-facts span { padding: 7px 9px; border-bottom: 1px solid #294056; font-size: 12px; }.st-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }.st-unit { border-bottom: 1px solid #263247; padding: 12px 0; }.st-unit > span { color: #9eb0c8; margin-left: 12px; }.st-unit .st-form { margin-top: 12px; }.st-item-form { margin-top: 20px; }.st-modal footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #253246; }
.st-assign { display: flex; gap: 8px; margin: 12px 0; }.st-assign select { min-height: 38px; background: #0c1628; color: #eaf2fb; border: 1px solid #29364b; border-radius: 6px; }
.st-legacy-note { margin: 16px 20px 0; color: #aac0d6; font-size: 13px; }.st-legacy .st-assign,.st-legacy .st-result,.st-legacy .st-actions { display: none; }
@media(max-width:650px) {
  .st-page { padding: 14px; }
  .st-form { grid-template-columns: 1fr; }
  .st-toolbar { align-items: center; }
  .st-toolbar label { flex: 1; min-width: 0; }
  .st-toolbar input { width: 100%; }
  .st-toolbar .primary-button { flex: none; white-space: nowrap; margin-top: 0; }
  .st-table th,.st-table td { padding: 12px 9px; }
  .st-table th:nth-child(3),.st-table td:nth-child(3),
  .st-table th:nth-child(4),.st-table td:nth-child(4),
  .st-table th:nth-child(5),.st-table td:nth-child(5) { display: none; }
  .st-table td:nth-child(1) { font-size: 11px; }
  .st-table td:nth-child(2) { white-space: normal; overflow-wrap: anywhere; }
  .st-modal { max-height: calc(100vh - 16px); }
}
</style>
