<script setup>

import { ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()

const nombre = ref('')
const celular = ref('')
const plan = ref('mensual')
const formaPago = ref('efectivo')
const monto = ref('')
const fechaVencimiento = ref('')
const edad = ref('')
const pesoActual = ref('')
const pesoObjetivo = ref('')
const estatura = ref('')
const condicionesFisicas = ref('')
const tipoServicio = ref('')

const guardando = ref(false)
const miembroCreado = ref(false)
const error = ref('')

const diasPorPlan = { diario: 1, semanal: 7, quincena: 15, mensual: 30 }

// Precios sugeridos. El semanal queda vacío hasta confirmar el valor.
const preciosPorPlan = { diario: 6000, semanal: 21000, quincena: 33000, mensual: 60000 }

function calcularVencimiento(planSeleccionado) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  hoy.setDate(hoy.getDate() + (diasPorPlan[planSeleccionado] || 0))
  return hoy.toISOString().split('T')[0]
}

// Sugiere vencimiento y monto cada vez que cambia el plan
watch(plan, (nuevoPlan) => {
  fechaVencimiento.value = calcularVencimiento(nuevoPlan)
  monto.value = preciosPorPlan[nuevoPlan]
}, { immediate: true })

async function guardarMiembro() {
  error.value = ''
  if (!nombre.value.trim()) {
    error.value = 'El nombre es obligatorio'
    return
  }
  if (!fechaVencimiento.value) {
    error.value = 'La fecha de vencimiento es obligatoria'
    return
  }
  if (!monto.value || Number(monto.value) <= 0) {
    error.value = 'Escribe el monto pagado'
    return
  }

  guardando.value = true

  const { data: nuevo, error: insertError } = await supabase
    .from('miembros')
    .insert({
      nombre: nombre.value.trim(),
      celular: celular.value.trim() || null,
      plan: plan.value,
      forma_pago: formaPago.value,
      fecha_vencimiento: fechaVencimiento.value,
      edad: edad.value ? Number(edad.value) : null,
      peso_actual: pesoActual.value ? Number(pesoActual.value) : null,
      peso_objetivo: pesoObjetivo.value ? Number(pesoObjetivo.value) : null,
      estatura: estatura.value ? Number(estatura.value) : null,
      condiciones_fisicas: condicionesFisicas.value.trim() || null,
      tipo_servicio: tipoServicio.value.trim() || null,
    })
    .select('id')
    .single()

  if (insertError) {
    guardando.value = false
    error.value = 'No se pudo guardar: ' + insertError.message
    return
  }

  miembroCreado.value = true

  const { error: pagoError } = await supabase.from('pagos').insert({
    miembro_id: nuevo.id,
    plan: plan.value,
    monto: Number(monto.value),
    forma_pago: formaPago.value,
  })

  guardando.value = false

  if (pagoError) {
    error.value =
      'El miembro se guardó, pero no se pudo registrar el pago: ' + pagoError.message +
      '. No vuelvas a guardarlo (quedaría duplicado).'
    return
  }

  router.push('/miembros')
}
</script>

<template>
  <div class="container mt-4" style="max-width: 600px">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1>Agregar miembro</h1>
      <RouterLink to="/miembros" class="btn btn-outline-secondary btn-sm">Volver</RouterLink>
    </div>

    <form @submit.prevent="guardarMiembro">
      <div class="mb-3">
        <label class="form-label">Nombre *</label>
        <input v-model="nombre" type="text" class="form-control" required />
      </div>

      <div class="mb-3">
        <label class="form-label">Celular</label>
        <input v-model="celular" type="text" class="form-control" />
      </div>

      <div class="row mb-3">
        <div class="col">
          <label class="form-label">Plan *</label>
          <select v-model="plan" class="form-select">
            <option value="diario">Diario</option>
            <option value="semanal">Semanal</option>
            <option value="quincena">Quincena</option>
            <option value="mensual">Mensual</option>
          </select>
        </div>
              <div class="mb-3">
        <label class="form-label">Monto pagado (COP) *</label>
        <input v-model="monto" type="number" min="1" step="1000" class="form-control" required />
        <div class="form-text">Se sugiere según el plan..</div>
      </div>
        <div class="col">
          <label class="form-label">Forma de pago *</label>
          <select v-model="formaPago" class="form-select">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label">Fecha de vencimiento *</label>
        <input v-model="fechaVencimiento" type="date" class="form-control" required />
        <div class="form-text">Se sugiere sola según el plan, pero puedes cambiarla.</div>
      </div>

      <hr class="my-4" />
      <h2 class="h5">Perfil físico (opcional)</h2>

      <div class="row mb-3">
        <div class="col">
          <label class="form-label">Edad</label>
          <input v-model="edad" type="number" min="0" class="form-control" />
        </div>
        <div class="col">
          <label class="form-label">Estatura (cm)</label>
          <input v-model="estatura" type="number" step="0.1" class="form-control" />
        </div>
      </div>

      <div class="row mb-3">
        <div class="col">
          <label class="form-label">Peso actual (kg)</label>
          <input v-model="pesoActual" type="number" step="0.1" class="form-control" />
        </div>
        <div class="col">
          <label class="form-label">Peso objetivo (kg)</label>
          <input v-model="pesoObjetivo" type="number" step="0.1" class="form-control" />
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label">Condiciones físicas</label>
        <textarea v-model="condicionesFisicas" class="form-control" rows="2"></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label">Tipo de servicio</label>
        <input v-model="tipoServicio" type="text" class="form-control" />
      </div>

      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

            <button type="submit" class="btn btn-primary w-100" :disabled="guardando || miembroCreado">
        {{ guardando ? 'Guardando...' : 'Guardar miembro' }}
      </button>
    </form>
  </div>
</template>