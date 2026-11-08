const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { sukses } = require("./utils/response");
const { notFound, errorHandler } = require("./middlewares/error-handler");
const authRoutes = require("./modules/auth.routes");
const penggunaRoutes = require("./modules/pengguna.routes");
const masterRoutes = require("./modules/master.routes");
const printerRoutes = require("./modules/printer.routes");
const accountRoutes = require("./modules/account.routes");
const stokRoutes = require("./modules/stok.routes");
const mutasiStokRoutes = require("./modules/mutasi-stok.routes");
const tiketRoutes = require("./modules/tiket.routes");
const suratTugasBaruRoutes = require("./modules/surat-tugas-baru.routes");
const auditRoutes = require("./modules/audit.routes");
const auditBarangRoutes = require("./modules/audit-barang.routes");
const masterImportRoutes = require("./modules/master-import.routes");
const pengaturanRoutes = require("./modules/pengaturan.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/kesehatan", (req, res) => {
  return sukses(res, "Service berjalan.", {
    service: "multiprint-service",
    waktu: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/pengguna", penggunaRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/kontrak", masterRoutes.kontrak);
app.use("/api/toner", masterRoutes.toner);
app.use("/api/printer-kategori", printerRoutes.kategori);
app.use("/api/printer-model", printerRoutes.model);
app.use("/api/printer", printerRoutes.unit);
app.use("/api/suku-cadang", masterRoutes.sukuCadang);
app.use("/api/printer-terpasang", printerRoutes.installed);
app.use("/api/gudang", masterRoutes.gudang);
app.use("/api/stok", stokRoutes);
app.use("/api/mutasi-stok", mutasiStokRoutes);
app.use("/api/tiket", tiketRoutes);
app.use("/api/surat-tugas", suratTugasBaruRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/audit-barang", auditBarangRoutes);
app.use("/api/master-import", masterImportRoutes);
app.use("/api/pengaturan", pengaturanRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
