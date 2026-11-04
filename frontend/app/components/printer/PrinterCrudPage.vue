<script setup lang="ts">
type PrinterMode = "kategori" | "model" | "unit";
// API rows are intentionally open because the three endpoints return different shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const props = defineProps<{ mode: PrinterMode }>();
const { request, message } = useServiceApi();

const isUnit = computed(() => props.mode === "unit");
const title = computed(
  () =>
    ({
      kategori: "Kategori Printer",
      model: "Model Printer",
      unit: "Unit Printer",
    })[props.mode],
);
const description = computed(
  () =>
    ({
      kategori: "Kelola kategori printer yang digunakan pada setiap model.",
      model: "Kelola merek dan model printer berdasarkan kategori aktif.",
      unit: "Kelola unit printer, lokasi gudang, dan jadwal maintenance.",
    })[props.mode],
);
const endpoint = computed(
  () =>
    ({
      kategori: "/printer-kategori",
      model: "/printer-model",
      unit: "/printer",
    })[props.mode],
);

const rows = ref<Row[]>([]);
const categories = ref<Row[]>([]);
const models = ref<Row[]>([]);
const warehouses = ref<Row[]>([]);
const search = ref("");
const categoryFilter = ref<string>();
const modelFilter = ref<string>();
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const summary = ref({ available: 0, reserved: 0, issued: 0, installed: 0 });
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const modalOpen = ref(false);
const actionModalOpen = ref(false);
const editing = ref<Row | null>(null);
const action = ref<"transfer" | "withdraw" | "return">("transfer");
const actionRow = ref<Row | null>(null);
const actionTitle = computed(
  () =>
    `${action.value.charAt(0).toUpperCase()}${action.value.slice(1)} Unit Printer`,
);
const form = reactive<Row>({});
const actionForm = reactive({ gudang_id: "", alasan: "" });
const createCategoryValue = "__create_category__";
const categoryModalOpen = ref(false);
const categorySaving = ref(false);
const categoryError = ref("");
const categoryTarget = ref<"model" | "quickModel">("model");
const newCategory = reactive({ kode_kategori: "", nama_kategori: "" });
const createModelValue = "__create_model__";
const modelModalOpen = ref(false);
const modelSaving = ref(false);
const modelError = ref("");
const newModel = reactive({
  kategori_id: "",
  kode_model: "",
  merek: "",
  nama_model: "",
});
const createWarehouseValue = "__create_warehouse__";
const warehouseModalOpen = ref(false);
const warehouseSaving = ref(false);
const warehouseError = ref("");
const technicians = ref<Row[]>([]);
const newWarehouse = reactive({
  kode_gudang: "",
  nama_gudang: "",
  jenis_gudang: "utama",
  teknisi_id: "",
  alamat: "",
});
const warehouseTypeOptions = [
  { label: "Utama", value: "utama" },
  { label: "Cabang", value: "cabang" },
  { label: "Teknisi", value: "teknisi" },
];

const categoryOptions = computed(() =>
  categories.value.map((item) => ({
    label: `${item.kode_kategori} — ${item.nama_kategori}`,
    value: item.id,
  })),
);
const modelCategoryOptions = computed(() => [
  ...categoryOptions.value.filter((option) =>
    categories.value.some(
      (item) =>
        item.id === option.value &&
        (item.aktif || item.id === form.kategori_id),
    ),
  ),
  { label: "+ Buat Kategori", value: createCategoryValue },
]);
const modelCategorySelection = computed({
  get: () => form.kategori_id as string,
  set: (value: string) => {
    if (value === createCategoryValue) openCategoryCreate("model");
    else form.kategori_id = value;
  },
});
const activeCategoryOptions = computed(() =>
  categories.value
    .filter((item) => item.aktif)
    .map((item) => ({
      label: `${item.kode_kategori} — ${item.nama_kategori}`,
      value: item.id,
    })),
);
const quickModelCategoryOptions = computed(() => [
  ...activeCategoryOptions.value,
  { label: "+ Buat Kategori", value: createCategoryValue },
]);
const quickModelCategorySelection = computed({
  get: () => newModel.kategori_id,
  set: (value: string) => {
    if (value === createCategoryValue) openCategoryCreate("quickModel");
    else newModel.kategori_id = value;
  },
});
const modelOptions = computed(() =>
  models.value
    .filter(
      (item) => !form.kategori_id || item.kategori_id === form.kategori_id,
    )
    .map((item) => ({
      label: `${item.merek} — ${item.nama_model}`,
      value: item.id,
    })),
);
const unitModelOptions = computed(() => [
  ...modelOptions.value,
  { label: "+ Buat Model", value: createModelValue },
]);
const unitModelSelection = computed({
  get: () => form.model_id as string,
  set: (value: string) => {
    if (value === createModelValue) {
      Object.assign(newModel, {
        kategori_id: "",
        kode_model: "",
        merek: "",
        nama_model: "",
      });
      modelError.value = "";
      modelModalOpen.value = true;
    } else form.model_id = value;
  },
});
const filterModelOptions = computed(() =>
  models.value
    .filter(
      (item) =>
        !categoryFilter.value || item.kategori_id === categoryFilter.value,
    )
    .map((item) => ({
      label: `${item.merek} — ${item.nama_model}`,
      value: item.id,
    })),
);
const warehouseOptions = computed(() =>
  warehouses.value
    .filter((item) => item.aktif)
    .map((item) => ({
      label: `${item.kode_gudang} — ${item.nama_gudang}`,
      value: item.id,
    })),
);
const unitWarehouseOptions = computed(() => [
  ...warehouseOptions.value,
  { label: "+ Buat Gudang", value: createWarehouseValue },
]);
const unitWarehouseSelection = computed({
  get: () => form.gudang_id as string,
  set: (value: string) => {
    if (value === createWarehouseValue) openWarehouseCreate();
    else form.gudang_id = value;
  },
});
const technicianOptions = computed(() =>
  technicians.value
    .filter((item) => item.role === "teknisi" && item.active)
    .map((item) => ({
      label: `${item.user_id} — ${item.name}`,
      value: item.id,
    })),
);
const columns = computed(() => {
  if (props.mode === "kategori")
    return [
      { accessorKey: "kode_kategori", header: "Kode" },
      { accessorKey: "nama_kategori", header: "Kategori" },
      { accessorKey: "aktif", header: "Status" },
      { id: "actions", header: "Aksi" },
    ];
  if (props.mode === "model")
    return [
      { accessorKey: "kode_model", header: "Kode" },
      { accessorKey: "merek", header: "Merek" },
      { accessorKey: "nama_model", header: "Model" },
      { accessorKey: "kategori", header: "Kategori" },
      { accessorKey: "aktif", header: "Status" },
      { id: "actions", header: "Aksi" },
    ];
  return [
    { accessorKey: "mp_no", header: "MP No" },
    { accessorKey: "serial_number", header: "Serial Number" },
    { accessorKey: "model", header: "Model" },
    { accessorKey: "gudang", header: "Gudang" },
    { accessorKey: "status_operasional", header: "Status" },
    { id: "actions", header: "Aksi" },
  ];
});

function resetForm() {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
  if (props.mode === "kategori")
    Object.assign(form, { kode_kategori: "", nama_kategori: "", aktif: true });
  if (props.mode === "model")
    Object.assign(form, {
      kategori_id: "",
      kode_model: "",
      merek: "",
      nama_model: "",
      aktif: true,
    });
  if (props.mode === "unit")
    Object.assign(form, {
      mp_no: "",
      serial_number: "",
      model_id: "",
      gudang_id: "",
      tanggal_pembelian: "",
      tanggal_maintenance_berikutnya: "",
      interval_maintenance_bulan: null,
      keterangan: "",
    });
}

function openCreate() {
  editing.value = null;
  resetForm();
  categoryModalOpen.value = false;
  modelModalOpen.value = false;
  warehouseModalOpen.value = false;
  modalOpen.value = true;
}

function openEdit(row: Row) {
  editing.value = row;
  resetForm();
  categoryModalOpen.value = false;
  modelModalOpen.value = false;
  warehouseModalOpen.value = false;
  if (props.mode === "kategori")
    Object.assign(form, {
      kode_kategori: row.kode_kategori,
      nama_kategori: row.nama_kategori,
      aktif: row.aktif,
    });
  if (props.mode === "model")
    Object.assign(form, {
      kategori_id: row.kategori_id,
      kode_model: row.kode_model,
      merek: row.merek,
      nama_model: row.nama_model,
      aktif: row.aktif,
    });
  if (props.mode === "unit")
    Object.assign(form, {
      mp_no: row.mp_no,
      serial_number: row.serial_number || "",
      model_id: row.model_id,
      gudang_id: row.gudang_id,
      tanggal_pembelian: row.tanggal_pembelian?.slice?.(0, 10) || "",
      tanggal_maintenance_berikutnya:
        row.tanggal_maintenance_berikutnya?.slice?.(0, 10) || "",
      interval_maintenance_bulan: row.interval_maintenance_bulan,
      keterangan: row.keterangan || "",
    });
  modalOpen.value = true;
}

function openAction(row: Row, nextAction: "transfer" | "withdraw" | "return") {
  actionRow.value = row;
  action.value = nextAction;
  actionForm.gudang_id = nextAction === "return" ? "" : row.gudang_id || "";
  actionForm.alasan = "";
  actionModalOpen.value = true;
}

async function openCategoryCreate(target: "model" | "quickModel") {
  categoryTarget.value = target;
  Object.assign(newCategory, { kode_kategori: "", nama_kategori: "" });
  categoryError.value = "";
  if (target === "quickModel") {
    modelModalOpen.value = false;
    await nextTick();
  }
  categoryModalOpen.value = true;
}

async function openWarehouseCreate() {
  Object.assign(newWarehouse, {
    kode_gudang: "",
    nama_gudang: "",
    jenis_gudang: "utama",
    teknisi_id: "",
    alamat: "",
  });
  warehouseError.value = "";
  warehouseModalOpen.value = true;
  try {
    const response = await request<{ data: Row[] }>("/pengguna");
    technicians.value = response.data;
  } catch {
    technicians.value = [];
  }
}

async function loadLookups() {
  if (props.mode === "kategori") return;
  const [categoryResponse, modelResponse, warehouseResponse] =
    await Promise.all([
      request<{ data: { items: Row[] } }>(
        "/printer-kategori?halaman=1&batas=100",
      ),
      request<{ data: { items: Row[] } }>("/printer-model?halaman=1&batas=100"),
      request<{ data: { items: Row[] } }>("/gudang?halaman=1&batas=100"),
    ]);
  categories.value = categoryResponse.data.items;
  models.value = modelResponse.data.items;
  warehouses.value = warehouseResponse.data.items;
}

async function loadRows() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const params = new URLSearchParams({
      halaman: String(page.value),
      batas: String(pageSize.value),
    });
    if (search.value) params.set("cari", search.value);
    if (props.mode === "unit" && categoryFilter.value)
      params.set("kategori_id", categoryFilter.value);
    if (props.mode === "unit" && modelFilter.value)
      params.set("model_id", modelFilter.value);
    const response = await request<{
      data: { items: Row[]; meta: { total: number } };
    }>(`${endpoint.value}?${params}`);
    rows.value = response.data.items.map((row) => ({
      ...row,
      kategori:
        row.master_printer_kategori?.nama_kategori ||
        categories.value.find((item) => item.id === row.kategori_id)
          ?.nama_kategori ||
        "-",
      model: row.master_printer_model
        ? `${row.master_printer_model.merek} — ${row.master_printer_model.nama_model}`
        : models.value.find((item) => item.id === row.model_id)?.nama_model ||
          "-",
      gudang:
        row.master_gudang?.nama_gudang ||
        warehouses.value.find((item) => item.id === row.gudang_id)
          ?.nama_gudang ||
        "-",
    }));
    total.value = response.data.meta.total;
    if (props.mode === "unit") {
      const summaryResponse = await request<{ data: typeof summary.value }>(
        "/printer/summary",
      );
      summary.value = summaryResponse.data;
    }
  } catch (error) {
    errorMessage.value = message(error, "Data printer gagal dimuat.");
  } finally {
    loading.value = false;
  }
}

async function load() {
  try {
    await loadLookups();
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Data referensi gagal dimuat.");
  }
}

async function save() {
  if (props.mode === "model" && categoryModalOpen.value) return;
  if (
    props.mode === "unit" &&
    (modelModalOpen.value || warehouseModalOpen.value)
  )
    return;
  saving.value = true;
  errorMessage.value = "";
  try {
    const data = { ...form };
    if (props.mode === "unit" && data.interval_maintenance_bulan)
      data.interval_maintenance_bulan = Number(data.interval_maintenance_bulan);
    if (editing.value)
      await request(`${endpoint.value}/${editing.value.id}`, {
        method: "PUT",
        body: data,
      });
    else await request(endpoint.value, { method: "POST", body: data });
    modalOpen.value = false;
    successMessage.value = `${title.value} berhasil disimpan.`;
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, `${title.value} gagal disimpan.`);
  } finally {
    saving.value = false;
  }
}

async function createCategory() {
  if (categorySaving.value) return;
  if (!newCategory.kode_kategori.trim() || !newCategory.nama_kategori.trim()) {
    categoryError.value = "Lengkapi kode dan nama kategori.";
    return;
  }
  categorySaving.value = true;
  categoryError.value = "";
  try {
    const response = await request<{ data: Row }>("/printer-kategori", {
      method: "POST",
      body: {
        kode_kategori: newCategory.kode_kategori.trim(),
        nama_kategori: newCategory.nama_kategori.trim(),
        aktif: true,
      },
    });
    categories.value.push(response.data);
    if (categoryTarget.value === "quickModel")
      newModel.kategori_id = response.data.id;
    else form.kategori_id = response.data.id;
    categoryModalOpen.value = false;
    successMessage.value = "Kategori printer berhasil dibuat dan dipilih.";
  } catch (error) {
    categoryError.value = message(error, "Kategori printer gagal dibuat.");
  } finally {
    categorySaving.value = false;
  }
}

async function createModel() {
  if (modelSaving.value || categoryModalOpen.value) return;
  if (
    !newModel.kategori_id ||
    !newModel.kode_model.trim() ||
    !newModel.merek.trim() ||
    !newModel.nama_model.trim()
  ) {
    modelError.value = "Lengkapi kategori, kode model, merek, dan nama model.";
    return;
  }
  modelSaving.value = true;
  modelError.value = "";
  try {
    const response = await request<{ data: Row }>("/printer-model", {
      method: "POST",
      body: {
        kategori_id: newModel.kategori_id,
        kode_model: newModel.kode_model.trim(),
        merek: newModel.merek.trim(),
        nama_model: newModel.nama_model.trim(),
        aktif: true,
      },
    });
    models.value.push(response.data);
    form.model_id = response.data.id;
    modelModalOpen.value = false;
    successMessage.value = "Model printer berhasil dibuat dan dipilih.";
  } catch (error) {
    modelError.value = message(error, "Model printer gagal dibuat.");
  } finally {
    modelSaving.value = false;
  }
}

async function createWarehouse() {
  if (warehouseSaving.value) return;
  if (
    !newWarehouse.kode_gudang.trim() ||
    !newWarehouse.nama_gudang.trim() ||
    (newWarehouse.jenis_gudang === "teknisi" && !newWarehouse.teknisi_id)
  ) {
    warehouseError.value =
      "Lengkapi kode, nama, dan teknisi jika jenis gudang adalah Teknisi.";
    return;
  }
  warehouseSaving.value = true;
  warehouseError.value = "";
  try {
    const response = await request<{ data: Row }>("/gudang", {
      method: "POST",
      body: {
        kode_gudang: newWarehouse.kode_gudang.trim(),
        nama_gudang: newWarehouse.nama_gudang.trim(),
        jenis_gudang: newWarehouse.jenis_gudang,
        teknisi_id:
          newWarehouse.jenis_gudang === "teknisi"
            ? newWarehouse.teknisi_id
            : null,
        alamat: newWarehouse.alamat.trim() || null,
        aktif: true,
      },
    });
    warehouses.value.push(response.data);
    form.gudang_id = response.data.id;
    warehouseModalOpen.value = false;
    successMessage.value = "Gudang berhasil dibuat dan dipilih.";
  } catch (error) {
    warehouseError.value = message(error, "Gudang gagal dibuat.");
  } finally {
    warehouseSaving.value = false;
  }
}

async function deactivate(row: Row) {
  if (
    !window.confirm(
      `Nonaktifkan ${row.nama_kategori || row.nama_model || row.mp_no}?`,
    )
  )
    return;
  try {
    await request(`${endpoint.value}/${row.id}`, { method: "DELETE" });
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Data gagal dinonaktifkan.");
  }
}

async function hardDelete(row: Row) {
  if (!window.confirm("Hapus data secara permanen?")) return;
  try {
    await request(`${endpoint.value}/${row.id}/permanent`, {
      method: "DELETE",
    });
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Data gagal dihapus permanen.");
  }
}

async function submitAction() {
  if (!actionRow.value) return;
  saving.value = true;
  try {
    await request(`/printer/${actionRow.value.id}/${action.value}`, {
      method: "POST",
      body: {
        gudang_id: actionForm.gudang_id || undefined,
        alasan: actionForm.alasan,
      },
    });
    actionModalOpen.value = false;
    successMessage.value = "Aksi printer berhasil diproses.";
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Aksi printer gagal diproses.");
  } finally {
    saving.value = false;
  }
}

watch([search, categoryFilter, modelFilter, pageSize], () => {
  page.value = 1;
  loadRows();
});
watch(page, loadRows);
watch(categoryModalOpen, async (open) => {
  if (!open && categoryTarget.value === "quickModel" && modalOpen.value) {
    await nextTick();
    modelModalOpen.value = true;
  }
});
onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <UPageHeader :title="title" :description="description" />

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

    <div v-if="isUnit" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard
        v-for="item in [
          { key: 'available', label: 'Available' },
          { key: 'reserved', label: 'Reserved' },
          { key: 'issued', label: 'Issued' },
          { key: 'installed', label: 'Installed' },
        ]"
        :key="item.key"
      >
        <p class="text-sm text-dimmed">
          {{ item.label }}
        </p>
        <p class="mt-2 text-2xl font-semibold text-highlighted">
          {{ summary[item.key as keyof typeof summary] }}
        </p>
      </UCard>
    </div>

    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari data"
          class="lg:max-w-sm"
          @keyup.enter="loadRows"
        />
        <USelect
          v-if="isUnit"
          v-model="categoryFilter"
          :items="categoryOptions"
          placeholder="Semua kategori"
          class="lg:w-64"
        />
        <USelect
          v-if="isUnit"
          v-model="modelFilter"
          :items="filterModelOptions"
          placeholder="Semua model"
          class="lg:w-64"
        />
        <div class="flex items-center gap-2 lg:ms-auto">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            aria-label="Refresh data"
            :loading="loading"
            @click="load"
          />
          <UButton icon="i-lucide-plus" label="Buat" @click="openCreate" />
        </div>
      </div>
    </UCard>

    <UCard>
      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #aktif-cell="{ row }">
          <UBadge
            :color="row.original.aktif ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ row.original.aktif ? "Aktif" : "Nonaktif" }}
          </UBadge>
        </template>
        <template #status_operasional-cell="{ row }">
          <UBadge color="info" variant="subtle">
            {{ row.original.status_operasional || row.original.status }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit"
              @click="openEdit(row.original)"
            />
            <template v-if="isUnit">
              <UButton
                size="xs"
                color="primary"
                variant="ghost"
                label="Transfer"
                @click="openAction(row.original, 'transfer')"
              />
              <UButton
                size="xs"
                color="warning"
                variant="ghost"
                label="Withdraw"
                @click="openAction(row.original, 'withdraw')"
              />
              <UButton
                size="xs"
                color="success"
                variant="ghost"
                label="Return"
                @click="openAction(row.original, 'return')"
              />
            </template>
            <template v-else>
              <UButton
                size="xs"
                color="warning"
                variant="ghost"
                icon="i-lucide-power"
                aria-label="Nonaktifkan"
                @click="deactivate(row.original)"
              />
            </template>
          </div>
        </template>
      </UTable>
      <div class="mt-4 flex justify-end">
        <UPagination
          v-model:page="page"
          :page-count="pageSize"
          :total="total"
        />
      </div>
    </UCard>

    <UModal
      v-model:open="modalOpen"
      :title="editing ? `Edit ${title}` : `Tambah ${title}`"
    >
      <template #body>
        <UForm :state="form" class="space-y-4" @submit="save">
          <UFormField
            v-if="mode === 'kategori'"
            label="Kode Kategori"
            name="kode_kategori"
            required
          >
            <UInput v-model="form.kode_kategori" />
          </UFormField>
          <UFormField
            v-if="mode === 'kategori'"
            label="Nama Kategori"
            name="nama_kategori"
            required
          >
            <UInput v-model="form.nama_kategori" />
          </UFormField>
          <UFormField
            v-if="mode === 'model'"
            label="Kategori"
            name="kategori_id"
            required
          >
            <USelect
              v-model="modelCategorySelection"
              :items="modelCategoryOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="mode === 'model'"
            label="Kode Model"
            name="kode_model"
            required
          >
            <UInput v-model="form.kode_model" />
          </UFormField>
          <UFormField
            v-if="mode === 'model'"
            label="Merek"
            name="merek"
            required
          >
            <UInput v-model="form.merek" />
          </UFormField>
          <UFormField
            v-if="mode === 'model'"
            label="Nama Model"
            name="nama_model"
            required
          >
            <UInput v-model="form.nama_model" />
          </UFormField>
          <template v-if="mode === 'unit'">
            <UFormField label="MP No" name="mp_no" required>
              <UInput v-model="form.mp_no" />
            </UFormField>
            <UFormField label="Serial Number" name="serial_number">
              <UInput v-model="form.serial_number" />
            </UFormField>
            <UFormField label="Model" name="model_id" required>
              <USelect
                v-model="unitModelSelection"
                :items="unitModelOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Gudang Awal" name="gudang_id" required>
              <USelect
                v-model="unitWarehouseSelection"
                :items="unitWarehouseOptions"
                class="w-full"
              />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Tanggal Pembelian">
                <UInput
                  v-model="form.tanggal_pembelian"
                  type="date"
                /> </UFormField
              ><UFormField label="Maintenance Berikutnya">
                <UInput
                  v-model="form.tanggal_maintenance_berikutnya"
                  type="date"
                />
              </UFormField>
            </div>
            <UFormField label="Interval Maintenance (Bulan)">
              <UInput
                v-model="form.interval_maintenance_bulan"
                type="number"
                min="1"
                max="120"
              />
            </UFormField>
            <UFormField label="Keterangan">
              <UTextarea v-model="form.keterangan" class="w-full" />
            </UFormField>
          </template>
          <UCheckbox
            v-if="mode !== 'unit'"
            v-model="form.aktif"
            label="Aktif"
          />
          <UButton
            type="submit"
            block
            :loading="saving"
            :disabled="
              (mode === 'model' && categoryModalOpen) ||
              (mode === 'unit' && (modelModalOpen || warehouseModalOpen))
            "
          >
            Simpan
          </UButton>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="modelModalOpen" title="Buat Model Printer">
      <template #body>
        <UForm :state="newModel" class="space-y-4" @submit="createModel">
          <UAlert
            v-if="modelError"
            color="error"
            variant="subtle"
            :title="modelError"
          />
          <UFormField label="Kategori" name="kategori_id" required>
            <USelect
              v-model="quickModelCategorySelection"
              :items="quickModelCategoryOptions"
              placeholder="Pilih kategori"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kode Model" name="kode_model" required>
            <UInput v-model="newModel.kode_model" class="w-full" />
          </UFormField>
          <UFormField label="Merek" name="merek" required>
            <UInput v-model="newModel.merek" class="w-full" />
          </UFormField>
          <UFormField label="Nama Model" name="nama_model" required>
            <UInput v-model="newModel.nama_model" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="modelModalOpen = false"
              >Batal</UButton
            >
            <UButton
              type="submit"
              :loading="modelSaving"
              :disabled="categoryModalOpen"
              >Simpan Model</UButton
            >
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="categoryModalOpen" title="Buat Kategori Printer">
      <template #body>
        <UForm :state="newCategory" class="space-y-4" @submit="createCategory">
          <UAlert
            v-if="categoryError"
            color="error"
            variant="subtle"
            :title="categoryError"
          />
          <UFormField label="Kode Kategori" name="kode_kategori" required>
            <UInput v-model="newCategory.kode_kategori" class="w-full" />
          </UFormField>
          <UFormField label="Nama Kategori" name="nama_kategori" required>
            <UInput v-model="newCategory.nama_kategori" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="categoryModalOpen = false"
              >Batal</UButton
            >
            <UButton type="submit" :loading="categorySaving"
              >Simpan Kategori</UButton
            >
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="warehouseModalOpen" title="Buat Gudang">
      <template #body>
        <UForm
          :state="newWarehouse"
          class="space-y-4"
          @submit="createWarehouse"
        >
          <UAlert
            v-if="warehouseError"
            color="error"
            variant="subtle"
            :title="warehouseError"
          />
          <UFormField label="Kode Gudang" name="kode_gudang" required>
            <UInput v-model="newWarehouse.kode_gudang" class="w-full" />
          </UFormField>
          <UFormField label="Nama Gudang" name="nama_gudang" required>
            <UInput v-model="newWarehouse.nama_gudang" class="w-full" />
          </UFormField>
          <UFormField label="Jenis Gudang" name="jenis_gudang" required>
            <USelect
              v-model="newWarehouse.jenis_gudang"
              :items="warehouseTypeOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="newWarehouse.jenis_gudang === 'teknisi'"
            label="Teknisi"
            name="teknisi_id"
            required
          >
            <USelect
              v-model="newWarehouse.teknisi_id"
              :items="technicianOptions"
              placeholder="Pilih teknisi"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Alamat" name="alamat">
            <UTextarea v-model="newWarehouse.alamat" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="warehouseModalOpen = false"
              >Batal</UButton
            >
            <UButton type="submit" :loading="warehouseSaving"
              >Simpan Gudang</UButton
            >
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="actionModalOpen" :title="actionTitle">
      <template #body>
        <UForm :state="actionForm" class="space-y-4" @submit="submitAction">
          <UFormField
            v-if="action !== 'withdraw'"
            label="Gudang"
            name="gudang_id"
            :required="action !== 'return'"
          >
            <USelect
              v-model="actionForm.gudang_id"
              :items="warehouseOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Alasan" name="alasan" required>
            <UTextarea v-model="actionForm.alasan" class="w-full" />
          </UFormField>
          <UButton type="submit" block :loading="saving"> Proses </UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
