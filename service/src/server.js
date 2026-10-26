const app = require("./app");
const env = require("./config/env");
const { buatSuratTugasMaintenance } = require("./modules/printer-maintenance.service");

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Service berjalan di port ${env.port}`);
});

async function periksaMaintenance() {
  try {
    const dibuat = await buatSuratTugasMaintenance();
    if (dibuat) console.log(`${dibuat} surat tugas maintenance terjadwal dibuat.`);
  } catch (error) {
    console.error("Pemeriksaan maintenance gagal:", error);
  }
}

periksaMaintenance();
setInterval(periksaMaintenance, 60 * 60 * 1000);
