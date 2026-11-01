export type NavigationItem = {
  label: string
  icon?: string
  to?: string
  children?: NavigationItem[]
  action?: 'logout'
}

export type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  { label: 'Utama', items: [
    { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
    { label: 'Tiket', icon: 'i-lucide-phone-call', to: '/tiket' },
    { label: 'Surat Tugas', icon: 'i-lucide-clipboard-list', to: '/surat-tugas' }
  ] },
  { label: 'Dataset', items: [
    { label: 'Stok Barang', icon: 'i-lucide-box', children: [
      { label: 'Stok Printer', icon: 'i-lucide-printer', to: '/stok/printer' },
      { label: 'Stok Toner', icon: 'i-lucide-package-plus', to: '/stok/toner' },
      { label: 'Stok Sparepart', icon: 'i-lucide-wrench', to: '/stok/sparepart' }
    ] },
    { label: 'Master Data', icon: 'i-lucide-database', children: [
      { label: 'Account', icon: 'i-lucide-building-2', children: [
        { label: 'Customer', icon: 'i-lucide-users', to: '/master/account/customer' },
        { label: 'Billing', icon: 'i-lucide-receipt', to: '/master/account/billing' }
      ] },
      { label: 'Printer', icon: 'i-lucide-printer', children: [
        { label: 'Kategori Printer', icon: 'i-lucide-printer', to: '/master/printer-kategori' },
        { label: 'Model Printer', icon: 'i-lucide-printer', to: '/master/printer-model' },
        { label: 'Unit Printer', icon: 'i-lucide-printer', to: '/master/printer' }
      ] },
      { label: 'Toner', icon: 'i-lucide-boxes', to: '/master/toner' },
      { label: 'Sparepart', icon: 'i-lucide-wrench', to: '/master/sparepart' },
      { label: 'Lokasi', icon: 'i-lucide-box', children: [
        { label: 'Master Gudang', icon: 'i-lucide-box', to: '/master/gudang' },
        { label: 'Lokasi Customer', icon: 'i-lucide-building-2', to: '/master/lokasi-customer' }
      ] },
      { label: 'User', icon: 'i-lucide-user-round', to: '/master/pengguna' }
    ] }
  ] },
  { label: 'Sistem', items: [
    { label: 'Audit', icon: 'i-lucide-history', to: '/audit' },
    { label: 'Audit Barang', icon: 'i-lucide-boxes', to: '/audit-barang' },
    { label: 'Pengaturan', icon: 'i-lucide-settings', children: [
      { label: 'Role Permission', icon: 'i-lucide-key-round', to: '/pengaturan/role-permission' },
      { label: 'SLA Pending Komplain', icon: 'i-lucide-timer-reset', to: '/pengaturan/sla-pending-komplain' }
    ] }
  ] },
  { label: 'Auth', items: [{ label: 'Keluar', icon: 'i-lucide-log-out', action: 'logout' }] }
]
