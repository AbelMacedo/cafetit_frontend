<script setup lang="ts">
import { ApiError, useApi } from '~/shared/composables/useApi'
import type { ApiResource, CorteCaja } from '~/shared/types/api'
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Cierre de caja con arqueo CIEGO.
 *
 * Fíjate en lo que esta pantalla NO muestra mientras se cuenta: el
 * efectivo esperado. Si se viera, nadie contaría de verdad — se teclearía
 * ese número. La diferencia se revela apenas después de enviar el conteo.
 */
const props = defineProps<{ turnoId: number }>()
const emit = defineEmits<{ cerrado: [], cancelar: [] }>()

const api = useApi()

/*
 * Denominaciones en centavos. Viven en `settings.cash_denominations` del
 * negocio; por ahora se replican aquí hasta que exista el endpoint de
 * configuración.
 */
const denominaciones = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]

const conteo = ref<Record<number, number>>(
  Object.fromEntries(denominaciones.map(d => [d, 0]))
)
const retiro = ref(0)
const notas = ref('')

const trabajando = ref(false)
const error = ref<string | null>(null)
const resultado = ref<CorteCaja | null>(null)

const contado = computed(() =>
  denominaciones.reduce((n, d) => n + d * (conteo.value[d] ?? 0), 0)
)

async function cerrar() {
  trabajando.value = true
  error.value = null

  try {
    const r = await api.post<ApiResource<CorteCaja>>(
      `/cash-sessions/${props.turnoId}/close`,
      {
        counts: conteo.value,
        withdrawal_cents: retiro.value > 0 ? retiro.value : undefined,
        notes: notas.value || undefined
      }
    )
    resultado.value = r.data
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo cerrar la caja.'
  } finally {
    trabajando.value = false
  }
}
</script>

<template>
  <UModal
    :open="true"
    :title="resultado ? 'Corte del turno' : 'Cerrar caja'"
    :ui="{ content: 'max-w-xl' }"
    @update:open="resultado ? emit('cerrado') : emit('cancelar')"
  >
    <template #body>
      <!-- Paso 1: contar, sin ver el esperado -->
      <div
        v-if="!resultado"
        class="space-y-4"
      >
        <p class="text-sm text-beige-600">
          Cuenta el efectivo del cajón y captura cuántas piezas hay de cada
          denominación. El sistema te dirá la diferencia al terminar.
        </p>

        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <div
            v-for="d in denominaciones"
            :key="d"
            class="flex items-center gap-2"
          >
            <span class="w-20 text-sm tabular-nums text-beige-700 dark:text-beige-300">
              {{ formatearCentavos(d) }}
            </span>
            <UInput
              v-model.number="conteo[d]"
              type="number"
              min="0"
              size="sm"
              class="flex-1"
              :ui="{ base: 'tabular-nums text-right' }"
            />
          </div>
        </div>

        <div class="flex items-baseline justify-between border-t border-beige-200 dark:border-beige-800 pt-3">
          <span class="font-medium">Total contado</span>
          <span class="text-2xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
            {{ formatearCentavos(contado) }}
          </span>
        </div>

        <UFormField
          label="Retiro a bóveda"
          help="Cuánto se saca del cajón. Lo que queda pasa como fondo del siguiente turno."
        >
          <UInput
            v-model.number="retiro"
            type="number"
            min="0"
            class="w-full"
            :ui="{ base: 'tabular-nums text-right' }"
          />
        </UFormField>

        <UTextarea
          v-model="notas"
          placeholder="Observaciones del cierre (opcional)"
          class="w-full"
        />

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />
      </div>

      <!-- Paso 2: el corte, ya con la diferencia revelada -->
      <div
        v-else
        class="space-y-4"
      >
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-beige-600">
              Fondo de caja
            </dt>
            <dd class="tabular-nums">
              {{ resultado.dinero_en_caja.fondo.formatted }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-beige-600">
              Ventas en efectivo
            </dt>
            <dd class="tabular-nums">
              {{ resultado.dinero_en_caja.ventas_en_efectivo.formatted }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-beige-600">
              Entradas
            </dt>
            <dd class="tabular-nums">
              {{ resultado.dinero_en_caja.entradas.formatted }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-beige-600">
              Salidas
            </dt>
            <dd class="tabular-nums">
              − {{ resultado.dinero_en_caja.salidas.formatted }}
            </dd>
          </div>
          <div class="flex justify-between border-t border-beige-200 dark:border-beige-800 pt-2">
            <dt class="font-medium">
              Efectivo esperado
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ resultado.dinero_en_caja.efectivo_esperado.formatted }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="font-medium">
              Contado
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ resultado.arqueo.contado.formatted }}
            </dd>
          </div>
        </dl>

        <div
          class="rounded-lg p-4 text-center"
          :class="resultado.arqueo.diferencia.cents === 0
            ? 'bg-success-50 dark:bg-success-950'
            : 'bg-warning-50 dark:bg-warning-950'"
        >
          <p class="text-sm text-beige-700 dark:text-beige-300">
            {{ resultado.arqueo.diferencia.cents === 0
              ? 'La caja cuadra'
              : (resultado.arqueo.hay_faltante ? 'Faltante' : 'Sobrante') }}
          </p>
          <p class="text-3xl font-semibold tabular-nums">
            {{ resultado.arqueo.diferencia.formatted }}
          </p>
        </div>

        <div class="text-sm text-beige-600 text-center">
          Turno #{{ resultado.turno.folio }} · {{ resultado.ventas.cantidad }} ventas ·
          {{ resultado.ventas.total.formatted }}
        </div>
      </div>
    </template>

    <template #footer>
      <div
        v-if="!resultado"
        class="flex w-full gap-2"
      >
        <UButton
          block
          size="lg"
          variant="outline"
          color="neutral"
          :disabled="trabajando"
          @click="emit('cancelar')"
        >
          Cancelar
        </UButton>
        <UButton
          block
          size="lg"
          class="toque"
          :loading="trabajando"
          @click="cerrar"
        >
          Cerrar turno
        </UButton>
      </div>

      <UButton
        v-else
        block
        size="lg"
        class="toque"
        @click="emit('cerrado')"
      >
        Listo
      </UButton>
    </template>
  </UModal>
</template>
