BEGIN;
ALTER TABLE tiket ADD COLUMN mp_no VARCHAR(150);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tiket t JOIN tiket_printer p ON p.tiket_id = t.id
    GROUP BY t.id, t.jenis, t.mode
    HAVING count(*) FILTER (WHERE p.peran = CASE WHEN t.jenis = 'kontrak' AND t.mode = 'tukar' THEN 'unit_lama' ELSE 'utama' END) > 1
       OR (count(*) > 1 AND count(*) FILTER (WHERE p.peran = CASE WHEN t.jenis = 'kontrak' AND t.mode = 'tukar' THEN 'unit_lama' ELSE 'utama' END) = 0)
  ) THEN RAISE EXCEPTION 'Ada Tiket dengan MP No objek ambigu.';
  END IF;
END $$;
UPDATE tiket t SET mp_no = chosen.mp_no FROM (
  SELECT DISTINCT ON (p.tiket_id) p.tiket_id, p.mp_no
  FROM tiket_printer p JOIN tiket t ON t.id = p.tiket_id
  ORDER BY p.tiket_id,
    CASE WHEN p.peran = CASE WHEN t.jenis = 'kontrak' AND t.mode = 'tukar' THEN 'unit_lama' ELSE 'utama' END THEN 0 ELSE 1 END,
    p.mp_no
) chosen WHERE chosen.tiket_id = t.id;
CREATE INDEX idx_tiket_mp_no ON tiket(mp_no);
DROP TABLE tiket_printer;
COMMIT;
