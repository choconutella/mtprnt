<script setup lang="ts">
// The warehouse API returns master data fields that are shared with printer and stock flows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const { request, message } = useServiceApi();
const auth = useAuth();

const rows = ref<Row[]>([]);
const technicians = ref<Row[]>([]);
const search = ref("");
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const modalOpen = ref(false);
const editing = ref<Row | null>(null);
const form = reactive<Row>({});

const canWrite = computed(
  () => auth.isAdmin.value || auth.user.value?.role === "warehouse",
);
const title = "Master Gudang";
const description = "Kelola gudang utama, cabang, dan gudang teknisi.";
const jenisOptions = [
  { label: "Utama", value: "utama" },
  { label: "Cabang", value: "cabang" },
  { label: "Teknisi", value: "teknisi" },
];
const technicianOptions = computed(() =>
  technicians.value
    .filter((item) => item.active || item.id === form.teknisi_id)
    .map((item) => ({
      label: `${item.user_id} — ${item.name || item.nama}`,
      value: item.id,
    })),
);
const columns = [
  { accessorKey: "kode_gudang", header: "Kode" },
  { accessorKey: "nama_gudang", header: "Nama" },
  { accessorKey: "jenis_gudang", header: "Jenis" },
  { accessorKey: "alamat", header: "Alamat" },
  { accessorKey: "aktif", header: "Status" },
  { id: "actions", header: "Aksi" },
];

function resetForm() {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
  Object.assign(form, {
    kode_gudang: "",
    nama_gudang: "",
    jenis_gudang: "utama",
    teknisi_id: undefined,
    alamat: "",
    aktif: true,
  });
}

function openCreate() {
  editing.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEdit(row: Row) {
  editing.value = row;
  Object.assign(form, {
    kode_gudang: row.kode_gudang,
    nama_gudang: row.nama_gudang,
    jenis_gudang: row.jenis_gudang,
    teknisi_id: row.teknisi_id || undefined,
    alamat: row.alamat || "",
    aktif: row.aktif,
  });
  modalOpen.value = true;
}

async function loadTechnicians() {
  const response = await request<{ data: Row[] }>("/pengguna");
  technicians.value = response.data.filter((item) => item.role === "teknisi");
}

async function loadRows() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const params = new URLSearchParams({
      halaman: String(page.value),
      batas: String(pageSize.value),
    });
    if (search.value.trim()) params.set("cari", search.value.trim());
    const response = await request<{
      data: { items: Row[]; meta: { total: number } };
    }>(`/gudang?${params}`);
    rows.value = response.data.items;
    total.value = response.data.meta.total;
  } catch (error) {
    errorMessage.value = message(error, "Data gudang gagal dimuat.");
  } finally {
    loading.value = false;
  }
}

async function load() {
  await loadRows();
  try {
    await loadTechnicians();
  } catch {
    // The existing /pengguna read policy may hide technician options for some roles.
    technicians.value = [];
  }
}

async function save() {
  if (!canWrite.value) return;
  saving.value = true;
  errorMessage.value = "";
  try {
    const data = { ...form };
    if (data.jenis_gudang !== "teknisi") data.teknisi_id = null;
    if (editing.value)
      await request(`/gudang/${editing.value.id}`, {
        method: "PUT",
        body: data,
      });
    else await request("/gudang", { method: "POST", body: data });
    modalOpen.value = false;
    successMessage.value = `${title} berhasil disimpan.`;
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, `${title} gagal disimpan.`);
  } finally {
    saving.value = false;
  }
}

async function deactivate(row: Row) {
  if (!canWrite.value || !window.confirm(`Nonaktifkan ${row.nama_gudang}?`))
    return;
  try {
    await request(`/gudang/${row.id}`, { method: "DELETE" });
    successMessage.value = "Gudang berhasil dinonaktifkan.";
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Gudang gagal dinonaktifkan.");
  }
}

async function hardDelete(row: Row) {
  if (
    !canWrite.value ||
    row.boleh_hapus_permanen === false ||
    !window.confirm(`Hapus permanen ${row.nama_gudang}?`)
  )
    return;
  try {
    await request(`/gudang/${row.id}/permanent`, { method: "DELETE" });
    successMessage.value = "Gudang berhasil dihapus permanen.";
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Gudang gagal dihapus permanen.");
  }
}

watch([search, pageSize], () => {
  page.value = 1;
  loadRows();
});
watch(page, loadRows);
watch(
  () => form.jenis_gudang,
  (value) => {
    if (value !== "teknisi") form.teknisi_id = undefined;
  },
);
onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      :title="title"
      :description="description"
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

    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari kode, nama, atau alamat"
          class="lg:max-w-sm"
          @keyup.enter="loadRows"
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
          <UButton
            icon="i-lucide-plus"
            label="Buat"
            :disabled="!canWrite"
            :title="
              canWrite
                ? 'Tambah gudang'
                : 'Akun ini tidak memiliki izin membuat gudang'
            "
            @click="openCreate"
          />
        </div>
      </div>
    </UCard>

    <UCard>
      <UTable
        :data="rows"
        :columns="columns"
        :loading="loading"
      >
        <template #jenis_gudang-cell="{ row }">
          <UBadge
            color="info"
            variant="subtle"
          >
            {{
              jenisOptions.find(
                (item) => item.value === row.original.jenis_gudang,
              )?.label || row.original.jenis_gudang
            }}
          </UBadge>
        </template>
        <template #aktif-cell="{ row }">
          <UBadge
            :color="row.original.aktif ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ row.original.aktif ? "Aktif" : "Nonaktif" }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div
            v-if="canWrite"
            class="flex flex-wrap gap-1"
          >
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit"
              @click="openEdit(row.original)"
            />
            <UButton
              size="xs"
              color="warning"
              variant="ghost"
              icon="i-lucide-power"
              aria-label="Nonaktifkan"
              @click="deactivate(row.original)"
            />
            <UButton
              v-if="row.original.boleh_hapus_permanen !== false"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              aria-label="Hapus permanen"
              @click="hardDelete(row.original)"
            />
          </div>
          <span
            v-else
            class="text-sm text-dimmed"
          >
            -
          </span>
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
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Kode Gudang"
              name="kode_gudang"
              required
            >
              <UInput
                v-model="form.kode_gudang"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Nama Gudang"
              name="nama_gudang"
              required
            >
              <UInput
                v-model="form.nama_gudang"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Jenis Gudang"
            name="jenis_gudang"
            required
          >
            <USelect
              v-model="form.jenis_gudang"
              :items="jenisOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="form.jenis_gudang === 'teknisi'"
            label="Teknisi"
            name="teknisi_id"
            required
          >
            <USelect
              v-model="form.teknisi_id"
              :items="technicianOptions"
              placeholder="Pilih teknisi"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Alamat"
            name="alamat"
          >
            <UTextarea
              v-model="form.alamat"
              class="w-full"
            />
          </UFormField>
          <UCheckbox
            v-model="form.aktif"
            label="Aktif"
          />
          <UButton
            type="submit"
            block
            :loading="saving"
          >
            Simpan
          </UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
