<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { supabase } from '../supabase'
import { colorSemaforo, textoSemaforo, calcularNuevoVencimiento } from '../utils/semaforo'

const route = useRoute()
const id = route.params.id

const miembro = ref(null)
const cargando = ref(true)
const error = ref('')

async function cargarMiembro() {
  cargando.value = true
  error.value = ''
  const { data, error: fetchError } = await supabase
    .from('miembros')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) {
    error.value = 'No se pudo cargar este miembro'
  } else {
    miembro.value = data
  }
  cargando.value = false
}

onMounted(cargarMiembro)

const mostrandoRenovar = ref(false)
const planRenovar = ref('mensual')
const pagoRenovar = ref('efectivo')
const renovando = ref(false)
const errorRenovar = ref('')

function abrirRenovar() {
  planRenovar.value = miembro.value.plan
  pagoRenovar.value = miembro.value.forma_pago
  errorRenovar.value = ''
  mostrandoRenovar.value = true
}

async function confirmarRenovar() {
  renovando.value = true
  errorRenovar.value = ''

  const nuevaFecha = calcularNuevoVencimiento(miembro.value.fecha_vencimiento, planRenovar.value)

  const { data, error: updateError } = await supabase
    .from('miembros')
    .update({
      plan: planRenovar.value,
      forma_pago: pagoRenovar.value,
      fecha_vencimiento: nuevaFecha,
      estado: 'activo',
    })
    .eq('id', id)
    .select()
    .single()

  renovando.value = false

  if (updateError) {
    errorRenovar.value = 'No se pudo renovar: ' + updateError.message
    return
  }

  miembro.value = data
  mostrandoRenovar.value = false
}
</script>

<template>
  <div class="container mt-4" style="max-width: 650px">
    <RouterLink to="/miembros" class="btn btn-outline-secondary btn-sm mb-3">← Volver a Miembros</RouterLink>

    <div v-if="cargando" class="text-center text-muted">Cargando...</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-else-if="miembro" class="card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h1 class="h3 mb-1">{{ miembro.nombre }}</h1>
            <span class="text-muted">{{ miembro.celular || 'Sin celular registrado' }}</span>
          </div>
          <span class="badge fs-6" :class="`bg-${colorSemaforo(miembro.fecha_vencimiento)}`">
            {{ textoSemaforo(miembro.fecha_vencimiento) }}
          </span>
        </div>

        <hr />

        <h2 class="h6 text-uppercase text-muted">Membresía</h2>
        <div class="row mb-3">
          <div class="col-6">
            <div class="text-muted small">Plan</div>
            <div class="text-capitalize">{{ miembro.plan }}</div>
          </div>
          <div class="col-6">
            <div class="text-muted small">Forma de pago</div>
            <div class="text-capitalize">{{ miembro.forma_pago }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Inscripción</div>
            <div>{{ miembro.fecha_inscripcion }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Vencimiento</div>
            <div>{{ miembro.fecha_vencimiento }}</div>
          </div>
        </div>

        <hr />

        <h2 class="h6 text-uppercase text-muted">Perfil físico</h2>
        <div class="row mb-3">
          <div class="col-6">
            <div class="text-muted small">Edad</div>
            <div>{{ miembro.edad ?? '—' }}</div>
          </div>
          <div class="col-6">
            <div class="text-muted small">Estatura</div>
            <div>{{ miembro.estatura ? `${miembro.estatura} cm` : '—' }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Peso actual</div>
            <div>{{ miembro.peso_actual ? `${miembro.peso_actual} kg` : '—' }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Peso objetivo</div>
            <div>{{ miembro.peso_objetivo ? `${miembro.peso_objetivo} kg` : '—' }}</div>
          </div>
          <div class="col-12 mt-2">
            <div class="text-muted small">Condiciones físicas</div>
            <div>{{ miembro.condiciones_fisicas || '—' }}</div>
          </div>
          <div class="col-12 mt-2">
            <div class="text-muted small">Tipo de servicio</div>
            <div>{{ miembro.tipo_servicio || '—' }}</div>
          </div>
        </div>

        <hr />

        <div v-if="!mostrandoRenovar">
          <button
            class="btn w-100"
            :class="colorSemaforo(miembro.fecha_vencimiento) === 'success' ? 'btn-outline-primary' : 'btn-danger'"
            @click="abrirRenovar"
          >
            Renovar membresía
          </button>
        </div>

        <div v-else class="border rounded p-3 bg-light">
          <h2 class="h6">Renovar membresía</h2>
          <div class="row mb-2">
            <div class="col">
              <label class="form-label">Plan</label>
              <select v-model="planRenovar" class="form-select">
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincena">Quincena</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div class="col">
              <label class="form-label">Forma de pago</label>
              <select v-model="pagoRenovar" class="form-select">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>
          <div v-if="errorRenovar" class="alert alert-danger py-2">{{ errorRenovar }}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary flex-grow-1" :disabled="renovando" @click="confirmarRenovar">
              {{ renovando ? 'Guardando...' : 'Confirmar renovación' }}
            </button>
            <button class="btn btn-outline-secondary" @click="mostrandoRenovar = false">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>