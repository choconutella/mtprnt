const ROLE_ALIASES = {
  "sales-admin": "sales_admin",
  "kepala-teknisi": "kepala_teknisi",
  gudang: "warehouse",
  manajer: "kepala_teknisi"
};

const ROLE_LABELS = {
  admin: "admin",
  sales: "sales",
  sales_admin: "sales-admin",
  kepala_teknisi: "kepala-teknisi",
  teknisi: "teknisi",
  warehouse: "warehouse"
};

const ROLE_VALUES = Object.keys(ROLE_LABELS);

function normalisasiRole(role) {
  const nilai = String(role || "").trim().toLowerCase().replace(/\s+/g, "-");
  return ROLE_ALIASES[nilai] || nilai;
}

function tampilkanRole(role) {
  const nilai = normalisasiRole(role);
  return ROLE_LABELS[nilai] || nilai;
}

module.exports = {
  ROLE_VALUES,
  normalisasiRole,
  tampilkanRole
};
