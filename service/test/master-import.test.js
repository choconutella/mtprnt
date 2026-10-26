const { test } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const prisma = require("../src/config/prisma");

const base = process.env.TEST_API_BASE || "http://localhost:5000/api";
const suffix = Date.now().toString(36).toUpperCase();
const ids = { account: [], customer: [], category: [], model: [], printer: [], toner: [], spare: [], gudang: [], user: [] };
const excelType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function login(username, password = process.env.TEST_PASSWORD || "Admin123") {
  const response = await fetch(`${base}/auth/masuk`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, kata_sandi: password }) });
  const payload = await response.json();
  assert.equal(response.status, 200, payload.pesan);
  return payload.data.token;
}

async function get(token, path) {
  const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const payload = await response.json();
  assert.equal(response.status, 200, payload.pesan);
  return payload.data;
}

async function workbook(headers, rows) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Data");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((header) => row[header] ?? null)));
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function upload(token, kind, action, rows, headers) {
  const buffer = await workbook(headers, rows);
  const response = await fetch(`${base}/master-import/${kind}/${action}`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": excelType }, body: buffer
  });
  const payload = await response.json();
  return { status: response.status, ...payload };
}

async function importRows(token, kind, rows, idKey) {
  const format = await get(token, `/master-import/${kind}/format`);
  const headers = format.columns.map((column) => column.key);
  const preview = await upload(token, kind, "preview", rows, headers);
  assert.equal(preview.status, 200, `${kind}: ${preview.pesan}`);
  assert.deepEqual(preview.data.errors, [], `${kind}: ${JSON.stringify(preview.data.errors)}`);
  assert.equal(preview.data.valid, rows.length);
  const committed = await upload(token, kind, "commit", rows, headers);
  assert.equal(committed.status, 201, `${kind}: ${committed.pesan}`);
  assert.equal(committed.data.total, rows.length);
  const model = {
    account: "master_account", lokasiCustomer: "master_customer", printerKategori: "master_printer_kategori",
    printerModel: "master_printer_model", printer: "master_printer", toner: "master_toner",
    sukuCadang: "master_suku_cadang", gudang: "master_gudang", pengguna: "master_pengguna"
  }[kind];
  const key = kind === "lokasiCustomer" ? "kode_customer" : kind === "pengguna" ? "user_id" : idKey;
  const created = await prisma[model].findMany({ where: { [key]: { in: rows.map((row) => row[key]) } } });
  assert.equal(created.length, rows.length);
  const bucket = kind === "lokasiCustomer" ? "customer" : kind === "printerKategori" ? "category" : kind === "printerModel" ? "model" : kind === "sukuCadang" ? "spare" : kind === "pengguna" ? "user" : kind;
  ids[bucket].push(...created.map((item) => item.id));
  return created;
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.riwayat_audit.deleteMany({ where: { jenis_dokumen: { in: ["barang_printer", "barang_toner", "barang_suku_cadang"] }, id_sumber: { in: [...ids.printer, ...ids.toner, ...ids.spare] } } });
    await tx.master_printer.deleteMany({ where: { id: { in: ids.printer } } });
    await tx.master_printer_model.deleteMany({ where: { id: { in: ids.model } } });
    await tx.master_printer_kategori.deleteMany({ where: { id: { in: ids.category } } });
    await tx.master_customer.deleteMany({ where: { id: { in: ids.customer } } });
    await tx.master_account.deleteMany({ where: { id: { in: ids.account } } });
    await tx.master_toner.deleteMany({ where: { id: { in: ids.toner } } });
    await tx.master_suku_cadang.deleteMany({ where: { id: { in: ids.spare } } });
    await tx.master_gudang.deleteMany({ where: { id: { in: ids.gudang } } });
    await tx.master_pengguna.deleteMany({ where: { id: { in: ids.user } } });
  });
}

test("template and bulk import for every visible master", async () => {
  try {
    const [admin, sales] = await Promise.all([login("admin"), login("sales")]);
    const categoryCode = `IMP-K-${suffix}`;
    const modelCode = `IMP-M-${suffix}`;
    const warehouseCode = `IMP-G-${suffix}`;
    const accountCode = `IMP-A-${suffix}`;
    const printerCode = `IMP-P-${suffix}`;
    const categoryFormat = await get(admin, "/master-import/printerKategori/format");
    const forbidden = await upload(sales, "printerKategori", "preview", [{ kode_kategori: categoryCode, nama_kategori: "Test" }], categoryFormat.columns.map((column) => column.key));
    assert.equal(forbidden.status, 403);
    const templateResponse = await fetch(`${base}/master-import/printerKategori/template`, { headers: { authorization: `Bearer ${admin}` } });
    assert.equal(templateResponse.status, 200);
    const template = new ExcelJS.Workbook();
    await template.xlsx.load(Buffer.from(await templateResponse.arrayBuffer()));
    assert.deepEqual(template.getWorksheet("Data").getRow(1).values.slice(1), categoryFormat.columns.map((column) => column.key));
    assert.ok(template.getWorksheet("Panduan"));

    await importRows(admin, "printerKategori", [{ kode_kategori: categoryCode, nama_kategori: "Laser" }], "kode_kategori");
    await importRows(admin, "printerModel", [{ kode_kategori: categoryCode, kode_model: modelCode, merek: "HP", nama_model: "M404" }], "kode_model");
    await importRows(admin, "gudang", [{ kode_gudang: warehouseCode, nama_gudang: "Gudang Impor", jenis_gudang: "utama" }], "kode_gudang");
    const account = await importRows(admin, "account", [{ kode_account: accountCode, nama_account: "PT Import", kode_customer: `IMP-C-${suffix}`, nama_customer: "Pusat", alamat_customer: "Jakarta" }], "kode_account");
    const firstCustomer = await prisma.master_customer.findFirst({ where: { account_id: account[0].id } });
    assert.ok(firstCustomer);
    ids.customer.push(firstCustomer.id);
    const site = await importRows(admin, "lokasiCustomer", [{ kode_account: accountCode, kode_customer: `IMP-C2-${suffix}`, nama_customer: "Cabang", alamat: "Bandung" }], "kode_customer");
    assert.equal(site[0].account_id, account[0].id);
    const printer = await importRows(admin, "printer", [{
      mp_no: printerCode, serial_number: `IMP-SN-${suffix}`, kode_model: modelCode, kode_gudang: warehouseCode,
      tanggal_pembelian: "2026-01-10", tanggal_maintenance_berikutnya: "2027-01-10", interval_maintenance_bulan: 6
    }], "mp_no");
    assert.equal(printer[0].status, "available");
    assert.equal(printer[0].gudang_id, ids.gudang[0]);
    assert.equal(printer[0].tanggal_pembelian.toISOString().slice(0, 10), "2026-01-10");
    assert.equal(printer[0].interval_maintenance_bulan, 6);
    const oldHeaders = (await get(admin, "/master-import/printer/format")).columns
      .filter((column) => !["tanggal_pembelian", "tanggal_maintenance_berikutnya", "interval_maintenance_bulan"].includes(column.key))
      .map((column) => column.key);
    const oldPreview = await upload(admin, "printer", "preview", [{ mp_no: `IMP-OLD-${suffix}`, kode_model: modelCode, kode_gudang: warehouseCode }], oldHeaders);
    assert.equal(oldPreview.status, 200);
    assert.deepEqual(oldPreview.data.errors, []);
    assert.equal((await prisma.riwayat_audit.count({ where: { jenis_dokumen: "barang_printer", id_sumber: printer[0].id, aksi: "buat" } })), 1);

    const tonerCode = `IMP-T-${suffix}`;
    const tonerRows = [1, 2].map((index) => ({ kode_toner: `${tonerCode}-${index}`, nama_toner: `Toner ${index}`, warna: "Hitam", tipe: "Laser" }));
    const toner = await importRows(admin, "toner", tonerRows, "kode_toner");
    assert.equal((await prisma.riwayat_audit.count({ where: { jenis_dokumen: "barang_toner", id_sumber: { in: toner.map((item) => item.id) } } })), 2);
    const spare = await importRows(admin, "sukuCadang", [{ kode_suku_cadang: `IMP-S-${suffix}`, nama_suku_cadang: "Fuser" }], "kode_suku_cadang");
    assert.equal((await prisma.riwayat_audit.count({ where: { jenis_dokumen: "barang_suku_cadang", id_sumber: spare[0].id } })), 1);
    const bulkSpare = Array.from({ length: 101 }, (_, index) => ({ kode_suku_cadang: `IMP-B-${suffix}-${index}`, nama_suku_cadang: `Sparepart ${index}` }));
    await importRows(admin, "sukuCadang", bulkSpare, "kode_suku_cadang");
    const secondPage = await get(admin, `/suku-cadang?cari=IMP-B-${suffix}&halaman=2&batas=100`);
    assert.equal(secondPage.meta.total, 101);
    assert.equal(secondPage.items.length, 1);

    const username = `imp${suffix.toLowerCase().slice(-10)}`;
    const user = await importRows(admin, "pengguna", [{ user_id: username, name: "Import Sales", email: `${username}@example.com`, role: "sales", password: "Import123" }], "user_id");
    assert.notEqual(user[0].kata_sandi_hash, "Import123");
    assert.ok(await login(username, "Import123"));
    const userFormat = await get(admin, "/master-import/pengguna/format");
    const userPreview = await upload(admin, "pengguna", "preview", [{ user_id: "other", name: "Other", email: "other@example.com", role: "sales", password: "Secret123" }], userFormat.columns.map((column) => column.key));
    assert.equal(userPreview.data.preview[0].password, "******");

    const tonerFormat = await get(admin, "/master-import/toner/format");
    const headers = tonerFormat.columns.map((column) => column.key);
    const duplicate = await upload(admin, "toner", "preview", [tonerRows[0], { kode_toner: `IMP-X-${suffix}`, nama_toner: "X", warna: "Cyan", tipe: "Laser" }], headers);
    assert.equal(duplicate.status, 200);
    assert.ok(duplicate.data.errors.some((error) => error.kolom === "kode_toner"));
    const deniedCommit = await upload(admin, "toner", "commit", [tonerRows[0], { kode_toner: `IMP-X-${suffix}`, nama_toner: "X", warna: "Cyan", tipe: "Laser" }], headers);
    assert.equal(deniedCommit.status, 422);
    assert.equal(await prisma.master_toner.count({ where: { kode_toner: `IMP-X-${suffix}` } }), 0);
    const inFileDuplicate = await upload(admin, "toner", "preview", [
      { kode_toner: `IMP-D-${suffix}`, nama_toner: "D1", warna: "Cyan", tipe: "Laser" },
      { kode_toner: `IMP-D-${suffix}`, nama_toner: "D2", warna: "Cyan", tipe: "Laser" }
    ], headers);
    assert.ok(inFileDuplicate.data.errors.some((item) => item.pesan.includes("Duplikat")));
    const formula = await upload(admin, "toner", "preview", [{ kode_toner: { formula: "1+1", result: 2 }, nama_toner: "Formula", warna: "Cyan", tipe: "Laser" }], headers);
    assert.ok(formula.data.errors.some((item) => item.kolom === "kode_toner" && item.pesan.includes("Formula")));
    const brokenReference = await upload(admin, "printer", "preview", [{ mp_no: `IMP-BAD-${suffix}`, kode_model: "NO-MODEL", kode_gudang: warehouseCode }], (await get(admin, "/master-import/printer/format")).columns.map((column) => column.key));
    assert.ok(brokenReference.data.errors.some((error) => error.kolom === "kode_model"));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
