<script setup lang="ts">
import type { TipoDescuento } from '~/features/sales/stores/cart'
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Descuento, de línea o de toda la venta.
 *
 * Es el mismo diálogo para los dos porque la decisión es idéntica —
 * cuánto y por qué— y sólo cambia sobre qué se aplica. Lo que sí cambia
 * es la advertencia: un descuento de venta se aplica **sobre el subtotal
 * ya descontado**, y quien acaba de rebajar una línea necesita saberlo
 * antes de rebajar otro 10% encima.
 *
 * **El motivo no es burocracia.** Como no hay roles, cualquiera puede
 * rebajar cualquier precio; lo único que lo hace revisable después es que
 * quede escrito por qué. Por eso se pide, aunque no se obligue: obligarlo
 * produciría «descuento» tecleado cien veces, que es peor que nada porque
 * parece información.
 */
const props = defineProps<{
  /** Sobre qué se aplica: el nombre de la línea, o null si es la venta. */
  concepto: string | null
  /** Importe sobre el que se calcula, en centavos. */
  base: number
  tipo: TipoDescuento
  /** Puntos base si es porcentaje (1000 = 10%), centavos si es monto. */
  valor: number
  motivo: string
  /** Hay descuentos de línea puestos: el de venta se suma encima. */
  avisarAcumulacion?: boolean
}>()

const emit = defineEmits<{
  aplicar: [tipo: TipoDescuento, valor: number, motivo: string]
  quitar: []
  cerrar: []
}>()

const esVenta = computed(() => props.concepto === null)

/** Se edita en unidades humanas: porcentaje con decimal, o pesos. */
const modo = ref<'percent' | 'amount'>(props.tipo === 'amount' ? 'amount' : 'percent')
const porcentaje = ref(props.tipo === 'percent' ? props.valor / 100 : 0)
const montoCentavos = ref(props.tipo === 'amount' ? props.valor : 0)
const motivo = ref(props.motivo)

const atajos = [5, 10, 15, 20, 50]

/** Redondeo mitad-hacia-arriba con enteros, igual que el backend. */
function porBasisPoints(centavos: number, puntosBase: number): number {
  return Math.floor((centavos * puntosBase + 5000) / 10000)
}

const descuento = computed(() => {
  const bruto = modo.value === 'percent'
    ? porBasisPoints(props.base, Math.round(porcentaje.value * 100))
    : montoCentavos.value

  // Nunca más que la base: regalar de más no es un descuento, es un error.
  return Math.min(Math.max(0, bruto), props.base)
})

const resultante = computed(() => props.base - descuento.value)

const tope = computed(() => descuento.value > 0 && descuento.value === props.base)

const listo = computed(() => descuento.value > 0)

function aplicar() {
  if (!listo.value) return

  emit(
    'aplicar',
    modo.value,
    modo.value === 'percent' ? Math.round(porcentaje.value * 100) : montoCentavos.value,
    motivo.value.trim()
  )
}
</script>

<template>
  <UModal
    :open="true"
    :title="esVenta ? 'Descuento a toda la venta' : `Descuento · ${concepto}`"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-5">
        <div class="grid grid-cols-2 gap-2">
          <UButton
            block
            size="lg"
            class="toque"
            :variant="modo === 'percent' ? 'soft' : 'outline'"
            :color="modo === 'percent' ? 'primary' : 'neutral'"
            icon="i-lucide-percent"
            @click="modo = 'percent'"
          >
            Porcentaje
          </UButton>
          <UButton
            block
            size="lg"
            class="toque"
            :variant="modo === 'amount' ? 'soft' : 'outline'"
            :color="modo === 'amount' ? 'primary' : 'neutral'"
            icon="i-lucide-banknote"
            @click="modo = 'amount'"
          >
            Cantidad
          </UButton>
        </div>

        <div
          v-if="modo === 'percent'"
          class="space-y-2"
        >
          <div class="flex items-center gap-3">
            <UInput
              v-model.number="porcentaje"
              type="number"
              min="0"
              max="100"
              step="1"
              size="xl"
              autofocus
              class="flex-1"
              :ui="{ base: 'tabular-nums text-right' }"
            >
              <template #trailing>
                <span class="text-apagado-2">%</span>
              </template>
            </UInput>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="a in atajos"
              :key="a"
              size="sm"
              variant="soft"
              color="neutral"
              @click="porcentaje = a"
            >
              {{ a }}%
            </UButton>
          </div>
        </div>

        <CampoPesos
          v-else
          v-model="montoCentavos"
          size="xl"
          autofocus
          class="w-full"
        />

        <UFormField
          label="¿Por qué?"
          help="Queda en el ticket y en el reporte. Sin roles, es lo único que lo hace revisable después."
        >
          <UInput
            v-model="motivo"
            placeholder="Cortesía, producto del día anterior..."
            class="w-full"
          />
        </UFormField>

        <!-- El resultado, no la fórmula: es lo que se va a cobrar -->
        <div class="rounded-xl bg-hundido p-3 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-apagado">{{ esVenta ? 'Subtotal' : 'Precio' }}</span>
            <span class="tabular-nums">{{ formatearCentavos(base) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-apagado">Descuento</span>
            <span class="tabular-nums text-naranja-600">− {{ formatearCentavos(descuento) }}</span>
          </div>
          <div class="flex items-baseline justify-between border-t border-borde-marcado pt-1.5">
            <span class="font-medium">Queda en</span>
            <span class="text-2xl font-semibold tabular-nums text-tinta">
              {{ formatearCentavos(resultante) }}
            </span>
          </div>
        </div>

        <UAlert
          v-if="tope"
          color="warning"
          variant="subtle"
          title="El descuento cubre el importe completo"
          description="Se va a cobrar cero. Si es una cortesía está bien; si no, revisa la cantidad."
        />

        <UAlert
          v-else-if="esVenta && avisarAcumulacion"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Hay líneas con descuento propio"
          description="Éste se aplica sobre el subtotal que ya quedó rebajado, no sobre el precio de lista."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          v-if="tipo !== 'none'"
          size="lg"
          variant="ghost"
          color="error"
          class="toque"
          @click="emit('quitar')"
        >
          Quitar
        </UButton>

        <div class="flex-1" />

        <UButton
          size="lg"
          variant="outline"
          color="neutral"
          class="toque"
          @click="emit('cerrar')"
        >
          Cancelar
        </UButton>

        <UButton
          size="lg"
          class="toque"
          :disabled="!listo"
          @click="aplicar"
        >
          Aplicar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
