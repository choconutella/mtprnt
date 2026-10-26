const express = require("express");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses } = require("../utils/response");
const { autentikasi, otorisasi } = require("../middlewares/auth");
const { normalisasiRole } = require("../utils/roles");

const router = express.Router();

const ROLES = ["admin", "sales", "sales-admin", "kepala-teknisi", "teknisi", "warehouse"];
const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tiket", label: "Tiket" },
  { key: "surat_tugas", label: "Surat Tugas" },
  { key: "item_surat_tugas", label: "Item Surat Tugas" },
  { key: "stock_data", label: "Stock Data" },
  { key: "master_data", label: "Master Data" },
  { key: "audit_trail", label: "Audit Trail" },
  { key: "pengaturan", label: "Pengaturan" }
];
const ACTIONS = ["view", "create", "update", "delete", "resolve", "workflow"];

const permissionSchema = z.object({
  role: z.string().transform(normalisasiRole),
  permissions: z.array(z.object({
    modul: z.string(),
    can_view: z.boolean(),
    can_create: z.boolean(),
    can_update: z.boolean(),
    can_delete: z.boolean(),
    can_resolve: z.boolean(),
    can_workflow: z.boolean()
  }))
});

const slaSchema = z.object({
  pending_setelah_jam: z.coerce.number().int().min(1).max(720)
});

function fullAccess(role, modul) {
  if (role === "admin") {
    return { role, modul, can_view: true, can_create: true, can_update: true, can_delete: true, can_resolve: true, can_workflow: true };
  }

  const base = { role, modul, can_view: false, can_create: false, can_update: false, can_delete: false, can_resolve: false, can_workflow: false };
  if (role === "sales") return { ...base, can_view: ["dashboard", "tiket", "surat_tugas"].includes(modul) };
  if (role === "sales_admin") return { ...base, can_view: true, can_create: modul === "tiket", can_update: modul === "tiket", can_resolve: modul === "tiket", can_workflow: modul === "tiket" };
  if (role === "kepala_teknisi") return { ...base, can_view: true, can_create: ["tiket", "surat_tugas"].includes(modul), can_update: ["tiket", "surat_tugas"].includes(modul), can_resolve: ["tiket", "surat_tugas"].includes(modul), can_workflow: modul === "surat_tugas" };
  if (role === "teknisi") return { ...base, can_view: ["dashboard", "tiket", "surat_tugas", "item_surat_tugas", "stock_data"].includes(modul), can_create: modul === "item_surat_tugas", can_update: ["surat_tugas", "item_surat_tugas"].includes(modul), can_workflow: ["surat_tugas", "item_surat_tugas"].includes(modul) };
  if (role === "warehouse") return { ...base, can_view: ["dashboard", "tiket", "surat_tugas", "item_surat_tugas", "stock_data"].includes(modul), can_create: ["tiket", "surat_tugas", "stock_data"].includes(modul), can_update: ["tiket", "stock_data"].includes(modul), can_resolve: modul === "tiket", can_delete: modul === "stock_data", can_workflow: ["surat_tugas", "stock_data"].includes(modul) };
  return base;
}

function defaultPermissions(role) {
  const normalized = normalisasiRole(role);
  return MODULES.map((modul) => fullAccess(normalized, modul.key));
}

async function ambilSla() {
  const setting = await prisma.app_pengaturan.findUnique({ where: { kunci: "sla_pending_komplain" } });
  return setting?.nilai || { pending_setelah_jam: 24 };
}

async function ambilPermissions(role) {
  const normalized = normalisasiRole(role);
  const rows = await prisma.role_permission.findMany({ where: { role: normalized } });
  if (!rows.length) return defaultPermissions(normalized);
  return MODULES.map((modul) => {
    const row = rows.find((item) => item.modul === modul.key);
    return row || fullAccess(normalized, modul.key);
  });
}

router.use(autentikasi, otorisasi("admin"));

router.get("/", asyncHandler(async (req, res) => {
  const role = req.query.role || "admin";
  const [sla, permissions] = await Promise.all([
    ambilSla(),
    ambilPermissions(role)
  ]);

  return sukses(res, "Pengaturan berhasil diambil.", {
    sla,
    roles: ROLES,
    modules: MODULES,
    actions: ACTIONS,
    selected_role: normalisasiRole(role),
    permissions
  });
}));

router.put("/sla-pending-komplain", asyncHandler(async (req, res) => {
  const body = slaSchema.parse(req.body);
  const item = await prisma.app_pengaturan.upsert({
    where: { kunci: "sla_pending_komplain" },
    update: { nilai: body, tanggal_diperbarui: new Date() },
    create: { kunci: "sla_pending_komplain", nilai: body }
  });

  return sukses(res, "SLA pending komplain berhasil disimpan.", item.nilai);
}));

router.put("/role-permission", asyncHandler(async (req, res) => {
  const body = permissionSchema.parse(req.body);
  const role = normalisasiRole(body.role);

  await prisma.$transaction(body.permissions.map((permission) =>
    prisma.role_permission.upsert({
      where: { role_modul: { role, modul: permission.modul } },
      update: { ...permission, role, tanggal_diperbarui: new Date() },
      create: { ...permission, role }
    })
  ));

  const permissions = await ambilPermissions(role);
  return sukses(res, "Permission role berhasil disimpan.", permissions);
}));

module.exports = router;
