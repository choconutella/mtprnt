<script setup>
import { Bar, Doughnut, Line } from "vue-chartjs";

defineProps({
  ringkasanDashboard: { type: Array, required: true },
  lineChartData: { type: Object, required: true },
  statusDonutData: { type: Object, required: true },
  suratTugasBarData: { type: Object, required: true },
  stokDonutData: { type: Object, required: true },
  teknisiBarData: { type: Object, required: true },
  axisOptions: { type: Object, required: true },
  donutOptions: { type: Object, required: true },
  statusKomplain: { type: Array, required: true },
  stokBarang: { type: Array, required: true }
});

function chartTotal(data) {
  return data?.datasets?.[0]?.data?.reduce((total, value) => total + Number(value || 0), 0) || 0;
}
</script>

<template>
  <section class="summary-grid">
    <article v-for="card in ringkasanDashboard" :key="card.label" class="summary-card">
      <component :is="card.icon" :size="23" />
      <span>{{ card.label }}</span>
      <strong>{{ card.value }}</strong>
      <small>{{ card.note }}</small>
    </article>
  </section>

  <section class="dashboard-chart-grid">
    <article class="chart-card chart-card-wide">
      <div class="chart-heading">
        <div>
          <span>Line Chart</span>
          <h2>Tren Tiket</h2>
        </div>
        <strong>{{ chartTotal(lineChartData) }}</strong>
      </div>
      <div class="chart-frame chart-frame-large">
        <Line :data="lineChartData" :options="axisOptions" />
      </div>
    </article>

    <article class="chart-card">
      <div class="chart-heading">
        <div>
          <span>Donut Chart</span>
          <h2>Status Tiket</h2>
        </div>
        <strong>{{ chartTotal(statusDonutData) }}</strong>
      </div>
      <div class="donut-layout">
        <div class="chart-frame donut-frame">
          <Doughnut :data="statusDonutData" :options="donutOptions" />
        </div>
        <div class="chart-legend">
          <span v-for="item in statusKomplain" :key="item.label">
            <i :style="{ background: item.color }"></i>
            {{ item.label }} {{ item.value }}
          </span>
        </div>
      </div>
    </article>

    <article class="chart-card">
      <div class="chart-heading">
        <div>
          <span>Bar Chart</span>
          <h2>Surat Tugas</h2>
        </div>
        <strong>{{ chartTotal(suratTugasBarData) }}</strong>
      </div>
      <div class="chart-frame">
        <Bar :data="suratTugasBarData" :options="axisOptions" />
      </div>
    </article>

    <article class="chart-card">
      <div class="chart-heading">
        <div>
          <span>Donut Chart</span>
          <h2>Komposisi Stok</h2>
        </div>
        <strong>{{ chartTotal(stokDonutData) }}</strong>
      </div>
      <div class="donut-layout">
        <div class="chart-frame donut-frame">
          <Doughnut :data="stokDonutData" :options="donutOptions" />
        </div>
        <div class="chart-legend">
          <span v-for="item in stokBarang" :key="item.label">
            <i :style="{ background: item.color }"></i>
            {{ item.label }} {{ item.value }}
          </span>
        </div>
      </div>
    </article>

    <article class="chart-card">
      <div class="chart-heading">
        <div>
          <span>Bar Chart</span>
          <h2>Beban Teknisi</h2>
        </div>
        <strong>{{ chartTotal(teknisiBarData) }}</strong>
      </div>
      <div class="chart-frame">
        <Bar :data="teknisiBarData" :options="axisOptions" />
      </div>
    </article>
  </section>
</template>
