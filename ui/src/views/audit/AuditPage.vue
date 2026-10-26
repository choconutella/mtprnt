<script setup>
import { ref } from "vue";
import { CalendarDays } from "lucide-vue-next";

defineProps({
  auditFilter: { type: Object, required: true },
  auditPagination: { type: Object, required: true },
  paginatedAuditItems: { type: Array, required: true },
  filteredAuditItems: { type: Array, required: true },
  auditPaginationStart: { type: Number, required: true },
  auditPaginationEnd: { type: Number, required: true },
  auditTotalPages: { type: Number, required: true },
  auditFilterSiap: { type: Boolean, required: true },
  loading: { type: Boolean, required: true },
  valueOf: { type: Function, required: true },
  badgeClass: { type: Function, required: true }
});

defineEmits(["reset-audit-pagination", "load-audit", "reset-audit-filter", "previous-page", "next-page"]);

const tanggalMulaiInput = ref(null);
const tanggalSelesaiInput = ref(null);

function bukaKalender(target) {
  const input = target === "mulai" ? tanggalMulaiInput.value : tanggalSelesaiInput.value;
  if (!input) return;
  input.focus();
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }
  input.click();
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
</script>

<template>
  <section class="audit-filter-panel">
    <label>
      <span>Tanggal Mulai</span>
      <div class="date-input">
        <input ref="tanggalMulaiInput" v-model="auditFilter.tanggal_mulai" type="date" @change="$emit('reset-audit-pagination'); $emit('load-audit')" />
        <button class="date-picker-button" type="button" title="Buka kalender" @click="bukaKalender('mulai')">
          <CalendarDays :size="17" />
        </button>
      </div>
    </label>
    <label>
      <span>Tanggal Selesai</span>
      <div class="date-input">
        <input ref="tanggalSelesaiInput" v-model="auditFilter.tanggal_selesai" type="date" @change="$emit('reset-audit-pagination'); $emit('load-audit')" />
        <button class="date-picker-button" type="button" title="Buka kalender" @click="bukaKalender('selesai')">
          <CalendarDays :size="17" />
        </button>
      </div>
    </label>
    <label>
      <span>User</span>
      <input v-model.trim="auditFilter.user" type="search" placeholder="Nama user" @input="$emit('reset-audit-pagination')" @keyup.enter="$emit('load-audit')" />
    </label>
    <label>
      <span>No Tiket</span>
      <input v-model.trim="auditFilter.nomor_tiket" type="search" placeholder="TKT..." @input="$emit('reset-audit-pagination')" @keyup.enter="$emit('load-audit')" />
    </label>
    <label>
      <span>No Surat Tugas</span>
      <input v-model.trim="auditFilter.nomor_surat_tugas" type="search" placeholder="ST..." @input="$emit('reset-audit-pagination')" @keyup.enter="$emit('load-audit')" />
    </label>
    <div class="audit-filter-actions">
      <button class="secondary-button" type="button" @click="$emit('reset-audit-filter')">Reset</button>
    </div>
  </section>

  <section class="data-panel">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Date and Time</th>
            <th>User</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in paginatedAuditItems" :key="item.id">
            <td>
              <span class="status-badge neutral">{{ item.event_nama || item.aksi || "-" }}</span>
            </td>
            <td>{{ formatDateTime(item.tanggal_audit) }}</td>
            <td>{{ item.nama_pengguna || "-" }}</td>
            <td>{{ item.tabel_keterangan || item.keterangan || "-" }}</td>
          </tr>
          <tr v-if="!filteredAuditItems.length">
            <td colspan="4" class="empty-cell">
              {{ loading ? "Memuat audit..." : auditFilterSiap ? "Audit tidak ditemukan." : "Isi filter tanggal dan user / surat tugas / tiket untuk menampilkan audit." }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination-bar">
      <div class="pagination-size">
        <select v-model.number="auditPagination.pageSize" @change="$emit('reset-audit-pagination')">
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="25">25</option>
        </select>
        <span>Baris per halaman</span>
      </div>
      <span class="pagination-range">
        {{ filteredAuditItems.length ? `Menampilkan ${auditPaginationStart}-${auditPaginationEnd} dari ${filteredAuditItems.length} audit` : "0 audit" }}
      </span>
      <div class="pagination-actions">
        <strong>Halaman {{ Math.min(auditPagination.page, auditTotalPages) }} dari {{ auditTotalPages }}</strong>
        <button class="secondary-button" type="button" title="Sebelumnya" :disabled="auditPagination.page <= 1" @click="$emit('previous-page', auditPagination)">
          &lsaquo;
        </button>
        <button class="secondary-button" type="button" title="Berikutnya" :disabled="auditPagination.page >= auditTotalPages" @click="$emit('next-page', auditPagination, auditTotalPages)">
          &rsaquo;
        </button>
      </div>
    </div>
  </section>
</template>
