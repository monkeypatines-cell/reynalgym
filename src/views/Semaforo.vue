<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase' // AJUSTA esta ruta a la de tu Login.vue

const estado = ref('espera') // espera | verde | amarillo | rojo
const miembro = ref(null)
const diasRestantes = ref(null)

let canal = null
let temporizador = null

const titulo = computed(() => {
  if (estado.value === 'espera') return 'Coloca tu huella'
  const nombre = miembro.value?.nombre ?? ''
  if (estado.value === 'verde') return `¡Bienvenido, ${nombre}!`
  if (estado.value === 'amarillo') return `${nombre}, tu plan está por vencer`
  return `${nombre}, tu plan está vencido`
})

const detalle = computed(() => {
  if (estado.value === 'espera') return 'Esperando lector...'
  const d = diasRestantes.value
  if (estado.value === 'verde') return `Te quedan ${d} días`
  if (estado.value === 'amarillo') {
    return d === 0 ? 'Tu plan vence hoy' : `Te quedan ${d} día${d === 1 ? '' : 's'}`
  }
  return 'Acércate a recepción para renovar'
})

const vencimiento = computed(() => {
  const f = miembro.value?.fecha_vencimiento
  if (!f) return ''
  const [a, m, d] = String(f).slice(0, 10).split('-')
  return `Vence: ${d}/${m}/${a}`
})

async function mostrar(fila) {
  const { data } = await supabase
    .from('miembros')
    .select('nombre, plan, fecha_vencimiento')
    .eq('id', fila.miembro_id)
    .single()

  miembro.value = data
  diasRestantes.value = fila.dias_restantes
  estado.value = fila.semaforo

  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    estado.value = 'espera'
    miembro.value = null
  }, 8000)
}


  onMounted(() => {
  canal = supabase
    .channel('asistencias-en-vivo')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'asistencias' },
      (payload) => {
        if (payload.eventType === 'DELETE') return
        mostrar(payload.new)
      }
    )
    .subscribe()
})

onUnmounted(() => {
  if (canal) supabase.removeChannel(canal)
  clearTimeout(temporizador)
})
</script>

<template>
  <div class="pantalla" :class="estado">
    <h1>{{ titulo }}</h1>
    <p class="detalle">{{ detalle }}</p>
    <p v-if="miembro" class="plan">
      Plan {{ miembro.plan }} · {{ vencimiento }}
    </p>
  </div>
</template>

<style scoped>
.pantalla {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  color: #fff;
  transition: background-color 0.3s;
}
.espera { background: #1f2937; }
.verde { background: #16a34a; }
.amarillo { background: #eab308; color: #1f2937; }
.rojo { background: #dc2626; }

h1 { font-size: clamp(2rem, 6vw, 4.5rem); margin: 0 0 1rem; }
.detalle { font-size: clamp(1.5rem, 4vw, 3rem); margin: 0 0 1rem; }
.plan { font-size: clamp(1rem, 2.5vw, 1.75rem); opacity: 0.9; margin: 0; }
</style>