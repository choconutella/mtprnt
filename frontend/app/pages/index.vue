<template>
  <div class="space-y-6">
    <UPageHeader
      title="Dashboard"
      description="Ringkasan operasional MultiPrint. Pilih menu di samping untuk melanjutkan pekerjaan."
    />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UPageCard
        title="Tiket"
        description="Pantau pengaduan dan status tiket layanan."
        icon="i-lucide-phone-call"
        to="/tiket"
      />
      <UPageCard
        title="Surat Tugas"
        description="Kelola pekerjaan teknisi dan alur validasi."
        icon="i-lucide-clipboard-list"
        to="/surat-tugas"
      />
      <UPageCard
        title="Stok Barang"
        description="Akses stok printer, toner, dan sparepart."
        icon="i-lucide-box"
        to="/stok/printer"
      />
    </div>
  </div>
</template>
