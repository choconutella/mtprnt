<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const { request, message } = useServiceApi();
const tickets = ref<Row[]>([]);
const workOrders = ref<Row[]>([]);
const users = ref<Row[]>([]);
const stock = ref<{ printer: Row[]; toner: Row[]; suku_cadang: Row[] }>({
  printer: [],
  toner: [],
  suku_cadang: [],
});
const printerSummary = reactive({
  installed: 0,
  available: 0,
  reserved: 0,
  issued: 0,
});
const loading = ref(false);
const errorMessage = ref("");

const statusLabels: Record<string, string> = {
  new: "New",
  pending: "Pending",
  progress: "Progress",
  solved: "Selesai",
  cancelled: "Dibatalkan",
};
const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  pending: "bg-sky-400",
  progress: "bg-cyan-400",
  solved: "bg-emerald-500",
  cancelled: "bg-rose-400",
};
const statusOrder = ["new", "pending", "progress", "solved", "cancelled"];
const shortDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const cards = computed(() => [
  {
    label: "Jumlah Tiket",
    value: tickets.value.length,
    note: "Total tiket tercatat",
    icon: "i-lucide-phone-call",
    color: "info",
  },
  {
    label: "Jumlah Surat Tugas",
    value: workOrders.value.length,
    note: "Total surat tugas",
    icon: "i-lucide-clipboard-list",
    color: "primary",
  },
  {
    label: "Printer Terpasang",
    value: printerSummary.installed,
    note: "Unit aktif di customer",
    icon: "i-lucide-printer",
    color: "success",
  },
]);
const ticketStatuses = computed(() => {
  const counts = Object.fromEntries(statusOrder.map((status) => [status, 0]));
  tickets.value.forEach((ticket) => {
    counts[ticket.status || "new"] = (counts[ticket.status || "new"] || 0) + 1;
  });
  return statusOrder.map((status) => ({
    status,
    label: statusLabels[status],
    value: counts[status] || 0,
    percent: tickets.value.length
      ? Math.round((counts[status] / tickets.value.length) * 100)
      : 0,
  }));
});
const recentDays = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  tickets.value.forEach((ticket) => {
    const date = dateFrom(ticket, [
      "tanggal_transaksi",
      "tanggal_dibuat",
      "created_at",
    ]);
    if (date) counts.set(dateKey(date), (counts.get(dateKey(date)) || 0) + 1);
  });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      label: shortDays[date.getDay()],
      value: counts.get(dateKey(date)) || 0,
    };
  });
});
const workOrderDays = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  workOrders.value.forEach((item) => {
    const date = dateFrom(item, [
      "tanggal_dibuat",
      "tanggal_jadwal",
      "created_at",
    ]);
    if (date) counts.set(dateKey(date), (counts.get(dateKey(date)) || 0) + 1);
  });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      label: shortDays[date.getDay()],
      value: counts.get(dateKey(date)) || 0,
    };
  });
});
const stockComposition = computed(() => [
  {
    label: "Printer",
    value: stock.value.printer.reduce(
      (sum, item) => sum + number(item.jumlah_tersedia),
      0,
    ),
    color: "bg-blue-500",
  },
  {
    label: "Toner",
    value: stock.value.toner.reduce(
      (sum, item) => sum + number(item.jumlah_tersedia),
      0,
    ),
    color: "bg-cyan-400",
  },
  {
    label: "Sparepart",
    value: stock.value.suku_cadang.reduce(
      (sum, item) => sum + number(item.jumlah_tersedia),
      0,
    ),
    color: "bg-violet-500",
  },
]);
const technicianLoad = computed(() => {
  const active = new Set([
    "pending",
    "progress",
    "technician_completed",
    "warehouse_validated",
  ]);
  const counts = new Map<string, number>();
  workOrders.value
    .filter((item) => active.has(item.status))
    .forEach((item) => {
      (item.teknisi_surat_tugas || item.teknisi || []).forEach(
        (assignment: Row) => {
          const id = assignment.master_pengguna?.id || assignment.teknisi_id || assignment.id;
          if (id) counts.set(id, (counts.get(id) || 0) + 1);
        },
      );
      if (item.pic_teknisi_id)
        counts.set(
          item.pic_teknisi_id,
          (counts.get(item.pic_teknisi_id) || 0) + 1,
        );
    });
  return users.value
    .filter((user) =>
      ["teknisi", "technician"].includes(
        String(user.role || user.peran || "").toLowerCase(),
      ),
    )
    .map((user) => ({
      label: user.nama_lengkap || user.name || user.user_id || "-",
      value: counts.get(user.id) || 0,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
});
const maxTrend = computed(() =>
  Math.max(1, ...recentDays.value.map((item) => item.value)),
);
const maxWorkOrder = computed(() =>
  Math.max(1, ...workOrderDays.value.map((item) => item.value)),
);
const maxTechnician = computed(() =>
  Math.max(1, ...technicianLoad.value.map((item) => item.value)),
);
const totalStock = computed(() =>
  stockComposition.value.reduce((sum, item) => sum + item.value, 0),
);

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function dateFrom(item: Row, keys: string[]) {
  const raw = keys.map((key) => item?.[key]).find(Boolean);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
function unwrap(response: Row) {
  return Array.isArray(response?.data)
    ? response.data
    : response?.data?.items || [];
}
async function loadList(path: string) {
  const response = await request<Row>(`${path}?halaman=1&batas=100`);
  return unwrap(response);
}

async function loadDashboard() {
  loading.value = true;
  errorMessage.value = "";
  const requests = await Promise.allSettled([
    loadList("/tiket"),
    loadList("/surat-tugas"),
    loadList("/pengguna"),
    request<Row>("/stok"),
    request<Row>("/printer/summary"),
  ]);
  const failures: string[] = [];
  const [
    ticketResult,
    workOrderResult,
    userResult,
    stockResult,
    printerResult,
  ] = requests;
  if (ticketResult.status === "fulfilled") tickets.value = ticketResult.value;
  else failures.push("tiket");
  if (workOrderResult.status === "fulfilled")
    workOrders.value = workOrderResult.value;
  else failures.push("surat tugas");
  if (userResult.status === "fulfilled") users.value = userResult.value;
  else failures.push("pengguna");
  if (stockResult.status === "fulfilled")
    stock.value = {
      printer: stockResult.value.data?.printer || [],
      toner: stockResult.value.data?.toner || [],
      suku_cadang: stockResult.value.data?.suku_cadang || [],
    };
  else failures.push("stok");
  if (printerResult.status === "fulfilled")
    Object.assign(printerSummary, printerResult.value.data || {});
  else failures.push("ringkasan printer");
  if (failures.length)
    errorMessage.value = `Sebagian data dashboard gagal dimuat: ${failures.join(", ")}.`;
  loading.value = false;
}

onMounted(loadDashboard);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <UPageHeader
        title="Dashboard"
        description="Ringkasan operasional MultiPrint."
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        label="Refresh"
        :loading="loading"
        @click="loadDashboard"
      />
    </div>
    <UAlert
      v-if="errorMessage"
      color="warning"
      variant="subtle"
      :title="errorMessage"
    />
    <div class="grid gap-4 md:grid-cols-3">
      <UCard
        v-for="card in cards"
        :key="card.label"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-dimmed">{{ card.label }}</p>
            <p class="mt-2 text-3xl font-semibold text-highlighted">
              {{ card.value }}
            </p>
            <p class="mt-1 text-xs text-dimmed">{{ card.note }}</p>
          </div>
          <UIcon
            :name="card.icon"
            class="size-7 text-primary"
          />
        </div>
      </UCard>
    </div>
    <div class="grid gap-4 xl:grid-cols-2">
      <UCard
        >
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-highlighted">Tren Tiket</h2>
            <p class="text-sm text-dimmed">7 hari terakhir</p>
          </div>
          <UBadge
            color="info"
            variant="subtle"
          >
            {{ tickets.length }} total
          </UBadge>
        </div>
        <div class="flex h-48 items-end gap-3">
          <div
            v-for="item in recentDays"
            :key="item.label"
            class="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span class="text-xs text-dimmed">{{ item.value }}</span>
            <div class="flex h-32 w-full items-end">
              <div
                class="w-full rounded-t-md bg-primary transition-all"
                :style="{
                  height: `${Math.max(item.value ? 10 : 2, (item.value / maxTrend) * 100)}%`,
                }"
              />
            </div>
            <span class="text-xs text-dimmed">{{ item.label }}</span>
          </div>
        </div>
      </UCard>
      <UCard
        >
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-highlighted">Status Tiket</h2>
            <p class="text-sm text-dimmed">Distribusi status tiket</p>
          </div>
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ tickets.length }} total
          </UBadge>
        </div>
        <div class="space-y-3">
          <div
            v-for="item in ticketStatuses"
            :key="item.status"
            class="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm"
          >
            <span class="text-dimmed">{{ item.label }}</span>
            <div class="h-2 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full"
                :class="statusColors[item.status]"
                :style="{ width: `${item.percent}%` }"
              />
            </div>
            <span class="text-right font-medium text-highlighted">{{
              item.value
            }}</span>
          </div>
        </div>
      </UCard>
      <UCard
        >
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-highlighted">Surat Tugas</h2>
            <p class="text-sm text-dimmed">7 hari terakhir</p>
          </div>
          <UBadge
            color="info"
            variant="subtle"
          >
            {{ workOrders.length }} total
          </UBadge>
        </div>
        <div class="flex h-48 items-end gap-3">
          <div
            v-for="item in workOrderDays"
            :key="item.label"
            class="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span class="text-xs text-dimmed">{{ item.value }}</span>
            <div class="flex h-32 w-full items-end">
              <div
                class="w-full rounded-t-md bg-info transition-all"
                :style="{
                  height: `${Math.max(item.value ? 10 : 2, (item.value / maxWorkOrder) * 100)}%`,
                }"
              />
            </div>
            <span class="text-xs text-dimmed">{{ item.label }}</span>
          </div>
        </div>
      </UCard>
      <UCard
        >
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-highlighted">Komposisi Stok</h2>
            <p class="text-sm text-dimmed">Total stok tersedia</p>
          </div>
          <span class="text-2xl font-semibold text-highlighted">{{
            totalStock
          }}</span>
        </div>
        <div class="space-y-4">
          <div
            v-for="item in stockComposition"
            :key="item.label"
          >
            <div class="mb-1 flex justify-between text-sm">
              <span class="text-dimmed">{{ item.label }}</span>
              <span class="font-medium text-highlighted">{{
                item.value
              }}</span>
            </div>
            <div class="h-3 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full"
                :class="item.color"
                :style="{
                  width: `${totalStock ? Math.max(item.value ? 5 : 0, (item.value / totalStock) * 100) : 0}%`,
                }"
              />
            </div>
          </div>

        </div>
      </UCard>
    </div>
    <UCard
      >
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-highlighted">Beban Teknisi</h2>
          <p class="text-sm text-dimmed">Surat tugas aktif per teknisi</p>
        </div>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          to="/surat-tugas"
        >
          Lihat Surat Tugas
        </UButton>
      </div>
      <div
        v-if="technicianLoad.length"
        class="space-y-3"
      >
        <div
          v-for="item in technicianLoad"
          :key="item.label"
          class="grid grid-cols-[10rem_1fr_2rem] items-center gap-3 text-sm"
        >
          <span class="truncate text-dimmed">{{ item.label }}</span>
          <div class="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full bg-info"
              :style="{
                width: `${item.value ? Math.max(8, (item.value / maxTechnician) * 100) : 0}%`,
              }"
            />
          </div>
          <span class="text-right font-medium text-highlighted">{{
            item.value
          }}</span>
        </div>
      </div>
      <div
        v-else
        class="py-6 text-center text-sm text-dimmed"
      >
        Belum ada beban teknisi aktif.
      </div>
    </UCard>
  </div>
</template>
