<script setup lang="ts">
import SuratTugasPage from "../surat-tugas/SuratTugasPage.vue";

type Row = Record<string, any>;
const { request, message } = useServiceApi();
const auth = useAuth();
const role = computed(() =>
  String(auth.user.value?.role || "")
    .toLowerCase()
    .replaceAll("-", "_"),
);
const owners: Record<string, string> = {
  delivery: "sales_admin",
  komplain: "sales_admin",
  internal: "kepala_teknisi",
  inbound: "warehouse",
  maintenance: "kepala_teknisi",
};
const categories: Record<string, string> = {
  delivery: "Delivery",
  komplain: "Komplain",
  internal: "Internal",
  inbound: "Inbound",
  maintenance: "Maintenance",
};
const statuses = ["new", "pending", "progress", "solved", "cancelled"];
const canCreate = computed(
  () => role.value === "admin" || Object.values(owners).includes(role.value),
);
const rows = ref<Row[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const search = ref("");
const category = ref<string>();
const status = ref<string>();
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const createOpen = ref(false);
const detailOpen = ref(false);
const stModalOpen = ref(false);
const stTicketId = ref("");
const detailTab = ref<"detil" | "surat_tugas">("detil");
const selected = ref<Row | null>(null);
const options = reactive<Record<string, Row[]>>({
  customers: [],
  printers: [],
  sales: [],
});
const searches = reactive({ customer: "", printer: "", sales: "" });
const loadingOptions = reactive({
  customer: false,
  printer: false,
  sales: false,
});
const form = reactive({
  kategori: "",
  account_id: "",
  customer_id: "",
  sales_id: "",
  tanggal_transaksi: "",
  deskripsi: "",
  printer_ids: [] as string[],
});
const salesItems = computed(() =>
  options.sales
    .filter(
      (row) =>
        ["sales"].includes(String(row.role || row.peran || "").toLowerCase()) &&
        row.aktif !== false &&
        row.active !== false,
    )
    .map((row) => ({
      label: row.nama_lengkap || row.name || row.user_id,
      value: row.id,
    })),
);
const allowedCategories = computed(() =>
  Object.keys(categories).filter(
    (key) => role.value === "admin" || owners[key] === role.value,
  ),
);
const customerRequired = computed(() =>
  ["delivery", "komplain", "inbound", "maintenance"].includes(form.kategori),
);
const canCloseSelected = computed(() =>
  Boolean(
    selected.value &&
      role.value === "admin" &&
      !["solved", "cancelled"].includes(selected.value.status),
  ),
);
const canEditSelected = computed(() =>
  Boolean(
    selected.value &&
      (role.value === "admin" ||
        owners[selected.value.kategori] === role.value) &&
      !["solved", "cancelled"].includes(selected.value.status),
  ),
);
const readyToClose = computed(() =>
  Boolean(
    selected.value?.surat_tugas?.length &&
      selected.value.surat_tugas.every((st: Row) =>
        ["solved", "cancelled"].includes(st.status),
      ) &&
      selected.value.surat_tugas.some((st: Row) => st.status === "solved"),
  ),
);
function unwrap(response: Row): Row[] {
  return Array.isArray(response?.data)
    ? response.data
    : response?.data?.items || [];
}
function dateTimeLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function iso(value: string) {
  return value ? new Date(value).toISOString() : null;
}
function clearNotice() {
  errorMessage.value = "";
  successMessage.value = "";
}
function resetForm() {
  Object.assign(form, {
    kategori: allowedCategories.value[0] || "",
    account_id: "",
    customer_id: "",
    sales_id: "",
    tanggal_transaksi: dateTimeLocal(),
    deskripsi: "",
    printer_ids: [],
  });
}
function selectCustomer(id: string) {
  const row = options.customers.find((item) => item.id === id);
  form.account_id = row?.account_id || row?.master_account?.id || "";
}
async function loadTickets() {
  loading.value = true;
  try {
    const q = new URLSearchParams({
      halaman: String(page.value),
      batas: String(pageSize.value),
    });
    if (search.value.trim()) q.set("cari", search.value.trim());
    if (category.value) q.set("kategori", category.value);
    if (status.value) q.set("status", status.value);
    const r = await request<Row>(`/tiket?${q}`);
    rows.value = unwrap(r);
    total.value = r?.data?.meta?.total || 0;
  } catch (e) {
    errorMessage.value = message(e, "Daftar tiket gagal dimuat.");
  } finally {
    loading.value = false;
  }
}
async function loadOption(path: string, key: string, term = "") {
  loadingOptions[key as keyof typeof loadingOptions] = true;
  try {
    const q = new URLSearchParams({ halaman: "1", batas: "20" });
    if (term.trim()) q.set("cari", term.trim());
    const r = await request<Row>(`${path}?${q}`);
    const results = unwrap(r);
    if (key === "printers") {
      const selectedUnits = options.printers.filter((unit) => form.printer_ids.includes(unit.id));
      options.printers = [...new Map([...selectedUnits, ...results].map((unit) => [unit.id, unit])).values()];
    } else if (key === "sales") {
      const selectedSales = options.sales.filter((user) => user.id === form.sales_id);
      options.sales = [...new Map([...selectedSales, ...results].map((user) => [user.id, user])).values()];
    } else options[key] = results;
  } catch (e) {
    errorMessage.value = message(e, "Pilihan data gagal dimuat.");
  } finally {
    loadingOptions[key as keyof typeof loadingOptions] = false;
  }
}
function openCreate() {
  clearNotice();
  selected.value = null;
  resetForm();
  createOpen.value = true;
}
async function openDetail(row: Row, tab: "detil" | "surat_tugas" = "detil") {
  clearNotice();
  try {
    const r = await request<Row>(`/tiket/${row.id}`);
    selected.value = r.data;
    detailTab.value = tab;
    Object.assign(form, {
      deskripsi: selected.value.deskripsi || "",
      customer_id: selected.value.customer_id || "",
      account_id: selected.value.account_id || "",
      sales_id: selected.value.sales_id || "",
      tanggal_transaksi: selected.value.tanggal_transaksi
        ? new Date(new Date(selected.value.tanggal_transaksi).getTime() - new Date(selected.value.tanggal_transaksi).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : "",
      printer_ids: (selected.value.tiket_printer || []).map((line: Row) => line.printer_id).filter(Boolean),
    });
    const selectedUnits = (selected.value.tiket_printer || []).map((line: Row) => line.master_printer).filter(Boolean);
    options.printers = [...new Map([...selectedUnits, ...options.printers].map((unit) => [unit.id, unit])).values()];
    if (selected.value.sales_id && selected.value.master_pengguna_sales && !options.sales.some((user) => user.id === selected.value.sales_id)) options.sales = [selected.value.master_pengguna_sales, ...options.sales];
    detailOpen.value = true;
  } catch (e) {
    errorMessage.value = message(e, "Detail tiket gagal dimuat.");
  }
}
function payload() {
  return {
    kategori: form.kategori,
    account_id: form.account_id || null,
    customer_id: form.customer_id || null,
    sales_id: form.sales_id || null,
    tanggal_transaksi: iso(form.tanggal_transaksi),
    deskripsi: form.deskripsi || null,
    printer: options.printers
      .filter((p) => form.printer_ids.includes(p.id))
      .map((p) => ({
        printer_id: p.id,
        mp_no: p.mp_no,
        model_id: p.model_id,
        serial_number: p.serial_number,
        peran: "utama",
      })),
    toner: [],
  };
}
async function save() {
  if (selected.value && !form.tanggal_transaksi) { errorMessage.value = "Tanggal Tiket wajib diisi."; return; }
  saving.value = true;
  clearNotice();
  try {
    if (selected.value)
      await request(`/tiket/${selected.value.id}`, {
        method: "PUT",
        body: { sales_id: form.sales_id || undefined, tanggal_transaksi: iso(form.tanggal_transaksi), deskripsi: form.deskripsi },
      });
    else await request("/tiket", { method: "POST", body: payload() });
    createOpen.value = false;
    detailOpen.value = false;
    successMessage.value = "Tiket berhasil disimpan.";
    await loadTickets();
  } catch (e) {
    errorMessage.value = message(e, "Tiket gagal disimpan.");
  } finally {
    saving.value = false;
  }
}
async function saveAndCreateSt() {
  saving.value = true;
  clearNotice();
  try {
    const response = await request<Row>("/tiket", {
      method: "POST",
      body: payload(),
    });
    const ticketId = response?.data?.id;
    if (!ticketId)
      throw new Error("Tiket berhasil dibuat tetapi ID tidak tersedia.");
    createOpen.value = false;
    stTicketId.value = ticketId;
    stModalOpen.value = true;
    await loadTickets();
  } catch (e) {
    errorMessage.value = message(e, "Tiket gagal disimpan.");
  } finally {
    saving.value = false;
  }
}
function createStFromDetail() {
  if (!selected.value?.id) return;
  detailOpen.value = false;
  stTicketId.value = selected.value.id;
  stModalOpen.value = true;
}
async function onStCreated() {
  const ticketId = stTicketId.value;
  stModalOpen.value = false;
  await loadTickets();
  await openDetail({ id: ticketId }, "surat_tugas");
}
async function action(kind: "resolve") {
  if (!selected.value) return;
  saving.value = true;
  clearNotice();
  try {
    await request(`/tiket/${selected.value.id}/${kind}`, {
      method: "POST",
      body: { ringkasan_penyelesaian: form.deskripsi || null },
    });
    detailOpen.value = false;
    successMessage.value = "Tiket ditutup.";
    await loadTickets();
  } catch (e) {
    errorMessage.value = message(e, "Workflow tiket gagal diproses.");
  } finally {
    saving.value = false;
  }
}
let timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
function debounce(key: string, fn: () => void) {
  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, 300);
}
watch([category, status, pageSize], () => {
  page.value = 1;
  loadTickets();
});
watch(search, () =>
  debounce("list", () => {
    page.value = 1;
    loadTickets();
  }),
);
watch(
  () => searches.customer,
  (value) =>
    debounce("customer", () =>
      loadOption("/account/lokasi-customer", "customers", value),
    ),
);
watch(
  () => searches.printer,
  (value) =>
    debounce("printer", () => loadOption("/printer", "printers", value)),
);
watch(
  () => searches.sales,
  (value) => debounce("sales", () => loadOption("/pengguna", "sales", value)),
);
onMounted(async () => {
  await Promise.all([
    loadTickets(),
    loadOption("/account/lokasi-customer", "customers"),
    loadOption("/printer", "printers"),
    loadOption("/pengguna", "sales"),
  ]);
});
</script>
<template>
  <div class="space-y-6">
    <UPageHeader
      title="Tiket"
      description="Kelola permintaan kerja dan kaitannya dengan Surat Tugas."
    /><UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    /><UAlert
      v-if="successMessage"
      color="success"
      variant="subtle"
      :title="successMessage"
    />
    <UCard
      ><div class="flex flex-wrap gap-3">
        <UInput
          v-model="search"
          placeholder="Cari nomor atau deskripsi"
          class="w-full lg:max-w-md"
        /><USelect
          v-model="category"
          :items="
            Object.entries(categories).map(([value, label]) => ({
              label,
              value,
            }))
          "
          placeholder="Semua kategori"
        /><USelect
          v-model="status"
          :items="statuses.map((value) => ({ label: value, value }))"
          placeholder="Semua status"
        /><UButton
          v-if="canCreate"
          class="ms-auto"
          icon="i-lucide-plus"
          label="Buat Tiket"
          @click="openCreate"
        /></div
    ></UCard>
    <UCard
      ><UTable
        :data="rows"
        :columns="[
          { accessorKey: 'nomor_tiket', header: 'No. Tiket' },
          { accessorKey: 'kategori', header: 'Kategori' },
          { accessorKey: 'master_customer', header: 'Customer' },
          { accessorKey: 'status', header: 'Status' },
          { id: 'actions', header: 'Aksi' },
        ]"
        :loading="loading"
        ><template #kategori-cell="{ row }">{{
          categories[row.original.kategori] || row.original.kategori
        }}</template
        ><template #master_customer-cell="{ row }">{{
          row.original.master_customer?.nama_customer || "—"
        }}</template
        ><template #actions-cell="{ row }"
          ><UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-pencil"
            aria-label="Edit Tiket"
            @click="openDetail(row.original)" /></template
        ><template #empty
          ><div class="py-10 text-center text-sm text-dimmed">
            {{ loading ? "Memuat data..." : "Belum ada tiket." }}
          </div></template
        ></UTable
      ><UPagination
        v-model:page="page"
        :page-count="pageSize"
        :total="total"
        class="mt-4 justify-end"
    /></UCard>
    <UModal
      v-model:open="createOpen"
      title="Buat Tiket"
      :ui="{ content: 'sm:max-w-3xl' }"
      ><template #body
        ><UForm :state="form" class="space-y-4" @submit="save"
          ><UFormField label="Kategori" required
            ><USelect
              v-model="form.kategori"
              :items="
                allowedCategories.map((value) => ({
                  label: categories[value],
                  value,
                }))
              "
              class="w-full"
          /></UFormField>
          <p class="text-sm text-dimmed">
            Jenis pekerjaan dipilih saat membuat Surat Tugas.
          </p>
          <UFormField v-if="customerRequired" label="Customer / Site" required
            ><USelectMenu
              v-model="form.customer_id"
              v-model:search-term="searches.customer"
              :items="
                options.customers.map((row) => ({
                  label: row.nama_customer || row.name,
                  value: row.id,
                }))
              "
              value-key="value"
              searchable
              ignore-filter
              :loading="loadingOptions.customer"
              class="w-full"
              @update:model-value="selectCustomer" /></UFormField
          ><UFormField
            v-if="['delivery', 'komplain'].includes(form.kategori)"
            label="Sales"
            required
            ><USelectMenu
              v-model="form.sales_id"
              v-model:search-term="searches.sales"
              :items="salesItems"
              value-key="value"
              searchable
              ignore-filter
              :loading="loadingOptions.sales"
              class="w-full" /></UFormField
          ><UFormField label="Tanggal Tiket" required
            ><UInput
              v-model="form.tanggal_transaksi"
              type="datetime-local"
              class="w-full" /></UFormField
          ><UFormField label="Unit Printer"
            ><USelectMenu
              v-model="form.printer_ids"
              v-model:search-term="searches.printer"
              :items="
                options.printers.map((row) => ({
                  label: `${row.mp_no} · ${row.master_printer_model?.nama_model || '-'}`,
                  value: row.id,
                }))
              "
              value-key="value"
              multiple
              searchable
              ignore-filter
              :loading="loadingOptions.printer"
              class="w-full" /></UFormField
          ><UFormField label="Deskripsi"
            ><UTextarea v-model="form.deskripsi" class="w-full"
          /></UFormField>
          <div class="grid gap-2 sm:grid-cols-2">
            <UButton type="submit" block :loading="saving">Simpan Tiket</UButton
            ><UButton
              type="button"
              block
              color="primary"
              variant="outline"
              :loading="saving"
              @click="saveAndCreateSt"
              >Buat Surat Tugas</UButton
            >
          </div></UForm
        ></template
      ></UModal
    >
    <UModal
      v-model:open="detailOpen"
      :title="selected?.nomor_tiket ? `Edit Tiket ${selected.nomor_tiket}` : 'Edit Tiket'"
      :ui="{ content: 'sm:max-w-3xl h-[80vh] max-h-[800px]', body: 'overflow-y-auto' }"
      ><template #body
        ><div v-if="selected" class="flex flex-col gap-4 sm:flex-row">
          <nav class="flex shrink-0 gap-2 sm:w-36 sm:flex-col" aria-label="Bagian Tiket">
            <UButton :variant="detailTab === 'detil' ? 'soft' : 'ghost'" color="neutral" class="justify-start" @click="detailTab = 'detil'">Detil</UButton>
            <UButton :variant="detailTab === 'surat_tugas' ? 'soft' : 'ghost'" color="neutral" class="justify-start" @click="detailTab = 'surat_tugas'">Surat Tugas ({{ selected.surat_tugas?.length || 0 }})</UButton>
          </nav>
          <div class="min-w-0 flex-1 space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge color="neutral" variant="subtle">{{
              selected.status
            }}</UBadge
            ><UBadge v-if="readyToClose" color="success" variant="subtle"
              >Siap ditinjau untuk penutupan</UBadge
            >
          </div>
          <div v-if="detailTab === 'detil'" class="space-y-4">
            <UFormField label="Kategori"><UInput :model-value="categories[selected.kategori] || selected.kategori" readonly class="w-full" /></UFormField>
            <UFormField label="Customer / Site"><UInput :model-value="selected.master_customer?.nama_customer || '—'" readonly class="w-full" /></UFormField>
            <UFormField label="Unit Printer"><UInput :model-value="selected.tiket_printer?.map((line: Row) => line.mp_no).join(', ') || '—'" readonly class="w-full" /></UFormField>
            <UFormField label="Tanggal Tiket"><UInput v-model="form.tanggal_transaksi" type="datetime-local" :readonly="!canEditSelected" class="w-full" /></UFormField>
            <UFormField label="Sales"><USelectMenu v-model="form.sales_id" v-model:search-term="searches.sales" :items="salesItems" value-key="value" searchable ignore-filter :loading="loadingOptions.sales" :disabled="!canEditSelected" class="w-full" /></UFormField>
            <UFormField label="Deskripsi"><UTextarea v-model="form.deskripsi" :readonly="!canEditSelected" class="w-full" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton v-if="canEditSelected" :loading="saving" @click="save">Simpan Perubahan</UButton>
              <UButton v-if="canCloseSelected" color="warning" @click="action('resolve')">Tutup Tiket</UButton>
            </div>
          </div>
          <div v-else class="space-y-4">
            <UTable :data="selected.surat_tugas || []" :columns="[{ accessorKey: 'nomor_surat_tugas', header: 'Nomor ST' }, { accessorKey: 'jenis_tugas', header: 'Jenis Tugas' }, { accessorKey: 'status', header: 'Status' }]" />
            <div class="flex justify-end">
            <UButton
              v-if="!['solved', 'cancelled'].includes(selected.status)"
              color="primary"
              variant="outline"
              @click="createStFromDetail"
              >Buat Surat Tugas</UButton
            >
            </div>
          </div>
          </div>
        </div></template
      ></UModal
    >
    <SuratTugasPage
      v-if="stModalOpen"
      embedded
      :ticket-id="stTicketId"
      @close="stModalOpen = false"
      @created="onStCreated"
    />
  </div>
</template>
