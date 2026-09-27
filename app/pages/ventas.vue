<script setup lang="ts">
import VentaDetalleModal from '~/features/sales/components/VentaDetalleModal.vue'
import { type FiltroEstado, useSalesHistory } from '~/features/sales/composables/useSalesHistory'
import { ApiError } from '~/shared/composables/useApi'
import type { Venta } from '~/shared/types/api'

definePageMeta({ middleware: 'auth' })

const toast = useToast()

const {
  visibles, total, totalCobrado, canceladas, desde, hasta, estado, busqueda,
  cargando, error, cargar, detalle, cancelar, hoy
} = useSalesHistory()

onMounted(cargar)

const seleccionada = ref<Venta | null>(null)
const abriendo = ref(false)
const cancelando = ref(false)
const errorCancelacion = ref<string | null>(null)

async function abrir(v: Venta) {
  abriendo.value = true
  errorCancelacion.value = null

  try {
    // El listado no trae líneas ni pagos: se piden al abrir el detalle.
    seleccionada.value = await detalle(v.id)
  } catch {
    toast.add({
      title: 'No se pudo abrir la venta',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    abriendo.value = false
  }
}

async function alCancelar(motivo: string) {
  if (!seleccionada.value) return

  const folio = seleccionada.value.folio
  cancelando.value = true
  errorCancelacion.value = null

  try {
    await cancelar(seleccionada.value.id, motivo)
    seleccionada.value = null

    toast.add({
      title: `Venta #${folio} cancelada`,
      description: 'El inventario volvió a existencias.',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    errorCancelacion.value = e instanceof ApiError ? e.message : 'No se pudo cancelar.'
  } finally {
    cancelando.value = false
  }
}

const estados = [
  { value: 'todas', label: 'Todas las ventas' },
  { value: 'paid', label: 'Sólo cobradas' },
  { value: 'cancelled', label: 'Sólo canceladas' }
]

/**
 * El filtro recarga desde el servidor, no filtra en memoria: el estado es
 * parte de la consulta. Por eso pasa por un `computed` con escritura en
 * lugar de un `v-model` directo.
 */
const estadoFiltro = computed({
  get: () => estado.value as string,
  set: (v: string | number) => {
    estado.value = String(v) as FiltroEstado
    void cargar()
  }
})

async function irAHoy() {
  hoy()
  await cargar()
}

const filtrada = computed(() => estado.value !== 'todas' || busqueda.value.trim() !== '')

async function limpiarFiltros() {
  estado.value = 'todas'
  busqueda.value = ''
  await cargar()
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-6">
    <PaginaTitulo
      titulo="Ventas"
      descripcion="Lo cobrado en el periodo. Abre una para reimprimir su ticket o cancelarla."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <BarraFiltros
      :visibles="visibles.length"
      :total="total"
      :filtrada="filtrada"
      @limpiar="limpiarFiltros"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Folio, cliente o cajero"
          icon="i-lucide-search"
          class="w-56"
        />
      </template>

      <template #filtros>
        <UInput
          v-model="desde"
          type="date"
          size="sm"
          aria-label="Desde"
          @change="cargar"
        />
        <span class="text-sm text-beige-600">a</span>
        <UInput
          v-model="hasta"
          type="date"
          size="sm"
          aria-label="Hasta"
          @change="cargar"
        />

        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-calendar-days"
          @click="irAHoy"
        >
          Hoy
        </UButton>

        <FiltroSelect
          v-model="estadoFiltro"
          :opciones="estados"
          etiqueta="Filtrar por estado"
          icono="i-lucide-circle-check"
          ancho="w-52"
        />
      </template>
    </BarraFiltros>

    <!-- Lo que se cobró, no cuántos renglones hay -->
    <div class="rounded-lg border border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900 p-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm text-beige-600">
          {{ total }} {{ total === 1 ? 'venta' : 'ventas' }} en el periodo
          <template v-if="canceladas > 0">
            · <strong>{{ canceladas }} cancelada{{ canceladas === 1 ? '' : 's' }}</strong>
          </template>
        </p>
        <p class="text-xs text-beige-600 mt-0.5">
          Suma de las cobradas
        </p>
      </div>

      <MontoDinero
        :valor="totalCobrado"
        tamano="grande"
      />
    </div>

    <EsqueletoLista
      v-if="cargando"
      :filas="5"
    />

    <SinResultados
      v-else-if="visibles.length === 0"
      icono="i-lucide-receipt"
      :titulo="filtrada ? 'Ninguna venta coincide' : 'No hay ventas en este periodo'"
      :descripcion="filtrada
        ? 'Prueba con otro rango de fechas o quita los filtros.'
        : 'Las ventas aparecen aquí en cuanto se cobran.'"
    >
      <template #accion>
        <UButton
          v-if="filtrada"
          variant="outline"
          color="neutral"
          @click="limpiarFiltros"
        >
          Quitar filtros
        </UButton>
        <UButton
          v-else
          to="/venta"
          icon="i-lucide-shopping-cart"
        >
          Ir a vender
        </UButton>
      </template>
    </SinResultados>

    <div
      v-else
      class="space-y-2"
    >
      <button
        v-for="v in visibles"
        :key="v.id"
        type="button"
        class="tarjeta w-full text-left p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:border-naranja-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500 transition disabled:opacity-50"
        :class="v.estado === 'cancelled' ? 'opacity-60' : ''"
        :disabled="abriendo"
        @click="abrir(v)"
      >
        <span class="flex items-baseline gap-3 min-w-0 flex-1">
          <span class="w-14 shrink-0 font-semibold tabular-nums">#{{ v.folio }}</span>

          <span class="w-16 shrink-0 text-sm tabular-nums text-beige-600">{{ hora(v.cobrado_en) }}</span>

          <span class="min-w-0 flex-1 text-sm truncate">
            <span v-if="v.cliente">{{ v.cliente }}</span>
            <span
              v-else
              class="text-beige-500"
            >Sin nombre</span>
            <span class="text-xs text-beige-600"> · {{ v.cajero }}</span>
          </span>
        </span>

        <!-- Estado e importe bajan juntos en pantallas angostas -->
        <span class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <UBadge
            v-if="v.estado === 'cancelled'"
            color="error"
            variant="subtle"
            size="sm"
          >
            Cancelada
          </UBadge>

          <MontoDinero :valor="v.total" />
        </span>
      </button>
    </div>

    <VentaDetalleModal
      v-if="seleccionada"
      :venta="seleccionada"
      :cancelando="cancelando"
      :error-cancelacion="errorCancelacion"
      @cancelar="alCancelar"
      @cerrar="seleccionada = null"
    />
  </div>
</template>
