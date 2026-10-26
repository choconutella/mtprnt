const test = require("node:test");
const assert = require("node:assert/strict");
const { JENIS_TIKET, JENIS_ST, kategoriUntukJenisSt, jenisStDiizinkan, tugasWajib } = require("../src/modules/tiket.catalog");

test("setiap jenis ST hanya berasal dari satu subjenis tiket", () => {
  assert.equal(new Set(JENIS_ST).size, JENIS_ST.length);
  for (const [kategori, jenis] of Object.entries(JENIS_TIKET)) {
    for (const [subjenis, tugas] of Object.entries(jenis)) {
      for (const st of tugas) {
        assert.deepEqual(kategoriUntukJenisSt(st), { kategori, jenis: subjenis });
        if (st !== "terima_tukar") assert.equal(jenisStDiizinkan(kategori, subjenis, st), true);
      }
    }
  }
});

test("TUKAR membutuhkan pengiriman dan penerimaan terpisah", () => {
  assert.deepEqual(tugasWajib("delivery", "kontrak", "baru"), ["kirim_kontrak"]);
  assert.deepEqual(tugasWajib("delivery", "kontrak", "tukar"), ["kirim_kontrak", "terima_tukar"]);
  assert.equal(jenisStDiizinkan("delivery", "kontrak", "terima_tukar", "baru"), false);
  assert.equal(jenisStDiizinkan("delivery", "kontrak", "terima_tukar", "tukar"), true);
});

test("BACK-UP mewajibkan pengiriman pengganti dan penerimaan unit rusak", () => {
  assert.deepEqual(tugasWajib("komplain", "back_up", "permanen"), ["kirim_back_up", "terima_unit_rusak"]);
  assert.equal(jenisStDiizinkan("komplain", "back_up", "qc", "permanen"), false);
});
