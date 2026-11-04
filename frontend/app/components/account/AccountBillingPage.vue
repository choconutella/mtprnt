<script setup lang="ts">
type Billing = {
  id: string;
  kode_account: string;
  nama_account: string;
  npwp: string | null;
  telepon: string | null;
  email: string | null;
  alamat_penagihan: string | null;
  aktif: boolean;
  jumlah_customer: number;
  boleh_hapus_permanen: boolean;
};

const { request, message } = useServiceApi();
const auth = useAuth();
const canWrite = computed(() => auth.isAdmin.value);
const accessLoading = ref(false);
const rows = ref<Billing[]>([]);
const search = ref("");
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editing = ref<Billing | null>(null);
const errorMessage = ref("");
const formError = ref("");
const successMessage = ref("");
const form = reactive({
  kode_account: "",
  nama_account: "",
  npwp: "",
  telepon: "",
  email: "",
  alamat_penagihan: "",
  aktif: true,
});
const columns = [
  { accessorKey: "kode_account", header: "Kode Account" },
  { accessorKey: "nama_account", header: "Nama Account" },
  { accessorKey: "npwp", header: "NPWP" },
  { accessorKey: "telepon", header: "Telepon Utama" },
  { accessorKey: "email", header: "Email Utama" },
  { accessorKey: "aktif", header: "Status" },
  { id: "actions", header: "Aksi" },
];

async function loadRows() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const params = new URLSearchParams({
      halaman: String(page.value),
      batas: "10",
    });
    if (search.value.trim()) params.set("cari", search.value.trim());
    const response = await request<{
      data: { items: Billing[]; meta: { total: number } };
    }>(`/account?${params}`);
    rows.value = response.data.items;
    total.value = response.data.meta.total;
  } catch (error) {
    errorMessage.value = message(error, "Billing gagal dimuat.");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    kode_account: "",
    nama_account: "",
    npwp: "",
    telepon: "",
    email: "",
    alamat_penagihan: "",
    aktif: true,
  });
  formError.value = "";
  modalOpen.value = true;
}

function openEdit(row: Billing) {
  editing.value = row;
  Object.assign(form, {
    kode_account: row.kode_account,
    nama_account: row.nama_account,
    npwp: row.npwp || "",
    telepon: row.telepon || "",
    email: row.email || "",
    alamat_penagihan: row.alamat_penagihan || "",
    aktif: row.aktif,
  });
  formError.value = "";
  modalOpen.value = true;
}

async function save() {
  if (!canWrite.value) return;
  formError.value = "";
  if (!form.kode_account.trim() || !form.nama_account.trim()) {
    formError.value = "Kode Account dan Nama Account wajib diisi.";
    return;
  }
  saving.value = true;
  try {
    const data = {
      kode_account: form.kode_account.trim(),
      nama_account: form.nama_account.trim(),
      npwp: form.npwp.trim() || null,
      telepon: form.telepon.trim() || null,
      email: form.email.trim() || null,
      alamat_penagihan: form.alamat_penagihan.trim() || null,
      aktif: form.aktif,
    };
    if (editing.value)
      await request(`/account/${editing.value.id}`, {
        method: "PUT",
        body: data,
      });
    else await request("/account", { method: "POST", body: data });
    modalOpen.value = false;
    successMessage.value = "Billing berhasil disimpan.";
    await loadRows();
  } catch (error) {
    const response = error as {
      data?: {
        detail?: {
          fieldErrors?: Record<string, string[]>;
          formErrors?: string[];
        };
      };
    };
    const detail = response.data?.detail;
    const issues = [
      ...Object.entries(detail?.fieldErrors || {}).flatMap(
        ([field, messages]) => messages.map((issue) => `${field}: ${issue}`),
      ),
      ...(detail?.formErrors || []),
    ];
    formError.value = issues.length
      ? issues.join(" ")
      : message(error, "Billing gagal disimpan.");
  } finally {
    saving.value = false;
  }
}

async function remove(row: Billing, permanent = false) {
  if (
    !canWrite.value ||
    !window.confirm(
      `${permanent ? "Hapus permanen" : "Nonaktifkan"} Billing ${row.nama_account}?`,
    )
  )
    return;
  try {
    await request(`/account/${row.id}${permanent ? "/permanent" : ""}`, {
      method: "DELETE",
    });
    successMessage.value = permanent
      ? "Billing berhasil dihapus permanen."
      : "Billing berhasil dinonaktifkan.";
    if (permanent && rows.value.length === 1 && page.value > 1) page.value -= 1;
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Billing gagal diubah.");
  }
}

async function initialize() {
  if (!auth.isAdmin.value && auth.hasToken.value) {
    accessLoading.value = true;
    try {
      await auth.loadProfile();
    } finally {
      accessLoading.value = false;
    }
  }
  await loadRows();
}

watch(search, () => {
  page.value = 1;
  loadRows();
});
watch(page, loadRows);
onMounted(initialize);
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="Billing"
      description="Kelola identitas dan alamat penagihan Account."
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
    <UAlert
      v-if="!accessLoading && !canWrite"
      color="warning"
      variant="subtle"
      :title="`Aksi Billing memerlukan role admin. Profil saat ini: ${auth.user.value?.role || 'belum tersedia'}.`"
    />
    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari kode, nama, NPWP, atau telepon"
          class="lg:max-w-sm"
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
            :loading="accessLoading"
            :disabled="!canWrite"
            @click="openCreate"
          />
        </div>
      </div>
    </UCard>
    <UCard>
      <UTable :data="rows" :columns="columns" :loading="loading">
        <template #aktif-cell="{ row }"
          ><UBadge
            :color="row.original.aktif ? 'success' : 'neutral'"
            variant="subtle"
            >{{ row.original.aktif ? "Aktif" : "Nonaktif" }}</UBadge
          ></template
        >
        <template #actions-cell="{ row }">
          <div v-if="canWrite" class="flex gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit Billing"
              @click="openEdit(row.original)"
            />
            <UButton
              v-if="row.original.aktif"
              size="xs"
              color="warning"
              variant="ghost"
              icon="i-lucide-power"
              aria-label="Nonaktifkan Billing"
              @click="remove(row.original)"
            />
          </div>
          <span v-else class="text-sm text-dimmed">-</span>
        </template>
      </UTable>
      <div class="mt-4 flex justify-end">
        <UPagination v-model:page="page" :page-count="10" :total="total" />
      </div>
    </UCard>
    <UModal
      v-model:open="modalOpen"
      :title="editing ? 'Edit Billing' : 'Tambah Billing'"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <UForm :state="form" class="space-y-4" @submit="save">
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :title="formError"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Kode Account" required
              ><UInput v-model="form.kode_account" class="w-full"
            /></UFormField>
            <UFormField label="Nama Account" required
              ><UInput v-model="form.nama_account" class="w-full"
            /></UFormField>
            <UFormField label="NPWP"
              ><UInput v-model="form.npwp" class="w-full"
            /></UFormField>
            <UFormField label="Telepon Utama"
              ><UInput v-model="form.telepon" class="w-full"
            /></UFormField>
            <UFormField label="Email Utama"
              ><UInput v-model="form.email" type="email" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Alamat Penagihan"
            ><UTextarea v-model="form.alamat_penagihan" class="w-full"
          /></UFormField>
          <UCheckbox v-model="form.aktif" label="Aktif" />
          <UButton type="submit" block :loading="saving">Simpan</UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
