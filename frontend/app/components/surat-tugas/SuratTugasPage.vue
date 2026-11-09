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
const formTab = ref<"detail" | "items" | "unit">("detail");
const formItems = ref<Row[]>([]);
const addItemOpen = ref(false);
const addItemKind = ref("printer");
const pendingPrinterIds = ref<string[]>([]);
const removedPrinterLineIds = ref<string[]>([]);
const formItemColumns = [
  { accessorKey: "jenis_barang", header: "Jenis" },
  { accessorKey: "item", header: "Item" },
  { accessorKey: "gudang", header: "Gudang" },
  { accessorKey: "jumlah_pakai", header: "Jumlah" },
  { accessorKey: "keterangan", header: "Keterangan" },
  { id: "actions", header: "" },
];
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
  kirim_sell: "Penjualan Printer",
  kirim_toner: "Penjualan Toner",
  on_site_service: "On-site Service",
  kirim_back_up: "Back-up",
  terima_unit_rusak: "Terima Unit Rusak",
  repair: "Repair",
  qc: "QC",
  internal_use: "Internal Use",
  terima_return: "Return",
  terima_printer_baru: "Printer Baru",
  maintenance: "Maintenance",
};
const role = computed(() =>
  String(auth.user.value?.role || "").replaceAll("-", "_"),
);
const unitPrinterKinds = ["repair", "on_site_service", "maintenance"];
const serviceHandoverKinds = ["on_site_service", "repair", "maintenance"];
const warehouseOutboundKinds = [
  "kirim_kontrak",
  "kirim_trial",
  "kirim_stand_by",
  "kirim_event",
  "kirim_sell",
  "kirim_toner",
  "kirim_back_up",
  "internal_use",
  ...serviceHandoverKinds,
];
const canShowUnitPrinterTab = computed(() => Boolean(
  editing.value
  && unitPrinterKinds.includes(editing.value.jenis_tugas)
  && editing.value.surat_tugas_printer?.length,
));
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
function accountCode(value: string | null | undefined) {
  if (!value) return "";
  return options.accounts.find((row) => row.kode_account === value || row.id === value)?.kode_account || value;
}
function customerCode(value: string | null | undefined) {
  if (!value) return "";
  return options.customers.find((row) => row.kode_customer === value || row.id === value)?.kode_customer || value;
}
const maintenancePrinterId = computed({
  get: () => form.printer_ids[0] || "",
  set: (value: string) => {
    form.printer_ids = value ? [value] : [];
  },
});
const solvedDetails = computed(() => {
  if (editing.value?.status !== "solved") return [];
  const fields: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== "") fields.push({ label, value: String(value) });
  };
  const label = (items: Row[], id: string, key: string) => items.find((item) => item.id === id || item.kode_account === id || item.kode_customer === id)?.[key] || id;
  add("Tiket", selectedTicket.value?.nomor_tiket || editing.value.tiket?.nomor_tiket);
  add("Jenis Surat Tugas", kinds[form.jenis_tugas] || form.jenis_tugas);
  add("Customer / Site", label(options.customers, form.customer_id, "nama_customer"));
  add("Mode", modeItems.value.find((item) => item.value === form.mode)?.label || form.mode);
  add("Kontrak Aktif", label(options.contracts, form.kontrak_id, "nomor_kontrak"));
  add("Unit Lama", label(options.printers, form.unit_asal_id, "mp_no"));
  add("Gudang", label(options.warehouses, form.gudang_id, "nama_gudang"));
  add("PIC Warehouse", label(options.users, form.pic_warehouse_id, "nama_lengkap"));
  if (form.jenis_tugas === "maintenance") add("Unit Printer", label(options.printers, maintenancePrinterId.value, "mp_no"));
  add("PIC Teknisi", technicianItems.value.find((item) => item.value === form.pic_teknisi_id)?.label || form.pic_teknisi_id);
  add("Divisi / Lokasi Internal", form.lokasi_internal);
  add("Sumber / Pemasok", form.sumber);
  if (form.jenis_tugas === "terima_printer_baru") add("MP No", form.new_mp_no);
  if (form.jenis_tugas === "terima_printer_baru") add("Model", label(options.models, form.new_model_id, "nama_model"));
  add("Hasil pekerjaan", editing.value.hasil);
  add("Status", editing.value.status);
  return fields;
});
const availablePrinters = computed(() => {
  return options.printers;
});
const formItemChoices = computed(() =>
  (addItemOpen.value ? addItemKind.value : formItem.jenis_barang) === "toner"
    ? options.toners
    : options.spareparts,
);
const canAddFormItem = computed(
  () => !!editing.value && ["pending", "progress"].includes(editing.value.status)
    && ["admin", "kepala_teknisi", "teknisi"].includes(role.value)
    && !editing.value.konfirmasi_keluar_pada,
);
const printerIsServiceObject = computed(() => form.jenis_tugas === "maintenance"
  || (form.jenis_tugas === "on_site_service" && !!form.tiket_id));
const displayedItems = computed(() => [
  ...(printerIsServiceObject.value ? [] : form.printer_ids.map((id) => ({
    jenis_barang: "printer",
    item: options.printers.find((row) => row.id === id)?.mp_no || id,
    gudang: "-",
    jumlah_pakai: 1,
    keterangan: "",
    printer_id: id,
    fixed: false,
    line_id: editing.value?.surat_tugas_printer?.find((line: Row) => line.printer_id === id || line.mp_no === options.printers.find((row) => row.id === id)?.mp_no)?.id,
    existing: !!editing.value?.pemakaian_barang_surat_tugas?.some((line: Row) => line.jenis_barang === "printer" && line.master_printer?.id === id),
  }))),
  ...(form.jenis_tugas === "terima_printer_baru" && form.new_mp_no
    ? [{ jenis_barang: "printer", item: form.new_mp_no, gudang: "-", jumlah_pakai: 1, keterangan: "", fixed: true }]
    : []),
  ...formItems.value.filter((item) => item.jenis_barang !== "printer"),
]);
const categoryToKinds: Record<string, string[]> = {
  delivery: [
    "kirim_kontrak",
    "terima_return",
    "kirim_trial",
    "kirim_stand_by",
    "kirim_event",
    "kirim_sell",
    "kirim_toner",
  ],
  komplain: ["on_site_service", "kirim_back_up", "terima_return"],
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
        !["terima_tukar", "terima_unit_rusak"].includes(key) &&
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
        value: row.kode_customer,
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
  availablePrinters.value
    .filter((row) => form.printer_ids.includes(row.id) || form.jenis_tugas !== "maintenance" || selectedTicket.value || (row.lokasi_jenis === "gudang" && row.gudang_id === form.gudang_id))
    .map((row) => ({
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
const selectedCustomerUuid = computed(() => {
  const customer = options.customers.find((row) => row.kode_customer === form.customer_id || row.id === form.customer_id)
    || (selectedTicket.value?.master_customer?.kode_customer === form.customer_id ? selectedTicket.value.master_customer : null)
    || (editing.value?.master_customer?.kode_customer === form.customer_id ? editing.value.master_customer : null);
  return customer?.id || "";
});
const printerLocationParams = computed(() => {
  const shouldUseCustomer =
    isInbound.value ||
    ["on_site_service", "maintenance"].includes(form.jenis_tugas);
  return shouldUseCustomer && form.customer_id
    ? (selectedCustomerUuid.value ? { customer_id: selectedCustomerUuid.value } : {})
    : form.gudang_id
      ? { gudang_id: form.gudang_id }
      : {};
});
async function loadPrinters(query = "", initial = false) {
  const normalized = query.trim();
  if (!initial && normalized.length < 2) return;
  const requestId = ++printerSearchRequest;
  if (form.customer_id && (isInbound.value || ["on_site_service", "maintenance"].includes(form.jenis_tugas)) && !selectedCustomerUuid.value) {
    options.printers = [];
    errorMessage.value = "Customer untuk pencarian unit belum dimuat.";
    return;
  }
  if (form.jenis_tugas === "maintenance" && !selectedTicket.value && !form.gudang_id) {
    options.printers = [];
    return;
  }
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
  removedPrinterLineIds.value = [];
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
  removedPrinterLineIds.value = [];
  try {
    const response = await request<Row>(`/surat-tugas/${row.id}`);
    const item = response.data || row;
    editing.value = item;
    Object.keys(resultForms).forEach((key) => delete resultForms[key]);
    item.surat_tugas_printer?.forEach((line: Row) => {
      resultForms[line.id] = {
        hasil: line.hasil || "",
        kondisi_hasil: line.kondisi_hasil || "",
        alasan: line.alasan || "",
      };
    });
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
    const usedPrinters = (item.pemakaian_barang_surat_tugas || []).filter((line: Row) => line.jenis_barang === "printer").map((line: Row) => line.master_printer).filter(Boolean);
    options.printers = [
      ...new Map(
        [...printerRows, ...usedPrinters, ...options.printers].filter((value) => value?.id).map((value) => [value.id, value]),
      ).values(),
    ];
    Object.assign(form, {
      tiket_id: item.tiket_id || ticket?.id || "",
      jenis_tugas: item.jenis_tugas || item.jenis_pekerjaan || "",
      mode: item.mode || ticket?.mode || "",
      account_id: accountCode(item.account_id || ticket?.account_id),
      customer_id: customerCode(item.customer_id || ticket?.customer_id),
      kontrak_id: item.kontrak_id || ticket?.kontrak_id || "",
      unit_asal_id: item.unit_asal_id || "",
      gudang_id: item.gudang_id || "",
      pic_teknisi_id: item.teknisi_surat_tugas?.[0]?.master_pengguna?.id || item.teknisi_surat_tugas?.[0]?.teknisi_id || "",
      pic_warehouse_id: item.pic_warehouse_id || "",
      lokasi_internal: item.lokasi_internal || ticket?.lokasi_internal || "",
      sumber: item.sumber || "",
      new_mp_no: item.surat_tugas_printer?.[0]?.mp_no || "",
      new_model_id: item.surat_tugas_printer?.[0]?.model_id || "",
      printer_ids: [...printerRows, ...usedPrinters].map((value: Row) => value.id).filter(Boolean),
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
  if (ticket?.master_customer && !options.customers.some((row) => row.id === ticket.master_customer.id))
    options.customers.push(ticket.master_customer);
  Object.assign(form, {
    tiket_id: ticket?.id || form.tiket_id || "",
    account_id: ticket?.master_account?.kode_account || accountCode(ticket?.account_id),
    customer_id: ticket?.master_customer?.kode_customer || customerCode(ticket?.customer_id),
    mode: ticket?.mode || "",
    kontrak_id: ticket?.kontrak_id || "",
    lokasi_internal: ticket?.lokasi_internal || "",
    jenis_tugas: "",
    new_mp_no: ticket?.mp_no || "",
    unit_asal_id: "",
    printer_ids: [],
  });
  if (ticket?.mp_no && !options.printers.some((row) => row.mp_no === ticket.mp_no)) {
    const params = new URLSearchParams({ cari: ticket.mp_no, halaman: "1", batas: "20" });
    request<Row>(`/printer?${params}`).then((response) => {
      const found = unwrap(response).find((row) => row.mp_no === ticket.mp_no);
      if (found && !options.printers.some((row) => row.id === found.id)) options.printers.push(found);
      selectTicketObject();
    }).catch((error) => { errorMessage.value = message(error, "Unit objek Tiket gagal dimuat."); });
  } else selectTicketObject();
}
function selectTicketObject() {
  const unit = options.printers.find((row) => row.mp_no === selectedTicket.value?.mp_no);
  if (!unit) return;
  const replacement = form.jenis_tugas === "kirim_back_up" || form.jenis_tugas === "kirim_kontrak" && form.mode === "tukar";
  if (replacement) form.unit_asal_id = unit.id;
  else if (form.jenis_tugas && !["kirim_toner", "terima_printer_baru"].includes(form.jenis_tugas)) form.printer_ids = [unit.id];
}
function selectCustomer(customerId: string) {
  const customer = options.customers.find((row) => row.kode_customer === customerId || row.id === customerId);
  const account = options.accounts.find((row) => row.id === customer?.account_id || row.kode_account === customer?.account_id);
  form.account_id = account?.kode_account || customer?.master_account?.kode_account || "";
}
function changeKind() {
  if (form.jenis_tugas !== "kirim_kontrak") form.kontrak_id = "";
  if (!form.printer_ids.length) selectTicketObject();
}
function changeWarehouse() {
  if (form.jenis_tugas === "maintenance" && !selectedTicket.value) printerSearch.value = "";
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
            model_id: row.master_printer_model?.id || row.model_id,
            serial_number: row.serial_number,
            peran: form.jenis_tugas === "kirim_back_up" ? "pengganti" : form.jenis_tugas === "terima_tukar" ? "unit_lama" : "utama",
          }));
  return {
    tiket_id: ticket?.id || form.tiket_id || null,
    jenis_tugas: form.jenis_tugas,
    mode: form.mode || null,
    account_id: ticket?.master_account?.kode_account || accountCode(ticket?.account_id || form.account_id) || null,
    customer_id: ticket?.master_customer?.kode_customer || customerCode(ticket?.customer_id || form.customer_id) || null,
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
async function openAddItem() {
  pendingPrinterIds.value = [...form.printer_ids];
  addItemKind.value = printerIsServiceObject.value ? "toner" : "printer";
  printerSearch.value = "";
  addItemOpen.value = true;
  if (addItemKind.value === "printer") await loadPrinters("", true);
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
function removeDisplayedPrinter(item: Row) {
  if (item.line_id && !removedPrinterLineIds.value.includes(item.line_id)) {
    removedPrinterLineIds.value.push(item.line_id);
  }
  form.printer_ids = form.printer_ids.filter((id) => id !== item.printer_id);
}
function formItemName(item: Row) {
  return (
    item.item ||
    item.label ||
    item.master_printer?.mp_no ||
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
async function saveUnitResults(surat: Row, skippedLineIds: string[] = []) {
  for (const line of surat.surat_tugas_printer || []) {
    if (skippedLineIds.includes(line.id)) continue;
    const result = resultForms[line.id];
    if (!result) continue;
    const hasil = result.hasil.trim();
    const alasan = result.alasan.trim();
    if (hasil === (line.hasil || "") && result.kondisi_hasil === (line.kondisi_hasil || "") && alasan === (line.alasan || "")) continue;
    await request(`/surat-tugas/${surat.id}/printer/${line.id}/hasil`, {
      method: "PUT",
      body: { hasil, ...(result.kondisi_hasil ? { kondisi_hasil: result.kondisi_hasil } : {}), alasan: alasan || null },
    });
    line.hasil = hasil;
    line.kondisi_hasil = result.kondisi_hasil;
    line.alasan = alasan;
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
    const detail = (error as { data?: { detail?: { fieldErrors?: Record<string, string[]> } } }).data?.detail?.fieldErrors;
    const fields = detail && Object.entries(detail).flatMap(([field, errors]) => errors.map((item) => `${field}: ${item}`));
    errorMessage.value = fields?.length ? fields.join("; ") : message(error, "Surat Tugas gagal dibuat.");
  } finally {
    saving.value = false;
  }
}
async function saveEdit() {
  if (!editing.value) return;
  if (editing.value.status === "solved") return;
  const surat = editing.value;
  for (const line of surat.surat_tugas_printer || []) {
    const result = resultForms[line.id];
    if (!result) continue;
    const changed = result.hasil.trim() !== (line.hasil || "") || result.kondisi_hasil !== (line.kondisi_hasil || "") || result.alasan.trim() !== (line.alasan || "");
    if (changed && !result.hasil.trim()) {
      errorMessage.value = `Isi Hasil Unit ${line.mp_no}.`;
      formTab.value = "unit";
      return;
    }
    if (changed && ["qc", "repair"].includes(surat.jenis_tugas) && !result.kondisi_hasil) {
      errorMessage.value = `Pilih Kondisi hasil untuk ${line.mp_no}.`;
      formTab.value = "unit";
      return;
    }
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    const ticket = selectedTicket.value;
    await request(`/surat-tugas/${editing.value.id}`, {
      method: "PUT",
      body: {
        account_id: accountCode(ticket?.account_id || form.account_id) || null,
        customer_id: customerCode(ticket?.customer_id || form.customer_id) || null,
        pic_teknisi_id: form.pic_teknisi_id || null,
        jenis_pekerjaan: form.jenis_tugas,
        mode: form.mode || null,
        hasil: form.hasil || null,
      },
    });
    const removedLineIds = [...removedPrinterLineIds.value];
    for (const lineId of removedLineIds) {
      await request(`/surat-tugas/${editing.value.id}/printer/${lineId}`, { method: "DELETE" });
      removedPrinterLineIds.value = removedPrinterLineIds.value.filter((id) => id !== lineId);
    }
    const savedPrinterIds = new Set([
      ...(surat.surat_tugas_printer || []).map((line: Row) => line.printer_id),
      ...(surat.pemakaian_barang_surat_tugas || []).filter((line: Row) => line.jenis_barang === "printer").map((line: Row) => line.master_printer?.id),
    ]);
    const newPrinterIds = form.printer_ids.filter((id) => !savedPrinterIds.has(id));
    if (newPrinterIds.length && !canAddFormItem.value) throw new Error("Item printer tidak dapat ditambahkan pada status Surat Tugas ini.");
    for (const id of newPrinterIds) {
      const printer = options.printers.find((row) => row.id === id);
      if (!printer || !form.gudang_id) throw new Error("Pilih printer dan gudang sebelum menyimpan item.");
      await request(`/surat-tugas/${editing.value.id}/pemakaian`, {
        method: "POST",
        body: { gudang_id: form.gudang_id, jenis_barang: "printer", printer_id: id, jumlah_pakai: 1 },
      });
    }
    await saveFormItems(editing.value.id);
    await saveUnitResults(surat, removedLineIds);
    createOpen.value = false;
    editing.value = null;
    removedPrinterLineIds.value = [];
    successMessage.value = "Surat Tugas berhasil diperbarui.";
    await load();
  } catch (error) {
    errorMessage.value = message(error, "Surat Tugas gagal diperbarui.");
  } finally {
    saving.value = false;
  }
}
function canAct(action: string, row = editing.value) {
  if (!row) return false;
  const leader = ["admin", "kepala_teknisi"].includes(role.value);
  const worker = ["admin", "teknisi"].includes(role.value);
  const store = ["admin", "warehouse"].includes(role.value);
  if (action === "start")
    return (leader || (store && isInboundRow(row))) && row.status === "pending";
  if (action === "keluar")
    return (
      store &&
      row.status === "progress" &&
      !row.konfirmasi_keluar_pada &&
      !isInboundRow(row) &&
      (warehouseOutboundKinds.includes(row.jenis_tugas) ||
        (row.pemakaian_barang_surat_tugas || []).length > 0) &&
      (row.jenis_tugas !== "kirim_toner" ||
        (row.pemakaian_barang_surat_tugas || []).some((item: Row) => item.jenis_barang === "toner"))
    );
  if (action === "serah")
    return (
      worker &&
      row.status === "progress" &&
      !row.konfirmasi_serah_pada &&
      serviceHandoverKinds.includes(row.jenis_tugas) &&
      !!row.konfirmasi_keluar_pada
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
        : worker && row.status === "progress" &&
          (!warehouseOutboundKinds.includes(row.jenis_tugas) || !!row.konfirmasi_keluar_pada) &&
          (!serviceHandoverKinds.includes(row.jenis_tugas) || !!row.konfirmasi_serah_pada) &&
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
  keluar: "Konfirmasi Keluar",
  serah: "Konfirmasi Pengembalian",
  terima: "Konfirmasi Terima",
  selesai: "Selesai Pekerjaan",
  resolve: "Resolve",
};
function nextWorkflowAction(row: Row | null) {
  if (!row) return null;
  return ["start", "keluar", "serah", "terima", "selesai", "resolve"]
    .find((name) => canAct(name, row)) || null;
}
function completedWorkflowLabel(row: Row) {
  if (row.status === "technician_completed") return "Selesai Pekerjaan";
  if (row.status === "warehouse_validated") return "Konfirmasi Terima";
  return "Mulai";
}
function isInboundRow(row: Row) {
  return String(row.jenis_tugas || "").startsWith("terima_");
}
async function action(name: string, row = editing.value) {
  if (
    !row ||
    (name === "cancel" && !window.confirm("Batalkan Surat Tugas ini?"))
  )
    return;
  if (name === "selesai" && ["qc", "repair", "maintenance", "on_site_service"].includes(row.jenis_tugas)) {
    for (const line of row.surat_tugas_printer || []) {
      const result = resultForms[line.id];
      if (!result?.hasil?.trim()) {
        errorMessage.value = `Isi Hasil Unit ${line.mp_no} sebelum Selesai Pekerjaan.`;
        formTab.value = "unit";
        return;
      }
      if (["qc", "repair"].includes(row.jenis_tugas) && !result.kondisi_hasil) {
        errorMessage.value = `Pilih Kondisi hasil untuk ${line.mp_no}.`;
        formTab.value = "unit";
        return;
      }
    }
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    if (name === "selesai") await saveUnitResults(row);
    await request(`/surat-tugas/${row.id}/${name}`, {
      method: "POST",
      body: name === "selesai" ? { hasil: form.hasil || null } : undefined,
    });
    successMessage.value = "Status Surat Tugas diperbarui.";
    await load();
    await openEdit(row);
  } catch (error) {
    errorMessage.value = message(error, "Workflow Surat Tugas gagal diproses.");
  } finally {
    saving.value = false;
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
          />
          <UButton
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
        <template
          #status-cell="{ row }"
        >
          <UBadge
            :color="
              ['solved', 'technician_completed'].includes(row.original.status)
                ? 'success'
                : ['cancelled'].includes(row.original.status)
                  ? 'error'
                  : 'info'
            "
            variant="subtle"
            >
              {{ row.original.status || "-" }}
            </UBadge>
        </template>
        <template
          #actions-cell="{ row }"
        >
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="row.original.status === 'solved' ? 'i-lucide-eye' : 'i-lucide-pencil'"
            :aria-label="row.original.status === 'solved' ? 'Lihat Surat Tugas' : 'Edit Surat Tugas'"
            @click="openEdit(row.original)"
          />
        </template>
        <template
          #empty
        >
          <div class="py-10 text-center text-sm text-dimmed">
            {{ loading ? "Memuat data..." : "Belum ada Surat Tugas." }}
          </div>
        </template>
      </UTable>
    </UCard>

    <UModal
      v-model:open="createOpen"
      :title="editing?.status === 'solved' ? 'Lihat Surat Tugas' : editing ? 'Edit Surat Tugas' : 'Buat Surat Tugas'"
      :ui="{
        content: 'sm:max-w-3xl h-[80vh] max-h-[800px]',
        body: 'overflow-y-auto',
      }"
    >
      <template
        #body
      >
        <UForm
          :state="form"
          class="space-y-4"
          @submit="editing ? saveEdit() : create()"
        >
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            :title="errorMessage"
          />
          <UAlert
            v-if="editing?.status === 'solved'"
            color="info"
            variant="subtle"
            title="Surat Tugas selesai"
            description="Data hanya dapat dilihat."
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
              >
                Detil
              </UButton>
              <UButton
                v-if="form.jenis_tugas"
                type="button"
                class="justify-start"
                :variant="formTab === 'items' ? 'soft' : 'ghost'"
                color="neutral"
                @click="formTab = 'items'"
              >
                Items ({{ displayedItems.length }})
              </UButton>
              <UButton
                v-if="canShowUnitPrinterTab"
                type="button"
                class="justify-start"
                :variant="formTab === 'unit' ? 'soft' : 'ghost'"
                color="neutral"
                @click="formTab = 'unit'"
              >
                Unit Printer
              </UButton>
            </nav>
            <div class="min-w-0 flex-1 space-y-4">
          <div
            v-if="editing?.status === 'solved' && formTab === 'detail'"
            class="grid gap-4"
          >
            <UFormField
              v-for="field in solvedDetails"
              :key="field.label"
              :label="field.label"
            >
              <UInput
                :model-value="field.value"
                readonly
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            v-else-if="formTab === 'detail'"
            class="space-y-4"
          >
          <div class="grid gap-4">
            <UFormField
              v-if="embedded || form.tiket_id"
              label="Tiket"
            >
                    <UInput
                      :model-value="selectedTicket?.nomor_tiket || 'Memuat tiket...'"
                      readonly
                      class="w-full"
                    />
            </UFormField>
                  <UFormField
                    label="Jenis Surat Tugas"
                    required
                  >
                    <USelectMenu
                      v-model="form.jenis_tugas"
                      :items="kindItems"
                      value-key="value"
                      searchable
                      searchable-placeholder="Ketik untuk mencari jenis Surat Tugas"
                      placeholder="Pilih jenis"
                      class="w-full"
                      @update:model-value="changeKind"
                    />
                  </UFormField>
          </div>
          <div
            v-if="form.jenis_tugas"
            class="space-y-4"
          >
          <div
            v-if="!selectedTicket && form.jenis_tugas !== 'maintenance'"
            class="grid gap-4"
          >
            <UFormField
              label="Customer / Site"
              :required="
                ['kirim_kontrak', 'terima_tukar', 'terima_return'].includes(
                  form.jenis_tugas,
                )
              "
              >
                      <USelectMenu
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
            />
            </UFormField>
          </div>
          <div
            v-if="['kirim_kontrak', 'kirim_back_up'].includes(form.jenis_tugas)"
            class="grid gap-4"
          >
            <UFormField
              label="Mode"
              required
            >
                      <USelect
                        v-model="form.mode"
                        :items="modeItems"
                        placeholder="Pilih mode"
                        class="w-full"
                      />
            </UFormField>
                    <UFormField
              v-if="
                form.jenis_tugas === 'kirim_kontrak' && form.mode === 'tukar'
              "
              label="Kontrak Aktif"
              required
              >
                      <USelect
                v-model="form.kontrak_id"
                :items="
                  options.contracts
                    .filter(
                      (row) =>
                        row.status === 'aktif' &&
                        row.customer_id === selectedCustomerUuid,
                    )
                    .map((row) => ({ label: row.nomor_kontrak, value: row.id }))
                "
                placeholder="Pilih kontrak"
                class="w-full"
            />
                    </UFormField>
          </div>
          <div
            v-if="
              ['kirim_kontrak', 'kirim_back_up'].includes(form.jenis_tugas) &&
              form.mode !== 'baru'
            "
            class="grid gap-4"
          >
            <UFormField
              label="Unit Lama"
            >
              <UInput
                v-if="form.jenis_tugas === 'kirim_back_up' && selectedTicket"
                :model-value="selectedTicket.mp_no || '-'"
                readonly
                class="w-full"
              />
              <USelect
                v-else
                v-model="form.unit_asal_id"
                :items="printerItems"
                placeholder="Pilih unit customer"
                class="w-full"
              />
            </UFormField>
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
                ...(!selectedTicket ? ['maintenance'] : []),
              ].includes(form.jenis_tugas)
            "
            class="grid gap-4"
          >
            <UFormField
              label="Gudang"
              required
            >
                      <USelect
                        v-model="form.gudang_id"
                        :items="warehouseItems"
                        placeholder="Pilih gudang"
                        class="w-full"
                        @update:model-value="changeWarehouse"
                      />
            </UFormField>
                    <UFormField
                      v-if="isInbound"
                      label="PIC Warehouse"
                      required
                    >
                      <USelect
                        v-model="form.pic_warehouse_id"
                        :items="warehouseUserItems"
                        placeholder="Pilih PIC warehouse"
                        class="w-full"
                      />
                    </UFormField>
          </div>
          <UFormField
            v-if="form.jenis_tugas === 'maintenance'"
            label="Unit Printer"
            required
          >
                    <USelectMenu
                      v-model="maintenancePrinterId"
                      v-model:search-term="printerSearch"
                      :items="printerItems"
                      value-key="value"
                      ignore-filter
                      :search-input="{ placeholder: 'Cari MP No atau serial printer' }"
                      :loading="printerLoading"
                      :disabled="!selectedTicket && !form.gudang_id"
                      placeholder="Pilih unit printer"
                      class="w-full"
                    />
          </UFormField>
          <UFormField
            v-if="!isInbound"
            label="PIC Teknisi"
            required
          >
                    <USelectMenu
                      v-model="form.pic_teknisi_id"
                      v-model:search-term="technicianSearch"
                      :items="technicianItems"
                      value-key="value"
                      ignore-filter
                      :search-input="{ placeholder: 'Ketik untuk mencari teknisi' }"
                      :loading="technicianLoading"
                      placeholder="Pilih PIC teknisi"
                      class="w-full"
                    />
          </UFormField>
          <UFormField
            v-if="form.jenis_tugas === 'internal_use'"
            label="Divisi / Lokasi Internal"
            required
          >
                    <UInput
                      v-model="form.lokasi_internal"
                      class="w-full"
                    />
          </UFormField>
          <div
            v-if="form.jenis_tugas === 'terima_printer_baru'"
            class="grid gap-4"
          >
            <UFormField
              label="Sumber / Pemasok"
              required
            >
                      <UInput
                        v-model="form.sumber"
                        class="w-full"
                      />
            </UFormField>
                    <UFormField
                      label="MP No"
                      required
                    >
                      <UInput
                        v-model="form.new_mp_no"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField
                      label="Model"
                      required
                    >
                      <USelect
                v-model="form.new_model_id"
                :items="
                  options.models.map((row) => ({
                    label: row.nama_model,
                    value: row.id,
                  }))
                "
                placeholder="Pilih model"
                class="w-full"
            />
                    </UFormField>
          </div>
          <div
            v-if="editing"
            class="space-y-3 border-t border-default pt-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium">Status</span>
              <UBadge
                color="neutral"
                variant="subtle"
              >
                {{ editing.status }}
              </UBadge>
            </div>
          </div>
          </div>
          </div>
          <div
            v-else-if="formTab === 'unit' && canShowUnitPrinterTab"
            class="space-y-3"
          >
            <UCard
              v-for="line in editing.surat_tugas_printer || []"
              :key="line.id"
            >
              <div class="space-y-3">
                <p class="font-semibold">{{ line.mp_no }}</p>
                <div
                  v-if="['progress', 'technician_completed'].includes(editing.status) && ['admin', 'teknisi'].includes(role) && resultForms[line.id]"
                  class="grid gap-2"
                >
                  <UFormField
                    label="Hasil Unit"
                    required
                  >
                        <UInput
                          v-model="resultForms[line.id].hasil"
                          class="w-full"
                        />
                  </UFormField>
                  <UFormField
                    v-if="['qc', 'repair'].includes(editing.jenis_tugas)"
                    label="Kondisi hasil"
                  >
                        <USelect
                          v-model="resultForms[line.id].kondisi_hasil"
                          :items="['ready', 'ready_with_condition', 'need_repair', 'unready', 'kanibal'].map((value) => ({ label: value, value }))"
                          class="w-full"
                        />
                  </UFormField>
                  <UFormField label="Alasan / keterangan">
                        <UInput
                          v-model="resultForms[line.id].alasan"
                          class="w-full"
                        />
                  </UFormField>
                </div>
                <p
                  v-else
                  class="text-sm text-dimmed"
                >
                  {{ line.hasil || 'Belum ada hasil.' }}
                </p>
              </div>
            </UCard>
          </div>
          <div
            v-else
            class="space-y-5"
          >
            <div class="overflow-x-auto">
              <UTable
                :data="displayedItems"
                :columns="formItemColumns"
              >
                <template #jenis_barang-cell="{ row }">{{ row.original.jenis_barang === 'suku_cadang' ? 'Sparepart' : row.original.jenis_barang === 'printer' ? 'Printer' : 'Toner' }}</template>
                <template #item-cell="{ row }">{{ formItemName(row.original) }}</template>
                <template #gudang-cell="{ row }">{{ formItemWarehouse(row.original) }}</template>
                <template #keterangan-cell="{ row }">{{ row.original.keterangan || '-' }}</template>
                <template #actions-cell="{ row }">
                  <UButton
                    v-if="row.original.printer_id && !row.original.existing"
                    type="button"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    aria-label="Hapus printer"
                    @click="removeDisplayedPrinter(row.original)"
                  />
                  <UButton
                    v-else-if="!row.original.existing && !row.original.fixed"
                    type="button"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    aria-label="Hapus item"
                    @click="removeFormItem(formItems.indexOf(row.original))"
                  />
                </template>
                <template #empty>
                      <div class="py-8 text-center text-sm text-dimmed">Belum ada item.</div>
                </template>
              </UTable>
            </div>
            <UAlert
              v-if="!editing"
              color="info"
              variant="subtle"
              title="Toner dan Sparepart dapat ditambahkan setelah Surat Tugas dimulai"
            />
            <div class="flex justify-end">
              <UButton
                v-if="editing?.status !== 'solved' && (!editing || canAddFormItem)"
                type="button"
                color="primary"
                variant="outline"
                @click="openAddItem"
              >
                Tambah Item
              </UButton>
            </div>
          </div>
            </div>
          </div>
          <div class="overflow-x-auto pb-1">
            <div class="ms-auto flex w-max items-center gap-2">
            <div
              v-if="editing && nextWorkflowAction(editing)"
              class="flex w-44 shrink-0 items-center"
            >
              <UButton
                type="button"
                color="primary"
                variant="outline"
                class="min-w-0 flex-1 justify-center rounded-e-none"
                :loading="saving"
                :disabled="saving"
                @click="action(nextWorkflowAction(editing)!, editing)"
              >
                {{ workflowLabels[nextWorkflowAction(editing)!] }}
              </UButton>
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
            <div
              v-else-if="editing && canAct('cancel', editing)"
              class="flex w-44 shrink-0 items-center"
            >
              <UButton
                type="button"
                color="primary"
                variant="outline"
                class="min-w-0 flex-1 justify-center rounded-e-none"
                disabled
              >
                {{ completedWorkflowLabel(editing) }}
              </UButton>
              <UDropdownMenu
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
            <UButton
              v-if="editing?.status !== 'solved'"
              type="submit"
              class="w-44 shrink-0 justify-center"
              :loading="saving || (embedded && loading)"
              :disabled="!form.jenis_tugas || (embedded && !selectedTicket)"
            >
              Simpan
            </UButton>
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
                ...(printerIsServiceObject ? [] : [{ label: 'Printer', value: 'printer' }]),
                ...(canAddFormItem ? [{ label: 'Toner', value: 'toner' }, { label: 'Sparepart', value: 'suku_cadang' }] : []),
              ]"
              class="w-full"
              @update:model-value="formItem.item_id = ''"
            />
          </UFormField>
          <UAlert
            v-if="addItemKind === 'printer' && form.jenis_tugas === 'terima_printer_baru'"
            color="info"
            variant="subtle"
            title="Printer baru diisi pada tab Detil"
            description="Isi MP No dan model printer baru pada tab Detil Surat Tugas."
          />
          <UFormField
            v-else-if="addItemKind === 'printer'"
            label="Printer"
          >
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
          <div
            v-else
            class="grid gap-3 sm:grid-cols-2"
          >
            <UFormField
              label="Item"
              class="sm:col-span-2"
            >
              <USelect
                v-model="formItem.item_id"
                :items="formItemChoices.map((row) => ({ label: row.nama_toner || row.nama_suku_cadang, value: row.id }))"
                placeholder="Pilih item"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Gudang">
              <USelect
                v-model="formItem.gudang_id"
                :items="warehouseItems"
                placeholder="Pilih gudang"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jumlah">
              <UInput
                v-model.number="formItem.jumlah_pakai"
                type="number"
                min="1"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Keterangan"
              class="sm:col-span-2"
            >
              <UInput
                v-model="formItem.keterangan"
                class="w-full"
              />
            </UFormField>
          </div>
          <p
            v-if="errorMessage && addItemKind !== 'printer'"
            class="text-sm text-error"
          >
            {{ errorMessage }}
          </p>
          <div class="mt-auto flex justify-end gap-2 pt-4">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="addItemOpen = false"
            >
              Batal
            </UButton>
            <UButton
              type="button"
              @click="confirmAddItem"
            >
              Tambahkan
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

  </div>
</template>
