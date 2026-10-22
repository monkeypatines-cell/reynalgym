<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../supabase'
import { construirBuckets, claveDe, desdeDe } from '../utils/periodos'

Chart.register(...registerables)

const periodos = [
  { id: 'dia', nombre: 'Por día', actual: 'Hoy' },
  { id: 'semana', nombre: 'Por semana', actual: 'Esta semana' },
  { id: 'mes', nombre: 'Por mes', actual: 'Este mes' },
]

const periodo = ref('dia')
const canvas = ref(null)
const error = ref('')
const actual = ref(0)
const etiquetaActual = ref('Hoy')

let grafica = null

function dibujar(etiquetas, valores) {
  if (grafica) grafica.destroy()
  grafica = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Personas',
        data: valores,
        backgroundColor: '#4f46e5',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  })
}

async function cargar() {
  error.value = ''
  const p = periodo.value
  const buckets = construirBuckets(p)

  const { data, error: e } = await supabase
    .from('asistencias')
    .select('fecha, miembro_id')
    .gte('fecha', desdeDe(buckets, p))
    .limit(10000)

  if (e) {
    error.value = 'No se pudo cargar la asistencia'
    return
  }

  // Personas distintas por barra
  const personas = new Map(buckets.map((b) => [b.clave, new Set()]))
  for (const fila of data) {
    const grupo = personas.get(claveDe(fila.fecha, p))
    if (grupo) grupo.add(fila.miembro_id)
  }

  const valores = buckets.map((b) => personas.get(b.clave).size)
  actual.value = valores[valores.length - 1]
  etiquetaActual.value = periodos.find((x) => x.id === p).actual
  dibujar(buckets.map((b) => b.etiqueta), valores)
}

onMounted(cargar)
watch(periodo, cargar)
onBeforeUnmount(() => grafica && grafica.destroy())
</script>

<template>
  <div class="rg-card">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
      <div>
        <h2>Asistencia</h2>
        <p class="rg-sub mb-0">Personas distintas que ingresaron</p>
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

    <div class="small text-muted mb-2">
      {{ etiquetaActual }}: <strong>{{ actual }}</strong>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div style="position: relative; height: 260px">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>