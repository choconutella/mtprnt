BEGIN;

-- Existing complaints, assignments, movements, balances, and audits are kept.
-- Hold writes to the legacy operational tables while the mapping is installed.
LOCK TABLE pengaduan, surat_tugas, master_printer, mutasi_stok,
  stok_toner, stok_suku_cadang, riwayat_audit IN ACCESS EXCLUSIVE MODE;
UPDATE role_permission SET modul = 'tiket' WHERE modul = 'komplain';

CREATE TABLE tiket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_tiket VARCHAR(100) NOT NULL UNIQUE,
  pengaduan_lama_id UUID UNIQUE REFERENCES pengaduan(id) ON DELETE RESTRICT,
  kategori VARCHAR(30) NOT NULL CHECK (kategori IN ('delivery','komplain','internal','inbound','maintenance')),
  jenis VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','pending','progress','solved','cancelled')),
  account_id UUID REFERENCES master_account(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES master_customer(id) ON DELETE RESTRICT,
  kontrak_id UUID REFERENCES master_kontrak(id) ON DELETE RESTRICT,
  tiket_asal_id UUID REFERENCES tiket(id) ON DELETE RESTRICT,
  sales_id UUID REFERENCES master_pengguna(id) ON DELETE RESTRICT,
  tanggal_transaksi TIMESTAMPTZ NOT NULL DEFAULT now(),
  tanggal_akhir TIMESTAMPTZ,
  mode VARCHAR(30),
  lokasi_internal VARCHAR(200),
  alasan VARCHAR(100),
  deskripsi TEXT,
  hasil VARCHAR(50),
  ringkasan_penyelesaian TEXT,
  dibuat_oleh UUID REFERENCES master_pengguna(id) ON DELETE RESTRICT,
  tanggal_dibuat TIMESTAMPTZ NOT NULL DEFAULT now(),
  tanggal_diperbarui TIMESTAMPTZ NOT NULL DEFAULT now(),
  tanggal_diselesaikan TIMESTAMPTZ
);
CREATE INDEX idx_tiket_jenis_status ON tiket(kategori, jenis, status);
CREATE INDEX idx_tiket_customer ON tiket(customer_id, tanggal_dibuat DESC);

CREATE TABLE tiket_printer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiket_id UUID NOT NULL REFERENCES tiket(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES master_printer(id) ON DELETE RESTRICT,
  mp_no VARCHAR(150) NOT NULL,
  model_id UUID REFERENCES master_printer_model(id) ON DELETE RESTRICT,
  serial_number VARCHAR(150),
  sumber VARCHAR(200),
  peran VARCHAR(30) NOT NULL DEFAULT 'utama',
  hasil VARCHAR(50),
  alasan TEXT,
  tanggal_konfirmasi TIMESTAMPTZ,
  UNIQUE(tiket_id, mp_no, peran)
);
CREATE INDEX idx_tiket_printer_printer ON tiket_printer(printer_id);

CREATE TABLE tiket_barang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiket_id UUID NOT NULL REFERENCES tiket(id) ON DELETE CASCADE,
  toner_id UUID NOT NULL REFERENCES master_toner(id) ON DELETE RESTRICT,
  jumlah NUMERIC(14,2) NOT NULL CHECK (jumlah > 0),
  UNIQUE(tiket_id, toner_id)
);

ALTER TABLE surat_tugas
  ALTER COLUMN account_id DROP NOT NULL,
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN tiket_id UUID REFERENCES tiket(id) ON DELETE RESTRICT,
  ADD COLUMN kontrak_id UUID REFERENCES master_kontrak(id) ON DELETE RESTRICT,
  ADD COLUMN unit_asal_id UUID REFERENCES master_printer(id) ON DELETE RESTRICT,
  ADD COLUMN mode VARCHAR(30),
  ADD COLUMN jenis_tugas VARCHAR(50),
  ADD COLUMN gudang_id UUID REFERENCES master_gudang(id) ON DELETE RESTRICT,
  ADD COLUMN pic_warehouse_id UUID REFERENCES master_pengguna(id) ON DELETE RESTRICT,
  ADD COLUMN lokasi_internal VARCHAR(200),
  ADD COLUMN sumber VARCHAR(200),
  ADD COLUMN tanggal_transaksi TIMESTAMPTZ,
  ADD COLUMN tanggal_akhir TIMESTAMPTZ,
  ADD COLUMN konfirmasi_keluar_pada TIMESTAMPTZ,
  ADD COLUMN konfirmasi_serah_pada TIMESTAMPTZ,
  ADD COLUMN konfirmasi_terima_pada TIMESTAMPTZ;
CREATE INDEX idx_surat_tugas_tiket ON surat_tugas(tiket_id, status);

CREATE TABLE surat_tugas_printer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_tugas_id UUID NOT NULL REFERENCES surat_tugas(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES master_printer(id) ON DELETE RESTRICT,
  mp_no VARCHAR(150) NOT NULL,
  model_id UUID REFERENCES master_printer_model(id) ON DELETE RESTRICT,
  serial_number VARCHAR(150),
  sumber VARCHAR(200),
  peran VARCHAR(30) NOT NULL DEFAULT 'utama',
  hasil VARCHAR(50),
  alasan TEXT,
  kondisi_hasil VARCHAR(30),
  kondisi_sebelum VARCHAR(30),
  konfirmasi_keluar_pada TIMESTAMPTZ,
  konfirmasi_serah_pada TIMESTAMPTZ,
  konfirmasi_terima_pada TIMESTAMPTZ,
  disetujui_kepala_pada TIMESTAMPTZ,
  UNIQUE(surat_tugas_id, mp_no, peran)
);
CREATE INDEX idx_surat_tugas_printer_unit ON surat_tugas_printer(printer_id);

ALTER TABLE master_printer
  DROP CONSTRAINT ck_printer_location,
  ADD COLUMN lokasi_jenis VARCHAR(20) NOT NULL DEFAULT 'gudang'
    CHECK (lokasi_jenis IN ('gudang','customer','internal','transit','keluar')),
  ADD COLUMN penempatan VARCHAR(30) NOT NULL DEFAULT 'none'
    CHECK (penempatan IN ('none','kontrak','trial','stand_by','event','back_up','internal_use','sold')),
  ADD COLUMN kondisi VARCHAR(30) NOT NULL DEFAULT 'ready'
    CHECK (kondisi IN ('ready','checking','in_repair','ready_with_condition','need_repair','unready','kanibal')),
  ADD COLUMN kontrak_id UUID REFERENCES master_kontrak(id) ON DELETE RESTRICT,
  ADD COLUMN lokasi_internal VARCHAR(200);
CREATE INDEX idx_printer_placement ON master_printer(lokasi_jenis, penempatan, kondisi);

ALTER TABLE master_kontrak
  ALTER COLUMN tanggal_selesai DROP NOT NULL,
  ADD COLUMN tiket_id UUID UNIQUE REFERENCES tiket(id) ON DELETE RESTRICT;

-- A legacy installed unit remains at its customer; available units remain in
-- their warehouse. Inactive units keep their last known warehouse reference
-- for historical traceability, but are not counted as available stock.
UPDATE master_printer
SET lokasi_jenis = CASE
    WHEN status = 'installed' THEN 'customer'
    WHEN status = 'available' THEN 'gudang'
    ELSE 'keluar'
  END,
  penempatan = CASE WHEN status = 'installed' THEN 'kontrak' ELSE 'none' END,
  kondisi = 'ready';

INSERT INTO tiket (
  id, nomor_tiket, pengaduan_lama_id, kategori, jenis, status,
  account_id, customer_id, sales_id, tanggal_transaksi, deskripsi,
  ringkasan_penyelesaian, dibuat_oleh, tanggal_dibuat,
  tanggal_diperbarui, tanggal_diselesaikan
)
SELECT
  p.id, p.nomor_pengaduan, p.id, 'komplain', 'on_site_service', p.status::text,
  p.account_id, p.customer_id, p.sales_id, p.tanggal_pengaduan,
  p.deskripsi_masalah, p.ringkasan_penyelesaian, p.dibuat_oleh,
  p.tanggal_dibuat, p.tanggal_diperbarui, p.tanggal_diselesaikan
FROM pengaduan p;

INSERT INTO tiket_printer (tiket_id, printer_id, mp_no, model_id, serial_number)
SELECT p.id, p.printer_id, COALESCE(pr.mp_no, p.mp_no), pr.model_id, pr.serial_number
FROM pengaduan p
LEFT JOIN master_printer pr ON pr.id = p.printer_id
WHERE COALESCE(pr.mp_no, p.mp_no) IS NOT NULL;

UPDATE surat_tugas st SET tiket_id = p.id
FROM pengaduan p WHERE st.pengaduan_id = p.id;

CREATE FUNCTION sinkron_pengaduan_lama_ke_tiket() RETURNS trigger AS $$
BEGIN
  UPDATE tiket SET
    status = NEW.status::text,
    deskripsi = NEW.deskripsi_masalah,
    ringkasan_penyelesaian = NEW.ringkasan_penyelesaian,
    tanggal_transaksi = NEW.tanggal_pengaduan,
    tanggal_diperbarui = NEW.tanggal_diperbarui,
    tanggal_diselesaikan = NEW.tanggal_diselesaikan
  WHERE pengaduan_lama_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sinonim_pengaduan_lama
AFTER UPDATE OF status, deskripsi_masalah, ringkasan_penyelesaian,
  tanggal_pengaduan, tanggal_diperbarui, tanggal_diselesaikan ON pengaduan
FOR EACH ROW EXECUTE FUNCTION sinkron_pengaduan_lama_ke_tiket();

COMMIT;
