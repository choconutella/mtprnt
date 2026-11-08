BEGIN;

DO $$
BEGIN
  IF to_regclass('public.teknisi_surat_tugas') IS NULL THEN
    RAISE EXCEPTION 'Tabel teknisi_surat_tugas tidak ditemukan; migrasi 020 tidak dapat dilanjutkan.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM teknisi_surat_tugas t
    JOIN master_pengguna u ON u.id = t.teknisi_id
    WHERE u.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Ada teknisi tanpa user_id; migrasi dihentikan.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM teknisi_surat_tugas t
    JOIN master_pengguna u ON u.id = t.teknisi_id
    GROUP BY t.surat_tugas_id, u.user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ada assignment teknisi ganda pada Surat Tugas; migrasi dihentikan.';
  END IF;
END $$;

ALTER TABLE teknisi_surat_tugas RENAME TO surat_tugas_teknisi;
ALTER TABLE surat_tugas_teknisi DROP CONSTRAINT teknisi_surat_tugas_teknisi_id_fkey;
ALTER TABLE surat_tugas_teknisi DROP CONSTRAINT uq_teknisi_surat_tugas;
DROP INDEX idx_teknisi_surat_tugas_teknisi;

ALTER TABLE surat_tugas_teknisi ADD COLUMN teknisi_user_id VARCHAR(20);
UPDATE surat_tugas_teknisi t
SET teknisi_user_id = u.user_id
FROM master_pengguna u
WHERE u.id = t.teknisi_id;

ALTER TABLE surat_tugas_teknisi ALTER COLUMN teknisi_user_id SET NOT NULL;
ALTER TABLE surat_tugas_teknisi DROP COLUMN teknisi_id;
ALTER TABLE surat_tugas_teknisi RENAME COLUMN teknisi_user_id TO teknisi_id;
ALTER TABLE surat_tugas_teknisi
  ADD CONSTRAINT surat_tugas_teknisi_teknisi_id_fkey
  FOREIGN KEY (teknisi_id) REFERENCES master_pengguna(user_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE surat_tugas_teknisi
  ADD CONSTRAINT uq_surat_tugas_teknisi UNIQUE (surat_tugas_id, teknisi_id);
CREATE INDEX idx_surat_tugas_teknisi_teknisi ON surat_tugas_teknisi(teknisi_id);

COMMIT;
