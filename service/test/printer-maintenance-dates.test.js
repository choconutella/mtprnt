const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tanggalBangkok, tambahBulan, jadwalBerikutnya } = require("../src/modules/printer-maintenance.service");

test("jadwal maintenance memakai tanggal Bangkok dan menjepit akhir bulan", () => {
  assert.equal(tanggalBangkok(new Date("2026-10-14T18:00:00.000Z")), "2026-10-15");
  assert.equal(tambahBulan("2026-01-31", 1), "2026-02-28");
  assert.equal(tambahBulan("2026-01-31", 2), "2026-03-31");
  assert.equal(jadwalBerikutnya("2026-01-31", 1, new Date("2026-03-01T00:00:00.000Z")).toISOString().slice(0, 10), "2026-03-31");
});
