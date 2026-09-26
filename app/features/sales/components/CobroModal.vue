<script setup lang="ts">
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Cobro.
 *
 * Los métodos se capturan como una lista de montos: "mixto" no es una
 * opción, es simplemente más de un renglón con monto. Así el formulario
 * tiene un solo camino, igual que el backend.
 */
const props = defineProps<{
  total: number
  cobrando: boolean
  error: string | null
}>()

const emit = defineEmits<{
  cobrar: [pagos: Array<Record<string, unknown>>]
  cerrar: []
}>()

type Metodo = 'cash' | 'card' | 'transfer'

const etiquetas: Record<Metodo, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia'
}

const montos = ref<Record<Metodo, number>>({ cash: 0, card: 0, transfer: 0 })
const recibido = ref(0)
const referencia = ref('')

const capturado = computed(() => montos.value.cash + montos.value.card + montos.value.transfer)
const faltante = computed(() => props.total - capturado.value)
const cuadra = computed(() => faltante.value === 0)

const cambio = computed(() => {
  if (montos.value.cash <= 0 || recibido.value <= 0) return 0
  return Math.max(0, recibido.value - montos.value.cash)
})

/** Un toque: el método cubre el total completo. Es el caso del 90%. */
function pagarTodo(metodo: Metodo) {
  montos.value = { cash: 0, card: 0, transfer: 0 }
  montos.value[metodo] = props.total
  if (metodo === 'cash') recibido.value = props.total
}

/** Billetes con los que la gente paga de verdad. */
const sugerencias = computed(() => {
  const t = props.total
  const opciones = [t, 10000, 20000, 50000, 100000]
    .filter(v => v >= t)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)

  return opciones.slice(0, 4)
})

function enviar() {
  if (!cuadra.value || props.cobrando) return

  const pagos: Array<Record<string, unknown>> = []

  for (const metodo of ['cash', 'card', 'transfer'] as Metodo[]) {
    const monto = montos.value[metodo]
    if (monto <= 0) continue

    pagos.push({
      method: metodo,
      amount_cents: monto,
      // Sólo el efectivo admite recibido: la base lo impide para el resto.
      ...(metodo === 'cash' && recibido.value > 0 ? { tendered_cents: recibido.value } : {}),
      ...(metodo !== 'cash' && referencia.value ? { reference: referencia.value } : {})
    })
  }

  emit('cobrar', pagos)
}

onMounted(() => pagarTodo('cash'))
</script>

<template>
  <UModal
    :open="true"
    title="Cobrar"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-5">
        <div class="text-center">
          <p class="text-sm text-beige-600">
            Total a cobrar
          </p>
          <p class="text-4xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
            {{ formatearCentavos(total) }}
          </p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <UButton
            v-for="(etiqueta, metodo) in etiquetas"
            :key="metodo"
            block
            size="lg"
            :variant="montos[metodo as Metodo] === total ? 'solid' : 'outline'"
            color="neutral"
            class="toque"
            @click="pagarTodo(metodo as Metodo)"
          >
            {{ etiqueta }}
          </UButton>
        </div>

        <div class="space-y-2">
          <div
            v-for="(etiqueta, metodo) in etiquetas"
            :key="`monto-${metodo}`"
            class="flex items-center gap-3"
          >
            <label class="w-32 text-sm text-beige-700 dark:text-beige-300">{{ etiqueta }}</label>
            <UInput
              v-model.number="montos[metodo as Metodo]"
              type="number"
              min="0"
              class="flex-1"
              :ui="{ base: 'tabular-nums text-right' }"
            />
            <span class="w-24 text-right text-sm tabular-nums text-beige-600">
              {{ formatearCentavos(montos[metodo as Metodo]) }}
            </span>
          </div>
        </div>

        <div
          v-if="montos.cash > 0"
          class="rounded-lg bg-beige-100 dark:bg-beige-900 p-3 space-y-3"
        >
          <div class="flex items-center gap-3">
            <label class="w-32 text-sm text-beige-700 dark:text-beige-300">Recibido</label>
            <UInput
              v-model.number="recibido"
              type="number"
              min="0"
              class="flex-1"
              :ui="{ base: 'tabular-nums text-right' }"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="s in sugerencias"
              :key="s"
              size="xs"
              variant="soft"
              color="neutral"
              @click="recibido = s"
            >
              {{ formatearCentavos(s) }}
            </UButton>
          </div>

          <div class="flex items-baseline justify-between border-t border-beige-300 dark:border-beige-700 pt-2">
            <span class="text-sm text-beige-700 dark:text-beige-300">Cambio</span>
            <span class="text-2xl font-semibold tabular-nums text-primary-600">
              {{ formatearCentavos(cambio) }}
            </span>
          </div>
        </div>

        <UInput
          v-if="montos.card > 0 || montos.transfer > 0"
          v-model="referencia"
          placeholder="Referencia de la terminal o transferencia (opcional)"
          class="w-full"
        />

        <UAlert
          v-if="!cuadra"
          color="warning"
          variant="subtle"
          :title="faltante > 0
            ? `Faltan ${formatearCentavos(faltante)} por capturar`
            : `Sobran ${formatearCentavos(-faltante)}`"
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
          :disabled="cobrando"
          @click="emit('cerrar')"
        >
          Cancelar
        </UButton>
        <UButton
          block
          size="lg"
          class="toque"
          :loading="cobrando"
          :disabled="!cuadra"
          @click="enviar"
        >
          Confirmar cobro
        </UButton>
      </div>
    </template>
  </UModal>
</template>
