BEGIN;

-- Toner quantities are recorded as Surat Tugas items, not Tiket items.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tiket_barang) THEN
    RAISE EXCEPTION 'tiket_barang masih berisi data; pindahkan rincian toner sebelum menghapus tabel.';
  END IF;
END $$;
DROP TABLE tiket_barang;

COMMIT;
