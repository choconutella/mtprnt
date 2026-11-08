<script setup lang="ts">
// The toner endpoint returns the master_toner shape from the existing service.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const { request, message } = useServiceApi();
const auth = useAuth();

const rows = ref<Row[]>([]);
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
const form = reactive({
  kode_toner: "",
  nama_toner: "",
  warna: "",
  tipe: "",
  aktif: true,
});

const title = "Master Toner";
const description = "Kelola data toner berdasarkan kode, warna, dan tipe.";
const canWrite = computed(() => auth.isAdmin.value);
const columns = [
  { accessorKey: "kode_toner", header: "Kode" },
  { accessorKey: "nama_toner", header: "Nama" },
  { accessorKey: "warna", header: "Warna" },
  { accessorKey: "tipe", header: "Tipe" },
  { accessorKey: "aktif", header: "Status" },
  { id: "actions", header: "Aksi" },
];

function resetForm() {
  Object.assign(form, {
    kode_toner: "",
    nama_toner: "",
    warna: "",
    tipe: "",
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
    kode_toner: row.kode_toner,
    nama_toner: row.nama_toner,
    warna: row.warna || "",
    tipe: row.tipe || "",
    aktif: row.aktif,
  });
  modalOpen.value = true;
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
    }>(`/toner?${params}`);
    rows.value = response.data.items;
    total.value = response.data.meta.total;
  } catch (error) {
    errorMessage.value = message(error, "Data toner gagal dimuat.");
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!canWrite.value) return;
  if (
    ![form.kode_toner, form.nama_toner, form.warna, form.tipe].every((value) =>
      value.trim(),
    )
  ) {
    errorMessage.value = "Lengkapi kode, nama, warna, dan tipe toner.";
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    const data = {
      ...form,
      kode_toner: form.kode_toner.trim(),
      nama_toner: form.nama_toner.trim(),
      warna: form.warna.trim(),
      tipe: form.tipe.trim(),
    };
    if (editing.value)
      await request(`/toner/${editing.value.id}`, {
        method: "PUT",
        body: data,
      });
    else await request("/toner", { method: "POST", body: data });
    modalOpen.value = false;
    successMessage.value = `${title} berhasil disimpan.`;
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, `${title} gagal disimpan.`);
  } finally {
    saving.value = false;
  }
}

async function toggleActive(row: Row) {
  if (!canWrite.value) return;
  const nextStatus = !row.aktif;
  if (!window.confirm(`${nextStatus ? "Aktifkan" : "Nonaktifkan"} ${row.nama_toner}?`)) return;
  try {
    await request(`/toner/${row.id}`, {
      method: "PUT",
      body: { aktif: nextStatus },
    });
    successMessage.value = `Toner berhasil ${nextStatus ? "diaktifkan" : "dinonaktifkan"}.`;
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, `Toner gagal ${nextStatus ? "diaktifkan" : "dinonaktifkan"}.`);
  }
}

watch([search, pageSize], () => {
  page.value = 1;
  loadRows();
});
watch(page, loadRows);
onMounted(loadRows);
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
          placeholder="Cari kode, nama, warna, atau tipe"
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
            @click="loadRows"
          />
          <UButton
            icon="i-lucide-plus"
            label="Buat"
            :disabled="!canWrite"
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
              :color="row.original.aktif ? 'warning' : 'success'"
              variant="ghost"
              :icon="row.original.aktif ? 'i-lucide-power-off' : 'i-lucide-power'"
              :aria-label="row.original.aktif ? 'Nonaktifkan' : 'Aktifkan'"
              @click="toggleActive(row.original)"
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
          <UFormField
            label="Kode Toner"
            name="kode_toner"
            required
          >
            <UInput
              v-model="form.kode_toner"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Nama Toner"
            name="nama_toner"
            required
          >
            <UInput
              v-model="form.nama_toner"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Warna"
            name="warna"
            required
          >
            <UInput
              v-model="form.warna"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Tipe"
            name="tipe"
            required
          >
            <UInput
              v-model="form.tipe"
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
