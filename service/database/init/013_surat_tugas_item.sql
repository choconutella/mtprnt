BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pemakaian_barang_surat_tugas') IS NOT NULL THEN
    IF to_regclass('public.surat_tugas_item') IS NOT NULL THEN
      RAISE EXCEPTION 'Tabel lama dan baru sama-sama ada; rename dibatalkan.';
    END IF;
    ALTER TABLE pemakaian_barang_surat_tugas RENAME TO surat_tugas_item;
  ELSIF to_regclass('public.surat_tugas_item') IS NULL THEN
    RAISE EXCEPTION 'Tabel item Surat Tugas tidak ditemukan.';
  END IF;
END $$;

-- Keep historical audit references aligned with the table's new name.
UPDATE riwayat_audit
SET tabel_sumber = 'surat_tugas_item'
WHERE tabel_sumber = 'pemakaian_barang_surat_tugas';

-- Earlier scripts copied existing complaints to tickets. Cover complaints
-- created after that copy, then move their work orders to tiket_id.
INSERT INTO tiket (
  id, nomor_tiket, pengaduan_lama_id, kategori, jenis, status,
  account_id, customer_id, sales_id, tanggal_transaksi, deskripsi,
  ringkasan_penyelesaian, dibuat_oleh, tanggal_dibuat,
  tanggal_diperbarui, tanggal_diselesaikan
)
SELECT
  p.id, p.nomor_pengaduan, p.id, 'komplain', 'on_site_service',
  CASE p.status::text
    WHEN 'baru' THEN 'new'
    WHEN 'ditugaskan' THEN 'pending'
    WHEN 'diproses' THEN 'progress'
    WHEN 'selesai' THEN 'solved'
    WHEN 'ditutup' THEN 'solved'
    WHEN 'dibatalkan' THEN 'cancelled'
    ELSE p.status::text
  END,
  p.account_id, p.customer_id, p.sales_id, p.tanggal_pengaduan,
  p.deskripsi_masalah, p.ringkasan_penyelesaian, p.dibuat_oleh,
  p.tanggal_dibuat, p.tanggal_diperbarui, p.tanggal_diselesaikan
FROM pengaduan p
WHERE NOT EXISTS (SELECT 1 FROM tiket t WHERE t.id = p.id);

INSERT INTO tiket_printer (tiket_id, printer_id, mp_no, model_id, serial_number)
SELECT p.id, p.printer_id, COALESCE(pr.mp_no, p.mp_no), pr.model_id, pr.serial_number
FROM pengaduan p
LEFT JOIN master_printer pr ON pr.id = p.printer_id
WHERE COALESCE(pr.mp_no, p.mp_no) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tiket_printer tp WHERE tp.tiket_id = p.id AND tp.mp_no = COALESCE(pr.mp_no, p.mp_no));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pengaduan p
    LEFT JOIN tiket t ON t.id = p.id
    WHERE t.pengaduan_lama_id IS DISTINCT FROM p.id
  ) THEN
    RAISE EXCEPTION 'Relasi Komplain lama dan Tiket tidak konsisten; kolom pengaduan_id tidak dihapus.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'surat_tugas' AND column_name = 'pengaduan_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM surat_tugas st
      WHERE st.pengaduan_id IS NOT NULL
        AND st.tiket_id IS NOT NULL
        AND st.tiket_id IS DISTINCT FROM st.pengaduan_id
    ) THEN
      RAISE EXCEPTION 'Relasi Komplain lama dan Tiket tidak konsisten; kolom pengaduan_id tidak dihapus.';
    END IF;
    UPDATE surat_tugas SET tiket_id = pengaduan_id
    WHERE pengaduan_id IS NOT NULL AND tiket_id IS NULL;
    ALTER TABLE surat_tugas DROP COLUMN pengaduan_id;
  END IF;
END $$;

-- The complaint remains editable through the old workflow. Keep its ticket
-- mirror current, including ownership used by work-order permissions.
CREATE OR REPLACE FUNCTION sinkron_pengaduan_lama_ke_tiket() RETURNS trigger AS $$
BEGIN
  UPDATE tiket SET
    nomor_tiket = NEW.nomor_pengaduan,
    status = CASE NEW.status::text
      WHEN 'baru' THEN 'new'
      WHEN 'ditugaskan' THEN 'pending'
      WHEN 'diproses' THEN 'progress'
      WHEN 'selesai' THEN 'solved'
      WHEN 'ditutup' THEN 'solved'
      WHEN 'dibatalkan' THEN 'cancelled'
      ELSE NEW.status::text
    END,
    account_id = NEW.account_id,
    customer_id = NEW.customer_id,
    sales_id = NEW.sales_id,
    deskripsi = NEW.deskripsi_masalah,
    ringkasan_penyelesaian = NEW.ringkasan_penyelesaian,
    tanggal_transaksi = NEW.tanggal_pengaduan,
    tanggal_diperbarui = NEW.tanggal_diperbarui,
    tanggal_diselesaikan = NEW.tanggal_diselesaikan
  WHERE pengaduan_lama_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER trg_sinonim_pengaduan_lama ON pengaduan;
CREATE TRIGGER trg_sinonim_pengaduan_lama
AFTER UPDATE OF nomor_pengaduan, status, account_id, customer_id, sales_id,
  deskripsi_masalah, ringkasan_penyelesaian, tanggal_pengaduan,
  tanggal_diperbarui, tanggal_diselesaikan ON pengaduan
FOR EACH ROW EXECUTE FUNCTION sinkron_pengaduan_lama_ke_tiket();

COMMIT;
