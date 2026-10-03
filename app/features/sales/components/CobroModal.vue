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

/**
 * Redondear al peso.
 *
 * Vive en el carrito, no aquí, porque cambia el total que se cobra y ese
 * número lo tiene el carrito. Este diálogo sólo lo enciende y lo apaga.
 */
const redondear = defineModel<boolean>('redondear', { required: true })

/** Lo que quedaría si se redondea; sirve para rotular el botón. */
const conRedondeo = computed(() => {
  const centavos = props.total % 100
  if (centavos === 0) return props.total

  return props.total + (centavos >= 50 ? 100 - centavos : -centavos)
})

/** Un total en pesos exactos no se puede redondear: no hay qué quitar. */
const sePuedeRedondear = computed(() => props.total % 100 !== 0 || redondear.value)

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

/**
 * Si cambia el total, el monto capturado lo sigue.
 *
 * Redondear cambia el total con el diálogo ya abierto. Sin esto, el monto
 * se quedaba en la cifra anterior y el cobro se bloqueaba con un «sobran
 * $0.25» que el cajero no provocó y no entiende.
 *
 * **Sólo se ajusta lo que el cajero no tocó.** Si repartió el pago entre
 * dos métodos, esos números son suyos: pisarlos sería peor que dejar el
 * aviso, porque cobraría algo distinto de lo que capturó.
 */
watch(() => props.total, (nuevo, anterior) => {
  for (const metodo of ['cash', 'card', 'transfer'] as Metodo[]) {
    if (montos.value[metodo] === anterior) montos.value[metodo] = nuevo
  }

  if (recibido.value === anterior) recibido.value = nuevo
})

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

        <!--
          Redondeo al peso.

          Dice a cuánto quedaría antes de aplicarlo: «Redondear a $47.00»
          se entiende de un vistazo, «Redondear» obliga a calcular.
        -->
        <UButton
          v-if="sePuedeRedondear"
          block
          size="lg"
          class="toque"
          :variant="redondear ? 'soft' : 'outline'"
          :color="redondear ? 'primary' : 'neutral'"
          :icon="redondear ? 'i-lucide-check' : 'i-lucide-coins'"
          @click="redondear = !redondear"
        >
          {{ redondear
            ? `Redondeado a ${formatearCentavos(total)}`
            : `Redondear a ${formatearCentavos(conRedondeo)}` }}
        </UButton>

        <div class="grid grid-cols-3 gap-2">
          <UButton
            v-for="(etiqueta, metodo) in etiquetas"
            :key="metodo"
            block
            size="lg"
            :variant="montos[metodo as Metodo] === total ? 'soft' : 'outline'"
            :color="montos[metodo as Metodo] === total ? 'primary' : 'neutral'"
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
            <CampoPesos
              v-model="montos[metodo as Metodo]"
              size="lg"
              class="flex-1"
            />
          </div>
        </div>

        <div
          v-if="montos.cash > 0"
          class="rounded-lg bg-beige-100 dark:bg-beige-900 p-3 space-y-3"
        >
          <div class="flex items-center gap-3">
            <label class="w-32 text-sm text-beige-700 dark:text-beige-300">Recibido</label>
            <CampoPesos
              v-model="recibido"
              size="lg"
              class="flex-1"
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
