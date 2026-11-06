<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import {
  Boxes,
  Box,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Pencil,
  PhoneCall,
  Plus,
  Power,
  Printer,
  Save,
  Settings,
  TimerReset,
  Trash2,
  UserRound,
  Wrench,
  X
} from "lucide-vue-next";
import logoMulti from "../assets/img/logo-multi-transparent.png";
import api, { hapusToken } from "../services/api";
import AuditPage from "./audit/AuditPage.vue";
import AuditBarangPage from "./audit/AuditBarangPage.vue";
import Complaint from "./complaint/Complaint.vue";
import StockPrinter from "./dataset/StockPrinter.vue";
import StockSparepart from "./dataset/StockSparepart.vue";
import StockToner from "./dataset/StockToner.vue";
import Dashboard from "./dashboard/Dashboard.vue";
import Gudang from "./master-data/Gudang.vue";
import LokasiCustomer from "./master-data/LokasiCustomer.vue";
import MasterImportDialog from "./master-data/MasterImportDialog.vue";
import Account from "./master-data/Account.vue";
import PrinterMaster from "./master-data/Printer.vue";
import PrinterKategori from "./master-data/PrinterKategori.vue";
import PrinterModel from "./master-data/PrinterModel.vue";
import Sparepart from "./master-data/Sparepart.vue";
import Toner from "./master-data/Toner.vue";
import User from "./master-data/User.vue";
import SettingsPage from "./settings/SettingsPage.vue";
import SuratTugas from "./surat-tugas/SuratTugas.vue";
import SuratTugasBaruPage from "./surat-tugas/SuratTugasBaruPage.vue";
import TiketPage from "./tiket/TiketPage.vue";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const router = useRouter();
const route = useRoute();
const pengguna = ref(null);
const statusBackend = ref("Memeriksa");
const pesanError = ref("");
const pesanSukses = ref("");
let toastTimer = null;
const sidebarTerbuka = ref(false);
const userMenuTerbuka = ref(false);
const activeView = ref(route.path === "/tiket" ? "tiket" : route.path === "/surat-tugas" ? "suratTugasBaru" : "dashboard");
const ticketPrefill = ref(null);
const loading = ref(false);
const modalTerbuka = ref(false);
const modalStokTerbuka = ref(false);
const importKind = ref(null);
const locationRefreshKey = ref(0);
const konfirmasiHapusTerbuka = ref(false);
const targetHapus = ref(null);
const targetHapusJenis = ref("account");
const modeKonfirmasi = ref("deactivate");
const modeForm = ref("create");
const formTab = ref("general");
const form = reactive({});
const siteRows = ref([]);
const siteFormVisible = ref(false);
const siteMode = ref("create");
const siteForm = reactive({});
const firstCustomerForm = reactive({});
const itemForm = reactive({
  gudang_id: "",
  jenis_barang: "toner",
  item_id: "",
  jumlah_pakai: 1,
  serial_number: "",
  keterangan: ""
});
const stockForm = reactive({
  jenis_mutasi: "masuk",
  gudang_asal_id: "",
  gudang_tujuan_id: "",
  jenis_barang: "toner",
  item_id: "",
  jumlah: 1,
  keterangan: ""
});
const cari = ref("");
const items = ref([]);
const auditItems = ref([]);
const auditBarangTarget = ref(null);
const stok = reactive({ toner: [], printer: [], suku_cadang: [] });
const auditFilter = reactive({
  tanggal_mulai: "",
  tanggal_selesai: "",
  user: "",
  nomor_tiket: "",
  nomor_surat_tugas: ""
});
const pagination = reactive({
  page: 1,
  pageSize: 10
});
const auditPagination = reactive({
  page: 1,
  pageSize: 10
});
const stokPagination = reactive({
  toner: { page: 1, pageSize: 10 },
  printer: { page: 1, pageSize: 10 },
  suku_cadang: { page: 1, pageSize: 10 }
});
const stokSearch = ref("");
const printerSummary = reactive({ available: 0, reserved: 0, issued: 0, installed: 0 });
const serverTotal = ref(0);
const printerFilters = reactive({ kategori_id: "", model_id: "" });
const availablePrinterOptions = ref([]);
const printerItemSearch = ref("");
const installedPrinterSearch = ref("");
const options = reactive({
  account: [],
  customer: [],
  printer: [],
  printerKategori: [],
  printerModel: [],
  toner: [],
  sukuCadang: [],
  gudang: [],
  pengguna: [],
  teknisi: [],
  printerTerpasang: [],
  pengaduan: [],
  tiket: [],
  suratTugas: []
});
const pengaturan = reactive({
  slaPendingJam: 24,
  roleDipilih: "admin",
  filterModul: "",
  roles: ["admin", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"],
  modules: [],
  actions: ["view", "create", "update", "delete", "resolve", "workflow"],
  permissions: []
});

const menu = ref([
  {
    section: "Utama",
    items: [
      { key: "dashboard", nama: "Dashboard", icon: LayoutDashboard },
      { key: "tiket", nama: "Tiket", icon: PhoneCall },
      { key: "suratTugasBaru", nama: "Surat Tugas", icon: ClipboardList }
    ]
  },
  {
    section: "Dataset",
    items: [
      {
        nama: "Stok Barang",
        icon: Box,
        terbuka: false,
        children: [
          { key: "stokPrinter", nama: "Stok Printer", icon: Printer },
          { key: "stokToner", nama: "Stok Toner", icon: PackagePlus },
          { key: "stokSparepart", nama: "Stok Sparepart", icon: Wrench }
        ]
      },
      {
        nama: "Master Data",
        icon: Database,
        terbuka: false,
        children: [
          { key: "account", nama: "Account", icon: Building2 },
          {
            nama: "Printer",
            icon: Printer,
            terbuka: false,
            children: [
              { key: "printer", nama: "Unit Printer", icon: Printer },
              { key: "printerKategori", nama: "Kategori Printer", icon: Printer },
              { key: "printerModel", nama: "Model Printer", icon: Printer }
            ]
          },
          { key: "toner", nama: "Toner", icon: Boxes },
          { key: "sukuCadang", nama: "Sparepart", icon: Wrench },
          {
            nama: "Lokasi",
            icon: Box,
            terbuka: false,
            children: [
              { key: "gudang", nama: "Master Gudang", icon: Box },
              { key: "lokasiCustomer", nama: "Lokasi Customer", icon: Building2 }
            ]
          },
          { key: "pengguna", nama: "User", icon: UserRound }
        ]
      }
    ]
  },
  {
    section: "Sistem",
    items: [
      { key: "audit", nama: "Audit", icon: History },
      { key: "auditBarang", nama: "Audit Barang", icon: Boxes },
      {
        nama: "Pengaturan",
        icon: Settings,
        terbuka: false,
        adminOnly: true,
        children: [
          { key: "rolePermission", nama: "Role Permission", icon: KeyRound },
          { key: "slaPending", nama: "SLA Pending Komplain", icon: TimerReset }
        ]
      }
    ]
  },
  {
    section: "Auth",
    items: [
      { key: "logout", nama: "Keluar", icon: LogOut }
    ]
  }
]);

const configs = {
  account: {
    title: "Account",
    subtitle: "Kelola Account dan Customer operasional.",
    endpoint: "/account",
    hardDelete: true,
    search: true,
    serverPagination: true,
    columns: [
      ["kode_account", "Kode"],
      ["nama_account", "Account"],
      ["jumlah_customer", "Customer"],
      ["tipe_account", "Tipe"],
      ["telepon", "Telepon"],
      ["aktif", "Status"]
    ],
    fields: [
      field("kode_account", "Kode Account", "text", true),
      field("nama_account", "Nama Account", "text", true),
      field("npwp", "NPWP"),
      field("telepon", "Telepon Utama"),
      field("email", "Email Utama", "email"),
      field("alamat_penagihan", "Alamat Penagihan", "textarea"),
      field("aktif", "Aktif", "checkbox")
    ]
  },
  printerKategori: {
    title: "Kategori Printer",
    endpoint: "/printer-kategori",
    hardDelete: true,
    search: true,
    serverPagination: true,
    columns: [["kode_kategori", "Kode"], ["nama_kategori", "Kategori"], ["aktif", "Status"]],
    fields: [field("kode_kategori", "Kode Kategori", "text", true), field("nama_kategori", "Nama Kategori", "text", true), field("aktif", "Aktif", "checkbox")]
  },
  printerModel: {
    title: "Model Printer",
    endpoint: "/printer-model",
    hardDelete: true,
    search: true,
    serverPagination: true,
    columns: [["kode_model", "Kode"], ["merek", "Merek"], ["nama_model", "Model"], ["kategori_id", "Kategori"], ["aktif", "Status"]],
    fields: [
      relation("kategori_id", "Kategori", "printerKategori", "nama_kategori", true),
      field("kode_model", "Kode Model", "text", true),
      field("merek", "Merek", "text", true),
      field("nama_model", "Nama Model", "text", true),
      field("aktif", "Aktif", "checkbox")
    ]
  },
  printer: {
    title: "Master Printer",
    subtitle: "Satu baris untuk setiap unit printer.",
    endpoint: "/printer",
    search: true,
    serverPagination: true,
    printerFilters: true,
    printerFilterFields: ["kategori_id", "model_id"],
    columns: [
      ["mp_no", "MP No"],
      ["serial_number", "Serial Number"],
      ["kategori_unit", "Kategori"],
      ["model_unit", "Model"],
      ["lokasi_unit", "Lokasi"],
      ["tanggal_pembelian", "Pembelian"],
      ["tanggal_maintenance_berikutnya", "Maintenance Berikutnya"],
      ["status_operasional", "Status"]
    ],
    fields: [
      field("mp_no", "MP No", "text", true),
      field("serial_number", "Serial Number"),
      relation("kategori_id", "Kategori", "printerKategori", "nama_kategori", true),
      relation("model_id", "Model", "printerModel", "nama_model", true),
      field("tanggal_pembelian", "Tanggal Pembelian", "date"),
      field("tanggal_maintenance_berikutnya", "Maintenance Berikutnya", "date"),
      field("interval_maintenance_bulan", "Interval Maintenance (Bulan)", "number", false, [], { min: 1, max: 120 }),
      field("keterangan", "Keterangan", "textarea"),
      relation("gudang_id", "Gudang Awal", "gudang", "nama_gudang", true),
    ]
  },
  toner: {
    title: "Master Toner",
    subtitle: "Data toner berdasarkan kode, warna, dan tipe.",
    endpoint: "/toner",
    hardDelete: true,
    search: true,
    serverPagination: true,
    columns: [
      ["kode_toner", "Kode"],
      ["nama_toner", "Nama"],
      ["warna", "Warna"],
      ["tipe", "Tipe"],
      ["aktif", "Status"]
    ],
    fields: [
      field("kode_toner", "Kode Toner", "text", true),
      field("nama_toner", "Nama Toner", "text", true),
      field("warna", "Warna", "text", true),
      field("tipe", "Tipe", "text", true),
      field("aktif", "Aktif", "checkbox")
    ]
  },
  sukuCadang: {
    title: "Master Sparepart",
    subtitle: "Data master sparepart.",
    endpoint: "/suku-cadang",
    hardDelete: true,
    search: true,
    serverPagination: true,
    columns: [
      ["kode_suku_cadang", "Kode"],
      ["nama_suku_cadang", "Nama"],
      ["aktif", "Status"]
    ],
    fields: [
      field("kode_suku_cadang", "Kode Sparepart", "text", true),
      field("nama_suku_cadang", "Nama Sparepart", "text", true),
      field("aktif", "Aktif", "checkbox")
    ]
  },
  gudang: {
    title: "Master Gudang",
    subtitle: "Gudang utama, cabang, atau teknisi.",
    endpoint: "/gudang",
    hardDelete: true,
    search: true,
    serverPagination: true,
    columns: [
      ["kode_gudang", "Kode"],
      ["nama_gudang", "Nama"],
      ["jenis_gudang", "Jenis"],
      ["alamat", "Alamat"],
      ["aktif", "Status"]
    ],
    fields: [
      field("kode_gudang", "Kode Gudang", "text", true),
      field("nama_gudang", "Nama Gudang", "text", true),
      field("jenis_gudang", "Jenis Gudang", "select", true, ["utama", "cabang", "teknisi"]),
      relation("teknisi_id", "Teknisi", "pengguna", "name"),
      field("alamat", "Alamat", "textarea"),
      field("aktif", "Aktif", "checkbox")
    ]
  },
  pengguna: {
    title: "Master Akun / User",
    subtitle: "Kode user, login, role, dan status aktif akun.",
    endpoint: "/pengguna",
    directList: true,
    columns: [
      ["user_id", "User ID"],
      ["name", "Nama"],
      ["role", "Role"],
      ["email", "Email"],
      ["active", "Status"]
    ],
    fields: [
      field("user_id", "User ID", "text", true),
      field("name", "Nama", "text", true),
      field("role", "Role", "select", true, ["admin", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"]),
      field("email", "Email", "email", true),
      field("password", "Password", "password", true),
      field("active", "Active", "checkbox")
    ]
  },
  pengaduan: {
    title: "Flow Komplain",
    subtitle: "Input, update prioritas, dan pantau status komplain.",
    endpoint: "/pengaduan",
    search: true,
    columns: [
      ["nomor_pengaduan", "Nomor"],
      ["mp_no", "MP No"],
      ["deskripsi_masalah", "Deskripsi"],
      ["prioritas", "Prioritas"],
      ["status", "Status"]
    ],
    flow: "pengaduan",
    fields: [
      field("nomor_pengaduan", "No. Komplain", "text", false, [], { readonly: true, placeholder: "Generate otomatis" }),
      field("tanggal_pengaduan", "Tanggal Komplain", "datetime-local", false, [], { defaultValue: "now" }),
      field("mp_no", "MP No", "text", true),
      relation("account_id", "Account", "account", "nama_account", true),
      relation("customer_id", "Customer", "customer", "nama_customer", true),
      relation("printer_id", "Printer Terpasang (Opsional)", "printerTerpasang", "mp_no"),
      relation("sales_id", "Sales", "pengguna", "name", true),
      field("status", "Status", "select", false, ["new", "pending", "progress", "solved", "cancelled"], { defaultValue: "new" }),
      field("deskripsi_masalah", "Deskripsi", "textarea", true),
      field("nama_pelapor", "Nama Pelapor", "text", true),
      field("telepon_pelapor", "Telepon Pelapor"),
      field("prioritas", "Prioritas", "select", false, ["rendah", "normal", "tinggi", "darurat"], { defaultValue: "normal" }),
      field("ringkasan_penyelesaian", "Ringkasan Penyelesaian", "textarea"),
      field("tanggal_diselesaikan", "Resolved At", "datetime-local", false, [], { readonly: true }),
      field("tanggal_diperbarui", "Updated At", "datetime-local", false, [], { readonly: true }),
      field("slug", "Slug", "text", false, [], { readonly: true })
    ]
  },
  suratTugas: {
    title: "Flow Surat Tugas",
    subtitle: "Buat pekerjaan dari komplain, update hasil, ajukan, dan setujui.",
    endpoint: "/surat-tugas",
    directList: true,
    columns: [
      ["nomor_surat_tugas", "Nomor"],
      ["mp_no", "MP No"],
      ["jenis_pekerjaan", "Pekerjaan"],
      ["status", "Status"],
      ["hasil", "Hasil"]
    ],
    flow: "suratTugas",
    fields: [
      field("nomor_surat_tugas", "ID Surat Tugas", "text", false, [], { readonly: true, placeholder: "Generate otomatis" }),
      relation("pengaduan_id", "No. Komplain", "pengaduan", "nomor_pengaduan"),
      field("mp_no", "MP No", "text", true),
      relation("account_id", "Account", "account", "nama_account", true),
      relation("customer_id", "Customer", "customer", "nama_customer", true),
      relation("printer_id", "Printer Terpasang (Opsional)", "printerTerpasang", "mp_no"),
      relation("pic_teknisi_id", "PIC", "teknisi", "name", true),
      field("jenis_pekerjaan", "Tipe", "select", true, ["maintenance", "installation", "delivery", "support"], { defaultValue: "maintenance" }),
      field("status", "Status", "select", false, ["pending", "progress", "technician_completed", "warehouse_validated", "solved", "cancelled"], { defaultValue: "pending" }),
      field("tanggal_jadwal", "Jadwal", "datetime-local"),
      field("catatan_masalah", "Catatan Masalah", "textarea"),
      field("tindakan", "Tindakan", "textarea"),
      field("hasil", "Hasil", "textarea")
    ]
  }
};

const stockItemOptions = computed(() => {
  if (stockForm.jenis_barang === "printer") return options.printer;
  if (stockForm.jenis_barang === "suku_cadang") return options.sukuCadang;
  return options.toner;
});
const itemSuratOptions = computed(() => {
  if (itemForm.jenis_barang === "printer") return availablePrinterOptions.value;
  if (itemForm.jenis_barang === "suku_cadang") return options.sukuCadang;
  return options.toner;
});
const ringkasanDashboard = computed(() => [
  {
    icon: PhoneCall,
    label: "Jumlah Tiket",
    value: options.tiket.length,
    note: "Total tiket tercatat"
  },
  {
    icon: ClipboardList,
    label: "Jumlah Surat Tugas",
    value: options.suratTugas.length,
    note: "Total surat tugas"
  },
  {
    icon: Printer,
    label: "Jumlah Printer Terpasang",
    value: printerSummary.installed,
    note: "Unit aktif di customer"
  }
]);

function angka(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tanggalDari(item, keys) {
  const raw = keys.map((key) => item?.[key]).find(Boolean);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tanggalKey(date) {
  return date.toISOString().slice(0, 10);
}

function hariTerakhir(total = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (total - 1 - index));
    return date;
  });
}

const labelHariPendek = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const warnaStatusKomplain = {
  new: "#2563eb",
  pending: "#38bdf8",
  progress: "#22d3ee",
  solved: "#10b981",
  cancelled: "#fb7185"
};
const urutanStatusKomplain = ["new", "pending", "progress", "solved", "cancelled"];

const trenKomplain = computed(() => {
  const counts = options.tiket.reduce((result, item) => {
    const date = tanggalDari(item, ["tanggal_transaksi", "tanggal_dibuat"]);
    if (!date) return result;
    const key = tanggalKey(date);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return hariTerakhir().map((date) => ({
    label: labelHariPendek[date.getDay()],
    value: counts[tanggalKey(date)] || 0
  }));
});

const statusKomplain = computed(() => {
  const counts = options.tiket.reduce((result, item) => {
    const status = item.status || "new";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});

  return urutanStatusKomplain.map((status) => ({
    label: labelStatus(status),
    value: counts[status] || 0,
    color: warnaStatusKomplain[status] || "#94a3b8"
  }));
});

const suratTugasMingguan = computed(() => {
  const counts = options.suratTugas.reduce((result, item) => {
    const date = tanggalDari(item, ["tanggal_dibuat", "tanggal_jadwal", "created_at"]);
    if (!date) return result;
    const key = tanggalKey(date);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return hariTerakhir().map((date) => ({
    label: labelHariPendek[date.getDay()],
    value: counts[tanggalKey(date)] || 0
  }));
});

const stokBarang = computed(() => [
  {
    label: "Printer",
    value: (stok.printer || []).reduce((total, item) => total + angka(item.jumlah_tersedia), 0),
    color: "#2563eb"
  },
  {
    label: "Toner",
    value: (stok.toner || []).reduce((total, item) => total + angka(item.jumlah_tersedia), 0),
    color: "#22d3ee"
  },
  {
    label: "Sparepart",
    value: (stok.suku_cadang || []).reduce((total, item) => total + angka(item.jumlah_tersedia), 0),
    color: "#8b5cf6"
  }
]);
const stokViews = {
  stokPrinter: {
    group: "printer",
    title: "Stok Printer",
    subtitle: "Unit printer di gudang dan di customer.",
    label: "Printer"
  },
  stokToner: {
    group: "toner",
    title: "Stok Toner",
    subtitle: "Pantau ketersediaan toner dan kebutuhan refill.",
    label: "Toner"
  },
  stokSparepart: {
    group: "suku_cadang",
    title: "Stok Sparepart",
    subtitle: "Pantau sparepart yang tersedia untuk kebutuhan teknisi.",
    label: "Sparepart"
  }
};
const teknisiBar = computed(() => {
  const aktif = new Set(["pending", "progress", "technician_completed", "warehouse_validated"]);
  const counts = options.suratTugas.reduce((result, surat) => {
    if (!aktif.has(surat.status)) return result;
    (surat.teknisi_surat_tugas || surat.teknisi || []).forEach((assignment) => {
      const id = assignment.teknisi_id;
      if (!id) return;
      result[id] = (result[id] || 0) + 1;
    });
    return result;
  }, {});

  return options.teknisi
    .map((teknisi) => ({
      label: penggunaLabel(teknisi),
      value: counts[teknisi.id] || 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
});
const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#111827",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      padding: 12,
      cornerRadius: 8,
      displayColors: false
    }
  }
};
const axisOptions = {
  ...chartBaseOptions,
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#9fb1c7", font: { family: "Manrope", size: 11, weight: 600 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(148, 163, 184, 0.13)" },
      ticks: { color: "#9fb1c7", font: { family: "Manrope", size: 11, weight: 600 }, precision: 0 }
    }
  }
};
const lineChartData = computed(() => ({
  labels: trenKomplain.value.map((item) => item.label),
  datasets: [
    {
      data: trenKomplain.value.map((item) => item.value),
      borderColor: "#2563eb",
      backgroundColor: "rgba(34, 211, 238, 0.16)",
      pointBackgroundColor: "#22d3ee",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: true,
      tension: 0.42,
      borderWidth: 3
    }
  ]
}));
const statusDonutData = computed(() => ({
  labels: statusKomplain.value.map((item) => item.label),
  datasets: [
    {
      data: statusKomplain.value.map((item) => item.value),
      backgroundColor: statusKomplain.value.map((item) => item.color),
      borderColor: "#ffffff",
      borderWidth: 4,
      hoverOffset: 5
    }
  ]
}));
const suratTugasBarData = computed(() => ({
  labels: suratTugasMingguan.value.map((item) => item.label),
  datasets: [
    {
      data: suratTugasMingguan.value.map((item) => item.value),
      backgroundColor: "#2563eb",
      hoverBackgroundColor: "#22d3ee",
      borderRadius: 8,
      borderSkipped: false
    }
  ]
}));
const stokDonutData = computed(() => ({
  labels: stokBarang.value.map((item) => item.label),
  datasets: [
    {
      data: stokBarang.value.map((item) => item.value),
      backgroundColor: stokBarang.value.map((item) => item.color),
      borderColor: "#ffffff",
      borderWidth: 4,
      hoverOffset: 5
    }
  ]
}));
const teknisiBarData = computed(() => ({
  labels: teknisiBar.value.map((item) => item.label),
  datasets: [
    {
      data: teknisiBar.value.map((item) => item.value),
      backgroundColor: "#22d3ee",
      hoverBackgroundColor: "#2563eb",
      borderRadius: 8,
      borderSkipped: false
    }
  ]
}));
const donutOptions = {
  ...chartBaseOptions,
  cutout: "68%"
};

watch([pesanError, pesanSukses], ([error, sukses], [errorLama, suksesLama]) => {
  if (toastTimer) clearTimeout(toastTimer);
  if (error && error !== errorLama && sukses) {
    pesanSukses.value = "";
    return;
  }
  if (sukses && sukses !== suksesLama && error) {
    pesanError.value = "";
    return;
  }
  if (!error && !sukses) return;
  toastTimer = setTimeout(() => {
    pesanError.value = "";
    pesanSukses.value = "";
    toastTimer = null;
  }, 3000);
});

const currentConfig = computed(() => configs[activeView.value]);
const activeStockView = computed(() => stokViews[activeView.value]);
const activeStockGroup = computed(() => activeStockView.value?.group);
const isAdmin = computed(() => (pengguna.value?.role || pengguna.value?.peran) === "admin");
const roleAktif = computed(() => normalisasiRoleFrontend(pengguna.value?.role || pengguna.value?.peran || ""));
const canViewAuditBarang = computed(() => ["admin", "sales_admin", "kepala_teknisi", "warehouse"].includes(roleAktif.value));
const stockPageComponents = {
  stokPrinter: StockPrinter,
  stokToner: StockToner,
  stokSparepart: StockSparepart
};
const crudPageComponents = {
  pengaduan: Complaint,
  suratTugas: SuratTugas,
  account: Account,
  printer: PrinterMaster,
  printerKategori: PrinterKategori,
  printerModel: PrinterModel,
  toner: Toner,
  sukuCadang: Sparepart,
  gudang: Gudang,
  pengguna: User
};
const currentStockComponent = computed(() => stockPageComponents[activeView.value]);
const currentCrudComponent = computed(() => crudPageComponents[activeView.value]);
const pageTitle = computed(() => {
  if (activeView.value === "tiket") return "Tiket";
  if (activeView.value === "suratTugasBaru") return "Surat Tugas";
  if (activeView.value === "auditBarang") return "Audit Barang";
  if (activeView.value === "lokasiCustomer") return "Lokasi Customer";
  if (activeView.value === "audit") return "Audit Trail";
  if (activeView.value === "rolePermission") return "Role Permission";
  if (activeView.value === "slaPending") return "SLA Pending Komplain";
  if (activeStockView.value) return activeStockView.value.title;
  return currentConfig.value?.title || "Ringkasan Aplikasi";
});
const pageSubtitle = computed(() => {
  if (activeView.value === "tiket") return "Delivery, komplain, internal, inbound, dan maintenance.";
  if (activeView.value === "suratTugasBaru") return "Pelaksanaan pekerjaan dan pergerakan unit.";
  if (activeView.value === "auditBarang") return "Riwayat perubahan printer, toner, dan sparepart.";
  if (activeView.value === "lokasiCustomer") return "Alamat operasional customer di setiap Account.";
  if (activeView.value === "audit") return "Filter riwayat berdasarkan tanggal, nomor tiket, atau nomor surat tugas.";
  if (activeView.value === "rolePermission") return "Atur hak akses setiap role terhadap modul aplikasi.";
  if (activeView.value === "slaPending") return "Atur batas jam komplain New otomatis menjadi Pending.";
  if (activeStockView.value) return activeStockView.value.subtitle;
  return currentConfig.value?.subtitle || "Selamat datang di portal operasional Multiprint.";
});
const canCreate = computed(() => {
  if (!currentConfig.value) return false;
  if (currentConfig.value.readOnly) return false;
  if (isAdmin.value) return true;
  if (activeView.value === "pengaduan") return roleAktif.value === "sales_admin";
  if (activeView.value === "suratTugas") return roleAktif.value === "kepala_teknisi";
  if (activeView.value === "pengguna") return false;
  return ["admin", "warehouse"].includes(roleAktif.value);
});
const importableMasters = ["account", "printerKategori", "printerModel", "printer", "toner", "sukuCadang", "gudang", "pengguna"];
const canImportMaster = computed(() => importableMasters.includes(activeView.value) && (isAdmin.value || (activeView.value === "gudang" && roleAktif.value === "warehouse")));
const formTabs = computed(() => {
  if (currentConfig.value?.flow === "pengaduan") return ["general", "suratTugas"];
  if (currentConfig.value?.flow === "suratTugas") return ["general", "item"];
  if (activeView.value === "account" && modeForm.value === "edit") return ["general", "customer"];
  return ["general"];
});
const currentFormFields = computed(() => currentConfig.value?.fields || []);
const currentVisibleFormFields = computed(() => currentFormFields.value.filter(tampilkanFieldForm));
const relatedSuratTugas = computed(() => {
  if (currentConfig.value?.flow !== "pengaduan" || !form.id) return [];
  return options.suratTugas.filter((item) => item.pengaduan_id === form.id);
});
const pemakaianSuratAktif = computed(() => {
  if (currentConfig.value?.flow !== "suratTugas") return [];
  return form.pemakaian_barang_surat_tugas || form.pemakaian || [];
});
const filteredPermissionRows = computed(() => {
  const keyword = pengaturan.filterModul.trim().toLowerCase();
  if (!keyword) return pengaturan.permissions;
  return pengaturan.permissions.filter((item) => permissionModuleLabel(item.modul).toLowerCase().includes(keyword));
});
const filteredItems = computed(() => {
  if (currentConfig.value?.serverPagination) return items.value;
  const keyword = cari.value.trim().toLowerCase();
  if (!keyword) return items.value;
  return items.value.filter((item) => textBlob(item).toLowerCase().includes(keyword));
});
const totalPages = computed(() => Math.max(1, Math.ceil((currentConfig.value?.serverPagination ? serverTotal.value : filteredItems.value.length) / pagination.pageSize)));
const paginatedItems = computed(() => {
  if (currentConfig.value?.serverPagination) return items.value;
  const page = Math.min(pagination.page, totalPages.value);
  const start = (page - 1) * pagination.pageSize;
  return filteredItems.value.slice(start, start + pagination.pageSize);
});
const paginationStart = computed(() => {
  if (!(currentConfig.value?.serverPagination ? serverTotal.value : filteredItems.value.length)) return 0;
  return (Math.min(pagination.page, totalPages.value) - 1) * pagination.pageSize + 1;
});
const paginationEnd = computed(() => Math.min(paginationStart.value + pagination.pageSize - 1, currentConfig.value?.serverPagination ? serverTotal.value : filteredItems.value.length));
const filteredAuditItems = computed(() => {
  const keyword = [auditFilter.user, auditFilter.nomor_tiket, auditFilter.nomor_surat_tugas].join(" ").trim().toLowerCase();
  if (!keyword) return auditItems.value;
  return auditItems.value.filter((item) => textBlob(item).toLowerCase().includes(keyword));
});
const auditFilterSiap = computed(() => {
  const adaTanggal = Boolean(auditFilter.tanggal_mulai || auditFilter.tanggal_selesai);
  const adaTarget = Boolean(auditFilter.user || auditFilter.nomor_tiket || auditFilter.nomor_surat_tugas);
  return adaTanggal && adaTarget;
});
const auditTotalPages = computed(() => Math.max(1, Math.ceil(filteredAuditItems.value.length / auditPagination.pageSize)));
const paginatedAuditItems = computed(() => {
  const page = Math.min(auditPagination.page, auditTotalPages.value);
  const start = (page - 1) * auditPagination.pageSize;
  return filteredAuditItems.value.slice(start, start + auditPagination.pageSize);
});
const auditPaginationStart = computed(() => {
  if (!filteredAuditItems.value.length) return 0;
  return (Math.min(auditPagination.page, auditTotalPages.value) - 1) * auditPagination.pageSize + 1;
});
const auditPaginationEnd = computed(() => Math.min(auditPaginationStart.value + auditPagination.pageSize - 1, filteredAuditItems.value.length));
const filteredStok = computed(() => {
  const keyword = stokSearch.value.trim().toLowerCase();
  return ["toner", "printer", "suku_cadang"].reduce((result, group) => {
    const rows = stok[group] || [];
    result[group] = keyword ? rows.filter((row) => textBlob(row).toLowerCase().includes(keyword)) : rows;
    return result;
  }, {});
});
const stokTotalPages = computed(() =>
  ["toner", "printer", "suku_cadang"].reduce((result, group) => {
    result[group] = Math.max(1, Math.ceil((filteredStok.value[group]?.length || 0) / stokPagination[group].pageSize));
    return result;
  }, {})
);
const paginatedStok = computed(() =>
  ["toner", "printer", "suku_cadang"].reduce((result, group) => {
    const target = stokPagination[group];
    const page = Math.min(target.page, stokTotalPages.value[group]);
    const start = (page - 1) * target.pageSize;
    result[group] = (filteredStok.value[group] || []).slice(start, start + target.pageSize);
    return result;
  }, {})
);
const targetHapusLabel = computed(() => {
  const item = targetHapus.value || {};
  return (
    item.nomor_pengaduan ||
    item.nomor_surat_tugas ||
    item.kode_account ||
    item.kode_customer ||
    item.nama_account ||
    item.nama_customer ||
    item.kode_printer ||
    item.model ||
    item.nama_toner ||
    item.nama_suku_cadang ||
    item.nama_gudang ||
    item.user_id ||
    item.name ||
    item.nama ||
    "data ini"
  );
});
const judulKonfirmasi = computed(() => {
  if (modeKonfirmasi.value === "delete") return "Hapus permanen data ini?";
  if (currentConfig.value?.flow) return "Batalkan data ini?";
  return "Nonaktifkan data ini?";
});
const eyebrowKonfirmasi = computed(() => {
  if (modeKonfirmasi.value === "delete") return "Konfirmasi Penghapusan";
  if (currentConfig.value?.flow) return "Konfirmasi Pembatalan";
  return "Konfirmasi Penonaktifan";
});
const deskripsiKonfirmasi = computed(() => {
  if (modeKonfirmasi.value === "delete") {
    return "Data akan dihapus permanen dan tidak bisa dikembalikan. Sistem akan menolak jika data sudah dipakai transaksi.";
  }
  if (currentConfig.value?.flow) {
    return "Status akan diubah menjadi cancelled. Riwayat dan audit tetap tersimpan.";
  }
  return "Data tetap tersimpan, tapi tidak dipakai untuk transaksi baru.";
});
const labelTombolKonfirmasi = computed(() => {
  if (modeKonfirmasi.value === "delete") return loading.value ? "Menghapus..." : "Hapus Permanen";
  if (currentConfig.value?.flow) return loading.value ? "Membatalkan..." : "Batalkan";
  return loading.value ? "Menonaktifkan..." : "Nonaktifkan";
});
const namaPenggunaAktif = computed(() => pengguna.value?.name || pengguna.value?.nama || pengguna.value?.user_id || "User");
const rolePenggunaAktif = computed(() => roleLabel(pengguna.value?.role || pengguna.value?.peran || "-"));
const inisialPenggunaAktif = computed(() =>
  namaPenggunaAktif.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "U"
);

function field(name, label, type = "text", required = false, optionsList = [], extra = {}) {
  return { name, label, type, required, options: optionsList, ...extra };
}

function relation(name, label, source, optionLabel, required = false, extra = {}) {
  return { name, label, type: "relation", source, optionLabel, required, ...extra };
}

function textBlob(value) {
  if (value == null) return "";
  if (typeof value === "object") return Object.values(value).map(textBlob).join(" ");
  return String(value);
}

function resetPagination() {
  pagination.page = 1;
}

function resetAuditPagination() {
  auditPagination.page = 1;
}

function resetStockPagination() {
  Object.values(stokPagination).forEach((target) => {
    target.page = 1;
  });
}

function paginationMulai(total, target) {
  if (!total) return 0;
  return (Math.min(target.page, Math.max(1, Math.ceil(total / target.pageSize))) - 1) * target.pageSize + 1;
}

function paginationSelesai(total, target) {
  return Math.min(paginationMulai(total, target) + target.pageSize - 1, total);
}

function halamanSebelumnya(target = pagination) {
  if (target.page > 1) {
    target.page -= 1;
    if (target === pagination && currentConfig.value?.serverPagination) muatHalaman();
  }
}

function halamanBerikutnya(target, total) {
  if (target.page < total) {
    target.page += 1;
    if (target === pagination && currentConfig.value?.serverPagination) muatHalaman();
  }
}

function toggleMenu(item) {
  if (item.children) item.terbuka = !item.terbuka;
}

function menuContains(item, key) {
  return item.key === key || item.children?.some((child) => menuContains(child, key)) || false;
}

function pilihMenu(item) {
  if (item.children) {
    toggleMenu(item);
    return;
  }
  if (!item.key) return;
  if (item.key === "logout") {
    keluar();
    return;
  }
  activeView.value = item.key;
  if (item.key === "tiket") router.push("/tiket");
  else if (item.key === "suratTugasBaru") router.push("/surat-tugas");
  else if (route.path !== "/dashboard") router.push("/dashboard");
  if (item.key === "auditBarang") auditBarangTarget.value = null;
  sidebarTerbuka.value = false;
  userMenuTerbuka.value = false;
  cari.value = "";
  stokSearch.value = "";
  resetPagination();
  resetAuditPagination();
  resetStockPagination();
  pesanError.value = "";
  pesanSukses.value = "";
  muatHalaman();
}

function bukaSuratDariTiket(ticket) {
  ticketPrefill.value = ticket;
  activeView.value = "suratTugasBaru";
  router.push("/surat-tugas");
}

async function bukaKomplainArsip(ticket) {
  try {
    activeView.value = "pengaduan";
    await router.push("/dashboard");
    await muatHalaman();
    const response = await api.get(`/pengaduan/${ticket.pengaduan_lama_id}`);
    await bukaForm(response.data.data);
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Komplain arsip gagal dibuka.";
  }
}

watch(() => route.path, (path) => {
  if (path === "/tiket") activeView.value = "tiket";
  else if (path === "/surat-tugas") activeView.value = "suratTugasBaru";
});

function bukaAuditBarang(jenis, item) {
  const barangJenis = jenis === "sukuCadang" || jenis === "suku_cadang" ? "suku_cadang" : jenis === "stokPrinter" ? "printer" : jenis === "stokToner" ? "toner" : jenis === "stokSparepart" ? "suku_cadang" : jenis;
  const id = barangJenis === "printer" ? item.id : barangJenis === "toner" ? item.toner_id || item.id : item.suku_cadang_id || item.id;
  const kode = barangJenis === "printer" ? item.mp_no : barangJenis === "toner" ? item.master_toner?.kode_toner || item.kode_toner : item.master_suku_cadang?.kode_suku_cadang || item.kode_suku_cadang;
  auditBarangTarget.value = { jenis: barangJenis, id, kode };
  activeView.value = "auditBarang";
  sidebarTerbuka.value = false;
}

async function selesaiImpor(total) {
  const kind = importKind.value;
  importKind.value = null;
  pesanSukses.value = `${total} data berhasil diimpor.`;
  resetPagination();
  if (kind === "lokasiCustomer") locationRefreshKey.value += 1;
  else await muatHalaman();
  await muatOptions();
}

function valueOf(item, key) {
  if (key === "tipe_account") return item.jumlah_customer > 1 ? "Multisite" : "Single";
  if (key === "kategori_unit") return item.master_printer_model?.master_printer_kategori?.nama_kategori || "-";
  if (key === "model_unit") return [item.master_printer_model?.merek, item.master_printer_model?.nama_model].filter(Boolean).join(" ") || "-";
  if (key === "lokasi_unit") return item.status === "issued" ? "Dalam surat tugas" : item.master_customer?.nama_customer || item.master_gudang?.nama_gudang || "-";
  const value = item?.[key];
  if (typeof value === "boolean") return value ? "Aktif" : "Nonaktif";
  if (key.includes("tanggal") && value) return new Date(value).toLocaleDateString("id-ID");
  if (["status", "prioritas", "peran", "active", "role"].includes(key)) return labelStatus(value);
  if (key === "account_id") return item.master_account?.nama_account || options.account.find((row) => row.id === value)?.nama_account || value || "-";
  if (key === "customer_id") return item.master_customer?.nama_customer || options.customer.find((row) => row.id === value)?.nama_customer || value || "-";
  if (key === "printer_id") return item.master_printer?.mp_no || options.printer.find((row) => row.id === value)?.mp_no || value || "-";
  if (key === "kategori_id") return options.printerKategori.find((row) => row.id === value)?.nama_kategori || item.master_printer_kategori?.nama_kategori || value || "-";
  return value || "-";
}

function labelStatus(value) {
  const labels = {
    new: "New",
    pending: "Pending",
    progress: "Progress",
    solved: "Solved",
    cancelled: "Cancelled",
    technician_completed: "Technician Completed",
    warehouse_validated: "Validasi 1",
    sales_admin: "sales-admin",
    kepala_teknisi: "kepala-teknisi"
  };
  return labels[value] || value || "-";
}

function formatTanggalPdf(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value || "-").replace(/\n/g, "<br>");
}

function penggunaLabel(user) {
  return user?.name || user?.nama || user?.user_id || "-";
}

function picSurat(item) {
  const primary = item?.teknisi_surat_tugas?.find((row) => row.peran === "utama") || item?.teknisi?.find?.((row) => row.peran === "utama");
  if (primary?.master_pengguna) return penggunaLabel(primary.master_pengguna);
  if (item?.master_pengguna_pic_warehouse) return penggunaLabel(item.master_pengguna_pic_warehouse);
  const id = primary?.teknisi_id || item?.pic_teknisi_id;
  return penggunaLabel(options.pengguna.find((user) => user.id === id));
}

function nomorKomplainSurat(item) {
  if (item?.tiket?.nomor_tiket) return item.tiket.nomor_tiket;
  if (item?.pengaduan?.nomor_pengaduan) return item.pengaduan.nomor_pengaduan;
  return options.pengaduan.find((row) => row.id === item?.pengaduan_id)?.nomor_pengaduan || "-";
}

function alamatSurat(item) {
  return item?.master_customer?.alamat || "-";
}

function pemakaianSurat(item) {
  return item?.pemakaian_barang_surat_tugas || item?.pemakaian || [];
}

function kodeItemSurat(item) {
  return (
    item?.master_toner?.kode_toner ||
    item?.master_printer?.mp_no ||
    item?.mp_no ||
    item?.master_suku_cadang?.kode_suku_cadang ||
    item?.jenis_barang ||
    "-"
  );
}

function deskripsiItemSurat(item) {
  return (
    item?.master_toner?.nama_toner ||
    item?.master_printer?.master_printer_model?.nama_model ||
    item?.master_printer?.mp_no ||
    item?.master_suku_cadang?.nama_suku_cadang ||
    item?.keterangan ||
    "-"
  );
}

function catatanPdfSurat(item) {
  const unitResults = (item?.surat_tugas_printer || []).filter((line) => line.hasil).map((line) => `${line.mp_no}: ${line.hasil}${line.kondisi_hasil ? ` (${line.kondisi_hasil})` : ""}${line.alasan ? ` - ${line.alasan}` : ""}`);
  return [item?.catatan_masalah, item?.tindakan, item?.hasil, ...unitResults]
    .filter(Boolean)
    .join("\n");
}

function templatePdfSurat(item) {
  const rows = [
    ...(item?.surat_tugas_printer || []).map((line) => ({
      master_printer: line.master_printer,
      mp_no: line.mp_no,
      serial_number: line.serial_number || line.master_printer?.serial_number,
      jenis_barang: "printer",
      jumlah_pakai: 1,
      keterangan: line.master_printer_model?.nama_model || line.mp_no
    })),
    ...pemakaianSurat(item)
  ];
  const itemRows = rows.length
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(kodeItemSurat(row))}</td>
          <td>${escapeHtml(row.jenis_barang === "printer" ? "Unit Printer" : "Stock")}</td>
          <td>${escapeHtml(deskripsiItemSurat(row))}</td>
          <td>${escapeHtml(row.jumlah_pakai)}</td>
          <td>${escapeHtml(row.serial_number || "No Serial")}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" class="empty">Tidak ada item/barang.</td></tr>`;
  const validator = penggunaLabel(item.master_pengguna_surat_tugas_validasi_warehouse_olehTomaster_pengguna);
  const authorizer = penggunaLabel(
    item.master_pengguna_surat_tugas_validasi_kepala_olehTomaster_pengguna ||
    item.master_pengguna_surat_tugas_disetujui_olehTomaster_pengguna
  );
  const validatedAt = item.validasi_warehouse_pada ? formatTanggalPdf(item.validasi_warehouse_pada) : "";
  const authorizedAt = (item.validasi_kepala_teknisi_pada || item.disetujui_pada)
    ? formatTanggalPdf(item.validasi_kepala_teknisi_pada || item.disetujui_pada)
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(item.nomor_surat_tugas || "Surat Tugas")}</title>
  <style>
    @page { size: A4 landscape; margin: 20mm 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.35; }
    .sheet { width: 100%; min-height: 180mm; padding: 10px 0; }
    h1 { margin: 0 0 4px; font-size: 22px; line-height: 1.1; letter-spacing: .2px; }
    .company p { margin: 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 90px; margin-top: 58px; }
    .meta-row { display: grid; grid-template-columns: 190px 20px 1fr; min-height: 36px; align-items: start; }
    table { width: 100%; border-collapse: collapse; }
    .items { margin-top: 48px; }
    th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; vertical-align: top; }
    th { font-weight: 700; }
    .empty { text-align: center; }
    .notes { min-height: 84px; margin-top: 50px; border: 1px solid #000; padding: 10px 12px; }
    .notes strong { display: block; margin-bottom: 12px; font-weight: 400; }
    .signatures { width: 74%; margin: 78px 0 0 auto; }
    .signatures td { width: 33.333%; height: 96px; padding: 8px 10px; }
    .signature-name { display: block; margin-top: 48px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { padding: 0; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="company">
      <h1>PT. MULTI PRIMA MANDIRI SUKSES</h1>
      <p>Jl. Hidup Baru Blok D No.6 Gunung Sahari DKI Jakarta 14420</p>
      <p>Telp.6415351/52 Fax. 6415263</p>
    </section>

    <section class="meta">
      <div>
        <div class="meta-row"><span>Tanggal Surat Tugas</span><span>:</span><span>${escapeHtml(formatTanggalPdf(item.tanggal_jadwal || item.tanggal_dibuat))}</span></div>
        <div class="meta-row"><span>Nomor surat tugas</span><span>:</span><span>${escapeHtml(item.nomor_surat_tugas)}</span></div>
        <div class="meta-row"><span>Jenis tugas</span><span>:</span><span>${escapeHtml(item.jenis_tugas || item.jenis_pekerjaan || "Service")}</span></div>
        <div class="meta-row"><span>MP No / Serial</span><span>:</span><span>${escapeHtml((item.surat_tugas_printer || []).map((line) => [line.mp_no, line.serial_number || line.master_printer?.serial_number].filter(Boolean).join(" / ")).join(", ") || [item.master_printer?.mp_no || item.mp_no, item.master_printer?.serial_number].filter(Boolean).join(" / ") || "-")}</span></div>
      </div>
      <div>
        <div class="meta-row"><span>Request By</span><span>:</span><span>${escapeHtml(picSurat(item))}</span></div>
        <div class="meta-row"><span>Request Address</span><span>:</span><span>${escapeHtml(alamatSurat(item))}</span></div>
        <div class="meta-row"><span>No. Tiket</span><span>:</span><span>${escapeHtml(nomorKomplainSurat(item))}</span></div>
      </div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th style="width: 12%;">Item ID</th>
          <th style="width: 18%;">Item Type</th>
          <th>Item Description</th>
          <th style="width: 6%;">Qty</th>
          <th style="width: 30%;">Serial No</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <section class="notes">
      <strong>Notes :</strong>
      <div>${nl2br(catatanPdfSurat(item))}</div>
    </section>

    <table class="signatures">
      <tr>
        <td>Validate by<span class="signature-name">${escapeHtml(validator)}${validatedAt ? `<br>${escapeHtml(validatedAt)}` : ""}</span></td>
        <td>Authorized by<span class="signature-name">${escapeHtml(authorizer)}${authorizedAt ? `<br>${escapeHtml(authorizedAt)}` : ""}</span></td>
        <td>Customer</td>
      </tr>
    </table>
  </main>
</body>
</html>`;
}

async function cetakSuratTugas(item) {
  if (!canPrintSuratItem(item)) {
    pesanError.value = "PDF surat tugas baru bisa dicetak setelah status Ready to Print.";
    return;
  }
  const popup = window.open("", "_blank", "width=1200,height=800");
  if (!popup) {
    pesanError.value = "Popup diblokir browser. Izinkan popup untuk mencetak PDF surat tugas.";
    return;
  }
  try {
    loading.value = true;
    const response = await api.get(`/surat-tugas/${item.id}`);
    const detail = response.data.data;
    popup.document.open();
    popup.document.write(templatePdfSurat(detail));
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 350);
  } catch (error) {
    popup.close();
    pesanError.value = error.response?.data?.pesan || "PDF surat tugas gagal dibuat.";
  } finally {
    loading.value = false;
  }
}

function labelAction(action) {
  const labels = {
    view: "View",
    create: "Create",
    update: "Update",
    delete: "Delete",
    resolve: "Resolve",
    workflow: "Workflow"
  };
  return labels[action] || action;
}

function permissionKey(action) {
  return `can_${action}`;
}

function permissionModuleLabel(modul) {
  return pengaturan.modules.find((item) => item.key === modul)?.label || modul;
}

function roleLabel(role) {
  return labelStatus(role).replace("-", " ");
}

function normalisasiRoleFrontend(role) {
  return String(role || "")
    .replace("sales-admin", "sales_admin")
    .replace("kepala-teknisi", "kepala_teknisi");
}

function teknisiAssigned(item) {
  if (isAdmin.value) return true;
  return item?.teknisi_surat_tugas?.some((row) => row.teknisi_id === pengguna.value?.id);
}

function suratPunyaItem(item) {
  return Boolean(item?.pemakaian_barang_surat_tugas?.length || item?.pemakaian?.length);
}

function statusBisaPrint(status) {
  return ["technician_completed", "warehouse_validated", "solved"].includes(status);
}

function canUpdateItem(item) {
  if (currentConfig.value?.readOnly) return false;
  if (isAdmin.value) return true;
  if (activeView.value === "pengaduan") return false;
  if (activeView.value === "suratTugas") return roleAktif.value === "kepala_teknisi" || (roleAktif.value === "teknisi" && teknisiAssigned(item));
  return roleAktif.value === "admin";
}

function canOpenItem(item) {
  if (!item) return false;
  if (["pengaduan", "suratTugas", "account"].includes(activeView.value)) return true;
  return canUpdateItem(item);
}

function canDeactivateItem(item) {
  if (!item) return false;
  if (currentConfig.value?.readOnly || activeView.value === "printer") return false;
  if (currentConfig.value?.flow) return isAdmin.value && !["solved", "cancelled"].includes(item.status);
  return canUpdateItem(item);
}

function canResolveComplaintItem(item) {
  if (!(isAdmin.value || roleAktif.value === "sales_admin")) return false;
  if (["solved", "cancelled"].includes(item?.status)) return false;
  const suratTerkait = options.suratTugas.filter((surat) => surat.pengaduan_id === item?.id);
  return suratTerkait.length > 0 && suratTerkait.every((surat) => surat.status === "solved");
}

function canRunSuratAction(item, action) {
  if (!item) return false;
  if (action === "start") return (isAdmin.value || roleAktif.value === "kepala_teknisi") && item.status === "pending";
  if (action === "selesaiTeknisi") return (isAdmin.value || (roleAktif.value === "teknisi" && teknisiAssigned(item))) && item.status === "progress";
  if (action === "validasiWarehouse") return (isAdmin.value || roleAktif.value === "warehouse") && item.status === "technician_completed" && suratPunyaItem(item);
  if (action === "resolve") {
    if (!(isAdmin.value || roleAktif.value === "kepala_teknisi")) return false;
    return suratPunyaItem(item) ? item.status === "warehouse_validated" : item.status === "technician_completed";
  }
  return false;
}

function canPrintSuratItem(item) {
  return (activeView.value === "suratTugasBaru" || currentConfig.value?.flow === "suratTugas") && statusBisaPrint(item?.status);
}

function canTambahItemSurat() {
  return form.id && (isAdmin.value || (roleAktif.value === "teknisi" && teknisiAssigned(form))) && form.status === "progress";
}

async function handleFieldChange(name) {
  if (name === "kategori_id" && activeView.value === "printer") form.model_id = "";
  if (name === "account_id") {
    form.customer_id = "";
    form.printer_id = "";
    await muatCustomerOptions(form.account_id);
    await muatInstalledPrinterOptions();
  }
  if (name === "customer_id") {
    form.printer_id = "";
    await muatInstalledPrinterOptions();
  }
  if (name === "printer_id" && form.printer_id) {
    const printer = options.printerTerpasang.find((row) => row.id === form.printer_id);
    if (printer) form.mp_no = printer.mp_no;
  }
  if (currentConfig.value?.flow === "suratTugas" && name === "pengaduan_id") {
    const pengaduan = options.pengaduan.find((item) => item.id === form.pengaduan_id);
    if (!pengaduan) return;
    form.mp_no = pengaduan.mp_no || "";
    form.account_id = pengaduan.account_id || "";
    await muatCustomerOptions(form.account_id);
    form.customer_id = pengaduan.customer_id || "";
    form.printer_id = pengaduan.printer_id || "";
    form.catatan_masalah = pengaduan.deskripsi_masalah || "";
    await muatInstalledPrinterOptions();
  }
}

function tampilkanFieldForm(item) {
  if (["toner", "sukuCadang"].includes(activeView.value) && item.name === "aktif" && modeForm.value === "create") return false;
  if (item.name === "printer_id" && activeView.value === "suratTugas" && !["maintenance", "support", "replacement"].includes(form.jenis_pekerjaan)) return false;
  if (item.name === "gudang_id" && ["printer", "toner", "sukuCadang"].includes(activeView.value) && modeForm.value === "edit") return false;
  if (item.name === "status" && activeView.value === "suratTugas") {
    return false;
  }
  return true;
}

function fieldWajib(item) {
  if (activeView.value === "printer" && item.name === "tanggal_maintenance_berikutnya") return Boolean(form.interval_maintenance_bulan);
  if (activeView.value === "printer" && item.name === "interval_maintenance_bulan") return Boolean(form.tanggal_maintenance_berikutnya);
  return item.required;
}

function relationOptions(item) {
  const rows = options[item.source] || [];
  if (item.name === "model_id") return rows.filter((option) => option.kategori_id === form.kategori_id && (option.aktif || option.id === form.model_id));
  if (item.source === "printerKategori") return rows.filter((option) => option.aktif || option.id === form.kategori_id);
  if (item.name === "gudang_id" && ["printer", "toner", "sukuCadang"].includes(activeView.value)) {
    return rows.filter((option) => option.aktif);
  }
  if (item.name === "sales_id") {
    return rows.filter((option) => normalisasiRoleFrontend(option.role || option.peran) === "sales");
  }
  if (item.name === "account_id") return rows.filter((option) => option.aktif || option.id === form.account_id);
  if (item.name === "customer_id") return rows.filter((option) => option.account_id === form.account_id && (option.aktif || option.id === form.customer_id));
  if (item.name === "printer_id") return rows.filter((option) => option.customer_id === form.customer_id);
  return rows;
}

async function muatCustomerOptions(accountId) {
  options.customer = [];
  if (!accountId) return;
  try {
    const response = await api.get(`/account/${accountId}/customer`);
    if (form.account_id !== accountId) return;
    options.customer = response.data.data?.items || [];
    const aktif = options.customer.filter((item) => item.aktif);
    if (!form.customer_id && aktif.length === 1) form.customer_id = aktif[0].id;
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Customer gagal dimuat.";
  }
}

async function muatInstalledPrinterOptions() {
  options.printerTerpasang = [];
  if (!form.customer_id) return;
  try {
    const response = await api.get("/printer-terpasang", {
      params: { customer_id: form.customer_id, cari: installedPrinterSearch.value, batas: 100 }
    });
    options.printerTerpasang = response.data.data?.items || [];
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Printer terpasang gagal dimuat.";
  }
}

function badgeClass(value) {
  if (value === true || ["aktif", "terhubung", "selesai", "disetujui", "terposting", "solved", "warehouse_validated"].includes(String(value).toLowerCase())) return "success";
  if (["darurat", "tinggi", "dibatalkan", "nonaktif", "cancelled"].includes(String(value).toLowerCase())) return "danger";
  if (["draft", "baru", "ditugaskan", "diproses", "diajukan", "new", "pending", "progress", "technician_completed"].includes(String(value).toLowerCase())) return "info";
  return "neutral";
}

function resetForm() {
  Object.keys(form).forEach((key) => delete form[key]);
  currentConfig.value?.fields.forEach((item) => {
    if (item.type === "checkbox") form[item.name] = true;
    else if (item.defaultValue === "now") form[item.name] = localDateTimeValue();
    else form[item.name] = item.defaultValue || "";
  });
}

function localDateTimeValue(value = new Date()) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function resetItemForm() {
  Object.assign(itemForm, {
    gudang_id: "",
    jenis_barang: "toner",
    item_id: "",
    jumlah_pakai: 1,
    serial_number: "",
    keterangan: ""
  });
}

function resetSiteForm() {
  Object.assign(siteForm, {
    id: "",
    kode_customer: "",
    nama_customer: "",
    alamat: "",
    nama_pic: "",
    telepon_pic: "",
    email_pic: "",
    aktif: true
  });
  siteMode.value = "create";
}

function resetFirstCustomerForm() {
  Object.assign(firstCustomerForm, {
    kode_customer: "",
    nama_customer: "",
    alamat: "",
    nama_pic: "",
    telepon_pic: "",
    email_pic: "",
    aktif: true
  });
}

async function muatSitePelanggan(accountId = form.id) {
  if (!accountId) {
    siteRows.value = [];
    return;
  }
  try {
    const response = await api.get(`/account/${accountId}/customer`);
    siteRows.value = response.data.data?.items || [];
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Customer gagal dimuat.";
  }
}

function bukaSite(site = null) {
  resetSiteForm();
  if (site) {
    Object.assign(siteForm, site);
    siteMode.value = "edit";
  }
  siteFormVisible.value = true;
}

async function simpanSite() {
  if (!form.id || !isAdmin.value) return;
  const data = {
    kode_customer: siteForm.kode_customer.trim(),
    nama_customer: siteForm.nama_customer.trim(),
    alamat: siteForm.alamat.trim(),
    nama_pic: siteForm.nama_pic?.trim() || null,
    telepon_pic: siteForm.telepon_pic?.trim() || null,
    email_pic: siteForm.email_pic?.trim() || null,
    aktif: Boolean(siteForm.aktif)
  };
  try {
    loading.value = true;
    if (siteMode.value === "edit") await api.put(`/account/${form.id}/customer/${siteForm.id}`, data);
    else await api.post(`/account/${form.id}/customer`, data);
    pesanSukses.value = "Customer berhasil disimpan.";
    siteFormVisible.value = false;
    await Promise.all([muatSitePelanggan(), muatHalaman(), muatOptions()]);
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Customer gagal disimpan.";
  } finally {
    loading.value = false;
  }
}

async function bukaForm(item = null, prefill = null) {
  resetForm();
  installedPrinterSearch.value = "";
  formTab.value = "general";
  resetItemForm();
  siteRows.value = [];
  resetSiteForm();
  resetFirstCustomerForm();
  siteFormVisible.value = false;
  modeForm.value = item ? "edit" : "create";
  if (currentConfig.value?.fields?.some((fieldItem) => fieldItem.type === "relation")) {
    await muatOptions();
  }
  if (item) {
    let sumber = item;
    if (currentConfig.value?.flow === "suratTugas") {
      try {
        loading.value = true;
        const response = await api.get(`/surat-tugas/${item.id}`);
        sumber = response.data.data || item;
      } catch (error) {
        pesanError.value = error.response?.data?.pesan || "Detail surat tugas gagal dimuat.";
      } finally {
        loading.value = false;
      }
    }
    Object.assign(form, sumber);
    form.id = sumber.id;
    if (activeView.value === "printer") form.kategori_id = sumber.master_printer_model?.kategori_id || "";
    form.pic_teknisi_id = sumber.teknisi_surat_tugas?.find((row) => row.peran === "utama")?.teknisi_id || "";
    currentConfig.value?.fields.forEach((fieldItem) => {
      if (fieldItem.type === "datetime-local" && form[fieldItem.name]) {
        form[fieldItem.name] = String(form[fieldItem.name]).slice(0, 16);
      }
      if (fieldItem.type === "date" && form[fieldItem.name]) {
        form[fieldItem.name] = String(form[fieldItem.name]).slice(0, 10);
      }
      if (fieldItem.name === "password") form[fieldItem.name] = "";
    });
  }
  if (prefill) Object.assign(form, prefill);
  if (form.account_id) await muatCustomerOptions(form.account_id);
  if (["pengaduan", "suratTugas"].includes(activeView.value)) await muatInstalledPrinterOptions();
  modalTerbuka.value = true;
  if (activeView.value === "account" && form.id) await muatSitePelanggan(form.id);
}

function payloadForm() {
  const data = {};
  currentConfig.value.fields.forEach((item) => {
    if (item.name === "gudang_id" && ["printer", "toner", "sukuCadang"].includes(activeView.value) && modeForm.value === "edit") return;
    if (item.name === "kategori_id" && activeView.value === "printer") return;
    if (item.name === "status" && activeView.value === "suratTugas" && modeForm.value === "edit") return;
    if (activeView.value === "suratTugas" && form.tanggal_maintenance_otomatis && ["account_id", "customer_id", "printer_id", "jenis_pekerjaan", "tanggal_jadwal"].includes(item.name)) return;
    const value = form[item.name];
    if (item.readonly && (value === "" || value == null)) return;
    if (item.name === "password" && modeForm.value === "edit" && !value) return;
    if (item.type === "number") data[item.name] = value === "" || value == null ? (item.name === "interval_maintenance_bulan" ? null : 0) : Number(value);
    else if (item.type === "checkbox") data[item.name] = Boolean(value);
    else data[item.name] = value === "" ? null : value;
  });
  if (activeView.value === "account" && modeForm.value === "create") {
    data.customer_pertama = {
      kode_customer: firstCustomerForm.kode_customer.trim(),
      nama_customer: firstCustomerForm.nama_customer.trim(),
      alamat: firstCustomerForm.alamat.trim(),
      nama_pic: firstCustomerForm.nama_pic?.trim() || null,
      telepon_pic: firstCustomerForm.telepon_pic?.trim() || null,
      email_pic: firstCustomerForm.email_pic?.trim() || null,
      aktif: true
    };
  }
  return data;
}

async function simpanForm() {
  if (modeForm.value === "edit" && !canUpdateItem(form)) {
    pesanError.value = "Anda tidak memiliki akses untuk mengubah data ini.";
    return;
  }
  if (modeForm.value === "create" && !canCreate.value) {
    pesanError.value = "Anda tidak memiliki akses untuk membuat data ini.";
    return;
  }
  try {
    loading.value = true;
    const config = currentConfig.value;
    let saved;
    if (modeForm.value === "edit") {
      saved = await api.put(`${config.endpoint}/${form.id}`, payloadForm());
      pesanSukses.value = "Data berhasil diperbarui.";
    } else {
      saved = await api.post(config.endpoint, payloadForm());
      pesanSukses.value = "Data berhasil dibuat.";
    }
    if (activeView.value === "account") {
      form.id = saved.data.data.id;
      modeForm.value = "edit";
      formTab.value = "customer";
      await muatSitePelanggan(form.id);
    } else {
      modalTerbuka.value = false;
    }
    await muatOptions();
    await muatHalaman();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Data gagal disimpan.";
  } finally {
    loading.value = false;
  }
}

function mintaKonfirmasi(item, mode = "deactivate", jenis = "account") {
  targetHapus.value = item;
  targetHapusJenis.value = jenis;
  modeKonfirmasi.value = mode;
  konfirmasiHapusTerbuka.value = true;
}

function batalHapus() {
  if (loading.value) return;
  targetHapus.value = null;
  targetHapusJenis.value = "account";
  modeKonfirmasi.value = "deactivate";
  konfirmasiHapusTerbuka.value = false;
}

async function konfirmasiHapus() {
  const item = targetHapus.value;
  if (!item) return;
  try {
    loading.value = true;
    if (targetHapusJenis.value === "customer") {
      const endpoint = `/account/${form.id}/customer/${item.id}`;
      if (modeKonfirmasi.value === "delete") {
        await api.delete(`${endpoint}/permanent`);
        pesanSukses.value = "Customer berhasil dihapus permanen.";
      } else {
        await api.delete(endpoint);
        pesanSukses.value = "Customer berhasil dinonaktifkan.";
      }
      await muatSitePelanggan();
      await muatOptions();
    } else if (modeKonfirmasi.value === "delete") {
      await api.delete(`${currentConfig.value.endpoint}/${item.id}/permanent`);
      pesanSukses.value = "Data berhasil dihapus permanen.";
    } else if (currentConfig.value.flow === "suratTugas") {
      await api.put(`/surat-tugas/${item.id}`, { status: "cancelled" });
      pesanSukses.value = "Surat tugas dibatalkan.";
    } else if (currentConfig.value.flow === "pengaduan") {
      await api.delete(`${currentConfig.value.endpoint}/${item.id}`);
      pesanSukses.value = "Komplain dibatalkan.";
    } else {
      await api.delete(`${currentConfig.value.endpoint}/${item.id}`);
      pesanSukses.value = "Data berhasil dinonaktifkan.";
    }
    await muatHalaman();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Aksi data gagal diproses.";
  } finally {
    loading.value = false;
    targetHapus.value = null;
    targetHapusJenis.value = "account";
    modeKonfirmasi.value = "deactivate";
    konfirmasiHapusTerbuka.value = false;
  }
}

async function aksiSurat(item, action) {
  const actionMap = {
    start: {
      endpoint: "start",
      pesan: "Surat tugas dimulai."
    },
    selesaiTeknisi: {
      endpoint: "selesai-teknisi",
      pesan: "Surat tugas selesai oleh teknisi."
    },
    validasiWarehouse: {
      endpoint: "validasi-warehouse",
      pesan: "Validasi 1 warehouse berhasil."
    },
    resolve: {
      endpoint: "resolve",
      pesan: "Validasi 2 kepala teknisi berhasil."
    },
    setujui: {
      endpoint: "validasi-warehouse",
      pesan: "Barang surat tugas berhasil divalidasi warehouse."
    }
  };
  const target = actionMap[action];
  if (!target) return;
  if (!canRunSuratAction(item, action)) {
    pesanError.value = "Anda tidak memiliki akses atau status surat tugas belum sesuai untuk aksi ini.";
    return;
  }
  try {
    loading.value = true;
    await api.post(`/surat-tugas/${item.id}/${target.endpoint}`);
    pesanSukses.value = target.pesan;
    await muatHalaman();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Aksi surat tugas gagal.";
  } finally {
    loading.value = false;
  }
}

async function resolveKomplain(item) {
  if (!canResolveComplaintItem(item)) {
    pesanError.value = "Hanya sales admin yang bisa resolve komplain setelah surat tugas selesai.";
    return;
  }
  try {
    loading.value = true;
    await api.post(`/pengaduan/${item.id}/resolve`);
    pesanSukses.value = "Komplain berhasil diselesaikan.";
    await muatHalaman();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Komplain gagal diselesaikan.";
  } finally {
    loading.value = false;
  }
}

function buatSuratDariKomplain() {
  if (!(isAdmin.value || roleAktif.value === "kepala_teknisi")) {
    pesanError.value = "Hanya kepala teknisi yang bisa membuat surat tugas dari komplain.";
    return;
  }
  const sumber = { ...form };
  activeView.value = "suratTugas";
  bukaForm(null, {
    pengaduan_id: sumber.id || "",
    mp_no: sumber.mp_no || "",
    account_id: sumber.account_id || "",
    customer_id: sumber.customer_id || "",
    printer_id: sumber.printer_id || "",
    catatan_masalah: sumber.deskripsi_masalah || "",
    status: "pending"
  });
}

async function simpanItemSurat() {
  if (!form.id) return;
  if (!canTambahItemSurat()) {
    pesanError.value = "Item hanya bisa ditambahkan oleh teknisi assigned saat surat tugas progress atau ready to print.";
    return;
  }
  try {
    loading.value = true;
    const idField = {
      toner: "toner_id",
      printer: "printer_id",
      suku_cadang: "suku_cadang_id"
    }[itemForm.jenis_barang];
    await api.post(`/surat-tugas/${form.id}/pemakaian`, {
      gudang_id: itemForm.gudang_id,
      jenis_barang: itemForm.jenis_barang,
      [idField]: itemForm.item_id,
      jumlah_pakai: Number(itemForm.jumlah_pakai),
      serial_number: itemForm.serial_number || null,
      keterangan: itemForm.keterangan || null
    });
    pesanSukses.value = "Item surat tugas berhasil ditambahkan.";
    const response = await api.get(`/surat-tugas/${form.id}`);
    Object.assign(form, response.data.data);
    await muatHalaman();
    resetItemForm();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Item surat tugas gagal ditambahkan.";
  } finally {
    loading.value = false;
  }
}

async function hapusItemSurat(item) {
  if (!form.id || !canTambahItemSurat()) return;
  if (!window.confirm("Hapus item surat tugas ini?")) return;
  try {
    loading.value = true;
    await api.delete(`/surat-tugas/${form.id}/pemakaian/${item.id}`);
    pesanSukses.value = "Item surat tugas berhasil dihapus.";
    const response = await api.get(`/surat-tugas/${form.id}`);
    Object.assign(form, response.data.data);
    await muatHalaman();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Item surat tugas gagal dihapus.";
  } finally {
    loading.value = false;
  }
}

async function bukaMutasiStok(jenis = "masuk", row = null) {
  const itemField = {
    toner: "toner_id",
    printer: "printer_id",
    suku_cadang: "suku_cadang_id"
  }[activeStockGroup.value];
  Object.assign(stockForm, {
    jenis_mutasi: jenis,
    gudang_asal_id: jenis === "keluar" ? row?.gudang_id || "" : "",
    gudang_tujuan_id: jenis === "masuk" ? row?.gudang_id || "" : "",
    jenis_barang: activeStockGroup.value || "toner",
    item_id: row?.[itemField] || "",
    jumlah: 1,
    keterangan: ""
  });
  modalStokTerbuka.value = true;
  await muatOptions();
}

async function simpanMutasiStok() {
  try {
    loading.value = true;
    const idField = {
      toner: "toner_id",
      printer: "printer_id",
      suku_cadang: "suku_cadang_id"
    }[stockForm.jenis_barang];
    await api.post("/mutasi-stok", {
      jenis_mutasi: stockForm.jenis_mutasi,
      gudang_asal_id: ["keluar", "transfer"].includes(stockForm.jenis_mutasi) ? stockForm.gudang_asal_id || null : null,
      gudang_tujuan_id: ["masuk", "transfer", "penyesuaian"].includes(stockForm.jenis_mutasi) ? stockForm.gudang_tujuan_id || null : null,
      keterangan: stockForm.keterangan || null,
      langsung_posting: true,
      detail: [
        {
          jenis_barang: stockForm.jenis_barang,
          [idField]: stockForm.item_id,
          jumlah: Number(stockForm.jumlah),
          satuan: "pcs"
        }
      ]
    });
    pesanSukses.value = stockForm.jenis_mutasi === "keluar" ? "Stok berhasil dikurangi." : "Stok berhasil diperbarui.";
    modalStokTerbuka.value = false;
    await muatStok();
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Mutasi stok gagal disimpan.";
  } finally {
    loading.value = false;
  }
}

async function ambilDaftarOptions(endpoint, semuaHalaman) {
  const first = await api.get(endpoint, { params: { batas: 100 } });
  const data = first.data.data;
  if (Array.isArray(data)) return data;
  const result = [...(data?.items || [])];
  if (!semuaHalaman || !data?.meta?.total) return result;
  const totalPages = Math.ceil(data.meta.total / 100);
  for (let start = 2; start <= totalPages; start += 5) {
    const pages = Array.from({ length: Math.min(5, totalPages - start + 1) }, (_, index) => start + index);
    const responses = await Promise.all(pages.map((halaman) => api.get(endpoint, { params: { batas: 100, halaman } })));
    responses.forEach((response) => result.push(...(response.data.data?.items || [])));
  }
  return result;
}

async function muatOptions() {
  const loaders = [
    ["account", "/account"],
    ["printerKategori", "/printer-kategori"],
    ["printerModel", "/printer-model"],
    ["toner", "/toner"],
    ["sukuCadang", "/suku-cadang"],
    ["gudang", "/gudang"],
    ["pengguna", "/pengguna"],
    ["pengaduan", "/pengaduan"],
    ["tiket", "/tiket"],
    ["suratTugas", "/surat-tugas"]
  ];
  const pagedOptions = new Set(["account", "printerKategori", "printerModel", "toner", "sukuCadang", "gudang", "tiket"]);
  const responses = await Promise.allSettled(loaders.map(([key, endpoint]) => ambilDaftarOptions(endpoint, pagedOptions.has(key))));
  const gagalWajib = [];
  responses.forEach((result, index) => {
    const key = loaders[index][0];
    if (result.status !== "fulfilled") {
      if (["account", "pengguna", "printerKategori", "printerModel"].includes(key) || (key === "gudang" && ["printer", "toner", "sukuCadang"].includes(activeView.value))) {
        gagalWajib.push(key);
      }
      return;
    }
    options[key] = result.value;
  });
  options.teknisi = options.pengguna.filter((item) => ["teknisi", "technician"].includes(item.role || item.peran));
  if (gagalWajib.length) {
    pesanError.value = `Data dropdown gagal dimuat: ${gagalWajib.join(", ")}.`;
  }
}

async function muatHalaman() {
  if (activeView.value === "dashboard") {
    await Promise.all([muatOptions(), muatStok(true), muatPrinterSummary()]);
    return;
  }
  if (["rolePermission", "slaPending"].includes(activeView.value)) {
    await muatPengaturan();
    return;
  }
  if (activeStockView.value) {
    await muatStok();
    return;
  }
  if (activeView.value === "audit") {
    auditItems.value = [];
    return;
  }
  if (activeView.value === "auditBarang") return;
  const config = currentConfig.value;
  if (!config) return;
  try {
    loading.value = true;
    const params = config.serverPagination
      ? {
          cari: cari.value,
          halaman: pagination.page,
          batas: pagination.pageSize,
          ...Object.fromEntries((config.printerFilterFields || []).filter((key) => printerFilters[key]).map((key) => [key, printerFilters[key]]))
        }
      : config.search ? { cari: cari.value, batas: 100 } : {};
    const response = await api.get(config.endpoint, { params });
    const data = response.data.data;
    items.value = Array.isArray(data) ? data : data?.items || [];
    serverTotal.value = config.serverPagination ? data?.meta?.total || 0 : 0;
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Data gagal dimuat.";
  } finally {
    loading.value = false;
  }
}

async function muatPrinterSummary() {
  try {
    const response = await api.get("/printer/summary");
    Object.assign(printerSummary, response.data.data);
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Ringkasan printer gagal dimuat.";
  }
}

async function ubahPrinterFilter(key, value) {
  printerFilters[key] = value;
  if (key === "kategori_id") printerFilters.model_id = "";
  resetPagination();
  await muatHalaman();
}

async function muatAvailablePrinters() {
  availablePrinterOptions.value = [];
  if (itemForm.jenis_barang !== "printer" || !itemForm.gudang_id) return;
  try {
    const response = await api.get("/printer", {
      params: { status: "available", gudang_id: itemForm.gudang_id, cari: printerItemSearch.value, batas: 25 }
    });
    availablePrinterOptions.value = response.data.data?.items || [];
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Unit printer gagal dimuat.";
  }
}

function pilihItemSurat() {
  if (itemForm.jenis_barang !== "printer") return;
  const unit = availablePrinterOptions.value.find((row) => row.id === itemForm.item_id);
  itemForm.serial_number = unit?.serial_number || "";
  itemForm.jumlah_pakai = 1;
}

async function muatPengaturan() {
  try {
    loading.value = true;
    const response = await api.get("/pengaturan", { params: { role: pengaturan.roleDipilih } });
    const data = response.data.data;
    pengaturan.slaPendingJam = data.sla?.pending_setelah_jam || 24;
    pengaturan.roles = data.roles || pengaturan.roles;
    pengaturan.modules = data.modules || [];
    pengaturan.actions = data.actions || pengaturan.actions;
    pengaturan.permissions = data.permissions || [];
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Pengaturan gagal dimuat.";
  } finally {
    loading.value = false;
  }
}

async function simpanSla() {
  try {
    loading.value = true;
    await api.put("/pengaturan/sla-pending-komplain", {
      pending_setelah_jam: Number(pengaturan.slaPendingJam)
    });
    pesanSukses.value = "SLA pending komplain berhasil disimpan.";
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "SLA gagal disimpan.";
  } finally {
    loading.value = false;
  }
}

async function simpanPermission() {
  try {
    loading.value = true;
    const response = await api.put("/pengaturan/role-permission", {
      role: pengaturan.roleDipilih,
      permissions: pengaturan.permissions
    });
    pengaturan.permissions = response.data.data || pengaturan.permissions;
    pesanSukses.value = "Permission role berhasil disimpan.";
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Permission gagal disimpan.";
  } finally {
    loading.value = false;
  }
}

async function muatStok(silent = false) {
  try {
    loading.value = true;
    const response = await api.get("/stok");
    Object.assign(stok, response.data.data);
  } catch (error) {
    if (!silent) pesanError.value = error.response?.data?.pesan || "Stok gagal dimuat.";
  } finally {
    loading.value = false;
  }
}

async function muatAudit() {
  if (!auditFilterSiap.value) {
    auditItems.value = [];
    return;
  }
  try {
    loading.value = true;
    const params = Object.fromEntries(
      Object.entries(auditFilter).filter(([, value]) => value)
    );
    const response = await api.get("/audit", { params });
    auditItems.value = response.data.data || [];
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Audit gagal dimuat.";
  } finally {
    loading.value = false;
  }
}

function resetAuditFilter() {
  Object.assign(auditFilter, {
    tanggal_mulai: "",
    tanggal_selesai: "",
    user: "",
    nomor_tiket: "",
    nomor_surat_tugas: ""
  });
  auditItems.value = [];
  resetAuditPagination();
}

function labelOption(source, option, labelKey) {
  if (!option) return "-";
  if (source === "printer") return `${option.merek || ""} ${option.model || ""}`.trim();
  if (source === "pengaduan") return `${option.nomor_pengaduan} - ${option.nama_pelapor}`;
  return option[labelKey] || option.name || option.nama || option.kode || option.id;
}

async function muatProfil() {
  try {
    const response = await api.get("/auth/saya");
    pengguna.value = response.data.data;
    statusBackend.value = "Terhubung";
    await Promise.all([muatOptions(), muatStok(true), muatPrinterSummary()]);
  } catch (error) {
    pesanError.value = error.response?.data?.pesan || "Sesi tidak valid.";
    hapusToken();
    await router.push({ name: "login" });
  }
}

async function keluar() {
  userMenuTerbuka.value = false;
  hapusToken();
  await router.push({ name: "login" });
}

onMounted(muatProfil);
</script>

<template>
  <main class="app-shell" :class="{ 'sidebar-open': sidebarTerbuka }">
    <button
      v-if="sidebarTerbuka"
      class="sidebar-backdrop"
      type="button"
      aria-label="Tutup menu"
      @click="sidebarTerbuka = false"
    />

    <aside class="sidebar">
      <div class="sidebar-brand">
        <img class="sidebar-logo" :src="logoMulti" alt="Multi Print" />
        <button class="sidebar-close" type="button" title="Tutup menu" @click="sidebarTerbuka = false">
          <X :size="20" />
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Menu utama">
        <section v-for="group in menu" :key="group.section" class="menu-section">
          <p>{{ group.section }}</p>
          <div class="menu-list">
            <div v-for="item in group.items" v-show="(!item.adminOnly || isAdmin) && (item.key !== 'auditBarang' || canViewAuditBarang)" :key="item.nama" class="menu-block">
              <button
                type="button"
                class="menu-item"
                :class="{ active: menuContains(item, activeView), 'has-children': item.children }"
                :aria-current="item.key === activeView ? 'page' : undefined"
                :aria-expanded="item.children ? item.terbuka : undefined"
                @click="pilihMenu(item)"
              >
                <component :is="item.icon" :size="21" />
                <span>{{ item.nama }}</span>
                <ChevronDown v-if="item.children && item.terbuka" class="menu-chevron" :size="18" />
                <ChevronRight v-else-if="item.children || item.arah" class="menu-chevron" :size="18" />
              </button>

              <Transition name="submenu">
                <div v-if="item.children && item.terbuka" class="submenu-list">
                  <div v-for="child in item.children" :key="child.nama" class="submenu-block">
                    <button
                      type="button"
                      class="submenu-item"
                      :class="{ active: menuContains(child, activeView) }"
                      :aria-current="child.key === activeView ? 'page' : undefined"
                      :aria-expanded="child.children ? child.terbuka : undefined"
                      @click="pilihMenu(child)"
                    >
                      <component :is="child.icon" :size="20" />
                      <span>{{ child.nama }}</span>
                      <ChevronDown v-if="child.children && child.terbuka" class="menu-chevron" :size="16" />
                      <ChevronRight v-else-if="child.children" class="menu-chevron" :size="16" />
                    </button>
                    <Transition name="submenu">
                      <div v-if="child.children && child.terbuka" class="submenu-list nested-submenu">
                        <button
                          v-for="grandchild in child.children"
                          :key="grandchild.key"
                          type="button"
                          class="submenu-item"
                          :class="{ active: grandchild.key === activeView }"
                          :aria-current="grandchild.key === activeView ? 'page' : undefined"
                          @click="pilihMenu(grandchild)"
                        >
                          <component :is="grandchild.icon" :size="18" />
                          <span>{{ grandchild.nama }}</span>
                        </button>
                      </div>
                    </Transition>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </section>
      </nav>

    </aside>

    <section class="content-area">
      <header class="topbar">
        <div class="topbar-heading">
          <button class="mobile-menu-button" type="button" title="Buka menu" @click="sidebarTerbuka = true">
            <Menu :size="20" />
          </button>
          <div>
            <p class="eyebrow">{{ activeView === "dashboard" ? "Dashboard" : "Workspace" }}</p>
            <h1>{{ pageTitle }}</h1>
            <span class="page-subtitle">{{ pageSubtitle }}</span>
          </div>
        </div>

        <div class="user-menu">
          <button
            class="user-menu-trigger"
            type="button"
            :aria-expanded="userMenuTerbuka"
            aria-haspopup="menu"
            @click="userMenuTerbuka = !userMenuTerbuka"
          >
            <span class="user-avatar">{{ inisialPenggunaAktif }}</span>
            <span class="user-menu-name">{{ namaPenggunaAktif }}</span>
            <ChevronDown :size="16" />
          </button>

          <Transition name="submenu">
            <div v-if="userMenuTerbuka" class="user-dropdown" role="menu">
              <div class="user-dropdown-profile">
                <span class="user-avatar compact">{{ inisialPenggunaAktif }}</span>
                <div>
                  <strong>{{ namaPenggunaAktif }}</strong>
                  <span>{{ rolePenggunaAktif }}</span>
                </div>
              </div>
              <button class="user-dropdown-action" type="button" role="menuitem" @click="keluar">
                <LogOut :size="16" />
                <span>Logout</span>
              </button>
            </div>
          </Transition>
        </div>
      </header>

      <Transition name="toast-fade">
        <p v-if="pesanError" class="alert-error">{{ pesanError }}</p>
      </Transition>
      <Transition name="toast-fade">
        <p v-if="pesanSukses" class="alert-success">{{ pesanSukses }}</p>
      </Transition>

      <Dashboard
        v-if="activeView === 'dashboard'"
        :ringkasan-dashboard="ringkasanDashboard"
        :line-chart-data="lineChartData"
        :status-donut-data="statusDonutData"
        :surat-tugas-bar-data="suratTugasBarData"
        :stok-donut-data="stokDonutData"
        :teknisi-bar-data="teknisiBarData"
        :axis-options="axisOptions"
        :donut-options="donutOptions"
        :status-komplain="statusKomplain"
        :stok-barang="stokBarang"
      />

      <TiketPage
        v-else-if="activeView === 'tiket'"
        :role="roleAktif"
        @open-surat="bukaSuratDariTiket"
        @open-legacy="bukaKomplainArsip"
      />

      <SuratTugasBaruPage
        v-else-if="activeView === 'suratTugasBaru'"
        :role="roleAktif"
        :ticket-prefill="ticketPrefill"
        @print="cetakSuratTugas"
      />

      <SettingsPage
        v-else-if="['rolePermission', 'slaPending'].includes(activeView)"
        :active-section="activeView"
        :pengaturan="pengaturan"
        :filtered-permission-rows="filteredPermissionRows"
        :loading="loading"
        :label-action="labelAction"
        :permission-key="permissionKey"
        :permission-module-label="permissionModuleLabel"
        :role-label="roleLabel"
        @save-sla="simpanSla"
        @load-settings="muatPengaturan"
        @save-permission="simpanPermission"
      />

      <component
        :is="currentStockComponent"
        v-else-if="activeStockView"
        v-model:stok-search="stokSearch"
        :active-stock-view="activeStockView"
        :active-stock-group="activeStockGroup"
        :can-manage-stock="isAdmin || roleAktif === 'warehouse'"
        :can-view-audit-barang="canViewAuditBarang"
        :can-create-printer="isAdmin"
        :filtered-stok="filteredStok"
        :paginated-stok="paginatedStok"
        :stok-pagination="stokPagination"
        :stok-total-pages="stokTotalPages"
        :pagination-mulai="paginationMulai"
        :pagination-selesai="paginationSelesai"
        @reset-stock-pagination="resetStockPagination"
        @open-stock-mutation="bukaMutasiStok"
        @previous-page="halamanSebelumnya"
        @next-page="halamanBerikutnya"
        @create-printer="activeView = 'printer'; bukaForm()"
        @open-history="bukaAuditBarang(activeView, $event)"
      />

      <AuditBarangPage
        v-else-if="activeView === 'auditBarang'"
        :target="auditBarangTarget"
      />

      <AuditPage
        v-else-if="activeView === 'audit'"
        :audit-filter="auditFilter"
        :audit-pagination="auditPagination"
        :paginated-audit-items="paginatedAuditItems"
        :filtered-audit-items="filteredAuditItems"
        :audit-pagination-start="auditPaginationStart"
        :audit-pagination-end="auditPaginationEnd"
        :audit-total-pages="auditTotalPages"
        :audit-filter-siap="auditFilterSiap"
        :loading="loading"
        :value-of="valueOf"
        :badge-class="badgeClass"
        @reset-audit-pagination="resetAuditPagination"
        @load-audit="muatAudit"
        @reset-audit-filter="resetAuditFilter"
        @previous-page="halamanSebelumnya"
        @next-page="halamanBerikutnya"
      />

      <LokasiCustomer
        v-else-if="activeView === 'lokasiCustomer'"
        :key="locationRefreshKey"
        :can-manage="isAdmin"
        @open-import="importKind = 'lokasiCustomer'"
      />

      <component
        :is="currentCrudComponent"
        v-else-if="currentConfig"
        v-model:cari="cari"
        :current-config="currentConfig"
        :can-create="canCreate"
        :can-import="canImportMaster"
        :paginated-items="paginatedItems"
        :filtered-items="filteredItems"
        :pagination="pagination"
        :total-pages="totalPages"
        :pagination-start="paginationStart"
        :pagination-end="paginationEnd"
        :loading="loading"
        :can-hard-delete="Boolean(currentConfig.hardDelete)"
        :can-open-item="canOpenItem"
        :can-update-item="canUpdateItem"
        :can-deactivate-item="canDeactivateItem"
        :can-resolve-complaint-item="canResolveComplaintItem"
        :can-run-surat-action="canRunSuratAction"
        :can-print-surat-item="canPrintSuratItem"
        :can-view-audit-barang="canViewAuditBarang && ['printer', 'toner', 'sukuCadang'].includes(activeView)"
        :value-of="valueOf"
        :badge-class="badgeClass"
        :label-status="labelStatus"
        :total-items="currentConfig.serverPagination ? serverTotal : filteredItems.length"
        :printer-filters="printerFilters"
        :printer-filter-options="{ kategori: options.printerKategori, model: options.printerModel }"
        @reset-pagination="resetPagination"
        @load-page="muatHalaman"
        @open-form="bukaForm"
        @resolve-complaint="resolveKomplain"
        @action-surat="aksiSurat"
        @print-surat="cetakSuratTugas"
        @deactivate-item="mintaKonfirmasi($event, 'deactivate')"
        @hard-delete-item="mintaKonfirmasi($event, 'delete')"
        @previous-page="halamanSebelumnya"
        @next-page="halamanBerikutnya"
        @update-printer-filter="ubahPrinterFilter"
        @open-history="bukaAuditBarang(activeView, $event)"
        @open-import="importKind = activeView"
      />
    </section>

    <div v-if="konfirmasiHapusTerbuka" class="modal-backdrop confirm-backdrop">
      <section class="confirm-panel" role="dialog" aria-modal="true" aria-labelledby="hapus-title">
        <div class="confirm-icon">
          <Trash2 :size="22" />
        </div>
        <div class="confirm-content">
          <p class="eyebrow">{{ eyebrowKonfirmasi }}</p>
          <h2 id="hapus-title">{{ judulKonfirmasi }}</h2>
          <p>
            <strong>{{ targetHapusLabel }}</strong> {{ deskripsiKonfirmasi }}
          </p>
        </div>
        <div class="modal-actions confirm-actions">
          <button class="secondary-button" type="button" :disabled="loading" @click="batalHapus">Batal</button>
          <button class="danger-button" type="button" :disabled="loading" @click="konfirmasiHapus">
            <Trash2 :size="17" />
            <span>{{ labelTombolKonfirmasi }}</span>
          </button>
        </div>
      </section>
    </div>

    <div v-if="modalTerbuka" class="modal-backdrop">
      <section class="modal-panel">
        <div class="modal-heading">
          <div>
            <p class="eyebrow">{{ modeForm === "edit" ? "Edit Data" : "Data Baru" }}</p>
            <h2>{{ pageTitle }}</h2>
          </div>
          <button class="icon-action" type="button" title="Tutup" @click="modalTerbuka = false">
            <X :size="18" />
          </button>
        </div>

        <div v-if="formTabs.length > 1" class="form-tabs">
          <button
            v-for="tab in formTabs"
            :key="tab"
            type="button"
            :class="{ active: formTab === tab }"
            @click="formTab = tab"
          >
            {{ tab === "suratTugas" ? "Surat Tugas" : tab === "item" ? "Item" : tab === "customer" ? "Customer" : "General" }}
          </button>
        </div>

        <form v-if="formTab === 'general'" class="data-form" @submit.prevent="simpanForm">
          <label v-for="item in currentVisibleFormFields" :key="item.name" :class="{ 'check-field': item.type === 'checkbox' }">
            <template v-if="item.type === 'checkbox'">
              <input v-model="form[item.name]" type="checkbox" />
              <span>{{ item.label }}</span>
            </template>
            <template v-else>
              <span>{{ item.label }}</span>
              <textarea v-if="item.type === 'textarea'" v-model="form[item.name]" :required="fieldWajib(item)" rows="3" />
              <select v-else-if="item.type === 'select'" v-model="form[item.name]" :required="fieldWajib(item)" :disabled="activeView === 'suratTugas' && form.tanggal_maintenance_otomatis && item.name === 'jenis_pekerjaan'" @change="handleFieldChange(item.name)">
                <option value="">Pilih</option>
                <option v-for="option in item.options" :key="option" :value="option">{{ labelStatus(option) }}</option>
              </select>
              <template v-else-if="item.type === 'relation'">
                <input v-if="item.name === 'printer_id'" v-model="installedPrinterSearch" type="search" placeholder="Cari MP No / Serial" @input="muatInstalledPrinterOptions" />
                <select v-model="form[item.name]" :required="fieldWajib(item)" :disabled="activeView === 'suratTugas' && form.tanggal_maintenance_otomatis && ['account_id', 'customer_id', 'printer_id'].includes(item.name)" @change="handleFieldChange(item.name)">
                  <option value="">Pilih</option>
                  <option v-for="option in relationOptions(item)" :key="option.id" :value="option.id">
                    {{ labelOption(item.source, option, item.optionLabel) }}
                  </option>
                </select>
              </template>
              <input
                v-else
                v-model="form[item.name]"
                :type="item.type"
                :required="fieldWajib(item) && !(modeForm === 'edit' && item.name === 'password')"
                :readonly="item.readonly || (activeView === 'suratTugas' && form.tanggal_maintenance_otomatis && item.name === 'tanggal_jadwal')"
                :min="item.min"
                :max="item.max"
                :placeholder="item.placeholder"
              />
            </template>
          </label>

          <div v-if="activeView === 'account' && modeForm === 'create'" class="form-section-title">Customer pertama</div>
          <template v-if="activeView === 'account' && modeForm === 'create'">
            <label><span>Kode Customer</span><input v-model="firstCustomerForm.kode_customer" type="text" required /></label>
            <label><span>Nama Customer</span><input v-model="firstCustomerForm.nama_customer" type="text" required /></label>
            <label><span>Alamat Operasional</span><textarea v-model="firstCustomerForm.alamat" rows="3" required /></label>
            <label><span>Nama PIC</span><input v-model="firstCustomerForm.nama_pic" type="text" /></label>
            <label><span>Telepon PIC</span><input v-model="firstCustomerForm.telepon_pic" type="tel" /></label>
            <label><span>Email PIC</span><input v-model="firstCustomerForm.email_pic" type="email" /></label>
          </template>

          <div class="modal-actions">
            <button class="secondary-button" type="button" @click="modalTerbuka = false">Batal</button>
            <button v-if="modeForm === 'create' ? canCreate : canUpdateItem(form)" class="primary-button" type="submit" :disabled="loading">
              <Save :size="17" />
              <span>{{ loading ? "Menyimpan..." : "Simpan" }}</span>
            </button>
          </div>
        </form>

        <section v-else-if="activeView === 'account' && formTab === 'customer'" class="tab-panel site-panel">
          <div class="site-panel-heading">
            <div>
              <strong>Customer</strong>
              <span>{{ siteRows.filter((row) => row.aktif).length }} aktif / {{ siteRows.filter((row) => row.aktif).length > 1 ? "Multisite" : "Single" }}</span>
            </div>
            <button v-if="form.id && isAdmin" class="primary-button" type="button" @click="bukaSite()">
              <Plus :size="16" />
              <span>Tambah Customer</span>
            </button>
          </div>
          <p v-if="!form.id" class="helper-text">Simpan Account terlebih dahulu.</p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Customer</th>
                  <th>Alamat</th>
                  <th>PIC</th>
                  <th>Status</th>
                  <th v-if="isAdmin">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="site in siteRows" :key="site.id">
                  <td>{{ site.kode_customer }}</td>
                  <td>{{ site.nama_customer }}</td>
                  <td>{{ site.alamat }}</td>
                  <td>{{ site.nama_pic || "-" }}</td>
                  <td><span class="status-badge" :class="badgeClass(site.aktif)">{{ site.aktif ? "Aktif" : "Nonaktif" }}</span></td>
                  <td v-if="isAdmin">
                    <div class="row-actions">
                      <button class="icon-action" type="button" title="Edit Customer" @click="bukaSite(site)"><Pencil :size="16" /></button>
                      <button v-if="site.aktif && siteRows.filter((row) => row.aktif).length > 1" class="icon-action warning" type="button" title="Nonaktifkan Customer" @click="mintaKonfirmasi(site, 'deactivate', 'customer')"><Power :size="16" /></button>
                      <button v-if="site.boleh_hapus_permanen !== false" class="icon-action danger" type="button" title="Hapus Customer permanen" @click="mintaKonfirmasi(site, 'delete', 'customer')"><Trash2 :size="16" /></button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!siteRows.length"><td :colspan="isAdmin ? 6 : 5" class="empty-cell">Belum ada Customer.</td></tr>
              </tbody>
            </table>
          </div>

          <form v-if="siteFormVisible && isAdmin && form.id" class="data-form inline-form site-form" @submit.prevent="simpanSite">
            <label><span>Kode Customer</span><input v-model="siteForm.kode_customer" type="text" required /></label>
            <label><span>Nama Customer</span><input v-model="siteForm.nama_customer" type="text" required /></label>
            <label><span>Alamat</span><textarea v-model="siteForm.alamat" rows="3" required /></label>
            <label><span>Nama PIC</span><input v-model="siteForm.nama_pic" type="text" /></label>
            <label><span>Telepon PIC</span><input v-model="siteForm.telepon_pic" type="tel" /></label>
            <label><span>Email PIC</span><input v-model="siteForm.email_pic" type="email" /></label>
            <label class="check-field"><input v-model="siteForm.aktif" type="checkbox" /><span>Aktif</span></label>
            <div class="modal-actions">
              <button class="secondary-button" type="button" @click="siteFormVisible = false">Batal</button>
              <button class="primary-button" type="submit" :disabled="loading"><Save :size="16" /><span>{{ loading ? "Menyimpan..." : "Simpan Customer" }}</span></button>
            </div>
          </form>
        </section>

        <section v-else-if="currentConfig.flow === 'pengaduan' && formTab === 'suratTugas'" class="tab-panel">
          <div v-if="isAdmin || roleAktif === 'kepala_teknisi'" class="tab-panel-actions">
            <button
              class="primary-button"
              type="button"
              :disabled="!form.id"
              @click="buatSuratDariKomplain"
            >
              <Plus :size="17" />
              <span>Buat Surat Tugas</span>
            </button>
          </div>
          <p v-if="!form.id" class="helper-text">Simpan komplain terlebih dahulu sebelum membuat surat tugas.</p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID Surat Tugas</th>
                  <th>Tipe</th>
                  <th>Status</th>
                  <th>Hasil</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="surat in relatedSuratTugas" :key="surat.id">
                  <td>{{ surat.nomor_surat_tugas }}</td>
                  <td>{{ surat.jenis_pekerjaan || "-" }}</td>
                  <td><span class="status-badge" :class="badgeClass(surat.status)">{{ labelStatus(surat.status) }}</span></td>
                  <td>{{ surat.hasil || "-" }}</td>
                </tr>
                <tr v-if="!relatedSuratTugas.length">
                  <td colspan="4" class="empty-cell">Belum ada surat tugas untuk komplain ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-else-if="currentConfig.flow === 'suratTugas' && formTab === 'item'" class="tab-panel">
          <p v-if="!form.id" class="helper-text">Simpan surat tugas terlebih dahulu sebelum menambahkan item.</p>
          <template v-else>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Kuantitas</th>
                    <th>Serial Number</th>
                    <th>Catatan</th>
                    <th v-if="canTambahItemSurat()">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in pemakaianSuratAktif" :key="item.id">
                    <td>{{ item.master_toner?.nama_toner || item.master_printer?.mp_no || item.master_suku_cadang?.nama_suku_cadang || item.jenis_barang }}</td>
                    <td>{{ item.jumlah_pakai }}</td>
                    <td>{{ item.serial_number || "-" }}</td>
                    <td>{{ item.keterangan || "-" }}</td>
                    <td v-if="canTambahItemSurat()">
                      <button class="icon-action danger" type="button" title="Hapus item" @click="hapusItemSurat(item)">
                        <Trash2 :size="15" />
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!pemakaianSuratAktif.length">
                    <td :colspan="canTambahItemSurat() ? 5 : 4" class="empty-cell">Belum ada item.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <form v-if="canTambahItemSurat()" class="data-form inline-form" @submit.prevent="simpanItemSurat">
              <label>
                <span>Jenis Item</span>
                <select v-model="itemForm.jenis_barang" required @change="itemForm.item_id = ''; muatAvailablePrinters()">
                  <option v-if="['installation', 'delivery', 'replacement'].includes(form.jenis_pekerjaan)" value="printer">Printer</option>
                  <option value="toner">Toner</option>
                  <option value="suku_cadang">Sparepart</option>
                </select>
              </label>
              <label>
                <span v-if="itemForm.jenis_barang === 'printer'">Cari MP No / Serial</span>
                <input v-if="itemForm.jenis_barang === 'printer'" v-model="printerItemSearch" type="search" placeholder="Cari unit tersedia" @input="muatAvailablePrinters" />
                <span>Item</span>
                <select v-model="itemForm.item_id" required @change="pilihItemSurat">
                  <option value="">Pilih item</option>
                  <option v-for="item in itemSuratOptions" :key="item.id" :value="item.id">
                    {{ item.nama_toner || item.mp_no || item.nama_suku_cadang }}
                  </option>
                </select>
              </label>
              <label>
                <span>Gudang</span>
                <select v-model="itemForm.gudang_id" required @change="itemForm.item_id = ''; muatAvailablePrinters()">
                  <option value="">Pilih gudang</option>
                  <option v-for="gudang in options.gudang" :key="gudang.id" :value="gudang.id">{{ gudang.nama_gudang }}</option>
                </select>
              </label>
              <label>
                <span>Kuantitas</span>
                <input v-model="itemForm.jumlah_pakai" type="number" min="1" :max="itemForm.jenis_barang === 'printer' ? 1 : undefined" step="1" :readonly="itemForm.jenis_barang === 'printer'" required />
              </label>
              <label>
                <span>Serial Number</span>
                <input v-model="itemForm.serial_number" type="text" :readonly="itemForm.jenis_barang === 'printer'" />
              </label>
              <label>
                <span>Catatan</span>
                <textarea v-model="itemForm.keterangan" rows="3" />
              </label>
              <div class="modal-actions">
                <button class="primary-button" type="submit" :disabled="loading">
                  <Plus :size="17" />
                  <span>{{ loading ? "Menambah..." : "Tambah Item" }}</span>
                </button>
              </div>
            </form>
            <p v-else class="helper-text">Item hanya bisa ditambahkan oleh teknisi assigned saat status progress atau ready to print.</p>
          </template>
        </section>
      </section>
    </div>

    <div v-if="modalStokTerbuka" class="modal-backdrop">
      <section class="modal-panel">
        <div class="modal-heading">
          <div>
            <p class="eyebrow">Stock Item</p>
            <h2>{{ stockForm.jenis_mutasi === "keluar" ? "Kurangi Stok" : stockForm.jenis_mutasi === "masuk" ? "Tambah Stok" : "Mutasi Stok" }}</h2>
          </div>
          <button class="icon-action" type="button" title="Tutup" @click="modalStokTerbuka = false">
            <X :size="18" />
          </button>
        </div>

        <form class="data-form" @submit.prevent="simpanMutasiStok">
          <label>
            <span>Jenis Mutasi</span>
            <select v-model="stockForm.jenis_mutasi" required>
              <option value="masuk">Tambah</option>
              <option value="keluar">Kurangi</option>
              <option value="transfer">Transfer</option>
              <option value="penyesuaian">Penyesuaian (+)</option>
            </select>
          </label>
          <label v-if="['keluar', 'transfer'].includes(stockForm.jenis_mutasi)">
            <span>Gudang Asal</span>
            <select v-model="stockForm.gudang_asal_id" required>
              <option value="">Pilih</option>
              <option v-for="gudang in options.gudang.filter((item) => item.aktif)" :key="gudang.id" :value="gudang.id">{{ gudang.nama_gudang }}</option>
            </select>
          </label>
          <label v-if="stockForm.jenis_mutasi !== 'keluar'">
            <span>Gudang Tujuan</span>
            <select v-model="stockForm.gudang_tujuan_id" required>
              <option value="">Pilih</option>
              <option v-for="gudang in options.gudang.filter((item) => item.aktif)" :key="gudang.id" :value="gudang.id">{{ gudang.nama_gudang }}</option>
            </select>
          </label>
          <label>
            <span>Jenis Barang</span>
            <input :value="activeStockView.label" type="text" readonly />
          </label>
          <label>
            <span>Barang</span>
            <select v-model="stockForm.item_id" required>
              <option value="">Pilih</option>
              <option v-for="item in stockItemOptions" :key="item.id" :value="item.id">
                {{ item.nama_toner || item.model || item.nama_suku_cadang }}
              </option>
            </select>
          </label>
          <label>
            <span>Jumlah</span>
            <input v-model="stockForm.jumlah" type="number" min="1" step="1" required />
          </label>
          <label>
            <span>Keterangan</span>
            <textarea v-model="stockForm.keterangan" rows="3" />
          </label>
          <div class="modal-actions">
            <button class="secondary-button" type="button" @click="modalStokTerbuka = false">Batal</button>
            <button class="primary-button" type="submit" :disabled="loading">
              <Save :size="17" />
              <span>{{ loading ? "Menyimpan..." : "Simpan" }}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
    <MasterImportDialog v-if="importKind" :kind="importKind" @close="importKind = null" @imported="selesaiImpor" />
  </main>
</template>
