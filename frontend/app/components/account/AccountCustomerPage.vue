<script setup lang="ts">
type Billing = {
  id: string;
  kode_account: string;
  nama_account: string;
  aktif: boolean;
};
type Customer = {
  id: string;
  account_id: string;
  kode_customer: string;
  nama_customer: string;
  alamat: string;
  nama_pic: string | null;
  telepon_pic: string | null;
  email_pic: string | null;
  aktif: boolean;
  boleh_nonaktifkan: boolean;
  boleh_hapus_permanen: boolean;
  master_account?: Billing;
};

const { request, message } = useServiceApi();
const auth = useAuth();
const canWrite = computed(() => auth.isAdmin.value);
const accessLoading = ref(false);
const rows = ref<Customer[]>([]);
const billings = ref<Billing[]>([]);
const search = ref("");
const billingSearch = ref("");
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const billingLoading = ref(false);
const billingSaving = ref(false);
const modalOpen = ref(false);
const billingModalOpen = ref(false);
const editing = ref<Customer | null>(null);
const errorMessage = ref("");
const formError = ref("");
const billingFormError = ref("");
const successMessage = ref("");
const form = reactive({
  sendiri: false,
  account_id: "",
  kode_customer: "",
  nama_customer: "",
  alamat: "",
  nama_pic: "",
  telepon_pic: "",
  email_pic: "",
});
const billingForm = reactive({
  kode_account: "",
  nama_account: "",
  npwp: "",
  telepon: "",
  email: "",
  alamat_penagihan: "",
  aktif: true,
});
const createBillingValue = "__create_billing__";
const columns = [
  { accessorKey: "kode_customer", header: "Kode Customer" },
  { accessorKey: "nama_customer", header: "Nama Customer" },
  { accessorKey: "master_account", header: "Billing" },
  { accessorKey: "alamat", header: "Alamat" },
  { accessorKey: "nama_pic", header: "Nama PIC" },
  { accessorKey: "aktif", header: "Status" },
  { id: "actions", header: "Aksi" },
];
const billingOptions = computed<
  Array<{ label: string; value: string; icon?: string }>
>(() =>
  billings.value
    .filter((item) => item.aktif || item.id === form.account_id)
    .map<{ label: string; value: string; icon?: string }>((item) => ({
      label: `${item.kode_account} — ${item.nama_account}`,
      value: item.id,
    }))
    .concat({
      label: "Buat Billing",
      value: createBillingValue,
      icon: "i-lucide-plus",
    }),
);

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
      data: { items: Customer[]; meta: { total: number } };
    }>(`/account/lokasi-customer?${params}`);
    rows.value = response.data.items;
    total.value = response.data.meta.total;
  } catch (error) {
    errorMessage.value = message(error, "Customer gagal dimuat.");
  } finally {
    loading.value = false;
  }
}

async function loadBillings() {
  billingLoading.value = true;
  try {
    const params = new URLSearchParams({ batas: "100" });
    if (billingSearch.value.trim())
      params.set("cari", billingSearch.value.trim());
    const response = await request<{ data: { items: Billing[] } }>(
      `/account?${params}`,
    );
    billings.value = response.data.items;
    if (
      editing.value?.master_account &&
      !billings.value.some((item) => item.id === editing.value?.account_id)
    ) {
      billings.value.push(editing.value.master_account);
    }
  } catch (error) {
    formError.value = message(error, "Pilihan Billing gagal dimuat.");
  } finally {
    billingLoading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    sendiri: false,
    account_id: "",
    kode_customer: "",
    nama_customer: "",
    alamat: "",
    nama_pic: "",
    telepon_pic: "",
    email_pic: "",
  });
  billingSearch.value = "";
  formError.value = "";
  modalOpen.value = true;
  loadBillings();
}

function openEdit(row: Customer) {
  editing.value = row;
  Object.assign(form, {
    sendiri: false,
    account_id: row.account_id,
    kode_customer: row.kode_customer,
    nama_customer: row.nama_customer,
    alamat: row.alamat,
    nama_pic: row.nama_pic || "",
    telepon_pic: row.telepon_pic || "",
    email_pic: row.email_pic || "",
  });
  billingSearch.value = "";
  formError.value = "";
  modalOpen.value = true;
  loadBillings();
}

async function save() {
  if (!canWrite.value) return;
  formError.value = "";
  if (
    (!form.sendiri && !form.account_id) ||
    !form.kode_customer.trim() ||
    !form.nama_customer.trim() ||
    !form.alamat.trim()
  ) {
    formError.value = `${form.sendiri ? "" : "Billing, "}kode, nama, dan alamat Customer wajib diisi.`;
    return;
  }
  saving.value = true;
  try {
    let accountId = form.account_id;
    if (form.sendiri) {
      const billingResponse = await request<{ data: Billing }>("/account", {
        method: "POST",
        body: {
          kode_account: form.kode_customer.trim(),
          nama_account: form.nama_customer.trim(),
          npwp: null,
          telepon: form.telepon_pic.trim() || null,
          email: form.email_pic.trim() || null,
          alamat_penagihan: form.alamat.trim() || null,
          aktif: true,
        },
      });
      accountId = billingResponse.data.id;
    }
    const data = {
      kode_customer: form.kode_customer.trim(),
      nama_customer: form.nama_customer.trim(),
      alamat: form.alamat.trim(),
      nama_pic: form.nama_pic.trim() || null,
      telepon_pic: form.telepon_pic.trim() || null,
      email_pic: form.email_pic.trim() || null,
    };
    if (editing.value)
      await request(`/account/${accountId}/customer/${editing.value.id}`, {
        method: "PUT",
        body: data,
      });
    else
      await request(`/account/${accountId}/customer`, {
        method: "POST",
        body: data,
      });
    modalOpen.value = false;
    successMessage.value = "Customer berhasil disimpan.";
    await loadRows();
  } catch (error) {
    formError.value = message(error, "Customer gagal disimpan.");
  } finally {
    saving.value = false;
  }
}

function openBillingCreate() {
  Object.assign(billingForm, {
    kode_account: "",
    nama_account: "",
    npwp: "",
    telepon: "",
    email: "",
    alamat_penagihan: "",
    aktif: true,
  });
  billingFormError.value = "";
  billingModalOpen.value = true;
}

async function saveBilling() {
  if (!canWrite.value) return;
  billingFormError.value = "";
  if (!billingForm.kode_account.trim() || !billingForm.nama_account.trim()) {
    billingFormError.value = "Kode Account dan Nama Account wajib diisi.";
    return;
  }
  billingSaving.value = true;
  try {
    const data = {
      kode_account: billingForm.kode_account.trim(),
      nama_account: billingForm.nama_account.trim(),
      npwp: billingForm.npwp.trim() || null,
      telepon: billingForm.telepon.trim() || null,
      email: billingForm.email.trim() || null,
      alamat_penagihan: billingForm.alamat_penagihan.trim() || null,
      aktif: billingForm.aktif,
    };
    const response = await request<{ data: Billing }>("/account", {
      method: "POST",
      body: data,
    });
    await loadBillings();
    form.account_id = response.data.id;
    billingModalOpen.value = false;
  } catch (error) {
    billingFormError.value = message(error, "Billing gagal dibuat.");
  } finally {
    billingSaving.value = false;
  }
}

async function remove(row: Customer, permanent = false) {
  if (
    !canWrite.value ||
    !window.confirm(
      `${permanent ? "Hapus permanen" : "Nonaktifkan"} Customer ${row.nama_customer}?`,
    )
  )
    return;
  try {
    await request(
      `/account/${row.account_id}/customer/${row.id}${permanent ? "/permanent" : ""}`,
      { method: "DELETE" },
    );
    successMessage.value = permanent
      ? "Customer berhasil dihapus permanen."
      : "Customer berhasil dinonaktifkan.";
    if (permanent && rows.value.length === 1 && page.value > 1) page.value -= 1;
    await loadRows();
  } catch (error) {
    errorMessage.value = message(error, "Customer gagal diubah.");
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
watch(
  () => form.account_id,
  (value) => {
    if (value === createBillingValue) {
      form.account_id = "";
      openBillingCreate();
    }
  },
);
onMounted(initialize);
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="Customer"
      description="Kelola data Customer dan Billing yang terkait."
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
      :title="`Aksi Customer memerlukan role admin. Profil saat ini: ${auth.user.value?.role || 'belum tersedia'}.`"
    />
    <UCard>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari Customer, Billing, atau alamat"
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
      <UTable
        :data="rows"
        :columns="columns"
        :loading="loading"
      >
        <template #master_account-cell="{ row }">{{
          row.original.master_account?.nama_account || "-"
        }}</template>
        <template
          #aktif-cell="{ row }"
        >
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
            class="flex gap-1"
          >
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit Customer"
              @click="openEdit(row.original)"
            />
            <UButton
              v-if="row.original.aktif"
              size="xs"
              color="warning"
              variant="ghost"
              icon="i-lucide-power"
              aria-label="Nonaktifkan Customer"
              :disabled="!row.original.boleh_nonaktifkan"
              :title="
                row.original.boleh_nonaktifkan
                  ? 'Nonaktifkan Customer'
                  : 'Customer aktif terakhir tidak dapat dinonaktifkan'
              "
              @click="remove(row.original)"
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
          :page-count="10"
          :total="total"
        />
      </div>
    </UCard>
    <UModal
      v-model:open="modalOpen"
      :title="editing ? 'Edit Customer' : 'Tambah Customer'"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UAlert
            v-if="formError"
            color="error"
            variant="subtle"
            :title="formError"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Kode Customer"
              required
            >
              <UInput
                v-model="form.kode_customer"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Nama Customer"
              required
            >
              <UInput
                v-model="form.nama_customer"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            v-if="!editing"
            label="Billing"
          >
            <UCheckbox
              v-model="form.sendiri"
              label="Sendiri"
            />
          </UFormField>
          <UFormField
            label="Pilih Billing"
            required
          >
            <USelectMenu
              v-model="form.account_id"
              :items="billingOptions"
              value-key="value"
              :loading="billingLoading"
              :disabled="form.sendiri"
              searchable
              searchable-placeholder="Ketik untuk mencari Billing"
              placeholder="Pilih Billing"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Nama PIC"
            >
              <UInput
                v-model="form.nama_pic"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Telepon PIC"
            >
              <UInput
                v-model="form.telepon_pic"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Email PIC"
            >
              <UInput
                v-model="form.email_pic"
                type="email"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Alamat"
            required
          >
            <UTextarea
              v-model="form.alamat"
              class="w-full"
            />
          </UFormField>
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
    <UModal
      v-model:open="billingModalOpen"
      title="Buat Billing"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <UForm
          :state="billingForm"
          class="space-y-4"
          @submit="saveBilling"
        >
          <UAlert
            v-if="billingFormError"
            color="error"
            variant="subtle"
            :title="billingFormError"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Kode Account"
              required
            >
              <UInput
                v-model="billingForm.kode_account"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Nama Account"
              required
            >
              <UInput
                v-model="billingForm.nama_account"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="NPWP"
            >
              <UInput
                v-model="billingForm.npwp"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Telepon Utama"
            >
              <UInput
                v-model="billingForm.telepon"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Email Utama"
            >
              <UInput
                v-model="billingForm.email"
                type="email"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Alamat Penagihan"
          >
            <UTextarea
              v-model="billingForm.alamat_penagihan"
              class="w-full"
            />
          </UFormField>
          <UCheckbox
            v-model="billingForm.aktif"
            label="Aktif"
          />
          <UButton
            type="submit"
            block
            :loading="billingSaving"
          >
            Simpan Billing
          </UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
