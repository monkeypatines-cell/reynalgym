<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../supabase'
import { construirBuckets, claveDe, desdeDe } from '../utils/periodos'

Chart.register(...registerables)

const periodos = [
  { id: 'dia', nombre: 'Por día' },
  { id: 'semana', nombre: 'Por semana' },
  { id: 'mes', nombre: 'Por mes' },
]

const peso = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const periodo = ref('dia')
const canvas = ref(null)
const error = ref('')
const totales = ref({ efectivo: 0, transferencia: 0, total: 0 })

let grafica = null

function dibujar(etiquetas, efectivo, transferencia, total) {
  if (grafica) grafica.destroy()
  grafica = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [
        { label: 'Efectivo', data: efectivo, backgroundColor: '#16a34a', borderRadius: 4, order: 1 },
        { label: 'Transferencia', data: transferencia, backgroundColor: '#2563eb', borderRadius: 4, order: 1 },
        {
          type: 'line',
          label: 'Total',
          data: total,
          borderColor: '#111827',
          backgroundColor: '#111827',
          tension: 0.3,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: { label: (c) => `${c.dataset.label}: ${peso.format(c.parsed.y)}` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => peso.format(v) },
        },
      },
    },
  })
}

async function cargar() {
  error.value = ''
  const p = periodo.value
  const buckets = construirBuckets(p)

  const { data, error: e } = await supabase
    .from('pagos')
    .select('fecha, monto, forma_pago')
    .gte('fecha', desdeDe(buckets, p))
    .limit(10000)

  if (e) {
    error.value = 'No se pudieron cargar los ingresos'
    return
  }

  const efectivo = new Map(buckets.map((b) => [b.clave, 0]))
  const transferencia = new Map(buckets.map((b) => [b.clave, 0]))

  for (const fila of data) {
    const clave = claveDe(fila.fecha, p)
    const mapa = fila.forma_pago === 'efectivo' ? efectivo : transferencia
    if (mapa.has(clave)) mapa.set(clave, mapa.get(clave) + fila.monto)
  }

  const ef = buckets.map((b) => efectivo.get(b.clave))
  const tr = buckets.map((b) => transferencia.get(b.clave))
  const tot = ef.map((v, i) => v + tr[i])

  const suma = (arr) => arr.reduce((a, b) => a + b, 0)
  totales.value = { efectivo: suma(ef), transferencia: suma(tr), total: suma(tot) }

  dibujar(buckets.map((b) => b.etiqueta), ef, tr, tot)
}

onMounted(cargar)
watch(periodo, cargar)
onBeforeUnmount(() => grafica && grafica.destroy())
</script>

<template>
  <div class="rg-card">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
      <div>
        <h2>Ingresos</h2>
        <p class="rg-sub mb-0">Efectivo, transferencia y total</p>
      </div>
      <div class="btn-group btn-group-sm">
        <button
          v-for="p in periodos"
          :key="p.id"
          type="button"
          class="btn"
          :class="periodo === p.id ? 'btn-primary' : 'btn-outline-secondary'"
          @click="periodo = p.id"
        >
          {{ p.nombre }}
        </button>
      </div>
    </div>

    <div class="rg-legend mb-2">
      <span><i class="rg-dot" style="background: #16a34a"></i>Efectivo {{ peso.format(totales.efectivo) }}</span>
      <span><i class="rg-dot" style="background: #2563eb"></i>Transferencia {{ peso.format(totales.transferencia) }}</span>
      <span><i class="rg-dot" style="background: #111827"></i>Total {{ peso.format(totales.total) }}</span>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div style="position: relative; height: 260px">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>