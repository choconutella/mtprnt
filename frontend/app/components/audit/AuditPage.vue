<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditRow = Record<string, any>;

const { request, message } = useServiceApi();
const filter = reactive({ tanggal_mulai: "", tanggal_selesai: "", search: "" });
const rows = ref<AuditRow[]>([]);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const searched = ref(false);
const errorMessage = ref("");
const hasDate = computed(() =>
  Boolean(filter.tanggal_mulai || filter.tanggal_selesai),
);
const hasTarget = computed(() => Boolean(filter.search.trim()));
const ready = computed(() => hasDate.value && hasTarget.value);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(rows.value.length / pageSize.value)),
);
const visibleRows = computed(() =>
  rows.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
);
const rangeStart = computed(() =>
  rows.value.length ? (page.value - 1) * pageSize.value + 1 : 0,
);
const rangeEnd = computed(() =>
  Math.min(page.value * pageSize.value, rows.value.length),
);
const columns = [
  { accessorKey: "event_nama", header: "Event" },
  { accessorKey: "tanggal_audit", header: "Tanggal dan Waktu" },
  { accessorKey: "nama_pengguna", header: "User" },
  { accessorKey: "tabel_keterangan", header: "Keterangan" },
];

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
function resetPage() {
  page.value = 1;
}
function resetFilter() {
  Object.assign(filter, { tanggal_mulai: "", tanggal_selesai: "", search: "" });
  rows.value = [];
  searched.value = false;
  errorMessage.value = "";
  resetPage();
}
async function loadAudit() {
  searched.value = true;
  errorMessage.value = "";
  resetPage();
  if (!ready.value) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    const baseParams = new URLSearchParams({ batas: "200" });
    if (filter.tanggal_mulai.trim())
      baseParams.set("tanggal_mulai", filter.tanggal_mulai.trim());
    if (filter.tanggal_selesai.trim())
      baseParams.set("tanggal_selesai", filter.tanggal_selesai.trim());
    const search = filter.search.trim();
    const targets = ["user", "nomor_tiket", "nomor_surat_tugas"];
    const responses = await Promise.all(
      targets.map((target) => {
        const params = new URLSearchParams(baseParams);
        params.set(target, search);
        return request<{ data: AuditRow[] }>(`/audit?${params.toString()}`);
      }),
    );
    const unique = new Map<string, AuditRow>();
    responses
      .flatMap((response) =>
        Array.isArray(response.data) ? response.data : [],
      )
      .forEach((row) => {
        const key = String(
          row.id || `${row.tanggal_audit}-${row.nomor_dokumen}-${row.aksi}`,
        );
        unique.set(key, row);
      });
    rows.value = [...unique.values()].sort((left, right) =>
      String(right.tanggal_audit || "").localeCompare(
        String(left.tanggal_audit || ""),
      ),
    );
  } catch (error) {
    rows.value = [];
    errorMessage.value = message(error, "Audit gagal dimuat.");
  } finally {
    loading.value = false;
  }
}
watch(pageSize, resetPage);
watch(totalPages, (value) => {
  if (page.value > value) page.value = value;
});
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="Audit"
      description="Telusuri riwayat perubahan tiket dan surat tugas."
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UAlert
      v-if="searched && !ready"
      color="warning"
      variant="subtle"
      title="Lengkapi filter tanggal dan isi Search."
    />
    <UCard>
      <div class="overflow-x-auto pb-1">
        <div class="flex min-w-[850px] items-end gap-3">
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
            label="Search"
            class="min-w-56 flex-1"
          >
            <UInput
              v-model="filter.search"
              icon="i-lucide-search"
              placeholder="Nama user, TKT..., atau ST..."
              class="w-full"
              @keyup.enter="loadAudit"
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
            @click="loadAudit"
          />
        </div>
      </div>
    </UCard>
    <UCard>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-semibold text-highlighted">Riwayat Audit</h2>
          <p class="text-sm text-dimmed">
            {{
              rows.length
                ? `${rows.length} event ditemukan`
                : "Belum ada event yang ditampilkan"
            }}
          </p>
        </div>
        <USelect
          v-model="pageSize"
          :items="
            [5, 10, 25].map((value) => ({ label: `${value} baris`, value }))
          "
          class="w-32"
        />
      </div>
      <UTable
        :data="visibleRows"
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
          row.original.nama_pengguna || "-"
        }}</template>
        <template
          #tabel_keterangan-cell="{ row }"
        >
          <span class="whitespace-normal">{{
            row.original.tabel_keterangan || row.original.keterangan || "-"
          }}</span>
        </template>
        <template
          #empty
        >
          <div class="py-10 text-center text-sm text-dimmed">
            {{
              loading
                ? "Memuat audit..."
                : searched
                  ? "Audit tidak ditemukan."
                  : "Isi filter lalu pilih Tampilkan Audit."
            }}
          </div>
        </template>
      </UTable>
      <div
        class="mt-4 flex flex-col gap-3 text-sm text-dimmed sm:flex-row sm:items-center sm:justify-between"
      >
        <span>{{ rangeStart }}-{{ rangeEnd }} dari {{ rows.length }} event</span>
        <UPagination
          v-model:page="page"
          :page-count="pageSize"
          :total="rows.length"
        />
      </div>
    </UCard>
  </div>
</template>
