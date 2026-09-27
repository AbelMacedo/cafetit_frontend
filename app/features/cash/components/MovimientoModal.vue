<script setup lang="ts">
import { ApiError, useApi } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Entrada o salida de efectivo del turno.
 *
 * Son las líneas que aparecen en el corte: el retiro a bóveda, las
 * propinas entregadas, la compra de insumos. Cada una necesita concepto
 * y monto, porque un movimiento de efectivo sin explicación no sirve de
 * nada tres días después — que es justo cuando hace falta entenderlo.
 */
const props = defineProps<{
  turnoId: number
  /** Para avisar antes de intentar sacar más de lo que hay. */
  efectivoEnCaja: number
}>()

const emit = defineEmits<{ registrado: [], cerrar: [] }>()

const api = useApi()

type Direccion = 'in' | 'out'
type Categoria = 'save' | 'tip' | 'purchase' | 'supplier' | 'change_fund' | 'adjustment' | 'other'

/**
 * `refund` no aparece aquí a propósito: lo genera el sistema al cancelar
 * una venta de un turno ya cerrado. Dejarlo a mano permitiría registrar
 * devoluciones sin la venta que las respalda.
 */
const categorias: Array<{ valor: Categoria, etiqueta: string, direccion: Direccion }> = [
  { valor: 'save', etiqueta: 'Retiro a bóveda', direccion: 'out' },
  { valor: 'tip', etiqueta: 'Propina entregada', direccion: 'out' },
  { valor: 'purchase', etiqueta: 'Compra de insumos', direccion: 'out' },
  { valor: 'supplier', etiqueta: 'Pago a proveedor', direccion: 'out' },
  { valor: 'change_fund', etiqueta: 'Cambio / feria', direccion: 'in' },
  { valor: 'adjustment', etiqueta: 'Ajuste', direccion: 'in' },
  { valor: 'other', etiqueta: 'Otro', direccion: 'out' }
]

const categoria = ref<Categoria>('save')
const direccion = ref<Direccion>('out')
const concepto = ref('')
const montoPesos = ref(0)
const notas = ref('')

const trabajando = ref(false)
const error = ref<string | null>(null)

const montoCentavos = computed(() => Math.round(montoPesos.value * 100))

/**
 * Sacar más de lo que hay lo rechaza el backend, pero avisarlo antes
 * evita que el cajero descubra el problema después de teclear todo.
 */
const excedeLoDisponible = computed(() =>
  direccion.value === 'out' && montoCentavos.value > props.efectivoEnCaja
)

const listo = computed(() =>
  concepto.value.trim().length >= 3
  && montoCentavos.value > 0
  && !excedeLoDisponible.value
)

/** Elegir categoría preselecciona el sentido habitual, sin imponerlo. */
function elegirCategoria(c: typeof categorias[number]) {
  categoria.value = c.valor
  direccion.value = c.direccion
}

async function registrar() {
  if (!listo.value || trabajando.value) return

  trabajando.value = true
  error.value = null

  try {
    await api.post(`/cash-sessions/${props.turnoId}/movements`, {
      direction: direccion.value,
      category: categoria.value,
      concept: concepto.value.trim(),
      amount_cents: montoCentavos.value,
      notes: notas.value || undefined
    })
    emit('registrado')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo registrar el movimiento.'
  } finally {
    trabajando.value = false
  }
}
</script>

<template>
  <UModal
    :open="true"
    title="Movimiento de efectivo"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Concepto">
          <div class="grid grid-cols-2 gap-2">
            <UButton
              v-for="c in categorias"
              :key="c.valor"
              block
              size="sm"
              class="toque"
              :variant="categoria === c.valor ? 'soft' : 'outline'"
              :color="categoria === c.valor ? 'primary' : 'neutral'"
              @click="elegirCategoria(c)"
            >
              {{ c.etiqueta }}
            </UButton>
          </div>
        </UFormField>

        <UFormField label="¿Entra o sale?">
          <div class="grid grid-cols-2 gap-2">
            <UButton
              block
              size="lg"
              class="toque"
              :variant="direccion === 'in' ? 'soft' : 'outline'"
              :color="direccion === 'in' ? 'primary' : 'neutral'"
              icon="i-lucide-arrow-down-to-line"
              @click="direccion = 'in'"
            >
              Entra
            </UButton>
            <UButton
              block
              size="lg"
              class="toque"
              :variant="direccion === 'out' ? 'soft' : 'outline'"
              :color="direccion === 'out' ? 'primary' : 'neutral'"
              icon="i-lucide-arrow-up-from-line"
              @click="direccion = 'out'"
            >
              Sale
            </UButton>
          </div>
        </UFormField>

        <UFormField
          label="Explicación"
          help="Lo que va a leer quien revise el corte. «SAVE matutino», «Propina mesa 4»."
        >
          <UInput
            v-model="concepto"
            placeholder="SAVE matutino"
            autofocus
            class="w-full"
          />
        </UFormField>

        <UFormField label="Monto">
          <div class="flex items-center gap-3">
            <UInput
              v-model.number="montoPesos"
              type="number"
              min="0"
              step="0.5"
              class="w-40"
              :ui="{ base: 'tabular-nums text-right text-lg' }"
            />
            <span class="text-xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
              {{ formatearCentavos(montoCentavos) }}
            </span>
          </div>
        </UFormField>

        <UTextarea
          v-model="notas"
          :rows="2"
          placeholder="Detalle adicional (opcional)"
          class="w-full"
        />

        <UAlert
          v-if="excedeLoDisponible"
          color="warning"
          variant="subtle"
          :title="`En la caja hay ${formatearCentavos(efectivoEnCaja)}`"
          description="No se puede sacar más de lo que hay."
        />

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          block
          size="lg"
          variant="outline"
          color="neutral"
          :disabled="trabajando"
          @click="emit('cerrar')"
        >
          Cancelar
        </UButton>
        <UButton
          block
          size="lg"
          class="toque"
          :loading="trabajando"
          :disabled="!listo"
          @click="registrar"
        >
          Registrar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
