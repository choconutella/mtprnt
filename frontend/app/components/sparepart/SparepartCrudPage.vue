<script setup lang="ts">
// The sparepart endpoint returns the master_suku_cadang shape from the existing service.
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
  kode_suku_cadang: "",
  nama_suku_cadang: "",
  aktif: true,
});

const title = "Master Sparepart";
const description = "Kelola data master sparepart.";
const canWrite = computed(() => auth.isAdmin.value);
const columns = [
  { accessorKey: "kode_suku_cadang", header: "Kode" },
  { accessorKey: "nama_suku_cadang", header: "Nama" },
  { accessorKey: "aktif", header: "Status" },
  { id: "actions", header: "Aksi" },
];

function resetForm() {
  Object.assign(form, {
    kode_suku_cadang: "",
    nama_suku_cadang: "",
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
    kode_suku_cadang: row.kode_suku_cadang,
    nama_suku_cadang: row.nama_suku_cadang,
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
    }>(`/suku-cadang?${params}`);
    rows.value = response.data.items;
    total.value = response.data.meta.total;
  } catch (error) {
    errorMessage.value = message(error, "Data sparepart gagal dimuat.");
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!canWrite.value) return;
  if (!form.kode_suku_cadang.trim() || !form.nama_suku_cadang.trim()) {
    errorMessage.value = "Lengkapi kode dan nama sparepart.";
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    const data = {
      ...form,
      kode_suku_cadang: form.kode_suku_cadang.trim(),
      nama_suku_cadang: form.nama_suku_cadang.trim(),
    };
    if (editing.value)
      await request(`/suku-cadang/${editing.value.id}`, {
        method: "PUT",
        body: data,
      });
    else await request("/suku-cadang", { method: "POST", body: data });
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
  if (
    !canWrite.value ||
    !window.confirm(`Nonaktifkan ${row.nama_suku_cadang}?`)
  )
    return;
  try {
    await request(`/suku-cadang/${row.id}`, { method: "DELETE" });
    successMessage.value = "Sparepart berhasil dinonaktifkan.";
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Sparepart gagal dinonaktifkan.");
  }
}

async function hardDelete(row: Row) {
  if (
    !canWrite.value ||
    row.boleh_hapus_permanen === false ||
    !window.confirm(`Hapus permanen ${row.nama_suku_cadang}?`)
  )
    return;
  try {
    await request(`/suku-cadang/${row.id}/permanent`, { method: "DELETE" });
    successMessage.value = "Sparepart berhasil dihapus permanen.";
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Sparepart gagal dihapus permanen.");
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

    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari kode atau nama sparepart"
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
      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #aktif-cell="{ row }">
          <UBadge
            :color="row.original.aktif ? 'success' : 'neutral'"
            variant="subtle"
            >{{ row.original.aktif ? "Aktif" : "Nonaktif" }}</UBadge
          >
        </template>
        <template #actions-cell="{ row }">
          <div v-if="canWrite" class="flex flex-wrap gap-1">
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
          <span v-else class="text-sm text-dimmed">-</span>
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
          <UFormField label="Kode Sparepart" name="kode_suku_cadang" required
            ><UInput v-model="form.kode_suku_cadang" class="w-full"
          /></UFormField>
          <UFormField label="Nama Sparepart" name="nama_suku_cadang" required
            ><UInput v-model="form.nama_suku_cadang" class="w-full"
          /></UFormField>
          <UCheckbox v-model="form.aktif" label="Aktif" />
          <UButton type="submit" block :loading="saving">Simpan</UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
