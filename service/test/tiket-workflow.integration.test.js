const { test } = require("node:test");
const assert = require("node:assert/strict");

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
  const result = await good(null, "/auth/masuk", "POST", { username, kata_sandi: process.env.TEST_PASSWORD || "Admin123" });
  return result.token;
}

function items(data) {
  return Array.isArray(data) ? data : data.items;
}

test("TONER PURCHASE posts once under concurrent Warehouse confirmation", { skip: !base && "Set TEST_API_BASE to a disposable test API." }, async () => {
  const [admin, salesAdmin, head, technician, warehouse] = await Promise.all([
    login("admin"), login("sales-admin"), login("kepala-teknisi"), login("teknisi"), login("warehouse")
  ]);
  const [accounts, customers, users, warehouses] = await Promise.all([
    good(admin, "/account?batas=100"),
    good(admin, "/account/lokasi-customer?batas=100"),
    good(admin, "/pengguna?batas=100"),
    good(admin, "/gudang?batas=100")
  ]);
  const account = items(accounts).find((row) => row.aktif);
  const customer = items(customers).find((row) => row.aktif && row.account_id === account?.id);
  const sales = items(users).find((row) => (row.role || row.peran) === "sales" && (row.active ?? row.aktif));
  const tech = items(users).find((row) => (row.role || row.peran) === "teknisi" && (row.active ?? row.aktif));
  const gudang = items(warehouses).find((row) => row.aktif);
  assert.ok(account && customer && sales && tech && gudang, "Seed account, customer, sales, technician, and warehouse first.");

  const suffix = Date.now().toString(36).toUpperCase();
  const toner = await good(admin, "/toner", "POST", {
    kode_toner: `T-INT-${suffix}`, nama_toner: `Toner integration ${suffix}`,
    warna: "Hitam", tipe: "Laser"
  }, 201);
  await good(warehouse, "/stok/mutasi", "POST", {
    jenis_mutasi: "masuk", gudang_tujuan_id: gudang.id, langsung_posting: true,
    detail: [{ jenis_barang: "toner", toner_id: toner.id, jumlah: 10 }]
  }, 201);

  const ticket = await good(salesAdmin, "/tiket", "POST", {
    kategori: "delivery", jenis: "toner_purchase", account_id: account.id,
    customer_id: customer.id, sales_id: sales.id,
    toner: [{ toner_id: toner.id, jumlah: 2 }]
  }, 201);
  const order = await good(head, "/surat-tugas", "POST", {
    tiket_id: ticket.id, jenis_tugas: "kirim_toner", gudang_id: gudang.id,
    pic_teknisi_id: tech.id, printer: []
  }, 201);
  await good(head, `/surat-tugas/${order.id}/start`, "POST", {});

  const attempts = await Promise.all([
    request(warehouse, `/surat-tugas/${order.id}/keluar`, "POST", {}),
    request(warehouse, `/surat-tugas/${order.id}/keluar`, "POST", {})
  ]);
  assert.deepEqual(attempts.map((row) => row.status).sort(), [200, 409]);
  const stock = await good(admin, "/stok");
  const balance = stock.toner.find((row) => row.toner_id === toner.id && row.gudang_id === gudang.id);
  assert.equal(Number(balance.jumlah_tersedia), 8);
  const history = await good(admin, `/audit-barang/toner/${toner.id}`);
  assert.equal(history.items.filter((row) => row.aksi === "pemakaian").length, 1);
  assert.equal((await request(head, `/surat-tugas/${order.id}`, "PUT", { status: "solved" })).status, 409);

  await good(technician, `/surat-tugas/${order.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${order.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${order.id}/resolve`, "POST", {});
  const solved = await good(salesAdmin, `/tiket/${ticket.id}/resolve`, "POST", {});
  assert.equal(solved.status, "solved");
});

test("TRIAL converts to KONTRAK and TUKAR receives the old unit separately", { skip: !base && "Set TEST_API_BASE to a disposable test API." }, async () => {
  const [admin, salesAdmin, head, technician, warehouse] = await Promise.all([
    login("admin"), login("sales-admin"), login("kepala-teknisi"), login("teknisi"), login("warehouse")
  ]);
  const [accounts, customers, users, warehouses, models] = await Promise.all([
    good(admin, "/account?batas=100"), good(admin, "/account/lokasi-customer?batas=100"),
    good(admin, "/pengguna?batas=100"), good(admin, "/gudang?batas=100"), good(admin, "/printer-model?batas=100")
  ]);
  const account = items(accounts).find((row) => row.aktif);
  const customer = items(customers).find((row) => row.aktif && row.account_id === account?.id);
  const sales = items(users).find((row) => (row.role || row.peran) === "sales" && (row.active ?? row.aktif));
  const tech = items(users).find((row) => (row.role || row.peran) === "teknisi" && (row.active ?? row.aktif));
  const wh = items(users).find((row) => (row.role || row.peran) === "warehouse" && (row.active ?? row.aktif));
  const gudang = items(warehouses).find((row) => row.aktif);
  const model = items(models).find((row) => row.aktif);
  assert.ok(account && customer && sales && tech && wh && gudang && model);
  const suffix = Date.now().toString(36).toUpperCase();
  const unitA = await good(admin, "/printer", "POST", { mp_no: `TRIAL-${suffix}`, model_id: model.id, gudang_id: gudang.id }, 201);
  const trial = await good(salesAdmin, "/tiket", "POST", {
    kategori: "delivery", jenis: "trial", account_id: account.id, customer_id: customer.id, sales_id: sales.id,
    tanggal_akhir: new Date(Date.now() + 7 * 86400000).toISOString(),
    printer: [{ printer_id: unitA.id, mp_no: unitA.mp_no, peran: "utama" }]
  }, 201);
  const trialSt = await good(head, "/surat-tugas", "POST", {
    tiket_id: trial.id, jenis_tugas: "kirim_trial", gudang_id: gudang.id, pic_teknisi_id: tech.id,
    printer: [{ printer_id: unitA.id, mp_no: unitA.mp_no, peran: "utama" }]
  }, 201);
  await good(head, `/surat-tugas/${trialSt.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${trialSt.id}/keluar`, "POST", {});
  await good(technician, `/surat-tugas/${trialSt.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${trialSt.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${trialSt.id}/resolve`, "POST", {});
  await good(salesAdmin, `/tiket/${trial.id}`, "PUT", { hasil: "berhasil" });
  await good(salesAdmin, `/tiket/${trial.id}/resolve`, "POST", {});
  assert.equal((await good(admin, `/printer/${unitA.id}`)).penempatan, "trial");

  const contractTicket = await good(salesAdmin, "/tiket", "POST", {
    kategori: "delivery", jenis: "kontrak", mode: "baru", account_id: account.id,
    customer_id: customer.id, sales_id: sales.id, tiket_asal_id: trial.id,
    printer: [{ printer_id: unitA.id, mp_no: unitA.mp_no, peran: "utama" }]
  }, 201);
  const contractSt = await good(head, "/surat-tugas", "POST", {
    tiket_id: contractTicket.id, jenis_tugas: "kirim_kontrak", gudang_id: gudang.id,
    pic_teknisi_id: tech.id, printer: [{ printer_id: unitA.id, mp_no: unitA.mp_no, peran: "utama" }]
  }, 201);
  await good(head, `/surat-tugas/${contractSt.id}/start`, "POST", {});
  await good(technician, `/surat-tugas/${contractSt.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${contractSt.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${contractSt.id}/resolve`, "POST", {});
  await good(salesAdmin, `/tiket/${contractTicket.id}/resolve`, "POST", {});
  const installed = await good(admin, `/printer/${unitA.id}`);
  assert.equal(installed.penempatan, "kontrak");
  assert.equal(installed.customer_id, customer.id);
  const contract = (await good(admin, `/kontrak?batas=100`)).items.find((row) => row.id === installed.kontrak_id);
  assert.equal(contract.status, "aktif");

  const unitB = await good(admin, "/printer", "POST", { mp_no: `TUKAR-${suffix}`, model_id: model.id, gudang_id: gudang.id }, 201);
  const exchange = await good(salesAdmin, "/tiket", "POST", {
    kategori: "delivery", jenis: "kontrak", mode: "tukar", account_id: account.id,
    customer_id: customer.id, sales_id: sales.id, kontrak_id: contract.id,
    printer: [
      { printer_id: unitB.id, mp_no: unitB.mp_no, peran: "utama" },
      { printer_id: unitA.id, mp_no: unitA.mp_no, peran: "unit_lama" }
    ]
  }, 201);
  const outbound = await good(head, "/surat-tugas", "POST", {
    tiket_id: exchange.id, jenis_tugas: "kirim_kontrak", gudang_id: gudang.id, pic_teknisi_id: tech.id,
    printer: [{ printer_id: unitB.id, mp_no: unitB.mp_no, peran: "utama" }]
  }, 201);
  await good(head, `/surat-tugas/${outbound.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${outbound.id}/keluar`, "POST", {});
  await good(technician, `/surat-tugas/${outbound.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${outbound.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${outbound.id}/resolve`, "POST", {});
  assert.equal((await request(salesAdmin, `/tiket/${exchange.id}/resolve`, "POST", {})).status, 409);
  const inbound = await good(warehouse, "/surat-tugas", "POST", {
    tiket_id: exchange.id, jenis_tugas: "terima_tukar", gudang_id: gudang.id, pic_warehouse_id: wh.id,
    printer: [{ printer_id: unitA.id, mp_no: unitA.mp_no, peran: "unit_lama" }]
  }, 201);
  await good(warehouse, `/surat-tugas/${inbound.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${inbound.id}/terima`, "POST", {});
  await good(warehouse, `/surat-tugas/${inbound.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${inbound.id}/resolve`, "POST", {});
  await good(salesAdmin, `/tiket/${exchange.id}/resolve`, "POST", {});
  const oldUnit = await good(admin, `/printer/${unitA.id}`);
  const newUnit = await good(admin, `/printer/${unitB.id}`);
  assert.equal(oldUnit.lokasi_jenis, "gudang");
  assert.equal(oldUnit.kondisi, "checking");
  assert.equal(newUnit.kontrak_id, contract.id);
  assert.equal(newUnit.customer_id, customer.id);

  const unitC = await good(admin, "/printer", "POST", { mp_no: `BACKUP-${suffix}`, model_id: model.id, gudang_id: gudang.id }, 201);
  const backup = await good(salesAdmin, "/tiket", "POST", {
    kategori: "komplain", jenis: "back_up", mode: "permanen", account_id: account.id,
    customer_id: customer.id, sales_id: sales.id,
    printer: [
      { printer_id: unitB.id, mp_no: unitB.mp_no, peran: "utama" },
      { printer_id: unitC.id, mp_no: unitC.mp_no, peran: "pengganti" }
    ]
  }, 201);
  const backupOut = await good(head, "/surat-tugas", "POST", {
    tiket_id: backup.id, jenis_tugas: "kirim_back_up", gudang_id: gudang.id,
    pic_teknisi_id: tech.id, printer: [{ printer_id: unitC.id, mp_no: unitC.mp_no, peran: "pengganti" }]
  }, 201);
  await good(head, `/surat-tugas/${backupOut.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${backupOut.id}/keluar`, "POST", {});
  await good(technician, `/surat-tugas/${backupOut.id}/serah`, "POST", {});
  await good(technician, `/surat-tugas/${backupOut.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${backupOut.id}/resolve`, "POST", {});
  assert.equal((await request(salesAdmin, `/tiket/${backup.id}/resolve`, "POST", {})).status, 409);
  const backupIn = await good(warehouse, "/surat-tugas", "POST", {
    tiket_id: backup.id, jenis_tugas: "terima_unit_rusak", gudang_id: gudang.id,
    pic_warehouse_id: wh.id, printer: [{ printer_id: unitB.id, mp_no: unitB.mp_no, peran: "utama" }]
  }, 201);
  await good(warehouse, `/surat-tugas/${backupIn.id}/start`, "POST", {});
  await good(warehouse, `/surat-tugas/${backupIn.id}/terima`, "POST", {});
  await good(warehouse, `/surat-tugas/${backupIn.id}/selesai`, "POST", {});
  await good(head, `/surat-tugas/${backupIn.id}/resolve`, "POST", {});
  await good(salesAdmin, `/tiket/${backup.id}/resolve`, "POST", {});
  assert.equal((await good(admin, `/printer/${unitB.id}`)).kondisi, "checking");
  const replacement = await good(admin, `/printer/${unitC.id}`);
  assert.equal(replacement.penempatan, "kontrak");
  assert.equal(replacement.kontrak_id, contract.id);
});
