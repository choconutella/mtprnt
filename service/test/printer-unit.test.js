const { test } = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/config/prisma");
const { buatSuratTugasMaintenance, tanggalBangkok } = require("../src/modules/printer-maintenance.service");

const base = process.env.TEST_API_BASE || "http://localhost:5000/api";
const suffix = Date.now().toString(36).toUpperCase();
const created = { categories: [], models: [], units: [], warehouses: [], workOrders: [], complaints: [], accounts: [], customers: [], toners: [], spareparts: [], mutations: [] };
const workOrderNumbers = [];
const complaintNumbers = [];
const mutationNumbers = [];

async function request(token, path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await response.json();
  return { status: response.status, data: payload.data, message: payload.pesan };
}

async function login(username) {
  const response = await request(null, "/auth/masuk", "POST", { username, kata_sandi: process.env.TEST_PASSWORD || "Admin123" });
  assert.equal(response.status, 200, `${username}: ${response.message}`);
  return response.data.token;
}

async function good(token, path, method = "GET", body, expected = 200) {
  const response = await request(token, path, method, body);
  assert.equal(response.status, expected, `${method} ${path}: ${response.message}`);
  return response.data;
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.master_printer.updateMany({ where: { id: { in: created.units } }, data: { surat_tugas_aktif_id: null } });
    await tx.riwayat_audit.deleteMany({ where: { OR: [
      { nomor_dokumen: { in: [...workOrderNumbers, ...complaintNumbers, ...mutationNumbers] } },
      { jenis_dokumen: { in: ["barang_printer", "barang_toner", "barang_suku_cadang"] }, id_sumber: { in: [...created.units, ...created.toners, ...created.spareparts] } }
    ] } });
    await tx.mutasi_stok.deleteMany({ where: { OR: [{ id: { in: created.mutations } }, { referensi_id: { in: [...created.units, ...created.workOrders] } }] } });
    await tx.pemakaian_barang_surat_tugas.deleteMany({ where: { surat_tugas_id: { in: created.workOrders } } });
    await tx.teknisi_surat_tugas.deleteMany({ where: { surat_tugas_id: { in: created.workOrders } } });
    await tx.surat_tugas.deleteMany({ where: { id: { in: created.workOrders } } });
    await tx.pengaduan.deleteMany({ where: { id: { in: created.complaints } } });
    await tx.master_printer.deleteMany({ where: { id: { in: created.units } } });
    await tx.stok_toner.deleteMany({ where: { toner_id: { in: created.toners } } });
    await tx.stok_suku_cadang.deleteMany({ where: { suku_cadang_id: { in: created.spareparts } } });
    await tx.master_toner.deleteMany({ where: { id: { in: created.toners } } });
    await tx.master_suku_cadang.deleteMany({ where: { id: { in: created.spareparts } } });
    await tx.master_customer.deleteMany({ where: { id: { in: created.customers } } });
    await tx.master_account.deleteMany({ where: { id: { in: created.accounts } } });
    await tx.master_printer_model.deleteMany({ where: { id: { in: created.models } } });
    await tx.master_printer_kategori.deleteMany({ where: { id: { in: created.categories } } });
    await tx.master_gudang.deleteMany({ where: { id: { in: created.warehouses } } });
  });
}

test("printer unit, stock, reservation, warehouse, and installation", async () => {
  try {
    const [admin, head, technician, warehouse, salesAdmin, salesToken] = await Promise.all([
      login("admin"), login("kepala-teknisi"), login("teknisi"), login("warehouse"), login("sales-admin"), login("sales")
    ]);
    assert.equal((await request(salesToken, "/audit-barang?jenis_barang=printer")).status, 403);
    const users = await good(admin, "/pengguna?batas=100");
    const tech = (Array.isArray(users) ? users : users.items).find((user) => user.user_id === "teknisi");
    assert.ok(tech);

    const category = await good(admin, "/printer-kategori", "POST", { kode_kategori: `UT-K-${suffix}`, nama_kategori: "Test Category" }, 201);
    created.categories.push(category.id);
    const model = await good(admin, "/printer-model", "POST", { kategori_id: category.id, kode_model: `UT-M-${suffix}`, merek: "Test", nama_model: "Model" }, 201);
    created.models.push(model.id);
    const modelCategory = await good(admin, `/printer-model?cari=${suffix}`);
    assert.equal(modelCategory.items[0].master_printer_kategori.id, category.id);

    for (const index of [1, 2]) {
      const row = await good(admin, "/gudang", "POST", { kode_gudang: `UT-G${index}-${suffix}`, nama_gudang: `Test Gudang ${index}`, jenis_gudang: "utama" }, 201);
      created.warehouses.push(row.id);
    }

    const mpNo = `UT-MP-${suffix}`;
    const unit = await good(admin, "/printer", "POST", { mp_no: mpNo, serial_number: `UT-SN-${suffix}`, model_id: model.id, gudang_id: created.warehouses[0] }, 201);
    created.units.push(unit.id);
    assert.deepEqual((await good(admin, `/audit-barang/printer/${unit.id}`)).items.map((event) => event.aksi), ["buat"]);
    assert.equal((await good(admin, `/audit-barang?barang=UT-SN-${suffix}`)).meta.total, 1);
    assert.equal(unit.status, "available");
    assert.equal((await good(admin, "/printer/summary")).available >= 1, true);
    assert.equal((await request(admin, "/printer", "POST", { mp_no: mpNo, model_id: model.id, gudang_id: created.warehouses[0] })).status, 409);
    assert.equal((await request(admin, "/printer", "POST", { mp_no: `${mpNo}-OTHER`, serial_number: `UT-SN-${suffix}`, model_id: model.id, gudang_id: created.warehouses[0] })).status, 409);

    await good(warehouse, `/printer/${unit.id}/transfer`, "POST", { gudang_id: created.warehouses[1], alasan: "Test transfer" });
    const transferAudit = (await good(admin, `/audit-barang/printer/${unit.id}`)).items[0];
    assert.equal(transferAudit.aksi, "pindah_gudang");
    assert.equal(transferAudit.lokasi_asal, "Test Gudang 1");
    assert.equal(transferAudit.lokasi_tujuan, "Test Gudang 2");
    assert.equal((await good(admin, `/printer/${unit.id}`)).gudang_id, created.warehouses[1]);
    assert.equal((await good(admin, `/printer?gudang_id=${created.warehouses[1]}&kategori_id=${category.id}&model_id=${model.id}`)).meta.total, 1);
    assert.equal((await request(admin, `/printer-model/${model.id}/permanent`, "DELETE")).status, 409);
    assert.equal((await request(admin, `/printer-kategori/${category.id}/permanent`, "DELETE")).status, 409);

    const extra = await good(admin, "/printer", "POST", { mp_no: `UT-EX-${suffix}`, model_id: model.id, gudang_id: created.warehouses[0] }, 201);
    created.units.push(extra.id);
    await good(warehouse, `/printer/${extra.id}/withdraw`, "POST", { alasan: "Test write-off" });
    assert.equal((await good(admin, `/printer/${extra.id}`)).status, "inactive");
    const deleted = await good(admin, "/printer", "POST", { mp_no: `UT-DEL-${suffix}`, model_id: model.id, gudang_id: created.warehouses[0] }, 201);
    created.units.push(deleted.id);
    await good(admin, `/printer/${deleted.id}`, "DELETE", { alasan: "Test deactivation" });
    assert.equal((await good(admin, `/printer/${deleted.id}`)).status, "inactive");

    const bulk = Array.from({ length: 101 }, (_, index) => ({ mp_no: `UT-B-${suffix}-${index}`, model_id: model.id, gudang_id: created.warehouses[0] }));
    await prisma.master_printer.createMany({ data: bulk });
    const bulkRows = await prisma.master_printer.findMany({ where: { mp_no: { startsWith: `UT-B-${suffix}-` } }, select: { id: true } });
    created.units.push(...bulkRows.map((row) => row.id));
    const firstPage = await good(admin, `/printer?cari=UT-B-${suffix}&batas=100&halaman=1`);
    const secondPage = await good(admin, `/printer?cari=UT-B-${suffix}&batas=100&halaman=2`);
    assert.equal(firstPage.meta.total, 101);
    assert.equal(firstPage.items.length, 100);
    assert.equal(secondPage.items.length, 1);

    const account = await good(admin, "/account", "POST", { kode_account: `UT-A-${suffix}`, nama_account: "Unit Test Account", customer_pertama: { kode_customer: `UT-C-${suffix}`, nama_customer: "Unit Test Customer", alamat: "Test Address" } }, 201);
    created.accounts.push(account.id);
    const customer = account.master_customer[0];
    created.customers.push(customer.id);
    assert.equal(customer.alamat, "Test Address");
    assert.equal(Object.hasOwn(customer, "kota"), false);
    const locations = await good(admin, `/account/lokasi-customer?cari=UT-C-${suffix}`);
    assert.equal(locations.meta.total, 1);
    assert.equal(locations.items[0].id, customer.id);
    assert.equal(locations.items[0].master_account.id, account.id);
    assert.equal((await good(admin, `/printer?lokasi=gudang&cari=${mpNo}`)).meta.total, 1);

    async function makeOrder(kind, printerId) {
      const order = await good(head, "/surat-tugas", "POST", { account_id: account.id, customer_id: customer.id, pic_teknisi_id: tech.id, mp_no: printerId ? mpNo : "NONE", jenis_pekerjaan: kind }, 201);
      created.workOrders.push(order.id);
      workOrderNumbers.push(order.nomor_surat_tugas);
      await good(head, `/surat-tugas/${order.id}/start`, "POST", {});
      return order;
    }

    const order = await makeOrder("installation", unit.id);
    const otherOrder = await makeOrder("installation", unit.id);
    const line = { gudang_id: created.warehouses[1], jenis_barang: "printer", printer_id: unit.id, jumlah_pakai: 1 };
    const claims = await Promise.all([
      request(technician, `/surat-tugas/${order.id}/pemakaian`, "POST", line),
      request(technician, `/surat-tugas/${otherOrder.id}/pemakaian`, "POST", line)
    ]);
    assert.deepEqual(claims.map((item) => item.status).sort(), [201, 409]);
    const owner = claims[0].status === 201 ? order : otherOrder;
    assert.equal((await good(admin, `/printer/${unit.id}`)).surat_tugas_aktif_id, owner.id);
    assert.equal((await good(admin, "/printer/summary")).reserved >= 1, true);
    assert.equal((await good(admin, `/printer?status=available&cari=${mpNo}`)).meta.total, 0);
    assert.equal((await request(head, `/surat-tugas/${owner.id}`, "PUT", { jenis_pekerjaan: "maintenance" })).status, 409);
    assert.equal((await request(admin, `/surat-tugas/${owner.id}`, "PUT", { status: "solved" })).status, 409);

    await good(technician, `/surat-tugas/${owner.id}/selesai-teknisi`, "POST", { hasil: "Installed" });
    await good(warehouse, `/surat-tugas/${owner.id}/validasi-warehouse`, "POST", {});
    assert.equal((await good(admin, `/printer/${unit.id}`)).status, "issued");
    await good(head, `/surat-tugas/${owner.id}/resolve`, "POST", {});
    const unitHistory = await good(admin, `/audit-barang/printer/${unit.id}?batas=2&halaman=1`);
    assert.equal(unitHistory.items.length, 2);
    assert.equal(unitHistory.items[0].aksi, "pasang_customer");
    assert.equal(unitHistory.items[1].aksi, "keluar_gudang");
    assert.equal((await good(admin, `/audit-barang/printer/${unit.id}?batas=2&halaman=2`)).items.length, 2);
    const installed = await good(admin, `/printer/${unit.id}`);
    assert.equal(installed.status, "installed");
    assert.equal(installed.customer_id, customer.id);
    assert.equal(installed.account_id, account.id);
    assert.equal(installed.gudang_id, null);
    assert.equal((await good(admin, `/printer-terpasang?customer_id=${customer.id}`)).meta.total, 1);
    assert.equal((await good(admin, `/printer?lokasi=customer&cari=${mpNo}`)).meta.total, 1);
    assert.equal((await good(admin, `/printer?lokasi=gudang&cari=${mpNo}`)).meta.total, 0);
    assert.equal((await good(admin, `/printer?lokasi=stok&cari=${mpNo}`)).meta.total, 1);

    const sales = (Array.isArray(users) ? users : users.items).find((user) => user.user_id === "sales");
    const complaint = await good(salesAdmin, "/pengaduan", "POST", { account_id: account.id, customer_id: customer.id, sales_id: sales.id, printer_id: unit.id, mp_no: "MISMATCH", nama_pelapor: "Test", deskripsi_masalah: "Test installed printer" }, 201);
    created.complaints.push(complaint.id);
    complaintNumbers.push(complaint.nomor_pengaduan);
    assert.equal(complaint.mp_no, mpNo);

    const maintenance = await makeOrder("maintenance");
    await good(head, `/surat-tugas/${maintenance.id}`, "PUT", { printer_id: unit.id });
    assert.equal((await good(head, `/surat-tugas/${maintenance.id}`)).printer_id, unit.id);
    await good(technician, `/surat-tugas/${maintenance.id}/selesai-teknisi`, "POST", {});
    await good(head, `/surat-tugas/${maintenance.id}/resolve`, "POST", {});
    assert.equal((await good(admin, `/printer/${unit.id}`)).status, "installed");
    assert.equal((await good(admin, "/stok")).printer[0].jumlah_tersedia >= 101, true);

    const hariIni = tanggalBangkok();
    const dueSixDays = new Date(`${hariIni}T00:00:00.000Z`);
    dueSixDays.setUTCDate(dueSixDays.getUTCDate() + 6);
    const dueFiveDays = new Date(dueSixDays);
    dueFiveDays.setUTCDate(dueFiveDays.getUTCDate() - 1);
    const due = dueFiveDays.toISOString().slice(0, 10);
    assert.equal((await request(admin, `/printer/${unit.id}`, "PUT", { interval_maintenance_bulan: 3 })).status, 422);
    await good(admin, `/printer/${unit.id}`, "PUT", {
      tanggal_pembelian: "2026-01-10", tanggal_maintenance_berikutnya: dueSixDays.toISOString().slice(0, 10), interval_maintenance_bulan: 3
    });
    assert.equal(await buatSuratTugasMaintenance(), 0);
    await good(admin, `/printer/${unit.id}`, "PUT", { tanggal_maintenance_berikutnya: due });
    assert.equal(await buatSuratTugasMaintenance(), 1);
    assert.equal(await buatSuratTugasMaintenance(), 0);
    const scheduled = await prisma.surat_tugas.findFirst({ where: { printer_id: unit.id, tanggal_maintenance_otomatis: dueFiveDays } });
    assert.ok(scheduled);
    created.workOrders.push(scheduled.id);
    workOrderNumbers.push(scheduled.nomor_surat_tugas);
    assert.equal(scheduled.status, "pending");
    assert.equal(scheduled.customer_id, customer.id);
    assert.equal(await prisma.teknisi_surat_tugas.count({ where: { surat_tugas_id: scheduled.id } }), 0);
    assert.equal((await request(head, `/surat-tugas/${scheduled.id}/start`, "POST", {})).status, 409);
    await good(head, `/surat-tugas/${scheduled.id}/assign`, "POST", { pic_teknisi_id: tech.id });
    await good(head, `/surat-tugas/${scheduled.id}/start`, "POST", {});
    assert.equal((await good(admin, `/printer/${unit.id}`)).status_operasional, "Sedang Maintenance");
    assert.ok(await prisma.riwayat_audit.findFirst({ where: { nomor_dokumen: scheduled.nomor_surat_tugas, aksi: "start" } }));
    const scheduledLine = await prisma.surat_tugas_printer.findFirst({ where: { surat_tugas_id: scheduled.id } });
    await good(technician, `/surat-tugas/${scheduled.id}/printer/${scheduledLine.id}/hasil`, "PUT", { hasil: "Maintenance selesai" });
    await good(technician, `/surat-tugas/${scheduled.id}/selesai`, "POST", {});
    await good(head, `/surat-tugas/${scheduled.id}/resolve`, "POST", {});
    const afterMaintenance = await good(admin, `/printer/${unit.id}`);
    assert.ok(afterMaintenance.status_operasional.startsWith("Di Customer"));
    assert.ok((await good(admin, `/audit-barang/printer/${unit.id}`)).items.some((event) => event.aksi === "maintenance_berikutnya"));
    assert.equal(afterMaintenance.tanggal_pembelian.slice(0, 10), "2026-01-10");
    assert.ok(afterMaintenance.tanggal_maintenance_berikutnya.slice(0, 10) > due);
    await good(admin, `/printer/${unit.id}`, "PUT", { tanggal_maintenance_berikutnya: due });
    assert.equal(await buatSuratTugasMaintenance(), 0);
    const cancelledDue = new Date(dueFiveDays);
    cancelledDue.setUTCDate(cancelledDue.getUTCDate() - 1);
    await good(admin, `/printer/${unit.id}`, "PUT", { tanggal_maintenance_berikutnya: cancelledDue.toISOString().slice(0, 10) });
    assert.equal(await buatSuratTugasMaintenance(), 1);
    const cancelledOrder = await prisma.surat_tugas.findFirst({ where: { printer_id: unit.id, tanggal_maintenance_otomatis: cancelledDue } });
    created.workOrders.push(cancelledOrder.id);
    workOrderNumbers.push(cancelledOrder.nomor_surat_tugas);
    await good(head, `/surat-tugas/${cancelledOrder.id}/assign`, "POST", { pic_teknisi_id: tech.id });
    await good(head, `/surat-tugas/${cancelledOrder.id}/start`, "POST", {});
    await good(head, `/surat-tugas/${cancelledOrder.id}/cancel`, "POST", {});
    assert.ok(await prisma.riwayat_audit.findFirst({ where: { nomor_dokumen: cancelledOrder.nomor_surat_tugas, aksi: "batalkan" } }));
    assert.equal(await buatSuratTugasMaintenance(), 0);
    assert.equal((await good(admin, `/printer/${unit.id}`)).tanggal_maintenance_berikutnya.slice(0, 10), cancelledDue.toISOString().slice(0, 10));

    const returning = await good(admin, "/printer", "POST", { mp_no: `UT-RET-${suffix}`, model_id: model.id, gudang_id: created.warehouses[0] }, 201);
    created.units.push(returning.id);
    const returnOrder = await makeOrder("delivery");
    await good(technician, `/surat-tugas/${returnOrder.id}/pemakaian`, "POST", { gudang_id: created.warehouses[0], jenis_barang: "printer", printer_id: returning.id, jumlah_pakai: 1 }, 201);
    await good(technician, `/surat-tugas/${returnOrder.id}/selesai-teknisi`, "POST", {});
    await good(warehouse, `/surat-tugas/${returnOrder.id}/validasi-warehouse`, "POST", {});
    assert.equal((await request(admin, `/surat-tugas/${returnOrder.id}`, "PUT", { status: "cancelled" })).status, 409);
    await good(warehouse, `/printer/${returning.id}/return`, "POST", { gudang_id: created.warehouses[1], alasan: "Barang kembali" });
    await good(admin, `/surat-tugas/${returnOrder.id}`, "PUT", { status: "cancelled" });
    assert.equal((await good(admin, `/printer/${returning.id}`)).status, "available");

    const reservedThenCancelled = await makeOrder("installation");
    await good(technician, `/surat-tugas/${reservedThenCancelled.id}/pemakaian`, "POST", { gudang_id: created.warehouses[1], jenis_barang: "printer", printer_id: returning.id, jumlah_pakai: 1 }, 201);
    assert.equal((await good(admin, `/printer/${returning.id}`)).status, "reserved");
    await good(admin, `/surat-tugas/${reservedThenCancelled.id}`, "PUT", { status: "cancelled" });
    assert.equal((await good(admin, `/printer/${returning.id}`)).status, "available");
    assert.equal((await good(admin, `/audit-barang/printer/${returning.id}`)).items[0].aksi, "lepas_reservasi");

    assert.equal((await request(admin, "/toner", "POST", { kode_toner: `UT-T-${suffix}`, nama_toner: "Test Toner", warna: "Hitam" })).status, 422);
    const toner = await good(admin, "/toner", "POST", { kode_toner: `UT-T-${suffix}`, nama_toner: "Test Toner", warna: "Hitam", tipe: "Laser" }, 201);
    created.toners.push(toner.id);
    const renamedToner = `UT-RENAMED-${suffix}`;
    await good(admin, `/toner/${toner.id}`, "PUT", { kode_toner: renamedToner });
    assert.deepEqual((await good(admin, `/audit-barang/toner/${toner.id}`)).items.map((event) => event.aksi), ["ubah", "buat"]);
    assert.equal((await good(admin, `/audit-barang?barang=UT-T-${suffix}`)).meta.total, 2);
    const reusedCode = await good(admin, "/toner", "POST", { kode_toner: `UT-T-${suffix}`, nama_toner: "Other Toner", warna: "Kuning", tipe: "Laser" }, 201);
    created.toners.push(reusedCode.id);
    assert.equal((await good(admin, `/audit-barang?barang=UT-T-${suffix}`)).meta.total, 3);
    assert.equal((await good(admin, `/audit-barang?barang_id=${toner.id}&barang=UT-T-${suffix}`)).meta.total, 2);
    await good(admin, `/toner/${reusedCode.id}/permanent`, "DELETE");
    assert.equal(toner.tipe, "Laser");
    const stokAwalToner = (await good(admin, "/stok")).toner.find((row) => row.toner_id === toner.id);
    assert.equal(stokAwalToner.belum_ditempatkan, true);
    assert.equal(Number(stokAwalToner.jumlah_tersedia), 0);
    const tonerTanpaStok = await good(admin, "/toner", "POST", { kode_toner: `UT-T-EMPTY-${suffix}`, nama_toner: "Toner Tanpa Stok", warna: "Cyan", tipe: "Laser" }, 201);
    created.toners.push(tonerTanpaStok.id);
    await good(admin, `/toner/${tonerTanpaStok.id}/permanent`, "DELETE");
    assert.deepEqual((await good(admin, `/audit-barang/toner/${tonerTanpaStok.id}`)).items.map((event) => event.aksi), ["hapus_permanen", "buat"]);
    assert.equal((await good(admin, `/audit-barang?barang=UT-T-EMPTY-${suffix}`)).meta.total, 2);
    assert.equal((await request(admin, "/suku-cadang", "POST", { kode_suku_cadang: `UT-S-${suffix}` })).status, 422);
    const sparepart = await good(admin, "/suku-cadang", "POST", { kode_suku_cadang: `UT-S-${suffix}`, nama_suku_cadang: "Test Sparepart" }, 201);
    created.spareparts.push(sparepart.id);
    assert.equal(Object.hasOwn(sparepart, "kategori"), false);
    assert.equal(Object.hasOwn(sparepart, "merek"), false);
    const stokAwalSparepart = (await good(admin, "/stok")).suku_cadang.find((row) => row.suku_cadang_id === sparepart.id);
    assert.equal(stokAwalSparepart.belum_ditempatkan, true);
    assert.equal(Number(stokAwalSparepart.jumlah_tersedia), 0);
    const sparepartTanpaStok = await good(admin, "/suku-cadang", "POST", { kode_suku_cadang: `UT-S-EMPTY-${suffix}`, nama_suku_cadang: "Sparepart Tanpa Stok" }, 201);
    created.spareparts.push(sparepartTanpaStok.id);
    await good(admin, `/suku-cadang/${sparepartTanpaStok.id}/permanent`, "DELETE");
    assert.deepEqual((await good(admin, `/audit-barang/suku_cadang/${sparepartTanpaStok.id}`)).items.map((event) => event.aksi), ["hapus_permanen", "buat"]);
    const draft = await good(warehouse, "/mutasi-stok", "POST", { jenis_mutasi: "masuk", gudang_tujuan_id: created.warehouses[0], detail: [{ jenis_barang: "toner", toner_id: toner.id, jumlah: 1 }] }, 201);
    created.mutations.push(draft.id);
    mutationNumbers.push(draft.nomor_mutasi);
    assert.deepEqual((await good(admin, `/audit-barang/toner/${toner.id}`)).items.map((event) => event.aksi), ["ubah", "buat"]);
    const mutation = await good(warehouse, "/mutasi-stok", "POST", { jenis_mutasi: "masuk", gudang_tujuan_id: created.warehouses[0], langsung_posting: true, detail: [
      { jenis_barang: "toner", toner_id: toner.id, jumlah: 3 },
      { jenis_barang: "suku_cadang", suku_cadang_id: sparepart.id, jumlah: 2 }
    ] }, 201);
    created.mutations.push(mutation.id);
    mutationNumbers.push(mutation.nomor_mutasi);
    const stock = await good(admin, "/stok");
    assert.equal(Number(stock.toner.find((row) => row.toner_id === toner.id).jumlah_tersedia), 3);
    assert.equal(Number(stock.suku_cadang.find((row) => row.suku_cadang_id === sparepart.id).jumlah_tersedia), 2);
    const tonerAudit = (await good(admin, `/audit-barang/toner/${toner.id}`)).items[0];
    assert.equal(tonerAudit.aksi, "masuk");
    assert.equal(tonerAudit.saldo_sebelum[0].jumlah_tersedia, 0);
    assert.equal(tonerAudit.saldo_sesudah[0].jumlah_tersedia, 3);
    assert.equal(tonerAudit.referensi.nomor, mutation.nomor_mutasi);
    assert.equal((await good(admin, `/audit-barang?barang=${encodeURIComponent(renamedToner)}&event=masuk`)).meta.total, 1);
    const auditCount = (await good(admin, `/audit-barang/toner/${toner.id}`)).meta.total;
    assert.equal((await request(warehouse, "/mutasi-stok", "POST", { jenis_mutasi: "keluar", gudang_asal_id: created.warehouses[0], langsung_posting: true, detail: [{ jenis_barang: "toner", toner_id: toner.id, jumlah: 99 }] })).status, 409);
    assert.equal((await good(admin, `/audit-barang/toner/${toner.id}`)).meta.total, auditCount);
    await good(warehouse, `/stok/mutasi/${draft.id}/posting`, "POST", {});
    assert.equal((await request(warehouse, `/stok/mutasi/${draft.id}/posting`, "POST", {})).status, 409);
    assert.equal((await good(admin, `/audit-barang/toner/${toner.id}`)).meta.total, auditCount + 1);
    assert.equal(Number((await good(admin, "/stok")).toner.find((row) => row.toner_id === toner.id).jumlah_tersedia), 4);

    const usageOrder = await makeOrder("maintenance");
    await good(technician, `/surat-tugas/${usageOrder.id}/pemakaian`, "POST", { gudang_id: created.warehouses[0], jenis_barang: "toner", toner_id: toner.id, jumlah_pakai: 2 }, 201);
    await good(technician, `/surat-tugas/${usageOrder.id}/selesai-teknisi`, "POST", {});
    await good(warehouse, `/surat-tugas/${usageOrder.id}/validasi-warehouse`, "POST", {});
    const usageAudit = (await good(admin, `/audit-barang/toner/${toner.id}`)).items[0];
    assert.equal(usageAudit.aksi, "pemakaian");
    assert.equal(usageAudit.saldo_sebelum[0].jumlah_tersedia, 4);
    assert.equal(usageAudit.saldo_sesudah[0].jumlah_tersedia, 2);
    assert.equal(usageAudit.referensi.id, usageOrder.id);
    assert.equal((await request(warehouse, `/surat-tugas/${usageOrder.id}/validasi-warehouse`, "POST", {})).status, 409);
    assert.equal((await good(admin, `/audit-barang/toner/${toner.id}`)).meta.total, auditCount + 2);
    await good(head, `/surat-tugas/${usageOrder.id}/resolve`, "POST", {});
    const transfer = await good(warehouse, "/mutasi-stok", "POST", { jenis_mutasi: "transfer", gudang_asal_id: created.warehouses[0], gudang_tujuan_id: created.warehouses[1], langsung_posting: true, detail: [{ jenis_barang: "toner", toner_id: toner.id, jumlah: 1 }] }, 201);
    created.mutations.push(transfer.id);
    mutationNumbers.push(transfer.nomor_mutasi);
    const transferStock = (await good(admin, `/audit-barang/toner/${toner.id}`)).items[0];
    assert.equal(transferStock.aksi, "transfer");
    assert.deepEqual(transferStock.saldo_sebelum.map((row) => row.jumlah_tersedia), [2, 0]);
    assert.deepEqual(transferStock.saldo_sesudah.map((row) => row.jumlah_tersedia), [1, 1]);
    const adjustment = await good(warehouse, "/mutasi-stok", "POST", { jenis_mutasi: "penyesuaian", gudang_tujuan_id: created.warehouses[1], langsung_posting: true, detail: [{ jenis_barang: "toner", toner_id: toner.id, jumlah: 2 }] }, 201);
    created.mutations.push(adjustment.id);
    mutationNumbers.push(adjustment.nomor_mutasi);
    assert.equal((await good(admin, `/audit-barang/toner/${toner.id}`)).items[0].aksi, "penyesuaian");
    const outgoing = await good(warehouse, "/mutasi-stok", "POST", { jenis_mutasi: "keluar", gudang_asal_id: created.warehouses[1], langsung_posting: true, detail: [{ jenis_barang: "toner", toner_id: toner.id, jumlah: 1 }] }, 201);
    created.mutations.push(outgoing.id);
    mutationNumbers.push(outgoing.nomor_mutasi);
    const outgoingAudit = (await good(admin, `/audit-barang/toner/${toner.id}`)).items[0];
    assert.equal(outgoingAudit.aksi, "keluar");
    assert.equal(outgoingAudit.saldo_sebelum[0].jumlah_tersedia, 3);
    assert.equal(outgoingAudit.saldo_sesudah[0].jumlah_tersedia, 2);
    await good(admin, `/suku-cadang/${sparepart.id}`, "DELETE");
    assert.equal((await good(admin, `/audit-barang/suku_cadang/${sparepart.id}`)).items[0].aksi, "nonaktifkan");
    assert.equal((await request(admin, `/toner/${toner.id}/permanent`, "DELETE")).status, 409);
    assert.equal((await request(admin, `/suku-cadang/${sparepart.id}/permanent`, "DELETE")).status, 409);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
