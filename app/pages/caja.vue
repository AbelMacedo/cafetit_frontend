<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import CierreCajaModal from '~/features/cash/components/CierreCajaModal.vue'
import { useCashSession } from '~/features/cash/composables/useCashSession'
import { ApiError, useApi } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'

definePageMeta({ middleware: 'auth', layout: false })

const auth = useAuthStore()
const api = useApi()
const { turno, turnoId, hayTurnoAbierto, cargando, cargar, abrir } = useCashSession()

const fondo = ref(0)
const etiqueta = ref<'matutino' | 'vespertino'>('matutino')
const error = ref<string | null>(null)
const trabajando = ref(false)
const mostrarCierre = ref(false)

async function alCerrarTurno() {
  mostrarCierre.value = false
  await cargar()
}

interface Caja { id: number, name: string }
const cajas = ref<Caja[]>([])
const cajaId = ref<number | null>(null)

onMounted(async () => {
  await cargar()

  // Hoy hay una sola caja; el selector existe porque el modelo ya soporta
  // varias y agregar una segunda no debe requerir tocar esta pantalla.
  try {
    const r = await api.get<{ data: Caja[] }>('/registers')
    cajas.value = r.data
    cajaId.value = r.data[0]?.id ?? null
  } catch {
    cajas.value = []
  }
})

async function abrirCaja() {
  if (cajaId.value === null) {
    error.value = 'No hay una caja configurada.'
    return
  }

  trabajando.value = true
  error.value = null

  try {
    await abrir(cajaId.value, fondo.value, etiqueta.value)
    await navigateTo('/venta')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo abrir la caja.'
  } finally {
    trabajando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-beige-50 dark:bg-beige-950">
    <header class="border-b border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900">
      <div class="px-4 h-14 flex items-center justify-between">
        <NuxtLink
          to="/"
          class="font-semibold text-cafe-800 dark:text-beige-100"
        >
          Cafetit
        </NuxtLink>
        <span class="text-sm text-beige-600">{{ auth.user?.name }}</span>
      </div>
    </header>

    <main class="p-6 flex justify-center">
      <div class="w-full max-w-lg space-y-4">
        <p
          v-if="cargando"
          class="text-sm text-beige-600"
        >
          Consultando el estado de la caja...
        </p>

        <!-- Turno abierto: resumen en vivo (corte X) -->
        <UCard v-else-if="hayTurnoAbierto && turno">
          <template #header>
            <div class="flex items-baseline justify-between">
              <h2 class="font-semibold">
                Turno #{{ turno.turno.folio }}
              </h2>
              <span class="text-sm text-beige-600">{{ turno.turno.etiqueta }}</span>
            </div>
          </template>

          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Cajero
              </dt>
              <dd>{{ turno.turno.cajero }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Fondo de caja
              </dt>
              <dd class="tabular-nums">
                {{ turno.dinero_en_caja.fondo.formatted }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Ventas en efectivo
              </dt>
              <dd class="tabular-nums">
                {{ turno.dinero_en_caja.ventas_en_efectivo.formatted }}
              </dd>
            </div>
            <div class="flex justify-between border-t border-beige-200 dark:border-beige-800 pt-2">
              <dt class="font-medium">
                Efectivo esperado
              </dt>
              <dd class="text-xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
                {{ turno.dinero_en_caja.efectivo_esperado.formatted }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Ventas del turno
              </dt>
              <dd class="tabular-nums">
                {{ turno.ventas.cantidad }} · {{ turno.ventas.total.formatted }}
              </dd>
            </div>
          </dl>

          <template #footer>
            <div class="flex gap-2">
              <UButton
                to="/venta"
                block
                size="lg"
                class="toque"
              >
                Ir a vender
              </UButton>
              <UButton
                block
                size="lg"
                variant="outline"
                color="neutral"
                class="toque"
                @click="mostrarCierre = true"
              >
                Cerrar caja
              </UButton>
            </div>
          </template>
        </UCard>

        <!-- Sin turno: abrir -->
        <UCard v-else>
          <template #header>
            <h2 class="font-semibold">
              Abrir caja
            </h2>
          </template>

          <form
            class="space-y-4"
            @submit.prevent="abrirCaja"
          >
            <UFormField
              label="Turno"
              help="Es sólo una etiqueta para el reporte: las ventas pertenecen al turno que esté abierto, no al horario."
            >
              <div class="grid grid-cols-2 gap-2">
                <UButton
                  v-for="t in (['matutino', 'vespertino'] as const)"
                  :key="t"
                  block
                  size="lg"
                  class="toque capitalize"
                  :variant="etiqueta === t ? 'solid' : 'outline'"
                  color="neutral"
                  @click="etiqueta = t"
                >
                  {{ t }}
                </UButton>
              </div>
            </UFormField>

            <UFormField
              label="Fondo de caja"
              help="Con cuánto efectivo empieza el turno, en centavos."
            >
              <UInput
                v-model.number="fondo"
                type="number"
                min="0"
                class="w-full"
                :ui="{ base: 'tabular-nums text-right text-lg' }"
              />
            </UFormField>

            <p class="text-right text-sm text-beige-600 tabular-nums">
              {{ formatearCentavos(fondo) }}
            </p>

            <UAlert
              v-if="error"
              color="error"
              variant="subtle"
              :title="error"
            />

            <UButton
              type="submit"
              block
              size="xl"
              class="toque"
              :loading="trabajando"
            >
              Abrir caja
            </UButton>
          </form>
        </UCard>
      </div>
    </main>

    <CierreCajaModal
      v-if="mostrarCierre && turnoId !== null"
      :turno-id="turnoId"
      @cerrado="alCerrarTurno"
      @cancelar="mostrarCierre = false"
    />
  </div>
</template>
