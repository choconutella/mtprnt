<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditRow = Record<string, any>;

const { request, message } = useServiceApi();
const filter = reactive({
  jenis_barang: "all",
  search: "",
  tanggal_mulai: "",
  tanggal_selesai: "",
});
const rows = ref<AuditRow[]>([]);
const selected = ref<AuditRow | null>(null);
const detailOpen = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const searched = ref(false);
const errorMessage = ref("");

const hasFilter = computed(
  () =>
    filter.jenis_barang !== "all" ||
    Boolean(
      filter.search.trim() || filter.tanggal_mulai || filter.tanggal_selesai,
    ),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value)),
);
const rangeStart = computed(() =>
  total.value ? (page.value - 1) * pageSize.value + 1 : 0,
);
const rangeEnd = computed(() =>
  Math.min(page.value * pageSize.value, total.value),
);
const columns = [
  { accessorKey: "event_nama", header: "Event" },
  { accessorKey: "tanggal_audit", header: "Tanggal dan Waktu" },
  { accessorKey: "nama_pengguna", header: "User" },
  { accessorKey: "kode_barang", header: "Barang" },
  { accessorKey: "lokasi", header: "Lokasi Asal / Tujuan" },
  { accessorKey: "perubahan", header: "Jumlah / Saldo" },
  { accessorKey: "referensi_nomor", header: "Referensi" },
  { accessorKey: "keterangan", header: "Keterangan" },
  { id: "actions", header: "Aksi" },
];
const labels: Record<string, string> = {
  mp_no: "MP No",
  serial_number: "Serial Number",
  model_id: "Model",
  status: "Status",
  lokasi_nama: "Lokasi",
  tanggal_pembelian: "Tanggal Pembelian",
  tanggal_maintenance_berikutnya: "Maintenance Berikutnya",
  interval_maintenance_bulan: "Interval Maintenance (Bulan)",
  status_operasional: "Status Operasional",
  kode_toner: "Kode Toner",
  nama_toner: "Nama Toner",
  warna: "Warna",
  tipe: "Tipe",
  kode_suku_cadang: "Kode Sparepart",
  nama_suku_cadang: "Nama Sparepart",
  aktif: "Aktif",
  keterangan: "Keterangan",
};

function formatDateTime(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
function stockText(value: AuditRow[] | null | undefined) {
  return value?.length
    ? value
        .map(
          (row) =>
            `${row.nama_gudang || "Gudang"}: ${Number(row.jumlah_tersedia)}`,
        )
        .join("; ")
    : "-";
}
function changeText(item: AuditRow) {
  if (item.jumlah == null)
    return item.status_sebelum &&
      item.status_sesudah &&
      item.status_sebelum !== item.status_sesudah
      ? `${item.status_sebelum} → ${item.status_sesudah}`
      : "-";
  const sign =
    item.aksi === "masuk"
      ? "+"
      : ["keluar", "pemakaian"].includes(item.aksi)
        ? "-"
        : "";
  return `${sign}${Number(item.jumlah)} / ${stockText(item.saldo_sesudah)}`;
}
function displayValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function detailChanges(item: AuditRow) {
  const before = item.data_sebelum || {};
  const after = item.data_sesudah || {};
  return Object.entries(labels)
    .filter(
      ([key]) =>
        JSON.stringify(before[key] ?? null) !==
        JSON.stringify(after[key] ?? null),
    )
    .map(([key, label]) => ({
      label,
      before: displayValue(before[key]),
      after: displayValue(after[key]),
    }));
}
function resetPage() {
  page.value = 1;
}
function resetFilter() {
  Object.assign(filter, {
    jenis_barang: "all",
    search: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
  });
  rows.value = [];
  total.value = 0;
  searched.value = false;
  errorMessage.value = "";
  resetPage();
}
async function loadAuditBarang(reset = true) {
  searched.value = true;
  errorMessage.value = "";
  if (reset) resetPage();
  if (!hasFilter.value) {
    rows.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const params = new URLSearchParams({
      halaman: String(page.value),
      batas: String(pageSize.value),
    });
    if (filter.jenis_barang !== "all")
      params.set("jenis_barang", filter.jenis_barang);
    if (filter.search.trim()) params.set("barang", filter.search.trim());
    if (filter.tanggal_mulai) params.set("tanggal_mulai", filter.tanggal_mulai);
    if (filter.tanggal_selesai)
      params.set("tanggal_selesai", filter.tanggal_selesai);
    const response = await request<{
      data: { items: AuditRow[]; meta: { total: number } };
    }>(`/audit-barang?${params.toString()}`);
    rows.value = response.data?.items || [];
    total.value = response.data?.meta?.total || 0;
  } catch (error) {
    rows.value = [];
    total.value = 0;
    errorMessage.value = message(error, "Audit barang gagal dimuat.");
  } finally {
    loading.value = false;
  }
}
async function changePage(nextPage: number) {
  page.value = nextPage;
  await loadAuditBarang(false);
}
watch(pageSize, () => {
  if (searched.value) loadAuditBarang();
});
watch(totalPages, (value) => {
  if (page.value > value) page.value = value;
});
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="Audit Barang"
      description="Telusuri perubahan master barang dan pergerakan stok."
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UCard>
      <div class="overflow-x-auto pb-1">
        <div class="flex min-w-[1100px] items-end gap-3">
          <UFormField
            label="Tanggal Mulai"
            class="w-40 shrink-0"
          >
            <UInput
              v-model="filter.tanggal_mulai"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Tanggal Selesai"
            class="w-40 shrink-0"
          >
            <UInput
              v-model="filter.tanggal_selesai"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Jenis Barang"
            class="w-40 shrink-0"
          >
            <USelect
              v-model="filter.jenis_barang"
              :items="[
                { label: 'Semua barang', value: 'all' },
                { label: 'Printer', value: 'printer' },
                { label: 'Toner', value: 'toner' },
                { label: 'Sparepart', value: 'suku_cadang' },
              ]"
              class="w-full"
          />
          </UFormField>
          <UFormField
            label="Search"
            class="min-w-64 flex-1"
          >
            <UInput
              v-model="filter.search"
              icon="i-lucide-search"
              placeholder="MP No atau kode barang"
              class="w-full"
              @keyup.enter="loadAuditBarang"
            />
          </UFormField>
          <UButton
            color="neutral"
            variant="outline"
            label="Reset"
            class="shrink-0"
            @click="resetFilter"
          />
          <UButton
            icon="i-lucide-search"
            label="Tampilkan Audit"
            :loading="loading"
            class="shrink-0"
            @click="loadAuditBarang"
          />
        </div>
      </div>
    </UCard>
    <UCard>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-semibold text-highlighted">Riwayat Audit Barang</h2>
          <p class="text-sm text-dimmed">
            {{
              total
                ? `${total} event ditemukan`
                : "Belum ada event yang ditampilkan"
            }}
          </p>
        </div>
        <USelect
          v-model="pageSize"
          :items="
            [10, 25, 50].map((value) => ({ label: `${value} baris`, value }))
          "
          class="w-32"
        />
      </div>
      <UTable
        :data="rows"
        :columns="columns"
        :loading="loading"
      >
        <template
          #event_nama-cell="{ row }"
        >
          <UBadge
            color="neutral"
            variant="subtle"
          >{{
            row.original.event_nama || row.original.aksi || "-"
          }}</UBadge>
        </template>
        <template #tanggal_audit-cell="{ row }">{{
          formatDateTime(row.original.tanggal_audit)
        }}</template>
        <template #nama_pengguna-cell="{ row }">{{
          row.original.nama_pengguna || "Sistem"
        }}</template>
        <template
          #kode_barang-cell="{ row }"
        >
          <span class="font-medium text-highlighted">{{
            row.original.kode_barang || "-"
          }}</span>
        </template>
        <template
          #lokasi-cell="{ row }"
        >{{ row.original.lokasi_asal || "-" }} →
          {{ row.original.lokasi_tujuan || "-" }}</template>
        <template #perubahan-cell="{ row }">{{
          changeText(row.original)
        }}</template>
        <template #referensi_nomor-cell="{ row }">{{
          row.original.referensi?.nomor || "-"
        }}</template>
        <template
          #keterangan-cell="{ row }"
        >
          <span class="whitespace-normal">{{
            row.original.keterangan || "-"
          }}</span>
        </template>
        <template
          #actions-cell="{ row }"
        >
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-eye"
            aria-label="Lihat perubahan"
            @click="
              selected = row.original;
              detailOpen = true;
            "
        />
        </template>
        <template
          #empty
        >
          <div class="py-10 text-center text-sm text-dimmed">
            {{
              loading
                ? "Memuat audit barang..."
                : searched
                  ? "Audit barang tidak ditemukan."
                  : "Pilih filter lalu pilih Tampilkan Audit."
            }}
          </div>
        </template>
      </UTable>
      <div
        class="mt-4 flex flex-col gap-3 text-sm text-dimmed sm:flex-row sm:items-center sm:justify-between"
      >
        <span>{{ rangeStart }}-{{ rangeEnd }} dari {{ total }} event</span>
        <div class="flex items-center gap-3">
          <span>Halaman {{ page }} dari {{ totalPages }}</span>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-left"
            aria-label="Halaman sebelumnya"
            :disabled="page <= 1"
            @click="changePage(page - 1)"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-right"
            aria-label="Halaman berikutnya"
            :disabled="page >= totalPages"
            @click="changePage(page + 1)"
          />
        </div>
      </div>
    </UCard>
    <UModal
      v-model:open="detailOpen"
      :title="selected?.event_nama || 'Detail Audit Barang'"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div
          v-if="selected"
          class="space-y-4"
        >
          <div class="flex flex-wrap gap-2">
            <UBadge
              color="neutral"
              variant="subtle"
            >{{
              selected.kode_barang || "-"
            }}</UBadge>
            <UBadge
              color="info"
              variant="subtle"
            >{{
              selected.nama_pengguna || "Sistem"
            }}</UBadge>
          </div>
          <p class="text-sm text-dimmed">
            {{ formatDateTime(selected.tanggal_audit) }} ·
            {{ selected.keterangan || "-" }}
          </p>
          <div
            v-if="selected.jumlah != null"
            class="grid grid-cols-[9rem_1fr] gap-3 border-t border-default pt-3 text-sm"
          >
            <strong>Jumlah</strong>
            <span>{{ Number(selected.jumlah) }}</span>
          </div>
          <div
            v-if="selected.saldo_sebelum || selected.saldo_sesudah"
            class="grid grid-cols-[9rem_1fr] gap-3 border-t border-default pt-3 text-sm"
          >
            <strong>Saldo</strong>
            <span
              >{{ stockText(selected.saldo_sebelum) }} →
              {{ stockText(selected.saldo_sesudah) }}</span>
          </div>
          <div
            v-for="change in detailChanges(selected)"
            :key="change.label"
            class="grid gap-1 border-t border-default pt-3 text-sm sm:grid-cols-[9rem_1fr]"
          >
            <strong>{{ change.label }}</strong>
            <span>{{ change.before }} → {{ change.after }}</span>
          </div>
          <div
            v-if="selected.referensi"
            class="grid grid-cols-[9rem_1fr] gap-3 border-t border-default pt-3 text-sm"
          >
            <strong>Referensi</strong>
            <span>{{ selected.referensi.nomor }}</span>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
