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

/**
 * Billetes con los que la gente paga de verdad.
 *
 * Se calculan sobre lo que se cobra EN EFECTIVO, no sobre el total.
 * En un pago partido no son lo mismo: con $70 de venta repartidos en
 * $35 de tarjeta y $35 en efectivo, ofrecer «$70» como entregado es
 * ofrecer un número que parece el importe exacto y no lo es. Nadie da
 * setenta pesos para cubrir treinta y cinco.
 */
const sugerencias = computed(() => {
  const efectivo = montos.value.cash
  if (efectivo <= 0) return []

  const opciones = [efectivo, 5000, 10000, 20000, 50000, 100000]
    .filter(v => v >= efectivo)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)

  return opciones.slice(0, 4)
})

/**
 * Lo recibido sigue al efectivo mientras nadie lo haya tocado.
 *
 * El diálogo abre con todo en efectivo y `recibido` igual al total. Si
 * el cajero reparte el pago y no vuelve a este campo, la venta quedaría
 * diciendo que el cliente entregó el total completo en efectivo para
 * cubrir sólo una parte — y con un cambio que nadie dio.
 *
 * **Sólo se ajusta si venía en el importe exacto anterior.** Un número
 * que el cajero escribió es suyo: pisarlo sería cobrar algo distinto de
 * lo que capturó. Es el mismo criterio que el ajuste por redondeo.
 */
watch(() => montos.value.cash, (nuevo, anterior) => {
  if (recibido.value === anterior) recibido.value = nuevo
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
          <p class="text-sm text-apagado">
            Total a cobrar
          </p>
          <p class="text-4xl font-semibold tabular-nums text-tinta">
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

        <!--
          Estos tres botones NO son un selector de método: son atajos
          que ponen el total entero en uno. El dato de verdad son los
          importes de abajo, y un pago mixto es simplemente más de un
          renglón con cantidad.

          Sin el rótulo parecían un selector —tres botones en fila, uno
          encendido— y al repartir el pago no quedaba ninguno marcado,
          lo que se leía como que algo había fallado. La línea de arriba
          cuesta un renglón y quita la duda entera.
        -->
        <div class="space-y-1.5">
          <p class="text-xs font-medium uppercase tracking-wide text-apagado">
            Cobrar todo con
          </p>

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
        </div>

        <div class="space-y-1.5">
          <p class="text-xs font-medium uppercase tracking-wide text-apagado">
            O repartir el cobro
          </p>

          <div class="space-y-2">
            <div
              v-for="(etiqueta, metodo) in etiquetas"
              :key="`monto-${metodo}`"
              class="flex items-center gap-3"
            >
              <label class="w-32 text-sm text-apagado">{{ etiqueta }}</label>
              <CampoPesos
                v-model="montos[metodo as Metodo]"
                size="lg"
                class="flex-1"
              />
            </div>
          </div>
        </div>

        <div
          v-if="montos.cash > 0"
          class="rounded-lg bg-hundido p-3 space-y-3"
        >
          <!--
            «Efectivo recibido», no «Recibido» a secas.

            Después de repartir el cobro en tres, «Recibido» se lee como
            «cuánto se recibió en total» — y no lo es: aquí sólo entran
            los billetes, porque son lo único de lo que se da cambio. La
            tarjeta y la transferencia llegan por su importe exacto.
          -->
          <div class="flex items-center gap-3">
            <label class="w-36 text-sm text-apagado">Efectivo recibido</label>
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

          <div class="flex items-baseline justify-between border-t border-borde-marcado pt-2">
            <span class="text-sm text-apagado">Cambio</span>
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
