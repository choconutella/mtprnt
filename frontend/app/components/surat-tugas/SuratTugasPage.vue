<script setup lang="ts">
// The Surat Tugas payload contains several legacy relation shapes; keep the UI adapter tolerant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const props = withDefaults(defineProps<{ embedded?: boolean; ticketId?: string; suratTugasId?: string }>(), {
  embedded: false,
  ticketId: "",
  suratTugasId: "",
});
const emit = defineEmits<{ close: []; created: []; failed: [message: string] }>();
const { request, message } = useServiceApi();
const auth = useAuth();
const rows = ref<Row[]>([]);
const options = reactive({
  tickets: [] as Row[],
  accounts: [] as Row[],
  customers: [] as Row[],
  contracts: [] as Row[],
  printers: [] as Row[],
  models: [] as Row[],
  warehouses: [] as Row[],
  users: [] as Row[],
  toners: [] as Row[],
  spareparts: [] as Row[],
});
const search = ref("");
const customerSearch = ref("");
const customerLoading = ref(false);
const technicianSearch = ref("");
const technicianSearchTerm = ref("");
const technicianLoading = ref(false);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const createOpen = ref(false);
const editing = ref<Row | null>(null);
const formTab = ref<"detail" | "items">("detail");
const formItems = ref<Row[]>([]);
const addItemOpen = ref(false);
const addItemKind = ref("printer");
const pendingPrinterIds = ref<string[]>([]);
const formItemColumns = [
  { accessorKey: "jenis_barang", header: "Jenis" },
  { accessorKey: "item", header: "Item" },
  { accessorKey: "gudang", header: "Gudang" },
  { accessorKey: "jumlah_pakai", header: "Jumlah" },
  { accessorKey: "keterangan", header: "Keterangan" },
  { id: "actions", header: "" },
];
const detailOpen = ref(false);
const detail = ref<Row | null>(null);
const tab = ref("general");
const printerSearch = ref("");
const printerLoading = ref(false);
const form = reactive({
  tiket_id: "",
  jenis_tugas: "",
  mode: "",
  account_id: "",
  customer_id: "",
  kontrak_id: "",
  unit_asal_id: "",
  gudang_id: "",
  pic_teknisi_id: "",
  pic_warehouse_id: "",
  lokasi_internal: "",
  sumber: "",
  new_mp_no: "",
  new_model_id: "",
  printer_ids: [] as string[],
  hasil: "",
});
const itemForm = reactive({
  jenis_barang: "toner",
  item_id: "",
  gudang_id: "",
  jumlah_pakai: 1,
  keterangan: "",
});
const formItem = reactive({
  jenis_barang: "toner",
  item_id: "",
  gudang_id: "",
  jumlah_pakai: 1,
  keterangan: "",
});
const resultForms = reactive<
  Record<string, { hasil: string; kondisi_hasil: string; alasan: string }>
>({});

const kinds: Record<string, string> = {
  kirim_kontrak: "Pengiriman Kontrak",
  terima_tukar: "Penerimaan Tukar",
  kirim_trial: "Pengiriman Trial",
  kirim_stand_by: "Pengiriman Stand-by",
  kirim_event: "Pengiriman Event",
  kirim_sell: "Penjualan",
  kirim_toner: "Pengiriman Toner",
  on_site_service: "On-site Service",
  kirim_back_up: "Pengiriman Back-up",
  terima_unit_rusak: "Terima Unit Rusak",
  repair: "Repair",
  qc: "QC",
  internal_use: "Internal Use",
  terima_return: "Return",
  terima_printer_baru: "Penerimaan Printer",
  maintenance: "Maintenance",
};
const role = computed(() =>
  String(auth.user.value?.role || "").replaceAll("-", "_"),
);
const canCreate = computed(() =>
  ["admin", "kepala_teknisi", "warehouse"].includes(role.value),
);
const isInbound = computed(() => form.jenis_tugas.startsWith("terima_"));
const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return rows.value;
  return rows.value.filter((row) =>
    `${row.nomor_surat_tugas || ""} ${kinds[row.jenis_tugas] || row.jenis_tugas || row.jenis_pekerjaan || ""} ${row.status || ""} ${row.tiket?.nomor_tiket || ""}`
      .toLowerCase()
      .includes(query),
  );
});
const selectedTicket = computed(() =>
  options.tickets.find((row) => row.id === form.tiket_id),
);
const availablePrinters = computed(() => {
  return options.printers;
});
const itemChoices = computed(() =>
  itemForm.jenis_barang === "toner" ? options.toners : options.spareparts,
);
const formItemChoices = computed(() =>
  (addItemOpen.value ? addItemKind.value : formItem.jenis_barang) === "toner"
    ? options.toners
    : options.spareparts,
);
const canAddFormItem = computed(
  () => !!editing.value && ["progress", "ready_to_print"].includes(editing.value.status)
    && ["admin", "teknisi"].includes(role.value),
);
const displayedItems = computed(() => [
  ...form.printer_ids.map((id) => ({
    jenis_barang: "printer",
    item: options.printers.find((row) => row.id === id)?.mp_no || id,
    gudang: "-",
    jumlah_pakai: 1,
    keterangan: "",
    printer_id: id,
  })),
  ...(form.jenis_tugas === "terima_printer_baru" && form.new_mp_no
    ? [{ jenis_barang: "printer", item: form.new_mp_no, gudang: "-", jumlah_pakai: 1, keterangan: "", fixed: true }]
    : []),
  ...formItems.value,
]);
const categoryToKinds: Record<string, string[]> = {
  delivery: [
    "kirim_kontrak",
    "terima_tukar",
    "kirim_trial",
    "kirim_stand_by",
    "kirim_event",
    "kirim_sell",
    "kirim_toner",
  ],
  komplain: ["on_site_service", "kirim_back_up", "terima_unit_rusak"],
  internal: ["repair", "qc", "internal_use"],
  inbound: ["terima_return", "terima_printer_baru"],
  maintenance: ["maintenance"],
};
const kindItems = computed(() => {
  const allowed = selectedTicket.value?.kategori
    ? categoryToKinds[selectedTicket.value.kategori] || []
    : Object.keys(kinds);
  return Object.entries(kinds)
    .filter(
      ([key]) =>
        allowed.includes(key) &&
        (role.value !== "warehouse" || key.startsWith("terima_")),
    )
    .map(([value, label]) => ({ label, value }));
});
const modeItems = computed(() =>
  form.jenis_tugas === "kirim_kontrak"
    ? [
        { label: "Baru", value: "baru" },
        { label: "Tukar", value: "tukar" },
      ]
    : [
        { label: "Sementara", value: "sementara" },
        { label: "Permanen", value: "permanen" },
      ],
);
const customerItems = computed(() =>
  options.customers
    .filter((row) => row.aktif !== false)
    .map((row) => {
      const account =
        options.accounts.find((item) => item.id === row.account_id) ||
        row.master_account ||
        row.account;
      return {
        label: `${row.nama_customer}${account?.nama_account ? ` · ${account.nama_account}` : ""}`,
        value: row.id,
      };
    }),
);
const warehouseItems = computed(() =>
  options.warehouses
    .filter((row) => row.aktif !== false)
    .map((row) => ({ label: row.nama_gudang, value: row.id })),
);
const technicianItems = computed(() => {
  const technicians = options.users
    .filter(
      (row) =>
        (row.role || row.peran) === "teknisi" &&
        (row.active ?? row.aktif ?? true),
    )
    .map((row) => ({
      label: row.name || row.nama_lengkap || row.user_id,
      value: row.id,
    }));
  const query = technicianSearchTerm.value.trim().toLowerCase();
  const filtered = query
    ? technicians.filter((item) => item.label.toLowerCase().includes(query))
    : technicians.slice(0, 20);
  const selected = technicians.find(
    (item) => item.value === form.pic_teknisi_id,
  );
  return selected && !filtered.some((item) => item.value === selected.value)
    ? [selected, ...filtered]
    : filtered;
});
const warehouseUserItems = computed(() =>
  options.users
    .filter(
      (row) =>
        (row.role || row.peran) === "warehouse" &&
        (row.active ?? row.aktif ?? true),
    )
    .map((row) => ({
      label: row.name || row.nama_lengkap || row.user_id,
      value: row.id,
    })),
);
function printerLocation(row: Row) {
  if (row.lokasi_jenis === "customer" || row.master_customer)
    return `Customer/Site: ${row.master_customer?.nama_customer || row.nama_customer || "-"}${row.master_account?.nama_account ? ` · ${row.master_account.nama_account}` : ""}`;
  if (row.lokasi_jenis === "gudang" || row.master_gudang)
    return `Gudang: ${row.master_gudang?.nama_gudang || row.nama_gudang || "-"}`;
  return `Lokasi: ${row.lokasi_jenis || "lainnya"}`;
}
const printerItems = computed(() =>
  availablePrinters.value.map((row) => ({
    label: `${row.mp_no} · ${row.master_printer_model?.nama_model || row.nama_model || "-"}`,
    value: row.id,
  })),
);
let customerSearchRequest = 0;
let customerSearchTimer: ReturnType<typeof setTimeout> | undefined;
let technicianSearchTimer: ReturnType<typeof setTimeout> | undefined;
let printerSearchRequest = 0;
let printerSearchTimer: ReturnType<typeof setTimeout> | undefined;

function unwrap(response: Row): Row[] {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
async function all(path: string) {
  const response = await request<Row>(`${path}?halaman=1&batas=100`);
  return unwrap(response);
}
async function loadCustomers(query: string, initial = false) {
  const normalized = query.trim();
  if (!initial && normalized.length < 2) return;
  const requestId = ++customerSearchRequest;
  customerLoading.value = true;
  try {
    const params = new URLSearchParams({ halaman: "1", batas: "20" });
    if (normalized) params.set("cari", normalized);
    const response = await request<Row>(`/account/lokasi-customer?${params}`);
    if (requestId === customerSearchRequest)
      options.customers = unwrap(response);
  } catch (error) {
    if (requestId === customerSearchRequest)
      errorMessage.value = message(error, "Pencarian customer gagal.");
  } finally {
    if (requestId === customerSearchRequest) customerLoading.value = false;
  }
}
const printerLocationParams = computed(() => {
  const shouldUseCustomer =
    isInbound.value ||
    ["on_site_service", "maintenance"].includes(form.jenis_tugas);
  return shouldUseCustomer && form.customer_id
    ? { customer_id: form.customer_id }
    : form.gudang_id
      ? { gudang_id: form.gudang_id }
      : {};
});
async function loadPrinters(query = "", initial = false) {
  const normalized = query.trim();
  if (!initial && normalized.length < 2) return;
  const requestId = ++printerSearchRequest;
  printerLoading.value = true;
  try {
    const params = new URLSearchParams({
      halaman: "1",
      batas: "20",
      ...printerLocationParams.value,
    });
    if (normalized) params.set("cari", normalized);
    const response = await request<Row>(`/printer?${params}`);
    if (requestId === printerSearchRequest) {
      const selected = options.printers.filter(
        (row) =>
          form.printer_ids.includes(row.id) ||
          (addItemOpen.value && pendingPrinterIds.value.includes(row.id)) ||
          row.id === form.unit_asal_id,
      );
      options.printers = [
        ...new Map(
          [...selected, ...unwrap(response)].map((row) => [row.id, row]),
        ).values(),
      ];
    }
  } catch (error) {
    if (requestId === printerSearchRequest)
      errorMessage.value = message(error, "Pencarian unit printer gagal.");
  } finally {
    if (requestId === printerSearchRequest) printerLoading.value = false;
  }
}
async function load() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [
      list,
      tickets,
      accounts,
      contracts,
      models,
      warehouses,
      users,
      toners,
      spareparts,
    ] = await Promise.all([
      props.embedded ? Promise.resolve([]) : all("/surat-tugas"),
      props.embedded ? Promise.resolve([]) : all("/tiket"),
      all("/account"),
      canCreate.value ? all("/kontrak") : Promise.resolve([]),
      all("/printer-model"),
      all("/gudang"),
      all("/pengguna"),
      all("/toner"),
      all("/suku-cadang"),
    ]);
    rows.value = list;
    Object.assign(options, {
      tickets,
      accounts,
      contracts,
      models,
      warehouses,
      users,
      toners,
      spareparts,
    });
    await loadPrinters("", true);
  } catch (error) {
    errorMessage.value = message(error, "Data Surat Tugas gagal dimuat.");
  } finally {
    loading.value = false;
  }
}
function resetForm() {
  Object.assign(form, {
    tiket_id: "",
    jenis_tugas: "",
    mode: "",
    account_id: "",
    customer_id: "",
    kontrak_id: "",
    unit_asal_id: "",
    gudang_id: "",
    pic_teknisi_id: "",
    pic_warehouse_id: "",
    lokasi_internal: "",
    sumber: "",
    new_mp_no: "",
    new_model_id: "",
    printer_ids: [],
    hasil: "",
  });
  formTab.value = "detail";
  addItemOpen.value = false;
  formItems.value = [];
  Object.assign(formItem, {
    jenis_barang: "toner",
    item_id: "",
    gudang_id: "",
    jumlah_pakai: 1,
    keterangan: "",
  });
  printerSearch.value = "";
}
function openCreate() {
  editing.value = null;
  resetForm();
  customerSearch.value = "";
  errorMessage.value = "";
  createOpen.value = true;
}
async function openEdit(row: Row) {
  saving.value = true;
  errorMessage.value = "";
  try {
    const response = await request<Row>(`/surat-tugas/${row.id}`);
    const item = response.data || row;
    editing.value = item;
    const ticket = item.tiket || options.tickets.find((value) => value.id === item.tiket_id);
    if (ticket && !options.tickets.some((value) => value.id === ticket.id))
      options.tickets.push(ticket);
    const customer = item.master_customer;
    if (customer && !options.customers.some((value) => value.id === customer.id))
      options.customers = [customer, ...options.customers];
    const printerRows = (item.surat_tugas_printer || []).map((line: Row) =>
      line.master_printer || {
        id: line.printer_id,
        mp_no: line.mp_no,
        model_id: line.model_id,
        serial_number: line.serial_number,
      },
    );
    options.printers = [
      ...new Map(
        [...printerRows, ...options.printers].filter((value) => value?.id).map((value) => [value.id, value]),
      ).values(),
    ];
    Object.assign(form, {
      tiket_id: item.tiket_id || ticket?.id || "",
      jenis_tugas: item.jenis_tugas || item.jenis_pekerjaan || "",
      mode: item.mode || ticket?.mode || "",
      account_id: item.account_id || ticket?.account_id || "",
      customer_id: item.customer_id || ticket?.customer_id || "",
      kontrak_id: item.kontrak_id || ticket?.kontrak_id || "",
      unit_asal_id: item.unit_asal_id || "",
      gudang_id: item.gudang_id || "",
      pic_teknisi_id: item.teknisi_surat_tugas?.[0]?.teknisi_id || "",
      pic_warehouse_id: item.pic_warehouse_id || "",
      lokasi_internal: item.lokasi_internal || ticket?.lokasi_internal || "",
      sumber: item.sumber || "",
      new_mp_no: item.surat_tugas_printer?.[0]?.mp_no || "",
      new_model_id: item.surat_tugas_printer?.[0]?.model_id || "",
      printer_ids: printerRows.map((value: Row) => value.id).filter(Boolean),
      hasil: item.hasil || "",
    });
    formTab.value = "detail";
    addItemOpen.value = false;
    formItems.value = (item.pemakaian_barang_surat_tugas || []).map(
      (value: Row) => ({ ...value, existing: true }),
    );
    customerSearch.value = "";
    printerSearch.value = "";
    createOpen.value = true;
    await loadPrinters("", true);
  } catch (error) {
    errorMessage.value = message(error, "Surat Tugas gagal dimuat untuk diedit.");
    if (props.embedded && props.suratTugasId) emit("failed", errorMessage.value);
  } finally {
    saving.value = false;
  }
}
function useTicket() {
  const ticket = selectedTicket.value;
  Object.assign(form, {
    account_id: ticket?.account_id || "",
    customer_id: ticket?.customer_id || "",
    mode: ticket?.mode || "",
    kontrak_id: ticket?.kontrak_id || "",
    lokasi_internal: ticket?.lokasi_internal || "",
    jenis_tugas: "",
  });
}
function selectCustomer(customerId: string) {
  const customer = options.customers.find((row) => row.id === customerId);
  form.account_id = customer?.account_id || "";
}
function changeKind() {
  form.printer_ids = [];
  if (form.jenis_tugas !== "kirim_kontrak") form.kontrak_id = "";
}
function payload() {
  const ticket = selectedTicket.value;
  const printer =
    form.jenis_tugas === "terima_printer_baru"
      ? [
          {
            mp_no: form.new_mp_no.trim(),
            model_id: form.new_model_id,
            sumber: form.sumber.trim(),
            peran: "utama",
          },
        ]
      : options.printers
          .filter((row) => form.printer_ids.includes(row.id))
          .map((row) => ({
            printer_id: row.id,
            mp_no: row.mp_no,
            model_id: row.model_id,
            serial_number: row.serial_number,
            peran: "utama",
          }));
  return {
    tiket_id: form.tiket_id || null,
    jenis_tugas: form.jenis_tugas,
    mode: form.mode || null,
    account_id: ticket?.account_id || form.account_id || null,
    customer_id: ticket?.customer_id || form.customer_id || null,
    kontrak_id: ticket?.kontrak_id || form.kontrak_id || null,
    unit_asal_id: form.unit_asal_id || null,
    gudang_id: form.gudang_id || null,
    pic_teknisi_id: form.pic_teknisi_id || null,
    pic_warehouse_id: form.pic_warehouse_id || null,
    lokasi_internal: form.lokasi_internal || null,
    sumber: form.sumber || null,
    printer,
  };
}
function addFormItem() {
  if (!canAddFormItem.value) return;
  if (!formItem.item_id || !formItem.gudang_id || formItem.jumlah_pakai < 1) {
    errorMessage.value = "Pilih item, gudang, dan jumlah pemakaian.";
    return;
  }
  const selected = formItemChoices.value.find(
    (value) => value.id === formItem.item_id,
  );
  formItems.value.push({
    jenis_barang: formItem.jenis_barang,
    item_id: formItem.item_id,
    gudang_id: formItem.gudang_id,
    jumlah_pakai: Number(formItem.jumlah_pakai),
    keterangan: formItem.keterangan || "",
    label: selected?.nama_toner || selected?.nama_suku_cadang || "-",
  });
  Object.assign(formItem, {
    item_id: "",
    jumlah_pakai: 1,
    keterangan: "",
  });
  errorMessage.value = "";
  addItemOpen.value = false;
}
function openAddItem() {
  pendingPrinterIds.value = [...form.printer_ids];
  addItemKind.value = "printer";
  addItemOpen.value = true;
}
function confirmAddItem() {
  if (addItemKind.value === "printer") {
    if (form.jenis_tugas === "terima_printer_baru") {
      addItemOpen.value = false;
      formTab.value = "detail";
      return;
    }
    form.printer_ids = [...pendingPrinterIds.value];
    addItemOpen.value = false;
    return;
  }
  formItem.jenis_barang = addItemKind.value;
  addFormItem();
}
function removeFormItem(index: number) {
  if (!formItems.value[index]?.existing) formItems.value.splice(index, 1);
}
function formItemName(item: Row) {
  return (
    item.item ||
    item.label ||
    item.master_toner?.nama_toner ||
    item.master_suku_cadang?.nama_suku_cadang ||
    item.toner_id || item.suku_cadang_id || "-"
  );
}
function formItemWarehouse(item: Row) {
  return (
    warehouseItems.value.find((warehouse) => warehouse.value === item.gudang_id)
      ?.label ||
    item.master_gudang?.nama_gudang ||
    "-"
  );
}
async function saveFormItems(suratId: string) {
  for (const item of formItems.value.filter((value) => !value.existing)) {
    const response = await request<Row>(`/surat-tugas/${suratId}/pemakaian`, {
      method: "POST",
      body: {
        gudang_id: item.gudang_id,
        jenis_barang: item.jenis_barang,
        jumlah_pakai: Number(item.jumlah_pakai),
        keterangan: item.keterangan || null,
        ...(item.jenis_barang === "toner"
          ? { toner_id: item.item_id }
          : { suku_cadang_id: item.item_id }),
      },
    });
    item.id = response.data?.id;
    item.existing = true;
  }
}
async function create() {
  if (props.embedded && !selectedTicket.value) {
    errorMessage.value = "Tiket belum berhasil dimuat.";
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    await request("/surat-tugas", {
      method: "POST",
      body: payload(),
    });
    createOpen.value = false;
    successMessage.value = "Surat Tugas berhasil dibuat.";
    if (props.embedded) emit("created");
    else await load();
  } catch (error) {
    errorMessage.value = message(error, "Surat Tugas gagal dibuat.");
  } finally {
    saving.value = false;
  }
}
async function saveEdit() {
  if (!editing.value) return;
  saving.value = true;
  errorMessage.value = "";
  try {
    const ticket = selectedTicket.value;
    const selectedPrinter = options.printers.find((row) => form.printer_ids.includes(row.id));
    await request(`/surat-tugas/${editing.value.id}`, {
      method: "PUT",
      body: {
        account_id: ticket?.account_id || form.account_id,
        customer_id: ticket?.customer_id || form.customer_id,
        pic_teknisi_id: form.pic_teknisi_id || null,
        jenis_pekerjaan: form.jenis_tugas,
        mode: form.mode || null,
        printer_id: selectedPrinter?.id || null,
        mp_no: selectedPrinter?.mp_no || form.new_mp_no || null,
        hasil: form.hasil || null,
      },
    });
    await saveFormItems(editing.value.id);
    createOpen.value = false;
    editing.value = null;
    successMessage.value = "Surat Tugas berhasil diperbarui.";
    await load();
  } catch (error) {
    errorMessage.value = message(error, "Surat Tugas gagal diperbarui.");
  } finally {
    saving.value = false;
  }
}
async function openDetail(row: Row) {
  try {
    const response = await request<Row>(`/surat-tugas/${row.id}`);
    detail.value = response.data;
    tab.value = "general";
    form.hasil = detail.value?.hasil || "";
    Object.keys(resultForms).forEach((key) => delete resultForms[key]);
    detail.value?.surat_tugas_printer?.forEach((line: Row) => {
      resultForms[line.id] = {
        hasil: line.hasil || "",
        kondisi_hasil: line.kondisi_hasil || "",
        alasan: line.alasan || "",
      };
    });
    detailOpen.value = true;
  } catch (error) {
    errorMessage.value = message(error, "Detail Surat Tugas gagal dimuat.");
  }
}
function canAct(action: string, row = detail.value) {
  if (!row) return false;
  const leader = ["admin", "kepala_teknisi"].includes(role.value);
  const worker = ["admin", "teknisi"].includes(role.value);
  const store = ["admin", "warehouse"].includes(role.value);
  if (action === "start")
    return (leader || (store && isInboundRow(row))) && row.status === "pending";
  if (action === "ready-to-print")
    return worker && row.status === "progress" && !isInboundRow(row);
  if (action === "keluar")
    return (
      store &&
      row.status === "ready_to_print" &&
      !row.konfirmasi_keluar_pada &&
      !isInboundRow(row) &&
      (String(row.jenis_tugas || "").startsWith("kirim_") ||
        (row.pemakaian_barang_surat_tugas || []).length > 0) &&
      (row.jenis_tugas !== "kirim_toner" ||
        (row.pemakaian_barang_surat_tugas || []).some((item: Row) => item.jenis_barang === "toner"))
    );
  if (action === "serah")
    return (
      worker &&
      row.status === "ready_to_print" &&
      !row.konfirmasi_serah_pada &&
      String(row.jenis_tugas || "").startsWith("kirim_") &&
      (row.konfirmasi_keluar_pada ||
        (row.jenis_tugas === "kirim_kontrak" && row.tiket?.tiket_asal_id))
    );
  if (action === "terima")
    return (
      store &&
      row.status === "progress" &&
      !row.konfirmasi_terima_pada &&
      isInboundRow(row)
    );
  if (action === "selesai")
    return (
      isInboundRow(row)
        ? store && row.status === "warehouse_validated"
        : worker && row.status === "ready_to_print" &&
          (!String(row.jenis_tugas || "").startsWith("kirim_") || !!row.konfirmasi_serah_pada) &&
          (!(row.pemakaian_barang_surat_tugas || []).some((item: Row) => item.jenis_barang !== "printer") || !!row.konfirmasi_keluar_pada)
    );
  if (action === "resolve")
    return (
      leader &&
      (row.status === "technician_completed" ||
        (isInboundRow(row) && row.status === "warehouse_validated"))
    );
  if (action === "cancel")
    return (
      (leader || (store && isInboundRow(row))) &&
      !["solved", "cancelled"].includes(row.status) &&
      !row.konfirmasi_keluar_pada &&
      !row.konfirmasi_serah_pada &&
      !row.konfirmasi_terima_pada
    );
  return false;
}
const workflowLabels: Record<string, string> = {
  start: "Mulai",
  "ready-to-print": "Siap Cetak",
  keluar: "Konfirmasi Keluar",
  serah: "Konfirmasi Serah",
  terima: "Konfirmasi Terima",
  selesai: "Selesai Pekerjaan",
  resolve: "Resolve",
};
function nextWorkflowAction(row: Row | null) {
  if (!row) return null;
  return ["start", "ready-to-print", "keluar", "serah", "terima", "selesai", "resolve"]
    .find((name) => canAct(name, row)) || null;
}
function completedWorkflowLabel(row: Row) {
  if (row.status === "ready_to_print") return "Siap Cetak";
  if (row.status === "technician_completed") return "Selesai Pekerjaan";
  if (row.status === "warehouse_validated") return "Konfirmasi Terima";
  return "Mulai";
}
function isInboundRow(row: Row) {
  return String(row.jenis_tugas || "").startsWith("terima_");
}
async function action(name: string, row = detail.value) {
  if (
    !row ||
    (name === "cancel" && !window.confirm("Batalkan Surat Tugas ini?"))
  )
    return;
  saving.value = true;
  errorMessage.value = "";
  try {
    await request(`/surat-tugas/${row.id}/${name}`, {
      method: "POST",
      body: name === "selesai" ? { hasil: form.hasil || null } : undefined,
    });
    successMessage.value = "Status Surat Tugas diperbarui.";
    await load();
    if (createOpen.value) await openEdit(row);
    else await openDetail(row);
  } catch (error) {
    errorMessage.value = message(error, "Workflow Surat Tugas gagal diproses.");
  } finally {
    saving.value = false;
  }
}
async function assign() {
  if (!detail.value || !form.pic_teknisi_id) return;
  try {
    await request(`/surat-tugas/${detail.value.id}/assign`, {
      method: "POST",
      body: { pic_teknisi_id: form.pic_teknisi_id },
    });
    await openDetail(detail.value);
    successMessage.value = "PIC teknisi ditugaskan.";
  } catch (error) {
    errorMessage.value = message(error, "PIC gagal ditugaskan.");
  }
}
async function saveResult(line: Row) {
  try {
    await request(`/surat-tugas/${detail.value?.id}/printer/${line.id}/hasil`, {
      method: "PUT",
      body: resultForms[line.id],
    });
    await openDetail(detail.value);
    successMessage.value = "Hasil unit tersimpan.";
  } catch (error) {
    errorMessage.value = message(error, "Hasil unit gagal disimpan.");
  }
}
async function addItem() {
  try {
    const body = {
      gudang_id: itemForm.gudang_id,
      jenis_barang: itemForm.jenis_barang,
      jumlah_pakai: Number(itemForm.jumlah_pakai),
      keterangan: itemForm.keterangan || null,
      ...(itemForm.jenis_barang === "toner"
        ? { toner_id: itemForm.item_id }
        : { suku_cadang_id: itemForm.item_id }),
    };
    await request(`/surat-tugas/${detail.value?.id}/pemakaian`, {
      method: "POST",
      body,
    });
    await openDetail(detail.value);
    tab.value = "item";
    successMessage.value = "Item pemakaian ditambahkan.";
  } catch (error) {
    errorMessage.value = message(error, "Item pemakaian gagal ditambahkan.");
  }
}
async function deleteItem(item: Row) {
  if (!detail.value || !window.confirm("Hapus item pemakaian ini?")) return;
  try {
    await request(`/surat-tugas/${detail.value.id}/pemakaian/${item.id}`, {
      method: "DELETE",
    });
    await openDetail(detail.value);
    tab.value = "item";
  } catch (error) {
    errorMessage.value = message(error, "Item pemakaian gagal dihapus.");
  }
}
onMounted(async () => {
  if (props.embedded && !props.suratTugasId) createOpen.value = true;
  await load();
  await loadCustomers("", true);
  const ticketId = props.embedded
    ? props.ticketId
    : String(useRoute().query.tiket_id || "");
  if (ticketId && !options.tickets.some((row) => row.id === ticketId)) {
    try {
      const response = await request<Row>(`/tiket/${ticketId}`);
      if (response.data) options.tickets.push(response.data);
    } catch (error) {
      errorMessage.value = message(error, "Tiket gagal dimuat.");
    }
  }
  if (ticketId && options.tickets.some((row) => row.id === ticketId) && !props.suratTugasId) {
    form.tiket_id = ticketId;
    useTicket();
    createOpen.value = true;
  }
  if (props.embedded && props.suratTugasId) await openEdit({ id: props.suratTugasId });
});
watch(createOpen, (open) => {
  if (props.embedded && !open) emit("close");
});
watch(customerSearch, (value) => {
  if (customerSearchTimer) clearTimeout(customerSearchTimer);
  customerSearchTimer = setTimeout(() => loadCustomers(value), 300);
});
watch(technicianSearch, (value) => {
  if (technicianSearchTimer) clearTimeout(technicianSearchTimer);
  technicianLoading.value = true;
  technicianSearchTimer = setTimeout(() => {
    technicianSearchTerm.value = value;
    technicianLoading.value = false;
  }, 300);
});
watch(printerSearch, (value) => {
  if (printerSearchTimer) clearTimeout(printerSearchTimer);
  printerLoading.value = true;
  printerSearchTimer = setTimeout(() => loadPrinters(value), 300);
});
watch(
  [() => form.customer_id, () => form.gudang_id, () => form.jenis_tugas],
  () => {
    if (createOpen.value) loadPrinters("", true);
  },
);
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      v-if="!embedded"
      title="Surat Tugas"
      description="Kelola penugasan, unit printer, pemakaian barang, dan workflow operasional."
    />
    <UAlert
      v-if="!embedded && errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UAlert
      v-if="!embedded && successMessage"
      color="success"
      variant="subtle"
      :title="successMessage"
    />
    <UCard v-if="!embedded">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Cari nomor, jenis, tiket, atau status"
          class="w-full lg:max-w-md"
        />
        <div class="flex gap-2 lg:ms-auto">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            aria-label="Refresh data"
            :loading="loading"
            @click="load"
          /><UButton
            v-if="canCreate"
            icon="i-lucide-plus"
            label="Buat Surat Tugas"
            @click="openCreate"
          />
        </div>
      </div>
    </UCard>
    <UCard v-if="!embedded">
      <UTable
        :data="filteredRows"
        :columns="[
          { accessorKey: 'nomor_surat_tugas', header: 'Nomor ST' },
          { accessorKey: 'jenis_tugas', header: 'Jenis' },
          { accessorKey: 'tiket', header: 'Tiket' },
          { accessorKey: 'master_customer', header: 'Customer' },
          { accessorKey: 'status', header: 'Status' },
          { id: 'actions', header: 'Aksi' },
        ]"
        :loading="loading"
      >
        <template #jenis_tugas-cell="{ row }">{{
          kinds[row.original.jenis_tugas] || row.original.jenis_pekerjaan || "-"
        }}</template>
        <template #tiket-cell="{ row }">{{
          row.original.tiket?.nomor_tiket || "Mandiri"
        }}</template>
        <template #master_customer-cell="{ row }">{{
          row.original.master_customer?.nama_customer || "-"
        }}</template>
        <template #status-cell="{ row }"
          ><UBadge
            :color="
              ['solved', 'technician_completed'].includes(row.original.status)
                ? 'success'
                : ['cancelled'].includes(row.original.status)
                  ? 'error'
                  : 'info'
            "
            variant="subtle"
            >{{ row.original.status || "-" }}</UBadge
          ></template
        >
        <template #actions-cell="{ row }"
          ><UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            aria-label="Edit Surat Tugas"
            @click="openEdit(row.original)"
        /></template>
        <template #empty
          ><div class="py-10 text-center text-sm text-dimmed">
            {{ loading ? "Memuat data..." : "Belum ada Surat Tugas." }}
          </div></template
        >
      </UTable>
    </UCard>

    <UModal
      v-model:open="createOpen"
      :title="editing ? 'Edit Surat Tugas' : 'Buat Surat Tugas'"
      :ui="{
        content: 'sm:max-w-3xl h-[80vh] max-h-[800px]',
        body: 'overflow-y-auto',
      }"
    >
      <template #body
        ><UForm :state="form" class="space-y-4" @submit="editing ? saveEdit() : create()">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            :title="errorMessage"
          />
          <div class="flex flex-col gap-4 sm:flex-row">
            <nav
              class="flex shrink-0 gap-2 sm:w-36 sm:flex-col"
              aria-label="Bagian Surat Tugas"
            >
              <UButton
                type="button"
                class="justify-start"
                :variant="formTab === 'detail' ? 'soft' : 'ghost'"
                color="neutral"
                @click="formTab = 'detail'"
                >Detil</UButton
              >
              <UButton
                type="button"
                class="justify-start"
                :variant="formTab === 'items' ? 'soft' : 'ghost'"
                color="neutral"
                @click="formTab = 'items'"
                >Items ({{ displayedItems.length }})</UButton
              >
            </nav>
            <div class="min-w-0 flex-1 space-y-4">
          <div v-if="formTab === 'detail'" class="space-y-4">
          <div class="grid gap-4">
            <UFormField :label="embedded ? 'Tiket' : 'Tiket (opsional)'"
              ><UInput
                v-if="embedded"
                :model-value="selectedTicket?.nomor_tiket || 'Memuat tiket...'"
                readonly
                class="w-full"
              /><USelect
                v-else
                v-model="form.tiket_id"
                :items="
                  options.tickets
                    .filter(
                      (row) => !['solved', 'cancelled'].includes(row.status),
                    )
                    .map((row) => ({
                      label: `${row.nomor_tiket} · ${row.jenis || row.kategori || ''}`,
                      value: row.id,
                    }))
                "
                placeholder="Surat Tugas mandiri"
                class="w-full"
                @update:model-value="useTicket" /></UFormField
            ><UFormField label="Jenis Surat Tugas" required
              ><USelectMenu
                v-model="form.jenis_tugas"
                :items="kindItems"
                value-key="value"
                searchable
                searchable-placeholder="Ketik untuk mencari jenis Surat Tugas"
                placeholder="Pilih jenis"
                class="w-full"
                @update:model-value="changeKind"
            /></UFormField>
          </div>
          <div v-if="!selectedTicket" class="grid gap-4">
            <UFormField
              label="Customer / Site"
              :required="
                ['kirim_kontrak', 'terima_tukar', 'terima_return'].includes(
                  form.jenis_tugas,
                )
              "
              ><USelectMenu
                v-model="form.customer_id"
                v-model:search-term="customerSearch"
                :items="customerItems"
                value-key="value"
                :search-input="{
                  placeholder: 'Ketik untuk mencari customer atau site',
                }"
                :loading="customerLoading"
                placeholder="Pilih customer / site"
                class="w-full"
                @update:model-value="selectCustomer"
            /></UFormField>
          </div>
          <div
            v-if="['kirim_kontrak', 'kirim_back_up'].includes(form.jenis_tugas)"
            class="grid gap-4"
          >
            <UFormField label="Mode" required
              ><USelect
                v-model="form.mode"
                :items="modeItems"
                placeholder="Pilih mode"
                class="w-full" /></UFormField
            ><UFormField
              v-if="
                form.jenis_tugas === 'kirim_kontrak' && form.mode === 'tukar'
              "
              label="Kontrak Aktif"
              required
              ><USelect
                v-model="form.kontrak_id"
                :items="
                  options.contracts
                    .filter(
                      (row) =>
                        row.status === 'aktif' &&
                        row.customer_id === form.customer_id,
                    )
                    .map((row) => ({ label: row.nomor_kontrak, value: row.id }))
                "
                placeholder="Pilih kontrak"
                class="w-full"
            /></UFormField>
          </div>
          <div
            v-if="
              ['kirim_kontrak', 'kirim_back_up'].includes(form.jenis_tugas) &&
              form.mode !== 'baru'
            "
            class="grid gap-4"
          >
            <UFormField label="Unit Lama"
              ><USelect
                v-model="form.unit_asal_id"
                :items="printerItems"
                placeholder="Pilih unit customer"
                class="w-full"
            /></UFormField>
          </div>
          <div
            v-if="
              [
                'kirim_kontrak',
                'kirim_trial',
                'kirim_stand_by',
                'kirim_event',
                'kirim_sell',
                'kirim_back_up',
                'internal_use',
                'kirim_toner',
                'terima_tukar',
                'terima_unit_rusak',
                'terima_return',
                'terima_printer_baru',
              ].includes(form.jenis_tugas)
            "
            class="grid gap-4"
          >
            <UFormField label="Gudang" required
              ><USelect
                v-model="form.gudang_id"
                :items="warehouseItems"
                placeholder="Pilih gudang"
                class="w-full" /></UFormField
            ><UFormField v-if="isInbound" label="PIC Warehouse" required
              ><USelect
                v-model="form.pic_warehouse_id"
                :items="warehouseUserItems"
                placeholder="Pilih PIC warehouse"
                class="w-full"
            /></UFormField>
          </div>
          <UFormField v-if="!isInbound" label="PIC Teknisi" required
            ><USelectMenu
              v-model="form.pic_teknisi_id"
              v-model:search-term="technicianSearch"
              :items="technicianItems"
              value-key="value"
              ignore-filter
              :search-input="{ placeholder: 'Ketik untuk mencari teknisi' }"
              :loading="technicianLoading"
              placeholder="Pilih PIC teknisi"
              class="w-full"
          /></UFormField>
          <UFormField
            v-if="form.jenis_tugas === 'internal_use'"
            label="Divisi / Lokasi Internal"
            required
            ><UInput v-model="form.lokasi_internal" class="w-full"
          /></UFormField>
          <div
            v-if="form.jenis_tugas === 'terima_printer_baru'"
            class="grid gap-4"
          >
            <UFormField label="Sumber / Pemasok" required
              ><UInput v-model="form.sumber" class="w-full" /></UFormField
            ><UFormField label="MP No" required
              ><UInput v-model="form.new_mp_no" class="w-full" /></UFormField
            ><UFormField label="Model" required
              ><USelect
                v-model="form.new_model_id"
                :items="
                  options.models.map((row) => ({
                    label: row.nama_model,
                    value: row.id,
                  }))
                "
                placeholder="Pilih model"
                class="w-full"
            /></UFormField>
          </div>
          <div v-if="editing" class="space-y-3 border-t border-default pt-4">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium">Status</span>
              <UBadge color="neutral" variant="subtle">{{ editing.status }}</UBadge>
            </div>
          </div>
          </div>
          <div v-else class="space-y-5">
            <div class="overflow-x-auto">
              <UTable :data="displayedItems" :columns="formItemColumns">
                <template #jenis_barang-cell="{ row }">{{ row.original.jenis_barang === 'suku_cadang' ? 'Sparepart' : row.original.jenis_barang === 'printer' ? 'Printer' : 'Toner' }}</template>
                <template #item-cell="{ row }">{{ formItemName(row.original) }}</template>
                <template #gudang-cell="{ row }">{{ formItemWarehouse(row.original) }}</template>
                <template #keterangan-cell="{ row }">{{ row.original.keterangan || '-' }}</template>
                <template #actions-cell="{ row }">
                  <UButton v-if="row.original.printer_id" type="button" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Hapus printer" @click="form.printer_ids = form.printer_ids.filter((id) => id !== row.original.printer_id)" />
                  <UButton v-else-if="!row.original.existing && !row.original.fixed" type="button" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Hapus item" @click="removeFormItem(formItems.indexOf(row.original))" />
                </template>
                <template #empty><div class="py-8 text-center text-sm text-dimmed">Belum ada item.</div></template>
              </UTable>
            </div>
            <UAlert v-if="!editing" color="info" variant="subtle" title="Toner dan Sparepart dapat ditambahkan setelah Surat Tugas dimulai" />
            <div class="flex justify-end">
              <UButton type="button" color="primary" variant="outline" @click="openAddItem">Tambah Item</UButton>
            </div>
          </div>
            </div>
          </div>
          <div class="overflow-x-auto pb-1">
            <div class="ms-auto flex w-max items-center gap-2">
            <div v-if="editing && nextWorkflowAction(editing)" class="flex w-44 shrink-0 items-center">
              <UButton
                type="button"
                color="primary"
                variant="outline"
                class="min-w-0 flex-1 justify-center rounded-e-none"
                :loading="saving"
                :disabled="saving"
                @click="action(nextWorkflowAction(editing)!, editing)"
              >{{ workflowLabels[nextWorkflowAction(editing)!] }}</UButton>
              <UDropdownMenu
                v-if="canAct('cancel', editing)"
                :items="[{ label: 'Batalkan', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => action('cancel', editing) }]"
                :content="{ align: 'end' }"
              >
                <UButton
                  type="button"
                  icon="i-lucide-chevron-down"
                  color="primary"
                  variant="outline"
                  class="-ms-px rounded-s-none"
                  aria-label="Tampilkan aksi Batalkan"
                  :disabled="saving"
                />
              </UDropdownMenu>
            </div>
            <div v-else-if="editing && canAct('cancel', editing)" class="flex w-44 shrink-0 items-center">
              <UButton type="button" color="primary" variant="outline" class="min-w-0 flex-1 justify-center rounded-e-none" disabled>
                {{ completedWorkflowLabel(editing) }}
              </UButton>
              <UDropdownMenu
                :items="[{ label: 'Batalkan', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => action('cancel', editing) }]"
                :content="{ align: 'end' }"
              >
                <UButton type="button" icon="i-lucide-chevron-down" color="primary" variant="outline" class="-ms-px rounded-s-none" aria-label="Tampilkan aksi Batalkan" :disabled="saving" />
              </UDropdownMenu>
            </div>
            <UButton
              type="submit"
              class="w-44 shrink-0 justify-center"
              :loading="saving || (embedded && loading)"
              :disabled="embedded && !selectedTicket"
            >Simpan</UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal
      v-model:open="addItemOpen"
      title="Tambah Item"
      :ui="{
        content: 'w-full max-w-lg h-[480px] max-h-[85dvh]',
        body: 'min-h-0 flex-1 overflow-y-auto',
      }"
    >
      <template #body>
        <div class="flex min-h-full flex-col gap-4">
          <UFormField label="Jenis item">
            <USelect
              v-model="addItemKind"
              :items="[
                { label: 'Printer', value: 'printer' },
                ...(canAddFormItem ? [{ label: 'Toner', value: 'toner' }, { label: 'Sparepart', value: 'suku_cadang' }] : []),
              ]"
              class="w-full"
              @update:model-value="formItem.item_id = ''"
            />
          </UFormField>
          <UAlert v-if="addItemKind === 'printer' && form.jenis_tugas === 'terima_printer_baru'" color="info" variant="subtle" title="Printer baru diisi pada tab Detil" description="Isi MP No dan model printer baru pada tab Detil Surat Tugas." />
          <UFormField v-else-if="addItemKind === 'printer'" label="Printer">
            <USelectMenu
              v-model="pendingPrinterIds"
              v-model:search-term="printerSearch"
              :items="printerItems"
              value-key="value"
              multiple
              ignore-filter
              :search-input="{ placeholder: 'Cari MP No, serial, customer/site, atau gudang' }"
              :loading="printerLoading"
              placeholder="Pilih printer"
              class="w-full"
            />
          </UFormField>
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Item" class="sm:col-span-2">
              <USelect v-model="formItem.item_id" :items="formItemChoices.map((row) => ({ label: row.nama_toner || row.nama_suku_cadang, value: row.id }))" placeholder="Pilih item" class="w-full" />
            </UFormField>
            <UFormField label="Gudang"><USelect v-model="formItem.gudang_id" :items="warehouseItems" placeholder="Pilih gudang" class="w-full" /></UFormField>
            <UFormField label="Jumlah"><UInput v-model.number="formItem.jumlah_pakai" type="number" min="1" class="w-full" /></UFormField>
            <UFormField label="Keterangan" class="sm:col-span-2"><UInput v-model="formItem.keterangan" class="w-full" /></UFormField>
          </div>
          <p v-if="errorMessage && addItemKind !== 'printer'" class="text-sm text-error">{{ errorMessage }}</p>
          <div class="mt-auto flex justify-end gap-2 pt-4">
            <UButton type="button" color="neutral" variant="ghost" @click="addItemOpen = false">Batal</UButton>
            <UButton type="button" @click="confirmAddItem">Tambahkan</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-if="!embedded"
      v-model:open="detailOpen"
      :title="detail?.nomor_surat_tugas || 'Detail Surat Tugas'"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body
        ><div v-if="detail" class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge color="info" variant="subtle">{{
              kinds[detail.jenis_tugas] || detail.jenis_pekerjaan
            }}</UBadge
            ><UBadge color="neutral" variant="subtle">{{
              detail.status
            }}</UBadge
            ><span class="text-sm text-dimmed"
              >{{ detail.tiket?.nomor_tiket || "Mandiri" }} ·
              {{
                detail.master_customer?.nama_customer || "Tanpa customer"
              }}</span
            >
          </div>
          <div class="flex gap-1 overflow-x-auto border-b border-default">
            <UButton
              v-for="item in [
                { value: 'general', label: 'General' },
                { value: 'unit', label: 'Unit Printer' },
                { value: 'item', label: 'Item' },
              ]"
              :key="item.value"
              size="sm"
              :variant="tab === item.value ? 'soft' : 'ghost'"
              @click="tab = item.value"
              >{{ item.label }}</UButton
            >
          </div>
          <div v-if="tab === 'general'" class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <UCard
                ><p class="text-sm text-dimmed">PIC Teknisi</p>
                <p class="font-medium text-highlighted">
                  {{
                    detail.teknisi_surat_tugas?.[0]?.master_pengguna?.name ||
                    detail.teknisi_surat_tugas?.[0]?.master_pengguna
                      ?.nama_lengkap ||
                    "-"
                  }}
                </p></UCard
              ><UCard
                ><p class="text-sm text-dimmed">Konfirmasi</p>
                <p class="text-sm text-highlighted">
                  Keluar: {{ detail.konfirmasi_keluar_pada ? "Ya" : "Belum" }} ·
                  Serah: {{ detail.konfirmasi_serah_pada ? "Ya" : "Belum" }} ·
                  Terima: {{ detail.konfirmasi_terima_pada ? "Ya" : "Belum" }}
                </p></UCard
              >
            </div>
            <div
              v-if="
                !detail.teknisi_surat_tugas?.length &&
                detail.status === 'pending' &&
                ['admin', 'kepala_teknisi'].includes(role)
              "
              class="flex gap-2"
            >
              <USelectMenu
                v-model="form.pic_teknisi_id"
                v-model:search-term="technicianSearch"
                :items="technicianItems"
                value-key="value"
                ignore-filter
                :search-input="{ placeholder: 'Ketik untuk mencari teknisi' }"
                :loading="technicianLoading"
                placeholder="Pilih teknisi"
                class="w-full"
              /><UButton color="neutral" variant="outline" @click="assign"
                >Assign PIC</UButton
              >
            </div>
            <UFormField label="Hasil pekerjaan"
              ><UTextarea v-model="form.hasil" class="w-full"
            /></UFormField>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="name in [
                  'start',
                  'ready-to-print',
                  'keluar',
                  'serah',
                  'terima',
                  'selesai',
                  'resolve',
                  'cancel',
                ]"
                v-show="canAct(name)"
                :key="name"
                size="sm"
                :color="name === 'cancel' ? 'error' : 'primary'"
                :loading="saving"
                @click="action(name)"
                >{{
                  {
                    start: "Mulai",
                    "ready-to-print": "Siap Cetak",
                    keluar: "Konfirmasi Keluar",
                    serah: "Konfirmasi Serah",
                    terima: "Konfirmasi Terima",
                    selesai: "Selesai Pekerjaan",
                    resolve: "Resolve",
                    cancel: "Batalkan",
                  }[name]
                }}</UButton
              >
            </div>
          </div>
          <div v-else-if="tab === 'unit'" class="space-y-3">
            <UCard
              v-for="line in detail.surat_tugas_printer || []"
              :key="line.id"
              ><div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-highlighted">{{ line.mp_no }}</p>
                  <p class="text-sm text-dimmed">
                    {{ line.peran }} ·
                    {{ line.serial_number || "Serial belum diisi" }}
                  </p>
                </div>
                <div
                  v-if="
                    [
                      'progress',
                      'ready_to_print',
                      'technician_completed',
                    ].includes(detail.status) &&
                    ['admin', 'teknisi'].includes(role)
                  "
                  class="grid min-w-64 gap-2"
                >
                  <UInput
                    v-model="resultForms[line.id].hasil"
                    placeholder="Hasil"
                  /><USelect
                    v-if="['qc', 'repair'].includes(detail.jenis_tugas)"
                    v-model="resultForms[line.id].kondisi_hasil"
                    :items="
                      [
                        'ready',
                        'ready_with_condition',
                        'need_repair',
                        'unready',
                        'kanibal',
                      ].map((value) => ({ label: value, value }))
                    "
                    placeholder="Kondisi hasil"
                  /><UInput
                    v-model="resultForms[line.id].alasan"
                    placeholder="Alasan / keterangan"
                  /><UButton size="sm" @click="saveResult(line)"
                    >Simpan Hasil</UButton
                  >
                </div>
                <p v-else class="text-sm text-dimmed">
                  {{ line.hasil || "Belum ada hasil."
                  }}{{ line.kondisi_hasil ? ` · ${line.kondisi_hasil}` : "" }}
                </p>
              </div></UCard
            >
            <div
              v-if="!detail.surat_tugas_printer?.length"
              class="py-8 text-center text-sm text-dimmed"
            >
              Tidak ada unit printer.
            </div>
          </div>
          <div v-else class="space-y-4">
            <UTable
              :data="detail.pemakaian_barang_surat_tugas || []"
              :columns="[
                { accessorKey: 'jenis_barang', header: 'Jenis' },
                { accessorKey: 'jumlah_pakai', header: 'Jumlah' },
                { accessorKey: 'master_gudang', header: 'Gudang' },
                { id: 'actions', header: '' },
              ]"
              ><template #master_gudang-cell="{ row }">{{
                row.original.master_gudang?.nama_gudang || "-"
              }}</template
              ><template #actions-cell="{ row }"
                ><UButton
                  v-if="
                    ['admin', 'teknisi'].includes(role) &&
                    ['progress', 'ready_to_print'].includes(detail.status)
                  "
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Hapus item"
                  @click="deleteItem(row.original)" /></template
              ><template #empty
                ><div class="py-8 text-center text-sm text-dimmed">
                  Belum ada item.
                </div></template
              ></UTable
            ><UForm
              v-if="
                ['admin', 'teknisi'].includes(role) &&
                ['progress', 'ready_to_print'].includes(detail.status)
              "
              :state="itemForm"
              class="grid gap-3 sm:grid-cols-2"
              @submit="addItem"
              ><USelect
                v-model="itemForm.jenis_barang"
                :items="[
                  { label: 'Toner', value: 'toner' },
                  { label: 'Sparepart', value: 'suku_cadang' },
                ]"
              /><USelect
                v-model="itemForm.item_id"
                :items="
                  itemChoices.map((row) => ({
                    label: row.nama_toner || row.nama_suku_cadang,
                    value: row.id,
                  }))
                "
                placeholder="Pilih item"
              /><USelect
                v-model="itemForm.gudang_id"
                :items="warehouseItems"
                placeholder="Pilih gudang"
              /><UInput
                v-model.number="itemForm.jumlah_pakai"
                type="number"
                min="1"
              /><UInput
                v-model="itemForm.keterangan"
                placeholder="Catatan"
              /><UButton type="submit">Tambah Item</UButton></UForm
            >
          </div>
        </div></template
      >
    </UModal>
  </div>
</template>
