const { Prisma } = require("@prisma/client");
const { catatAuditBarang } = require("./audit-barang.service");

const tabelStok = {
  toner: {
    tabel: "stok_toner",
    kolomItem: "toner_id",
    master: "master_toner",
    masterKey: "kode_toner"
  },
  suku_cadang: {
    tabel: "stok_suku_cadang",
    kolomItem: "suku_cadang_id",
    master: "master_suku_cadang",
    masterKey: "kode_suku_cadang"
  }
};

function ambilItemId(line) {
  if (line.jenis_barang === "toner") return line.toner_id;
  return line.suku_cadang_id;
}

async function tambahStok(tx, jenis_barang, gudang_id, item_id, jumlah) {
  const cfg = tabelStok[jenis_barang];
  await tx.$executeRawUnsafe(
    `INSERT INTO ${cfg.tabel} (gudang_id, ${cfg.kolomItem}, jumlah_tersedia)
     VALUES ($1::varchar, $2::varchar, $3::numeric)
     ON CONFLICT (gudang_id, ${cfg.kolomItem})
     DO UPDATE SET
       jumlah_tersedia = ${cfg.tabel}.jumlah_tersedia + EXCLUDED.jumlah_tersedia,
       tanggal_diperbarui = now()`,
    gudang_id,
    item_id,
    new Prisma.Decimal(jumlah)
  );
}

async function kurangiStok(tx, jenis_barang, gudang_id, item_id, jumlah) {
  const cfg = tabelStok[jenis_barang];
  const hasil = await tx.$queryRawUnsafe(
    `UPDATE ${cfg.tabel}
     SET jumlah_tersedia = jumlah_tersedia - $3::numeric,
         tanggal_diperbarui = now()
     WHERE gudang_id = $1::varchar
       AND ${cfg.kolomItem} = $2::varchar
       AND jumlah_tersedia >= $3::numeric
     RETURNING id`,
    gudang_id,
    item_id,
    new Prisma.Decimal(jumlah)
  );

  if (!hasil.length) {
    throw Object.assign(new Error("Stok tidak cukup."), { statusCode: 409 });
  }
}

async function terapkanMutasi(tx, mutasi, lines, req) {
  for (const line of lines) {
    const itemId = ambilItemId(line);
    const jumlah = Number(line.jumlah);
    const asalId = ["keluar", "pemakaian", "transfer"].includes(mutasi.jenis_mutasi) ? mutasi.gudang_asal_id : null;
    const tujuanId = ["masuk", "transfer", "penyesuaian"].includes(mutasi.jenis_mutasi)
      ? mutasi.gudang_tujuan_id || mutasi.gudang_asal_id : null;
    if (mutasi.jenis_mutasi === "masuk") {
      await tambahStok(tx, line.jenis_barang, mutasi.gudang_tujuan_id, itemId, line.jumlah);
    }

    if (mutasi.jenis_mutasi === "keluar" || mutasi.jenis_mutasi === "pemakaian") {
      await kurangiStok(tx, line.jenis_barang, mutasi.gudang_asal_id, itemId, line.jumlah);
    }

    if (mutasi.jenis_mutasi === "transfer") {
      await kurangiStok(tx, line.jenis_barang, mutasi.gudang_asal_id, itemId, line.jumlah);
      await tambahStok(tx, line.jenis_barang, mutasi.gudang_tujuan_id, itemId, line.jumlah);
    }

    if (mutasi.jenis_mutasi === "penyesuaian") {
      if (Number(line.jumlah) >= 0) {
        await tambahStok(tx, line.jenis_barang, mutasi.gudang_tujuan_id || mutasi.gudang_asal_id, itemId, line.jumlah);
      } else {
        await kurangiStok(tx, line.jenis_barang, mutasi.gudang_asal_id || mutasi.gudang_tujuan_id, itemId, Math.abs(Number(line.jumlah)));
      }
    }

    const cfg = tabelStok[line.jenis_barang];
    const master = await tx[cfg.master].findUnique({ where: { [cfg.masterKey]: itemId } });
    const gudangIds = [...new Set([asalId, tujuanId].filter(Boolean))];
    const [stocks, gudangs] = await Promise.all([
      tx[cfg.tabel].findMany({ where: { [cfg.kolomItem]: itemId, gudang_id: { in: gudangIds } } }),
      tx.master_gudang.findMany({ where: { kode_gudang: { in: gudangIds } }, select: { kode_gudang: true, nama_gudang: true } })
    ]);
    const stokSesudah = gudangIds.map((id) => ({
      gudang_id: id,
      nama_gudang: gudangs.find((gudang) => gudang.kode_gudang === id)?.nama_gudang || null,
      jumlah_tersedia: Number(stocks.find((stock) => stock.gudang_id === id)?.jumlah_tersedia || 0)
    }));
    const delta = (id) => {
      if (mutasi.jenis_mutasi === "transfer") return id === asalId ? -jumlah : jumlah;
      if (["keluar", "pemakaian"].includes(mutasi.jenis_mutasi)) return -jumlah;
      if (mutasi.jenis_mutasi === "penyesuaian") return Number(line.jumlah);
      return jumlah;
    };
    const stokSebelum = stokSesudah.map((stock) => ({ ...stock, jumlah_tersedia: stock.jumlah_tersedia - delta(stock.gudang_id) }));
    await catatAuditBarang(tx, req, {
      jenis_barang: line.jenis_barang,
      aksi: mutasi.jenis_mutasi,
      sebelum: { ...master, stok: stokSebelum },
      sesudah: { ...master, stok: stokSesudah },
      perubahan: { jenis_mutasi: mutasi.jenis_mutasi, jumlah, gudang_asal_id: asalId, gudang_tujuan_id: tujuanId },
      referensi: { jenis: "mutasi_stok", id: mutasi.id, nomor: mutasi.nomor_mutasi, surat_tugas_id: mutasi.jenis_referensi === "surat_tugas" ? mutasi.referensi_id : null },
      keterangan: line.keterangan || mutasi.keterangan || "Mutasi stok terposting."
    });
  }
}

module.exports = { ambilItemId, tambahStok, kurangiStok, terapkanMutasi };
