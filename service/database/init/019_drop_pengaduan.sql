BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pengaduan') IS NULL THEN
    RAISE EXCEPTION 'Tabel pengaduan tidak ditemukan; migrasi 019 tidak dapat dilanjutkan.';
  END IF;
  IF EXISTS (SELECT 1 FROM pengaduan) THEN
    RAISE EXCEPTION 'Tabel pengaduan masih berisi data; arsipkan atau migrasikan data sebelum menghapusnya.';
  END IF;
  IF EXISTS (SELECT 1 FROM tiket WHERE pengaduan_lama_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Tiket legacy masih memiliki pengaduan_lama_id; migrasi dihentikan.';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sinonim_pengaduan_lama ON pengaduan;
DROP FUNCTION IF EXISTS sinkron_pengaduan_lama_ke_tiket();

ALTER TABLE tiket DROP COLUMN IF EXISTS pengaduan_lama_id;
DROP TABLE pengaduan;
DROP TYPE IF EXISTS prioritas_pengaduan;
DROP TYPE IF EXISTS status_pengaduan;

COMMIT;
