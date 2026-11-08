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
const stEditingId = ref("");
const stError = ref("");
const detailTab = ref<"detil" | "surat_tugas">("detil");
const createTab = ref<"detil" | "surat_tugas">("detil");
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
const ownerError = ref("");
let ownerSearchRequest = 0;
const form = reactive({
  kategori: "",
  account_id: "",
  customer_id: "",
  owner: "",
  tanggal_transaksi: "",
  deskripsi: "",
  new_mp_no: "",
  printer_ids: [] as string[],
});
const selectedPrinterId = computed({
  get: () => form.printer_ids[0] || "",
  set: (id: string) => { form.printer_ids = id ? [id] : []; },
});
const ownerItems = computed(() =>
  options.sales
    .filter(
      (row) =>
        (row.aktif !== false && row.active !== false) || row.id === form.owner,
    )
    .map((row) => ({
      label: row.nama_lengkap || row.name || row.nama || row.user_id,
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
const showUnitPrinter = computed(() => !["delivery", "inbound"].includes(form.kategori));
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
    owner: "",
    tanggal_transaksi: dateTimeLocal(),
    deskripsi: "",
    new_mp_no: "",
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
  const requestId = key === "sales" ? ++ownerSearchRequest : 0;
  if (key === "sales") ownerError.value = "";
  loadingOptions[key as keyof typeof loadingOptions] = true;
  try {
    const q = new URLSearchParams({ halaman: "1", batas: "20" });
    if (term.trim()) q.set("cari", term.trim());
    const r = await request<Row>(`${path}?${q}`);
    if (key === "sales" && requestId !== ownerSearchRequest) return;
    const results = unwrap(r);
    if (key === "printers") {
      const selectedUnits = options.printers.filter((unit) => form.printer_ids.includes(unit.id));
      options.printers = [...new Map([...selectedUnits, ...results].map((unit) => [unit.id, unit])).values()];
    } else if (key === "sales") {
      const selectedOwner = options.sales.filter((user) => user.id === form.owner);
      options.sales = [...new Map([...selectedOwner, ...results].map((user) => [user.id, user])).values()];
    } else options[key] = results;
  } catch (e) {
    if (key === "sales") {
      if (requestId === ownerSearchRequest) ownerError.value = message(e, "Pilihan Owner gagal dimuat.");
    } else errorMessage.value = message(e, "Pilihan data gagal dimuat.");
  } finally {
    if (key !== "sales" || requestId === ownerSearchRequest) loadingOptions[key as keyof typeof loadingOptions] = false;
  }
}
function openCreate() {
  clearNotice();
  selected.value = null;
  resetForm();
  createTab.value = "detil";
  createOpen.value = true;
}
async function openDetail(row: Row, tab: "detil" | "surat_tugas" = "detil") {
  clearNotice();
  stError.value = "";
  try {
    const r = await request<Row>(`/tiket/${row.id}`);
    selected.value = r.data;
    detailTab.value = tab;
    Object.assign(form, {
      deskripsi: selected.value.deskripsi || "",
      customer_id: selected.value.customer_id || "",
      account_id: selected.value.account_id || "",
    owner: selected.value.owner || selected.value.sales_id || "",
      tanggal_transaksi: selected.value.tanggal_transaksi
        ? new Date(new Date(selected.value.tanggal_transaksi).getTime() - new Date(selected.value.tanggal_transaksi).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : "",
      printer_ids: [],
    });
    if (form.owner && !options.sales.some((user) => user.id === form.owner)) {
      try {
        const ownerResponse = await request<Row>(`/pengguna/${form.owner}`);
        options.sales = [ownerResponse.data, ...options.sales];
      } catch {
        // Detail tiket tetap dapat dibuka jika profil Owner tidak tersedia.
      }
    }
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
    owner: form.owner || null,
    tanggal_transaksi: iso(form.tanggal_transaksi),
    deskripsi: form.deskripsi || null,
    mp_no: form.kategori === "inbound"
      ? form.new_mp_no.trim() || null
      : showUnitPrinter.value
        ? options.printers?.find((p) => p.id === selectedPrinterId.value)?.mp_no || null
        : null,
  };
}
async function save() {
  if (selected.value && !form.tanggal_transaksi) { errorMessage.value = "Tanggal Tiket wajib diisi."; return; }
  if (!selected.value && form.kategori === "inbound" && !form.new_mp_no.trim()) { errorMessage.value = "MP No objek wajib diisi."; return; }
  saving.value = true;
  clearNotice();
  try {
    if (selected.value)
      await request(`/tiket/${selected.value.id}`, {
        method: "PUT",
        body: { owner: form.owner || undefined, tanggal_transaksi: iso(form.tanggal_transaksi), deskripsi: form.deskripsi },
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
  if (form.kategori === "inbound" && !form.new_mp_no.trim()) { errorMessage.value = "MP No objek wajib diisi."; return; }
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
    stEditingId.value = "";
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
  stError.value = "";
  detailOpen.value = false;
  stTicketId.value = selected.value.id;
  stEditingId.value = "";
  stModalOpen.value = true;
}
function openStFromTicket(row: Row) {
  if (!selected.value?.id || !row.id) return;
  stError.value = "";
  stTicketId.value = selected.value.id;
  stEditingId.value = row.id;
  detailOpen.value = false;
  stModalOpen.value = true;
}
async function onStClosed() {
  if (!stModalOpen.value) return;
  stModalOpen.value = false;
  if (selected.value?.id) await openDetail({ id: selected.value.id }, "surat_tugas");
}
async function onStFailed(error: string) {
  stModalOpen.value = false;
  if (selected.value?.id) await openDetail({ id: selected.value.id }, "surat_tugas");
  stError.value = error;
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
watch(
  () => form.kategori,
  (value) => {
    if (!showUnitPrinter.value) form.printer_ids = [];
    if (value !== "inbound") form.new_mp_no = "";
  },
);
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
    <UCard
      >
      <div class="flex flex-wrap gap-3">
        <UInput
          v-model="search"
          placeholder="Cari nomor atau deskripsi"
          class="w-full lg:max-w-md"
        />
        <USelect
          v-model="category"
          :items="
            Object.entries(categories).map(([value, label]) => ({
              label,
              value,
            }))
          "
          placeholder="Semua kategori"
        />
        <USelect
          v-model="status"
          :items="statuses.map((value) => ({ label: value, value }))"
          placeholder="Semua status"
        />
        <UButton
          v-if="canCreate"
          class="ms-auto"
          icon="i-lucide-plus"
          label="Buat Tiket"
          @click="openCreate"
        />
      </div>
    </UCard>
    <UCard
      >
      <UTable
        :data="rows"
        :columns="[
          { accessorKey: 'id', header: 'No. Tiket' },
          { accessorKey: 'kategori', header: 'Kategori' },
          { accessorKey: 'master_customer', header: 'Customer' },
          { accessorKey: 'status', header: 'Status' },
          { id: 'actions', header: 'Aksi' },
        ]"
        :loading="loading"
        >
        <template #kategori-cell="{ row }">{{
          categories[row.original.kategori] || row.original.kategori
        }}</template>
        <template #master_customer-cell="{ row }">{{
          row.original.master_customer?.nama_customer || "—"
        }}</template>
        <template
          #actions-cell="{ row }"
        >
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-pencil"
            aria-label="Edit Tiket"
            @click="openDetail(row.original)"
          />
        </template>
        <template
          #empty
        >
          <div class="py-10 text-center text-sm text-dimmed">
            {{ loading ? "Memuat data..." : "Belum ada tiket." }}
          </div>
        </template>
      </UTable>
      <UPagination
        v-model:page="page"
        :page-count="pageSize"
        :total="total"
        class="mt-4 justify-end"
      />
    </UCard>
    <UModal
      v-model:open="createOpen"
      title="Buat Tiket"
      :ui="{ content: 'sm:max-w-3xl h-[80vh] max-h-[800px]', body: 'overflow-y-auto' }"
    >
      <template
        #body
      >
        <div class="flex flex-col gap-4 sm:flex-row">
          <nav
            class="flex shrink-0 gap-2 sm:w-36 sm:flex-col"
            aria-label="Bagian Tiket"
          >
            <UButton
              :variant="createTab === 'detil' ? 'soft' : 'ghost'"
              color="neutral"
              class="justify-start"
              @click="createTab = 'detil'"
            >
              Detil
            </UButton>
            <UButton
              :variant="createTab === 'surat_tugas' ? 'soft' : 'ghost'"
              color="neutral"
              class="justify-start"
              @click="createTab = 'surat_tugas'"
            >
              Surat Tugas
            </UButton>
          </nav>
          <div class="min-w-0 flex-1">
          <UForm
            v-if="createTab === 'detil'"
            :state="form"
            class="space-y-4"
            @submit="save"
          >
              <UFormField
                label="Kategori"
                required
              >
                <USelect
              v-model="form.kategori"
              :items="
                allowedCategories.map((value) => ({
                  label: categories[value],
                  value,
                }))
              "
              class="w-full"
          />
              </UFormField>
          <p class="text-sm text-dimmed">
            Jenis pekerjaan dipilih saat membuat Surat Tugas.
          </p>
          <UFormField
            v-if="customerRequired"
            label="Customer / Site"
            required
          >
                <USelectMenu
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
              @update:model-value="selectCustomer" />
          </UFormField>
              <UFormField
                v-if="form.kategori === 'inbound'"
                label="MP No objek"
                required
              >
                <UInput v-model="form.new_mp_no" class="w-full" />
              </UFormField>
              <UFormField
                v-else-if="showUnitPrinter"
                label="Unit Printer"
              >
                <USelectMenu
              v-model="selectedPrinterId"
              v-model:search-term="searches.printer"
              :items="
                options.printers.map((row) => ({
                  label: `${row.mp_no} · ${row.master_printer_model?.nama_model || '-'}`,
                  value: row.id,
                }))
              "
              value-key="value"
              searchable
              ignore-filter
              :loading="loadingOptions.printer"
              class="w-full" />
              </UFormField>
              <UFormField
                label="Tanggal Tiket"
                required
              >
                <UInput
                  v-model="form.tanggal_transaksi"
                  type="datetime-local"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Owner"
                :required="['delivery', 'komplain'].includes(form.kategori)"
              >
                <USelectMenu
                  v-model="form.owner"
                  v-model:search-term="searches.sales"
                  :items="ownerItems"
                  value-key="value"
                  searchable
                  ignore-filter
                  :loading="loadingOptions.sales"
                  :search-input="{ placeholder: 'Cari nama atau ID user' }"
                  class="w-full"
                />
            <p
              v-if="ownerError"
              class="text-sm text-error"
            >
              {{ ownerError }}
            </p>
            <p
              v-else-if="!loadingOptions.sales && !ownerItems.length"
              class="text-sm text-dimmed"
            >
              User aktif tidak ditemukan.
            </p>
          </UFormField>
              <UFormField
                label="Deskripsi"
              >
                <UTextarea
                  v-model="form.deskripsi"
                  class="w-full"
                />
              </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              :loading="saving"
            >
              Simpan Tiket
            </UButton>
          </div>
          </UForm>
          <div
            v-else
            class="space-y-4"
          >
            <p class="text-sm text-dimmed">Isi data pada tab Detil terlebih dahulu. Tiket akan disimpan sebelum form Surat Tugas dibuka.</p>
            <div class="flex justify-end">
              <UButton
                color="primary"
                variant="outline"
                :loading="saving"
                @click="saveAndCreateSt"
              >
                Buat Surat Tugas
              </UButton>
            </div>
          </div>
          </div>
        </div>
      </template>
    </UModal>
    <UModal
      v-model:open="detailOpen"
      :title="selected?.nomor_tiket ? `Edit Tiket ${selected.nomor_tiket}` : 'Edit Tiket'"
      :ui="{ content: 'sm:max-w-3xl h-[80vh] max-h-[800px]', body: 'overflow-y-auto' }"
    >
      <template
        #body
      >
        <div
          v-if="selected"
          class="flex flex-col gap-4 sm:flex-row"
        >
          <nav
            class="flex shrink-0 gap-2 sm:w-36 sm:flex-col"
            aria-label="Bagian Tiket"
          >
            <UButton
              :variant="detailTab === 'detil' ? 'soft' : 'ghost'"
              color="neutral"
              class="justify-start"
              @click="detailTab = 'detil'"
            >
              Detil
            </UButton>
            <UButton
              :variant="detailTab === 'surat_tugas' ? 'soft' : 'ghost'"
              color="neutral"
              class="justify-start"
              @click="detailTab = 'surat_tugas'"
            >
              Surat Tugas ({{ selected.surat_tugas?.length || 0 }})
            </UButton>
          </nav>
          <div class="min-w-0 flex-1 space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge
              color="neutral"
              variant="subtle"
            >{{
              selected.status
            }}</UBadge>
              <UBadge
                v-if="readyToClose"
                color="success"
                variant="subtle"
              >
                Siap ditinjau untuk penutupan
              </UBadge>
          </div>
          <div
            v-if="detailTab === 'detil'"
            class="space-y-4"
          >
            <UFormField label="Kategori">
                <UInput
                  :model-value="categories[selected.kategori] || selected.kategori"
                  readonly
                  class="w-full"
                />
            </UFormField>
            <UFormField label="Customer / Site">
                <UInput
                  :model-value="selected.master_customer?.nama_customer || '—'"
                  readonly
                  class="w-full"
                />
            </UFormField>
            <UFormField
              v-if="selected.mp_no"
              label="Unit Printer"
            >
                <UInput
                  :model-value="selected.mp_no || '—'"
                  readonly
                  class="w-full"
                />
            </UFormField>
            <UFormField label="Tanggal Tiket">
                <UInput
                  v-model="form.tanggal_transaksi"
                  type="datetime-local"
                  :readonly="!canEditSelected"
                  class="w-full"
                />
            </UFormField>
            <UFormField label="Owner">
                <USelectMenu
                  v-model="form.owner"
                  v-model:search-term="searches.sales"
                  :items="ownerItems"
                  value-key="value"
                  searchable
                  ignore-filter
                  :loading="loadingOptions.sales"
                  :disabled="!canEditSelected"
                  :search-input="{ placeholder: 'Cari nama atau ID user' }"
                  class="w-full"
                />
                <p
                  v-if="ownerError"
                  class="text-sm text-error"
                >
                  {{ ownerError }}
                </p>
                <p
                  v-else-if="!loadingOptions.sales && !ownerItems.length"
                  class="text-sm text-dimmed"
                >
                  User aktif tidak ditemukan.
                </p>
            </UFormField>
            <UFormField label="Deskripsi">
                <UTextarea
                  v-model="form.deskripsi"
                  :readonly="!canEditSelected"
                  class="w-full"
                />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton
                v-if="canEditSelected"
                :loading="saving"
                @click="save"
              >
                Simpan Perubahan
              </UButton>
              <UButton
                v-if="canCloseSelected"
                color="warning"
                @click="action('resolve')"
              >
                Tutup Tiket
              </UButton>
            </div>
          </div>
          <div
            v-else
            class="space-y-4"
          >
            <UAlert
              v-if="stError"
              color="error"
              variant="subtle"
              :title="stError"
            />
            <UTable
              :data="selected.surat_tugas || []"
              :columns="[{ accessorKey: 'nomor_surat_tugas', header: 'Nomor ST' }, { accessorKey: 'jenis_tugas', header: 'Jenis Tugas' }, { accessorKey: 'status', header: 'Status' }]"
            >
              <template #nomor_surat_tugas-cell="{ row }">
                  <UButton
                    type="button"
                    color="primary"
                    variant="link"
                    class="p-0"
                    :aria-label="`Buka Surat Tugas ${row.original.nomor_surat_tugas}`"
                    @click="openStFromTicket(row.original)"
                  >
                    {{ row.original.nomor_surat_tugas }}
                  </UButton>
              </template>
              <template #empty>
                  <div class="py-8 text-center text-sm text-dimmed">Belum ada Surat Tugas.</div>
              </template>
            </UTable>
            <div class="flex justify-end">
            <UButton
              v-if="!['solved', 'cancelled'].includes(selected.status)"
              color="primary"
              variant="outline"
              @click="createStFromDetail"
            >
              Buat Surat Tugas
            </UButton>
            </div>
          </div>
          </div>
        </div>
      </template>
    </UModal>
    <SuratTugasPage
      v-if="stModalOpen"
      embedded
      :ticket-id="stTicketId"
      :surat-tugas-id="stEditingId"
      @close="onStClosed"
      @failed="onStFailed"
      @created="onStCreated"
    />
  </div>
</template>
