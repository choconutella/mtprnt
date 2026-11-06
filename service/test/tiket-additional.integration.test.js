const { test } = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/config/prisma");
const { buatSuratTugasMaintenance } = require("../src/modules/printer-maintenance.service");

const base = process.env.TEST_API_BASE;

async function request(token, path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await response.json();
  return { status: response.status, data: payload.data, message: payload.pesan };
}

async function good(token, path, method = "GET", body, expected = 200) {
  const result = await request(token, path, method, body);
  assert.equal(result.status, expected, `${method} ${path}: ${result.message}`);
  return result.data;
}

async function login(username) {
  return (await good(null, "/auth/masuk", "POST", { username, kata_sandi: process.env.TEST_PASSWORD || "Admin123" })).token;
}

const items = (data) => Array.isArray(data) ? data : data.items;
const line = (unit, peran = "utama") => ({ printer_id: unit.id, mp_no: unit.mp_no, peran });

test("inbound bulk, QC/Repair, Internal Use, cancellation, maintenance, and Return", { skip: !base && "Use a disposable test database." }, async () => {
  const [admin, salesAdmin, head, technician, warehouse, sales] = await Promise.all([
    login("admin"), login("sales-admin"), login("kepala-teknisi"), login("teknisi"), login("warehouse"), login("sales")
  ]);
  const [accounts, customers, users, warehouses, models] = await Promise.all([
    good(admin, "/account?batas=100"), good(admin, "/account/lokasi-customer?batas=100"),
    good(admin, "/pengguna?batas=100"), good(admin, "/gudang?batas=100"), good(admin, "/printer-model?batas=100")
  ]);
  const account = items(accounts).find((row) => row.aktif);
  const customer = items(customers).find((row) => row.aktif && row.account_id === account?.id);
  const salesUser = items(users).find((row) => (row.role || row.peran) === "sales" && (row.active ?? row.aktif));
  const tech = items(users).find((row) => (row.role || row.peran) === "teknisi" && (row.active ?? row.aktif));
  const wh = items(users).find((row) => (row.role || row.peran) === "warehouse" && (row.active ?? row.aktif));
  const gudang = items(warehouses).find((row) => row.aktif);
  const model = items(models).find((row) => row.aktif);
  assert.ok(account && customer && salesUser && tech && wh && gudang && model);
  assert.equal((await request(sales, "/tiket", "POST", { kategori: "internal", jenis: "qc" })).status, 403);
  assert.equal((await request(warehouse, "/tiket", "POST", { kategori: "delivery", jenis: "trial" })).status, 403);

  const suffix = Date.now().toString(36).toUpperCase();
  const incoming = [1, 2].map((n) => ({ mp_no: `BULK-${suffix}-${n}`, model_id: model.id, sumber: "Pembelian uji" }));
  const inboundTicket = await good(warehouse, "/tiket", "POST", {
    kategori: "inbound", jenis: "penerimaan_printer", printer: incoming
  }, 201);
  const inboundSt = await good(warehouse, "/surat-tugas", "POST", {
    tiket_id: inboundTicket.id, jenis_tugas: "terima_printer_baru", gudang_id: gudang.id,
    pic_warehouse_id: wh.id, printer: incoming
  }, 201);
  await good(warehouse, `/surat-tugas/${inboundSt.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${inboundSt.id}/terima`, "POST", {});
  await good(warehouse, `/surat-tugas/${inboundSt.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${inboundSt.id}/resolve`, "POST", {});
  await good(warehouse, `/tiket/${inboundTicket.id}/resolve`, "POST", {});
  const inboundDetail = await good(warehouse, `/surat-tugas/${inboundSt.id}`);
  assert.equal(inboundDetail.master_pengguna_pic_warehouse?.id, wh.id);
  assert.ok(!JSON.stringify(inboundDetail).includes("kata_sandi_hash"), "Surat Tugas must not expose password hashes.");
  const imported = await Promise.all(incoming.map(async (row) => {
    const result = await good(admin, `/printer?cari=${row.mp_no}`);
    assert.equal(result.meta.total, 1);
    assert.equal(result.items[0].kondisi, "checking");
    return result.items[0];
  }));
  assert.equal((await request(warehouse, "/tiket", "POST", { kategori: "inbound", jenis: "penerimaan_printer", printer: incoming })).status, 409);

  const qcTicket = await good(head, "/tiket", "POST", {
    kategori: "internal", jenis: "qc", printer: imported.map((unit) => line(unit))
  }, 201);
  const qc = await good(head, "/surat-tugas", "POST", {
    tiket_id: qcTicket.id, jenis_tugas: "qc", pic_teknisi_id: tech.id,
    printer: imported.map((unit) => line(unit))
  }, 201);
  await good(head, `/surat-tugas/${qc.id}/start`, "POST", {});
  assert.equal((await request(warehouse, `/surat-tugas/${qc.id}/selesai`, "POST", {})).status, 403);
  for (const [index, resultLine] of qc.surat_tugas_printer.entries()) {
    await good(technician, `/surat-tugas/${qc.id}/printer/${resultLine.id}/hasil`, "PUT", {
      hasil: index === 0 ? "Lulus QC" : "Perlu perbaikan",
      kondisi_hasil: index === 0 ? "ready" : "need_repair",
      ...(index === 0 ? {} : { alasan: "Roller aus" })
    });
  }
  await good(technician, `/surat-tugas/${qc.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${qc.id}/resolve`, "POST", {});
  await good(head, `/tiket/${qcTicket.id}/resolve`, "POST", {});
  assert.equal((await good(admin, `/printer/${imported[0].id}`)).kondisi, "ready");
  assert.equal((await good(admin, `/printer/${imported[1].id}`)).kondisi, "need_repair");

  const repairTicket = await good(head, "/tiket", "POST", {
    kategori: "internal", jenis: "repair", printer: [line(imported[1])]
  }, 201);
  const repair = await good(head, "/surat-tugas", "POST", {
    tiket_id: repairTicket.id, jenis_tugas: "repair", pic_teknisi_id: tech.id,
    printer: [line(imported[1])]
  }, 201);
  await good(head, `/surat-tugas/${repair.id}/start`, "POST", {});
  assert.equal((await good(admin, `/printer/${imported[1].id}`)).kondisi, "in_repair");
  await good(technician, `/surat-tugas/${repair.id}/printer/${repair.surat_tugas_printer[0].id}/hasil`, "PUT", { hasil: "Roller diganti", kondisi_hasil: "ready" });
  await good(technician, `/surat-tugas/${repair.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${repair.id}/resolve`, "POST", {});
  await good(head, `/tiket/${repairTicket.id}/resolve`, "POST", {});
  assert.equal((await good(admin, `/printer/${imported[1].id}`)).kondisi, "ready");

  const cancelTicket = await good(head, "/tiket", "POST", {
    kategori: "internal", jenis: "internal_use", lokasi_internal: "Divisi Operasional",
    printer: [line(imported[0])]
  }, 201);
  const cancelled = await good(head, "/surat-tugas", "POST", {
    tiket_id: cancelTicket.id, jenis_tugas: "internal_use", gudang_id: gudang.id,
    pic_teknisi_id: tech.id, printer: [line(imported[0])]
  }, 201);
  assert.equal((await good(admin, `/printer/${imported[0].id}`)).status, "reserved");
  await good(head, `/surat-tugas/${cancelled.id}/cancel`, "POST", {});
  await good(head, `/tiket/${cancelTicket.id}/cancel`, "POST", {});
  assert.equal((await good(admin, `/printer/${imported[0].id}`)).status, "available");
  const internalTicket = await good(head, "/tiket", "POST", {
    kategori: "internal", jenis: "internal_use", lokasi_internal: "Divisi Operasional",
    printer: [line(imported[0])]
  }, 201);
  const internal = await good(head, "/surat-tugas", "POST", {
    tiket_id: internalTicket.id, jenis_tugas: "internal_use", gudang_id: gudang.id,
    pic_teknisi_id: tech.id, printer: [line(imported[0])]
  }, 201);
  await good(head, `/surat-tugas/${internal.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${internal.id}/keluar`, "POST", {});
  await good(technician, `/surat-tugas/${internal.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${internal.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${internal.id}/resolve`, "POST", {});
  await good(head, `/tiket/${internalTicket.id}/resolve`, "POST", {});
  const internalUnit = await good(admin, `/printer/${imported[0].id}`);
  assert.equal(internalUnit.lokasi_jenis, "internal");
  assert.equal(internalUnit.lokasi_internal, "Divisi Operasional");

  const customerUnit = await good(admin, "/printer", "POST", {
    mp_no: `RETURN-${suffix}`, model_id: model.id, gudang_id: gudang.id
  }, 201);
  const deliveryTicket = await good(salesAdmin, "/tiket", "POST", {
    kategori: "delivery", jenis: "stand_by", account_id: account.id, customer_id: customer.id,
    sales_id: salesUser.id, printer: [line(customerUnit)]
  }, 201);
  const delivery = await good(head, "/surat-tugas", "POST", {
    tiket_id: deliveryTicket.id, jenis_tugas: "kirim_stand_by", gudang_id: gudang.id,
    pic_teknisi_id: tech.id, printer: [line(customerUnit)]
  }, 201);
  await good(head, `/surat-tugas/${delivery.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${delivery.id}/keluar`, "POST", {});
  await good(technician, `/surat-tugas/${delivery.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${delivery.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${delivery.id}/resolve`, "POST", {});
  await good(salesAdmin, `/tiket/${deliveryTicket.id}/resolve`, "POST", {});

  const due = new Date(Date.now() + 3 * 86400000);
  await prisma.master_printer.update({ where: { id: customerUnit.id }, data: {
    tanggal_maintenance_berikutnya: new Date(due.toISOString().slice(0, 10)), interval_maintenance_bulan: 1
  } });
  assert.equal(await buatSuratTugasMaintenance(), 1);
  assert.equal(await buatSuratTugasMaintenance(), 0);
  const scheduled = await prisma.surat_tugas.findFirst({ where: { printer_id: customerUnit.id, jenis_tugas: "maintenance", status: "pending" }, include: { teknisi_surat_tugas: true } });
  assert.ok(scheduled);
  assert.equal(scheduled.teknisi_surat_tugas.length, 0);
  await good(head, `/surat-tugas/${scheduled.id}/cancel`, "POST", {});

  const returnTicket = await good(warehouse, "/tiket", "POST", {
    kategori: "inbound", jenis: "return", account_id: account.id, customer_id: customer.id,
    alasan: "Masa standby berakhir", printer: [line(customerUnit)]
  }, 201);
  const returnSt = await good(warehouse, "/surat-tugas", "POST", {
    tiket_id: returnTicket.id, jenis_tugas: "terima_return", gudang_id: gudang.id,
    pic_warehouse_id: wh.id, printer: [line(customerUnit)]
  }, 201);
  await good(warehouse, `/surat-tugas/${returnSt.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${returnSt.id}/terima`, "POST", {});
  await good(warehouse, `/surat-tugas/${returnSt.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${returnSt.id}/resolve`, "POST", {});
  await good(warehouse, `/tiket/${returnTicket.id}/resolve`, "POST", {});
  const returned = await good(admin, `/printer/${customerUnit.id}`);
  assert.equal(returned.lokasi_jenis, "gudang");
  assert.equal(returned.kondisi, "checking");
  const history = await good(admin, `/audit-barang/printer/${customerUnit.id}`);
  assert.ok(history.items.some((event) => event.aksi === "terima_gudang"));

  const standalone = await good(head, "/surat-tugas", "POST", {
    jenis_tugas: "qc", pic_teknisi_id: tech.id, printer: [line(customerUnit)]
  }, 201);
  assert.equal(standalone.tiket_id, null);
  assert.equal((await request(sales, `/surat-tugas/${standalone.id}`)).status, 403);
  await good(head, `/surat-tugas/${standalone.id}/start`, "POST", {});
  await good(technician, `/surat-tugas/${standalone.id}/printer/${standalone.surat_tugas_printer[0].id}/hasil`, "PUT", {
    hasil: "Lulus pemeriksaan", kondisi_hasil: "ready"
  });
  await good(technician, `/surat-tugas/${standalone.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${standalone.id}/resolve`, "POST", {});
  const printable = await good(head, `/surat-tugas/${standalone.id}`);
  assert.equal(printable.status, "solved");
  assert.equal(printable.surat_tugas_printer[0].mp_no, customerUnit.mp_no);
  assert.equal(printable.validasi_kepala_teknisi_oleh, items(users).find((row) => (row.role || row.peran) === "kepala-teknisi")?.id);
  assert.ok(printable.validasi_kepala_teknisi_pada);
  assert.equal((await good(admin, `/printer/${customerUnit.id}`)).kondisi, "ready");
});
