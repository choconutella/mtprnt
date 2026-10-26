const express = require("express");
const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/async-handler");
const { sukses, gagal } = require("../utils/response");
const { autentikasi, izin } = require("../middlewares/auth");
const { normalisasiRole, ROLE_VALUES } = require("../utils/roles");
const { catatAuditBarang } = require("./audit-barang.service");
const { formats } = require("./master-import.config");

const router = express.Router();
const rawExcel = express.raw({ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", limit: "5mb" });
const MAX_ROWS = 500;
const modelByKind = {
  account: "master_account", lokasiCustomer: "master_customer", printerKategori: "master_printer_kategori",
  printerModel: "master_printer_model", printer: "master_printer", toner: "master_toner",
  sukuCadang: "master_suku_cadang", gudang: "master_gudang", pengguna: "master_pengguna"
};

function issue(baris, kolom, pesan) { return { baris, kolom, pesan }; }
function uniqueValues(rows, key) { return [...new Set(rows.map((row) => row.data[key]).filter(Boolean))]; }
function mapBy(rows, key) { return new Map(rows.map((row) => [row[key], row])); }
function empty(value) { return value === undefined || value === null || String(value).trim() === ""; }

function normalizeCell(value, column, baris, errors) {
  if (column.type === "date" && value instanceof Date) {
    if (Number.isNaN(value.getTime())) errors.push(issue(baris, column.key, "Tanggal tidak valid."));
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (value && typeof value === "object") {
    errors.push(issue(baris, column.key, "Formula, tanggal, atau objek Excel tidak diterima; gunakan teks biasa."));
    return null;
  }
  if (empty(value)) {
    if (column.required) errors.push(issue(baris, column.key, "Wajib diisi."));
    return column.type === "boolean" ? true : null;
  }
  const text = String(value).trim();
  if (column.type === "date") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00.000Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) errors.push(issue(baris, column.key, "Gunakan tanggal YYYY-MM-DD yang valid."));
    return text;
  }
  if (column.type === "integer") {
    const number = Number(text);
    if (!Number.isInteger(number) || number < column.min || number > column.max) errors.push(issue(baris, column.key, `Isi bilangan ${column.min}-${column.max}.`));
    return number;
  }
  if (column.type === "boolean") {
    if (["ya", "true", "1", "aktif"].includes(text.toLowerCase())) return true;
    if (["tidak", "false", "0", "nonaktif"].includes(text.toLowerCase())) return false;
    errors.push(issue(baris, column.key, "Gunakan ya atau tidak."));
    return null;
  }
  if (column.max && text.length > column.max) errors.push(issue(baris, column.key, `Maksimal ${column.max} karakter.`));
  if (column.type === "email" && !z.string().email().safeParse(text).success) errors.push(issue(baris, column.key, "Format email tidak valid."));
  if (column.type === "password" && text.length < 6) errors.push(issue(baris, column.key, "Minimal 6 karakter."));
  if (column.choices && !column.choices.includes(text.toLowerCase())) errors.push(issue(baris, column.key, `Pilihan: ${column.choices.join(", ")}.`));
  return column.choices ? text.toLowerCase() : text;
}

async function parseWorkbook(buffer, format) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw Object.assign(new Error("Pilih file .xlsx yang valid."), { statusCode: 422 });
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); }
  catch { throw Object.assign(new Error("File Excel tidak dapat dibaca. Gunakan .xlsx sesuai template."), { statusCode: 422 }); }
  const sheet = workbook.getWorksheet("Data") || workbook.worksheets[0];
  if (!sheet) throw Object.assign(new Error("Sheet Data tidak ditemukan."), { statusCode: 422 });
  const headers = sheet.getRow(1).values.slice(1).map((value) => String(value || "").trim().toLowerCase());
  const expected = format.columns.map((column) => column.key);
  const missing = format.columns.filter((column) => column.required && !headers.includes(column.key)).map((column) => column.key);
  const unexpected = headers.filter((key) => key && !expected.includes(key));
  if (missing.length || unexpected.length || new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) {
    throw Object.assign(new Error(`Kolom Excel tidak sesuai template. ${missing.length ? `Kurang: ${missing.join(", ")}. ` : ""}${unexpected.length ? `Tidak dikenal: ${unexpected.join(", ")}.` : ""}`), { statusCode: 422 });
  }
  const errors = [];
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = expected.map((key) => headers.includes(key) ? row.getCell(headers.indexOf(key) + 1).value : null);
    if (values.every(empty)) return;
    if (rows.length >= MAX_ROWS) throw Object.assign(new Error(`Maksimal ${MAX_ROWS} baris per file.`), { statusCode: 422 });
    const data = {};
    format.columns.forEach((column, index) => { data[column.key] = normalizeCell(values[index], column, number, errors); });
    rows.push({ number, data });
  });
  if (!rows.length) throw Object.assign(new Error("Sheet Data belum berisi baris impor."), { statusCode: 422 });
  return { rows, errors };
}

async function validateRows(tx, kind, rows, initialErrors = []) {
  const errors = [...initialErrors];
  const format = formats[kind];
  const seen = new Map();
  const keys = (row) => {
    const data = row.data;
    if (kind === "lokasiCustomer") return data.kode_account && data.kode_customer ? [[`${data.kode_account}|${data.kode_customer}`, "kode_customer"]] : [];
    if (kind === "printer") return [[data.mp_no, "mp_no"], ...(data.serial_number ? [[`serial:${data.serial_number}`, "serial_number"]] : [])];
    if (kind === "pengguna") return [[data.user_id, "user_id"], ...(data.email ? [[`email:${data.email}`, "email"]] : [])];
    return data[format.code] ? [[data[format.code], format.code]] : [];
  };
  for (const row of rows) {
    for (const [key, column] of keys(row)) {
      if (!key) continue;
      if (seen.has(key)) errors.push(issue(row.number, column, `Duplikat dengan baris ${seen.get(key)}.`));
      else seen.set(key, row.number);
    }
    if (kind === "account" && row.data.aktif === false) errors.push(issue(row.number, "aktif", "Account dan Customer pertama harus aktif."));
    if (kind === "pengguna" && row.data.role && !ROLE_VALUES.includes(normalisasiRole(row.data.role))) {
      errors.push(issue(row.number, "role", "Role tidak dikenal."));
    }
  }

  const codes = uniqueValues(rows, format.code);
  if (kind !== "lokasiCustomer") {
    const existing = await tx[modelByKind[kind]].findMany({ where: { [format.code]: { in: codes } }, select: { id: true, [format.code]: true } });
    const used = new Set(existing.map((item) => item[format.code]));
    for (const row of rows) if (used.has(row.data[format.code])) errors.push(issue(row.number, format.code, "Kode sudah ada di database."));
  }

  const refs = {};
  if (["lokasiCustomer"].includes(kind)) {
    refs.accounts = mapBy(await tx.master_account.findMany({ where: { kode_account: { in: uniqueValues(rows, "kode_account") } } }), "kode_account");
    const accountIds = [...refs.accounts.values()].map((account) => account.id);
    const existing = await tx.master_customer.findMany({ where: { account_id: { in: accountIds }, kode_customer: { in: codes } }, select: { account_id: true, kode_customer: true } });
    const used = new Set(existing.map((item) => `${item.account_id}|${item.kode_customer}`));
    for (const row of rows) {
      const account = refs.accounts.get(row.data.kode_account);
      if (!account?.aktif) errors.push(issue(row.number, "kode_account", "Account tidak ditemukan atau tidak aktif."));
      else if (used.has(`${account.id}|${row.data.kode_customer}`)) errors.push(issue(row.number, "kode_customer", "Kode Customer sudah ada pada Account ini."));
    }
  }
  if (kind === "printerModel") {
    refs.categories = mapBy(await tx.master_printer_kategori.findMany({ where: { kode_kategori: { in: uniqueValues(rows, "kode_kategori") } } }), "kode_kategori");
    for (const row of rows) if (!refs.categories.get(row.data.kode_kategori)?.aktif) errors.push(issue(row.number, "kode_kategori", "Kategori tidak ditemukan atau tidak aktif."));
  }
  if (kind === "printer") {
    refs.models = mapBy(await tx.master_printer_model.findMany({ where: { kode_model: { in: uniqueValues(rows, "kode_model") } }, include: { master_printer_kategori: true } }), "kode_model");
    refs.warehouses = mapBy(await tx.master_gudang.findMany({ where: { kode_gudang: { in: uniqueValues(rows, "kode_gudang") } } }), "kode_gudang");
    const serials = uniqueValues(rows, "serial_number");
    const existingSerials = await tx.master_printer.findMany({ where: { serial_number: { in: serials } }, select: { serial_number: true } });
    const usedSerials = new Set(existingSerials.map((item) => item.serial_number));
    for (const row of rows) {
      if (Boolean(row.data.tanggal_maintenance_berikutnya) !== Boolean(row.data.interval_maintenance_bulan)) {
        errors.push(issue(row.number, "tanggal_maintenance_berikutnya", "Tanggal maintenance dan interval bulan harus diisi bersama."));
      }
      const model = refs.models.get(row.data.kode_model);
      if (!model?.aktif || !model.master_printer_kategori.aktif) errors.push(issue(row.number, "kode_model", "Model atau kategorinya tidak ditemukan/aktif."));
      if (!refs.warehouses.get(row.data.kode_gudang)?.aktif) errors.push(issue(row.number, "kode_gudang", "Gudang tidak ditemukan atau tidak aktif."));
      if (row.data.serial_number && usedSerials.has(row.data.serial_number)) errors.push(issue(row.number, "serial_number", "Serial Number sudah ada."));
    }
  }
  if (kind === "gudang") {
    refs.technicians = mapBy(await tx.master_pengguna.findMany({ where: { user_id: { in: uniqueValues(rows, "user_id_teknisi") } } }), "user_id");
    for (const row of rows) if (row.data.user_id_teknisi && (!refs.technicians.get(row.data.user_id_teknisi)?.aktif || refs.technicians.get(row.data.user_id_teknisi)?.peran !== "teknisi")) {
      errors.push(issue(row.number, "user_id_teknisi", "User teknisi tidak ditemukan atau tidak aktif."));
    }
  }
  if (kind === "pengguna") {
    const existing = await tx.master_pengguna.findMany({ where: { email: { in: uniqueValues(rows, "email") } }, select: { email: true } });
    const used = new Set(existing.map((item) => item.email));
    for (const row of rows) if (used.has(row.data.email)) errors.push(issue(row.number, "email", "Email sudah ada di database."));
  }
  return { errors, refs };
}

async function createRow(tx, req, kind, data, refs, passwordHash) {
  if (kind === "account") {
    const { kode_customer, nama_customer, alamat_customer, nama_pic, telepon_pic, email_pic, ...account } = data;
    return tx.master_account.create({ data: { ...account, master_customer: { create: { kode_customer, nama_customer, alamat: alamat_customer, nama_pic, telepon_pic, email_pic, aktif: true } } } });
  }
  if (kind === "lokasiCustomer") {
    const { kode_account, ...customer } = data;
    return tx.master_customer.create({ data: { ...customer, account_id: refs.accounts.get(kode_account).id } });
  }
  if (kind === "printerModel") {
    const { kode_kategori, ...model } = data;
    return tx.master_printer_model.create({ data: { ...model, kategori_id: refs.categories.get(kode_kategori).id } });
  }
  if (kind === "printer") {
    const { kode_model, kode_gudang, tanggal_pembelian, tanggal_maintenance_berikutnya, ...unit } = data;
    const created = await tx.master_printer.create({ data: {
      ...unit,
      tanggal_pembelian: tanggal_pembelian ? new Date(`${tanggal_pembelian}T00:00:00.000Z`) : null,
      tanggal_maintenance_berikutnya: tanggal_maintenance_berikutnya ? new Date(`${tanggal_maintenance_berikutnya}T00:00:00.000Z`) : null,
      model_id: refs.models.get(kode_model).id, gudang_id: refs.warehouses.get(kode_gudang).id, status: "available"
    } });
    await catatAuditBarang(tx, req, { jenis_barang: "printer", aksi: "buat", sesudah: created, keterangan: "Unit printer dibuat melalui impor Excel." });
    return created;
  }
  if (kind === "gudang") {
    const { user_id_teknisi, ...warehouse } = data;
    return tx.master_gudang.create({ data: { ...warehouse, teknisi_id: user_id_teknisi ? refs.technicians.get(user_id_teknisi).id : null } });
  }
  if (kind === "pengguna") {
    const { name, role, password, active, ...user } = data;
    return tx.master_pengguna.create({ data: { ...user, nama: name, peran: normalisasiRole(role), aktif: active, kata_sandi_hash: passwordHash } });
  }
  const created = await tx[modelByKind[kind]].create({ data });
  if (kind === "toner" || kind === "sukuCadang") {
    await catatAuditBarang(tx, req, { jenis_barang: kind === "toner" ? "toner" : "suku_cadang", aksi: "buat", sesudah: created, keterangan: "Data master dibuat melalui impor Excel." });
  }
  return created;
}

router.use(autentikasi);
router.param("kind", (req, res, next, kind) => formats[kind] ? next() : gagal(res, "Master data tidak dikenal.", 404));
router.use("/:kind", (req, res, next) => izin("master_data", "create", req.params.kind === "gudang" ? "warehouse" : "admin")(req, res, next));

router.get("/:kind/format", (req, res) => sukses(res, "Format impor berhasil diambil.", formats[req.params.kind]));

router.get("/:kind/template", asyncHandler(async (req, res) => {
  const format = formats[req.params.kind];
  const book = new ExcelJS.Workbook();
  const data = book.addWorksheet("Data", { views: [{ state: "frozen", ySplit: 1 }] });
  data.addRow(format.columns.map((column) => column.key));
  data.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  data.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
  data.columns.forEach((excelColumn, index) => {
    excelColumn.width = Math.min(38, Math.max(17, format.columns[index].key.length + 5));
    excelColumn.numFmt = "@";
  });
  data.autoFilter = { from: "A1", to: `${data.getColumn(format.columns.length).letter}1` };
  const guide = book.addWorksheet("Panduan");
  guide.addRow(["Kolom", "Wajib", "Contoh", "Keterangan"]);
  format.columns.forEach((column) => guide.addRow([column.key, column.required ? "Ya" : "Tidak", column.example, column.note]));
  guide.columns = [{ width: 28 }, { width: 10 }, { width: 38 }, { width: 75 }];
  guide.getRow(1).font = { bold: true };
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="template-${req.params.kind}.xlsx"`);
  return res.send(buffer);
}));

router.post("/:kind/preview", rawExcel, asyncHandler(async (req, res) => {
  const { rows, errors: parseErrors } = await parseWorkbook(req.body, formats[req.params.kind]);
  const { errors } = await validateRows(prisma, req.params.kind, rows, parseErrors);
  const preview = rows.slice(0, 10).map((row) => ({ baris: row.number, ...row.data, ...(req.params.kind === "pengguna" ? { password: "******" } : {}) }));
  return sukses(res, "Pratinjau impor berhasil dibuat.", { total: rows.length, valid: Math.max(0, rows.length - new Set(errors.map((error) => error.baris)).size), errors, preview });
}));

router.post("/:kind/commit", rawExcel, asyncHandler(async (req, res) => {
  const kind = req.params.kind;
  const { rows, errors: parseErrors } = await parseWorkbook(req.body, formats[kind]);
  const preliminary = await validateRows(prisma, kind, rows, parseErrors);
  if (preliminary.errors.length) return gagal(res, "Perbaiki semua baris sebelum impor.", 422, preliminary.errors);
  const passwordHashes = kind === "pengguna" ? await Promise.all(rows.map((row) => bcrypt.hash(row.data.password, 10))) : [];
  try {
    await prisma.$transaction(async (tx) => {
      const { errors, refs } = await validateRows(tx, kind, rows);
      if (errors.length) throw Object.assign(new Error("Data berubah sejak pratinjau."), { statusCode: 422, rowErrors: errors });
      for (let index = 0; index < rows.length; index += 1) {
        await createRow(tx, req, kind, rows[index].data, refs, passwordHashes[index]);
      }
    }, { maxWait: 10000, timeout: 120000 });
  } catch (error) {
    if (error.rowErrors) return gagal(res, error.message, 422, error.rowErrors);
    throw error;
  }
  return sukses(res, `${rows.length} data berhasil diimpor.`, { total: rows.length }, 201);
}));

module.exports = router;
